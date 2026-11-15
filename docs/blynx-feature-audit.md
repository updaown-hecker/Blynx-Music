# Android feature audit

Baseline OpenTune commit `07acdf9299c0c70c9e8042ae8eceac025810cf24`. These are source-level mappings. Device checks require an installed build.

| Area | Upstream implementation carried into Blynx Music | Device check |
| --- | --- | --- |
| Home and discovery | Home, Explore, quick picks, speed dial, rankings, local mixes, daylists and personalized shelves | Open Home, play a recommendation, scroll to load another shelf |
| Search | YouTube Music, local library and add-ons. Recent searches, suggestions and per-type filters | Search for a song, album and artist, then try the local source |
| Playback | InnerTubeX, the original Innertube resolver and NewPipe. Media3, queue resume, quality switching, seek, shuffle, repeat and autoplay | Stream a track, seek, reorder queue and pause/resume |
| System playback | Media session, Android Auto, foreground service, notifications, lock-screen transport, audio focus, widgets and headset controls | After playback starts, lock the phone and try Bluetooth and notification controls |
| Local library | On-device files, likes, downloads, browsing, playlists, pins, smart playlists and imported playlists | Import a playlist, like a song, add it to a playlist and restart |
| Offline copies | Cache, manual and smart downloads, Wi-Fi limits, per-quality selection, export, and offline lyrics | Download a track, go offline and play it |
| Lyrics | Existing provider order, word and line sync, offset, alignment, lyric selection and share cards | Play a track with synced lyrics, seek and confirm the highlighted line follows |
| Audio | EQ, AutoEq, normalizing, skip silence, crossfade, Automix, sleep timer, remix, USB and exclusive output, bitrate and DSP details | Change an EQ setting and verify the setting persists |
| Accounts | YouTube Music account pairing and synchronization. Spotify connect, import and matching through YouTube Music | Sign in on the provider's page and confirm sync |
| Companion features | Listen together rooms, TV pairing, Cast and DLNA, Android Auto browsing, podcasts, audiobooks, internet radio and song recognition | Exercise on compatible hardware or with a second device |
| Scrobbling and add-ons | ListenBrainz, Last.fm, Discord, Subsonic, external audio add-ons, SponsorBlock and configurable resolver/source settings | Configure a test account or service and verify the request reaches it |
| Customization | Light/dark/system, wallpaper and artwork color, launch icons, custom fonts, gesture, performance and layout settings | Change theme and glass style, rotate, restart and recheck |
| Library statistics | History, Replay, Wrapped, streaks, sharing and JSON import/export | Play a track through, open History and export a backup |
| Release updates | Build/version checks and checksum-aware updater. Private releases require a browser signed in to the repository | Open Check for updates from About and confirm access |

The new application ID gives the handset build its own storage. Upstream JSON export/import remains available. Pairing URI schemes and the existing integrations remain compatible at the code level. Build-owner credentials are required for Last.fm and Discord, as described in [service-integrations.md](service-integrations.md). Third-party availability needs a device or service integration test.
