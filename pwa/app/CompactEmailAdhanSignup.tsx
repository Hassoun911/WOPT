"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const API = "https://wopt-prayer-push.wopt-windsor.workers.dev";
const LOCATION_KEY = "hassoun-web-prayer-location-v2";

function readLocation() {
  try {
    const raw = window.localStorage.getItem(LOCATION_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as { latitude?: number; longitude?: number; timezone?: string };
    if (!Number.isFinite(value.latitude) || !Number.isFinite(value.longitude)) return null;
    return { latitude: Number(value.latitude), longitude: Number(value.longitude), timezone: value.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC" };
  } catch { return null; }
}

function getLocation(): Promise<{ latitude: number; longitude: number; timezone: string }> {
  const cached = readLocation();
  if (cached) return Promise.resolve(cached);
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) return reject(new Error("Location is unavailable"));
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"
      }),
      reject,
      { enableHighAccuracy: false, timeout: 12000, maximumAge: 15 * 60 * 1000 }
    );
  });
}

export default function CompactEmailAdhanSignup() {
  const pathname = usePathname();

  useEffect(() => {
    if (pathname !== "/" && pathname !== "") return;
    const prayerSection = document.querySelector<HTMLElement>(".prayer-section");
    if (!prayerSection || document.querySelector("[data-hassoun-email-adhan-signup]")) return;

    const section = document.createElement("section");
    section.dataset.hassounEmailAdhanSignup = "true";
    section.style.cssText = "margin:14px auto 2px;max-width:980px;padding:0 18px;box-sizing:border-box";
    section.innerHTML = `
      <div style="background:#edf5f1;border:1px solid #d5e4dd;border-radius:18px;padding:13px 14px;display:flex;gap:12px;align-items:center;box-shadow:0 5px 16px rgba(14,79,62,.05)">
        <div style="width:38px;height:38px;flex:0 0 38px;border-radius:12px;background:#0b5b47;color:#fff;display:grid;place-items:center;font-size:20px">🔔</div>
        <div style="min-width:0;flex:1">
          <strong style="display:block;color:#16483b;font-size:14px;line-height:1.2">Adhan-time reminders by email</strong>
          <span style="display:block;color:#6d817a;font-size:10px;margin-top:3px;line-height:1.35">A gentle da‘wah to protect your salah • تذكير لطيف بالصلاة</span>
        </div>
        <form data-email-form style="display:flex;gap:7px;align-items:center;flex:0 1 390px;min-width:0">
          <input data-email type="email" autocomplete="email" required placeholder="Your email" aria-label="Email address" style="min-width:0;flex:1;height:38px;border:1px solid #c9d9d2;border-radius:11px;background:#fff;padding:0 11px;color:#173f35;font-size:12px;outline:none" />
          <button type="submit" style="height:38px;white-space:nowrap;border:0;border-radius:11px;background:#0b5b47;color:#fff;font-weight:800;font-size:11px;padding:0 13px;cursor:pointer">Get reminders</button>
        </form>
      </div>
      <p data-email-status style="display:none;margin:6px 10px 0;color:#557169;font-size:10px"></p>`;

    prayerSection.insertAdjacentElement("afterend", section);
    const form = section.querySelector<HTMLFormElement>("[data-email-form]");
    const input = section.querySelector<HTMLInputElement>("[data-email]");
    const button = form?.querySelector<HTMLButtonElement>("button");
    const status = section.querySelector<HTMLElement>("[data-email-status]");
    if (!form || !input || !button || !status) return;

    const onSubmit = async (event: Event) => {
      event.preventDefault();
      const email = input.value.trim();
      if (!email) return;
      button.disabled = true;
      button.textContent = "Sending…";
      status.style.display = "block";
      status.style.color = "#557169";
      status.textContent = "Using your current location for the correct prayer times…";
      try {
        const location = await getLocation();
        const prayers = Object.fromEntries(["fajr", "dhuhr", "asr", "maghrib", "isha"].map((prayer) => [prayer, { twenty: false, ten: false, athan: true }]));
        const response = await fetch(`${API}/email/subscribers`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email,
            locale: document.documentElement.lang === "ar" ? "ar" : "en",
            ...location,
            calculationMethod: 3,
            madhab: "standard",
            preferences: { prayerAlerts: true, dailyPrayerSchedule: false, religiousOccasions: false, dailyContent: false, announcements: false, communityEvents: false, marketing: false },
            prayers
          })
        });
        const body = await response.json().catch(() => ({})) as { error?: string; alreadySubscribed?: boolean };
        if (!response.ok) throw new Error(body.error || "Unable to subscribe");
        status.style.color = "#0b6f52";
        status.textContent = body.alreadySubscribed ? "You’re already subscribed — we sent you a secure manage link." : "Check your email to confirm your Adhan-time reminders.";
        input.value = "";
      } catch (error) {
        status.style.color = "#9b3e35";
        status.textContent = error instanceof Error ? error.message : "Unable to subscribe right now.";
      } finally {
        button.disabled = false;
        button.textContent = "Get reminders";
      }
    };
    form.addEventListener("submit", onSubmit);

    const media = window.matchMedia("(max-width: 720px)");
    const applyMobile = () => {
      const card = section.firstElementChild as HTMLElement | null;
      if (!card) return;
      if (media.matches) {
        card.style.flexWrap = "wrap";
        form.style.flexBasis = "100%";
        form.style.width = "100%";
      } else {
        card.style.flexWrap = "nowrap";
        form.style.flexBasis = "390px";
        form.style.width = "auto";
      }
    };
    applyMobile();
    media.addEventListener?.("change", applyMobile);

    return () => {
      form.removeEventListener("submit", onSubmit);
      media.removeEventListener?.("change", applyMobile);
      section.remove();
    };
  }, [pathname]);

  return null;
}
