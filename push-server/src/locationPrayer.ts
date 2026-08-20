import type { Env, PrayerDay, PrayerFile, PrayerTimes } from "./types";

const WINDSOR = { latitude: 42.3149, longitude: -83.0364 };
const WINDSOR_RADIUS_KM = 45;

type AlAdhanDay = { timings?: Record<string, string>; date?: { gregorian?: { date?: string } } };
type AlAdhanResponse = { code?: number; data?: AlAdhanDay[] };

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=300" } });
}

function radians(value: number) { return value * Math.PI / 180; }
function distanceKm(aLat: number, aLng: number, bLat: number, bLng: number) {
  const earth = 6371;
  const dLat = radians(bLat - aLat);
  const dLng = radians(bLng - aLng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(radians(aLat)) * Math.cos(radians(bLat)) * Math.sin(dLng / 2) ** 2;
  return earth * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function validCoordinate(value: string | null, min: number, max: number) {
  if (value === null || value.trim() === "") return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= min && number <= max ? number : null;
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

function dateKey(value: unknown) {
  if (typeof value !== "string") return null;
  const match = value.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  return match ? `${match[3]}-${match[2]}-${match[1]}` : null;
}

function monthFilter(times: PrayerTimes, year: number, month: number) {
  const prefix = `${year}-${String(month).padStart(2, "0")}-`;
  return Object.fromEntries(Object.entries(times).filter(([key]) => key.startsWith(prefix))) as PrayerTimes;
}

async function windsorMonth(env: Env, year: number, month: number) {
  const response = await fetch(env.SCHEDULE_URL, { cf: { cacheTtl: 300, cacheEverything: true } });
  if (!response.ok) throw new Error(`Windsor schedule fetch failed: ${response.status}`);
  const data = await response.json() as PrayerFile;
  if (!data.prayer_times) throw new Error("Windsor schedule is invalid");
  return monthFilter(data.prayer_times, year, month);
}

async function globalMonth(env: Env, latitude: number, longitude: number, year: number, month: number, method: number, school: number) {
  const apiBase = (env.GLOBAL_PRAYER_API_BASE || "https://api.aladhan.com/v1").replace(/\/$/, "");
  const url = new URL(`${apiBase}/calendar/${year}/${month}`);
  url.searchParams.set("latitude", String(latitude));
  url.searchParams.set("longitude", String(longitude));
  url.searchParams.set("method", String(method));
  url.searchParams.set("school", String(school));
  const response = await fetch(url.toString(), { headers: { Accept: "application/json" }, cf: { cacheEverything: true, cacheTtl: 21_600 } });
  if (!response.ok) throw new Error(`Global prayer API failed: ${response.status}`);
  const payload = await response.json() as AlAdhanResponse;
  if (payload.code !== 200 || !Array.isArray(payload.data)) throw new Error("Global prayer API returned an invalid calendar");
  const prayerTimes: PrayerTimes = {};
  for (const day of payload.data) {
    const key = dateKey(day.date?.gregorian?.date);
    const fajr = parseTiming(day.timings?.Fajr);
    const dhuhr = parseTiming(day.timings?.Dhuhr);
    const asr = parseTiming(day.timings?.Asr);
    const maghrib = parseTiming(day.timings?.Maghrib);
    const isha = parseTiming(day.timings?.Isha);
    if (!key || !fajr || !dhuhr || !asr || !maghrib || !isha) continue;
    prayerTimes[key] = { fajr, dhuhr, asr, maghrib, isha } satisfies PrayerDay;
  }
  return prayerTimes;
}

export async function getLocationPrayerTimes(url: URL, env: Env) {
  const latitude = validCoordinate(url.searchParams.get("lat"), -90, 90);
  const longitude = validCoordinate(url.searchParams.get("lng"), -180, 180);
  if (latitude === null || longitude === null) return json({ error: "Valid lat and lng are required" }, 400);

  const now = new Date();
  const requestedYear = Number(url.searchParams.get("year") || now.getUTCFullYear());
  const requestedMonth = Number(url.searchParams.get("month") || now.getUTCMonth() + 1);
  const year = Number.isInteger(requestedYear) && requestedYear >= 2025 && requestedYear <= 2035 ? requestedYear : now.getUTCFullYear();
  const month = Number.isInteger(requestedMonth) && requestedMonth >= 1 && requestedMonth <= 12 ? requestedMonth : now.getUTCMonth() + 1;
  const methodValue = Number(url.searchParams.get("method") || 3);
  const method = Number.isInteger(methodValue) && methodValue >= 0 && methodValue <= 99 ? methodValue : 3;
  const school = url.searchParams.get("school") === "1" ? 1 : 0;
  const isWindsor = distanceKm(latitude, longitude, WINDSOR.latitude, WINDSOR.longitude) <= WINDSOR_RADIUS_KM;
  const prayerTimes = isWindsor
    ? await windsorMonth(env, year, month)
    : await globalMonth(env, latitude, longitude, year, month, method, school);

  return json({
    prayer_times: prayerTimes,
    source: isWindsor ? "windsor_islamic_association" : "aladhan",
    sourceLabel: isWindsor ? "Windsor Islamic Association" : "Calculated for current GPS location",
    location: isWindsor ? { city: "Windsor", region: "Ontario", country: "Canada", label: "Windsor, Ontario" } : { label: "Current location", latitude, longitude },
    latitude,
    longitude,
    year,
    month
  });
}
