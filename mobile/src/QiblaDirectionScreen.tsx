import * as Location from "expo-location";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Animated, Pressable, ScrollView, StyleSheet, Text, Vibration, View } from "react-native";

type Props = {
  locale: "en" | "ar";
  onBack: () => void;
};

type Coordinates = { latitude: number; longitude: number };

const KAABA = { latitude: 21.422487, longitude: 39.826206 };
const WINDSOR = { latitude: 42.3149, longitude: -83.0364 };
const ALIGN_TOLERANCE = 5;

function toRadians(value: number) { return value * Math.PI / 180; }
function toDegrees(value: number) { return value * 180 / Math.PI; }
function normalize360(value: number) { return ((value % 360) + 360) % 360; }
function signedAngle(value: number) { return ((value + 540) % 360) - 180; }

function qiblaBearing(from: Coordinates) {
  const lat1 = toRadians(from.latitude);
  const lat2 = toRadians(KAABA.latitude);
  const deltaLon = toRadians(KAABA.longitude - from.longitude);
  const y = Math.sin(deltaLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLon);
  return normalize360(toDegrees(Math.atan2(y, x)));
}

function distanceToKaaba(from: Coordinates) {
  const radiusKm = 6371;
  const dLat = toRadians(KAABA.latitude - from.latitude);
  const dLon = toRadians(KAABA.longitude - from.longitude);
  const lat1 = toRadians(from.latitude);
  const lat2 = toRadians(KAABA.latitude);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return radiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function cardinal(degrees: number) {
  const labels = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return labels[Math.round(normalize360(degrees) / 45) % 8];
}

export default function QiblaDirectionScreen({ locale, onBack }: Props) {
  const [coords, setCoords] = useState<Coordinates>(WINDSOR);
  const [locationLabel, setLocationLabel] = useState(locale === "ar" ? "وندسور، أونتاريو" : "Windsor, Ontario");
  const [heading, setHeading] = useState(0);
  const [headingAccuracy, setHeadingAccuracy] = useState(0);
  const [loadingLocation, setLoadingLocation] = useState(true);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const headingSubscription = useRef<Location.LocationSubscription | null>(null);
  const wasAligned = useRef(false);
  const flashOpacity = useRef(new Animated.Value(0)).current;

  const bearing = useMemo(() => qiblaBearing(coords), [coords]);
  const distanceKm = useMemo(() => distanceToKaaba(coords), [coords]);
  const turn = signedAngle(bearing - heading);
  const aligned = Math.abs(turn) <= ALIGN_TOLERANCE;
  const targetDirection = cardinal(bearing);
  const currentDirection = cardinal(heading);

  const refreshLocation = useCallback(async () => {
    setLoadingLocation(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== "granted") {
        setPermissionDenied(true);
        setCoords(WINDSOR);
        setLocationLabel(locale === "ar" ? "وندسور، أونتاريو • موقع افتراضي" : "Windsor, Ontario • fallback location");
        return;
      }

      setPermissionDenied(false);
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const nextCoords = { latitude: position.coords.latitude, longitude: position.coords.longitude };
      setCoords(nextCoords);

      try {
        const places = await Location.reverseGeocodeAsync(nextCoords);
        const place = places[0];
        if (place) {
          const parts = [place.city || place.subregion, place.region || place.country].filter(Boolean);
          if (parts.length) setLocationLabel(parts.join(", "));
        }
      } catch {
        setLocationLabel(`${nextCoords.latitude.toFixed(3)}°, ${nextCoords.longitude.toFixed(3)}°`);
      }
    } catch {
      setCoords(WINDSOR);
      setLocationLabel(locale === "ar" ? "وندسور، أونتاريو • موقع افتراضي" : "Windsor, Ontario • fallback location");
    } finally {
      setLoadingLocation(false);
    }
  }, [locale]);

  useEffect(() => {
    void refreshLocation();
    let cancelled = false;

    void Location.watchHeadingAsync((value) => {
      if (cancelled) return;
      const nextHeading = value.trueHeading >= 0 ? value.trueHeading : value.magHeading;
      setHeading(normalize360(nextHeading));
      setHeadingAccuracy(value.accuracy);
    }).then((subscription) => {
      if (cancelled) subscription.remove();
      else headingSubscription.current = subscription;
    }).catch(() => undefined);

    return () => {
      cancelled = true;
      headingSubscription.current?.remove();
      headingSubscription.current = null;
    };
  }, [refreshLocation]);

  useEffect(() => {
    if (aligned && !wasAligned.current) {
      Vibration.vibrate([0, 120, 70, 180]);
      Animated.sequence([
        Animated.timing(flashOpacity, { toValue: 0.42, duration: 120, useNativeDriver: true }),
        Animated.timing(flashOpacity, { toValue: 0.04, duration: 150, useNativeDriver: true }),
        Animated.timing(flashOpacity, { toValue: 0.38, duration: 120, useNativeDriver: true }),
        Animated.timing(flashOpacity, { toValue: 0, duration: 250, useNativeDriver: true })
      ]).start();
    }
    wasAligned.current = aligned;
  }, [aligned, flashOpacity]);

  const turnInstruction = aligned
    ? (locale === "ar" ? "أنت باتجاه القبلة" : "You are facing the Qibla")
    : turn > 0
      ? (locale === "ar" ? `انعطف يميناً ${Math.round(Math.abs(turn))}°` : `Turn right ${Math.round(Math.abs(turn))}°`)
      : (locale === "ar" ? `انعطف يساراً ${Math.round(Math.abs(turn))}°` : `Turn left ${Math.round(Math.abs(turn))}°`);

  const accuracyText = headingAccuracy >= 3
    ? (locale === "ar" ? "دقة البوصلة جيدة" : "Compass accuracy is good")
    : (locale === "ar" ? "حرّك الهاتف بشكل 8 لتحسين الدقة" : "Move the phone in a figure 8 to improve accuracy");

  return (
    <View style={styles.root}>
      <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Pressable onPress={onBack} style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
            <Text style={styles.backText}>‹</Text>
          </Pressable>
          <View style={styles.headerCopy}>
            <Text style={styles.arabicTitle}>اتجاه القبلة</Text>
            <Text style={styles.title}>Qibla Direction</Text>
          </View>
          <View style={[styles.liveBadge, aligned && styles.liveBadgeAligned]}>
            <Text style={styles.liveBadgeText}>{aligned ? "✓" : "LIVE"}</Text>
          </View>
        </View>

        <View style={styles.locationCard}>
          <View style={styles.locationPin}><Text style={styles.locationPinText}>⌖</Text></View>
          <View style={styles.locationCopy}>
            <Text style={styles.locationEyebrow}>{locale === "ar" ? "الموقع الحالي" : "CURRENT LOCATION"}</Text>
            <Text numberOfLines={1} style={styles.locationTitle}>{locationLabel}</Text>
            {permissionDenied ? <Text style={styles.permissionWarning}>{locale === "ar" ? "فعّل الموقع للحصول على قبلة دقيقة من مكانك" : "Enable location for an exact Qibla from where you are"}</Text> : null}
          </View>
          <Pressable onPress={() => void refreshLocation()} style={({ pressed }) => [styles.refreshButton, pressed && styles.pressed]}>
            {loadingLocation ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.refreshText}>↻</Text>}
          </Pressable>
        </View>

        <View style={styles.smartStrip}>
          <View style={styles.smartMetric}><Text style={styles.smartMetricLabel}>{locale === "ar" ? "اتجاه الهاتف" : "PHONE"}</Text><Text style={styles.smartMetricValue}>{Math.round(heading)}° {currentDirection}</Text></View>
          <View style={styles.smartDivider} />
          <View style={styles.smartMetric}><Text style={styles.smartMetricLabel}>{locale === "ar" ? "اتجاه القبلة" : "QIBLA"}</Text><Text style={styles.smartMetricValue}>{Math.round(bearing)}° {targetDirection}</Text></View>
          <View style={styles.smartDivider} />
          <View style={styles.smartMetric}><Text style={styles.smartMetricLabel}>{locale === "ar" ? "المسافة" : "DISTANCE"}</Text><Text style={styles.smartMetricValue}>{Math.round(distanceKm).toLocaleString()} km</Text></View>
        </View>

        <View style={styles.compassWrap}>
          <View style={[styles.compassOuter, aligned && styles.compassOuterAligned]}>
            <View style={[styles.compassPulse, aligned && styles.compassPulseAligned]} />
            <View style={styles.compassInner}>
              <View style={[styles.compassRose, { transform: [{ rotate: `${-heading}deg` }] }]}>
                <Text style={[styles.directionLabel, styles.north]}>N</Text>
                <Text style={[styles.directionLabel, styles.east]}>E</Text>
                <Text style={[styles.directionLabel, styles.south]}>S</Text>
                <Text style={[styles.directionLabel, styles.west]}>W</Text>
                <Text style={[styles.degreeLabel, styles.deg30]}>30</Text><Text style={[styles.degreeLabel, styles.deg60]}>60</Text>
                <Text style={[styles.degreeLabel, styles.deg120]}>120</Text><Text style={[styles.degreeLabel, styles.deg150]}>150</Text>
                <Text style={[styles.degreeLabel, styles.deg210]}>210</Text><Text style={[styles.degreeLabel, styles.deg240]}>240</Text>
                <Text style={[styles.degreeLabel, styles.deg300]}>300</Text><Text style={[styles.degreeLabel, styles.deg330]}>330</Text>
              </View>

              <View style={[styles.needleLayer, { transform: [{ rotate: `${turn}deg` }] }]}>
                <View style={[styles.needleTip, aligned && styles.needleTipAligned]} />
                <View style={[styles.needleStem, aligned && styles.needleStemAligned]} />
                <View style={[styles.kaabaMarker, aligned && styles.kaabaMarkerAligned]}><Text style={styles.kaabaEmoji}>🕋</Text></View>
              </View>

              <View style={[styles.centerDial, aligned && styles.centerDialAligned]}>
                <Text style={styles.centerBearing}>{Math.round(bearing)}°</Text>
                <Text style={[styles.centerDirection, aligned && styles.centerDirectionAligned]}>{targetDirection}</Text>
                <Text style={styles.centerLive}>{locale === "ar" ? "قبلة" : "QIBLA"}</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={[styles.statusCard, aligned && styles.statusCardAligned]}>
          <View style={[styles.statusIcon, aligned && styles.statusIconAligned]}><Text style={styles.statusIconText}>{aligned ? "✓" : turn > 0 ? "↻" : "↺"}</Text></View>
          <View style={styles.statusCopy}>
            <Text style={[styles.statusArabic, aligned && styles.statusArabicAligned]}>{aligned ? "أنت متجه للقبلة" : "توجيه مباشر للقبلة"}</Text>
            <Text style={styles.statusTitle}>{turnInstruction}</Text>
            <Text style={styles.statusText}>{aligned
              ? (locale === "ar" ? "اهتز الهاتف ووميضت الشاشة لأنك أصبحت ضمن نطاق ٥ درجات من القبلة." : "The phone vibrated and the screen flashed because you are now within 5° of the Qibla.")
              : (locale === "ar" ? `حرّك الهاتف حتى يصل الفرق إلى 0°. الفرق الآن ${Math.round(Math.abs(turn))}°.` : `Rotate until the difference reaches 0°. You are ${Math.round(Math.abs(turn))}° away.`)}</Text>
          </View>
        </View>

        <View style={styles.tipCard}>
          <View style={styles.tipIcon}><Text style={styles.tipIconText}>✦</Text></View>
          <View style={styles.tipCopy}>
            <Text style={styles.tipTitle}>{locale === "ar" ? "مساعد البوصلة الذكي" : "Smart compass assistant"}</Text>
            <Text style={styles.tipText}>{accuracyText}. {locale === "ar" ? "ضع الهاتف بشكل مستوٍ وبعيداً عن المعادن والمغناطيس للحصول على أفضل نتيجة." : "Keep the phone flat and away from magnets or metal for the best result."}</Text>
          </View>
        </View>

        <View style={styles.infoCard}>
          <View style={styles.infoColumn}><Text style={styles.infoLabel}>{locale === "ar" ? "الزاوية" : "BEARING"}</Text><Text style={styles.infoValue}>{Math.round(bearing)}° {targetDirection}</Text></View>
          <View style={styles.infoDivider} />
          <View style={styles.infoColumn}><Text style={styles.infoLabel}>{locale === "ar" ? "العرض" : "LATITUDE"}</Text><Text style={styles.infoValue}>{Math.abs(coords.latitude).toFixed(2)}° {coords.latitude >= 0 ? "N" : "S"}</Text></View>
          <View style={styles.infoDivider} />
          <View style={styles.infoColumn}><Text style={styles.infoLabel}>{locale === "ar" ? "الطول" : "LONGITUDE"}</Text><Text style={styles.infoValue}>{Math.abs(coords.longitude).toFixed(2)}° {coords.longitude >= 0 ? "E" : "W"}</Text></View>
        </View>

        <Text style={styles.footer}>{locale === "ar" ? "يتم تحديث الاتجاه مباشرة من بوصلة الهاتف وحساب القبلة من موقعك إلى الكعبة المشرفة" : "Live heading from your phone compass • Qibla recalculated from your current location to the Kaaba"}</Text>
      </ScrollView>

      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.alignmentFlash, { opacity: flashOpacity }]} />
      {aligned ? <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.alignedFrame]} /> : null}
    </View>
  );
}

