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
        return new JSONObject().put("provider", provider).put("model", secrets.get("ai.model." + provider)).put("hasKey", !secrets.get("ai.key." + provider).isEmpty());
    }

    /** Native catalogue lookup keeps remote model metadata off the local WebView. */
    public JSONObject freeModels(String provider) throws Exception {
        endpoint(provider); // Validate requested provider.
        JSONArray models = new JSONArray();
        String notice;
        boolean liveCatalogue = false;
        if ("openrouter".equals(provider)) {
            notice = "Live OpenRouter zero-cost text models. Free models have rate limits and may be unavailable.";
            try {
                Object value = http.request("https://openrouter.ai/api/v1/models", "GET", new JSONObject(), null);
                if (!(value instanceof JSONObject)) throw new IllegalStateException("Invalid model catalogue");
                JSONArray catalog = ((JSONObject) value).optJSONArray("data");
                if (catalog == null) throw new IllegalStateException("No models returned");
                liveCatalogue = true;
                java.util.HashSet<String> added = new java.util.HashSet<>();
                // The free router is a stable zero-cost fallback, not a paid model.
                models.put(new JSONObject().put("id", "openrouter/free").put("label", "Automatic free model (OpenRouter)"));
                added.add("openrouter/free");
                for (int i = 0; i < catalog.length() && models.length() < 100; i++) {
                    JSONObject item = catalog.optJSONObject(i);
                    if (item == null) continue;
                    String id = item.optString("id");
                    JSONObject pricing = item.optJSONObject("pricing");
                    JSONObject architecture = item.optJSONObject("architecture");
                    JSONArray output = architecture == null ? null : architecture.optJSONArray("output_modalities");
                    // Only explicit :free variants are offered here. Zero-cost previews
                    // without :free may still require a funded account, and some API
                    // catalogue entries are non-chat endpoints.
                    if (!id.endsWith(":free") || id.length() > 160 || pricing == null ||
                        id.contains("/rerank") || id.contains("/recraft") ||
                        !zeroPrice(pricing.optString("prompt")) || !zeroPrice(pricing.optString("completion")) ||
                        (output != null && !contains(output, "text")) || !added.add(id)) continue;
                    String name = item.optString("name", id);
                    models.put(new JSONObject().put("id", id).put("label", name.substring(0, Math.min(name.length(), 120))));
                }
            } catch (Exception unavailable) {
                notice = "Live OpenRouter model catalogue unavailable; using the automatic free router. Retry later.";
            }
            if (models.length() == 0) models.put(new JSONObject().put("id", "openrouter/free").put("label", "Automatic free model (OpenRouter)"));
        } else if ("groq".equals(provider)) {
            notice = "Known Groq free-plan text models. Availability depends on your API key, plan and current limits.";
            models.put(new JSONObject().put("id", "openai/gpt-oss-120b").put("label", "GPT-OSS 120B"));
            models.put(new JSONObject().put("id", "openai/gpt-oss-20b").put("label", "GPT-OSS 20B"));
        } else {
            notice = "Gemini models with documented free-tier pricing. Billing, quota and regional eligibility depend on your account.";
            models.put(new JSONObject().put("id", "gemini-3.5-flash-lite").put("label", "Gemini 3.5 Flash-Lite"));
            models.put(new JSONObject().put("id", "gemini-3.1-flash-lite").put("label", "Gemini 3.1 Flash-Lite"));
        }
        return new JSONObject().put("provider", provider).put("models", models)
            .put("catalogueStatus", "openrouter".equals(provider) ? (liveCatalogue ? "live" : "unavailable") : "curated")
            .put("notice", notice);
    }
    private static boolean zeroPrice(String value) {
        try { return !value.isEmpty() && Double.parseDouble(value) == 0.0; }
        catch (Exception invalid) { return false; }
    }
    private static boolean contains(JSONArray list, String target) {
        for (int i = 0; i < list.length(); i++) if (target.equals(list.optString(i))) return true;
        return false;
    }

    public synchronized JSONObject save(JSONObject input) throws Exception {
        String provider = input.getString("provider"); endpoint(provider);
        String model = input.optString("model").trim(); if (model.isEmpty() || model.length() > 160) throw new IllegalArgumentException("Enter a model ID from your provider");
        secrets.put("ai.provider", provider); secrets.put("ai.model." + provider, model);
        if (input.optBoolean("clearKey")) secrets.put("ai.key." + provider, "");
        else if (!input.optString("key").trim().isEmpty()) secrets.put("ai.key." + provider, input.getString("key").trim());
        return config();
    }
    public String suggest(String query, String kind) throws Exception {
        JSONObject settings = config(); String provider = settings.getString("provider");
        String key = secrets.get("ai.key." + provider), model = settings.getString("model");
        if (key.isEmpty() || model.isEmpty()) throw new IllegalStateException("Add an API key and model in AI settings first");
        if (query.trim().isEmpty() || query.length() > 2000) throw new IllegalArgumentException("Describe what you want in 1–2000 characters");
        if (!"media".equals(kind)) throw new IllegalArgumentException("Only media recommendations are supported");
        String prompt = "Find up to 8 real movies, TV series or anime matching the user. Return ONLY a JSON array of objects with title, year, type (movie or series), and short reason. Never invent IDs, URLs, or verified availability.";
        JSONObject body = new JSONObject().put("model", model).put("max_tokens", 1800).put("messages", new JSONArray()
            .put(new JSONObject().put("role", "system").put("content", prompt))
            .put(new JSONObject().put("role", "user").put("content", query.trim())));
        JSONObject headers = new JSONObject().put("Authorization", "Bearer " + key);
        if (provider.equals("openrouter")) headers.put("X-Title", "Mutiny Media Android");
        JSONObject response = (JSONObject) http.request(endpoint(provider), "POST", headers, body);
        JSONArray choices = response.optJSONArray("choices");
        if (choices == null || choices.length() == 0) throw new IllegalStateException("The AI provider returned no suggestions. Check the model and quota.");
        String text = choices.getJSONObject(0).getJSONObject("message").getString("content");
        if (text.length() > 100000) throw new IllegalStateException("AI reply too large");
        return text;
    }
    /** Conversational media-only chat with bounded device-supplied history. */
    public String chat(JSONArray history) throws Exception {
        JSONObject settings = config();
        String provider = settings.getString("provider");
        String key = secrets.get("ai.key." + provider);
        String model = settings.getString("model");
        if (key.isEmpty() || model.isEmpty()) throw new IllegalStateException("Configure an AI provider, model and API key in Settings first");
        if (history == null || history.length() == 0) throw new IllegalArgumentException("Enter a message first");
        JSONArray messages = new JSONArray().put(new JSONObject().put("role", "system")
            .put("content", "You are Mutiny Media's media assistant. Help users discuss real films, TV and anime. Answer naturally, allow follow-ups and recommend titles when useful. Do not invent source availability or dubbing status. Avoid spoilers unless requested."));
        int start = Math.max(0, history.length() - 12);
        String lastRole = "";
        for (int i = start; i < history.length(); i++) {
            JSONObject item = history.optJSONObject(i);
            if (item == null) continue;
            String role = item.optString("role");
            String content = item.optString("content").trim();
            if (!("user".equals(role) || "assistant".equals(role)) || content.isEmpty() || content.length() > 4000) continue;
            messages.put(new JSONObject().put("role", role).put("content", content));
            lastRole = role;
        }
        if (!"user".equals(lastRole)) throw new IllegalArgumentException("The last chat message must be from the user");
        JSONObject body = new JSONObject().put("model", model).put("max_tokens", 1200).put("messages", messages);
        JSONObject headers = new JSONObject().put("Authorization", "Bearer " + key);
        if ("openrouter".equals(provider)) headers.put("X-Title", "Mutiny Media Android");
        JSONObject response = (JSONObject) http.request(endpoint(provider), "POST", headers, body);
        JSONArray choices = response.optJSONArray("choices");
        if (choices == null || choices.length() == 0) throw new IllegalStateException("AI chat returned no response. Check your model and quota.");
        String answer = choices.getJSONObject(0).getJSONObject("message").getString("content");
        if (answer.length() > 100000) throw new IllegalStateException("AI reply too large");
        return answer;
    }

}
