from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
MOBILE = ROOT / "mobile"


def patch_prayer_home() -> None:
    path = MOBILE / "App.tsx"
    text = path.read_text()
    if 'import HomePrayerPanel from "./src/HomePrayerPanel";' not in text:
        text = text.replace(
            'import SettingsHub from "./src/SettingsHub";\n',
            'import SettingsHub from "./src/SettingsHub";\nimport HomePrayerPanel from "./src/HomePrayerPanel";\nimport QiblaDirectionScreen from "./src/QiblaDirectionScreen";\n',
            1,
        )
    text = text.replace(
        'type AppTab = "home" | "quran" | "quiz" | "alerts" | "events" | "more";',
        'type AppTab = "home" | "quran" | "quiz" | "alerts" | "events" | "qibla" | "more";',
        1,
    )
    home_pattern = re.compile(
        r'\n\s*\{next \? <View style=\{styles\.nextCard\}>.*?\n\s*<Pressable onPress=\{\(\) => setActiveTab\("quiz"\)\}',
        re.S,
    )
    replacement = '''\n\n      <HomePrayerPanel
        locale={locale}
        today={today}
        next={next}
        preferences={phoneAlertPreferences}
        onTogglePrayer={(prayer) => void togglePrayerAudio(prayer)}
        onOpenQibla={() => setActiveTab("qibla")}
      />

      <Pressable onPress={() => setActiveTab("quiz")}'''
    text, count = home_pattern.subn(replacement, text, count=1)
    if count != 1 and '<HomePrayerPanel' not in text:
        raise SystemExit('Refusing build: could not restore known-good HomePrayerPanel')
    body_pattern = re.compile(
        r': activeTab === "events"\s*\n\s*\? <IslamicEventsPage locale=\{locale\} todayKey=\{todayKey\} onBack=\{\(\) => setActiveTab\("home"\)\} />\s*\n\s*: activeTab === "more"',
        re.S,
    )
    body_replacement = ''': activeTab === "events"
          ? <IslamicEventsPage locale={locale} todayKey={todayKey} onBack={() => setActiveTab("home")} />
          : activeTab === "qibla"
            ? <QiblaDirectionScreen locale={locale} onBack={() => setActiveTab("home")} />
            : activeTab === "more"'''
    text, count2 = body_pattern.subn(body_replacement, text, count=1)
    if count2 != 1 and 'activeTab === "qibla"' not in text:
        raise SystemExit('Refusing build: could not restore known-good Qibla route')
    path.write_text(text)


def patch_push_registration() -> None:
    path = MOBILE / "AppWithEmail.tsx"
    text = path.read_text()
    text = text.replace('  Modal,\n  Pressable,', '  AppState,\n  Modal,\n  Pressable,', 1)
    old = '''  useEffect(() => {
    void loadHassounRuntimeConfig().then(setRuntime).catch(() => undefined);
    void (async () => {
      await configureNotificationChannels();
      const saved = await AsyncStorage.getItem(STORAGE_KEYS.locale);
      const currentLocale = saved === "ar" ? "ar" : "en";
      setLocale(currentLocale);

      const permission = await Notifications.getPermissionsAsync();
      if (permission.granted) {
        await registerDeviceForServerPush(currentLocale).catch(() => undefined);
      }
    })().catch(() => undefined);
  }, []);'''
    new = '''  useEffect(() => {
    let currentLocale: "en" | "ar" = "en";
    const syncPush = async (allowPrompt: boolean) => {
      const saved = await AsyncStorage.getItem(STORAGE_KEYS.locale);
      currentLocale = saved === "ar" ? "ar" : "en";
      setLocale(currentLocale);
      let permission = await Notifications.getPermissionsAsync();
      if (!permission.granted && allowPrompt && permission.canAskAgain) permission = await Notifications.requestPermissionsAsync();
      if (permission.granted) await registerDeviceForServerPush(currentLocale);
    };
    void loadHassounRuntimeConfig().then(setRuntime).catch(() => undefined);
    void configureNotificationChannels().then(() => syncPush(true)).catch(() => undefined);
    const sub = AppState.addEventListener("change", state => { if (state === "active") void syncPush(false).catch(() => undefined); });
    const timer = setInterval(() => void syncPush(false).catch(() => undefined), 6 * 60 * 60 * 1000);
    return () => { sub.remove(); clearInterval(timer); };
  }, []);'''
    if old not in text:
        raise SystemExit('Refusing build: golden AppWithEmail push block did not match')
    path.write_text(text.replace(old, new, 1))


