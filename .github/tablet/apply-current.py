from pathlib import Path
import json
import runpy

ROOT = Path(__file__).resolve().parents[2]
MANIFEST = Path(__file__).with_name("manifest.json")

manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
patches = manifest.get("tablet_patch_order", [])
if not patches:
    raise SystemExit("tablet manifest has no patch order")

print(f"Hassoun tablet canonical runner: v{manifest['current_version']} ({manifest['android_version_code']})")
for index, rel in enumerate(patches, start=1):
    path = ROOT / rel
    if not path.exists():
        raise SystemExit(f"missing tablet patch #{index}: {rel}")
    print(f"[{index}/{len(patches)}] {rel}")
    runpy.run_path(str(path), run_name="__main__")

print("HASSOUN_TABLET_CANONICAL_STACK_OK")
