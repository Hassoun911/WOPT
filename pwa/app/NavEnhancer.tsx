"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || "";
const appPath = (path: string) => `${BASE_PATH}${path}`;

export default function NavEnhancer() {
  const pathname = usePathname();

  useEffect(() => {
    const localPath = BASE_PATH && pathname.startsWith(BASE_PATH) ? pathname.slice(BASE_PATH.length) || "/" : pathname;

    // Top-menu shortcuts open the existing Home sheets even though the old
    // bottom navigation bar is no longer visible.
    if (localPath === "/") {
      const open = new URLSearchParams(window.location.search).get("open");
      const indexes: Record<string, number> = { month: 1, alerts: 2, settings: 3 };
      if (open && open in indexes) {
        const timer = window.setTimeout(() => {
          const buttons = document.querySelectorAll<HTMLButtonElement>(".mobile-nav button");
          buttons[indexes[open]]?.click();
          window.history.replaceState({}, "", appPath("/"));
        }, 120);
        return () => window.clearTimeout(timer);
      }
    }

    // The Qur’an page uses root-relative links so it can also run on ChatGPT Sites.
    // Rewrite only first-party navigation when this build is hosted under a Pages base path.
    if (BASE_PATH) {
      document.querySelectorAll<HTMLAnchorElement>('a[href^="/"]').forEach((anchor) => {
        const href = anchor.getAttribute("href");
        if (!href || href.startsWith(BASE_PATH)) return;
        anchor.setAttribute("href", appPath(href));
      });
      document.querySelectorAll<HTMLImageElement>('img[src^="/"]').forEach((image) => {
        const src = image.getAttribute("src");
        if (!src || src.startsWith(BASE_PATH)) return;
        image.setAttribute("src", appPath(src));
      });

      if ("serviceWorker" in navigator) {
        void navigator.serviceWorker.register(appPath("/sw.js"), { scope: appPath("/"), updateViaCache: "none" })
          .then((registration) => registration.update())
          .catch(() => undefined);
      }
    }
  }, [pathname]);

  return null;
}
