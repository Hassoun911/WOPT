import { upcomingIslamicEvent } from "./islamicEvents";
import { subscriberManageUrl } from "./subscribers";
import type { Env, Locale, PrayerKey } from "./types";

const PRAYERS: PrayerKey[] = ["fajr", "dhuhr", "asr", "maghrib", "isha"];
const OFFSETS = [
  { kind: "twenty" as const, minutes: -20, field: "email_twenty" as const },
  { kind: "ten" as const, minutes: -10, field: "email_ten" as const },
  { kind: "athan" as const, minutes: 0, field: "email_athan" as const }
];
type AlertKind = (typeof OFFSETS)[number]["kind"];

type SubscriberPreferenceRow = {
  id: number; public_id: string; email: string; locale: Locale; latitude: number; longitude: number; timezone: string;
  country_code: string | null; country_name: string | null; region: string | null; city: string | null;
  calculation_method: number | null; madhab: "standard" | "hanafi"; prayer: PrayerKey;
  email_twenty: number; email_ten: number; email_athan: number;
};
type Subscriber = Omit<SubscriberPreferenceRow, "prayer" | "email_twenty" | "email_ten" | "email_athan"> & {
  preferences: Partial<Record<PrayerKey, Pick<SubscriberPreferenceRow, "email_twenty" | "email_ten" | "email_athan">>>;
};
type CachedPrayerDay = { location_key: string; prayer_date: string; fajr: string; dhuhr: string; asr: string; maghrib: string; isha: string };
type AlAdhanDay = { timings?: Record<string, string>; date?: { gregorian?: { date?: string } } };
type AlAdhanResponse = { code?: number; data?: AlAdhanDay[] };

function methodFor(subscriber: Subscriber) { return subscriber.calculation_method ?? 3; }
function locationKey(subscriber: Subscriber) {
  return [subscriber.latitude.toFixed(4), subscriber.longitude.toFixed(4), subscriber.timezone, methodFor(subscriber), subscriber.madhab].join("|");
}
function parseTiming(value: unknown) {
  if (typeof value !== "string") return null;
  const match = value.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;
  const hour = Number(match[1]); const minute = Number(match[2]);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}
function gregorianDateKey(value: unknown) {
  if (typeof value !== "string") return null;
  const match = value.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  return match ? `${match[3]}-${match[2]}-${match[1]}` : null;
}
function partsInZone(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).formatToParts(date);
  const read = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value ?? 0);
  return { year: read("year"), month: read("month"), day: read("day"), hour: read("hour"), minute: read("minute"), second: read("second") };
}
function localDateKey(date: Date, timezone: string) {
  const parts = partsInZone(date, timezone);
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}
function addDays(dateKey: string, days: number) {
  const date = new Date(`${dateKey}T12:00:00Z`); date.setUTCDate(date.getUTCDate() + days); return date.toISOString().slice(0, 10);
}
function zonedLocalToInstant(dateKey: string, time: string, timezone: string) {
  const [year = 0, month = 1, day = 1] = dateKey.split("-").map(Number);
  const [hour = 0, minute = 0] = time.split(":").map(Number);
  const desiredAsUtc = Date.UTC(year, month - 1, day, hour, minute, 0);
  let instantMs = desiredAsUtc;
  for (let pass = 0; pass < 3; pass += 1) {
    const actual = partsInZone(new Date(instantMs), timezone);
    const displayedAsUtc = Date.UTC(actual.year, actual.month - 1, actual.day, actual.hour, actual.minute, actual.second);
    const correction = desiredAsUtc - displayedAsUtc; instantMs += correction; if (Math.abs(correction) < 1_000) break;
  }
  return instantMs;
}
function sameMinute(leftMs: number, rightMs: number) { return Math.floor(leftMs / 60_000) === Math.floor(rightMs / 60_000); }
function prayerLabel(prayer: PrayerKey, locale: Locale) {
  const labels: Record<PrayerKey, { en: string; ar: string }> = {
    fajr: { en: "Fajr", ar: "الفجر" }, dhuhr: { en: "Dhuhr", ar: "الظهر" }, asr: { en: "Asr", ar: "العصر" }, maghrib: { en: "Maghrib", ar: "المغرب" }, isha: { en: "Isha", ar: "العشاء" }
  };
  return labels[prayer][locale];
}
function locationLabel(subscriber: Subscriber) {
  return [subscriber.city, subscriber.region, subscriber.country_name].filter(Boolean).join(", ") || "your location";
}

