import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { STORAGE_KEYS, WINDSOR_TIME_ZONE } from "./config";
import { getInstallationId } from "./installation";
import { loadSavedPrayerContext } from "./prayerData";

function expoProjectId() {
  return (
    Constants.expoConfig?.extra?.eas?.projectId as string | undefined
  ) || Constants.easConfig?.projectId || undefined;
}

export async function registerDeviceForServerPush(locale: "en" | "ar") {
  if (!Device.isDevice) return null;
  const projectId = expoProjectId();
  const pushApiUrl = Constants.expoConfig?.extra?.pushApiUrl as string | undefined;
  if (!projectId || !pushApiUrl) return null;

  const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  const installationId = await getInstallationId();
  const prayerContext = await loadSavedPrayerContext();

  const response = await fetch(`${pushApiUrl.replace(/\/$/, "")}/subscriptions/expo`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      installationId,
      token,
      platform: Platform.OS,
      locale,
      scheduleTimeZone: prayerContext?.location.timezone || WINDSOR_TIME_ZONE,
      locationLabel: prayerContext?.location.label || null,
      latitude: prayerContext?.location.latitude ?? null,
      longitude: prayerContext?.location.longitude ?? null,
      prayerSource: prayerContext?.location.source || null,
      calculationMethod: prayerContext?.calculationMethod ?? null,
      prayerCalculatedAt: prayerContext?.calculatedAt || null,
      appVersion: Constants.expoConfig?.version ?? "unknown"
    })
  });
  if (!response.ok) throw new Error(`Push registration failed: ${response.status}`);
  await AsyncStorage.setItem(STORAGE_KEYS.pushToken, token);
  return token;
}
