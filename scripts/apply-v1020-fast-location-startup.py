from pathlib import Path

p = Path('mobile/App.tsx')
s = p.read_text(encoding='utf-8')

s = s.replace(
    'import { loadPrayerTimes } from "./src/prayerData";',
    'import { loadInitialPrayerTimes, loadPrayerTimes, type PrayerLocation } from "./src/prayerData";',
    1
)
s = s.replace(
    'import { PRAYER_KEYS, type PrayerKey, type PrayerTimes } from "./src/types";',
    'import { PRAYER_KEYS, type PrayerFile, type PrayerKey, type PrayerTimes } from "./src/types";\nimport bundledSchedule from "./assets/windsor_islamic_association_2026_prayer_times.json";',
    1
)
s = s.replace(
    '  const [prayerTimes, setPrayerTimes] = useState<PrayerTimes>({});\n  const [live, setLive] = useState(false);',
    '  const [prayerTimes, setPrayerTimes] = useState<PrayerTimes>(() => (bundledSchedule as PrayerFile).prayer_times);\n  const [live, setLive] = useState(false);\n  const [prayerLocation, setPrayerLocation] = useState<PrayerLocation>({ latitude: 42.3149, longitude: -83.0364, timezone: WINDSOR_TIME_ZONE, label: CITY_LABEL, source: "saved" });',
    1
)

old = '''      const [savedLocale, savedAlerts, savedPhoneAlertPreferences, loaded, storedQuizStats] = await Promise.all([\n        AsyncStorage.getItem(STORAGE_KEYS.locale),\n        AsyncStorage.getItem(STORAGE_KEYS.alertsEnabled),\n        loadPhonePrayerAlertPreferences(),\n        loadPrayerTimes(),\n        loadQuizStats()\n      ]);'''
new = '''      const [savedLocale, savedAlerts, savedPhoneAlertPreferences, initial, storedQuizStats] = await Promise.all([\n        AsyncStorage.getItem(STORAGE_KEYS.locale),\n        AsyncStorage.getItem(STORAGE_KEYS.alertsEnabled),\n        loadPhonePrayerAlertPreferences(),\n        loadInitialPrayerTimes(),\n        loadQuizStats()\n      ]);'''
if old not in s:
    raise SystemExit('startup Promise.all block not found')
s = s.replace(old, new, 1)

s = s.replace(
    '      setPrayerTimes(loaded.prayerTimes);\n      setLive(loaded.live);',
    '      setPrayerTimes(initial.prayerTimes);\n      setLive(initial.live);\n      setPrayerLocation(initial.location);',
    1
)
s = s.replace(
    '        const result = await schedulePrayerNotifications(loaded.prayerTimes, chosenLocale, savedPhoneAlertPreferences);',
    '        const result = await schedulePrayerNotifications(initial.prayerTimes, chosenLocale, savedPhoneAlertPreferences);',
    1
)

# Insert background location/network refresh only inside the initial startup effect.
# The same registerDeviceForServerPush line appears in other callbacks, so replace ONCE.
anchor = '''        void registerDeviceForServerPush(chosenLocale).catch(() => undefined);\n      }\n    })();'''
replacement = '''        void registerDeviceForServerPush(chosenLocale).catch(() => undefined);\n      }\n\n      // Refresh GPS + network prayer data only after Home is already usable.\n      // This keeps startup instant and updates Windsor/Montreal/other cities in the background.\n      void loadPrayerTimes().then(async (refreshed) => {\n        setPrayerTimes(refreshed.prayerTimes);\n        setPrayerLocation(refreshed.location);\n        setLive(refreshed.live);\n        if (savedAlerts === "on") {\n          const result = await schedulePrayerNotifications(refreshed.prayerTimes, chosenLocale, savedPhoneAlertPreferences);\n          setScheduledCount(result.count);\n        }\n      }).catch(() => undefined);\n    })();'''
if anchor not in s:
    raise SystemExit('startup completion anchor not found')
s = s.replace(anchor, replacement, 1)

loader = '''  if (busy && !today) {\n    return <SafeAreaView style={styles.loading} edges={["top", "bottom", "left", "right"]}><ActivityIndicator color="#0b5b47" size="large" /><Text style={styles.loadingText}>Loading Windsor prayer times…</Text></SafeAreaView>;\n  }\n\n'''
s = s.replace(loader, '', 1)

s = s.replace(
    '<View style={styles.brandText}><Text style={styles.title}>Hassoun</Text><Text style={styles.subtitle}>{locale === "ar" ? "📍 وندسور، أونتاريو • مواقيت الصلاة" : "📍 Windsor, Ontario • Prayer Times"}</Text></View>',
    '<View style={styles.brandText}><Text style={styles.title}>Hassoun</Text><Text style={styles.subtitle}>📍 {prayerLocation.label} • {locale === "ar" ? "مواقيت الصلاة" : "Prayer Times"}</Text></View>',
    1
)

for required in [
    'loadInitialPrayerTimes',
    'setPrayerLocation(initial.location)',
    'void loadPrayerTimes().then(async (refreshed)',
    '📍 {prayerLocation.label}',
]:
    if required not in s:
        raise SystemExit('missing fast-start requirement: ' + required)
if 'Loading Windsor prayer times…' in s:
    raise SystemExit('blocking Windsor loader still present')
if s.count('void loadPrayerTimes().then(async (refreshed)') != 1:
    raise SystemExit('background refresh must exist exactly once')

p.write_text(s, encoding='utf-8')
print('Applied v1.0.20 fast startup exactly once: cached Home first, GPS refresh second.')
