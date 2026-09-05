from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[2]
APP = ROOT / "mobile/App.tsx"
PAIR = ROOT / "mobile/src/ConnectDisplayPage.tsx"
PRAYER_AUDIO = ROOT / "mobile/src/prayerAudio.ts"
NATIVE_INDEX = ROOT / "mobile/modules/prayer-audio/index.ts"
NATIVE_MODULE = ROOT / "mobile/modules/prayer-audio/android/src/main/java/ca/wopt/prayeraudio/PrayerAudioModule.kt"
CONFIG = ROOT / "mobile/app.config.ts"

# 1) QR permission: do not mount CameraView in the same frame as Android's permission
# activity returns. Some devices recreate/pause the React activity at that moment.
pair = PAIR.read_text(encoding="utf-8")
old = '''  const openScanner = async () => {\n    if (!permission?.granted) {\n      const result = await requestPermission();\n      if (!result.granted) {\n        Alert.alert(t("Camera permission needed", "مطلوب إذن الكاميرا"), t("Allow camera access to scan the display QR code.", "اسمح بالوصول إلى الكاميرا لمسح رمز QR الخاص بالشاشة."));\n        return;\n      }\n    }\n    setScannerOpen(true);\n  };'''
new = '''  const openScanner = async () => {\n    if (!permission?.granted) {\n      const result = await requestPermission();\n      if (!result.granted) {\n        Alert.alert(t("Camera permission needed", "مطلوب إذن الكاميرا"), t("Allow camera access to scan the display QR code.", "اسمح بالوصول إلى الكاميرا لمسح رمز QR الخاص بالشاشة."));\n        return;\n      }\n      // Android can briefly pause/recreate the Activity when camera permission is granted.\n      // Do not mount CameraView during that transition. The next tap opens it safely.\n      setMessage(t("Camera access is ready. Tap Scan QR code again.", "تم تفعيل الكاميرا. اضغط مسح رمز QR مرة أخرى."));\n      return;\n    }\n    setScannerOpen(true);\n  };'''
if old not in pair:
    raise SystemExit("Could not patch QR permission flow")
pair = pair.replace(old, new, 1)
PAIR.write_text(pair, encoding="utf-8")

# 2) Add a native stop command so a stale alarm/service from an older install/build
# can never keep playing when the new app is first opened.
idx = NATIVE_INDEX.read_text(encoding="utf-8")
if 'stopPrayerAudioPlayback(): Promise<void>;' not in idx:
    idx = idx.replace('  cancelExactPrayerAlarms(): Promise<void>;\n', '  cancelExactPrayerAlarms(): Promise<void>;\n  stopPrayerAudioPlayback(): Promise<void>;\n', 1)
NATIVE_INDEX.write_text(idx, encoding="utf-8")

native = NATIVE_MODULE.read_text(encoding="utf-8")
if 'import android.content.Intent' not in native:
    native = native.replace('package ca.wopt.prayeraudio\n', 'package ca.wopt.prayeraudio\n\nimport android.content.Intent\n', 1)
if 'AsyncFunction("stopPrayerAudioPlayback")' not in native:
    anchor = '    AsyncFunction("restoreExactPrayerAlarms") {'
    insert = '''    AsyncFunction("stopPrayerAudioPlayback") {\n      context.stopService(Intent(context, PrayerAudioService::class.java))\n    }\n\n'''
    if anchor not in native:
        raise SystemExit("Could not add native prayer-audio stop command")
    native = native.replace(anchor, insert + anchor, 1)
NATIVE_MODULE.write_text(native, encoding="utf-8")

pa = PRAYER_AUDIO.read_text(encoding="utf-8")
# First launch must never open special-access UI or restore audio by itself.
pa = pa.replace('startFirstLaunchExactAlarmSetup();', '// v1.0.22: exact-alarm setup is user-driven from Alerts; never auto-run on first launch.')
if 'export async function stopAndroidPrayerAudioPlayback()' not in pa:
    pa += '''\n\nexport async function stopAndroidPrayerAudioPlayback() {\n  if (Platform.OS === "android" && PrayerAudio) {\n    await PrayerAudio.stopPrayerAudioPlayback();\n  }\n}\n'''
PRAYER_AUDIO.write_text(pa, encoding="utf-8")

# 3) Home refresh: visible progress, bounded GPS wait, and clear error feedback.
app = APP.read_text(encoding="utf-8")
app = app.replace(
    'import { openExactAlarmSettings, scheduleAndroidPrayerAudio, scheduleAndroidTestAdhan } from "./src/prayerAudio";',
    'import { cancelAndroidPrayerAudio, openExactAlarmSettings, scheduleAndroidPrayerAudio, scheduleAndroidTestAdhan, stopAndroidPrayerAudioPlayback } from "./src/prayerAudio";'
)
app = app.replace(
    'import { openExactAlarmSettings, scheduleAndroidTestAdhan } from "./src/prayerAudio";',
    'import { cancelAndroidPrayerAudio, openExactAlarmSettings, scheduleAndroidTestAdhan, stopAndroidPrayerAudioPlayback } from "./src/prayerAudio";'
)
if 'stopAndroidPrayerAudioPlayback' not in app:
    raise SystemExit("Could not patch prayer audio imports")

# One-time per-version cold-start guard. It stops any already-running stale audio and
# removes old exact alarms before the normal current schedule is rebuilt.
if 'hassoun:v1022:first-launch-audio-guard' not in app:
    anchor = '  const [refreshingHome, setRefreshingHome] = useState(false);'
    if anchor not in app:
        raise SystemExit("Could not find refresh state anchor for first-launch guard")
    guard = '''\n\n  useEffect(() => {\n    const key = "hassoun:v1022:first-launch-audio-guard";\n    void AsyncStorage.getItem(key).then(async (seen) => {\n      if (seen) return;\n      await stopAndroidPrayerAudioPlayback().catch(() => undefined);\n      await cancelAndroidPrayerAudio().catch(() => undefined);\n      await AsyncStorage.setItem(key, "1").catch(() => undefined);\n    });\n  }, []);'''
    app = app.replace(anchor, anchor + guard, 1)

