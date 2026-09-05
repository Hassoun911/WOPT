from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
P = ROOT / "mobile/src/MasjidDisplayPage.tsx"

P.write_text(r'''import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  useWindowDimensions,
  View
} from "react-native";
import * as ScreenOrientation from "expo-screen-orientation";
import { loadInitialPrayerTimes, loadPrayerTimes, type PrayerLocation } from "./prayerData";
import { PRAYER_KEYS, type PrayerDay, type PrayerTimes } from "./types";

type Props = { locale: "en" | "ar"; onBack: () => void };
type PrayerMeta = { key: keyof PrayerDay; en: string; ar: string };

const PRAYERS: PrayerMeta[] = [
  { key: "fajr", en: "Fajr", ar: "الفجر" },
  { key: "dhuhr", en: "Dhuhr", ar: "الظهر" },
  { key: "asr", en: "Asr", ar: "العصر" },
  { key: "maghrib", en: "Maghrib", ar: "المغرب" },
  { key: "isha", en: "Isha", ar: "العشاء" }
];

function dateKey(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value || "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function clockParts(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true
  }).formatToParts(date);
  return {
    time: `${parts.find((p) => p.type === "hour")?.value || ""}:${parts.find((p) => p.type === "minute")?.value || "00"}`,
    second: parts.find((p) => p.type === "second")?.value || "00",
    period: parts.find((p) => p.type === "dayPeriod")?.value || ""
  };
}

function minutesFor(value?: string) {
  if (!value) return null;
  const m = value.trim().match(/^(\d{1,2}):(\d{2})(?:\s*([AP]M))?$/i);
  if (!m) return null;
  let h = Number(m[1]);
  const min = Number(m[2]);
  const ap = (m[3] || "").toUpperCase();
  if (ap === "PM" && h < 12) h += 12;
  if (ap === "AM" && h === 12) h = 0;
  return h * 60 + min;
}

function nowMinutes(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).formatToParts(date);
  return Number(parts.find((p) => p.type === "hour")?.value || 0) * 60 + Number(parts.find((p) => p.type === "minute")?.value || 0);
}

export default function MasjidDisplayPage({ locale, onBack }: Props) {
  const { width, height } = useWindowDimensions();
  const landscape = width > height;
  const phonePortrait = !landscape && width < 700;
  const compactLandscape = landscape && height < 520;
  const ar = locale === "ar";
  const t = (en: string, arabic: string) => ar ? arabic : en;

  const [now, setNow] = useState(new Date());
  const [times, setTimes] = useState<PrayerTimes>({});
  const [location, setLocation] = useState<PrayerLocation>({
    latitude: 42.3149,
    longitude: -83.0364,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Toronto",
    label: "Current location",
    source: "saved"
  });
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const loaded = await loadPrayerTimes();
      setTimes(loaded.prayerTimes);
      setLocation(loaded.location);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let alive = true;
    void loadInitialPrayerTimes().then((loaded) => {
      if (!alive) return;
      setTimes(loaded.prayerTimes);
      setLocation(loaded.location);
      setLoading(false);
      void refresh();
    });
    const clock = setInterval(() => setNow(new Date()), 1000);
    return () => { alive = false; clearInterval(clock); };
  }, [refresh]);

  useEffect(() => {
    void ScreenOrientation.unlockAsync().catch(() => undefined);
    return () => { void ScreenOrientation.unlockAsync().catch(() => undefined); };
  }, []);

  const key = dateKey(now, location.timezone);
  const day = times[key];
  const currentMinutes = nowMinutes(now, location.timezone);
  const nextKey = useMemo(() => {
    if (!day) return null;
    for (const prayer of PRAYER_KEYS) {
      const m = minutesFor(day[prayer]);
      if (m !== null && m > currentMinutes) return prayer;
    }
    return "fajr" as const;
  }, [day, currentMinutes]);

  const clock = clockParts(now, location.timezone);
  const gregorian = new Intl.DateTimeFormat(ar ? "ar" : "en-CA", {
    timeZone: location.timezone,
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric"
  }).format(now);

  let hijri = "";
  try {
    hijri = new Intl.DateTimeFormat(ar ? "ar-SA-u-ca-islamic" : "en-US-u-ca-islamic", {
      timeZone: location.timezone,
      month: "long",
      day: "numeric",
      year: "numeric"
    }).format(now);
  } catch {}

  return (
    <Modal visible animationType="fade" presentationStyle="fullScreen" statusBarTranslucent onRequestClose={onBack}>
      <View style={[styles.root, phonePortrait && styles.rootPhone, compactLandscape && styles.rootCompactLandscape]}>
        <StatusBar hidden />
        <View pointerEvents="none" style={styles.glowOne} />
        <View pointerEvents="none" style={styles.glowTwo} />

        {phonePortrait ? (
          <>
            <View style={styles.phoneTopBar}>
              <View style={styles.phoneBrand}>
                <Image source={require("../assets/hassoun-logo.png")} resizeMode="contain" style={styles.phoneLogo} />
                <View style={styles.phoneBrandCopy}>
                  <Text style={styles.phoneTitle} numberOfLines={1}>{t("Hassoun Masjid Display", "شاشة حسّون للمسجد")}</Text>
                  <Text style={styles.phoneLocation} numberOfLines={1}>📍 {location.label}</Text>
                </View>
              </View>
              <View style={styles.phoneActions}>
                <Pressable onPress={() => void refresh()} style={styles.smallAction}><Text style={styles.smallActionText}>↻</Text></Pressable>
                <Pressable onPress={onBack} style={styles.smallAction}><Text style={styles.smallActionText}>×</Text></Pressable>
              </View>
            </View>

            <View style={styles.phoneClockHero}>
              <View style={styles.phoneClockLine}>
                <Text style={styles.phoneClock}>{clock.time}</Text>
                <View style={styles.phoneClockMeta}><Text style={styles.phonePeriod}>{clock.period}</Text><Text style={styles.phoneSeconds}>{clock.second}</Text></View>
              </View>
              <Text style={styles.phoneDate}>{gregorian}</Text>
              {hijri ? <Text style={styles.phoneHijri}>☾ {hijri}</Text> : null}
            </View>
          </>
        ) : (
          <View style={[styles.header, compactLandscape && styles.headerCompactLandscape]}>
            <View style={styles.brandBlock}>
              <Image source={require("../assets/hassoun-logo.png")} resizeMode="contain" style={[styles.logo, compactLandscape && styles.logoCompact]} />
              <View style={styles.brandCopy}>
                <Text style={[styles.title, compactLandscape && styles.titleCompact]} numberOfLines={1}>{t("Hassoun Masjid Display", "شاشة حسّون للمسجد")}</Text>
                <Text style={styles.location} numberOfLines={1}>📍 {location.label}</Text>
              </View>
            </View>
            <View style={styles.clockBlock}>
              <View style={styles.clockLine}><Text style={[styles.clock, compactLandscape && styles.clockCompact]}>{clock.time}</Text><View><Text style={styles.period}>{clock.period}</Text><Text style={styles.seconds}>{clock.second}</Text></View></View>
              <Text style={styles.date}>{gregorian}</Text>
              {hijri ? <Text style={styles.hijri}>☾ {hijri}</Text> : null}
            </View>
            <View style={styles.actions}>
              <Pressable onPress={() => void refresh()} style={styles.action}><Text style={styles.actionText}>↻</Text></Pressable>
              <Pressable onPress={onBack} style={styles.action}><Text style={styles.actionText}>×</Text></Pressable>
            </View>
          </View>
        )}

        <View style={[styles.rule, phonePortrait && styles.rulePhone]} />

        <View style={[styles.prayerArea, landscape ? styles.prayerLandscape : styles.prayerPortrait]}>
          {PRAYERS.map((prayer) => {
            const active = nextKey === prayer.key;
            return (
              <View
                key={prayer.key}
                style={[
                  styles.prayerCard,
                  landscape ? styles.prayerCardLandscape : styles.prayerCardPortrait,
                  phonePortrait && styles.prayerCardPhone,
                  compactLandscape && styles.prayerCardCompactLandscape,
                  active && styles.prayerCardActive
                ]}
              >
                {active ? <Text style={[styles.nextBadge, phonePortrait && styles.nextBadgePhone]}>{t("NEXT", "القادمة")}</Text> : null}
                <Text style={[styles.prayerArabic, phonePortrait && styles.prayerArabicPhone]}>{prayer.ar}</Text>
                <Text style={[styles.prayerName, phonePortrait && styles.prayerNamePhone]}>{ar ? prayer.ar : prayer.en}</Text>
                <Text style={[styles.prayerTime, phonePortrait && styles.prayerTimePhone, compactLandscape && styles.prayerTimeCompact, active && styles.prayerTimeActive]}>{day?.[prayer.key] || "--:--"}</Text>
                {active ? <View style={styles.activeBar} /> : null}
              </View>
            );
          })}
        </View>

        <View style={[styles.footer, phonePortrait && styles.footerPhone]}>
          <View style={styles.footerMessage}>
            <Text style={[styles.footerIcon, phonePortrait && styles.footerIconPhone]}>☪</Text>
            <View style={styles.footerCopy}>
              <Text style={[styles.footerTitle, phonePortrait && styles.footerTitlePhone]}>{t("Prayer • Qur’an • Knowledge", "الصلاة • القرآن • المعرفة")}</Text>
              {!phonePortrait ? <Text style={styles.footerSub}>{t("Please silence mobile phones and prepare for salah", "يرجى إغلاق صوت الهواتف والاستعداد للصلاة")}</Text> : null}
            </View>
          </View>
          <View style={styles.sourcePill}><Text style={styles.sourceText} numberOfLines={1}>{location.source === "windsor_islamic_association" ? t("Official Windsor schedule", "جدول وندسور الرسمي") : t("Local prayer times", "مواقيت الصلاة المحلية")}</Text></View>
        </View>

        {loading ? <View style={styles.loading}><ActivityIndicator size="large" color="#E2C56D" /><Text style={styles.loadingText}>{t("Updating prayer times…", "جارٍ تحديث مواقيت الصلاة…")}</Text></View> : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#031D18", paddingHorizontal: 28, paddingTop: 20, paddingBottom: 18, overflow: "hidden" },
  rootPhone: { paddingHorizontal: 18, paddingTop: 16, paddingBottom: 14 },
  rootCompactLandscape: { paddingHorizontal: 18, paddingTop: 10, paddingBottom: 10 },
  glowOne: { position: "absolute", top: -230, right: -170, width: 620, height: 620, borderRadius: 320, backgroundColor: "rgba(19,109,82,0.20)" },
  glowTwo: { position: "absolute", bottom: -330, left: -260, width: 720, height: 720, borderRadius: 380, backgroundColor: "rgba(5,77,59,0.13)" },

  phoneTopBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  phoneBrand: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center" },
  phoneLogo: { width: 62, height: 62, marginRight: 11 },
  phoneBrandCopy: { flex: 1, minWidth: 0 },
  phoneTitle: { color: "#FFF8E7", fontSize: 19, fontWeight: "900" },
  phoneLocation: { color: "#ABC3BA", fontSize: 12, fontWeight: "700", marginTop: 4 },
  phoneActions: { flexDirection: "row", gap: 7 },
  smallAction: { width: 39, height: 39, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.08)", borderWidth: 1, borderColor: "rgba(255,255,255,0.12)" },
  smallActionText: { color: "#FFFFFF", fontSize: 22, fontWeight: "800" },
  phoneClockHero: { alignItems: "center", paddingTop: 6, paddingBottom: 8 },
  phoneClockLine: { flexDirection: "row", alignItems: "center", gap: 8 },
  phoneClock: { color: "#FFFFFF", fontSize: 64, lineHeight: 68, fontWeight: "900", letterSpacing: -2 },
  phoneClockMeta: { paddingTop: 3 },
  phonePeriod: { color: "#E6C76F", fontSize: 15, fontWeight: "900" },
  phoneSeconds: { color: "#6F9A8B", fontSize: 12, fontWeight: "800", marginTop: 2 },
  phoneDate: { color: "#C9D8D2", fontSize: 13, fontWeight: "700", marginTop: 2 },
  phoneHijri: { color: "#E1C36D", fontSize: 13, fontWeight: "800", marginTop: 3 },

  header: { minHeight: 126, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 20 },
  headerCompactLandscape: { minHeight: 90, gap: 12 },
  brandBlock: { flex: 1.2, minWidth: 0, flexDirection: "row", alignItems: "center" },
  logo: { width: 84, height: 84, marginRight: 14 },
  logoCompact: { width: 58, height: 58, marginRight: 9 },
  brandCopy: { flex: 1, minWidth: 0 },
  title: { color: "#FFF8E7", fontSize: 25, fontWeight: "900" },
  titleCompact: { fontSize: 19 },
  location: { color: "#B2C7C0", fontSize: 14, fontWeight: "700", marginTop: 6 },
  clockBlock: { flex: 1, alignItems: "center" },
  clockLine: { flexDirection: "row", alignItems: "center", gap: 8 },
  clock: { color: "#FFFFFF", fontSize: 58, fontWeight: "900", letterSpacing: -2 },
  clockCompact: { fontSize: 42 },
  period: { color: "#E5C66D", fontSize: 14, fontWeight: "900" },
  seconds: { color: "#759B8E", fontSize: 12, fontWeight: "800", marginTop: 2 },
  date: { color: "#C8D6D1", fontSize: 13, fontWeight: "700", marginTop: 1 },
  hijri: { color: "#DDBF69", fontSize: 12, fontWeight: "800", marginTop: 3 },
  actions: { flexDirection: "row", gap: 8 },
  action: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.08)", borderWidth: 1, borderColor: "rgba(255,255,255,0.12)" },
  actionText: { color: "#FFFFFF", fontSize: 25, fontWeight: "800" },

  rule: { height: 1, backgroundColor: "rgba(227,197,109,0.28)", marginBottom: 16 },
  rulePhone: { marginBottom: 12 },
  prayerArea: { flex: 1, gap: 12 },
  prayerLandscape: { flexDirection: "row", alignItems: "stretch" },
  prayerPortrait: { flexDirection: "row", flexWrap: "wrap", alignContent: "stretch", justifyContent: "center" },
  prayerCard: { position: "relative", backgroundColor: "rgba(255,255,255,0.055)", borderWidth: 1, borderColor: "rgba(255,255,255,0.11)", borderRadius: 22, alignItems: "center", justifyContent: "center", paddingHorizontal: 10, overflow: "hidden" },
  prayerCardLandscape: { flex: 1 },
  prayerCardPortrait: { width: "47%", minHeight: 142, flexGrow: 1 },
  prayerCardPhone: { minHeight: 126, borderRadius: 18 },
  prayerCardCompactLandscape: { borderRadius: 17 },
  prayerCardActive: { backgroundColor: "rgba(19,106,80,0.37)", borderColor: "#DDBF69", borderWidth: 2 },
  nextBadge: { position: "absolute", top: 12, backgroundColor: "#D9BB63", color: "#0B2A22", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, fontSize: 9, fontWeight: "900", letterSpacing: 0.6 },
  nextBadgePhone: { top: 8, fontSize: 8, paddingVertical: 3 },
  prayerArabic: { color: "#E2C56C", fontSize: 23, fontWeight: "800", marginBottom: 4 },
  prayerArabicPhone: { fontSize: 19, marginBottom: 3 },
  prayerName: { color: "#C9D6D1", fontSize: 14, fontWeight: "800", textTransform: "uppercase", letterSpacing: 1 },
  prayerNamePhone: { fontSize: 11 },
  prayerTime: { color: "#FFFFFF", fontSize: 32, fontWeight: "900", marginTop: 10, letterSpacing: -0.4 },
  prayerTimePhone: { fontSize: 28, marginTop: 7 },
  prayerTimeCompact: { fontSize: 26, marginTop: 7 },
  prayerTimeActive: { color: "#FFE69B" },
  activeBar: { position: "absolute", bottom: 0, left: 22, right: 22, height: 4, borderTopLeftRadius: 4, borderTopRightRadius: 4, backgroundColor: "#D9BB63" },

  footer: { minHeight: 68, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 14, paddingTop: 14 },
  footerPhone: { minHeight: 50, paddingTop: 10 },
  footerMessage: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10 },
  footerIcon: { color: "#DCC373", fontSize: 30 },
  footerIconPhone: { fontSize: 24 },
  footerCopy: { flex: 1, minWidth: 0 },
  footerTitle: { color: "#F5EDDB", fontWeight: "900", fontSize: 15 },
  footerTitlePhone: { fontSize: 12 },
  footerSub: { color: "#89A39A", fontWeight: "600", fontSize: 11, marginTop: 2 },
  sourcePill: { maxWidth: "42%", borderRadius: 14, backgroundColor: "rgba(255,255,255,0.065)", borderWidth: 1, borderColor: "rgba(255,255,255,0.10)", paddingHorizontal: 11, paddingVertical: 8 },
  sourceText: { color: "#BFD0CA", fontSize: 10, fontWeight: "800" },

  loading: { ...StyleSheet.absoluteFill, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(3,29,24,0.86)", gap: 12 },
  loadingText: { color: "#E9F0ED", fontSize: 14, fontWeight: "700" }
});
''', encoding="utf-8")

print("Built true full-screen native Masjid display with phone portrait + TV/tablet responsive layouts")
