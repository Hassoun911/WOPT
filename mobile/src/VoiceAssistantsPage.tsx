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
          <Text style={styles.subtitle}>{t("Connect Hassoun with Alexa and Google Home.", "اربط Hassoun مع Alexa وGoogle Home.")}</Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.icon}>🔵</Text>
        <Text style={styles.cardTitle}>Amazon Alexa</Text>
        <Text style={styles.cardText}>{t("Ask for prayer times, how long until Maghrib or Isha, the next prayer, Hijri dates and Islamic holidays.", "اسأل عن مواقيت الصلاة والوقت المتبقي للمغرب أو العشاء والصلاة القادمة والتاريخ الهجري والمناسبات الإسلامية.")}</Text>
        <View style={styles.example}><Text style={styles.exampleText}>“Alexa, ask Hassoun when Maghrib is.”</Text></View>
        <View style={styles.example}><Text style={styles.exampleText}>“Alexa, ask Hassoun how long until Isha.”</Text></View>
        <Pressable onPress={openInfo} style={styles.primaryButton}><Text style={styles.primaryButtonText}>{t("Connect to Alexa", "الاتصال بـ Alexa")}</Text></Pressable>
      </View>

      <View style={styles.card}>
        <Text style={styles.icon}>🟢</Text>
        <Text style={styles.cardTitle}>Google Home</Text>
        <Text style={styles.cardText}>{t("Use the same Hassoun prayer and Islamic-event information with Google Home and compatible smart-home automations.", "استخدم نفس معلومات Hassoun للصلاة والمناسبات الإسلامية مع Google Home وأتمتة المنزل الذكي المتوافقة.")}</Text>
        <View style={styles.example}><Text style={styles.exampleText}>“Hey Google, ask Hassoun what the next prayer is.”</Text></View>
        <View style={styles.example}><Text style={styles.exampleText}>“Hey Google, ask Hassoun what the next Islamic holiday is.”</Text></View>
        <Pressable onPress={openInfo} style={styles.primaryButton}><Text style={styles.primaryButtonText}>{t("Connect to Google Home", "الاتصال بـ Google Home")}</Text></Pressable>
      </View>

      <View style={styles.automationCard}>
        <Text style={styles.automationTitle}>{t("Smart Adhan automations", "أتمتة الأذان الذكية")}</Text>
        <Text style={styles.automationText}>{t("The integration is being prepared for actions such as muting a compatible TV at Adhan, lowering speaker volume, changing lights and restoring the previous state after prayer.", "يجري تجهيز التكامل لإجراءات مثل كتم صوت التلفاز المتوافق وقت الأذان وخفض صوت السماعات وتغيير الإضاءة ثم إعادة الحالة السابقة بعد الصلاة.")}</Text>
      </View>

      <Text style={styles.note}>{t("The menu and setup screen are now part of Hassoun. Final account linking becomes active after the Alexa Skill and Google Home production integrations are published.", "أصبحت شاشة الإعداد والقائمة جزءاً من Hassoun. سيتم تفعيل ربط الحساب النهائي بعد نشر تكامل Alexa Skill وGoogle Home للإنتاج.")}</Text>
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
  card: { marginTop: 14, backgroundColor: "#FFFDF8", borderWidth: 1, borderColor: "#D8E1DC", borderRadius: 22, padding: 18 },
  icon: { fontSize: 28 },
  cardTitle: { marginTop: 10, color: "#17362E", fontSize: 21, fontWeight: "900" },
  cardText: { marginTop: 7, color: "#62756E", fontSize: 13, lineHeight: 19 },
  example: { marginTop: 9, borderRadius: 12, backgroundColor: "#F1F6F3", paddingHorizontal: 12, paddingVertical: 10 },
  exampleText: { color: "#264B41", fontSize: 12, lineHeight: 18 },
  primaryButton: { marginTop: 15, minHeight: 46, borderRadius: 13, backgroundColor: "#0B5B47", alignItems: "center", justifyContent: "center", paddingHorizontal: 14 },
  primaryButtonText: { color: "#FFFFFF", fontWeight: "900", fontSize: 14 },
  automationCard: { marginTop: 16, backgroundColor: "#FFF7DF", borderWidth: 1, borderColor: "#E2D2A7", borderRadius: 20, padding: 17 },
  automationTitle: { color: "#5F512A", fontWeight: "900", fontSize: 17 },
  automationText: { marginTop: 7, color: "#726647", fontSize: 13, lineHeight: 19 },
  note: { marginTop: 18, color: "#71807A", fontSize: 12, lineHeight: 18, textAlign: "center" }
});
