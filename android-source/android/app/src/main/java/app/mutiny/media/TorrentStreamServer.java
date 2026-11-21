package app.mutiny.media;

import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.*;

/** Loopback-only range server. Never returns bytes from an unverified torrent piece. */
public final class TorrentStreamServer implements AutoCloseable {
    public interface PieceSource {
        long size();
        int read(long position, byte[] buffer, int length) throws Exception;
    }
    private final ServerSocket socket;
    private final PieceSource source;
    private final String token = java.util.UUID.randomUUID().toString();
    private final ExecutorService clients = Executors.newFixedThreadPool(4);
    private volatile boolean closed;
    public TorrentStreamServer(PieceSource source) throws IOException {
        this.source = source;
        socket = new ServerSocket(0, 8, InetAddress.getByName("127.0.0.1"));
        Thread thread = new Thread(() -> {
            while (!closed) try { Socket client = socket.accept(); clients.execute(() -> serve(client)); } catch (IOException | RejectedExecutionException ignored) { }
        }, "mutiny-torrent-stream"); thread.setDaemon(true); thread.start();
    }
    public String url() { return "http://127.0.0.1:" + socket.getLocalPort() + "/" + token + "/video"; }
    private void serve(Socket client) {
        try (Socket connection = client) {
            connection.setSoTimeout(10000);
            BufferedReader input = new BufferedReader(new InputStreamReader(connection.getInputStream(), StandardCharsets.US_ASCII));
            String request = input.readLine(); if (request == null || request.length() > 4096) return;
            String[] words = request.split(" ");
            OutputStream output = connection.getOutputStream();
            if (words.length != 3 || !words[1].equals("/" + token + "/video") || (!words[0].equals("GET") && !words[0].equals("HEAD"))) { output.write("HTTP/1.1 404 Not Found\r\nConnection: close\r\nContent-Length: 0\r\n\r\n".getBytes(StandardCharsets.US_ASCII)); return; }
            String rangeHeader = null, line; int total = 0;
            while ((line = input.readLine()) != null && !line.isEmpty()) {
                total += line.length(); if (total > 16000) return;
                if (line.toLowerCase(java.util.Locale.ROOT).startsWith("range:")) rangeHeader = line.substring(6).trim();
            }
            ByteRange range;
            try { range = ByteRange.parse(rangeHeader, source.size()); }
            catch (IllegalArgumentException invalid) { output.write(("HTTP/1.1 416 Range Not Satisfiable\r\nContent-Range: bytes */" + source.size() + "\r\nContent-Length: 0\r\nConnection: close\r\n\r\n").getBytes(StandardCharsets.US_ASCII)); return; }
            String headers = (range.partial ? "HTTP/1.1 206 Partial Content" : "HTTP/1.1 200 OK") + "\r\nAccept-Ranges: bytes\r\nContent-Type: application/octet-stream\r\nContent-Length: " + (range.end - range.start + 1) + (range.partial ? "\r\nContent-Range: bytes " + range.start + "-" + range.end + "/" + source.size() : "") + "\r\nConnection: close\r\n\r\n";
            output.write(headers.getBytes(StandardCharsets.US_ASCII)); output.flush();
            if (words[0].equals("HEAD")) return;
            byte[] buffer = new byte[65536]; long position = range.start;
            while (!closed && position <= range.end) {
                int read = source.read(position, buffer, (int) Math.min(buffer.length, range.end - position + 1));
                if (read <= 0) throw new EOFException("Torrent read ended early");
                output.write(buffer, 0, read); output.flush(); position += read;
            }
        } catch (Exception ignored) { /* A seek cancels the previous range connection. */ }
    }
    public void close() throws IOException { closed = true; socket.close(); clients.shutdownNow(); }
}
