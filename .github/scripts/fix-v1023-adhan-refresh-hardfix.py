from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[2]
APP = ROOT / "mobile/App.tsx"
PRAYER_AUDIO = ROOT / "mobile/src/prayerAudio.ts"
CONFIG = ROOT / "mobile/app.config.ts"

app = APP.read_text(encoding="utf-8")
pa = PRAYER_AUDIO.read_text(encoding="utf-8")
cfg = CONFIG.read_text(encoding="utf-8")

# HARD FIX 1: Never restore or request exact alarms merely because the module/app opened.
# Old persisted alarm metadata can otherwise resurrect a stale Fajr alarm after cold start.
pa = re.sub(
    r'\nfunction startFirstLaunchExactAlarmSetup\(\) \{.*?\n\}\n\n(?:startFirstLaunchExactAlarmSetup\(\);|// v1\.0\.22:[^\n]*)\n',
    '\n// v1.0.23: no automatic alarm restoration/setup on module import.\n// Exact-alarm access is user-driven and current alarms are rebuilt only by scheduleAndroidPrayerAudio().\n',
    pa,
    flags=re.S,
)
pa = pa.replace('startFirstLaunchExactAlarmSetup();', '// v1.0.23: disabled automatic exact-alarm restoration on app/module startup.')

# The v1.0.22 build may already have replaced only the call while leaving the helper/listener.
# Remove the helper regardless so no AppState listener can restore persisted alarms later.
pa = re.sub(
    r'\nfunction startFirstLaunchExactAlarmSetup\(\) \{.*?\n\}\n',
    '\n// v1.0.23: automatic first-launch exact-alarm setup removed.\n',
    pa,
    flags=re.S,
)

# Remove now-unused setup state and helper that restored old persisted alarms.
pa = re.sub(r'\nlet exactAlarmSetupStarted = false;\n', '\n', pa)
pa = re.sub(r'\nlet exactAlarmSettingsOpenedThisSession = false;\n', '\n', pa)
pa = re.sub(
    r'\nasync function restoreExactAlarmsIfAvailable\(\) \{.*?\n\}\n',
    '\n', pa, flags=re.S
)
pa = re.sub(
    r'\nasync function requestExactAlarmAccessIfNeeded\(\) \{.*?\n\}\n',
    '\n', pa, flags=re.S
)
pa = pa.replace('import { AppState, Platform } from "react-native";', 'import { Platform } from "react-native";')
if 'automatic first-launch exact-alarm setup removed' not in pa:
    pa += '\n// v1.0.23: automatic first-launch exact-alarm setup removed.\n'

# HARD FIX 2: Stop playback + cancel old native alarms on EVERY cold app start, before
# the saved current schedule is rebuilt. One-time-per-version guards are not enough.
app = re.sub(
    r'\n\s*useEffect\(\(\) => \{\n\s*const key = "hassoun:v1022:first-launch-audio-guard";.*?\n\s*\}, \[\]\);',
    '', app, flags=re.S
)

# Ensure required imports from prayerAudio are present.
for old in [
    'import { openExactAlarmSettings, scheduleAndroidPrayerAudio, scheduleAndroidTestAdhan } from "./src/prayerAudio";',
    'import { openExactAlarmSettings, scheduleAndroidTestAdhan } from "./src/prayerAudio";'
]:
    if old in app:
        app = app.replace(old, 'import { cancelAndroidPrayerAudio, openExactAlarmSettings, scheduleAndroidTestAdhan, stopAndroidPrayerAudioPlayback } from "./src/prayerAudio";', 1)

if 'stopAndroidPrayerAudioPlayback' not in app or 'cancelAndroidPrayerAudio' not in app:
    raise SystemExit('v1.0.23 could not install prayer-audio startup imports')

# Insert a startup-ready gate. The normal app initialization waits until native stale audio
# and alarms are cleared, preventing a race where a stale Fajr alarm fires during startup.
state_anchor = '  const [refreshingHome, setRefreshingHome] = useState(false);'
if state_anchor not in app:
    raise SystemExit('refreshingHome state anchor missing')
if 'const [startupAudioCleared, setStartupAudioCleared]' not in app:
    app = app.replace(state_anchor, state_anchor + '\n  const [startupAudioCleared, setStartupAudioCleared] = useState(false);', 1)

startup_effect = '''\n\n  useEffect(() => {\n    let mounted = true;\n    void (async () => {\n      await stopAndroidPrayerAudioPlayback().catch(() => undefined);\n      await cancelAndroidPrayerAudio().catch(() => undefined);\n      if (mounted) setStartupAudioCleared(true);\n    })();\n    return () => { mounted = false; };\n  }, []);'''

first_effect = app.find('  useEffect(() => {')
if first_effect < 0:
    raise SystemExit('could not find first App effect')
