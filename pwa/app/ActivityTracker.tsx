"use client";

import { useEffect } from "react";

const API_URL = "https://wopt-prayer-push.wopt-windsor.workers.dev/activity";
const INSTALL_KEY = "wpt-installation-id";
const LAST_KEY = "hassoun:last-activity-report:v1";

type ActivityKey = "app_open" | "home" | "quran" | "games" | "alerts" | "events" | "more" | "email_alerts";

function installationId() {
  const saved = window.localStorage.getItem(INSTALL_KEY);
  if (saved && /^[A-Za-z0-9_-]{16,128}$/.test(saved)) return saved;
  const bytes = new Uint8Array(24);
  window.crypto.getRandomValues(bytes);
  const id = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  window.localStorage.setItem(INSTALL_KEY, id);
  return id;
}

function classify(target: Element | null): { activity: ActivityKey; detail?: string } | null {
  if (!target) return null;
  const clickable = target.closest("a,button,[role='button']") as HTMLElement | null;
  const href = clickable instanceof HTMLAnchorElement ? clickable.href.toLowerCase() : "";
  const text = (clickable?.innerText || clickable?.getAttribute("aria-label") || "").trim().toLowerCase();
  const value = `${href} ${text}`;
  if (/qur.?an|quran|القرآن/.test(value)) return { activity: "quran", detail: "Opened the Qur’an experience" };
  if (/quiz|game|trivia|imposter|ألعاب|مسابقة/.test(value)) return { activity: "games", detail: "Opened games and learning" };
  if (/islamic event|calendar|event|المناسبات|التقويم/.test(value)) return { activity: "events", detail: "Viewed Islamic events" };
  if (/email alert|email prayer|تنبيهات الصلاة عبر البريد/.test(value)) return { activity: "email_alerts", detail: "Reviewed email prayer alerts" };
  if (/alert|notification|تنبيه/.test(value)) return { activity: "alerts", detail: "Reviewed prayer alerts" };
  if (/settings|more|المزيد|الإعدادات/.test(value)) return { activity: "more", detail: "Opened app settings" };
  if (/home|dashboard|الرئيسية/.test(value)) return { activity: "home", detail: "Viewed the prayer dashboard" };
  return null;
}

async function report(activity: ActivityKey, detail?: string) {
  const now = Date.now();
  try {
    const last = JSON.parse(window.sessionStorage.getItem(LAST_KEY) || "null") as { activity?: string; at?: number } | null;
    if (last?.activity === activity && typeof last.at === "number" && now - last.at < 30_000) return;
  } catch {}
  window.sessionStorage.setItem(LAST_KEY, JSON.stringify({ activity, at: now }));
  await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ installationId: installationId(), activity, detail, platform: "web" }),
    keepalive: true,
  }).catch(() => undefined);
}

export default function ActivityTracker() {
  useEffect(() => {
    void report("app_open", "Opened Hassoun on the web");
    const onClick = (event: MouseEvent) => {
      const found = classify(event.target as Element | null);
      if (found) void report(found.activity, found.detail);
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);
  return null;
}
