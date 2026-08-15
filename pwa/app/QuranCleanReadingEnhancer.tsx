"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export default function QuranCleanReadingEnhancer() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname.endsWith("/quran") && !pathname.endsWith("/quran/")) return;

    const style = document.createElement("style");
    style.dataset.woptCleanReading = "true";
    style.textContent = `
      .quran-app.wopt-clean-reading .wopt-ref-safe{display:none!important}
      .quran-app.wopt-clean-reading .wopt-smart-mini{display:none!important}
      .quran-app.wopt-clean-reading .mushaf-shell{padding-top:0!important}
      .quran-app.wopt-clean-reading .wopt-clean-reader-head{display:block}
      .wopt-clean-reader-head{display:none;max-width:760px;margin:0 auto;padding:28px 22px 12px;background:var(--wopt-reader-bg,#fff);color:var(--wopt-reader-color,#111);font-family:Arial,sans-serif}
      .wopt-clean-meta{display:flex;align-items:center;justify-content:space-between;gap:18px;margin-bottom:24px;color:#5f6465;font-size:13px;font-weight:700}
      .wopt-clean-meta span:last-child{text-align:right}
      .wopt-clean-surah-banner{position:relative;display:flex;align-items:center;justify-content:center;min-height:58px;margin:0 0 20px;border:1.5px solid #16816c;background:rgba(250,248,240,.72);overflow:hidden}
      .wopt-clean-surah-banner:before,.wopt-clean-surah-banner:after{content:"✦  ❈  ✦";position:absolute;top:50%;transform:translateY(-50%);color:#16816c;font-size:14px;letter-spacing:4px;opacity:.85}
      .wopt-clean-surah-banner:before{left:14px}.wopt-clean-surah-banner:after{right:14px}
      .wopt-clean-surah-title{position:relative;z-index:1;padding:0 88px;background:rgba(250,248,240,.9);font-family:"Noto Naskh Arabic","Amiri",serif;font-size:26px;line-height:1.4;color:#111;direction:rtl;text-align:center}
      .wopt-clean-bismillah{text-align:center;margin:0 0 26px;font-family:"Noto Naskh Arabic","Amiri",serif;font-size:29px;line-height:1.55;direction:rtl;color:var(--wopt-reader-color,#111)}
      .wopt-clean-toolbar{position:fixed;z-index:3300;left:50%;bottom:max(18px,calc(env(safe-area-inset-bottom) + 12px));transform:translate(-50%,18px);display:flex;align-items:center;gap:6px;padding:7px;border:1px solid rgba(0,0,0,.08);border-radius:999px;background:rgba(255,255,255,.96);box-shadow:0 14px 44px rgba(0,0,0,.18);opacity:0;pointer-events:none;transition:opacity .18s ease,transform .18s ease;font-family:Arial,sans-serif;backdrop-filter:blur(14px)}
      .quran-app.wopt-clean-reading.wopt-clean-tools-open .wopt-clean-toolbar{opacity:1;pointer-events:auto;transform:translate(-50%,0)}
      .wopt-clean-toolbar button{min-width:50px;height:46px;border:0;border-radius:999px;background:transparent;color:#23423a;font-size:11px;font-weight:800;padding:0 10px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px}
      .wopt-clean-toolbar button b{font-size:18px;line-height:1}.wopt-clean-toolbar button:active{background:#e9f5f1}
      .wopt-clean-toolbar .play-active{background:#e8f6f2;color:#0b6653}
      .quran-app.wopt-clean-reading .wopt-verse-menu:not(.open),
      .quran-app.wopt-clean-reading .verse-action-dock{display:none!important}
      @media(max-width:700px){
        .wopt-clean-reader-head{padding:24px 18px 8px}.wopt-clean-meta{margin-bottom:20px;font-size:12px}.wopt-clean-surah-banner{min-height:54px;margin-bottom:17px}.wopt-clean-surah-title{font-size:24px;padding:0 72px}.wopt-clean-bismillah{font-size:27px;margin-bottom:22px}
        .quran-app.wopt-clean-reading .mushaf-shell{padding-left:18px!important;padding-right:18px!important}
        .wopt-clean-toolbar{max-width:calc(100vw - 22px);gap:2px;padding:6px}.wopt-clean-toolbar button{min-width:48px;padding:0 8px;font-size:10px}
      }
    `;
    document.head.appendChild(style);

    const app = document.querySelector<HTMLElement>(".quran-app");
    const mushaf = document.querySelector<HTMLElement>(".mushaf-shell");
    if (!app || !mushaf) { style.remove(); return; }

    const head = document.createElement("section");
    head.className = "wopt-clean-reader-head";
    head.innerHTML = `
      <div class="wopt-clean-meta"><span data-clean-surah>Surah</span><span data-clean-location>Juz — · Page —</span></div>
      <div class="wopt-clean-surah-banner"><div class="wopt-clean-surah-title" data-clean-arabic>سورة</div></div>
      <div class="wopt-clean-bismillah" data-clean-bismillah>بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ</div>`;
    mushaf.insertAdjacentElement("beforebegin", head);

    const toolbar = document.createElement("div");
    toolbar.className = "wopt-clean-toolbar";
    toolbar.setAttribute("aria-label", "Qur’an reading tools");
    toolbar.innerHTML = `
      <button type="button" data-clean="play"><b>▶</b><span>Audio</span></button>
      <button type="button" data-clean="surahs"><b>☷</b><span>Surahs</span></button>
      <button type="button" data-clean="search"><b>⌕</b><span>Search</span></button>
      <button type="button" data-clean="settings"><b>Aa</b><span>Reader</span></button>
      <button type="button" data-clean="more"><b>⋯</b><span>More</span></button>`;
    document.body.appendChild(toolbar);

    let hideTimer: number | null = null;
    let lastSig = "";

    const clearHide = () => { if (hideTimer) window.clearTimeout(hideTimer); hideTimer = null; };
    const hideTools = () => { app.classList.remove("wopt-clean-tools-open"); };
    const showTools = (delay = 4200) => {
      app.classList.add("wopt-clean-tools-open");
      clearHide();
      hideTimer = window.setTimeout(hideTools, delay);
    };

    const isReading = () => {
      const reading = document.querySelector<HTMLElement>(".wopt-ref-safe-tabs [data-ref='reading']");
      if (reading) return reading.classList.contains("active");
      return !app.classList.contains("wopt-layout-cards");
    };

    const refresh = () => {
      const reading = isReading();
      app.classList.toggle("wopt-clean-reading", reading);
      if (!reading) app.classList.remove("wopt-clean-tools-open");

      const verse = document.querySelector<HTMLElement>(".mushaf-text [data-verse-key]");
      const key = verse?.dataset.verseKey || "";
      const surahNo = key.split(":")[0] || "";
      const en = document.querySelector<HTMLElement>(".quran-title-line strong")?.textContent?.trim()
        || document.querySelector<HTMLElement>("[data-ref-title]")?.textContent?.replace(/^\d+\.\s*/, "").trim()
        || "Qur’an";
      const ar = document.querySelector<HTMLElement>(".quran-heading-block h1")?.textContent?.trim()
        || document.querySelector<HTMLElement>("[data-ref-ar]")?.textContent?.trim()
        || "سورة";
      const juz = verse?.dataset.juz || document.querySelector<HTMLElement>(".mushaf-page-foot span:first-child")?.textContent?.replace(/[^0-9]/g, "") || "—";
      const page = verse?.dataset.page || document.querySelector<HTMLElement>(".mushaf-page-foot span:last-child")?.textContent?.replace(/[^0-9]/g, "") || "—";
      const sig = `${reading}|${surahNo}|${en}|${ar}|${juz}|${page}`;
      if (sig !== lastSig) {
        lastSig = sig;
        const s = head.querySelector<HTMLElement>("[data-clean-surah]");
        const a = head.querySelector<HTMLElement>("[data-clean-arabic]");
        const l = head.querySelector<HTMLElement>("[data-clean-location]");
        const b = head.querySelector<HTMLElement>("[data-clean-bismillah]");
        if (s) s.textContent = `${surahNo ? `Surah ${surahNo} · ` : ""}${en}`;
        if (a) a.textContent = ar.startsWith("سورة") ? ar : `سورة ${ar}`;
        if (l) l.textContent = `Juz ${juz} · Page ${page}`;
        if (b) b.style.display = surahNo === "9" ? "none" : "block";
      }

      const hiddenPlay = document.querySelector<HTMLButtonElement>(".wopt-quran-player [data-player='play']")?.textContent || "";
      const play = toolbar.querySelector<HTMLButtonElement>("[data-clean='play']");
      if (play) {
        const active = /pause|resume/i.test(hiddenPlay);
        play.classList.toggle("play-active", active);
        const icon = play.querySelector("b");
        if (icon) icon.textContent = /pause/i.test(hiddenPlay) ? "❚❚" : "▶";
      }
    };

    const triggerRef = (name: string) => document.querySelector<HTMLElement>(`.wopt-ref-safe [data-ref='${name}']`)?.click();

    const onToolbar = (event: MouseEvent) => {
      const button = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-clean]");
      if (!button) return;
      event.stopPropagation();
      const action = button.dataset.clean;
      if (action === "play") document.querySelector<HTMLButtonElement>(".wopt-quran-player [data-player='play']")?.click();
      if (action === "surahs") triggerRef("surahs");
      if (action === "search") triggerRef("search");
      if (action === "settings") triggerRef("settings");
      if (action === "more") {
        app.classList.remove("wopt-clean-reading");
        showTools(7000);
        window.setTimeout(() => app.classList.add("wopt-clean-reading"), 7000);
      }
      showTools(action === "settings" || action === "surahs" || action === "search" ? 8000 : 4200);
    };

    const onPageTap = (event: PointerEvent) => {
      if (!app.classList.contains("wopt-clean-reading")) return;
      const target = event.target as HTMLElement;
      if (target.closest(".wopt-clean-toolbar,.wopt-ref-settings-backdrop,.quran-drawer-backdrop,.wopt-search-backdrop,.wopt-verse-menu,.wopt-verse-translate-backdrop,.memorize-overlay")) return;
      if (app.classList.contains("wopt-clean-tools-open")) hideTools(); else showTools();
    };

    toolbar.addEventListener("click", onToolbar);
    document.addEventListener("pointerdown", onPageTap, { passive: true });
    const timer = window.setInterval(refresh, 350);
    refresh();

    return () => {
      clearHide();
      window.clearInterval(timer);
      toolbar.removeEventListener("click", onToolbar);
      document.removeEventListener("pointerdown", onPageTap);
      toolbar.remove();
      head.remove();
      app.classList.remove("wopt-clean-reading", "wopt-clean-tools-open");
      style.remove();
    };
  }, [pathname]);

  return null;
}