if 'setStartupAudioCleared(true)' not in app:
    app = app[:first_effect] + startup_effect + '\n\n' + app[first_effect:]

# Gate the main initialization effect so saved alerts are not rebuilt until cleanup completed.
init_marker = 'const [savedLocale, savedAlerts'
init_at = app.find(init_marker)
if init_at < 0:
    raise SystemExit('main initialization effect not found')
effect_start = app.rfind('  useEffect(() => {', 0, init_at)
effect_end = app.find('  }, []);', init_at)
if effect_start < 0 or effect_end < 0:
    raise SystemExit('could not bound main initialization effect')
effect_end += len('  }, []);')
init_block = app[effect_start:effect_end]
if 'if (!startupAudioCleared) return;' not in init_block:
    init_block = init_block.replace('  useEffect(() => {', '  useEffect(() => {\n    if (!startupAudioCleared) return;', 1)
init_block = init_block[:-len('[]);')] + '[startupAudioCleared]);'
app = app[:effect_start] + init_block + app[effect_end:]

# HARD FIX 3: Make Home refresh usable both by pull gesture and an explicit button.
app = app.replace('progressViewOffset={64}', 'progressViewOffset={96}')
app = app.replace('progressViewOffset={8}', 'progressViewOffset={96}')
app = app.replace(
    'contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}',
    'contentContainerStyle={[styles.content, { flexGrow: 1 }]} showsVerticalScrollIndicator={false}',
    1,
)

if 'REFRESH LOCATION' not in app:
    anchor = '''      {refreshingHome ? (\n        <View style={{ marginHorizontal: 16, marginBottom: 10, borderRadius: 14, paddingVertical: 10, paddingHorizontal: 14, backgroundColor: "#eef7f3", flexDirection: "row", alignItems: "center", gap: 10 }}>\n          <ActivityIndicator size="small" />\n          <Text style={{ color: "#164c40", fontWeight: "800" }}>{locale === "ar" ? "جارٍ تحديث الموقع ومواقيت الصلاة…" : "Refreshing location & prayer times…"}</Text>\n        </View>\n      ) : null}\n'''
    if anchor not in app:
        raise SystemExit('v1.0.22 refresh progress anchor missing')
    button = anchor + '''      <Pressable\n        onPress={() => void refreshHome()}\n        disabled={refreshingHome}\n        style={{ marginHorizontal: 16, marginBottom: 10, borderRadius: 14, paddingVertical: 11, paddingHorizontal: 14, backgroundColor: refreshingHome ? "#dfe7e4" : "#0b5b47", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }}\n      >\n        {refreshingHome ? <ActivityIndicator size="small" color="#ffffff" /> : <Text style={{ color: "#ffffff", fontSize: 16 }}>↻</Text>}\n        <Text style={{ color: "#ffffff", fontWeight: "900", letterSpacing: 0.4 }}>{locale === "ar" ? "تحديث الموقع" : "REFRESH LOCATION"}</Text>\n      </Pressable>\n'''
    app = app.replace(anchor, button, 1)

cfg = re.sub(r'version:\s*(?:process\.env\.EXPO_APP_VERSION\s*\|\|\s*)?"[^"]+"', 'version: process.env.EXPO_APP_VERSION || "1.0.23"', cfg, count=1)
cfg = re.sub(r'versionCode:\s*\d+', 'versionCode: 67', cfg, count=1)

APP.write_text(app, encoding='utf-8')
PRAYER_AUDIO.write_text(pa, encoding='utf-8')
CONFIG.write_text(cfg, encoding='utf-8')

checks = {
    APP: [
        'startupAudioCleared',
        'stopAndroidPrayerAudioPlayback()',
        'cancelAndroidPrayerAudio()',
        'if (!startupAudioCleared) return;',
        'onRefresh={refreshHome}',
        'progressViewOffset={96}',
        'REFRESH LOCATION',
        'onPress={() => void refreshHome()}',
        'flexGrow: 1',
    ],
    PRAYER_AUDIO: [
        'automatic first-launch exact-alarm setup removed',
        'scheduleAndroidPrayerAudio',
    ],
    CONFIG: ['1.0.23', 'versionCode: 67'],
}
for path, needles in checks.items():
    text = path.read_text(encoding='utf-8')
    for needle in needles:
        if needle not in text:
            raise SystemExit(f'Missing {needle!r} in {path}')

for forbidden in ('startFirstLaunchExactAlarmSetup()', 'restoreExactPrayerAlarms()'):
    if forbidden in pa:
        raise SystemExit(f'Forbidden automatic stale-alarm restoration remains: {forbidden}')

print('Applied v1.0.23 hard fix: no stale Adhan restoration, startup cleanup gate, reliable Home refresh + button')
