from pathlib import Path
import re


def read(path): return Path(path).read_text(encoding="utf-8")
def write(path, text): Path(path).write_text(text, encoding="utf-8")
def must_replace(path, old, new, count=1):
    text = read(path)
    if old not in text:
        raise SystemExit(f"Missing target in {path}: {old[:100]!r}")
    write(path, text.replace(old, new, count))

def add_before(path, marker, addition):
    must_replace(path, marker, addition + marker)

# ---------------- Settings / About / Sadaqah ----------------
p = "mobile/src/SettingsHub.tsx"
text = read(p)
if '"donation" | "contact"' not in text:
    text = text.replace('type SettingsPage = "root" | "about" | "contact" | "privacy" | "terms" | "data" | "permissions" | "widgets";',
                        'type SettingsPage = "root" | "about" | "donation" | "contact" | "privacy" | "terms" | "data" | "permissions" | "widgets";')
    text = text.replace('  const appVersion = Constants.expoConfig?.version ?? "0.5.0";\n',
                        '  const appVersion = Constants.expoConfig?.version ?? "0.5.0";\n  const pushApiUrl = String(Constants.expoConfig?.extra?.pushApiUrl ?? "https://wopt-prayer-push.wopt-windsor.workers.dev");\n  const configuredDonationUrl = String(Constants.expoConfig?.extra?.donationUrl ?? "").trim();\n  const [sadaqahConfig, setSadaqahConfig] = useState<Record<string, unknown>>({ enabled: true, donationEnabled: Boolean(configuredDonationUrl), donationUrl: configuredDonationUrl, dedicationEn: "For Abdul Jalil Hassoun and Salwa Hassoun", dedicationAr: "عن عبد الجليل حسون وسلمى حسون" });\n')
    text = text.replace('  useEffect(() => {\n    if (page !== "widgets") return;\n',
                        '  useEffect(() => {\n    let active = true;\n    void fetch(`${pushApiUrl}/config`).then((response) => response.ok ? response.json() : null).then((payload) => {\n      const remote = payload?.control?.settings?.sadaqah_jariyah;\n      if (active && remote && typeof remote === "object") setSadaqahConfig((previous) => ({ ...previous, ...remote }));\n    }).catch(() => undefined);\n    return () => { active = false; };\n  }, [pushApiUrl]);\n\n  useEffect(() => {\n    if (page !== "widgets") return;\n', 1)
    text = text.replace('      <Section title={t("PRIVACY & LEGAL", "الخصوصية والقانون")}>',
                        '      <Section title={t("SADAQAH JARIYAH", "صدقة جارية")}><Row emoji="🤲" title={t("Sadaqah Jariyah & donations", "الصدقة الجارية والتبرع")} text={t("For Abdul Jalil Hassoun and Salwa Hassoun • Join the ongoing charity", "عن عبد الجليل حسون وسلمى حسون • شارك في الصدقة الجارية")} onPress={() => setPage("donation")} /></Section>\n\n      <Section title={t("PRIVACY & LEGAL", "الخصوصية والقانون")}>')
    text = text.replace('<View style={styles.aboutHero}><Text style={styles.aboutMoon}>☪</Text><Text style={styles.aboutTitle}>Hassoun</Text><Text style={styles.aboutTagline}>{t("Prayer • Qur’an • Knowledge", "الصلاة • القرآن • المعرفة")}</Text><Text style={styles.version}>v{appVersion}</Text></View>',
                        '<View style={styles.aboutHero}><Image source={require("../assets/hassoun-logo.png")} style={styles.aboutLogo} resizeMode="contain" /><Text style={styles.aboutTitle}>Hassoun</Text><Text style={styles.aboutTagline}>{t("Prayer • Qur’an • Knowledge", "الصلاة • القرآن • المعرفة")}</Text><Text style={styles.version}>v{appVersion}</Text></View>')
    purpose = '        <LegalCard title={t("Our purpose", "هدفنا")}><Text style={styles.legalText}>{t("Hassoun brings prayer times, Adhan, Qur’an reading and listening, memorization tools and Islamic learning into one calm, easy-to-use experience.", "يجمع Hassoun مواقيت الصلاة والأذان وقراءة القرآن والاستماع إليه وأدوات الحفظ والتعلم الإسلامي في تجربة سهلة وواضحة.")}</Text></LegalCard>\n'
    text = text.replace(purpose, purpose + '        <LegalCard title={t("Sadaqah Jariyah", "صدقة جارية")}><Text style={styles.legalText}>{t("Hassoun is dedicated as Sadaqah Jariyah for Abdul Jalil Hassoun and Salwa Hassoun. We ask Allah to accept every prayer reminder, Qur’an verse read, lesson learned and beneficial use through this app as ongoing charity for them.", "تطبيق Hassoun مُهدى كصدقة جارية عن عبد الجليل حسون وسلمى حسون. نسأل الله أن يتقبل كل تذكير بالصلاة وكل آية تُقرأ وكل علم نافع واستفادة من هذا التطبيق في ميزان صدقتهما الجارية.")}</Text><Pressable onPress={() => setPage("donation")} style={styles.inlineButton}><Text style={styles.inlineButtonText}>{t("Be part of this Sadaqah Jariyah", "شارك في هذه الصدقة الجارية")}</Text></Pressable></LegalCard>\n')
    donation = '''  if (page === "donation") {
    const donationUrl = String(sadaqahConfig.donationUrl ?? configuredDonationUrl ?? "").trim();
    const donationEnabled = sadaqahConfig.enabled !== false && sadaqahConfig.donationEnabled !== false && Boolean(donationUrl);
    return (
      <ScrollView style={styles.flex} contentContainerStyle={styles.content}>
        <BackHeader title={t("Sadaqah Jariyah", "صدقة جارية")} onBack={() => setPage("root")} />
        <View style={styles.aboutHero}><Image source={require("../assets/hassoun-logo.png")} style={styles.aboutLogo} resizeMode="contain" /><Text style={styles.aboutTitle}>Hassoun</Text><Text style={styles.aboutTagline}>{t("An ongoing charity", "صدقة جارية")}</Text></View>
        <LegalCard title={t("For Abdul Jalil Hassoun & Salwa Hassoun", "عن عبد الجليل حسون وسلمى حسون")}><Text style={styles.legalText}>{t("This app is offered as Sadaqah Jariyah for Abdul Jalil Hassoun and Salwa Hassoun. May Allah accept it, multiply its benefit, and make every beneficial use a continuing reward for them.", "هذا التطبيق صدقة جارية عن عبد الجليل حسون وسلمى حسون. نسأل الله أن يتقبله ويضاعف نفعه وأن يجعل كل استفادة منه أجراً مستمراً لهما.")}</Text></LegalCard>
        <LegalCard title={t("Join the Sadaqah", "شارك في الصدقة")}><Text style={styles.legalText}>{t("You can contribute a donation to help maintain and improve Hassoun so its prayer, Qur’an and learning tools can continue benefiting people.", "يمكنك المساهمة بتبرع للمساعدة في استمرار وتطوير Hassoun حتى تبقى أدوات الصلاة والقرآن والتعلم نافعة للناس.")}</Text>{donationEnabled ? <Pressable onPress={() => Linking.openURL(donationUrl)} style={styles.primaryButton}><Text style={styles.primaryButtonText}>{t("Donate as Sadaqah Jariyah", "تبرع كصدقة جارية")}</Text></Pressable> : <Text style={styles.formNote}>{t("The donation link is being prepared. It will appear automatically when enabled by Hassoun administration.", "يجري تجهيز رابط التبرع وسيظهر تلقائياً عند تفعيله من إدارة Hassoun.")}</Text>}</LegalCard>
        <Text style={styles.formNote}>{t("Donations are voluntary and support Hassoun’s continuing charitable purpose.", "التبرعات اختيارية وتدعم استمرار هدف Hassoun كصدقة جارية.")}</Text>
      </ScrollView>
    );
  }

'''
    text = text.replace('  if (page === "permissions") {', donation + '  if (page === "permissions") {')
    text = text.replace('  aboutMoon: { color: "#f2cc72", fontSize: 45 },\n', '  aboutMoon: { color: "#f2cc72", fontSize: 45 },\n  aboutLogo: { width: 92, height: 92, marginBottom: 4 },\n')
    write(p, text)

