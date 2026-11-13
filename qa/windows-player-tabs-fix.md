# Windows source deck visibility fix

Implementation commit: `67f84bf2ecd834da2ea438a18b18c845ce36b703`.

Build: https://github.com/HornyforCheese/Myrepo/actions/runs/43438862359

## Reported behavior

Opening a title used the original addon picker rather than displaying **Web Sources** and **Addon Providers**. The shipped source contained the two-tab source deck, but the generated wrapper bypassed it whenever `autoPlay` was true. Windows settings default `instantPlay` to true, and normal title/episode actions forward that setting as `autoPlay`.

## Change

Fresh title playback always opens the web-first source deck, irrespective of Instant Play. The original addon picker is mounted with `autoPlay={false}` when the Addon Providers tab is opened, so the user can select a stream. Download requests and changes to an already-active native player retain their existing route.

No saved settings are reset. The app remains version 1.0.1 with the same Mutiny app identity. The replacement is distributed as a separate player-fix release so the earlier installer remains identifiable.

## Regression evidence

The source integration test compiles and executes the generated wrapper with an element factory, checking the selected component and forwarded properties. It verifies fresh playback with `autoPlay` true, false and absent; manual addon selection; unchanged request data; and existing download/active-player routing. This is a component-routing test, not a Windows UI or playback test.

The same test was run against the previously released wrapper and failed with `Fresh title playback must show Web Sources and Addon Providers`. It passes against the fix. All 11 existing compatibility tests and full local TypeScript checking also passed. The Windows reconstruction workflow now runs these routing tests before building.

Windows optimized release compilation, NSIS packaging and installer upload passed. The native release compile took 9m 16s.

Installer artifact: https://github.com/HornyforCheese/Myrepo/actions/runs/43438862359/artifacts/14045703902

Complete source: https://github.com/HornyforCheese/Myrepo/actions/runs/43438862359/artifacts/14045856274

## Published installer

[Download the corrected installer](https://github.com/HornyforCheese/Myrepo/releases/download/windows-v1.0.1-player-fix/MutinyMedia-1.0.1-windows-x64-setup.exe).

[Release and checksum file](https://github.com/HornyforCheese/Myrepo/releases/tag/windows-v1.0.1-player-fix). Installer size: 372,140,819 bytes. SHA-256: `f1e758664d30254312bfc4c90f940533ccb1e25c4ee42404d80b31f799b36031`. The downloaded ZIP extracted successfully and the executable has a Windows PE/NSIS header. Publication independently checked that checksum and verified the successful build and exact source tag.

## Runtime verification still required

Fully quit the older Mutiny app, including its tray process, before installing and launching the replacement. Open a movie or episode from the normal desktop interface: Web Sources and Addon Providers should both be visible with Instant Play enabled. Try switching tabs and selecting a provider/stream.

Windows GUI and live provider playback remain for user testing. Big Picture has its own interface. Generating an embed URL does not establish that a provider carries a given title. The 570 live playback cases remain NOT_RUN.
