import { useEffect, useMemo, useRef } from "react";
import { Animated, Easing, Image, StyleSheet, View, useWindowDimensions } from "react-native";

type Props = { onFinished: () => void };

export default function HassounSplashAnimation({ onFinished }: Props) {
  const { width, height } = useWindowDimensions();
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0.92)).current;
  const glowOpacity = useRef(new Animated.Value(0)).current;
  const glowScale = useRef(new Animated.Value(0.55)).current;
  const shimmer = useRef(new Animated.Value(0)).current;
  const rootOpacity = useRef(new Animated.Value(1)).current;

  const logoSize = useMemo(() => Math.min(width * 0.82, height * 0.64, 520), [width, height]);

  useEffect(() => {
    const reveal = Animated.parallel([
      Animated.sequence([
        Animated.delay(300),
        Animated.timing(glowOpacity, { toValue: 0.95, duration: 400, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(glowOpacity, { toValue: 0.55, duration: 500, easing: Easing.inOut(Easing.quad), useNativeDriver: true })
      ]),
      Animated.sequence([
        Animated.delay(300),
        Animated.timing(glowScale, { toValue: 1.15, duration: 900, easing: Easing.out(Easing.cubic), useNativeDriver: true })
      ]),
      Animated.sequence([
        Animated.delay(700),
        Animated.parallel([
          Animated.timing(logoOpacity, { toValue: 1, duration: 850, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
          Animated.timing(logoScale, { toValue: 1, duration: 850, easing: Easing.out(Easing.back(1.05)), useNativeDriver: true })
        ])
      ]),
      Animated.sequence([
        Animated.delay(1600),
        Animated.timing(shimmer, { toValue: 1, duration: 500, easing: Easing.inOut(Easing.quad), useNativeDriver: true })
      ])
    ]);

    reveal.start();
    const fadeTimer = setTimeout(() => {
      Animated.timing(rootOpacity, { toValue: 0, duration: 300, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
    }, 2100);
    const finishTimer = setTimeout(onFinished, 2400);

    return () => {
      reveal.stop();
      clearTimeout(fadeTimer);
      clearTimeout(finishTimer);
    };
  }, [glowOpacity, glowScale, logoOpacity, logoScale, onFinished, rootOpacity, shimmer]);

  const shimmerTranslate = shimmer.interpolate({ inputRange: [0, 1], outputRange: [-width * 0.8, width * 0.8] });
  const shimmerOpacity = shimmer.interpolate({ inputRange: [0, 0.25, 0.7, 1], outputRange: [0, 0.7, 0.25, 0] });

  return (
    <Animated.View style={[styles.root, { opacity: rootOpacity }]}>
      <View style={styles.patternOne} />
      <View style={styles.patternTwo} />
      <View style={styles.mosqueSilhouette}>
        <View style={styles.dome} />
        <View style={[styles.minaret, { left: "12%", height: 84 }]} />
        <View style={[styles.minaret, { right: "12%", height: 72 }]} />
        <View style={styles.horizon} />
      </View>

      <Animated.View style={[styles.glowOuter, { opacity: glowOpacity, transform: [{ scale: glowScale }] }]} />
      <Animated.View style={[styles.glowInner, { opacity: glowOpacity, transform: [{ scale: glowScale }] }]} />

      <Animated.View style={{ opacity: logoOpacity, transform: [{ scale: logoScale }] }}>
        <Image source={require("../assets/hassoun-logo.png")} resizeMode="contain" style={{ width: logoSize, height: logoSize }} />
      </Animated.View>

      <Animated.View pointerEvents="none" style={[styles.shimmer, { opacity: shimmerOpacity, transform: [{ translateX: shimmerTranslate }, { rotate: "18deg" }] }]} />
      <View style={styles.bottomWarmth} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
    elevation: 9999,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    backgroundColor: "#061f1b"
  },
  patternOne: {
    position: "absolute",
    width: 360,
    height: 360,
    borderRadius: 180,
    borderWidth: 1,
    borderColor: "rgba(213,169,87,0.08)",
    top: -130,
    right: -130
  },
  patternTwo: {
    position: "absolute",
    width: 250,
    height: 250,
    borderRadius: 125,
    borderWidth: 1,
    borderColor: "rgba(213,169,87,0.06)",
    left: -100,
    top: 80
  },
  glowOuter: {
    position: "absolute",
    bottom: "14%",
    width: 330,
    height: 330,
    borderRadius: 165,
    backgroundColor: "rgba(224,171,67,0.12)"
  },
  glowInner: {
    position: "absolute",
    bottom: "18%",
    width: 190,
    height: 190,
    borderRadius: 95,
    backgroundColor: "rgba(255,215,126,0.22)"
  },
  shimmer: {
    position: "absolute",
    width: 90,
    height: "90%",
    backgroundColor: "rgba(255,220,143,0.17)"
  },
  mosqueSilhouette: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: "27%",
    opacity: 0.42
  },
  horizon: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 65,
    backgroundColor: "#041511"
  },
  dome: {
    position: "absolute",
    bottom: 54,
    alignSelf: "center",
    left: "38%",
    width: "24%",
    height: 72,
    borderTopLeftRadius: 70,
    borderTopRightRadius: 70,
    backgroundColor: "#041511"
  },
  minaret: {
    position: "absolute",
    bottom: 54,
    width: 14,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    backgroundColor: "#041511"
  },
  bottomWarmth: {
    position: "absolute",
    bottom: -80,
    width: 380,
    height: 180,
    borderRadius: 190,
    backgroundColor: "rgba(201,144,45,0.08)"
  }
});
