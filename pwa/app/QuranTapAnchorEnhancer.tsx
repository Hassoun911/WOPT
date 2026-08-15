"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export default function QuranTapAnchorEnhancer() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname.endsWith("/quran") && !pathname.endsWith("/quran/")) return;

    let active = false;
    let startY = 0;
    let anchorTop = 0;
    let verseKey = "";
    let wordIndex = -1;
    let settleTimers: number[] = [];

    const clearTimers = () => {
      settleTimers.forEach((id) => window.clearTimeout(id));
      settleTimers = [];
    };

    const resolveAnchor = () => {
      if (!verseKey) return null;
      const ayah = document.querySelector<HTMLElement>(`.mushaf-ayah[data-verse-key='${CSS.escape(verseKey)}'], [data-verse-key='${CSS.escape(verseKey)}']`);
      if (!ayah) return null;
      if (wordIndex >= 0) {
        const words = ayah.querySelectorAll<HTMLElement>(".quran-word");
        return words[wordIndex] || ayah;
      }
      return ayah;
    };

    const restoreAnchor = () => {
      if (!active) return;
      const node = resolveAnchor();
      if (!node) return;
      const currentTop = node.getBoundingClientRect().top;
      const delta = currentTop - anchorTop;
      if (Math.abs(delta) > 1) window.scrollBy({ top: delta, left: 0, behavior: "auto" });
    };

    const onPointerDown = (event: PointerEvent) => {
      const target = (event.target as HTMLElement).closest<HTMLElement>(".quran-word,.ayah-marker,.mushaf-ayah");
      if (!target) {
        active = false;
        return;
      }

      const ayah = target.closest<HTMLElement>(".mushaf-ayah,[data-verse-key]");
      if (!ayah?.dataset.verseKey) {
        active = false;
        return;
      }

      clearTimers();
      active = true;
      startY = event.clientY;
      verseKey = ayah.dataset.verseKey;
      const word = target.closest<HTMLElement>(".quran-word");
      if (word) {
        const words = Array.from(ayah.querySelectorAll<HTMLElement>(".quran-word"));
        wordIndex = words.indexOf(word);
        anchorTop = word.getBoundingClientRect().top;
      } else {
        wordIndex = -1;
        anchorTop = ayah.getBoundingClientRect().top;
      }
    };

    const onPointerMove = (event: PointerEvent) => {
      if (!active) return;
      if (Math.abs(event.clientY - startY) > 10) {
        active = false;
        clearTimers();
      }
    };

    const onPointerUp = (event: PointerEvent) => {
      if (!active) return;
      if (Math.abs(event.clientY - startY) > 10) {
        active = false;
        clearTimers();
        return;
      }

      // Keep the tapped Qur'an word/ayah at the same viewport position while
      // downstream audio/menu/highlight handlers finish their work.
      requestAnimationFrame(restoreAnchor);
      [25, 70, 140, 260, 450, 750].forEach((delay) => {
        settleTimers.push(window.setTimeout(restoreAnchor, delay));
      });
      settleTimers.push(window.setTimeout(() => { active = false; }, 900));
    };

    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("pointermove", onPointerMove, true);
    document.addEventListener("pointerup", onPointerUp, true);

    return () => {
      clearTimers();
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("pointermove", onPointerMove, true);
      document.removeEventListener("pointerup", onPointerUp, true);
    };
  }, [pathname]);

  return null;
}
