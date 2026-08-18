from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def read(path: str) -> str:
    return (ROOT / path).read_text()


def write(path: str, text: str) -> None:
    (ROOT / path).write_text(text)

# ---------------------------------------------------------------------------
# App.tsx — one preference source controls Home prayer-card Adhan, Alerts UI,
# local 20/10 reminders and native exact Adhan alarms.
# ---------------------------------------------------------------------------
path = "mobile/App.tsx"
text = read(path)

if 'from "./src/alertPreferences";' not in text:
    text = text.replace(
        'import { CITY_LABEL, STORAGE_KEYS, WINDSOR_TIME_ZONE } from "./src/config";\n',
        'import { CITY_LABEL, STORAGE_KEYS, WINDSOR_TIME_ZONE } from "./src/config";\nimport {\n  DEFAULT_PHONE_PRAYER_ALERTS,\n  anyPrayerAlertEnabled,\n  applyPrayerAlertPreset,\n  loadPhonePrayerAlertPreferences,\n  savePhonePrayerAlertPreferences,\n  summarizePrayerAlertPreferences,\n  type PrayerAlertPreferences\n} from "./src/alertPreferences";\n'
    )
if 'import PrayerAlertPreferenceGrid from "./src/PrayerAlertPreferenceGrid";' not in text:
    text = text.replace(
        'import { loadPrayerTimes } from "./src/prayerData";\n',
        'import { loadPrayerTimes } from "./src/prayerData";\nimport PrayerAlertPreferenceGrid from "./src/PrayerAlertPreferenceGrid";\n'
    )
text = text.replace(
    'import { openExactAlarmSettings, scheduleAndroidPrayerAudio, scheduleAndroidTestAdhan } from "./src/prayerAudio";',
    'import { openExactAlarmSettings, scheduleAndroidTestAdhan } from "./src/prayerAudio";'
)

text = text.replace(
    '  const [mutedPrayerAudio, setMutedPrayerAudio] = useState<PrayerKey[]>([]);\n',
    '  const [phoneAlertPreferences, setPhoneAlertPreferences] = useState<PrayerAlertPreferences>(DEFAULT_PHONE_PRAYER_ALERTS);\n  const [alertPreferencesBusy, setAlertPreferencesBusy] = useState(false);\n'
)

old_start = '''      const [savedLocale, savedAlerts, savedMutedPrayerAudio, loaded, storedQuizStats] = await Promise.all([\n        AsyncStorage.getItem(STORAGE_KEYS.locale),\n        AsyncStorage.getItem(STORAGE_KEYS.alertsEnabled),\n        AsyncStorage.getItem(STORAGE_KEYS.prayerAudioMuted),\n        loadPrayerTimes(),\n        loadQuizStats()\n      ]);'''
new_start = '''      const [savedLocale, savedAlerts, savedPhoneAlertPreferences, loaded, storedQuizStats] = await Promise.all([\n        AsyncStorage.getItem(STORAGE_KEYS.locale),\n        AsyncStorage.getItem(STORAGE_KEYS.alertsEnabled),\n        loadPhonePrayerAlertPreferences(),\n        loadPrayerTimes(),\n        loadQuizStats()\n      ]);'''
if old_start in text:
    text = text.replace(old_start, new_start, 1)

old_muted_load = '''      try {\n        const parsedMuted = savedMutedPrayerAudio ? JSON.parse(savedMutedPrayerAudio) as unknown : [];\n        if (Array.isArray(parsedMuted)) setMutedPrayerAudio(parsedMuted.filter((value): value is PrayerKey => typeof value === "string" && PRAYER_KEYS.includes(value as PrayerKey)));\n      } catch {}\n'''
if old_muted_load in text:
    text = text.replace(old_muted_load, '      setPhoneAlertPreferences(savedPhoneAlertPreferences);\n', 1)

# Startup scheduler uses the loaded per-user preferences immediately.
text = text.replace(
    '        const result = await schedulePrayerNotifications(loaded.prayerTimes, chosenLocale);',
    '        const result = await schedulePrayerNotifications(loaded.prayerTimes, chosenLocale, savedPhoneAlertPreferences);',
    1
)
# Foreground refresh and locale changes use current preferences.
text = text.replace(
    '      void schedulePrayerNotifications(prayerTimes, locale)\n',
    '      void schedulePrayerNotifications(prayerTimes, locale, phoneAlertPreferences)\n'
)
text = text.replace(
    '  }, [alertsEnabled, locale, prayerTimes]);',
    '  }, [alertsEnabled, locale, prayerTimes, phoneAlertPreferences]);',
    1
)
text = text.replace(
    '      const result = await schedulePrayerNotifications(prayerTimes, nextLocale);',
    '      const result = await schedulePrayerNotifications(prayerTimes, nextLocale, phoneAlertPreferences);'
)

