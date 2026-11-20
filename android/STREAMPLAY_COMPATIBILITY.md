# StreamPlay compatibility gate (before CS3 chunk 4)

Target: **StreamPlay**, the user's only required CloudStream extension. Do not treat generic CS3 import as success.

## Inspected reference

The public `tpadev/phiser-streamplay` repository's `StreamPlay/build.gradle.kts` describes an Android-only CloudStream plugin (`isCrossPlatform = false`), `requiresResources = true`, CloudStream pre-release host dependency, Android Material and Browser dependencies, and numerous `BuildConfig` API/token fields supplied from `local.properties`. This is a **candidate reference**, not yet verified as the exact binary/version the user has installed.

## Current Mutiny Media limitations

- `CloudStreamPackageStore` imports CS3 archives as `imported-inactive` and exposes `executionSupported=false`.
- `CloudStreamWorker` currently rejects validated requests. No executable CloudStream ABI, resource loading, plugin lifecycle, provider registration, search/detail/loadLinks bridge or network mediation exists.
- A CS3 archive alone does not establish whether its build-time configuration fields contain working values. Do not assume any public repository contains valid credentials or bundle secrets into Mutiny.
- StreamPlay may require a full CloudStream API surface, Android resources and extractor dependencies; implement against a **specific source/binary revision**, not a name alone.

## Acceptance criteria before marking StreamPlay working

1. Identify the exact StreamPlay CS3 release, version, SHA-256 and its corresponding source revision. Inspect its manifest, resources, DEX class list and host API calls without executing it.
2. Build and run a permission-isolated host with required CloudStream interfaces and resources; mediate network calls and bound outputs. Do not load plugin DEX in the main app process.
3. Verify StreamPlay registers its provider(s) and that search, metadata, episodes and link extraction work for permitted test media. Report external-source failures separately.
4. Confirm source selection, request headers, subtitles and player handoff on an Android device; validate cancellation, timeouts, isolation, provider removal and app restart.
5. Execute regression tests and an Android build. Record actual results, commit SHA and reproducible logs.

**Current status: NOT WORKING / NOT VERIFIED.** CS3 chunk 4 is blocked by this StreamPlay acceptance gate.
