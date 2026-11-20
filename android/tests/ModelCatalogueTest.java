import app.mutiny.media.*;
import org.json.*;
import java.util.*;

public class ModelCatalogueTest {
    public static void main(String[] args) throws Exception {
        Map<String,String> data = new HashMap<>();
        Secrets store = new Secrets() {
            public String get(String key) {return data.getOrDefault(key,"");}
            public void putAll(Map<String,String> changes) {data.putAll(changes);}
        };
        int[] pages = {0};
        AiClient client = new AiClient(store,(url,method,headers,body)->{
            if (url.contains("openrouter")) return new JSONObject("{data:[{id:'x',pricing:{prompt:'0.0',completion:'0'}},{id:'y:free',pricing:{prompt:0,completion:0,request:'1'}}]}");
            if (url.contains("fixtureKey") || !"fixtureKey".equals(headers.getString("x-goog-api-key"))) throw new AssertionError("Credential routing");
            pages[0]++;
            if (url.endsWith("pageSize=200")) return new JSONObject("{models:[{name:'models/x',supportedGenerationMethods:['embedContent']}],nextPageToken:'a/b'}");
            if (!url.endsWith("pageToken=a%2Fb")) throw new AssertionError("Page token");
            return new JSONObject("{models:[{name:'models/y',displayName:'Model Y',supportedGenerationMethods:['generateContent']}]}");
        });
        if (client.models("openrouter","").getJSONArray("models").length()!=1) throw new AssertionError("Pricing filter");
        JSONArray models=client.models("gemini","fixtureKey").getJSONArray("models");
        if (pages[0]!=2 || models.length()!=1 || !"Model Y".equals(models.getJSONObject(0).getString("name"))) throw new AssertionError("Pagination");
        store.put("ai.key.gemini","fixtureKey");
        client.clearKey("gemini");
        if (!store.get("ai.key.gemini").isEmpty() || !store.get("ai.provider").isEmpty()) throw new AssertionError("Clear key required provider switch");
        System.out.println("Gemini pagination, auth header, capability filter, key removal and OpenRouter pricing fixtures passed");
    }
}
