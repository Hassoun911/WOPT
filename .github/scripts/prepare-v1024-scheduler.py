from pathlib import Path
import runpy

# Keep the v1.0.24 scheduler preparation.
p = Path('mobile/modules/prayer-audio/android/src/main/java/ca/wopt/prayeraudio/PrayerAlarmScheduler.kt')
s = p.read_text(encoding='utf-8')
# v1.0.20 already carries scheduledAtMs in the PendingIntent. The v1.0.24 patch
# replaces the whole extras tail and re-adds it together with generation/isTest.
s = s.replace('      putExtra("scheduledAtMs", scheduledAtMs)\n', '', 1)
p.write_text(s, encoding='utf-8')

# Preserve the current app tab + nested Settings page if Android recreates the Activity
# while returning from a system permission screen.
runpy.run_path('.github/scripts/fix-v1021-resume-state.py', run_name='__main__')

# The main v1.0.24 patch runs immediately after this file. Append a final post-fix block
# to that patch so the user-facing permission/refresh corrections are applied AFTER all
# v1.0.21-v1.0.24 reconstruction scripts have finished.
patch_path = Path('.github/scripts/fix-v1024-native-alarm-refresh.py')
patch = patch_path.read_text(encoding='utf-8')
marker = '# v1.0.24 POSTFIX: stable camera permission + exact-alarm status + compact refresh icon'
if marker not in patch:
    patch += r'''

# v1.0.24 POSTFIX: stable camera permission + exact-alarm status + compact refresh icon
PAIR = ROOT / "mobile/src/ConnectDisplayPage.tsx"
pair = PAIR.read_text(encoding="utf-8")

# Camera permission on some Samsung/Android builds can recreate the Activity. Use the
# platform permission API, persist a pending scan request, and reopen the scanner only
# after the Activity is active again. This survives recreation without losing the page.
pair = pair.replace('import { CameraView, useCameraPermissions } from "expo-camera";', 'import { CameraView } from "expo-camera";')
pair = pair.replace(
'''  ActivityIndicator,\n  Alert,\n  Modal,''',
'''  ActivityIndicator,\n  Alert,\n  AppState,\n  Modal,\n  PermissionsAndroid,\n  Platform,''',
1,
)
pair = pair.replace('  const [permission, requestPermission] = useCameraPermissions();\n', '')
if 'CAMERA_PENDING_KEY' not in pair:
    pair = pair.replace(
        'const STORAGE_KEY = "hassoun:paired-displays:v2";\n',
        'const STORAGE_KEY = "hassoun:paired-displays:v2";\nconst CAMERA_PENDING_KEY = "hassoun:pending-display-camera:v1";\n',
        1,
    )

old_scanner_start = pair.find('  const openScanner = async () => {')
old_scanner_end = pair.find('\n  const onScanned =', old_scanner_start)
if old_scanner_start < 0 or old_scanner_end < 0:
    raise SystemExit('Could not locate ConnectDisplayPage openScanner')
new_scanner = r'''  const openScanner = async () => {
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
        // Give Android time to fully resume/recreate the Activity before CameraView mounts.
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
pair = pair[:old_scanner_start] + new_scanner + pair[old_scanner_end:]

# If Android recreated the Activity after permission grant, SettingsHub restores this page;
# this effect finishes the pending scan automatically instead of making the user start over.
scan_effect_anchor = '  const valid = useMemo(() => /^\\d{6}$/.test(code), [code]);\n'
if scan_effect_anchor not in pair:
    raise SystemExit('Could not locate pairing valid-code anchor')
if 'pending-display-camera:v1' in pair and 'finishPendingCameraScan' not in pair:
    scan_effect = r'''

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
    pair = pair.replace(scan_effect_anchor, scan_effect_anchor + scan_effect, 1)
PAIR.write_text(pair, encoding="utf-8")

# Exact alarm permission UX. Android's Alarms & reminders switch is a protected system
# setting and cannot legally be toggled by an app. Hassoun now shows the actual state,
# opens the correct screen, and re-checks/reschedules immediately when the user returns.
app = APP.read_text(encoding="utf-8")
app = app.replace(
    'cancelAndroidPrayerAudio, openExactAlarmSettings, scheduleAndroidTestAdhan, stopAndroidPrayerAudioPlayback',
    'cancelAndroidPrayerAudio, canScheduleAndroidExactAlarms, openExactAlarmSettings, scheduleAndroidTestAdhan, stopAndroidPrayerAudioPlayback',
    1,
)
if 'canScheduleAndroidExactAlarms' not in app:
    raise SystemExit('Could not add exact alarm permission import')

alarm_state_anchor = '  const [lastHomeRefreshAt, setLastHomeRefreshAt] = useState<Date | null>(null);'
if alarm_state_anchor not in app:
    alarm_state_anchor = '  const [startupAudioCleared, setStartupAudioCleared] = useState(false);'
if alarm_state_anchor not in app:
    raise SystemExit('Could not locate state anchor for exact alarm permission')
if 'exactAlarmAllowed' not in app:
    app = app.replace(alarm_state_anchor, alarm_state_anchor + '\n  const [exactAlarmAllowed, setExactAlarmAllowed] = useState(() => canScheduleAndroidExactAlarms());', 1)

if 'refreshExactAlarmPermission' not in app:
    effect_anchor = '  const toggleLocale = async () => {'
    effect_pos = app.find(effect_anchor)
    if effect_pos < 0:
        raise SystemExit('Could not find toggleLocale anchor')
    alarm_effect = r'''  const refreshExactAlarmPermission = useCallback(async () => {
    const granted = canScheduleAndroidExactAlarms();
    setExactAlarmAllowed(granted);
    if (granted && alertsEnabled && Object.keys(prayerTimes).length) {
      const result = await schedulePrayerNotifications(
        prayerTimes,
        locale,
        phoneAlertPreferences,
        { locationLabel: prayerLocation.label, timeZone: prayerLocation.timezone }
      ).catch(() => null);
      if (result) setScheduledCount(result.count);
    }
  }, [alertsEnabled, locale, phoneAlertPreferences, prayerTimes, prayerLocation]);

  useEffect(() => {
    void refreshExactAlarmPermission();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") setTimeout(() => { void refreshExactAlarmPermission(); }, 350);
    });
    return () => subscription.remove();
  }, [refreshExactAlarmPermission]);

