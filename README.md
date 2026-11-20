# Mutiny Media Android 1.0.1 engines development

This branch reconstructs the Android source tree **byte-for-byte for non-binary UTF-8 sources** from the source ZIP of release `android-v1.0.1-engines` (20 November 2026). The previous release remains unmodified. Android project: [`android/`](android/). Install preview APK from [published release](https://github.com/HornyforCheese/Myrepo/releases/tag/android-v1.0.1-engines).

Use JDK 17, Android SDK 35 and Node 24. Run `cd android && npm ci && npm test && ./gradlew :app:assembleDebug`. Native playback, real account providers and torrent streaming still require physical-device verification. The current build includes gaming controls that need removal for the media-only product scope, plus unverified extension/provider support and parity gaps.
