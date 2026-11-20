package app.mutiny.media;

import org.json.JSONObject;

/**
 * Bounded request contract for a future isolated CloudStream provider process.
 * This class does not load or execute extension code.
 */
final class CloudStreamRequest {
    static final int MAX_QUERY = 256;
    static final int MAX_ID = 512;
    static final int MAX_REQUEST_BYTES = 4096;

    private CloudStreamRequest() {}

    static JSONObject validate(JSONObject request) throws org.json.JSONException {
        if (request == null || request.toString().getBytes(java.nio.charset.StandardCharsets.UTF_8).length > MAX_REQUEST_BYTES)
            throw new IllegalArgumentException("Invalid or oversized CloudStream request");
        String operation = request.optString("operation", "");
        if (!operation.equals("search") && !operation.equals("metadata") && !operation.equals("streams"))
            throw new IllegalArgumentException("Unsupported CloudStream operation");
        String provider = request.optString("provider", "");
        if (!provider.matches("[A-Za-z0-9_.:-]{1,128}"))
            throw new IllegalArgumentException("Invalid CloudStream provider");
        String value = request.optString(operation.equals("search") ? "query" : "id", "");
        int limit = operation.equals("search") ? MAX_QUERY : MAX_ID;
        if (value.isBlank() || value.length() > limit || value.chars().anyMatch(c -> c < 32 || c == 127))
            throw new IllegalArgumentException("Invalid CloudStream request value");
        String type = request.optString("type", "");
        if (!type.isEmpty() && !type.equals("movie") && !type.equals("series"))
            throw new IllegalArgumentException("Unsupported CloudStream media type");
        if (operation.equals("search") && request.has("id") || !operation.equals("search") && request.has("query"))
            throw new IllegalArgumentException("Unexpected CloudStream request field");
        JSONObject result = new JSONObject().put("operation", operation).put("provider", provider)
            .put(operation.equals("search") ? "query" : "id", value);
        if (!type.isEmpty()) result.put("type", type);
        return result;
    }
}
