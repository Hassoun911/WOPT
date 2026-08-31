"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || "";
const appPath = (path: string) => `${BASE_PATH}${path}`;
const TV_MODE_KEY = "hassoun-web-masjid-tv-mode";

const looksLikeSmartTv = () => {
  const ua = `${navigator.userAgent || ""} ${(navigator as Navigator & { vendor?: string }).vendor || ""}`.toLowerCase();
  return /smart[- ]?tv|smarttv|hbbtv|netcast|web0s|webos|tizen|vidaa|hisense|viera|aquos|bravia|googletv|google tv|android tv|aftb|aftm|aftt|crkey|roku|tv safari/.test(ua);
};

export default function WebMasjidTvMenuEnhancer() {
  const pathname = usePathname();

  useEffect(() => {
    const localPath = BASE_PATH && pathname.startsWith(BASE_PATH) ? pathname.slice(BASE_PATH.length) || "/" : pathname;
    const href = appPath("/masjid-tv/?mode=tv");

    if (localPath.startsWith("/masjid-tv")) return;

    // A real Smart TV should behave like the TV app on the very first visit.
    // Explicitly enabled desktop/browser displays are remembered as well.
    try {
      const remembered = window.localStorage.getItem(TV_MODE_KEY) === "1";
      const largeDisplay = window.innerWidth >= 1100 && window.innerHeight >= 600;
      const smartTv = looksLikeSmartTv();
      if (smartTv || (remembered && largeDisplay)) {
        if (smartTv) window.localStorage.setItem(TV_MODE_KEY, "1");
        window.location.replace(href);
        return;
      }
    } catch {
      if (looksLikeSmartTv()) {
        window.location.replace(href);
        return;
      }
    }

    const activateTvMode = async (event: Event) => {
      event.preventDefault();
      try { window.localStorage.setItem(TV_MODE_KEY, "1"); } catch {}
      try {
        if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
          await document.documentElement.requestFullscreen();
        }
      } catch {}
      window.location.href = href;
    };

    const wire = (anchor: HTMLAnchorElement) => {
      if (anchor.dataset.hassounTvWired === "1") return;
      anchor.dataset.hassounTvWired = "1";
      anchor.addEventListener("click", activateTvMode);
    };

    const addLink = (container: Element) => {
      if (container.querySelector('[data-hassoun-masjid-tv-link="1"]')) return;
      const anchor = document.createElement("a");
      anchor.href = href;
      anchor.dataset.hassounMasjidTvLink = "1";
      anchor.setAttribute("aria-label", "Open Masjid TV / Big Screen Mode");
      anchor.innerHTML = '<span aria-hidden="true" style="font-size:22px">▣</span><span><strong style="display:block;font-size:14px">Masjid TV / Big Screen</strong><small style="display:block;margin-top:3px;color:#71827c;font-size:11px">Use this website like the TV app</small></span><span aria-hidden="true" style="margin-left:auto;font-size:20px">›</span>';
      Object.assign(anchor.style, { display: "flex", alignItems: "center", gap: "12px", margin: "12px 0 0", padding: "15px 16px", border: "1px solid #c8d8d0", borderRadius: "15px", background: "#edf5f1", color: "#17362e", textDecoration: "none", boxShadow: "0 8px 24px rgba(11,91,71,.08)" });
      wire(anchor);
      container.appendChild(anchor);
    };

    const enhance = () => {
      const candidates = Array.from(document.querySelectorAll(".sheet-panel, aside, [role=dialog], [class*=drawer], [class*=sidebar], [class*=menu-panel], [class*=slide-menu]"));
      candidates.forEach((el) => {
        const value = (el.textContent || "").toLowerCase();
        if (value.includes("setting") || value.includes("qur") || value.includes("install") || value.includes("alert") || value.includes("menu")) addLink(el);
      });

      const header = document.querySelector(".header-actions");
      if (header && !header.querySelector('[data-hassoun-masjid-tv-link="1"]')) {
        const a = document.createElement("a");
        a.href = href;
        a.dataset.hassounMasjidTvLink = "1";
        a.innerHTML = '<span aria-hidden="true">▣</span><span>Masjid TV</span>';
        a.title = "Masjid TV / Big Screen Mode";
        Object.assign(a.style, { height: "42px", minWidth: "108px", padding: "0 15px", display: "flex", gap: "7px", alignItems: "center", justifyContent: "center", borderRadius: "999px", background: "#0b5b47", color: "#fff", fontWeight: "900", fontSize: "12px", textDecoration: "none", whiteSpace: "nowrap" });
        wire(a);
        header.prepend(a);
      }

      if (window.innerWidth >= 1200 && !document.querySelector('[data-hassoun-tv-corner="1"]')) {
        const corner = document.createElement("a");
        corner.href = href;
        corner.dataset.hassounTvCorner = "1";
        corner.textContent = "▣  Masjid TV";
        corner.setAttribute("aria-label", "Enter Masjid TV / Big Screen Mode");
        Object.assign(corner.style, { position: "fixed", right: "18px", bottom: "18px", zIndex: "9998", padding: "12px 18px", borderRadius: "999px", background: "#0b5b47", color: "#fff", textDecoration: "none", fontWeight: "900", fontSize: "13px", boxShadow: "0 10px 32px rgba(0,0,0,.2)" });
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
