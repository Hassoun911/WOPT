"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || "";
const appPath = (path: string) => `${BASE_PATH}${path}`;
const TV_MODE_KEY = "hassoun-web-masjid-tv-mode-v3";
const OLD_KEYS = ["hassoun-web-masjid-tv-mode", "hassoun-web-masjid-tv-mode-v2"];

export default function WebMasjidTvMenuEnhancer() {
  const pathname = usePathname();

  useEffect(() => {
    const localPath = BASE_PATH && pathname.startsWith(BASE_PATH) ? pathname.slice(BASE_PATH.length) || "/" : pathname;
    const displayHref = appPath("/masjid-tv/?mode=tv");
    const activationHref = appPath("/masjid-tv/?mode=tv&activate=1");

    // Always retire the previous experimental detector flags. They caused
    // desktops to be mistaken for TVs and must never influence v3 behavior.
    try { OLD_KEYS.forEach(key => window.localStorage.removeItem(key)); } catch {}

    // Visiting the display route by itself does NOT mark a device as a TV.
    // Only the explicit activation URL/button does. This prevents a computer
    // that was previously redirected here from becoming permanently trapped.
    if (localPath.startsWith("/masjid-tv")) {
      try {
        const params = new URLSearchParams(window.location.search);
        if (params.get("activate") === "1") {
          window.localStorage.setItem(TV_MODE_KEY, "enabled");
          params.delete("activate");
          const cleanQuery = params.toString();
          const cleanUrl = `${appPath("/masjid-tv/")}${cleanQuery ? `?${cleanQuery}` : ""}`;
          window.history.replaceState({}, "", cleanUrl);
        }
      } catch {}
      return;
    }

    // No UA/screen/pointer guessing. The normal website redirects only if
    // THIS exact browser was explicitly activated as a Masjid TV before.
    try {
      if (window.localStorage.getItem(TV_MODE_KEY) === "enabled") {
        window.location.replace(displayHref);
        return;
      }
    } catch {}

    const activateTvMode = async (event: Event) => {
      event.preventDefault();
      try { window.localStorage.setItem(TV_MODE_KEY, "enabled"); } catch {}
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

    const addLink = (container: Element) => {
      if (container.querySelector('[data-hassoun-masjid-tv-link="1"]')) return;
      const anchor = document.createElement("a");
      anchor.href = activationHref;
      anchor.dataset.hassounMasjidTvLink = "1";
      anchor.setAttribute("aria-label", "Activate Masjid TV / Big Screen Mode on this device");
      anchor.innerHTML = '<span aria-hidden="true" style="font-size:22px">▣</span><span><strong style="display:block;font-size:14px">Masjid TV / Big Screen</strong><small style="display:block;margin-top:3px;color:#71827c;font-size:11px">Activate this screen once and it will remember</small></span><span aria-hidden="true" style="margin-left:auto;font-size:20px">›</span>';
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
        a.href = activationHref;
        a.dataset.hassounMasjidTvLink = "1";
        a.innerHTML = '<span aria-hidden="true">▣</span><span>Masjid TV</span>';
        a.title = "Activate Masjid TV / Big Screen Mode on this device";
        Object.assign(a.style, { height: "42px", minWidth: "108px", padding: "0 15px", display: "flex", gap: "7px", alignItems: "center", justifyContent: "center", borderRadius: "999px", background: "#0b5b47", color: "#fff", fontWeight: "900", fontSize: "12px", textDecoration: "none", whiteSpace: "nowrap" });
        wire(a);
        header.prepend(a);
      }

      // Always expose a reliable activation control on the normal website.
      // This is intentionally explicit because many TV browsers impersonate
      // desktop Chrome and cannot be distinguished safely from a real PC.
      if (!document.querySelector('[data-hassoun-tv-corner="1"]')) {
        const corner = document.createElement("a");
        corner.href = activationHref;
        corner.dataset.hassounTvCorner = "1";
        corner.textContent = "▣  ENTER MASJID TV";
        corner.setAttribute("aria-label", "Activate Masjid TV / Big Screen Mode on this device");
        Object.assign(corner.style, { position: "fixed", right: "18px", bottom: "18px", zIndex: "99999", padding: "14px 20px", borderRadius: "999px", background: "#0b5b47", color: "#fff", textDecoration: "none", fontWeight: "900", fontSize: "14px", letterSpacing: ".02em", boxShadow: "0 10px 32px rgba(0,0,0,.28)" });
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
