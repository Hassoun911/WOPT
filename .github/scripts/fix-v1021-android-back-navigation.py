from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[2]
APP = ROOT / "mobile/App.tsx"
SETTINGS = ROOT / "mobile/src/SettingsHub.tsx"

# ---------------- App-level Android back behavior ----------------
app = APP.read_text(encoding="utf-8")

if "BackHandler" not in app:
    app, count = re.subn(r'(\bAppState,\s*\n\s*)', r'\1BackHandler,\n  ', app, count=1)
    if count != 1:
        raise SystemExit("Could not add BackHandler import to App.tsx")

app = re.sub(
    r'\n\s*// Android system back: stay inside Hassoun.*?\n\s*\}, \[activeTab\]\);\n',
    '\n',
    app,
    flags=re.S,
)

anchor = '  const upcomingIslamicDays = islamicTimeline.daysUntilNext;\n'
if anchor not in app:
    raise SystemExit("Could not find App back-handler insertion anchor")

handler = r'''

  // Android system back: stay inside Hassoun. Child screens can consume the
  // event first; otherwise any top-level app page returns to Home instead of
  // closing the Android activity.
  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      if (activeTab === "home") return false;
      setActiveTab("home");
      setQuranAppNavVisible(true);
      setQuranOwnsAudioSurface(false);
      return true;
    });
    return () => subscription.remove();
  }, [activeTab]);
'''
app = app.replace(anchor, anchor + handler, 1)

if 'BackHandler.addEventListener("hardwareBackPress"' not in app:
    raise SystemExit("App hardware back handler was not installed")
APP.write_text(app, encoding="utf-8")

# ---------------- Settings nested-page Android back behavior ----------------
settings = SETTINGS.read_text(encoding="utf-8")

if "BackHandler" not in settings:
    settings, count = re.subn(r'(\bAlert,\s*\n\s*)', r'\1BackHandler,\n  ', settings, count=1)
    if count != 1:
        raise SystemExit("Could not add BackHandler import to SettingsHub.tsx")

settings = re.sub(
    r'\n\s*// Android system back inside Settings.*?\n\s*\}, \[page, readerOpen\]\);\n',
    '\n',
    settings,
    flags=re.S,
)

state_anchor = '  const [readerOpen, setReaderOpen] = useState(false);\n'
if state_anchor not in settings:
    raise SystemExit("Could not find Settings back-handler insertion anchor")

settings_handler = r'''

  // Android system back inside Settings follows the same hierarchy as the
  // visible back buttons instead of allowing Android to exit the app.
  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      if (readerOpen) {
        setReaderOpen(false);
        return true;
      }
      if (page === "connectDisplay") {
        setPage("displays");
        return true;
      }
      if (page !== "root") {
        setPage("root");
        return true;
      }
      return false;
    });
    return () => subscription.remove();
  }, [page, readerOpen]);
'''
settings = settings.replace(state_anchor, state_anchor + settings_handler, 1)

required = [
    'BackHandler.addEventListener("hardwareBackPress"',
    'page === "connectDisplay"',
    'setPage("displays")',
    'if (page !== "root")',
]
for item in required:
    if item not in settings:
        raise SystemExit("Missing Settings Android-back behavior: " + item)

if 'page === "masjidDisplay"' in settings:
    raise SystemExit("Obsolete masjidDisplay back route still present")

SETTINGS.write_text(settings, encoding="utf-8")
print("Android back now navigates within Hassoun instead of exiting from child pages")
