from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[2]
APP = ROOT / "mobile/App.tsx"
PRAYER_DATA = ROOT / "mobile/src/prayerData.ts"
app = APP.read_text(encoding="utf-8")
prayer_data = PRAYER_DATA.read_text(encoding="utf-8")

# Native React Native RefreshControl is the reliable Android implementation.
react_import = re.search(r'import \{([^}]*)\} from "react";', app)
if not react_import:
    raise SystemExit("React import not found")
imports = [x.strip() for x in react_import.group(1).split(',') if x.strip()]
if "useCallback" not in imports:
    imports.append("useCallback")
imports = [x for x in imports if x != "useRef"]
replacement = 'import { ' + ', '.join(imports) + ' } from "react";'
app = app[:react_import.start()] + replacement + app[react_import.end():]

if "RefreshControl" not in app:
    app, count = re.subn(r'(\bPressable,\s*\n\s*)(ScrollView,)', r'\1RefreshControl,\n  \2', app, count=1)
    if count != 1:
        raise SystemExit("Could not add RefreshControl import")

if "prayerLocation" not in app or "loadPrayerTimes" not in app:
    raise SystemExit("Expected v1.0.20 prayerLocation/loadPrayerTimes pipeline is missing")

old_sig = 'export async function loadPrayerTimes(): Promise<LoadedPrayerTimes> {'
new_sig = 'export async function loadPrayerTimes(options: { forceLocation?: boolean } = {}): Promise<LoadedPrayerTimes> {'
if old_sig in prayer_data:
    prayer_data = prayer_data.replace(old_sig, new_sig, 1)
elif new_sig not in prayer_data:
    raise SystemExit("Could not patch loadPrayerTimes signature for forced location")

old_position = '''    let position: Location.LocationObject;\n    try {\n      position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });\n    } catch {\n      const last = await Location.getLastKnownPositionAsync();\n      if (!last) return fallback;\n      position = last;\n    }'''
new_position = '''    let position: Location.LocationObject;\n    try {\n      position = await Location.getCurrentPositionAsync({\n        accuracy: options.forceLocation ? Location.Accuracy.High : Location.Accuracy.Balanced\n      });\n    } catch {\n      // A manual refresh must never silently report an old cached GPS position.\n      // Startup may still use last-known data for speed/offline resilience.\n      if (options.forceLocation) throw new Error("Fresh GPS location unavailable");\n      const last = await Location.getLastKnownPositionAsync();\n      if (!last) return fallback;\n      position = last;\n    }'''
if old_position in prayer_data:
    prayer_data = prayer_data.replace(old_position, new_position, 1)
elif new_position not in prayer_data:
    raise SystemExit("Could not patch fresh-GPS position block")

# The original v1.0.20 outer catch returns the saved Windsor schedule for any error.
# That means a forced manual refresh can fail but still look successful and keep
# Windsor on screen. Forced mode must propagate the error to the Home refresh UI.
old_outer = '''  } catch {\n    return fallback;\n  }\n}'''
new_outer = '''  } catch (error) {\n    if (options.forceLocation) throw error;\n    return fallback;\n  }\n}'''
if old_outer in prayer_data:
    prayer_data = prayer_data.replace(old_outer, new_outer, 1)
elif new_outer not in prayer_data:
    raise SystemExit("Could not patch outer fallback for forced refresh")

state_anchor = '  const [alertPreferencesBusy, setAlertPreferencesBusy] = useState(false);'
if state_anchor not in app:
    raise SystemExit("Could not find Home state anchor")

app = re.sub(r'\n\s*const \[refreshingHome, setRefreshingHome\] = useState\(false\);', '', app)
app = re.sub(r'\n\s*const homePullStartY = useRef<number \| null>\(null\);', '', app)
app = re.sub(r'\n\s*const homeScrollY = useRef\(0\);', '', app)
app = re.sub(r'\n\s*const homePullTriggered = useRef\(false\);', '', app)
app = app.replace(state_anchor, state_anchor + '\n  const [refreshingHome, setRefreshingHome] = useState(false);', 1)

