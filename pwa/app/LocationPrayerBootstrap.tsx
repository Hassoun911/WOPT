"use client";

import { useLayoutEffect } from "react";

const PRAYER_API = "https://wopt-prayer-push.wopt-windsor.workers.dev/prayer-times";
const LOCATION_KEY = "hassoun:prayer-location:v2";
const WINDSOR_FILE = "windsor_islamic_association_2026_prayer_times.json";

type SavedLocation = {
  latitude: number;
  longitude: number;
  timezone: string;
  label: string;
  source: string;
  updatedAt: string;
};

type PrayerApiResponse = {
  prayer_times?: Record<string, Record<string, string>>;
  source?: string;
  sourceLabel?: string;
  location?: { label?: string };
};

function distanceKm(aLat: number, aLng: number, bLat: number, bLng: number) {
  const radians = (value: number) => value * Math.PI / 180;
  const earth = 6371;
  const dLat = radians(bLat - aLat);
  const dLng = radians(bLng - aLng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(radians(aLat)) * Math.cos(radians(bLat)) * Math.sin(dLng / 2) ** 2;
  return earth * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function currentYearMonth(timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit" }).formatToParts(new Date());
  return {
    year: Number(parts.find((part) => part.type === "year")?.value ?? new Date().getFullYear()),
    month: Number(parts.find((part) => part.type === "month")?.value ?? new Date().getMonth() + 1)
  };
}

function nextMonth(year: number, month: number) {
  return month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };
}

function getPosition() {
  return new Promise<GeolocationPosition>((resolve, reject) => {
    if (!("geolocation" in navigator)) return reject(new Error("Geolocation unavailable"));
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: false,
      maximumAge: 120_000,
      timeout: 10_000
    });
  });
}

