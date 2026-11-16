Name: blynx-music-web
Version: %{blynx_version}
Release: 1%{?dist}
Summary: Blynx Music desktop player
License: GPL-3.0-or-later
URL: https://music.blynx.vip/
BuildArch: noarch

%description
Open Blynx Music in an app window using your regular Chrome, Chromium,
Brave or Edge browser profile.

%install
mkdir -p %{buildroot}
cp -a %{blynx_stage}/usr %{buildroot}/

%files
/usr/bin/blynx-music
/usr/share/applications/vip.blynx.music.desktop
/usr/share/icons/hicolor/scalable/apps/vip.blynx.music.svg
%license /usr/share/doc/blynx-music-web/LICENSE
%doc /usr/share/doc/blynx-music-web/README.md
%doc /usr/share/doc/blynx-music-web/THIRD_PARTY_NOTICES.md
