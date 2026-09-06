from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[2]
APP = ROOT / "mobile/App.tsx"
AUDIO = ROOT / "mobile/src/prayerAudio.ts"

# Never launch Android special-access Settings from module import. App.tsx owns the
# visible user-facing permission flow so users understand why Android Settings opens.
audio = AUDIO.read_text(encoding="utf-8")
audio = re.sub(r'\nlet exactAlarmSetupStarted = false;.*?\nstartFirstLaunchExactAlarmSetup\(\);\n', '\n', audio, flags=re.S)
if 'startFirstLaunchExactAlarmSetup()' in audio or 'exactAlarmSettingsOpenedThisSession' in audio:
    raise SystemExit('Automatic exact-alarm settings launcher still exists')
AUDIO.write_text(audio, encoding='utf-8')

app = APP.read_text(encoding="utf-8")

m = re.search(r'import \{([^}]*)\} from "\./src/prayerAudio";', app)
if not m:
    raise SystemExit('prayerAudio import missing')
parts = [p.strip() for p in m.group(1).split(',') if p.strip()]
for name in ('canScheduleAndroidExactAlarms', 'openExactAlarmSettings'):
    if name not in parts:
        parts.append(name)
app = app[:m.start()] + 'import { ' + ', '.join(parts) + ' } from "./src/prayerAudio";' + app[m.end():]

start = app.find('  const refreshExactAlarmPermissionState = useCallback(() => {')
if start >= 0:
    end = app.find('  const toggleLocale = async () => {', start)
    if end < 0:
        raise SystemExit('Could not find exact-alarm effect end')
    app = app[:start] + app[end:]

anchor = '  const toggleLocale = async () => {'
pos = app.find(anchor)
if pos < 0:
    raise SystemExit('toggleLocale anchor missing')

block = '''  // HASSOUN_EXACT_ALARM_PERMISSION_V4
  const exactAlarmPromptShownRef = useRef(false);

  const refreshExactAlarmPermissionState = useCallback(() => {
    setExactAlarmAllowed(canScheduleAndroidExactAlarms());
  }, []);

  const showExactAlarmPermissionPrompt = useCallback(() => {
    if (exactAlarmPromptShownRef.current || canScheduleAndroidExactAlarms()) return;
    exactAlarmPromptShownRef.current = true;
    Alert.alert(
      locale === "ar" ? "السماح بالمنبهات والتذكيرات" : "Allow Alarms & reminders",
      locale === "ar"
        ? "يحتاج حسّون إلى إذن المنبهات والتذكيرات من أندرويد لكي يبدأ الأذان والتنبيهات الدقيقة في وقتها حتى إذا كان التطبيق في الخلفية. اضغط السماح الآن ثم فعّل حسّون في شاشة أندرويد."
        : "Hassoun needs Android Alarms & reminders access so exact prayer alerts and Adhan can start on time even while the app is in the background. Tap Allow now, then enable Hassoun on the Android screen.",
      [
        {
          text: locale === "ar" ? "ليس الآن" : "Not now",
          style: "cancel",
          onPress: () => { exactAlarmPromptShownRef.current = false; }
        },
        {
          text: locale === "ar" ? "السماح الآن" : "Allow now",
          onPress: () => { openExactAlarmSettings(); }
        }
      ]
    );
  }, [locale]);

  useEffect(() => {
    refreshExactAlarmPermissionState();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        setTimeout(() => {
          const allowed = canScheduleAndroidExactAlarms();
          setExactAlarmAllowed(allowed);
          if (!allowed) {
            exactAlarmPromptShownRef.current = false;
            setTimeout(showExactAlarmPermissionPrompt, 500);
          }
        }, 350);
      }
    });
    return () => subscription.remove();
  }, [refreshExactAlarmPermissionState, showExactAlarmPermissionPrompt]);

  // Fresh installs must always get a visible prompt if Android special access is
  // missing. Do not depend on startupAudioCleared or persisted storage flags because
  // those can suppress the permission request forever on affected devices.
  useEffect(() => {
    if (exactAlarmAllowed || AppState.currentState !== "active") return;
    const timer = setTimeout(showExactAlarmPermissionPrompt, 900);
    return () => clearTimeout(timer);
  }, [exactAlarmAllowed, showExactAlarmPermissionPrompt]);

'''
app = app[:pos] + block + app[pos:]

needle = '      if (!result.exactAlarmGranted && PRAYER_KEYS.some((prayer) => preferences[prayer].athan)) {'
if needle not in app:
    raise SystemExit('Exact-alarm alert recovery path missing from toggleAlerts')

APP.write_text(app, encoding='utf-8')

for needle in [
    'HASSOUN_EXACT_ALARM_PERMISSION_V4',
    'Allow Alarms & reminders',
    'Allow now',
    'showExactAlarmPermissionPrompt',
    'openExactAlarmSettings()',
    'exactAlarmPromptShownRef',
]:
    if needle not in APP.read_text(encoding='utf-8'):
        raise SystemExit(f'Missing exact alarm permission flow: {needle}')
if 'startupAudioCleared || exactAlarmAllowed' in APP.read_text(encoding='utf-8'):
    raise SystemExit('Permission prompt is still incorrectly gated by startup audio')
if 'hassoun:exact-alarm-permission-prompt:v3' in APP.read_text(encoding='utf-8'):
    raise SystemExit('Persisted v3 prompt suppression still exists')
if 'startFirstLaunchExactAlarmSetup()' in AUDIO.read_text(encoding='utf-8'):
    raise SystemExit('Automatic special-access launcher remains')
print('Installed forced visible Alarms & reminders permission prompt with Android Settings handoff')
