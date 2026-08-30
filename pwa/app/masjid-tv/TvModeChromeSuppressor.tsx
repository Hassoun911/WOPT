"use client";

import { useEffect } from "react";

const TV_MARK = "data-hassoun-tv-hidden";

function isInsideStudio(el: Element) {
  return Boolean(el.closest(".webtv-admin, .webtv-admin-backdrop, .reference-replica-one, .webtv-shell"));
}

function shouldHide(el: HTMLElement) {
  if (isInsideStudio(el)) return false;
  const text = (el.textContent || "").trim().toLowerCase();
  const cls = String(el.className || "").toLowerCase();
  const aria = (el.getAttribute("aria-label") || "").toLowerCase();
  const title = (el.getAttribute("title") || "").toLowerCase();
  const style = getComputedStyle(el);
  const floating = ["fixed","sticky","absolute"].includes(style.position);
  if (floating && (text === "menu" || text.startsWith("menu") || aria.includes("menu") || title.includes("menu"))) return true;
  if (cls.includes("floating-menu") || cls.includes("menu-fab") || cls.includes("header-actions") || cls.includes("site-header") || cls.includes("mobile-menu") || cls.includes("menu-button")) return true;
  return false;
}

function hideWebsiteChrome() {
  document.documentElement.classList.add("masjid-tv-route-active");
  document.body.classList.add("masjid-tv-route-active");
  const nodes = Array.from(document.querySelectorAll<HTMLElement>("button, a, header, nav, [role=button], [class*=menu], [class*=header]"));
  for (const el of nodes) {
    if (!shouldHide(el)) continue;
    if (!el.hasAttribute(TV_MARK)) {
      el.setAttribute(TV_MARK, "1");
      el.dataset.hassounPrevDisplay = el.style.display || "";
    }
    el.style.setProperty("display", "none", "important");
  }
}

export default function TvModeChromeSuppressor() {
  useEffect(() => {
    hideWebsiteChrome();
    const timer = window.setInterval(hideWebsiteChrome, 400);
    const observer = new MutationObserver(hideWebsiteChrome);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      window.clearInterval(timer);
      observer.disconnect();
      document.documentElement.classList.remove("masjid-tv-route-active");
      document.body.classList.remove("masjid-tv-route-active");
      document.querySelectorAll<HTMLElement>(`[${TV_MARK}]`).forEach((el) => {
        el.style.display = el.dataset.hassounPrevDisplay || "";
        delete el.dataset.hassounPrevDisplay;
        el.removeAttribute(TV_MARK);
      });
    };
  }, []);
  return null;
}