def write_ticker() -> None:
    path = MOBILE / "src" / "ScrollingTicker.tsx"
    path.write_text(r'''import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, AppState, Easing, StyleSheet, Text, View } from "react-native";
import { STORAGE_KEYS } from "./config";

const API_BASE = String(Constants.expoConfig?.extra?.pushApiUrl || "https://wopt-prayer-push.wopt-windsor.workers.dev").replace(/\/$/, "");
type TickerSetting = { enabled?: boolean; textEn?: string; textAr?: string; startsAt?: string | null; expiresAt?: string | null; speed?: "slow" | "normal" | "fast" };

function active(ticker: TickerSetting | null) {
  if (!ticker?.enabled) return false;
  const now = Date.now();
  if (ticker.startsAt) { const value = Date.parse(ticker.startsAt); if (Number.isFinite(value) && now < value) return false; }
  if (ticker.expiresAt) { const value = Date.parse(ticker.expiresAt); if (Number.isFinite(value) && now >= value) return false; }
  return true;
}

export default function ScrollingTicker() {
  const [ticker, setTicker] = useState<TickerSetting | null>(null);
  const [locale, setLocale] = useState<"en" | "ar">("en");
  const [containerWidth, setContainerWidth] = useState(0);
  const [textWidth, setTextWidth] = useState(0);
  const x = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const saved = await AsyncStorage.getItem(STORAGE_KEYS.locale);
        if (!cancelled) setLocale(saved === "ar" ? "ar" : "en");
        const response = await fetch(`${API_BASE}/app/runtime?ts=${Date.now()}`, { headers: { Accept: "application/json", "Cache-Control": "no-cache" } });
        if (!response.ok) return;
        const payload = await response.json() as { settings?: { scrolling_ticker?: TickerSetting } };
        if (!cancelled) setTicker(payload.settings?.scrolling_ticker ?? null);
      } catch {}
    };
    void load();
    const timer = setInterval(() => void load(), 20_000);
    const state = AppState.addEventListener("change", value => { if (value === "active") void load(); });
    return () => { cancelled = true; clearInterval(timer); state.remove(); };
  }, []);

  const message = useMemo(() => {
    if (!active(ticker)) return "";
    return String(locale === "ar" ? (ticker?.textAr || ticker?.textEn || "") : (ticker?.textEn || ticker?.textAr || "")).trim();
  }, [locale, ticker]);
  const duration = useMemo(() => ticker?.speed === "slow" ? 30000 : ticker?.speed === "fast" ? 14000 : 21000, [ticker?.speed]);

  useEffect(() => {
    x.stopAnimation();
    if (!message || !containerWidth || !textWidth) return;
    x.setValue(containerWidth);
    const loop = Animated.loop(Animated.timing(x, { toValue: -textWidth, duration, easing: Easing.linear, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [message, duration, containerWidth, textWidth, x]);

  if (!message) return null;
  return <View style={styles.wrap} onLayout={(event) => setContainerWidth(event.nativeEvent.layout.width)}>
    <View style={styles.badge}><Text style={styles.badgeText}>📢</Text></View>
    <View style={styles.track}>
      <Animated.View style={{ transform: [{ translateX: x }] }}>
        <Text onLayout={(event) => setTextWidth(event.nativeEvent.layout.width)} numberOfLines={1} style={styles.text}>{message}</Text>
      </Animated.View>
    </View>
  </View>;
}

const styles = StyleSheet.create({
  wrap: { minHeight: 40, overflow: "hidden", backgroundColor: "#0b5b47", borderBottomWidth: 1, borderBottomColor: "#d7bd72", flexDirection: "row", alignItems: "center" },
  badge: { width: 42, height: 40, alignItems: "center", justifyContent: "center", backgroundColor: "#0b5b47", zIndex: 2 },
  badgeText: { fontSize: 16 },
  track: { flex: 1, height: 40, overflow: "hidden", justifyContent: "center" },
  text: { color: "#fff4c7", fontSize: 15, lineHeight: 40, fontWeight: "800", paddingHorizontal: 18, includeFontPadding: false }
});
''')


def set_version() -> None:
    path = MOBILE / "app.config.ts"
    text = path.read_text()
    text = re.sub(r'version:\s*"[^"]+"', 'version: "1.0.12"', text, count=1)
    text = re.sub(r'versionCode:\s*\d+', 'versionCode: 53', text, count=1)
    android_section = text.split('android: {', 1)[1].split('}', 1)[0] if 'android: {' in text else ''
    if 'icon: "./assets/icon.png"' not in android_section:
        text = text.replace('android: {\n    package:', 'android: {\n    icon: "./assets/icon.png",\n    package:', 1)
    path.write_text(text)


if __name__ == "__main__":
    patch_prayer_home()
    patch_push_registration()
    write_ticker()
    set_version()
    print('Applied v1.0.12 messaging overlay to golden lineage only.')
