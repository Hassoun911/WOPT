import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

type Props = {
  locale: "en" | "ar";
  onBack: () => void;
};

const QIBLA_BEARING = 52;

export default function QiblaDirectionScreen({ locale, onBack }: Props) {
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Pressable onPress={onBack} style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
          <Text style={styles.backText}>‹</Text>
        </Pressable>
        <View style={styles.headerCopy}>
          <Text style={styles.arabicTitle}>اتجاه القبلة</Text>
          <Text style={styles.title}>Qibla Direction</Text>
        </View>
        <View style={styles.headerIcon}><Text style={styles.headerIconText}>✦</Text></View>
      </View>

      <View style={styles.locationCard}>
        <View style={styles.locationPin}><Text style={styles.locationPinText}>⌖</Text></View>
        <View style={styles.locationCopy}>
          <Text style={styles.locationEyebrow}>{locale === "ar" ? "الموقع" : "LOCATION"}</Text>
          <Text style={styles.locationTitle}>{locale === "ar" ? "وندسور، أونتاريو" : "Windsor, Ontario"}</Text>
        </View>
        <View style={styles.refreshButton}><Text style={styles.refreshText}>↻</Text></View>
      </View>

      <View style={styles.compassWrap}>
        <View style={styles.compassOuter}>
          <View style={styles.compassInner}>
            <Text style={[styles.directionLabel, styles.north]}>N</Text>
            <Text style={[styles.directionLabel, styles.east]}>E</Text>
            <Text style={[styles.directionLabel, styles.south]}>S</Text>
            <Text style={[styles.directionLabel, styles.west]}>W</Text>

            <Text style={[styles.degreeLabel, styles.deg30]}>30</Text>
            <Text style={[styles.degreeLabel, styles.deg60]}>60</Text>
            <Text style={[styles.degreeLabel, styles.deg120]}>120</Text>
            <Text style={[styles.degreeLabel, styles.deg150]}>150</Text>
            <Text style={[styles.degreeLabel, styles.deg210]}>210</Text>
            <Text style={[styles.degreeLabel, styles.deg240]}>240</Text>
            <Text style={[styles.degreeLabel, styles.deg300]}>300</Text>
            <Text style={[styles.degreeLabel, styles.deg330]}>330</Text>

            <View style={[styles.needleLayer, { transform: [{ rotate: `${QIBLA_BEARING}deg` }] }]}>
              <View style={styles.needleTip} />
              <View style={styles.needleStem} />
              <View style={styles.kaabaMarker}>
                <Text style={styles.kaabaEmoji}>🕋</Text>
              </View>
            </View>

            <View style={styles.centerDial}>
              <Text style={styles.centerBearing}>{QIBLA_BEARING}°</Text>
              <Text style={styles.centerDirection}>NE</Text>
            </View>
          </View>
        </View>
      </View>

      <View style={styles.statusCard}>
        <View style={styles.statusIcon}><Text style={styles.statusIconText}>✓</Text></View>
        <View style={styles.statusCopy}>
          <Text style={styles.statusArabic}>اتجاه القبلة من موقعك</Text>
          <Text style={styles.statusTitle}>{locale === "ar" ? "القبلة باتجاه الشمال الشرقي" : "Qibla is toward the north-east"}</Text>
          <Text style={styles.statusText}>{locale === "ar" ? "اتجه نحو ٥٢° للصلاة باتجاه الكعبة المشرفة." : "Face approximately 52° from north toward the Kaaba in Makkah."}</Text>
        </View>
      </View>

      <View style={styles.tipCard}>
        <View style={styles.tipIcon}><Text style={styles.tipIconText}>◉</Text></View>
        <View style={styles.tipCopy}>
          <Text style={styles.tipTitle}>{locale === "ar" ? "طريقة الاستخدام" : "How to use it"}</Text>
          <Text style={styles.tipText}>{locale === "ar" ? "ضع الهاتف بشكل مستوٍ وبعيداً عن المعادن والمغناطيس. السهم الذهبي يوضح زاوية القبلة من وندسور." : "Hold the phone flat and away from magnets or metal. The gold arrow shows the Qibla bearing from Windsor."}</Text>
        </View>
      </View>

      <View style={styles.infoCard}>
        <View style={styles.infoColumn}>
          <Text style={styles.infoLabel}>{locale === "ar" ? "الزاوية" : "BEARING"}</Text>
          <Text style={styles.infoValue}>52° NE</Text>
        </View>
        <View style={styles.infoDivider} />
        <View style={styles.infoColumn}>
          <Text style={styles.infoLabel}>{locale === "ar" ? "العرض" : "LATITUDE"}</Text>
          <Text style={styles.infoValue}>42.31° N</Text>
        </View>
        <View style={styles.infoDivider} />
        <View style={styles.infoColumn}>
          <Text style={styles.infoLabel}>{locale === "ar" ? "الطول" : "LONGITUDE"}</Text>
          <Text style={styles.infoValue}>83.04° W</Text>
        </View>
      </View>

      <Text style={styles.footer}>{locale === "ar" ? "اتجاه القبلة محسوب نحو الكعبة المشرفة في مكة المكرمة" : "Qibla bearing calculated toward the Kaaba in Makkah"}</Text>
    </ScrollView>
  );
}

