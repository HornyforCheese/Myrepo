package app.mutiny.media;

import org.json.JSONObject;

public final class CloudStreamRequestTest {
    private static void rejects(JSONObject request) throws Exception {
        try { CloudStreamRequest.validate(request); throw new AssertionError("Accepted: " + request); }
        catch (IllegalArgumentException expected) { }
    }

    public static void main(String[] args) throws Exception {
        JSONObject search = new JSONObject().put("operation", "search").put("provider", "example.provider")
            .put("query", "Anime").put("type", "series");
        if (!"Anime".equals(CloudStreamRequest.validate(search).getString("query"))) throw new AssertionError();
        if (!"tt123".equals(CloudStreamRequest.validate(new JSONObject().put("operation", "streams")
            .put("provider", "example.provider").put("id", "tt123")).getString("id"))) throw new AssertionError();
        rejects(new JSONObject().put("operation", "execute").put("provider", "example.provider").put("query", "a"));
        rejects(new JSONObject().put("operation", "search").put("provider", "../escape").put("query", "a"));
        rejects(new JSONObject().put("operation", "search").put("provider", "ok").put("query", "x".repeat(257)));
        rejects(new JSONObject().put("operation", "metadata").put("provider", "ok").put("id", "a\nb"));
        rejects(new JSONObject().put("operation", "search").put("provider", "ok").put("query", "a").put("id", "b"));
        rejects(new JSONObject().put("operation", "search").put("provider", "ok").put("query", "a").put("type", "game"));
        rejects(new JSONObject().put("operation", "search").put("provider", "ok").put("query", "a").put("padding", "z".repeat(4096)));
        System.out.println("CloudStream bounded request contract fixtures passed");
    }
}
