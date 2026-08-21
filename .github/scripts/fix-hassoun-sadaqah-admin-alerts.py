from pathlib import Path
import re


def replace(path, old, new, count=1):
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise SystemExit(f"Missing expected text in {path}: {old[:120]!r}")
    text = text.replace(old, new, count)
    p.write_text(text)


def insert_before(path, marker, addition):
    replace(path, marker, addition + marker)

# ---------------------------------------------------------------------------
# Android app branding, Sadaqah Jariyah and donation section.
# ---------------------------------------------------------------------------
settings = "mobile/src/SettingsHub.tsx"
replace(settings,
    'type SettingsPage = "root" | "about" | "contact" | "privacy" | "terms" | "data" | "permissions" | "widgets";',
    'type SettingsPage = "root" | "about" | "donation" | "contact" | "privacy" | "terms" | "data" | "permissions" | "widgets";')

replace(settings,
    '  const appVersion = Constants.expoConfig?.version ?? "0.5.0";\n',
    '  const appVersion = Constants.expoConfig?.version ?? "0.5.0";\n'
    '  const pushApiUrl = String(Constants.expoConfig?.extra?.pushApiUrl ?? "https://wopt-prayer-push.wopt-windsor.workers.dev");\n'
    '  const configuredDonationUrl = String(Constants.expoConfig?.extra?.donationUrl ?? "").trim();\n'
    '  const [sadaqahConfig, setSadaqahConfig] = useState<Record<string, unknown>>({\n'
    '    enabled: true, donationEnabled: Boolean(configuredDonationUrl), donationUrl: configuredDonationUrl,\n'
    '    dedicationEn: "For Abdul Jalil Hassoun and Salwa Hassoun", dedicationAr: "عن عبد الجليل حسون وسلمى حسون"\n'
    '  });\n')

replace(settings,
    '  useEffect(() => {\n    if (page !== "widgets") return;\n',
    '  useEffect(() => {\n'
    '    let active = true;\n'
    '    void fetch(`${pushApiUrl}/config`).then((response) => response.ok ? response.json() : null).then((payload) => {\n'
    '      const remote = payload?.control?.settings?.sadaqah_jariyah;\n'
    '      if (active && remote && typeof remote === "object") setSadaqahConfig((previous) => ({ ...previous, ...remote }));\n'
    '    }).catch(() => undefined);\n'
    '    return () => { active = false; };\n'
    '  }, [pushApiUrl]);\n\n'
    '  useEffect(() => {\n    if (page !== "widgets") return;\n')

root_marker = '      <Section title={t("PRIVACY & LEGAL", "الخصوصية والقانون")}>'
insert_before(settings, root_marker,
    '      <Section title={t("SADAQAH JARIYAH", "صدقة جارية")}>\n'
    '        <Row emoji="🤲" title={t("Sadaqah Jariyah & donations", "الصدقة الجارية والتبرع")} text={t("For Abdul Jalil Hassoun and Salwa Hassoun • Join the ongoing charity", "عن عبد الجليل حسون وسلمى حسون • شارك في الصدقة الجارية")} onPress={() => setPage("donation")} />\n'
    '      </Section>\n\n')

replace(settings,
    '<View style={styles.aboutHero}><Text style={styles.aboutMoon}>☪</Text><Text style={styles.aboutTitle}>Hassoun</Text><Text style={styles.aboutTagline}>{t("Prayer • Qur’an • Knowledge", "الصلاة • القرآن • المعرفة")}</Text><Text style={styles.version}>v{appVersion}</Text></View>',
    '<View style={styles.aboutHero}><Image source={require("../assets/hassoun-logo.png")} style={styles.aboutLogo} resizeMode="contain" /><Text style={styles.aboutTitle}>Hassoun</Text><Text style={styles.aboutTagline}>{t("Prayer • Qur’an • Knowledge", "الصلاة • القرآن • المعرفة")}</Text><Text style={styles.version}>v{appVersion}</Text></View>')

