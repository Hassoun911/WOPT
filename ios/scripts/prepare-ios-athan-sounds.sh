#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
IOS_DIR="$ROOT/ios"
RAW_DIR="$ROOT/mobile/modules/prayer-audio/android/src/main/res/raw"
OUT_DIR="$IOS_DIR/assets"

mkdir -p "$OUT_DIR"

make_clip() {
  local input="$1"
  local output="$2"
  ffmpeg -y -hide_banner -loglevel error -i "$input" -t 29 -ac 1 -ar 22050 -c:a pcm_s16le "$output"
  local duration
  duration="$(ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "$output")"
  python3 - "$duration" "$output" <<'PY'
import sys
from pathlib import Path
seconds = float(sys.argv[1])
path = Path(sys.argv[2])
if not (0 < seconds < 30):
    raise SystemExit(f"iOS notification sound must be under 30 seconds: {path} = {seconds:.3f}s")
if path.stat().st_size <= 44:
    raise SystemExit(f"Generated sound is empty: {path}")
print(f"verified {path.name}: {seconds:.3f}s, {path.stat().st_size} bytes")
PY
}

make_clip "$RAW_DIR/fajr_adhan.mp3" "$OUT_DIR/hassoun_fajr_athan.wav"
make_clip "$RAW_DIR/azan9.mp3" "$OUT_DIR/hassoun_athan.wav"

echo "Prepared iOS Athan notification clips from the approved Android recordings."
