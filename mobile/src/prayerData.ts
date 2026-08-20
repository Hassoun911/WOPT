import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import bundledSchedule from "../assets/windsor_islamic_association_2026_prayer_times.json";
import { CITY_LABEL, PRAYER_API_URL, STORAGE_KEYS, WINDSOR_TIME_ZONE } from "./config";
import type { PrayerFile, PrayerTimes } from "./types";

export type PrayerLocation = {
  latitude: number;
  longitude: number;
  timezone: string;
  label: string;
  source: "windsor_islamic_association" | "aladhan" | "saved";
};

export type LoadedPrayerTimes = {
  prayerTimes: PrayerTimes;
  live: boolean;
  location: PrayerLocation;
};

type PrayerApiResponse = {
  prayer_times?: PrayerTimes;
  source?: "windsor_islamic_association" | "aladhan";
  sourceLabel?: string;
  location?: { label?: string; city?: string; region?: string; country?: string };
  latitude?: number;
  longitude?: number;
};

type CachedLocationPayload = {
  prayerTimes: PrayerTimes;
  location: PrayerLocation;
  savedAt: string;
};

function isPrayerTimes(value: unknown): value is PrayerTimes {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function mergePrayerTimes(...sets: PrayerTimes[]) {
  return Object.assign({}, ...sets) as PrayerTimes;
}

function monthPair(timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit" }).formatToParts(new Date());
  const year = Number(parts.find((part) => part.type === "year")?.value ?? new Date().getFullYear());
  const month = Number(parts.find((part) => part.type === "month")?.value ?? new Date().getMonth() + 1);
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  return [{ year, month }, { year: nextYear, month: nextMonth }];
}

async function locationLabel(latitude: number, longitude: number) {
  try {
    const places = await Location.reverseGeocodeAsync({ latitude, longitude });
    const place = places[0];
    const parts = [place?.city || place?.subregion, place?.region, place?.country].filter(Boolean);
    return parts.length ? parts.join(", ") : "Current location";
  } catch {
    return "Current location";
  }
}

async function fetchMonth(latitude: number, longitude: number, timezone: string, year: number, month: number) {
  const url = new URL(PRAYER_API_URL);
  url.searchParams.set("lat", String(latitude));
  url.searchParams.set("lng", String(longitude));
  url.searchParams.set("timezone", timezone);
  url.searchParams.set("year", String(year));
  url.searchParams.set("month", String(month));
  url.searchParams.set("method", "3");
  url.searchParams.set("school", "0");
  const response = await fetch(url.toString(), { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`Prayer API failed: ${response.status}`);
  const data = await response.json() as PrayerApiResponse;
  if (!isPrayerTimes(data.prayer_times)) throw new Error("Prayer API response is invalid");
  return data;
}

async function cachedLocation() {
  const saved = await AsyncStorage.getItem(STORAGE_KEYS.locationSchedule);
  if (!saved) return null;
  try {
    const parsed = JSON.parse(saved) as Partial<CachedLocationPayload>;
    if (!isPrayerTimes(parsed.prayerTimes) || !parsed.location) return null;
    return parsed as CachedLocationPayload;
  } catch {
    await AsyncStorage.removeItem(STORAGE_KEYS.locationSchedule);
    return null;
  }
}

export async function loadPrayerTimes(): Promise<LoadedPrayerTimes> {
  const bundled = bundledSchedule as PrayerFile;
  const cached = await cachedLocation();
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || WINDSOR_TIME_ZONE;

  try {
    const permission = await Location.requestForegroundPermissionsAsync();
    if (!permission.granted) throw new Error("Location permission is not granted");
    const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    const latitude = position.coords.latitude;
    const longitude = position.coords.longitude;
    const months = monthPair(timezone);
    const [current, next] = await Promise.all(months.map(({ year, month }) => fetchMonth(latitude, longitude, timezone, year, month)));
    const prayerTimes = mergePrayerTimes(current.prayer_times || {}, next.prayer_times || {});
    const apiLabel = current.location?.label && current.location.label !== "Current location" ? current.location.label : null;
    const label = apiLabel || await locationLabel(latitude, longitude);
    const location: PrayerLocation = {
      latitude,
      longitude,
      timezone,
      label: current.source === "windsor_islamic_association" ? CITY_LABEL : label,
      source: current.source || "aladhan"
    };
    await AsyncStorage.setItem(STORAGE_KEYS.locationSchedule, JSON.stringify({ prayerTimes, location, savedAt: new Date().toISOString() } satisfies CachedLocationPayload));
    return { prayerTimes, live: true, location };
  } catch {
    if (cached) return { prayerTimes: cached.prayerTimes, live: false, location: { ...cached.location, source: "saved" } };
    return {
      prayerTimes: bundled.prayer_times,
      live: false,
      location: { latitude: 42.3149, longitude: -83.0364, timezone: WINDSOR_TIME_ZONE, label: CITY_LABEL, source: "saved" }
    };
  }
}
