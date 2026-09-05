from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[2]
MOBILE = ROOT / "mobile"
subprocess.run(["npx", "expo", "install", "expo-camera", "--npm"], cwd=MOBILE, check=True)
print("Installed expo-camera for Wall & Masjid QR pairing")
