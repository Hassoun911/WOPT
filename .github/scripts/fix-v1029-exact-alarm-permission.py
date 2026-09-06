from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[2]
APP = ROOT / "mobile/App.tsx"
AUDIO = ROOT / "mobile/src/prayerAudio.ts"

# Do not launch Android special-access Settings from module import. That can look like
# a restart and bypasses the explanatory prompt. App.tsx owns the user-facing flow.
audio = AUDIO.read_text(encoding="utf-8")
audio = re.sub(r'\nlet exactAlarmSetupStarted = false;.*?\nstartFirstLaunchExactAlarmSetup\(\);\n', '\n', audio, flags=re.S)
if 'startFirstLaunchExactAlarmSetup()' in audio or 'exactAlarmSettingsOpenedThisSession' in audio:
    raise SystemExit('Automatic exact-alarm settings launcher still exists')
AUDIO.write_text(audio, encoding='utf-8')

app = APP.read_text(encoding="utf-8")

# Ensure the exact alarm helpers are imported.
m = re.search(r'import \{([^}]*)\} from "\./src/prayerAudio";', app)
if not m:
    raise SystemExit('prayerAudio import missing')
parts = [p.strip() for p in m.group(1).split(',') if p.strip()]
for name in ('canScheduleAndroidExactAlarms', 'openExactAlarmSettings'):
    if name not in parts: parts.append(name)
app = app[:m.start()] + 'import { ' + ', '.join(parts) + ' } from "./src/prayerAudio";' + app[m.end():]

# Replace any prior exact-alarm prompt effect with a deterministic v3 flow.
start = app.find('  const refreshExactAlarmPermissionState = useCallback(() => {')
if start >= 0:
    end = app.find('  const toggleLocale = async () => {', start)
    if end < 0: raise SystemExit('Could not find exact-alarm effect end')
    app = app[:start] + app[end:]

anchor = '  const toggleLocale = async () => {'
pos = app.find(anchor)
if pos < 0: raise SystemExit('toggleLocale anchor missing')
block = '''  // HASSOUN_EXACT_ALARM_PERMISSION_V3
  const refreshExactAlarmPermissionState = useCallback(() => {
    setExactAlarmAllowed(canScheduleAndroidExactAlarms());
  }, []);

  useEffect(() => {
    refreshExactAlarmPermissionState();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") setTimeout(refreshExactAlarmPermissionState, 350);
    });
    return () => subscription.remove();
  }, [refreshExactAlarmPermissionState]);

  useEffect(() => {
    if (!startupAudioCleared || exactAlarmAllowed || AppState.currentState !== "active") return;
    let cancelled = false;
    const promptKey = "hassoun:exact-alarm-permission-prompt:v3";
    void AsyncStorage.getItem(promptKey).then((shown) => {
      if (cancelled || shown === "enabled" || canScheduleAndroidExactAlarms()) return;
      setTimeout(() => {
        if (cancelled || AppState.currentState !== "active" || canScheduleAndroidExactAlarms()) return;
        Alert.alert(
          locale === "ar" ? "السماح بالمنبهات والتذكيرات" : "Allow Alarms & reminders",
          locale === "ar"
            ? "يحتاج حسّون إلى إذن المنبهات والتذكيرات من أندرويد لكي يبدأ الأذان والتنبيهات الدقيقة في وقتها حتى إذا كان التطبيق في الخلفية."
            : "Hassoun needs Android Alarms & reminders access so exact prayer alerts and Adhan can start on time even while the app is in the background.",
          [
            {
              text: locale === "ar" ? "ليس الآن" : "Not now",
              style: "cancel",
              onPress: () => { void AsyncStorage.setItem(promptKey, "later"); }
            },
            {
              text: locale === "ar" ? "السماح الآن" : "Allow now",
              onPress: () => {
                void AsyncStorage.setItem(promptKey, "opened");
                openExactAlarmSettings();
              }
            }
          ]
        );
      }, 1200);
    });
    return () => { cancelled = true; };
  }, [exactAlarmAllowed, locale, startupAudioCleared]);

  useEffect(() => {
    if (!exactAlarmAllowed) return;
    void AsyncStorage.setItem("hassoun:exact-alarm-permission-prompt:v3", "enabled").catch(() => undefined);
  }, [exactAlarmAllowed]);

'''
app = app[:pos] + block + app[pos:]

# When the user explicitly enables prayer alerts, give an immediate recovery path if
# exact alarm access is still missing. This is separate from the first-launch prompt.
needle = '      if (!result.exactAlarmGranted && PRAYER_KEYS.some((prayer) => preferences[prayer].athan)) {'
if needle in app:
    # Existing alert is already appropriate; keep it.
    pass
else:
    raise SystemExit('Exact-alarm alert recovery path missing from toggleAlerts')

APP.write_text(app, encoding='utf-8')

for needle in ['HASSOUN_EXACT_ALARM_PERMISSION_V3','Allow Alarms & reminders','Allow now','hassoun:exact-alarm-permission-prompt:v3','openExactAlarmSettings()']:
    if needle not in APP.read_text(encoding='utf-8'):
        raise SystemExit(f'Missing exact alarm permission flow: {needle}')
if 'startFirstLaunchExactAlarmSetup()' in AUDIO.read_text(encoding='utf-8'):
    raise SystemExit('Automatic special-access launcher remains')
print('Installed reliable Alarms & reminders permission prompt and removed silent auto-launch')
