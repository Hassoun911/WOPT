"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

type PrayerKey = "fajr" | "dhuhr" | "asr" | "maghrib" | "isha";
type PrayerDay = Record<PrayerKey, string>;
type PrayerTimes = Record<string, PrayerDay>;

type CachedLocation = {
  latitude: number;
  longitude: number;
  accuracy?: number;
  timezone: string;
  savedAt: number;
};

type LocalPrayerCache = {
  location: CachedLocation;
  prayerTimes: PrayerTimes;
  sourceLabel: string;
  placeLabel: string;
  mosqueName?: string;
  savedAt: number;
};

type AlAdhanDay = {
  timings?: Record<string, string>;
  date?: { gregorian?: { date?: string } };
};

type AlAdhanResponse = { code?: number; data?: AlAdhanDay[] };

type OverpassElement = {
  type?: string;
  id?: number;
  lat?: number;
  lon?: number;
  center?: { lat?: number; lon?: number };
  tags?: Record<string, string>;
};

const WINDSOR_DATA_URL = "https://raw.githubusercontent.com/Hassoun911/WOPT/main/windsor_islamic_association_2026_prayer_times.json";
const LOCATION_KEY = "hassoun-web-prayer-location-v2";
const LOCATION_TIMES_KEY = "hassoun-web-location-prayer-times-v2";
const LEGACY_TIMES_KEY = "wpt-prayer-times";
const CACHE_MAX_AGE = 12 * 60 * 60 * 1000;
const LOCATION_MAX_AGE = 30 * 60 * 1000;
const WINDSOR = { latitude: 42.3149, longitude: -83.0364 };
const WINDSOR_RADIUS_KM = 35;
const PRAYERS: PrayerKey[] = ["fajr", "dhuhr", "asr", "maghrib", "isha"];
const PRAYER_LABELS: Record<PrayerKey, { en: string; ar: string }> = {
  fajr: { en: "Fajr", ar: "الفجر" },
  dhuhr: { en: "Dhuhr", ar: "الظهر" },
  asr: { en: "Asr", ar: "العصر" },
  maghrib: { en: "Maghrib", ar: "المغرب" },
  isha: { en: "Isha", ar: "العشاء" },
};

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

