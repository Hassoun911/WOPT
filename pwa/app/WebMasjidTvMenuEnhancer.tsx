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
      anchor.setAttribute("aria-label", "Open Masjid TV / Big Screen Mode");
      anchor.innerHTML = '<span aria-hidden="true" style="font-size:20px">▣</span><span><strong style="display:block;font-size:13px">Masjid TV / Big Screen</strong><small style="display:block;margin-top:2px;color:#71827c;font-size:10px">Full-screen smart mosque display</small></span><span aria-hidden="true" style="margin-left:auto">›</span>';
      Object.assign(anchor.style, { display: "flex", alignItems: "center", gap: "12px", margin: "12px 0 0", padding: "13px 14px", border: "1px solid #d6dfda", borderRadius: "15px", background: "#edf5f1", color: "#17362e", textDecoration: "none" });
      container.appendChild(anchor);
    };

    const enhance = () => {
      const candidates = Array.from(document.querySelectorAll(".sheet-panel, aside, [role=dialog], [class*=drawer], [class*=sidebar], [class*=menu-panel], [class*=slide-menu]"));
      candidates.forEach((el) => {
        const text = (el.textContent || "").toLowerCase();
        if (text.includes("setting") || text.includes("qur") || text.includes("install") || text.includes("alert") || text.includes("menu")) addLink(el);
      });

      const header = document.querySelector(".header-actions");
      if (header && !header.querySelector('[data-hassoun-masjid-tv-link="1"]')) {
        const a = document.createElement("a");
        a.href = href;
        a.dataset.hassounMasjidTvLink = "1";
        a.textContent = "TV";
        a.title = "Masjid TV / Big Screen Mode";
        Object.assign(a.style, { height: "42px", minWidth: "48px", padding: "0 13px", display: "grid", placeItems: "center", borderRadius: "999px", background: "#0b5b47", color: "#fff", fontWeight: "900", fontSize: "12px", textDecoration: "none" });
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
