from pathlib import Path

PRAYER_DATA = r'''import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import bundledSchedule from "../assets/windsor_islamic_association_2026_prayer_times.json";
import { CITY_LABEL, STORAGE_KEYS, WINDSOR_TIME_ZONE } from "./config";
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
};

type CachedLocationPayload = LoadedPrayerTimes & { savedAt: string };
type AlAdhanDay = {
  timings?: Record<string, string>;
  date?: { gregorian?: { date?: string } };
  meta?: { timezone?: string };
};
type AlAdhanResponse = { code?: number; data?: AlAdhanDay[] };

const WINDSOR = { latitude: 42.3149, longitude: -83.0364 };
const WINDSOR_RADIUS_KM = 35;
const GPS_TIMEOUT_MS = 9000;
const API_TIMEOUT_MS = 9000;
const GEOCODE_TIMEOUT_MS = 3500;

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

function smartMethodForLocation(latitude: number, longitude: number) {
  if (latitude >= 16 && latitude <= 33 && longitude >= 34 && longitude <= 56) return 4;
  if (latitude >= 20 && latitude <= 33 && longitude >= 24 && longitude <= 37) return 5;
  if (latitude >= 5 && latitude <= 38 && longitude >= 60 && longitude <= 93) return 1;
  if (latitude >= 15 && latitude <= 72 && longitude >= -170 && longitude <= -50) return 2;
  return 3;
}

function parseTiming(value: unknown) {
  if (typeof value !== "string") return null;
  const match = value.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;
  return `${String(Number(match[1])).padStart(2, "0")}:${match[2]}`;
}

function gregorianKey(value: unknown) {
  if (typeof value !== "string") return null;
  const match = value.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  return match ? `${match[3]}-${match[2]}-${match[1]}` : null;
}

function monthWindow() {
  const now = new Date();
  return [0, 1].map((offset) => {
    const date = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    return { year: date.getFullYear(), month: date.getMonth() + 1 };
  });
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
  if (!await Location.hasServicesEnabledAsync()) throw new Error("LOCATION_SERVICES_DISABLED");
  if (!force) {
    const last = await Location.getLastKnownPositionAsync({ maxAge: 15 * 60 * 1000, requiredAccuracy: 5000 });
    if (last) return last;
  }
  return timeout(
    Location.getCurrentPositionAsync({ accuracy: force ? Location.Accuracy.High : Location.Accuracy.Balanced }),
    GPS_TIMEOUT_MS,
    "LOCATION_FIX_TIMEOUT"
  );
}

async function resolveCity(latitude: number, longitude: number) {
  try {
    const places = await timeout(Location.reverseGeocodeAsync({ latitude, longitude }), GEOCODE_TIMEOUT_MS, "GEOCODE_TIMEOUT");
    const place = places[0];
    const city = place?.city || place?.subregion || place?.district;
    const region = place?.region;
    const country = place?.country;
    if (city && region) return `${city}, ${region}`;
    if (city && country) return `${city}, ${country}`;
    return city || country || `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
  } catch {
    return `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
  }
}

function methodAngles(method: number) {
  const table: Record<number, { fajr: number; isha?: number; ishaMinutes?: number }> = {
    1: { fajr: 18, isha: 18 },
    2: { fajr: 15, isha: 15 },
    3: { fajr: 18, isha: 17 },
    4: { fajr: 18.5, ishaMinutes: 90 },
    5: { fajr: 19.5, isha: 17.5 },
    7: { fajr: 17.7, isha: 14 }
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
  return { decl, solarNoonUtcMinutes: 720 - 4 * longitude - eqtime };
}

function hourAngle(latitude: number, declination: number, altitudeDeg: number) {
  const lat = latitude * Math.PI / 180;
  const altitude = altitudeDeg * Math.PI / 180;
  const cosH = (Math.sin(altitude) - Math.sin(lat) * Math.sin(declination)) / (Math.cos(lat) * Math.cos(declination));
  if (cosH <= -1 || cosH >= 1) return null;
  return Math.acos(cosH) * 180 / Math.PI * 4;
}

function asrMinutesFromNoon(latitude: number, declination: number) {
  const lat = latitude * Math.PI / 180;
  const angle = -Math.atan(1 / (1 + Math.tan(Math.abs(lat - declination)))) * 180 / Math.PI;
  return hourAngle(latitude, declination, angle);
}

function timezoneOffsetMinutes(date: Date, timezone: string) {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23"
    }).formatToParts(date);
    const get = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value || 0);
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

function localPrayerDay(date: Date, latitude: number, longitude: number, timezone: string, method: number): PrayerDay {
  const angles = methodAngles(method);
  const { decl, solarNoonUtcMinutes } = solarInfo(date, longitude);
  const offset = timezoneOffsetMinutes(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 12)), timezone);
  const noon = solarNoonUtcMinutes + offset;
  const sunriseHa = hourAngle(latitude, decl, -0.833) ?? 360;
  const fajrHa = hourAngle(latitude, decl, -angles.fajr) ?? sunriseHa + 90;
  const ishaHa = angles.isha ? (hourAngle(latitude, decl, -angles.isha) ?? sunriseHa + 90) : null;
  const asrHa = asrMinutesFromNoon(latitude, decl) ?? 240;
  const sunset = noon + sunriseHa;
  return {
    fajr: clock(noon - fajrHa),
    dhuhr: clock(noon),
    asr: clock(noon + asrHa),
    maghrib: clock(sunset),
    isha: clock(angles.ishaMinutes ? sunset + angles.ishaMinutes : noon + (ishaHa || sunriseHa + 90))
  };
}

function calculateLocalWindow(latitude: number, longitude: number, timezone: string) {
  const prayerTimes: PrayerTimes = {};
  const method = smartMethodForLocation(latitude, longitude);
  const now = new Date();
  for (let offset = -1; offset <= 45; offset += 1) {
    const date = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate() + offset, 12));
    const key = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
    prayerTimes[key] = localPrayerDay(date, latitude, longitude, timezone, method);
  }
  return prayerTimes;
}

async function fetchAlAdhanMonth(latitude: number, longitude: number, year: number, month: number) {
  const url = new URL(`https://api.aladhan.com/v1/calendar/${year}/${month}`);
  url.searchParams.set("latitude", String(latitude));
  url.searchParams.set("longitude", String(longitude));
  url.searchParams.set("method", String(smartMethodForLocation(latitude, longitude)));
  url.searchParams.set("school", "0");
  url.searchParams.set("latitudeAdjustmentMethod", "3");
  const response = await timeout(fetch(url.toString(), { headers: { Accept: "application/json" } }), API_TIMEOUT_MS, "PRAYER_API_TIMEOUT");
  if (!response.ok) throw new Error(`PRAYER_API_${response.status}`);
  const payload = await response.json() as AlAdhanResponse;
  if (payload.code !== 200 || !Array.isArray(payload.data)) throw new Error("PRAYER_API_INVALID");
  return payload;
}

async function fetchRemoteWindow(latitude: number, longitude: number) {
  const prayerTimes: PrayerTimes = {};
  let timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  for (const { year, month } of monthWindow()) {
    const payload = await fetchAlAdhanMonth(latitude, longitude, year, month);
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
  return { prayerTimes, timezone };
}

async function cachedLocation() {
  const saved = await AsyncStorage.getItem(STORAGE_KEYS.locationSchedule);
  if (!saved) return null;
  try {
    const parsed = JSON.parse(saved) as Partial<CachedLocationPayload>;
    if (!parsed.prayerTimes || !parsed.location) return null;
    return parsed as CachedLocationPayload;
  } catch {
    await AsyncStorage.removeItem(STORAGE_KEYS.locationSchedule);
    return null;
  }
}

async function saveContext(value: LoadedPrayerTimes) {
  await AsyncStorage.setItem(STORAGE_KEYS.locationSchedule, JSON.stringify({ ...value, savedAt: new Date().toISOString() } satisfies CachedLocationPayload));
}

export async function loadInitialPrayerTimes(): Promise<LoadedPrayerTimes> {
  const cached = await cachedLocation();
  if (cached) return { prayerTimes: cached.prayerTimes, live: false, location: { ...cached.location, source: "saved" } };
  const bundled = bundledSchedule as PrayerFile;
  return {
    prayerTimes: bundled.prayer_times,
    live: false,
    location: { latitude: WINDSOR.latitude, longitude: WINDSOR.longitude, timezone: WINDSOR_TIME_ZONE, label: CITY_LABEL, source: "saved" }
  };
}

export async function loadPrayerTimes(options: { forceLocation?: boolean } = {}): Promise<LoadedPrayerTimes> {
  const fallback = await loadInitialPrayerTimes();
  const force = options.forceLocation === true;
  try {
    if (!await getPermission(force)) return fallback;
    const position = await getPosition(force);
    const latitude = position.coords.latitude;
    const longitude = position.coords.longitude;
    const deviceTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || fallback.location.timezone || WINDSOR_TIME_ZONE;
    const label = isNearWindsor(latitude, longitude) ? CITY_LABEL : await resolveCity(latitude, longitude);

    const localContext: LoadedPrayerTimes = {
      prayerTimes: calculateLocalWindow(latitude, longitude, deviceTimezone),
      live: true,
      location: { latitude, longitude, timezone: deviceTimezone, label, source: "local_calculation" }
    };
    await saveContext(localContext);

    try {
      const remote = await fetchRemoteWindow(latitude, longitude);
      const remoteContext: LoadedPrayerTimes = {
        prayerTimes: remote.prayerTimes,
        live: true,
        location: { latitude, longitude, timezone: remote.timezone, label, source: "aladhan" }
      };
      await saveContext(remoteContext);
      return remoteContext;
    } catch {
      return localContext;
    }
  } catch {
    return fallback;
  }
}
'''


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f"Missing expected source for {label}")
    return text.replace(old, new, 1)

