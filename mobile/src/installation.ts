import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";
import { STORAGE_KEYS } from "./config";

export async function getInstallationId() {
  let installationId = await AsyncStorage.getItem(STORAGE_KEYS.installationId);
  if (!installationId) {
    installationId = Crypto.randomUUID();
    await AsyncStorage.setItem(STORAGE_KEYS.installationId, installationId);
  }
  return installationId;
}
