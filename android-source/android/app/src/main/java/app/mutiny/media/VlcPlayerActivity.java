package app.mutiny.media;

import android.app.*;
import android.content.*;
import android.net.Uri;
import android.os.*;
import android.view.*;
import android.widget.*;
import org.videolan.libvlc.*;
import org.videolan.libvlc.util.VLCVideoLayout;
import org.json.JSONObject;
import java.util.*;

/** Bundled libVLC playback with software codec fallback, seeking and track selection. */
public final class VlcPlayerActivity extends Activity {
    private LibVLC vlc;
    private MediaPlayer player;
    private VLCVideoLayout surface;
    private TextView time;
    private SeekBar seek;
    private Button toggle;
    private boolean seeking, wasPlaying;
    private Uri uri;
    private JSONObject meta = new JSONObject();
    private long resume, lastCloudSave;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private final java.util.concurrent.ExecutorService sync = java.util.concurrent.Executors.newSingleThreadExecutor();
    private final Runnable tick = new Runnable() {
        public void run() {
            if (player == null) return;
            long duration = player.getLength(), position = player.getTime();
            if (!seeking && duration > 0) seek.setProgress((int) (position * 1000 / duration));
            time.setText(clock(position) + " / " + clock(duration));
            toggle.setText(player.isPlaying() ? "Pause" : "Play");
            if (System.currentTimeMillis() - lastCloudSave > 30000) saveProgress();
            handler.postDelayed(this, 500);
        }
    };
    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        String url = getIntent().getStringExtra("url");
        uri = getIntent().getData() != null ? getIntent().getData() : url == null ? null : Uri.parse(url);
        boolean local = uri != null && "content".equals(uri.getScheme());
        boolean torrent = url != null && TorrentEngine.get(this).isStreamUrl(url);
        if (uri == null || (!local && !torrent && !UrlPolicy.isPublicHttps(uri.toString()))) { finish(); return; }
        try { meta = new JSONObject(getIntent().getStringExtra("meta") == null ? "{}" : getIntent().getStringExtra("meta")); } catch (Exception ignored) { }
        resume = state == null ? getPreferences(MODE_PRIVATE).getLong(resumeKey(), getIntent().getLongExtra("resume", 0)) : state.getLong("position");
        LinearLayout root = new LinearLayout(this); root.setOrientation(LinearLayout.VERTICAL); root.setBackgroundColor(0xff000000);
        root.setOnApplyWindowInsetsListener((view, insets) -> { view.setPadding(insets.getSystemWindowInsetLeft(), insets.getSystemWindowInsetTop(), insets.getSystemWindowInsetRight(), insets.getSystemWindowInsetBottom()); return insets.consumeSystemWindowInsets(); });
        LinearLayout toolbar = new LinearLayout(this); toolbar.setGravity(Gravity.CENTER_VERTICAL);
        toolbar.addView(control("← Back", () -> finish()));
        toolbar.addView(control("Tracks", () -> tracks()));
        toolbar.addView(control("More", () -> options())); root.addView(toolbar);
        surface = new VLCVideoLayout(this); root.addView(surface, new LinearLayout.LayoutParams(-1, 0, 1));
        time = new TextView(this); time.setTextColor(0xffffffff); time.setPadding(16, 0, 16, 0); root.addView(time);
        seek = new SeekBar(this); seek.setMax(1000); root.addView(seek);
        LinearLayout controls = new LinearLayout(this); controls.setGravity(Gravity.CENTER);
        controls.addView(control("−10s", () -> player.setTime(Math.max(0, player.getTime() - 10000))));
        toggle = control("Pause", () -> { if (player.isPlaying()) player.pause(); else player.play(); }); controls.addView(toggle);
        controls.addView(control("+30s", () -> player.setTime(player.getTime() + 30000))); root.addView(controls);
        setContentView(root);
        try {
            vlc = new LibVLC(this, new ArrayList<>(Arrays.asList("--network-caching=2000", "--file-caching=1000", "--no-video-title-show")));
            player = new MediaPlayer(vlc); player.attachViews(surface, null, true, false);
            player.setEventListener(event -> {
                if (event.type == MediaPlayer.Event.Playing && resume > 0) { player.setTime(resume); resume = 0; }
                if (event.type == MediaPlayer.Event.EncounteredError) new AlertDialog.Builder(this).setTitle("Playback failed").setMessage("The source may be unavailable or require a different playback setting.").setPositiveButton("Open externally", (dialog, which) -> external()).setNegativeButton("Close", (dialog, which) -> finish()).show();
                if (event.type == MediaPlayer.Event.EndReached) saveProgress();
            });
            Media media = local ? new Media(vlc, getContentResolver().openFileDescriptor(uri, "r").getFileDescriptor()) : new Media(vlc, uri);
            media.setHWDecoderEnabled(true, false);
            String rawHeaders = getIntent().getStringExtra("headers");
            if (rawHeaders != null) {
                JSONObject headers = new JSONObject(rawHeaders);
                for (Iterator<String> it = headers.keys(); it.hasNext();) {
                    String key = it.next(), value = headers.optString(key);
                    if (value.contains("\r") || value.contains("\n")) continue;
                    if (key.equalsIgnoreCase("User-Agent")) media.addOption(":http-user-agent=" + value);
                    if (key.equalsIgnoreCase("Referer")) media.addOption(":http-referrer=" + value);
                }
            }
            player.setMedia(media); media.release(); player.play(); handler.post(tick);
        } catch (Throwable failure) {
            new AlertDialog.Builder(this).setTitle("Could not start libVLC").setMessage("This device could not load the bundled media engine or open the video.").setPositiveButton("Close", (dialog, which) -> finish()).show();
        }
        seek.setOnSeekBarChangeListener(new SeekBar.OnSeekBarChangeListener() {
            public void onProgressChanged(SeekBar bar, int value, boolean user) { }
            public void onStartTrackingTouch(SeekBar bar) { seeking = true; }
            public void onStopTrackingTouch(SeekBar bar) { if (player != null && player.getLength() > 0) player.setTime(player.getLength() * bar.getProgress() / 1000); seeking = false; }
        });
    }
    private Button control(String name, Runnable action) { Button button = new Button(this); button.setText(name); button.setOnClickListener(view -> { if (player != null || name.equals("← Back")) action.run(); }); return button; }
    private String clock(long ms) { long seconds = Math.max(0, ms) / 1000; return String.format(Locale.ROOT, "%d:%02d:%02d", seconds / 3600, seconds / 60 % 60, seconds % 60); }
    private void tracks() {
        new AlertDialog.Builder(this).setTitle("Playback tracks").setItems(new String[]{"Audio track", "Subtitle track", "Load subtitle file"}, (dialog, item) -> {
            if (item == 2) { startActivityForResult(new Intent(Intent.ACTION_OPEN_DOCUMENT).setType("*/*").addCategory(Intent.CATEGORY_OPENABLE), 50); return; }
            MediaPlayer.TrackDescription[] tracks = item == 0 ? player.getAudioTracks() : player.getSpuTracks();
            if (tracks == null || tracks.length == 0) { Toast.makeText(this, "No tracks available", Toast.LENGTH_SHORT).show(); return; }
            String[] names = new String[tracks.length]; for (int i = 0; i < tracks.length; i++) names[i] = tracks[i].name;
            new AlertDialog.Builder(this).setTitle(item == 0 ? "Audio" : "Subtitles").setItems(names, (picker, index) -> { if (item == 0) player.setAudioTrack(tracks[index].id); else player.setSpuTrack(tracks[index].id); }).show();
        }).show();
    }
    private void options() {
        new AlertDialog.Builder(this).setTitle("Playback options").setItems(new String[]{"Playback speed", "Fit video", "Open externally"}, (dialog, item) -> {
            if (item == 2) { external(); return; }
            if (item == 1) { player.setVideoScale(MediaPlayer.ScaleType.SURFACE_BEST_FIT); return; }
            float[] rates = {.5f, .75f, 1f, 1.25f, 1.5f, 2f};
            new AlertDialog.Builder(this).setTitle("Speed").setItems(new String[]{"0.5×", "0.75×", "1×", "1.25×", "1.5×", "2×"}, (picker, index) -> player.setRate(rates[index])).show();
        }).show();
    }
    @Override protected void onActivityResult(int code, int result, Intent data) {
        super.onActivityResult(code, result, data);
        if (code == 50 && result == RESULT_OK && data != null && data.getData() != null && player != null) {
            try {
                java.io.File file = new java.io.File(getCacheDir(), "subtitle-" + System.currentTimeMillis() + ".srt");
                try (java.io.InputStream input = getContentResolver().openInputStream(data.getData()); java.io.OutputStream output = new java.io.FileOutputStream(file)) {
                    byte[] bytes = new byte[8192]; int n, total = 0; while ((n = input.read(bytes)) != -1) { total += n; if (total > 10_000_000) throw new java.io.IOException("Subtitle too large"); output.write(bytes, 0, n); }
                }
                player.addSlave(Media.Slave.Type.Subtitle, Uri.fromFile(file), true);
            } catch (Exception error) { Toast.makeText(this, "Unable to open subtitle", Toast.LENGTH_LONG).show(); }
        }
    }
    private void external() { try { startActivity(new Intent(Intent.ACTION_VIEW).setDataAndType(uri, "video/*").addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)); } catch (Exception error) { Toast.makeText(this, "No compatible player installed", Toast.LENGTH_LONG).show(); } }
    private String resumeKey() { return "resume." + Integer.toHexString((meta.optString("scope") + "|" + meta.optString("videoId", uri == null ? "" : uri.toString())).hashCode()); }
    private void saveProgress() {
        if (player == null) return;
        long position = player.getTime(), duration = player.getLength();
        if (duration <= 0 || position < 1000) return;
        getPreferences(MODE_PRIVATE).edit().putLong(resumeKey(), position < duration * .95 ? position : 0).apply();
        lastCloudSave = System.currentTimeMillis();
        sync.submit(() -> { try { NativeApi.get(this).accounts.progress(meta, position, duration); } catch (Exception ignored) { /* Local resume remains available when cloud sync is offline. */ } });
    }
    @Override protected void onPause() { if (player != null) { saveProgress(); wasPlaying = player.isPlaying(); player.pause(); } super.onPause(); }
    @Override protected void onResume() { super.onResume(); if (player != null && wasPlaying) player.play(); }
    @Override protected void onSaveInstanceState(Bundle state) { super.onSaveInstanceState(state); if (player != null) state.putLong("position", player.getTime()); }
    @Override protected void onDestroy() { handler.removeCallbacks(tick); sync.shutdown(); if (player != null) { player.stop(); player.detachViews(); player.release(); } if (vlc != null) vlc.release(); super.onDestroy(); }
}
