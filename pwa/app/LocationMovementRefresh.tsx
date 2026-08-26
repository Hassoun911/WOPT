"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

type SavedLocation = {
  latitude: number;
  longitude: number;
  timezone?: string;
  savedAt?: number;
};

const LOCATION_KEY = "hassoun-web-prayer-location-v2";
const MOVE_THRESHOLD_KM = 8;

function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const rad = (value: number) => value * Math.PI / 180;
  const dLat = rad(lat2 - lat1);
  const dLon = rad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function readSavedLocation(): SavedLocation | null {
  try {
    const raw = window.localStorage.getItem(LOCATION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SavedLocation;
    if (!Number.isFinite(parsed.latitude) || !Number.isFinite(parsed.longitude)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeLocation(latitude: number, longitude: number, accuracy?: number) {
  const location = {
    latitude,
    longitude,
    accuracy,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
    savedAt: Date.now(),
  };
  try { window.localStorage.setItem(LOCATION_KEY, JSON.stringify(location)); } catch {}
}

export default function LocationMovementRefresh() {
  const pathname = usePathname();

  useEffect(() => {
    if (pathname !== "/" && pathname !== "") return;
    if (!("geolocation" in navigator)) return;

    let reloading = false;

    const consider = (position: GeolocationPosition) => {
      if (reloading) return;
      const previous = readSavedLocation();
      const { latitude, longitude, accuracy } = position.coords;
      if (!previous) {
        writeLocation(latitude, longitude, accuracy);
        return;
      }
      const moved = distanceKm(previous.latitude, previous.longitude, latitude, longitude);
      if (moved < MOVE_THRESHOLD_KM) return;
      writeLocation(latitude, longitude, accuracy);
      reloading = true;
      window.location.reload();
    };

    const refreshNow = () => {
      navigator.geolocation.getCurrentPosition(
        consider,
        () => undefined,
        { enableHighAccuracy: false, timeout: 10000, maximumAge: 0 },
      );
    };

    refreshNow();
    const watchId = navigator.geolocation.watchPosition(
      consider,
      () => undefined,
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 2 * 60 * 1000 },
    );
    const onVisible = () => {
      if (document.visibilityState === "visible") refreshNow();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", refreshNow);

    return () => {
      navigator.geolocation.clearWatch(watchId);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", refreshNow);
    };
  }, [pathname]);

  return null;
}
