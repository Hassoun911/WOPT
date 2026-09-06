import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import * as ScreenOrientation from "expo-screen-orientation";
import { loadInitialPrayerTimes, loadPrayerTimes, type PrayerLocation } from "./prayerData";
import { PRAYER_KEYS, type PrayerDay, type PrayerTimes } from "./types";

type Props = { locale: "en" | "ar"; onBack: () => void };
type PrayerKey = keyof PrayerDay;
type PrayerMeta = { key: PrayerKey; en: string; ar: string };

type DisplaySettings = {
  nextPrayerCardColor: string;
  nextPrayerMiniCardColor: string;
  highlightNextPrayerCard: boolean;
  highlightNextPrayerMiniCard: boolean;
  sliderSeconds: number;
};

type DisplayDevice = { id: string; code: string; secret: string; name: string };

const API = "https://wopt-prayer-push.wopt-windsor.workers.dev";
const SETTINGS_KEY = "hassoun:native-wall-display:v2";
const DEVICE_KEY = "hassoun:native-wall-display-device:v1";
const DEFAULT_SETTINGS: DisplaySettings = {
  nextPrayerCardColor: "#0B6B55",
  nextPrayerMiniCardColor: "#0B6B55",
  highlightNextPrayerCard: true,
  highlightNextPrayerMiniCard: true,
  sliderSeconds: 8,
};
const COLORS = ["#0B6B55", "#08795E", "#0A5B4A", "#146B63", "#255F48", "#4A6C46"];
const PRAYERS: PrayerMeta[] = [
  { key: "fajr", en: "Fajr", ar: "الفجر" },
  { key: "dhuhr", en: "Dhuhr", ar: "الظهر" },
  { key: "asr", en: "Asr", ar: "العصر" },
  { key: "maghrib", en: "Maghrib", ar: "المغرب" },
  { key: "isha", en: "Isha", ar: "العشاء" },
];

const randomPart = () => Math.random().toString(36).slice(2, 10);
const makeDevice = (): DisplayDevice => ({
  id: `${Date.now().toString(36)}${randomPart()}${randomPart()}`,
  code: String(Math.floor(100000 + Math.random() * 900000)),
  secret: `${randomPart()}${randomPart()}${randomPart()}${randomPart()}`,
  name: "Hassoun Wall Display",
});

function dateKey(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value || "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}
function minutesFor(value?: string) {
  if (!value) return null;
  const m = value.trim().match(/^(\d{1,2}):(\d{2})(?:\s*([AP]M))?$/i);
  if (!m) return null;
  let h = Number(m[1]); const min = Number(m[2]); const ap = (m[3] || "").toUpperCase();
  if (ap === "PM" && h < 12) h += 12; if (ap === "AM" && h === 12) h = 0;
  return h * 60 + min;
}
function nowMinutes(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: timezone, hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(date);
  return Number(parts.find((p) => p.type === "hour")?.value || 0) * 60 + Number(parts.find((p) => p.type === "minute")?.value || 0);
}
function pretty(value?: string) {
  if (!value) return "--:--";
  const m = value.match(/^(\d{1,2}):(\d{2})/); if (!m) return value;
  const raw = Number(m[1]); const suffix = raw >= 12 ? "PM" : "AM"; const hour = raw % 12 || 12;
  return `${hour}:${m[2]} ${suffix}`;
}
function clockParts(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: timezone, hour: "numeric", minute: "2-digit", second: "2-digit", hour12: true }).formatToParts(date);
  return {
    time: `${parts.find((p) => p.type === "hour")?.value || ""}:${parts.find((p) => p.type === "minute")?.value || "00"}`,
    second: parts.find((p) => p.type === "second")?.value || "00",
    period: parts.find((p) => p.type === "dayPeriod")?.value || "",
  };
}

