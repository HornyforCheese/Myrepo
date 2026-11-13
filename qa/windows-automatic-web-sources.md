# Automatic web source setup and scoped iframe compatibility

## User-visible changes

The desktop Web Sources tab defaults to **Automatic**. It selects an entry with a configured URL and supported identifiers for the selected title, preferring entries without a mandatory compatibility acknowledgement. The ordinary list contains 42 preconfigured entries, up from 14. The remaining 15 names are retained behind **Show entries without a verified URL**. No speculative URLs or aliases to unrelated providers were installed for those names.

IMDb titles gain an automatic TMDB lookup using Cinemeta's public metadata endpoint. The response must identify the exact requested IMDb ID and media type; malformed/mismatched responses are rejected. Requests are coalesced, bounded and cached. No API key is required for this lookup. A late metadata response does not restart an already-open player when its URL is unchanged.

**Try next source** selects another configured entry for the same title. This is a user-triggered source switch, not a claim that the app can detect successful playback inside an arbitrary cross-origin iframe. **Open in browser** opens the selected title URL using the existing external-link handler.

## Sandboxed-frame error

Sandbox protection remains the default. **Compatibility mode for [provider]** is an explicit opt-in to a normal iframe. Consent is bound to the provider AND exact title URL, and is not transferred when the user changes source or title—even in the render before effects run. No global permission setting is changed. Hosts known to require a normal iframe still require acknowledgement before loading. This resolves the iframe sandbox restriction only after that per-host opt-in; a provider's own framing policy, availability, or authentication may still prevent playback.

The native main-window navigation boundary accepts only the app's own origins (plus the exact local development server in debug builds). Windows child iframe navigation is separate from top-level NavigationStarting. Default Wry new-window handling denies popup requests; the existing privacy extension and Tauri capability configuration are retained. A normal iframe is not a security sandbox.

## Source provenance and limitations

See [the provider audit](web-source-provider-audit.json) for the 28 added mappings, primary-source documentation/generators and the 15 unresolved entries. Numbered VidSrc choices use official mirrors; their numbering is not established to match DuaFile's internal list. The domain directory marks some older mirrors as still working but recommends the primary domain. Auto starts with the primary entry. Mirror entries do not imply independent video inventories.

The unresolved names are VidStorm, MoviesAPI, 2Embed, ZxcStream, Atlantic, Vidmario, Velarium, VidFlix, Nxsha 2, ModiPlay, MoviePire, VaPlayer, Cineby, AnyEmbed and CinemaOS. Searches and provider-site inspection did not establish current provider-owned URL formats for all of them; some services were unavailable or blocked from the execution environment. They are not presented as preconfigured.

The user requested all 57 entries. This implementation preconfigures the 42 supported by the available evidence; it does not claim the remaining 15 are implemented or working. Per-title live playback remains unverified. The 570 playback cases remain NOT_RUN. Big Picture has its own source picker; this web source deck is in normal desktop mode. The combined build also includes the Big Picture startup branding repair and previous Instant Play routing fix.

## Verification

21 compatibility tests pass, including actual URL selection, exact-ID resolution, request coalescing, recovery, and consent isolation across hosts/titles. Source-deck, episode URL, Instant Play routing, rollback/idempotency tests and three static branding validation passes pass. Live HTTP metadata checks returned tt1254207 → TMDB 10378 and tt1727587 → TMDB 45745. These checks establish metadata identity only, not stream availability.

The native boundary has two standalone Rust tests which the Windows workflow compiles and runs before packaging. Both native Rust tests passed in Windows CI. Full TypeScript checking, 21 compatibility tests, optimized native compilation and NSIS packaging passed. Native compilation took 15m 31s; the complete build took 32m 42s.

Source commit: `20b3a48881681f74df9dcf6dec1d615cd2e40f27`.

[Successful build](https://github.com/HornyforCheese/Myrepo/actions/runs/43453557318) · [Published release](https://github.com/HornyforCheese/Myrepo/releases/tag/windows-v1.0.1-automatic-sources) · [Complete source](https://github.com/HornyforCheese/Myrepo/actions/runs/43453557318/artifacts/14053806584).

Installer: 370,103,208 bytes. The downloaded ZIP extracted successfully and the executable has a Windows MZ header. SHA-256: `37dd54ce70d501aa54546e44f4eb7f33ccf503b0b2021f270561c81c15641710`. The publishing workflow independently verified this checksum and the exact successful source build/tag before uploading.

Primary platform references: [Tauri plugin navigation callback](https://docs.rs/tauri/latest/tauri/plugin/struct.Builder.html#method.on_navigation), [Windows Wry backend navigation/new-window handling](https://github.com/tauri-apps/wry/blob/dev/src/webview2/mod.rs).
