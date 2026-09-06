from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[2]
rel = "mobile/src/ConnectDisplayPage.tsx"
content = subprocess.check_output(["git", "show", f"HEAD:{rel}"], text=True)
content = content.replace('sel:{outlineWidth:3 as any,outlineColor:"#ffdc79" as any}', 'sel:{borderWidth:3,borderColor:"#ffdc79"}')
target = ROOT / rel
target.parent.mkdir(parents=True, exist_ok=True)
target.write_text(content, encoding="utf-8")
required = [
    'PermissionsAndroid.PERMISSIONS.CAMERA',
    'CameraView',
    'LIVE TABLET EDITOR',
    'gradientMix',
    'Pair and open live editor',
    'tabletTheme',
    'showSeconds',
    'showClockPeriod',
    'showPrayerPeriod',
]
for needle in required:
    if needle not in content:
        raise SystemExit(f"Live display admin missing: {needle}")
print("Restored safe QR pairing and WYSIWYG live tablet display editor")
