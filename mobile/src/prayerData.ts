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
  source: "windsor_islamic_association" | "aladhan" | "saved" | "local_calculation";
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
const CANONICAL_CACHE_KEY = "hassoun:prayer-context:v4";
const LEGACY_CACHE_KEY = "hassoun:prayer-context:v3";
const GPS_TIMEOUT_MS = 7000;
const API_TIMEOUT_MS = 7000;
const GEOCODE_TIMEOUT_MS = 2500;

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
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
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

function fastLocationLabel(latitude: number, longitude: number, saved: LoadedPrayerTimes | null) {
  if (isNearWindsor(latitude, longitude)) return CITY_LABEL;
  if (saved?.location && distanceKm(latitude, longitude, saved.location.latitude, saved.location.longitude) < 10) return saved.location.label;
  return `${latitude.toFixed(3)}, ${longitude.toFixed(3)}`;
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
    return city || country || `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
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

  const last = await Location.getLastKnownPositionAsync({ maxAge: 30 * 60 * 1000, requiredAccuracy: 10000 });
  if (last && !force) return last;

  return timeout(
    Location.getCurrentPositionAsync({ accuracy: force ? Location.Accuracy.High : Location.Accuracy.Balanced }),
    GPS_TIMEOUT_MS,
    "LOCATION_FIX_TIMEOUT"
  );
}

function methodFor(preferences: PrayerCalculationPreferences, latitude: number, longitude: number) {
  return preferences.mode === "smart" ? smartMethodForLocation(latitude, longitude) : preferences.method;
}

function methodAngles(method: number) {
  const table: Record<number, { fajr: number; isha?: number; ishaMinutes?: number }> = {
    1: { fajr: 18, isha: 18 },
    2: { fajr: 15, isha: 15 },
    3: { fajr: 18, isha: 17 },
    4: { fajr: 18.5, ishaMinutes: 90 },
    5: { fajr: 19.5, isha: 17.5 },
    7: { fajr: 17.7, isha: 14 },
    8: { fajr: 19.5, ishaMinutes: 90 },
    9: { fajr: 18, isha: 17.5 },
    10: { fajr: 18, ishaMinutes: 90 },
    11: { fajr: 20, isha: 18 },
    12: { fajr: 12, isha: 12 },
    13: { fajr: 18, isha: 17 },
    14: { fajr: 16, isha: 15 }
  };
  return table[method] || table[3];
}

function dayOfYear(date: Date) {
  const start = Date.UTC(date.getUTCFullYear(), 0, 0);
  return Math.floor((Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) - start) / 86400000);
}

function solarInfo(date: Date, longitude: number) {
  const n = dayOfYear(date);
  const gamma = 2 * Math.PI / 365 * (n - 1);
  const eqtime = 229.18 * (0.000075 + 0.001868 * Math.cos(gamma) - 0.032077 * Math.sin(gamma) - 0.014615 * Math.cos(2 * gamma) - 0.040849 * Math.sin(2 * gamma));
  const decl = 0.006918 - 0.399912 * Math.cos(gamma) + 0.070257 * Math.sin(gamma) - 0.006758 * Math.cos(2 * gamma) + 0.000907 * Math.sin(2 * gamma) - 0.002697 * Math.cos(3 * gamma) + 0.00148 * Math.sin(3 * gamma);
  const solarNoonUtcMinutes = 720 - 4 * longitude - eqtime;
  return { decl, solarNoonUtcMinutes };
}

function hourAngle(latitude: number, declination: number, altitudeDeg: number) {
  const lat = latitude * Math.PI / 180;
  const altitude = altitudeDeg * Math.PI / 180;
  const cosH = (Math.sin(altitude) - Math.sin(lat) * Math.sin(declination)) / (Math.cos(lat) * Math.cos(declination));
  if (cosH <= -1 || cosH >= 1) return null;
  return Math.acos(cosH) * 180 / Math.PI * 4;
}

function asrMinutesFromNoon(latitude: number, declination: number, shadowFactor: number) {
  const lat = latitude * Math.PI / 180;
  const angle = -Math.atan(1 / (shadowFactor + Math.tan(Math.abs(lat - declination)))) * 180 / Math.PI;
  return hourAngle(latitude, declination, angle);
}

function timezoneOffsetMinutes(date: Date, timezone: string) {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23"
    }).formatToParts(date);
    const get = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((p) => p.type === type)?.value || 0);
    const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
    return Math.round((asUtc - date.getTime()) / 60000);
  } catch {
    return -date.getTimezoneOffset();
  }
}

function clock(minutes: number) {
  const normalized = ((Math.round(minutes) % 1440) + 1440) % 1440;
  return `${String(Math.floor(normalized / 60)).padStart(2, "0")}:${String(normalized % 60).padStart(2, "0")}`;
}

function applyTune(time: string, offset = 0) {
  const [h, m] = time.split(":").map(Number);
  return clock(h * 60 + m + offset);
}

function localPrayerDay(date: Date, latitude: number, longitude: number, timezone: string, preferences: PrayerCalculationPreferences): PrayerDay {
  const method = methodFor(preferences, latitude, longitude);
  const angles = methodAngles(method);
  const { decl, solarNoonUtcMinutes } = solarInfo(date, longitude);
  const offset = timezoneOffsetMinutes(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 12)), timezone);
  const noon = solarNoonUtcMinutes + offset;
  const sunriseHa = hourAngle(latitude, decl, -0.833) ?? 360;
  const fajrHa = hourAngle(latitude, decl, -angles.fajr) ?? sunriseHa + 90;
  const ishaHa = angles.isha ? (hourAngle(latitude, decl, -angles.isha) ?? sunriseHa + 90) : null;
  const asrHa = asrMinutesFromNoon(latitude, decl, preferences.school === 1 ? 2 : 1) ?? 240;
  const sunset = noon + sunriseHa;
  const offsets = preferences.offsets || {};
  return {
    fajr: applyTune(clock(noon - fajrHa), Number(offsets.fajr || 0)),
    dhuhr: applyTune(clock(noon), Number(offsets.dhuhr || 0)),
    asr: applyTune(clock(noon + asrHa), Number(offsets.asr || 0)),
    maghrib: applyTune(clock(sunset), Number(offsets.maghrib || 0)),
    isha: applyTune(clock(angles.ishaMinutes ? sunset + angles.ishaMinutes : noon + (ishaHa || sunriseHa + 90)), Number(offsets.isha || 0))
  };
}

function calculateLocalWindow(latitude: number, longitude: number, timezone: string, preferences: PrayerCalculationPreferences) {
  const prayerTimes: PrayerTimes = {};
  const today = new Date();
  for (let offset = -1; offset <= 45; offset += 1) {
    const date = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate() + offset, 12));
    const key = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
    prayerTimes[key] = localPrayerDay(date, latitude, longitude, timezone, preferences);
  }
  return { prayerTimes, method: methodFor(preferences, latitude, longitude) };
}

async function fetchAlAdhanMonth(latitude: number, longitude: number, year: number, month: number, preferences: PrayerCalculationPreferences) {
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

async function fetchRemoteWindow(latitude: number, longitude: number, preferences: PrayerCalculationPreferences) {
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
        fajr: parseTiming(day.timings?.Fajr), dhuhr: parseTiming(day.timings?.Dhuhr), asr: parseTiming(day.timings?.Asr),
        maghrib: parseTiming(day.timings?.Maghrib), isha: parseTiming(day.timings?.Isha)
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
    const [current, legacy] = await AsyncStorage.multiGet([CANONICAL_CACHE_KEY, LEGACY_CACHE_KEY]);
    const raw = current[1] || legacy[1];
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
  const { latitude, longitude, timezone } = saved.location;
  const day = calculateLocalWindow(latitude, longitude, timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC", preferences).prayerTimes[localDateKey()];
  return { asr: day?.asr, source: `${preferences.school === 1 ? "Hanafi" : "Standard"} Asr · local instant calculation` };
}

function windsorFallback(): LoadedPrayerTimes {
  const prayerTimes = (bundledSchedule as PrayerFile).prayer_times;
  return {
    prayerTimes,
    live: false,
    location: { latitude: WINDSOR.latitude, longitude: WINDSOR.longitude, timezone: WINDSOR_TIME_ZONE, label: CITY_LABEL, source: "saved" },
    calculationMethod: null,
    calculatedAt: new Date().toISOString()
  };
}

export async function loadInitialPrayerTimes(): Promise<LoadedPrayerTimes> {
  return (await loadSavedPrayerContext()) || windsorFallback();
}

async function refreshRemoteInBackground(base: LoadedPrayerTimes, preferences: PrayerCalculationPreferences) {
  const { latitude, longitude } = base.location;
  try {
    const [remote, city] = await Promise.all([
      fetchRemoteWindow(latitude, longitude, preferences),
      resolveCity(latitude, longitude)
    ]);
    const refreshed: LoadedPrayerTimes = {
      prayerTimes: remote.prayerTimes,
      live: true,
      location: { latitude, longitude, timezone: remote.timezone, label: city, source: "aladhan" },
      calculationMethod: remote.selectedMethod,
      calculatedAt: new Date().toISOString()
    };
    await saveContext(refreshed);
  } catch {
    // Local/cache data remains authoritative until the next successful refresh.
  }
}

export async function loadPrayerTimes(options: { forceLocation?: boolean } = {}): Promise<LoadedPrayerTimes> {
  const force = Boolean(options.forceLocation);
  const saved = await loadSavedPrayerContext();
  const fallback = saved || windsorFallback();

  try {
    const granted = await getPermission(force);
    if (!granted) return fallback;
    const position = await getPosition(force);
    const latitude = position.coords.latitude;
    const longitude = position.coords.longitude;
    const preferences = await loadPrayerCalculationPreferences();
    const nearWindsor = isNearWindsor(latitude, longitude);
    const shouldUseOfficialWindsor = nearWindsor && preferences.scheduleSource !== "calculated";

    if (shouldUseOfficialWindsor) {
      const context: LoadedPrayerTimes = {
        prayerTimes: (bundledSchedule as PrayerFile).prayer_times,
        live: true,
        location: { latitude, longitude, timezone: WINDSOR_TIME_ZONE, label: CITY_LABEL, source: "windsor_islamic_association" },
        calculationMethod: null,
        calculatedAt: new Date().toISOString()
      };
      await saveContext(context);
      return context;
    }

    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || saved?.location.timezone || "UTC";
    const local = calculateLocalWindow(latitude, longitude, timezone, preferences);
    const context: LoadedPrayerTimes = {
      prayerTimes: local.prayerTimes,
      live: true,
      location: { latitude, longitude, timezone, label: fastLocationLabel(latitude, longitude, saved), source: "local_calculation" },
      calculationMethod: local.method,
      calculatedAt: new Date().toISOString()
    };

    await saveContext(context);
    void refreshRemoteInBackground(context, preferences);
    return context;
  } catch (error) {
    if (force && !saved) throw error;
    return fallback;
  }
}
