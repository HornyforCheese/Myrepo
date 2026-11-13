# Mutiny Media: Windows 1.0.1 integration workbench

**Windows only. This branch deliberately contains no Android app.**

This is the source patch/workflow workbench for the existing **Mutiny Media 1.0.1** Windows React/Tauri installation. The user's installed executable and source-updates were not a complete editable source checkout. This is **not** a finished 1.0.1 installer or a proof that any of the 57 web hosts can play the correct media.

## Contents

* A two-tab, web-first playback source selector with the existing add-on picker preserved.
* A catalog of 57 source names, 14 documentation-based URL adapters, and safe placeholder states for unconfigured sources. None is verified as streaming correctly.
* A cautious branding migration with compatibility-key preservation and rollback.
* Local static tests and a 570-case (10 titles × 57 providers) live Windows QA checklist.
* A GitHub Actions workflow that runs source-level checks and builds **only if** the complete, customized Windows source tree is available as `windows-src/`.

## Prerequisite for real Windows installer

The complete **Mutiny Media Windows 1.0.1 checkout** is needed. It must include `windows-src/package.json`, `windows-src/src-tauri/tauri.conf.json`, `windows-src/src/views/play-picker.tsx`, all existing modifications to settings/providers/themes and the Tauri/Rust tree. An installed `.exe`, a source overlay ZIP, or upstream Harbor 1.0.1 alone is not equivalent to the customized Windows source.

Place the complete Windows source under `windows-src/` (do not include `node_modules` or `src-tauri/target`). The workflow validates the version, applies the source-deck and branding patches, typechecks, builds via Tauri on `windows-2022`, and uploads the installer artifact if successful.

```powershell
corepack pnpm install --frozen-lockfile
node ..\tools\apply-player-deck.mjs --target .
node ..\tools\brand-windows-1.0.1.mjs . --apply
corepack pnpm run typecheck
corepack pnpm tauri build --bundles nsis
```

## QA and version gate

Run `npm install --no-save typescript` and `node tests/run-tests.mjs` and `node tests/three-pass-validation.mjs` to test patch mechanics and rollback. They **do not** test real playback.

`qa/web_sources_10x57_cases.csv` contains 570 **NOT_RUN** checks. Each needs a human or approved automated browser verifying the correct title or episode and 30 seconds of playback. An iframe loading alone does not count.

Do not rename legacy protocol, cache keys or third-party licence attribution without a compatibility migration. The displayed product name is Mutiny Media, but internal identifiers can remain for compatibility.

## Status

- Static source-deck tests: passed locally.
- Three branding validation passes: passed locally.
- Exact 1.0.1 reconstruction and guarded player/branding integration: passed locally.
- Full Windows compile: pending Windows CI; no installer is claimed until it passes.
- 570 real web-provider checks: not performed.
- Installer / GitHub Release: not published.
