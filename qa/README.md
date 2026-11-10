# Mutiny Media 1.0.1 Windows: web-source release test plan

**Status: PREPARED, NOT EXECUTED.** No playable Windows build is available in this container for end-to-end testing. This file must never be used as proof that providers work.

## Scope

- 57 separate web-source dropdown entries from the user's supplied source list.
- 10 verified titles: 6 films (including one anime film), 2 live-action series episodes and 2 anime episodes.
- 57 × 10 = **570 distinct provider/media checks**. Preserve same media selection while switching source.
- Test on **Windows Mutiny Media v1.0.1**, using the actual release candidate executable (not the standalone HTML design demo and not Android).
- The archived current source deck exposes only **six documentation-based URL builders**, with **51 providers needing configuration**. No actual playback is presently verified.

## Required verification per case

1. Select title in Mutiny. Assert selected IMDb/TMDB identity and movie-vs-series type.
2. For a series/anime choose the specified season/episode, then open **Web Sources**.
3. Select the provider by name. Observe whether it loads an actual player, not a landing page, ad, 404, or wrong title.
4. Press Mutiny's central **Play** button. Confirm playback starts and remains playing for **30 seconds**.
5. Compare on-screen media with the reference *title, year, and for episodes season/episode*, independently of a success HTTP status. Log mismatches and document evidence.
6. Verify new-window requests are blocked, no unwanted popup/redirect interrupts playback and source switching destroys the previous embed.
7. If an iframe or host is blocked, log `BLOCKED`; if title is missing log `UNAVAILABLE`; if the player is wrong use `WRONG_TITLE`; do not count either as a pass.
8. `PASS` requires the correct title/episode to visibly play, not just a generated URL or a loaded iframe.

## Status taxonomy

`NOT_RUN`, `PASS`, `WRONG_TITLE`, `WRONG_EPISODE`, `NO_PLAYBACK`, `UNAVAILABLE`, `BLOCKED`, `BAD_EMBED`, `POPUP_OR_AD`, `ERROR`.

## Release gate

No web source may be labelled **verified** on the user-facing menu until its end-to-end checks pass. Failed or unconfigured sources must display a truthful state, and working addon providers must remain available as the fallback. Since the user wants every listed source verified, any unverified source is an **unmet acceptance requirement** and must not be reported as a functional integration.

### Title catalogue IDs

| Title | Type | IMDb ID | Test episode |
| --- | --- | --- | --- |
| The Matrix (1999) | Movie | tt0133093 | Full film |
| Everything Everywhere All at Once (2022) | Movie | tt6710474 | Full film |
| The Substance (2024) | Movie | tt17526714 | Full film |
| Dune: Part Two (2024) | Movie | tt15239678 | Full film |
| Spirited Away (2001) | Anime film | tt0245429 | Full film |
| Parasite (2019) | Movie | tt6751668 | Full film |
| Breaking Bad (2008) | Series episode | tt0903747 | S01E01 |
| Dark (2017) | Series episode | tt5753856 | S01E02 |
| Death Note (2006) | Anime episode | tt0877057 | S01E01 |
| Attack on Titan (2013) | Anime episode | tt2560140 | S01E02 |

All title IMDb IDs correspond to IMDb title pages. Episode titles should be cross-checked from episode metadata at test time.
