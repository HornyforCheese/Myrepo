# Windows 1.0.1 desktop-updates release

The combined Windows release includes the five-button desktop quick-action row (Web Sources, Local video, Stream magnet link, Settings and Ask AI), separate OpenRouter/Groq/Gemini AI configuration, the silent welcome screen and community-theme display branding. It also retains the earlier automatic web-source, two-tab player and Big Picture branding work.

## Verified build

- Source: `3736ec074084541a7e50f07e0cb95e30903a94ae`.
- Windows workflow: [43499763471](https://github.com/HornyforCheese/Myrepo/actions/runs/43499763471), passed.
- Publisher workflow: [44750909049](https://github.com/HornyforCheese/Myrepo/actions/runs/44750909049), passed.
- Compatibility tests: 41 passed, zero failed.
- Source-deck tests, three static branding passes, full reconstructed-app TypeScript checking and two native boundary tests passed.
- The optimized Rust build and NSIS installer packaging completed successfully on `windows-2022`.

The published installer is 372,173,327 bytes with SHA-256 `55c5579493a507d3cc3cec82b04589ba7fcf593e6c17377c6b56b221ea74bac0`. The publishing workflow accepted only the artifact from the source commit above and verified its digest before publishing.

[Release](https://github.com/HornyforCheese/Myrepo/releases/tag/windows-v1.0.1-desktop-updates) · [Direct installer](https://github.com/HornyforCheese/Myrepo/releases/download/windows-v1.0.1-desktop-updates/MutinyMedia-1.0.1-windows-x64-setup.exe) · [Complete source artifact](https://github.com/HornyforCheese/Myrepo/actions/runs/43499763471/artifacts/14073602529)

## User verification still required

No Windows GUI emulation was performed, as requested. Real local-file playback, torrent/magnet playback, authenticated Groq/Gemini requests, arbitrary installed community themes and the 570 web-provider/title cases require hands-on testing. A provider frame loading is not proof that it resolved or played the requested title. Theme wording baked into images, canvas output or unlabelled vector paths can require an individual asset edit.

## Chunk 4 follow-up

The 2026-11-23 web-source pass reduced the user-facing selector to eight repeatedly reachable endpoints: EmbedMaster, PrimeSrc, VidLink, VidFast, VixSrc, VidRock 1, VidRift and Mapple. Each returned HTML on three consecutive checks. Unreliable, blocked, undocumented and unconfigured choices were removed from the menu. All 41 compatibility tests, the source-deck integration/rollback suite and all three static validation passes passed after the correction. See [automatic web-source evidence](windows-automatic-web-sources.md). A new Windows installer is required for these post-release corrections.

Addon Providers remains a manual-selection tab: its original Stremio/Nuvio/CloudStream picker is always mounted with autoplay disabled. The native add-on browser now explicitly denies remote `window.open`/new-window requests, so provider verification pages cannot create automatic popup windows. A deliberate user action is required to open an external provider page.
