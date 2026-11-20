# StreamPlay compatibility gate (before CS3 chunk 4)

## Verified user-supplied StreamPlay CS3 binary (2026-11-21)

- Filename: `StreamPlay.cs3`, 2,236,985 bytes.
- SHA-256: `94d7ec68ed45cf3527fb71d92460047cd3d1d5de8c92aa912122f7ed1117e332`.
- ZIP entries: `manifest.json` and `classes.dex` only.
- Manifest: `{"pluginClassName":"com.phisher98.StreamPlayPlugin","name":"StreamPlay","version":715,"requiresResources":false}`.
- Primary DEX header: `dex\\n035\\0`; uncompressed DEX length 5,922,668 bytes.
- Static byte inspection found references to CloudStream `SearchResponse`, `CloudflareKiller`, `APIHolder`, `ExtractorApi`, and numerous `com.phisher98` classes.
- **Important correction:** The previously reviewed public StreamPlay Gradle source declares `requiresResources=true`, but **this actual user-supplied v715 binary declares `requiresResources=false`**. Prior public source may be a different revision. Treat the binary as authoritative for its own manifest.
- Inspection was static only; the DEX was not loaded, executed, or verified against Android. Exact source revision and external API availability remain unknown.
- Required acceptance: run this exact hash through the isolated compatible host, register `com.phisher98.StreamPlayPlugin`, verify provider registration, search, metadata, episode resolution, extraction and player handoff. **Currently not working**.


Target: **StreamPlay**, the user's only required CloudStream extension. Do not treat generic CS3 import as success.

## Inspected reference

The public `tpadev/phiser-streamplay` repository's `StreamPlay/build.gradle.kts` describes an Android-only CloudStream plugin (`isCrossPlatform = false`), `requiresResources = true`, CloudStream pre-release host dependency, Android Material and Browser dependencies, and numerous `BuildConfig` API/token fields supplied from `local.properties`. This is a **candidate reference**, not yet verified as the exact binary/version the user has installed.

## Current Mutiny Media limitations

- `CloudStreamPackageStore` imports CS3 archives as `imported-inactive` and exposes `executionSupported=false`.
- `CloudStreamWorker` currently rejects validated requests. No executable CloudStream ABI, resource loading, plugin lifecycle, provider registration, search/detail/loadLinks bridge or network mediation exists.
- A CS3 archive alone does not establish whether its build-time configuration fields contain working values. Do not assume any public repository contains valid credentials or bundle secrets into Mutiny.
- StreamPlay may require a full CloudStream API surface, Android resources and extractor dependencies; implement against a **specific source/binary revision**, not a name alone.

## Acceptance criteria before marking StreamPlay working

1. Identify the exact StreamPlay CS3 release, version, SHA-256 and its corresponding source revision. Inspect its manifest, resources, DEX class list and host API calls without executing it.
2. Build and run a permission-isolated host with required CloudStream interfaces and resources; mediate network calls and bound outputs. Do not load plugin DEX in the main app process.
3. Verify StreamPlay registers its provider(s) and that search, metadata, episodes and link extraction work for permitted test media. Report external-source failures separately.
4. Confirm source selection, request headers, subtitles and player handoff on an Android device; validate cancellation, timeouts, isolation, provider removal and app restart.
5. Execute regression tests and an Android build. Record actual results, commit SHA and reproducible logs.

**Current status: NOT WORKING / NOT VERIFIED.** CS3 chunk 4 is blocked by this StreamPlay acceptance gate.

## StreamPlay v715 exact-binary host ABI inventory

Static extraction from the uploaded `classes.dex` found **99 distinct `Lcom/lagradost/cloudstream3/...` class descriptors**. This is a lower bound on host API compatibility, not a method-level dependency graph.

Key referenced classes and packages:

- Plugin lifecycle: `plugins/Plugin`, `plugins/CloudstreamPlugin`, `plugins/PluginData`, `plugins/PluginManager`
- Provider contract: `MainAPI`, `MainAPIKt`, `APIHolder`, `MainPageRequest`, `MainPageData`
- Discovery: `SearchResponse`, `MovieSearchResponse`, `AnimeSearchResponse`, `HomePageResponse`, `HomePageList`
- Metadata: `LoadResponse`, `MovieLoadResponse`, `TvSeriesLoadResponse`, `AnimeLoadResponse`, `Episode`, `TvType`
- Extraction: `utils/ExtractorApi`, `utils/ExtractorLink`, `utils/ExtractorLinkType`, `utils/M3u8Helper`, `utils/JsUnpacker`, plus 20+ named extractor implementations
- HTTP/browser: `network/CloudflareKiller`, `network/WebViewResolver`
- Other host APIs: `syncproviders/AccountManager`, `syncproviders/SyncAPI`, `syncproviders/providers/AniListApi`, `utils/DataStore`, `utils/AppUtils`, `CommonActivity`, `CloudStreamApp`

**Engineering consequence:** the existing three-operation JSON IPC protocol alone cannot run this binary. The plugin expects a substantial CloudStream Android/Kotlin host ABI. A fabricated stub that merely makes class loading succeed would not meet the user's functional requirement. Next: resolve actual invoked method signatures and compatible dependency versions, then build and execute the isolated host against this pinned binary. Do not claim playback until verified.