Path("src/prayerData.ts").write_text(PRAYER_DATA, encoding="utf-8")

notifications_path = Path("src/notifications.ts")
notifications = notifications_path.read_text(encoding="utf-8")
notifications = replace_once(
    notifications,
    '    shouldPlaySound: notification.request.content.data?.kind !== "athan",',
    '    shouldPlaySound: true,',
    "foreground Athan sound handler",
)
notifications = replace_once(
    notifications,
    '  return { ...common, title: locale === "ar" ? `حان الآن وقت صلاة ${prayer}` : `It is time for ${prayer}`, body: `${time} • ${locationLabel}` };',
    '  const sound = event.prayer === "fajr" ? "hassoun_fajr_athan.wav" : "hassoun_athan.wav";\n  return { ...common, title: locale === "ar" ? `حان الآن وقت صلاة ${prayer}` : `It is time for ${prayer}`, body: `${time} • ${locationLabel}`, ...(Platform.OS === "ios" ? { sound } : {}) };',
    "iOS Athan notification sound",
)
marker = 'export async function disableIslamicEventReminders() {'
ios_test = '''export async function scheduleIosTestAdhan(prayer: PrayerKey = "fajr", delaySeconds = 30) {
  const granted = await requestNotificationPermission();
  if (!granted) return { granted: false, allowsSound: false, identifier: null as string | null };
  const permissions = await Notifications.getPermissionsAsync();
  const allowsSound = Platform.OS !== "ios" || permissions.ios?.allowsSound !== false;
  const sound = prayer === "fajr" ? "hassoun_fajr_athan.wav" : "hassoun_athan.wav";
  const identifier = await Notifications.scheduleNotificationAsync({
    content: {
      title: prayer === "fajr" ? "Fajr Adhan test" : "Adhan test",
      body: "Lock the iPhone now. The Athan notification sound should play.",
      sound,
      data: { kind: "athan-test", prayer }
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: Math.max(5, delaySeconds), repeats: false }
  });
  return { granted: true, allowsSound, identifier };
}

'''
notifications = replace_once(notifications, marker, ios_test + marker, "iOS Athan test helper")
notifications_path.write_text(notifications, encoding="utf-8")

