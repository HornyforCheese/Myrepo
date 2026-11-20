package app.mutiny.media;

import java.net.URI;

public final class UrlPolicy {
    private UrlPolicy() {}
    public static boolean isPublicHttps(String value) {
        try {
            URI uri = new URI(value);
            String host = uri.getHost();
            if (!"https".equalsIgnoreCase(uri.getScheme()) || host == null || uri.getRawUserInfo() != null || uri.getPort() != -1) return false;
            host = host.toLowerCase(java.util.Locale.ROOT);
            if (host.endsWith(".")) host = host.substring(0, host.length() - 1);
            return host.contains(".") && !host.matches("[0-9.]+") && !host.contains(":") && !host.equals("localhost") && !host.endsWith(".localhost") && !host.endsWith(".local") && !host.endsWith(".internal");
        } catch (Exception invalid) { return false; }
    }
}
