import app.mutiny.media.UrlPolicy;

public class UrlPolicyTest {
    public static void main(String[] args) {
        String[] invalid = {"file:///tmp/a", "javascript:alert(1)", "http://example.com", "https://127.0.0.1/", "https://[::1]/", "https://device.local/", "https://user:secret@example.com/", "https://example.com:8443/", "https://localhost./", "https://name.localhost/"};
        for (String url : invalid) if (UrlPolicy.isPublicHttps(url)) throw new AssertionError(url);
        if (!UrlPolicy.isPublicHttps("https://example.com/watch/123")) throw new AssertionError("valid HTTPS rejected");
        System.out.println("Native URL policy: 11 checks passed");
    }
}
