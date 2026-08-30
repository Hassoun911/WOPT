import { StyleSheet, View } from "react-native";
import { VideoView, useVideoPlayer } from "expo-video";

export default function MasjidVideoBackground({ uri, dim = 0.45 }: { uri: string; dim?: number }) {
  const player = useVideoPlayer(uri, (instance) => {
    instance.loop = true;
    instance.muted = true;
    instance.play();
  });

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <VideoView
        player={player}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        nativeControls={false}
      />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: `rgba(0,0,0,${Math.max(0, Math.min(0.85, dim))})` }]} />
    </View>
  );
}
