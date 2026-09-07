from pathlib import Path

PAGE = r'''import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import { useKeepAwake } from "expo-keep-awake";
import * as NavigationBar from "expo-navigation-bar";
import * as ScreenOrientation from "expo-screen-orientation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Image, Modal, Platform, Pressable, ScrollView, StatusBar, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { loadInitialPrayerTimes, loadPrayerTimes, type PrayerLocation } from "./prayerData";
import { PRAYER_KEYS, type PrayerDay, type PrayerTimes } from "./types";

type Props = { locale: "en" | "ar"; onBack: () => void };
type PrayerKey = keyof PrayerDay;
type Device = { id: string; code: string; secret: string; name: string };

type PrayerMeta = { key: PrayerKey; en: string; ar: string; icon: string };

const API = "https://wopt-prayer-push.wopt-windsor.workers.dev";
const SETTINGS_KEY = "hassoun:native-wall-display:v4";
const DEVICE_KEY = "hassoun:native-wall-display-device:v2";
const DISPLAY_MARKER = "HASSOUN_NATIVE_TABLET_GRAND_V1";

const PRAYERS: PrayerMeta[] = [
  { key: "fajr", en: "Fajr", ar: "الفجر", icon: "☾" },
  { key: "dhuhr", en: "Dhuhr", ar: "الظهر", icon: "☀" },
  { key: "asr", en: "Asr", ar: "العصر", icon: "◉" },
  { key: "maghrib", en: "Maghrib", ar: "المغرب", icon: "◒" },
  { key: "isha", en: "Isha", ar: "العشاء", icon: "☽" },
];

const CLASSIC = {
  pageA: "#fbfaf6",
  pageB: "#f3f0e8",
  clock: "#8f2434",
  meta: "#243b36",
  cardA: "#075d52",
  cardB: "#006b5d",
  gold: "#edc268",
  white: "#fffdf7",
  muted: "#d9d2c6",
  mini: "#faf8fb",
  miniText: "#233732",
  nextA: "#0c6c5d",
  nextB: "#075449",
};

const rand = () => Math.random().toString(36).slice(2, 10);
const makeDevice = (): Device => ({
  id: `${Date.now().toString(36)}${rand()}${rand()}`,
  code: String(Math.floor(100000 + Math.random() * 900000)),
  secret: `${rand()}${rand()}${rand()}${rand()}`,
  name: "Hassoun Native Tablet Display",
});

function dateKey(d: Date, z: string) {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: z, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(d);
  const g = (x: string) => p.find(q => q.type === x)?.value || "";
  return `${g("year")}-${g("month")}-${g("day")}`;
}

function minutes(v?: string) {
  const m = String(v || "").match(/^(\d{1,2}):(\d{2})/);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

function nowMinutes(d: Date, z: string) {
  const p = new Intl.DateTimeFormat("en-US", { timeZone: z, hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(d);
  return Number(p.find(x => x.type === "hour")?.value || 0) * 60 + Number(p.find(x => x.type === "minute")?.value || 0);
}

function prayerParts(v?: string) {
  const m = String(v || "").match(/^(\d{1,2}):(\d{2})/);
  if (!m) return { main: "--:--", period: "" };
  const h = Number(m[1]);
  return { main: `${h % 12 || 12}:${m[2]}`, period: h >= 12 ? "p.m." : "a.m." };
}

function zonedParts(d: Date, z: string) {
  const p = new Intl.DateTimeFormat("en-US", { timeZone: z, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).formatToParts(d);
  const n = (t: string) => Number(p.find(x => x.type === t)?.value || 0);
  return { year: n("year"), month: n("month"), day: n("day"), hour: n("hour"), minute: n("minute"), second: n("second") };
}

function secondsUntilPrayer(now: Date, timezone: string, hhmm?: string) {
  const m = String(hhmm || "").match(/^(\d{1,2}):(\d{2})/);
  if (!m) return 0;
  const z = zonedParts(now, timezone);
  const targetMinutes = Number(m[1]) * 60 + Number(m[2]);
  const currentSeconds = z.hour * 3600 + z.minute * 60 + z.second;
  let targetSeconds = targetMinutes * 60;
  if (targetSeconds <= currentSeconds) targetSeconds += 24 * 3600;
  return Math.max(0, targetSeconds - currentSeconds);
}

function humanLeft(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m left`;
  return `${Math.max(1, m)}m left`;
}

export default function MasjidDisplayPage({ locale, onBack }: Props) {
  useKeepAwake();
  const { width, height } = useWindowDimensions();
  const landscape = width > height;
  const ar = locale === "ar";
  const t = (en: string, a: string) => ar ? a : en;

  const [now, setNow] = useState(new Date());
  const [times, setTimes] = useState<PrayerTimes>({});
  const [location, setLocation] = useState<PrayerLocation>({ latitude: 42.3149, longitude: -83.0364, timezone: "America/Toronto", label: "Current location", source: "saved" });
  const [loading, setLoading] = useState(true);
  const [setup, setSetup] = useState(false);
  const [device, setDevice] = useState<Device | null>(null);
  const [paired, setPaired] = useState(false);
  const [slide, setSlide] = useState(0);
  const [slideSeconds, setSlideSeconds] = useState(8);

  const refresh = useCallback(async () => {
    try {
      const x = await loadPrayerTimes();
      setTimes(x.prayerTimes);
      setLocation(x.location);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const [raw, loaded] = await Promise.all([AsyncStorage.getItem(DEVICE_KEY), loadInitialPrayerTimes()]);
      if (!alive) return;
      let d: Device;
      try { d = raw ? JSON.parse(raw) : makeDevice(); } catch { d = makeDevice(); }
      setDevice(d);
      await AsyncStorage.setItem(DEVICE_KEY, JSON.stringify(d));
      const saved = await AsyncStorage.getItem(SETTINGS_KEY);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Number(parsed?.slideSeconds) >= 4) setSlideSeconds(Number(parsed.slideSeconds));
        } catch {}
      }
      setTimes(loaded.prayerTimes);
      setLocation(loaded.location);
      setLoading(false);
      void refresh();
    })();

    const id = setInterval(() => setNow(new Date()), 1000);
    void ScreenOrientation.unlockAsync().catch(() => undefined);
    if (Platform.OS === "android") {
      void NavigationBar.setBehaviorAsync("overlay-swipe").catch(() => undefined);
      void NavigationBar.setVisibilityAsync("hidden").catch(() => undefined);
    }
    return () => {
      alive = false;
      clearInterval(id);
      if (Platform.OS === "android") void NavigationBar.setVisibilityAsync("visible").catch(() => undefined);
    };
  }, [refresh]);

  useEffect(() => {
    const id = setInterval(() => setSlide(n => (n + 1) % PRAYERS.length), Math.max(4, slideSeconds) * 1000);
    return () => clearInterval(id);
  }, [slideSeconds]);

  useEffect(() => {
    if (!device) return;
    let dead = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const register = async () => {
      try {
        await fetch(`${API}/masjid-displays/register`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ deviceId: device.id, pairCode: device.code, deviceSecret: device.secret, name: device.name, settings: { displayMode: "native-tablet-grand", displayMarker: DISPLAY_MARKER } }),
        });
      } catch {}
    };
    const poll = async () => {
      if (dead) return;
      try {
        const r = await fetch(`${API}/masjid-displays/device/${encodeURIComponent(device.id)}?secret=${encodeURIComponent(device.secret)}`, { cache: "no-store" });
        if (r.status === 404) await register();
        else if (r.ok) {
          const data = await r.json() as { pairCode?: string; settings?: Record<string, any>; paired?: boolean; controllerCount?: number };
          if (data.pairCode && /^\d{6}$/.test(data.pairCode) && data.pairCode !== device.code) {
            const n = { ...device, code: data.pairCode };
            setDevice(n);
            await AsyncStorage.setItem(DEVICE_KEY, JSON.stringify(n));
          }
          const remoteSlide = Number(data.settings?.sliderSeconds);
          if (remoteSlide >= 4 && remoteSlide <= 60) {
            setSlideSeconds(remoteSlide);
            await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify({ slideSeconds: remoteSlide }));
          }
          setPaired(Boolean(data.paired) || (Number(data.controllerCount) || 0) > 0);
        }
      } catch {}
      timer = setTimeout(poll, 1000);
    };
    void register().then(poll);
    return () => { dead = true; if (timer) clearTimeout(timer); };
  }, [device?.id]);

  const key = dateKey(now, location.timezone);
  const day = times[key];
  const cur = nowMinutes(now, location.timezone);
  const next = useMemo(() => {
    if (!day) return "fajr" as PrayerKey;
    for (const p of PRAYER_KEYS) {
      const m = minutes(day[p]);
      if (m !== null && m > cur) return p;
    }
    return "fajr" as PrayerKey;
  }, [day, cur]);

  const current = PRAYERS[slide];
  const currentTime = prayerParts(day?.[current.key]);
  const isNext = current.key === next;
  const nextSeconds = secondsUntilPrayer(now, location.timezone, day?.[next]);
  const date = new Intl.DateTimeFormat(ar ? "ar" : "en-CA", { timeZone: location.timezone, weekday: "short", month: "short", day: "numeric", year: "numeric" }).format(now);
  const clock = new Intl.DateTimeFormat("en-US", { timeZone: location.timezone, hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(now);
  const pairUrl = device ? `https://hassoun.app/masjid-tv/pair/?device=${encodeURIComponent(device.id)}&code=${device.code}` : "";
  const qr = pairUrl ? `https://api.qrserver.com/v1/create-qr-code/?size=360x360&margin=8&data=${encodeURIComponent(pairUrl)}` : "";

  return (
    <Modal visible animationType="fade" presentationStyle="fullScreen" statusBarTranslucent onRequestClose={onBack}>
      <LinearGradient colors={[CLASSIC.pageA, CLASSIC.pageB]} style={styles.root}>
        <StatusBar hidden />
        <View style={styles.meta}>
          <Text style={styles.metaText}>✦ {location.label}</Text>
          <View style={styles.metaDivider} />
          <Text style={styles.metaText}>▣ {date}</Text>
        </View>

        <Pressable onPress={() => setSetup(true)} style={styles.clockButton}>
          <Text style={[styles.clock, { fontSize: landscape ? 78 : 112 }]}>{clock}</Text>
        </Pressable>

        <LinearGradient colors={[CLASSIC.cardA, CLASSIC.cardB]} style={styles.hero}>
          <View style={styles.ornamentRow}><View style={styles.ornamentLine} /><Text style={styles.diamond}>◆</Text><View style={styles.ornamentLine} /></View>
          <View style={styles.prayerPill}><Text style={styles.pillText}>{isNext ? "NEXT PRAYER" : "PRAYER"}</Text></View>
          <Text style={[styles.arabic, { fontSize: landscape ? 58 : 78 }]}>{current.ar}</Text>
          <Text style={[styles.english, { fontSize: landscape ? 42 : 54 }]}>{current.en}</Text>
          <View style={styles.ruleRow}><View style={styles.rule} /><Text style={styles.ruleIcon}>۞</Text><View style={styles.rule} /></View>
          <View style={styles.timeRow}><Text style={[styles.prayerTime, { fontSize: landscape ? 62 : 82 }]}>{currentTime.main}</Text><Text style={styles.prayerPeriod}>{currentTime.period}</Text></View>
          {isNext ? <Text style={styles.countdown}>◉ {humanLeft(nextSeconds)}</Text> : null}
          <View style={styles.adhan}><Text style={styles.adhanText}>🔊 Adhan On</Text></View>
        </LinearGradient>

        <View style={styles.miniRow}>
          {PRAYERS.map((p, i) => {
            const active = p.key === next;
            const m = prayerParts(day?.[p.key]);
            return (
              <Pressable key={p.key} onPress={() => setSlide(i)} style={styles.miniWrap}>
                <LinearGradient colors={active ? [CLASSIC.nextA, CLASSIC.nextB] : [CLASSIC.mini, "#f3f0f4"]} style={[styles.mini, active && styles.miniActive]}>
                  <Text style={[styles.miniAr, active && styles.miniTextActive]}>{p.ar}</Text>
                  <Text style={[styles.miniEn, active && styles.miniTextActive]}>{p.en}</Text>
                  <Text style={[styles.miniIcon, active && styles.miniTextActive]}>{p.icon}</Text>
                  <Text style={[styles.miniTime, active && styles.miniTextActive]}>{m.main}</Text>
                </LinearGradient>
              </Pressable>
            );
          })}
        </View>

        {loading ? <View style={styles.loading}><ActivityIndicator size="large" color={CLASSIC.gold} /></View> : null}

        <Modal visible={setup} transparent animationType="fade" onRequestClose={() => setSetup(false)}>
          <View style={styles.backdrop}>
            <View style={styles.sheet}>
              <ScrollView contentContainerStyle={styles.sheetBody}>
                <View style={styles.sheetHead}>
                  <View style={{ flex: 1 }}><Text style={styles.sheetTitle}>{t("Native Tablet Display", "شاشة الجهاز اللوحي")}</Text><Text style={styles.sheetSub}>{t("Always-on native mode. Hassoun notifications and Adhan alarms continue running in the app.", "وضع أصلي دائم التشغيل مع استمرار التنبيهات والأذان داخل التطبيق.")}</Text></View>
                  <Pressable onPress={() => setSetup(false)} style={styles.close}><Text style={styles.closeText}>×</Text></Pressable>
                </View>
                <View style={styles.health}><Text style={styles.healthTitle}>✓ Native display active</Text><Text style={styles.healthText}>Screen stays awake • Android navigation hidden • prayer notifications/Adhan remain managed by Hassoun</Text></View>
                <Text style={styles.label}>{t("CONNECT THIS TABLET", "ربط هذا الجهاز")}</Text>
                <View style={styles.pair}>
                  {qr ? <Image source={{ uri: qr }} style={styles.qr} /> : null}
                  <View style={styles.pairCopy}><Text style={styles.codeLabel}>PAIRING CODE</Text><Text style={styles.code}>{device?.code || "------"}</Text><Text style={styles.pairHelp}>{t("Use Hassoun → Settings → Displays → Connect Display.", "استخدم حسّون ← الإعدادات ← الشاشات ← ربط شاشة.")}</Text><Text style={[styles.status, paired && styles.statusOn]}>{paired ? "● CONNECTED · LIVE" : "○ WAITING FOR APP"}</Text></View>
                </View>
                <Pressable onPress={onBack} style={styles.exit}><Text style={styles.exitText}>{t("Exit tablet display", "الخروج من وضع الشاشة")}</Text></Pressable>
              </ScrollView>
            </View>
          </View>
        </Modal>
      </LinearGradient>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 14, paddingTop: 10, paddingBottom: 8 },
  meta: { height: 34, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 12 },
  metaText: { color: CLASSIC.meta, fontSize: 16, fontWeight: "800" },
  metaDivider: { width: 1, height: 16, backgroundColor: "#8e958f" },
  clockButton: { height: 138, alignItems: "center", justifyContent: "center" },
  clock: { color: CLASSIC.clock, fontWeight: "900", letterSpacing: -3, textShadowColor: "rgba(80,20,30,.28)", textShadowOffset: { width: 0, height: 4 }, textShadowRadius: 1 },
  hero: { flex: 1, minHeight: 0, borderRadius: 30, borderWidth: 1.5, borderColor: "#d3b45f", alignItems: "center", justifyContent: "center", paddingHorizontal: 18, paddingVertical: 14, overflow: "hidden" },
  ornamentRow: { width: "56%", flexDirection: "row", alignItems: "center", marginBottom: 8 },
  ornamentLine: { flex: 1, height: 1, backgroundColor: CLASSIC.gold, opacity: .8 },
  diamond: { color: CLASSIC.gold, fontSize: 13, marginHorizontal: 8 },
  prayerPill: { borderWidth: 1.5, borderColor: CLASSIC.gold, borderRadius: 999, paddingHorizontal: 18, paddingVertical: 6, marginBottom: 18 },
  pillText: { color: CLASSIC.gold, fontSize: 14, fontWeight: "900", letterSpacing: 1.2 },
  arabic: { color: CLASSIC.gold, fontWeight: "900", lineHeight: 88, textAlign: "center" },
  english: { color: "#f2eee8", fontWeight: "900", marginTop: 8 },
  ruleRow: { width: "68%", flexDirection: "row", alignItems: "center", marginVertical: 18 },
  rule: { flex: 1, height: 1, backgroundColor: CLASSIC.gold, opacity: .75 },
  ruleIcon: { color: CLASSIC.gold, fontSize: 18, marginHorizontal: 10 },
  timeRow: { flexDirection: "row", alignItems: "baseline", justifyContent: "center" },
  prayerTime: { color: CLASSIC.white, fontWeight: "900", letterSpacing: -2 },
  prayerPeriod: { color: CLASSIC.white, fontSize: 26, fontWeight: "800", marginLeft: 8 },
  countdown: { color: CLASSIC.gold, fontSize: 18, fontWeight: "900", marginTop: 12 },
  adhan: { marginTop: 14, borderWidth: 1.2, borderColor: CLASSIC.gold, borderRadius: 999, paddingHorizontal: 15, paddingVertical: 5 },
  adhanText: { color: CLASSIC.white, fontWeight: "900", fontSize: 14 },
  miniRow: { height: 104, flexDirection: "row", gap: 5, marginTop: 7 },
  miniWrap: { flex: 1 },
  mini: { flex: 1, borderWidth: 1.1, borderColor: "#a39aa6", borderRadius: 11, alignItems: "center", justifyContent: "center", paddingVertical: 4 },
  miniActive: { borderColor: CLASSIC.gold },
  miniAr: { color: CLASSIC.miniText, fontSize: 15, fontWeight: "700" },
  miniEn: { color: CLASSIC.miniText, fontSize: 13, fontWeight: "800", marginTop: 1 },
  miniIcon: { color: CLASSIC.miniText, fontSize: 13, marginTop: 1 },
  miniTime: { color: CLASSIC.miniText, fontSize: 17, fontWeight: "900", marginTop: 1 },
  miniTextActive: { color: "#ffffff" },
  loading: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(250,248,243,.62)", alignItems: "center", justifyContent: "center" },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,.66)", alignItems: "center", justifyContent: "center", padding: 18 },
  sheet: { width: "94%", maxWidth: 760, maxHeight: "92%", backgroundColor: "#073f35", borderRadius: 24, borderWidth: 1, borderColor: "#6f9e91", overflow: "hidden" },
  sheetBody: { padding: 20 },
  sheetHead: { flexDirection: "row", gap: 14, alignItems: "flex-start" },
  sheetTitle: { color: "#ffffff", fontSize: 24, fontWeight: "900" },
  sheetSub: { color: "#bed1cc", fontSize: 13, marginTop: 5, lineHeight: 18 },
  close: { width: 42, height: 42, borderRadius: 21, backgroundColor: "#20584d", alignItems: "center", justifyContent: "center" },
  closeText: { color: "#ffffff", fontSize: 27, lineHeight: 30 },
  health: { backgroundColor: "#0d5548", borderRadius: 14, padding: 13, marginTop: 16, borderWidth: 1, borderColor: "#4f8175" },
  healthTitle: { color: "#e9c96d", fontSize: 15, fontWeight: "900" },
  healthText: { color: "#d2e1dd", fontSize: 12, lineHeight: 17, marginTop: 4 },
  label: { color: "#f0c86a", fontSize: 11, letterSpacing: 1.5, fontWeight: "900", marginTop: 18, marginBottom: 8 },
  pair: { flexDirection: "row", gap: 15, borderWidth: 1, borderColor: "#58877b", borderRadius: 16, padding: 13, backgroundColor: "#093329" },
  qr: { width: 126, height: 126, borderRadius: 9 },
  pairCopy: { flex: 1, justifyContent: "center" },
  codeLabel: { color: "#a9c4bc", fontSize: 10, fontWeight: "800", letterSpacing: 1.2 },
  code: { color: "#f5cf70", fontSize: 34, fontWeight: "900", letterSpacing: 4, marginVertical: 4 },
  pairHelp: { color: "#c8d9d4", fontSize: 12, lineHeight: 17 },
  status: { color: "#c5d6d1", marginTop: 8, fontSize: 11, fontWeight: "800" },
  statusOn: { color: "#78e1a7" },
  exit: { marginTop: 18, borderRadius: 12, borderWidth: 1, borderColor: "#6e948b", padding: 13, alignItems: "center" },
  exitText: { color: "#ffffff", fontWeight: "900" },
});
'''

page = Path("mobile/src/MasjidDisplayPage.tsx")
page.write_text(PAGE, encoding="utf-8")

cfg = Path("mobile/app.config.ts")
text = cfg.read_text(encoding="utf-8")
text = text.replace('version: "1.0.29"', 'version: "1.0.30"')
text = text.replace('versionCode: 73', 'versionCode: 74')
cfg.write_text(text, encoding="utf-8")

print("HASSOUN_NATIVE_TABLET_GRAND_V1 applied; v1.0.30 / versionCode 74")
