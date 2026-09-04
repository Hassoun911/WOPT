from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]

def read(path): return (ROOT / path).read_text()
def write(path, text):
    p = ROOT / path
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(text)

def replace_once(path, old, new):
    text = read(path)
    if old not in text:
        raise SystemExit(f"Missing expected text in {path}: {old[:100]!r}")
    write(path, text.replace(old, new, 1))

local_prayer = r'''import AsyncStorage from "@react-native-async-storage/async-storage";
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
'''
write("mobile/src/localPrayerTimes.ts", local_prayer)

# Make time helpers timezone-aware while preserving compatibility.
time = read("mobile/src/time.ts")
time = time.replace('function partsInZone(date: Date, timeZone = WINDSOR_TIME_ZONE) {', 'export function partsInZone(date: Date, timeZone = WINDSOR_TIME_ZONE) {')
time = time.replace('export function windsorDateKey(date = new Date()) {\n  const parts = partsInZone(date);', 'export function dateKeyInZone(date = new Date(), timeZone = WINDSOR_TIME_ZONE) {\n  const parts = partsInZone(date, timeZone);')
time = time.replace('export function windsorSecondsSinceMidnight(date = new Date()) {\n  const parts = partsInZone(date);', 'export function windsorDateKey(date = new Date()) { return dateKeyInZone(date, WINDSOR_TIME_ZONE); }\n\nexport function windsorSecondsSinceMidnight(date = new Date()) {\n  const parts = partsInZone(date, WINDSOR_TIME_ZONE);')
time = time.replace('export function windsorLocalToDate(dateKey: string, time: string) {', 'export function localToDateInZone(dateKey: string, time: string, timeZone = WINDSOR_TIME_ZONE) {')
time = time.replace('    const actual = partsInZone(new Date(instantMs));', '    const actual = partsInZone(new Date(instantMs), timeZone);')
time = time.replace('\nexport function formatPrayerTime', '\nexport function windsorLocalToDate(dateKey: string, time: string) { return localToDateInZone(dateKey, time, WINDSOR_TIME_ZONE); }\n\nexport function formatPrayerTime')
write("mobile/src/time.ts", time)

# Events support arbitrary time zones.
events = read("mobile/src/events.ts")
events = events.replace('import { addDateDays, windsorDateKey, windsorLocalToDate } from "./time";', 'import { addDateDays, dateKeyInZone, localToDateInZone } from "./time";')
events = events.replace('export function buildPrayerEvents(prayerTimes: PrayerTimes, days: number, now = new Date()) {', 'export function buildPrayerEvents(prayerTimes: PrayerTimes, days: number, now = new Date(), timeZone = "America/Toronto") {')
events = events.replace('  const today = windsorDateKey(now);', '  const today = dateKeyInZone(now, timeZone);')
events = events.replace('      const prayerDate = windsorLocalToDate(dateKey, prayerTime);', '      const prayerDate = localToDateInZone(dateKey, prayerTime, timeZone);')
write("mobile/src/events.ts", events)

# Native prayer audio receives time zone.
pa = read("mobile/src/prayerAudio.ts")
pa = pa.replace('  suppliedPreferences?: PrayerAlertPreferences\n): Promise<AndroidPrayerAudioResult> {', '  suppliedPreferences?: PrayerAlertPreferences,\n  timeZone = "America/Toronto"\n): Promise<AndroidPrayerAudioResult> {')
pa = pa.replace('  const events = buildPrayerEvents(prayerTimes, 30)', '  const events = buildPrayerEvents(prayerTimes, 30, new Date(), timeZone)')
write("mobile/src/prayerAudio.ts", pa)

# Notification bodies and scheduling use the detected location/timezone.
nt = read("mobile/src/notifications.ts")
nt = nt.replace('  CITY_LABEL,\n', '')
nt = nt.replace('function notificationContent(event: PrayerEvent, locale: "en" | "ar") {', 'function notificationContent(event: PrayerEvent, locale: "en" | "ar", locationLabel = "Windsor, Ontario") {')
nt = nt.replace('${time} • ${CITY_LABEL}', '${time} • ${locationLabel}')
nt = nt.replace('  suppliedPreferences?: PrayerAlertPreferences\n) {', '  suppliedPreferences?: PrayerAlertPreferences,\n  locationLabel = "Windsor, Ontario",\n  timeZone = "America/Toronto"\n) {')
nt = nt.replace('  const events = buildPrayerEvents(prayerTimes, days)', '  const events = buildPrayerEvents(prayerTimes, days, new Date(), timeZone)')
nt = nt.replace('      content: notificationContent(event, locale),', '      content: notificationContent(event, locale, locationLabel),')
nt = nt.replace('  const androidAudio = await scheduleAndroidPrayerAudio(prayerTimes, preferences);', '  const androidAudio = await scheduleAndroidPrayerAudio(prayerTimes, preferences, timeZone);')
nt = nt.replace('  preferences?: PrayerAlertPreferences\n) {\n  return withNotificationScheduleLock(() => schedulePrayerNotificationsUnlocked(prayerTimes, locale, preferences));', '  preferences?: PrayerAlertPreferences,\n  locationLabel = "Windsor, Ontario",\n  timeZone = "America/Toronto"\n) {\n  return withNotificationScheduleLock(() => schedulePrayerNotificationsUnlocked(prayerTimes, locale, preferences, locationLabel, timeZone));')
write("mobile/src/notifications.ts", nt)

