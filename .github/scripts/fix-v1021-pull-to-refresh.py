from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[2]
APP = ROOT / "mobile/App.tsx"
app = APP.read_text(encoding="utf-8")

# Add RefreshControl import.
if "RefreshControl" not in app:
    app, count = re.subn(r'(\bPressable,\s*\n\s*)(ScrollView,)', r'\1RefreshControl,\n  \2', app, count=1)
    if count != 1:
        raise SystemExit("Could not add RefreshControl import")

# v1.0.20 already has prayerLocation + loadPrayerTimes after the fast-start recipe.
if "prayerLocation" not in app or "loadPrayerTimes" not in app:
    raise SystemExit("Expected v1.0.20 prayerLocation/loadPrayerTimes pipeline is missing")

if "refreshingHome" not in app:
    anchor = '  const [alertPreferencesBusy, setAlertPreferencesBusy] = useState(false);'
    if anchor not in app:
        raise SystemExit("Could not find Home state anchor")
    app = app.replace(anchor, anchor + '\n  const [refreshingHome, setRefreshingHome] = useState(false);', 1)

if "const refreshHome = useCallback" not in app:
    marker = '  useEffect(() => {\n    if (Object.keys(prayerTimes).length) HassounWidget.syncPrayerSchedule(JSON.stringify(prayerTimes), locale);'
    idx = app.find(marker)
    if idx < 0:
        raise SystemExit("Could not find insertion point before first effect")
    refresh = '''  const refreshHome = useCallback(async () => {\n    if (refreshingHome) return;\n    setRefreshingHome(true);\n    try {\n      setNow(new Date());\n      const [refreshed, freshQuizStats] = await Promise.all([\n        loadPrayerTimes(),\n        loadQuizStats().catch(() => quizStats)\n      ]);\n      setPrayerTimes(refreshed.prayerTimes);\n      setPrayerLocation(refreshed.location);\n      setLive(refreshed.live);\n      setQuizStats(freshQuizStats);\n      if (alertsEnabled) {\n        const result = await schedulePrayerNotifications(\n          refreshed.prayerTimes,\n          locale,\n          phoneAlertPreferences,\n          { locationLabel: refreshed.location.label, timeZone: refreshed.location.timezone }\n        );\n        setScheduledCount(result.count);\n        await scheduleIslamicEventReminders(\n          windsorDateKey(new Date(), refreshed.location.timezone),\n          locale,\n          refreshed.location.timezone\n        ).catch(() => undefined);\n      }\n    } finally {\n      setRefreshingHome(false);\n    }\n  }, [alertsEnabled, locale, phoneAlertPreferences, quizStats, refreshingHome]);\n\n'''
    app = app[:idx] + refresh + app[idx:]

needle = "refreshControl={<RefreshControl refreshing={refreshingHome} onRefresh={refreshHome} />}"
if needle not in app:
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
    additions = ""
    if "alwaysBounceVertical" not in opening:
        additions += "\n      alwaysBounceVertical"
    additions += "\n      refreshControl={<RefreshControl refreshing={refreshingHome} onRefresh={refreshHome} />}"
    app = app[:tag_end] + additions + app[tag_end:]

APP.write_text(app, encoding="utf-8")
print("Added pull-to-refresh using the exact v1.0.20 prayer/location pipeline")