# ---------------- Prayer startup cache ----------------
p = "mobile/src/prayerData.ts"
text = read(p)
if "loadCachedPrayerTimes" not in text:
    old = '''export async function loadPrayerTimes(): Promise<{ prayerTimes: PrayerTimes; live: boolean }> {
  const bundled = bundledSchedule as PrayerFile;
  const cached = await AsyncStorage.getItem(STORAGE_KEYS.schedule);
  let fallback = bundled.prayer_times;

  if (cached) {
    try {
      const parsed = JSON.parse(cached) as unknown;
      if (isPrayerFile(parsed)) fallback = parsed.prayer_times;
    } catch {
      await AsyncStorage.removeItem(STORAGE_KEYS.schedule);
    }
  }

  try {'''
    new = '''export async function loadCachedPrayerTimes(): Promise<{ prayerTimes: PrayerTimes; live: false }> {
  const bundled = bundledSchedule as PrayerFile;
  const cached = await AsyncStorage.getItem(STORAGE_KEYS.schedule);
  let fallback = bundled.prayer_times;
  if (cached) {
    try {
      const parsed = JSON.parse(cached) as unknown;
      if (isPrayerFile(parsed)) fallback = parsed.prayer_times;
    } catch {
      await AsyncStorage.removeItem(STORAGE_KEYS.schedule);
    }
  }
  return { prayerTimes: fallback, live: false };
}

export async function loadPrayerTimes(): Promise<{ prayerTimes: PrayerTimes; live: boolean }> {
  const fallback = (await loadCachedPrayerTimes()).prayerTimes;

  try {'''
    if old not in text: raise SystemExit("prayerData target missing")
    write(p, text.replace(old, new, 1))