replace(settings,
    '        <LegalCard title={t("Our purpose", "هدفنا")}><Text style={styles.legalText}>{t("Hassoun brings prayer times, Adhan, Qur’an reading and listening, memorization tools and Islamic learning into one calm, easy-to-use experience.", "يجمع Hassoun مواقيت الصلاة والأذان وقراءة القرآن والاستماع إليه وأدوات الحفظ والتعلم الإسلامي في تجربة سهلة وواضحة.")}</Text></LegalCard>\n',
    '        <LegalCard title={t("Our purpose", "هدفنا")}><Text style={styles.legalText}>{t("Hassoun brings prayer times, Adhan, Qur’an reading and listening, memorization tools and Islamic learning into one calm, easy-to-use experience.", "يجمع Hassoun مواقيت الصلاة والأذان وقراءة القرآن والاستماع إليه وأدوات الحفظ والتعلم الإسلامي في تجربة سهلة وواضحة.")}</Text></LegalCard>\n'
    '        <LegalCard title={t("Sadaqah Jariyah", "صدقة جارية")}><Text style={styles.legalText}>{t("Hassoun is dedicated as Sadaqah Jariyah for Abdul Jalil Hassoun and Salwa Hassoun. We ask Allah to accept every prayer reminder, Qur’an verse read, lesson learned and beneficial use through this app as ongoing charity for them.", "تطبيق Hassoun مُهدى كصدقة جارية عن عبد الجليل حسون وسلمى حسون. نسأل الله أن يتقبل كل تذكير بالصلاة وكل آية تُقرأ وكل علم نافع واستفادة من هذا التطبيق في ميزان صدقتهما الجارية.")}</Text><Pressable onPress={() => setPage("donation")} style={styles.inlineButton}><Text style={styles.inlineButtonText}>{t("Be part of this Sadaqah Jariyah", "شارك في هذه الصدقة الجارية")}</Text></Pressable></LegalCard>\n')

permissions_marker = '  if (page === "permissions") {'
insert_before(settings, permissions_marker,
    '  if (page === "donation") {\n'
    '    const donationUrl = String(sadaqahConfig.donationUrl ?? configuredDonationUrl ?? "").trim();\n'
    '    const donationEnabled = sadaqahConfig.donationEnabled !== false && Boolean(donationUrl);\n'
    '    return (\n'
    '      <ScrollView style={styles.flex} contentContainerStyle={styles.content}>\n'
    '        <BackHeader title={t("Sadaqah Jariyah", "صدقة جارية")} onBack={() => setPage("root")} />\n'
    '        <View style={styles.aboutHero}><Image source={require("../assets/hassoun-logo.png")} style={styles.aboutLogo} resizeMode="contain" /><Text style={styles.aboutTitle}>Hassoun</Text><Text style={styles.aboutTagline}>{t("An ongoing charity", "صدقة جارية")}</Text></View>\n'
    '        <LegalCard title={t("For Abdul Jalil Hassoun & Salwa Hassoun", "عن عبد الجليل حسون وسلمى حسون")}><Text style={styles.legalText}>{t("This app is offered as Sadaqah Jariyah for Abdul Jalil Hassoun and Salwa Hassoun. May Allah accept it, multiply its benefit, and make every beneficial use a continuing reward for them.", "هذا التطبيق صدقة جارية عن عبد الجليل حسون وسلمى حسون. نسأل الله أن يتقبله ويضاعف نفعه وأن يجعل كل استفادة منه أجراً مستمراً لهما.")}</Text></LegalCard>\n'
    '        <LegalCard title={t("Join the Sadaqah", "شارك في الصدقة")}><Text style={styles.legalText}>{t("You can contribute a donation to help maintain and improve Hassoun so its prayer, Qur’an and learning tools can continue benefiting people.", "يمكنك المساهمة بتبرع للمساعدة في استمرار وتطوير Hassoun حتى تبقى أدوات الصلاة والقرآن والتعلم نافعة للناس.")}</Text>{donationEnabled ? <Pressable onPress={() => Linking.openURL(donationUrl)} style={styles.primaryButton}><Text style={styles.primaryButtonText}>{t("Donate as Sadaqah Jariyah", "تبرع كصدقة جارية")}</Text></Pressable> : <Text style={styles.formNote}>{t("The donation link is being prepared. The app will show the donation button automatically when it is enabled by Hassoun administration.", "يجري تجهيز رابط التبرع. سيظهر زر التبرع تلقائياً عند تفعيله من إدارة Hassoun.")}</Text>}</LegalCard>\n'
    '        <Text style={styles.formNote}>{t("Donations support the Hassoun project and its ongoing charitable purpose. They are voluntary and are not required to use the app.", "التبرعات تدعم مشروع Hassoun وهدفه كصدقة جارية، وهي اختيارية وليست مطلوبة لاستخدام التطبيق.")}</Text>\n'
    '      </ScrollView>\n'
    '    );\n'
    '  }\n\n')

