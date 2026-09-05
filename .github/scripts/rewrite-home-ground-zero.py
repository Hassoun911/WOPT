from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[2]
APP = ROOT / "mobile/App.tsx"

app = APP.read_text(encoding="utf-8")

app = app.replace('import HomePrayerPanel from "./src/HomePrayerPanel";\n', '')
app = app.replace('import { loadLocationPrayerContext } from "./src/localPrayerTimes";\n', '')
if 'import HomePrayerPage from "./src/HomePrayerPage";' not in app:
    app = app.replace('import SettingsHub from "./src/SettingsHub";\n', 'import SettingsHub from "./src/SettingsHub";\nimport HomePrayerPage from "./src/HomePrayerPage";\n')

for old in [
    'import { loadPrayerTimes } from "./src/prayerData";\n',
    'import { loadPrayerTimes, type PrayerLocation } from "./src/prayerData";\n',
]:
    app = app.replace(old, '')
if 'from "./src/prayerData"' not in app:
    anchor = 'import { openExactAlarmSettings'
    idx = app.find(anchor)
    if idx < 0:
        raise SystemExit('prayerAudio import anchor missing')
    line_end = app.find('\n', idx) + 1
    app = app[:line_end] + 'import { loadInitialPrayerTimes, loadPrayerTimes, type LoadedPrayerTimes } from "./src/prayerData";\n' + app[line_end:]

state_start = app.find('  const [now, setNow] = useState(new Date());')
derived_start = app.find('  const todayKey =', state_start)
if state_start < 0 or derived_start < 0:
    raise SystemExit('could not bound legacy Home state section')
new_state = '''  const [now, setNow] = useState(new Date());
  const [prayerContext, setPrayerContext] = useState<LoadedPrayerTimes | null>(null);
  const [refreshingHome, setRefreshingHome] = useState(false);
  const [startupAudioCleared, setStartupAudioCleared] = useState(false);
  const [locale, setLocale] = useState<"en" | "ar">("en");
  const [alertsEnabled, setAlertsEnabled] = useState(false);
  const [busy, setBusy] = useState(true);
  const [scheduledCount, setScheduledCount] = useState(0);
  const [activeTab, setActiveTab] = useState<AppTab>("home");
  const [quranAppNavVisible, setQuranAppNavVisible] = useState(true);
  const [quranOwnsAudioSurface, setQuranOwnsAudioSurface] = useState(false);
  const [globalQuranAudio, setGlobalQuranAudio] = useState<QuranAudioStatus>({ available: Boolean(QuranAudio), state: "idle", positionMs: 0, durationMs: 0, speed: 1 });
  const [quizStats, setQuizStats] = useState<QuizStats>(EMPTY_QUIZ_STATS);
  const [phoneAlertPreferences, setPhoneAlertPreferences] = useState<PrayerAlertPreferences>(DEFAULT_PHONE_PRAYER_ALERTS);
  const [alertPreferencesBusy, setAlertPreferencesBusy] = useState(false);

  const prayerTimes = prayerContext?.prayerTimes ?? {};
  const live = prayerContext?.live ?? false;
  const locationLabel = prayerContext?.location.label ?? (locale === "ar" ? "جارٍ تحديد الموقع" : "Locating…");
  const prayerTimeZone = prayerContext?.location.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone ?? "UTC";
  const sourceLabel = prayerContext?.location.source === "windsor_islamic_association"
    ? "Windsor Islamic Association • official Adhan time"
    : prayerContext?.location.source === "aladhan"
      ? "Local Adhan calculation • device location"
      : "Saved prayer schedule";

'''
app = app[:state_start] + new_state + app[derived_start:]

app = re.sub(r'\n\s*const refreshPrayerLocation = useCallback\(async \(force = false\) => \{.*?\n\s*\}, \[\]\);\n', '\n', app, count=1, flags=re.S)
app = re.sub(r'\n\s*const refreshHome = useCallback\(async \(\) => \{.*?\n\s*\}, \[[^\]]*\]\);\n', '\n', app, count=1, flags=re.S)