'''
    app = app[:effect_pos] + alarm_effect + app[effect_pos:]

# Insert a clear permission card in Alerts. The OS switch still requires the user's tap;
# Hassoun reflects the result as soon as they return.
if 'ALARMS & REMINDERS PERMISSION' not in app:
    master_end = app.find('      </View>\n\n      <View style={styles.alertPreferenceCard}>', app.find('const alertsScreen'))
    if master_end < 0:
        raise SystemExit('Could not locate Alerts permission-card insertion point')
    master_end += len('      </View>\n')
    permission_card = r'''

      <Pressable onPress={() => { openExactAlarmSettings(); }} style={styles.emailCard}>
        <View style={styles.emailIcon}><Text style={styles.emailEmoji}>⏰</Text></View>
        <View style={styles.settingCopy}>
          <Text style={styles.alertMasterEyebrow}>{locale === "ar" ? "إذن المنبهات والتذكيرات" : "ALARMS & REMINDERS PERMISSION"}</Text>
          <Text style={styles.settingTitle}>{exactAlarmAllowed ? (locale === "ar" ? "مسموح" : "Allowed") : (locale === "ar" ? "مطلوب للأذان في الوقت المحدد" : "Required for exact-time Adhan")}</Text>
          <Text style={styles.settingText}>{exactAlarmAllowed ? (locale === "ar" ? "يمكن لـ Hassoun تشغيل الأذان في وقت الصلاة المحدد." : "Hassoun can schedule the full Adhan at the exact prayer time.") : (locale === "ar" ? "اضغط هنا، ثم فعّل مفتاح السماح في شاشة أندرويد. لا يستطيع أي تطبيق تشغيل هذا المفتاح تلقائيًا." : "Tap here, then turn on Allow permission in Android. Android requires you to switch this setting on yourself.")}</Text>
        </View>
        <Text style={[styles.settingArrow, { color: exactAlarmAllowed ? "#0b654f" : "#b27a23" }]}>{exactAlarmAllowed ? "✓" : "›"}</Text>
      </Pressable>
'''
    app = app[:master_end] + permission_card + app[master_end:]

# Replace the oversized full-width Home refresh button with a compact icon beside AR/EN.
button_pattern = re.compile(
    r'\n\s*<Pressable\n\s*onPress=\{\(\) => void refreshHome\(\)\}\n\s*disabled=\{refreshingHome\}.*?REFRESH LOCATION.*?</Pressable>\n',
    re.S,
)
app = button_pattern.sub('\n', app, count=1)

if 'accessibilityLabel={locale === "ar" ? "تحديث الموقع" : "Refresh location"}' not in app:
    lang_anchor = '      <Pressable onPress={toggleLocale} style={styles.languageButton}>'
    if lang_anchor not in app:
        raise SystemExit('Could not locate AR/EN language button')
    compact = r'''      <Pressable
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

# Final generated-source assertions.
final_checks = {
    PAIR: ['PermissionsAndroid.PERMISSIONS.CAMERA', 'CAMERA_PENDING_KEY', 'finishPendingCameraScan', 'Camera allowed. Opening scanner'],
    APP: ['exactAlarmAllowed', 'ALARMS & REMINDERS PERMISSION', 'Refresh location', 'onRefresh={() => { void refreshHome(); }}'],
}
for path, needles in final_checks.items():
    text = path.read_text(encoding='utf-8')
    for needle in needles:
        if needle not in text:
            raise SystemExit(f'Post-fix missing {needle!r} in {path}')

print('Applied post-v1.0.24 permission recovery, exact-alarm status, and compact Home refresh icon')
'''
    patch_path.write_text(patch, encoding='utf-8')

print('Prepared scheduler and injected v1.0.24 runtime permission/refresh postfix')
