from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
APP = ROOT / "mobile/App.tsx"

app = APP.read_text(encoding="utf-8")

app = app.replace(
'''  Pressable,\n  ScrollView,\n  StyleSheet,''',
'''  Pressable,\n  RefreshControl,\n  ScrollView,\n  StyleSheet,''',
1,
)

state_anchor = '''  const [sourceLabel, setSourceLabel] = useState("Saved official Windsor schedule");'''
if state_anchor not in app:
    raise SystemExit("Could not find sourceLabel state anchor")
app = app.replace(
    state_anchor,
    state_anchor + '\n  const [refreshingHome, setRefreshingHome] = useState(false);',
    1,
)

callback_anchor = '''  const refreshPrayerLocation = useCallback(async (force = false) => {\n    const context = await loadLocationPrayerContext(force);\n    setPrayerTimes(context.prayerTimes);\n    setLive(context.live);\n    setLocationLabel(context.locationLabel);\n    setPrayerTimeZone(context.timezone);\n    setSourceLabel(context.sourceLabel);\n    return context;\n  }, []);'''
if callback_anchor not in app:
    raise SystemExit("Could not find refreshPrayerLocation callback")
manual_refresh = callback_anchor + '''\n\n  const refreshHome = useCallback(async () => {\n    if (refreshingHome) return;\n    setRefreshingHome(true);\n    try {\n      setNow(new Date());\n      const [context, freshQuizStats] = await Promise.all([\n        refreshPrayerLocation(true),\n        loadQuizStats().catch(() => quizStats)\n      ]);\n      setQuizStats(freshQuizStats);\n      if (alertsEnabled) {\n        const result = await schedulePrayerNotifications(\n          context.prayerTimes,\n          locale,\n          phoneAlertPreferences,\n          context.locationLabel,\n          context.timezone\n        );\n        setScheduledCount(result.count);\n        await scheduleIslamicEventReminders(dateKeyInZone(new Date(), context.timezone), locale).catch(() => undefined);\n      }\n    } finally {\n      setRefreshingHome(false);\n    }\n  }, [alertsEnabled, locale, phoneAlertPreferences, quizStats, refreshPrayerLocation, refreshingHome]);'''
app = app.replace(callback_anchor, manual_refresh, 1)

scroll_anchor = '''  const homeScreen = (\n    <ScrollView style={styles.flex} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>'''
if scroll_anchor not in app:
    raise SystemExit("Could not find home ScrollView")
scroll_new = '''  const homeScreen = (\n    <ScrollView\n      style={styles.flex}\n      contentContainerStyle={styles.content}\n      showsVerticalScrollIndicator={false}\n      alwaysBounceVertical\n      refreshControl={<RefreshControl refreshing={refreshingHome} onRefresh={refreshHome} />}\n    >'''
app = app.replace(scroll_anchor, scroll_new, 1)

APP.write_text(app, encoding="utf-8")
print("Added manual pull-to-refresh to Hassoun home screen")
