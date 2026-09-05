from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[2]
APP = ROOT / "mobile/App.tsx"
CONFIG = ROOT / "mobile/app.config.ts"

app = APP.read_text(encoding="utf-8")

old = '''  useEffect(() => {\n    const subscription = AppState.addEventListener("change", (state) => {\n      if (state !== "active") return;\n      setNow(new Date());\n      void loadQuizStats().then(setQuizStats).catch(() => undefined);\n      void refreshPrayerLocation(true).then((context) => {\n        if (!alertsEnabled) return;\n        return schedulePrayerNotifications(context.prayerTimes, locale, phoneAlertPreferences, context.locationLabel, context.timezone)\n          .then((result) => setScheduledCount(result.count));\n      }).catch(() => undefined);\n      void scheduleIslamicEventReminders(dateKeyInZone(new Date(), prayerTimeZone), locale).catch(() => undefined);\n    });\n    return () => subscription.remove();\n  }, [alertsEnabled, locale, phoneAlertPreferences, prayerTimeZone, refreshPrayerLocation]);'''

new = '''  useEffect(() => {\n    const subscription = AppState.addEventListener("change", (state) => {\n      if (state !== "active") return;\n      // Resume in-place. Do not force GPS/network refresh here because it makes\n      // Android appear to reload the app and can interrupt the user's current screen.\n      setNow(new Date());\n      void loadQuizStats().then(setQuizStats).catch(() => undefined);\n    });\n    return () => subscription.remove();\n  }, []);'''

if old not in app:
    raise SystemExit("Expected v1.0.21 AppState resume block was not found")
app = app.replace(old, new, 1)
APP.write_text(app, encoding="utf-8")

cfg = CONFIG.read_text(encoding="utf-8")
cfg, n1 = re.subn(
    r'version:\s*(?:process\.env\.EXPO_APP_VERSION\s*\|\|\s*)?"[^"]+"',
    'version: process.env.EXPO_APP_VERSION || "1.0.21"',
    cfg,
    count=1,
)
cfg, n2 = re.subn(r'versionCode:\s*\d+', 'versionCode: 65', cfg, count=1)
if n1 != 1 or n2 != 1:
    raise SystemExit("Could not set v1.0.21/versionCode 65")
CONFIG.write_text(cfg, encoding="utf-8")

print("Applied v1.0.21 no-reload-on-resume fix and versionCode 65")
