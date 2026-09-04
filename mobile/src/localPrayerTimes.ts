import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import bundledSchedule from "../assets/windsor_islamic_association_2026_prayer_times.json";
import type { PrayerDay, PrayerFile, PrayerTimes } from "./types";

export type PrayerLocationContext = {
  latitude: number;
  longitude: number;
  timezone: string;
  locationLabel: string;
  sourceLabel: string;
  prayerTimes: PrayerTimes;
  live: boolean;
  isWindsor: boolean;
};

type AlAdhanDay = { timings?: Record<string, string>; date?: { gregorian?: { date?: string } }; meta?: { timezone?: string } };
type AlAdhanResponse = { code?: number; data?: AlAdhanDay[] };

const WINDSOR = { latitude: 42.3149, longitude: -83.0364 };
const WINDSOR_RADIUS_KM = 35;
const CACHE_KEY = "hassoun:local-prayer-context:v1";

function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const rad = (v: number) => v * Math.PI / 180;
  const dLat = rad(lat2 - lat1), dLon = rad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function parseTiming(value: unknown) {
  if (typeof value !== "string") return null;
  const m = value.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  return `${m[1].padStart(2, "0")}:${m[2]}`;
}

function dateKey(value: unknown) {
  if (typeof value !== "string") return null;
  const m = value.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}

function periodsAroundNow() {
  const now = new Date();
  return [-1, 0, 1].map((offset) => {
    const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    return { year: d.getFullYear(), month: d.getMonth() + 1 };
  });
}

async function calculatedTimes(latitude: number, longitude: number) {
  const prayerTimes: PrayerTimes = {};
  let timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  for (const { year, month } of periodsAroundNow()) {
    const url = new URL(`https://api.aladhan.com/v1/calendar/${year}/${month}`);
    url.searchParams.set("latitude", String(latitude));
    url.searchParams.set("longitude", String(longitude));
    url.searchParams.set("method", "3");
    url.searchParams.set("school", "0");
    const response = await fetch(url.toString(), { headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error(`Prayer service returned ${response.status}`);
    const payload = await response.json() as AlAdhanResponse;
    if (payload.code !== 200 || !Array.isArray(payload.data)) throw new Error("Invalid prayer service response");
    timezone = payload.data.find((day) => day.meta?.timezone)?.meta?.timezone || timezone;
    for (const day of payload.data) {
      const key = dateKey(day.date?.gregorian?.date);
      if (!key) continue;
      const parsed = {
        fajr: parseTiming(day.timings?.Fajr), dhuhr: parseTiming(day.timings?.Dhuhr), asr: parseTiming(day.timings?.Asr),
        maghrib: parseTiming(day.timings?.Maghrib), isha: parseTiming(day.timings?.Isha)
      };
      if (Object.values(parsed).some((v) => !v)) continue;
      prayerTimes[key] = parsed as PrayerDay;
    }
  }
  if (!Object.keys(prayerTimes).length) throw new Error("No local prayer times returned");
  return { prayerTimes, timezone };
}

async function placeLabel(latitude: number, longitude: number) {
  try {
    const places = await Location.reverseGeocodeAsync({ latitude, longitude });
    const p = places[0];
    if (!p) return "Current location";
    return [p.city || p.subregion || p.district, p.region].filter(Boolean).join(", ") || p.country || "Current location";
  } catch { return "Current location"; }
}

async function save(context: PrayerLocationContext) {
  await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(context)).catch(() => undefined);
}

async function cached(): Promise<PrayerLocationContext | null> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) as PrayerLocationContext : null;
  } catch { return null; }
}

export async function loadLocationPrayerContext(force = false): Promise<PrayerLocationContext> {
  const fallback = await cached();
  try {
    const permission = await Location.requestForegroundPermissionsAsync();
    if (permission.status !== "granted") {
      if (fallback) return fallback;
      const prayerTimes = (bundledSchedule as PrayerFile).prayer_times;
      return { ...WINDSOR, timezone: "America/Toronto", locationLabel: "Windsor, Ontario", sourceLabel: "Saved official Windsor schedule", prayerTimes, live: false, isWindsor: true };
    }
    let position = !force ? await Location.getLastKnownPositionAsync({ maxAge: 15 * 60 * 1000, requiredAccuracy: 5000 }) : null;
    if (!position) position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    const latitude = position.coords.latitude, longitude = position.coords.longitude;
    const isWindsor = distanceKm(latitude, longitude, WINDSOR.latitude, WINDSOR.longitude) <= WINDSOR_RADIUS_KM;
    const locationLabel = await placeLabel(latitude, longitude);
    let context: PrayerLocationContext;
    if (isWindsor) {
      context = { latitude, longitude, timezone: "America/Toronto", locationLabel: locationLabel || "Windsor, Ontario", sourceLabel: "Windsor Islamic Association • official Adhan time", prayerTimes: (bundledSchedule as PrayerFile).prayer_times, live: true, isWindsor: true };
    } else {
      const local = await calculatedTimes(latitude, longitude);
      context = { latitude, longitude, timezone: local.timezone, locationLabel, sourceLabel: "Local Adhan calculation • device location", prayerTimes: local.prayerTimes, live: true, isWindsor: false };
    }
    await save(context);
    return context;
  } catch {
    if (fallback) return fallback;
    const prayerTimes = (bundledSchedule as PrayerFile).prayer_times;
    return { ...WINDSOR, timezone: "America/Toronto", locationLabel: "Windsor, Ontario", sourceLabel: "Saved official Windsor schedule", prayerTimes, live: false, isWindsor: true };
  }
}
