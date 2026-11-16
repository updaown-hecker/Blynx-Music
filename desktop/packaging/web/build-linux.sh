#!/bin/bash
set -euo pipefail

here=$(cd "$(dirname "$0")" && pwd)
root=$(cd "$here/../../.." && pwd)
version=$(cat "$here/version.txt")
[[ "$version" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]
out=$(realpath -m "${1:-$root/release}")
mkdir -p "$out"
scratch=$(mktemp -d)
trap 'rm -rf "$scratch"' EXIT
stage="$scratch/package"
docs="$stage/usr/share/doc/blynx-music-web"
install -Dm755 "$here/blynx-music" "$stage/usr/bin/blynx-music"
install -Dm644 "$here/vip.blynx.music.desktop" "$stage/usr/share/applications/vip.blynx.music.desktop"
install -Dm644 "$root/web/app/public/favicon.svg" "$stage/usr/share/icons/hicolor/scalable/apps/vip.blynx.music.svg"
install -Dm644 "$root/docs/blynx-linux.md" "$docs/README.md"
install -m644 "$root/LICENSE" "$root/THIRD_PARTY_NOTICES.md" "$docs/"

mkdir -p "$stage/DEBIAN"
cat > "$stage/DEBIAN/control" <<CONTROL
Package: blynx-music-web
Version: $version
Section: sound
Priority: optional
Architecture: all
Maintainer: Blynx Music <https://music.blynx.vip/>
Homepage: https://music.blynx.vip/
Description: Blynx Music desktop player
 Opens the Blynx Music player in an existing Chrome, Chromium, Brave or Edge
 profile. The browser and Blynx Music extension are installed separately.
CONTROL
dpkg-deb --root-owner-group --build "$stage" "$out/Blynx-Music-v$version-linux-all.deb"

portable="$scratch/Blynx-Music"
mkdir -p "$portable"
install -m755 "$here/blynx-music" "$portable/"
cp "$docs/"* "$portable/"
tar -C "$scratch" -czf "$out/Blynx-Music-v$version-linux-portable.tar.gz" Blynx-Music

if command -v rpmbuild >/dev/null 2>&1; then
  rpmbuild -bb "$here/blynx-music.spec" \
    --define "_topdir $scratch/rpm" \
    --define "blynx_version $version" \
    --define "blynx_stage $stage"
  cp "$scratch"/rpm/RPMS/noarch/*.rpm "$out/Blynx-Music-v$version-linux-noarch.rpm"
fi

(cd "$out" && sha256sum Blynx-Music-v"$version"-linux-* > SHA256SUMS.txt && sha256sum -c SHA256SUMS.txt)