old_toggle_alerts = '''  const toggleAlerts = async (enabled: boolean) => {\n    setBusy(true);\n    try {\n      if (!enabled) {\n        await disablePrayerNotifications();\n        setAlertsEnabled(false);\n        setScheduledCount(0);\n        return;\n      }\n      const result = await schedulePrayerNotifications(prayerTimes, locale);\n      if (!result.granted) {\n        Alert.alert("Notifications are off", "Allow notifications in your phone settings to receive prayer alerts.");\n        return;\n      }\n      await scheduleIslamicEventReminders(todayKey, locale).catch(() => undefined);\n      setAlertsEnabled(true);\n      setScheduledCount(result.count);\n      void registerDeviceForServerPush(locale).catch(() => undefined);\n      if (!result.exactAlarmGranted) {\n        Alert.alert("Allow exact prayer alarms", "Android needs Alarms & reminders access so the full Adhan can begin at the exact prayer time, even when the app is closed.", [\n          { text: "Not now", style: "cancel" },\n          { text: "Open settings", onPress: openExactAlarmSettings }\n        ]);\n      }\n    } finally { setBusy(false); }\n  };\n\n  const togglePrayerAudio = async (prayer: PrayerKey) => {\n    const currentlyMuted = mutedPrayerAudio.includes(prayer);\n    const nextMuted = currentlyMuted\n      ? mutedPrayerAudio.filter((item) => item !== prayer)\n      : [...mutedPrayerAudio, prayer];\n    setMutedPrayerAudio(nextMuted);\n    await AsyncStorage.setItem(STORAGE_KEYS.prayerAudioMuted, JSON.stringify(nextMuted));\n    if (alertsEnabled && Object.keys(prayerTimes).length) {\n      await scheduleAndroidPrayerAudio(prayerTimes).catch(() => undefined);\n    }\n  };'''
new_toggle_alerts = '''  const toggleAlerts = async (enabled: boolean) => {\n    setBusy(true);\n    try {\n      if (!enabled) {\n        await disablePrayerNotifications();\n        setAlertsEnabled(false);\n        setScheduledCount(0);\n        return;\n      }\n      let preferences = phoneAlertPreferences;\n      if (!anyPrayerAlertEnabled(preferences)) {\n        preferences = applyPrayerAlertPreset("all");\n        setPhoneAlertPreferences(preferences);\n        await savePhonePrayerAlertPreferences(preferences);\n      }\n      const result = await schedulePrayerNotifications(prayerTimes, locale, preferences);\n      if (!result.granted) {\n        Alert.alert("Notifications are off", "Allow notifications in your phone settings to receive prayer alerts.");\n        return;\n      }\n      await scheduleIslamicEventReminders(todayKey, locale).catch(() => undefined);\n      setAlertsEnabled(true);\n      setScheduledCount(result.count);\n      void registerDeviceForServerPush(locale).catch(() => undefined);\n      if (!result.exactAlarmGranted && PRAYER_KEYS.some((prayer) => preferences[prayer].athan)) {\n        Alert.alert("Allow exact prayer alarms", "Android needs Alarms & reminders access so the full Adhan can begin at the exact prayer time, even when the app is closed.", [\n          { text: "Not now", style: "cancel" },\n          { text: "Open settings", onPress: openExactAlarmSettings }\n        ]);\n      }\n    } finally { setBusy(false); }\n  };\n\n  const updatePhoneAlertPreferences = async (nextPreferences: PrayerAlertPreferences) => {\n    setPhoneAlertPreferences(nextPreferences);\n    await savePhonePrayerAlertPreferences(nextPreferences);\n    if (!alertsEnabled || !Object.keys(prayerTimes).length) return;\n    setAlertPreferencesBusy(true);\n    try {\n      if (!anyPrayerAlertEnabled(nextPreferences)) {\n        await disablePrayerNotifications();\n        setAlertsEnabled(false);\n        setScheduledCount(0);\n        return;\n      }\n      const result = await schedulePrayerNotifications(prayerTimes, locale, nextPreferences);\n      setScheduledCount(result.count);\n    } finally {\n      setAlertPreferencesBusy(false);\n    }\n  };\n\n  const togglePrayerAudio = async (prayer: PrayerKey) => {\n    const nextPreferences: PrayerAlertPreferences = {\n      ...phoneAlertPreferences,\n      [prayer]: { ...phoneAlertPreferences[prayer], athan: !phoneAlertPreferences[prayer].athan }\n    };\n    await updatePhoneAlertPreferences(nextPreferences);\n  };'''
if old_toggle_alerts not in text:
    raise SystemExit("Could not find old toggleAlerts/togglePrayerAudio block")