replace(settings,
    '  aboutMoon: { color: "#f2cc72", fontSize: 45 },\n',
    '  aboutMoon: { color: "#f2cc72", fontSize: 45 },\n  aboutLogo: { width: 92, height: 92, marginBottom: 4 },\n')

# ---------------------------------------------------------------------------
# App startup: render cached/bundled schedule first, then network refresh.
# Alerts: make Islamic event reminders a real toggle instead of opening events.
# ---------------------------------------------------------------------------
prayer_data = "mobile/src/prayerData.ts"
replace(prayer_data,
    'export async function loadPrayerTimes(): Promise<{ prayerTimes: PrayerTimes; live: boolean }> {\n  const bundled = bundledSchedule as PrayerFile;\n  const cached = await AsyncStorage.getItem(STORAGE_KEYS.schedule);\n  let fallback = bundled.prayer_times;\n\n  if (cached) {\n    try {\n      const parsed = JSON.parse(cached) as unknown;\n      if (isPrayerFile(parsed)) fallback = parsed.prayer_times;\n    } catch {\n      await AsyncStorage.removeItem(STORAGE_KEYS.schedule);\n    }\n  }\n\n  try {',
    'export async function loadCachedPrayerTimes(): Promise<{ prayerTimes: PrayerTimes; live: false }> {\n  const bundled = bundledSchedule as PrayerFile;\n  const cached = await AsyncStorage.getItem(STORAGE_KEYS.schedule);\n  let fallback = bundled.prayer_times;\n  if (cached) {\n    try {\n      const parsed = JSON.parse(cached) as unknown;\n      if (isPrayerFile(parsed)) fallback = parsed.prayer_times;\n    } catch {\n      await AsyncStorage.removeItem(STORAGE_KEYS.schedule);\n    }\n  }\n  return { prayerTimes: fallback, live: false };\n}\n\nexport async function loadPrayerTimes(): Promise<{ prayerTimes: PrayerTimes; live: boolean }> {\n  const cached = await loadCachedPrayerTimes();\n  const fallback = cached.prayerTimes;\n\n  try {')

notifications = "mobile/src/notifications.ts"
insert_before(notifications, 'function notificationContent(event: PrayerEvent, locale: "en" | "ar") {',
    'export async function cancelIslamicEventReminders() {\n'
    '  const scheduled = await Notifications.getAllScheduledNotificationsAsync();\n'
    '  const islamic = scheduled.filter((request) => {\n'
    '    const data = request.content.data as Record<string, unknown> | null | undefined;\n'
    '    return data?.kind === ISLAMIC_EVENT_KIND;\n'
    '  });\n'
    '  await Promise.all(islamic.map((request) => Notifications.cancelScheduledNotificationAsync(request.identifier)));\n'
    '  await AsyncStorage.removeItem(ISLAMIC_EVENT_MARKER_KEY);\n'
    '}\n\n')

