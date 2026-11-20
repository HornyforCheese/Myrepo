package app.mutiny.media;

import android.content.Context;
import org.json.*;
import org.libtorrent4j.*;
import java.io.*;
import java.util.concurrent.*;

/** Native libtorrent metadata, file selection, downloading and verified-piece streaming. */
public final class TorrentEngine {
    private static TorrentEngine instance;
    public static synchronized TorrentEngine get(Context context) { if (instance == null) instance = new TorrentEngine(context.getApplicationContext()); return instance; }
    private final Context context;
    private final File directory;
    private final ExecutorService worker = Executors.newSingleThreadExecutor();
    private volatile String stage = "stopped", error = "";
    private volatile SessionManager session;
    private volatile TorrentInfo info;
    private volatile TorrentHandle handle;
    private volatile int selected = -1, generation;
    private volatile TorrentStreamServer server;
    private Future<?> task;
    private JSONObject media = new JSONObject();
    private TorrentEngine(Context context) { this.context = context; directory = new File(context.getFilesDir(), "torrents"); directory.mkdirs(); }
    public synchronized JSONObject add(String magnet, int fileIndex, JSONObject meta) throws Exception {
        if (!stage.equals("stopped") && !stage.equals("error")) throw new IllegalStateException("Stop the current torrent before adding another");
        String normalized = MagnetUri.normalize(magnet);
        stop(); stage = "metadata"; error = ""; media = meta == null ? new JSONObject() : new JSONObject(meta.toString());
        int run = generation;
        task = worker.submit(() -> {
            try {
                SessionManager active = new SessionManager(); session = active;
                active.start(new SessionParams(new SettingsPack().connectionsLimit(100).uploadRateLimit(512 * 1024)));
                byte[] metadata = active.fetchMagnet(normalized, 90, directory);
                if (run != generation) return;
                if (metadata == null) throw new IOException("No torrent metadata received. Check peers, trackers, and your connection.");
                TorrentInfo parsed = new TorrentInfo(metadata);
                for (int i = 0; i < parsed.numFiles(); i++) safeFile(parsed.files().filePath(i));
                info = parsed; stage = "choose-file";
                if (fileIndex >= 0 && fileIndex < parsed.numFiles()) select(fileIndex);
            } catch (Throwable failure) { if (run == generation) { stage = "error"; error = failure instanceof UnsatisfiedLinkError ? "Torrent native library could not load on this device" : String.valueOf(failure.getMessage()); } }
        });
        context.startForegroundService(new android.content.Intent(context, TorrentService.class));
        return status();
    }
    public synchronized JSONObject select(int index) throws Exception {
        TorrentInfo current = info; SessionManager active = session;
        if (current == null || active == null || index < 0 || index >= current.numFiles()) throw new IllegalArgumentException("Choose a torrent file");
        if (!stage.equals("choose-file")) throw new IllegalStateException("Stop and reopen the torrent to select a different file");
        File file = safeFile(current.files().filePath(index));
        long size = current.files().fileSize(index);
        if (size <= 0 || size > directory.getUsableSpace() + (file.exists() ? file.length() : 0)) throw new IOException("Not enough free storage for this file");
        Priority[] priorities = Priority.array(Priority.IGNORE, current.numFiles()); priorities[index] = Priority.DEFAULT;
        selected = index; stage = "starting"; int run = generation;
        worker.submit(() -> {
            try {
                active.download(current, directory, null, priorities, null, TorrentFlags.SEQUENTIAL_DOWNLOAD);
                TorrentHandle found = null;
                for (int attempts = 0; attempts < 100 && run == generation; attempts++) { found = active.find(current.infoHash()); if (found != null) break; Thread.sleep(100); }
                if (run != generation) return;
                if (found == null) throw new IOException("Unable to start torrent");
                handle = found; stage = "downloading";
            } catch (Exception failure) { if (run == generation) { error = failure.getMessage(); stage = "error"; } }
        });
        return status();
    }
    private File safeFile(String path) throws IOException {
        File file = new File(directory, path).getCanonicalFile();
        if (!file.getPath().startsWith(directory.getCanonicalPath() + File.separator)) throw new IOException("Invalid torrent file path");
        return file;
    }
    public synchronized JSONObject status() throws Exception {
        JSONObject result = new JSONObject().put("stage", stage).put("error", error).put("selected", selected);
        TorrentInfo current = info;
        if (current != null) {
            JSONArray files = new JSONArray();
            for (int i = 0; i < current.numFiles(); i++) files.put(new JSONObject().put("index", i).put("name", current.files().filePath(i)).put("size", current.files().fileSize(i)));
            result.put("files", files).put("name", current.name());
        }
        TorrentHandle currentHandle = handle;
        if (currentHandle != null && currentHandle.isValid() && selected >= 0) {
            TorrentStatus stats = currentHandle.status(); long[] progress = currentHandle.fileProgress();
            long total = current.files().fileSize(selected), done = progress[selected];
            if (done >= total) stage = "ready";
            result.put("stage", stage).put("done", done).put("total", total).put("rate", stats.downloadRate()).put("peers", stats.numPeers());
        }
        return result;
    }
    public synchronized String streamUrl() throws Exception {
        if (handle == null || !handle.isValid() || selected < 0) throw new IllegalStateException("Select a file and wait for the download to start");
        if (server != null) return server.url();
        final TorrentInfo torrent = info; final TorrentHandle torrentHandle = handle; final int index = selected, run = generation;
        final File file = safeFile(torrent.files().filePath(index));
        final long size = torrent.files().fileSize(index), base = torrent.files().fileOffset(index);
        final int pieceLength = torrent.pieceLength();
        server = new TorrentStreamServer(new TorrentStreamServer.PieceSource() {
            public long size() { return size; }
            public int read(long position, byte[] buffer, int length) throws Exception {
                long absolute = base + position; int piece = (int) (absolute / pieceLength);
                int wanted = (int) Math.min(length, pieceLength - absolute % pieceLength);
                // Prioritize the current read and a bounded lookahead, including seeks.
                for (int ahead = 0; ahead < 12 && piece + ahead < torrent.numPieces(); ahead++) torrentHandle.setPieceDeadline(piece + ahead, ahead * 300);
                long deadline = System.currentTimeMillis() + 120000;
                while (run == generation && !Thread.currentThread().isInterrupted() && !torrentHandle.havePiece(piece)) {
                    if (System.currentTimeMillis() > deadline) throw new IOException("Timed out waiting for torrent pieces");
                    Thread.sleep(100);
                }
                if (run != generation || Thread.currentThread().isInterrupted()) throw new IOException("Torrent stopped");
                // havePiece can precede an asynchronous disk flush; retry until the requested bytes exist.
                while (run == generation) {
                    try (RandomAccessFile input = new RandomAccessFile(file, "r")) {
                        if (input.length() >= position + wanted) { input.seek(position); input.readFully(buffer, 0, wanted); return wanted; }
                    } catch (FileNotFoundException ignored) { }
                    if (System.currentTimeMillis() > deadline) throw new IOException("Torrent file not available");
                    Thread.sleep(50);
                }
                throw new IOException("Torrent stopped");
            }
        });
        return server.url();
    }
    public synchronized boolean isStreamUrl(String value) { return server != null && server.url().equals(value); }
    public synchronized JSONObject media() throws Exception { return new JSONObject(media.toString()); }
    public synchronized void stop() {
        generation++;
        if (task != null) task.cancel(true);
        if (server != null) try { server.close(); } catch (IOException ignored) { }
        server = null; handle = null; info = null; selected = -1; stage = "stopped";
        SessionManager active = session; session = null; if (active != null) active.stop();
    }
    public synchronized void clearFiles() throws IOException {
        if (!stage.equals("stopped") && !stage.equals("error")) throw new IOException("Stop the torrent before clearing files");
        deleteTree(directory); directory.mkdirs();
    }
    private void deleteTree(File file) throws IOException {
        if (!file.getCanonicalPath().startsWith(directory.getCanonicalPath())) throw new IOException("Invalid cache path");
        File[] children = file.listFiles(); if (children != null) for (File child : children) deleteTree(child);
        if (file.exists() && !file.delete()) throw new IOException("Unable to clear torrent files");
    }
}
