"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

function isEditableTarget(target: EventTarget | null) {
  const element = target instanceof HTMLElement ? target : null;
  if (!element) return false;
  return Boolean(element.closest("input, textarea, select, [contenteditable='true']"));
}

export default function QuranDesktopScrollInputFix() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname.endsWith("/quran") && !pathname.endsWith("/quran/")) return;

    const html = document.documentElement;
    const body = document.body;
    const previous = {
      htmlOverflow: html.style.overflow,
      htmlOverflowY: html.style.overflowY,
      bodyOverflow: body.style.overflow,
      bodyOverflowY: body.style.overflowY,
      bodyHeight: body.style.height,
    };

    const style = document.createElement("style");
    style.dataset.woptQuranDesktopScrollFix = "true";
    style.textContent = `
      html:has(.quran-app), body:has(.quran-app) {
        overflow-x: hidden !important;
        overflow-y: auto !important;
        height: auto !important;
        min-height: 100% !important;
        overscroll-behavior-y: auto !important;
      }
      body:has(.quran-app) .quran-app {
        overflow: visible !important;
        height: auto !important;
        min-height: 100dvh !important;
        touch-action: pan-y !important;
      }
      body:has(.quran-app) .wopt-printed-reader,
      body:has(.quran-app) .mushaf-shell {
        overflow: visible !important;
        max-height: none !important;
      }
    `;
    document.head.appendChild(style);

    html.style.overflowY = "auto";
    body.style.overflowY = "auto";
    body.style.height = "auto";

    const scrollByKeyboard = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || isEditableTarget(event.target)) return;

      const pageStep = Math.max(280, window.innerHeight * 0.82);
      let top: number | null = null;

      switch (event.key) {
        case "ArrowDown": top = 72; break;
        case "ArrowUp": top = -72; break;
        case "PageDown": top = pageStep; break;
        case "PageUp": top = -pageStep; break;
        case " ": top = event.shiftKey ? -pageStep : pageStep; break;
        case "Home":
          event.preventDefault();
          window.scrollTo({ top: 0, behavior: "smooth" });
          return;
        case "End":
          event.preventDefault();
          window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "smooth" });
          return;
        default: return;
      }

      event.preventDefault();
      window.scrollBy({ top, behavior: "smooth" });
    };

    window.addEventListener("keydown", scrollByKeyboard, { capture: true });

    return () => {
      window.removeEventListener("keydown", scrollByKeyboard, { capture: true });
      html.style.overflow = previous.htmlOverflow;
      html.style.overflowY = previous.htmlOverflowY;
      body.style.overflow = previous.bodyOverflow;
      body.style.overflowY = previous.bodyOverflowY;
      body.style.height = previous.bodyHeight;
      style.remove();
    };
  }, [pathname]);

  return null;
}
