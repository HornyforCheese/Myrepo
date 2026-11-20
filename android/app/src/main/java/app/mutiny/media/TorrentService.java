package app.mutiny.media;

import android.app.*;
import android.content.Intent;
import android.os.*;
import org.json.JSONObject;

/** Keeps a user-started torrent running with visible Android foreground controls. */
public final class TorrentService extends Service {
    private final Handler handler = new Handler(Looper.getMainLooper());
    private PowerManager.WakeLock wakeLock;
    private static final String CHANNEL = "mutiny-torrents";
    private final Runnable update = new Runnable() {
        public void run() {
            try {
                JSONObject state = TorrentEngine.get(TorrentService.this).status();
                String stage = state.getString("stage");
                if (stage.equals("stopped") || stage.equals("error")) { stopSelf(); return; }
                String text = stage;
                if (state.optLong("total") > 0) text = (state.optLong("done") * 100 / state.getLong("total")) + "% · " + state.optInt("peers") + " peers";
                getSystemService(NotificationManager.class).notify(101, notification(text));
            } catch (Exception ignored) { }
            handler.postDelayed(this, 2000);
        }
    };
    public void onCreate() {
        super.onCreate();
        getSystemService(NotificationManager.class).createNotificationChannel(new NotificationChannel(CHANNEL, "Torrent downloads", NotificationManager.IMPORTANCE_LOW));
        startForeground(101, notification("Starting torrent…"));
        wakeLock = getSystemService(PowerManager.class).newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "MutinyMedia:torrent");
        wakeLock.acquire(6 * 60 * 60 * 1000L); handler.post(update);
    }
    private Notification notification(String text) {
        PendingIntent open = PendingIntent.getActivity(this, 0, new Intent(this, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP), PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        PendingIntent stop = PendingIntent.getService(this, 1, new Intent(this, TorrentService.class).setAction("STOP"), PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        return new Notification.Builder(this, CHANNEL).setSmallIcon(android.R.drawable.stat_sys_download).setContentTitle("Mutiny Media torrent").setContentText(text).setOngoing(true).setContentIntent(open).addAction(new Notification.Action.Builder(null, "Stop", stop).build()).build();
    }
    public int onStartCommand(Intent intent, int flags, int id) {
        if (intent != null && "STOP".equals(intent.getAction())) { TorrentEngine.get(this).stop(); stopSelf(); }
        return START_NOT_STICKY;
    }
    @Override public void onTimeout(int startId, int type) { TorrentEngine.get(this).stop(); stopSelf(); }
    public void onDestroy() { handler.removeCallbacks(update); if (wakeLock != null && wakeLock.isHeld()) wakeLock.release(); super.onDestroy(); }
    public IBinder onBind(Intent intent) { return null; }
}
