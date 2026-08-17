"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export default function QuranReferenceLayoutEnhancer() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname.endsWith("/quran") && !pathname.endsWith("/quran/")) return;

    const app = document.querySelector<HTMLElement>(".quran-app");
    if (!app) return;

    const style = document.createElement("style");
    style.dataset.woptReferenceQuranSafe = "true";
    style.textContent = `
      .quran-app.wopt-reference-safe{max-width:none!important;background:#fff!important;color:#151515!important;padding:0 0 64px!important}
      .quran-app.wopt-reference-safe>.quran-topbar,
      .quran-app.wopt-reference-safe>.quran-command-zone,
      .quran-app.wopt-reference-safe>.quran-reader-toolbar,
      .quran-app.wopt-reference-safe>.quran-mobile-nav,
      .quran-app.wopt-reference-safe>.verse-action-dock,
      .quran-app.wopt-reference-safe .wopt-reader-style-button,
      .quran-app.wopt-reference-safe .wopt-true-mushaf,
      .quran-app.wopt-reference-safe .enhanced-surah-title,
      .quran-app.wopt-reference-safe .mushaf-page-head,
      .quran-app.wopt-reference-safe .mushaf-page-foot{display:none!important}
      .quran-app.wopt-reference-safe .wopt-quran-player{position:fixed!important;left:-10000px!important;top:-10000px!important;width:1px!important;height:1px!important;opacity:0!important;pointer-events:none!important;overflow:hidden!important}
      .quran-app.wopt-reference-safe .mushaf-shell{max-width:760px!important;margin:0 auto!important;padding:0 26px 100px!important;border:0!important;border-radius:0!important;box-shadow:none!important;background:#fff!important}
      .quran-app.wopt-reference-safe .mushaf-text{display:block!important;padding:0!important;background:#fff!important;color:#111!important;font-family:"Noto Naskh Arabic","Amiri","Traditional Arabic",serif!important;font-size:clamp(25px,5.7vw,31px)!important;line-height:1.95!important;text-align:center!important;direction:rtl!important}
      .quran-app.wopt-reference-safe .mushaf-ayah{display:inline!important;background:transparent!important;box-shadow:none!important;border-radius:5px!important;padding:0!important}
      .quran-app.wopt-reference-safe .mushaf-ayah.playing,.quran-app.wopt-reference-safe .mushaf-ayah.wopt-sync-playing{background:#eef8f6!important;box-shadow:none!important}
      .quran-app.wopt-reference-safe .quran-word{display:inline!important;border:0!important;background:transparent!important;color:#111!important;font:inherit!important;line-height:inherit!important;padding:0 .025em!important;margin:0!important}
      .quran-app.wopt-reference-safe .quran-word.wopt-sync-word{background:#dff4ef!important;color:#111!important;border-radius:4px!important}
      .quran-app.wopt-reference-safe .ayah-marker{display:inline-grid!important;place-items:center!important;width:1.35em!important;height:1.35em!important;margin:0 .12em!important;border:1.4px solid #9aa19f!important;border-radius:50%!important;background:#fff!important;color:#666!important;box-shadow:none!important;font:600 .38em/1 Arial,sans-serif!important;vertical-align:.08em!important}
      .wopt-ref-safe{max-width:760px;margin:0 auto;background:#fff;color:#151515;font-family:Arial,sans-serif}
      .wopt-ref-safe-head{height:78px;padding:0 24px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #efefef}
      .wopt-ref-safe-brand{font:900 30px/1 Georgia,serif;letter-spacing:-.045em;color:#111;border:0;background:transparent;padding:0}
      .wopt-ref-safe-icons{display:flex;gap:20px;align-items:center}.wopt-ref-safe-icons button{border:0;background:transparent;font-size:26px;color:#111;padding:4px}
      .wopt-ref-safe-surah{padding:20px 24px 12px;display:flex;align-items:center;justify-content:space-between}.wopt-ref-safe-surah button{border:0;background:transparent}.wopt-ref-safe-surah .chooser{font-size:18px;font-weight:750;color:#222}.wopt-ref-safe-surah .gear{font-size:25px;color:#39aaa9}
      .wopt-ref-safe-tabs{height:70px;display:grid;grid-template-columns:1fr 1fr;border-bottom:1px solid #e8e8e8}.wopt-ref-safe-tabs button{position:relative;border:0;background:#fff;color:#666;font-size:16px}.wopt-ref-safe-tabs .active{color:#35aaa8;font-weight:700}.wopt-ref-safe-tabs .active:after{content:"";position:absolute;left:0;right:0;bottom:-1px;height:3px;background:#3bb0af}
      .wopt-ref-safe-card{margin:34px 20px 24px;padding:22px 22px 18px;border-radius:18px;background:#f5f6f7}
      .wopt-ref-safe-cardtop{display:grid;grid-template-columns:105px 1fr;gap:14px;align-items:center}.wopt-ref-safe-ar{font-family:"Noto Naskh Arabic","Amiri",serif;font-size:40px;line-height:1;text-align:center;direction:rtl}.wopt-ref-safe-title strong{display:block;font-size:22px}.wopt-ref-safe-title span{display:block;margin-top:4px;color:#5d5d5d;font-size:16px}
      .wopt-ref-safe-desc{margin:18px 0 14px;color:#666;font-size:12px;line-height:1.35}.wopt-ref-safe-actions{display:grid;grid-template-columns:62px 70px 1fr 1fr;gap:9px}.wopt-ref-safe-actions button{height:40px;border:1px solid #eee;border-radius:22px;background:#fff;color:#35a7a6;font-weight:750;box-shadow:0 2px 7px rgba(0,0,0,.05)}.wopt-ref-safe-actions .active{background:#222;color:#fff;border-color:#222}.wopt-ref-safe-actions .play{font-size:18px}
      .wopt-ref-safe-bismillah{text-align:center;padding:14px 20px 28px}.wopt-ref-safe-bismillah .ar{font-family:"Noto Naskh Arabic","Amiri",serif;font-size:30px;line-height:1.6;direction:rtl}.wopt-ref-safe-bismillah .en{margin-top:7px;color:#6a6a6a;font-size:12px}
      .wopt-ref-safe-search{display:none;margin:0 20px 20px;padding:11px 12px;border:1px solid #ddd;border-radius:14px}.wopt-ref-safe-search.open{display:flex;gap:8px}.wopt-ref-safe-search input{flex:1;min-width:0;border:0;outline:0;font-size:13px}.wopt-ref-safe-search button{border:0;border-radius:9px;background:#39aaa9;color:#fff;padding:0 14px;font-weight:700}
      @media(max-width:700px){
        .quran-app.wopt-reference-safe{padding-bottom:32px!important}
        .wopt-ref-safe-head{height:70px;padding:0 20px}.wopt-ref-safe-brand{font-size:27px}.wopt-ref-safe-icons{gap:16px}.wopt-ref-safe-icons button{font-size:23px}
        .wopt-ref-safe-surah{padding:17px 20px 10px}.wopt-ref-safe-tabs{height:64px}.wopt-ref-safe-tabs button{font-size:15px}
        .wopt-ref-safe-card{margin:26px 18px 22px;padding:18px}.wopt-ref-safe-cardtop{grid-template-columns:90px 1fr}.wopt-ref-safe-ar{font-size:35px}.wopt-ref-safe-title strong{font-size:20px}.wopt-ref-safe-title span{font-size:15px}.wopt-ref-safe-actions{grid-template-columns:56px 62px 1fr 1fr;gap:7px}.wopt-ref-safe-actions button{height:37px;font-size:11px}
        .wopt-ref-safe-bismillah{padding:12px 18px 24px}.wopt-ref-safe-bismillah .ar{font-size:27px}
        .quran-app.wopt-reference-safe .mushaf-shell{padding:0 22px 58px!important}.quran-app.wopt-reference-safe .mushaf-text{font-size:clamp(24px,6.15vw,28px)!important;line-height:1.95!important}
      }
    `;
    document.head.appendChild(style);
    app.classList.add("wopt-reference-safe");

    const shell = document.createElement("section");
    shell.className = "wopt-ref-safe";
    shell.innerHTML = `
      <div class="wopt-ref-safe-head">
        <button class="wopt-ref-safe-brand" data-ref="home" type="button">Hassoun Qur’an</button>
        <div class="wopt-ref-safe-icons"><button data-ref="search" type="button" aria-label="Search">⌕</button><button data-ref="menu" type="button" aria-label="Menu">☰</button></div>
      </div>
      <div class="wopt-ref-safe-surah"><button class="chooser" data-ref="surahs" type="button"><span data-ref-surah>Qur’an</span>⌄</button><button class="gear" data-ref="settings" type="button" aria-label="Reader settings">⚙</button></div>
      <div class="wopt-ref-safe-tabs"><button type="button" data-ref="verse">▤ &nbsp; Verse by Verse</button><button class="active" type="button" data-ref="reading">▤ &nbsp; Reading</button></div>
      <div class="wopt-ref-safe-card">
        <div class="wopt-ref-safe-cardtop"><div class="wopt-ref-safe-ar" data-ref-ar>القرآن</div><div class="wopt-ref-safe-title"><strong data-ref-title>Qur’an</strong><span data-ref-meaning></span></div></div>
        <p class="wopt-ref-safe-desc">Read and listen with translation, audio recitation, word-by-word tools, bookmarks, and memorization.</p>
        <div class="wopt-ref-safe-actions"><button class="play" data-ref="play" type="button">▶</button><button data-ref="info" type="button">Info</button><button class="active" data-ref="arabic" type="button">Arabic</button><button data-ref="translation" type="button">Translation</button></div>
      </div>
      <div class="wopt-ref-safe-search"><input type="search" placeholder="Search Qur’an in Arabic or English"><button type="button">Search</button></div>
      <div class="wopt-ref-safe-bismillah"><div class="ar">بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ</div><div class="en">In the Name of Allah—the Most Compassionate, Most Merciful</div></div>
    `;
    app.insertAdjacentElement("afterbegin", shell);

    const clickOriginal = (selector: string, text?: RegExp) => {
      const nodes = Array.from(document.querySelectorAll<HTMLElement>(selector));
      const node = text ? nodes.find((item) => text.test(item.textContent || "")) : nodes[0];
      node?.click();
    };

    const title = shell.querySelector<HTMLElement>("[data-ref-title]");
    const arabic = shell.querySelector<HTMLElement>("[data-ref-ar]");
    const meaning = shell.querySelector<HTMLElement>("[data-ref-meaning]");
    const surah = shell.querySelector<HTMLElement>("[data-ref-surah]");
    let lastSignature = "";

    const refresh = () => {
      const en = document.querySelector<HTMLElement>(".quran-title-line strong")?.textContent?.trim() || "Qur’an";
      const tr = document.querySelector<HTMLElement>(".quran-title-line span")?.textContent?.trim() || "";
      const ar = document.querySelector<HTMLElement>(".quran-heading-block h1")?.textContent?.trim() || "القرآن الكريم";
      const verseKey = document.querySelector<HTMLElement>(".mushaf-text [data-verse-key]")?.dataset.verseKey || "";
      const no = verseKey.split(":")[0] || "";
      const signature = `${no}|${en}|${tr}|${ar}`;
      if (signature === lastSignature) return;
      lastSignature = signature;
      if (title) title.textContent = `${no ? `${no}. ` : ""}${en}`;
      if (arabic) arabic.textContent = ar;
      if (meaning) meaning.textContent = tr;
      if (surah) surah.textContent = `${no ? `${no}. ` : ""}${en} `;
      const bismillah = shell.querySelector<HTMLElement>(".wopt-ref-safe-bismillah");
      if (bismillah) bismillah.style.display = no === "9" ? "none" : "block";
    };

    const refSearch = shell.querySelector<HTMLElement>(".wopt-ref-safe-search");
    const refInput = refSearch?.querySelector<HTMLInputElement>("input");
    const runSearch = () => {
      const value = refInput?.value.trim();
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
      if (action === "search") { refSearch?.classList.toggle("open"); refInput?.focus(); }
      if (action === "play") clickOriginal(".wopt-quran-player [data-player='play']");
      if (action === "translation") clickOriginal(".quran-reader-toolbar button", /^Translation$/i);
      if (action === "verse") {
        app.classList.remove("wopt-layout-book", "wopt-layout-flow", "wopt-layout-compact");
        app.classList.add("wopt-layout-cards");
        shell.querySelector("[data-ref='verse']")?.classList.add("active");
        shell.querySelector("[data-ref='reading']")?.classList.remove("active");
      }
      if (action === "reading") {
        app.classList.remove("wopt-layout-book", "wopt-layout-cards", "wopt-layout-compact");
        app.classList.add("wopt-layout-flow");
        shell.querySelector("[data-ref='reading']")?.classList.add("active");
        shell.querySelector("[data-ref='verse']")?.classList.remove("active");
      }
    };

    shell.addEventListener("click", onClick);
    refSearch?.querySelector("button")?.addEventListener("click", runSearch);
    refInput?.addEventListener("keydown", (event) => { if (event.key === "Enter") runSearch(); });

    app.classList.remove("wopt-layout-book", "wopt-layout-cards", "wopt-layout-compact");
    app.classList.add("wopt-layout-flow");
    refresh();
    const timer = window.setInterval(refresh, 900);

    return () => {
      window.clearInterval(timer);
      shell.removeEventListener("click", onClick);
      shell.remove();
      app.classList.remove("wopt-reference-safe");
      style.remove();
    };
  }, [pathname]);

  return null;
}
