# Blynx Music for Linux

The Linux launcher opens the Blynx web player in its own window using an installed Chrome, Chromium, Brave or Edge profile. It uses the same library, appearance settings and account connections as the web player in that profile.

| Download | Install |
| --- | --- |
| Debian package (.deb) | On KDE neon, Ubuntu, Debian or Linux Mint, open it with your package installer or run `sudo apt install ./Blynx-Music-*-linux-all.deb`. |
| RPM package (.rpm) | On Fedora, run `sudo dnf install ./Blynx-Music-*-linux-noarch.rpm`. |
| Portable archive (.tar.gz) | Extract it and run `./Blynx-Music/blynx-music`. |

Open **Blynx Music** from your application menu. The first-run prompt guides you through signing in on Google and returning to the player. Install the [Blynx Music browser extension](https://music.blynx.vip/player/#/extension) in the same browser profile when prompted. To use your YouTube Music library, sign into [YouTube Music](https://music.youtube.com/) in that same profile. In the extension popup, choose **Connect** if the account shows as disconnected.

The launcher's **Set up playback and sign-in** menu action opens both pages in normal browser tabs. From a terminal, use `blynx-music --setup`. If several browsers or profiles are installed, use `blynx-music --browser brave --profile "Profile 1"` with your actual browser and profile directory. You can find the directory under **Profile Path** on your browser's version page. The launcher accepts `BLYNX_BROWSER` and `BLYNX_BROWSER_PROFILE` for a custom shortcut.

The earlier Compose Desktop build kept its own library in `~/.blynx-music`. This launcher uses the browser's Blynx library. The web and native libraries are stored separately.

Based on OpenTune, licensed under GPL-3.0. The release includes SHA-256 checksums and the corresponding source archive.
