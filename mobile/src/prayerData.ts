import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import bundledSchedule from "../assets/windsor_islamic_association_2026_prayer_times.json";
import { CITY_LABEL, STORAGE_KEYS, WINDSOR_TIME_ZONE } from "./config";
import {
  loadPrayerCalculationPreferences,
  smartMethodForLocation,
  tuneString,
  type PrayerCalculationPreferences
} from "./prayerCalculationSettings";
import type { PrayerDay, PrayerFile, PrayerTimes } from "./types";

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
  calculationMethod: number | null;
  calculatedAt: string;
};

type CachedPrayerContext = LoadedPrayerTimes & { savedAt: string };
type AlAdhanDay = {
  timings?: Record<string, string>;
  date?: { gregorian?: { date?: string } };
  meta?: { timezone?: string };
};
type AlAdhanResponse = { code?: number; data?: AlAdhanDay[] };

const WINDSOR = { latitude: 42.3149, longitude: -83.0364 };
const WINDSOR_RADIUS_KM = 35;
const CANONICAL_CACHE_KEY = "hassoun:prayer-context:v3";
const GPS_TIMEOUT_MS = 15000;
const API_TIMEOUT_MS = 10000;
const GEOCODE_TIMEOUT_MS = 5000;

function timeout<T>(promise: Promise<T>, ms: number, code: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(code)), ms))
  ]);
}

function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const rad = (value: number) => value * Math.PI / 180;
  const dLat = rad(lat2 - lat1);
  const dLon = rad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function isNearWindsor(latitude: number, longitude: number) {
  return distanceKm(latitude, longitude, WINDSOR.latitude, WINDSOR.longitude) <= WINDSOR_RADIUS_KM;
}

function parseTiming(value: unknown) {
  if (typeof value !== "string") return null;
  const match = value.match(/^(\d{1,2}):(\d{2})/);
  return match ? `${match[1].padStart(2, "0")}:${match[2]}` : null;
}

function gregorianKey(value: unknown) {
  if (typeof value !== "string") return null;
  const match = value.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  return match ? `${match[3]}-${match[2]}-${match[1]}` : null;
}

function localDateKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function monthWindow() {
  const now = new Date();
  return [0, 1].map((offset) => {
    const date = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    return { year: date.getFullYear(), month: date.getMonth() + 1 };
  });
}