const gold = "#e0bd69";
const green = "#064f41";
const green2 = "#073f35";

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: green },
  content: { padding: 18, paddingBottom: 38 },
  header: { flexDirection: "row", alignItems: "center", marginBottom: 16 },
  backButton: { width: 44, height: 44, borderRadius: 16, borderWidth: 1, borderColor: "rgba(225,190,105,.36)", backgroundColor: "rgba(255,255,255,.05)", alignItems: "center", justifyContent: "center" },
  backText: { color: "#fff", fontSize: 34, lineHeight: 36, marginTop: -3 },
  headerCopy: { flex: 1, alignItems: "center" },
  arabicTitle: { color: "#fff", fontSize: 19, fontWeight: "900" },
  title: { color: "#d9e7e2", fontSize: 12, fontWeight: "700", marginTop: 2 },
  headerIcon: { width: 44, height: 44, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  headerIconText: { color: gold, fontSize: 21 },
  locationCard: { borderRadius: 20, borderWidth: 1, borderColor: "rgba(224,189,105,.38)", backgroundColor: "rgba(3,54,45,.68)", padding: 11, flexDirection: "row", alignItems: "center", gap: 10 },
  locationPin: { width: 38, height: 38, borderRadius: 13, backgroundColor: "rgba(224,189,105,.13)", alignItems: "center", justifyContent: "center" },
  locationPinText: { color: gold, fontSize: 24, fontWeight: "900" },
  locationCopy: { flex: 1 },
  locationEyebrow: { color: "#b4cfc5", fontSize: 7.5, fontWeight: "900", letterSpacing: 1.2 },
  locationTitle: { color: "#fff", fontSize: 14, fontWeight: "900", marginTop: 2 },
  refreshButton: { width: 39, height: 39, borderRadius: 15, backgroundColor: "#11705a", alignItems: "center", justifyContent: "center" },
  refreshText: { color: "#fff", fontSize: 23, fontWeight: "700" },
  compassWrap: { alignItems: "center", paddingVertical: 26 },
  compassOuter: { width: 318, height: 318, borderRadius: 159, borderWidth: 2, borderColor: gold, backgroundColor: "#06483c", alignItems: "center", justifyContent: "center", shadowColor: "#000", shadowOpacity: .22, shadowRadius: 16, shadowOffset: { width: 0, height: 9 }, elevation: 7 },
  compassInner: { width: 272, height: 272, borderRadius: 136, borderWidth: 1, borderColor: "rgba(224,189,105,.45)", backgroundColor: green2, alignItems: "center", justifyContent: "center" },
  directionLabel: { position: "absolute", color: "#fff", fontSize: 15, fontWeight: "900" },
  north: { top: 10 }, east: { right: 13, top: 126 }, south: { bottom: 10 }, west: { left: 12, top: 126 },
  degreeLabel: { position: "absolute", color: "#a8c3ba", fontSize: 9, fontWeight: "800" },
  deg30: { top: 34, right: 67 }, deg60: { top: 74, right: 27 }, deg120: { bottom: 75, right: 23 }, deg150: { bottom: 34, right: 67 },
  deg210: { bottom: 34, left: 67 }, deg240: { bottom: 75, left: 23 }, deg300: { top: 74, left: 27 }, deg330: { top: 34, left: 67 },
  needleLayer: { position: "absolute", width: 18, height: 230, alignItems: "center", justifyContent: "flex-start" },
  needleTip: { width: 0, height: 0, borderLeftWidth: 9, borderRightWidth: 9, borderBottomWidth: 62, borderLeftColor: "transparent", borderRightColor: "transparent", borderBottomColor: gold, marginTop: 17 },
  needleStem: { width: 5, height: 70, backgroundColor: gold, borderRadius: 3 },
  kaabaMarker: { position: "absolute", top: 0, width: 49, height: 49, borderRadius: 24.5, backgroundColor: "#e4c370", borderWidth: 2, borderColor: "#f5df9d", alignItems: "center", justifyContent: "center", transform: [{ rotate: `-${QIBLA_BEARING}deg` }] },
  kaabaEmoji: { fontSize: 25 },
  centerDial: { width: 104, height: 104, borderRadius: 52, backgroundColor: "#064a3e", borderWidth: 1, borderColor: "rgba(224,189,105,.5)", alignItems: "center", justifyContent: "center" },
  centerBearing: { color: "#fff", fontSize: 31, fontWeight: "900" },
  centerDirection: { color: gold, fontSize: 11, fontWeight: "900", marginTop: 1 },
  statusCard: { borderRadius: 20, borderWidth: 1, borderColor: "rgba(224,189,105,.45)", backgroundColor: "rgba(3,53,44,.74)", padding: 13, flexDirection: "row", alignItems: "center", gap: 11 },
  statusIcon: { width: 47, height: 47, borderRadius: 24, backgroundColor: "#20a46d", alignItems: "center", justifyContent: "center" },
  statusIconText: { color: "#fff", fontSize: 25, fontWeight: "900" },
  statusCopy: { flex: 1 },
  statusArabic: { color: "#f0d58c", fontSize: 12, fontWeight: "900" },
  statusTitle: { color: "#fff", fontSize: 13, fontWeight: "900", marginTop: 2 },
  statusText: { color: "#b7cec6", fontSize: 9, lineHeight: 13, marginTop: 3 },
  tipCard: { marginTop: 11, borderRadius: 20, backgroundColor: "rgba(255,255,255,.06)", borderWidth: 1, borderColor: "rgba(255,255,255,.12)", padding: 13, flexDirection: "row", gap: 10 },
  tipIcon: { width: 40, height: 40, borderRadius: 14, backgroundColor: "rgba(224,189,105,.12)", alignItems: "center", justifyContent: "center" },
  tipIconText: { color: gold, fontSize: 18 },
  tipCopy: { flex: 1 },
  tipTitle: { color: "#f1d58b", fontSize: 12, fontWeight: "900" },
  tipText: { color: "#b6cbc4", fontSize: 9, lineHeight: 14, marginTop: 3 },
  infoCard: { marginTop: 11, borderRadius: 20, backgroundColor: "rgba(3,53,44,.75)", borderWidth: 1, borderColor: "rgba(224,189,105,.28)", paddingVertical: 13, paddingHorizontal: 8, flexDirection: "row", alignItems: "center" },
  infoColumn: { flex: 1, alignItems: "center" },
  infoLabel: { color: "#9fb8b0", fontSize: 6.5, fontWeight: "900", letterSpacing: .8 },
  infoValue: { color: "#fff", fontSize: 10, fontWeight: "900", marginTop: 4 },
  infoDivider: { width: 1, height: 31, backgroundColor: "rgba(224,189,105,.22)" },
  footer: { color: "#8fb0a5", textAlign: "center", fontSize: 8, lineHeight: 12, marginTop: 17 },
  pressed: { opacity: .72, transform: [{ scale: .985 }] }
});
