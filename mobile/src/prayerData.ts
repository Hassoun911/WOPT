import AsyncStorage from "@react-native-async-storage/async-storage";
import bundledSchedule from "../assets/windsor_islamic_association_2026_prayer_times.json";
import { SCHEDULE_URL, STORAGE_KEYS } from "./config";
import type { PrayerFile, PrayerTimes } from "./types";

function isPrayerFile(value: unknown): value is PrayerFile {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<PrayerFile>;
  return Boolean(candidate.prayer_times && typeof candidate.prayer_times === "object");
}

export async function loadCachedPrayerTimes(): Promise<{ prayerTimes: PrayerTimes; live: false }> {
  const bundled = bundledSchedule as PrayerFile;
  const cached = await AsyncStorage.getItem(STORAGE_KEYS.schedule);
  let fallback = bundled.prayer_times;
  if (cached) {
    try {
      const parsed = JSON.parse(cached) as unknown;
      if (isPrayerFile(parsed)) fallback = parsed.prayer_times;
    } catch {
      await AsyncStorage.removeItem(STORAGE_KEYS.schedule);
    }
  }
  return { prayerTimes: fallback, live: false };
}

export async function loadPrayerTimes(): Promise<{ prayerTimes: PrayerTimes; live: boolean }> {
  const fallback = (await loadCachedPrayerTimes()).prayerTimes;

  try {
    const response = await fetch(`${SCHEDULE_URL}?v=${Date.now()}`, {
      headers: { Accept: "application/json" }
    });
    if (!response.ok) throw new Error(`Schedule request failed: ${response.status}`);
    const data = (await response.json()) as unknown;
    if (!isPrayerFile(data)) throw new Error("Schedule response is invalid");
    await AsyncStorage.setItem(STORAGE_KEYS.schedule, JSON.stringify(data));
    return { prayerTimes: data.prayer_times, live: true };
  } catch {
    return { prayerTimes: fallback, live: false };
  }
}
