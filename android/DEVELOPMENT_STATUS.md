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

## Additional bounded security fix

- Commit `bffd3cdb132f75dea8719d1799df15d9f51717ba`: CS3 package import now uses a `long` byte counter and a pre-addition size guard, preventing integer overflow from bypassing the 48 MiB compressed-file limit. Source re-read confirmed the guard. **Static source verification only**: Java compilation, runtime import tests and CI were not executed for this change. This does not implement CS3 execution or provider registration.

## CS3 archive entry path hardening

- Implementation commit `37e2b8478838ee30c05171b04297efae5fa65a5c`: reject absolute paths, drive-prefixed paths, backslashes, dot and parent-directory segments, and ambiguous empty segments in `.cs3` ZIP entries.
- Fixture commit `033b72a7682be160c50153f83dffd88aa913e0b3`: add negative-path archive fixtures for those cases.
- Verification: fetched both updated files back from GitHub and inspected changes. **No fixture execution, Java compilation, CI pass, APK build or device test is claimed.** Runtime provider execution remains unavailable.

## CS3 Java syntax repair

- Commit `40d93778fa22637c18a0c061f5f5ceae26b7a2b0`: fixed the previously invalid Java character literal in the archive backslash path guard.
- A standalone Java `javac` and `java` check compiled and exercised the corrected guard successfully. This **does not** verify the complete archive class, full regression fixtures, Android compilation or hosted CI. No APK was built.
- Next: inspect hosted Android CI for the changed branch, then advance to isolated CS3 runtime and provider ABI.

## Chunk 4: CS3 control-character path rejection and CI diagnosis

- Implementation commit `2eb647a26b263b14e2666774c667379847751f19`: reject C0/DEL control characters in `.cs3` ZIP entry names, before future resource extraction.
- Fixture commits `5f561647d57674920af944714e0ecfc7b3cc675a` and `c466d45e61de90e067af26ef3956514bd3e91fe5`: add control-character path cases without Java Unicode-escape source hazards.
- Inspected historical GitHub Actions run `44822049872`: Android Java compilation and native fixtures succeeded, but UI fixture failed with a modal dialog intercepting a click on My library. This is an **older run**, not confirmation of current branch CI.
- Source files were re-read after commit; new tests and current Android CI **not executed/verified**. No APK built. Next: verify current CI, repair modal/navigation test failure if reproducible, then CS3 isolated runtime work.

## AI-first development sequence (user priority)

- AI chunk 1 implementation `bf33e6520b942bcda0b9ff71b24da2ba7e2299cf`: OpenRouter models with missing pricing no longer qualify as verified free solely from a `:free` suffix.
- Regression fixture `82f985426cba0e795632aec931ca9b9d35ebea83`: covers unpriced suffix, paid model, and explicitly zero-priced model.
- GitHub source re-read verified both changes; **fixtures not executed, Android compilation/CI not checked**. No APK built.
- Requested order: finish AI catalogue and credential verification, then anime discovery/preferences, then Windows parity and UI. Resume CloudStream runtime afterward.

## AI chunk 2: Gemini catalogue pagination and provider-key isolation

- Implementation `50bc7325d6b92071901bca3ed7248d82a774ff02`: reject oversized Gemini pagination tokens before reuse.
- Fixtures `b35f3570f98e550d73ece96607b930f9cb3ce592`: cover two-page Gemini discovery and per-provider API key removal.
- Source re-read verified both changes. **No fixture execution, Android compilation, CI result or APK build verified.** Live provider credentials and model eligibility remain untested.
- Next: execute Java AI fixtures and compile, then anime discovery/stream preference chunks, then Windows UI parity.

## Anime chunk 1: explicit genre browsing

- Implementation `4623b11644304d855014ebb71a85a2c071c8d567`: separate `genre=Anime` catalogue browsing from title search, retaining genre-tag filtering.
- Retry correction `6fd4c7d985cbf2d4a6bab89eb68ea73c4863bbb5`: retry the same browse or search mode.
- UI fixture `7c6ad4ab552893258c613d8dec807a5f7fce0d0d`: mock genre results and assert non-Anime titles are filtered.
- GitHub source re-read verified changes. **UI fixture not executed, live genre endpoint not checked, no APK built.** Next anime chunk: stream/audio/subtitle preference verification; then Windows parity.

## Anime chunk 2: conservative stream label negation

- Implementation `5cdb4497a332918233a3430e737573f80cac859a`: ignore English dub, Japanese audio, subtitles, and dual-audio labels when directly negated by no/not/without.
- Regression fixtures `c64984c8e33ac3c202047971cb9c91a6834b7aad`: cover negated and affirmative stream descriptions.
- Re-fetched GitHub files to verify source and fixtures; **tests not executed, actual media track detection not verified, no APK built**. This is provider-label filtering, not reliable language-track identification.
- Next: run JS and UI fixtures, then Windows feature parity and interface chunks in user-requested order.

## Windows parity/UI chunk 1: appearance palette

- Implementation `8d02b97c02fe14bf5625e0ed4d7cad656a76d9f5` and `86cae5bd9c46ed2ebccd1ab02dfa5a16c59c3e14`: make existing light/system theme settings control core background, text, navigation, hero, and settings panels with CSS variables; system mode respects `prefers-color-scheme:light`.
- Fixture `fef47ecb613820cb30aee80d6f4df57abacdcced`: static appearance palette wiring assertions.
- GitHub source re-read confirmed files. **Test execution, screenshots, live device theme changes and APK build not verified.** Further UI styling and functional Windows parity remain open.
