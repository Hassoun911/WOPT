from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[2]
APP = ROOT / "mobile/App.tsx"
PAIR = ROOT / "mobile/src/ConnectDisplayPage.tsx"
HUB = ROOT / "mobile/src/SettingsHub.tsx"
HOME = ROOT / "mobile/src/HomePrayerPage.tsx"

# ---------------------------------------------------------------------------
# QR scanner: use Android permission directly and mount CameraView only after
# the permission activity has fully returned to the foreground.
# ---------------------------------------------------------------------------
pair = PAIR.read_text(encoding="utf-8")
pair = pair.replace('import { CameraView, useCameraPermissions } from "expo-camera";', 'import { CameraView } from "expo-camera";')
pair = pair.replace('  const [permission, requestPermission] = useCameraPermissions();\n', '')

if 'PermissionsAndroid' not in pair:
    pair = pair.replace(
        '  Alert,\n  Modal,',
        '  Alert,\n  AppState,\n  Modal,\n  PermissionsAndroid,\n  Platform,',
        1,
    )

if 'CAMERA_PENDING_KEY' not in pair:
    pair = pair.replace(
        'const STORAGE_KEY = "hassoun:paired-displays:v2";\n',
        'const STORAGE_KEY = "hassoun:paired-displays:v2";\nconst CAMERA_PENDING_KEY = "hassoun:pending-display-camera:v2";\n',
        1,
    )

start = pair.find('  const openScanner = async () => {')
end = pair.find('\n  const onScanned =', start)
if start < 0 or end < 0:
    raise SystemExit('Could not locate ConnectDisplayPage openScanner')

scanner = '''  const openScanner = async () => {
    if (Platform.OS !== "android") {
      setScannerOpen(true);
      return;
    }
    try {
      const alreadyGranted = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.CAMERA);
      if (alreadyGranted) {
        setScannerOpen(true);
        return;
      }

      await AsyncStorage.setItem(CAMERA_PENDING_KEY, "1");
      const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.CAMERA, {
        title: t("Camera permission", "إذن الكاميرا"),
        message: t("Allow Hassoun to use the camera only to scan the Masjid display QR code.", "اسمح لحسّون باستخدام الكاميرا فقط لمسح رمز QR الخاص بشاشة المسجد."),
        buttonPositive: t("Allow", "سماح"),
        buttonNegative: t("Not now", "ليس الآن")
      });
      if (result !== PermissionsAndroid.RESULTS.GRANTED) {
        await AsyncStorage.removeItem(CAMERA_PENDING_KEY);
        Alert.alert(
          t("Camera permission needed", "مطلوب إذن الكاميرا"),
          t("You can still enter the 6-digit pairing code manually.", "يمكنك إدخال رمز الربط المكوّن من 6 أرقام يدويًا.")
        );
        return;
      }

      setMessage(t("Camera allowed. Opening scanner…", "تم السماح للكاميرا. جارٍ فتح الماسح…"));
      setTimeout(async () => {
        if (AppState.currentState !== "active") return;
        const granted = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.CAMERA);
        if (!granted) return;
        await AsyncStorage.removeItem(CAMERA_PENDING_KEY);
        setScannerOpen(true);
      }, 900);
    } catch {
      await AsyncStorage.removeItem(CAMERA_PENDING_KEY).catch(() => undefined);
      Alert.alert(
        t("Camera unavailable", "الكاميرا غير متاحة"),
        t("Use the 6-digit pairing code or try the scanner again.", "استخدم رمز الربط المكوّن من 6 أرقام أو حاول تشغيل الماسح مرة أخرى.")
      );
    }
  };
'''
pair = pair[:start] + scanner + pair[end:]

valid_anchor = '  const valid = useMemo(() => /^\\d{6}$/.test(code), [code]);\n'
if valid_anchor not in pair:
    raise SystemExit('Could not locate pairing valid-code anchor')
if 'resumePendingCameraScanner' not in pair:
    effect = '''\n  useEffect(() => {
    let alive = true;
    const resumePendingCameraScanner = async () => {
      if (Platform.OS !== "android" || AppState.currentState !== "active") return;
      const pending = await AsyncStorage.getItem(CAMERA_PENDING_KEY);
      if (!pending) return;
      const granted = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.CAMERA);
      if (!granted || !alive) return;
      await AsyncStorage.removeItem(CAMERA_PENDING_KEY);
      setTimeout(() => {
        if (alive && AppState.currentState === "active") setScannerOpen(true);
      }, 700);
    };
    void resumePendingCameraScanner();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void resumePendingCameraScanner();
    });
    return () => { alive = false; subscription.remove(); };
  }, []);\n'''
    pair = pair.replace(valid_anchor, valid_anchor + effect, 1)
PAIR.write_text(pair, encoding="utf-8")

