import type { Env, PrayerKey, PrayerTimes } from "./types";

const WINDSOR = { latitude: 42.3149, longitude: -83.0364 };
const WINDSOR_RADIUS_KM = 35;
const PRAYERS: PrayerKey[] = ["fajr", "dhuhr", "asr", "maghrib", "isha"];

type PrayerFile = { prayer_times?: PrayerTimes };
type AlAdhanDay = { timings?: Record<string, string>; date?: { gregorian?: { date?: string } } };
type AlAdhanResponse = { code?: number; data?: AlAdhanDay[] };

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=300" }
  });
}

function numberParam(url: URL, key: string, min: number, max: number) {
  const raw = url.searchParams.get(key);
  if (raw === null) return null;
  const value = Number(raw);
  return Number.isFinite(value) && value >= min && value <= max ? value : null;
}

function integerParam(url: URL, key: string, fallback: number, min: number, max: number) {
  const value = Number(url.searchParams.get(key) ?? fallback);
  return Number.isInteger(value) && value >= min && value <= max ? value : fallback;
}

function validTimezone(value: string | null) {
  const timezone = value || "UTC";
  try {
    new Intl.DateTimeFormat("en", { timeZone: timezone }).format(new Date());
    return timezone;
  } catch {
    return "UTC";
  }
}

function radians(value: number) { return value * Math.PI / 180; }
function distanceKm(aLat: number, aLng: number, bLat: number, bLng: number) {
  const earth = 6371;
  const dLat = radians(bLat - aLat);
  const dLng = radians(bLng - aLng);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(radians(aLat)) * Math.cos(radians(bLat)) * Math.sin(dLng / 2) ** 2;
  return earth * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
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

function monthPrefix(year: number, month: number) {
  return `${year}-${String(month).padStart(2, "0")}-`;
}

function filterMonth(times: PrayerTimes, year: number, month: number) {
  const prefix = monthPrefix(year, month);
  return Object.fromEntries(Object.entries(times).filter(([date]) => date.startsWith(prefix))) as PrayerTimes;
}

async function windsorSchedule(env: Env, year: number, month: number) {
  const response = await fetch(env.SCHEDULE_URL, { cf: { cacheEverything: true, cacheTtl: 3600 } });
  if (!response.ok) throw new Error(`Windsor schedule fetch failed: ${response.status}`);
  const data = await response.json() as PrayerFile;
  if (!data.prayer_times) throw new Error("Windsor schedule is missing prayer_times");
  return filterMonth(data.prayer_times, year, month);
}

async function globalSchedule(env: Env, latitude: number, longitude: number, year: number, month: number, method: number, school: number) {
  const base = (env.GLOBAL_PRAYER_API_BASE || "https://api.aladhan.com/v1").replace(/\/$/, "");
  const url = new URL(`${base}/calendar/${year}/${month}`);
  url.searchParams.set("latitude", String(latitude));
  url.searchParams.set("longitude", String(longitude));
  url.searchParams.set("method", String(method));
  url.searchParams.set("school", String(school));
  const response = await fetch(url.toString(), { headers: { Accept: "application/json" }, cf: { cacheEverything: true, cacheTtl: 21600 } });
  if (!response.ok) throw new Error(`Global prayer API failed: ${response.status}`);
  const payload = await response.json() as AlAdhanResponse;
  if (payload.code !== 200 || !Array.isArray(payload.data)) throw new Error("Global prayer API returned invalid data");
  const times: PrayerTimes = {};
  for (const day of payload.data) {
    const date = gregorianKey(day.date?.gregorian?.date);
    if (!date) continue;
    const parsed = {
      fajr: parseTiming(day.timings?.Fajr),
      dhuhr: parseTiming(day.timings?.Dhuhr),
      asr: parseTiming(day.timings?.Asr),
      maghrib: parseTiming(day.timings?.Maghrib),
      isha: parseTiming(day.timings?.Isha)
    };
    if (PRAYERS.some((key) => !parsed[key])) continue;
    times[date] = parsed as Record<PrayerKey, string>;
  }
  return times;
}

export async function getLocationPrayerTimes(url: URL, env: Env) {
  const latitude = numberParam(url, "lat", -90, 90);
  const longitude = numberParam(url, "lng", -180, 180);
  if (latitude === null || longitude === null) return json({ error: "Valid lat and lng are required" }, 400);

  const now = new Date();
  const year = integerParam(url, "year", now.getUTCFullYear(), 2020, 2100);
  const month = integerParam(url, "month", now.getUTCMonth() + 1, 1, 12);
  const method = integerParam(url, "method", 3, 0, 99);
  const school = integerParam(url, "school", 0, 0, 1);
  const timezone = validTimezone(url.searchParams.get("timezone"));
  const isWindsor = distanceKm(latitude, longitude, WINDSOR.latitude, WINDSOR.longitude) <= WINDSOR_RADIUS_KM;

  const prayerTimes = isWindsor
    ? await windsorSchedule(env, year, month)
    : await globalSchedule(env, latitude, longitude, year, month, method, school);

  return json({
    prayer_times: prayerTimes,
    latitude,
    longitude,
    timezone,
    source: isWindsor ? "windsor_islamic_association" : "aladhan",
    sourceLabel: isWindsor ? "Windsor Islamic Association official schedule" : "Calculated for current GPS location",
    location: { label: isWindsor ? "Windsor, Ontario" : "Current location" }
  });
}
