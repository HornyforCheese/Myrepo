package app.mutiny.media;

import org.json.JSONArray;
import org.json.JSONObject;
import java.net.URI;
import java.util.HashSet;
import java.util.Locale;
import java.util.Set;

/** Public CloudStream repository index discovery, NOT a .cs3 binary execution host. */
public final class CloudStreamRepository {
    private static final int MAX_LISTS = 15;
    private static final int MAX_EXTENSIONS = 150;
    private CloudStreamRepository() { }

    private static String resolve(String base, String relative) throws Exception {
        if (relative == null || relative.trim().isEmpty()) throw new IllegalArgumentException("Empty repository URL");
        String address = new URI(base).resolve(relative.trim()).toASCIIString();
        if (!UrlPolicy.isPublicHttps(address)) throw new IllegalArgumentException("CloudStream indexes require a public HTTPS URL");
        return address;
    }

    public static JSONObject discover(String repositoryUrl, JsonHttp http) throws Exception {
        if (!UrlPolicy.isPublicHttps(repositoryUrl)) throw new IllegalArgumentException("Use a public HTTPS CloudStream repository URL");
        Object response = http.request(repositoryUrl, "GET", new JSONObject(), null);
        if (!(response instanceof JSONObject)) throw new IllegalArgumentException("Invalid CloudStream repository index");
        JSONObject repository = (JSONObject) response;
        JSONArray lists = repository.optJSONArray("pluginLists");
        if (lists == null) throw new IllegalArgumentException("Not a CloudStream repository: missing pluginLists");
        if (lists.length() > MAX_LISTS) throw new IllegalArgumentException("Repository contains too many plugin lists");

        JSONArray found = new JSONArray();
        Set<String> seen = new HashSet<>();
        int failedLists = 0;
        for (int index = 0; index < lists.length(); index++) {
            if (found.length() >= MAX_EXTENSIONS) break;
            try {
                String indexUrl = resolve(repositoryUrl, lists.optString(index));
                Object document = http.request(indexUrl, "GET", new JSONObject(), null);
                JSONArray plugins = document instanceof JSONArray ? (JSONArray) document :
                    document instanceof JSONObject ? ((JSONObject) document).optJSONArray("plugins") : null;
                if (plugins == null) { failedLists++; continue; }
                for (int item = 0; item < Math.min(plugins.length(), 500) && found.length() < MAX_EXTENSIONS; item++) {
                    JSONObject plugin = plugins.optJSONObject(item);
                    if (plugin == null || (plugin.has("status") && plugin.optInt("status") == 0)) continue;
                    String name = plugin.optString("name").trim();
                    if (name.isEmpty()) continue;
                    String downloadUrl;
                    try { downloadUrl = resolve(indexUrl, plugin.optString("url")); }
                    catch (Exception ignored) { continue; }
                    if (!new URI(downloadUrl).getPath().toLowerCase(Locale.ROOT).endsWith(".cs3") || !seen.add(downloadUrl)) continue;
                    found.put(new JSONObject()
                        .put("name", name.substring(0, Math.min(120, name.length())))
                        .put("description", plugin.optString("description").substring(0, Math.min(350, plugin.optString("description").length())))
                        .put("version", plugin.optInt("version"))
                        .put("language", plugin.optString("language"))
                        .put("downloadUrl", downloadUrl));
                }
            } catch (Exception ignored) {
                // A broken index should not hide working indexes from the same repository.
                failedLists++;
            }
        }
        return new JSONObject()
            .put("repository", repository.optString("name", "CloudStream repository"))
            .put("extensions", found)
            .put("failedLists", failedLists)
            .put("executionSupported", false)
            .put("warning", "Discovery only. Mutiny Media does not yet execute CloudStream .cs3 extensions.");
    }
}
