"use client";

import { useEffect } from "react";

const TV_KEY = "hassoun-web-masjid-tv-mode-v4";
const WEB_SESSION_KEY = "hassoun-web-force-website-session";

export default function WebsiteWallDisplaySwitch() {
  useEffect(() => {
    if (location.pathname.includes("/masjid-tv")) return;
    const existing = document.querySelector<HTMLElement>("[data-hassoun-wall-display-switch='1']");
    if (existing) return;

    const button = document.createElement("button");
    button.type = "button";
    button.dataset.hassounWallDisplaySwitch = "1";
    button.innerHTML = `<span style="font-size:19px">▣</span><span><strong style="display:block;font-size:13px">Wall Display</strong><small style="display:block;font-size:10px;opacity:.78">Tablet / TV mode</small></span>`;
    button.setAttribute("aria-label", "Open Tablet Wall Display mode");
    Object.assign(button.style, {
      position: "fixed",
      right: "16px",
      bottom: "84px",
      zIndex: "2147483000",
      display: "flex",
      alignItems: "center",
      gap: "8px",
      padding: "10px 13px",
      borderRadius: "16px",
      border: "1px solid rgba(217,179,107,.72)",
      background: "linear-gradient(145deg,#0c5d4c,#083f35)",
      color: "white",
      boxShadow: "0 10px 28px rgba(0,0,0,.22)",
      cursor: "pointer",
      textAlign: "left"
    });
    button.addEventListener("click", () => {
      try {
        localStorage.setItem(TV_KEY, "enabled");
        sessionStorage.removeItem(WEB_SESSION_KEY);
      } catch {}
      location.href = "/masjid-tv/?mode=tv&activate=1";
    });
    document.body.appendChild(button);
    return () => button.remove();
  }, []);
  return null;
}
