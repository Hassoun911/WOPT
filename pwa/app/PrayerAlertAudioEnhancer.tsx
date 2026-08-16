"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

type PrayerKey = "fajr" | "dhuhr" | "asr" | "maghrib" | "isha";
type AlertPrefs = { twenty?: boolean; ten?: boolean; prayer?: boolean };
type PrayerDay = Record<PrayerKey, string>;
type PrayerTimes = Record<string, PrayerDay>;
type AlertKind = "twenty" | "ten" | "prayer";
type PushAudioMessage = {
  type?: string;
  eventId?: string;
  dateKey?: string;
  prayer?: PrayerKey;
  kind?: "twenty" | "ten" | "athan" | "prayer";
  receivedAtMs?: number;
};

const DATA_URL = "https://raw.githubusercontent.com/Hassoun911/WOPT/main/windsor_islamic_association_2026_prayer_times.json";
const MUTED_KEY = "wpt-muted-prayers";
const AUDIO = {
  chime: "https://raw.githubusercontent.com/Hassoun911/WOPT/main/mobile/assets/attention_chime.wav",
  fajr: "https://raw.githubusercontent.com/Hassoun911/WOPT/main/mobile/modules/prayer-audio/android/src/main/res/raw/fajr_adhan.mp3",
  adhan: "https://raw.githubusercontent.com/Hassoun911/WOPT/main/mobile/modules/prayer-audio/android/src/main/res/raw/azan9.mp3",
  dua: "https://raw.githubusercontent.com/Hassoun911/WOPT/main/mobile/modules/prayer-audio/android/src/main/res/raw/dua_after_azan.mp3",
};
const PRAYERS: PrayerKey[] = ["fajr", "dhuhr", "asr", "maghrib", "isha"];
const PRAYER_NAMES: Record<PrayerKey, string> = {
  fajr: "Fajr",
  dhuhr: "Dhuhr",
  asr: "Asr",
  maghrib: "Maghrib",
  isha: "Isha",
};

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
    player.pause();
    player.src = src;
    player.currentTime = 0;
    player.volume = 1;
    player.onended = () => resolve();
    player.onerror = () => reject(new Error("audio"));
    player.play().catch(reject);
  });
}

async function showLocalNotification(prayer: PrayerKey, kind: AlertKind, time: string, scopedBase: string) {
  if (!("Notification" in window) || Notification.permission !== "granted" || !("serviceWorker" in navigator)) return;
  try {
    const registration = await navigator.serviceWorker.ready;
    const name = PRAYER_NAMES[prayer];
    const title = kind === "prayer" ? `${name} prayer time` : `${name} reminder`;
    const body = kind === "prayer"
      ? `${name} is now (${time}) in Windsor.`
      : `${kind === "twenty" ? "20" : "10"} minutes until ${name} (${time}).`;
    await registration.showNotification(title, {
      body,
      icon: `${scopedBase}/icon-192.png` || "/icon-192.png",
      badge: `${scopedBase}/notification-badge.png` || "/notification-badge.png",
      tag: `wopt-local-${prayer}-${kind}`,
      renotify: true,
      silent: false,
      vibrate: kind === "prayer" ? [300, 120, 300] : [180, 100, 180],
      requireInteraction: kind === "prayer",
      data: { url: `${scopedBase}/` || "/", prayer, kind },
    });
  } catch {
    // Audio alert can still continue if notification display fails.
  }
}

