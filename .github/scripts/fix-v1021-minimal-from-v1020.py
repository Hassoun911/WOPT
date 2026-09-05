from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[2]
APP = ROOT / "mobile/App.tsx"
CONFIG = ROOT / "mobile/app.config.ts"

s = APP.read_text(encoding="utf-8")

def rep(old: str, new: str, count: int = 1):
    global s
    if old not in s:
        raise SystemExit(f"Expected v1.0.20 text not found: {old[:140]!r}")
    s = s.replace(old, new, count)

# Reuse the location-aware prayerData/time/notification infrastructure already present in v1.0.20.
rep('import { loadPrayerTimes } from "./src/prayerData";', 'import { loadPrayerTimes, type PrayerLocation } from "./src/prayerData";')
rep('function nextPrayerFor(prayerTimes: PrayerTimes, now = new Date()) {\n  const currentKey = windsorDateKey(now);', 'function nextPrayerFor(prayerTimes: PrayerTimes, now = new Date(), timeZone = WINDSOR_TIME_ZONE) {\n  const currentKey = windsorDateKey(now, timeZone);')
rep('const target = windsorLocalToDate(dateKey, day[prayer]);', 'const target = windsorLocalToDate(dateKey, day[prayer], timeZone);')
rep('function hijriDateLabel(date: Date, locale: "en" | "ar") {', 'function hijriDateLabel(date: Date, locale: "en" | "ar", timeZone = WINDSOR_TIME_ZONE) {')
rep('day: "numeric", month: "long", year: "numeric", timeZone: WINDSOR_TIME_ZONE', 'day: "numeric", month: "long", year: "numeric", timeZone')
rep('  const [alertPreferencesBusy, setAlertPreferencesBusy] = useState(false);', '  const [alertPreferencesBusy, setAlertPreferencesBusy] = useState(false);\n  const [prayerLocation, setPrayerLocation] = useState<PrayerLocation>({\n    latitude: 42.3149,\n    longitude: -83.0364,\n    timezone: WINDSOR_TIME_ZONE,\n    label: CITY_LABEL,\n    source: "saved"\n  });')
rep('  const todayKey = windsorDateKey(now);', '  const todayKey = windsorDateKey(now, prayerLocation.timezone);')
rep('  const next = useMemo(() => nextPrayerFor(prayerTimes, now), [now, prayerTimes]);', '  const next = useMemo(() => nextPrayerFor(prayerTimes, now, prayerLocation.timezone), [now, prayerTimes, prayerLocation.timezone]);')
rep('      setPrayerTimes(loaded.prayerTimes);\n      setLive(loaded.live);', '      setPrayerTimes(loaded.prayerTimes);\n      setLive(loaded.live);\n      setPrayerLocation(loaded.location);')
rep('        const result = await schedulePrayerNotifications(loaded.prayerTimes, chosenLocale, savedPhoneAlertPreferences);', '        const result = await schedulePrayerNotifications(loaded.prayerTimes, chosenLocale, savedPhoneAlertPreferences, { locationLabel: loaded.location.label, timeZone: loaded.location.timezone });')
rep('        await scheduleIslamicEventReminders(windsorDateKey(new Date()), chosenLocale).catch(() => undefined);', '        await scheduleIslamicEventReminders(windsorDateKey(new Date(), loaded.location.timezone), chosenLocale, loaded.location.timezone).catch(() => undefined);')

old_resume = '''  useEffect(() => {\n    const subscription = AppState.addEventListener("change", (state) => {\n      if (state !== "active") return;\n      setNow(new Date());\n      void loadQuizStats().then(setQuizStats).catch(() => undefined);\n      if (!alertsEnabled || !Object.keys(prayerTimes).length) return;\n      void schedulePrayerNotifications(prayerTimes, locale, phoneAlertPreferences)\n        .then((result) => setScheduledCount(result.count))\n        .catch(() => undefined);\n      void scheduleIslamicEventReminders(windsorDateKey(new Date()), locale).catch(() => undefined);\n    });\n    return () => subscription.remove();\n  }, [alertsEnabled, locale, prayerTimes, phoneAlertPreferences]);'''
new_resume = '''  useEffect(() => {\n    const subscription = AppState.addEventListener("change", (state) => {\n      if (state !== "active") return;\n      setNow(new Date());\n      void loadQuizStats().then(setQuizStats).catch(() => undefined);\n      // Refresh GPS whenever Hassoun returns to the foreground so the city and prayer schedule travel with the user.\n      void loadPrayerTimes().then(async (refreshed) => {\n        setPrayerTimes(refreshed.prayerTimes);\n        setLive(refreshed.live);\n        setPrayerLocation(refreshed.location);\n        if (alertsEnabled) {\n          const result = await schedulePrayerNotifications(refreshed.prayerTimes, locale, phoneAlertPreferences, { locationLabel: refreshed.location.label, timeZone: refreshed.location.timezone });\n          setScheduledCount(result.count);\n          await scheduleIslamicEventReminders(windsorDateKey(new Date(), refreshed.location.timezone), locale, refreshed.location.timezone).catch(() => undefined);\n        }\n      }).catch(() => undefined);\n    });\n    return () => subscription.remove();\n  }, [alertsEnabled, locale, phoneAlertPreferences]);'''
rep(old_resume, new_resume)

