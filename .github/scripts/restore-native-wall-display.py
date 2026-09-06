from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[2]
rel = "mobile/src/MasjidDisplayPage.tsx"
content = subprocess.check_output(["git", "show", f"HEAD:{rel}"], text=True)
content = content.replace('loading:{position:"absolute",inset:0 as any,', 'loading:{position:"absolute",top:0,left:0,right:0,bottom:0,')
content = content.replace("StyleSheet.absoluteFillObject", "StyleSheet.absoluteFill")
target = ROOT / rel
target.parent.mkdir(parents=True, exist_ok=True)
target.write_text(content, encoding="utf-8")

# The reconstructed v1.0.20 types.ts predates the Locale export.
calc = ROOT / "mobile/src/PrayerCalculationSettingsPage.tsx"
if calc.exists():
    text = calc.read_text(encoding="utf-8")
    text = text.replace('import type { Locale } from "./types";\n', 'type Locale = "en" | "ar";\n')
    calc.write_text(text, encoding="utf-8")

required = [
    'Tablet Wall Display',
    '6-DIGIT PAIRING CODE',
    'WAITING FOR APP',
    'CONNECTED · LIVE',
    'tabletTheme',
    'pageGradientA',
    'clockOutline',
    'showSeconds',
    'showClockPeriod',
    'showPrayerPeriod',
    '/masjid-displays/register',
    '/masjid-displays/device/',
    'setSlide(n=>(n+1)%PRAYERS.length)',
]
for needle in required:
    if needle not in content:
        raise SystemExit(f"Native tablet display missing: {needle}")
if "StyleSheet.absoluteFillObject" in content:
    raise SystemExit("Unsupported StyleSheet.absoluteFillObject remains")
if calc.exists() and 'import type { Locale } from "./types";' in calc.read_text(encoding="utf-8"):
    raise SystemExit("Prayer calculation page still depends on missing reconstructed Locale export")
print("Restored approved portrait tablet prayer board with pairing and live theme sync")