text = text.replace(old_toggle_alerts, new_toggle_alerts, 1)

# Home cards read the same persisted Adhan preference.
text = text.replace(
    'const muted = mutedPrayerAudio.includes(prayer);',
    'const muted = !phoneAlertPreferences[prayer].athan;'
)

# Replace the old simple Alerts page with a per-user control center.
start = text.find('  const alertsScreen = (')
end = text.find('\n\n  const moreScreen =', start)
if start == -1 or end == -1:
    raise SystemExit("Could not locate alertsScreen block")
new_alerts = '''  const alertsScreen = (\n    <ScrollView style={styles.flex} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>\n      {header}\n      <Text style={styles.pageEyebrow}>HASSOUN • {locale === "ar" ? "مركز التنبيهات" : "ALERT CENTER"}</Text>\n      <Text style={styles.pageTitle}>{locale === "ar" ? "تنبيهاتك، باختيارك" : "Your prayer alerts, your way"}</Text>\n      <Text style={styles.pageSubtitle}>{locale === "ar" ? "خصص كل صلاة على حدة: قبل ٢٠ دقيقة أو ١٠ دقائق أو الأذان عند الوقت، أو أي مجموعة منها." : "Customize every prayer separately: 20 minutes before, 10 minutes before, Adhan at prayer time, or any combination."}</Text>\n\n      <View style={styles.alertMasterCard}>\n        <View style={styles.alertMasterLogo}><Image source={require("./assets/hassoun-logo.png")} style={styles.alertMasterLogoImage} resizeMode="contain" /></View>\n        <View style={styles.settingCopy}>\n          <Text style={styles.alertMasterEyebrow}>{locale === "ar" ? "تنبيهات هذا الهاتف" : "THIS PHONE"}</Text>\n          <Text style={styles.settingTitle}>{alertsEnabled ? (locale === "ar" ? "تنبيهات الصلاة مفعلة" : "Prayer alerts are active") : (locale === "ar" ? "تنبيهات الصلاة متوقفة" : "Prayer alerts are paused")}</Text>\n          <Text style={styles.settingText}>{summarizePrayerAlertPreferences(phoneAlertPreferences, locale)}</Text>\n          {alertsEnabled ? <Text style={styles.settingStatus}>✓ {scheduledCount} {locale === "ar" ? "تنبيه/أذان مجدول" : "scheduled reminder/Adhan events"}</Text> : null}\n        </View>\n        <Switch value={alertsEnabled} onValueChange={toggleAlerts} disabled={busy || alertPreferencesBusy} trackColor={{ false: "#d9ddd9", true: "#95c3b4" }} thumbColor={alertsEnabled ? "#0b5b47" : "#f8faf8"} />\n      </View>\n\n      <View style={styles.alertPreferenceCard}>\n        <View style={styles.alertPreferenceHeading}>\n          <View style={{ flex: 1 }}>\n            <Text style={styles.alertPreferenceEyebrow}>{locale === "ar" ? "تخصيص كل صلاة" : "PER-PRAYER CONTROLS"}</Text>\n            <Text style={styles.alertPreferenceTitle}>{locale === "ar" ? "اختر متى ينبهك Hassoun" : "Choose exactly when Hassoun alerts you"}</Text>\n            <Text style={styles.alertPreferenceText}>{locale === "ar" ? "زر الصلاة على اليمين يوقف كل تنبيهات تلك الصلاة. أزرار 20 و10 والأذان تتحكم بكل نوع بشكل مستقل." : "The prayer switch turns that prayer completely on/off. The 20, 10 and Adhan buttons control each alert type independently."}</Text>\n          </View>\n        </View>\n        <PrayerAlertPreferenceGrid\n          locale={locale}\n          value={phoneAlertPreferences}\n          onChange={(nextPreferences) => void updatePhoneAlertPreferences(nextPreferences)}\n          disabled={busy || alertPreferencesBusy}\n        />\n        {alertPreferencesBusy ? <View style={styles.alertSaving}><ActivityIndicator size="small" color="#0b654f" /><Text style={styles.alertSavingText}>{locale === "ar" ? "جارٍ تحديث التنبيهات على هذا الهاتف…" : "Updating this phone’s prayer schedule…"}</Text></View> : null}\n      </View>\n\n      <Pressable onPress={onOpenEmailAlerts} disabled={!onOpenEmailAlerts} style={styles.emailCard}>\n        <View style={styles.emailLogoWrap}><Image source={require("./assets/hassoun-logo.png")} style={styles.emailLogo} resizeMode="contain" /></View>\n        <View style={styles.settingCopy}><Text style={styles.settingTitle}>{locale === "ar" ? "تنبيهات الصلاة عبر البريد" : "Prayer email alerts"}</Text><Text style={styles.settingText}>{locale === "ar" ? "خصص Fajr وDhuhr وAsr وMaghrib وIsha بشكل مستقل، مع ٢٠ دقيقة أو ١٠ دقائق أو وقت الصلاة." : "Customize Fajr, Dhuhr, Asr, Maghrib and Isha independently with 20-minute, 10-minute and at-time emails."}</Text></View><Text style={styles.settingArrow}>›</Text>\n      </Pressable>\n\n      <Pressable onPress={() => setActiveTab("events")} style={styles.emailCard}>\n        <View style={styles.emailIcon}><Text style={styles.emailEmoji}>🌙</Text></View><View style={styles.settingCopy}><Text style={styles.settingTitle}>{locale === "ar" ? "تنبيهات المناسبات الإسلامية" : "Islamic event reminders"}</Text><Text style={styles.settingText}>{locale === "ar" ? "إشعار قبل ١٥ يوماً من المناسبة الإسلامية القادمة." : "A reminder appears when the next Islamic event is 15 days away."}</Text></View><Text style={styles.settingArrow}>›</Text>\n      </Pressable>\n\n      <View style={styles.testCard}><Text style={styles.testTitle}>{locale === "ar" ? "اختبار النظام" : "System tests"}</Text><Text style={styles.testDescription}>{locale === "ar" ? "اختبر التنبيه والأذان دون تغيير ساعة الهاتف." : "Test notifications and locked-screen Adhan without changing the phone clock."}</Text><View style={styles.testRow}><Pressable onPress={testNotification} style={styles.testButton} disabled={busy || alertPreferencesBusy}><Text style={styles.testButtonIcon}>🔔</Text><Text style={styles.testButtonTitle}>{locale === "ar" ? "اختبار تنبيه" : "Test notification"}</Text><Text style={styles.testButtonMeta}>15 sec</Text></Pressable><Pressable onPress={testAdhan} style={[styles.testButton, styles.testButtonPrimary]} disabled={busy || alertPreferencesBusy}><Text style={styles.testButtonIcon}>🕌</Text><Text style={[styles.testButtonTitle, styles.testButtonPrimaryText]}>{locale === "ar" ? "اختبار الأذان" : "Test Adhan"}</Text><Text style={[styles.testButtonMeta, styles.testButtonPrimaryMeta]}>30 sec</Text></Pressable></View></View>\n    </ScrollView>\n  );'''
text = text[:start] + new_alerts + text[end:]

