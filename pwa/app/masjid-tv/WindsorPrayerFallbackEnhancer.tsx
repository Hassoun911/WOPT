"use client";

import { useEffect } from "react";

const STORAGE = "hassoun:web-masjid-tv:v2";
const DATA_URL = "https://raw.githubusercontent.com/Hassoun911/WOPT/main/windsor_islamic_association_2026_prayer_times.json";
const PRAYERS = ["fajr", "dhuhr", "asr", "maghrib", "isha"] as const;

function dateKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function WindsorPrayerFallbackEnhancer() {
  useEffect(() => {
    let cancelled = false;

    const hydrate = async () => {
      try {
        const raw = localStorage.getItem(STORAGE) || "{}";
        const settings = JSON.parse(raw) as Record<string, any>;
        const today = dateKey();
        const existing = settings?.prayerSchedule?.[today]?.adhan || {};
        const alreadyComplete = PRAYERS.every(p => String(existing?.[p] || "").trim());
        if (alreadyComplete) return;

        const res = await fetch(DATA_URL, { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json() as { prayer_times?: Record<string, Record<string, string>> };
        const row = data.prayer_times?.[today];
        if (!row || cancelled) return;

        const adhan: Record<string, string> = {};
        for (const p of PRAYERS) adhan[p] = String(row[p] || "");

        const prayerSchedule = { ...(settings.prayerSchedule || {}) };
        const currentDay = prayerSchedule[today] || {};
        prayerSchedule[today] = {
          ...currentDay,
          adhan: { ...adhan, ...(currentDay.adhan || {}) },
        };

        const next = {
          ...settings,
          prayerSchedule,
          mosqueLocation: String(settings.mosqueLocation || "").trim() || "Windsor, ON",
          prayerSource: settings.prayerSource || "Windsor Islamic Association 2026",
        };

        localStorage.setItem(STORAGE, JSON.stringify(next));
        window.dispatchEvent(new StorageEvent("storage", { key: STORAGE, newValue: JSON.stringify(next) }));
      } catch {
        // Keep the TV usable even if the fallback source is temporarily unavailable.
      }
    };

    void hydrate();
    const timer = window.setInterval(() => void hydrate(), 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  return null;
}
