from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[2]
APP = ROOT / "mobile/App.tsx"
s = APP.read_text(encoding="utf-8")

# Keep native RefreshControl, but add a passive touch-distance fallback because some
# Samsung/Android builds do not reliably dispatch SwipeRefreshLayout on this nested app shell.
react_import = re.search(r'import \{([^}]*)\} from "react";', s)
if not react_import:
    raise SystemExit("React import missing")
imports = [x.strip() for x in react_import.group(1).split(',') if x.strip()]
if "useRef" not in imports:
    imports.append("useRef")
replacement = 'import { ' + ', '.join(imports) + ' } from "react";'
s = s[:react_import.start()] + replacement + s[react_import.end():]

state_anchor = '  const [refreshingHome, setRefreshingHome] = useState(false);'
if state_anchor not in s:
    raise SystemExit("refreshingHome state missing")
if 'homePullStartY' not in s:
    s = s.replace(state_anchor, state_anchor + '''\n  const homePullStartY = useRef<number | null>(null);\n  const homePullDistance = useRef(0);\n  const homeAtTop = useRef(true);''', 1)

handler_anchor = '  const refreshHome = useCallback(async () => {'
idx = s.find(handler_anchor)
if idx < 0:
    raise SystemExit("refreshHome callback missing")
# Insert fallback handlers before refreshHome so JSX can reference them.
if 'const onHomeTouchStart' not in s:
    handlers = '''  const onHomeTouchStart = useCallback((event: any) => {\n    if (!homeAtTop.current || refreshingHome) { homePullStartY.current = null; homePullDistance.current = 0; return; }\n    homePullStartY.current = event.nativeEvent.pageY;\n    homePullDistance.current = 0;\n  }, [refreshingHome]);\n\n  const onHomeTouchMove = useCallback((event: any) => {\n    if (homePullStartY.current == null || !homeAtTop.current || refreshingHome) return;\n    homePullDistance.current = Math.max(0, event.nativeEvent.pageY - homePullStartY.current);\n  }, [refreshingHome]);\n\n  const onHomeTouchEnd = useCallback(() => {\n    const shouldRefresh = homeAtTop.current && homePullDistance.current >= 72 && !refreshingHome;\n    homePullStartY.current = null;\n    homePullDistance.current = 0;\n    if (shouldRefresh) void refreshHome();\n  }, [refreshHome, refreshingHome]);\n\n'''
    # These callbacks refer to refreshHome, so place them after refreshHome instead.
    # We'll inject after the callback block below.
else:
    handlers = ''

# Find end of refreshHome callback.
start = s.find(handler_anchor)
end = s.find('\n\n  useEffect(() => {', start)
if end < 0:
    raise SystemExit("Could not locate end of refreshHome callback")
if 'const onHomeTouchStart' not in s:
    handlers = '''\n\n  const onHomeTouchStart = useCallback((event: any) => {\n    if (!homeAtTop.current || refreshingHome) { homePullStartY.current = null; homePullDistance.current = 0; return; }\n    homePullStartY.current = event.nativeEvent.pageY;\n    homePullDistance.current = 0;\n  }, [refreshingHome]);\n\n  const onHomeTouchMove = useCallback((event: any) => {\n    if (homePullStartY.current == null || !homeAtTop.current || refreshingHome) return;\n    homePullDistance.current = Math.max(0, event.nativeEvent.pageY - homePullStartY.current);\n  }, [refreshingHome]);\n\n  const onHomeTouchEnd = useCallback(() => {\n    const shouldRefresh = homeAtTop.current && homePullDistance.current >= 72 && !refreshingHome;\n    homePullStartY.current = null;\n    homePullDistance.current = 0;\n    if (shouldRefresh) void refreshHome();\n  }, [refreshHome, refreshingHome]);'''
    s = s[:end] + handlers + s[end:]

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

# Remove only our fallback props if script is re-run, preserving native RefreshControl.
for pat in [
    r'\s+scrollEventThrottle=\{16\}',
    r'\s+onScroll=\{\(event\) => \{ homeAtTop\.current = event\.nativeEvent\.contentOffset\.y <= 1; \}\}',
    r'\s+onTouchStart=\{onHomeTouchStart\}',
    r'\s+onTouchMove=\{onHomeTouchMove\}',
    r'\s+onTouchEnd=\{onHomeTouchEnd\}',
    r'\s+onTouchCancel=\{onHomeTouchEnd\}',
]:
    opening = re.sub(pat, '', opening)

opening = opening[:-1] + '''\n      scrollEventThrottle={16}\n      onScroll={(event) => { homeAtTop.current = event.nativeEvent.contentOffset.y <= 1; }}\n      onTouchStart={onHomeTouchStart}\n      onTouchMove={onHomeTouchMove}\n      onTouchEnd={onHomeTouchEnd}\n      onTouchCancel={onHomeTouchEnd}\n    >'''
s = s[:scroll_index] + opening + s[tag_end + 1:]

for required in (
    'refreshControl={',
    'onRefresh={refreshHome}',
    'homePullDistance.current >= 72',
    'onTouchEnd={onHomeTouchEnd}',
    'loadPrayerTimes({ forceLocation: true })',
):
    if required not in s:
        raise SystemExit("Missing robust refresh requirement: " + required)

APP.write_text(s, encoding="utf-8")
print("Added passive Android downward-swipe fallback while keeping native RefreshControl")