# Add unique style keys at the beginning of StyleSheet so we don't depend on
# exact formatting of the existing large style object.
style_anchor = 'const styles = StyleSheet.create({\n'
style_insert = '''const styles = StyleSheet.create({\n  alertMasterCard: { borderRadius: 23, backgroundColor: "#fff", borderWidth: 1, borderColor: "#dfe5df", padding: 14, flexDirection: "row", alignItems: "center", gap: 11, marginTop: 17 },\n  alertMasterLogo: { width: 49, height: 49, borderRadius: 15, backgroundColor: "#003d33", alignItems: "center", justifyContent: "center", overflow: "hidden" },\n  alertMasterLogoImage: { width: 45, height: 45 },\n  alertMasterEyebrow: { color: "#9b7a39", fontSize: 7, fontWeight: "900", letterSpacing: 1 },\n  alertPreferenceCard: { borderRadius: 23, backgroundColor: "#fffdf8", borderWidth: 1, borderColor: "#e1d9ca", padding: 14, marginTop: 11 },\n  alertPreferenceHeading: { flexDirection: "row", gap: 10, marginBottom: 13 },\n  alertPreferenceEyebrow: { color: "#9b7a39", fontSize: 7, fontWeight: "900", letterSpacing: 1 },\n  alertPreferenceTitle: { color: "#173f35", fontSize: 17, fontWeight: "900", marginTop: 3 },\n  alertPreferenceText: { color: "#748079", fontSize: 9, lineHeight: 14, marginTop: 4 },\n  alertSaving: { minHeight: 38, borderRadius: 13, backgroundColor: "#edf5f1", marginTop: 10, paddingHorizontal: 11, flexDirection: "row", alignItems: "center", gap: 8 },\n  alertSavingText: { flex: 1, color: "#526d64", fontSize: 8.5, fontWeight: "800" },\n  emailLogoWrap: { width: 45, height: 45, borderRadius: 14, backgroundColor: "#003d33", alignItems: "center", justifyContent: "center", overflow: "hidden" },\n  emailLogo: { width: 41, height: 41 },\n'''
if 'alertMasterCard:' not in text:
    if style_anchor not in text:
        raise SystemExit("StyleSheet anchor not found")
    text = text.replace(style_anchor, style_insert, 1)

