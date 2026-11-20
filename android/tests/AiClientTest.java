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
        System.out.println("AI transport, history, routing and validation fixtures passed");
    }
}