refresh_impl = '''  const refreshHome = useCallback(async () => {\n    if (refreshingHome) return;\n    setRefreshingHome(true);\n    const startedAt = Date.now();\n    try {\n      setNow(new Date());\n      const [refreshed, freshQuizStats] = await Promise.all([\n        loadPrayerTimes({ forceLocation: true }),\n        loadQuizStats().catch(() => quizStats)\n      ]);\n      setPrayerTimes(refreshed.prayerTimes);\n      setPrayerLocation(refreshed.location);\n      setLive(refreshed.live);\n      setQuizStats(freshQuizStats);\n      HassounWidget.syncPrayerSchedule(JSON.stringify(refreshed.prayerTimes), locale);\n      HassounWidget.refresh();\n      if (alertsEnabled) {\n        const result = await schedulePrayerNotifications(\n          refreshed.prayerTimes,\n          locale,\n          phoneAlertPreferences,\n          { locationLabel: refreshed.location.label, timeZone: refreshed.location.timezone }\n        );\n        setScheduledCount(result.count);\n        await scheduleIslamicEventReminders(\n          windsorDateKey(new Date(), refreshed.location.timezone),\n          locale,\n          refreshed.location.timezone\n        ).catch(() => undefined);\n      }\n    } finally {\n      const remaining = Math.max(0, 800 - (Date.now() - startedAt));\n      if (remaining) await new Promise((resolve) => setTimeout(resolve, remaining));\n      setRefreshingHome(false);\n    }\n  }, [alertsEnabled, locale, phoneAlertPreferences, quizStats, refreshingHome]);'''

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
# Do NOT use app.find('>') here: passive touch handlers contain arrow functions (=>),
# whose > character is not the end of the JSX opening tag. The true tag terminator is
# on its own indented line.
closing_match = re.search(r'\n\s*>', app[scroll_index:])
if not closing_match:
    raise SystemExit("Could not parse Home ScrollView opening tag")
tag_end = scroll_index + closing_match.end() - 1
opening = app[scroll_index:tag_end + 1]

for pat in [
    r'\s+alwaysBounceVertical', r'\s+overScrollMode="[^"]+"', r'\s+nestedScrollEnabled',
    r'\s+scrollEventThrottle=\{[^}]+\}', r'\s+onScroll=\{onHomeScroll\}',
    r'\s+onTouchStart=\{onHomeTouchStart\}', r'\s+onTouchMove=\{onHomeTouchMove\}',
    r'\s+onTouchEnd=\{onHomeTouchEnd\}', r'\s+onScrollEndDrag=\{onHomeTouchEnd\}',
    r'\s+refreshControl=\{\s*<RefreshControl.*?/>(?:\s*)\}',
]:
    opening = re.sub(pat, '', opening, flags=re.S)

opening = opening[:-1] + '''\n      alwaysBounceVertical\n      overScrollMode="always"\n      refreshControl={\n        <RefreshControl\n          refreshing={refreshingHome}\n          onRefresh={refreshHome}\n          progressViewOffset={8}\n          enabled\n        />\n      }\n    >'''
app = app[:scroll_index] + opening + app[tag_end + 1:]

required = [
    'const refreshHome = useCallback',
    'loadPrayerTimes({ forceLocation: true })',
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

if 'Location.Accuracy.High' not in prayer_data or 'options.forceLocation' not in prayer_data:
    raise SystemExit('Forced fresh GPS mode was not installed in prayerData.ts')
if 'if (options.forceLocation) throw error;' not in prayer_data:
    raise SystemExit('Forced refresh can still silently fall back to stale saved location')

APP.write_text(app, encoding="utf-8")
PRAYER_DATA.write_text(prayer_data, encoding="utf-8")

MASJID = ROOT / "mobile/src/MasjidDisplayPage.tsx"
if MASJID.exists():
    masjid = MASJID.read_text(encoding="utf-8")
    masjid = masjid.replace("StyleSheet.absoluteFillObject", "StyleSheet.absoluteFill")
    MASJID.write_text(masjid, encoding="utf-8")
    if "absoluteFillObject" in masjid:
        raise SystemExit("Masjid display still contains unsupported StyleSheet.absoluteFillObject")

print("Enabled Home pull-to-refresh with forced high-accuracy GPS, explicit failure, and no stale-location fallback")
