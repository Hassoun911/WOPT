from pathlib import Path
import json

ROOT = Path(__file__).resolve().parents[2]
PKG = ROOT / "mobile/package.json"

pkg = json.loads(PKG.read_text(encoding="utf-8"))
deps = pkg.setdefault("dependencies", {})

# expo-camera is installed during the workflow dependency step, before the
# TypeScript platform binary is restored. Do not run npm/expo install here:
# doing so prunes the no-save @typescript/typescript-linux-x64 package and
# causes tsc to fail with "Unable to resolve @typescript/typescript-linux-x64".
if "expo-camera" not in deps:
    raise SystemExit("expo-camera must be installed in the workflow dependency step")

print("expo-camera already installed; preserving TypeScript platform binary")