app = "mobile/App.tsx"
replace(app, 'import { loadPrayerTimes } from "./src/prayerData";', 'import { loadCachedPrayerTimes, loadPrayerTimes } from "./src/prayerData";')
replace(app, '  scheduleIslamicEventReminders,', '  cancelIslamicEventReminders,\n  scheduleIslamicEventReminders,')
replace(app, 'const NAMES:', 'const ISLAMIC_EVENT_ALERTS_KEY = "hassoun:islamic-event-alerts:v1";\n\nconst NAMES:')
replace(app,
    '  const [scheduledCount, setScheduledCount] = useState(0);',
    '  const [scheduledCount, setScheduledCount] = useState(0);\n  const [islamicEventAlertsEnabled, setIslamicEventAlertsEnabled] = useState(true);')

# Hydrate schedule as soon as possible before the existing remote load completes.
replace(app,
    '  useEffect(() => {\n    void (async () => {',
    '  useEffect(() => {\n    void loadCachedPrayerTimes().then((cached) => {\n      setPrayerTimes((current) => Object.keys(current).length ? current : cached.prayerTimes);\n      setLive(false);\n      setBusy(false);\n    }).catch(() => setBusy(false));\n    void AsyncStorage.getItem(ISLAMIC_EVENT_ALERTS_KEY).then((saved) => setIslamicEventAlertsEnabled(saved !== "off")).catch(() => undefined);\n    void (async () => {',
    1)

# Only schedule Islamic events when the dedicated toggle is enabled.
replace(app,
    '      await scheduleIslamicEventReminders(todayKey, locale).catch(() => undefined);',
    '      const eventAlerts = await AsyncStorage.getItem(ISLAMIC_EVENT_ALERTS_KEY).catch(() => null);\n      if (eventAlerts !== "off") await scheduleIslamicEventReminders(todayKey, locale).catch(() => undefined);')

insert_before(app, '  const testNotification = async () => {',
    '  const toggleIslamicEventAlerts = async (enabled: boolean) => {\n'
    '    setIslamicEventAlertsEnabled(enabled);\n'
    '    await AsyncStorage.setItem(ISLAMIC_EVENT_ALERTS_KEY, enabled ? "on" : "off");\n'
    '    try {\n'
    '      if (enabled) await scheduleIslamicEventReminders(todayKey, locale);\n'
    '      else await cancelIslamicEventReminders();\n'
    '    } catch (error) {\n'
    '      setIslamicEventAlertsEnabled(!enabled);\n'
    '      await AsyncStorage.setItem(ISLAMIC_EVENT_ALERTS_KEY, !enabled ? "on" : "off");\n'
    '      Alert.alert(locale === "ar" ? "تعذر تحديث التنبيه" : "Could not update reminder", String(error));\n'
    '    }\n'
    '  };\n\n')

replace(app,
    '      <Pressable onPress={() => setActiveTab("events")} style={styles.emailCard}>\n        <View style={styles.emailIcon}><Text style={styles.emailEmoji}>🌙</Text></View><View style={styles.settingCopy}><Text style={styles.settingTitle}>{locale === "ar" ? "تنبيهات المناسبات الإسلامية" : "Islamic event reminders"}</Text><Text style={styles.settingText}>{locale === "ar" ? "إشعار قبل ١٥ يوماً من المناسبة الإسلامية القادمة." : "A reminder appears when the next Islamic event is 15 days away."}</Text></View><Text style={styles.settingArrow}>›</Text>\n      </Pressable>',
    '      <View style={styles.emailCard}>\n        <View style={styles.emailIcon}><Text style={styles.emailEmoji}>🌙</Text></View><View style={styles.settingCopy}><Text style={styles.settingTitle}>{locale === "ar" ? "تنبيهات المناسبات الإسلامية" : "Islamic event reminders"}</Text><Text style={styles.settingText}>{locale === "ar" ? "إشعار قبل ١٥ يوماً من المناسبة الإسلامية القادمة. هذا المفتاح يشغّل أو يوقف التذكير مباشرة." : "A reminder appears when the next Islamic event is 15 days away. This switch controls it directly."}</Text></View><Switch value={islamicEventAlertsEnabled} onValueChange={(value) => void toggleIslamicEventAlerts(value)} />\n      </View>')

