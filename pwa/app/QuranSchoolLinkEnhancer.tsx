"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export default function QuranSchoolLinkEnhancer() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname.endsWith("/quran") && !pathname.endsWith("/quran/")) return;

    const style = document.createElement("style");
    style.dataset.hassounSchoolLink = "true";
    style.textContent = `.memorize-launch{display:none!important}.hassoun-school-launch{display:inline-flex;align-items:center;justify-content:center;gap:7px;border:0;border-radius:12px;padding:11px 14px;background:#17604e;color:#fff;text-decoration:none;font-weight:900;white-space:nowrap}.hassoun-school-launch:hover{background:#0f5141}`;
    document.head.appendChild(style);

    let link: HTMLAnchorElement | null = null;
    const placeLink = () => {
      if (document.querySelector(".hassoun-school-launch")) return;
      const oldButton = document.querySelector<HTMLElement>(".memorize-launch");
      if (!oldButton?.parentElement) return;
      link = document.createElement("a");
      link.className = "hassoun-school-launch";
      link.href = "/school";
      link.textContent = "🎒 School / Memorize";
      oldButton.insertAdjacentElement("afterend", link);
    };

    placeLink();
    const timer = window.setInterval(placeLink, 500);
    return () => { window.clearInterval(timer); link?.remove(); style.remove(); };
  }, [pathname]);

  return null;
}
