from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[2]
APP = ROOT / "mobile/App.tsx"

app = APP.read_text(encoding="utf-8")

# Add RefreshControl to the existing react-native import without depending on exact spacing.
if "RefreshControl" not in app:
    app, count = re.subn(r'(\bPressable,\s*\n\s*)(ScrollView,)', r'\1RefreshControl,\n  \2', app, count=1)
    if count != 1:
        raise SystemExit("Could not add RefreshControl import")

# Add refresh state once.
if "refreshingHome" not in app:
    state_pattern = r'(const \[sourceLabel,\s*setSourceLabel\]\s*=\s*useState\([^\n]+\);)'
    app, count = re.subn(state_pattern, r'\1\n  const [refreshingHome, setRefreshingHome] = useState(false);', app, count=1)
    if count != 1:
        raise SystemExit("Could not find sourceLabel state anchor")

# Add manual Home refresh callback immediately after refreshPrayerLocation.
if "const refreshHome = useCallback" not in app:
    callback_pattern = re.compile(
        r'(  const refreshPrayerLocation = useCallback\(async \(force = false\) => \{.*?^  \}, \[\]\);)',
        re.M | re.S,
    )
    match = callback_pattern.search(app)
    if not match:
        raise SystemExit("Could not find refreshPrayerLocation callback")
    callback = match.group(1)
    manual_refresh = callback + '''\n\n  const refreshHome = useCallback(async () => {\n    if (refreshingHome) return;\n    setRefreshingHome(true);\n    try {\n      setNow(new Date());\n      const [context, freshQuizStats] = await Promise.all([\n        refreshPrayerLocation(true),\n        loadQuizStats().catch(() => quizStats)\n      ]);\n      setQuizStats(freshQuizStats);\n      if (alertsEnabled) {\n        const result = await schedulePrayerNotifications(\n          context.prayerTimes,\n          locale,\n          phoneAlertPreferences,\n          context.locationLabel,\n          context.timezone\n        );\n        setScheduledCount(result.count);\n        await scheduleIslamicEventReminders(dateKeyInZone(new Date(), context.timezone), locale).catch(() => undefined);\n      }\n    } finally {\n      setRefreshingHome(false);\n    }\n  }, [alertsEnabled, locale, phoneAlertPreferences, quizStats, refreshPrayerLocation, refreshingHome]);'''
    app = app[:match.start()] + manual_refresh + app[match.end():]

# Patch the first ScrollView inside the homeScreen declaration, regardless of formatting/extra props.
if "refreshControl={<RefreshControl refreshing={refreshingHome} onRefresh={refreshHome} />}" not in app:
    home_index = app.find("const homeScreen")
    if home_index < 0:
        raise SystemExit("Could not find homeScreen declaration")
    scroll_index = app.find("<ScrollView", home_index)
    if scroll_index < 0:
        raise SystemExit("Could not find Home ScrollView")
    tag_end = app.find(">", scroll_index)
    if tag_end < 0:
        raise SystemExit("Could not parse Home ScrollView opening tag")
    opening = app[scroll_index:tag_end]
    additions = ''
    if "alwaysBounceVertical" not in opening:
        additions += "\n      alwaysBounceVertical"
    additions += "\n      refreshControl={<RefreshControl refreshing={refreshingHome} onRefresh={refreshHome} />}"
    app = app[:tag_end] + additions + app[tag_end:]

APP.write_text(app, encoding="utf-8")
print("Added manual pull-to-refresh to Hassoun home screen")
