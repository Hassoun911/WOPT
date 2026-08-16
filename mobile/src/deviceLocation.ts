import { PermissionsAndroid, Platform } from "react-native";
import PrayerAudio, { type NativeDeviceLocation } from "../modules/prayer-audio";

export type DetectedPrayerLocation = NativeDeviceLocation & {
  timezone: string;
};

function deviceTimeZone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

export async function detectPrayerLocation(): Promise<DetectedPrayerLocation | null> {
  if (Platform.OS !== "android" || !PrayerAudio) return null;

  const granted = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    {
      title: "Use your location for prayer times",
      message: "WOPT uses your current location to automatically select the correct local prayer times and email alert time zone.",
      buttonPositive: "Allow",
      buttonNegative: "Not now"
    }
  );

  if (granted !== PermissionsAndroid.RESULTS.GRANTED) return null;

  const location = await PrayerAudio.getCurrentDeviceLocation();
  if (!location) return null;

  return {
    ...location,
    timezone: deviceTimeZone()
  };
}
