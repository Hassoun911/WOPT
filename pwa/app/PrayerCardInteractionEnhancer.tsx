"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

type PrayerKey = "fajr" | "dhuhr" | "asr" | "maghrib" | "isha";

const PRAYERS: PrayerKey[] = ["fajr", "dhuhr", "asr", "maghrib", "isha"];
const MUTED_KEY = "wpt-muted-prayers";
const AUDIO = {
  chime: "https://raw.githubusercontent.com/Hassoun911/WOPT/main/mobile/assets/attention_chime.wav",
  fajr: "https://raw.githubusercontent.com/Hassoun911/WOPT/main/mobile/modules/prayer-audio/android/src/main/res/raw/fajr_adhan.mp3",
  adhan: "https://raw.githubusercontent.com/Hassoun911/WOPT/main/mobile/modules/prayer-audio/android/src/main/res/raw/azan9.mp3",
  dua: "https://raw.githubusercontent.com/Hassoun911/WOPT/main/mobile/modules/prayer-audio/android/src/main/res/raw/dua_after_azan.mp3",
};

function mutedSet() {
  try {
    return new Set<PrayerKey>(JSON.parse(window.localStorage.getItem(MUTED_KEY) || "[]") as PrayerKey[]);
  } catch {
    return new Set<PrayerKey>();
  }
}

function saveMuted(value: Set<PrayerKey>) {
  window.localStorage.setItem(MUTED_KEY, JSON.stringify(Array.from(value)));
  window.dispatchEvent(new CustomEvent("wpt-muted-prayers-change"));
}

function windsorSeconds() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Toronto",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value || 0);
  return get("hour") * 3600 + get("minute") * 60 + get("second");
}

function timeSeconds(value: string) {
  const [hour, minute] = value.split(":").map(Number);
  return hour * 3600 + minute * 60;
}

