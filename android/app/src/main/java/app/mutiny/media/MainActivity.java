package app.mutiny.media;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.*;
import android.view.View;
import android.widget.Toast;
import java.io.*;
import androidx.webkit.WebViewCompat;
import androidx.webkit.WebViewFeature;
import org.json.*;

/** Local application UI. Remote players never receive an application JS bridge. */
public class MainActivity extends Activity {
    static final String ORIGIN = "https://appassets.androidplatform.net";
    private WebView web;
    private String localAudio;
    private boolean localSubtitles;
    private final java.util.concurrent.ExecutorService commands = java.util.concurrent.Executors.newFixedThreadPool(4);
    private final java.util.concurrent.atomic.AtomicInteger pending = new java.util.concurrent.atomic.AtomicInteger();
    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        if (state != null) { localAudio = state.getString("localAudio"); localSubtitles = state.getBoolean("localSubtitles"); }
        getWindow().setStatusBarColor(0xff101319);
        web = new WebView(this);
        web.setBackgroundColor(0xff101319);
        web.setPadding(0, 0, 0, 0);
        web.setOnApplyWindowInsetsListener((view, insets) -> {
            view.setPadding(insets.getSystemWindowInsetLeft(), insets.getSystemWindowInsetTop(), insets.getSystemWindowInsetRight(), insets.getSystemWindowInsetBottom());
            return insets.consumeSystemWindowInsets();
        });
        setContentView(web);
        WebSettings settings = web.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        if (WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) {
            WebViewCompat.addWebMessageListener(web, "Mutiny", java.util.Collections.singleton(ORIGIN), (view, message, origin, mainFrame, reply) -> {
                if (!mainFrame || !ORIGIN.equals(origin.toString()) || message.getData() == null || message.getData().length() > 150000) return;
                String raw = message.getData();
                if (pending.incrementAndGet() > 16) { pending.decrementAndGet(); return; }
                commands.execute(() -> {
                    JSONObject response = new JSONObject();
                    try {
                        JSONObject request = new JSONObject(raw); response.put("id", request.getString("id"));
                        Object result = NativeApi.get(this).call(this, request.getString("method"), request.optJSONObject("args") == null ? new JSONObject() : request.getJSONObject("args"));
                        response.put("result", result == null ? JSONObject.NULL : result);
                    } catch (Throwable failure) {
                        try { response.put("error", failure instanceof UnsatisfiedLinkError ? "Native engine could not load on this device" : failure.getMessage() == null ? "Native operation failed" : failure.getMessage()); } catch (JSONException ignored) { }
                    } finally { pending.decrementAndGet(); }
                    runOnUiThread(() -> { if (!isDestroyed()) reply.postMessage(response.toString()); });
                });
            });
        }
        web.setWebChromeClient(new WebChromeClient());
        web.setWebViewClient(new WebViewClient() {
            @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if (!ORIGIN.equals(uri.getScheme() + "://" + uri.getAuthority())) return null;
                String name = uri.getPath().equals("/") ? "index.html" : uri.getPath().substring(1);
                if (!name.matches("[a-zA-Z0-9._-]+")) return empty();
                try {
                    String mime = name.endsWith(".html") ? "text/html" : name.endsWith(".css") ? "text/css" : name.endsWith(".js") ? "application/javascript" : name.endsWith(".png") ? "image/png" : "application/octet-stream";
                    return new WebResourceResponse(mime, "UTF-8", getAssets().open(name));
                } catch (IOException error) { return empty(); }
            }
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if (ORIGIN.equals(uri.getScheme() + "://" + uri.getAuthority())) return false;
                if (request.isForMainFrame() && view.getUrl() != null && view.getUrl().startsWith(ORIGIN + "/") && "mutiny".equals(uri.getScheme())) action(uri);
                return true;
            }
        });
        if (state == null || web.restoreState(state) == null) web.loadUrl(ORIGIN + "/index.html");
    }
    private WebResourceResponse empty() { return new WebResourceResponse("text/plain", "UTF-8", 404, "Not found", java.util.Collections.emptyMap(), new ByteArrayInputStream(new byte[0])); }
    private void action(Uri action) {
        if ("cs3".equals(action.getHost())) {
            startActivityForResult(new Intent(Intent.ACTION_OPEN_DOCUMENT).setType("*/*").addCategory(Intent.CATEGORY_OPENABLE), 11);
            return;
        }
        if ("local".equals(action.getHost())) {
            localAudio = action.getQueryParameter("audio");
            localSubtitles = "true".equals(action.getQueryParameter("subtitles"));
            Intent pick = new Intent(Intent.ACTION_OPEN_DOCUMENT).setType("video/*").addCategory(Intent.CATEGORY_OPENABLE);
            startActivityForResult(pick, 10);
            return;
        }
        String url = action.getQueryParameter("url");
        if (!UrlPolicy.isPublicHttps(url)) { Toast.makeText(this, "A public HTTPS address is required", Toast.LENGTH_LONG).show(); return; }
        if ("external".equals(action.getHost())) {
            try { startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url)).addCategory(Intent.CATEGORY_BROWSABLE)); }
            catch (Exception error) { Toast.makeText(this, "No compatible app installed", Toast.LENGTH_LONG).show(); }
        } else if ("web".equals(action.getHost()) || "video".equals(action.getHost())) {
            startActivity(new Intent(this, "web".equals(action.getHost()) ? PlayerActivity.class : VlcPlayerActivity.class).putExtra("audio", action.getQueryParameter("audio")).putExtra("subtitles", "true".equals(action.getQueryParameter("subtitles"))).putExtra("url", url).putExtra("web", "web".equals(action.getHost())));
        }
    }
    @Override protected void onActivityResult(int request, int result, Intent data) {
        super.onActivityResult(request, result, data);
        if (request == 11 && result == RESULT_OK && data != null && data.getData() != null) {
            Uri source = data.getData();
            commands.execute(() -> {
                try {
                    CloudStreamPackageStore.installFromUri(this, source);
                    runOnUiThread(() -> {
                        if (!isDestroyed()) web.evaluateJavascript("window.dispatchEvent(new Event('cs3-imported'))", null);
                    });
                } catch (Exception error) {
                    runOnUiThread(() -> Toast.makeText(this, "Could not import CS3: " + error.getMessage(), Toast.LENGTH_LONG).show());
                }
            });
        }
        if (request == 10 && result == RESULT_OK && data != null && data.getData() != null) {
            startActivity(new Intent(this, VlcPlayerActivity.class).putExtra("audio",localAudio).putExtra("subtitles",localSubtitles).setData(data.getData()).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION));
        }
    }
    @Override protected void onSaveInstanceState(Bundle state) { super.onSaveInstanceState(state); state.putString("localAudio",localAudio); state.putBoolean("localSubtitles",localSubtitles); web.saveState(state); }
    @Override public void onBackPressed() { web.evaluateJavascript("window.mutinyBack && window.mutinyBack()", result -> { if (!"true".equals(result)) super.onBackPressed(); }); }
    @Override protected void onDestroy() { commands.shutdown(); web.destroy(); super.onDestroy(); }
}