# App: keep v1.0.20 UI, replace only location/prayer-data behavior.
app = read("mobile/App.tsx")
app = app.replace('import { useEffect, useMemo, useState } from "react";', 'import { useCallback, useEffect, useMemo, useState } from "react";')
app = app.replace('import { CITY_LABEL, STORAGE_KEYS, WINDSOR_TIME_ZONE } from "./src/config";', 'import { STORAGE_KEYS, WINDSOR_TIME_ZONE } from "./src/config";')
app = app.replace('import { loadPrayerTimes } from "./src/prayerData";', 'import { loadLocationPrayerContext } from "./src/localPrayerTimes";')
app = app.replace('import { addDateDays, formatPrayerTime, windsorDateKey, windsorLocalToDate } from "./src/time";', 'import { addDateDays, dateKeyInZone, formatPrayerTime, localToDateInZone } from "./src/time";')
app = app.replace('function nextPrayerFor(prayerTimes: PrayerTimes, now = new Date()) {\n  const currentKey = windsorDateKey(now);', 'function nextPrayerFor(prayerTimes: PrayerTimes, now = new Date(), timeZone = WINDSOR_TIME_ZONE) {\n  const currentKey = dateKeyInZone(now, timeZone);')
app = app.replace('      const target = windsorLocalToDate(dateKey, day[prayer]);', '      const target = localToDateInZone(dateKey, day[prayer], timeZone);')
app = app.replace('function hijriDateLabel(date: Date, locale: "en" | "ar") {', 'function hijriDateLabel(date: Date, locale: "en" | "ar", timeZone = WINDSOR_TIME_ZONE) {')
app = app.replace('      day: "numeric", month: "long", year: "numeric", timeZone: WINDSOR_TIME_ZONE', '      day: "numeric", month: "long", year: "numeric", timeZone')
app = app.replace('  const [alertPreferencesBusy, setAlertPreferencesBusy] = useState(false);', '  const [alertPreferencesBusy, setAlertPreferencesBusy] = useState(false);\n  const [locationLabel, setLocationLabel] = useState("Windsor, Ontario");\n  const [prayerTimeZone, setPrayerTimeZone] = useState(WINDSOR_TIME_ZONE);\n  const [sourceLabel, setSourceLabel] = useState("Saved official Windsor schedule");')
app = app.replace('  const todayKey = windsorDateKey(now);', '  const todayKey = dateKeyInZone(now, prayerTimeZone);')
app = app.replace('  const next = useMemo(() => nextPrayerFor(prayerTimes, now), [now, prayerTimes]);', '  const next = useMemo(() => nextPrayerFor(prayerTimes, now, prayerTimeZone), [now, prayerTimes, prayerTimeZone]);')
app = app.replace('  const upcomingIslamicDays = islamicTimeline.daysUntilNext;\n\n  useEffect(() => {', '  const upcomingIslamicDays = islamicTimeline.daysUntilNext;\n\n  const refreshPrayerLocation = useCallback(async (force = false) => {\n    const context = await loadLocationPrayerContext(force);\n    setPrayerTimes(context.prayerTimes);\n    setLive(context.live);\n    setLocationLabel(context.locationLabel);\n    setPrayerTimeZone(context.timezone);\n    setSourceLabel(context.sourceLabel);\n    return context;\n  }, []);\n\n  useEffect(() => {')
app = app.replace('        loadPhonePrayerAlertPreferences(),\n        loadPrayerTimes(),\n        loadQuizStats()', '        loadPhonePrayerAlertPreferences(),\n        loadLocationPrayerContext(false),\n        loadQuizStats()')
app = app.replace('      setPrayerTimes(loaded.prayerTimes);\n      setLive(loaded.live);', '      setPrayerTimes(loaded.prayerTimes);\n      setLive(loaded.live);\n      setLocationLabel(loaded.locationLabel);\n      setPrayerTimeZone(loaded.timezone);\n      setSourceLabel(loaded.sourceLabel);')
app = app.replace('        const result = await schedulePrayerNotifications(loaded.prayerTimes, chosenLocale, savedPhoneAlertPreferences);', '        const result = await schedulePrayerNotifications(loaded.prayerTimes, chosenLocale, savedPhoneAlertPreferences, loaded.locationLabel, loaded.timezone);')
app = app.replace('        await scheduleIslamicEventReminders(windsorDateKey(new Date()), chosenLocale).catch(() => undefined);', '        await scheduleIslamicEventReminders(dateKeyInZone(new Date(), loaded.timezone), chosenLocale).catch(() => undefined);')
old_resume = '''      setNow(new Date());\n      void loadQuizStats().then(setQuizStats).catch(() => undefined);\n      if (!alertsEnabled || !Object.keys(prayerTimes).length) return;\n      void schedulePrayerNotifications(prayerTimes, locale, phoneAlertPreferences)\n        .then((result) => setScheduledCount(result.count))\n        .catch(() => undefined);\n      void scheduleIslamicEventReminders(windsorDateKey(new Date()), locale).catch(() => undefined);'''
new_resume = '''      setNow(new Date());\n      void loadQuizStats().then(setQuizStats).catch(() => undefined);\n      void refreshPrayerLocation(true).then((context) => {\n        if (!alertsEnabled) return;\n        return schedulePrayerNotifications(context.prayerTimes, locale, phoneAlertPreferences, context.locationLabel, context.timezone)\n          .then((result) => setScheduledCount(result.count));\n      }).catch(() => undefined);\n      void scheduleIslamicEventReminders(dateKeyInZone(new Date(), prayerTimeZone), locale).catch(() => undefined);'''
if old_resume not in app: raise SystemExit("resume block not found")
app = app.replace(old_resume, new_resume)
app = app.replace('  }, [alertsEnabled, locale, prayerTimes, phoneAlertPreferences]);', '  }, [alertsEnabled, locale, phoneAlertPreferences, prayerTimeZone, refreshPrayerLocation]);')
app = app.replace('schedulePrayerNotifications(prayerTimes, nextLocale, phoneAlertPreferences)', 'schedulePrayerNotifications(prayerTimes, nextLocale, phoneAlertPreferences, locationLabel, prayerTimeZone)')
app = app.replace('schedulePrayerNotifications(prayerTimes, locale, preferences)', 'schedulePrayerNotifications(prayerTimes, locale, preferences, locationLabel, prayerTimeZone)')
app = app.replace('schedulePrayerNotifications(prayerTimes, locale, nextPreferences)', 'schedulePrayerNotifications(prayerTimes, locale, nextPreferences, locationLabel, prayerTimeZone)')
app = app.replace('Loading Windsor prayer times…', 'Loading local prayer times…')
app = app.replace('  const date = windsorLocalToDate(todayKey, "12:00");', '  const date = localToDateInZone(todayKey, "12:00", prayerTimeZone);')
app = app.replace('  const hijriDate = hijriDateLabel(date, locale);', '  const hijriDate = hijriDateLabel(date, locale, prayerTimeZone);')
app = app.replace('<View style={styles.brandText}><Text style={styles.title}>Hassoun</Text><Text style={styles.subtitle}>{locale === "ar" ? "📍 وندسور، أونتاريو • مواقيت الصلاة" : "📍 Windsor, Ontario • Prayer Times"}</Text></View>', '<View style={styles.brandText}><Text style={styles.title}>Hassoun</Text><Text numberOfLines={1} style={styles.subtitle}>📍 {locationLabel} • {locale === "ar" ? "مواقيت الصلاة" : "Prayer Times"}</Text></View>')
old_sync = '<Text style={styles.syncText}>{live ? (locale === "ar" ? "متزامن عبر Hassoun" : "Synced by Hassoun") : (locale === "ar" ? "الجدول الرسمي محفوظ" : "Saved official schedule")}</Text>'
app = app.replace(old_sync, '<Text style={styles.syncText}>{sourceLabel}</Text>')
write("mobile/App.tsx", app)

# App version for the build after the known-good v1.0.20.
config = read("mobile/app.config.ts")
import re
config = re.sub(r'version: process\.env\.EXPO_APP_VERSION \|\| "[^"]+"', 'version: process.env.EXPO_APP_VERSION || "1.0.21"', config)
config = re.sub(r'versionCode: \d+', 'versionCode: 55', config)
write("mobile/app.config.ts", config)

print("Applied Hassoun v1.0.21 live-location patch")
