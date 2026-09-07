"use client";

import { useEffect } from "react";

const STORAGE = "hassoun:web-masjid-tv:v2";
const RELOAD_KEY = "hassoun:tablet-grand-restored:v1";

/**
 * Existing ?mode=tablet links should render the approved Grand Masjid display.
 * The previous full-screen prayer slider in this component overrode that layout.
 */
export default function TabletWallDisplayMode() {
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("mode") !== "tablet") return;

    try {
      const raw = window.localStorage.getItem(STORAGE);
      const saved = raw ? JSON.parse(raw) : {};
      if (saved?.layout !== "grand") {
        window.localStorage.setItem(STORAGE, JSON.stringify({ ...saved, layout: "grand" }));
        if (window.sessionStorage.getItem(RELOAD_KEY) !== "1") {
          window.sessionStorage.setItem(RELOAD_KEY, "1");
          window.location.reload();
          return;
        }
      }
      window.sessionStorage.removeItem(RELOAD_KEY);
    } catch {
      // Keep the normal Masjid TV renderer visible even if storage is unavailable.
    }
  }, []);

  return null;
}