function playOnce(player: HTMLAudioElement, src: string) {
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

export default function PrayerCardInteractionEnhancer() {
  const pathname = usePathname();

  useEffect(() => {
    const isHome = pathname === "/" || pathname === "/WOPT" || pathname === "/WOPT/";
    if (!isHome) return;

    const style = document.createElement("style");
    style.dataset.woptPrayerInteraction = "true";
    style.textContent = `
      @keyframes woptUrgentPrayerPulse{0%,100%{border-color:#dc2626;box-shadow:0 0 0 0 rgba(220,38,38,.08)}50%{border-color:#ff3b30;box-shadow:0 0 0 5px rgba(220,38,38,.16)}}
      .prayer-card.wopt-prayer-urgent{border:2px solid #dc2626!important;animation:woptUrgentPrayerPulse 1s ease-in-out infinite!important}
      .prayer-card.wopt-prayer-muted{opacity:.66;position:relative}.prayer-card.wopt-prayer-muted:after{content:"🔇";position:absolute;top:10px;right:12px;font-size:15px;line-height:1}.app-shell[dir='rtl'] .prayer-card.wopt-prayer-muted:after{right:auto;left:12px}
      .prayer-card.wopt-longpress-ready{transform:scale(.985);transition:transform .12s ease}
      .wopt-mute-toast{position:fixed;z-index:3000;left:50%;bottom:max(90px,calc(env(safe-area-inset-bottom) + 80px));transform:translate(-50%,12px);padding:10px 14px;border-radius:999px;background:#173e35;color:#fff;font:700 12px/1.2 Arial,sans-serif;box-shadow:0 10px 35px rgba(0,0,0,.2);opacity:0;pointer-events:none;transition:.18s ease}.wopt-mute-toast.show{opacity:1;transform:translate(-50%,0)}
      .wopt-sound-test{padding:14px!important;display:block!important}.wopt-sound-test-head{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:10px}.wopt-sound-test-head strong{font-size:14px}.wopt-sound-test-head span{font-size:11px;color:#71807b}.wopt-sound-test-buttons{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.wopt-sound-test-buttons button{min-height:42px;border:1px solid rgba(17,94,76,.18);border-radius:12px;background:#f5faf8;color:#0b5b47;font-weight:800;font-size:11px}.wopt-sound-test-buttons button.playing{background:#0b5b47;color:#fff}
      @media(max-width:560px){.wopt-sound-test-buttons{grid-template-columns:1fr}.wopt-sound-test-buttons button{min-height:40px}}
    `;
    document.head.appendChild(style);

    const toast = document.createElement("div");
    toast.className = "wopt-mute-toast";
    document.body.appendChild(toast);
    let toastTimer = 0;
    const showToast = (text: string) => {
      toast.textContent = text;
      toast.classList.add("show");
      window.clearTimeout(toastTimer);
      toastTimer = window.setTimeout(() => toast.classList.remove("show"), 1700);
    };

    const player = new Audio();
    player.preload = "auto";
    let testBusy = false;

    const testSound = async (kind: "chime" | "fajr" | "adhan", button: HTMLButtonElement) => {
      if (testBusy) {
        player.pause();
        player.currentTime = 0;
        testBusy = false;
        document.querySelectorAll(".wopt-sound-test-buttons button").forEach((item) => item.classList.remove("playing"));
        return;
      }
      testBusy = true;
      button.classList.add("playing");
      try {
        if (kind === "chime") await playOnce(player, AUDIO.chime);
        if (kind === "fajr") await playOnce(player, AUDIO.fajr);
        if (kind === "adhan") {
          await playOnce(player, AUDIO.adhan);
          await playOnce(player, AUDIO.dua);
        }
      } catch {
        showToast("Tap once, then try the sound again");
      } finally {
        testBusy = false;
        button.classList.remove("playing");
      }
    };

    const ensureSoundTests = () => {
      const stack = document.querySelector<HTMLElement>(".alerts-stack");
      if (!stack || stack.querySelector(".wopt-sound-test")) return;
      const card = document.createElement("div");
      card.className = "setting-card wopt-sound-test";
      card.innerHTML = `<div class="wopt-sound-test-head"><strong>Test alert sounds</strong><span>Tap to preview</span></div><div class="wopt-sound-test-buttons"><button type="button" data-test="chime">▶ Chime</button><button type="button" data-test="fajr">▶ Fajr Adhan</button><button type="button" data-test="adhan">▶ Adhan + Dua</button></div>`;
      const note = stack.querySelector(".sheet-note");
      if (note) stack.insertBefore(card, note); else stack.appendChild(card);
      card.addEventListener("click", (event) => {
        const button = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-test]");
        if (!button) return;
        void testSound(button.dataset.test as "chime" | "fajr" | "adhan", button);
      });
    };

    const pressTimers = new WeakMap<HTMLElement, number>();
    const clearPress = (card: HTMLElement) => {
      const timer = pressTimers.get(card);
      if (timer) window.clearTimeout(timer);
      pressTimers.delete(card);
      card.classList.remove("wopt-longpress-ready");
    };

    const wireCards = () => {
      const cards = Array.from(document.querySelectorAll<HTMLElement>(".prayer-grid .prayer-card"));
      const muted = mutedSet();
      cards.forEach((card, index) => {
        const prayer = PRAYERS[index];
        if (!prayer) return;
        card.dataset.woptPrayer = prayer;
        card.classList.toggle("wopt-prayer-muted", muted.has(prayer));
        if (card.dataset.woptLongpress === "1") return;
        card.dataset.woptLongpress = "1";
        card.addEventListener("pointerdown", () => {
          card.classList.add("wopt-longpress-ready");
          const timer = window.setTimeout(() => {
            const current = mutedSet();
            const willMute = !current.has(prayer);
            if (willMute) current.add(prayer); else current.delete(prayer);
            saveMuted(current);
            card.classList.toggle("wopt-prayer-muted", willMute);
            if (navigator.vibrate) navigator.vibrate(35);
            showToast(`${willMute ? "Muted" : "Unmuted"} ${prayer.charAt(0).toUpperCase()}${prayer.slice(1)} alerts`);
            clearPress(card);
          }, 650);
          pressTimers.set(card, timer);
        });
        ["pointerup", "pointercancel", "pointerleave"].forEach((name) => card.addEventListener(name, () => clearPress(card)));
      });
    };

    const updateUrgent = () => {
      const now = windsorSeconds();
      document.querySelectorAll<HTMLElement>(".prayer-grid .prayer-card").forEach((card) => {
        const time = card.querySelector<HTMLTimeElement>("time[datetime]")?.dateTime || "";
        const until = time ? timeSeconds(time) - now : Number.POSITIVE_INFINITY;
        const urgent = card.classList.contains("active") && until > 0 && until <= 600;
        card.classList.toggle("wopt-prayer-urgent", urgent);
      });
    };

    // Suppress service-worker notifications for prayers muted by long-press.
    const proto = typeof ServiceWorkerRegistration !== "undefined" ? ServiceWorkerRegistration.prototype : null;
    const originalShow = proto?.showNotification;
    if (proto && originalShow) {
      proto.showNotification = function(title: string, options?: NotificationOptions) {
        const tag = options?.tag || "";
        const prayer = PRAYERS.find((key) => tag.includes(`:${key}:`));
        if (prayer && mutedSet().has(prayer)) return Promise.resolve();
        return originalShow.call(this, title, options);
      };
    }

    wireCards();
    updateUrgent();
    ensureSoundTests();
    const timer = window.setInterval(() => {
      wireCards();
      updateUrgent();
      ensureSoundTests();
    }, 500);

    const onMutedChange = () => wireCards();
    window.addEventListener("wpt-muted-prayers-change", onMutedChange);

    return () => {
      window.clearInterval(timer);
      window.clearTimeout(toastTimer);
      window.removeEventListener("wpt-muted-prayers-change", onMutedChange);
      if (proto && originalShow) proto.showNotification = originalShow;
      player.pause();
      player.src = "";
      toast.remove();
      style.remove();
    };
  }, [pathname]);

  return null;
}
