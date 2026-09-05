from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[2]
APP = ROOT / "mobile/App.tsx"
s = APP.read_text(encoding="utf-8")

state_anchor = '  const [alertPreferencesBusy, setAlertPreferencesBusy] = useState(false);'
if state_anchor not in s:
    raise SystemExit("Home state anchor missing")
if 'manualPullStartY' not in s:
    s = s.replace(state_anchor, state_anchor + '''\n  const [manualPullStartY, setManualPullStartY] = useState<number | null>(null);\n  const [manualPullDistance, setManualPullDistance] = useState(0);\n  const [homeScrollAtTop, setHomeScrollAtTop] = useState(true);\n  const [manualRefreshNonce, setManualRefreshNonce] = useState(0);''', 1)

# Add a fallback refresh effect. The later pull-to-refresh patch upgrades loadPrayerTimes
# to accept forceLocation:true, so this final generated App uses a real fresh GPS fix.
anchor = '  useEffect(() => {\n    if (Object.keys(prayerTimes).length) HassounWidget.syncPrayerSchedule(JSON.stringify(prayerTimes), locale);\n  }, [prayerTimes, locale]);\n'
if anchor not in s:
    raise SystemExit("Widget sync effect anchor missing")
if 'manualRefreshNonce > 0' not in s:
    effect = '''\n  useEffect(() => {\n    if (manualRefreshNonce <= 0) return;\n    void loadPrayerTimes({ forceLocation: true } as any).then((refreshed: any) => {\n      setPrayerTimes(refreshed.prayerTimes);\n      setPrayerLocation(refreshed.location);\n      setLive(refreshed.live);\n      setNow(new Date());\n      HassounWidget.syncPrayerSchedule(JSON.stringify(refreshed.prayerTimes), locale);\n      HassounWidget.refresh();\n    }).catch(() => undefined);\n  }, [manualRefreshNonce]);\n'''
    s = s.replace(anchor, anchor + effect, 1)

# Passive touch handlers do not claim/capture the responder. They only measure a downward
# drag while Home is at y=0, so native RefreshControl still gets first chance.
handler_anchor = '  const toggleLocale = async () => {'
if handler_anchor not in s:
    raise SystemExit("toggleLocale anchor missing")
if 'const manualHomeTouchStart' not in s:
    handlers = '''  const manualHomeTouchStart = (event: any) => {\n    if (!homeScrollAtTop) { setManualPullStartY(null); setManualPullDistance(0); return; }\n    setManualPullStartY(event.nativeEvent.pageY);\n    setManualPullDistance(0);\n  };\n\n  const manualHomeTouchMove = (event: any) => {\n    if (manualPullStartY == null || !homeScrollAtTop) return;\n    setManualPullDistance(Math.max(0, event.nativeEvent.pageY - manualPullStartY));\n  };\n\n  const manualHomeTouchEnd = () => {\n    if (homeScrollAtTop && manualPullDistance >= 72) setManualRefreshNonce((value) => value + 1);\n    setManualPullStartY(null);\n    setManualPullDistance(0);\n  };\n\n'''
    s = s.replace(handler_anchor, handlers + handler_anchor, 1)

home_index = s.find('const homeScreen')
if home_index < 0:
    raise SystemExit("homeScreen missing")
scroll_index = s.find('<ScrollView', home_index)
if scroll_index < 0:
    raise SystemExit("Home ScrollView missing")
tag_end = s.find('>', scroll_index)
if tag_end < 0:
    raise SystemExit("Home ScrollView opening tag malformed")
opening = s[scroll_index:tag_end + 1]

# Idempotent if re-run.
for pat in [
    r'\s+scrollEventThrottle=\{16\}',
    r'\s+onScroll=\{\(event\) => setHomeScrollAtTop\(event\.nativeEvent\.contentOffset\.y <= 1\)\}',
    r'\s+onTouchStart=\{manualHomeTouchStart\}',
    r'\s+onTouchMove=\{manualHomeTouchMove\}',
    r'\s+onTouchEnd=\{manualHomeTouchEnd\}',
    r'\s+onTouchCancel=\{manualHomeTouchEnd\}',
]:
    opening = re.sub(pat, '', opening)

opening = opening[:-1] + '''\n      scrollEventThrottle={16}\n      onScroll={(event) => setHomeScrollAtTop(event.nativeEvent.contentOffset.y <= 1)}\n      onTouchStart={manualHomeTouchStart}\n      onTouchMove={manualHomeTouchMove}\n      onTouchEnd={manualHomeTouchEnd}\n      onTouchCancel={manualHomeTouchEnd}\n    >'''
s = s[:scroll_index] + opening + s[tag_end + 1:]

APP.write_text(s, encoding="utf-8")
print("Added passive 72px Android pull-down fallback on Home without blocking native RefreshControl")
