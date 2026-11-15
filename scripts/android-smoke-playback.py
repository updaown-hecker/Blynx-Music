#!/usr/bin/env python3
"""Exercise the released phone APK with a local fixture and no network."""
import array
import math
import re
import subprocess
import time
import wave
import xml.etree.ElementTree as ET
from pathlib import Path

APP = "vip.blynx.music"
TRACK = "Blynx QA Tone"
QA = Path("qa")


def adb(*args: str, timeout: int = 30) -> str:
    return subprocess.check_output(["adb", *args], text=True, timeout=timeout).strip()


def screenshot(name: str) -> None:
    image = subprocess.check_output(["adb", "exec-out", "screencap", "-p"], timeout=20)
    (QA / f"{name}.png").write_bytes(image)


def tap(label: str, *, attempts: int = 8, required: bool = True) -> None:
    for _ in range(attempts):
        try:
            adb("shell", "uiautomator", "dump", "--compressed", "/data/local/tmp/blynx.xml", timeout=18)
            state = adb("exec-out", "cat", "/data/local/tmp/blynx.xml")
            (QA / "ui.xml").write_text(state)
            for node in ET.fromstring(state).iter("node"):
                names = (node.get("text"), node.get("content-desc"))
                if label not in names or node.get("enabled") == "false":
                    continue
                left, top, right, bottom = map(int, re.findall(r"\d+", node.attrib["bounds"]))
                adb("shell", "input", "tap", str((left + right) // 2), str((top + bottom) // 2))
                print(f"Tapped {label}", flush=True)
                return
        except (subprocess.SubprocessError, ET.ParseError):
            pass
        time.sleep(1)
    if required:
        raise AssertionError(f"Could not find {label!r}")


def media_state(expected: int) -> None:
    for _ in range(12):
        status = adb("shell", "dumpsys", "media_session")
        (QA / "media-session.txt").write_text(status + "\n")
        sessions = re.split(r"(?m)^\s{4}\S.*\(userId=\d+\)", status)
        if any(APP in session and re.search(rf"state=PlaybackState \{{state={expected}\b", session) for session in sessions):
            print(f"Media session for {APP} reported state {expected}", flush=True)
            return
        time.sleep(1)
    raise AssertionError(f"Media session did not reach state {expected}")


def make_track() -> None:
    sample_rate = 16_000
    frames = array.array("h", (int(1600 * math.sin(2 * math.pi * 440 * i / sample_rate)) for i in range(sample_rate)))
    with wave.open(str(QA / f"{TRACK}.wav"), "wb") as track:
        track.setparams((1, 2, sample_rate, 0, "NONE", "not compressed"))
        track.writeframes(frames.tobytes() * 90)
    adb("shell", "pm", "grant", APP, "android.permission.READ_MEDIA_AUDIO")
    adb("shell", "mkdir", "-p", "/sdcard/Music")
    adb("push", str(QA / f"{TRACK}.wav"), "/sdcard/Music/")
    adb("shell", "am", "broadcast", "-a", "android.intent.action.MEDIA_SCANNER_SCAN_FILE", "-d", "file:///sdcard/Music/Blynx%20QA%20Tone.wav")
    for _ in range(12):
        index = adb("shell", "content", "query", "--uri", "content://media/external/audio/media", "--projection", "_display_name:title")
        if f"{TRACK}.wav" in index:
            return
        time.sleep(1)
    raise AssertionError("Android did not index the test track")


def main() -> None:
    adb("shell", "settings", "put", "global", "animator_duration_scale", "0")
    tap("DON’T ALLOW", attempts=3, required=False)
    tap("Skip")
    tap("Continue")
    tap("Not now")
    make_track()
    tap("Library")
    tap("On this phone")
    tap(TRACK)
    media_state(3)
    screenshot("library-playback")
    adb("shell", "input", "keyevent", "KEYCODE_HOME")
    media_state(3)
    adb("shell", "cmd", "media_session", "dispatch", "pause")
    media_state(2)
    print("Verified offline playback, background playback and MediaSession pause", flush=True)


if __name__ == "__main__":
    main()
