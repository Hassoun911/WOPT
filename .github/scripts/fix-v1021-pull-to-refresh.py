from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[2]
APP = ROOT / "mobile/App.tsx"
app = APP.read_text(encoding="utf-8")

# Pull-to-refresh uses useCallback/useRef.
react_import = re.search(r'import \{([^}]*)\} from "react";', app)
if not react_import:
    raise SystemExit("React import not found")
imports = [x.strip() for x in react_import.group(1).split(',') if x.strip()]
for needed in ("useCallback", "useRef"):
    if needed not in imports:
        imports.append(needed)
replacement = 'import { ' + ', '.join(imports) + ' } from "react";'
app = app[:react_import.start()] + replacement + app[react_import.end():]

# Add RefreshControl import.
if "RefreshControl" not in app:
    app, count = re.subn(r'(\bPressable,\s*\n\s*)(ScrollView,)', r'\1RefreshControl,\n  \2', app, count=1)
    if count != 1:
        raise SystemExit("Could not add RefreshControl import")

if "prayerLocation" not in app or "loadPrayerTimes" not in app:
    raise SystemExit("Expected v1.0.20 prayerLocation/loadPrayerTimes pipeline is missing")

state_anchor = '  const [alertPreferencesBusy, setAlertPreferencesBusy] = useState(false);'
if state_anchor not in app:
    raise SystemExit("Could not find Home state anchor")
extra_state = '''
  const [refreshingHome, setRefreshingHome] = useState(false);
  const homePullStartY = useRef<number | null>(null);
  const homeScrollY = useRef(0);
  const homePullTriggered = useRef(false);'''
# Remove prior injected state/refs and re-add exactly once.
app = re.sub(r'\n\s*const \[refreshingHome, setRefreshingHome\] = useState\(false\);', '', app)
app = re.sub(r'\n\s*const homePullStartY = useRef<number \| null>\(null\);', '', app)
app = re.sub(r'\n\s*const homeScrollY = useRef\(0\);', '', app)
app = re.sub(r'\n\s*const homePullTriggered = useRef\(false\);', '', app)
app = app.replace(state_anchor, state_anchor + extra_state, 1)

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
      const remaining = Math.max(0, 900 - (Date.now() - startedAt));
      if (remaining) await new Promise((resolve) => setTimeout(resolve, remaining));
      setRefreshingHome(false);
    }
  }, [alertsEnabled, locale, phoneAlertPreferences, quizStats, refreshingHome]);

  // Android fallback: RefreshControl can fail to claim the gesture on some Samsung builds.
  // Track an actual downward finger drag while Home is at the top and trigger the same refresh.
  const onHomeScroll = useCallback((event: any) => {
    homeScrollY.current = Number(event?.nativeEvent?.contentOffset?.y || 0);
  }, []);
  const onHomeTouchStart = useCallback((event: any) => {
    homePullStartY.current = Number(event?.nativeEvent?.pageY || 0);
    homePullTriggered.current = false;
  }, []);
  const onHomeTouchMove = useCallback((event: any) => {
    if (refreshingHome || homePullTriggered.current || homePullStartY.current === null) return;
    if (homeScrollY.current > 8) return;
    const currentY = Number(event?.nativeEvent?.pageY || 0);
    if (currentY - homePullStartY.current >= 55) {
      homePullTriggered.current = true;
      void refreshHome();
    }
  }, [refreshHome, refreshingHome]);
  const onHomeTouchEnd = useCallback(() => {
    homePullStartY.current = null;
    homePullTriggered.current = false;
  }, []);'''

pattern = re.compile(r'  const refreshHome = useCallback\(async \(\) => \{.*?^  \}, \[[^\]]*\]\);(?:\n\n  // Android fallback:.*?^  \}, \[\]\);)?', re.M | re.S)
if pattern.search(app):
    app = pattern.sub(refresh_impl, app, count=1)
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

# Strip any previous injected gesture/refresh props so the shipped Home ScrollView is deterministic.
for pat in [
    r'\s+alwaysBounceVertical', r'\s+overScrollMode="[^"]+"', r'\s+nestedScrollEnabled',
    r'\s+scrollEventThrottle=\{[^}]+\}', r'\s+onScroll=\{onHomeScroll\}',
    r'\s+onTouchStart=\{onHomeTouchStart\}', r'\s+onTouchMove=\{onHomeTouchMove\}',
    r'\s+onTouchEnd=\{onHomeTouchEnd\}', r'\s+onScrollEndDrag=\{onHomeTouchEnd\}',
    r'\s+refreshControl=\{\s*<RefreshControl.*?/>(?:\s*)\}',
]:
    opening = re.sub(pat, '', opening, flags=re.S)

opening = opening[:-1] + '''
      alwaysBounceVertical
      overScrollMode="always"
      nestedScrollEnabled
      scrollEventThrottle={16}
      onScroll={onHomeScroll}
      onTouchStart={onHomeTouchStart}
      onTouchMove={onHomeTouchMove}
      onTouchEnd={onHomeTouchEnd}
      onScrollEndDrag={onHomeTouchEnd}
      refreshControl={
        <RefreshControl
          refreshing={refreshingHome}
          onRefresh={refreshHome}
          progressViewOffset={16}
          enabled={true}
        />
      }
    >'''
app = app[:scroll_index] + opening + app[tag_end + 1:]

required = [
    'const refreshHome = useCallback',
    'const onHomeTouchMove = useCallback',
    'currentY - homePullStartY.current >= 55',
    'refreshing={refreshingHome}',
    'onRefresh={refreshHome}',
    'onTouchMove={onHomeTouchMove}',
    'overScrollMode="always"',
    'progressViewOffset={16}',
    'HassounWidget.refresh()',
]
for item in required:
    if item not in app:
        raise SystemExit('Missing pull-to-refresh requirement: ' + item)

APP.write_text(app, encoding="utf-8")
print("Enabled native + gesture-fallback pull-to-refresh on Home")