export default function PrayerAlertAudioEnhancer() {
  const pathname = usePathname();

  useEffect(() => {
    const scopedBase = basePath();
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register(`${scopedBase}/sw.js`, { scope: `${scopedBase || ""}/`, updateViaCache: "none" })
        .then((registration) => registration.update()).catch(() => undefined);
    }

    let prayerTimes: PrayerTimes = {};
    let unlocked = false;
    let busy = false;
    let visibleSince = windsorParts();
    const player = new Audio();
    player.preload = "auto";

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") visibleSince = windsorParts();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    const unlockAudio = () => {
      if (unlocked) return;
      unlocked = true;
      player.src = AUDIO.chime;
      player.volume = 0;
      void player.play().then(() => {
        player.pause();
        player.currentTime = 0;
        player.volume = 1;
      }).catch(() => undefined);
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
      if (busy || mutedPrayers().has(prayer) || document.visibilityState !== "visible") return;
      busy = true;
      try {
        if (prayer === "fajr") await playFile(player, AUDIO.fajr);
        else {
          await playFile(player, AUDIO.adhan);
          await playFile(player, AUDIO.dua);
        }
      } catch { /* browser autoplay policy can still prevent foreground audio */ }
      finally { busy = false; }
    };

    const playReminder = async (prayer: PrayerKey) => {
      if (busy || mutedPrayers().has(prayer) || document.visibilityState !== "visible") return;
      busy = true;
      try { await playFile(player, AUDIO.chime); }
      catch { /* browser autoplay policy can still prevent foreground audio */ }
      finally { busy = false; }
    };

    const prefsAllow = (kind: AlertKind) => {
      let prefs: AlertPrefs = {};
      try { prefs = JSON.parse(window.localStorage.getItem("wpt-alert-preferences") || "{}") as AlertPrefs; }
      catch { /* ignore */ }
      return kind === "twenty" ? Boolean(prefs.twenty) : kind === "ten" ? Boolean(prefs.ten) : Boolean(prefs.prayer);
    };

    const markAndPlay = (prayer: PrayerKey, kind: AlertKind, dateKey: string, receivedAtMs?: number) => {
      if (document.visibilityState !== "visible") return;
      if (receivedAtMs && Date.now() - receivedAtMs > 15000) return;
      if (!prefsAllow(kind) || mutedPrayers().has(prayer)) return;
      const key = `wpt-sound:${dateKey}:${prayer}:${kind}`;
      if (window.localStorage.getItem(key)) return;
      window.localStorage.setItem(key, "played");
      if (kind === "prayer") void playPrayer(prayer);
      else void playReminder(prayer);
    };

    const onServiceWorkerMessage = (event: MessageEvent<PushAudioMessage>) => {
      const data = event.data;
      if (!data || data.type !== "wopt-prayer-push" || !data.prayer || !PRAYERS.includes(data.prayer)) return;
      const kind: AlertKind | null = data.kind === "athan" || data.kind === "prayer"
        ? "prayer"
        : data.kind === "twenty"
          ? "twenty"
          : data.kind === "ten"
            ? "ten"
            : null;
      if (!kind) return;
      markAndPlay(data.prayer, kind, data.dateKey || windsorParts().dateKey, data.receivedAtMs);
    };
    navigator.serviceWorker?.addEventListener("message", onServiceWorkerMessage);

    const check = () => {
      if (document.visibilityState !== "visible") return;
      let prefs: AlertPrefs = {};
      try { prefs = JSON.parse(window.localStorage.getItem("wpt-alert-preferences") || "{}") as AlertPrefs; }
      catch { /* ignore */ }
      if (!prefs.twenty && !prefs.ten && !prefs.prayer) return;
      const muted = mutedPrayers();
      const { dateKey, seconds } = windsorParts();
      const day = prayerTimes[dateKey];
      if (!day) return;

      for (const prayer of PRAYERS) {
        if (muted.has(prayer)) continue;
        const prayerSeconds = minutesOf(day[prayer]) * 60;
        const until = prayerSeconds - seconds;
        const due: Array<{ enabled: boolean | undefined; kind: AlertKind; match: boolean; scheduledSeconds: number }> = [
          { enabled: prefs.twenty, kind: "twenty", match: until <= 1200 && until > 1170, scheduledSeconds: prayerSeconds - 1200 },
          { enabled: prefs.ten, kind: "ten", match: until <= 600 && until > 570, scheduledSeconds: prayerSeconds - 600 },
          { enabled: prefs.prayer, kind: "prayer", match: until <= 0 && until > -30, scheduledSeconds: prayerSeconds },
        ];
        for (const rule of due) {
          if (!rule.enabled || !rule.match) continue;
          // Never back-fill an alert that became due while the PWA was hidden.
          if (visibleSince.dateKey === dateKey && rule.scheduledSeconds < visibleSince.seconds) continue;
          const key = `wpt-sound:${dateKey}:${prayer}:${rule.kind}`;
          if (window.localStorage.getItem(key)) continue;
          window.localStorage.setItem(key, "played");
          void showLocalNotification(prayer, rule.kind, day[prayer], scopedBase);
          if (rule.kind === "prayer") void playPrayer(prayer);
          else void playReminder(prayer);
        }
      }
    };

    void loadSchedule().then(check);
    const timer = window.setInterval(check, 10000);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pointerdown", unlockAudio, true);
      window.removeEventListener("keydown", unlockAudio, true);
      navigator.serviceWorker?.removeEventListener("message", onServiceWorkerMessage);
      player.pause();
      player.src = "";
    };
  }, [pathname]);

  return null;
}