export default function MasjidDisplayPage({ locale, onBack }: Props) {
  const { width, height } = useWindowDimensions();
  const landscape = width > height;
  const ar = locale === "ar";
  const t = (en: string, arabic: string) => ar ? arabic : en;
  const [now, setNow] = useState(new Date());
  const [times, setTimes] = useState<PrayerTimes>({});
  const [location, setLocation] = useState<PrayerLocation>({ latitude: 42.3149, longitude: -83.0364, timezone: "America/Toronto", label: "Current location", source: "saved" });
  const [loading, setLoading] = useState(true);
  const [setupOpen, setSetupOpen] = useState(false);
  const [settings, setSettings] = useState<DisplaySettings>(DEFAULT_SETTINGS);
  const [device, setDevice] = useState<DisplayDevice | null>(null);
  const [slide, setSlide] = useState(0);

  const saveSettings = useCallback((patch: Partial<DisplaySettings>) => {
    setSettings((current) => {
      const next = { ...current, ...patch };
      void AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    try { const loaded = await loadPrayerTimes(); setTimes(loaded.prayerTimes); setLocation(loaded.location); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const [savedSettings, savedDevice, loaded] = await Promise.all([
        AsyncStorage.getItem(SETTINGS_KEY), AsyncStorage.getItem(DEVICE_KEY), loadInitialPrayerTimes(),
      ]);
      if (!alive) return;
      if (savedSettings) { try { setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(savedSettings) }); } catch {} }
      let nextDevice: DisplayDevice;
      try { nextDevice = savedDevice ? JSON.parse(savedDevice) : makeDevice(); } catch { nextDevice = makeDevice(); }
      setDevice(nextDevice);
      await AsyncStorage.setItem(DEVICE_KEY, JSON.stringify(nextDevice));
      setTimes(loaded.prayerTimes); setLocation(loaded.location); setLoading(false); void refresh();
    })();
    const clock = setInterval(() => setNow(new Date()), 1000);
    return () => { alive = false; clearInterval(clock); };
  }, [refresh]);

  useEffect(() => {
    const id = setInterval(() => setSlide((n) => (n + 1) % PRAYERS.length), Math.max(4, settings.sliderSeconds) * 1000);
    return () => clearInterval(id);
  }, [settings.sliderSeconds]);

  useEffect(() => { void ScreenOrientation.unlockAsync().catch(() => undefined); }, []);

  useEffect(() => {
    if (!device) return;
    let stopped = false; let timer: ReturnType<typeof setTimeout> | null = null;
    const register = async () => {
      try { await fetch(`${API}/masjid-displays/register`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ deviceId: device.id, pairCode: device.code, deviceSecret: device.secret, name: device.name, settings }) }); } catch {}
    };
    const poll = async () => {
      if (stopped) return;
      try {
        const response = await fetch(`${API}/masjid-displays/device/${encodeURIComponent(device.id)}?secret=${encodeURIComponent(device.secret)}`);
        if (response.status === 404) await register();
        else if (response.ok) {
          const data = await response.json() as { pairCode?: string; settings?: Record<string, unknown> };
          if (data.pairCode && /^\d{6}$/.test(data.pairCode) && data.pairCode !== device.code) {
            const nextDevice = { ...device, code: data.pairCode }; setDevice(nextDevice); await AsyncStorage.setItem(DEVICE_KEY, JSON.stringify(nextDevice));
          }
          if (data.settings && typeof data.settings === "object") {
            const remote = data.settings as Partial<DisplaySettings>;
            const next = { ...settings, ...remote };
            setSettings(next); await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
          }
        }
      } catch {}
      timer = setTimeout(poll, 3000);
    };
    void register().then(poll);
    return () => { stopped = true; if (timer) clearTimeout(timer); };
  }, [device?.id]);

  const key = dateKey(now, location.timezone); const day = times[key]; const currentMinutes = nowMinutes(now, location.timezone);
  const nextKey = useMemo(() => {
    if (!day) return null;
    for (const prayer of PRAYER_KEYS) { const m = minutesFor(day[prayer]); if (m !== null && m > currentMinutes) return prayer; }
    return "fajr" as PrayerKey;
  }, [day, currentMinutes]);
  const currentPrayer = PRAYERS[slide]; const isNextSlide = currentPrayer.key === nextKey;
  const clock = clockParts(now, location.timezone);
  const date = new Intl.DateTimeFormat(ar ? "ar" : "en-CA", { timeZone: location.timezone, weekday: "long", month: "long", day: "numeric", year: "numeric" }).format(now);
  let hijri = ""; try { hijri = new Intl.DateTimeFormat(ar ? "ar-SA-u-ca-islamic" : "en-US-u-ca-islamic", { timeZone: location.timezone, month: "long", day: "numeric", year: "numeric" }).format(now); } catch {}
  const pairUrl = device ? `https://hassoun.app/masjid-tv/pair/?device=${encodeURIComponent(device.id)}&code=${device.code}` : "";
  const qrUrl = pairUrl ? `https://api.qrserver.com/v1/create-qr-code/?size=360x360&margin=8&data=${encodeURIComponent(pairUrl)}` : "";

  return <Modal visible animationType="fade" presentationStyle="fullScreen" statusBarTranslucent onRequestClose={onBack}>
    <View style={styles.root}>
      <StatusBar hidden />
      <View style={styles.top}>
        <Pressable onPress={() => setSetupOpen(true)} style={styles.clockButton} accessibilityLabel="Open wall display setup">
          <View style={styles.clockLine}><Text style={styles.clock}>{clock.time}</Text><View><Text style={styles.period}>{clock.period}</Text><Text style={styles.seconds}>{clock.second}</Text></View></View>
          <Text style={styles.tapHint}>{t("Tap clock for setup", "اضغط على الساعة للإعداد")}</Text>
        </Pressable>
        <View style={styles.locationBox}><Text style={styles.location}>📍 {location.label}</Text><Text style={styles.date}>{date}</Text>{hijri ? <Text style={styles.hijri}>☾ {hijri}</Text> : null}</View>
      </View>

      <View style={styles.heroWrap}>
        <View style={[styles.heroCard, isNextSlide && settings.highlightNextPrayerCard && { backgroundColor: settings.nextPrayerCardColor, borderColor: "#E8C864" }]}>
          {isNextSlide ? <Text style={styles.nextBadge}>{t("NEXT PRAYER", "الصلاة القادمة")}</Text> : <Text style={styles.slideBadge}>{t("PRAYER", "الصلاة")}</Text>}
          <Text style={styles.heroArabic}>{currentPrayer.ar}</Text>
          <Text style={styles.heroEnglish}>{currentPrayer.en}</Text>
          <Text style={styles.heroTime}>{pretty(day?.[currentPrayer.key])}</Text>
          <View style={styles.dots}>{PRAYERS.map((p, i) => <View key={p.key} style={[styles.dot, i === slide && styles.dotActive]} />)}</View>
        </View>
      </View>

      <View style={[styles.miniRow, landscape && styles.miniRowLandscape]}>
        {PRAYERS.map((prayer, index) => {
          const active = prayer.key === nextKey;
          return <Pressable key={prayer.key} onPress={() => setSlide(index)} style={[styles.miniCard, active && settings.highlightNextPrayerMiniCard && { backgroundColor: settings.nextPrayerMiniCardColor, borderColor: "#E8C864" }]}>
            <Text style={styles.miniArabic}>{prayer.ar}</Text><Text style={styles.miniEnglish}>{prayer.en}</Text><Text style={styles.miniTime}>{pretty(day?.[prayer.key])}</Text>{active ? <Text style={styles.miniNext}>{t("NEXT", "القادمة")}</Text> : null}
          </Pressable>;
        })}
      </View>
      <Text style={styles.footer}>{t("Prayer • Qur’an • Knowledge", "الصلاة • القرآن • المعرفة")}</Text>
      {loading ? <View style={styles.loading}><ActivityIndicator size="large" color="#E7C768"/><Text style={styles.loadingText}>{t("Updating prayer times…", "جارٍ تحديث مواقيت الصلاة…")}</Text></View> : null}

      <Modal visible={setupOpen} transparent animationType="fade" onRequestClose={() => setSetupOpen(false)}>
        <View style={styles.sheetBackdrop}><View style={styles.sheet}><ScrollView contentContainerStyle={styles.sheetContent}>
          <View style={styles.sheetHead}><View><Text style={styles.sheetTitle}>{t("Wall Display Setup", "إعداد شاشة الحائط")}</Text><Text style={styles.sheetSub}>{t("Pair, customize, or switch modes", "الربط والتخصيص وتغيير الوضع")}</Text></View><Pressable onPress={() => setSetupOpen(false)} style={styles.close}><Text style={styles.closeText}>×</Text></Pressable></View>
          <Text style={styles.sectionLabel}>{t("CONNECT THIS DISPLAY", "ربط هذه الشاشة")}</Text>
          <View style={styles.pairCard}>{qrUrl ? <Image source={{ uri: qrUrl }} style={styles.qr}/> : null}<View style={styles.pairCopy}><Text style={styles.codeLabel}>{t("6-DIGIT PAIRING CODE", "رمز الربط من 6 أرقام")}</Text><Text style={styles.code}>{device?.code || "------"}</Text><Text style={styles.pairHelp}>{t("Scan this QR or enter the code from Hassoun → Displays → Connect Display.", "امسح الرمز أو أدخل الرقم من حسّون ← الشاشات ← ربط شاشة.")}</Text></View></View>

          <Text style={styles.sectionLabel}>{t("NEXT PRAYER CARD", "بطاقة الصلاة القادمة")}</Text>
          <View style={styles.settingRow}><Text style={styles.settingText}>{t("Highlight next large prayer card", "تمييز بطاقة الصلاة القادمة الكبيرة")}</Text><Switch value={settings.highlightNextPrayerCard} onValueChange={(value) => saveSettings({ highlightNextPrayerCard: value })}/></View>
          <View style={styles.settingRow}><Text style={styles.settingText}>{t("Highlight matching mini card", "تمييز البطاقة المصغرة المطابقة")}</Text><Switch value={settings.highlightNextPrayerMiniCard} onValueChange={(value) => saveSettings({ highlightNextPrayerMiniCard: value })}/></View>
          <Text style={styles.colorTitle}>{t("Next-prayer green", "لون الصلاة القادمة")}</Text><View style={styles.colors}>{COLORS.map((color) => <Pressable key={color} onPress={() => saveSettings({ nextPrayerCardColor: color, nextPrayerMiniCardColor: color })} style={[styles.swatch, { backgroundColor: color }, settings.nextPrayerCardColor === color && styles.swatchActive]} />)}</View>

          <Text style={styles.sectionLabel}>{t("DISPLAY MODE", "وضع الشاشة")}</Text>
          <Pressable style={styles.menuButton} onPress={() => void refresh()}><Text style={styles.menuButtonText}>↻ {t("Refresh prayer times", "تحديث مواقيت الصلاة")}</Text></Pressable>
          <Pressable style={styles.menuButton} onPress={() => void Linking.openURL("https://hassoun.app/?mode=web")}><Text style={styles.menuButtonText}>🌐 {t("Website Mode", "وضع الموقع")}</Text></Pressable>
          <Pressable style={styles.menuButton} onPress={onBack}><Text style={styles.menuButtonText}>← {t("Exit Wall Display", "الخروج من شاشة الحائط")}</Text></Pressable>
          <Pressable style={styles.resetButton} onPress={() => saveSettings(DEFAULT_SETTINGS)}><Text style={styles.resetText}>{t("Reset display customization", "إعادة إعدادات الشاشة")}</Text></Pressable>
        </ScrollView></View></View>
      </Modal>
    </View>
  </Modal>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#03221C", paddingHorizontal: 18, paddingTop: 24, paddingBottom: 18 },
  top: { alignItems: "center" }, clockButton: { alignItems: "center", paddingHorizontal: 18, paddingVertical: 4 }, clockLine: { flexDirection: "row", alignItems: "center", gap: 8 },
  clock: { color: "#FFFFFF", fontSize: 78, lineHeight: 82, fontWeight: "900", letterSpacing: -3 }, period: { color: "#E6C66A", fontSize: 17, fontWeight: "900" }, seconds: { color: "#88A99E", fontSize: 12, fontWeight: "800" }, tapHint: { color: "#73988D", fontSize: 10, marginTop: -2 },
  locationBox: { alignItems: "center", marginTop: 4 }, location: { color: "#DCE9E4", fontSize: 15, fontWeight: "800" }, date: { color: "#9DB9B0", fontSize: 12, marginTop: 3 }, hijri: { color: "#E0C268", fontSize: 12, marginTop: 2 },
  heroWrap: { flex: 1, justifyContent: "center", paddingVertical: 14 }, heroCard: { minHeight: 390, flex: 1, maxHeight: 520, borderRadius: 28, borderWidth: 1.5, borderColor: "rgba(231,199,104,.65)", backgroundColor: "#0B493D", alignItems: "center", justifyContent: "center", padding: 26, shadowColor: "#000", shadowOpacity: .32, shadowRadius: 18, elevation: 9 },
  nextBadge: { position: "absolute", top: 18, color: "#F7D978", fontSize: 12, letterSpacing: 2, fontWeight: "900" }, slideBadge: { position: "absolute", top: 18, color: "#7DA99C", fontSize: 11, letterSpacing: 2, fontWeight: "900" }, heroArabic: { color: "#FFFFFF", fontSize: 86, lineHeight: 100, fontWeight: "900", textAlign: "center" }, heroEnglish: { color: "#FFFFFF", fontSize: 40, fontWeight: "900", marginTop: 8 }, heroTime: { color: "#F4D26F", fontSize: 58, fontWeight: "900", marginTop: 20 },
  dots: { flexDirection: "row", gap: 7, position: "absolute", bottom: 18 }, dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "rgba(255,255,255,.25)" }, dotActive: { width: 22, backgroundColor: "#E8C864" },
  miniRow: { flexDirection: "row", gap: 6, marginTop: 3 }, miniRowLandscape: { gap: 10 }, miniCard: { flex: 1, minHeight: 98, borderRadius: 14, borderWidth: 1, borderColor: "rgba(197,166,82,.42)", backgroundColor: "#0A4036", alignItems: "center", justifyContent: "center", paddingVertical: 7, paddingHorizontal: 2 }, miniArabic: { color: "#F1D47C", fontSize: 16, fontWeight: "900" }, miniEnglish: { color: "#FFFFFF", fontSize: 11, fontWeight: "800", marginTop: 1 }, miniTime: { color: "#FFFFFF", fontSize: 12, fontWeight: "900", marginTop: 5 }, miniNext: { color: "#F5D36D", fontSize: 7, fontWeight: "900", letterSpacing: 1, marginTop: 3 }, footer: { color: "#73988D", textAlign: "center", marginTop: 10, fontSize: 11, fontWeight: "700" },
  loading: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(3,34,28,.78)", alignItems: "center", justifyContent: "center", zIndex: 20 }, loadingText: { color: "#FFFFFF", marginTop: 12, fontWeight: "800" },
  sheetBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,.66)", justifyContent: "center", padding: 16 }, sheet: { maxHeight: "92%", borderRadius: 24, overflow: "hidden", backgroundColor: "#082F28", borderWidth: 1, borderColor: "#4E786C" }, sheetContent: { padding: 20, paddingBottom: 28 }, sheetHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }, sheetTitle: { color: "#FFFFFF", fontSize: 24, fontWeight: "900" }, sheetSub: { color: "#9EBBB2", fontSize: 12, marginTop: 3 }, close: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,255,255,.08)", alignItems: "center", justifyContent: "center" }, closeText: { color: "#FFFFFF", fontSize: 26 },
  sectionLabel: { color: "#E3C363", fontSize: 11, fontWeight: "900", letterSpacing: 1.7, marginTop: 12, marginBottom: 9 }, pairCard: { flexDirection: "row", gap: 16, borderRadius: 18, backgroundColor: "#0B4036", padding: 14, alignItems: "center" }, qr: { width: 132, height: 132, borderRadius: 10, backgroundColor: "#FFFFFF" }, pairCopy: { flex: 1 }, codeLabel: { color: "#8FB0A6", fontSize: 9, fontWeight: "900", letterSpacing: 1.3 }, code: { color: "#F1CD69", fontSize: 38, fontWeight: "900", letterSpacing: 7, marginVertical: 4 }, pairHelp: { color: "#D4E1DD", fontSize: 11, lineHeight: 16 },
  settingRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#315B50" }, settingText: { flex: 1, color: "#FFFFFF", fontSize: 14, fontWeight: "800" }, colorTitle: { color: "#D6E2DE", fontSize: 12, fontWeight: "800", marginTop: 12, marginBottom: 8 }, colors: { flexDirection: "row", flexWrap: "wrap", gap: 10 }, swatch: { width: 46, height: 46, borderRadius: 13, borderWidth: 2, borderColor: "rgba(255,255,255,.24)" }, swatchActive: { borderColor: "#F4D36D", borderWidth: 4 },
  menuButton: { borderRadius: 14, borderWidth: 1, borderColor: "#426D61", backgroundColor: "#0A4238", padding: 14, marginBottom: 9 }, menuButtonText: { color: "#FFFFFF", fontWeight: "900", fontSize: 14 }, resetButton: { alignItems: "center", padding: 14, marginTop: 5 }, resetText: { color: "#9DB9B0", fontWeight: "800", fontSize: 12 },
});
