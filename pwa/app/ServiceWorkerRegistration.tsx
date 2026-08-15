"use client";

import { useEffect } from "react";

const BASE_PATH = (process.env.NEXT_PUBLIC_BASE_PATH || "").replace(/\/$/, "");

export default function ServiceWorkerRegistration() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    const serviceWorkerUrl = `${BASE_PATH}/sw.js` || "/sw.js";
    const scope = `${BASE_PATH}/` || "/";

    navigator.serviceWorker
      .register(serviceWorkerUrl, { scope, updateViaCache: "none" })
      .then((registration) => registration.update())
      .catch((error) => {
        console.error("WOPT service worker registration failed", error);
      });
  }, []);

  return null;
}
