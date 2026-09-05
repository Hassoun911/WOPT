from pathlib import Path
import subprocess

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]

# Keep proven non-prayer app fixes and native Adhan safety.
base = HERE / "fix-v1023-adhan-refresh-hardfix-base.py"
exec(compile(base.read_text(encoding="utf-8"), str(base), "exec"), {"__file__": str(base), "__name__": "__main__"})

# Native Android alarm registry/stale-alarm protection.
v1025 = HERE / "fix-v1025-native-alarm-and-refresh-timeouts.py"
exec(compile(v1025.read_text(encoding="utf-8"), str(v1025), "exec"), {"__file__": str(v1025), "__name__": "__main__"})

# Interactive calculation settings UI and deterministic SettingsHub route.
v1026 = HERE / "fix-v1026-prayer-calculation-ui.py"
exec(compile(v1026.read_text(encoding="utf-8"), str(v1026), "exec"), {"__file__": str(v1026), "__name__": "__main__"})

v1028 = HERE / "fix-v1028-final-calculation-route.py"
exec(compile(v1028.read_text(encoding="utf-8"), str(v1028), "exec"), {"__file__": str(v1028), "__name__": "__main__"})

# FINAL canonical prayer rewrite. The workflow reconstructs the old app foundation in the
# working tree, but HEAD still points at this commit. Replace the prayer stack wholesale
# from HEAD after all legacy reconstruction so no old prayer patch can override it.
canonical_files = [
    "mobile/src/prayerData.ts",
    "mobile/src/notifications.ts",
    "mobile/src/push.ts",
]
for rel in canonical_files:
    content = subprocess.check_output(["git", "show", f"HEAD:{rel}"], text=True)
    target = ROOT / rel
    target.write_text(content, encoding="utf-8")
    print(f"Installed canonical rewrite: {rel}")

# Keep test metadata compatible with the established release workflow.
config = ROOT / "mobile/app.config.ts"
cfg = config.read_text(encoding="utf-8")
cfg = cfg.replace('version: process.env.EXPO_APP_VERSION || "1.0.24"', 'version: process.env.EXPO_APP_VERSION || "1.0.23"')
cfg = cfg.replace('versionCode: 68', 'versionCode: 67')
config.write_text(cfg, encoding="utf-8")

# Fail the build if any of the rewritten invariants disappear.
prayer = (ROOT / "mobile/src/prayerData.ts").read_text(encoding="utf-8")
notifications = (ROOT / "mobile/src/notifications.ts").read_text(encoding="utf-8")
push = (ROOT / "mobile/src/push.ts").read_text(encoding="utf-8")
required_prayer = [
    'hassoun:prayer-context:v3',
    'loadPrayerCalculationPreferences',
    'smartMethodForLocation',
    'tuneString',
    'Location.Accuracy.High',
    'forceLocation?: boolean',
    'api.aladhan.com/v1/calendar',
    'windsor_islamic_association',
    'loadSavedPrayerContext',
]
for needle in required_prayer:
    if needle not in prayer:
        raise SystemExit(f"Canonical prayer engine missing: {needle}")
required_notifications = [
    'loadSavedPrayerContext',
    'registerDeviceForServerPush',
    'locationLabel',
    'scheduleAndroidPrayerAudio',
]
for needle in required_notifications:
    if needle not in notifications:
        raise SystemExit(f"Canonical notification scheduler missing: {needle}")
required_push = [
    'scheduleTimeZone: prayerContext?.location.timezone',
    'locationLabel: prayerContext?.location.label',
    'calculationMethod: prayerContext?.calculationMethod',
]
for needle in required_push:
    if needle not in push:
        raise SystemExit(f"Canonical push sync missing: {needle}")

print("Installed canonical prayer rewrite: Home, Adhan, phone notifications, widgets schedule, push/email registration share one PrayerContext")