async function resolveCity(latitude: number, longitude: number) {
  try {
    const places = await timeout(Location.reverseGeocodeAsync({ latitude, longitude }), GEOCODE_TIMEOUT_MS, "GEOCODE_TIMEOUT");
    const place = places[0];
    if (!place) return `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
    const city = place.city || place.subregion || place.district;
    const region = place.region;
    const country = place.country;
    if (city && region) return `${city}, ${region}`;
    if (city && country) return `${city}, ${country}`;
    if (city) return city;
    return country || `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
  } catch {
    return `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
  }
}

async function getPermission(force: boolean) {
  const existing = await Location.getForegroundPermissionsAsync();
  if (existing.granted) return true;
  const requested = await Location.requestForegroundPermissionsAsync();
  if (requested.granted) return true;
  if (force) throw new Error("LOCATION_PERMISSION_DENIED");
  return false;
}

async function getPosition(force: boolean) {
  const services = await Location.hasServicesEnabledAsync();
  if (!services) throw new Error("LOCATION_SERVICES_DISABLED");

  if (!force) {
    const last = await Location.getLastKnownPositionAsync({ maxAge: 10 * 60 * 1000, requiredAccuracy: 5000 });
    if (last) return last;
  }

  const startedAt = Date.now();
  const current = await timeout(
    Location.getCurrentPositionAsync({ accuracy: force ? Location.Accuracy.High : Location.Accuracy.Balanced }),
    GPS_TIMEOUT_MS,
    "LOCATION_FIX_TIMEOUT"
  );
  if (force && current.timestamp < startedAt - 60000) throw new Error("LOCATION_FIX_STALE");
  return current;
}

function methodFor(preferences: PrayerCalculationPreferences, latitude: number, longitude: number) {
  return preferences.mode === "smart" ? smartMethodForLocation(latitude, longitude) : preferences.method;
}

async function fetchAlAdhanMonth(
  latitude: number,
  longitude: number,
  year: number,
  month: number,
  preferences: PrayerCalculationPreferences
) {
  const method = methodFor(preferences, latitude, longitude);
  const url = new URL(`https://api.aladhan.com/v1/calendar/${year}/${month}`);
  url.searchParams.set("latitude", String(latitude));
  url.searchParams.set("longitude", String(longitude));
  url.searchParams.set("method", String(method));
  url.searchParams.set("school", String(preferences.school));
  url.searchParams.set("latitudeAdjustmentMethod", String(preferences.highLatitude));
  url.searchParams.set("tune", tuneString(preferences.offsets));

  const response = await timeout(fetch(url.toString(), { headers: { Accept: "application/json" } }), API_TIMEOUT_MS, "PRAYER_API_TIMEOUT");
  if (!response.ok) throw new Error(`PRAYER_API_${response.status}`);
  const payload = await response.json() as AlAdhanResponse;
  if (payload.code !== 200 || !Array.isArray(payload.data)) throw new Error("PRAYER_API_INVALID");
  return { payload, method };
}

async function calculateOutsideWindsor(latitude: number, longitude: number, preferences: PrayerCalculationPreferences) {
  const prayerTimes: PrayerTimes = {};
  let timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  let selectedMethod = methodFor(preferences, latitude, longitude);

  for (const { year, month } of monthWindow()) {
    const { payload, method } = await fetchAlAdhanMonth(latitude, longitude, year, month, preferences);
    selectedMethod = method;
    timezone = payload.data?.find((day) => day.meta?.timezone)?.meta?.timezone || timezone;
    for (const day of payload.data || []) {
      const key = gregorianKey(day.date?.gregorian?.date);
      if (!key) continue;
      const parsed = {
        fajr: parseTiming(day.timings?.Fajr),
        dhuhr: parseTiming(day.timings?.Dhuhr),
        asr: parseTiming(day.timings?.Asr),
        maghrib: parseTiming(day.timings?.Maghrib),
        isha: parseTiming(day.timings?.Isha)
      };
      if (Object.values(parsed).some((value) => !value)) continue;
      prayerTimes[key] = parsed as PrayerDay;
    }
  }

  if (!Object.keys(prayerTimes).length) throw new Error("PRAYER_API_EMPTY");
  return { prayerTimes, timezone, selectedMethod };
}

async function saveContext(context: LoadedPrayerTimes) {
  const payload: CachedPrayerContext = { ...context, savedAt: new Date().toISOString() };
  await AsyncStorage.multiSet([
    [CANONICAL_CACHE_KEY, JSON.stringify(payload)],
    [STORAGE_KEYS.locationSchedule, JSON.stringify({ prayerTimes: context.prayerTimes, location: context.location, savedAt: payload.savedAt })]
  ]).catch(() => undefined);
}

export async function loadSavedPrayerContext(): Promise<LoadedPrayerTimes | null> {
  try {
    const raw = await AsyncStorage.getItem(CANONICAL_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedPrayerContext;
    if (!parsed?.location || !parsed?.prayerTimes || typeof parsed.prayerTimes !== "object") return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function previewPrayerDayForPreferences(preferences: PrayerCalculationPreferences): Promise<{ asr?: string; source: string }> {
  const saved = await loadSavedPrayerContext();
  if (!saved?.location) throw new Error("NO_SAVED_LOCATION");
  const { latitude, longitude } = saved.location;
  const now = new Date();
  const { payload, method } = await fetchAlAdhanMonth(latitude, longitude, now.getFullYear(), now.getMonth() + 1, preferences);
  const target = localDateKey();
  const day = payload.data?.find((item) => gregorianKey(item.date?.gregorian?.date) === target);
  const asr = parseTiming(day?.timings?.Asr) || undefined;
  return {
    asr,
    source: `${preferences.school === 1 ? "Hanafi" : "Standard"} Asr · method ${method}`
  };
}

function windsorFallback(): LoadedPrayerTimes {
  const prayerTimes = (bundledSchedule as PrayerFile).prayer_times;
  return {
    prayerTimes,
    live: false,
    location: {
      latitude: WINDSOR.latitude,
      longitude: WINDSOR.longitude,
      timezone: WINDSOR_TIME_ZONE,
      label: CITY_LABEL,
      source: "saved"
    },
    calculationMethod: null,
    calculatedAt: new Date().toISOString()
  };
}

export async function loadInitialPrayerTimes(): Promise<LoadedPrayerTimes> {
  return (await loadSavedPrayerContext()) || windsorFallback();
}

export async function loadPrayerTimes(options: { forceLocation?: boolean } = {}): Promise<LoadedPrayerTimes> {
  const force = Boolean(options.forceLocation);
  const fallback = await loadInitialPrayerTimes();

  try {
    const granted = await getPermission(force);
    if (!granted) return fallback;

    const position = await getPosition(force);
    const latitude = position.coords.latitude;
    const longitude = position.coords.longitude;
    const locationLabel = await resolveCity(latitude, longitude);
    const preferences = await loadPrayerCalculationPreferences();
    const nearWindsor = isNearWindsor(latitude, longitude);
    const shouldUseOfficialWindsor = nearWindsor && preferences.scheduleSource !== "calculated";

    let context: LoadedPrayerTimes;
    if (shouldUseOfficialWindsor) {
      context = {
        prayerTimes: (bundledSchedule as PrayerFile).prayer_times,
        live: true,
        location: {
          latitude,
          longitude,
          timezone: WINDSOR_TIME_ZONE,
          label: locationLabel.includes("42.") ? CITY_LABEL : locationLabel,
          source: "windsor_islamic_association"
        },
        calculationMethod: null,
        calculatedAt: new Date().toISOString()
      };
    } else {
      const calculated = await calculateOutsideWindsor(latitude, longitude, preferences);
      context = {
        prayerTimes: calculated.prayerTimes,
        live: true,
        location: {
          latitude,
          longitude,
          timezone: calculated.timezone,
          label: locationLabel,
          source: "aladhan"
        },
        calculationMethod: calculated.selectedMethod,
        calculatedAt: new Date().toISOString()
      };
    }

    await saveContext(context);
    return context;
  } catch (error) {
    if (force) throw error;
    return fallback;
  }
}
