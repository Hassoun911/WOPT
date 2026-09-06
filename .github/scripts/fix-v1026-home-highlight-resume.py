from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[2]
APP = ROOT / "mobile/App.tsx"
HOME = ROOT / "mobile/src/HomePrayerPage.tsx"

home = HOME.read_text(encoding="utf-8")
old = '          const active = next?.prayer === prayer && !next.tomorrow;'
new = '          const active = next?.prayer === prayer;'
if old in home:
    home = home.replace(old, new, 1)
elif new not in home:
    raise SystemExit("Could not find next-prayer active-row calculation")

home = home.replace(
    '<Text style={styles.nextBadgeText}>{locale === "ar" ? "التالي" : "NEXT"}</Text>',
    '<Text style={styles.nextBadgeText}>{next?.tomorrow ? (locale === "ar" ? "التالي • غداً" : "NEXT • TOMORROW") : (locale === "ar" ? "التالي" : "NEXT")}</Text>',
    1,
)
HOME.write_text(home, encoding="utf-8")

app = APP.read_text(encoding="utf-8")

# useRef lets us retain the exact current tab in the AppState background callback.
react_import = re.search(r'import \{([^}]*)\} from "react";', app)
if not react_import:
    raise SystemExit("React import missing")
parts = [p.strip() for p in react_import.group(1).split(',') if p.strip()]
if "useRef" not in parts:
    parts.append("useRef")
app = app[:react_import.start()] + 'import { ' + ', '.join(parts) + ' } from "react";' + app[react_import.end():]

state_anchor = '  const [runtimeNavRestored, setRuntimeNavRestored] = useState(false);'
if state_anchor not in app:
    raise SystemExit("runtimeNavRestored state missing; resume persistence must run first")
if 'const activeTabRef = useRef<AppTab>("home");' not in app:
    app = app.replace(state_anchor, state_anchor + '\n  const activeTabRef = useRef<AppTab>("home");', 1)

# Persist the tab on every navigation change and immediately when Android backgrounds the app.
if 'hassoun:resume-exact-screen:v1' not in app:
    anchor = '''  useEffect(() => {
    if (!runtimeNavRestored) return;
    void AsyncStorage.setItem("hassoun:last-active-tab:v2", activeTab).catch(() => undefined);
  }, [activeTab, runtimeNavRestored]);
'''
    if anchor not in app:
        raise SystemExit("active-tab persistence effect missing")
    stronger = anchor + '''
  useEffect(() => {
    if (!runtimeNavRestored) return;
    activeTabRef.current = activeTab;
    void AsyncStorage.multiSet([
      ["hassoun:last-active-tab:v2", activeTab],
      ["hassoun:resume-exact-screen:v1", activeTab]
    ]).catch(() => undefined);
  }, [activeTab, runtimeNavRestored]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") return;
      const current = activeTabRef.current;
      void AsyncStorage.multiSet([
        ["hassoun:last-active-tab:v2", current],
        ["hassoun:resume-exact-screen:v1", current]
      ]).catch(() => undefined);
    });
    return () => subscription.remove();
  }, []);
'''
    app = app.replace(anchor, stronger, 1)

# Restore from the strongest resume key first, then the older tab key.
old_restore = '    void AsyncStorage.getItem("hassoun:last-active-tab:v2")\n      .then((saved) => {'
if old_restore in app:
    app = app.replace(
        old_restore,
        '    void AsyncStorage.multiGet(["hassoun:resume-exact-screen:v1", "hassoun:last-active-tab:v2"])\n      .then((rows) => {\n        const saved = rows[0]?.[1] || rows[1]?.[1];',
        1,
    )

# Never render Home while navigation restoration is still asynchronous. This prevents the
# visible "restart to Home" flash and makes process recreation reopen the saved screen first.
loading_anchor = '  if (busy && !today) {'
if loading_anchor in app:
    app = app.replace(loading_anchor, '  if (!runtimeNavRestored || (busy && !today)) {', 1)
elif 'if (!runtimeNavRestored || (busy && !today)) {' not in app:
    raise SystemExit("Could not find startup loading gate")

APP.write_text(app, encoding="utf-8")

for needle in [
    'const active = next?.prayer === prayer;',
    'NEXT • TOMORROW',
]:
    if needle not in HOME.read_text(encoding="utf-8"):
        raise SystemExit(f"Home highlight fix missing: {needle}")
for needle in [
    'hassoun:resume-exact-screen:v1',
    'activeTabRef.current = activeTab',
    'if (!runtimeNavRestored || (busy && !today))',
]:
    if needle not in APP.read_text(encoding="utf-8"):
        raise SystemExit(f"Resume fix missing: {needle}")
print("Applied next-prayer highlight including tomorrow and exact-screen background/process resume")
