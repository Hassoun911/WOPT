import Constants from "expo-constants";
import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";

const API_BASE = String(Constants.expoConfig?.extra?.pushApiUrl || "https://wopt-prayer-push.wopt-windsor.workers.dev").replace(/\/$/, "");

type TickerSetting = { enabled?: boolean; message?: string; speed?: "slow" | "normal" | "fast" };

export default function ScrollingTicker() {
  const [ticker, setTicker] = useState<TickerSetting | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [textWidth, setTextWidth] = useState(0);
  const x = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const response = await fetch(`${API_BASE}/app/runtime`, { headers: { Accept: "application/json" } });
        if (!response.ok) return;
        const payload = await response.json() as { settings?: { scrolling_ticker?: TickerSetting } };
        if (!cancelled) setTicker(payload.settings?.scrolling_ticker ?? null);
      } catch {}
    };
    void load();
    const timer = setInterval(load, 60_000);
    return () => { cancelled = true; clearInterval(timer); };
  }, []);

  const duration = useMemo(() => ticker?.speed === "slow" ? 30000 : ticker?.speed === "fast" ? 14000 : 21000, [ticker?.speed]);

  useEffect(() => {
    if (!ticker?.enabled || !ticker.message?.trim() || !containerWidth || !textWidth) return;
    x.stopAnimation();
    x.setValue(containerWidth);
    const loop = Animated.loop(Animated.timing(x, {
      toValue: -textWidth,
      duration,
      easing: Easing.linear,
      useNativeDriver: true
    }));
    loop.start();
    return () => loop.stop();
  }, [ticker?.enabled, ticker?.message, duration, containerWidth, textWidth, x]);

  if (!ticker?.enabled || !ticker.message?.trim()) return null;
  return <View style={styles.wrap} onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}>
    <Animated.View style={{ transform: [{ translateX: x }] }}>
      <Text onLayout={(e) => setTextWidth(e.nativeEvent.layout.width)} numberOfLines={1} style={styles.text}>{ticker.message}</Text>
    </Animated.View>
  </View>;
}

const styles = StyleSheet.create({
  wrap: { minHeight: 40, justifyContent: "center", overflow: "hidden", backgroundColor: "#0b5b47", borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.18)" },
  text: { color: "#ffffff", fontSize: 15, lineHeight: 40, fontWeight: "800", paddingHorizontal: 18, includeFontPadding: false }
});
