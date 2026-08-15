"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

function pageNumber(node: Element) {
  if (node instanceof HTMLElement) {
    const direct = Number(node.dataset.printedPage || node.dataset.scrollPage || 0);
    if (direct) return direct;
    const article = node.querySelector<HTMLElement>("[data-printed-page]");
    return Number(article?.dataset.printedPage || 0) || 0;
  }
  return 0;
}

export default function QuranPageOrderGuardEnhancer() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname.endsWith("/quran") && !pathname.endsWith("/quran/")) return;

    let fixing = false;
    let raf = 0;

    const fixOrder = () => {
      if (fixing) return;
      const reader = document.querySelector<HTMLElement>(".wopt-printed-reader");
      if (!reader || !document.querySelector(".quran-app.wopt-printed-page-mode")) return;

      const directPage = Array.from(reader.children).filter((child) => {
        if (!(child instanceof HTMLElement)) return false;
        return child.matches(".wopt-printed-page[data-printed-page], .wopt-scroll-page-wrap[data-scroll-page]");
      }) as HTMLElement[];

      if (directPage.length < 2) return;

      const ordered = [...directPage].sort((a, b) => pageNumber(a) - pageNumber(b));
      const alreadyOrdered = directPage.every((node, index) => node === ordered[index]);
      if (alreadyOrdered) return;

      const viewportAnchor = directPage
        .map((node) => ({ node, distance: Math.abs(node.getBoundingClientRect().top - 90) }))
        .sort((a, b) => a.distance - b.distance)[0]?.node;
      const oldTop = viewportAnchor?.getBoundingClientRect().top ?? 0;

      fixing = true;
      const fragment = document.createDocumentFragment();
      ordered.forEach((node) => fragment.appendChild(node));
      reader.appendChild(fragment);

      requestAnimationFrame(() => {
        if (viewportAnchor) {
          const newTop = viewportAnchor.getBoundingClientRect().top;
          const delta = newTop - oldTop;
          if (Math.abs(delta) > 1) window.scrollBy({ top: delta, behavior: "auto" });
        }
        fixing = false;
      });
    };

    const schedule = () => {
      window.cancelAnimationFrame(raf);
      raf = window.requestAnimationFrame(fixOrder);
    };

    const observer = new MutationObserver(schedule);
    const app = document.querySelector<HTMLElement>(".quran-app");
    if (app) observer.observe(app, { childList: true, subtree: true });
    window.addEventListener("scroll", schedule, { passive: true });
    const timer = window.setInterval(schedule, 500);
    schedule();

    return () => {
      window.cancelAnimationFrame(raf);
      window.clearInterval(timer);
      window.removeEventListener("scroll", schedule);
      observer.disconnect();
    };
  }, [pathname]);

  return null;
}
