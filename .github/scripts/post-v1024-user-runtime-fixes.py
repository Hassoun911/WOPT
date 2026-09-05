from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[2]
APP = ROOT / "mobile/App.tsx"
PAIR = ROOT / "mobile/src/ConnectDisplayPage.tsx"

# --- Camera permission flow -------------------------------------------------
pair = PAIR.read_text(encoding="utf-8")
pair = pair.replace('import { CameraView, useCameraPermissions } from "expo-camera";', 'import { CameraView } from "expo-camera";')

if 'PermissionsAndroid' not in pair:
    pair = pair.replace(
        '  Alert,\n  Modal,',
        '  Alert,\n  AppState,\n  Modal,\n  PermissionsAndroid,\n  Platform,',
        1,
    )

pair = pair.replace('  const [permission, requestPermission] = useCameraPermissions();\n', '')

if 'CAMERA_PENDING_KEY' not in pair:
    pair = pair.replace(
        'const STORAGE_KEY = "hassoun:paired-displays:v2";\n',
        'const STORAGE_KEY = "hassoun:paired-displays:v2";\nconst CAMERA_PENDING_KEY = "hassoun:pending-display-camera:v1";\n',
        1,
    )

start = pair.find('  const openScanner = async () => {')
end = pair.find('\n  const onScanned =', start)
if start < 0 or end < 0:
    raise SystemExit('Could not locate ConnectDisplayPage openScanner')

new_scanner = '''  const openScanner = async () => {
    if (Platform.OS !== "android") {
      setScannerOpen(true);
      return;
    }
    try {
      const alreadyGranted = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.CAMERA);
      if (!alreadyGranted) {
        await AsyncStorage.setItem(CAMERA_PENDING_KEY, "1");
        const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.CAMERA, {
          title: t("Camera permission", "إذن الكاميرا"),
          message: t("Hassoun uses the camera only to scan the Masjid display QR pairing code.", "يستخدم Hassoun الكاميرا فقط لمسح رمز QR لربط شاشة المسجد."),
          buttonPositive: t("Allow", "سماح"),
          buttonNegative: t("Not now", "ليس الآن")
        });
        if (result !== PermissionsAndroid.RESULTS.GRANTED) {
          await AsyncStorage.removeItem(CAMERA_PENDING_KEY);
          Alert.alert(t("Camera permission needed", "مطلوب إذن الكاميرا"), t("You can still enter the 6-digit code manually, or allow Camera and try again.", "يمكنك إدخال الرمز المكوّن من 6 أرقام يدويًا أو السماح للكاميرا والمحاولة مرة أخرى."));
          return;
        }
        setMessage(t("Camera allowed. Opening scanner…", "تم السماح للكاميرا. جارٍ فتح الماسح…"));
        setTimeout(() => {
          if (AppState.currentState === "active") {
            void AsyncStorage.removeItem(CAMERA_PENDING_KEY);
            setScannerOpen(true);
          }
        }, 900);
        return;
      }
      await AsyncStorage.removeItem(CAMERA_PENDING_KEY);
      setScannerOpen(true);
    } catch {
      await AsyncStorage.removeItem(CAMERA_PENDING_KEY).catch(() => undefined);
      Alert.alert(t("Camera unavailable", "الكاميرا غير متاحة"), t("Enter the 6-digit pairing code manually, or try the scanner again.", "أدخل رمز الربط المكوّن من 6 أرقام يدويًا أو حاول المسح مرة أخرى."));
    }
  };
'''
pair = pair[:start] + new_scanner + pair[end:]

valid_anchor = '  const valid = useMemo(() => /^\\d{6}$/.test(code), [code]);\n'
if valid_anchor not in pair:
    raise SystemExit('Could not locate pairing valid-code anchor')

if 'finishPendingCameraScan' not in pair:
    scan_effect = '''

  useEffect(() => {
    let alive = true;
    const finishPendingCameraScan = async () => {
      if (Platform.OS !== "android") return;
      const pending = await AsyncStorage.getItem(CAMERA_PENDING_KEY);
      if (!pending) return;
      const granted = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.CAMERA);
      if (!granted || !alive) return;
      await AsyncStorage.removeItem(CAMERA_PENDING_KEY);
      setTimeout(() => {
        if (alive && AppState.currentState === "active") setScannerOpen(true);
      }, 700);
    };
    void finishPendingCameraScan();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void finishPendingCameraScan();
    });
    return () => { alive = false; subscription.remove(); };
  }, []);
'''
    pair = pair.replace(valid_anchor, valid_anchor + scan_effect, 1)

PAIR.write_text(pair, encoding="utf-8")

# --- Exact alarm permission + compact Home refresh -------------------------
app = APP.read_text(encoding="utf-8")

# Normalize prayer-audio import to include permission state helper.
for old in [
    'import { cancelAndroidPrayerAudio, openExactAlarmSettings, scheduleAndroidTestAdhan, stopAndroidPrayerAudioPlayback } from "./src/prayerAudio";',
    'import { cancelAndroidPrayerAudio, openExactAlarmSettings, scheduleAndroidPrayerAudio, scheduleAndroidTestAdhan, stopAndroidPrayerAudioPlayback } from "./src/prayerAudio";',
]:
    if old in app:
        replacement = old.replace('cancelAndroidPrayerAudio, ', 'cancelAndroidPrayerAudio, canScheduleAndroidExactAlarms, ')
        app = app.replace(old, replacement, 1)
        break
if 'canScheduleAndroidExactAlarms' not in app:
    raise SystemExit('Could not add exact alarm permission import')

