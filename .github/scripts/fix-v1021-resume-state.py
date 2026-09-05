from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
APP = ROOT / "mobile/App.tsx"
HUB = ROOT / "mobile/src/SettingsHub.tsx"

s = APP.read_text(encoding="utf-8")
state_anchor = '  const [activeTab, setActiveTab] = useState<AppTab>("home");'
if state_anchor not in s:
    raise SystemExit("activeTab state anchor missing")
if 'navStateRestored' not in s:
    s = s.replace(state_anchor, state_anchor + '\n  const [navStateRestored, setNavStateRestored] = useState(false);', 1)
anchor = '  useEffect(() => {\n    if (Object.keys(prayerTimes).length) HassounWidget.syncPrayerSchedule(JSON.stringify(prayerTimes), locale);\n  }, [prayerTimes, locale]);\n'
if anchor not in s:
    raise SystemExit("widget effect anchor missing")
persist = '''\n  useEffect(() => {\n    let alive = true;\n    void AsyncStorage.getItem("hassoun:last-active-tab:v1").then((saved) => {\n      if (!alive) return;\n      const allowed: AppTab[] = ["home", "quran", "quiz", "alerts", "events", "qibla", "more"];\n      if (saved && allowed.includes(saved as AppTab)) setActiveTab(saved as AppTab);\n    }).finally(() => { if (alive) setNavStateRestored(true); });\n    return () => { alive = false; };\n  }, []);\n\n  useEffect(() => {\n    if (!navStateRestored) return;\n    void AsyncStorage.setItem("hassoun:last-active-tab:v1", activeTab).catch(() => undefined);\n  }, [activeTab, navStateRestored]);\n'''
if 'hassoun:last-active-tab:v1' not in s:
    s = s.replace(anchor, anchor + persist, 1)
APP.write_text(s, encoding="utf-8")

h = HUB.read_text(encoding="utf-8")
if 'import AsyncStorage from "@react-native-async-storage/async-storage";' not in h:
    h = 'import AsyncStorage from "@react-native-async-storage/async-storage";\n' + h
page_anchor = '  const [page, setPage] = useState<SettingsPage>("root");'
if page_anchor not in h:
    raise SystemExit("SettingsHub page state anchor missing")
if 'settingsPageRestored' not in h:
    h = h.replace(page_anchor, page_anchor + '\n  const [settingsPageRestored, setSettingsPageRestored] = useState(false);', 1)
insert_anchor = '  const [widgetPrefs, setWidgetPrefs] = useState<HassounWidgetPreferences>(() => ({ ...HassounWidget.getPreferences(), locale }));\n'
if insert_anchor not in h:
    raise SystemExit("SettingsHub widget state anchor missing")
settings_effect = '''\n  useEffect(() => {\n    let alive = true;\n    void AsyncStorage.getItem("hassoun:last-settings-page:v1").then((saved) => {\n      if (!alive || !saved) return;\n      const allowed = ["root","about","contact","privacy","terms","data","permissions","widgets","displays","connectDisplay","prayerCalculation"];\n      if (allowed.includes(saved)) setPage(saved as SettingsPage);\n    }).finally(() => { if (alive) setSettingsPageRestored(true); });\n    return () => { alive = false; };\n  }, []);\n\n  useEffect(() => {\n    if (!settingsPageRestored) return;\n    void AsyncStorage.setItem("hassoun:last-settings-page:v1", page).catch(() => undefined);\n  }, [page, settingsPageRestored]);\n'''
if 'hassoun:last-settings-page:v1' not in h:
    h = h.replace(insert_anchor, insert_anchor + settings_effect, 1)
HUB.write_text(h, encoding="utf-8")
print("Persisted active app tab and nested Settings page across Android recreation")
