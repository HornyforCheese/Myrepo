package app.mutiny.media;

import android.content.Context;
import android.net.Uri;
import android.util.Base64;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.URI;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Enumeration;
import java.util.Locale;
import java.util.zip.ZipEntry;
import java.util.zip.ZipFile;
import javax.net.ssl.HttpsURLConnection;

/**
 * Inspects and stores CloudStream .cs3 packages in private application storage.
 * A .cs3 contains executable Dalvik code. This registry intentionally DOES NOT
 * load that code: execution requires the full CloudStream ABI and provider bridge.
 */
public final class CloudStreamPackageStore {
    private static final String PREFS = "mutiny_cloudstream_packages";
    private static final String INDEX = "installed";
    private static final int MAX_PACKAGES = 150;
    private static final int MAX_BYTES = 48 * 1024 * 1024;
    private static final int MAX_MANIFEST = 64 * 1024;
    private CloudStreamPackageStore() { }

    private static File directory(Context context) throws IOException {
        File dir = new File(context.getFilesDir(), "cloudstream-extensions");
        if (!dir.exists() && !dir.mkdirs()) throw new IOException("Cannot create extension storage");
        return dir;
    }

    private static JSONArray index(Context context) throws Exception {
        return new JSONArray(context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(INDEX, "[]"));
    }

    public static synchronized JSONArray list(Context context) throws Exception {
        JSONArray rows = index(context), installed = new JSONArray();
        File dir = directory(context);
        for (int i = 0; i < rows.length(); i++) {
            JSONObject row = rows.optJSONObject(i);
            if (row == null) continue;
            String sha = row.optString("sha256", "");
            if (!sha.matches("[a-f0-9]{64}") || !new File(dir, sha + ".cs3").isFile()) continue;
            installed.put(new JSONObject(row.toString()).put("executionSupported", false));
        }
        return installed;
    }

    public static synchronized JSONObject installFromUri(Context context, Uri uri) throws Exception {
        if (uri == null || !"content".equalsIgnoreCase(uri.getScheme()))
            throw new IllegalArgumentException("Use the Android document picker to select a .cs3 file");
        try (InputStream in = context.getContentResolver().openInputStream(uri)) {
            if (in == null) throw new IOException("Cannot read the selected file");
            return install(context, in, "Local document", "");
        }
    }

    public static synchronized JSONObject installFromUrl(Context context, String address, String expectedHash) throws Exception {
        if (!UrlPolicy.isPublicHttps(address)) throw new IllegalArgumentException("Use a public HTTPS .cs3 address");
        URI original = new URI(address);
        if (!original.getPath().toLowerCase(Locale.ROOT).endsWith(".cs3"))
            throw new IllegalArgumentException("Expected a .cs3 extension URL");
        for (int redirect = 0; redirect <= 4; redirect++) {
            if (!UrlPolicy.isPublicHttps(address)) throw new IOException("Unsafe extension download redirect");
            HttpsURLConnection connection = (HttpsURLConnection) new URL(address).openConnection();
            connection.setConnectTimeout(15000);
            connection.setReadTimeout(45000);
            connection.setInstanceFollowRedirects(false);
            connection.setRequestProperty("Accept", "application/octet-stream");
            connection.setRequestProperty("User-Agent", "MutinyMedia/1.0.1 Android");
            try {
                int code = connection.getResponseCode();
                if (code == 301 || code == 302 || code == 303 || code == 307 || code == 308) {
                    String location = connection.getHeaderField("Location");
                    if (location == null || redirect == 4) throw new IOException("Too many extension redirects");
                    address = new URI(address).resolve(location).toString();
                    continue;
                }
                if (code != 200) throw new IOException("Extension download failed: HTTP " + code);
                if (connection.getContentLengthLong() > MAX_BYTES)
                    throw new IOException("Extension exceeds 48 MiB");
                try (InputStream input = connection.getInputStream()) {
                    return install(context, input, original.toString(), expectedHash);
                }
            } finally {
                connection.disconnect();
            }
        }
        throw new IOException("Too many extension redirects");
    }

    private static void verifyHash(String actual, String expected) {
        String value = expected == null ? "" : expected.trim();
        if (value.isEmpty()) return;
        if (value.matches("(?i)[a-f0-9]{64}")) {
            if (!actual.equalsIgnoreCase(value)) throw new IllegalArgumentException("Extension SHA-256 does not match repository index");
            return;
        }
        if (value.toLowerCase(Locale.ROOT).startsWith("sha256-")) {
            String encoded = value.substring(7);
            // Official CloudStream repository metadata uses "sha256-" + lowercase hex.
            if (encoded.matches("(?i)[a-f0-9]{64}")) {
                if (!actual.equalsIgnoreCase(encoded))
                    throw new IllegalArgumentException("Extension SHA-256 does not match repository index");
                return;
            }
            // Accept Base64-formatted checksums from other compatible repositories.
            byte[] raw;
            try { raw = Base64.decode(encoded, Base64.DEFAULT); }
            catch (IllegalArgumentException invalid) { throw new IllegalArgumentException("Invalid repository SHA-256"); }
            if (raw.length != 32 || !MessageDigest.isEqual(raw, hexToBytes(actual)))
                throw new IllegalArgumentException("Extension SHA-256 does not match repository index");
            return;
        }
        throw new IllegalArgumentException("Unsupported extension hash format");
    }

