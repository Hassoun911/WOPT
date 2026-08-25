"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export default function QuranSchoolLinkEnhancer() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname.endsWith("/quran") && !pathname.endsWith("/quran/")) return;

    const style = document.createElement("style");
    style.dataset.hassounSchoolLink = "true";
    style.textContent = `.memorize-launch{display:none!important}.hassoun-school-launch,.hassoun-school-verse-link{display:inline-flex;align-items:center;justify-content:center;gap:7px;border:0;border-radius:12px;padding:11px 14px;background:#17604e;color:#fff;text-decoration:none;font-weight:900;white-space:nowrap}.hassoun-school-launch:hover,.hassoun-school-verse-link:hover{background:#0f5141}.verse-action-dock button[data-hassoun-old-memorize='true']{display:none!important}`;
    document.head.appendChild(style);

    const placeLinks = () => {
      if (!document.querySelector(".hassoun-school-launch")) {
        const oldButton = document.querySelector<HTMLElement>(".memorize-launch");
        if (oldButton?.parentElement) {
          const link = document.createElement("a");
          link.className = "hassoun-school-launch";
          link.href = "/school";
          link.textContent = "🎒 School / Memorize";
          oldButton.insertAdjacentElement("afterend", link);
        }
      }

      const dock = document.querySelector<HTMLElement>(".verse-action-dock");
      if (dock) {
        const oldDockButton = Array.from(dock.querySelectorAll<HTMLButtonElement>("button")).find((button) => /memorize/i.test(button.textContent || ""));
        if (oldDockButton) oldDockButton.dataset.hassounOldMemorize = "true";
        if (oldDockButton && !dock.querySelector(".hassoun-school-verse-link")) {
          const link = document.createElement("a");
          link.className = "hassoun-school-verse-link";
          link.href = "/school";
          link.textContent = "🎒 School";
          oldDockButton.insertAdjacentElement("afterend", link);
        }
      }
    };

    placeLinks();
    const timer = window.setInterval(placeLinks, 400);
    return () => { window.clearInterval(timer); document.querySelectorAll(".hassoun-school-launch,.hassoun-school-verse-link").forEach((node) => node.remove()); style.remove(); };
  }, [pathname]);

  return null;
}
