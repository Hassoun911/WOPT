import { useEffect, useRef, useState } from "react";
import { Animated, AppState, Easing, Image, StyleSheet, Text, View } from "react-native";
import AppExperience from "./AppExperience";

const STARTUP_MS = 720;

function StartupSplash({ onDone }: { onDone: () => void }) {
  const lift = useRef(new Animated.Value(0)).current;
  const glow = useRef(new Animated.Value(0)).current;
  const fade = useRef(new Animated.Value(1)).current;
  const title = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.sequence([
        Animated.timing(lift, {
          toValue: 1,
          duration: 320,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true
        }),
        Animated.timing(lift, {
          toValue: 0.35,
          duration: 170,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true
        })
      ]),
      Animated.timing(glow, {
        toValue: 1,
        duration: 360,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true
      }),
      Animated.timing(title, {
        toValue: 1,
        duration: 280,
        delay: 120,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true
      })
    ]).start();

    const timer = setTimeout(() => {
      Animated.timing(fade, {
        toValue: 0,
        duration: 180,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true
      }).start(({ finished }) => {
        if (finished) onDone();
      });
    }, STARTUP_MS - 180);

    return () => clearTimeout(timer);
  }, [fade, glow, lift, onDone, title]);

  const translateY = lift.interpolate({ inputRange: [0, 1], outputRange: [0, -14] });
  const scale = lift.interpolate({ inputRange: [0, 1], outputRange: [1, 1.035] });
  const glowOpacity = glow.interpolate({ inputRange: [0, 1], outputRange: [0, 0.28] });

  return (
    <Animated.View pointerEvents="none" style={[styles.splash, { opacity: fade }]}>
      <Animated.View style={[styles.glow, { opacity: glowOpacity, transform: [{ scale }] }]} />
      <Animated.View style={[styles.logoWrap, { transform: [{ translateY }, { scale }] }]}>
        <Image source={require("./assets/hassoun-logo.png")} resizeMode="contain" style={styles.logo} />
      </Animated.View>
      <Animated.View style={{ opacity: title }}>
        <Text style={styles.brand}>Hassoun</Text>
        <View style={styles.rule} />
      </Animated.View>
    </Animated.View>
  );
}

export default function AppRoot() {
  const [locationEpoch, setLocationEpoch] = useState(0);
  const [showStartup, setShowStartup] = useState(true);

  useEffect(() => {
    let lastActiveAt = Date.now();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active") return;
      const now = Date.now();
      if (now - lastActiveAt > 30_000) setLocationEpoch((value) => value + 1);
      lastActiveAt = now;
    });
    return () => subscription.remove();
  }, []);

  return (
    <View style={styles.root}>
      <AppExperience key={locationEpoch} />
      {showStartup ? <StartupSplash onDone={() => setShowStartup(false)} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  splash: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 9999,
    elevation: 9999,
    backgroundColor: "#042d27",
    alignItems: "center",
    justifyContent: "center"
  },
  glow: {
    position: "absolute",
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: "#d9b45c"
  },
  logoWrap: {
    width: 245,
    height: 245,
    alignItems: "center",
    justifyContent: "center"
  },
  logo: {
    width: 235,
    height: 235
  },
  brand: {
    marginTop: 14,
    color: "#e5c579",
    fontSize: 24,
    fontWeight: "800",
    letterSpacing: 1.2,
    textAlign: "center"
  },
  rule: {
    width: 72,
    height: 1,
    marginTop: 8,
    alignSelf: "center",
    backgroundColor: "rgba(229,197,121,0.65)"
  }
});