refresh_callback = '''
  const refreshHome = useCallback(async () => {
    if (refreshingHome) return;
    setRefreshingHome(true);
    try {
      const refreshed = await loadPrayerTimes({ forceLocation: true });
      setPrayerContext(refreshed);
      setNow(new Date());
      HassounWidget.syncPrayerSchedule(JSON.stringify(refreshed.prayerTimes), locale);
      HassounWidget.refresh();
      if (alertsEnabled) {
        const result = await schedulePrayerNotifications(refreshed.prayerTimes, locale, phoneAlertPreferences, refreshed.location.label, refreshed.location.timezone);
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

app = app.replace('loadLocationPrayerContext(false)', 'loadInitialPrayerTimes()')
app = app.replace('loadPrayerTimes(),', 'loadInitialPrayerTimes(),')
app = re.sub(
    r'\n\s*setPrayerTimes\(loaded\.prayerTimes\);\n(?:\s*setLive\([^\n]+\);\n)?(?:\s*setLocationLabel\([^\n]+\);\n)?(?:\s*setPrayerTimeZone\([^\n]+\);\n)?(?:\s*setSourceLabel\([^\n]+\);)?',
    '\n      setPrayerContext(loaded);', app, count=1
)
app = app.replace('loaded.locationLabel, loaded.timezone', 'loaded.location.label, loaded.location.timezone')
app = app.replace('loaded.timezone), chosenLocale', 'loaded.location.timezone), chosenLocale')

# Any pre-existing AppState listener is removed; resume only updates the clock.
app = re.sub(
    r'\n\s*useEffect\(\(\) => \{\n\s*const subscription = AppState\.addEventListener\("change", \(state\) => \{.*?\n\s*return \(\) => subscription\.remove\(\);\n\s*\}, \[[^\]]*\]\);\n',
    '\n', app, count=1, flags=re.S
)

resume_effects = '''
  useEffect(() => {
    let mounted = true;
    void AsyncStorage.getItem("hassoun:active-tab:v3").then((saved) => {
      if (!mounted) return;
      if (saved && ["home", "quran", "quiz", "alerts", "events", "qibla", "more"].includes(saved)) setActiveTab(saved as AppTab);
    }).catch(() => undefined);
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    void AsyncStorage.setItem("hassoun:active-tab:v3", activeTab).catch(() => undefined);
  }, [activeTab]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") setNow(new Date());
    });
    return () => subscription.remove();
  }, []);
'''
marker = '  const toggleLocale = async () => {'
pos = app.find(marker)
if pos < 0:
    raise SystemExit('toggleLocale anchor missing')
app = app[:pos] + resume_effects + '\n' + app[pos:]

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

# Delete the old Home renderer if present. Do not depend on the name of the next screen.
home_match = re.search(r'\n\s*const homeScreen\s*=\s*\(.*?\n\s*\);\n', app, flags=re.S)
if home_match:
    app = app[:home_match.start()] + '\n' + app[home_match.end():]

# Insert the new Home renderer before the first remaining screen declaration. If screen
# declarations were transformed, insert before the final app return section instead.
insert_match = re.search(r'\n\s*const [A-Za-z0-9_]+Screen\s*=\s*\(', app)
if insert_match:
    insert_at = insert_match.start() + 1
else:
    insert_at = app.find('  return (')
    if insert_at < 0:
        raise SystemExit('could not find Home insertion point')
app = app[:insert_at] + new_home + app[insert_at:]

app = re.sub(r'\nfunction nextPrayerFor\(.*?\n\}\n\nfunction countdownLabel', '\nfunction countdownLabel', app, count=1, flags=re.S)
app = re.sub(r'\nfunction countdownLabel\(.*?\n\}\n\nfunction hijriDateLabel', '\nfunction hijriDateLabel', app, count=1, flags=re.S)
app = re.sub(r'\nfunction hijriDateLabel\(.*?\n\}\n\nexport default function App', '\nexport default function App', app, count=1, flags=re.S)
app = re.sub(r'\n\s*const next = useMemo\(.*?;\n', '\n', app, count=1)
app = re.sub(r'\n\s*const badge = badgeForWins\(.*?;\n', '\n', app, count=1)
app = re.sub(r'\n\s*const upcomingBadge = nextBadge\(.*?;\n', '\n', app, count=1)
app = re.sub(r'\n\s*const islamicTimeline = useMemo\(.*?;\n\s*const upcomingIslamicEvent = .*?;\n\s*const upcomingIslamicDays = .*?;\n', '\n', app, count=1)

app = app.replace('import { useCallback, useEffect, useMemo, useState } from "react";', 'import { useCallback, useEffect, useState } from "react";')
app = app.replace('import { badgeForWins, EMPTY_QUIZ_STATS, loadQuizStats, nextBadge, type QuizStats } from "./src/islamicQuiz";', 'import { EMPTY_QUIZ_STATS, loadQuizStats, type QuizStats } from "./src/islamicQuiz";')

app = re.sub(
    r'\n\s*if \(busy && !today\) \{.*?\n\s*\}\n\n\s*const date = .*?\n\s*const shortDate = .*?\n\s*const hijriDate = .*?\n',
    '\n', app, count=1, flags=re.S
)

for forbidden in ['loadLocationPrayerContext', 'HomePrayerPanel', 'refreshPrayerLocation', 'REFRESH LOCATION', 'setLocationLabel(', 'setPrayerTimeZone(', 'setSourceLabel(', 'setPrayerTimes(']:
    if forbidden in app:
        raise SystemExit(f'Legacy Home symbol still present: {forbidden}')
for required in ['HomePrayerPage', 'loadInitialPrayerTimes', 'loadPrayerTimes({ forceLocation: true })', 'hassoun:active-tab:v3', 'context={prayerContext}', 'onRefresh={refreshHome}', 'startupAudioCleared']:
    if required not in app:
        raise SystemExit(f'Ground-zero Home requirement missing: {required}')

APP.write_text(app, encoding="utf-8")
print('Rebuilt Home from ground zero: canonical PrayerContext, pull-down refresh, subscription area, resume without restart')
