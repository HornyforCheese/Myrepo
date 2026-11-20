import app.mutiny.media.AiClient;
import app.mutiny.media.Secrets;
import java.util.HashMap;
import org.json.*;

public class AiClientTest {
    public static void main(String[] args) throws Exception {
        HashMap<String,String> values = new HashMap<>();
        Secrets store = new Secrets() {
            public String get(String key) { return values.getOrDefault(key, ""); }
            public void putAll(java.util.Map<String,String> changes) { values.putAll(changes); }
        };
        AiClient ai = new AiClient(store, (url, method, headers, body) -> {
            if (!url.equals("https://api.groq.com/openai/v1/chat/completions") || !headers.getString("Authorization").equals("Bearer fixture"))
                throw new AssertionError("Provider routing");
            JSONArray messages = body.getJSONArray("messages");
            if (messages.length() != 3 || !messages.getJSONObject(1).getString("role").equals("assistant")
                || !messages.getJSONObject(2).getString("content").contains("fixture reference")) throw new AssertionError("Conversation construction");
            return new JSONObject("{choices:[{message:{content:'fixture reply'}}]}");
        });
        try { ai.suggest("film", null, ""); throw new AssertionError("Missing credentials"); }
        catch (IllegalStateException expected) { }
        ai.save(new JSONObject().put("provider","groq").put("model","test-model").put("key","fixture"));
        if (ai.config("gemini").getBoolean("hasKey") || !ai.config().getString("provider").equals("groq")) throw new AssertionError("Provider isolation");
        JSONArray history = new JSONArray("[{role:'system',content:'ignored'},{role:'assistant',content:'earlier reply'}]");
        if (!"fixture reply".equals(ai.suggest("film", history, "fixture reference"))) throw new AssertionError("Response");
        try { ai.suggest("x".repeat(2001), history, ""); throw new AssertionError("Oversized query"); }
        catch (IllegalArgumentException expected) { }
        AiClient catalogue = new AiClient(store, (url, method, headers, body) -> {
            if (!url.equals("https://openrouter.ai/api/v1/models")) throw new AssertionError("Catalogue routing");
            JSONArray models = new JSONArray()
                .put(new JSONObject().put("id", "unpriced:free"))
                .put(new JSONObject().put("id", "paid").put("pricing", new JSONObject().put("prompt", "0.01").put("completion", "0")))
                .put(new JSONObject().put("id", "verified:free").put("pricing", new JSONObject().put("prompt", "0").put("completion", "0")));
            return new JSONObject().put("data", models);
        });
        JSONObject free = catalogue.models("openrouter", "");
        JSONArray listed = free.getJSONArray("models");
        if (listed.length() != 1 || !"verified:free".equals(listed.getJSONObject(0).getString("id")))
            throw new AssertionError("Unpriced or paid model incorrectly labelled free");
        ai.save(new JSONObject().put("provider", "gemini").put("model", "gemini-fixture").put("key", "gemini-secret"));
        if (!ai.config("gemini").getBoolean("hasKey")) throw new AssertionError("Gemini key not saved");
        if (!ai.clearKey("gemini").getBoolean("hasKey") && ai.config("groq").getBoolean("hasKey")) {
            // The selected Gemini key was removed without affecting Groq.
        } else throw new AssertionError("Provider-scoped key removal failed");
        final int[] pages = {0};
        AiClient paged = new AiClient(store, (url, method, headers, body) -> {
            if (!"gemini-secret".equals(headers.getString("x-goog-api-key"))) throw new AssertionError("Gemini auth");
            if (pages[0]++ == 0) {
                if (!url.endsWith("?pageSize=200")) throw new AssertionError("Initial page");
                return new JSONObject().put("models", new JSONArray().put(new JSONObject()
                    .put("name", "models/gemini-first").put("supportedGenerationMethods", new JSONArray().put("generateContent"))))
                    .put("nextPageToken", "page + two");
            }
            if (!url.contains("pageToken=page+%2B+two")) throw new AssertionError("Page token not encoded");
            return new JSONObject().put("models", new JSONArray().put(new JSONObject()
                .put("name", "models/gemini-second").put("supportedGenerationMethods", new JSONArray().put("generateContent"))));
        });
        JSONObject gemini = paged.models("gemini", "gemini-secret");
        if (pages[0] != 2 || gemini.getJSONArray("models").length() != 2 || gemini.getBoolean("truncated"))
            throw new AssertionError("Gemini pagination");
        System.out.println("AI transport, history, routing and validation fixtures passed");
    }
}