rep('      const result = await schedulePrayerNotifications(prayerTimes, nextLocale, phoneAlertPreferences);', '      const result = await schedulePrayerNotifications(prayerTimes, nextLocale, phoneAlertPreferences, { locationLabel: prayerLocation.label, timeZone: prayerLocation.timezone });')
rep('      const result = await schedulePrayerNotifications(prayerTimes, locale, preferences);', '      const result = await schedulePrayerNotifications(prayerTimes, locale, preferences, { locationLabel: prayerLocation.label, timeZone: prayerLocation.timezone });')
rep('      const result = await schedulePrayerNotifications(prayerTimes, locale, nextPreferences);', '      const result = await schedulePrayerNotifications(prayerTimes, locale, nextPreferences, { locationLabel: prayerLocation.label, timeZone: prayerLocation.timezone });')
s = s.replace('await scheduleIslamicEventReminders(todayKey, nextLocale).catch(() => undefined);', 'await scheduleIslamicEventReminders(todayKey, nextLocale, prayerLocation.timezone).catch(() => undefined);')
s = s.replace('await scheduleIslamicEventReminders(todayKey, locale).catch(() => undefined);', 'await scheduleIslamicEventReminders(todayKey, locale, prayerLocation.timezone).catch(() => undefined);')
rep('Loading Windsor prayer times…', 'Loading prayer times…')
rep('  const date = windsorLocalToDate(todayKey, "12:00");', '  const date = windsorLocalToDate(todayKey, "12:00", prayerLocation.timezone);')
rep('  const hijriDate = hijriDateLabel(date, locale);', '  const hijriDate = hijriDateLabel(date, locale, prayerLocation.timezone);')
rep('<View style={styles.brandText}><Text style={styles.title}>Hassoun</Text><Text style={styles.subtitle}>{locale === "ar" ? "📍 وندسور، أونتاريو • مواقيت الصلاة" : "📍 Windsor, Ontario • Prayer Times"}</Text></View>', '<View style={styles.brandText}><Text style={styles.title}>Hassoun</Text><Text numberOfLines={1} style={styles.subtitle}>📍 {prayerLocation.label} • {locale === "ar" ? "مواقيت الصلاة" : "Prayer Times"}</Text></View>')
old_sync = '<Text style={styles.syncText}>{live ? (locale === "ar" ? "متزامن عبر Hassoun" : "Synced by Hassoun") : (locale === "ar" ? "الجدول الرسمي محفوظ" : "Saved official schedule")}</Text>'
new_sync = '<Text style={styles.syncText}>{live ? (prayerLocation.source === "windsor_islamic_association" ? (locale === "ar" ? "جدول وندسور الإسلامي الرسمي" : "Windsor Islamic Association • official Adhan time") : (locale === "ar" ? "حساب الأذان المحلي • موقع الجهاز" : "Local Adhan calculation • device location")) : (locale === "ar" ? "جدول الصلاة المحفوظ" : "Saved prayer schedule")}</Text>'
rep(old_sync, new_sync)
rep('<Text style={styles.footer}>Official Windsor Islamic Association schedule • America/Toronto</Text>', '<Text style={styles.footer}>{prayerLocation.source === "windsor_islamic_association" ? "Official Windsor Islamic Association schedule" : prayerLocation.source === "aladhan" ? `Local prayer calculation • ${prayerLocation.label}` : `Saved prayer schedule • ${prayerLocation.label}`} • {prayerLocation.timezone}</Text>')
APP.write_text(s, encoding="utf-8")

c = CONFIG.read_text(encoding="utf-8")
c, n1 = re.subn(r'version:\s*(?:process\.env\.EXPO_APP_VERSION\s*\|\|\s*)?"[^"]+"', 'version: process.env.EXPO_APP_VERSION || "1.0.21"', c, count=1)
c, n2 = re.subn(r'versionCode:\s*\d+', 'versionCode: 65', c, count=1)
if n1 != 1 or n2 != 1:
    raise SystemExit("Could not update app version/versionCode exactly once")
CONFIG.write_text(c, encoding="utf-8")

# App-only guardrails. About/logo integrity is verified separately against SettingsHub in CI.
for needle in ['📍 {prayerLocation.label}', 'loadPrayerTimes().then(async (refreshed)', 'locationLabel: refreshed.location.label', 'Local Adhan calculation • device location']:
    if needle not in s:
        raise SystemExit(f"Post-patch guard failed: {needle}")

print("Applied minimal v1.0.21 live-location patch to exact v1.0.20 mobile baseline")
