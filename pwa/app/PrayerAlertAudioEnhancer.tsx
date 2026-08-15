"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

type PrayerKey = "fajr" | "dhuhr" | "asr" | "maghrib" | "isha";
type AlertPrefs = { twenty?: boolean; ten?: boolean; prayer?: boolean };
type PrayerDay = Record<PrayerKey, string>;
type PrayerTimes = Record<string, PrayerDay>;

const DATA_URL = "https://raw.githubusercontent.com/Hassoun911/WOPT/main/windsor_islamic_association_2026_prayer_times.json";
const MUTED_KEY = "wpt-muted-prayers";
const AUDIO = {
  chime: "https://raw.githubusercontent.com/Hassoun911/WOPT/main/mobile/assets/attention_chime.wav",
  fajr: "https://raw.githubusercontent.com/Hassoun911/WOPT/main/mobile/modules/prayer-audio/android/src/main/res/raw/fajr_adhan.mp3",
  adhan: "https://raw.githubusercontent.com/Hassoun911/WOPT/main/mobile/modules/prayer-audio/android/src/main/res/raw/azan9.mp3",
  dua: "https://raw.githubusercontent.com/Hassoun911/WOPT/main/mobile/modules/prayer-audio/android/src/main/res/raw/dua_after_azan.mp3",
};
const PRAYERS: PrayerKey[] = ["fajr", "dhuhr", "asr", "maghrib", "isha"];

function mutedPrayers() {
  try { return new Set<PrayerKey>(JSON.parse(window.localStorage.getItem(MUTED_KEY) || "[]") as PrayerKey[]); }
  catch { return new Set<PrayerKey>(); }
}

function windsorParts(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Toronto", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
  }).formatToParts(now);
  const get = (type: string) => parts.find((part) => part.type === type)?.value || "00";
  return { dateKey: `${get("year")}-${get("month")}-${get("day")}`, seconds: Number(get("hour")) * 3600 + Number(get("minute")) * 60 + Number(get("second")) };
}

function minutesOf(value: string) {
  const [h, m] = value.split(":").map(Number);
  return h * 60 + m;
}

function basePath() {
  if (window.location.pathname === "/WOPT" || window.location.pathname.startsWith("/WOPT/")) return "/WOPT";
  return "";
}

function playFile(player: HTMLAudioElement, src: string) {
  return new Promise<void>((resolve, reject) => {
    player.pause(); player.src = src; player.currentTime = 0; player.volume = 1;
    player.onended = () => resolve(); player.onerror = () => reject(new Error("audio"));
    player.play().catch(reject);
  });
}

export default function PrayerAlertAudioEnhancer() {
  const pathname = usePathname();

  useEffect(() => {
    const isHome = pathname === "/" || pathname === "/WOPT" || pathname === "/WOPT/";
    if (!isHome) return;

    const scopedBase = basePath();
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register(`${scopedBase}/sw.js`, { scope: `${scopedBase || ""}/`, updateViaCache: "none" })
        .then((registration) => registration.update()).catch(() => undefined);
    }

    let prayerTimes: PrayerTimes = {};
    let unlocked = false;
    let busy = false;
    const player = new Audio();
    player.preload = "auto";

    const unlockAudio = () => {
      if (unlocked) return;
      unlocked = true;
      player.src = AUDIO.chime; player.volume = 0;
      void player.play().then(() => { player.pause(); player.currentTime = 0; player.volume = 1; }).catch(() => undefined);
    };
    window.addEventListener("pointerdown", unlockAudio, { once: true, capture: true });
    window.addEventListener("keydown", unlockAudio, { once: true, capture: true });

    const loadSchedule = async () => {
      try {
        const saved = window.localStorage.getItem("wpt-prayer-times");
        if (saved) prayerTimes = JSON.parse(saved) as PrayerTimes;
      } catch { /* ignore */ }
      try {
        const response = await fetch(`${DATA_URL}?v=${Date.now()}`, { cache: "no-store" });
        const data = await response.json() as { prayer_times?: PrayerTimes };
        if (data.prayer_times) prayerTimes = data.prayer_times;
      } catch { /* saved schedule remains available */ }
    };

    const playPrayer = async (prayer: PrayerKey) => {
      if (busy || mutedPrayers().has(prayer)) return;
      busy = true;
      try {
        if (prayer === "fajr") await playFile(player, AUDIO.fajr);
        else { await playFile(player, AUDIO.adhan); await playFile(player, AUDIO.dua); }
      } catch { /* browser policy */ }
      finally { busy = false; }
    };

    const playReminder = async (prayer: PrayerKey) => {
      if (busy || mutedPrayers().has(prayer)) return;
      busy = true;
      try { await playFile(player, AUDIO.chime); } catch { /* browser policy */ }
      finally { busy = false; }
    };

    const check = () => {
      let prefs: AlertPrefs = {};
      try { prefs = JSON.parse(window.localStorage.getItem("wpt-alert-preferences") || "{}") as AlertPrefs; } catch { /* ignore */ }
      if (!prefs.twenty && !prefs.ten && !prefs.prayer) return;
      const muted = mutedPrayers();
      const { dateKey, seconds } = windsorParts();
      const day = prayerTimes[dateKey];
      if (!day) return;

      for (const prayer of PRAYERS) {
        if (muted.has(prayer)) continue;
        const until = minutesOf(day[prayer]) * 60 - seconds;
        const due: Array<{ enabled: boolean | undefined; kind: "twenty" | "ten" | "prayer"; match: boolean }> = [
          { enabled: prefs.twenty, kind: "twenty", match: until <= 1200 && until > 1170 },
          { enabled: prefs.ten, kind: "ten", match: until <= 600 && until > 570 },
          { enabled: prefs.prayer, kind: "prayer", match: until <= 0 && until > -30 },
        ];
        for (const rule of due) {
          if (!rule.enabled || !rule.match) continue;
          const key = `wpt-sound:${dateKey}:${prayer}:${rule.kind}`;
          if (window.localStorage.getItem(key)) continue;
          window.localStorage.setItem(key, "played");
          if (rule.kind === "prayer") void playPrayer(prayer); else void playReminder(prayer);
        }
      }
    };

    void loadSchedule().then(check);
    const timer = window.setInterval(check, 10000);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("pointerdown", unlockAudio, true);
      window.removeEventListener("keydown", unlockAudio, true);
      player.pause(); player.src = "";
    };
  }, [pathname]);

  return null;
}
