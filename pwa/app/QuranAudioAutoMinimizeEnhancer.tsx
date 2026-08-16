"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export default function QuranAudioAutoMinimizeEnhancer() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname.endsWith("/quran") && !pathname.endsWith("/quran/")) return;

    const minimize = () => {
      const overlay = document.querySelector<HTMLElement>(".wopt-book-audio-backdrop.open");
      if (!overlay) return;

      const close = overlay.querySelector<HTMLButtonElement>(".wopt-book-audio-close");
      if (close) close.click();
      else overlay.classList.remove("open");
    };

    const onPlay = (event: Event) => {
      const media = event.target;
      if (!(media instanceof HTMLMediaElement)) return;
      if (media instanceof HTMLAudioElement && media.dataset.woptContinuousQuran === "true") {
        window.setTimeout(minimize, 0);
      }
    };

    document.addEventListener("play", onPlay, true);

    return () => {
      document.removeEventListener("play", onPlay, true);
    };
  }, [pathname]);

  return null;
}
