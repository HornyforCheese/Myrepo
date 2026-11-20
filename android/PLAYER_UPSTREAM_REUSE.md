# Advanced video player: source reuse and implementation map

Status: research and source inspection complete; integration and device testing pending. Recorded 2026-11-21. This is workstream PLAYER, not proof of feature completion.

## Verified upstream sources
1. VideoLAN VLC Android: https://github.com/videolan/vlc-android — upstream Android application and player UI reference. README: https://github.com/videolan/vlc-android/blob/master/README.md . The application is GPLv2-or-later; the libVLC engine is LGPLv2. Retain notices and assess combined distribution obligations before copying application code.
2. VideoLAN libVLC Android samples: https://code.videolan.org/videolan/libvlc-android-samples — preferred reference for embedding libVLC in our own activity. Check exact sample API against pinned libVLC 3.6.5 before adapting.
3. AndroidX Media3: https://github.com/androidx/media — ExoPlayer, track selection, MediaSession, playback diagnostics, adaptive HLS/DASH. Prefer documented library dependencies over copying framework internals. Alternative engine, NOT a drop-in replacement for libVLC.
4. Just (Video) Player, https://github.com/moneytoo/Player — reference for compact controls, subtitle/track UX and TV interaction; verify repository licence and source version before copying any code.
5. VLC Android's own source should be the first player UX reference because our Gradle dependencies already include libVLC.

## Inspected Mutiny source
- `android/app/build.gradle`: libVLC 3.6.5 is already a dependency, with minSdk 26 and Java 17. No need to add a second player engine to achieve basic advanced controls.
- `android/app/src/main/java/app/mutiny/media/PlayerActivity.java`: direct video path currently uses Android `VideoView` + `MediaController`, not libVLC. Supports resume from saved position, external player handoff, and error dialog; web path is a separate restricted WebView. This direct-player activity is a concrete upgrade target.
- A separate native playback implementation may exist elsewhere; inspect all launch paths before replacing this activity. Avoid breaking existing libVLC/torrent paths.

## Implementation sequence
1. Trace every intent/RPC launch into PlayerActivity and existing libVLC components. Write tests around URI handling, HTTPS validation, content grants, and web-vs-native selection.
2. Refactor direct playback behind a small player interface. Embed libVLC with SurfaceView/TextureView using the upstream sample's compatible 3.6.5 API; preserve web playback as a separate path.
3. Wire native audio/subtitle track discovery, selection, external subtitle URIs, seek, playback speed and resume. Ensure UI survives rotation and Android lifecycle changes.
4. Add playback diagnostics (state, video resolution, codec if available, buffer, errors) and source failover events. Do not equate stream throughput with encoded bitrate.
5. Support per-source request headers securely; do not forward account tokens to arbitrary hosts or log secrets. Reject unsafe URLs and avoid SSRF/redirect bypasses.
6. Test local content:// media, HTTPS MP4/HLS, subtitle tracks, unsupported codecs, offline/retry, rotation, Android Back, and app background/foreground. Verify on real device.
7. Build and install the APK; only mark PLAYER complete with tests and build evidence.

## Source reuse decisions
- ADOPT: existing `org.videolan.android:libvlc-all:3.6.5` dependency.
- ADAPT: upstream libVLC embedding patterns and VLC Android controls/track-selection concepts.
- REFERENCE: Media3's diagnostic, adaptive-playback and session patterns; avoid adding Media3 until a demonstrable need.
- REFERENCE: Just Player UX, subject to licence review.
- DO NOT blindly transplant GPL application files or claim existing libVLC dependency means the current PlayerActivity uses it.

## Risks and acceptance
Primary risks: lifecycle/surface ownership, source headers and redirects, external subtitles, native library ABI sizes, and source-to-player handoff. Completion requires a functioning tested player, not merely a new dependency or documentation.
