# Blynx Music for Linux

This x86-64 release uses the native Compose Desktop player with the Blynx Music branding. The app bundles its Java runtime.

| Download | Install |
| --- | --- |
| `.deb` | On Debian, Ubuntu, KDE neon or Linux Mint, open the package with your software installer or use `sudo apt install ./Blynx-Music-*-linux-amd64.deb`. |
| `.rpm` | On Fedora, install with `sudo dnf install ./Blynx-Music-*-linux-x86_64.rpm`. |
| Portable `.tar.gz` | Extract the archive, then run `BlynxMusic/bin/BlynxMusic` from the extracted folder. Requires the system's desktop and audio libraries. |

Open **BlynxMusic** from the application menu after installation. The desktop app stores settings and library data in `~/.blynx-music`.

The desktop player shares the Android app's Kotlin music models, discovery, settings, and lyrics. Platform features such as Android Auto and Android's notification controls are handled by the Android app.

Based on OpenTune, licensed under GPL-3.0. The release includes a source archive and SHA-256 checksums for all Linux files.