function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const rad = (value: number) => value * Math.PI / 180;
  const dLat = rad(lat2 - lat1);
  const dLon = rad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function readLocation(): CachedLocation | null {
  try {
    const raw = window.localStorage.getItem(LOCATION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedLocation;
    if (!Number.isFinite(parsed.latitude) || !Number.isFinite(parsed.longitude)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function readCache(): LocalPrayerCache | null {
  try {
    const raw = window.localStorage.getItem(LOCATION_TIMES_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LocalPrayerCache;
    if (!parsed?.prayerTimes || !parsed?.location) return null;
    return parsed;
  } catch {
    return null;
  }
}

function saveCache(cache: LocalPrayerCache) {
  try {
    window.localStorage.setItem(LOCATION_TIMES_KEY, JSON.stringify(cache));
    window.localStorage.setItem(LOCATION_KEY, JSON.stringify(cache.location));
    window.localStorage.setItem(LEGACY_TIMES_KEY, JSON.stringify(cache.prayerTimes));
  } catch {}
}

function browserLocation(force = false): Promise<CachedLocation> {
  const cached = readLocation();
  if (!force && cached && Date.now() - cached.savedAt < LOCATION_MAX_AGE) return Promise.resolve(cached);
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) {
      reject(new Error("Location is not supported on this device."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
        savedAt: Date.now(),
      }),
      reject,
      { enableHighAccuracy: false, timeout: 12000, maximumAge: force ? 0 : LOCATION_MAX_AGE },
    );
  });
}

function monthParts(offset: number) {
  const now = new Date();
  const date = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  return { year: date.getFullYear(), month: date.getMonth() + 1 };
}

async function fetchCalculatedMonth(location: CachedLocation, year: number, month: number) {
  const url = new URL(`https://api.aladhan.com/v1/calendar/${year}/${month}`);
  url.searchParams.set("latitude", String(location.latitude));
  url.searchParams.set("longitude", String(location.longitude));
  url.searchParams.set("method", "3");
  url.searchParams.set("school", "0");
  const response = await fetch(url.toString(), { headers: { Accept: "application/json" }, cache: "no-store" });
  if (!response.ok) throw new Error(`Prayer service returned ${response.status}`);
  const payload = await response.json() as AlAdhanResponse;
  if (payload.code !== 200 || !Array.isArray(payload.data)) throw new Error("Prayer service returned invalid data");
  return payload.data;
}

async function calculatedTimes(location: CachedLocation): Promise<PrayerTimes> {
  const periods = [monthParts(-1), monthParts(0), monthParts(1)];
  const months = await Promise.all(periods.map(({ year, month }) => fetchCalculatedMonth(location, year, month)));
  const prayerTimes: PrayerTimes = {};
  for (const days of months) {
    for (const day of days) {
      const key = dateKey(day.date?.gregorian?.date);
      if (!key) continue;
      const parsed = {
        fajr: parseTiming(day.timings?.Fajr),
        dhuhr: parseTiming(day.timings?.Dhuhr),
        asr: parseTiming(day.timings?.Asr),
        maghrib: parseTiming(day.timings?.Maghrib),
        isha: parseTiming(day.timings?.Isha),
      };
      if (PRAYERS.some((prayer) => !parsed[prayer])) continue;
      prayerTimes[key] = parsed as PrayerDay;
    }
  }
  if (!Object.keys(prayerTimes).length) throw new Error("No local prayer times were returned");
  return prayerTimes;
}

async function windsorTimes(): Promise<PrayerTimes> {
  const response = await fetch(`${WINDSOR_DATA_URL}?v=${Date.now()}`, { cache: "no-store" });
  if (!response.ok) throw new Error("Windsor schedule unavailable");
  const payload = await response.json() as { prayer_times?: PrayerTimes };
  if (!payload.prayer_times) throw new Error("Windsor schedule missing prayer times");
  return payload.prayer_times;
}

async function nearestMosque(location: CachedLocation) {
  try {
    const radiusM = 15000;
    const query = `[out:json][timeout:8];(node[\"amenity\"=\"place_of_worship\"][\"religion\"=\"muslim\"](around:${radiusM},${location.latitude},${location.longitude});way[\"amenity\"=\"place_of_worship\"][\"religion\"=\"muslim\"](around:${radiusM},${location.latitude},${location.longitude});relation[\"amenity\"=\"place_of_worship\"][\"religion\"=\"muslim\"](around:${radiusM},${location.latitude},${location.longitude}););out center tags 25;`;
    const response = await fetch(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`, { headers: { Accept: "application/json" } });
    if (!response.ok) return null;
    const payload = await response.json() as { elements?: OverpassElement[] };
    const found = (payload.elements ?? []).flatMap((element) => {
      const lat = Number(element.lat ?? element.center?.lat);
      const lon = Number(element.lon ?? element.center?.lon);
      const name = element.tags?.name || element.tags?.["name:en"] || element.tags?.["name:ar"];
      if (!name || !Number.isFinite(lat) || !Number.isFinite(lon)) return [];
      return [{ name, distance: distanceKm(location.latitude, location.longitude, lat, lon), city: element.tags?.["addr:city"] }];
    }).sort((a, b) => a.distance - b.distance);
    return found[0] ?? null;
  } catch {
    return null;
  }
}

async function reversePlace(location: CachedLocation) {
  try {
    const url = new URL("https://nominatim.openstreetmap.org/reverse");
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("lat", String(location.latitude));
    url.searchParams.set("lon", String(location.longitude));
    url.searchParams.set("zoom", "10");
    const response = await fetch(url.toString(), { headers: { Accept: "application/json" } });
    if (!response.ok) return "Your location";
    const payload = await response.json() as { address?: Record<string, string> };
    const address = payload.address ?? {};
    const city = address.city || address.town || address.village || address.municipality || address.county;
    const region = address.state || address.province;
    return [city, region].filter(Boolean).join(", ") || "Your location";
  } catch {
    return "Your location";
  }
}

async function buildLocalCache(forceLocation = false): Promise<LocalPrayerCache> {
  const location = await browserLocation(forceLocation);
  const isWindsor = distanceKm(location.latitude, location.longitude, WINDSOR.latitude, WINDSOR.longitude) <= WINDSOR_RADIUS_KM;
  const [placeLabel, mosque] = await Promise.all([reversePlace(location), nearestMosque(location)]);
  const prayerTimes = isWindsor ? await windsorTimes() : await calculatedTimes(location);
  const sourceLabel = isWindsor
    ? "Windsor Islamic Association • official Adhan time"
    : mosque
      ? `Local Adhan calculation • nearest masjid: ${mosque.name}`
      : "Local Adhan calculation • device location";
  const cache = { location, prayerTimes, sourceLabel, placeLabel, mosqueName: mosque?.name, savedAt: Date.now() };
  saveCache(cache);
  return cache;
}

function dateKeyForTimezone(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const value = (type: string) => parts.find((part) => part.type === type)?.value || "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

function clockParts(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).formatToParts(date);
  const value = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? 0);
  return { hour: value("hour"), minute: value("minute"), second: value("second") };
}

function minutesOf(value: string) {
  const [hour, minute] = value.split(":").map(Number);
  return hour * 60 + minute;
}

function formatTime(value: string) {
  const [hour, minute] = value.split(":").map(Number);
  const h = hour % 12 || 12;
  return `${h}:${String(minute).padStart(2, "0")} ${hour < 12 ? "a.m." : "p.m."}`;
}

function humanCountdown(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours ? `${hours}h ` : ""}${minutes}m`;
}

function currentPrayerState(cache: LocalPrayerCache, now = new Date()) {
  const timezone = cache.location.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  const today = dateKeyForTimezone(now, timezone);
  const times = cache.prayerTimes[today];
  if (!times) return null;
  const current = clockParts(now, timezone);
  const currentSeconds = current.hour * 3600 + current.minute * 60 + current.second;
  for (const key of PRAYERS) {
    const target = minutesOf(times[key]) * 60;
    if (target > currentSeconds) return { today, times, key, seconds: target - currentSeconds };
  }
  const tomorrowDate = new Date(now.getTime() + 86_400_000);
  const tomorrow = cache.prayerTimes[dateKeyForTimezone(tomorrowDate, timezone)];
  const fajr = tomorrow?.fajr ?? times.fajr;
  return { today, times, key: "fajr" as PrayerKey, seconds: 86400 - currentSeconds + minutesOf(fajr) * 60 };
}

function setText(selector: string, text: string) {
  const node = document.querySelector<HTMLElement>(selector);
  if (node && node.textContent !== text) node.textContent = text;
}

function applyToHome(cache: LocalPrayerCache, offline: boolean) {
  const state = currentPrayerState(cache);
  if (!state) return;
  document.documentElement.dataset.hassounPrayerLocation = "device";
  document.documentElement.dataset.hassounPrayerOffline = offline ? "true" : "false";

  const status = offline ? "Offline • saved local schedule" : "Local prayer times active";
  const sync = document.querySelector<HTMLElement>(".sync-pill");
  if (sync) {
    sync.classList.add("live");
    sync.replaceChildren();
    const dot = document.createElement("span");
    sync.append(dot, document.createTextNode(status));
  }

  setText(".dashboard .date-column .eyebrow", cache.placeLabel || "Your location");

  const source = document.querySelector<HTMLElement>(".source-note");
  if (source) {
    source.replaceChildren();
    const dot = document.createElement("span");
    source.append(dot, document.createTextNode(` ${cache.sourceLabel}${offline ? " • saved offline" : ""}`));
  }

  const cards = Array.from(document.querySelectorAll<HTMLElement>(".prayer-grid .prayer-card"));
  PRAYERS.forEach((key, index) => {
    const card = cards[index];
    if (!card) return;
    const time = card.querySelector<HTMLElement>("time");
    if (time) {
      time.textContent = formatTime(state.times[key]);
      time.setAttribute("datetime", state.times[key]);
    }
    card.classList.toggle("active", key === state.key);
  });

  setText(".next-prayer-card .next-card-head h2", `${PRAYER_LABELS[state.key].en}  ${PRAYER_LABELS[state.key].ar}`);
  const countdownStrong = document.querySelector<HTMLElement>(".next-prayer-card .countdown");
  if (countdownStrong) countdownStrong.textContent = humanCountdown(state.seconds);
  const begins = document.querySelectorAll<HTMLElement>(".next-prayer-card .countdown-row strong");
  if (begins[0]) begins[0].textContent = formatTime(state.times[state.key]);

  const liveClock = document.querySelector<HTMLElement>(".next-prayer-card .live-clock strong");
  if (liveClock) {
    liveClock.textContent = new Intl.DateTimeFormat("en-CA", { timeZone: cache.location.timezone, hour: "numeric", minute: "2-digit", second: "2-digit" }).format(new Date());
  }

  const notice = document.querySelector<HTMLElement>(".notice-card");
  if (notice) {
    const strong = notice.querySelector("strong");
    const text = notice.querySelector("p");
    const date = notice.querySelector<HTMLElement>(".verified-date");
    if (strong) strong.textContent = offline ? "Offline local prayer schedule" : "Local Adhan times ready";
    if (text) text.textContent = offline
      ? "Using the last successfully saved local schedule on this device. Hassoun will refresh it automatically when you are online."
      : cache.sourceLabel;
    if (date) date.textContent = offline ? "Saved on device" : "Location synced";
  }
}

function cacheIsUsable(cache: LocalPrayerCache | null) {
  if (!cache) return false;
  const timezone = cache.location.timezone || "UTC";
  const today = dateKeyForTimezone(new Date(), timezone);
  return Boolean(cache.prayerTimes[today]);
}

export default function LocationPrayerTimesEnhancer() {
  const pathname = usePathname();

  useEffect(() => {
    if (pathname !== "/" && pathname !== "") return;
    let cancelled = false;
    let activeCache = readCache();

    const paint = () => {
      if (!cancelled && cacheIsUsable(activeCache)) applyToHome(activeCache!, !navigator.onLine);
    };

    const refresh = async (forceLocation = false) => {
      if (!navigator.onLine) {
        paint();
        return;
      }
      try {
        const next = await buildLocalCache(forceLocation);
        if (cancelled) return;
        activeCache = next;
        applyToHome(next, false);
      } catch (error) {
        console.warn("Hassoun local prayer refresh failed", error);
        if (!cancelled) paint();
      }
    };

    // Paint saved local data immediately, then refresh in the background.
    paint();
    const initialTimer = window.setTimeout(() => void refresh(false), 450);
    const repaintTimer = window.setInterval(paint, 1000);
    const refreshTimer = window.setInterval(() => void refresh(false), 6 * 60 * 60 * 1000);
    const onOnline = () => void refresh(true);
    const onOffline = () => paint();
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        paint();
        if (activeCache && Date.now() - activeCache.savedAt > CACHE_MAX_AGE) void refresh(false);
      }
    };

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      window.clearTimeout(initialTimer);
      window.clearInterval(repaintTimer);
      window.clearInterval(refreshTimer);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      document.removeEventListener("visibilitychange", onVisible);
      delete document.documentElement.dataset.hassounPrayerLocation;
      delete document.documentElement.dataset.hassounPrayerOffline;
    };
  }, [pathname]);

  return null;
}