const gold = "#e0bd69";
const green = "#064f41";
const green2 = "#073f35";
const alignedBlue = "#31b8ff";

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: green },
  screen: { flex: 1, backgroundColor: green },
  content: { padding: 18, paddingBottom: 38 },
  header: { flexDirection: "row", alignItems: "center", marginBottom: 16 },
  backButton: { width: 44, height: 44, borderRadius: 16, borderWidth: 1, borderColor: "rgba(225,190,105,.36)", backgroundColor: "rgba(255,255,255,.05)", alignItems: "center", justifyContent: "center" },
  backText: { color: "#fff", fontSize: 34, lineHeight: 36, marginTop: -3 },
  headerCopy: { flex: 1, alignItems: "center" },
  arabicTitle: { color: "#fff", fontSize: 19, fontWeight: "900" },
  title: { color: "#d9e7e2", fontSize: 12, fontWeight: "700", marginTop: 2 },
  liveBadge: { minWidth: 44, height: 30, borderRadius: 15, borderWidth: 1, borderColor: "rgba(224,189,105,.45)", backgroundColor: "rgba(224,189,105,.12)", alignItems: "center", justifyContent: "center" },
  liveBadgeAligned: { borderColor: alignedBlue, backgroundColor: "rgba(49,184,255,.2)" },
  liveBadgeText: { color: "#fff", fontSize: 9, fontWeight: "900", letterSpacing: 1 },
  locationCard: { borderRadius: 20, borderWidth: 1, borderColor: "rgba(224,189,105,.38)", backgroundColor: "rgba(3,54,45,.68)", padding: 11, flexDirection: "row", alignItems: "center", gap: 10 },
  locationPin: { width: 38, height: 38, borderRadius: 13, backgroundColor: "rgba(224,189,105,.13)", alignItems: "center", justifyContent: "center" },
  locationPinText: { color: gold, fontSize: 24, fontWeight: "900" },
  locationCopy: { flex: 1 },
  locationEyebrow: { color: "#b4cfc5", fontSize: 7.5, fontWeight: "900", letterSpacing: 1.2 },
  locationTitle: { color: "#fff", fontSize: 14, fontWeight: "900", marginTop: 2 },
  permissionWarning: { color: "#f3cc86", fontSize: 7.5, marginTop: 3 },
  refreshButton: { width: 39, height: 39, borderRadius: 15, backgroundColor: "#11705a", alignItems: "center", justifyContent: "center" },
  refreshText: { color: "#fff", fontSize: 23, fontWeight: "700" },
  smartStrip: { flexDirection: "row", alignItems: "center", marginTop: 10, borderRadius: 17, paddingVertical: 10, paddingHorizontal: 6, backgroundColor: "rgba(255,255,255,.055)", borderWidth: 1, borderColor: "rgba(255,255,255,.1)" },
  smartMetric: { flex: 1, alignItems: "center" },
  smartMetricLabel: { color: "#8fb1a6", fontSize: 6.5, fontWeight: "900", letterSpacing: .8 },
  smartMetricValue: { color: "#fff", fontSize: 10, fontWeight: "900", marginTop: 3 },
  smartDivider: { width: 1, height: 28, backgroundColor: "rgba(224,189,105,.2)" },
  compassWrap: { alignItems: "center", paddingVertical: 24 },
  compassOuter: { width: 318, height: 318, borderRadius: 159, borderWidth: 3, borderColor: gold, backgroundColor: "#06483c", alignItems: "center", justifyContent: "center", shadowColor: "#000", shadowOpacity: .22, shadowRadius: 16, shadowOffset: { width: 0, height: 9 }, elevation: 7 },
  compassOuterAligned: { borderColor: alignedBlue, shadowColor: alignedBlue, shadowOpacity: .7, shadowRadius: 22, elevation: 12 },
  compassPulse: { position: "absolute", width: 306, height: 306, borderRadius: 153, borderWidth: 1, borderColor: "rgba(224,189,105,.18)" },
  compassPulseAligned: { borderWidth: 5, borderColor: "rgba(49,184,255,.52)" },
  compassInner: { width: 272, height: 272, borderRadius: 136, borderWidth: 1, borderColor: "rgba(224,189,105,.45)", backgroundColor: green2, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  compassRose: { position: "absolute", width: 272, height: 272, alignItems: "center", justifyContent: "center" },
  directionLabel: { position: "absolute", color: "#fff", fontSize: 15, fontWeight: "900" },
  north: { top: 10 }, east: { right: 13, top: 126 }, south: { bottom: 10 }, west: { left: 12, top: 126 },
  degreeLabel: { position: "absolute", color: "#a8c3ba", fontSize: 9, fontWeight: "800" },
  deg30: { top: 34, right: 67 }, deg60: { top: 74, right: 27 }, deg120: { bottom: 75, right: 23 }, deg150: { bottom: 34, right: 67 },
  deg210: { bottom: 34, left: 67 }, deg240: { bottom: 75, left: 23 }, deg300: { top: 74, left: 27 }, deg330: { top: 34, left: 67 },
  needleLayer: { position: "absolute", width: 18, height: 230, alignItems: "center", justifyContent: "flex-start" },
  needleTip: { width: 0, height: 0, borderLeftWidth: 9, borderRightWidth: 9, borderBottomWidth: 62, borderLeftColor: "transparent", borderRightColor: "transparent", borderBottomColor: gold, marginTop: 17 },
  needleTipAligned: { borderBottomColor: alignedBlue },
  needleStem: { width: 5, height: 70, backgroundColor: gold, borderRadius: 3 },
  needleStemAligned: { backgroundColor: alignedBlue },
  kaabaMarker: { position: "absolute", top: 0, width: 49, height: 49, borderRadius: 24.5, backgroundColor: "#e4c370", borderWidth: 2, borderColor: "#f5df9d", alignItems: "center", justifyContent: "center" },
  kaabaMarkerAligned: { backgroundColor: "#dff5ff", borderColor: alignedBlue },
  kaabaEmoji: { fontSize: 25 },
  centerDial: { width: 104, height: 104, borderRadius: 52, backgroundColor: "#064a3e", borderWidth: 1, borderColor: "rgba(224,189,105,.5)", alignItems: "center", justifyContent: "center" },
  centerDialAligned: { borderWidth: 3, borderColor: alignedBlue, backgroundColor: "#07526a" },
  centerBearing: { color: "#fff", fontSize: 31, fontWeight: "900" },
  centerDirection: { color: gold, fontSize: 11, fontWeight: "900", marginTop: 1 },
  centerDirectionAligned: { color: "#bdeaff" },
  centerLive: { color: "#8fb2a7", fontSize: 6.5, fontWeight: "900", letterSpacing: 1, marginTop: 2 },
  statusCard: { borderRadius: 20, borderWidth: 1, borderColor: "rgba(224,189,105,.45)", backgroundColor: "rgba(3,53,44,.74)", padding: 13, flexDirection: "row", alignItems: "center", gap: 11 },
  statusCardAligned: { borderColor: alignedBlue, backgroundColor: "rgba(5,72,92,.9)" },
  statusIcon: { width: 47, height: 47, borderRadius: 24, backgroundColor: "#16785f", alignItems: "center", justifyContent: "center" },
  statusIconAligned: { backgroundColor: alignedBlue },
  statusIconText: { color: "#fff", fontSize: 25, fontWeight: "900" },
  statusCopy: { flex: 1 },
  statusArabic: { color: "#f0d58c", fontSize: 12, fontWeight: "900" },
  statusArabicAligned: { color: "#bfeaff" },
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
  alignmentFlash: { backgroundColor: alignedBlue },
  alignedFrame: { borderWidth: 7, borderColor: alignedBlue },
  pressed: { opacity: .72, transform: [{ scale: .985 }] }
});
