import { StyleSheet, Text, View } from "react-native";
import { dailyIslamicContentForDate } from "./dailyIslamicContent";

type Props = { locale: "en" | "ar"; date: Date; timeZone: string };

export default function DailyIslamicCards({ locale, date, timeZone }: Props) {
  const ar = locale === "ar";
  const daily = dailyIslamicContentForDate(date, timeZone);
  return (
    <View style={styles.wrap}>
      <View style={styles.card}>
        <View style={styles.headingRow}>
          <View style={styles.icon}><Text style={styles.iconText}>📖</Text></View>
          <View style={styles.headingCopy}>
            <Text style={styles.eyebrow}>{ar ? "نور القرآن اليومي" : "DAILY QUR’AN"}</Text>
            <Text style={styles.title}>{ar ? "آية اليوم" : "Qur’an verse of the day"}</Text>
          </View>
        </View>
        <Text style={styles.arabic}>{daily.ayah.ar}</Text>
        <Text style={styles.english}>{daily.ayah.en}</Text>
        <Text style={styles.reference}>{daily.ayah.ref}</Text>
      </View>

      <View style={styles.card}>
        <View style={styles.headingRow}>
          <View style={styles.icon}><Text style={styles.iconText}>☪️</Text></View>
          <View style={styles.headingCopy}>
            <Text style={styles.eyebrow}>{ar ? "من السنة" : "DAILY SUNNAH"}</Text>
            <Text style={styles.title}>{ar ? "حديث اليوم" : "Hadith of the day"}</Text>
          </View>
        </View>
        <Text style={styles.arabic}>{daily.hadith.ar}</Text>
        <Text style={styles.english}>{daily.hadith.en}</Text>
        <Text style={styles.reference}>{daily.hadith.ref}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10, marginTop: 16 },
  card: { borderRadius: 21, backgroundColor: "#fff", borderWidth: 1, borderColor: "#dedfd9", padding: 15 },
  headingRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  icon: { width: 42, height: 42, borderRadius: 14, backgroundColor: "#eef5f1", alignItems: "center", justifyContent: "center" },
  iconText: { fontSize: 20 },
  headingCopy: { flex: 1 },
  eyebrow: { color: "#9d8039", fontSize: 7.5, fontWeight: "900", letterSpacing: 1 },
  title: { color: "#163f35", fontSize: 14, fontWeight: "900", marginTop: 2 },
  arabic: { color: "#123f34", fontSize: 19, lineHeight: 31, fontWeight: "700", textAlign: "right", marginTop: 14 },
  english: { color: "#566b64", fontSize: 11, lineHeight: 17, marginTop: 9 },
  reference: { color: "#a17c36", fontSize: 9, fontWeight: "900", marginTop: 8 }
});
