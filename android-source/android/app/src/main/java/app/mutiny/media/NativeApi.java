package app.mutiny.media;

import android.app.Activity;
import android.content.*;
import org.json.*;

/** Origin-scoped RPC implementation. Remote WebViews never receive this endpoint. */
public final class NativeApi {
    private static NativeApi instance;
    public static synchronized NativeApi get(android.content.Context context) throws Exception {
        if (instance == null) instance = new NativeApi(context.getApplicationContext()); return instance;
    }
    public final Accounts accounts;
    private final AiClient ai;
    private final JsonHttp http = new JsonHttp();
    private final android.content.Context context;
    private NativeApi(android.content.Context context) throws Exception {
        this.context = context; Secrets secrets = new SecureStore(context); accounts = new Accounts(secrets, http); ai = new AiClient(secrets, http);
    }
    public Object call(Activity activity, String method, JSONObject args) throws Exception {
        TorrentEngine torrent = TorrentEngine.get(context);
        switch (method) {
            case "capabilities": return new JSONObject().put("vlc", true).put("torrent", true).put("accounts", true).put("ai", true);
            case "account.status": return accounts.status();
            case "account.login": return accounts.login(args.getString("provider"), args.getString("email"), args.getString("password"));
            case "account.logout": accounts.logout(args.getString("provider")); return accounts.status();
            case "account.sync": return accounts.sync(args.getString("provider"), args.optInt("profile", 1));
            case "account.bookmark": accounts.bookmark(args.getJSONObject("meta"), args.optBoolean("removed")); return true;
            case "ai.config": return ai.config();
            case "ai.save": return ai.save(args);
            case "ai.suggest": return ai.suggest(args.getString("query"), "media");
            case "public.get": return http.request(args.getString("url"), "GET", new JSONObject(), null);
            case "torrent.add":
                if (android.os.Build.VERSION.SDK_INT >= 33 && activity.checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED)
                    activity.runOnUiThread(() -> activity.requestPermissions(new String[]{android.Manifest.permission.POST_NOTIFICATIONS}, 20));
                return torrent.add(args.getString("magnet"), args.optInt("fileIndex", -1), args.optJSONObject("meta"));
            case "torrent.status": return torrent.status();
            case "torrent.select": return torrent.select(args.getInt("index"));
            case "torrent.stop": torrent.stop(); context.stopService(new Intent(context, TorrentService.class)); return torrent.status();
            case "torrent.clear": torrent.clearFiles(); return torrent.status();
            case "torrent.play": {
                String url = torrent.streamUrl(), meta = torrent.media().toString();
                activity.runOnUiThread(() -> activity.startActivity(new Intent(activity, VlcPlayerActivity.class).putExtra("url", url).putExtra("meta", meta)));
                return true;
            }
            case "video.play": {
                String url = args.getString("url"); if (!UrlPolicy.isPublicHttps(url)) throw new IllegalArgumentException("A public HTTPS video URL is required");
                String meta = args.optJSONObject("meta") == null ? "{}" : args.getJSONObject("meta").toString();
                String headers = args.optJSONObject("headers") == null ? "{}" : args.getJSONObject("headers").toString();
                long resume = Math.max(0, args.optLong("resume"));
                activity.runOnUiThread(() -> activity.startActivity(new Intent(activity, VlcPlayerActivity.class).putExtra("url", url).putExtra("meta", meta).putExtra("headers", headers).putExtra("resume", resume).putExtra("fallbackUrls", args.optJSONArray("fallbackUrls") == null ? "[]" : args.optJSONArray("fallbackUrls").toString()).putExtra("lowBandwidth", args.optBoolean("lowBandwidth"))));
                return true;
            }
            default: throw new IllegalArgumentException("Unknown native command");
        }
    }
}
