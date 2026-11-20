package app.mutiny.media;

import org.json.JSONObject;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Enumeration;
import java.util.Locale;
import java.util.zip.ZipEntry;
import java.util.zip.ZipFile;

final class CloudStreamArchive {
    static final int MAX_BYTES = 48 * 1024 * 1024;
    private static final int MAX_MANIFEST = 64 * 1024;

    static void verifyHash(String actual, String expected) {
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
            try { raw = java.util.Base64.getDecoder().decode(encoded); }
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

    static String asHex(byte[] bytes) {
        char[] chars = "0123456789abcdef".toCharArray();
        StringBuilder hex = new StringBuilder(bytes.length * 2);
        for (byte b : bytes) { hex.append(chars[(b & 0xff) >>> 4]); hex.append(chars[b & 15]); }
        return hex.toString();
    }

    static JSONObject inspect(File archive) throws Exception {
        try (ZipFile zip = new ZipFile(archive)) {
            ZipEntry manifest = zip.getEntry("manifest.json");
            if (manifest == null || manifest.isDirectory() || manifest.getSize() > MAX_MANIFEST)
                throw new IOException("Not a CloudStream package: manifest.json is missing or too large");
            boolean dex = false;
            int count = 0;
            java.util.HashSet<String> names = new java.util.HashSet<>();
            Enumeration<? extends ZipEntry> entries = zip.entries();
            while (entries.hasMoreElements()) {
                ZipEntry entry = entries.nextElement();
                if (!names.add(entry.getName())) throw new IOException("Ambiguous duplicate archive entry");
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

}
