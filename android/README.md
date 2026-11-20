# Mutiny Media for Android

Open Settings to load a magnet link, select a torrent file, sign in to Stremio or Nuvio, configure an AI provider, search Steam, or launch an installed Android game. Torrent transfers use device storage and continue in a foreground service until stopped. Tap Refresh torrent to see available files and progress. Steam Link requires the Steam Link app and a paired PC.

Local and direct video playback uses libVLC. Web sources open in a separate WebView. Watch progress can be submitted for identified titles played with libVLC. A provider page controls its own playback history. Stremio and Nuvio bookmarks can be opened from Load cloud library. PIN-protected Nuvio profiles are unsupported. Credentials are stored with Android Keystore. AI requests go directly to the provider you configure and use your account quota.

Build from this directory with JDK 17, Android SDK 35 and Node 24. Run npm ci, npm test, then ./gradlew :app:assembleDebug. The Gradle project fetches libVLC 3.6.5 (LGPL 2.1) and libtorrent4j 2.1.0-39 (MIT) from Maven Central. The development signing key is generated locally and is excluded from the source archive. Android 8 or newer and a current Android System WebView are required.

The Windows source catalog and branding come from commit 20b3a48881681f74df9dcf6dec1d615cd2e40f27. Live playback, cloud services and game launches require device testing.
