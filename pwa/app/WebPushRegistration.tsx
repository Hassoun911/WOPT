"use client";

import { useEffect } from "react";

const API_URL = (process.env.NEXT_PUBLIC_PUSH_API_URL || "").replace(/\/$/, "");
const INSTALL_KEY = "wpt-installation-id";
const STATUS_KEY = "wpt-web-push-status";

function setStatus(status: string, detail?: string) {
  const payload = { status, detail: detail || "", updatedAt: new Date().toISOString() };
  window.localStorage.setItem(STATUS_KEY, JSON.stringify(payload));
  window.dispatchEvent(new CustomEvent("wopt-web-push-status", { detail: payload }));
}

async function disableWebPush() {
  try {
    if ("serviceWorker" in navigator && "PushManager" in window) {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) await subscription.unsubscribe();
    }

    const installationId = window.localStorage.getItem(INSTALL_KEY);
    if (API_URL && installationId && /^[A-Za-z0-9_-]{16,128}$/.test(installationId)) {
      await fetch(`${API_URL}/subscriptions`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ installationId }),
      }).catch(() => undefined);
    }

    setStatus("disabled", "Browser push is disabled. Hassoun notifications are delivered through the native app.");
  } catch (error) {
    setStatus("disabled", "Browser push is disabled.");
  }
}

export default function WebPushRegistration() {
  useEffect(() => {
    void disableWebPush();
  }, []);
  return null;
}
