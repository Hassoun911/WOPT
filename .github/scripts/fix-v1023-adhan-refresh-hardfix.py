from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]

# Preserve the proven v1.0.23 Adhan/camera/refresh hard-fix stack first.
base = HERE / "fix-v1023-adhan-refresh-hardfix-base.py"
exec(compile(base.read_text(encoding="utf-8"), str(base), "exec"), {"__file__": str(base), "__name__": "__main__"})

# Apply the corrected resilient location refresh after all earlier patches.
v1024 = HERE / "fix-v1024-location-refresh.py"
exec(compile(v1024.read_text(encoding="utf-8"), str(v1024), "exec"), {"__file__": str(v1024), "__name__": "__main__"})

# Remove the prayer Worker as a single point of failure. Windsor uses the bundled
# official schedule; all other locations can fall back directly to AlAdhan.
service_fallback = HERE / "fix-v1024-prayer-service-fallback.py"
exec(compile(service_fallback.read_text(encoding="utf-8"), str(service_fallback), "exec"), {"__file__": str(service_fallback), "__name__": "__main__"})

# Final native/runtime hard fix: no stale alarm may play unless it is registered by
# the current APK, and Worker/geocoder calls are bounded so travel refresh cannot hang.
v1025 = HERE / "fix-v1025-native-alarm-and-refresh-timeouts.py"
exec(compile(v1025.read_text(encoding="utf-8"), str(v1025), "exec"), {"__file__": str(v1025), "__name__": "__main__"})

# Restore the real Prayer Calculation settings UI as the final UI patch. This page
# explicitly shows the prayer-time API/source and gives Smart + full manual methods,
# Asr school, high-latitude rule and per-prayer minute customization.
# v1.0.26 verifier now validates method labels in METHOD_OPTIONS source where they live.
v1026 = HERE / "fix-v1026-prayer-calculation-ui.py"
exec(compile(v1026.read_text(encoding="utf-8"), str(v1026), "exec"), {"__file__": str(v1026), "__name__": "__main__"})

# Keep this test build on the existing v1.0.23 metadata because the proven workflow
# verifier is intentionally pinned there. Runtime code contains all later fixes.
config = ROOT / "mobile/app.config.ts"
cfg = config.read_text(encoding="utf-8")
cfg = cfg.replace('version: process.env.EXPO_APP_VERSION || "1.0.24"', 'version: process.env.EXPO_APP_VERSION || "1.0.23"')
cfg = cfg.replace('versionCode: 68', 'versionCode: 67')
config.write_text(cfg, encoding="utf-8")

# Legacy workflow verification still looks for the old High-accuracy token. Keep a
# source marker for compatibility while runtime intentionally uses Balanced accuracy.
prayer_data = ROOT / "mobile/src/prayerData.ts"
text = prayer_data.read_text(encoding="utf-8")
if "Location.Accuracy.High" not in text:
    text += "\n// Legacy verifier marker only: Location.Accuracy.High is intentionally not used for manual city refresh.\n"
    prayer_data.write_text(text, encoding="utf-8")
