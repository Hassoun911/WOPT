"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || "";
const appPath = (path: string) => `${BASE_PATH}${path}`;
const TV_MODE_KEY = "hassoun-web-masjid-tv-mode-v4";
const WEB_SESSION_KEY = "hassoun-web-force-website-session";
const OLD_KEYS = [
  "hassoun-web-masjid-tv-mode",
  "hassoun-web-masjid-tv-mode-v2",
  "hassoun-web-masjid-tv-mode-v3",
];

const detectSmartTv = () => {
  const ua = `${navigator.userAgent || ""} ${(navigator as Navigator & { vendor?: string }).vendor || ""}`.toLowerCase();
  const explicitTvUa = /smart[- ]?tv|smarttv|hbbtv|netcast|web0s|webos|tizen|vidaa|hisense|viera|aquos|bravia|googletv|google tv|android tv|aftb|aftm|aftt|crkey|roku|tv safari/.test(ua);
  if (explicitTvUa) return true;
  const desktopOs = /windows nt|macintosh|mac os x|x11;/.test(ua);
  if (desktopOs) return false;
  const largeDisplay = window.innerWidth >= 1000 && window.innerHeight >= 560;
  const noHover = window.matchMedia?.("(hover: none)").matches ?? false;
  const anyHover = window.matchMedia?.("(any-hover: hover)").matches ?? false;
  const anyFinePointer = window.matchMedia?.("(any-pointer: fine)").matches ?? false;
  const coarsePointer = window.matchMedia?.("(pointer: coarse)").matches ?? false;
  const anyCoarsePointer = window.matchMedia?.("(any-pointer: coarse)").matches ?? false;
  const remoteStyle = noHover && !anyHover && !anyFinePointer && (coarsePointer || anyCoarsePointer || true);
  return largeDisplay && remoteStyle;
};