# ---------------------------------------------------------------------------
# Home: restore the daily Qur'an + Hadith cards from the existing Hassoun daily
# content system without reintroducing any legacy Home implementation.
# ---------------------------------------------------------------------------
home = HOME.read_text(encoding="utf-8")
if 'DailyIslamicCards' not in home:
    home = home.replace(
        'import { subscribeToDailyPrayerTimes } from "./emailSignup";\n',
        'import { subscribeToDailyPrayerTimes } from "./emailSignup";\nimport DailyIslamicCards from "./DailyIslamicCards";\n',
        1,
    )
    qibla_end = '      </Pressable>\n\n      <View style={styles.dawahCard}>'
    if qibla_end not in home:
        raise SystemExit('Could not locate Home Qibla/Da’wah boundary')
    home = home.replace(
        qibla_end,
        '      </Pressable>\n\n      <DailyIslamicCards locale={locale} date={now} timeZone={zone} />\n\n      <View style={styles.dawahCard}>',
        1,
    )
HOME.write_text(home, encoding="utf-8")

# ---------------------------------------------------------------------------
# Permissions page: show live status and direct enable actions.
# ---------------------------------------------------------------------------
hub = HUB.read_text(encoding="utf-8")
if 'import PermissionsStatusPage from "./PermissionsStatusPage";' not in hub:
    import_anchor = 'import BrandMark from "./BrandMark";\n'
    if import_anchor not in hub:
        raise SystemExit('SettingsHub BrandMark import missing')
    hub = hub.replace(import_anchor, import_anchor + 'import PermissionsStatusPage from "./PermissionsStatusPage";\n', 1)

route_anchor = '  if (page === "root") return root;\n'
if route_anchor not in hub:
    raise SystemExit('SettingsHub root route missing')
if 'PermissionsStatusPage locale={locale}' not in hub:
    hub = hub.replace(
        route_anchor,
        route_anchor + '\n  if (page === "permissions") return <PermissionsStatusPage locale={locale} onBack={() => setPage("root")} />;\n',
        1,
    )
HUB.write_text(hub, encoding="utf-8")

# ---------------------------------------------------------------------------
# App runtime:
#  - explicitly ask the user to enable Android Alarms & reminders special access
#  - re-check the switch after returning from Android settings
#  - persist active tab across Activity/process recreation
#  - immediately recalculate after Prayer Calculation settings are saved
#  - never trigger GPS/network refresh merely because the app resumes
# ---------------------------------------------------------------------------
app = APP.read_text(encoding="utf-8")

# Add exact-alarm helpers to whichever prayerAudio import exists.
m = re.search(r'import \{([^}]*)\} from "\./src/prayerAudio";', app)
if not m:
    raise SystemExit('prayerAudio import missing')
parts = [part.strip() for part in m.group(1).split(',') if part.strip()]
for name in ('canScheduleAndroidExactAlarms', 'openExactAlarmSettings'):
    if name not in parts:
        parts.append(name)
app = app[:m.start()] + 'import { ' + ', '.join(parts) + ' } from "./src/prayerAudio";' + app[m.end():]

if 'subscribePrayerCalculationChanges' not in app:
    home_import = 'import HomePrayerPage from "./src/HomePrayerPage";\n'
    if home_import not in app:
        raise SystemExit('HomePrayerPage import missing')
    app = app.replace(
        home_import,
        home_import + 'import { subscribePrayerCalculationChanges } from "./src/prayerCalculationSettings";\n',
        1,
    )

state_anchor = '  const [startupAudioCleared, setStartupAudioCleared] = useState(false);'
if state_anchor not in app:
    raise SystemExit('startupAudioCleared state missing')
if 'const [exactAlarmAllowed, setExactAlarmAllowed]' not in app:
    app = app.replace(
        state_anchor,
        state_anchor + '\n  const [exactAlarmAllowed, setExactAlarmAllowed] = useState(() => canScheduleAndroidExactAlarms());',
        1,
    )

# Add a side-effect-light permission recheck. It must not load prayer data.
permission_anchor = '  const toggleLocale = async () => {'
permission_pos = app.find(permission_anchor)
if permission_pos < 0:
    raise SystemExit('toggleLocale anchor missing')