replace(app,
    '<Pressable onPress={onOpenEmailAlerts} disabled={!onOpenEmailAlerts} style={styles.emailCard}>',
    '<Pressable onPress={() => { if (onOpenEmailAlerts) onOpenEmailAlerts(); else Alert.alert(locale === "ar" ? "تنبيهات البريد غير متاحة" : "Email alerts unavailable", locale === "ar" ? "أعد فتح Hassoun وحاول مرة أخرى." : "Reopen Hassoun and try again."); }} style={styles.emailCard}>')

# Widget launches reuse an existing activity instead of rebuilding it.
widget = "mobile/modules/hassoun-widget/android/src/main/java/ca/wopt/hassounwidget/HassounPrayerWidgetProvider.kt"
replace(widget,
    '      launch.flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP',
    '      launch.flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP')

# ---------------------------------------------------------------------------
# Admin CRM: Sadaqah controls, real logo, admin-only email test.
# ---------------------------------------------------------------------------
admin = "pwa/app/admin/AdminControlCenter.tsx"
replace(admin,
    '  const appUi = (settingMap.app_ui?.value ?? {}) as Record<string, unknown>;',
    '  const appUi = (settingMap.app_ui?.value ?? {}) as Record<string, unknown>;\n  const sadaqah = (settingMap.sadaqah_jariyah?.value ?? { enabled: true, donationEnabled: false, donationUrl: "", dedicationEn: "For Abdul Jalil Hassoun and Salwa Hassoun", dedicationAr: "عن عبد الجليل حسون وسلمى حسون" }) as Record<string, unknown>;')

insert_before(admin, '  if (!token || !admin) {',
    '  const saveSadaqahPatch = (patch: Record<string, unknown>) => void saveSetting("sadaqah_jariyah", { ...sadaqah, ...patch });\n\n'
    '  const sendEmailTest = async () => {\n'
    '    if (!token || !admin) return;\n'
    '    await run(async () => {\n'
    '      await api("/admin/email/test", { method: "POST", body: JSON.stringify({ subjectEn: emailForm.subjectEn || "Hassoun test email", htmlEn: emailForm.htmlEn || "<p>This is a Hassoun admin email test.</p>", subjectAr: emailForm.subjectAr || undefined, htmlAr: emailForm.htmlAr || undefined, locale: emailForm.targetLocale === "ar" ? "ar" : "en" }) }, token);\n'
    '    }, `Test email sent only to admin: ${admin.email}`);\n'
    '  };\n\n')

replace(admin, '<div style={S.logo}>و</div>', '<img src="../assets/hassoun-logo.png" alt="Hassoun" style={{ width: 56, height: 56, objectFit: "contain" }} />')
replace(admin, '<div style={S.logoSmall}>و</div>', '<img src="../assets/hassoun-logo.png" alt="Hassoun" style={{ width: 42, height: 42, objectFit: "contain" }} />')