app_path = Path("App.tsx")
app = app_path.read_text(encoding="utf-8")
app = replace_once(
    app,
    'import { disablePrayerNotifications, scheduleIslamicEventReminders, schedulePrayerNotifications, scheduleTestReminder } from "./src/notifications";',
    'import { disablePrayerNotifications, scheduleIosTestAdhan, scheduleIslamicEventReminders, schedulePrayerNotifications, scheduleTestReminder } from "./src/notifications";',
    "iOS Athan test import",
)
app = replace_once(app, '        loadPrayerTimes(),', '        loadPrayerTimes({ forceLocation: true }),', "fresh GPS on startup")
app = replace_once(app, '        const refreshed = await loadPrayerTimes();', '        const refreshed = await loadPrayerTimes({ forceLocation: true });', "fresh GPS on resume")
app = app.replace('Allow notifications for Hassoun in Android settings, then try again.', 'Allow notifications for Hassoun in your phone settings, then try again.')
old_test = '''  const testAdhan = async () => {
    try {
      const result = await scheduleAndroidTestAdhan("fajr", 30);
      if (!result.available) { Alert.alert("Native Adhan unavailable", "This build does not contain the native Android prayer-audio module."); return; }
      if (!result.exact) {
        Alert.alert("Allow Alarms & reminders", "Exact alarm access is off. Enable it, return to Hassoun, then run the Adhan test again.", [
          { text: "Cancel", style: "cancel" }, { text: "Open settings", onPress: openExactAlarmSettings }
        ]);
        return;
      }
      Alert.alert("Adhan test scheduled", "Lock the phone now. The Fajr Adhan should start by itself in about 30 seconds.");
    } catch (error) { Alert.alert("Adhan test failed", String(error)); }
  };'''
