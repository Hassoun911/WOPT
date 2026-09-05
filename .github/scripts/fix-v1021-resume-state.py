from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
APP = ROOT / "mobile/App.tsx"
s = APP.read_text(encoding="utf-8")

state_anchor = '  const [activeTab, setActiveTab] = useState<AppTab>("home");'
if state_anchor not in s:
    raise SystemExit("activeTab state anchor missing")
if 'navStateRestored' not in s:
    s = s.replace(state_anchor, state_anchor + '\n  const [navStateRestored, setNavStateRestored] = useState(false);', 1)

anchor = '  useEffect(() => {\n    if (Object.keys(prayerTimes).length) HassounWidget.syncPrayerSchedule(JSON.stringify(prayerTimes), locale);\n  }, [prayerTimes, locale]);\n'
if anchor not in s:
    raise SystemExit("widget effect anchor missing")

persist = '''\n  // Restore the last visible tab if Android recreates the activity/process while Hassoun is backgrounded.\n  // This prevents a process recreation from looking like a forced app restart back to Home.\n  useEffect(() => {\n    let alive = true;\n    void AsyncStorage.getItem("hassoun:last-active-tab:v1").then((saved) => {\n      if (!alive) return;\n      const allowed: AppTab[] = ["home", "quran", "quiz", "alerts", "events", "qibla", "more"];\n      if (saved && allowed.includes(saved as AppTab)) setActiveTab(saved as AppTab);\n    }).finally(() => { if (alive) setNavStateRestored(true); });\n    return () => { alive = false; };\n  }, []);\n\n  useEffect(() => {\n    if (!navStateRestored) return;\n    void AsyncStorage.setItem("hassoun:last-active-tab:v1", activeTab).catch(() => undefined);\n  }, [activeTab, navStateRestored]);\n'''
if 'hassoun:last-active-tab:v1' not in s:
    s = s.replace(anchor, anchor + persist, 1)

APP.write_text(s, encoding="utf-8")
print("Persisted last active Hassoun tab across Android activity/process recreation")
