import Constants from "expo-constants";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View
} from "react-native";
import HassounWidget, { type HassounWidgetLayout, type HassounWidgetPreferences } from "../modules/hassoun-widget";
import { ReaderSettingsSheet, useQuranAppearance } from "./quran/quranRendering";
import { submitSupportMessage } from "./support";

type SettingsPage = "root" | "about" | "contact" | "privacy" | "terms" | "data" | "permissions" | "widgets";

type Props = {
  locale: "en" | "ar";
  onToggleLocale: () => void;
  onOpenAlerts: () => void;
  onOpenEmailAlerts?: () => void;
};

const PUBLIC_BASE = "https://hassoun911.github.io/WOPT";

function Row({ emoji, title, text, onPress }: { emoji: string; title: string; text: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.row}>
      <View style={styles.rowIcon}><Text style={styles.rowEmoji}>{emoji}</Text></View>
      <View style={styles.rowCopy}><Text style={styles.rowTitle}>{title}</Text><Text style={styles.rowText}>{text}</Text></View>
      <Text style={styles.arrow}>›</Text>
    </Pressable>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <View style={styles.section}><Text style={styles.sectionLabel}>{title}</Text>{children}</View>;
}

function BackHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <View style={styles.subHeader}>
      <Pressable onPress={onBack} style={styles.backButton}><Text style={styles.backText}>‹</Text></Pressable>
      <Text style={styles.subHeaderTitle}>{title}</Text>
    </View>
  );
}

function LegalCard({ title, children }: { title: string; children: React.ReactNode }) {
  return <View style={styles.legalCard}><Text style={styles.legalTitle}>{title}</Text><View style={styles.legalBody}>{children}</View></View>;
}

