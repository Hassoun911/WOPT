"use client";

import { useEffect } from "react";

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || "";
const appPath = (path: string) => `${BASE_PATH}${path}`;

function makeCard(href: string, title: string, subtitle: string, icon: string, key: string) {
  const a = document.createElement("a");
  a.href = href;
  a.dataset.hassounDisplaySettingsCard = key;
  a.innerHTML = `<span aria-hidden="true" style="font-size:22px;width:34px;text-align:center;color:#0b5b47">${icon}</span><span style="min-width:0"><strong style="display:block;font-size:14px;color:#17362e">${title}</strong><small style="display:block;margin-top:3px;color:#71827c;font-size:11px">${subtitle}</small></span><span aria-hidden="true" style="margin-left:auto;font-size:20px;color:#17362e">›</span>`;
  Object.assign(a.style, {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    margin: "10px 0 0",
    padding: "15px 16px",
    border: "1px solid #c8d8d0",
    borderRadius: "15px",
    background: "#edf5f1",
    color: "#17362e",
    textDecoration: "none",
    boxShadow: "0 8px 24px rgba(11,91,71,.06)"
  });
  return a;
}

export default function AppSettingsDisplayLinks() {
  useEffect(() => {
    const inject = () => {
      const all = Array.from(document.querySelectorAll<HTMLElement>("a,button,[role=button],div"));
      const tv = all.find(el => {
        const t = (el.textContent || "").replace(/\s+/g, " ").trim();
        return t.includes("Masjid TV / Big Screen") && t.includes("TVs auto-detect");
      });
      if (!tv) return;

      const card = (tv.closest("a") as HTMLElement | null) || tv;
      const parent = card.parentElement;
      if (!parent) return;

      const drawer = card.closest("[role=dialog], .sheet-panel, [class*=drawer], [class*=sheet]");
      if (drawer && !(drawer.textContent || "").includes("App settings")) return;

      parent.querySelectorAll('[data-hassoun-display-settings-card]').forEach(el => el.remove());

      const connect = makeCard(appPath("/masjid-tv/pair/"), "Connect Display", "Enter the 6-digit code shown on your TV or display", "🔗", "connect");
      const manage = makeCard(appPath("/masjid-tv/devices/"), "My Displays", "Manage paired TVs, tablets, iPads and computer screens", "▤", "manage");

      card.insertAdjacentElement("afterend", manage);
      card.insertAdjacentElement("afterend", connect);
    };

    inject();
    const observer = new MutationObserver(inject);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return null;
}
