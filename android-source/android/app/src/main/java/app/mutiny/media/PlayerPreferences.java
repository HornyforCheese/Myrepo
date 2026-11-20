package app.mutiny.media;

import android.content.Context;
import android.content.SharedPreferences;
import org.json.JSONObject;

/** Small whitelist of user-facing playback controls shared by local, torrent and HTTPS playback. */
public final class PlayerPreferences {
    private static final String STORE = "mutiny.media.playback.v1";
    private PlayerPreferences() { }

    public static final class Values {
        public final boolean resumePlayback, subtitlesOffByDefault, keepScreenOn;
        public final int seekBackSec, seekForwardSec, networkCacheMs;
        public final float defaultPlaybackSpeed;
        private Values(SharedPreferences values) {
            resumePlayback = values.getBoolean("resumePlayback", true);
            subtitlesOffByDefault = values.getBoolean("subtitlesOffByDefault", false);
            keepScreenOn = values.getBoolean("keepScreenOn", true);
            seekBackSec = validStep(values.getInt("seekBackSec", 10), 10);
            seekForwardSec = validStep(values.getInt("seekForwardSec", 30), 30);
            networkCacheMs = validCache(values.getInt("networkCacheMs", 0));
            defaultPlaybackSpeed = validRate(values.getFloat("defaultPlaybackSpeed", 1.0f));
        }
    }
    public static Values load(Context context) {
        return new Values(context.getSharedPreferences(STORE, Context.MODE_PRIVATE));
    }
    private static int validStep(int value, int fallback) {
        switch(value) { case 5: case 10: case 15: case 30: case 60: return value; default: return fallback; }
    }
    private static int validCache(int value) {
        switch(value) { case 0: case 2000: case 5000: case 10000: case 20000: return value; default: return 0; }
    }
    private static float validRate(float value) {
        for(float rate : new float[]{0.5f, 0.75f, 1.0f, 1.25f, 1.5f, 2.0f})
            if(Math.abs(value-rate)<0.001f) return rate;
        return 1.0f;
    }
    public static JSONObject configure(Context context, JSONObject data) throws Exception {
        if(data == null) throw new IllegalArgumentException("Missing player settings");
        SharedPreferences.Editor editor=context.getSharedPreferences(STORE, Context.MODE_PRIVATE).edit();
        if(data.has("resumePlayback")) editor.putBoolean("resumePlayback",data.optBoolean("resumePlayback",true));
        if(data.has("subtitlesOffByDefault")) editor.putBoolean("subtitlesOffByDefault",data.optBoolean("subtitlesOffByDefault",false));
        if(data.has("keepScreenOn")) editor.putBoolean("keepScreenOn",data.optBoolean("keepScreenOn",true));
        if(data.has("seekBackSec")) editor.putInt("seekBackSec",validStep(data.optInt("seekBackSec",10),10));
        if(data.has("seekForwardSec")) editor.putInt("seekForwardSec",validStep(data.optInt("seekForwardSec",30),30));
        if(data.has("networkCacheMs")) editor.putInt("networkCacheMs",validCache(data.optInt("networkCacheMs",0)));
        if(data.has("defaultPlaybackSpeed")) editor.putFloat("defaultPlaybackSpeed",validRate((float)data.optDouble("defaultPlaybackSpeed",1.0)));
        editor.apply();
        Values p=load(context);
        return new JSONObject()
            .put("resumePlayback",p.resumePlayback)
            .put("subtitlesOffByDefault",p.subtitlesOffByDefault)
            .put("keepScreenOn",p.keepScreenOn)
            .put("seekBackSec",p.seekBackSec)
            .put("seekForwardSec",p.seekForwardSec)
            .put("networkCacheMs",p.networkCacheMs)
            .put("defaultPlaybackSpeed",p.defaultPlaybackSpeed);
    }
}