# ---------------- Islamic event alert cancel helper ----------------
p = "mobile/src/notifications.ts"
text = read(p)
if "cancelIslamicEventReminders" not in text:
    marker = 'function notificationContent(event: PrayerEvent, locale: "en" | "ar") {'
    helper = '''export async function cancelIslamicEventReminders() {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  const islamic = scheduled.filter((request) => {
    const data = request.content.data as Record<string, unknown> | null | undefined;
    return data?.kind === ISLAMIC_EVENT_KIND;
  });
  await Promise.all(islamic.map((request) => Notifications.cancelScheduledNotificationAsync(request.identifier)));
  await AsyncStorage.removeItem(ISLAMIC_EVENT_MARKER_KEY);
}

'''
    if marker not in text: raise SystemExit("notifications marker missing")
    write(p, text.replace(marker, helper + marker, 1))

# ---------------- Main app alerts and startup ----------------
p = "mobile/App.tsx"
text = read(p)
if "islamicEventAlertsEnabled" not in text:
    text = text.replace('import { disablePrayerNotifications, scheduleIslamicEventReminders, schedulePrayerNotifications, scheduleTestReminder } from "./src/notifications";',
                        'import { cancelIslamicEventReminders, disablePrayerNotifications, scheduleIslamicEventReminders, schedulePrayerNotifications, scheduleTestReminder } from "./src/notifications";')
    text = text.replace('import { loadPrayerTimes } from "./src/prayerData";', 'import { loadCachedPrayerTimes, loadPrayerTimes } from "./src/prayerData";')
    text = text.replace('type AppProps = {\n  onOpenEmailAlerts?: () => void;\n};\n\n', 'type AppProps = {\n  onOpenEmailAlerts?: () => void;\n};\n\nconst ISLAMIC_EVENT_ALERTS_KEY = "hassoun:islamic-event-alerts:v1";\n\n')
    text = text.replace('  const [scheduledCount, setScheduledCount] = useState(0);', '  const [scheduledCount, setScheduledCount] = useState(0);\n  const [islamicEventAlertsEnabled, setIslamicEventAlertsEnabled] = useState(true);')
    old_effect = '''  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1_000);
    void (async () => {
      const [savedLocale, savedAlerts, savedPhoneAlertPreferences, loaded, storedQuizStats] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.locale),
        AsyncStorage.getItem(STORAGE_KEYS.alertsEnabled),
        loadPhonePrayerAlertPreferences(),
        loadPrayerTimes(),
        loadQuizStats()
      ]);
      const chosenLocale = savedLocale === "ar" ? "ar" : "en";
      setLocale(chosenLocale);
      setAlertsEnabled(savedAlerts === "on");
      setPrayerTimes(loaded.prayerTimes);
      setLive(loaded.live);
      setQuizStats(storedQuizStats);
      setPhoneAlertPreferences(savedPhoneAlertPreferences);
      setBusy(false);
      if (savedAlerts === "on") {
        const result = await schedulePrayerNotifications(loaded.prayerTimes, chosenLocale, savedPhoneAlertPreferences);
        setScheduledCount(result.count);
        await scheduleIslamicEventReminders(windsorDateKey(new Date()), chosenLocale).catch(() => undefined);
        void registerDeviceForServerPush(chosenLocale).catch(() => undefined);
      }
    })();
    return () => clearInterval(timer);
  }, []);'''
    new_effect = '''  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1_000);
    void (async () => {
      const [savedLocale, savedAlerts, savedEventAlerts, savedPhoneAlertPreferences, cached, storedQuizStats] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.locale),
        AsyncStorage.getItem(STORAGE_KEYS.alertsEnabled),
        AsyncStorage.getItem(ISLAMIC_EVENT_ALERTS_KEY),
        loadPhonePrayerAlertPreferences(),
        loadCachedPrayerTimes(),
        loadQuizStats()
      ]);
      const chosenLocale = savedLocale === "ar" ? "ar" : "en";
      const eventAlertsOn = savedEventAlerts !== "off";
      setLocale(chosenLocale);
      setAlertsEnabled(savedAlerts === "on");
      setIslamicEventAlertsEnabled(eventAlertsOn);
      setPrayerTimes(cached.prayerTimes);
      setLive(false);
      setQuizStats(storedQuizStats);
      setPhoneAlertPreferences(savedPhoneAlertPreferences);
      setBusy(false);

      void loadPrayerTimes().then(async (loaded) => {
        setPrayerTimes(loaded.prayerTimes);
        setLive(loaded.live);
        if (savedAlerts === "on") {
          const result = await schedulePrayerNotifications(loaded.prayerTimes, chosenLocale, savedPhoneAlertPreferences);
          setScheduledCount(result.count);
          if (eventAlertsOn) await scheduleIslamicEventReminders(windsorDateKey(new Date()), chosenLocale).catch(() => undefined);
          void registerDeviceForServerPush(chosenLocale).catch(() => undefined);
        }
      }).catch(() => undefined);
    })().catch(() => setBusy(false));
    return () => clearInterval(timer);
  }, []);'''
    if old_effect not in text: raise SystemExit("App startup effect target missing")
    text = text.replace(old_effect, new_effect, 1)
    text = text.replace('      void scheduleIslamicEventReminders(windsorDateKey(new Date()), locale).catch(() => undefined);', '      if (islamicEventAlertsEnabled) void scheduleIslamicEventReminders(windsorDateKey(new Date()), locale).catch(() => undefined);')
    text = text.replace('  }, [alertsEnabled, locale, prayerTimes, phoneAlertPreferences]);', '  }, [alertsEnabled, islamicEventAlertsEnabled, locale, prayerTimes, phoneAlertPreferences]);')
    text = text.replace('      await scheduleIslamicEventReminders(todayKey, nextLocale).catch(() => undefined);', '      if (islamicEventAlertsEnabled) await scheduleIslamicEventReminders(todayKey, nextLocale).catch(() => undefined);')
    text = text.replace('      await scheduleIslamicEventReminders(todayKey, locale).catch(() => undefined);', '      if (islamicEventAlertsEnabled) await scheduleIslamicEventReminders(todayKey, locale).catch(() => undefined);')
    marker = '  const testNotification = async () => {'
    toggle = '''  const toggleIslamicEventAlerts = async (enabled: boolean) => {
    setIslamicEventAlertsEnabled(enabled);
    await AsyncStorage.setItem(ISLAMIC_EVENT_ALERTS_KEY, enabled ? "on" : "off");
    try {
      if (enabled) await scheduleIslamicEventReminders(todayKey, locale);
      else await cancelIslamicEventReminders();
    } catch (error) {
      const rollback = !enabled;
      setIslamicEventAlertsEnabled(rollback);
      await AsyncStorage.setItem(ISLAMIC_EVENT_ALERTS_KEY, rollback ? "on" : "off");
      Alert.alert(locale === "ar" ? "تعذر تحديث التنبيه" : "Could not update reminder", String(error));
    }
  };

'''
    if marker not in text: raise SystemExit("App test marker missing")
    text = text.replace(marker, toggle + marker, 1)
    text = text.replace('<Pressable onPress={onOpenEmailAlerts} disabled={!onOpenEmailAlerts} style={styles.emailCard}>', '<Pressable onPress={() => { if (onOpenEmailAlerts) onOpenEmailAlerts(); else Alert.alert(locale === "ar" ? "تنبيهات البريد غير متاحة" : "Email alerts unavailable", locale === "ar" ? "أعد فتح Hassoun وحاول مرة أخرى." : "Reopen Hassoun and try again."); }} style={styles.emailCard}>')
    old_event_card = '''      <Pressable onPress={() => setActiveTab("events")} style={styles.emailCard}>
        <View style={styles.emailIcon}><Text style={styles.emailEmoji}>🌙</Text></View><View style={styles.settingCopy}><Text style={styles.settingTitle}>{locale === "ar" ? "تنبيهات المناسبات الإسلامية" : "Islamic event reminders"}</Text><Text style={styles.settingText}>{locale === "ar" ? "إشعار قبل ١٥ يوماً من المناسبة الإسلامية القادمة." : "A reminder appears when the next Islamic event is 15 days away."}</Text></View><Text style={styles.settingArrow}>›</Text>
      </Pressable>'''
    new_event_card = '''      <View style={styles.emailCard}>
        <View style={styles.emailIcon}><Text style={styles.emailEmoji}>🌙</Text></View><View style={styles.settingCopy}><Text style={styles.settingTitle}>{locale === "ar" ? "تنبيهات المناسبات الإسلامية" : "Islamic event reminders"}</Text><Text style={styles.settingText}>{locale === "ar" ? "إشعار قبل ١٥ يوماً من المناسبة الإسلامية القادمة. شغّل أو أوقف التذكير من هنا." : "A reminder appears when the next Islamic event is 15 days away. Turn it on or off here."}</Text></View><Switch value={islamicEventAlertsEnabled} onValueChange={(value) => void toggleIslamicEventAlerts(value)} />
      </View>'''
    if old_event_card not in text: raise SystemExit("Islamic event alert card target missing")
    text = text.replace(old_event_card, new_event_card, 1)
    write(p, text)

