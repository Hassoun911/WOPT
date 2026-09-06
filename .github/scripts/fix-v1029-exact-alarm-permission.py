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

# The canonical v1.0.23 stack expects this helper in App.tsx. Re-add it after the
# canonical prayerAudio.ts restore so Metro/TypeScript cannot fail on the import.
if 'export async function stopAndroidPrayerAudioPlayback()' not in audio:
    audio += '''\n\nexport async function stopAndroidPrayerAudioPlayback() {\n  if (Platform.OS === "android" && PrayerAudio) {\n    await PrayerAudio.stopPrayerAudioPlayback();\n  }\n}\n'''
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

# Make this patch idempotent. The canonical aggregator already runs this script once,
# and the v1.0.29 workflow runs it once more. Remove the complete V4 block first so a
# second application never redeclares exactAlarmPromptShownRef.
app = re.sub(
    r'\n  // HASSOUN_EXACT_ALARM_PERMISSION_V4\n.*?(?=\n  const toggleLocale = async \(\) => \{)',
    '\n',
    app,
    flags=re.S,
)

# Remove older exact-alarm permission effects that may exist on the reconstructed base.
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

final_app = APP.read_text(encoding='utf-8')
final_audio = AUDIO.read_text(encoding='utf-8')
for needle in [
    'HASSOUN_EXACT_ALARM_PERMISSION_V4',
    'Allow Alarms & reminders',
    'Allow now',
    'showExactAlarmPermissionPrompt',
    'openExactAlarmSettings()',
    'exactAlarmPromptShownRef',
]:
    if needle not in final_app:
        raise SystemExit(f'Missing exact alarm permission flow: {needle}')
if final_app.count('const exactAlarmPromptShownRef = useRef(false);') != 1:
    raise SystemExit('exactAlarmPromptShownRef must be declared exactly once')
if 'startupAudioCleared || exactAlarmAllowed' in final_app:
    raise SystemExit('Permission prompt is still incorrectly gated by startup audio')
if 'hassoun:exact-alarm-permission-prompt:v3' in final_app:
    raise SystemExit('Persisted v3 prompt suppression still exists')
if 'startFirstLaunchExactAlarmSetup()' in final_audio:
    raise SystemExit('Automatic special-access launcher remains')
if 'export async function stopAndroidPrayerAudioPlayback()' not in final_audio:
    raise SystemExit('Prayer audio stop helper missing after canonical restore')
print('Installed idempotent Alarms & reminders prompt and restored prayer-audio stop helper')
