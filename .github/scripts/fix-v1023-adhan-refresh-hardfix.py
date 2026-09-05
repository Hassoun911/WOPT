from pathlib import Path
import subprocess

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]

# Keep proven non-prayer app fixes: startup audio cleanup, QR/camera safety,
# refresh UI/button wiring, and navigation/background-state behavior.
base = HERE / "fix-v1023-adhan-refresh-hardfix-base.py"
exec(compile(base.read_text(encoding="utf-8"), str(base), "exec"), {"__file__": str(base), "__name__": "__main__"})

# Keep only the interactive Prayer Calculation settings UI/route. No legacy prayer
# fetching, location, timeout, notification-city, or prayer-data patch scripts run here.
v1026 = HERE / "fix-v1026-prayer-calculation-ui.py"
exec(compile(v1026.read_text(encoding="utf-8"), str(v1026), "exec"), {"__file__": str(v1026), "__name__": "__main__"})

v1028 = HERE / "fix-v1028-final-calculation-route.py"
exec(compile(v1028.read_text(encoding="utf-8"), str(v1028), "exec"), {"__file__": str(v1028), "__name__": "__main__"})

# FINAL canonical rewrite. The workflow reconstructs the old app foundation in the
# working tree, while HEAD points at the new source. Replace the entire prayer stack
# wholesale from HEAD after reconstruction so no legacy prayer patch can override it.
canonical_files = [
    "mobile/src/prayerData.ts",
    "mobile/src/prayerCalculationSettings.ts",
    "mobile/src/notifications.ts",
    "mobile/src/push.ts",
    "mobile/src/config.ts",
    "mobile/modules/prayer-audio/android/src/main/java/ca/wopt/prayeraudio/PrayerAlarmScheduler.kt",
    "mobile/modules/prayer-audio/android/src/main/java/ca/wopt/prayeraudio/PrayerAlarmReceiver.kt",
]
for rel in canonical_files:
    content = subprocess.check_output(["git", "show", f"HEAD:{rel}"], text=True)
    target = ROOT / rel
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content, encoding="utf-8")
    print(f"Installed canonical source: {rel}")

# Keep test metadata compatible with the established release workflow.
app_config = ROOT / "mobile/app.config.ts"
cfg = app_config.read_text(encoding="utf-8")
cfg = cfg.replace('version: process.env.EXPO_APP_VERSION || "1.0.24"', 'version: process.env.EXPO_APP_VERSION || "1.0.23"')
cfg = cfg.replace('versionCode: 68', 'versionCode: 67')
app_config.write_text(cfg, encoding="utf-8")

# Fail immediately if any rewritten invariant disappears.
prayer = (ROOT / "mobile/src/prayerData.ts").read_text(encoding="utf-8")
settings = (ROOT / "mobile/src/prayerCalculationSettings.ts").read_text(encoding="utf-8")
notifications = (ROOT / "mobile/src/notifications.ts").read_text(encoding="utf-8")
push = (ROOT / "mobile/src/push.ts").read_text(encoding="utf-8")
config = (ROOT / "mobile/src/config.ts").read_text(encoding="utf-8")
scheduler = (ROOT / "mobile/modules/prayer-audio/android/src/main/java/ca/wopt/prayeraudio/PrayerAlarmScheduler.kt").read_text(encoding="utf-8")
receiver = (ROOT / "mobile/modules/prayer-audio/android/src/main/java/ca/wopt/prayeraudio/PrayerAlarmReceiver.kt").read_text(encoding="utf-8")

for needle in [
    'hassoun:prayer-context:v3',
    'loadPrayerCalculationPreferences',
    'smartMethodForLocation',
    'tuneString',
    'Location.Accuracy.High',
    'forceLocation?: boolean',
    'api.aladhan.com/v1/calendar',
    'windsor_islamic_association',
    'loadSavedPrayerContext',
]:
    if needle not in prayer:
        raise SystemExit(f"Canonical prayer engine missing: {needle}")
for needle in ['Muslim World League', 'Umm al-Qura, Makkah', 'highLatitude', 'offsets']:
    if needle not in settings:
        raise SystemExit(f"Canonical calculation settings missing: {needle}")
for needle in ['loadSavedPrayerContext', 'registerDeviceForServerPush', 'locationLabel', 'scheduleAndroidPrayerAudio', 'normalizeContext']:
    if needle not in notifications:
        raise SystemExit(f"Canonical notification scheduler missing: {needle}")
for needle in ['scheduleTimeZone: prayerContext?.location.timezone', 'locationLabel: prayerContext?.location.label', 'calculationMethod: prayerContext?.calculationMethod']:
    if needle not in push:
        raise SystemExit(f"Canonical push/email sync missing: {needle}")
if 'locationSchedule' not in config:
    raise SystemExit('Canonical storage key missing: locationSchedule')
for needle in ['TEST_EVENTS_KEY', 'consumeAuthorizedEvent', 'wopt_prayer_audio_v2']:
    if needle not in scheduler:
        raise SystemExit(f"Canonical native alarm registry missing: {needle}")
for needle in ['consumeAuthorizedEvent', 'MAX_TRIGGER_DRIFT_MS']:
    if needle not in receiver:
        raise SystemExit(f"Canonical native alarm receiver missing: {needle}")

print("Installed canonical prayer rewrite: Home, Adhan, phone notifications, widgets, and push/email registration share one PrayerContext")
