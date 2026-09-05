from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[2]
APP = ROOT / "mobile/App.tsx"
app = APP.read_text(encoding="utf-8")

# The phone Home is new, but Masjid TV / splash / remote / navigation state remains shared.
app = re.sub(r'^import .*HomePrayerPanel.*\n', '', app, flags=re.M)
app = re.sub(r'^import .*localPrayerTimes.*\n', '', app, flags=re.M)
if 'import HomePrayerPage from "./src/HomePrayerPage";' not in app:
    app = app.replace('import SettingsHub from "./src/SettingsHub";\n', 'import SettingsHub from "./src/SettingsHub";\nimport HomePrayerPage from "./src/HomePrayerPage";\n')

# Normalize all prayerData imports and anchor the canonical import to our own stable new Home import.
app = re.sub(r'^import .*from "\./src/prayerData";\n', '', app, flags=re.M)
home_import = 'import HomePrayerPage from "./src/HomePrayerPage";\n'
if home_import not in app:
    raise SystemExit('HomePrayerPage import anchor missing')
app = app.replace(home_import, home_import + 'import { loadInitialPrayerTimes, loadPrayerTimes, type LoadedPrayerTimes, type PrayerLocation } from "./src/prayerData";\n', 1)

# Preserve every existing shared state declaration. Add only the canonical context used by
# the new phone Home. Existing prayerTimes/prayerLocation/live remain for Masjid/TV features.
if 'const [prayerContext, setPrayerContext]' not in app:
    state_anchor = '  const [alertPreferencesBusy, setAlertPreferencesBusy] = useState(false);'
    if state_anchor not in app:
        state_anchor = '  const [refreshingHome, setRefreshingHome] = useState(false);'
    if state_anchor not in app:
        raise SystemExit('could not find state insertion anchor')
    app = app.replace(state_anchor, state_anchor + '\n  const [prayerContext, setPrayerContext] = useState<LoadedPrayerTimes | null>(null);', 1)

# Old Home refresh callbacks were already removed by cleanup, but remove any variant that survived.
for marker in ('  const refreshHome = useCallback', '  const refreshPrayerLocation = useCallback'):
    while True:
        start = app.find(marker)
        if start < 0:
            break
        candidates = [p for p in (
            app.find('\n  useEffect(', start + len(marker)),
            app.find('\n  const ', start + len(marker)),
            app.find('\n  async function ', start + len(marker)),
        ) if p >= 0]
        if not candidates:
            raise SystemExit(f'could not bound old callback: {marker}')
        app = app[:start] + app[min(candidates) + 1:]

# Remove the passive/manual fallback refresh effect. Native RefreshControl in HomePrayerPage is
# now the only phone Home refresh gesture.
app = re.sub(
    r'\n\s*useEffect\(\(\) => \{\n\s*if \(manualRefreshNonce <= 0\) return;.*?\n\s*\}, \[manualRefreshNonce\]\);\n',
    '\n', app, count=1, flags=re.S
)

refresh_callback = '''
  const refreshHome = useCallback(async () => {
    if (refreshingHome) return;
    setRefreshingHome(true);
    try {
      const refreshed = await loadPrayerTimes({ forceLocation: true });
      setPrayerContext(refreshed);
      setPrayerTimes(refreshed.prayerTimes);
      setPrayerLocation(refreshed.location);
      setLive(refreshed.live);
      setNow(new Date());
      HassounWidget.syncPrayerSchedule(JSON.stringify(refreshed.prayerTimes), locale);
      HassounWidget.refresh();
      if (alertsEnabled) {
        const result = await schedulePrayerNotifications(
          refreshed.prayerTimes,
          locale,
          phoneAlertPreferences,
          refreshed.location.label,
          refreshed.location.timezone
        );
        setScheduledCount(result.count);
      }
      void registerDeviceForServerPush(locale).catch(() => undefined);
    } catch (error) {
      const message = String(error);
      Alert.alert(
        locale === "ar" ? "تعذر تحديث الموقع" : "Location refresh failed",
        message.includes("LOCATION_PERMISSION_DENIED")
          ? (locale === "ar" ? "اسمح لتطبيق Hassoun باستخدام الموقع ثم اسحب للأسفل مرة أخرى." : "Allow Hassoun to use your location, then pull down again.")
          : message.includes("LOCATION_SERVICES_DISABLED")
            ? (locale === "ar" ? "فعّل خدمة الموقع ثم اسحب للأسفل مرة أخرى." : "Turn on Location Services, then pull down again.")
            : (locale === "ar" ? "لم نتمكن من الحصول على موقع GPS جديد. لم يتم تغيير مواقيت الصلاة الحالية." : "Hassoun could not get a fresh GPS fix. Your current prayer data was left unchanged.")
      );
    } finally {
      setRefreshingHome(false);
    }
  }, [alertsEnabled, locale, phoneAlertPreferences, refreshingHome]);
'''
first_effect = app.find('  useEffect(() => {')
if first_effect < 0:
    raise SystemExit('first effect missing')
app = app[:first_effect] + refresh_callback + '\n' + app[first_effect:]

