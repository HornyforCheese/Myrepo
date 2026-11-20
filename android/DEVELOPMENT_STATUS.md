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

## Windows parity/UI chunk 2: live system appearance and Android status bar

- Implementation `ac039eeb37da08e39b5b21780da3b6d7cc19e084`: app theme selection updates the `theme-color` meta tag, and System theme listens for device light/dark preference changes. Invalid stored theme values fall back to Dark.
- Fixture `79a51f9a2e1c50d462c38294eb0a8b5cbf1ae6f2`: static assertions for appearance event and theme-colour wiring.
- Re-fetched GitHub source and fixture to verify committed text. **npm/browser tests and Android status bar behaviour not executed; no APK built.**

## Windows UI parity audit: correctness and scope

- Fixed over-escaped static appearance test assertions in `19d6b68140f00e847efa12fe9d98ff8fa6cb7549`. Previously added assertions could incorrectly fail against correct source.
- Removed misleading Spanish/French interface choices in `4008d55044506666ddbe3de8956deb4083c9d5e0`: interface strings remain English, and storing a language preference did not translate the UI.
- Re-fetched source and fixture to confirm both edits. **No npm tests, Playwright browser checks, Android runtime testing or APK built.**
- Windows UI parity **remains PARTIAL**. Full feature comparison, functioning translations if required, navigation, settings, player parity and current CI evidence are outstanding. Do not mark complete based on visual/theme changes alone.

## CloudStream runtime sequence, chunk 1: multi-DEX validation

- `70f535d79bb02247926443dae1b43a8053281ea8`: reject malformed `classes2.dex` and subsequent secondary DEX headers during archive inspection; primary DEX remains mandatory.
- `fb2d2a195b1f112228e6cbb81b1b84cb0b113575`: negative fixture for malformed secondary DEX.
- Source and fixture re-read on GitHub; **Java tests not executed, runtime still inactive, provider execution not implemented, no APK built**.
- User-requested order: complete 4–6 bounded CS3 runtime/provider execution chunks, then 2–3 Stremio/Nuvio integration chunks. Next: isolated execution process contract and mediated provider dispatch, without granting untrusted DEX direct host privileges.

## CloudStream runtime sequence, chunk 2: bounded provider request contract

- `fcc4690656254fc1d166b2590e77edcbcacbc91b`: added `CloudStreamRequest` validator allowing only search, metadata, streams; provider IDs, media types, UTF-8 request size, query/ID limits and control-character checks.
- `32e56c043cb5440eed20f9b459d7f6abe1fd4e38`: request contract negative fixtures. Follow-up checked-JSON exception signature fixes `adf76a64ec201924088b61dba1e9dc8f4988a834`, `6f2852678f4749fcf452a8c2cd1aca5ecb6800ca`, `faa875fc886c1f890693b1d53795e7cf76b09b63`.
- GitHub source re-read confirmed files. **No Java/Android compilation or test execution; no isolated request transport or provider code execution; no APK built.**
- Next: isolated request/reply transport with deadlines, then mediated CloudStream ABI/provider registration and dispatch. Stremio/Nuvio integration follows requested CS3 sequence.

## CloudStream runtime sequence, chunk 3: isolated worker transport

- `d375da884c218f067c4c81323a01d8237179d99d`: `CloudStreamWorker` permissionless worker service endpoint, validates request and fails closed until actual provider ABI exists.
- `7c36c694518e26bc8db8739c3ffc5a7f3ef90986`: register worker non-exported with `isolatedProcess=true`.
- `2442f1c1aa6d045c50611b8b16f9d7bd63232e85`: `CloudStreamTransport` with main-thread guard, 8-second timeout, disconnect/binder-death failure and bounded response; currently not exposed through `NativeApi`.
- `b90b7797a88f5901380d40ff4a37142f596bf9a8`: static contract fixture, not executed.
- Source re-read confirmed commits. **No Java/Android compilation, tests, live IPC, actual CS3 loading, provider execution or APK build.**

## StreamPlay compatibility hold

User's sole required CS3 provider is StreamPlay. Candidate upstream `tpadev/phiser-streamplay/StreamPlay/build.gradle.kts` declares Android-only, `requiresResources=true`, CloudStream pre-release dependency and build-time API/token fields. These imply requirements beyond ZIP/DEX validation and generic IPC. Exact installed binary/version not yet known. Added `android/STREAMPLAY_COMPATIBILITY.md` in `4aff33618dc0d2af5f35427d942e00c8074ac88a` with acceptance gate. **StreamPlay does not yet execute in Mutiny; no live tests performed.** Hold generic chunk 4 until compatibility is verified.

## Exact StreamPlay v715 binary received

User uploaded `StreamPlay.cs3` (2,236,985 bytes, SHA-256 `94d7ec68ed45cf3527fb71d92460047cd3d1d5de8c92aa912122f7ed1117e332`). ZIP has `manifest.json` and `classes.dex`; manifest specifies `com.phisher98.StreamPlayPlugin`, version 715, `requiresResources=false`, contradicting candidate public source. Static DEX035 inspection found CloudStream API references. Compatibility gate updated in `986676c338dd661e37df9d9d7937e76948b2303d`. **No execution or runtime success.** Continue targeted host ABI work before CS3 chunk 4.

## StreamPlay chunk 4: native bridge, not executable runtime

`b8e741d6be481c2eddaa3f88c59e9b388905dd7d` and `0bb63eaa648bd0f4440293766a95bdb5e353e9af` add installed package hash lookup; `c72a15755332407f6dd2a39171d2958576f8d35b` adds `cs3.request` native dispatch pinned to uploaded StreamPlay v715 SHA-256 and existing isolated transport; `db8cefd0503606afbd4829e5bb2f6cfa8a63de02` adds static source assertions. No tests executed. Worker still rejects requests. **No working StreamPlay runtime or APK.**

## StreamPlay v715 DEX host method inventory

Static Python DEX method-ID parsing of user-uploaded v715 binary identified 211 method references in 81 CloudStream class owners; see `android/STREAMPLAY_COMPATIBILITY.md` commit `35dbf67cf8b5bb6c1bb8e760d92cef66e00f56d2`. Added reproducible local Node inspector `android/tests/streamplay-abi.mjs` in `e335111c86785eab56699682b37218a55d699f83`. Inspector source re-read but Node script not executed; independent Python parsing ran. This is compatibility analysis, **not executable plugin integration**. No APK/device test. Cannot support 90% reliability estimate.

## StreamPlay pinned archive descriptor IPC

`272ee89755405989d0bb58e343882146faf40bcc` passes pinned archive via read-only ParcelFileDescriptor to isolated worker, `37beff0038c60d842691dd29902f3f67aa44b54d` binds native API to digest-aware transport, `66da718066b6921786b021095c768f356dddff31` adds worker-thread SHA-256 verification before failing closed, and `c3a6406ce6716e9787039df921c5ae68e7c48c2e` updates static regression assertions. Source re-read only, no tests or APK. **StreamPlay still cannot execute; full CloudStream host ABI missing.**
