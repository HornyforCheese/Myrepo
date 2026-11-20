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
        switch (method) {
            case "capabilities": return new JSONObject().put("vlc", true).put("torrent", true).put("accounts", true).put("ai", true).put("cloudstreamDiscovery", true).put("cloudstreamExecution", false).put("pictureInPicture", true);
            case "player.preferences": return PlayerPreferences.configure(context, args);
            case "account.status": return accounts.status();
            case "account.login": return accounts.login(args.getString("provider"), args.getString("email"), args.getString("password"));
            case "account.logout": accounts.logout(args.getString("provider")); return accounts.status();
            case "account.sync": return accounts.sync(args.getString("provider"), args.optInt("profile", 1));
            case "account.bookmark": accounts.bookmark(args.getJSONObject("meta"), args.optBoolean("removed")); return true;
            case "ai.config": return ai.config();
            case "ai.freeModels": return ai.freeModels(args.getString("provider"));
            case "ai.save": return ai.save(args);
            case "ai.chat": return ai.chat(args.getJSONArray("messages"));
            case "ai.suggest": return ai.suggest(args.getString("query"), "media");
            case "cloudstream.discover": return CloudStreamRepository.discover(args.getString("url"), http);
            case "public.get": return http.request(args.getString("url"), "GET", new JSONObject(), null);
            case "download.start": {
                String address = args.getString("url");
                if (!UrlPolicy.isPublicHttps(address)) throw new IllegalArgumentException("Only public HTTPS video downloads are allowed");
                android.net.Uri source = android.net.Uri.parse(address);
                String file = source.getLastPathSegment() == null ? "" : source.getLastPathSegment().split("\\?")[0];
                if (!file.toLowerCase(java.util.Locale.ROOT).matches("[a-z0-9._-]{1,100}\\.(mp4|mkv|webm|mov|m4v|avi)"))
                    throw new IllegalArgumentException("Offline downloads require a direct video file URL, not a web player or playlist");
                android.app.DownloadManager.Request download = new android.app.DownloadManager.Request(source);
                download.setTitle(args.optString("title", "Mutiny Media download").replaceAll("[\\r\\n]", " ").substring(0, Math.min(100, args.optString("title", "Mutiny Media download").length())));
                download.setNotificationVisibility(android.app.DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
                download.setDestinationInExternalPublicDir(android.os.Environment.DIRECTORY_DOWNLOADS, "MutinyMedia-" + System.currentTimeMillis() + "-" + file);
                android.app.DownloadManager manager = (android.app.DownloadManager) context.getSystemService(android.content.Context.DOWNLOAD_SERVICE);
                if (manager == null) throw new IllegalStateException("Android Download Manager is unavailable");
                return new JSONObject().put("downloadId", manager.enqueue(download));
            }
            case "torrent.add":
                if (android.os.Build.VERSION.SDK_INT >= 33 && activity.checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS) != android.content.pm.PackageManager.PERMISSION_GRANTED)
                    activity.runOnUiThread(() -> activity.requestPermissions(new String[]{android.Manifest.permission.POST_NOTIFICATIONS}, 20));
                return TorrentEngine.get(context).add(args.getString("magnet"), args.optInt("fileIndex", -1), args.optJSONObject("meta"));
            case "torrent.status": return TorrentEngine.get(context).status();
            case "torrent.select": return TorrentEngine.get(context).select(args.getInt("index"));
            case "torrent.stop": TorrentEngine.get(context).stop(); context.stopService(new Intent(context, TorrentService.class)); return TorrentEngine.get(context).status();
            case "torrent.clear": TorrentEngine.get(context).clearFiles(); return TorrentEngine.get(context).status();
            case "torrent.play": {
                String url = TorrentEngine.get(context).streamUrl(), meta = TorrentEngine.get(context).media().toString();
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