new_test = '''  const testAdhan = async () => {
    try {
      if (Platform.OS === "ios") {
        const result = await scheduleIosTestAdhan("fajr", 30);
        if (!result.granted) {
          Alert.alert("Notifications are off", "Allow notifications for Hassoun in iPhone Settings, then try again.");
          return;
        }
        if (!result.allowsSound) {
          Alert.alert("Notification sounds are off", "Open iPhone Settings → Notifications → Hassoun and turn Sounds on, then test again.");
          return;
        }
        Alert.alert("iPhone Adhan test scheduled", "Lock the iPhone now. The Fajr Athan clip should play in about 30 seconds. Ring mode must be on and Focus must allow Hassoun notifications.");
        return;
      }
      const result = await scheduleAndroidTestAdhan("fajr", 30);
      if (!result.available) { Alert.alert("Native Adhan unavailable", "This build does not contain the native Android prayer-audio module."); return; }
      if (!result.exact) {
        Alert.alert("Allow Alarms & reminders", "Exact alarm access is off. Enable it, return to Hassoun, then run the Adhan test again.", [
          { text: "Cancel", style: "cancel" }, { text: "Open settings", onPress: openExactAlarmSettings }
        ]);
        return;
      }
      Alert.alert("Adhan test scheduled", "Lock the phone now. The Fajr Adhan should start by itself in about 30 seconds.");
    } catch (error) { Alert.alert("Adhan test failed", String(error)); }
  };'''
app = replace_once(app, old_test, new_test, "cross-platform Adhan test")
app_path.write_text(app, encoding="utf-8")

config_path = Path("app.config.ts")
config = config_path.read_text(encoding="utf-8")
config = replace_once(
    config,
    '"sounds": ["./assets/attention_chime.wav"]',
    '"sounds": ["./assets/attention_chime.wav", "./assets/hassoun_fajr_athan.wav", "./assets/hassoun_athan.wav"]',
    "bundled iOS Athan sounds",
)
config_path.write_text(config, encoding="utf-8")

print("Applied iOS fresh-location + Athan notification sound fixes")
