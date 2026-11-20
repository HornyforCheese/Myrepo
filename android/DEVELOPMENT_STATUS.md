# Mutiny Media Android development handover

Development branch: `android-v1.0.1-engines-development`. Start from its actual remote HEAD and compare with the implementation SHA in development-checkpoint.json. No numbered 32-chunk roadmap was found on the target branch. Task IDs below are reconstructed. Earlier chunk labels 1–5 describe scope only.

| Requirement | Implementation and integration | Evidence / remaining acceptance |
|---|---|---|
| Homepage and media-only navigation (historical 1) | Five home actions, top navigation, JS Back, native document picker and prompt support. Removed game RPCs, launcher-package visibility, Steam UI and AI game prompt. | DOM fixtures cover action count and Back. Installed Android intents and touch deferred. |
| AI conversation and model settings (2, 5) | app.js → NativeApi → AiClient. Bounded prior turns, references separate from query, provider-specific configuration, encrypted batch writes, stale reply rejection after clearing. | AiClientTest and DOM fixture. Still audit Gemini catalogue pagination, independent key deletion and attribution after reload. Live accounts unverified. |
| Anime discovery and stream labels (3, 4) | Cinemeta text search followed by genre filter; per-stream label filters and bounded cache. | Partial. Default text query is not a genre catalogue. Dual audio alone cannot identify both languages. Track inspection/preferences remain open. |
| Stremio catalogue search | catalog-search.js → search → detail → source tabs. Bounded concurrency, namespaced custom IDs, IMDb deduplication, local manifest migration, partial failure handling. | Fixture tests for outage, malformed lists, old manifests and ID collisions. Account-sourced add-ons and CS3 results still need integration. |
| Accounts and torrents | General Settings exposes native login, profile sync, library and logout. Streaming Server exposes torrent selection and play. Accounts/SecureStore commit credentials and profile together. | DOM fixtures, AccountSessionTest. Next integrate synchronized add-ons by account and profile. Offline logout clears locally. Live provider behaviour unverified. |
| CloudStream | Native index discovery and inactive local/HTTPS package import, checksum and structural inspection, private storage, list/remove. Origin-scoped bridge. | Repository fixtures, archive fixtures, Android source compilation. Missing isolated runtime, provider/extractor registration, execution, metadata, stream resolution, updates and dependency handling. |
| Player and Windows parity | Windows source-deck.tsx and source-deck-catalog.ts compared with Android source tabs and 42-adapter catalog. libVLC player exposes track selection and local resume. | Model fixtures cover identifier mapping and episode selection. Configurable embed templates, preference application, error-driven fallback and end-to-end playback still open. |

## Resume

Inspect the latest CI job first. Android pushes compile Java and run fixtures. Only manual workflow dispatch packages the APK. Never dispatch during ongoing development. No installed-app testing or final APK has been performed this session.

The CS3 foundation came from the separate feature branch; it had no executable host. Upstream CloudStream commit `b8450407714220db06fbfa8477bbdd4f7d3b99d1` separates Android Plugin.load(Context) from BasePlugin registration in APIHolder and the extractor registry. Model the isolated process and mediated input/output before loading third-party code. The separate account branch contains account-addons.js with an existing reconciliation fixture; verify user *and profile* scope before reuse. No branches were merged.

Run npm ci and npm test under android. Java and browser fixture commands are in the workflow. Local Chromium startup hit an OS socket restriction. Hosted Chrome runs the UI fixtures. Check the actual hosted job result before citing these as passed.
