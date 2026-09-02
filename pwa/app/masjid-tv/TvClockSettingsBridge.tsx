"use client";

import { useEffect } from "react";

function isTvRoute() {
  const p = window.location.pathname.replace(/\/+$/, "").toLowerCase();
  return p === "/masjid-tv";
}

export default function TvClockSettingsBridge() {
  useEffect(() => {
    if (!isTvRoute()) return;

    const onClick = (event: MouseEvent) => {
      const target = event.target as Element | null;
      if (!target) return;
      const smartClock = target.closest("[data-smart-grand-v2='1'] .sg-clock");
      if (!smartClock) return;

      event.preventDefault();
      event.stopPropagation();

      const nativeClock = document.querySelector<HTMLButtonElement>(".webtv-shell .tv-clock");
      nativeClock?.click();
    };

    const keepInteractive = () => {
      const smartRoot = document.querySelector<HTMLElement>("[data-smart-grand-v2='1']");
      if (smartRoot) {
        smartRoot.style.setProperty("z-index", "40", "important");
        const clock = smartRoot.querySelector<HTMLElement>(".sg-clock");
        if (clock) {
          clock.style.setProperty("pointer-events", "auto", "important");
          clock.style.setProperty("cursor", "pointer", "important");
        }
      }

      const modal = document.querySelector<HTMLElement>(".webtv-admin-backdrop");
      if (modal) {
        modal.style.setProperty("z-index", "2147483646", "important");
        modal.style.setProperty("pointer-events", "auto", "important");
        modal.style.setProperty("visibility", "visible", "important");
        modal.style.setProperty("opacity", "1", "important");
      }
    };

    document.addEventListener("click", onClick, true);
    keepInteractive();
    const timer = window.setInterval(keepInteractive, 250);
    const observer = new MutationObserver(keepInteractive);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["style", "class"] });

    return () => {
      document.removeEventListener("click", onClick, true);
      window.clearInterval(timer);
      observer.disconnect();
    };
  }, []);

  return null;
}
