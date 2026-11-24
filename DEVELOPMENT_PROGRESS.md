# Mutiny Media Windows V200000 — Development Progress

## Scope

Prompt 1 of 5: Interface and Avatar Upgrades. Windows application only. Android is explicitly out of scope.

## Baseline (2026-11-23 Pacific Time)

- Existing Ask AI implementation inspected in `src/lib/mutiny/desktop-actions.tsx` and the recovered complete Windows source.
- Existing AI provider/model/key integration is functional and must be preserved.
- Existing title resolution uses `resolveAiSuggestions` and `AiResultList`; resolved results already navigate to title details.
- Existing requests use `AbortController`, providing the foundation for stop-generation and recovery.
- No authoritative human pixel-art pirate avatar is present in the workbench or recovered Windows source.
- Workspace filesystem is full (approximately 16 MB free), preventing creation of a clean detached baseline checkout.
- Baseline test attempt without dependencies failed because TypeScript is not installed in the workbench.
- Retrying with the recovered checkout's TypeScript reached the suite, but the runner cannot spawn the managed Node binary (`EPERM`); direct compatibility tests reported 4 passing and 6 environment/dependency failures.
- A previous, separate Cloudflare/source-deck task has uncommitted files. They are preserved and must not be included in the V200000 checkpoint.

## Checkpoint Status

### Checkpoint 1 — Ask AI interface

- [x] Existing implementation inspected.
- [x] Existing provider integrations, result resolver and cancellation support identified.
- [ ] Titles Only landing mode.
- [ ] Full Chat mode.
- [ ] Authoritative avatar displayed in Chat.
- [ ] Copy, retry and stop controls.
- [ ] Focus, keyboard and accessibility verification.

The authoritative master has now been received in pirate.zip and extracted unchanged to `public/ai-avatar/pixel_pirate_with_charcoal_glove.png`. SHA-256: `1ee1b98a66b3596f7fca482c17ffef6516569073d6461c21c017097009d843be`. Chat displays this exact asset with pixelated scaling. Titles Only/Chat selectors, copy-response and stop-generation controls have been added. Windows reconstruction stages the updated component and master asset. Animation, retry, full validation and the recoverable completion checkpoint remain pending.

### Checkpoint 2 — Avatar visual preservation

- [ ] Master asset received and checksummed.
- [ ] Original preserved byte-for-byte as default idle frame.
- [ ] Pixel-art scaling verified.

### Checkpoint 3 — Avatar animations

- [ ] Idle/blink state.
- [ ] Thinking state.
- [ ] Talking state.
- [ ] Recovery and visibility lifecycle.

### Checkpoint 4 — Performance and settings

- [ ] Animation toggle.
- [ ] Reduced resource usage and playback isolation.
- [ ] Typecheck, relevant tests and Windows build validation.

## Modified Files

## Prompt 1 implementation verification

- Added `pirate-avatar.tsx` and `pirate-avatar.css`: immutable idle master, low-frequency blinking, subtle thinking motion with the original hand-on-chin pose, and three talking mouth positions. Facial motion uses small composited overlays; visual acceptance on Windows remains pending.
- Talking is driven by actual SSE text deltas, with a 350 ms inactivity timeout. Thinking resumes between chunks. Stop, close, completion and failure clear the active state. Hidden documents pause all avatar activity; reduced-motion preferences disable CSS movement.
- Animation preference is available in Ask AI and AI provider settings and persists locally. Pixelated scaling is used. No playback APIs are called by animation code.
- Streaming transport handles split UTF-8/SSE chunks, provider errors and abort signals; existing non-streaming callers remain compatible.
- Final checks: 43 compatibility tests PASS; player regression suite PASS; complete-source TypeScript check PASS with a 6 GB Node heap; changed-file formatting/lint PASS (four modules). Existing Vite plugin deprecation warnings remain unrelated to this task.
- Windows workflow stages the avatar master, component, styles, AI transport and settings modules. Windows build and interactive visual acceptance remain pending; this document does not certify those checks.
- Additional modified files: `.github/workflows/reconstruct-windows-1.0.1.yml`, `src/lib/mutiny/ai-services.ts`, `src/lib/mutiny/ai-provider-settings.tsx`, `src/lib/mutiny/desktop-actions.tsx`, `tests/ai-services-compat.test.mjs`.

Latest verification: AI provider compatibility passes; `git diff --check` passes. The player regression runner reaches child-process integration checks but fails to spawn the managed Node executable with EPERM. Retry response now reruns the last user turn without duplicating subsequent assistant output. Titles Only accepts an empty conversational answer while resolving the returned titles. Full animation implementation and Windows validation remain incomplete; this is a partial recoverable checkpoint, not Prompt 1 acceptance.

- `DEVELOPMENT_PROGRESS.md` — tracking document required by Prompt 1.
- `ACCEPTANCE_CRITERIA.md` — verifiable Prompt 1 completion criteria.

## Known Issues and External Blockers

1. The authoritative avatar image is absent. Implementation cannot legally or accurately recreate its face, logos, clothing or pixel art.
2. The workspace volume is full, preventing dependency installation and a clean baseline checkout.
3. This managed Linux environment cannot directly validate the Windows NSIS executable; GitHub Actions is the intended Windows build validator after implementation.

