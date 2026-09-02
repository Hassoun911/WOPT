"use client";

import { useEffect } from "react";

function isTvRoute() {
  const p = window.location.pathname.replace(/\/+$/, "").toLowerCase();
  return p === "/masjid-tv";
}

export default function TvDisplayVisibilityGuard() {
  useEffect(() => {
    if (!isTvRoute()) return;

    const forceVisible = () => {
      const shell = document.querySelector<HTMLElement>(".webtv-shell");
      if (!shell) return;

      shell.style.setProperty("display", "block", "important");
      shell.style.setProperty("visibility", "visible", "important");
      shell.style.setProperty("opacity", "1", "important");
      shell.style.setProperty("position", "fixed", "important");
      shell.style.setProperty("inset", "0", "important");
      shell.style.setProperty("width", "100vw", "important");
      shell.style.setProperty("height", "100vh", "important");
      shell.style.setProperty("z-index", "1", "important");

      shell.querySelectorAll<HTMLElement>(".template,[data-smart-grand-v2='1']").forEach(el => {
        el.style.setProperty("visibility", "visible", "important");
        el.style.setProperty("opacity", "1", "important");
      });

      shell.querySelectorAll<HTMLElement>("[data-hassoun-tv-hidden]").forEach(el => {
        el.removeAttribute("data-hassoun-tv-hidden");
        el.style.removeProperty("display");
        el.style.removeProperty("visibility");
        el.style.removeProperty("opacity");
      });
    };

    forceVisible();
    const timer = window.setInterval(forceVisible, 250);
    const observer = new MutationObserver(forceVisible);
    observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ["style", "class", "data-hassoun-tv-hidden"] });
    return () => {
      window.clearInterval(timer);
      observer.disconnect();
    };
  }, []);

  return null;
}
