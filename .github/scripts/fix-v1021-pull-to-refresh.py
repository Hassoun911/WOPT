from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[2]
APP = ROOT / "mobile/App.tsx"
app = APP.read_text(encoding="utf-8")

# Native React Native RefreshControl is the reliable Android implementation.
react_import = re.search(r'import \{([^}]*)\} from "react";', app)
if not react_import:
    raise SystemExit("React import not found")
imports = [x.strip() for x in react_import.group(1).split(',') if x.strip()]
if "useCallback" not in imports:
    imports.append("useCallback")
# Remove the old gesture fallback dependency if a prior candidate added it.
imports = [x for x in imports if x != "useRef"]
replacement = 'import { ' + ', '.join(imports) + ' } from "react";'
app = app[:react_import.start()] + replacement + app[react_import.end():]

if "RefreshControl" not in app:
    app, count = re.subn(r'(\bPressable,\s*\n\s*)(ScrollView,)', r'\1RefreshControl,\n  \2', app, count=1)
    if count != 1:
        raise SystemExit("Could not add RefreshControl import")

if "prayerLocation" not in app or "loadPrayerTimes" not in app:
    raise SystemExit("Expected v1.0.20 prayerLocation/loadPrayerTimes pipeline is missing")

state_anchor = '  const [alertPreferencesBusy, setAlertPreferencesBusy] = useState(false);'
if state_anchor not in app:
    raise SystemExit("Could not find Home state anchor")

# Remove every previous refresh/gesture state then add only the native refreshing state.
app = re.sub(r'\n\s*const \[refreshingHome, setRefreshingHome\] = useState\(false\);', '', app)
app = re.sub(r'\n\s*const homePullStartY = useRef<number \| null>\(null\);', '', app)
app = re.sub(r'\n\s*const homeScrollY = useRef\(0\);', '', app)
app = re.sub(r'\n\s*const homePullTriggered = useRef\(false\);', '', app)
app = app.replace(state_anchor, state_anchor + '\n  const [refreshingHome, setRefreshingHome] = useState(false);', 1)

refresh_impl = '''  const refreshHome = useCallback(async () => {
    if (refreshingHome) return;
    setRefreshingHome(true);
    const startedAt = Date.now();
    try {
      setNow(new Date());
      const [refreshed, freshQuizStats] = await Promise.all([
        loadPrayerTimes(),
        loadQuizStats().catch(() => quizStats)
      ]);
      setPrayerTimes(refreshed.prayerTimes);
      setPrayerLocation(refreshed.location);
      setLive(refreshed.live);
      setQuizStats(freshQuizStats);
      HassounWidget.syncPrayerSchedule(JSON.stringify(refreshed.prayerTimes), locale);
      HassounWidget.refresh();
      if (alertsEnabled) {
        const result = await schedulePrayerNotifications(
          refreshed.prayerTimes,
          locale,
          phoneAlertPreferences,
          { locationLabel: refreshed.location.label, timeZone: refreshed.location.timezone }
        );
        setScheduledCount(result.count);
        await scheduleIslamicEventReminders(
          windsorDateKey(new Date(), refreshed.location.timezone),
          locale,
          refreshed.location.timezone
        ).catch(() => undefined);
      }
    } finally {
      // Keep the spinner visible long enough to give clear feedback that refresh happened.
      const remaining = Math.max(0, 800 - (Date.now() - startedAt));
      if (remaining) await new Promise((resolve) => setTimeout(resolve, remaining));
      setRefreshingHome(false);
    }
  }, [alertsEnabled, locale, phoneAlertPreferences, quizStats, refreshingHome]);'''

# Remove any earlier refreshHome + manual touch fallback block.
start = app.find('  const refreshHome = useCallback')
if start >= 0:
    end_marker = '  useEffect(() => {\n    if (Object.keys(prayerTimes).length) HassounWidget.syncPrayerSchedule(JSON.stringify(prayerTimes), locale);'
    end = app.find(end_marker, start)
    if end < 0:
        raise SystemExit("Could not locate end of old refresh block")
    app = app[:start] + refresh_impl + '\n\n' + app[end:]
else:
    marker = '  useEffect(() => {\n    if (Object.keys(prayerTimes).length) HassounWidget.syncPrayerSchedule(JSON.stringify(prayerTimes), locale);'
    idx = app.find(marker)
    if idx < 0:
        raise SystemExit("Could not find insertion point before first effect")
    app = app[:idx] + refresh_impl + '\n\n' + app[idx:]

home_index = app.find("const homeScreen")
if home_index < 0:
    raise SystemExit("Could not find homeScreen declaration")
scroll_index = app.find("<ScrollView", home_index)
if scroll_index < 0:
    raise SystemExit("Could not find Home ScrollView")
tag_end = app.find(">", scroll_index)
if tag_end < 0:
    raise SystemExit("Could not parse Home ScrollView opening tag")
opening = app[scroll_index:tag_end + 1]

# Strip all previous refresh/gesture props. Manual onTouch handlers compete with
# Android SwipeRefreshLayout and were the reason the downward gesture was unreliable.
for pat in [
    r'\s+alwaysBounceVertical', r'\s+overScrollMode="[^"]+"', r'\s+nestedScrollEnabled',
    r'\s+scrollEventThrottle=\{[^}]+\}', r'\s+onScroll=\{onHomeScroll\}',
    r'\s+onTouchStart=\{onHomeTouchStart\}', r'\s+onTouchMove=\{onHomeTouchMove\}',
    r'\s+onTouchEnd=\{onHomeTouchEnd\}', r'\s+onScrollEndDrag=\{onHomeTouchEnd\}',
    r'\s+refreshControl=\{\s*<RefreshControl.*?/>(?:\s*)\}',
]:
    opening = re.sub(pat, '', opening, flags=re.S)

# Make the Home ScrollView own the pull gesture and use the platform-native control.
opening = opening[:-1] + '''
      alwaysBounceVertical
      overScrollMode="always"
      refreshControl={
        <RefreshControl
          refreshing={refreshingHome}
          onRefresh={refreshHome}
          progressViewOffset={8}
          enabled
        />
      }
    >'''
app = app[:scroll_index] + opening + app[tag_end + 1:]

required = [
    'const refreshHome = useCallback',
    'refreshing={refreshingHome}',
    'onRefresh={refreshHome}',
    'overScrollMode="always"',
    'progressViewOffset={8}',
    'HassounWidget.refresh()',
]
for item in required:
    if item not in app:
        raise SystemExit('Missing pull-to-refresh requirement: ' + item)
for forbidden in ('onHomeTouchMove', 'homePullStartY', 'homePullTriggered', 'nestedScrollEnabled'):
    if forbidden in app:
        raise SystemExit('Old gesture fallback still present: ' + forbidden)

APP.write_text(app, encoding="utf-8")

# React Native's StyleSheet typings expose absoluteFill, not absoluteFillObject in this SDK.
# The native Masjid generator runs before this script, so normalize the generated screen here.
MASJID = ROOT / "mobile/src/MasjidDisplayPage.tsx"
if MASJID.exists():
    masjid = MASJID.read_text(encoding="utf-8")
    masjid = masjid.replace("StyleSheet.absoluteFillObject", "StyleSheet.absoluteFill")
    MASJID.write_text(masjid, encoding="utf-8")
    if "absoluteFillObject" in masjid:
        raise SystemExit("Masjid display still contains unsupported StyleSheet.absoluteFillObject")

print("Enabled reliable native Android pull-to-refresh on Home and normalized Masjid StyleSheet compatibility")
