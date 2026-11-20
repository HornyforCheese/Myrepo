# Mutiny Media Android debug APK test plan

Requested 2026-11-21 for hands-on Android debugging.

The push to this development branch is intended to trigger `.github/workflows/android-ai-accounts.yml`, which runs `npm ci`, `npm test`, and `gradle --no-daemon :app:assembleDebug` before uploading the APK artifact.

Manual checks after installation:
- Homepage navigation and five-button layout
- AI Search settings, model selection, and search behaviour
- Stremio and Nuvio login, add-on lists, stream selection and playback
- Account and profile switching without provider leakage
- TorBox streaming data usage, buffering and stopping playback
- Settings, crash recovery and low-bandwidth operation

This test plan is not evidence that the APK compiled or passed any tests. Report failures with logs and reproduction steps.
