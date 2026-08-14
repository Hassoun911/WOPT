"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || "";
const appPath = (path: string) => `${BASE_PATH}${path}`;

export default function NavEnhancer() {
  const pathname = usePathname();

  useEffect(() => {
    const localPath = BASE_PATH && pathname.startsWith(BASE_PATH) ? pathname.slice(BASE_PATH.length) || "/" : pathname;

    // Keep old home-page buttons working when Alerts/Settings are opened from the Qur’an page.
    if (localPath === "/") {
      const open = new URLSearchParams(window.location.search).get("open");
      if (open === "alerts" || open === "settings") {
        const index = open === "alerts" ? 2 : 3;
        const timer = window.setTimeout(() => {
          const buttons = document.querySelectorAll<HTMLButtonElement>(".mobile-nav button");
          buttons[index]?.click();
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

      // Register the same service worker at the correct Pages scope. The home page's
      // root registration may fail on a sub-path, but this one succeeds.
      if ("serviceWorker" in navigator) {
        void navigator.serviceWorker.register(appPath("/sw.js"), { scope: appPath("/"), updateViaCache: "none" })
          .then((registration) => registration.update())
          .catch(() => undefined);
      }
    }
  }, [pathname]);

  const localPath = BASE_PATH && pathname.startsWith(BASE_PATH) ? pathname.slice(BASE_PATH.length) || "/" : pathname;
  if (localPath === "/quran" || localPath === "/quran/") return null;

  return <a className="quran-tab-overlay" href={appPath("/quran/")} aria-label="Open Qur’an"><span aria-hidden="true">۞</span>Qur’an</a>;
}
