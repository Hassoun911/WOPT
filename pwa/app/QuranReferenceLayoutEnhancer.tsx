"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export default function QuranReferenceLayoutEnhancer() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname.endsWith("/quran") && !pathname.endsWith("/quran/")) return;

    const style = document.createElement("style");
    style.dataset.woptReferenceQuran = "true";
    style.textContent = `
      .quran-app.wopt-reference-reading{background:#fff!important;color:#171717!important;max-width:none!important;padding-bottom:40px!important}
      .quran-app.wopt-reference-reading .quran-topbar,
      .quran-app.wopt-reference-reading .quran-command-zone,
      .quran-app.wopt-reference-reading .quran-reader-toolbar,
      .quran-app.wopt-reference-reading .quran-mobile-nav,
      .quran-app.wopt-reference-reading .verse-action-dock{display:none!important}
      .quran-app.wopt-reference-reading .wopt-quran-player{position:fixed!important;left:-9999px!important;top:-9999px!important;width:1px!important;height:1px!important;opacity:0!important;pointer-events:none!important;overflow:hidden!important;margin:0!important;padding:0!important}
      .quran-app.wopt-reference-reading .mushaf-shell{max-width:820px!important;margin:0 auto!important;padding:0!important;border:0!important;border-radius:0!important;background:#fff!important;box-shadow:none!important}
      .quran-app.wopt-reference-reading .wopt-true-mushaf{display:block!important;min-height:auto!important;margin:0!important;padding:0 22px 70px!important;border:0!important;background:#fff!important;box-shadow:none!important;color:#111!important}
      .quran-app.wopt-reference-reading .wopt-mushaf-meta{display:none!important}
      .quran-app.wopt-reference-reading .wopt-mushaf-footer{border:0!important;display:flex!important;justify-content:center!important;padding:18px 0 12px!important;color:#666!important;font:500 15px/1 Arial,sans-serif!important}
      .quran-app.wopt-reference-reading .wopt-mushaf-footer span:not(.page-no){display:none!important}
      .quran-app.wopt-reference-reading .wopt-page-nav{display:none!important}
      .quran-app.wopt-reference-reading .wopt-surah-break{margin:24px 0 16px!important}
      .quran-app.wopt-reference-reading .wopt-surah-banner{border:0!important;background:transparent!important;display:block!important;min-height:0!important;padding:0!important;color:#111!important}
      .quran-app.wopt-reference-reading .wopt-surah-banner strong{display:block!important;font-family:var(--wopt-reader-font,"Noto Naskh Arabic",serif)!important;font-size:32px!important;font-weight:500!important;line-height:1.3!important}
      .quran-app.wopt-reference-reading .wopt-surah-banner small{display:block!important;margin-top:3px!important;color:#555!important;font:600 12px/1.3 Arial,sans-serif!important}
      .quran-app.wopt-reference-reading .wopt-surah-bismillah{margin:22px 0 16px!important;font-size:29px!important;line-height:1.5!important;color:#111!important}
      .quran-app.wopt-reference-reading .wopt-mushaf-lines{font-family:var(--wopt-reader-font,"Noto Naskh Arabic","Amiri",serif)!important;font-size:29px!important;line-height:1.82!important;color:#111!important}
      .quran-app.wopt-reference-reading .wopt-mushaf-line{min-height:auto!important;margin:0!important;text-align:center!important;text-align-last:center!important;word-spacing:.06em!important}
      .quran-app.wopt-reference-reading .wopt-page-ayah{background:transparent!important;box-shadow:none!important;border-radius:5px!important}
      .quran-app.wopt-reference-reading .wopt-page-ayah.wopt-sync-playing{background:#eef8f6!important;box-shadow:none!important}
      .quran-app.wopt-reference-reading .wopt-page-ayah .quran-word{padding:0 .015em!important;color:#111!important}
      .quran-app.wopt-reference-reading .wopt-page-marker{width:1.34em!important;height:1.34em!important;margin:0 .10em!important;border:1.4px solid #8f9895!important;color:#5f6966!important;background:#fff!important;box-shadow:none!important;font:600 .38em/1 Arial,sans-serif!important;vertical-align:.08em!important}

      .wopt-ref-shell{max-width:820px;margin:0 auto;background:#fff;color:#111;font-family:Arial,sans-serif}
      .wopt-ref-header{height:76px;padding:0 22px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #f0f0f0;background:#fff}
      .wopt-ref-brand{border:0;background:transparent;color:#111;font:900 29px/1 Georgia,serif;letter-spacing:-.04em;padding:0;cursor:pointer}
      .wopt-ref-icons{display:flex;align-items:center;gap:22px}.wopt-ref-icon{border:0;background:transparent;color:#111;font-size:26px;line-height:1;padding:5px;cursor:pointer}
      .wopt-ref-surah-row{padding:18px 24px 12px;display:flex;align-items:center;justify-content:space-between;gap:14px;background:#fff}
      .wopt-ref-surah-button{border:0;background:transparent;color:#1d1d1d;font-size:17px;font-weight:750;padding:4px 0;cursor:pointer;text-align:left}.wopt-ref-surah-button span{margin-left:7px;font-size:13px}
      .wopt-ref-gear{border:0;background:transparent;color:#39aaa9;font-size:24px;padding:4px;cursor:pointer}
      .wopt-ref-tabs{height:72px;display:grid;grid-template-columns:1fr 1fr;border-bottom:1px solid #ececec;background:#fff}
      .wopt-ref-tabs button{position:relative;border:0;background:#fff;color:#656565;font-size:16px;cursor:pointer}.wopt-ref-tabs button.active{color:#37aaa9;font-weight:700}.wopt-ref-tabs button.active:after{content:"";position:absolute;left:0;right:0;bottom:-1px;height:3px;background:#3bb0af}
      .wopt-ref-card{margin:34px 20px 26px;padding:20px 22px 18px;border-radius:16px;background:#f5f6f7}
      .wopt-ref-card-head{display:grid;grid-template-columns:110px 1fr;gap:14px;align-items:center}.wopt-ref-arabic-mark{font-family:var(--wopt-reader-font,"Noto Naskh Arabic",serif);font-size:39px;font-weight:650;line-height:1;text-align:center;direction:rtl}.wopt-ref-title strong{display:block;font-size:21px}.wopt-ref-title span{display:block;margin-top:3px;color:#595959;font-size:16px}
      .wopt-ref-desc{margin:17px 0 14px;color:#666;font-size:11px;line-height:1.35}
      .wopt-ref-actions{display:grid;grid-template-columns:60px 68px 1fr 1fr;gap:10px}.wopt-ref-actions button{height:39px;border:1px solid #eee;border-radius:20px;background:#fff;color:#35a7a6;font-size:12px;font-weight:750;box-shadow:0 2px 8px rgba(0,0,0,.05);cursor:pointer}.wopt-ref-actions button.active{background:#202020;color:#fff;border-color:#202020}.wopt-ref-actions .play{font-size:18px}
      .wopt-ref-bismillah{padding:15px 24px 20px;text-align:center;background:#fff}.wopt-ref-bismillah .arabic{font-family:var(--wopt-reader-font,"Noto Naskh Arabic",serif);font-size:29px;line-height:1.6;direction:rtl}.wopt-ref-bismillah .english{margin-top:8px;color:#6b6b6b;font-size:11px}
      .wopt-ref-search{display:none;margin:0 20px 20px;padding:12px;border:1px solid #ddd;border-radius:14px;background:#fff}.wopt-ref-search.open{display:flex;gap:8px}.wopt-ref-search input{flex:1;min-width:0;border:0;outline:0;font-size:13px}.wopt-ref-search button{border:0;border-radius:10px;background:#39aaa9;color:#fff;padding:0 14px;font-weight:700}
      .wopt-reference-reading .wopt-reader-style-button{display:none!important}

      @media(max-width:700px){
        .quran-app.wopt-reference-reading{padding:0!important}
        .wopt-ref-shell{width:100%}
        .wopt-ref-header{height:70px;padding:0 20px}.wopt-ref-brand{font-size:27px}.wopt-ref-icons{gap:17px}.wopt-ref-icon{font-size:23px}
        .wopt-ref-surah-row{padding:17px 22px 10px}.wopt-ref-tabs{height:66px}.wopt-ref-tabs button{font-size:15px}
        .wopt-ref-card{margin:28px 18px 24px;padding:18px}.wopt-ref-card-head{grid-template-columns:92px 1fr}.wopt-ref-arabic-mark{font-size:35px}.wopt-ref-title strong{font-size:20px}.wopt-ref-title span{font-size:15px}
        .wopt-ref-actions{grid-template-columns:58px 64px 1fr 1fr;gap:7px}.wopt-ref-actions button{height:37px;font-size:11px}
        .wopt-ref-bismillah{padding:12px 20px 18px}.wopt-ref-bismillah .arabic{font-size:27px}
        .quran-app.wopt-reference-reading .wopt-true-mushaf{padding:0 20px 55px!important}
        .quran-app.wopt-reference-reading .wopt-mushaf-lines{font-size:clamp(23px,6.05vw,27px)!important;line-height:1.9!important}
        .quran-app.wopt-reference-reading .wopt-surah-break{margin:22px 0 14px!important}
        .quran-app.wopt-reference-reading .wopt-surah-banner strong{font-size:28px!important}.quran-app.wopt-reference-reading .wopt-surah-bismillah{font-size:26px!important}
      }
    `;
    document.head.appendChild(style);

    const app = document.querySelector<HTMLElement>(".quran-app");
    if (!app) { style.remove(); return; }
    app.classList.add("wopt-reference-reading");

    const shell = document.createElement("section");
    shell.className = "wopt-ref-shell";
    shell.innerHTML = `
      <div class="wopt-ref-header">
        <button class="wopt-ref-brand" type="button" data-ref="home">WOPT Qur’an</button>
        <div class="wopt-ref-icons"><button class="wopt-ref-icon" type="button" data-ref="language" aria-label="Language">◎</button><button class="wopt-ref-icon" type="button" data-ref="search" aria-label="Search">⌕</button><button class="wopt-ref-icon" type="button" data-ref="menu" aria-label="Menu">☰</button></div>
      </div>
      <div class="wopt-ref-surah-row"><button class="wopt-ref-surah-button" type="button" data-ref="surahs">Qur’an <span>⌄</span></button><button class="wopt-ref-gear" type="button" data-ref="settings" aria-label="Reader settings">⚙</button></div>
      <div class="wopt-ref-tabs"><button type="button" data-ref="verse-mode">▤ &nbsp; Verse by Verse</button><button class="active" type="button" data-ref="reading-mode">▤ &nbsp; Reading</button></div>
      <div class="wopt-ref-card">
        <div class="wopt-ref-card-head"><div class="wopt-ref-arabic-mark" data-ref-arabic>القرآن</div><div class="wopt-ref-title"><strong data-ref-title>Qur’an</strong><span data-ref-translation></span></div></div>
        <p class="wopt-ref-desc" data-ref-desc>Read and listen with translation, audio recitation, word-by-word tools, bookmarks, and memorization.</p>
        <div class="wopt-ref-actions"><button class="play" type="button" data-ref="play">▶</button><button type="button" data-ref="info">Info</button><button class="active" type="button" data-ref="arabic">Arabic</button><button type="button" data-ref="translation">Translation</button></div>
      </div>
      <div class="wopt-ref-search"><input type="search" placeholder="Search Qur’an in Arabic or English"><button type="button">Search</button></div>
      <div class="wopt-ref-bismillah"><div class="arabic">بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ</div><div class="english">In the Name of Allah—the Most Compassionate, Most Merciful</div></div>
    `;

    app.insertAdjacentElement("afterbegin", shell);

    const refTitle = shell.querySelector<HTMLElement>("[data-ref-title]");
    const refArabic = shell.querySelector<HTMLElement>("[data-ref-arabic]");
    const refTranslation = shell.querySelector<HTMLElement>("[data-ref-translation]");
    const surahButton = shell.querySelector<HTMLButtonElement>("[data-ref='surahs']");
    const refSearch = shell.querySelector<HTMLElement>(".wopt-ref-search");
    const refSearchInput = refSearch?.querySelector<HTMLInputElement>("input");

    const refreshChapter = () => {
      const english = document.querySelector<HTMLElement>(".quran-title-line strong")?.textContent?.trim() || "Qur’an";
      const translated = document.querySelector<HTMLElement>(".quran-title-line span")?.textContent?.trim() || "";
      const arabic = document.querySelector<HTMLElement>(".quran-heading-block h1")?.textContent?.trim() || "القرآن الكريم";
      const verseKey = document.querySelector<HTMLElement>("[data-verse-key]")?.dataset.verseKey || "";
      const chapterNo = verseKey.split(":")[0] || "";
      if (refTitle) refTitle.textContent = `${chapterNo ? `${chapterNo}. ` : ""}${english}`;
      if (refArabic) refArabic.textContent = arabic;
      if (refTranslation) refTranslation.textContent = translated;
      if (surahButton) surahButton.innerHTML = `${chapterNo ? `${chapterNo}. ` : ""}${english} <span>⌄</span>`;
    };

    const clickOriginal = (selector: string, text?: RegExp) => {
      const nodes = Array.from(document.querySelectorAll<HTMLElement>(selector));
      const target = text ? nodes.find((node) => text.test(node.textContent || "")) : nodes[0];
      target?.click();
    };

    const setLayout = (layout: "book" | "cards") => {
      app.classList.remove("wopt-layout-book", "wopt-layout-flow", "wopt-layout-cards", "wopt-layout-compact");
      app.classList.add(layout === "book" ? "wopt-layout-book" : "wopt-layout-cards");
      const current = (() => { try { return JSON.parse(localStorage.getItem("wopt-quran-reader-style-v3") || "{}"); } catch { return {}; } })();
      localStorage.setItem("wopt-quran-reader-style-v3", JSON.stringify({ ...current, layout }));
      shell.querySelector("[data-ref='reading-mode']")?.classList.toggle("active", layout === "book");
      shell.querySelector("[data-ref='verse-mode']")?.classList.toggle("active", layout === "cards");
    };

    const performRefSearch = () => {
      const value = refSearchInput?.value.trim();
      if (!value) return;
      const original = document.querySelector<HTMLInputElement>(".quran-search-box input");
      if (original) {
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
        setter?.call(original, value);
        original.dispatchEvent(new Event("input", { bubbles: true }));
        original.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
      }
      refSearch?.classList.remove("open");
    };

    const onClick = (event: MouseEvent) => {
      const target = (event.target as HTMLElement).closest<HTMLElement>("[data-ref]");
      if (!target) return;
      const action = target.dataset.ref;
      if (action === "home") window.location.href = pathname.replace(/\/quran\/?$/, "/");
      if (action === "surahs" || action === "menu") clickOriginal(".quran-top-actions button", /surahs/i);
      if (action === "settings") clickOriginal(".quran-top-actions button", /^Aa$/i);
      if (action === "search") { refSearch?.classList.toggle("open"); refSearchInput?.focus(); }
      if (action === "play") clickOriginal(".wopt-quran-player [data-player='play']");
      if (action === "translation") clickOriginal(".quran-reader-toolbar button", /^Translation$/i);
      if (action === "verse-mode") setLayout("cards");
      if (action === "reading-mode") setLayout("book");
    };
    shell.addEventListener("click", onClick);
    refSearch?.querySelector("button")?.addEventListener("click", performRefSearch);
    refSearchInput?.addEventListener("keydown", (event) => { if (event.key === "Enter") performRefSearch(); });

    setLayout("book");
    refreshChapter();
    const observer = new MutationObserver(refreshChapter);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });

    return () => {
      observer.disconnect();
      app.classList.remove("wopt-reference-reading");
      shell.removeEventListener("click", onClick);
      shell.remove();
      style.remove();
    };
  }, [pathname]);

  return null;
}
