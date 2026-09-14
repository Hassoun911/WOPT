import type { Env, PrayerFile, PrayerKey, PrayerTimes } from "./types";

const WINDSOR_TIME_ZONE = "America/Toronto";
const WINDSOR_LOCATION = "Windsor, Ontario";
const WINDSOR = { latitude: 42.3149, longitude: -83.0364 };
const WINDSOR_RADIUS_KM = 35;
const PRAYERS: PrayerKey[] = ["fajr", "dhuhr", "asr", "maghrib", "isha"];
const NAMES: Record<PrayerKey, string> = { fajr: "Fajr", dhuhr: "Dhuhr", asr: "Asr", maghrib: "Maghrib", isha: "Isha" };
const ISLAMIC_EVENTS = [
  { id: "new-year", month: 1, day: 1, name: "Islamic New Year" },
  { id: "ashura", month: 1, day: 10, name: "Day of Ashura" },
  { id: "mawlid", month: 3, day: 12, name: "12 Rabi al-Awwal" },
  { id: "isra-miraj", month: 7, day: 27, name: "Isra and Mi'raj" },
  { id: "mid-shaban", month: 8, day: 15, name: "Mid-Sha'ban" },
  { id: "ramadan", month: 9, day: 1, name: "Ramadan Begins" },
  { id: "laylat-qadr", month: 9, day: 27, name: "Laylat al-Qadr, 27th night" },
  { id: "eid-fitr", month: 10, day: 1, name: "Eid al-Fitr" },
  { id: "hajj-begins", month: 12, day: 8, name: "Hajj Days Begin" },
  { id: "arafah", month: 12, day: 9, name: "Day of Arafah" },
  { id: "eid-adha", month: 12, day: 10, name: "Eid al-Adha" }
] as const;

const HIJRI_EPOCH = 1948439.5;
const HIJRI_DAY_OFFSET = 1;
let windsorScheduleCache: { expiresAt: number; data: PrayerFile } | null = null;