state_anchor = '  const [lastHomeRefreshAt, setLastHomeRefreshAt] = useState<Date | null>(null);'
if state_anchor not in app:
    state_anchor = '  const [startupAudioCleared, setStartupAudioCleared] = useState(false);'
if state_anchor not in app:
    raise SystemExit('Could not locate state anchor for exact alarm permission')
if 'const [exactAlarmAllowed, setExactAlarmAllowed]' not in app:
    app = app.replace(
        state_anchor,
        state_anchor + '\n  const [exactAlarmAllowed, setExactAlarmAllowed] = useState(() => canScheduleAndroidExactAlarms());',
        1,
    )

# Keep this re-check intentionally side-effect-light: normal scheduling code already
# rebuilds prayer alarms when alerts/settings change. We only need to reflect Android's
# protected switch immediately when the user returns.
if 'refreshExactAlarmPermission' not in app:
    anchor = '  const toggleLocale = async () => {'
    pos = app.find(anchor)
    if pos < 0:
        raise SystemExit('Could not locate toggleLocale anchor')
    block = '''  const refreshExactAlarmPermission = useCallback(() => {
    setExactAlarmAllowed(canScheduleAndroidExactAlarms());
  }, []);

  useEffect(() => {
    refreshExactAlarmPermission();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") setTimeout(refreshExactAlarmPermission, 350);
    });
    return () => subscription.remove();
  }, [refreshExactAlarmPermission]);

'''
    app = app[:pos] + block + app[pos:]

if 'ALARMS & REMINDERS PERMISSION' not in app:
    alerts_pos = app.find('  const alertsScreen = (')
    if alerts_pos < 0:
        raise SystemExit('Alerts screen not found')
    insert_marker = '      <View style={styles.alertPreferenceCard}>'
    insert_pos = app.find(insert_marker, alerts_pos)
    if insert_pos < 0:
        raise SystemExit('Could not locate Alerts card insertion point')
    permission_card = '''      <Pressable onPress={() => { openExactAlarmSettings(); }} style={styles.emailCard}>
        <View style={styles.emailIcon}><Text style={styles.emailEmoji}>⏰</Text></View>
        <View style={styles.settingCopy}>
          <Text style={styles.alertMasterEyebrow}>{locale === "ar" ? "إذن المنبهات والتذكيرات" : "ALARMS & REMINDERS PERMISSION"}</Text>
          <Text style={styles.settingTitle}>{exactAlarmAllowed ? (locale === "ar" ? "مسموح" : "Allowed") : (locale === "ar" ? "مطلوب للأذان في الوقت المحدد" : "Required for exact-time Adhan")}</Text>
          <Text style={styles.settingText}>{exactAlarmAllowed ? (locale === "ar" ? "يمكن لـ Hassoun تشغيل الأذان في وقت الصلاة المحدد." : "Hassoun can schedule the full Adhan at the exact prayer time.") : (locale === "ar" ? "اضغط هنا، ثم فعّل مفتاح السماح في شاشة أندرويد. يتطلب أندرويد منك تشغيل هذا المفتاح بنفسك." : "Tap here, then turn on Allow permission in Android. Android requires you to switch this protected setting on yourself.")}</Text>
        </View>
        <Text style={[styles.settingArrow, { color: exactAlarmAllowed ? "#0b654f" : "#b27a23" }]}>{exactAlarmAllowed ? "✓" : "›"}</Text>
      </Pressable>

'''
    app = app[:insert_pos] + permission_card + app[insert_pos:]

# Remove the giant v1.0.23 full-width refresh button if present.
app = re.sub(
    r'\n\s*<Pressable\n\s*onPress=\{\(\) => void refreshHome\(\)\}\n\s*disabled=\{refreshingHome\}.*?REFRESH LOCATION.*?</Pressable>\n',
    '\n',
    app,
    count=1,
    flags=re.S,
)

# Add a compact refresh icon beside AR/EN in the shared Home header.
if 'accessibilityLabel={locale === "ar" ? "تحديث الموقع" : "Refresh location"}' not in app:
    lang_anchor = '      <Pressable onPress={toggleLocale} style={styles.languageButton}>'
    if lang_anchor not in app:
        raise SystemExit('Could not locate AR/EN language button')
    compact = '''      <Pressable
        onPress={() => void refreshHome()}
        disabled={refreshingHome}
        accessibilityRole="button"
        accessibilityLabel={locale === "ar" ? "تحديث الموقع" : "Refresh location"}
        style={{ width: 48, height: 48, marginRight: 8, borderRadius: 16, borderWidth: 1, borderColor: "#d8d4c9", backgroundColor: "#fffdf8", alignItems: "center", justifyContent: "center", opacity: refreshingHome ? 0.6 : 1 }}
      >
        {refreshingHome ? <ActivityIndicator size="small" color="#0b5b47" /> : <Text style={{ color: "#0b5b47", fontSize: 25, fontWeight: "900" }}>↻</Text>}
      </Pressable>
'''
    app = app.replace(lang_anchor, compact + lang_anchor, 1)

APP.write_text(app, encoding="utf-8")

checks = {
    PAIR: ['PermissionsAndroid.PERMISSIONS.CAMERA', 'CAMERA_PENDING_KEY', 'finishPendingCameraScan', 'Camera allowed. Opening scanner'],
    APP: ['exactAlarmAllowed', 'ALARMS & REMINDERS PERMISSION', 'Refresh location', 'onRefresh={() => { void refreshHome(); }}'],
}
for path, needles in checks.items():
    text = path.read_text(encoding='utf-8')
    for needle in needles:
        if needle not in text:
            raise SystemExit(f'Post-fix missing {needle!r} in {path}')

print('Applied stable QR permission recovery, exact-alarm status UX, and compact Home refresh icon')
