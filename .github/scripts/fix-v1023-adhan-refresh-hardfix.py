from pathlib import Path
import re
import subprocess

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]

def run(name: str):
    p = HERE / name
    exec(compile(p.read_text(encoding="utf-8"), str(p), "exec"), {"__file__": str(p), "__name__": "__main__"})

run("fix-v1023-adhan-refresh-hardfix-base.py")
run("fix-v1026-prayer-calculation-ui.py")
run("fix-v1028-final-calculation-route.py")

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
    "mobile/src/prayerAudio.ts",
    "mobile/modules/prayer-audio/android/src/main/AndroidManifest.xml",
    "mobile/modules/prayer-audio/android/src/main/java/ca/wopt/prayeraudio/PrayerAlarmScheduler.kt",
    "mobile/modules/prayer-audio/android/src/main/java/ca/wopt/prayeraudio/PrayerAlarmReceiver.kt",
]
for rel in canonical_files:
    content = subprocess.check_output(["git", "show", f"HEAD:{rel}"], text=True)
    target = ROOT / rel
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content, encoding="utf-8")

run("remove-legacy-home-before-rewrite.py")
run("rewrite-home-ground-zero.py")
run("ensure-home-prayer-autoload.py")
run("ensure-startup-audio-gate.py")
run("fix-v1023-runtime-permissions-camera-resume.py")
run("fix-v1026-home-highlight-resume.py")
run("fix-v1027-functional-prayer-calculation.py")
run("fix-v1028-never-reset-on-background.py")
run("fix-v1029-exact-alarm-permission.py")
run("restore-live-display-admin.py")
run("fix-v1021-unified-display-menu.py")
run("restore-native-wall-display.py")

# IMPORTANT: the unified Displays menu rebuilds the route block between Settings
# root and Widgets. Re-apply Prayer Calculation last so Displays/QR/tablet support
# cannot accidentally remove the calculation card or renderer from the final APK.
run("fix-v1028-final-calculation-route.py")

app_config = ROOT / "mobile/app.config.ts"
cfg = app_config.read_text(encoding="utf-8")
cfg = re.sub(r'version: process\.env\.EXPO_APP_VERSION \|\| "[^"]+"', 'version: process.env.EXPO_APP_VERSION || "1.0.29"', cfg, count=1)
cfg = re.sub(r'versionCode:\s*\d+', 'versionCode: 73', cfg, count=1)
app_config.write_text(cfg, encoding="utf-8")

checks = {
    "mobile/src/prayerData.ts": ["hassoun:prayer-context:v3", "api.aladhan.com/v1/calendar", "preferences.school", "tuneString(preferences.offsets)", "fajr: parseTiming", "isha: parseTiming"],
    "mobile/src/PrayerCalculationSettingsPage.tsx": ["Smart Automatic", "Official Local Mosque Schedule", "Calculated Prayer Times", "Save & apply now", "LIVE PREVIEW", "Reset defaults", "Switch to calculated times"],
    "mobile/src/HomePrayerPage.tsx": ["RefreshControl", "DA’WAH • PRAYER EMAILS", "DailyIslamicCards", "NEXT • TOMORROW", "const active = next?.prayer === prayer;"],
    "mobile/App.tsx": ["HomePrayerPage", "hassoun:last-active-tab:v2", "hassoun:resume-exact-screen:v1", "HASSOUN_EXACT_SCREEN_RESUME_V3", "HASSOUN_BACKGROUND_RESUME_NO_RESET_V4", "HASSOUN_CONTINUOUS_SCREEN_CHECKPOINT_V4", "HASSOUN_EXACT_ALARM_PERMISSION_V4", "Allow Alarms & reminders", "showExactAlarmPermissionPrompt", "exactAlarmPromptShownRef", "resumeStateReady", "activeTabRef.current = activeTab", "subscribePrayerCalculationChanges"],
    "mobile/src/PermissionsStatusPage.tsx": ["Alarms & reminders", "PermissionsAndroid.PERMISSIONS.CAMERA", "openExactAlarmSettings"],
    "mobile/src/SettingsHub.tsx": ["PrayerCalculationSettingsPage", 'setPage("calculation")', 'page === "calculation"', 'settingsCurrentPageRef', 'settingsCurrentPageRef.current !== "root"', "Tablet / Wall Display", 'setPage("masjidDisplay")', '<MasjidDisplayPage locale={locale}', "ConnectDisplayPage locale={locale}"],
    "mobile/src/ConnectDisplayPage.tsx": ["PermissionsAndroid.PERMISSIONS.CAMERA", "CameraView", "LIVE TABLET EDITOR", "gradientMix", "Pair and open live editor", "tabletTheme"],
    "mobile/src/MasjidDisplayPage.tsx": ["Tablet Wall Display", "WAITING FOR APP", "CONNECTED · LIVE", "tabletTheme", "pageGradientA", "clockOutline", "showSeconds", "showClockPeriod", "showPrayerPeriod", "/masjid-displays/register"],
    "mobile/app.config.ts": ["1.0.29", "versionCode: 73", "android.permission.SCHEDULE_EXACT_ALARM", "android.permission.CAMERA"],
}
for rel, needles in checks.items():
    text = (ROOT / rel).read_text(encoding="utf-8")
    for needle in needles:
        if needle not in text:
            raise SystemExit(f"Missing {needle!r} in {rel}")

app = (ROOT / "mobile/App.tsx").read_text(encoding="utf-8")
audio = (ROOT / "mobile/src/prayerAudio.ts").read_text(encoding="utf-8")
for forbidden in ("REFRESH LOCATION", "loadLocationPrayerContext", "HomePrayerPanel", "refreshPrayerLocation", "phoneHomeScreen"):
    if forbidden in app:
        raise SystemExit(f"Legacy Home code remains: {forbidden}")
if "startFirstLaunchExactAlarmSetup()" in audio:
    raise SystemExit("Silent exact-alarm settings auto-launch remains")
if "hassoun:exact-alarm-permission-prompt:v3" in app:
    raise SystemExit("Persisted alarm prompt suppression remains")
print("Installed canonical prayer runtime, functional Prayer Calculation, no-reset background resume, forced alarms permission prompt, next-prayer highlight and live-editable tablet display")
