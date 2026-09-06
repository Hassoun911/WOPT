from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[2]
rel = "mobile/src/MasjidDisplayPage.tsx"
content = subprocess.check_output(["git", "show", f"HEAD:{rel}"], text=True)
target = ROOT / rel
target.parent.mkdir(parents=True, exist_ok=True)
target.write_text(content, encoding="utf-8")

required = [
    'Tap clock for setup',
    'NEXT PRAYER',
    'highlightNextPrayerCard',
    'highlightNextPrayerMiniCard',
    '6-DIGIT PAIRING CODE',
    'Website Mode',
    '/masjid-displays/register',
    '/masjid-displays/device/',
    'setSlide((n) => (n + 1) % PRAYERS.length)',
]
for needle in required:
    if needle not in content:
        raise SystemExit(f"Native wall display missing: {needle}")

print("Restored native tablet/wall display with slider, pairing, clock setup, and website mode")
