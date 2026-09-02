import { Image, StyleSheet, View } from "react-native";

export default function BrandMark({ size = 44 }: { size?: number }) {
  const markSize = Math.round(size * 0.82);
  return (
    <View style={[styles.shell, { width: size, height: size, borderRadius: Math.max(12, Math.round(size * 0.28)) }]}>
      <Image source={require("../assets/hassoun-logo.png")} resizeMode="contain" style={{ width: markSize, height: markSize }} />
    </View>
  );
}

const styles = StyleSheet.create({
  shell: { overflow: "hidden", backgroundColor: "#003d33", alignItems: "center", justifyContent: "center", padding: 2 }
});