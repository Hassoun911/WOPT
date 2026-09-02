"use client";

import { useEffect } from "react";

const TV_MARK = "data-hassoun-tv-hidden";

function isTvDisplayRoute() {
  const path = window.location.pathname.replace(/\/+$/, "").toLowerCase();
  return path === "/masjid-tv";
}

function isInsideMasjidUi(el: Element) {
  return Boolean(el.closest(
    ".webtv-shell, .template, .sg-root, [data-smart-grand-v2], [data-smart-grand-v2-preview], .webtv-admin, .webtv-admin-backdrop, .reference-replica-one, .pixel-replica-one"
  ));
}

function shouldHide(el: HTMLElement) {
  // Never hide anything that belongs to the Masjid TV renderer/editor itself.
  if (isInsideMasjidUi(el)) return false;

  const text = (el.textContent || "").trim().toLowerCase();
  const cls = String(el.className || "").toLowerCase();
  const aria = (el.getAttribute("aria-label") || "").toLowerCase();
  const title = (el.getAttribute("title") || "").toLowerCase();
  const style = getComputedStyle(el);
  const floating = ["fixed", "sticky", "absolute"].includes(style.position);

  // Hide only known website chrome/floating controls. Do not blanket-hide headers.
  if (cls.includes("floating-menu") || cls.includes("menu-fab") || cls.includes("site-header") ||
      cls.includes("mobile-menu") || cls.includes("header-actions") || cls.includes("menu-button")) return true;

  if (el.tagName === "NAV" && !el.closest(".webtv-shell")) return true;

  if (floating && (text === "menu" || text.startsWith("menu") || aria.includes("menu") || title.includes("menu"))) return true;

  return false;
}

function hideWebsiteChrome() {
  if (!isTvDisplayRoute()) return;

  document.documentElement.classList.add("masjid-tv-route-active");
  document.body.classList.add("masjid-tv-route-active");

  const nodes = Array.from(document.querySelectorAll<HTMLElement>(
    "button, a, nav, [role=button], .floating-menu, .menu-fab, .site-header, .mobile-menu, .header-actions, .menu-button"
  ));

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
    if (!isTvDisplayRoute()) return;

    hideWebsiteChrome();
    const timer = window.setInterval(hideWebsiteChrome, 800);
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
