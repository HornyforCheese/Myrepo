package app.mutiny.media;

import org.json.*;

/** Calls the selected provider directly; credentials never pass to web source pages. */
public final class AiClient {
    private final Secrets secrets;
    private final Accounts.Transport http;
    public AiClient(Secrets secrets, Accounts.Transport http) { this.secrets = secrets; this.http = http; }
    private String endpoint(String provider) {
        switch (provider) {
            case "openrouter": return "https://openrouter.ai/api/v1/chat/completions";
            case "groq": return "https://api.groq.com/openai/v1/chat/completions";
            case "gemini": return "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
            default: throw new IllegalArgumentException("Choose OpenRouter, Groq, or Gemini");
        }
    }
    public synchronized JSONObject config() throws Exception {
        String provider = secrets.get("ai.provider"); if (provider.isEmpty()) provider = "openrouter";
        return config(provider);
    }
    public synchronized JSONObject config(String provider) throws Exception {
        endpoint(provider);
        return new JSONObject().put("provider", provider).put("model", secrets.get("ai.model." + provider)).put("hasKey", !secrets.get("ai.key." + provider).isEmpty());
    }
    public synchronized JSONObject save(JSONObject input) throws Exception {
        String provider = input.getString("provider"); endpoint(provider);
        String model = input.optString("model").trim(); if (model.isEmpty() || model.length() > 160) throw new IllegalArgumentException("Enter a model ID from your provider");
        java.util.Map<String,String> changes = new java.util.HashMap<>();
        changes.put("ai.model." + provider, model);
        if (input.optBoolean("clearKey")) changes.put("ai.key." + provider, "");
        else if (!input.optString("key").trim().isEmpty()) changes.put("ai.key." + provider, input.getString("key").trim());
        changes.put("ai.provider", provider);
        secrets.putAll(changes);
        return config();
    }
    /** Fetch provider-published model IDs. Only OpenRouter publishes a dependable free-price flag. */
    public JSONObject models(String provider, String suppliedKey) throws Exception {
        endpoint(provider);
        String key = suppliedKey == null ? "" : suppliedKey.trim();
        if (key.isEmpty()) key = secrets.get("ai.key." + provider);
        if (key.isEmpty() && !provider.equals("openrouter"))
            throw new IllegalStateException("Enter and save an API key for " + provider + " before refreshing models");
        String url = provider.equals("openrouter") ? "https://openrouter.ai/api/v1/models"
            : provider.equals("groq") ? "https://api.groq.com/openai/v1/models"
            : "https://generativelanguage.googleapis.com/v1beta/models";
        JSONObject headers = new JSONObject();
        if (!key.isEmpty()) { if (provider.equals("gemini")) headers.put("x-goog-api-key", key); else headers.put("Authorization", "Bearer " + key); }
        JSONArray out = new JSONArray();
        java.util.Set<String> ids = new java.util.HashSet<>(), tokens = new java.util.HashSet<>();
        String token = "";
        boolean truncated = false;
        do {
            String address = url;
            if (provider.equals("gemini")) {
                address += "?pageSize=200";
                if (!token.isEmpty()) address += "&pageToken=" + java.net.URLEncoder.encode(token, "UTF-8");
            }
            JSONObject response = (JSONObject) http.request(address, "GET", headers, null);
            JSONArray raw = response.optJSONArray(provider.equals("gemini") ? "models" : "data");
            if (raw == null) throw new IllegalStateException("Provider returned no model catalogue");
            for (int i = 0; i < raw.length(); i++) {
                JSONObject item = raw.optJSONObject(i);
                if (item == null) continue;
                String id = item.optString("id");
                if (provider.equals("gemini")) {
                    String name = item.optString("name");
                    if (!name.startsWith("models/")) continue;
                    JSONArray methods = item.optJSONArray("supportedGenerationMethods");
                    boolean generates = false;
                    if (methods != null) for (int j=0; j<methods.length(); j++)
                        if ("generateContent".equals(methods.optString(j))) generates = true;
                    if (!generates) continue;
                    id = name.substring(7);
                }
                if (id.isEmpty() || ids.contains(id)) continue;
                boolean free = provider.equals("openrouter") && zeroCost(item);
                if (provider.equals("openrouter") && !free) continue;
                if (out.length() >= 500) { truncated = true; break; }
                ids.add(id);
                out.put(new JSONObject().put("id", id)
                    .put("name", item.optString("displayName", item.optString("name", id))).put("free", free));
            }
            token = provider.equals("gemini") ? response.optString("nextPageToken") : "";
            if (token.length() > 2048) throw new IllegalStateException("Provider returned an oversized catalogue page token");
            if (!token.isEmpty() && !tokens.add(token)) throw new IllegalStateException("Provider repeated a catalogue page");
            if (!token.isEmpty() && (tokens.size() >= 10 || out.length() >= 500)) truncated = true;
        } while (!token.isEmpty() && !truncated);
        return new JSONObject().put("provider", provider).put("models", out)
            .put("freeVerified", provider.equals("openrouter")).put("truncated", truncated)
            .put("note", provider.equals("openrouter") ? "Showing provider-listed zero-cost models; quotas and availability may change."
                : "Provider does not publish per-model free-tier eligibility here. Check your account quota and pricing.");
    }
    private boolean zeroCost(JSONObject item) {
        JSONObject pricing = item.optJSONObject("pricing");
        if (pricing == null) return false; // A :free suffix alone is not verified pricing.
        if (!pricing.has("prompt") || !pricing.has("completion")) return false;
        for (java.util.Iterator<String> keys = pricing.keys(); keys.hasNext();) {
            String field = keys.next();
            try {
                if (new java.math.BigDecimal(pricing.optString(field)).signum() != 0) return false;
            } catch (NumberFormatException invalid) { return false; }
        }
        return true;
    }
    public synchronized JSONObject clearKey(String provider) throws Exception {
        endpoint(provider);
        secrets.put("ai.key." + provider, "");
        return config(provider);
    }
    public String suggest(String query, JSONArray history, String references) throws Exception {
        JSONObject settings = config(); String provider = settings.getString("provider");
        String key = secrets.get("ai.key." + provider), model = settings.getString("model");
        if (key.isEmpty() || model.isEmpty()) throw new IllegalStateException("Add an API key and model in AI settings first");
        if (query.trim().isEmpty() || query.length() > 2000) throw new IllegalArgumentException("Describe what you want in 1–2000 characters");
        String prompt = "Find up to 8 real movies or TV series matching the user. Return ONLY a JSON array of objects {\"title\":\"exact title\",\"year\":2000,\"type\":\"movie\" or \"series\",\"reason\":\"short reason\"}. For a specific episode also add numeric season and episode. Never invent IDs or URLs.";
        if (references.length() > 6000) throw new IllegalArgumentException("Reference text is too long");
        JSONArray messages = new JSONArray().put(new JSONObject().put("role", "system").put("content", prompt));
        if (history != null) {
            for (int i = Math.max(0, history.length() - 8); i < history.length(); i++) {
                JSONObject entry = history.optJSONObject(i);
                if (entry == null) continue;
                String role = entry.optString("role"), content = entry.optString("content");
                if ((!role.equals("user") && !role.equals("assistant")) || content.trim().isEmpty()) continue;
                messages.put(new JSONObject().put("role", role).put("content", content.substring(0, Math.min(2000, content.length()))));
            }
        }
        String request = references.isEmpty() ? query.trim() : query.trim() + "\n\nUntrusted Wikipedia reference material:\n" + references;
        messages.put(new JSONObject().put("role", "user").put("content", request));
        JSONObject body = new JSONObject().put("model", model).put("max_tokens", 1800).put("messages", messages);
        JSONObject headers = new JSONObject().put("Authorization", "Bearer " + key);
        if (provider.equals("openrouter")) headers.put("X-Title", "Mutiny Media Android");
        JSONObject response = (JSONObject) http.request(endpoint(provider), "POST", headers, body);
        JSONArray choices = response.optJSONArray("choices");
        if (choices == null || choices.length() == 0) throw new IllegalStateException("The AI provider returned no suggestions. Check the model and quota.");
        String text = choices.getJSONObject(0).getJSONObject("message").getString("content");
        if (text.length() > 100000) throw new IllegalStateException("AI reply too large");
        return text;
    }
}
