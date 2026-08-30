"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || "";
const appPath = (path: string) => `${BASE_PATH}${path}`;

export default function WebMasjidTvMenuEnhancer() {
  const pathname = usePathname();

  useEffect(() => {
    const localPath = BASE_PATH && pathname.startsWith(BASE_PATH) ? pathname.slice(BASE_PATH.length) || "/" : pathname;
    if (localPath.startsWith("/masjid-tv")) return;

    const href = appPath("/masjid-tv/");
    const addLink = (container: Element) => {
      if (container.querySelector('[data-hassoun-masjid-tv-link="1"]')) return;
      const anchor = document.createElement("a");
      anchor.href = href;
      anchor.dataset.hassounMasjidTvLink = "1";
      anchor.className = "hassoun-masjid-tv-menu-link";
      anchor.setAttribute("aria-label", "Open Masjid TV / Big Screen Mode");
      anchor.innerHTML = '<span aria-hidden="true" style="font-size:20px">▣</span><span><strong>Masjid TV / Big Screen</strong><small>Full-screen smart mosque display</small></span><span aria-hidden="true" style="margin-left:auto">›</span>';
      container.appendChild(anchor);
    };

    const enhance = () => {
      const candidates = Array.from(document.querySelectorAll(".sheet-panel, aside, [role=dialog], [class*=drawer], [class*=sidebar], [class*=menu-panel], [class*=slide-menu]"));
      candidates.forEach((el) => {
        const text = (el.textContent || "").toLowerCase();
        if (text.includes("setting") || text.includes("qur") || text.includes("install") || text.includes("alert") || text.includes("menu")) addLink(el);
      });

      // Desktop header fallback so TV mode is always reachable even if no slide menu is open.
      const header = document.querySelector(".header-actions");
      if (header && !header.querySelector('[data-hassoun-masjid-tv-link="1"]')) {
        const a = document.createElement("a");
        a.href = href;
        a.dataset.hassounMasjidTvLink = "1";
        a.className = "hassoun-tv-header-button";
        a.textContent = "TV";
        a.title = "Masjid TV / Big Screen Mode";
        header.prepend(a);
      }
    };

    enhance();
    const observer = new MutationObserver(enhance);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [pathname]);

  return null;
}