control_marker = '        <Card title="Maintenance & global announcement" subtitle="Emergency app-wide controls">'
# Insert after maintenance card by targeting the next generic settings div.
replace(admin,
    '        <div style={S.twoCols}>{control.settings.filter((setting) => !["feature_flags", "app_ui"].includes(setting.key)).map((setting) =>',
    '        <Card title="Sadaqah Jariyah & donations" subtitle="Public dedication and donation link shown inside Hassoun"><div style={S.formGrid}><Toggle checked={sadaqah.enabled !== false} label="Show Sadaqah Jariyah section" onChange={(value) => saveSadaqahPatch({ enabled: value })} /><Toggle checked={sadaqah.donationEnabled === true} label="Enable donation button" onChange={(value) => saveSadaqahPatch({ donationEnabled: value })} /><Field label="Dedication (English)"><input defaultValue={String(sadaqah.dedicationEn || "For Abdul Jalil Hassoun and Salwa Hassoun")} onBlur={(event) => saveSadaqahPatch({ dedicationEn: event.target.value })} style={S.input} /></Field><Field label="Dedication (Arabic)"><input defaultValue={String(sadaqah.dedicationAr || "عن عبد الجليل حسون وسلمى حسون")} onBlur={(event) => saveSadaqahPatch({ dedicationAr: event.target.value })} style={S.input} /></Field><Field label="Donation URL"><input inputMode="url" placeholder="https://..." defaultValue={String(sadaqah.donationUrl || "")} onBlur={(event) => saveSadaqahPatch({ donationUrl: event.target.value.trim() })} style={S.input} /></Field><div style={S.muted}>The app reads this public setting from the Hassoun control API. Leave the donation URL blank until the official destination is ready.</div></div></Card>\n'
    '        <div style={S.twoCols}>{control.settings.filter((setting) => !["feature_flags", "app_ui", "sadaqah_jariyah"].includes(setting.key)).map((setting) =>')

replace(admin,
    '<button style={S.primary}>Queue email</button></form>',
    '<button style={S.primary}>Queue email</button><button type="button" onClick={() => void sendEmailTest()} disabled={busy} style={S.secondary}>Send test to admin only ({admin.email})</button></form>')

# ---------------------------------------------------------------------------
# Worker: protected admin-only test route and unified branded email header.
# ---------------------------------------------------------------------------
admin_email = "push-server/src/adminEmail.ts"
insert_before(admin_email, 'export async function listAdminEmailCampaigns(request: Request, env: Env) {',
    'export async function sendAdminEmailTest(request: Request, env: Env) {\n'
    '  const auth = await requireAdmin(request, env);\n'
    '  if (!auth.admin) return auth.response!;\n'
    '  const body = await bodyJson(request);\n'
    '  const subjectEn = clean(body.subjectEn, 180) || "Hassoun admin test email";\n'
    '  const htmlEn = clean(body.htmlEn, 50_000) || "<p>This is a Hassoun admin email test.</p>";\n'
    '  const subjectAr = clean(body.subjectAr, 180);\n'
    '  const htmlAr = clean(body.htmlAr, 50_000);\n'
    '  const locale: Locale = body.locale === "ar" ? "ar" : "en";\n'
    '  const publicId = crypto.randomUUID();\n'
    '  const templateKey = `admin_test_${publicId.replace(/-/g, "")}`;\n'
    '  const subject = locale === "ar" && subjectAr ? subjectAr : subjectEn;\n'
    '  const html = locale === "ar" && htmlAr ? htmlAr : htmlEn;\n'
    '  const text = html.replace(/<[^>]+>/g, " ").replace(/\\s+/g, " ").trim().slice(0, 20_000);\n'
    '  await env.DB.batch([\n'
    '    env.DB.prepare(`INSERT INTO email_templates (template_key, name, category, subject_en, subject_ar, html_en, html_ar, text_en, text_ar, enabled) VALUES (?, ?, \'system\', ?, ?, ?, ?, ?, ?, 1)`).bind(templateKey, "Admin-only test", subjectEn, subjectAr, htmlEn, htmlAr, text, text),\n'
    '    env.DB.prepare(`INSERT INTO email_outbox (delivery_id, subscriber_id, recipient_email, locale, kind, template_key, template_data_json, idempotency_key) VALUES (NULL, NULL, ?, ?, \'system\', ?, \'{}\', ?)`).bind(auth.admin.email, locale, templateKey, `admin-test:${publicId}`)\n'
    '  ]);\n'
    '  await logAdmin(env, auth.admin.id, "admin_email_test", publicId, { recipient: auth.admin.email, locale });\n'
    '  return json({ ok: true, recipient: auth.admin.email, queued: true, subject });\n'
    '}\n\n')

