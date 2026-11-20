# CloudStream .cs3 integration: implementation status

## Implemented on this branch

- Discover public HTTPS CloudStream repositories, preserving each extension's optional `fileHash`.
- Import .cs3 packages from repository URLs or Android's document picker.
- Inspect ZIP archives for `manifest.json` and `classes.dex`; verify manifest `pluginClassName`.
- Enforce a 48 MiB per-file cap, SHA-256 checksum when supplied, a 150-package registry limit, and read-only storage in the app's private files directory.
- Persist installed-package metadata; expose listing and removal in Settings through the origin-restricted native bridge.
- Do not grant remote WebViews direct access to extension operations.

## Not implemented: executable CloudStream host

**Imported packages are currently inactive.** A .cs3 ZIP is not a provider configuration; it contains compiled Dalvik classes that depend on CloudStream's Kotlin/JVM/Android API and third-party libraries. Importing, parsing, or storing the file does not register or execute its providers. UI and native capabilities state this explicitly.

For actual source-provider parity, a separate, fully integrated runtime must:

1. Supply the CloudStream ABI required by third-party extensions (including `Plugin`, `BasePlugin`, `MainAPI`, `APIHolder`, provider response models, network helpers, extractors, coroutines, and binary-compatible Kotlin signatures).
2. Safely load a **read-only** installed .cs3 with Android's classloader; instantiate its manifest-declared plugin class and invoke `load(context)` while collecting registered provider/extractor instances. Use compatibility and lifecycle checks and handle startup failures without breaking the rest of Mutiny Media.
3. Add asynchronous native RPCs for provider discovery, search, title load, seasons/episodes, stream links, and subtitles, then integrate their results with Mutiny Media's universal search, source ranking, native playback, retry/fallback, watch history, and settings. Respect plugin-specific identifiers rather than assuming IMDb IDs.
4. Support refresh/disable/uninstall, provider selection, explicit trust notices, and per-plugin diagnostics. Imported extension code runs with **the app's permissions**; a ZIP-format check or SHA-256 integrity check does not make third-party code safe.
5. Test representative real .cs3 packages end-to-end on an Android device, including image loading, search, title details, video resolution, headers, subtitle handling, updates, bad packages, and offline restart. Run `npm test`, `npm run test:ui`, and `./gradlew :app:assembleDebug` in CI.

Do not label this feature as "fully supported" or ship it as live CloudStream integration until these runtime and end-to-end requirements pass.
