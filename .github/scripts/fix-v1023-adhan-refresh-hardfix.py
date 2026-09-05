from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]

# Keep proven non-prayer app fixes and native Adhan safety.
base = HERE / "fix-v1023-adhan-refresh-hardfix-base.py"
exec(compile(base.read_text(encoding="utf-8"), str(base), "exec"), {"__file__": str(base), "__name__": "__main__"})

# Native Android alarm registry/stale-alarm protection. Any temporary prayerData edits
# from this script are replaced wholesale by the canonical prayer rewrite in the workflow.
v1025 = HERE / "fix-v1025-native-alarm-and-refresh-timeouts.py"
exec(compile(v1025.read_text(encoding="utf-8"), str(v1025), "exec"), {"__file__": str(v1025), "__name__": "__main__"})

# Interactive calculation settings UI and deterministic SettingsHub route.
v1026 = HERE / "fix-v1026-prayer-calculation-ui.py"
exec(compile(v1026.read_text(encoding="utf-8"), str(v1026), "exec"), {"__file__": str(v1026), "__name__": "__main__"})

v1028 = HERE / "fix-v1028-final-calculation-route.py"
exec(compile(v1028.read_text(encoding="utf-8"), str(v1028), "exec"), {"__file__": str(v1028), "__name__": "__main__"})

# Keep test metadata compatible with the established release workflow.
config = ROOT / "mobile/app.config.ts"
cfg = config.read_text(encoding="utf-8")
cfg = cfg.replace('version: process.env.EXPO_APP_VERSION || "1.0.24"', 'version: process.env.EXPO_APP_VERSION || "1.0.23"')
cfg = cfg.replace('versionCode: 68', 'versionCode: 67')
config.write_text(cfg, encoding="utf-8")

print("Applied non-prayer v1.0.23 safety/UI stack; canonical prayer engine will be installed next")