# Replace the refresh implementation with one that always gives feedback and cannot hang forever.
start = app.find('  const refreshHome = useCallback')
end_marker = '  useEffect(() => {\n    if (Object.keys(prayerTimes).length) HassounWidget.syncPrayerSchedule(JSON.stringify(prayerTimes), locale);'
end = app.find(end_marker, start)
if start < 0 or end < 0:
    raise SystemExit("Could not locate generated Home refresh callback")
refresh = '''  const refreshHome = useCallback(async () => {\n    if (refreshingHome) return;\n    setRefreshingHome(true);\n    const startedAt = Date.now();\n    try {\n      setNow(new Date());\n      const refreshed = await Promise.race([\n        loadPrayerTimes({ forceLocation: true }),\n        new Promise<never>((_, reject) => setTimeout(() => reject(new Error("GPS timed out")), 12000))\n      ]);\n      const freshQuizStats = await loadQuizStats().catch(() => quizStats);\n      setPrayerTimes(refreshed.prayerTimes);\n      setPrayerLocation(refreshed.location);\n      setLive(refreshed.live);\n      setQuizStats(freshQuizStats);\n      HassounWidget.syncPrayerSchedule(JSON.stringify(refreshed.prayerTimes), locale);\n      HassounWidget.refresh();\n      if (alertsEnabled) {\n        const result = await schedulePrayerNotifications(\n          refreshed.prayerTimes,\n          locale,\n          phoneAlertPreferences,\n          { locationLabel: refreshed.location.label, timeZone: refreshed.location.timezone }\n        );\n        setScheduledCount(result.count);\n        await scheduleIslamicEventReminders(\n          windsorDateKey(new Date(), refreshed.location.timezone),\n          locale,\n          refreshed.location.timezone\n        ).catch(() => undefined);\n      }\n    } catch (error) {\n      const detail = error instanceof Error && error.message === "GPS timed out"\n        ? (locale === "ar" ? "تعذر الحصول على موقع GPS جديد خلال 12 ثانية. تأكد من تشغيل الموقع ثم اسحب للأسفل مرة أخرى." : "A fresh GPS fix was not available within 12 seconds. Make sure Location is on, then pull down again.")\n        : (locale === "ar" ? "تعذر تحديث الموقع الآن. حاول مرة أخرى." : "Location could not be refreshed right now. Please try again.");\n      Alert.alert(locale === "ar" ? "تعذر تحديث الموقع" : "Location refresh failed", detail);\n    } finally {\n      const remaining = Math.max(0, 900 - (Date.now() - startedAt));\n      if (remaining) await new Promise((resolve) => setTimeout(resolve, remaining));\n      setRefreshingHome(false);\n    }\n  }, [alertsEnabled, locale, phoneAlertPreferences, quizStats, refreshingHome]);\n\n'''
app = app[:start] + refresh + app[end:]

# Move Android's native spinner below the status bar and also show an unmistakable
# in-content progress pill when a pull refresh is active.
app = app.replace('progressViewOffset={8}', 'progressViewOffset={64}')
home_anchor = '      {header}\n'
if home_anchor not in app:
    raise SystemExit("Could not find Home header insertion point")
loading = '''      {header}\n      {refreshingHome ? (\n        <View style={{ marginHorizontal: 16, marginBottom: 10, borderRadius: 14, paddingVertical: 10, paddingHorizontal: 14, backgroundColor: "#eef7f3", flexDirection: "row", alignItems: "center", gap: 10 }}>\n          <ActivityIndicator size="small" />\n          <Text style={{ color: "#164c40", fontWeight: "800" }}>{locale === "ar" ? "جارٍ تحديث الموقع ومواقيت الصلاة…" : "Refreshing location & prayer times…"}</Text>\n        </View>\n      ) : null}\n'''
app = app.replace(home_anchor, loading, 1)
APP.write_text(app, encoding="utf-8")

# 4) New installable build number.
cfg = CONFIG.read_text(encoding="utf-8")
cfg = re.sub(r'version:\s*(?:process\.env\.EXPO_APP_VERSION\s*\|\|\s*)?"[^"]+"', 'version: process.env.EXPO_APP_VERSION || "1.0.22"', cfg, count=1)
cfg = re.sub(r'versionCode:\s*\d+', 'versionCode: 66', cfg, count=1)
CONFIG.write_text(cfg, encoding="utf-8")

required = {
    PAIR: ['Camera access is ready. Tap Scan QR code again.'],
    APP: ['hassoun:v1022:first-launch-audio-guard', 'progressViewOffset={64}', 'Refreshing location & prayer times', 'GPS timed out'],
    PRAYER_AUDIO: ['stopAndroidPrayerAudioPlayback', 'never auto-run on first launch'],
    NATIVE_INDEX: ['stopPrayerAudioPlayback(): Promise<void>'],
    NATIVE_MODULE: ['AsyncFunction("stopPrayerAudioPlayback")'],
    CONFIG: ['1.0.22', 'versionCode: 66'],
}
for path, needles in required.items():
    text = path.read_text(encoding="utf-8")
    for needle in needles:
        if needle not in text:
            raise SystemExit(f"Missing {needle!r} in {path}")

print("Applied v1.0.22 first-launch audio guard, stable camera permission flow, and visible bounded Home refresh")
