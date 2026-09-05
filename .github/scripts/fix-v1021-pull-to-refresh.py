from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[2]
APP = ROOT / "mobile/App.tsx"
app = APP.read_text(encoding="utf-8")

# Pull-to-refresh uses useCallback.
react_import = re.search(r'import \{([^}]*)\} from "react";', app)
if not react_import:
    raise SystemExit("React import not found")
if "useCallback" not in react_import.group(1):
    current = react_import.group(1).strip()
    replacement = 'import { ' + current + ', useCallback } from "react";'
    app = app[:react_import.start()] + replacement + app[react_import.end():]

# Add RefreshControl import.
if "RefreshControl" not in app:
    app, count = re.subn(r'(\bPressable,\s*\n\s*)(ScrollView,)', r'\1RefreshControl,\n  \2', app, count=1)
    if count != 1:
        raise SystemExit("Could not add RefreshControl import")

if "prayerLocation" not in app or "loadPrayerTimes" not in app:
    raise SystemExit("Expected v1.0.20 prayerLocation/loadPrayerTimes pipeline is missing")

if "refreshingHome" not in app:
    anchor = '  const [alertPreferencesBusy, setAlertPreferencesBusy] = useState(false);'
    if anchor not in app:
        raise SystemExit("Could not find Home state anchor")
    app = app.replace(anchor, anchor + '\n  const [refreshingHome, setRefreshingHome] = useState(false);', 1)

# Replace any older refreshHome implementation with one that always gives visible feedback,
# runs the native v1.0.20 GPS/location pipeline, syncs the widget, and cannot finish invisibly.
refresh_impl = '''  const refreshHome = useCallback(async () => {\n    if (refreshingHome) return;\n    setRefreshingHome(true);\n    const startedAt = Date.now();\n    try {\n      setNow(new Date());\n      const [refreshed, freshQuizStats] = await Promise.all([\n        loadPrayerTimes(),\n        loadQuizStats().catch(() => quizStats)\n      ]);\n      setPrayerTimes(refreshed.prayerTimes);\n      setPrayerLocation(refreshed.location);\n      setLive(refreshed.live);\n      setQuizStats(freshQuizStats);\n      HassounWidget.syncPrayerSchedule(JSON.stringify(refreshed.prayerTimes), locale);\n      HassounWidget.refresh();\n      if (alertsEnabled) {\n        const result = await schedulePrayerNotifications(\n          refreshed.prayerTimes,\n          locale,\n          phoneAlertPreferences,\n          { locationLabel: refreshed.location.label, timeZone: refreshed.location.timezone }\n        );\n        setScheduledCount(result.count);\n        await scheduleIslamicEventReminders(\n          windsorDateKey(new Date(), refreshed.location.timezone),\n          locale,\n          refreshed.location.timezone\n        ).catch(() => undefined);\n      }\n    } finally {\n      const remaining = Math.max(0, 700 - (Date.now() - startedAt));\n      if (remaining) await new Promise((resolve) => setTimeout(resolve, remaining));\n      setRefreshingHome(false);\n    }\n  }, [alertsEnabled, locale, phoneAlertPreferences, quizStats, refreshingHome]);'''

pattern = re.compile(r'  const refreshHome = useCallback\(async \(\) => \{.*?^  \}, \[[^\]]*\]\);', re.M | re.S)
if pattern.search(app):
    app = pattern.sub(refresh_impl, app, count=1)
else:
    marker = '  useEffect(() => {\n    if (Object.keys(prayerTimes).length) HassounWidget.syncPrayerSchedule(JSON.stringify(prayerTimes), locale);'
    idx = app.find(marker)
    if idx < 0:
        raise SystemExit("Could not find insertion point before first effect")
    app = app[:idx] + refresh_impl + '\n\n' + app[idx:]

# Replace the Home ScrollView opening tag so Android definitely permits overscroll/pull gesture.
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

# Remove any older refresh props first so we know exactly what ships.
opening = re.sub(r'\s+alwaysBounceVertical', '', opening)
opening = re.sub(r'\s+overScrollMode="[^"]+"', '', opening)
opening = re.sub(r'\s+nestedScrollEnabled', '', opening)
opening = re.sub(r'\s+refreshControl=\{<RefreshControl[^>]+/>\}', '', opening)
opening = opening[:-1] + '''\n      alwaysBounceVertical\n      overScrollMode="always"\n      nestedScrollEnabled\n      refreshControl={\n        <RefreshControl\n          refreshing={refreshingHome}\n          onRefresh={refreshHome}\n          progressViewOffset={8}\n          enabled\n        />\n      }\n    >'''
app = app[:scroll_index] + opening + app[tag_end + 1:]

# Verify the actual Home control, not just a callback somewhere in the file.
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

APP.write_text(app, encoding="utf-8")
print("Enabled reliable Android pull-to-refresh on the Home screen")
