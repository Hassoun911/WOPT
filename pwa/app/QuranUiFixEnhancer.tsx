"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

const API = "https://api.quran.com/api/v4";

type ChapterReciter = {
  id: number;
  name: string;
  style?: { name?: string | null } | string | null;
};

const FALLBACK_RECITERS: ChapterReciter[] = [
  { id: 7, name: "Mishari Rashid al-`Afasy" },
  { id: 3, name: "Abdur-Rahman as-Sudais" },
  { id: 6, name: "Mahmoud Khalil Al-Husary" },
  { id: 8, name: "Mohamed Siddiq al-Minshawi" },
  { id: 1, name: "AbdulBaset AbdulSamad" },
];

function styleName(style: ChapterReciter["style"]) {
  if (!style) return "";
  return typeof style === "string" ? style : style.name || "";
}

function verseNumber(key?: string) {
  return Number((key || "").split(":")[1] || 0);
}

export default function QuranUiFixEnhancer() {
  const pathname = usePathname();
  const selectingRef = useRef(false);
  const startKeyRef = useRef<string | null>(null);
  const syntheticRef = useRef(false);
  const recitersLoadedRef = useRef(false);

  useEffect(() => {
    if (!pathname.endsWith("/quran") && !pathname.endsWith("/quran/")) return;

    const style = document.createElement("style");
    style.dataset.woptUiFix = "true";
    style.textContent = `
      .wopt-range-start{background:rgba(211,170,87,.17)!important;box-shadow:0 0 0 7px rgba(211,170,87,.12)!important;border-radius:10px}
      .wopt-range-hint{position:sticky;z-index:17;top:155px;max-width:720px;margin:8px auto;padding:10px 14px;border:1px solid rgba(11,91,71,.18);border-radius:14px;background:rgba(255,253,248,.96);color:var(--q-ink);box-shadow:0 12px 34px rgba(7,49,39,.12);font-size:11px;text-align:center;backdrop-filter:blur(14px)}
      .quran-theme-night .wopt-range-hint{background:rgba(13,42,34,.96)}
      @media(max-width:700px){.wopt-range-hint{top:150px;margin:7px 10px;font-size:10px}}
    `;
    document.head.appendChild(style);

    const hint = document.createElement("div");
    hint.className = "wopt-range-hint";
    hint.hidden = true;
    hint.textContent = "Selection mode: tap the first ayah, then tap the last ayah. The full range will be selected for Memorize.";
    document.querySelector(".quran-reader-toolbar")?.insertAdjacentElement("afterend", hint);

    const getSelectionButton = () => Array.from(document.querySelectorAll<HTMLButtonElement>(".quran-reader-toolbar button"))
      .find((button) => /select ayat|selecting/i.test(button.textContent || ""));

    const clearStart = () => {
      document.querySelectorAll(".wopt-range-start").forEach((node) => node.classList.remove("wopt-range-start"));
      startKeyRef.current = null;
    };

    const clearCurrentReactSelection = () => {
      const selected = Array.from(document.querySelectorAll<HTMLElement>(".mushaf-ayah.selected"));
      syntheticRef.current = true;
      selected.forEach((ayah) => ayah.click());
      syntheticRef.current = false;
    };

    const applyRange = (startKey: string, endKey: string) => {
      const start = verseNumber(startKey);
      const end = verseNumber(endKey);
      if (!start || !end) return;
      const low = Math.min(start, end);
      const high = Math.max(start, end);

      clearCurrentReactSelection();
      const ayat = Array.from(document.querySelectorAll<HTMLElement>(".mushaf-ayah[data-verse-key]"));
      syntheticRef.current = true;
      ayat.forEach((ayah) => {
        const key = ayah.dataset.verseKey;
        const n = verseNumber(key);
        if (n >= low && n <= high && !ayah.classList.contains("selected")) ayah.click();
      });
      syntheticRef.current = false;

      clearStart();
      hint.textContent = `${high - low + 1} ayah${high === low ? "" : "s"} selected. Tap Memorize to study this exact range, or tap another ayah to start a new range.`;
    };

    const populateReciters = async () => {
      const select = document.querySelector<HTMLSelectElement>(".wopt-quran-player select.reciter");
      if (!select) return;
      if (recitersLoadedRef.current && !/loading/i.test(select.textContent || "")) return;

      let reciters = FALLBACK_RECITERS;
      try {
        const response = await fetch(`${API}/resources/chapter_reciters?language=en`, { cache: "no-store" });
        if (response.ok) {
          const data = await response.json();
          if (Array.isArray(data.reciters) && data.reciters.length) reciters = data.reciters as ChapterReciter[];
        }
      } catch { /* keep verified fallback IDs */ }

      const previous = Number(select.value || 7);
      select.innerHTML = "";
      reciters.forEach((reciter) => {
        const option = document.createElement("option");
        option.value = String(reciter.id);
        const styleText = styleName(reciter.style);
        option.textContent = `${reciter.name}${styleText ? ` · ${styleText}` : ""}`;
        select.appendChild(option);
      });
      const preferred = reciters.some((item) => item.id === previous)
        ? previous
        : (reciters.find((item) => /mishari|mishary|afasy/i.test(item.name))?.id || reciters[0]?.id || 7);
      select.value = String(preferred);
      recitersLoadedRef.current = true;
      select.dispatchEvent(new Event("change", { bubbles: true }));
    };

    const onWindowCapture = (event: MouseEvent) => {
      if (syntheticRef.current || !selectingRef.current) return;
      const target = event.target as HTMLElement;
      const word = target.closest<HTMLElement>(".quran-word");
      const marker = target.closest<HTMLElement>(".ayah-marker");
      const ayah = (word || marker || target.closest<HTMLElement>(".mushaf-ayah"))?.closest<HTMLElement>(".mushaf-ayah[data-verse-key]");
      if (!ayah) return;

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      const key = ayah.dataset.verseKey;
      if (!key) return;
      if (!startKeyRef.current) {
        clearStart();
        startKeyRef.current = key;
        ayah.classList.add("wopt-range-start");
        hint.textContent = `Start ayah ${verseNumber(key)} selected. Now tap the last ayah in the range.`;
      } else {
        applyRange(startKeyRef.current, key);
      }
    };

    const onDocumentClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      const selectionButton = target.closest<HTMLButtonElement>(".quran-reader-toolbar button");
      if (selectionButton && /select ayat|selecting/i.test(selectionButton.textContent || "")) {
        window.setTimeout(() => {
          const activeButton = getSelectionButton();
          selectingRef.current = !!activeButton?.classList.contains("active");
          if (selectingRef.current) {
            hint.hidden = false;
            hint.textContent = "Selection mode: tap the first ayah, then tap the last ayah. The full range will be selected for Memorize.";
            clearStart();
          } else {
            hint.hidden = true;
            clearStart();
          }
        }, 0);
      }
    };

    const observer = new MutationObserver(() => {
      void populateReciters();
    });
    observer.observe(document.body, { childList: true, subtree: true });

    window.addEventListener("click", onWindowCapture, true);
    document.addEventListener("click", onDocumentClick, false);
    const retry = window.setInterval(() => void populateReciters(), 1800);
    const initial = window.setTimeout(() => void populateReciters(), 350);

    return () => {
      window.clearInterval(retry);
      window.clearTimeout(initial);
      observer.disconnect();
      window.removeEventListener("click", onWindowCapture, true);
      document.removeEventListener("click", onDocumentClick, false);
      clearStart();
      hint.remove();
      style.remove();
    };
  }, [pathname]);

  return null;
}
