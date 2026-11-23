# Mutiny Media: Windows 1.0.1 integration workbench

**Windows only. This branch deliberately contains no Android app.**

This is the source patch/workflow workbench for the existing **Mutiny Media 1.0.1** Windows React/Tauri installation. The reconstruction workflow now produces a complete editable checkout from a pinned upstream revision and the checksum-verified archived customization overlay. A successful installer build is **not** proof that any of the 57 web hosts can play the correct media.

## Contents

* A two-tab, web-first playback source selector with the existing add-on picker preserved.
* A catalog of 57 source names, 42 preconfigured URL adapters, and safe placeholder states for unconfigured sources. None is verified as streaming correctly.
* Automatic source selection, exact IMDb-to-TMDB lookup without an API key, user-triggered next-source/browser options, and per-provider normal-frame compatibility. Fifteen unverified names are retained in the advanced list.
* A cautious branding migration with compatibility-key preservation and rollback.
* Local static tests and a 570-case (10 titles × 57 providers) live Windows QA checklist.
* A Windows reconstruction workflow that restores the full customized source, checks it, stages runtime dependencies, and builds an NSIS installer. It uploads the complete source separately from the installer.

## Current desktop release

* [Local video and magnet streaming buttons](qa/windows-media-buttons.md).
* [Groq and Gemini free-tier choices and separate API keys](qa/windows-ai-providers.md).
* Silent “Ahoy, mateys!” welcome screen.
* [Community theme text and CSS wordmark branding](qa/windows-community-theme-branding.md).

These changes are included in the verified [Windows 1.0.1 desktop-updates release](https://github.com/HornyforCheese/Myrepo/releases/tag/windows-v1.0.1-desktop-updates).

[Download the Windows installer directly](https://github.com/HornyforCheese/Myrepo/releases/download/windows-v1.0.1-desktop-updates/MutinyMedia-1.0.1-windows-x64-setup.exe). Quit Mutiny Media completely, including its tray icon, before installing because this build retains app version 1.0.1.

## Reproduce the Windows installer

Run `.github/workflows/reconstruct-windows-1.0.1.yml` using Actions → **Reconstruct and build Mutiny Media Windows 1.0.1** → **Run workflow** on this branch. It also runs on branch pushes.

The workflow checks out `Harborofficial/Harbor` at `d862943d27ca10beca26d0d53e7bf6be66688968`, verifies the archived overlay, repairs revision mismatches, applies the source deck and branding, runs full TypeScript checking, stages playback dependencies, and builds on `windows-2022`.

`tools/repair-windows-native.mjs` keeps the entry point consistent with the pinned Cargo/native implementation. The archived entry point referenced unavailable newer modules, removed working Capstan commands, and gated music/games against undeclared features. The repair uses the actual upstream 1.0.1 entry point and retains the overlay's Lite Browser command; it does not replace functionality with stubs.

Successful runs upload:

- `mutiny-media-windows-1.0.1-complete-source`: complete customized source tarball.
- `mutiny-media-windows-1.0.1-reconstructed-installer`: Windows NSIS `.exe`.

Download and extract the installer artifact ZIP to obtain the `.exe`. GitHub may require sign-in.

## QA and version gate

Run `npm install --no-save typescript` and `node tests/run-tests.mjs` and `node tests/three-pass-validation.mjs` to test patch mechanics and rollback. They **do not** test real playback.

`qa/web_sources_10x57_cases.csv` contains 570 **NOT_RUN** checks. Each needs a human or approved automated browser verifying the correct title or episode and 30 seconds of playback. An iframe loading alone does not count.

Do not rename legacy protocol, cache keys or third-party licence attribution without a compatibility migration. The displayed product name is Mutiny Media, but internal identifiers can remain for compatibility.

## Status

- Static source-deck tests: passed locally.
- Three branding validation passes: passed locally.
- Exact 1.0.1 reconstruction and guarded player/branding integration: passed locally.
- Full Windows release compile and NSIS packaging: [passed](https://github.com/HornyforCheese/Myrepo/actions/runs/43499763471) for source commit `3736ec074084541a7e50f07e0cb95e30903a94ae`.
- 570 real web-provider checks: not performed.
- [Download the current Windows installer](https://github.com/HornyforCheese/Myrepo/releases/download/windows-v1.0.1-desktop-updates/MutinyMedia-1.0.1-windows-x64-setup.exe). SHA-256: `55c5579493a507d3cc3cec82b04589ba7fcf593e6c17377c6b56b221ea74bac0`.
- [Complete customized source artifact](https://github.com/HornyforCheese/Myrepo/actions/runs/43499763471/artifacts/14073602529).
- [GitHub testing release](https://github.com/HornyforCheese/Myrepo/releases/tag/windows-v1.0.1-desktop-updates): includes the direct `.exe` and `SHA256SUMS.txt`. Windows GUI and live playback remain for user testing.
- [Combined desktop-updates verification report](qa/windows-desktop-updates.md).
- [Native build verification report](qa/windows-native-build-report.md).
- [Player tab visibility fix and regression evidence](qa/windows-player-tabs-fix.md): fresh title playback shows the source deck even with Instant Play enabled.

Latest changes and verification: [automatic source setup and iframe compatibility](qa/windows-automatic-web-sources.md), [provider audit](qa/web-source-provider-audit.json), [Big Picture startup branding](qa/windows-big-picture-branding-fix.md).
