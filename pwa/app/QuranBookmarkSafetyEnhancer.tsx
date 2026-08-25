"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const LAST_KEY = "wopt-quran-last-read";
const EASY_PLACE_KEY = "wopt-quran-easy-place-v1";
const RESTORE_KEY = "wopt-quran-restore-exact-once";

function readSavedPlace() {
  try {
    const raw = window.localStorage.getItem(EASY_PLACE_KEY);
    if (!raw || raw.length > 12000) return null;
    return JSON.parse(raw) as {
      chapterId: number;
      verseKey: string;
      page?: number;
      word?: number;
      scrollY?: number;
      savedAt: number;
      label?: string;
    };
  } catch {
    return null;
  }
}

function showSavedWatermark(place: { verseKey: string; page?: number }) {
  document.querySelectorAll("[data-wopt-saved-watermark]").forEach((node) => node.remove());
  const splash = document.createElement("div");
  splash.dataset.woptSavedWatermark = "true";
  splash.setAttribute("role", "status");
  splash.style.cssText = "position:fixed;left:50%;top:45%;transform:translate(-50%,-50%) scale(.92);z-index:9999;background:rgba(11,91,71,.94);color:#fff;border-radius:24px;padding:18px 24px;min-width:180px;text-align:center;font-family:Arial,sans-serif;font-weight:900;box-shadow:0 18px 60px rgba(0,0,0,.28);opacity:0;transition:opacity .18s ease,transform .18s ease;pointer-events:none";
  splash.innerHTML = `<div style="font-size:34px;line-height:1;margin-bottom:7px">✓</div><div style="font-size:20px">Saved</div><div style="font-size:12px;opacity:.86;margin-top:5px">${place.verseKey}${place.page ? ` · Page ${place.page}` : ""}</div>`;
  document.body.appendChild(splash);
  requestAnimationFrame(() => {
    splash.style.opacity = "1";
    splash.style.transform = "translate(-50%,-50%) scale(1)";
  });
  window.setTimeout(() => {
    splash.style.opacity = "0";
    splash.style.transform = "translate(-50%,-50%) scale(.96)";
  }, 850);
  window.setTimeout(() => splash.remove(), 1150);
}

function syncSavedPlacesDrawer() {
  const place = readSavedPlace();
  if (!place) return;

  const heading = Array.from(document.querySelectorAll<HTMLElement>("h1,h2,h3,div"))
    .find((node) => node.textContent?.trim() === "Saved places");
  if (!heading) return;

  const shell = heading.closest<HTMLElement>(".quran-drawer") || heading.parentElement?.parentElement || heading.parentElement;
  if (!shell) return;

  shell.querySelectorAll("[data-wopt-easy-saved-card]").forEach((node) => node.remove());

  const card = document.createElement("button");
  card.type = "button";
  card.dataset.woptEasySavedCard = "true";
  card.style.cssText = "width:calc(100% - 34px);margin:18px 17px 0;padding:16px 17px;border:1px solid rgba(11,91,71,.18);border-radius:18px;background:#fff;color:#143d34;box-shadow:0 8px 28px rgba(0,0,0,.08);text-align:left;font-family:Arial,sans-serif;cursor:pointer";
  card.innerHTML = `<div style="display:flex;align-items:center;justify-content:space-between;gap:12px"><div><div style="font-size:12px;font-weight:900;letter-spacing:.08em;color:#0b5b47;text-transform:uppercase">🔖 My saved place</div><div style="font-size:19px;font-weight:900;margin-top:6px">Ayah ${place.verseKey}</div><div style="font-size:13px;color:#66736f;margin-top:4px">${place.page ? `Page ${place.page} · ` : ""}Tap to continue reading</div></div><div style="font-size:28px;color:#0b5b47">›</div></div>`;
  card.addEventListener("click", () => {
    window.localStorage.setItem(LAST_KEY, JSON.stringify({
      chapterId: place.chapterId,
      verseKey: place.verseKey,
      page: place.page,
      word: place.word,
      savedAt: place.savedAt,
    }));
    window.sessionStorage.setItem(RESTORE_KEY, "1");
    window.location.assign("/quran");
  });

  const hint = Array.from(shell.querySelectorAll<HTMLElement>("div,p"))
    .find((node) => node.textContent?.includes("Tap a verse, then choose Save"));
  if (hint?.parentElement) hint.parentElement.insertAdjacentElement("afterend", card);
  else shell.appendChild(card);
}

export default function QuranBookmarkSafetyEnhancer() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname.includes("/quran")) return;

    const onClickCapture = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const button = target?.closest<HTMLButtonElement>("[data-clean='bookmark']");
      if (!button) return;

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      try {
        const raw = window.localStorage.getItem(LAST_KEY);
        if (!raw || raw.length > 12000) return;
        const last = JSON.parse(raw) as { chapterId?: number; verseKey?: string; page?: number; word?: number };
        if (!last?.chapterId || !last?.verseKey) return;

        const place = {
          chapterId: last.chapterId,
          verseKey: last.verseKey,
          page: last.page,
          word: last.word,
          scrollY: Math.max(0, Math.round(window.scrollY)),
          savedAt: Date.now(),
          label: `My reading place · ${last.verseKey}`,
        };
        window.localStorage.setItem(EASY_PLACE_KEY, JSON.stringify(place));
        showSavedWatermark(place);
        syncSavedPlacesDrawer();

        const icon = button.querySelector<HTMLElement>("b");
        const label = button.querySelector<HTMLElement>("span");
        button.classList.add("save-flash");
        if (icon) icon.textContent = "✓";
        if (label) label.textContent = "Saved";
        window.setTimeout(() => {
          button.classList.remove("save-flash");
          if (icon) icon.textContent = "🔖";
          if (label) label.textContent = "Save";
        }, 900);
      } catch {
        // Never let bookmark storage interrupt Qur'an reading.
      }
    };

    const observer = new MutationObserver(() => syncSavedPlacesDrawer());
    observer.observe(document.body, { childList: true, subtree: true });
    syncSavedPlacesDrawer();

    if (window.sessionStorage.getItem(RESTORE_KEY) === "1") {
      const place = readSavedPlace();
      window.sessionStorage.removeItem(RESTORE_KEY);
      if (place) window.setTimeout(() => window.scrollTo({ top: Math.max(0, place.scrollY || 0), behavior: "smooth" }), 900);
    }

    document.addEventListener("click", onClickCapture, true);
    return () => {
      observer.disconnect();
      document.removeEventListener("click", onClickCapture, true);
    };
  }, [pathname]);

  return null;
}
