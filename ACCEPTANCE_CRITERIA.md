# Mutiny Media Windows V200000 — Prompt 1 Acceptance Criteria

## Ask AI Landing and Titles Only

- [ ] Ask AI opens a landing page with two visually and semantically distinct choices: **Titles Only** and **Chat**.
- [ ] Titles Only presents a minimal natural-language search field without conversational filler.
- [ ] Results may include movies, television, anime and documentaries.
- [ ] Each result shows available artwork and metadata without fabricating missing values.
- [ ] Selecting a result opens its existing Mutiny Media title-information route.
- [ ] Existing AI providers, free-model catalogues and API-key settings remain available.

## Chat

- [ ] Chat opens the complete conversational interface.
- [ ] The supplied authoritative pirate avatar is visible without visual reinterpretation.
- [ ] User and assistant messages are clearly distinguishable and accessible.
- [ ] Assistant responses can be copied.
- [ ] The last failed or completed request can be retried without duplicating unrelated history.
- [ ] An active request can be stopped where the selected provider supports cancellation.
- [ ] Closing Chat cancels active work and leaves no stuck busy state.

## Avatar Preservation

- [ ] The supplied original file remains the default idle frame and is retained as an immutable master asset.
- [ ] Human appearance, facial features, colours, clothing, proportions, orientation, lighting and pixel-art rendering are preserved.
- [ ] Pirate Bay hat logo and LimeTorrents headphone logo are preserved.
- [ ] The glove remains logo-free.
- [ ] Animation frames modify only pixels required for blinking, thinking gestures or mouth positions.

## Animation Lifecycle

- [ ] Idle uses the original resting frame and occasional low-frequency blinking.
- [ ] Thinking activates during Titles Only lookup and while Chat awaits a response.
- [ ] Talking activates only while response text is actually arriving/being presented as generated output.
- [ ] Completion, failure, cancellation and dialog closure always return the avatar to idle.
- [ ] Animation pauses when hidden and does not require text-to-speech.

## Performance and Settings

- [ ] Users can disable avatar animation in the existing settings system.
- [ ] Scaling uses crisp nearest-neighbour/pixelated rendering.
- [ ] Hidden or idle animation performs no continuous high-frequency rendering.
- [ ] AI animation work does not affect playback state or media hot paths.

## Validation and Recovery

- [ ] Relevant focused tests pass.
- [ ] `pnpm run check` passes for changed source in the complete Windows checkout.
- [ ] `pnpm run typecheck` passes.
- [ ] Windows build validation succeeds in GitHub Actions.
- [ ] Modified files, results, remaining issues and blockers are recorded in `DEVELOPMENT_PROGRESS.md`.
- [ ] A recoverable Git checkpoint contains Prompt 1 only and excludes unrelated pre-existing changes.
- [ ] No Android files are modified.

