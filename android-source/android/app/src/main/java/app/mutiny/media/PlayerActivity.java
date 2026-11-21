package app.mutiny.media;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.view.*;
import android.webkit.*;
import android.widget.*;

public class PlayerActivity extends Activity {
    private WebView browser;
    private VideoView video;
    private android.view.View fullscreen;
    private WebChromeClient.CustomViewCallback fullscreenCallback;
    private FrameLayout root;
    private String url;
    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        root = new FrameLayout(this);
        root.setBackgroundColor(0xff000000);
        setContentView(root);
        root.setOnApplyWindowInsetsListener((view, insets) -> { view.setPadding(insets.getSystemWindowInsetLeft(), insets.getSystemWindowInsetTop(), insets.getSystemWindowInsetRight(), insets.getSystemWindowInsetBottom()); return insets.consumeSystemWindowInsets(); });
        url = getIntent().getStringExtra("url");
        boolean local = getIntent().getData() != null && "content".equals(getIntent().getData().getScheme());
        if (!local && !UrlPolicy.isPublicHttps(url)) { finish(); return; }
        if (getIntent().getBooleanExtra("web", false)) createBrowser(state);
        else {
            video = new VideoView(this);
            FrameLayout.LayoutParams layout = new FrameLayout.LayoutParams(-1, -1, Gravity.CENTER);
            layout.topMargin = 56;
            root.addView(video, layout);
            MediaController controls = new MediaController(this);
            controls.setAnchorView(video);
            video.setMediaController(controls);
            video.setOnPreparedListener(player -> { if (state != null) video.seekTo(state.getInt("position")); video.start(); });
            video.setOnErrorListener((player, what, extra) -> {
                new android.app.AlertDialog.Builder(this).setTitle("Unable to play this video")
                    .setMessage("This format or source may need another player.")
                    .setPositiveButton("Open in another app", (dialog, which) -> openExternal())
                    .setNegativeButton("Close", (dialog, which) -> finish()).show();
                return true;
            });
            video.setVideoURI(local ? getIntent().getData() : Uri.parse(url));
        }
        LinearLayout toolbar = new LinearLayout(this);
        toolbar.setBackgroundColor(0xe6101319);
        Button back = new Button(this); back.setText("← Back"); back.setOnClickListener(view -> finish()); toolbar.addView(back);
        Button external = new Button(this); external.setText("Open externally"); external.setOnClickListener(view -> openExternal()); toolbar.addView(external);
        root.addView(toolbar, new FrameLayout.LayoutParams(-1, -2, Gravity.TOP));
    }
    private void createBrowser(Bundle state) {
        browser = new WebView(this);
        WebSettings settings = browser.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setSupportMultipleWindows(true);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);
        settings.setMediaPlaybackRequiresUserGesture(true);
        browser.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri target = request.getUrl();
                if (!UrlPolicy.isPublicHttps(target.toString())) return true;
                // Embedded resources can use CDNs; top-level navigation stays on the selected provider.
                return request.isForMainFrame() && !Uri.parse(url).getHost().equalsIgnoreCase(target.getHost());
            }
            @Override public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request.isForMainFrame()) Toast.makeText(PlayerActivity.this, "Source could not load. Go back to try another source.", Toast.LENGTH_LONG).show();
            }
        });
        browser.setWebChromeClient(new WebChromeClient() {
            @Override public boolean onCreateWindow(WebView view, boolean dialog, boolean gesture, android.os.Message message) { return false; }
            @Override public void onShowCustomView(View view, CustomViewCallback callback) {
                if (fullscreen != null) { callback.onCustomViewHidden(); return; }
                fullscreen = view; fullscreenCallback = callback;
                root.addView(view, new FrameLayout.LayoutParams(-1, -1));
                getWindow().getDecorView().setSystemUiVisibility(5894);
            }
            @Override public void onHideCustomView() { hideFullscreen(); }
        });
        FrameLayout.LayoutParams layout = new FrameLayout.LayoutParams(-1, -1); layout.topMargin = 56;
        root.addView(browser, layout);
        if (state == null || browser.restoreState(state) == null) browser.loadUrl(url);
    }
    private void hideFullscreen() {
        if (fullscreen == null) return;
        root.removeView(fullscreen); fullscreen = null;
        getWindow().getDecorView().setSystemUiVisibility(0);
        fullscreenCallback.onCustomViewHidden(); fullscreenCallback = null;
    }
    private void openExternal() {
        Uri uri = getIntent().getData() != null ? getIntent().getData() : Uri.parse(url);
        Intent intent = new Intent(Intent.ACTION_VIEW, uri).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        if (video != null) intent.setDataAndType(uri, "video/*");
        try { startActivity(intent); } catch (Exception error) { Toast.makeText(this, "No compatible app installed", Toast.LENGTH_LONG).show(); }
    }
    @Override public void onBackPressed() { if (fullscreen != null) hideFullscreen(); else finish(); }
    @Override protected void onPause() { if (browser != null) browser.onPause(); if (video != null) video.pause(); super.onPause(); }
    @Override protected void onResume() { super.onResume(); if (browser != null) browser.onResume(); }
    @Override protected void onSaveInstanceState(Bundle state) { super.onSaveInstanceState(state); if (browser != null) browser.saveState(state); if (video != null) state.putInt("position", video.getCurrentPosition()); }
    @Override protected void onDestroy() { if (browser != null) browser.destroy(); if (video != null) video.stopPlayback(); super.onDestroy(); }
}