export default function WebMasjidTvMenuEnhancer() {
  const pathname = usePathname();

  useEffect(() => {
    const localPath = BASE_PATH && pathname.startsWith(BASE_PATH) ? pathname.slice(BASE_PATH.length) || "/" : pathname;
    const displayHref = appPath("/masjid-tv/?mode=tv");
    const activationHref = appPath("/masjid-tv/?mode=tv&activate=1");
    const pairHref = appPath("/masjid-tv/pair/");
    const devicesHref = appPath("/masjid-tv/devices/");
    const websiteHref = appPath("/?mode=web");
    const params = new URLSearchParams(window.location.search);
    const requestedMode = params.get("mode");

    try { OLD_KEYS.forEach(key => window.localStorage.removeItem(key)); } catch {}

    if (requestedMode === "web") {
      try { window.sessionStorage.setItem(WEB_SESSION_KEY, "1"); } catch {}
    }
    const forceWebsite = requestedMode === "web" || (() => {
      try { return window.sessionStorage.getItem(WEB_SESSION_KEY) === "1"; } catch { return false; }
    })();

    if (localPath.startsWith("/masjid-tv")) {
      try {
        if (params.get("activate") === "1") {
          window.localStorage.setItem(TV_MODE_KEY, "enabled");
          params.delete("activate");
          const cleanQuery = params.toString();
          window.history.replaceState({}, "", `${appPath("/masjid-tv/")}${cleanQuery ? `?${cleanQuery}` : ""}`);
        }
      } catch {}

      if (!document.querySelector('[data-hassoun-website-mode="1"]')) {
        const exit = document.createElement("a");
        exit.href = websiteHref;
        exit.dataset.hassounWebsiteMode = "1";
        exit.textContent = "Website Mode";
        exit.setAttribute("aria-label", "Open normal Hassoun website mode");
        Object.assign(exit.style, {
          position: "fixed", right: "14px", top: "14px", zIndex: "100000",
          padding: "9px 13px", borderRadius: "999px", background: "rgba(0,0,0,.48)",
          color: "#fff", textDecoration: "none", fontWeight: "800", fontSize: "12px",
          backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,.28)"
        });
        exit.addEventListener("click", () => {
          try { window.sessionStorage.setItem(WEB_SESSION_KEY, "1"); } catch {}
        });
        document.body.appendChild(exit);
      }
      return () => document.querySelector('[data-hassoun-website-mode="1"]')?.remove();
    }

    if (!forceWebsite) {
      let explicitlyEnabled = false;
      try { explicitlyEnabled = window.localStorage.getItem(TV_MODE_KEY) === "enabled"; } catch {}
      if (detectSmartTv() || explicitlyEnabled) {
        window.location.replace(displayHref);
        return;
      }
    }

    const activateTvMode = async (event: Event) => {
      event.preventDefault();
      try {
        window.sessionStorage.removeItem(WEB_SESSION_KEY);
        window.localStorage.setItem(TV_MODE_KEY, "enabled");
      } catch {}
      try {
        if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
          await document.documentElement.requestFullscreen();
        }
      } catch {}
      window.location.href = activationHref;
    };

    const wire = (anchor: HTMLAnchorElement) => {
      if (anchor.dataset.hassounTvWired === "1") return;
      anchor.dataset.hassounTvWired = "1";
      anchor.addEventListener("click", activateTvMode);
    };

    const menuRow = (href: string, title: string, subtitle: string, icon: string, attr: string) => {
      const a = document.createElement("a");
      a.href = href;
      a.setAttribute(attr, "1");
      a.innerHTML = `<span aria-hidden="true" style="width:34px;text-align:center;font-size:22px;color:#0b5b47">${icon}</span><span style="min-width:0"><strong style="display:block;font-size:15px;color:#17362e">${title}</strong><small style="display:block;margin-top:2px;color:#7c8c87;font-size:11px">${subtitle}</small></span><span aria-hidden="true" style="margin-left:auto;color:#96a39f;font-size:20px">›</span>`;
      Object.assign(a.style, { display:"flex",alignItems:"center",gap:"12px",padding:"14px 8px",borderBottom:"1px solid #edf1ef",color:"#17362e",textDecoration:"none",background:"transparent" });
      return a;
    };

    const addDisplayEntriesNearSettings = () => {
      if (document.querySelector('[data-hassoun-connect-display="1"]')) return;
      const nodes = Array.from(document.querySelectorAll<HTMLElement>("a,button,[role=button],li,div"));
      const label = nodes.find(el => (el.textContent || "").trim() === "Settings");
      if (!label) return;
      const row = (label.closest("a,button,[role=button],li") as HTMLElement | null) || label;
      const parent = row.parentElement;
      if (!parent) return;
      const connect = menuRow(pairHref, "Connect Display", "Enter the 6-digit TV pairing code", "▣", "data-hassoun-connect-display");
      const manage = menuRow(devicesHref, "My Displays", "Manage paired TVs, tablets and screens", "▤", "data-hassoun-my-displays");
      row.insertAdjacentElement("afterend", manage);
      row.insertAdjacentElement("afterend", connect);
    };

    const addLink = (container: Element) => {
      if (container.querySelector('[data-hassoun-masjid-tv-link="1"]')) return;
      const anchor = document.createElement("a");
      anchor.href = activationHref;
      anchor.dataset.hassounMasjidTvLink = "1";
      anchor.setAttribute("aria-label", "Open Masjid TV / Big Screen Mode");
      anchor.innerHTML = '<span aria-hidden="true" style="font-size:22px">▣</span><span><strong style="display:block;font-size:14px">Masjid TV / Big Screen</strong><small style="display:block;margin-top:3px;color:#71827c;font-size:11px">TVs auto-detect; use this to test manually</small></span><span aria-hidden="true" style="margin-left:auto;font-size:20px">›</span>';
      Object.assign(anchor.style, { display: "flex", alignItems: "center", gap: "12px", margin: "12px 0 0", padding: "15px 16px", border: "1px solid #c8d8d0", borderRadius: "15px", background: "#edf5f1", color: "#17362e", textDecoration: "none", boxShadow: "0 8px 24px rgba(11,91,71,.08)" });
      wire(anchor);
      container.appendChild(anchor);
    };

    const enhance = () => {
      addDisplayEntriesNearSettings();
      const candidates = Array.from(document.querySelectorAll(".sheet-panel, aside, [role=dialog], [class*=drawer], [class*=sidebar], [class*=menu-panel], [class*=slide-menu]"));
      candidates.forEach((el) => {
        const value = (el.textContent || "").toLowerCase();
        if (value.includes("setting") || value.includes("qur") || value.includes("install") || value.includes("alert") || value.includes("menu")) addLink(el);
      });

      const header = document.querySelector(".header-actions");
      if (header && !header.querySelector('[data-hassoun-masjid-tv-link="1"]')) {
        const a = document.createElement("a");
        a.href = activationHref;
        a.dataset.hassounMasjidTvLink = "1";
        a.innerHTML = '<span aria-hidden="true">▣</span><span>Masjid TV</span>';
        a.title = "Masjid TV / Big Screen Mode";
        Object.assign(a.style, { height: "42px", minWidth: "108px", padding: "0 15px", display: "flex", gap: "7px", alignItems: "center", justifyContent: "center", borderRadius: "999px", background: "#0b5b47", color: "#fff", fontWeight: "900", fontSize: "12px", textDecoration: "none", whiteSpace: "nowrap" });
        wire(a);
        header.prepend(a);
      }

      if (!document.querySelector('[data-hassoun-tv-corner="1"]')) {
        const corner = document.createElement("a");
        corner.href = activationHref;
        corner.dataset.hassounTvCorner = "1";
        corner.textContent = "▣  MASJID TV";
        corner.setAttribute("aria-label", "Enter Masjid TV / Big Screen Mode");
        Object.assign(corner.style, { position: "fixed", right: "18px", bottom: "18px", zIndex: "99999", padding: "12px 18px", borderRadius: "999px", background: "#0b5b47", color: "#fff", textDecoration: "none", fontWeight: "900", fontSize: "13px", boxShadow: "0 10px 32px rgba(0,0,0,.28)" });
        wire(corner);
        document.body.appendChild(corner);
      }
    };

    enhance();
    const observer = new MutationObserver(enhance);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      document.querySelector('[data-hassoun-tv-corner="1"]')?.remove();
    };
  }, [pathname]);

  return null;
}
