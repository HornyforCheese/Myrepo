# Community theme display branding

Installed and newly downloaded themes now receive display branding when applied. Theme CSS `content` strings (including lowercase/capitalized wordmarks, CSS escapes, nested rules and display variables) use Mutiny Media. The same normalization covers custom CSS and preview styles observed in the document head. Theme HTML, template content and labels subsequently added by theme scripts are normalized by the existing display observer, now covering all casing and accessible text attributes.

The actual theme sources and saved settings are retained. Theme IDs, data attributes, classes, storage keys, URLs, fonts, colours, layouts and script APIs retain their existing names. JavaScript is not globally rewritten. Original safety scanning and cleanup still run. Upstream copyright/attribution and the real title Pearl Harbor are preserved.

Public community payloads inspected on 2026-11-13 (read only; none executed):

- FLIX NEXT – Director's Cut v1 (`d0646447-67b2-4efc-bd27-e7d9a24d522d`): HTML and script-generated display labels.
- Apple TV+ (`3e491532-cd7d-4ec3-a751-4c4532aa5234`): CSS-generated `content: "harbor+"` wordmark, previously missed by body text branding.
- Catppuccin Mocha Carbon – Cat Logo Edition (`6c205a83-ae0f-4829-922c-2518bbe391a4`).
- AFTERHOURS – Pixel Cinema v12 (`5f237208-ba04-424f-b5a4-728b78c341e1`): custom HTML labels.
- Afterglow (`fb4ea5e5-8e03-49c3-8460-df566966f37e`).
- Harbor Tahoe Cinema (`8754d9e7-9c31-4426-9fbe-ac79644bfb4d`).

Verification: 39 compatibility tests pass, including all-casing text, protected attribution/URLs, the Apple-style wordmark, CSS string escapes, nested rules, display-variable indirection, idempotence and unchanged assets/selectors/fonts. Clean source integration and repeat application pass. Full app typechecking passed on the reconstructed sources. The CSS transform was also applied read-only to the six inspected public payloads: all were idempotent, and the Apple TV+ wordmark changed as intended. Windows installer results will be recorded after packaging. Windows GUI/theme execution remains for user testing.

Limitations: text baked into third-party screenshots, raster images or unlabelled vector paths cannot be identified and renamed by a generic text/CSS transformation. Those assets may require individual theme edits. Arbitrary theme code that continuously overrides branding, draws text on a canvas or inserts text into closed shadow roots is not guaranteed to be covered. No claim is made that every community theme was installed or executed.
