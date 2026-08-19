import { PermissionsAndroid, Platform } from "react-native";
import PrayerAudio, { type NativeDeviceLocation } from "../modules/prayer-audio";

export type DetectedPrayerLocation = NativeDeviceLocation & {
  timezone: string;
};

function deviceTimeZone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

export async function detectPrayerLocation(): Promise<DetectedPrayerLocation | null> {
  if (!PrayerAudio) return null;

  if (Platform.OS === "android") {
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      {
        title: "Use your location for prayer email alerts",
        message: "Hassoun uses your current location only when you choose location-based prayer email alerts.",
        buttonPositive: "Allow",
        buttonNegative: "Not now"
      }
    );
    if (granted !== PermissionsAndroid.RESULTS.GRANTED) return null;
  }

  if (Platform.OS !== "android" && Platform.OS !== "ios") return null;
  const location = await PrayerAudio.getCurrentDeviceLocation();
  if (!location) return null;

  return {
    ...location,
    timezone: deviceTimeZone()
  };
}
