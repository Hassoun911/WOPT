"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export default function QuranMoreMenuEnhancer() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname.endsWith("/quran") && !pathname.endsWith("/quran/")) return;

    const style = document.createElement("style");
    style.dataset.woptMoreMenu = "true";
    style.textContent = `
      .wopt-more-backdrop{position:fixed;z-index:4200;inset:0;display:none;align-items:flex-end;justify-content:center;background:rgba(0,0,0,.28);padding:12px;backdrop-filter:blur(3px)}
      .wopt-more-backdrop.open{display:flex}
      .wopt-more-sheet{width:min(620px,100%);background:#fff;color:#183f35;border-radius:22px;padding:16px;box-shadow:0 24px 70px rgba(0,0,0,.28);font-family:Arial,sans-serif}
      .wopt-more-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:14px}
      .wopt-more-head strong{font-size:18px}.wopt-more-head button{width:40px;height:40px;border:0;border-radius:50%;background:#f1f4f3;font-size:22px;color:#24483e}
      .wopt-more-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:10px}
      .wopt-more-grid button{min-height:62px;border:1px solid #dce7e3;border-radius:15px;background:#f8fbfa;color:#175b4d;font-weight:800;font-size:13px;padding:10px}
      .wopt-more-grid button:active{background:#e8f5f1}
      .wopt-more-grid button[data-more='book']{background:#eaf7f3;border-color:#acd8cc}
      @media(max-width:520px){.wopt-more-grid{grid-template-columns:1fr 1fr}.wopt-more-sheet{padding:14px}.wopt-more-grid button{min-height:58px;font-size:12px}}
    `;
    document.head.appendChild(style);

    const backdrop = document.createElement("div");
    backdrop.className = "wopt-more-backdrop";
    backdrop.innerHTML = `
      <section class="wopt-more-sheet" role="dialog" aria-modal="true" aria-label="More Qur’an tools">
        <div class="wopt-more-head"><strong>More Qur’an tools</strong><button type="button" data-more-close aria-label="Close">×</button></div>
        <div class="wopt-more-grid">
          <button type="button" data-more="book">Book mode</button>
          <button type="button" data-more="verse">Verse by Verse</button>
          <button type="button" data-more="translation">Translation</button>
          <button type="button" data-more="transliteration">English letters</button>
          <button type="button" data-more="info">Surah info</button>
          <button type="button" data-more="memorize">Memorize</button>
          <button type="button" data-more="home">Prayers</button>
        </div>
      </section>`;
    document.body.appendChild(backdrop);

    const open = () => backdrop.classList.add("open");
    const close = () => backdrop.classList.remove("open");

    const clickRef = (name: string) => document.querySelector<HTMLElement>(`.wopt-ref-safe [data-ref='${name}']`)?.click();
    const clickText = (selector: string, pattern: RegExp) => {
      const el = Array.from(document.querySelectorAll<HTMLElement>(selector)).find((node) => pattern.test((node.textContent || "").trim()));
      el?.click();
    };

    const onCapture = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      const moreButton = target.closest<HTMLElement>("[data-clean='more']");
      if (!moreButton) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      open();
    };

    const onBackdrop = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (target === backdrop || target.closest("[data-more-close]")) { close(); return; }
      const button = target.closest<HTMLButtonElement>("[data-more]");
      if (!button) return;
      const action = button.dataset.more;

      if (action === "book") {
        // Arabic-only mushaf/book reading. The Translation enhancer owns this mode switch.
        clickRef("arabic");
        window.localStorage.setItem("wopt-quran-text-mode", "arabic");
        document.querySelector<HTMLElement>(".quran-app")?.setAttribute("data-wopt-text-mode", "arabic");
        close();
        return;
      }
      if (action === "verse") clickRef("verse");
      if (action === "translation") clickText("button", /^Translation(?:\s|$)/i);
      if (action === "transliteration") clickText("button", /Arabic.*English|English letters/i);
      if (action === "info") clickRef("info");
      if (action === "memorize") clickText("button", /Memorize/i);
      if (action === "home") {
        // Use the actual browser path so GitHub Pages /WOPT/ is preserved.
        const current = window.location.pathname;
        const base = current.replace(/\/quran\/?$/, "/");
        window.location.assign(base || "/");
        return;
      }
      close();
    };

    document.addEventListener("click", onCapture, true);
    backdrop.addEventListener("click", onBackdrop);

    return () => {
      document.removeEventListener("click", onCapture, true);
      backdrop.removeEventListener("click", onBackdrop);
      backdrop.remove();
      style.remove();
    };
  }, [pathname]);

  return null;
}
