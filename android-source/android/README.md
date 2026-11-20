# Mutiny Media Android · Media-only feature branch

This source was extracted from the **Android v1.0.1 Engines** release and is being developed independently of the Windows and CloudStream plugin-template branches. The 251 MiB released APK is unchanged. New commits in this branch are **not** included in that APK until a new build is published.

## Current source capabilities

- Cinemeta discovery, title details and season/episode selection.
- Search across Cinemeta plus search-capable installed Stremio add-on catalogs, with duplicate removal.
- Two playback tabs: configurable Web Sources and Stremio add-on streams.
- Native libVLC video, audio/subtitle track choices, local media, external subtitles and resume progress.
- Libtorrent magnet/torrent streaming through the native foreground service.
- Stremio and Nuvio login, cloud-library import and provider sync; PIN-protected Nuvio profiles remain unsupported.
- OpenRouter, Groq and Gemini API-key settings, with film/TV/anime suggestions.
- Theme choices, colour randomiser, font and poster sizing, collection management, offline settings export/import.
- User-defined source prioritisation, bitrate-conscious stream ranking, maximum labelled resolution, preferred codec and anime audio/subtitle filters.

## Known unfinished work

CloudStream binary plugin runtime compatibility, debrid services, downloadable upscaling engines, true player bitrate measurement and validation of individual Web Sources are not delivered by the changes above. Filters rely on provider stream labels; a low-bandwidth preference does not transcode video. UI/static tests are not evidence of successful device playback. Preserve all original Stremio functionality and add only media-related features. Gaming controls and app-discovery APIs were removed from this branch.

## Build

Android 8+, JDK 17, Android SDK 35 and Node 24. Inside this directory run `npm ci`, `npm test`, then `./gradlew :app:assembleDebug`. The resulting APK requires installation and device testing before release. LibVLC and libtorrent4j are fetched from their respective repositories by Gradle.



## Media-only provider/player development (1.0.2-dev)

This feature branch includes the media-only interface, watchlist and collections, themes, low-bandwidth and anime filters, direct HTTPS downloads, Stremio/Nuvio account import, and the existing libVLC and torrent engines. Additional provider/player fixes: Stremio `stremio://` manifest URLs, third-party catalog metadata resolution, supported request headers and safer stream fallback, provider-name prioritization, picture-in-picture in libVLC, extension-aware subtitle files, and lazy torrent initialization for account/UI commands.

**CloudStream is repository discovery only** in this branch: a public HTTPS index can list `.cs3` extensions, but no CloudStream binary plugins execute in this Android process yet. Do not call extensions installed or playable. PiP and physical-device playback still require hands-on testing. Web source results rely on external provider availability. No GPU/CPU upscaling or Real-Debrid account flow is implemented by these changes. Test with `npm ci && npm test` and `./gradlew :app:assembleDebug`.

This is a development-signed preview. A different signing certificate may prevent installing it over the currently published APK; backup app data before replacing it.
