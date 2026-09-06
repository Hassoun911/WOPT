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
# The current canonical display admin contains the safe camera flow plus the live WYSIWYG editor.
run("restore-live-display-admin.py")
# Final display routing must preserve the canonical display admin rather than regenerate an older page.
run("fix-v1021-unified-display-menu.py")
run("restore-native-wall-display.py")

app_config = ROOT / "mobile/app.config.ts"
cfg = app_config.read_text(encoding="utf-8")
cfg = re.sub(r'version: process\.env\.EXPO_APP_VERSION \|\| "[^"]+"', 'version: process.env.EXPO_APP_VERSION || "1.0.25"', cfg, count=1)
cfg = re.sub(r'versionCode:\s*\d+', 'versionCode: 69', cfg, count=1)
app_config.write_text(cfg, encoding="utf-8")

checks = {
    "mobile/src/prayerData.ts": ["hassoun:prayer-context:v3", "api.aladhan.com/v1/calendar", "preferences.school", "tuneString(preferences.offsets)"],
    "mobile/src/HomePrayerPage.tsx": ["RefreshControl", "DA’WAH • PRAYER EMAILS", "DailyIslamicCards"],
    "mobile/App.tsx": ["HomePrayerPage", "hassoun:last-active-tab:v2", "subscribePrayerCalculationChanges"],
    "mobile/src/PermissionsStatusPage.tsx": ["Alarms & reminders", "PermissionsAndroid.PERMISSIONS.CAMERA", "openExactAlarmSettings"],
    "mobile/src/SettingsHub.tsx": ["Tablet / Wall Display", 'setPage("masjidDisplay")', '<MasjidDisplayPage locale={locale}', "ConnectDisplayPage locale={locale}"],
    "mobile/src/ConnectDisplayPage.tsx": ["PermissionsAndroid.PERMISSIONS.CAMERA", "CameraView", "LIVE TABLET EDITOR", "gradientMix", "Pair and open live editor", "tabletTheme"],
    "mobile/src/MasjidDisplayPage.tsx": ["Tablet Wall Display", "WAITING FOR APP", "CONNECTED · LIVE", "tabletTheme", "pageGradientA", "clockOutline", "showSeconds", "showClockPeriod", "showPrayerPeriod", "/masjid-displays/register"],
    "mobile/app.config.ts": ["1.0.25", "versionCode: 69", "android.permission.SCHEDULE_EXACT_ALARM", "android.permission.CAMERA"],
}
for rel, needles in checks.items():
    text = (ROOT / rel).read_text(encoding="utf-8")
    for needle in needles:
        if needle not in text:
            raise SystemExit(f"Missing {needle!r} in {rel}")

app = (ROOT / "mobile/App.tsx").read_text(encoding="utf-8")
for forbidden in ("REFRESH LOCATION", "loadLocationPrayerContext", "HomePrayerPanel", "refreshPrayerLocation", "phoneHomeScreen"):
    if forbidden in app:
        raise SystemExit(f"Legacy Home code remains: {forbidden}")
print("Installed canonical prayer runtime plus approved live-editable tablet display")
