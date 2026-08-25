"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const LAST_KEY = "wopt-quran-last-read";
const EASY_PLACE_KEY = "wopt-quran-easy-place-v1";

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

        const last = JSON.parse(raw) as {
          chapterId?: number;
          verseKey?: string;
          page?: number;
          word?: number;
        };
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

    document.addEventListener("click", onClickCapture, true);
    return () => document.removeEventListener("click", onClickCapture, true);
  }, [pathname]);

  return null;
}