# ---------------- Widget launch reuse ----------------
p = "mobile/modules/hassoun-widget/android/src/main/java/ca/wopt/hassounwidget/HassounPrayerWidgetProvider.kt"
text = read(p)
if "FLAG_ACTIVITY_SINGLE_TOP" not in text:
    text = text.replace('launch.flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP', 'launch.flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP')
    write(p, text)

# ---------------- Admin CRM ----------------
p = "pwa/app/admin/AdminControlCenter.tsx"
text = read(p)
if "sendEmailTest" not in text:
    text = text.replace('  const appUi = (settingMap.app_ui?.value ?? {}) as Record<string, unknown>;', '  const appUi = (settingMap.app_ui?.value ?? {}) as Record<string, unknown>;\n  const sadaqah = (settingMap.sadaqah_jariyah?.value ?? { enabled: true, donationEnabled: false, donationUrl: "", dedicationEn: "For Abdul Jalil Hassoun and Salwa Hassoun", dedicationAr: "عن عبد الجليل حسون وسلمى حسون" }) as Record<string, unknown>;')
    marker = '  if (!token || !admin) {'
    helpers = '''  const saveSadaqahPatch = (patch: Record<string, unknown>) => void saveSetting("sadaqah_jariyah", { ...sadaqah, ...patch });

  const sendEmailTest = async () => {
    if (!token || !admin) return;
    await run(async () => {
      await api("/admin/email/test", { method: "POST", body: JSON.stringify({ subjectEn: emailForm.subjectEn || "Hassoun test email", htmlEn: emailForm.htmlEn || "<p>This is a Hassoun admin email test.</p>", subjectAr: emailForm.subjectAr || undefined, htmlAr: emailForm.htmlAr || undefined, locale: emailForm.targetLocale === "ar" ? "ar" : "en" }) }, token);
    }, `Test email sent only to admin: ${admin.email}`);
  };

'''
    if marker not in text: raise SystemExit("Admin auth marker missing")
    text = text.replace(marker, helpers + marker, 1)
    text = text.replace('<div style={S.logo}>و</div>', '<img src="../assets/hassoun-logo.png" alt="Hassoun" style={{ width: 56, height: 56, objectFit: "contain" }} />')
    text = text.replace('<div style={S.logoSmall}>و</div>', '<img src="../assets/hassoun-logo.png" alt="Hassoun" style={{ width: 42, height: 42, objectFit: "contain" }} />')
    generic = '        <div style={S.twoCols}>{control.settings.filter((setting) => !["feature_flags", "app_ui"].includes(setting.key)).map((setting) =>'
    card = '        <Card title="Sadaqah Jariyah & donations" subtitle="Public dedication and donation link shown inside Hassoun"><div style={S.formGrid}><Toggle checked={sadaqah.enabled !== false} label="Show Sadaqah Jariyah section" onChange={(value) => saveSadaqahPatch({ enabled: value })} /><Toggle checked={sadaqah.donationEnabled === true} label="Enable donation button" onChange={(value) => saveSadaqahPatch({ donationEnabled: value })} /><Field label="Dedication (English)"><input defaultValue={String(sadaqah.dedicationEn || "For Abdul Jalil Hassoun and Salwa Hassoun")} onBlur={(event) => saveSadaqahPatch({ dedicationEn: event.target.value })} style={S.input} /></Field><Field label="Dedication (Arabic)"><input defaultValue={String(sadaqah.dedicationAr || "عن عبد الجليل حسون وسلمى حسون")} onBlur={(event) => saveSadaqahPatch({ dedicationAr: event.target.value })} style={S.input} /></Field><Field label="Donation URL"><input inputMode="url" placeholder="https://..." defaultValue={String(sadaqah.donationUrl || "")} onBlur={(event) => saveSadaqahPatch({ donationUrl: event.target.value.trim() })} style={S.input} /></Field><div style={S.muted}>This public setting is read by the Hassoun app. Leave the donation URL blank until the official destination is ready.</div></div></Card>\n'
    if generic not in text: raise SystemExit("Admin generic settings target missing")
    text = text.replace(generic, card + '        <div style={S.twoCols}>{control.settings.filter((setting) => !["feature_flags", "app_ui", "sadaqah_jariyah"].includes(setting.key)).map((setting) =>', 1)
    q = '<button style={S.primary}>Queue email</button></form>'
    if q not in text: raise SystemExit("Admin email queue button missing")
    text = text.replace(q, '<button style={S.primary}>Queue email</button><button type="button" onClick={() => void sendEmailTest()} disabled={busy} style={S.secondary}>Send test to admin only ({admin.email})</button></form>', 1)
    write(p, text)

