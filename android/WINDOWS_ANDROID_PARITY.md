# Windows-to-Android feature parity audit (workstream 7)

Status: **PARTIAL**, not complete. This document compares known Windows requirements with the Android implementation visible in the development branch. The Windows application source was not accessible at the two previously documented paths on this branch; therefore Windows feature claims below come from the project's existing DEVELOPMENT_STATUS.md and user requirements, not a fresh Windows source-level diff. Do not count this as verified full parity.

| Feature | Android source status | Remaining gap / acceptance |
|---|---|---|
| Mutiny branding, media-only navigation, five home actions | Implemented in UI source | Installed Android touch, Back and navigation tests |
| Stremio catalogue and addon sources | Catalogue search, detail and source tabs implemented | Verify account/profile-scoped addons and live sources |
| Nuvio accounts | Login/profile sync infrastructure exists | Live account, catalogue and source handoff tests |
| CloudStream StreamPlay v715 | CS3 import, digest checks, isolated IPC only | Full Kotlin/CloudStream host ABI, plugin execution, provider registration, search, metadata, extraction and playback |
| Web Sources / addon-provider source deck | Android source tabs and adapter catalogue documented | Compare Windows source deck against Android using actual Windows source revision; validate embedded web playback policy |
| Universal search and duplicate merging | Search, IMDb deduplication and bounded concurrency implemented | Add CloudStream results, verify cross-engine merge and ranking |
| Quality and low-bandwidth selection | Quality choices, low-bandwidth ranking of labelled streams | Actual bitrate measurements, network adaptation and player settings |
| Audio/subtitles and anime | Label-based anime filters, native track selection | Reliable language/dual-audio detection, track-aware selection, live media tests |
| Automatic stream fallback | Partial failure handling during catalogue search | Runtime playback failure detection and source retry |
| Player | libVLC, resume, track selection | Headers, subtitles, playback diagnostics, error recovery, quality filters and player controls |
| AI search and free model settings | Native AI provider config, model discovery, conversation | Verify live providers, zero-cost eligibility, key isolation and pagination |
| Appearance and theme settings | Dark/light/system, palettes, compact cards, reduced motion | Theme Studio equivalent, fonts, layouts, poster/card and player UI customisation |
| Import/export settings | JSON export/import and preference reset | Import now filters boolean and enum types; test round-trip, malformed JSON and migration |
| Collections and history | Local library/bookmark and resume components | Collections and unified cross-provider history parity |
| Controller/TV layout | No completed TV/controller parity evidenced | Navigation focus, remote input, big-picture UI |
| Upscaling and resolution filters | Resolution preference exists | Actual GPU/CPU upscaling controls and verified resolution filtering |
| Background and Android-specific settings | Settings UI exists | Native WakeLock/background permissions and services |
| Local video and torrents | Native picker, torrent engine and libVLC playback | Device permission, torrent and playback testing |
| Gaming features | Removed from Android by design | Not a parity requirement |

## Workstream 7 completion criteria

1. Obtain and pin the exact Windows counterpart source/build; compare actual implementation, not just feature descriptions.
2. Implement missing applicable functionality, excluding gaming as requested.
3. Run Android automated tests, compile, install and perform device tests for navigation, accounts, search, settings, player and CloudStream.
4. Record observed evidence, bugs and commits for each row; only mark completed after verification.

## Work performed in this pass

- `caee59f1cbc0f4620c85fbb70a156e4c0e14ce39`: constrain imported settings by expected types and enumerated values rather than accepting arbitrary booleans/strings for every preference.
- `5c82a8cf5b8a6626f90026dc6e1d07c6bdb53114`: correct the anime-audio enum to the actual UI values (`any`, `dub`, `sub`, `dual`).
- No automated test or Android build executed; settings source was fetched and reviewed. Full workstream remains partial.
