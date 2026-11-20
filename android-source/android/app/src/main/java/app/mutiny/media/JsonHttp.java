package app.mutiny.media;

import org.json.*;
import javax.net.ssl.HttpsURLConnection;
import java.net.URL;
import java.io.*;
import java.nio.charset.StandardCharsets;

public final class JsonHttp implements Accounts.Transport {
    public Object request(String url, String method, JSONObject headers, JSONObject body) throws Exception {
        if (!UrlPolicy.isPublicHttps(url)) throw new IOException("A public HTTPS URL is required");
        HttpsURLConnection connection = (HttpsURLConnection) new URL(url).openConnection();
        connection.setConnectTimeout(20000); connection.setReadTimeout(60000);
        connection.setInstanceFollowRedirects(false); connection.setRequestMethod(method);
        connection.setRequestProperty("Accept", "application/json");
        connection.setRequestProperty("User-Agent", "MutinyMedia/1.0.1 Android");
        for (java.util.Iterator<String> keys = headers.keys(); keys.hasNext();) { String key = keys.next(); connection.setRequestProperty(key, headers.getString(key)); }
        try {
            if (body != null) {
                connection.setDoOutput(true); connection.setRequestProperty("Content-Type", "application/json");
                try (OutputStream output = connection.getOutputStream()) { output.write(body.toString().getBytes(StandardCharsets.UTF_8)); }
            }
            int code = connection.getResponseCode();
            if (code < 200 || code >= 300) throw new IOException("HTTP " + code + (code == 401 || code == 403 ? ": check your credentials and permissions." : code == 429 ? ": rate limit or quota reached." : ": provider request failed."));
            try (InputStream input = connection.getInputStream(); ByteArrayOutputStream output = new ByteArrayOutputStream()) {
                byte[] buffer = new byte[8192]; int read;
                while ((read = input.read(buffer)) != -1) { if (output.size() + read > 6_000_000) throw new IOException("Provider response too large"); output.write(buffer, 0, read); }
                String text = output.toString("UTF-8"); return text.trim().isEmpty() ? new JSONObject() : new JSONTokener(text).nextValue();
            }
        } finally { connection.disconnect(); }
    }
}