# ---------------- Admin-only email test backend ----------------
p = "push-server/src/adminEmail.ts"
text = read(p)
if "sendAdminEmailTest" not in text:
    marker = 'export async function listAdminEmailCampaigns(request: Request, env: Env) {'
    fn = '''export async function sendAdminEmailTest(request: Request, env: Env) {
  const auth = await requireAdmin(request, env);
  if (!auth.admin) return auth.response!;
  const body = await bodyJson(request);
  const subjectEn = clean(body.subjectEn, 180) || "Hassoun admin test email";
  const htmlEn = clean(body.htmlEn, 50_000) || "<p>This is a Hassoun admin email test.</p>";
  const subjectAr = clean(body.subjectAr, 180);
  const htmlAr = clean(body.htmlAr, 50_000);
  const locale: Locale = body.locale === "ar" ? "ar" : "en";
  const publicId = crypto.randomUUID();
  const templateKey = `admin_test_${publicId.replace(/-/g, "")}`;
  const chosenHtml = locale === "ar" && htmlAr ? htmlAr : htmlEn;
  const textBody = chosenHtml.replace(/<[^>]+>/g, " ").replace(/\\s+/g, " ").trim().slice(0, 20_000);
  await env.DB.batch([
    env.DB.prepare(`INSERT INTO email_templates (template_key, name, category, subject_en, subject_ar, html_en, html_ar, text_en, text_ar, enabled) VALUES (?, ?, 'system', ?, ?, ?, ?, ?, ?, 1)`).bind(templateKey, "Admin-only test", subjectEn, subjectAr, htmlEn, htmlAr, textBody, textBody),
    env.DB.prepare(`INSERT INTO email_outbox (delivery_id, subscriber_id, recipient_email, locale, kind, template_key, template_data_json, idempotency_key) VALUES (NULL, NULL, ?, ?, 'system', ?, '{}', ?)`).bind(auth.admin.email, locale, templateKey, `admin-test:${publicId}`)
  ]);
  await logAdmin(env, auth.admin.id, "admin_email_test", publicId, { recipient: auth.admin.email, locale });
  return json({ ok: true, recipient: auth.admin.email, queued: true });
}

'''
    if marker not in text: raise SystemExit("adminEmail list marker missing")
    write(p, text.replace(marker, fn + marker, 1))

