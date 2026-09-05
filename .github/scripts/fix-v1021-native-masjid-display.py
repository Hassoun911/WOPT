from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
P = ROOT / "mobile/src/MasjidDisplayPage.tsx"

P.write_text(r'''import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
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
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true
  });
  const parts = fmt.formatToParts(date);
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
  const compact = Math.min(width, height) < 650;
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
    for (const p of PRAYER_KEYS) {
      const m = minutesFor(day[p]);
      if (m !== null && m > currentMinutes) return p;
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
    <View style={styles.root}>
      <StatusBar hidden />
      <View style={[styles.topGlow, landscape ? styles.topGlowLandscape : null]} />
      <View style={[styles.header, compact && styles.headerCompact]}>
        <View style={styles.brandBlock}>
          <Image source={require("../assets/hassoun-logo.png")} resizeMode="contain" style={[styles.logo, compact && styles.logoCompact]} />
          <View style={styles.brandText}>
            <Text style={[styles.masjidTitle, compact && styles.masjidTitleCompact]} numberOfLines={1}>{t("Hassoun Masjid Display", "شاشة حسّون للمسجد")}</Text>
            <Text style={styles.location} numberOfLines={1}>📍 {location.label}</Text>
          </View>
        </View>
        <View style={styles.clockBlock}>
          <View style={styles.clockLine}><Text style={[styles.clock, compact && styles.clockCompact]}>{clock.time}</Text><View><Text style={styles.period}>{clock.period}</Text><Text style={styles.seconds}>{clock.second}</Text></View></View>
          <Text style={styles.date}>{gregorian}</Text>
          {hijri ? <Text style={styles.hijri}>☾ {hijri}</Text> : null}
        </View>
        <View style={styles.actions}>
          <Pressable onPress={() => void refresh()} style={styles.actionButton}><Text style={styles.actionText}>↻</Text></Pressable>
          <Pressable onPress={onBack} style={styles.actionButton}><Text style={styles.actionText}>×</Text></Pressable>
        </View>
      </View>

      <View style={styles.rule} />

      <View style={[styles.prayerArea, landscape ? styles.prayerLandscape : styles.prayerPortrait]}>
        {PRAYERS.map((prayer) => {
          const active = nextKey === prayer.key;
          return (
            <View key={prayer.key} style={[styles.prayerCard, landscape ? styles.prayerCardLandscape : styles.prayerCardPortrait, active && styles.prayerCardActive]}>
              {active ? <Text style={styles.nextBadge}>{t("NEXT PRAYER", "الصلاة القادمة")}</Text> : <View style={styles.badgeSpacer} />}
              <Text style={[styles.prayerArabic, compact && styles.prayerArabicCompact]}>{prayer.ar}</Text>
              <Text style={[styles.prayerName, compact && styles.prayerNameCompact]}>{ar ? prayer.ar : prayer.en}</Text>
              <Text style={[styles.prayerTime, compact && styles.prayerTimeCompact, active && styles.prayerTimeActive]}>{day?.[prayer.key] || "--:--"}</Text>
              {active ? <View style={styles.activeBar} /> : null}
            </View>
          );
        })}
      </View>

      <View style={styles.footer}>
        <View style={styles.footerMessage}>
          <Text style={styles.footerIcon}>☪</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.footerTitle}>{t("Prayer • Qur’an • Knowledge", "الصلاة • القرآن • المعرفة")}</Text>
            <Text style={styles.footerSub}>{t("Please silence mobile phones and prepare for salah", "يرجى إغلاق صوت الهواتف والاستعداد للصلاة")}</Text>
          </View>
        </View>
        <View style={styles.sourcePill}><Text style={styles.sourceText}>{location.source === "windsor_islamic_association" ? t("Official Windsor Islamic Association schedule", "جدول جمعية وندسور الإسلامية الرسمي") : t("Local prayer times", "مواقيت الصلاة المحلية")}</Text></View>
      </View>

      {loading ? <View style={styles.loading}><ActivityIndicator size="large" /><Text style={styles.loadingText}>{t("Updating prayer times…", "جارٍ تحديث مواقيت الصلاة…")}</Text></View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#061D19", paddingHorizontal: 24, paddingTop: 18, paddingBottom: 18, overflow: "hidden" },
  topGlow: { position: "absolute", top: -160, right: -120, width: 430, height: 430, borderRadius: 240, backgroundColor: "rgba(20,111,84,0.18)" },
  topGlowLandscape: { width: 620, height: 620, borderRadius: 340 },
  header: { minHeight: 132, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 20 },
  headerCompact: { minHeight: 106, gap: 12 },
  brandBlock: { flex: 1.25, flexDirection: "row", alignItems: "center", minWidth: 0 },
  logo: { width: 88, height: 88, marginRight: 16 },
  logoCompact: { width: 62, height: 62, marginRight: 10 },
  brandText: { flex: 1, minWidth: 0 },
  masjidTitle: { color: "#FFF8E7", fontSize: 26, fontWeight: "900", letterSpacing: 0.2 },
  masjidTitleCompact: { fontSize: 19 },
  location: { color: "#B6CCC4", fontSize: 15, fontWeight: "700", marginTop: 7 },
  clockBlock: { flex: 1, alignItems: "center" },
  clockLine: { flexDirection: "row", alignItems: "center", gap: 8 },
  clock: { color: "#FFFFFF", fontSize: 58, fontWeight: "900", letterSpacing: -2 },
  clockCompact: { fontSize: 40 },
  period: { color: "#EACB78", fontSize: 14, fontWeight: "900" },
  seconds: { color: "#769B8F", fontSize: 13, fontWeight: "800", marginTop: 3 },
  date: { color: "#C9D7D2", fontSize: 14, fontWeight: "700", marginTop: 2 },
  hijri: { color: "#DABF72", fontSize: 13, fontWeight: "800", marginTop: 4 },
  actions: { flexDirection: "row", gap: 8 },
  actionButton: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.08)", borderWidth: 1, borderColor: "rgba(255,255,255,0.12)" },
  actionText: { color: "#FFFFFF", fontSize: 25, fontWeight: "800" },
  rule: { height: 1, backgroundColor: "rgba(229,201,124,0.25)", marginBottom: 18 },
  prayerArea: { flex: 1, gap: 12 },
  prayerLandscape: { flexDirection: "row", alignItems: "stretch" },
  prayerPortrait: { flexDirection: "row", flexWrap: "wrap", alignContent: "stretch", justifyContent: "center" },
  prayerCard: { backgroundColor: "rgba(255,255,255,0.055)", borderWidth: 1, borderColor: "rgba(255,255,255,0.10)", borderRadius: 22, alignItems: "center", justifyContent: "center", paddingHorizontal: 12, overflow: "hidden" },
  prayerCardLandscape: { flex: 1 },
  prayerCardPortrait: { width: "47%", minHeight: 150, flexGrow: 1 },
  prayerCardActive: { backgroundColor: "rgba(19,106,80,0.36)", borderColor: "#D6B962", borderWidth: 2 },
  nextBadge: { position: "absolute", top: 15, backgroundColor: "#D5B95F", color: "#132B24", paddingHorizontal: 11, paddingVertical: 5, borderRadius: 20, fontSize: 10, fontWeight: "900", letterSpacing: 0.7 },
  badgeSpacer: { height: 20 },
  prayerArabic: { color: "#E6C970", fontSize: 23, fontWeight: "800", marginBottom: 5 },
  prayerArabicCompact: { fontSize: 18 },
  prayerName: { color: "#C9D6D1", fontSize: 15, fontWeight: "800", textTransform: "uppercase", letterSpacing: 1 },
  prayerNameCompact: { fontSize: 12 },
  prayerTime: { color: "#FFFFFF", fontSize: 33, fontWeight: "900", marginTop: 12, letterSpacing: -0.5 },
  prayerTimeCompact: { fontSize: 25, marginTop: 8 },
  prayerTimeActive: { color: "#FFE8A0" },
  activeBar: { position: "absolute", bottom: 0, left: 28, right: 28, height: 5, borderTopLeftRadius: 5, borderTopRightRadius: 5, backgroundColor: "#D5B95F" },
  footer: { minHeight: 74, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 16, paddingTop: 16 },
  footerMessage: { flex: 1, flexDirection: "row", alignItems: "center", gap: 12 },
  footerIcon: { color: "#DCC373", fontSize: 32 },
  footerTitle: { color: "#F6EEDC", fontWeight: "900", fontSize: 16 },
  footerSub: { color: "#8EA8A0", fontWeight: "600", fontSize: 12, marginTop: 3 },
  sourcePill: { maxWidth: "38%", borderRadius: 16, backgroundColor: "rgba(255,255,255,0.06)", paddingHorizontal: 14, paddingVertical: 9, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
  sourceText: { color: "#AFC3BC", fontSize: 11, fontWeight: "700", textAlign: "center" },
  loading: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(3,18,15,0.82)", alignItems: "center", justifyContent: "center" },
  loadingText: { color: "#FFFFFF", fontSize: 15, fontWeight: "800", marginTop: 12 }
});
''', encoding="utf-8")
print("Wrote native responsive MasjidDisplayPage.tsx")