async function subscribersWithPreferences(env: Env) {
  const { results } = await env.DB.prepare(
    `SELECT s.id, s.public_id, s.email, s.locale, s.latitude, s.longitude, s.timezone,
            s.country_code, s.country_name, s.region, s.city, s.calculation_method, s.madhab,
            p.prayer, p.email_twenty, p.email_ten, p.email_athan
     FROM email_subscribers s
     JOIN subscriber_email_preferences g ON g.subscriber_id = s.id AND g.prayer_alerts = 1
     JOIN subscriber_prayer_preferences p ON p.subscriber_id = s.id
     WHERE s.status = 'active' ORDER BY s.id LIMIT 2500`
  ).all<SubscriberPreferenceRow>();
  const grouped = new Map<number, Subscriber>();
  for (const row of results) {
    let subscriber = grouped.get(row.id);
    if (!subscriber) {
      subscriber = { id: row.id, public_id: row.public_id, email: row.email, locale: row.locale, latitude: row.latitude, longitude: row.longitude, timezone: row.timezone, country_code: row.country_code, country_name: row.country_name, region: row.region, city: row.city, calculation_method: row.calculation_method, madhab: row.madhab, preferences: {} };
      grouped.set(row.id, subscriber);
    }
    subscriber.preferences[row.prayer] = { email_twenty: row.email_twenty, email_ten: row.email_ten, email_athan: row.email_athan };
  }
  return [...grouped.values()];
}

async function cachedDay(env: Env, subscriber: Subscriber, dateKey: string) {
  return env.DB.prepare(`SELECT location_key, prayer_date, fajr, dhuhr, asr, maghrib, isha FROM location_prayer_cache WHERE location_key = ? AND prayer_date = ? LIMIT 1`).bind(locationKey(subscriber), dateKey).first<CachedPrayerDay>();
}

async function fetchPrayerMonth(env: Env, subscriber: Subscriber, dateKey: string) {
  const [yearText, monthText] = dateKey.split("-"); const year = Number(yearText); const month = Number(monthText);
  if (!year || !month) throw new Error(`Invalid date key ${dateKey}`);
  const apiBase = (env.GLOBAL_PRAYER_API_BASE || "https://api.aladhan.com/v1").replace(/\/$/, "");
  const url = new URL(`${apiBase}/calendar/${year}/${month}`);
  url.searchParams.set("latitude", String(subscriber.latitude)); url.searchParams.set("longitude", String(subscriber.longitude)); url.searchParams.set("method", String(methodFor(subscriber))); url.searchParams.set("school", subscriber.madhab === "hanafi" ? "1" : "0");
  const response = await fetch(url.toString(), { headers: { Accept: "application/json" }, cf: { cacheEverything: true, cacheTtl: 21_600 } });
  if (!response.ok) throw new Error(`Global prayer API failed: ${response.status}`);
  const payload = await response.json() as AlAdhanResponse;
  if (payload.code !== 200 || !Array.isArray(payload.data)) throw new Error("Global prayer API returned an invalid calendar");
  const key = locationKey(subscriber); const statements: D1PreparedStatement[] = [];
  for (const day of payload.data) {
    const prayerDate = gregorianDateKey(day.date?.gregorian?.date); const fajr = parseTiming(day.timings?.Fajr); const dhuhr = parseTiming(day.timings?.Dhuhr); const asr = parseTiming(day.timings?.Asr); const maghrib = parseTiming(day.timings?.Maghrib); const isha = parseTiming(day.timings?.Isha);
    if (!prayerDate || !fajr || !dhuhr || !asr || !maghrib || !isha) continue;
    statements.push(env.DB.prepare(
      `INSERT INTO location_prayer_cache (location_key, prayer_date, latitude, longitude, timezone, country_code, country_name, region, city, calculation_method, madhab, fajr, dhuhr, asr, maghrib, isha, source)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'aladhan')
       ON CONFLICT(location_key, prayer_date) DO UPDATE SET latitude=excluded.latitude, longitude=excluded.longitude, timezone=excluded.timezone, country_code=excluded.country_code, country_name=excluded.country_name, region=excluded.region, city=excluded.city, calculation_method=excluded.calculation_method, madhab=excluded.madhab, fajr=excluded.fajr, dhuhr=excluded.dhuhr, asr=excluded.asr, maghrib=excluded.maghrib, isha=excluded.isha, source=excluded.source, fetched_at=CURRENT_TIMESTAMP`
    ).bind(key, prayerDate, subscriber.latitude, subscriber.longitude, subscriber.timezone, subscriber.country_code, subscriber.country_name, subscriber.region, subscriber.city, methodFor(subscriber), subscriber.madhab, fajr, dhuhr, asr, maghrib, isha));
  }
  for (let index = 0; index < statements.length; index += 80) await env.DB.batch(statements.slice(index, index + 80));
}

