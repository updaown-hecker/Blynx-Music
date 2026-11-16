#!/bin/bash
set -euo pipefail

launcher=$(realpath "$1")
work=$(mktemp -d)
original_path=$PATH
trap 'PATH=$original_path rm -rf "$work"' EXIT
cat > "$work/google-chrome-stable" <<'BROWSER'
#!/bin/sh
printf '%s\n' "$@"
BROWSER
cat > "$work/xdg-settings" <<'XDG'
#!/bin/sh
printf '%s\n' google-chrome.desktop
XDG
chmod +x "$work/"*
export PATH="$work"
unset BLYNX_BROWSER BLYNX_BROWSER_PROFILE

[[ "$("$launcher")" == '--app=https://music.blynx.vip/player/?desktop=1#/home' ]]
[[ "$("$launcher" --browser chrome --profile 'Profile 1')" == $'--profile-directory=Profile 1\n--app=https://music.blynx.vip/player/?desktop=1#/home' ]]
[[ "$("$launcher" --setup)" == $'--new-window\nhttps://music.blynx.vip/player/#/extension\nhttps://music.youtube.com/' ]]
if "$launcher" --browser brave >/dev/null 2>&1; then
  printf '%s\n' 'Missing explicit browser must report an error' >&2
  exit 1
fi
printf '%s\n' 'App window, browser profile, sign-in setup and missing browser checks passed.'
