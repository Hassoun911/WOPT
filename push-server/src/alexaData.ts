import type { Env, PrayerFile, PrayerKey } from "./types";

const TIME_ZONE = "America/Toronto";
const LOCATION = "Windsor, Ontario";
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
let scheduleCache: { expiresAt: number; data: PrayerFile } | null = null;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=30" } });
}

function pad(value: number) { return String(value).padStart(2, "0"); }
function dateKeyUtc(date: Date) { return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`; }
function addDateKey(dateKey: string, days: number) { const date = new Date(`${dateKey}T12:00:00Z`); date.setUTCDate(date.getUTCDate() + days); return dateKeyUtc(date); }
function daysBetween(from: string, to: string) { return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000); }

function zonedParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value || 0);
  return { year: value("year"), month: value("month"), day: value("day"), hour: value("hour"), minute: value("minute"), second: value("second") };
}

function dateKeyInZone(date: Date) { const p = zonedParts(date); return `${p.year}-${pad(p.month)}-${pad(p.day)}`; }
function minuteOfDayInZone(date: Date) { const p = zonedParts(date); return p.hour * 60 + p.minute + p.second / 60; }
function parseClock(value: string) { const match = String(value || "").match(/^(\d{1,2}):(\d{2})$/); if (!match) return null; return Number(match[1]) * 60 + Number(match[2]); }
function formatClock(value: string) { const minutes = parseClock(value); if (minutes == null) return value; const h24 = Math.floor(minutes / 60); const mins = minutes % 60; const suffix = h24 >= 12 ? "PM" : "AM"; const h12 = h24 % 12 || 12; return `${h12}:${pad(mins)} ${suffix}`; }
function humanDelta(totalMinutes: number) { const minutes = Math.max(0, Math.round(totalMinutes)); const hours = Math.floor(minutes / 60); const rest = minutes % 60; if (!hours) return `${rest} minute${rest === 1 ? "" : "s"}`; if (!rest) return `${hours} hour${hours === 1 ? "" : "s"}`; return `${hours} hour${hours === 1 ? "" : "s"} and ${rest} minute${rest === 1 ? "" : "s"}`; }

function gregorianToJulianDay(year: number, month: number, day: number) {
  let y = year; let m = month; if (m <= 2) { y -= 1; m += 12; }
  const a = Math.floor(y / 100); const b = 2 - a + Math.floor(a / 4);
  return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + day + b - 1524.5;
}
function islamicToJulianDay(year: number, month: number, day: number) { return day + Math.ceil(29.5 * (month - 1)) + (year - 1) * 354 + Math.floor((3 + 11 * year) / 30) + HIJRI_EPOCH - 1; }
function hijriPartsFromGregorian(year: number, month: number, day: number) {
  const jd = Math.floor(gregorianToJulianDay(year, month, day) + HIJRI_DAY_OFFSET) + 0.5;
  const hijriYear = Math.floor((30 * (jd - HIJRI_EPOCH) + 10646) / 10631);
  const hijriMonth = Math.min(12, Math.max(1, Math.ceil((jd - (29 + islamicToJulianDay(hijriYear, 1, 1))) / 29.5) + 1));
  const hijriDay = Math.max(1, Math.floor(jd - islamicToJulianDay(hijriYear, hijriMonth, 1) + 1));
  return { year: hijriYear, month: hijriMonth, day: hijriDay };
}
const HIJRI_MONTHS = ["Muharram", "Safar", "Rabi al-Awwal", "Rabi al-Thani", "Jumada al-Awwal", "Jumada al-Thani", "Rajab", "Sha'ban", "Ramadan", "Shawwal", "Dhu al-Qi'dah", "Dhu al-Hijjah"];
function hijriForKey(dateKey: string) { const [y, m, d] = dateKey.split("-").map(Number); return hijriPartsFromGregorian(y, m, d); }
function hijriLabel(dateKey: string) { const h = hijriForKey(dateKey); return `${HIJRI_MONTHS[h.month - 1]} ${h.day}, ${h.year} AH`; }
function nextIslamicEvent(todayKey: string) {
  for (let offset = 0; offset <= 370; offset += 1) {
    const key = addDateKey(todayKey, offset); const h = hijriForKey(key);
    const event = ISLAMIC_EVENTS.find((item) => item.month === h.month && item.day === h.day);
    if (event) return { ...event, dateKey: key, hijriYear: h.year, daysUntil: daysBetween(todayKey, key) };
  }
  return null;
}

async function loadSchedule(env: Env) {
  if (scheduleCache && scheduleCache.expiresAt > Date.now()) return scheduleCache.data;
  const response = await fetch(env.SCHEDULE_URL, { cf: { cacheTtl: 300, cacheEverything: true } });
  if (!response.ok) throw new Error(`Schedule fetch failed: ${response.status}`);
  const data = await response.json() as PrayerFile;
  if (!data.prayer_times) throw new Error("Schedule is missing prayer_times");
  scheduleCache = { expiresAt: Date.now() + 300_000, data };
  return data;
}

function normalizePrayer(value: string | null): PrayerKey | null {
  const key = (value || "").trim().toLowerCase().replace(/[^a-z]/g, "");
  if (key === "fajr" || key === "dhuhr" || key === "asr" || key === "maghrib" || key === "isha") return key;
  if (key === "zuhr" || key === "dhur" || key === "zuhur") return "dhuhr";
  return null;
}

function occurrence(schedule: PrayerFile, prayer: PrayerKey, todayKey: string, nowMinutes: number) {
  for (let offset = 0; offset <= 7; offset += 1) {
    const dateKey = addDateKey(todayKey, offset); const day = schedule.prayer_times[dateKey]; if (!day) continue;
    const raw = day[prayer]; const target = parseClock(raw); if (target == null) continue;
    const delta = offset * 1440 + target - nowMinutes;
    if (delta > 0) return { prayer, name: NAMES[prayer], dateKey, time: raw, displayTime: formatClock(raw), minutesUntil: Math.ceil(delta), timeUntil: humanDelta(delta), isTomorrow: offset > 0 };
  }
  return null;
}

export async function getAlexaContext(request: Request, env: Env) {
  if (request.method !== "GET") return json({ error: "Method not allowed" }, 405);
  const url = new URL(request.url);
  const schedule = await loadSchedule(env);
  const now = new Date();
  const todayKey = dateKeyInZone(now);
  const nowMinutes = minuteOfDayInZone(now);
  const today = schedule.prayer_times[todayKey];
  if (!today) return json({ error: "Prayer schedule is unavailable for today" }, 503);

  let nextPrayer = null as ReturnType<typeof occurrence>;
  for (const prayer of PRAYERS) {
    const candidate = occurrence(schedule, prayer, todayKey, nowMinutes);
    if (candidate && (!nextPrayer || candidate.minutesUntil < nextPrayer.minutesUntil)) nextPrayer = candidate;
  }

  const requestedKey = normalizePrayer(url.searchParams.get("prayer"));
  const requestedPrayer = requestedKey ? occurrence(schedule, requestedKey, todayKey, nowMinutes) : null;
  const prayers = Object.fromEntries(PRAYERS.map((prayer) => [prayer, { name: NAMES[prayer], time: today[prayer], displayTime: formatClock(today[prayer]) }]));
  const event = nextIslamicEvent(todayKey);

  return json({
    ok: true,
    source: "Hassoun official Windsor schedule",
    location: LOCATION,
    timezone: TIME_ZONE,
    now: now.toISOString(),
    dateKey: todayKey,
    hijriDate: hijriLabel(todayKey),
    prayers,
    nextPrayer,
    requestedPrayer,
    nextIslamicEvent: event ? { id: event.id, name: event.name, dateKey: event.dateKey, daysUntil: event.daysUntil, hijriDate: hijriLabel(event.dateKey) } : null
  });
}