index = "push-server/src/index.ts"
replace(index,
    '  refreshAdminEmailCampaignStatuses\n} from "./adminEmail";',
    '  refreshAdminEmailCampaignStatuses,\n  sendAdminEmailTest\n} from "./adminEmail";')
replace(index,
    '      } else if (request.method === "GET" && url.pathname === "/admin/email/campaigns") {\n        response = await listAdminEmailCampaigns(request, env);',
    '      } else if (request.method === "GET" && url.pathname === "/admin/email/campaigns") {\n        response = await listAdminEmailCampaigns(request, env);\n      } else if (request.method === "POST" && url.pathname === "/admin/email/test") {\n        response = await sendAdminEmailTest(request, env);\n        if (response.status < 300) await processEmailOutbox(env);')

email_delivery = "push-server/src/emailDelivery.ts"
replace(email_delivery,
    'function brandedEmail(options: { locale: Locale; eyebrow: string; title: string; intro: string; details?: Array<{ label: string; value: string }>; buttonLabel?: string; buttonUrl?: string; note?: string }) {',
    'function brandedEmail(options: { locale: Locale; eyebrow: string; title: string; intro: string; bodyHtml?: string; details?: Array<{ label: string; value: string }>; buttonLabel?: string; buttonUrl?: string; note?: string }) {')
replace(email_delivery,
    '${escapeHtml(options.intro)}</p>${details ?',
    '${escapeHtml(options.intro)}</p>${options.bodyHtml ? `<div style="margin-top:18px;color:#355c52;font-size:14px;line-height:1.7">${options.bodyHtml}</div>` : ""}${details ?')
replace(email_delivery,
    '  return { subject: applyTemplate(subjectSource, values, false), html: applyTemplate(htmlSource, values, true), text: applyTemplate(textSource, values, false) };',
    '  const subject = applyTemplate(subjectSource, values, false);\n  const bodyHtml = applyTemplate(htmlSource, values, true);\n  const text = applyTemplate(textSource, values, false);\n  return { subject, html: brandedEmail({ locale: row.locale, eyebrow: "HASSOUN", title: subject, intro: row.locale === "ar" ? "رسالة من Hassoun" : "A message from Hassoun", bodyHtml }), text };')

# ---------------------------------------------------------------------------
# Version and configurable donation URL.
# ---------------------------------------------------------------------------
config = "mobile/app.config.ts"
replace(config, '  version: "1.0.0",', '  version: "1.0.3",')
replace(config, '    versionCode: 41,', '    versionCode: 44,')
replace(config,
    '    pushApiUrl: process.env.EXPO_PUBLIC_PUSH_API_URL || "https://wopt-prayer-push.wopt-windsor.workers.dev",',
    '    pushApiUrl: process.env.EXPO_PUBLIC_PUSH_API_URL || "https://wopt-prayer-push.wopt-windsor.workers.dev",\n    donationUrl: process.env.EXPO_PUBLIC_HASSOUN_DONATION_URL || "",')

# Keep package version aligned if it is still 1.0.0/1.0.1.
for package_path in ["mobile/package.json", "mobile/package-lock.json"]:
    p = Path(package_path)
    text = p.read_text()
    text = re.sub(r'("version"\s*:\s*")1\.0\.[01](")', r'\g<1>1.0.3\2', text, count=2 if package_path.endswith("lock.json") else 1)
    p.write_text(text)

print("Applied Hassoun Sadaqah, donation, admin email, mobile CRM, alert and widget launch fixes.")
