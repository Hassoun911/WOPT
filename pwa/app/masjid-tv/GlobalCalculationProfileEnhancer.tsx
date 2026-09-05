"use client";

import { useEffect } from "react";

const STORAGE = "hassoun:web-masjid-tv:v2";
const PRAYERS = ["fajr", "dhuhr", "asr", "maghrib", "isha"] as const;

type Offsets = { fajr?: number; dhuhr?: number; asr?: number; maghrib?: number; isha?: number };

function dateKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function smartMethod(latitude: number, longitude: number) {
  if (latitude >= 16 && latitude <= 33 && longitude >= 34 && longitude <= 56) return 4;
  if (latitude >= 20 && latitude <= 33 && longitude >= 24 && longitude <= 37) return 5;
  if (latitude >= 5 && latitude <= 38 && longitude >= 60 && longitude <= 93) return 1;
  if (latitude >= 15 && latitude <= 72 && longitude >= -170 && longitude <= -50) return 2;
  return 3;
}

function tune(offsets: Offsets = {}) {
  return [offsets.fajr || 0, 0, offsets.dhuhr || 0, offsets.asr || 0, 0, offsets.maghrib || 0, offsets.isha || 0, 0, 0].join(",");
}

function normalize(timings: Record<string, string>) {
  const clean = (value?: string) => String(value || "").replace(/\s*\([^)]*\)\s*$/, "").trim();
  return {
    fajr: clean(timings.Fajr),
    dhuhr: clean(timings.Dhuhr),
    asr: clean(timings.Asr),
    maghrib: clean(timings.Maghrib),
    isha: clean(timings.Isha)
  };
}

export default function GlobalCalculationProfileEnhancer() {
  useEffect(() => {
    let stopped = false;

    const apply = async () => {
      if (stopped || !location.pathname.includes("/masjid-tv") || location.pathname.includes("/devices")) return;
      let settings: Record<string, any> = {};
      try { settings = JSON.parse(localStorage.getItem(STORAGE) || "{}"); } catch { return; }

      const city = String(settings.prayerCity || settings.mosqueLocation || "").toLowerCase();
      const mosque = String(settings.selectedMosqueName || settings.mosqueName || "").toLowerCase();
      const isWindsorOfficial = city.includes("windsor") || mosque.includes("al hijra") || mosque.includes("windsor islamic");
      if (isWindsorOfficial || settings.prayerSourceMode === "manual") return;

      const latitude = Number(settings.prayerLatitude);
      const longitude = Number(settings.prayerLongitude);
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;

      const mode = settings.calculationMode === "manual" ? "manual" : "smart";
      const method = mode === "smart" ? smartMethod(latitude, longitude) : Number(settings.calculationMethod || 2);
      const school = Number(settings.calculationSchool) === 1 ? 1 : 0;
      const highLatitude = [0, 1, 2, 3].includes(Number(settings.calculationHighLatitude)) ? Number(settings.calculationHighLatitude) : 3;
      const offsets = (settings.calculationOffsets || {}) as Offsets;

      const stamp = Math.floor(Date.now() / 1000);
      const url = new URL(`https://api.aladhan.com/v1/timings/${stamp}`);
      url.searchParams.set("latitude", String(latitude));
      url.searchParams.set("longitude", String(longitude));
      url.searchParams.set("method", String(method));
      url.searchParams.set("school", String(school));
      url.searchParams.set("latitudeAdjustmentMethod", String(highLatitude));
      url.searchParams.set("tune", tune(offsets));

      try {
        const response = await fetch(url.toString(), { cache: "no-store" });
        if (!response.ok) return;
        const payload = await response.json();
        const adhan = normalize(payload?.data?.timings || {});
        if (!PRAYERS.every((prayer) => adhan[prayer])) return;

        const today = dateKey();
        const prayerSchedule = { ...(settings.prayerSchedule || {}) };
        prayerSchedule[today] = { ...(prayerSchedule[today] || {}), adhan };
        const next = {
          ...settings,
          prayerSchedule,
          calculationMethodResolved: method,
          prayerSourceResolved: `Calculated with Hassoun profile · method ${method} · ${school === 1 ? "Hanafi" : "Standard"} Asr`
        };
        localStorage.setItem(STORAGE, JSON.stringify(next));
        window.dispatchEvent(new StorageEvent("storage", { key: STORAGE, newValue: JSON.stringify(next) }));
      } catch {}
    };

    void apply();
    const timer = window.setInterval(() => { void apply(); }, 60000);
    return () => { stopped = true; window.clearInterval(timer); };
  }, []);

  return null;
}