type LocationProfile = {
  latitude: number;
  longitude: number;
  timezone: string;
  location: string;
  calculationMethod: number;
  madhab: "standard" | "hanafi";
  isWindsor: boolean;
};
type CachedPrayerDay = { location_key: string; prayer_date: string; fajr: string; dhuhr: string; asr: string; maghrib: string; isha: string; source?: string };
type AlAdhanDay = { timings?: Record<string, string>; date?: { gregorian?: { date?: string } } };
type AlAdhanResponse = { code?: number; data?: AlAdhanDay[] };

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=30" } });
}
function pad(value: number) { return String(value).padStart(2, "0"); }
function dateKeyUtc(date: Date) { return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`; }
function addDateKey(dateKey: string, days: number) { const date = new Date(`${dateKey}T12:00:00Z`); date.setUTCDate(date.getUTCDate() + days); return dateKeyUtc(date); }
function daysBetween(from: string, to: string) { return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000); }
function radians(value: number) { return value * Math.PI / 180; }
function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const dLat = radians(lat2 - lat1); const dLon = radians(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(radians(lat1)) * Math.cos(radians(lat2)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
function validTimezone(value: string) { try { new Intl.DateTimeFormat("en-CA", { timeZone: value }).format(new Date()); return true; } catch { return false; } }
function numberParam(url: URL, key: string) { const value = Number(url.searchParams.get(key)); return Number.isFinite(value) ? value : null; }

function profileFromRequest(url: URL): LocationProfile {
  const latitude = numberParam(url, "latitude");
  const longitude = numberParam(url, "longitude");
  const hasCoordinates = latitude != null && longitude != null && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180;
  const lat = hasCoordinates ? latitude! : WINDSOR.latitude;
  const lon = hasCoordinates ? longitude! : WINDSOR.longitude;
  const requestedTimezone = (url.searchParams.get("timezone") || "").trim();
  const timezone = requestedTimezone && validTimezone(requestedTimezone) ? requestedTimezone : WINDSOR_TIME_ZONE;
  const isWindsor = distanceKm(lat, lon, WINDSOR.latitude, WINDSOR.longitude) <= WINDSOR_RADIUS_KM;
  const requestedLocation = (url.searchParams.get("location") || "").trim();
  const location = requestedLocation || (isWindsor ? WINDSOR_LOCATION : `${lat.toFixed(3)}, ${lon.toFixed(3)}`);
  const rawMethod = Number(url.searchParams.get("method"));
  const calculationMethod = Number.isInteger(rawMethod) && rawMethod >= 0 && rawMethod <= 99 ? rawMethod : 3;
  const school = (url.searchParams.get("school") || url.searchParams.get("madhab") || "").toLowerCase();
  const madhab: "standard" | "hanafi" = school === "1" || school === "hanafi" ? "hanafi" : "standard";
  return { latitude: lat, longitude: lon, timezone, location, calculationMethod, madhab, isWindsor };
}

function zonedParts(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value || 0);
  return { year: value("year"), month: value("month"), day: value("day"), hour: value("hour"), minute: value("minute"), second: value("second") };
}
function dateKeyInZone(date: Date, timezone: string) { const p = zonedParts(date, timezone); return `${p.year}-${pad(p.month)}-${pad(p.day)}`; }
function minuteOfDayInZone(date: Date, timezone: string) { const p = zonedParts(date, timezone); return p.hour * 60 + p.minute + p.second / 60; }
function parseClock(value: unknown) { const match = String(value || "").match(/^(\d{1,2}):(\d{2})/); if (!match) return null; const h = Number(match[1]); const m = Number(match[2]); if (h > 23 || m > 59) return null; return h * 60 + m; }
function normalizeClock(value: unknown) { const minutes = parseClock(value); return minutes == null ? null : `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`; }
function formatClock(value: string) { const minutes = parseClock(value); if (minutes == null) return value; const h24 = Math.floor(minutes / 60); const mins = minutes % 60; const suffix = h24 >= 12 ? "PM" : "AM"; const h12 = h24 % 12 || 12; return `${h12}:${pad(mins)} ${suffix}`; }
function humanDelta(totalMinutes: number) { const minutes = Math.max(0, Math.round(totalMinutes)); const hours = Math.floor(minutes / 60); const rest = minutes % 60; if (!hours) return `${rest} minute${rest === 1 ? "" : "s"}`; if (!rest) return `${hours} hour${hours === 1 ? "" : "s"}`; return `${hours} hour${hours === 1 ? "" : "s"} and ${rest} minute${rest === 1 ? "" : "s"}`; }
function gregorianDateKey(value: unknown) { if (typeof value !== "string") return null; const m = value.match(/^(\d{2})-(\d{2})-(\d{4})$/); return m ? `${m[3]}-${m[2]}-${m[1]}` : null; }

function gregorianToJulianDay(year: number, month: number, day: number) { let y = year; let m = month; if (m <= 2) { y -= 1; m += 12; } const a = Math.floor(y / 100); const b = 2 - a + Math.floor(a / 4); return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + day + b - 1524.5; }
function islamicToJulianDay(year: number, month: number, day: number) { return day + Math.ceil(29.5 * (month - 1)) + (year - 1) * 354 + Math.floor((3 + 11 * year) / 30) + HIJRI_EPOCH - 1; }
function hijriPartsFromGregorian(year: number, month: number, day: number) { const jd = Math.floor(gregorianToJulianDay(year, month, day) + HIJRI_DAY_OFFSET) + 0.5; const hijriYear = Math.floor((30 * (jd - HIJRI_EPOCH) + 10646) / 10631); const hijriMonth = Math.min(12, Math.max(1, Math.ceil((jd - (29 + islamicToJulianDay(hijriYear, 1, 1))) / 29.5) + 1)); const hijriDay = Math.max(1, Math.floor(jd - islamicToJulianDay(hijriYear, hijriMonth, 1) + 1)); return { year: hijriYear, month: hijriMonth, day: hijriDay }; }
const HIJRI_MONTHS = ["Muharram", "Safar", "Rabi al-Awwal", "Rabi al-Thani", "Jumada al-Awwal", "Jumada al-Thani", "Rajab", "Sha'ban", "Ramadan", "Shawwal", "Dhu al-Qi'dah", "Dhu al-Hijjah"];
function hijriForKey(dateKey: string) { const [y, m, d] = dateKey.split("-").map(Number); return hijriPartsFromGregorian(y, m, d); }
function hijriLabel(dateKey: string) { const h = hijriForKey(dateKey); return `${HIJRI_MONTHS[h.month - 1]} ${h.day}, ${h.year} AH`; }
function nextIslamicEvent(todayKey: string) { for (let offset = 0; offset <= 370; offset += 1) { const key = addDateKey(todayKey, offset); const h = hijriForKey(key); const event = ISLAMIC_EVENTS.find((item) => item.month === h.month && item.day === h.day); if (event) return { ...event, dateKey: key, hijriYear: h.year, daysUntil: daysBetween(todayKey, key) }; } return null; }

async function loadWindsorSchedule(env: Env) {
  if (windsorScheduleCache && windsorScheduleCache.expiresAt > Date.now()) return windsorScheduleCache.data;
  const response = await fetch(env.SCHEDULE_URL, { headers: { Accept: "application/json" }, cf: { cacheTtl: 300, cacheEverything: true } });
  if (!response.ok) throw new Error(`Windsor schedule fetch failed: ${response.status}`);
  const data = await response.json() as PrayerFile;
  if (!data.prayer_times) throw new Error("Windsor schedule is missing prayer_times");
  windsorScheduleCache = { expiresAt: Date.now() + 300_000, data };
  return data;
}

function locationKey(profile: LocationProfile) { return [profile.latitude.toFixed(4), profile.longitude.toFixed(4), profile.timezone, profile.calculationMethod, profile.madhab].join("|"); }
async function cachedDay(env: Env, profile: LocationProfile, dateKey: string) {
  return env.DB.prepare("SELECT location_key, prayer_date, fajr, dhuhr, asr, maghrib, isha, source FROM location_prayer_cache WHERE location_key=? AND prayer_date=? LIMIT 1").bind(locationKey(profile), dateKey).first<CachedPrayerDay>();
}
async function fetchGlobalMonth(env: Env, profile: LocationProfile, dateKey: string) {
  const [yearText, monthText] = dateKey.split("-"); const year = Number(yearText); const month = Number(monthText);
  if (!year || !month) throw new Error(`Invalid date key ${dateKey}`);
  const apiBase = (env.GLOBAL_PRAYER_API_BASE || "https://api.aladhan.com/v1").replace(/\/$/, "");
  const url = new URL(`${apiBase}/calendar/${year}/${month}`);
  url.searchParams.set("latitude", String(profile.latitude)); url.searchParams.set("longitude", String(profile.longitude)); url.searchParams.set("method", String(profile.calculationMethod)); url.searchParams.set("school", profile.madhab === "hanafi" ? "1" : "0");
  const response = await fetch(url.toString(), { headers: { Accept: "application/json" }, cf: { cacheEverything: true, cacheTtl: 21_600 } });
  if (!response.ok) throw new Error(`Global prayer API failed: ${response.status}`);
  const payload = await response.json() as AlAdhanResponse;
  if (payload.code !== 200 || !Array.isArray(payload.data)) throw new Error("Global prayer API returned an invalid calendar");
  const key = locationKey(profile); const statements: D1PreparedStatement[] = [];
  for (const day of payload.data) {
    const prayerDate = gregorianDateKey(day.date?.gregorian?.date); const fajr = normalizeClock(day.timings?.Fajr); const dhuhr = normalizeClock(day.timings?.Dhuhr); const asr = normalizeClock(day.timings?.Asr); const maghrib = normalizeClock(day.timings?.Maghrib); const isha = normalizeClock(day.timings?.Isha);
    if (!prayerDate || !fajr || !dhuhr || !asr || !maghrib || !isha) continue;
    statements.push(env.DB.prepare(`INSERT INTO location_prayer_cache (location_key, prayer_date, latitude, longitude, timezone, country_code, country_name, region, city, calculation_method, madhab, fajr, dhuhr, asr, maghrib, isha, source) VALUES (?, ?, ?, ?, ?, NULL, NULL, NULL, ?, ?, ?, ?, ?, ?, ?, ?, 'aladhan') ON CONFLICT(location_key, prayer_date) DO UPDATE SET latitude=excluded.latitude,longitude=excluded.longitude,timezone=excluded.timezone,city=excluded.city,calculation_method=excluded.calculation_method,madhab=excluded.madhab,fajr=excluded.fajr,dhuhr=excluded.dhuhr,asr=excluded.asr,maghrib=excluded.maghrib,isha=excluded.isha,source=excluded.source,fetched_at=CURRENT_TIMESTAMP`).bind(key, prayerDate, profile.latitude, profile.longitude, profile.timezone, profile.location, profile.calculationMethod, profile.madhab, fajr, dhuhr, asr, maghrib, isha));
  }
  for (let index = 0; index < statements.length; index += 80) await env.DB.batch(statements.slice(index, index + 80));
}
async function globalDay(env: Env, profile: LocationProfile, dateKey: string) {
  let day = await cachedDay(env, profile, dateKey);
  if (day) return day;
  await fetchGlobalMonth(env, profile, dateKey);
  day = await cachedDay(env, profile, dateKey);
  if (!day) throw new Error(`Global prayer calendar missing ${dateKey}`);
  return day;
}
async function resolvedDay(env: Env, profile: LocationProfile, dateKey: string): Promise<{ day: CachedPrayerDay; source: string }> {
  if (profile.isWindsor) {
    try {
      const schedule = await loadWindsorSchedule(env);
      const row = schedule.prayer_times[dateKey];
      const fajr = normalizeClock(row?.fajr); const dhuhr = normalizeClock(row?.dhuhr); const asr = normalizeClock(row?.asr); const maghrib = normalizeClock(row?.maghrib); const isha = normalizeClock(row?.isha);
      if (fajr && dhuhr && asr && maghrib && isha) return { day: { location_key: "windsor-official", prayer_date: dateKey, fajr, dhuhr, asr, maghrib, isha, source: "windsor-official" }, source: "Hassoun approved Windsor mosque schedule" };
    } catch (error) { console.warn("Windsor official schedule unavailable; using global fallback", error); }
  }
  const day = await globalDay(env, profile, dateKey);
  return { day, source: profile.isWindsor ? "Location-based calculated fallback" : "Location-based prayer calculation" };
}

function normalizePrayer(value: string | null): PrayerKey | null { const key = (value || "").trim().toLowerCase().replace(/[^a-z]/g, ""); if (key === "fajr" || key === "dhuhr" || key === "asr" || key === "maghrib" || key === "isha") return key; if (key === "zuhr" || key === "dhur" || key === "zuhur") return "dhuhr"; return null; }
function occurrence(schedule: PrayerFile, prayer: PrayerKey, todayKey: string, nowMinutes: number) { for (let offset = 0; offset <= 7; offset += 1) { const dateKey = addDateKey(todayKey, offset); const day = schedule.prayer_times[dateKey]; if (!day) continue; const raw = day[prayer]; const target = parseClock(raw); if (target == null) continue; const delta = offset * 1440 + target - nowMinutes; if (delta > 0) return { prayer, name: NAMES[prayer], dateKey, time: raw, displayTime: formatClock(raw), minutesUntil: Math.ceil(delta), timeUntil: humanDelta(delta), isTomorrow: offset > 0 }; } return null; }

export async function getAlexaContext(request: Request, env: Env) {
  if (request.method !== "GET") return json({ error: "Method not allowed" }, 405);
  const url = new URL(request.url);
  const profile = profileFromRequest(url);
  const now = new Date();
  const todayKey = dateKeyInZone(now, profile.timezone);
  const nowMinutes = minuteOfDayInZone(now, profile.timezone);
  const prayerTimes: PrayerTimes = {};
  let todaySource = "";
  try {
    for (let offset = 0; offset <= 7; offset += 1) {
      const dateKey = addDateKey(todayKey, offset);
      const resolved = await resolvedDay(env, profile, dateKey);
      prayerTimes[dateKey] = { fajr: resolved.day.fajr, dhuhr: resolved.day.dhuhr, asr: resolved.day.asr, maghrib: resolved.day.maghrib, isha: resolved.day.isha };
      if (offset === 0) todaySource = resolved.source;
    }
  } catch (error) {
    console.error("Prayer context resolution failed", { location: profile.location, error });
    return json({ error: "Prayer schedule is unavailable for this location right now", location: profile.location }, 503);
  }
  const schedule: PrayerFile = { prayer_times: prayerTimes };
  const today = prayerTimes[todayKey];
  if (!today) return json({ error: "Prayer schedule is unavailable for today", location: profile.location }, 503);
  let nextPrayer = null as ReturnType<typeof occurrence>;
  for (const prayer of PRAYERS) { const candidate = occurrence(schedule, prayer, todayKey, nowMinutes); if (candidate && (!nextPrayer || candidate.minutesUntil < nextPrayer.minutesUntil)) nextPrayer = candidate; }
  const requestedKey = normalizePrayer(url.searchParams.get("prayer"));
  const requestedPrayer = requestedKey ? occurrence(schedule, requestedKey, todayKey, nowMinutes) : null;
  const prayers = Object.fromEntries(PRAYERS.map((prayer) => [prayer, { name: NAMES[prayer], time: today[prayer], displayTime: formatClock(today[prayer]) }]));
  const event = nextIslamicEvent(todayKey);
  return json({
    ok: true,
    source: todaySource,
    sourceMode: profile.isWindsor && todaySource.includes("approved") ? "local-approved" : "global-calculated",
    location: profile.location,
    latitude: profile.latitude,
    longitude: profile.longitude,
    timezone: profile.timezone,
    calculationMethod: profile.calculationMethod,
    madhab: profile.madhab,
    now: now.toISOString(),
    dateKey: todayKey,
    hijriDate: hijriLabel(todayKey),
    prayers,
    nextPrayer,
    requestedPrayer,
    nextIslamicEvent: event ? { id: event.id, name: event.name, dateKey: event.dateKey, daysUntil: event.daysUntil, hijriDate: hijriLabel(event.dateKey) } : null
  });
}
