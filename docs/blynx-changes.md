# Blynx Music modifications

Modified November 14, 2026. Blynx Music derives from OpenTune commit `07acdf9299c0c70c9e8042ae8eceac025810cf24` and is distributed under GPLv3.

- Introduced the Blynx Music Android application ID, localized launcher and widget labels, record-and-play launcher mark, splash artwork and shorter opening reveal.
- Added warm white and charcoal surfaces, larger type and more generous spacing. Updated the Home header and daylist, search field, library shortcuts, floating navigation, mini player, now-playing metadata, lyrics typography and settings surfaces.
- Added Clear refraction as a new persisted style. Retained existing glass modes and made the refraction switch apply to all modes.
- Moved version checks to the Blynx Music repository. Private release downloads use the signed-in GitHub browser.
- Disabled automatic version checks and upstream usage reporting by default. Existing settings are still available.
- Adjusted the platform hash to match the installed Android 37.0 SDK. Added dedicated handset CI and test release workflows.
- Consulted [lore-glass](https://github.com/Simonstorms/lore-glass) (MIT, Simon Gneuß) for optical behavior. Blynx Music uses the original Android Backdrop dependency for rendering and includes no lore-glass code.
