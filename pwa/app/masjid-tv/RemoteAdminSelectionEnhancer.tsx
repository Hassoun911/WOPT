"use client";

import { useEffect } from "react";

const ACTIVE_KEY = "hassoun:studio-active-display-code";

function codeFromArticle(article: HTMLElement | null) {
  return article?.textContent?.match(/\b\d{6}\b/)?.[0] || "";
}

export default function RemoteAdminSelectionEnhancer() {
  useEffect(() => {
    if (!location.pathname.includes("/masjid-tv/devices")) return;

    const onClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const button = target?.closest("button") as HTMLButtonElement | null;
      if (!button || !(button.textContent || "").includes("Manage live")) return;
      const article = button.closest("article") as HTMLElement | null;
      const code = codeFromArticle(article);
      if (code) {
        sessionStorage.setItem(ACTIVE_KEY, code);
        document.querySelector('[data-smart-grand-v2-preview="1"]')?.remove();
        document.querySelector('[data-smart-masjid-settings="1"]')?.remove();
        document.querySelector('[data-prayer-source-resolver="1"]')?.remove();
      }
    };
    document.addEventListener("click", onClick, true);

    const enhanceLoading = () => {
      const heading = Array.from(document.querySelectorAll<HTMLElement>("h1,h2,h3,strong")).find(el =>
        (el.textContent || "").includes("Live display editor")
      );
      const section = heading?.closest("section") as HTMLElement | null;
      if (!section) return;

      const loading = Array.from(section.querySelectorAll<HTMLElement>("p,div,span")).find(el =>
        (el.textContent || "").trim() === "Loading…"
      );
      if (!loading) {
        section.querySelector('[data-remote-load-help="1"]')?.remove();
        return;
      }
      if (section.querySelector('[data-remote-load-help="1"]')) return;

      const started = Date.now();
      const timer = window.setInterval(() => {
        if (!document.body.contains(loading)) {
          window.clearInterval(timer);
          return;
        }
        if (Date.now() - started < 6000) return;
        window.clearInterval(timer);
        const box = document.createElement("div");
        box.dataset.remoteLoadHelp = "1";
        box.style.cssText = "margin:12px 0;padding:12px 14px;border:1px solid #8a7442;border-radius:12px;background:#102f2a;color:#fff;display:flex;gap:10px;align-items:center;flex-wrap:wrap";
        box.innerHTML = '<strong style="color:#efc66c">Remote control is taking too long.</strong><span style="color:#b9cbc5">Retry the selected display without leaving this page.</span><button type="button" style="padding:8px 12px;border-radius:999px;border:1px solid #d9b36b;background:#d9b36b;color:#102c25;font-weight:900">Retry now</button>';
        box.querySelector("button")?.addEventListener("click", () => {
          const saved = sessionStorage.getItem(ACTIVE_KEY) || "";
          const article = Array.from(document.querySelectorAll<HTMLElement>("article")).find(a => codeFromArticle(a) === saved);
          const manage = Array.from(article?.querySelectorAll<HTMLButtonElement>("button") || []).find(b => (b.textContent || "").includes("Manage live"));
          manage?.click();
          box.remove();
        });
        loading.insertAdjacentElement("afterend", box);
      }, 500);
    };

    enhanceLoading();
    const observer = new MutationObserver(enhanceLoading);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      document.removeEventListener("click", onClick, true);
      observer.disconnect();
    };
  }, []);
  return null;
}
