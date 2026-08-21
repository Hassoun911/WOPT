import { Pressable, StyleSheet, Text, View } from "react-native";
import BrandMark from "./BrandMark";

type Props = {
  locale: "en" | "ar";
  titleEn: string;
  titleAr: string;
  messageEn?: string;
  messageAr?: string;
  onBack?: () => void;
};

export default function FeatureUnavailable({ locale, titleEn, titleAr, messageEn, messageAr, onBack }: Props) {
  const ar = locale === "ar";
  return (
    <View style={styles.page}>
      <View style={styles.card}>
        <BrandMark size={72} />
        <Text style={styles.eyebrow}>HASSOUN</Text>
        <Text style={styles.title}>{ar ? titleAr : titleEn}</Text>
        <Text style={styles.message}>
          {ar
            ? (messageAr || "هذه الميزة غير متاحة مؤقتاً. حاول مرة أخرى لاحقاً.")
            : (messageEn || "This feature is temporarily unavailable. Please try again later.")}
        </Text>
        {onBack ? (
          <Pressable onPress={onBack} style={styles.button}>
            <Text style={styles.buttonText}>{ar ? "العودة للرئيسية" : "Back to Home"}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#f7f4ec", padding: 22, alignItems: "center", justifyContent: "center" },
  card: { width: "100%", maxWidth: 520, borderRadius: 26, padding: 25, alignItems: "center", backgroundColor: "#fffdf8", borderWidth: 1, borderColor: "#e2ddd1" },
  eyebrow: { color: "#b27a23", fontSize: 10, fontWeight: "900", letterSpacing: 1.8, marginTop: 14 },
  title: { color: "#173f35", fontSize: 25, lineHeight: 31, fontWeight: "900", textAlign: "center", marginTop: 7 },
  message: { color: "#71807a", fontSize: 14, lineHeight: 21, textAlign: "center", marginTop: 9 },
  button: { marginTop: 20, borderRadius: 14, paddingHorizontal: 20, paddingVertical: 11, backgroundColor: "#0b654f" },
  buttonText: { color: "#fff", fontWeight: "900" }
});
