import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import * as Crypto from "expo-crypto";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { STORAGE_KEYS, WINDSOR_TIME_ZONE } from "./config";

export async function registerDeviceForServerPush(locale: "en" | "ar") {
  if (!Device.isDevice) return null;
  const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
  const pushApiUrl = Constants.expoConfig?.extra?.pushApiUrl as string | undefined;
  if (!projectId || !pushApiUrl) return null;

  const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  let installationId = await AsyncStorage.getItem(STORAGE_KEYS.installationId);
  if (!installationId) {
    installationId = Crypto.randomUUID();
    await AsyncStorage.setItem(STORAGE_KEYS.installationId, installationId);
  }
  const previous = await AsyncStorage.getItem(STORAGE_KEYS.pushToken);
  if (previous === token) return token;

  const response = await fetch(`${pushApiUrl.replace(/\/$/, "")}/subscriptions/expo`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      installationId,
      token,
      platform: Platform.OS,
      locale,
      scheduleTimeZone: WINDSOR_TIME_ZONE,
      appVersion: Constants.expoConfig?.version ?? "unknown"
    })
  });
  if (!response.ok) throw new Error(`Push registration failed: ${response.status}`);
  await AsyncStorage.setItem(STORAGE_KEYS.pushToken, token);
  return token;
}
