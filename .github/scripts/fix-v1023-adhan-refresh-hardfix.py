from pathlib import Path
import re
import subprocess

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]

base = HERE / "fix-v1023-adhan-refresh-hardfix-base.py"
exec(compile(base.read_text(encoding="utf-8"), str(base), "exec"), {"__file__": str(base), "__name__": "__main__"})

v1026 = HERE / "fix-v1026-prayer-calculation-ui.py"
exec(compile(v1026.read_text(encoding="utf-8"), str(v1026), "exec"), {"__file__": str(v1026), "__name__": "__main__"})

v1028 = HERE / "fix-v1028-final-calculation-route.py"
exec(compile(v1028.read_text(encoding="utf-8"), str(v1028), "exec"), {"__file__": str(v1028), "__name__": "__main__"})

canonical_files = [
    "mobile/app.config.ts",
    "mobile/src/HomePrayerPage.tsx",
    "mobile/src/DailyIslamicCards.tsx",
    "mobile/src/dailyIslamicContent.ts",
    "mobile/src/PermissionsStatusPage.tsx",
    "mobile/src/prayerData.ts",
    "mobile/src/prayerCalculationSettings.ts",
    "mobile/src/notifications.ts",
    "mobile/src/push.ts",
    "mobile/src/config.ts",
    "mobile/src/emailSignup.ts",
    "mobile/modules/prayer-audio/android/src/main/AndroidManifest.xml",
    "mobile/modules/prayer-audio/android/src/main/java/ca/wopt/prayeraudio/PrayerAlarmScheduler.kt",
    "mobile/modules/prayer-audio/android/src/main/java/ca/wopt/prayeraudio/PrayerAlarmReceiver.kt",
]
for rel in canonical_files:
    content = subprocess.check_output(["git", "show", f"HEAD:{rel}"], text=True)
    target = ROOT / rel
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content, encoding="utf-8")
    print(f"Installed canonical source: {rel}")

cleanup = HERE / "remove-legacy-home-before-rewrite.py"
exec(compile(cleanup.read_text(encoding="utf-8"), str(cleanup), "exec"), {"__file__": str(cleanup), "__name__": "__main__"})
ground_zero = HERE / "rewrite-home-ground-zero.py"
exec(compile(ground_zero.read_text(encoding="utf-8"), str(ground_zero), "exec"), {"__file__": str(ground_zero), "__name__": "__main__"})
autoload = HERE / "ensure-home-prayer-autoload.py"
exec(compile(autoload.read_text(encoding="utf-8"), str(autoload), "exec"), {"__file__": str(autoload), "__name__": "__main__"})
audio_gate = HERE / "ensure-startup-audio-gate.py"
exec(compile(audio_gate.read_text(encoding="utf-8"), str(audio_gate), "exec"), {"__file__": str(audio_gate), "__name__": "__main__"})
runtime = HERE / "fix-v1023-runtime-permissions-camera-resume.py"
exec(compile(runtime.read_text(encoding="utf-8"), str(runtime), "exec"), {"__file__": str(runtime), "__name__": "__main__"})
wall = HERE / "restore-native-wall-display.py"
exec(compile(wall.read_text(encoding="utf-8"), str(wall), "exec"), {"__file__": str(wall), "__name__": "__main__"})

app_config = ROOT / "mobile/app.config.ts"
cfg = app_config.read_text(encoding="utf-8")
cfg = re.sub(r'version: process\.env\.EXPO_APP_VERSION \|\| "[^"]+"', 'version: process.env.EXPO_APP_VERSION || "1.0.24"', cfg, count=1)
cfg = re.sub(r'versionCode:\s*\d+', 'versionCode: 68', cfg, count=1)
app_config.write_text(cfg, encoding="utf-8")

prayer = (ROOT / "mobile/src/prayerData.ts").read_text(encoding="utf-8")
home = (ROOT / "mobile/src/HomePrayerPage.tsx").read_text(encoding="utf-8")
app = (ROOT / "mobile/App.tsx").read_text(encoding="utf-8")
settings = (ROOT / "mobile/src/prayerCalculationSettings.ts").read_text(encoding="utf-8")
notifications = (ROOT / "mobile/src/notifications.ts").read_text(encoding="utf-8")
push = (ROOT / "mobile/src/push.ts").read_text(encoding="utf-8")
email_signup = (ROOT / "mobile/src/emailSignup.ts").read_text(encoding="utf-8")
config = (ROOT / "mobile/src/config.ts").read_text(encoding="utf-8")
permissions_page = (ROOT / "mobile/src/PermissionsStatusPage.tsx").read_text(encoding="utf-8")
daily_cards = (ROOT / "mobile/src/DailyIslamicCards.tsx").read_text(encoding="utf-8")
wall_page = (ROOT / "mobile/src/MasjidDisplayPage.tsx").read_text(encoding="utf-8")
settings_hub = (ROOT / "mobile/src/SettingsHub.tsx").read_text(encoding="utf-8")
manifest = (ROOT / "mobile/modules/prayer-audio/android/src/main/AndroidManifest.xml").read_text(encoding="utf-8")
scheduler = (ROOT / "mobile/modules/prayer-audio/android/src/main/java/ca/wopt/prayeraudio/PrayerAlarmScheduler.kt").read_text(encoding="utf-8")
receiver = (ROOT / "mobile/modules/prayer-audio/android/src/main/java/ca/wopt/prayeraudio/PrayerAlarmReceiver.kt").read_text(encoding="utf-8")