if 'refreshExactAlarmPermissionState' not in app:
    permission_effect = '''  const refreshExactAlarmPermissionState = useCallback(() => {
    setExactAlarmAllowed(canScheduleAndroidExactAlarms());
  }, []);

  useEffect(() => {
    refreshExactAlarmPermissionState();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") setTimeout(refreshExactAlarmPermissionState, 300);
    });
    return () => subscription.remove();
  }, [refreshExactAlarmPermissionState]);

  useEffect(() => {
    if (!startupAudioCleared || !alertsEnabled || exactAlarmAllowed) return;
    let cancelled = false;
    const key = "hassoun:exact-alarm-permission-prompt:v2";
    void AsyncStorage.getItem(key).then((shown) => {
      if (shown || cancelled || canScheduleAndroidExactAlarms()) return;
      setTimeout(() => {
        if (cancelled || AppState.currentState !== "active") return;
        Alert.alert(
          locale === "ar" ? "السماح بالمنبهات والتذكيرات" : "Allow Alarms & reminders",
          locale === "ar"
            ? "يحتاج حسّون هذا الإذن ليبدأ الأذان الكامل في وقت الصلاة المحدد حتى عندما يكون التطبيق مغلقاً."
            : "Hassoun needs Android Alarms & reminders access so the full Adhan can start at the exact prayer time even when the app is closed.",
          [
            { text: locale === "ar" ? "لاحقاً" : "Not now", style: "cancel", onPress: () => { void AsyncStorage.setItem(key, "shown"); } },
            { text: locale === "ar" ? "تفعيل الآن" : "Enable now", onPress: () => { void AsyncStorage.setItem(key, "shown"); openExactAlarmSettings(); } }
          ]
        );
      }, 900);
    });
    return () => { cancelled = true; };
  }, [alertsEnabled, exactAlarmAllowed, locale, startupAudioCleared]);

'''
    app = app[:permission_pos] + permission_effect + app[permission_pos:]

# Persist the current top-level tab so a true Android Activity/process recreation
# comes back to the same place rather than visibly resetting to Home.
if 'hassoun:last-active-tab:v2' not in app:
    tab_anchor = '  const [activeTab, setActiveTab] = useState<AppTab>("home");'
    if tab_anchor not in app:
        raise SystemExit('activeTab state missing')
    if 'const [runtimeNavRestored, setRuntimeNavRestored]' not in app:
        app = app.replace(tab_anchor, tab_anchor + '\n  const [runtimeNavRestored, setRuntimeNavRestored] = useState(false);', 1)
    effects_anchor = '  const refreshHome = useCallback'
    effects_pos = app.find(effects_anchor)
    if effects_pos < 0:
        raise SystemExit('refreshHome anchor missing')
    persistence = '''  useEffect(() => {
    let alive = true;
    void AsyncStorage.getItem("hassoun:last-active-tab:v2")
      .then((saved) => {
        if (!alive || !saved) return;
        const allowed: AppTab[] = ["home", "quran", "quiz", "alerts", "events", "qibla", "more"];
        if (allowed.includes(saved as AppTab)) setActiveTab(saved as AppTab);
      })
      .finally(() => { if (alive) setRuntimeNavRestored(true); });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!runtimeNavRestored) return;
    void AsyncStorage.setItem("hassoun:last-active-tab:v2", activeTab).catch(() => undefined);
  }, [activeTab, runtimeNavRestored]);

'''
    app = app[:effects_pos] + persistence + app[effects_pos:]

# Calculation settings now trigger the canonical refresh immediately after save.
if 'subscribePrayerCalculationChanges(() => {' not in app:
    refresh_end_marker = '  useEffect(() => {'
    refresh_start = app.find('  const refreshHome = useCallback')
    if refresh_start < 0:
        raise SystemExit('refreshHome callback missing')
    next_effect = app.find(refresh_end_marker, refresh_start)
    if next_effect < 0:
        raise SystemExit('Could not find insertion point after refreshHome')
    calc_effect = '''  useEffect(() => {
    return subscribePrayerCalculationChanges(() => {
      void refreshHome();
    });
  }, [refreshHome]);

'''
    app = app[:next_effect] + calc_effect + app[next_effect:]

# Safety: foreground listeners may update clock/permission state, but may not reload GPS/prayers.
for match in re.finditer(r'AppState\.addEventListener\("change"', app):
    effect_start = app.rfind('  useEffect(() => {', 0, match.start())
    effect_end = app.find('\n  },', match.end())
    if effect_start >= 0 and effect_end >= 0:
        block = app[effect_start:effect_end]
        if 'loadPrayerTimes(' in block or 'refreshHome()' in block or 'loadInitialPrayerTimes(' in block:
            raise SystemExit('Foreground AppState listener still reloads prayer/location data')

APP.write_text(app, encoding="utf-8")

checks = {
    PAIR: ['PermissionsAndroid.PERMISSIONS.CAMERA', 'CAMERA_PENDING_KEY', 'resumePendingCameraScanner'],
    HOME: ['DailyIslamicCards', 'DA’WAH • PRAYER EMAILS'],
    HUB: ['PermissionsStatusPage locale={locale}', 'page === "permissions"'],
    APP: ['canScheduleAndroidExactAlarms', 'Allow Alarms & reminders', 'hassoun:last-active-tab:v2', 'subscribePrayerCalculationChanges'],
}
for path, needles in checks.items():
    text = path.read_text(encoding="utf-8")
    for needle in needles:
        if needle not in text:
            raise SystemExit(f'Runtime fix missing {needle!r} in {path}')

print('Applied exact-alarm permission prompt, live Permissions page, safe QR camera, resume persistence, immediate calculation refresh, and daily Quran/Hadith cards')
