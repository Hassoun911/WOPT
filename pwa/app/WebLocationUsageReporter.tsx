"use client";

import { useEffect } from "react";

const API = "https://wopt-prayer-push.wopt-windsor.workers.dev/location-usage";
const LOCATION_KEY = "hassoun-web-prayer-location-v2";
const LOCATION_TIMES_KEY = "hassoun-web-location-prayer-times-v2";
const LAST_SENT_KEY = "hassoun:web-location-usage:last:v1";
const SEND_INTERVAL = 10 * 60 * 1000;

type CachedLocation = { latitude?: number; longitude?: number; timezone?: string };
type CachedPrayer = { location?: CachedLocation; placeLabel?: string };

function readPayload() {
  try {
    const cached = JSON.parse(localStorage.getItem(LOCATION_TIMES_KEY) || "null") as CachedPrayer | null;
    const location = cached?.location || JSON.parse(localStorage.getItem(LOCATION_KEY) || "null") as CachedLocation | null;
    if (!location || !Number.isFinite(location.latitude) || !Number.isFinite(location.longitude)) return null;
    return {
      latitude: location.latitude,
      longitude: location.longitude,
      timezone: location.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
      placeLabel: cached?.placeLabel || "",
      platform: "web"
    };
  } catch {
    return null;
  }
}

export default function WebLocationUsageReporter() {
  useEffect(() => {
    let cancelled = false;
    const report = async (force = false) => {
      if (cancelled || !navigator.onLine) return;
      const payload = readPayload();
      if (!payload) return;
      const last = Number(localStorage.getItem(LAST_SENT_KEY) || 0);
      if (!force && Date.now() - last < SEND_INTERVAL) return;
      const controller = new AbortController();
      const timer = window.setTimeout(() => controller.abort(), 2000);
      try {
        const response = await fetch(API, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          signal: controller.signal,
          keepalive: true
        });
        if (response.ok) localStorage.setItem(LAST_SENT_KEY, String(Date.now()));
      } catch {
        // Analytics must never block or break prayer-time rendering.
      } finally {
        window.clearTimeout(timer);
      }
    };

    const first = window.setTimeout(() => void report(false), 1200);
    const interval = window.setInterval(() => void report(false), SEND_INTERVAL);
    const online = () => void report(true);
    const visible = () => { if (document.visibilityState === "visible") void report(false); };
    window.addEventListener("online", online);
    document.addEventListener("visibilitychange", visible);
    return () => {
      cancelled = true;
      window.clearTimeout(first);
      window.clearInterval(interval);
      window.removeEventListener("online", online);
      document.removeEventListener("visibilitychange", visible);
    };
  }, []);

  return null;
}
