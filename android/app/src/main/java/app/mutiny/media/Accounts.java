package app.mutiny.media;

import org.json.*;
import java.time.Instant;
import java.util.HashMap;
import java.util.Map;

/** Android client for the same Stremio/Nuvio endpoints used by desktop Mutiny. */
public final class Accounts {
    public interface Transport { Object request(String url, String method, JSONObject headers, JSONObject body) throws Exception; }
    private final Secrets secrets;
    private final Transport http;
    private static final String NUVIO = "https://api.nuvio.tv";
    // Public application anon key from desktop Nuvio client, not a user credential.
    private static final String ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzgxNTIxMzQ2LCJleHAiOjE5MzkyMDEzNDZ9.tmQaj682pwzehpqlgCDMnySOqiUvpgRbrE43T4VJpDI";
    public Accounts(Secrets secrets, Transport http) { this.secrets = secrets; this.http = http; }
    private void provider(String value) { if (!value.equals("stremio") && !value.equals("nuvio")) throw new IllegalArgumentException("Choose Stremio or Nuvio"); }
    private JSONObject stremio(String method, JSONObject body) throws Exception {
        JSONObject response = (JSONObject) http.request("https://api.strem.io/api/" + method, "POST", new JSONObject(), body);
        if (response.has("error")) throw new java.io.IOException("Stremio rejected the request. Check your account and try again.");
        Object value = response.opt("result");
        return new JSONObject().put("value", value == null ? JSONObject.NULL : value);
    }
    private JSONObject auth() throws Exception {
        String key = secrets.get("stremio.token"); if (key.isEmpty()) throw new IllegalStateException("Sign in to Stremio first");
        return new JSONObject().put("authKey", key);
    }
    private JSONObject nuvioHeaders(boolean user) throws Exception {
        return new JSONObject().put("apikey", ANON).put("Authorization", "Bearer " + (user ? secrets.get("nuvio.token") : ANON));
    }
    private Object nuvio(String path, String method, JSONObject body) throws Exception {
        if (secrets.get("nuvio.token").isEmpty()) throw new IllegalStateException("Sign in to Nuvio first");
        long expiry;
        try { expiry = Long.parseLong(secrets.get("nuvio.expiry")); }
        catch (NumberFormatException invalid) { expiry = 0; }
        if (System.currentTimeMillis() / 1000 > expiry - 60) {
            JSONObject refresh = (JSONObject) http.request(NUVIO + "/auth/v1/token?grant_type=refresh_token", "POST", nuvioHeaders(false), new JSONObject().put("refresh_token", secrets.get("nuvio.refresh")));
            secrets.putAll(nuvioSession(refresh, false));
        }
        return http.request(NUVIO + path, method, nuvioHeaders(true), body);
    }
    private Map<String,String> nuvioSession(JSONObject session, boolean login) throws Exception {
        String token = session.getString("access_token"), refresh = session.getString("refresh_token");
        if (token.isEmpty() || refresh.isEmpty()) throw new IllegalStateException("Invalid Nuvio session");
        Map<String,String> changes = new HashMap<>();
        changes.put("nuvio.token", token); changes.put("nuvio.refresh", refresh);
        changes.put("nuvio.expiry", String.valueOf(System.currentTimeMillis() / 1000 + session.optLong("expires_in", 3600)));
        JSONObject user = session.optJSONObject("user");
        if (login && (user == null || user.optString("id").isEmpty())) throw new IllegalStateException("Missing Nuvio account identity");
        if (!login && user != null && !secrets.get("nuvio.user").equals(user.optString("id"))) throw new IllegalStateException("Nuvio session identity changed. Sign in again.");
        if (user != null) { changes.put("nuvio.user", user.getString("id")); changes.put("nuvio.email", user.optString("email")); }
        return changes;
    }
    public synchronized JSONObject login(String provider, String email, String password) throws Exception {
        provider(provider);
        if (email.trim().isEmpty() || password.isEmpty()) throw new IllegalArgumentException("Enter email and password");
        Map<String,String> changes = new HashMap<>();
        if (provider.equals("stremio")) {
            JSONObject response = stremio("login", new JSONObject().put("email", email.trim()).put("password", password).put("facebook", false)).getJSONObject("value");
            String token = response.getString("authKey"); if (token.isEmpty()) throw new IllegalStateException("Invalid Stremio session");
            JSONObject user = response.getJSONObject("user");
            changes.put("stremio.token", token); changes.put("stremio.user", user.getString("_id")); changes.put("stremio.email", user.optString("email", email));
        } else changes = nuvioSession((JSONObject) http.request(NUVIO + "/auth/v1/token?grant_type=password", "POST", nuvioHeaders(false), new JSONObject().put("email", email.trim()).put("password", password)), true);
        changes.put(provider + ".addonSnapshot", "");
        changes.put("account.active", provider); changes.put("account.profile", "1");
        secrets.putAll(changes);
        return status();
    }
    public synchronized JSONObject status() throws Exception {
        JSONObject result = new JSONObject().put("active", secrets.get("account.active")).put("profile", secrets.get("account.profile"));
        for (String provider : new String[]{"stremio", "nuvio"}) result.put(provider, new JSONObject().put("signedIn", !secrets.get(provider + ".token").isEmpty()).put("email", secrets.get(provider + ".email")).put("user", secrets.get(provider + ".user")));
        return result;
    }
    public synchronized void logout(String provider) throws Exception {
        provider(provider);
        try { if (provider.equals("stremio")) stremio("logout", auth()); else nuvio("/auth/v1/logout", "POST", new JSONObject()); } catch (Exception ignored) { /* Always permit local sign-out when offline. */ }
        Map<String,String> changes = new HashMap<>();
        for (String suffix : new String[]{"token", "refresh", "expiry", "user", "email", "addonSnapshot"}) changes.put(provider + "." + suffix, "");
        if (secrets.get("account.active").equals(provider)) changes.put("account.active", "");
        secrets.putAll(changes);
    }
    public synchronized JSONObject sync(String provider, int profile) throws Exception {
        provider(provider); if (profile < 1 || profile > 6) throw new IllegalArgumentException("Profile must be 1–6");
        JSONObject result = new JSONObject();
        if (provider.equals("stremio")) {
            JSONArray ids = stremio("datastoreMeta", auth().put("collection", "libraryItem")).optJSONArray("value"), keys = new JSONArray();
            if (ids != null) for (int i = 0; i < ids.length(); i++) keys.put(ids.getJSONArray(i).getString(0));
            JSONArray items = new JSONArray();
            // Bound each API request without silently truncating a large library.
            for (int offset = 0; offset < keys.length(); offset += 200) {
                JSONArray batch = new JSONArray(); for (int i = offset; i < Math.min(keys.length(), offset + 200); i++) batch.put(keys.get(i));
                JSONArray part = stremio("datastoreGet", auth().put("collection", "libraryItem").put("ids", batch).put("all", true)).getJSONArray("value");
                for (int i = 0; i < part.length(); i++) items.put(part.get(i));
            }
            result.put("library", items).put("progress", items);
            result.put("addons", stremio("addonCollectionGet", auth().put("type", "user").put("update", false)).getJSONObject("value").getJSONArray("addons"));
            result.put("profiles", new JSONArray()); profile = 1;
        } else {
            JSONArray profiles = (JSONArray) nuvio("/rest/v1/profiles?order=profile_index.asc", "GET", null);
            JSONObject chosen = unlockedProfile(profiles, profile);
            int addonProfile = chosen.optBoolean("uses_primary_addons") ? 1 : profile;
            JSONArray library = new JSONArray();
            for (int offset = 0; ; offset += 200) {
                JSONArray part = (JSONArray) nuvio("/rest/v1/rpc/sync_pull_library", "POST", new JSONObject().put("p_profile_id", profile).put("p_limit", 200).put("p_offset", offset));
                for (int i = 0; i < part.length(); i++) library.put(part.get(i));
                if (part.length() < 200) break;
                if (offset >= 10000) throw new IllegalStateException("Nuvio library exceeds the Android sync limit");
            }
            result.put("library", library).put("profiles", profileChoices(profiles))
                .put("addons", nuvio("/rest/v1/addons?profile_id=eq." + addonProfile + "&order=sort_order.asc", "GET", null))
                .put("progress", nuvio("/rest/v1/watch_progress?profile_id=eq." + profile + "&order=last_watched.desc", "GET", null));
        }
        Map<String,String> changes = new HashMap<>();
        JSONObject snapshot = new JSONObject().put("user",secrets.get(provider + ".user")).put("profile",profile)
            .put("addons",result.getJSONArray("addons"));
        changes.put(provider + ".addonSnapshot",snapshot.toString());
        changes.put("account.active", provider); changes.put("account.profile", String.valueOf(profile));
        secrets.putAll(changes);
        return result.put("scope", provider + ":" + secrets.get(provider + ".user") + ":" + profile).put("provider", provider).put("profile", profile);
    }
    public synchronized JSONObject addonSnapshots() throws Exception {
        JSONObject result = new JSONObject();
        for (String provider : new String[]{"stremio","nuvio"}) {
            String user = secrets.get(provider + ".user");
            String raw = secrets.get(provider + ".addonSnapshot");
            if (raw.isEmpty() || user.isEmpty() || secrets.get(provider + ".token").isEmpty()) continue;
            JSONObject snapshot = new JSONObject(raw);
            if (user.equals(snapshot.getString("user"))) result.put(provider,snapshot.put("signedIn",true));
        }
        return result;
    }
    public synchronized void bookmark(JSONObject meta, boolean removed) throws Exception {
        String active = secrets.get("account.active"); if (active.isEmpty()) return;
        String id = meta.getString("id"), type = meta.optString("type", "movie");
        if (!id.matches("(?:tt\\d{5,12}|tmdb:[\\w:]+|kitsu:\\d+)") || (!type.equals("movie") && !type.equals("series"))) throw new IllegalArgumentException("Unsupported library identifier");
        if (active.equals("stremio")) {
            JSONObject item = stremioItem(id, meta);
            item.put("removed", removed).put("temp", removed).put("_mtime", Instant.now().toString());
            stremio("datastorePut", auth().put("collection", "libraryItem").put("changes", new JSONArray().put(item)));
        } else {
            JSONObject item = new JSONObject().put("content_id", id).put("content_type", type);
            String method = removed ? "sync_delete_library_items" : "sync_push_library_items";
            if (!removed) item.put("name", meta.optString("name")).put("poster", meta.optString("poster")).put("poster_shape", "POSTER").put("added_at", System.currentTimeMillis());
            nuvio("/rest/v1/rpc/" + method, "POST", new JSONObject().put("p_profile_id", profile()).put(removed ? "p_keys" : "p_items", new JSONArray().put(item)).put("p_origin_client_id", clientId()));
        }
    }
    private JSONObject stremioItem(String id, JSONObject meta) throws Exception {
        JSONArray found = stremio("datastoreGet", auth().put("collection", "libraryItem").put("ids", new JSONArray().put(id)).put("all", false)).getJSONArray("value");
        for (int i = 0; i < found.length(); i++) if (found.getJSONObject(i).optString("_id").equals(id)) return found.getJSONObject(i);
        return new JSONObject().put("_id", id).put("type", meta.optString("type", "movie")).put("name", meta.optString("name")).put("poster", meta.optString("poster")).put("removed", false).put("temp", true).put("_ctime", Instant.now().toString()).put("state", new JSONObject());
    }
    public synchronized void progress(JSONObject meta, long position, long duration) throws Exception {
        if (!meta.has("scope") || !activeScope().equals(meta.optString("scope"))) return;
        String active = secrets.get("account.active"); if (active.isEmpty() || position < 1000 || duration <= 0) return;
        String id = meta.optString("id"); if (!id.matches("tt\\d{5,12}")) return;
        String videoId = meta.optString("videoId", id); int season = meta.optInt("season", -1), episode = meta.optInt("episode", -1);
        if (active.equals("stremio")) {
            JSONObject item = stremioItem(id, meta), state = item.optJSONObject("state"); if (state == null) state = new JSONObject();
            state.put("timeOffset", position).put("duration", duration).put("video_id", videoId).put("lastWatched", Instant.now().toString());
            if (season >= 0) state.put("season", season).put("episode", episode);
            item.put("state", state).put("_mtime", Instant.now().toString());
            stremio("datastorePut", auth().put("collection", "libraryItem").put("changes", new JSONArray().put(item)));
        } else {
            JSONObject entry = new JSONObject().put("content_id", id).put("content_type", meta.optString("type", "movie")).put("video_id", videoId).put("position", position).put("duration", duration).put("last_watched", System.currentTimeMillis()).put("progress_key", season >= 0 ? id + "_s" + season + "e" + episode : id);
            if (season >= 0) entry.put("season", season).put("episode", episode);
            nuvio("/rest/v1/rpc/sync_push_watch_progress", "POST", new JSONObject().put("p_profile_id", profile()).put("p_entries", new JSONArray().put(entry)).put("p_origin_client_id", clientId()));
        }
    }
    public synchronized JSONArray profiles() throws Exception {
        return profileChoices((JSONArray)nuvio("/rest/v1/profiles?order=profile_index.asc","GET",null));
    }
    private JSONArray profileChoices(JSONArray raw) throws Exception {
        JSONArray choices = new JSONArray();
        for (int i=0; i<raw.length(); i++) {
            JSONObject row = raw.optJSONObject(i);
            int index = row == null ? 0 : row.optInt("profile_index");
            if (index < 1 || index > 6) continue;
            choices.put(new JSONObject().put("index",index).put("name",row.optString("name","Profile " + index))
                .put("locked",!Boolean.FALSE.equals(row.opt("pin_enabled"))));
        }
        return choices;
    }
    private JSONObject unlockedProfile(JSONArray profiles, int index) throws Exception {
        for (int i = 0; i < profiles.length(); i++) {
            JSONObject candidate = profiles.optJSONObject(i);
            if (candidate == null || candidate.optInt("profile_index") != index) continue;
            if (!Boolean.FALSE.equals(candidate.opt("pin_enabled")))
                throw new IllegalStateException("Choose a confirmed, unlocked Nuvio profile.");
            return candidate;
        }
        throw new IllegalArgumentException("Nuvio profile not found");
    }
    private int profile() throws Exception {
        int index = Integer.parseInt(secrets.get("account.profile"));
        JSONArray profiles = (JSONArray) nuvio("/rest/v1/profiles?order=profile_index.asc", "GET", null);
        unlockedProfile(profiles, index);
        return index;
    }
    public synchronized String activeScope() throws Exception {
        String provider = secrets.get("account.active");
        return provider.isEmpty() ? "" : provider + ":" + secrets.get(provider + ".user") + ":" + secrets.get("account.profile");
    }
    private String clientId() throws Exception { String id = secrets.get("client.id"); if (id.isEmpty()) { id = java.util.UUID.randomUUID().toString(); secrets.put("client.id", id); } return id; }
}
