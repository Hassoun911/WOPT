"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export default function QuranCleanToolbarFixEnhancer() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname.endsWith("/quran") && !pathname.endsWith("/quran/")) return;

    let toolbar: HTMLElement | null = null;
    let app: HTMLElement | null = null;

    const handleClick = (event: MouseEvent) => {
      const button = (event.target as HTMLElement).closest<HTMLButtonElement>(".wopt-clean-toolbar [data-clean]");
      if (!button) return;
      const action = button.dataset.clean;

      if (action === "surahs") {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        window.dispatchEvent(new Event("wopt-quran-context-surahs"));
        return;
      }

      if (action === "settings") {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        const richSettings = document.querySelector<HTMLButtonElement>(".wopt-ref-safe [data-ref='settings']");
        if (richSettings) richSettings.click();
        return;
      }

      if (action === "search") {
        const search = document.querySelector<HTMLButtonElement>(".wopt-ref-safe [data-ref='search']");
        if (search) {
          event.preventDefault();
          event.stopPropagation();
          event.stopImmediatePropagation();
          search.click();
        }
      }
    };

    const sync = () => {
      app = document.querySelector<HTMLElement>(".quran-app");
      toolbar = document.querySelector<HTMLElement>(".wopt-clean-toolbar");
      if (!app || !toolbar) return;
      if (toolbar.parentElement !== app) app.appendChild(toolbar);
    };

    const timer = window.setInterval(sync, 150);
    sync();
    document.addEventListener("click", handleClick, true);

    return () => {
      window.clearInterval(timer);
      document.removeEventListener("click", handleClick, true);
    };
  }, [pathname]);

  return null;
}
