# Groq and Gemini for Ask AI

Ask AI and Settings → AI search now select OpenRouter, Groq or Gemini. Each provider has an independent, masked API-key field, a link to its key console and a model picker. Saving one key does not select a different provider or replace another key. The selected provider survives restart. Existing OpenRouter settings remain valid.

Direct provider models are a curated free-tier text list, checked against provider documentation on 2026-11-13:

- Groq: `openai/gpt-oss-20b`, `openai/gpt-oss-120b` ([published free-plan limits](https://console.groq.com/docs/rate-limits)). Retired Llama defaults are not offered by the new picker.
- Gemini: `gemini-3.5-flash-lite`, `gemini-3.1-flash-lite` ([pricing and free-tier rows](https://ai.google.dev/gemini-api/docs/pricing)). Uses Google's [documented OpenAI-compatible endpoint](https://ai.google.dev/gemini-api/docs/openai).
- OpenRouter retains the live, price-verified free text catalogue.

Free-tier availability depends on the account, region and provider quotas. These are not unlimited or guaranteed free requests for billing-enabled accounts. The app displays this beside the choices and never automatically retries another provider or upgrades to a paid model. Curated direct models may need updates when providers retire them.

The shared transport sends each selected key directly to its provider's fixed HTTPS endpoint, rejects redirects and mismatched direct-provider model IDs, bounds requests to 60 seconds and redacts keys from provider errors. Chat cancellation stops pending requests. Keys use the existing local settings storage, not a new encrypted credential vault.

Movie/series discovery, episode finding and games AI share the selected route so a Gemini key cannot accidentally be sent to OpenRouter. AI entry-point visibility includes Gemini-only accounts. Live web context settings remain available for all providers.

Verification: 31 compatibility tests pass, including all three endpoints, independent credentials, missing keys without fallback, model ownership, quota redaction, malformed/empty responses, cancellation, legacy boolean routes and actual Gemini-response recommendation parsing. Tests use mocked HTTP responses. Clean reconstruction and idempotent integration pass. No provider credentials were available for live AI requests, so live account/model compatibility is not claimed. Full app typechecking passed against the clean reconstruction. Installer evidence will be recorded after packaging.

Upstream source notices and the pinned upstream source licence remain in the complete source archive. Selected AI source overrides are stored at their actual `src/` paths; `tools/integrate-ai-services.mjs` checks their expected overlay revisions before applying them.
