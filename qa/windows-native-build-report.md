# Windows 1.0.1 native build verification

Source implementation commit: `ab184a73ceebfc063c5d6aedc0fbaff0111907f1`.

Native build: https://github.com/HornyforCheese/Myrepo/actions/runs/43424519242

## Root cause and repair

The archived customization overlay carried a native `lib.rs` from a different upstream revision. It referenced absent modules (`process_output`, `native_module`, `ytdlp_update`), newer command implementations, and undeclared music/games features, while the accompanying Cargo manifest, native implementations and frontend CloudStream bridge remained at Windows 1.0.1.

The reconstruction now restores `lib.rs` from the exact pinned upstream commit `d862943d27ca10beca26d0d53e7bf6be66688968`, then adds the existing Lite Browser module and command and updates the embedded document title. All original Capstan commands, playback cache, music and games implementations remain registered. No no-op command stubs were introduced. The patch checks the upstream revision, requires unique source anchors, verifies root modules exist, keeps an original-file backup, and checks CloudStream command registration.

## Verification evidence

- Native repair applied twice with identical resulting SHA-256: `853b2ef8cd0a03198933569284013eb15a8b5797b34826934cb204022fecbe88` (before subsequent branding).
- 541 root-qualified native command references found implementation functions in the corresponding module trees. This is a static preflight, not a substitute for Rust compilation.
- All 11 compatibility tests passed.
- Source-deck tests passed: TypeScript syntax, 57 source names, 14 documented URL adapters, anime audio selection, PrimeSrc TMDB fallback, safe application, verification, idempotency and rollback.
- Full frontend production build passed locally.
- Windows CI reconstruction, full TypeScript checking and runtime dependency setup passed.
- Native release compilation passed (`release` profile, optimized; 25m 25s). NSIS packaging and installer upload passed. The workflow finished successfully.
- Installer: `Mutiny Media_1.0.1_x64-setup.exe`, Windows x64, 372,157,439 bytes.
- Downloaded artifact ZIP extracted successfully; installer has the Windows executable `MZ` header.
- Installer SHA-256: `10bce43800690d18340e55b433b0821b934b8f71d1187acc79821491028c8ada`.
- [Installer artifact](https://github.com/HornyforCheese/Myrepo/actions/runs/43424519242/artifacts/14039866472).
- [Complete source artifact](https://github.com/HornyforCheese/Myrepo/actions/runs/43424519242/artifacts/14036445755).

## GitHub release

The checksum-verified installer and SHA256SUMS.txt are published at https://github.com/HornyforCheese/Myrepo/releases/tag/windows-v1.0.1 as a testing prerelease. The tag points to the exact source commit used by the successful build. Publication used the existing artifact; it did not rebuild or alter the executable.

## Runtime limits

No Windows GUI, installation, account login or live playback testing was performed. The user will test the executable. The 570 web-provider playback cases remain `NOT_RUN`; 43 of the 57 named sources require configuration. A generated embed URL or successful installer build does not establish provider availability or playback success.
