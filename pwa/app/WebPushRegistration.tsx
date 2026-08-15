"use client";

import { useEffect } from "react";

const API_URL = (process.env.NEXT_PUBLIC_PUSH_API_URL || "").replace(/\/$/, "");
const INSTALL_KEY = "wpt-installation-id";
const STATUS_KEY = "wpt-web-push-status";

function base64UrlToUint8Array(value: string) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  return Uint8Array.from([...raw].map((char) => char.charCodeAt(0)));
}

function installationId() {
  const saved = window.localStorage.getItem(INSTALL_KEY);
  if (saved && /^[A-Za-z0-9_-]{16,128}$/.test(saved)) return saved;
  const bytes = new Uint8Array(24);
  window.crypto.getRandomValues(bytes);
  const id = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  window.localStorage.setItem(INSTALL_KEY, id);
  return id;
}

function setStatus(status: string, detail?: string) {
  const payload = { status, detail: detail || "", updatedAt: new Date().toISOString() };
  window.localStorage.setItem(STATUS_KEY, JSON.stringify(payload));
  window.dispatchEvent(new CustomEvent("wopt-web-push-status", { detail: payload }));
}

async function ensureSubscription() {
  if (!API_URL) {
    setStatus("server-not-configured", "Push server URL is not configured in this build.");
    return;
  }
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    setStatus("unsupported", "This browser does not support Web Push.");
    return;
  }
  if (Notification.permission !== "granted") {
    setStatus(Notification.permission === "denied" ? "blocked" : "permission-needed");
    return;
  }

  try {
    setStatus("connecting");
    const registration = await navigator.serviceWorker.ready;
    const configResponse = await fetch(`${API_URL}/config`, { cache: "no-store" });
    if (!configResponse.ok) throw new Error(`Push config ${configResponse.status}`);
    const config = (await configResponse.json()) as { vapidPublicKey?: string };
    if (!config.vapidPublicKey) throw new Error("Push server did not return a VAPID public key");

    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: base64UrlToUint8Array(config.vapidPublicKey),
      });
    }

    const registerResponse = await fetch(`${API_URL}/subscriptions/web`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        installationId: installationId(),
        locale: document.documentElement.lang === "ar" ? "ar" : "en",
        subscription: subscription.toJSON(),
      }),
    });
    if (!registerResponse.ok) throw new Error(`Push registration ${registerResponse.status}`);
    setStatus("connected", "Background prayer notifications are registered on this device.");
  } catch (error) {
    setStatus("error", error instanceof Error ? error.message : "Push registration failed");
  }
}

export default function WebPushRegistration() {
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (cancelled) return;
      await ensureSubscription();
    };

    void run();
    const onVisibility = () => {
      if (document.visibilityState === "visible") void run();
    };
    const onOnline = () => void run();
    const onPermissionRefresh = () => void run();

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("online", onOnline);
    window.addEventListener("wopt-notification-permission-changed", onPermissionRefresh as EventListener);
    const timer = window.setInterval(() => void run(), 6 * 60 * 60 * 1000);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("wopt-notification-permission-changed", onPermissionRefresh as EventListener);
      window.clearInterval(timer);
    };
  }, []);

  return null;
}
