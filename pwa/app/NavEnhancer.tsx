"use client";

import { useEffect } from "react";

export default function NavEnhancer() {
  useEffect(() => {
    if (window.location.pathname !== "/") return;
    const open = new URLSearchParams(window.location.search).get("open");
    if (open !== "alerts" && open !== "settings") return;
    const index = open === "alerts" ? 2 : 3;
    const timer = window.setTimeout(() => {
      const buttons = document.querySelectorAll<HTMLButtonElement>(".mobile-nav button");
      buttons[index]?.click();
      window.history.replaceState({}, "", "/");
    }, 120);
    return () => window.clearTimeout(timer);
  }, []);

  if (typeof window !== "undefined" && window.location.pathname === "/quran") return null;

  return <a className="quran-tab-overlay" href="/quran" aria-label="Open Qur’an"><span aria-hidden="true">۞</span>Qur’an</a>;
}
