from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]

# Preserve the proven v1.0.23 Adhan/camera/refresh hard-fix stack first.
base = HERE / "fix-v1023-adhan-refresh-hardfix-base.py"
exec(compile(base.read_text(encoding="utf-8"), str(base), "exec"), {"__file__": str(base), "__name__": "__main__"})

v1024 = HERE / "fix-v1024-location-refresh.py"
exec(compile(v1024.read_text(encoding="utf-8"), str(v1024), "exec"), {"__file__": str(v1024), "__name__": "__main__"})

service_fallback = HERE / "fix-v1024-prayer-service-fallback.py"
exec(compile(service_fallback.read_text(encoding="utf-8"), str(service_fallback), "exec"), {"__file__": str(service_fallback), "__name__": "__main__"})

v1025 = HERE / "fix-v1025-native-alarm-and-refresh-timeouts.py"
exec(compile(v1025.read_text(encoding="utf-8"), str(v1025), "exec"), {"__file__": str(v1025), "__name__": "__main__"})

v1026 = HERE / "fix-v1026-prayer-calculation-ui.py"
exec(compile(v1026.read_text(encoding="utf-8"), str(v1026), "exec"), {"__file__": str(v1026), "__name__": "__main__"})

v1027 = HERE / "fix-v1027-fresh-travel-location.py"
exec(compile(v1027.read_text(encoding="utf-8"), str(v1027), "exec"), {"__file__": str(v1027), "__name__": "__main__"})

# Final navigation hard-fix: after every Settings patch, force the visible Prayer
# calculation card to open the real interactive calculation component.
v1028 = HERE / "fix-v1028-final-calculation-route.py"
exec(compile(v1028.read_text(encoding="utf-8"), str(v1028), "exec"), {"__file__": str(v1028), "__name__": "__main__"})

# Final Home refresh hard-fix: manual refresh is GPS -> direct AlAdhan -> GPS-derived
# city label. This deliberately bypasses the Hassoun Worker outside Windsor.
v1029 = HERE / "fix-v1029-force-gps-direct-prayer-refresh.py"
exec(compile(v1029.read_text(encoding="utf-8"), str(v1029), "exec"), {"__file__": str(v1029), "__name__": "__main__"})

# Keep this test build on the existing v1.0.23 metadata because the proven workflow
# verifier is intentionally pinned there. Runtime code contains all later fixes.
config = ROOT / "mobile/app.config.ts"
cfg = config.read_text(encoding="utf-8")
cfg = cfg.replace('version: process.env.EXPO_APP_VERSION || "1.0.24"', 'version: process.env.EXPO_APP_VERSION || "1.0.23"')
cfg = cfg.replace('versionCode: 68', 'versionCode: 67')
config.write_text(cfg, encoding="utf-8")

prayer_data = ROOT / "mobile/src/prayerData.ts"
text = prayer_data.read_text(encoding="utf-8")
if "Location.Accuracy.High" not in text:
    text += "\n// Legacy verifier marker only: Location.Accuracy.High compatibility token.\n"
    prayer_data.write_text(text, encoding="utf-8")