export default function SettingsHub({ locale, onToggleLocale, onOpenAlerts, onOpenEmailAlerts }: Props) {
  const ar = locale === "ar";
  const t = (en: string, arabic: string) => ar ? arabic : en;
  const [page, setPage] = useState<SettingsPage>("root");
  const [readerOpen, setReaderOpen] = useState(false);
  const { appearance, setAppearance, reset } = useQuranAppearance();
  const appVersion = Constants.expoConfig?.version ?? "0.5.0";

  const [widgetPrefs, setWidgetPrefs] = useState<HassounWidgetPreferences>(() => ({ ...HassounWidget.getPreferences(), locale }));
  const widgetCapabilities = useMemo(() => HassounWidget.getCapabilities(), [page]);

  useEffect(() => {
    const next = { ...HassounWidget.getPreferences(), locale };
    setWidgetPrefs(next);
    HassounWidget.setPreferences(next);
  }, [locale]);

  const updateWidget = (patch: Partial<HassounWidgetPreferences>) => {
    setWidgetPrefs((previous) => {
      const next = { ...previous, ...patch, locale };
      HassounWidget.setPreferences(next);
      return next;
    });
  };

  const root = (
    <ScrollView style={styles.flex} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Text style={styles.eyebrow}>⚙️ HASSOUN</Text>
      <Text style={styles.title}>{t("Settings & Support", "الإعدادات والدعم")}</Text>
      <Text style={styles.subtitle}>{t("Reading, widgets, alerts, privacy and help in one place.", "إعدادات القراءة والويدجت والتنبيهات والخصوصية والدعم في مكان واحد.")}</Text>

      <Section title={t("APP SETTINGS", "إعدادات التطبيق")}>
        <Row emoji="📖" title={t("Qur’an reading", "إعدادات قراءة القرآن")} text={t("Font, Tajweed, page browsing, layout, size and colors", "الخط والتجويد والتنقل وشكل الصفحات والحجم والألوان")} onPress={() => setReaderOpen(true)} />
        <Row emoji="🧩" title={t("Widgets", "الويدجت")} text={t("Choose layout and what appears on home and supported lock screens", "اختر التصميم والمعلومات التي تظهر على الشاشة الرئيسية وشاشة القفل المدعومة")} onPress={() => setPage("widgets")} />
        <Row emoji="🔔" title={t("Prayer & Adhan alerts", "تنبيهات الصلاة والأذان")} text={t("Notification, Adhan and email alert controls", "التحكم بالتنبيهات والأذان وتنبيهات البريد")} onPress={onOpenAlerts} />
        <Row emoji="🌐" title={t("Language", "اللغة")} text={t("Switch to Arabic", "التبديل إلى الإنجليزية")} onPress={onToggleLocale} />
      </Section>

      <Section title={t("HELP & SUPPORT", "المساعدة والدعم")}>
        <Row emoji="✉️" title={t("Contact us", "اتصل بنا")} text={t("Send Hassoun support a message from inside the app", "أرسل رسالة إلى دعم Hassoun من داخل التطبيق")} onPress={() => setPage("contact")} />
        <Row emoji="🔐" title={t("Permissions", "الأذونات")} text={t("Why Hassoun requests location, notifications, alarms and microphone", "لماذا يطلب Hassoun الموقع والتنبيهات والمنبهات والميكروفون")} onPress={() => setPage("permissions")} />
        <Row emoji="ℹ️" title={t("About Hassoun", "حول Hassoun")} text={t(`Version ${appVersion} • Prayer • Qur’an • Knowledge`, `الإصدار ${appVersion} • الصلاة • القرآن • المعرفة`)} onPress={() => setPage("about")} />
      </Section>

      <Section title={t("PRIVACY & LEGAL", "الخصوصية والقانون")}>
        <Row emoji="🛡️" title={t("Privacy Policy", "سياسة الخصوصية")} text={t("What data Hassoun uses and how it is protected", "ما البيانات التي يستخدمها Hassoun وكيف تتم حمايتها")} onPress={() => setPage("privacy")} />
        <Row emoji="🧾" title={t("Terms of Use", "شروط الاستخدام")} text={t("Important terms for prayer times, Qur’an tools and app use", "شروط مهمة لمواقيت الصلاة وأدوات القرآن واستخدام التطبيق")} onPress={() => setPage("terms")} />
        <Row emoji="🗂️" title={t("Data & privacy choices", "خيارات البيانات والخصوصية")} text={t("Email subscriptions, local data and deletion choices", "اشتراكات البريد والبيانات المحلية وخيارات الحذف")} onPress={() => setPage("data")} />
      </Section>

      <Text style={styles.footer}>Hassoun • v{appVersion}</Text>

      <ReaderSettingsSheet visible={readerOpen} locale={locale} appearance={appearance} setAppearance={setAppearance} reset={reset} onDone={() => setReaderOpen(false)} />
    </ScrollView>
  );

  if (page === "root") return root;

  if (page === "widgets") {
    return (
      <ScrollView style={styles.flex} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <BackHeader title={t("Widgets", "الويدجت")} onBack={() => setPage("root")} />
        <Text style={styles.subtitle}>{t("Choose a default Hassoun widget layout. The same responsive widget can be resized on phones, tablets and foldables.", "اختر التصميم الافتراضي لويدجت Hassoun. يمكن تغيير حجمه على الهواتف والأجهزة اللوحية والقابلة للطي.")}</Text>

        <Text style={styles.sectionLabel}>{t("WIDGET LAYOUT", "تصميم الويدجت")}</Text>
        <View style={styles.layoutGrid}>
          {([
            ["compact", "◼", t("Compact", "مصغر"), t("Next prayer + countdown", "الصلاة القادمة والعد التنازلي")],
            ["next", "▰", t("Prayer card", "بطاقة الصلاة"), t("Dates + next prayer", "التاريخ والصلاة القادمة")],
            ["full", "▦", t("Full day", "اليوم كامل"), t("Next prayer + all five", "الصلاة القادمة والصلوات الخمس")]
          ] as Array<[HassounWidgetLayout, string, string, string]>).map(([layout, icon, label, note]) => (
            <Pressable key={layout} onPress={() => updateWidget({ layout })} style={[styles.layoutChoice, widgetPrefs.layout === layout && styles.layoutChoiceActive]}>
              <Text style={styles.layoutIcon}>{icon}</Text><Text style={styles.layoutTitle}>{label}</Text><Text style={styles.layoutNote}>{note}</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.widgetPreview}>
          <Text style={styles.widgetPreviewBrand}>HASSOUN • {t("NEXT PRAYER", "الصلاة القادمة")}</Text>
          <View style={styles.widgetPreviewRow}><Text style={styles.widgetPreviewPrayer}>{t("Fajr", "الفجر")}</Text><Text style={styles.widgetPreviewTime}>5:06 a.m.</Text></View>
          {widgetPrefs.showCountdown ? <Text style={styles.widgetPreviewCountdown}>⏳ 3h 46m left</Text> : null}
          {widgetPrefs.layout !== "compact" && widgetPrefs.showHijri ? <Text style={styles.widgetPreviewMeta}>🌙 Rabiʿ I 4, 1448 AH</Text> : null}
          {widgetPrefs.layout === "full" && widgetPrefs.showAllPrayers ? <Text style={styles.widgetPreviewList}>Fajr 5:06  •  Dhuhr 1:36  •  Asr 5:26{`\n`}Maghrib 8:32  •  Isha 9:55</Text> : null}
        </View>

        <Text style={styles.sectionLabel}>{t("SHOW ON WIDGET", "إظهار على الويدجت")}</Text>
        {([
          ["showCountdown", t("Live countdown", "العد التنازلي المباشر")],
          ["showHijri", t("Hijri date", "التاريخ الهجري")],
          ["showGregorian", t("Gregorian date", "التاريخ الميلادي")],
          ["showAllPrayers", t("All five prayer times", "مواقيت الصلوات الخمس")],
          ["showLocation", t("Location", "الموقع")]
        ] as Array<[keyof HassounWidgetPreferences, string]>).map(([key, label]) => (
          <View key={key} style={styles.toggleRow}><Text style={styles.toggleLabel}>{label}</Text><Switch value={Boolean(widgetPrefs[key])} onValueChange={(value) => updateWidget({ [key]: value } as Partial<HassounWidgetPreferences>)} trackColor={{ false: "#d6dbd8", true: "#8cc9b7" }} thumbColor={Boolean(widgetPrefs[key]) ? "#0b7057" : "#fff"} /></View>
        ))}

        <Pressable onPress={() => {
          const ok = HassounWidget.requestPin();
          if (!ok) Alert.alert(t("Widget picker", "اختيار الويدجت"), t("Your launcher does not support adding a widget directly. Touch and hold the Home screen, choose Widgets, then choose Hassoun.", "مشغل هاتفك لا يدعم إضافة الويدجت مباشرة. اضغط مطولاً على الشاشة الرئيسية ثم اختر الويدجت ثم Hassoun."));
        }} style={styles.primaryButton}>
          <Text style={styles.primaryButtonText}>＋ {t("Add Hassoun widget", "إضافة ويدجت Hassoun")}</Text>
        </Pressable>
        <Pressable onPress={() => HassounWidget.refresh()} style={styles.secondaryButton}><Text style={styles.secondaryButtonText}>↻ {t("Refresh widgets", "تحديث الويدجت")}</Text></Pressable>

        <LegalCard title={t("🔒 Lock-screen widget", "🔒 ويدجت شاشة القفل") }>
          <Text style={styles.legalText}>{widgetCapabilities.lockScreenEligible
            ? t("This Hassoun widget is marked as lock-screen eligible on supported Android 16+/17 devices. Add it from your phone’s Lock screen customization screen. Samsung/other manufacturers decide where lock-screen widgets are offered.", "تم تجهيز ويدجت Hassoun للعمل على شاشة القفل في أجهزة Android 16+/17 المدعومة. أضفه من إعدادات تخصيص شاشة القفل. تحدد Samsung والشركات الأخرى مكان توفر ويدجت شاشة القفل.")
            : t("Your current Android version does not expose the new lock-screen widget host. The same Hassoun widget will still work on the Home screen.", "إصدار Android الحالي لا يوفر نظام ويدجت شاشة القفل الجديد. سيعمل نفس ويدجت Hassoun على الشاشة الرئيسية.")}</Text>
        </LegalCard>
      </ScrollView>
    );
  }

  if (page === "contact") return <ContactPage locale={locale} version={appVersion} onBack={() => setPage("root")} />;

  if (page === "about") {
    return (
      <ScrollView style={styles.flex} contentContainerStyle={styles.content}>
        <BackHeader title={t("About Hassoun", "حول Hassoun")} onBack={() => setPage("root")} />
        <View style={styles.aboutHero}><Text style={styles.aboutMoon}>☪</Text><Text style={styles.aboutTitle}>Hassoun</Text><Text style={styles.aboutTagline}>{t("Prayer • Qur’an • Knowledge", "الصلاة • القرآن • المعرفة")}</Text><Text style={styles.version}>v{appVersion}</Text></View>
        <LegalCard title={t("Our purpose", "هدفنا")}><Text style={styles.legalText}>{t("Hassoun brings prayer times, Adhan, Qur’an reading and listening, memorization tools and Islamic learning into one calm, easy-to-use experience.", "يجمع Hassoun مواقيت الصلاة والأذان وقراءة القرآن والاستماع إليه وأدوات الحفظ والتعلم الإسلامي في تجربة سهلة وواضحة.")}</Text></LegalCard>
        <LegalCard title={t("Sources", "المصادر")}><Text style={styles.legalText}>{t("Windsor prayer times use the official Windsor Islamic Association schedule. Qur’an text and recitation features use verified Qur’anic data and recognized public Qur’an services where indicated in the app.", "تستخدم مواقيت وندسور الجدول الرسمي لجمعية وندسور الإسلامية. تستخدم ميزات نص القرآن والتلاوة بيانات قرآنية موثقة وخدمات قرآن عامة معروفة حيث يشار إليها داخل التطبيق.")}</Text></LegalCard>
      </ScrollView>
    );
  }

  if (page === "permissions") {
    return (
      <ScrollView style={styles.flex} contentContainerStyle={styles.content}>
        <BackHeader title={t("Permissions", "الأذونات")} onBack={() => setPage("root")} />
        <LegalCard title={t("📍 Location", "📍 الموقع")}><Text style={styles.legalText}>{t("Used to select local prayer times and the correct time zone for optional email alerts. Hassoun should still offer manual/local schedule options when location is not granted.", "يستخدم لاختيار مواقيت الصلاة المحلية والمنطقة الزمنية الصحيحة لتنبيهات البريد الاختيارية. يجب أن تبقى الخيارات اليدوية والمحلية متاحة عند عدم منح إذن الموقع.")}</Text></LegalCard>
        <LegalCard title={t("🔔 Notifications & exact alarms", "🔔 التنبيهات والمنبهات الدقيقة")}><Text style={styles.legalText}>{t("Used for 20-minute and 10-minute reminders and for starting the native Adhan at prayer time, including while the screen is locked.", "تستخدم لتنبيهات 20 و10 دقائق وتشغيل الأذان الأصلي في وقت الصلاة حتى عند قفل الشاشة.")}</Text></LegalCard>
        <LegalCard title={t("🎙️ Microphone", "🎙️ الميكروفون")}><Text style={styles.legalText}>{t("Used only when you choose recitation practice. Hassoun uses the device’s Android speech-recognition service to compare your recitation; Hassoun does not intentionally upload or store raw microphone recordings on its own server.", "يستخدم فقط عند اختيار تدريب التلاوة. يستخدم Hassoun خدمة التعرف على الكلام في Android لمقارنة التلاوة ولا يقوم Hassoun عمداً برفع أو تخزين تسجيلات الميكروفون الخام على خادمه.")}</Text></LegalCard>
      </ScrollView>
    );
  }

  if (page === "data") {
    return (
      <ScrollView style={styles.flex} contentContainerStyle={styles.content}>
        <BackHeader title={t("Data & privacy choices", "خيارات البيانات والخصوصية")} onBack={() => setPage("root")} />
        <LegalCard title={t("No Hassoun account required", "لا يلزم حساب Hassoun")}><Text style={styles.legalText}>{t("The core app does not require you to create or sign in to a Hassoun account. Reading preferences, bookmarks and memorization progress are primarily stored on your device.", "لا يتطلب التطبيق الأساسي إنشاء حساب Hassoun أو تسجيل الدخول. يتم حفظ تفضيلات القراءة والإشارات المرجعية وتقدم الحفظ بشكل أساسي على جهازك.")}</Text></LegalCard>
        <LegalCard title={t("Prayer email alerts", "تنبيهات الصلاة عبر البريد")}><Text style={styles.legalText}>{t("If you subscribe to prayer emails, Hassoun stores the email address, alert choices and prayer-location information needed to deliver those emails. You can manage or unsubscribe using the secure email-management flow.", "إذا اشتركت في تنبيهات الصلاة عبر البريد، يحفظ Hassoun البريد وخيارات التنبيه ومعلومات موقع الصلاة اللازمة للإرسال. يمكنك إدارة الاشتراك أو إلغاؤه من خلال مسار إدارة البريد الآمن.")}</Text>{onOpenEmailAlerts ? <Pressable onPress={onOpenEmailAlerts} style={styles.inlineButton}><Text style={styles.inlineButtonText}>{t("Manage prayer emails", "إدارة تنبيهات البريد")}</Text></Pressable> : null}</LegalCard>
        <Pressable onPress={() => Linking.openURL(`${PUBLIC_BASE}/privacy-choices/`)} style={styles.secondaryButton}><Text style={styles.secondaryButtonText}>{t("Open public privacy choices page", "فتح صفحة خيارات الخصوصية")}</Text></Pressable>
      </ScrollView>
    );
  }

  if (page === "privacy") {
    return (
      <ScrollView style={styles.flex} contentContainerStyle={styles.content}>
        <BackHeader title={t("Privacy Policy", "سياسة الخصوصية")} onBack={() => setPage("root")} />
        <Text style={styles.updated}>{t("Effective: August 17, 2026", "سارية من: 17 أغسطس 2026")}</Text>
        <LegalCard title={t("Information Hassoun uses", "المعلومات التي يستخدمها Hassoun")}><Text style={styles.legalText}>{t("Depending on the features you choose, Hassoun may process location, push-notification tokens, prayer email address and preferences, support-form contact details, Qur’an reading settings, bookmarks and memorization progress. Microphone access is only requested for recitation practice.", "بحسب الميزات التي تختارها، قد يعالج Hassoun الموقع ورموز التنبيه والبريد وخيارات تنبيهات الصلاة وبيانات نموذج الدعم وإعدادات قراءة القرآن والإشارات المرجعية وتقدم الحفظ. يطلب الميكروفون فقط لتدريب التلاوة.")}</Text></LegalCard>
        <LegalCard title={t("How information is used", "كيفية استخدام المعلومات")}><Text style={styles.legalText}>{t("Data is used to provide prayer times and alerts, synchronize optional email reminders, operate Qur’an and memorization features, respond to support requests, protect the service and maintain reliability. Hassoun does not sell personal information and does not use personal information for third-party advertising.", "تستخدم البيانات لتوفير مواقيت الصلاة والتنبيهات ومزامنة تنبيهات البريد الاختيارية وتشغيل ميزات القرآن والحفظ والرد على طلبات الدعم وحماية الخدمة والمحافظة على موثوقيتها. لا يبيع Hassoun المعلومات الشخصية ولا يستخدمها لإعلانات أطراف ثالثة.")}</Text></LegalCard>
        <LegalCard title={t("Service providers", "مزودو الخدمات")}><Text style={styles.legalText}>{t("Hassoun may rely on platform and infrastructure providers such as Expo push services, Cloudflare, Resend email delivery, Android speech recognition and Qur’an/prayer-data services. Only information needed for the selected feature is sent to those services.", "قد يعتمد Hassoun على خدمات البنية والمنصة مثل Expo للتنبيهات وCloudflare وResend للبريد وخدمة التعرف على الكلام في Android وخدمات بيانات القرآن والصلاة. يتم إرسال المعلومات اللازمة فقط للميزة المختارة.")}</Text></LegalCard>
        <LegalCard title={t("Retention, deletion & consent", "الاحتفاظ والحذف والموافقة")}><Text style={styles.legalText}>{t("Local settings remain until you change them, clear app data or uninstall. Email subscriptions remain until you unsubscribe. Support messages may be retained as needed to answer and document the request. You can revoke operating-system permissions at any time in device settings and can contact Hassoun for privacy or deletion requests.", "تبقى الإعدادات المحلية حتى تغيرها أو تمسح بيانات التطبيق أو تحذفه. تبقى اشتراكات البريد حتى تلغيها. قد يتم الاحتفاظ برسائل الدعم بقدر الحاجة للرد وتوثيق الطلب. يمكنك سحب أذونات النظام في أي وقت من إعدادات الجهاز والتواصل مع Hassoun لطلبات الخصوصية أو الحذف.")}</Text></LegalCard>
        <Pressable onPress={() => Linking.openURL(`${PUBLIC_BASE}/privacy/`)} style={styles.secondaryButton}><Text style={styles.secondaryButtonText}>{t("Open public Privacy Policy", "فتح سياسة الخصوصية العامة")}</Text></Pressable>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.content}>
      <BackHeader title={t("Terms of Use", "شروط الاستخدام")} onBack={() => setPage("root")} />
      <Text style={styles.updated}>{t("Effective: August 17, 2026", "سارية من: 17 أغسطس 2026")}</Text>
      <LegalCard title={t("Using Hassoun", "استخدام Hassoun")}><Text style={styles.legalText}>{t("Hassoun is provided for personal religious, educational and informational use. Use the app lawfully and do not attempt to disrupt, reverse-engineer or misuse its services.", "يوفر Hassoun للاستخدام الديني والتعليمي والمعلوماتي الشخصي. استخدم التطبيق بشكل قانوني ولا تحاول تعطيل خدماته أو إساءة استخدامها.")}</Text></LegalCard>
      <LegalCard title={t("Prayer times & Hijri dates", "مواقيت الصلاة والتاريخ الهجري")}><Text style={styles.legalText}>{t("Prayer times and Hijri dates can vary by mosque, calculation convention, local observation or authority. Hassoun identifies its source where practical, but users should follow their trusted local mosque or religious authority when a difference matters.", "قد تختلف مواقيت الصلاة والتاريخ الهجري حسب المسجد أو طريقة الحساب أو الرؤية المحلية أو الجهة المعتمدة. يوضح Hassoun مصدره قدر الإمكان، ويُنصح باتباع المسجد أو المرجع الديني المحلي الموثوق عند وجود اختلاف مهم.")}</Text></LegalCard>
      <LegalCard title={t("Qur’an content & audio", "محتوى القرآن والصوت")}><Text style={styles.legalText}>{t("Hassoun is designed to preserve verified Qur’anic text and clearly separate Qur’an from translations, transliterations and learning tools. Network audio and external data availability can change and may occasionally be unavailable.", "صمم Hassoun للحفاظ على النص القرآني الموثق والفصل بوضوح بين القرآن والترجمة والكتابة اللاتينية وأدوات التعلم. قد تتغير إتاحة الصوت والبيانات عبر الشبكة وقد تتوقف مؤقتاً.")}</Text></LegalCard>
      <LegalCard title={t("Changes & support", "التغييرات والدعم")}><Text style={styles.legalText}>{t("Hassoun may improve features, sources and these terms over time. Material legal or privacy changes will be reflected in the published pages. Contact support if you have questions.", "قد يقوم Hassoun بتحسين الميزات والمصادر وهذه الشروط مع الوقت. ستنعكس التغييرات القانونية أو المتعلقة بالخصوصية المهمة في الصفحات المنشورة. تواصل مع الدعم لأي استفسار.")}</Text></LegalCard>
      <Pressable onPress={() => Linking.openURL(`${PUBLIC_BASE}/terms/`)} style={styles.secondaryButton}><Text style={styles.secondaryButtonText}>{t("Open public Terms of Use", "فتح شروط الاستخدام العامة")}</Text></Pressable>
    </ScrollView>
  );
}

function ContactPage({ locale, version, onBack }: { locale: "en" | "ar"; version: string; onBack: () => void }) {
  const ar = locale === "ar";
  const t = (en: string, arabic: string) => ar ? arabic : en;
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const send = async () => {
    if (!email.trim() || !/^\S+@\S+\.\S+$/.test(email.trim())) return Alert.alert(t("Email required", "البريد مطلوب"), t("Enter a valid email address so support can reply.", "أدخل بريداً صحيحاً ليتمكن الدعم من الرد."));
    if (message.trim().length < 10) return Alert.alert(t("Message required", "الرسالة مطلوبة"), t("Tell us a little more about what you need help with.", "اكتب تفاصيل أكثر قليلاً عن المساعدة المطلوبة."));
    setSending(true);
    try {
      await submitSupportMessage({ name: name.trim(), email: email.trim(), subject: subject.trim() || "Hassoun app support", message: message.trim(), locale, appVersion: version, platform: Platform.OS });
      setMessage(""); setSubject("");
      Alert.alert(t("Message sent", "تم إرسال الرسالة"), t("Hassoun support received your message.", "استلم دعم Hassoun رسالتك."));
    } catch (error) {
      Alert.alert(t("Could not send", "تعذر الإرسال"), String(error));
    } finally { setSending(false); }
  };

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <BackHeader title={t("Contact us", "اتصل بنا")} onBack={onBack} />
      <Text style={styles.subtitle}>{t("Send a support, privacy, bug or feature request directly from Hassoun.", "أرسل طلب دعم أو خصوصية أو بلاغ مشكلة أو اقتراح ميزة مباشرة من Hassoun.")}</Text>
      <TextInput value={name} onChangeText={setName} placeholder={t("Name (optional)", "الاسم (اختياري)")} style={styles.input} textAlign={ar ? "right" : "left"} />
      <TextInput value={email} onChangeText={setEmail} placeholder={t("Email", "البريد الإلكتروني")} autoCapitalize="none" keyboardType="email-address" style={styles.input} textAlign={ar ? "right" : "left"} />
      <TextInput value={subject} onChangeText={setSubject} placeholder={t("Subject", "الموضوع")} style={styles.input} textAlign={ar ? "right" : "left"} />
      <TextInput value={message} onChangeText={setMessage} placeholder={t("How can we help?", "كيف يمكننا مساعدتك؟")} multiline style={[styles.input, styles.messageInput]} textAlignVertical="top" textAlign={ar ? "right" : "left"} />
      <Pressable onPress={send} disabled={sending} style={[styles.primaryButton, sending && styles.disabledButton]}>{sending ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>{t("Send message", "إرسال الرسالة")}</Text>}</Pressable>
      <Text style={styles.formNote}>{t("Your email and message are used only to respond to this request and operate support.", "يستخدم بريدك ورسالتك فقط للرد على هذا الطلب وتشغيل خدمة الدعم.")}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: 18, paddingBottom: 42 },
  eyebrow: { color: "#17705b", fontSize: 10, fontWeight: "900", letterSpacing: 1.4 },
  title: { color: "#173f35", fontSize: 29, fontWeight: "900", marginTop: 5 },
  subtitle: { color: "#75827d", fontSize: 12, lineHeight: 18, marginTop: 5, marginBottom: 16 },
  section: { marginTop: 8 },
  sectionLabel: { color: "#9a7c42", fontSize: 9, fontWeight: "900", letterSpacing: 1.2, marginBottom: 7, marginTop: 10 },
  row: { minHeight: 72, flexDirection: "row", alignItems: "center", gap: 11, backgroundColor: "#fff", borderWidth: 1, borderColor: "#e1ded6", borderRadius: 20, paddingHorizontal: 13, marginBottom: 8 },
  rowIcon: { width: 43, height: 43, borderRadius: 15, backgroundColor: "#edf5f1", alignItems: "center", justifyContent: "center" },
  rowEmoji: { fontSize: 21 },
  rowCopy: { flex: 1 },
  rowTitle: { color: "#173f35", fontSize: 13, fontWeight: "900" },
  rowText: { color: "#83908b", fontSize: 9, lineHeight: 13, marginTop: 3 },
  arrow: { color: "#0b7057", fontSize: 27 },
  footer: { color: "#929995", textAlign: "center", fontSize: 9, marginTop: 18 },
  subHeader: { flexDirection: "row", alignItems: "center", gap: 11, marginBottom: 10 },
  backButton: { width: 44, height: 44, borderRadius: 15, backgroundColor: "#fff", borderWidth: 1, borderColor: "#dedbd3", alignItems: "center", justifyContent: "center" },
  backText: { color: "#0b654f", fontSize: 32, lineHeight: 35 },
  subHeaderTitle: { flex: 1, color: "#173f35", fontSize: 22, fontWeight: "900" },
  legalCard: { backgroundColor: "#fff", borderRadius: 20, borderWidth: 1, borderColor: "#e1ded6", padding: 15, marginBottom: 10 },
  legalTitle: { color: "#173f35", fontSize: 14, fontWeight: "900", marginBottom: 7 },
  legalBody: { gap: 8 },
  legalText: { color: "#65736e", fontSize: 11, lineHeight: 18 },
  updated: { color: "#8a948f", fontSize: 10, marginBottom: 14 },
  aboutHero: { alignItems: "center", backgroundColor: "#0b654f", borderRadius: 26, padding: 24, marginBottom: 13 },
  aboutMoon: { color: "#f2cc72", fontSize: 45 },
  aboutTitle: { color: "#fff", fontSize: 28, fontWeight: "900", marginTop: 3 },
  aboutTagline: { color: "#c8e1d8", fontSize: 11, marginTop: 3 },
  version: { color: "#f1d58c", fontSize: 10, fontWeight: "800", marginTop: 10 },
  layoutGrid: { flexDirection: "row", gap: 7, marginBottom: 12 },
  layoutChoice: { flex: 1, minHeight: 105, borderRadius: 17, borderWidth: 1, borderColor: "#dfddd5", backgroundColor: "#fff", alignItems: "center", justifyContent: "center", padding: 8 },
  layoutChoiceActive: { borderColor: "#0b7057", backgroundColor: "#eaf5f0" },
  layoutIcon: { color: "#0b7057", fontSize: 23, fontWeight: "900" },
  layoutTitle: { color: "#173f35", fontSize: 10, fontWeight: "900", marginTop: 7, textAlign: "center" },
  layoutNote: { color: "#8a948f", fontSize: 7, lineHeight: 10, textAlign: "center", marginTop: 3 },
  widgetPreview: { backgroundColor: "#0b654f", borderRadius: 25, padding: 16, marginBottom: 14 },
  widgetPreviewBrand: { color: "#b9d8ce", fontSize: 8, fontWeight: "900", letterSpacing: 1 },
  widgetPreviewRow: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", marginTop: 6 },
  widgetPreviewPrayer: { color: "#fff", fontSize: 24, fontWeight: "900" },
  widgetPreviewTime: { color: "#fff", fontSize: 17, fontWeight: "900" },
  widgetPreviewCountdown: { color: "#e4f1ed", fontSize: 10, fontWeight: "800", textAlign: "right", marginTop: 3 },
  widgetPreviewMeta: { color: "#bedbd1", fontSize: 9, marginTop: 8 },
  widgetPreviewList: { color: "#e9f4f0", fontSize: 9, lineHeight: 15, marginTop: 7 },
  toggleRow: { minHeight: 58, flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "#fff", borderRadius: 17, borderWidth: 1, borderColor: "#e2dfd7", paddingHorizontal: 14, marginBottom: 7 },
  toggleLabel: { color: "#264b41", fontSize: 12, fontWeight: "800" },
  primaryButton: { minHeight: 52, backgroundColor: "#0b654f", borderRadius: 17, alignItems: "center", justifyContent: "center", paddingHorizontal: 16, marginTop: 10 },
  primaryButtonText: { color: "#fff", fontSize: 12, fontWeight: "900" },
  secondaryButton: { minHeight: 50, backgroundColor: "#edf5f1", borderRadius: 17, alignItems: "center", justifyContent: "center", paddingHorizontal: 16, marginTop: 8, marginBottom: 10 },
  secondaryButtonText: { color: "#0b654f", fontSize: 11, fontWeight: "900" },
  inlineButton: { alignSelf: "flex-start", backgroundColor: "#e8f3ee", borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9, marginTop: 8 },
  inlineButtonText: { color: "#0b654f", fontSize: 10, fontWeight: "900" },
  input: { minHeight: 52, borderRadius: 17, backgroundColor: "#fff", borderWidth: 1, borderColor: "#dfddd5", paddingHorizontal: 14, color: "#173f35", fontSize: 12, marginBottom: 9 },
  messageInput: { minHeight: 150, paddingTop: 14 },
  disabledButton: { opacity: 0.65 },
  formNote: { color: "#8a948f", fontSize: 9, lineHeight: 14, marginTop: 10, textAlign: "center" }
});