async function ensureDay(env: Env, subscriber: Subscriber, dateKey: string) {
  let day = await cachedDay(env, subscriber, dateKey); if (day) return day;
  await fetchPrayerMonth(env, subscriber, dateKey); day = await cachedDay(env, subscriber, dateKey);
  if (!day) throw new Error(`Prayer calendar missing ${dateKey} after refresh`); return day;
}

async function claimPrayerEmail(env: Env, subscriber: Subscriber, eventId: string, kind: AlertKind, prayer: PrayerKey, scheduledFor: string) {
  const result = await env.DB.prepare(`INSERT OR IGNORE INTO email_deliveries (event_id, subscriber_id, recipient_email, status, notification_kind, prayer, scheduled_for, template_key) VALUES (?, ?, ?, 'pending', ?, ?, ?, 'prayer_alert')`).bind(eventId, subscriber.id, subscriber.email, kind, prayer, scheduledFor).run();
  if ((result.meta.changes ?? 0) !== 1) return null;
  return env.DB.prepare("SELECT id FROM email_deliveries WHERE event_id = ? AND subscriber_id = ? LIMIT 1").bind(eventId, subscriber.id).first<{ id: number }>();
}

async function queuePrayerEmail(env: Env, subscriber: Subscriber, day: CachedPrayerDay, prayer: PrayerKey, kind: AlertKind, prayerTime: string, targetMs: number) {
  const eventId = `email:${subscriber.id}:${day.prayer_date}:${prayer}:${kind}`;
  const delivery = await claimPrayerEmail(env, subscriber, eventId, kind, prayer, new Date(targetMs).toISOString());
  if (!delivery) return false;
  const manageUrl = await subscriberManageUrl(env, subscriber.public_id, subscriber.email);
  const nextEvent = upcomingIslamicEvent(day.prayer_date);
  const upcomingEvent = nextEvent && nextEvent.daysLeft >= 0 && nextEvent.daysLeft <= 15 ? {
    id: nextEvent.id,
    emoji: nextEvent.emoji,
    dateKey: nextEvent.dateKey,
    daysLeft: nextEvent.daysLeft,
    nameEn: nextEvent.name.en,
    nameAr: nextEvent.name.ar,
    descriptionEn: nextEvent.description.en,
    descriptionAr: nextEvent.description.ar
  } : null;
  const data = {
    eventId, kind, prayer, prayerLabel: prayerLabel(prayer, subscriber.locale), prayerTime,
    prayerDate: day.prayer_date,
    prayerTimes: { fajr: day.fajr, dhuhr: day.dhuhr, asr: day.asr, maghrib: day.maghrib, isha: day.isha },
    locationLabel: locationLabel(subscriber), timezone: subscriber.timezone, manageUrl, upcomingEvent
  };
  await env.DB.prepare(`INSERT OR IGNORE INTO email_outbox (delivery_id, subscriber_id, recipient_email, locale, kind, template_key, template_data_json, idempotency_key) VALUES (?, ?, ?, ?, 'prayer', 'prayer_alert', ?, ?)`).bind(delivery.id, subscriber.id, subscriber.email, subscriber.locale, JSON.stringify(data), eventId).run();
  return true;
}

async function evaluateDay(env: Env, subscriber: Subscriber, day: CachedPrayerDay, scheduledTime: number) {
  let queued = 0;
  for (const prayer of PRAYERS) {
    const prefs = subscriber.preferences[prayer]; if (!prefs) continue;
    const prayerTime = day[prayer]; const prayerInstant = zonedLocalToInstant(day.prayer_date, prayerTime, subscriber.timezone);
    for (const rule of OFFSETS) {
      if (prefs[rule.field] !== 1) continue;
      const targetMs = prayerInstant + rule.minutes * 60_000;
      if (!sameMinute(targetMs, scheduledTime)) continue;
      if (await queuePrayerEmail(env, subscriber, day, prayer, rule.kind, prayerTime, targetMs)) queued += 1;
    }
  }
  return queued;
}

export async function dispatchGlobalPrayerEmails(env: Env, scheduledTime: number) {
  const subscribers = await subscribersWithPreferences(env); let queued = 0;
  for (const subscriber of subscribers) {
    try {
      const now = new Date(scheduledTime); const todayKey = localDateKey(now, subscriber.timezone); const tomorrowKey = addDays(todayKey, 1);
      const [today, tomorrow] = await Promise.all([ensureDay(env, subscriber, todayKey), ensureDay(env, subscriber, tomorrowKey)]);
      queued += await evaluateDay(env, subscriber, today, scheduledTime);
      queued += await evaluateDay(env, subscriber, tomorrow, scheduledTime);
    } catch (error) { console.error("Global prayer email scheduling failed", { subscriberId: subscriber.id, error }); }
  }
  return { subscribers: subscribers.length, queued };
}
