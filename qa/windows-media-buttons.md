# Desktop local video and magnet actions

The normal desktop quick-action row now includes **Local video** and **Stream magnet link** next to Web Sources, Settings and Ask AI. The row wraps on narrow windows.

Local video opens the existing native single-file dialog, filters video formats, and hands the unchanged filesystem path to the existing local-file event and native player. Cancellation does not launch playback. Dialog errors appear beside the actions. Existing dialog permissions are reused.

Stream magnet link opens an accessible modal accepting a magnet URI or torrent infohash. Validation uses the app's actual magnet parser. Load magnet opens the existing MagnetCard, whose Play action uses the existing torrent engine (or configured streaming server), video-file selection and player handoff. Closing clears the draft and unmounts the card; the existing card owns abandoned-torrent cleanup. This does not launch an external torrent client.

Verification: 24 compatibility tests pass, including exact Windows paths, video filters, picker cancellation/malformed responses and picker errors. Source-deck and three static branding passes pass. Reconstruction was applied twice successfully, retaining the corrected live-web import and a single toolbar integration. Full app TypeScript checking passed. Windows packaging will be recorded after the combined installer build. No Windows app emulation or live file/torrent playback was performed; user testing remains required.
