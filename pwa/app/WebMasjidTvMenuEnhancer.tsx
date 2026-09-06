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
      document.querySelector('[data-hassoun-website-mode="1"]')?.remove();
      document.querySelector('[data-hassoun-tv-corner="1"]')?.remove();
      return;
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
        if (!document.fullscreenElement && document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen();
      } catch {}
      window.location.href = activationHref;
    };

    const wire = (anchor: HTMLAnchorElement) => {
      if (anchor.dataset.hassounTvWired === "1") return;
      anchor.dataset.hassounTvWired = "1";
      anchor.addEventListener("click", activateTvMode);
    };

    const addLink = (container: Element) => {
      if (container.querySelector('[data-hassoun-masjid-tv-link="1"]')) return;
      const anchor = document.createElement("a");
      anchor.href = activationHref;
      anchor.dataset.hassounMasjidTvLink = "1";
      anchor.setAttribute("aria-label", "Open Tablet / Wall Display Mode");
      anchor.innerHTML = '<span aria-hidden="true" style="font-size:22px">▣</span><span><strong style="display:block;font-size:14px">Tablet / Wall Display</strong><small style="display:block;margin-top:3px;color:#71827c;font-size:11px">Open the prayer wall display on tablets, iPads and TVs</small></span><span aria-hidden="true" style="margin-left:auto;font-size:20px">›</span>';
      Object.assign(anchor.style, { display: "flex", alignItems: "center", gap: "12px", margin: "12px 0 0", padding: "15px 16px", border: "1px solid #c8d8d0", borderRadius: "15px", background: "#edf5f1", color: "#17362e", textDecoration: "none", boxShadow: "0 8px 24px rgba(11,91,71,.08)" });
      wire(anchor);
      container.appendChild(anchor);
    };

    const removeNonMenuEntries = () => {
      document.querySelector('[data-hassoun-tv-corner="1"]')?.remove();
      const header = document.querySelector(".header-actions");
      header?.querySelectorAll('[data-hassoun-masjid-tv-link="1"]').forEach(el => el.remove());
    };

    const enhance = () => {
      removeNonMenuEntries();
      const candidates = Array.from(document.querySelectorAll(".sheet-panel, aside, [role=dialog], [class*=drawer], [class*=sidebar], [class*=menu-panel], [class*=slide-menu]"));
      candidates.forEach((el) => {
        const value = (el.textContent || "").toLowerCase();
        if (value.includes("setting") || value.includes("qur") || value.includes("install") || value.includes("alert") || value.includes("menu")) addLink(el);
      });
    };

    enhance();
    const observer = new MutationObserver(enhance);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => { observer.disconnect(); removeNonMenuEntries(); };
  }, [pathname]);

  return null;
}
