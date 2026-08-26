import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, AppState, Easing, StyleSheet, Text, useWindowDimensions, View } from "react-native";

const API = "https://wopt-prayer-push.wopt-windsor.workers.dev";

type TickerSetting = {
  enabled?: boolean;
  textEn?: string;
  textAr?: string;
  startsAt?: string | null;
  expiresAt?: string | null;
};

type RuntimePayload = {
  settings?: {
    scrolling_ticker?: TickerSetting;
  };
};

function active(setting: TickerSetting | undefined) {
  if (!setting?.enabled) return false;
  const now = Date.now();
  if (setting.startsAt) {
    const start = Date.parse(setting.startsAt);
    if (Number.isFinite(start) && now < start) return false;
  }
  if (setting.expiresAt) {
    const end = Date.parse(setting.expiresAt);
    if (Number.isFinite(end) && now >= end) return false;
  }
  return true;
}

export default function SystemMessageTicker({ locale }: { locale: "en" | "ar" }) {
  const { width } = useWindowDimensions();
  const [setting, setSetting] = useState<TickerSetting | undefined>();
  const x = useRef(new Animated.Value(width)).current;

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const response = await fetch(`${API}/app/runtime`, { headers: { "Cache-Control": "no-cache" } });
        if (!response.ok) return;
        const payload = await response.json() as RuntimePayload;
        if (mounted) setSetting(payload.settings?.scrolling_ticker);
      } catch {}
    };
    void load();
    const timer = setInterval(() => void load(), 20_000);
    const subscription = AppState.addEventListener("change", state => {
      if (state === "active") void load();
    });
    return () => {
      mounted = false;
      clearInterval(timer);
      subscription.remove();
    };
  }, []);

  const text = useMemo(() => {
    if (!active(setting)) return "";
    const preferred = locale === "ar" ? setting?.textAr : setting?.textEn;
    return String(preferred || setting?.textEn || setting?.textAr || "").trim();
  }, [locale, setting]);

  useEffect(() => {
    x.stopAnimation();
    if (!text) return;
    const estimatedTextWidth = Math.max(220, Math.min(1800, text.length * 10 + 100));
    x.setValue(width);
    const animation = Animated.loop(
      Animated.timing(x, {
        toValue: -estimatedTextWidth,
        duration: Math.max(8_000, Math.min(32_000, text.length * 120 + 8_000)),
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    animation.start();
    return () => animation.stop();
  }, [text, width, x]);

  if (!text) return null;

  return (
    <View style={styles.wrap} accessibilityRole="text" accessibilityLabel={text}>
      <View style={styles.badge}><Text style={styles.badgeText}>📢</Text></View>
      <View style={styles.track}>
        <Animated.Text numberOfLines={1} style={[styles.text, { transform: [{ translateX: x }] }]}>
          {text}
        </Animated.Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    minHeight: 38,
    backgroundColor: "#0b5b47",
    borderBottomWidth: 1,
    borderBottomColor: "#d7bd72",
    flexDirection: "row",
    alignItems: "center",
    overflow: "hidden",
  },
  badge: {
    width: 42,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
    backgroundColor: "#0b5b47",
  },
  badgeText: { fontSize: 17 },
  track: { flex: 1, overflow: "hidden", height: 38, justifyContent: "center" },
  text: {
    position: "absolute",
    color: "#fff4c7",
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 0.2,
    minWidth: 220,
  },
});
