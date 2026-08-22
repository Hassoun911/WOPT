import { View } from "react-native";
import AppWithEmail from "./AppWithEmail";

// Ask the Sheikh now lives inside the main App navigation and Home grid.
// Keep this wrapper intentionally simple so no floating button can overlap
// the persistent bottom navigation on Android.
export default function AppExperience() {
  return (
    <View style={{ flex: 1 }}>
      <AppWithEmail />
    </View>
  );
}
