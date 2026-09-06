from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[2]
APP = ROOT / "mobile/App.tsx"
HOME = ROOT / "mobile/src/HomePrayerPage.tsx"

home = HOME.read_text(encoding="utf-8")
home = home.replace(
    '          const active = next?.prayer === prayer && !next.tomorrow;',
    '          const active = next?.prayer === prayer;',
    1,
)
if 'const active = next?.prayer === prayer;' not in home:
    raise SystemExit("Could not install next-prayer active-row calculation")

old_badge = '<Text style={styles.nextBadgeText}>{locale === "ar" ? "التالي" : "NEXT"}</Text>'
new_badge = '<Text style={styles.nextBadgeText}>{next?.tomorrow ? (locale === "ar" ? "التالي • غداً" : "NEXT • TOMORROW") : (locale === "ar" ? "التالي" : "NEXT")}</Text>'
if old_badge in home:
    home = home.replace(old_badge, new_badge, 1)
elif 'NEXT • TOMORROW' not in home:
    raise SystemExit("Could not install tomorrow badge")
HOME.write_text(home, encoding="utf-8")

app = APP.read_text(encoding="utf-8")

m = re.search(r'import \{([^}]*)\} from "react";', app)
if not m:
    raise SystemExit("React import missing")
parts = [p.strip() for p in m.group(1).split(',') if p.strip()]
if "useRef" not in parts:
    parts.append("useRef")
app = app[:m.start()] + 'import { ' + ', '.join(parts) + ' } from "react";' + app[m.end():]

active_state = re.search(r'^(\s*)const \[activeTab, setActiveTab\] = useState<AppTab>\("home"\);', app, re.M)
if not active_state:
    raise SystemExit("activeTab state missing")
indent = active_state.group(1)
state_line = active_state.group(0)
extra = []
if 'const [resumeStateReady, setResumeStateReady]' not in app:
    extra.append(f'{indent}const [resumeStateReady, setResumeStateReady] = useState(false);')
if 'const activeTabRef = useRef<AppTab>("home");' not in app:
    extra.append(f'{indent}const activeTabRef = useRef<AppTab>("home");')
if extra:
    app = app.replace(state_line, state_line + '\n' + '\n'.join(extra), 1)

if 'HASSOUN_EXACT_SCREEN_RESUME_V3' not in app:
    candidates = [app.find('  const refreshHome = useCallback'), app.find('  useEffect(() => {'), app.find('  const toggleLocale = async () => {')]
    candidates = [x for x in candidates if x >= 0]
    if not candidates:
        raise SystemExit("Could not find resume-effect insertion point")
    pos = min(candidates)
    block = '''  // HASSOUN_EXACT_SCREEN_RESUME_V3
  useEffect(() => {
    let alive = true;
    void AsyncStorage.multiGet([
      "hassoun:resume-exact-screen:v1",
      "hassoun:last-active-tab:v2",
      "hassoun:last-active-tab:v1"
    ]).then((rows) => {
      if (!alive) return;
      const saved = rows[0]?.[1] || rows[1]?.[1] || rows[2]?.[1];
      const allowed: AppTab[] = ["home", "quran", "quiz", "alerts", "events", "qibla", "more"];
      if (saved && allowed.includes(saved as AppTab)) {
        activeTabRef.current = saved as AppTab;
        setActiveTab(saved as AppTab);
      }
    }).finally(() => {
      if (alive) setResumeStateReady(true);
    });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!resumeStateReady) return;
    activeTabRef.current = activeTab;
    void AsyncStorage.multiSet([
      ["hassoun:resume-exact-screen:v1", activeTab],
      ["hassoun:last-active-tab:v2", activeTab],
      ["hassoun:last-active-tab:v1", activeTab]
    ]).catch(() => undefined);
  }, [activeTab, resumeStateReady]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") return;
      const current = activeTabRef.current;
      void AsyncStorage.multiSet([
        ["hassoun:resume-exact-screen:v1", current],
        ["hassoun:last-active-tab:v2", current],
        ["hassoun:last-active-tab:v1", current]
      ]).catch(() => undefined);
    });
    return () => subscription.remove();
  }, []);

'''
    app = app[:pos] + block + app[pos:]

# Prevent a Home flash while the persisted route is being restored. Some reconstructed
# variants have an existing loading gate and some do not, so support both forms.
if 'HASSOUN_RESUME_RENDER_GATE_V3' not in app:
    replaced = False
    app, n = re.subn(r'  if \(busy && !today\) \{', '  // HASSOUN_RESUME_RENDER_GATE_V3\n  if (!resumeStateReady || (busy && !today)) {', app, count=1)
    replaced = n == 1
    if not replaced:
        app, n = re.subn(r'  if \(!runtimeNavRestored \|\| \(busy && !today\)\) \{', '  // HASSOUN_RESUME_RENDER_GATE_V3\n  if (!resumeStateReady || !runtimeNavRestored || (busy && !today)) {', app, count=1)
        replaced = n == 1
    if not replaced:
        # Ground-zero Home variants can have no startup gate at all. Insert a minimal gate
        # immediately before screen JSX declarations, after all hooks have already run.
        marker = '  const homeScreen = ('
        pos = app.find(marker)
        if pos < 0:
            raise SystemExit("Could not locate Home screen declaration for resume gate")
        gate = '''  // HASSOUN_RESUME_RENDER_GATE_V3
  if (!resumeStateReady) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#f7f8f4" }}>
        <ActivityIndicator color="#0b5b47" size="large" />
      </View>
    );
  }

'''
        app = app[:pos] + gate + app[pos:]

APP.write_text(app, encoding="utf-8")

checks_home = ['const active = next?.prayer === prayer;', 'NEXT • TOMORROW', 'prayerRowActive']
checks_app = ['HASSOUN_EXACT_SCREEN_RESUME_V3', 'HASSOUN_RESUME_RENDER_GATE_V3', 'resumeStateReady', 'activeTabRef.current = activeTab', 'hassoun:resume-exact-screen:v1']
for needle in checks_home:
    if needle not in HOME.read_text(encoding="utf-8"):
        raise SystemExit(f"Home highlight fix missing: {needle}")
for needle in checks_app:
    if needle not in APP.read_text(encoding="utf-8"):
        raise SystemExit(f"Resume fix missing: {needle}")
print("Applied robust next-prayer highlight and exact-screen background/process resume")