# Cold start may use the saved canonical context, never an obsolete localPrayerTimes service.
app = app.replace('loadLocationPrayerContext(false)', 'loadInitialPrayerTimes()')
app = app.replace('        loadPrayerTimes(),\n        loadQuizStats()', '        loadInitialPrayerTimes(),\n        loadQuizStats()', 1)

# Whenever startup receives `loaded`, keep all shared consumers synchronized and populate the new Home.
startup_candidates = [
    '      setPrayerLocation(loaded.location);',
    '      setLive(loaded.live);',
    '      setPhoneAlertPreferences(savedPhoneAlertPreferences);',
]
if 'setPrayerContext(loaded);' not in app:
    for startup_anchor in startup_candidates:
        if startup_anchor in app:
            app = app.replace(startup_anchor, startup_anchor + '\n      setPrayerContext(loaded);', 1)
            break
    else:
        raise SystemExit('startup context anchor missing')

app = app.replace('loaded.locationLabel', 'loaded.location.label')
app = app.replace('loaded.timezone', 'loaded.location.timezone')

# Background -> foreground must not force GPS/network refresh.
pattern = re.compile(r'\n\s*useEffect\(\(\) => \{.*?AppState\.addEventListener\("change".*?\n\s*\}, \[[^\]]*\]\);\n', re.S)
for match in list(pattern.finditer(app))[::-1]:
    block = match.group(0)
    if 'loadPrayerTimes' in block or 'refreshPrayerLocation' in block:
        app = app[:match.start()] + '\n' + app[match.end():]

if 'if (state === "active") setNow(new Date());' not in app:
    marker = '  const toggleLocale = async () => {'
    pos = app.find(marker)
    if pos < 0:
        raise SystemExit('toggleLocale anchor missing')
    resume = '''  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") setNow(new Date());
    });
    return () => subscription.remove();
  }, []);

'''
    app = app[:pos] + resume + app[pos:]

# Remove every legacy phone Home declaration.
for name in ('homeScreen', 'phoneHomeScreen'):
    marker = f'  const {name} ='
    while True:
        start = app.find(marker)
        if start < 0:
            break
        next_decl = app.find('\n  const ', start + len(marker))
        if next_decl < 0:
            raise SystemExit(f'could not bound remaining legacy {name}')
        app = app[:start] + app[next_decl + 1:]

new_home = '''  const homeScreen = (
    <HomePrayerPage
      locale={locale}
      context={prayerContext}
      refreshing={refreshingHome}
      alertsEnabled={alertsEnabled}
      alertPreferencesBusy={alertPreferencesBusy}
      preferences={phoneAlertPreferences}
      scheduledCount={scheduledCount}
      onRefresh={refreshHome}
      onMenu={() => setActiveTab("more")}
      onToggleLocale={() => { void toggleLocale(); }}
      onOpenQibla={() => setActiveTab("qibla")}
      onOpenAlerts={() => setActiveTab("alerts")}
      onToggleAlerts={(enabled) => { void toggleAlerts(enabled); }}
      onChangePreferences={(nextPreferences) => { void updatePhoneAlertPreferences(nextPreferences); }}
      onTogglePrayerAudio={(prayer) => { void togglePrayerAudio(prayer); }}
    />
  );

'''
insert_match = re.search(r'\n\s*const [A-Za-z0-9_]+Screen\s*=\s*\(', app)
if insert_match:
    insert_at = insert_match.start() + 1
else:
    insert_at = app.find('  return (')
    if insert_at < 0:
        raise SystemExit('could not find Home insertion point')
app = app[:insert_at] + new_home + app[insert_at:]
app = app.replace('phoneHomeScreen', 'homeScreen')

# Old manual-touch handlers belong only to the removed Home.
for handler in ('manualHomeTouchStart', 'manualHomeTouchMove', 'manualHomeTouchEnd', 'onHomeTouchStart', 'onHomeTouchMove', 'onHomeTouchEnd'):
    app = re.sub(rf'\n\s*const {handler}\b.*?(?=\n\s*const |\n\s*useEffect\(|\n\s*async function )', '\n', app, count=1, flags=re.S)

for forbidden in ['loadLocationPrayerContext', 'HomePrayerPanel', 'refreshPrayerLocation', 'REFRESH LOCATION', 'phoneHomeScreen']:
    if forbidden in app:
        idx = app.find(forbidden)
        snippet = app[max(0, idx - 180):idx + 260]
        raise SystemExit(f'Legacy phone Home code still present: {forbidden}\n{snippet}')
for required in [
    'HomePrayerPage', 'loadInitialPrayerTimes', 'loadPrayerTimes({ forceLocation: true })',
    'context={prayerContext}', 'onRefresh={refreshHome}', 'setPrayerContext(loaded);',
    'setPrayerTimes(refreshed.prayerTimes);', 'startupAudioCleared',
]:
    if required not in app:
        raise SystemExit(f'Ground-zero Home requirement missing: {required}')

APP.write_text(app, encoding="utf-8")
print('Rebuilt phone Home from ground zero while preserving shared Masjid/TV/navigation/splash state')
