package app.mutiny.media;

import org.json.JSONObject;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HashSet;
import java.util.Locale;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

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

    static JSONObject inspect(InputStream archive) throws Exception {
        try (ZipInputStream zip = new ZipInputStream(new BufferedInputStream(archive))) {
            HashSet<String> names = new HashSet<>();
            ByteArrayOutputStream manifest = new ByteArrayOutputStream();
            boolean dex = false;
            long total = 0;
            byte[] block = new byte[16384];
            ZipEntry entry;
            while ((entry = zip.getNextEntry()) != null) {
                String name = entry.getName();
                // Reject ambiguous or traversal paths before any future DEX/resource extraction.
                if (name.isEmpty() || name.startsWith("/") || name.indexOf('\\') >= 0 ||
                    name.matches("^[A-Za-z]:.*"))
                    throw new IOException("Unsafe extension archive path");
                String[] segments = name.split("/", -1);
                for (int part = 0; part < segments.length; part++) {
                    if (".".equals(segments[part]) || "..".equals(segments[part]) ||
                        (segments[part].isEmpty() && part != segments.length - 1))
                        throw new IOException("Unsafe extension archive path");
                }
                if (!names.add(name) || names.size() > 256) throw new IOException("Invalid or excessive archive entries");
                boolean isManifest = "manifest.json".equals(name);
                boolean primaryDex = "classes.dex".equals(name);
                byte[] magic = new byte[8];
                int size = 0, n;
                while ((n = zip.read(block)) != -1) {
                    total += n;
                    if (total > 2L * MAX_BYTES || size + n > MAX_BYTES) throw new IOException("Expanded extension exceeds size limit");
                    if (isManifest) {
                        if (size + n > MAX_MANIFEST) throw new IOException("Manifest is too large");
                        manifest.write(block,0,n);
                    }
                    if (primaryDex && size < magic.length)
                        System.arraycopy(block,0,magic,size,Math.min(n,magic.length - size));
                    size += n;
                }
                if (primaryDex) {
                    dex = size >= 112 && magic[0] == 'd' && magic[1] == 'e' && magic[2] == 'x' && magic[3] == '\n' && magic[7] == 0;
                    for (int i = 4; i <= 6; i++) dex &= magic[i] >= '0' && magic[i] <= '9';
                }
            }
            if (!dex || manifest.size() == 0) throw new IOException("Missing manifest or valid primary DEX header");
            JSONObject data = new JSONObject(manifest.toString(StandardCharsets.UTF_8.name()));
            String className = data.optString("pluginClassName", "").trim();
            if (!className.matches("[A-Za-z_$][A-Za-z0-9_$]*(\\.[A-Za-z_$][A-Za-z0-9_$]*)+"))
                throw new IOException("CloudStream manifest has no valid pluginClassName");
            String name = data.optString("name", className).trim();
            if (name.isEmpty()) name = className;
            return new JSONObject()
                .put("name", name.substring(0, Math.min(120, name.length())))
                .put("pluginClassName", className)
                .put("requiresResources",data.optBoolean("requiresResources"))
                .put("version", data.optInt("version", data.optInt("versionCode", 0)));
        }
    }

}