    private static byte[] hexToBytes(String hex) {
        byte[] bytes = new byte[hex.length() / 2];
        for (int i = 0; i < bytes.length; i++)
            bytes[i] = (byte) Integer.parseInt(hex.substring(i * 2, i * 2 + 2), 16);
        return bytes;
    }

    private static String asHex(byte[] bytes) {
        char[] chars = "0123456789abcdef".toCharArray();
        StringBuilder hex = new StringBuilder(bytes.length * 2);
        for (byte b : bytes) { hex.append(chars[(b & 0xff) >>> 4]); hex.append(chars[b & 15]); }
        return hex.toString();
    }

    private static JSONObject inspect(File archive) throws Exception {
        try (ZipFile zip = new ZipFile(archive)) {
            ZipEntry manifest = zip.getEntry("manifest.json");
            if (manifest == null || manifest.isDirectory() || manifest.getSize() > MAX_MANIFEST)
                throw new IOException("Not a CloudStream package: manifest.json is missing or too large");
            boolean dex = false;
            int count = 0;
            Enumeration<? extends ZipEntry> entries = zip.entries();
            while (entries.hasMoreElements()) {
                ZipEntry entry = entries.nextElement();
                if (++count > 256) throw new IOException("Extension has too many ZIP entries");
                if (entry.getName().matches("classes(\\d+)?\\.dex") && !entry.isDirectory()
                    && entry.getSize() > 0 && entry.getSize() <= MAX_BYTES) dex = true;
            }
            if (!dex) throw new IOException("Not an executable CloudStream package: classes.dex is missing");
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            try (InputStream in = zip.getInputStream(manifest)) {
                byte[] bytes = new byte[4096];
                int n;
                while ((n = in.read(bytes)) != -1) {
                    if (out.size() + n > MAX_MANIFEST) throw new IOException("Manifest is too large");
                    out.write(bytes, 0, n);
                }
            }
            JSONObject data = new JSONObject(out.toString(StandardCharsets.UTF_8.name()));
            String className = data.optString("pluginClassName", "").trim();
            if (!className.matches("[A-Za-z_$][A-Za-z0-9_$]*(\\.[A-Za-z_$][A-Za-z0-9_$]*)+"))
                throw new IOException("CloudStream manifest has no valid pluginClassName");
            String name = data.optString("name", className).trim();
            if (name.isEmpty()) name = className;
            return new JSONObject()
                .put("name", name.substring(0, Math.min(120, name.length())))
                .put("pluginClassName", className)
                .put("version", data.optInt("version", data.optInt("versionCode", 0)));
        }
    }

    private static JSONObject install(Context context, InputStream input, String source, String expectedHash) throws Exception {
        File stage = File.createTempFile("cs3-import-", ".zip", context.getCacheDir());
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            int size = 0;
            try (FileOutputStream output = new FileOutputStream(stage)) {
                byte[] buffer = new byte[16384];
                int n;
                while ((n = input.read(buffer)) != -1) {
                    size += n;
                    if (size > MAX_BYTES) throw new IOException("Extension exceeds 48 MiB");
                    digest.update(buffer, 0, n);
                    output.write(buffer, 0, n);
                }
            }
            if (size < 100) throw new IOException("Invalid or empty CloudStream extension");
            String hash = asHex(digest.digest());
            verifyHash(hash, expectedHash);
            JSONObject info = inspect(stage).put("sha256", hash).put("bytes", size)
                .put("source", source.equals("Local document") ? source : new URI(source).getHost()).put("importedAt", System.currentTimeMillis())
                .put("status", "imported-inactive").put("executionSupported", false);
            JSONArray old = index(context);
            JSONArray updated = new JSONArray();
            for (int i = 0; i < old.length(); i++) {
                JSONObject row = old.optJSONObject(i);
                if (row != null && !hash.equals(row.optString("sha256"))) updated.put(row);
            }
            if (updated.length() >= MAX_PACKAGES) throw new IOException("Too many installed extensions");
            File dest = new File(directory(context), hash + ".cs3");
            if (!stage.setReadOnly()) throw new IOException("Cannot mark extension file read-only");
            java.nio.file.Files.move(stage.toPath(), dest.toPath(), java.nio.file.StandardCopyOption.ATOMIC_MOVE,
                java.nio.file.StandardCopyOption.REPLACE_EXISTING);
            updated.put(info);
            if (!context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString(INDEX, updated.toString()).commit())
                throw new IOException("Could not save the installed-extension registry");
            return info;
        } finally {
            stage.delete();
        }
    }

    public static synchronized JSONArray remove(Context context, String hash) throws Exception {
        if (hash == null || !hash.matches("[a-f0-9]{64}")) throw new IllegalArgumentException("Invalid extension ID");
        JSONArray old = index(context), updated = new JSONArray();
        for (int i = 0; i < old.length(); i++) {
            JSONObject row = old.optJSONObject(i);
            if (row != null && !hash.equals(row.optString("sha256"))) updated.put(row);
        }
        if (!context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString(INDEX, updated.toString()).commit())
            throw new IOException("Could not update extension registry");
        File archive = new File(directory(context), hash + ".cs3");
        if (archive.exists() && !archive.delete()) throw new IOException("Cannot delete extension archive");
        return list(context);
    }
}
