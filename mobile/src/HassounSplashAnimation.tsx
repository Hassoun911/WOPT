import { useEffect, useMemo, useRef } from "react";
import { Animated, Easing, Image, StyleSheet, View, useWindowDimensions } from "react-native";

type Props = { onFinished: () => void };

export default function HassounSplashAnimation({ onFinished }: Props) {
  const { width, height } = useWindowDimensions();
  const onFinishedRef = useRef(onFinished);
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0.96)).current;
  const glowOpacity = useRef(new Animated.Value(0)).current;
  const glowScale = useRef(new Animated.Value(0.72)).current;
  const shimmer = useRef(new Animated.Value(0)).current;
  const rootOpacity = useRef(new Animated.Value(1)).current;
  const logoSize = useMemo(() => Math.min(width * 0.78, height * 0.58, 500), [width, height]);

  useEffect(() => { onFinishedRef.current = onFinished; }, [onFinished]);

  useEffect(() => {
    const reveal = Animated.parallel([
      Animated.sequence([
        Animated.delay(180),
        Animated.timing(glowOpacity, { toValue: 0.38, duration: 420, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(glowScale, { toValue: 1.08, duration: 760, easing: Easing.out(Easing.cubic), useNativeDriver: true })
      ]),
      Animated.sequence([
        Animated.delay(420),
        Animated.parallel([
          Animated.timing(logoOpacity, { toValue: 1, duration: 620, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
          Animated.timing(logoScale, { toValue: 1, duration: 620, easing: Easing.out(Easing.cubic), useNativeDriver: true })
        ])
      ]),
      Animated.sequence([
        Animated.delay(1250),
        Animated.timing(shimmer, { toValue: 1, duration: 420, easing: Easing.inOut(Easing.quad), useNativeDriver: true })
      ])
    ]);
    reveal.start();
    const fadeTimer = setTimeout(() => {
      Animated.timing(rootOpacity, { toValue: 0, duration: 260, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
    }, 1750);
    const finishTimer = setTimeout(() => onFinishedRef.current(), 2050);
    return () => { reveal.stop(); clearTimeout(fadeTimer); clearTimeout(finishTimer); };
  }, [glowOpacity, glowScale, logoOpacity, logoScale, rootOpacity, shimmer]);

  const shimmerTranslate = shimmer.interpolate({ inputRange: [0, 1], outputRange: [-width * 0.7, width * 0.7] });
  const shimmerOpacity = shimmer.interpolate({ inputRange: [0, 0.28, 0.72, 1], outputRange: [0, 0.22, 0.08, 0] });

  return (
    <Animated.View style={[styles.root, { opacity: rootOpacity }]}>
      <Animated.View style={[styles.glow, { opacity: glowOpacity, transform: [{ scale: glowScale }] }]} />
      <Animated.View style={{ opacity: logoOpacity, transform: [{ scale: logoScale }] }}>
        <Image source={require("../assets/hassoun-logo.png")} resizeMode="contain" style={{ width: logoSize, height: logoSize }} />
      </Animated.View>
      <Animated.View pointerEvents="none" style={[styles.shimmer, { opacity: shimmerOpacity, transform: [{ translateX: shimmerTranslate }, { rotate: "16deg" }] }]} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, zIndex: 9999, elevation: 9999, alignItems: "center", justifyContent: "center", overflow: "hidden", backgroundColor: "#061f1b" },
  glow: { position: "absolute", width: 310, height: 310, borderRadius: 155, backgroundColor: "rgba(237,190,96,0.15)" },
  shimmer: { position: "absolute", width: 68, height: "74%", backgroundColor: "rgba(255,226,164,0.12)" }
});