write(path, text)

# ---------------------------------------------------------------------------
# Email modal hero: no fake/random moon/dome/Arabic glyph branding.
# ---------------------------------------------------------------------------
path = "mobile/AppWithEmail.tsx"
text = read(path)
old_hero = '''            <View style={styles.heroIllustration}>\n              <View style={styles.heroMoon}><Text style={styles.heroMoonText}>☾</Text></View>\n              <View style={styles.heroDome}><Text style={styles.heroDomeText}>و</Text></View>\n            </View>'''
new_hero = '''            <View style={styles.heroIllustration}>\n              <BrandMark size={70} />\n            </View>'''
if old_hero in text:
    text = text.replace(old_hero, new_hero, 1)
write(path, text)

# ---------------------------------------------------------------------------
# PWA secure manage page: real Hassoun logo + smarter labels. Per-prayer backend
# behavior already existed; keep it and make the page visibly branded.
# ---------------------------------------------------------------------------
path = "pwa/app/email/manage/page.tsx"
text = read(path)
if 'const LOGO =' not in text:
    text = text.replace(
        'const API = "https://wopt-prayer-push.wopt-windsor.workers.dev";\n',
        'const API = "https://wopt-prayer-push.wopt-windsor.workers.dev";\nconst LOGO = "https://hassoun911.github.io/WOPT/assets/hassoun-logo.png";\n'
    )
text = text.replace(
    '<header style={s.header}><div><p style={s.eyebrow}>Hassoun</p><h1 style={s.h1}>{locale === "ar" ? "إدارة تنبيهات البريد" : "Manage email alerts"}</h1><p style={s.muted}>{subscription?.email}</p></div><a href="../../" style={s.link}>{locale === "ar" ? "العودة" : "Back"}</a></header>',
    '<header style={s.header}><div style={s.brandRow}><img src={LOGO} alt="Hassoun" width={56} height={56} style={s.logo} /><div><p style={s.eyebrow}>HASSOUN</p><h1 style={s.h1}>{locale === "ar" ? "إدارة تنبيهات البريد" : "Manage email alerts"}</h1><p style={s.muted}>{subscription?.email}</p></div></div><a href="../../" style={s.link}>{locale === "ar" ? "العودة" : "Back"}</a></header>'
)
if 'brandRow:' not in text:
    text = text.replace(
        '  header: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, marginBottom: 18 },',
        '  header: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, marginBottom: 18 }, brandRow: { display: "flex", alignItems: "center", gap: 12 }, logo: { borderRadius: 16, background: "#003d33", objectFit: "contain" },'
    )
write(path, text)

# Hard assertions.
requirements = {
    "mobile/App.tsx": [
        'PrayerAlertPreferenceGrid',
        'phoneAlertPreferences',
        'updatePhoneAlertPreferences',
        'summarizePrayerAlertPreferences',
        '20 minutes before, 10 minutes before, Adhan at prayer time',
        'const muted = !phoneAlertPreferences[prayer].athan;',
    ],
    "mobile/src/notifications.ts": [
        'eventEnabled(event, preferences)',
        'scheduleAndroidPrayerAudio(prayerTimes, preferences)',
    ],
    "mobile/src/prayerAudio.ts": [
        'preferences[event.prayer]?.athan === true',
    ],
    "mobile/src/EmailSignupCard.tsx": [
        'PrayerAlertPreferenceGrid',
        'Email alerts, your way',
    ],
    "mobile/src/emailSignup.ts": [
        'prayers: choices',
        'anyPrayerAlertEnabled',
    ],
    "mobile/AppWithEmail.tsx": ['<BrandMark size={70} />'],
    "pwa/app/email/manage/page.tsx": ['const LOGO =', 'img src={LOGO}'],
}
for file, markers in requirements.items():
    value = read(file)
    for marker in markers:
        if marker not in value:
            raise SystemExit(f"Missing v0.6.3 alert requirement in {file}: {marker}")

print("Applied Hassoun v0.6.3 smart per-user phone/email alert controls and exact-logo cleanup.")
