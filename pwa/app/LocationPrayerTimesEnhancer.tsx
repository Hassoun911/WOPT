"use client";

import { useLayoutEffect } from "react";
import { usePathname } from "next/navigation";

type PrayerKey = "fajr" | "dhuhr" | "asr" | "maghrib" | "isha";
type PrayerDay = Record<PrayerKey, string>;
type PrayerTimes = Record<string, PrayerDay>;

type AlAdhanDay = {
  timings?: Record<string, string>;
  date?: { gregorian?: { date?: string } };
};

type AlAdhanResponse = { code?: number; data?: AlAdhanDay[] };

type CachedLocation = {
  latitude: number;
  longitude: number;
  accuracy?: number;
  timezone: string;
  savedAt: number;
};

const WINDSOR_DATA_URL = "https://raw.githubusercontent.com/Hassoun911/WOPT/main/windsor_islamic_association_2026_prayer_times.json";
const LOCATION_KEY = "hassoun-web-prayer-location-v1";
const LOCATION_TIMES_KEY = "hassoun-web-location-prayer-times-v1";
const LEGACY_TIMES_KEY = "wpt-prayer-times";
const CACHE_MAX_AGE = 15 * 60 * 1000;
const PRAYERS: PrayerKey[] = ["fajr", "dhuhr", "asr", "maghrib", "isha"];

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

function readCachedLocation(): CachedLocation | null {
  try {
    const raw = window.localStorage.getItem(LOCATION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedLocation;
    if (!Number.isFinite(parsed.latitude) || !Number.isFinite(parsed.longitude)) return null;
    if (Date.now() - parsed.savedAt > CACHE_MAX_AGE) return null;
    return parsed;
  } catch {
    return null;
  }
}

function getBrowserLocation(): Promise<CachedLocation> {
  const cached = readCachedLocation();
  if (cached) return Promise.resolve(cached);

  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) {
      reject(new Error("Geolocation unavailable"));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const location: CachedLocation = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
          savedAt: Date.now(),
        };
        try { window.localStorage.setItem(LOCATION_KEY, JSON.stringify(location)); } catch {}
        resolve(location);
      },
      reject,
      { enableHighAccuracy: false, timeout: 10000, maximumAge: CACHE_MAX_AGE },
    );
  });
}

function monthParts(offset: number) {
  const now = new Date();
  const date = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  return { year: date.getFullYear(), month: date.getMonth() + 1 };
}

async function fetchMonth(
  originalFetch: typeof window.fetch,
  location: CachedLocation,
  year: number,
  month: number,
) {
  const url = new URL(`https://api.aladhan.com/v1/calendar/${year}/${month}`);
  url.searchParams.set("latitude", String(location.latitude));
  url.searchParams.set("longitude", String(location.longitude));
  url.searchParams.set("method", "3");
  url.searchParams.set("school", "0");

  const response = await originalFetch(url.toString(), {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Location prayer service failed (${response.status})`);

  const payload = await response.json() as AlAdhanResponse;
  if (payload.code !== 200 || !Array.isArray(payload.data)) throw new Error("Invalid location prayer response");
  return payload.data;
}

async function getLocationPrayerFile(originalFetch: typeof window.fetch) {
  const location = await getBrowserLocation();
  const periods = [monthParts(-1), monthParts(0), monthParts(1)];
  const months = await Promise.all(periods.map(({ year, month }) => fetchMonth(originalFetch, location, year, month)));
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

  if (!Object.keys(prayerTimes).length) throw new Error("No location prayer times returned");
  try {
    window.localStorage.setItem(LOCATION_TIMES_KEY, JSON.stringify({ location, prayerTimes, savedAt: Date.now() }));
    window.localStorage.setItem(LEGACY_TIMES_KEY, JSON.stringify(prayerTimes));
  } catch {}

  return {
    metadata: {
      source_page: "Location-based prayer times",
      latitude: location.latitude,
      longitude: location.longitude,
      timezone: location.timezone,
    },
    prayer_times: prayerTimes,
  };
}

function applyLocationLabels() {
  const location = readCachedLocation();
  if (!location) return;
  document.documentElement.dataset.hassounPrayerLocation = "device";

  document.querySelectorAll<HTMLElement>(".dashboard .date-column .eyebrow, .sheet-header .eyebrow").forEach((node) => {
    const text = node.textContent?.trim() || "";
    if (/windsor|وندسور/i.test(text)) node.textContent = "Your location";
  });

  document.querySelectorAll<HTMLElement>(".source-note").forEach((node) => {
    const desired = "Location-based prayer times";
    if ((node.textContent || "").includes(desired)) return;
    node.replaceChildren();
    const dot = document.createElement("span");
    node.append(dot, document.createTextNode(` ${desired}`));
  });

  document.querySelectorAll<HTMLElement>(".sync-pill").forEach((node) => {
    const desired = "Location prayer times";
    if ((node.textContent || "").includes(desired)) return;
    node.replaceChildren();
    const dot = document.createElement("span");
    node.append(dot, document.createTextNode(` ${desired}`));
  });
}

function scheduleLocationLabels() {
  // React may finish painting the home screen after this enhancer mounts. Run a
  // small, finite set of updates instead of observing and rewriting every DOM mutation.
  const timers = [0, 150, 500, 1200].map((delay) => window.setTimeout(applyLocationLabels, delay));
  return () => timers.forEach((timer) => window.clearTimeout(timer));
}

export default function LocationPrayerTimesEnhancer() {
  const pathname = usePathname();

  useLayoutEffect(() => {
    if (pathname !== "/" && pathname !== "") return;

    const originalFetch = window.fetch.bind(window);
    let disposed = false;

    window.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const requestUrl = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      if (requestUrl.startsWith(WINDSOR_DATA_URL)) {
        try {
          const data = await getLocationPrayerFile(originalFetch);
          return new Response(JSON.stringify(data), {
            status: 200,
            headers: { "Content-Type": "application/json", "X-Hassoun-Prayer-Source": "device-location" },
          });
        } catch (error) {
          console.warn("Hassoun location prayer times unavailable; using Windsor fallback", error);
          return originalFetch(input, init);
        }
      }
      return originalFetch(input, init);
    }) as typeof window.fetch;

    const cancelInitialLabels = scheduleLocationLabels();
    void getLocationPrayerFile(originalFetch).then(() => {
      if (!disposed) applyLocationLabels();
    }).catch(() => undefined);

    return () => {
      disposed = true;
      cancelInitialLabels();
      window.fetch = originalFetch;
    };
  }, [pathname]);

  return null;
}
