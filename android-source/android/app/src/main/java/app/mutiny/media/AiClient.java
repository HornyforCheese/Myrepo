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
        String prompt = "Find up to 8 real movies, TV series or anime matching the user. Return ONLY a JSON array of objects {\\\"title\\\":\\\"exact title\\\",\\\"year\\\":2000,\\\"type\\\":\\\"movie\\\" or \\\"series\\\",\\\"reason\\\":\\\"short reason\\\"}. Never invent IDs, URLs, or verified availability.";
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
}
