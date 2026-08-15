"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export default function QuranHomeLinkFixEnhancer() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname.endsWith("/quran") && !pathname.endsWith("/quran/")) return;

    const handler = (event: MouseEvent) => {
      const target = (event.target as HTMLElement).closest<HTMLElement>(".wopt-ref-safe-brand,[data-ref='home']");
      if (!target) return;

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      const home = window.location.pathname === "/WOPT/quran" || window.location.pathname.startsWith("/WOPT/quran/")
        ? "/WOPT/"
        : "/";
      window.location.assign(home);
    };

    document.addEventListener("click", handler, true);
    return () => document.removeEventListener("click", handler, true);
  }, [pathname]);

  return null;
}
