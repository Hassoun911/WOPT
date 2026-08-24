import { useEffect, useRef, useState } from "react";
import { Animated, AppState, Image, StyleSheet, View } from "react-native";
import AppExperience from "./AppExperience";

function StartupSplash({ onDone }: { onDone: () => void }) {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 520,
        useNativeDriver: true
      }),
      Animated.delay(260),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true
      })
    ]).start(({ finished }) => {
      if (finished) onDone();
    });
  }, [onDone, opacity]);

  return (
    <View pointerEvents="none" style={styles.splash}>
      <Animated.View style={[styles.logoWrap, { opacity }]}>
        <Image
          source={require("./assets/hassoun-logo.png")}
          resizeMode="contain"
          style={styles.logo}
        />
      </Animated.View>
    </View>
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
    backgroundColor: "#f7f3e8",
    alignItems: "center",
    justifyContent: "center"
  },
  logoWrap: {
    width: 230,
    height: 230,
    alignItems: "center",
    justifyContent: "center"
  },
  logo: {
    width: 220,
    height: 220
  }
});