async function reverseLabel(latitude: number, longitude: number) {
  try {
    const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(latitude)}&lon=${encodeURIComponent(longitude)}&zoom=10`, {
      headers: { Accept: "application/json" }
    });
    if (!response.ok) return "Current location";
    const data = await response.json() as { address?: { city?: string; town?: string; village?: string; county?: string; state?: string; country?: string } };
    const address = data.address || {};
    return [address.city || address.town || address.village || address.county, address.state, address.country].filter(Boolean).join(", ") || "Current location";
  } catch {
    return "Current location";
  }
}

function updateVisibleLocation(label: string, source: string) {
  const replacements: Array<[string, string]> = [
    ["Windsor, Ontario", label],
    ["وندسور، أونتاريو", label],
    ["Times verified for Windsor", source === "windsor_islamic_association" ? "Times verified for Windsor" : "Prayer times for your current location"],
    ["تم التحقق من مواقيت وندسور", source === "windsor_islamic_association" ? "تم التحقق من مواقيت وندسور" : "مواقيت الصلاة حسب موقعك الحالي"],
    ["Windsor Islamic Association • Adhan time", source === "windsor_islamic_association" ? "Windsor Islamic Association • Adhan time" : "Current GPS location • Prayer time"],
    ["الجمعية الإسلامية في وندسور • وقت الأذان", source === "windsor_islamic_association" ? "الجمعية الإسلامية في وندسور • وقت الأذان" : "موقعك الحالي • وقت الصلاة"],
    ["Times verified for Windsor", source === "windsor_islamic_association" ? "Times verified for Windsor" : "GPS prayer times verified for this location"],
    ["Official Windsor Islamic Association schedule", source === "windsor_islamic_association" ? "Official Windsor Islamic Association schedule" : "Prayer schedule for current GPS location"]
  ];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  while (walker.nextNode()) nodes.push(walker.currentNode as Text);
  for (const node of nodes) {
    let text = node.nodeValue || "";
    for (const [from, to] of replacements) text = text.replaceAll(from, to);
    if (text !== node.nodeValue) node.nodeValue = text;
  }
}

function locationAwareNotificationOptions(options: NotificationOptions | undefined, location: SavedLocation | null) {
  if (!options || !location?.label) return options;
  const body = typeof options.body === "string"
    ? options.body.replaceAll("Windsor, Ontario", location.label).replaceAll("وندسور، أونتاريو", location.label)
    : options.body;
  return { ...options, body };
}

export default function LocationPrayerBootstrap() {
  useLayoutEffect(() => {
    const nativeFetch = window.fetch.bind(window);
    let locationPromise: Promise<GeolocationPosition> | null = null;
    let latest: SavedLocation | null = null;

    try {
      const saved = window.localStorage.getItem(LOCATION_KEY);
      if (saved) latest = JSON.parse(saved) as SavedLocation;
    } catch {}

    const locate = () => locationPromise ||= getPosition();
    const fetchLocationMonth = async (latitude: number, longitude: number, timezone: string, year: number, month: number) => {
      const url = new URL(PRAYER_API);
      url.searchParams.set("lat", String(latitude));
      url.searchParams.set("lng", String(longitude));
      url.searchParams.set("timezone", timezone);
      url.searchParams.set("year", String(year));
      url.searchParams.set("month", String(month));
      url.searchParams.set("method", "3");
      url.searchParams.set("school", "0");
      const response = await nativeFetch(url.toString(), { cache: "no-store", headers: { Accept: "application/json" } });
      if (!response.ok) throw new Error(`Prayer API failed: ${response.status}`);
      return response.json() as Promise<PrayerApiResponse>;
    };

    const originalDateTimeFormat = Intl.DateTimeFormat;
    const deviceTimezone = originalDateTimeFormat().resolvedOptions().timeZone || "America/Toronto";
    Intl.DateTimeFormat = function(locales?: Intl.LocalesArgument, options?: Intl.DateTimeFormatOptions) {
      const next = options?.timeZone === "America/Toronto" && deviceTimezone !== "America/Toronto"
        ? { ...options, timeZone: deviceTimezone }
        : options;
      return new originalDateTimeFormat(locales, next);
    } as typeof Intl.DateTimeFormat;
    Intl.DateTimeFormat.supportedLocalesOf = originalDateTimeFormat.supportedLocalesOf.bind(originalDateTimeFormat);

    window.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const requestUrl = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      if (!requestUrl.includes(WINDSOR_FILE)) return nativeFetch(input, init);
      try {
        const position = await locate();
        const latitude = position.coords.latitude;
        const longitude = position.coords.longitude;
        const current = currentYearMonth(deviceTimezone);
        const following = nextMonth(current.year, current.month);
        const [first, second] = await Promise.all([
          fetchLocationMonth(latitude, longitude, deviceTimezone, current.year, current.month),
          fetchLocationMonth(latitude, longitude, deviceTimezone, following.year, following.month)
        ]);
        if (!first.prayer_times) throw new Error("Location prayer schedule missing");
        const source = first.source || "aladhan";
        const apiLabel = first.location?.label && first.location.label !== "Current location" ? first.location.label : "";
        const label = source === "windsor_islamic_association" ? "Windsor, Ontario" : (apiLabel || await reverseLabel(latitude, longitude));
        latest = { latitude, longitude, timezone: deviceTimezone, label, source, updatedAt: new Date().toISOString() };
        window.localStorage.setItem(LOCATION_KEY, JSON.stringify(latest));
        window.dispatchEvent(new CustomEvent("hassoun:prayer-location", { detail: latest }));
        window.setTimeout(() => updateVisibleLocation(label, source), 0);
        return new Response(JSON.stringify({
          metadata: { source_page: first.sourceLabel || source, location: latest },
          prayer_times: { ...first.prayer_times, ...(second.prayer_times || {}) }
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      } catch {
        return nativeFetch(input, init);
      }
    }) as typeof window.fetch;

    const registrationPrototype = typeof ServiceWorkerRegistration !== "undefined" ? ServiceWorkerRegistration.prototype : null;
    const originalShowNotification = registrationPrototype?.showNotification;
    if (registrationPrototype && originalShowNotification) {
      registrationPrototype.showNotification = function(title: string, options?: NotificationOptions) {
        return originalShowNotification.call(this, title, locationAwareNotificationOptions(options, latest));
      };
    }

    const observer = new MutationObserver(() => {
      if (latest?.label) updateVisibleLocation(latest.label, latest.source);
    });
    observer.observe(document.body, { childList: true, subtree: true });
    if (latest?.label) window.setTimeout(() => updateVisibleLocation(latest!.label, latest!.source), 0);

    const refreshIfMoved = () => {
      if (document.visibilityState !== "visible") return;
      locationPromise = null;
      void locate().then((position) => {
        if (!latest) return;
        const moved = distanceKm(latest.latitude, latest.longitude, position.coords.latitude, position.coords.longitude);
        if (moved >= 10) window.location.reload();
      }).catch(() => undefined);
    };
    document.addEventListener("visibilitychange", refreshIfMoved);

    return () => {
      window.fetch = nativeFetch;
      Intl.DateTimeFormat = originalDateTimeFormat;
      if (registrationPrototype && originalShowNotification) registrationPrototype.showNotification = originalShowNotification;
      observer.disconnect();
      document.removeEventListener("visibilitychange", refreshIfMoved);
    };
  }, []);

  return null;
}
