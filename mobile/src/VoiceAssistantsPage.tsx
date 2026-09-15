import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

type Props = {
  locale: "en" | "ar";
  onBack: () => void;
};

export default function VoiceAssistantsPage({ locale, onBack }: Props) {
  const ar = locale === "ar";
  const t = (en: string, arabic: string) => ar ? arabic : en;

  const openInfo = () => {
    void Linking.openURL("https://hassoun.app/voice-assistants/").catch(() => undefined);
  };

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Pressable onPress={onBack} style={styles.backButton}><Text style={styles.backText}>‹</Text></Pressable>
        <View style={styles.headerCopy}>
          <Text style={styles.eyebrow}>🎙️ HASSOUN SMART HOME</Text>
          <Text style={styles.title}>{t("Voice Assistants", "المساعدات الصوتية")}</Text>
          <Text style={styles.subtitle}>{t("See what is live now on Alexa and what still needs production setup.", "اعرف ما يعمل الآن على Alexa وما الذي لا يزال يحتاج إعداد الإنتاج.")}</Text>
        </View>
      </View>

      <View style={styles.liveCard}>
        <Text style={styles.liveLabel}>{t("LIVE IN DEVELOPMENT / TESTING", "يعمل في التطوير والاختبار")}</Text>
        <Text style={styles.liveTitle}>Amazon Alexa</Text>
        <Text style={styles.liveText}>{t("Hassoun Alexa already answers prayer questions and supports the Echo Show prayer dashboard, countdowns, Hijri dates, Islamic events and requested next-prayer reminders.", "يعمل Hassoun على Alexa الآن للإجابة عن أسئلة الصلاة وعرض شاشة Echo Show والعد التنازلي والتاريخ الهجري والمناسبات الإسلامية وتذكيرات الصلاة المطلوبة.")}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.icon}>🔵</Text>
        <Text style={styles.cardTitle}>Amazon Alexa</Text>
        <Text style={styles.cardText}>{t("Try the working development skill now. Current Alexa requests without a Hassoun profile still use the legacy Windsor default location.", "جرّب مهارة Alexa العاملة الآن. طلبات Alexa التي لا تحتوي على ملف Hassoun ما زالت تستخدم موقع Windsor الافتراضي القديم.")}</Text>
        <View style={styles.example}><Text style={styles.exampleText}>“Alexa, open Hassoun.”</Text></View>
        <View style={styles.example}><Text style={styles.exampleText}>“Alexa, ask Hassoun when Maghrib is.”</Text></View>
        <View style={styles.example}><Text style={styles.exampleText}>“Alexa, ask Hassoun how long until Isha.”</Text></View>
        <Pressable onPress={openInfo} style={styles.primaryButton}><Text style={styles.primaryButtonText}>{t("Alexa setup & status", "إعداد وحالة Alexa")}</Text></Pressable>
      </View>

      <View style={styles.pendingCard}>
        <Text style={styles.pendingLabel}>{t("NEXT CONNECTION LAYER", "طبقة الربط التالية")}</Text>
        <Text style={styles.pendingTitle}>{t("Account linking & per-device locations", "ربط الحساب والمواقع لكل جهاز")}</Text>
        <Text style={styles.pendingText}>{t("Still to be completed: signing Alexa into a Hassoun profile, choosing a saved prayer location and assigning different locations to different Echo devices. This is separate from the voice skill that already works.", "ما زال مطلوباً إكمال ربط Alexa بملف Hassoun واختيار موقع صلاة محفوظ وتعيين مواقع مختلفة لأجهزة Echo المختلفة. هذا منفصل عن مهارة الصوت التي تعمل بالفعل.")}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.icon}>🟢</Text>
        <Text style={styles.cardTitle}>Google Home</Text>
        <Text style={styles.cardText}>{t("Google Home is planned but is not connected to a production Hassoun integration yet.", "Google Home مخطط له ولكنه غير متصل بتكامل Hassoun للإنتاج حتى الآن.")}</Text>
        <Pressable onPress={openInfo} style={styles.secondaryButton}><Text style={styles.secondaryButtonText}>{t("Google Home status", "حالة Google Home")}</Text></Pressable>
      </View>

      <View style={styles.automationCard}>
        <Text style={styles.automationTitle}>{t("Smart Adhan automations", "أتمتة الأذان الذكية")}</Text>
        <Text style={styles.automationText}>{t("TV muting, speaker-volume changes, lighting and restoring the previous state are not live yet. They require a separate approved Alexa smart-home or routine capability.", "كتم التلفاز وتغيير صوت السماعات والإضاءة وإعادة الحالة السابقة لا تعمل بعد. تحتاج إلى قدرة Alexa منزل ذكي أو روتين منفصلة ومعتمدة.")}</Text>
      </View>

      <Text style={styles.note}>{t("Amazon publication/certification is still required before the skill is public for everyone. Account linking is optional for the current voice Q&A, but required for Hassoun saved profiles and per-Echo locations.", "ما زال نشر واعتماد Amazon مطلوباً قبل أن تصبح المهارة عامة للجميع. ربط الحساب ليس مطلوباً لأسئلة الصوت الحالية، لكنه مطلوب لملفات Hassoun المحفوظة والمواقع الخاصة بكل Echo.")}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: "#F7F4EC" },
  content: { padding: 20, paddingBottom: 42 },
  header: { flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 18 },
  backButton: { width: 42, height: 42, borderRadius: 21, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#D8E1DC", alignItems: "center", justifyContent: "center" },
  backText: { fontSize: 30, lineHeight: 32, color: "#0B5B47", marginTop: -3 },
  headerCopy: { flex: 1 },
  eyebrow: { color: "#0B5B47", fontSize: 11, fontWeight: "900", letterSpacing: 1.2 },
  title: { marginTop: 5, color: "#17362E", fontSize: 30, lineHeight: 34, fontWeight: "900" },
  subtitle: { marginTop: 6, color: "#6C7C76", fontSize: 14, lineHeight: 20 },
  liveCard: { marginTop: 8, backgroundColor: "#EAF7F1", borderWidth: 1, borderColor: "#BFE0D2", borderRadius: 20, padding: 17 },
  liveLabel: { color: "#0B6B50", fontSize: 10, fontWeight: "900", letterSpacing: 1 },
  liveTitle: { marginTop: 7, color: "#17362E", fontSize: 21, fontWeight: "900" },
  liveText: { marginTop: 7, color: "#526C63", fontSize: 13, lineHeight: 19 },
  card: { marginTop: 14, backgroundColor: "#FFFDF8", borderWidth: 1, borderColor: "#D8E1DC", borderRadius: 22, padding: 18 },
  icon: { fontSize: 28 },
  cardTitle: { marginTop: 10, color: "#17362E", fontSize: 21, fontWeight: "900" },
  cardText: { marginTop: 7, color: "#62756E", fontSize: 13, lineHeight: 19 },
  example: { marginTop: 9, borderRadius: 12, backgroundColor: "#F1F6F3", paddingHorizontal: 12, paddingVertical: 10 },
  exampleText: { color: "#264B41", fontSize: 12, lineHeight: 18 },
  primaryButton: { marginTop: 15, minHeight: 46, borderRadius: 13, backgroundColor: "#0B5B47", alignItems: "center", justifyContent: "center", paddingHorizontal: 14 },
  primaryButtonText: { color: "#FFFFFF", fontWeight: "900", fontSize: 14 },
  secondaryButton: { marginTop: 15, minHeight: 46, borderRadius: 13, backgroundColor: "#EDF5F1", borderWidth: 1, borderColor: "#CFE0D9", alignItems: "center", justifyContent: "center", paddingHorizontal: 14 },
  secondaryButtonText: { color: "#0B5B47", fontWeight: "900", fontSize: 14 },
  pendingCard: { marginTop: 16, backgroundColor: "#FFF7DF", borderWidth: 1, borderColor: "#E2D2A7", borderRadius: 20, padding: 17 },
  pendingLabel: { color: "#80651F", fontSize: 10, fontWeight: "900", letterSpacing: 1 },
  pendingTitle: { marginTop: 7, color: "#5F512A", fontWeight: "900", fontSize: 17 },
  pendingText: { marginTop: 7, color: "#726647", fontSize: 13, lineHeight: 19 },
  automationCard: { marginTop: 16, backgroundColor: "#FFF7DF", borderWidth: 1, borderColor: "#E2D2A7", borderRadius: 20, padding: 17 },
  automationTitle: { color: "#5F512A", fontWeight: "900", fontSize: 17 },
  automationText: { marginTop: 7, color: "#726647", fontSize: 13, lineHeight: 19 },
  note: { marginTop: 18, color: "#71807A", fontSize: 12, lineHeight: 18, textAlign: "center" }
});
