# Big Picture startup branding fix

Implementation commit: `08c9178`.

Build: https://github.com/HornyforCheese/Myrepo/actions/runs/43444498385

## Cause

Big Picture's `bp-intro.tsx` independently loaded `harbor-lottie.json`, a graphical wordmark, and rendered a separate inline SVG in the settled/static path. A text-string branding scan could not rename text drawn as vector artwork. The early television entry also inlined the upstream mark.

## Fix

The reconstruction now replaces Big Picture's animation and settled fallback with the supplied `/mutiny-mark.png` and a visible MUTINY MEDIA caption. Big Picture's intro uses that product mark directly so a previously saved launch animation cannot reintroduce the upstream branding. Saved artwork records are retained. The early boot mark is replaced as well, with its boot container and spinner lifecycle preserved.

The existing poster mosaic, entry/exit transition, spinner, reduced-motion handling and settings storage identifiers remain in place. Upstream attribution and license notices are retained. This installer also includes the Instant Play routing fix for the desktop Web Sources / Addon Providers tabs.

## Verification

- All 14 compatibility tests passed, including new tests for animated/static intro replacement, idempotency, unknown-layout rejection, early boot replacement and retained state/storage keys.
- Source-deck and Instant Play routing regression tests passed.
- Full TypeScript checking passed locally.
- The actual reconstructed intro no longer references `harbor-lottie.json`, `BpIntroStaticMark` or `CustomArtwork` and uses the Mutiny asset.
- The initial branding-only Windows build passed: https://github.com/HornyforCheese/Myrepo/actions/runs/43444498385. Publication is being combined with the automatic web-source and scoped iframe fixes.

No Windows GUI or emulated app was run. The user will verify the appearance after installation. Big Picture's source picker remains separate from the desktop two-tab source deck; this patch changes startup branding.