p = "push-server/src/index.ts"
text = read(p)
if "sendAdminEmailTest" not in text:
    text = text.replace('  refreshAdminEmailCampaignStatuses\n} from "./adminEmail";', '  refreshAdminEmailCampaignStatuses,\n  sendAdminEmailTest\n} from "./adminEmail";')
    old = '      } else if (request.method === "GET" && url.pathname === "/admin/email/campaigns") {\n        response = await listAdminEmailCampaigns(request, env);'
    new = old + '\n      } else if (request.method === "POST" && url.pathname === "/admin/email/test") {\n        response = await sendAdminEmailTest(request, env);\n        if (response.status < 300) await processEmailOutbox(env);'
    if old not in text: raise SystemExit("index email route marker missing")
    write(p, text.replace(old, new, 1))

# ---------------- Unified email header ----------------
p = "push-server/src/emailDelivery.ts"
text = read(p)
if "bodyHtml?: string" not in text:
    text = text.replace('function brandedEmail(options: { locale: Locale; eyebrow: string; title: string; intro: string; details?: Array<{ label: string; value: string }>; buttonLabel?: string; buttonUrl?: string; note?: string }) {', 'function brandedEmail(options: { locale: Locale; eyebrow: string; title: string; intro: string; bodyHtml?: string; details?: Array<{ label: string; value: string }>; buttonLabel?: string; buttonUrl?: string; note?: string }) {')
    target = '${escapeHtml(options.intro)}</p>${details ?'
    if target not in text: raise SystemExit("email branded body marker missing")
    text = text.replace(target, '${escapeHtml(options.intro)}</p>${options.bodyHtml ? `<div style="margin-top:18px;color:#355c52;font-size:14px;line-height:1.7">${options.bodyHtml}</div>` : ""}${details ?', 1)
    old = '  return { subject: applyTemplate(subjectSource, values, false), html: applyTemplate(htmlSource, values, true), text: applyTemplate(textSource, values, false) };'
    new = '  const subject = applyTemplate(subjectSource, values, false);\n  const bodyHtml = applyTemplate(htmlSource, values, true);\n  const text = applyTemplate(textSource, values, false);\n  return { subject, html: brandedEmail({ locale: row.locale, eyebrow: "HASSOUN", title: subject, intro: row.locale === "ar" ? "رسالة من Hassoun" : "A message from Hassoun", bodyHtml }), text };'
    if old not in text: raise SystemExit("email render return missing")
    write(p, text.replace(old, new, 1))

# ---------------- Release/version config ----------------
p = "mobile/app.config.ts"
text = read(p)
text = text.replace('version: "1.0.0"', 'version: "1.0.3"', 1).replace('versionCode: 41', 'versionCode: 44', 1)
if 'donationUrl:' not in text:
    text = text.replace('    pushApiUrl: process.env.EXPO_PUBLIC_PUSH_API_URL || "https://wopt-prayer-push.wopt-windsor.workers.dev",', '    pushApiUrl: process.env.EXPO_PUBLIC_PUSH_API_URL || "https://wopt-prayer-push.wopt-windsor.workers.dev",\n    donationUrl: process.env.EXPO_PUBLIC_HASSOUN_DONATION_URL || "",')
write(p, text)
for p in ["mobile/package.json", "mobile/package-lock.json"]:
    text = read(p)
    text = re.sub(r'("version"\s*:\s*")1\.0\.[01](")', r'\g<1>1.0.3\2', text, count=2 if p.endswith('lock.json') else 1)
    write(p, text)

print("Hassoun current-task v2 fixes applied")