for needle in ['hassoun:prayer-context:v3','loadPrayerCalculationPreferences','smartMethodForLocation','tuneString','Location.Accuracy.High','forceLocation?: boolean','api.aladhan.com/v1/calendar','windsor_islamic_association','loadSavedPrayerContext','latitudeAdjustmentMethod','preferences.school','tuneString(preferences.offsets)']:
    if needle not in prayer: raise SystemExit(f"Canonical prayer engine missing: {needle}")
for needle in ['RefreshControl','DA’WAH • PRAYER EMAILS','onRefresh={() => { void onRefresh(); }}','context?.location.label','PRAYER_KEYS.map','subscribeToDailyPrayerTimes','DailyIslamicCards']:
    if needle not in home: raise SystemExit(f"Ground-zero Home missing: {needle}")
for forbidden in ['PrayerAlertPreferenceGrid','scheduled prayer events','Prayer alerts for this phone']:
    if forbidden in home: raise SystemExit(f"Old oversized alert controls remain on Home: {forbidden}")
for needle in ['Qur’an verse of the day','Hadith of the day','dailyIslamicContentForDate']:
    if needle not in daily_cards: raise SystemExit(f"Daily Islamic cards missing: {needle}")
for needle in ['HomePrayerPage','loadPrayerTimes({ forceLocation: true })','context={prayerContext}','setPrayerContext(loaded);','if (!startupAudioCleared) return;','HOME_PRAYER_AUTOLOAD_V1','Allow Alarms & reminders','hassoun:last-active-tab:v2','subscribePrayerCalculationChanges']:
    if needle not in app: raise SystemExit(f"Ground-zero App integration missing: {needle}")
for needle in ['subscribeToDailyPrayerTimes','dailyPrayerSchedule: true','prayerAlerts: false']:
    if needle not in email_signup: raise SystemExit(f"Daily prayer email signup missing: {needle}")
for forbidden in ['loadLocationPrayerContext','HomePrayerPanel','refreshPrayerLocation','REFRESH LOCATION','phoneHomeScreen']:
    if forbidden in app: raise SystemExit(f"Legacy phone Home code still present: {forbidden}")
for needle in ['Muslim World League','Umm al-Qura, Makkah','highLatitude','offsets','subscribePrayerCalculationChanges']:
    if needle not in settings: raise SystemExit(f"Canonical calculation settings missing: {needle}")
for needle in ['loadSavedPrayerContext','registerDeviceForServerPush','locationLabel','scheduleAndroidPrayerAudio','normalizeContext']:
    if needle not in notifications: raise SystemExit(f"Canonical notification scheduler missing: {needle}")
for needle in ['scheduleTimeZone: prayerContext?.location.timezone','locationLabel: prayerContext?.location.label','calculationMethod: prayerContext?.calculationMethod']:
    if needle not in push: raise SystemExit(f"Canonical push/email sync missing: {needle}")
for needle in ['Alarms & reminders','NOT ENABLED','PermissionsAndroid.PERMISSIONS.CAMERA','openExactAlarmSettings']:
    if needle not in permissions_page: raise SystemExit(f"Live Permissions page missing: {needle}")
for needle in ['Tap clock for setup','NEXT PRAYER','highlightNextPrayerCard','highlightNextPrayerMiniCard','6-DIGIT PAIRING CODE','Website Mode','/masjid-displays/register','setSlide((n) => (n + 1) % PRAYERS.length)']:
    if needle not in wall_page: raise SystemExit(f"Native wall display missing: {needle}")
for needle in ['Tablet / Wall Display','setPage("masjidDisplay")','<MasjidDisplayPage locale={locale}']:
    if needle not in settings_hub: raise SystemExit(f"Native wall display route missing: {needle}")
if 'android.permission.SCHEDULE_EXACT_ALARM' not in manifest or 'android.permission.USE_EXACT_ALARM' in manifest or 'maxSdkVersion="32"' in manifest:
    raise SystemExit('Exact alarm Android special-access manifest is incorrect')
if 'locationSchedule' not in config: raise SystemExit('Canonical storage key missing: locationSchedule')
for needle in ['TEST_EVENTS_KEY','consumeAuthorizedEvent','wopt_prayer_audio_v2']:
    if needle not in scheduler: raise SystemExit(f"Canonical native alarm registry missing: {needle}")
for needle in ['consumeAuthorizedEvent','MAX_TRIGGER_DRIFT_MS']:
    if needle not in receiver: raise SystemExit(f"Canonical native alarm receiver missing: {needle}")

print("Installed ground-zero Home + permissions + safe camera + resume persistence + global calculation + daily Quran/Hadith + native tablet wall display")
