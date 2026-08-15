"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const API = "https://api.quran.com/api/v4";

type Chapter = {
  id: number;
  name_simple: string;
  name_arabic: string;
  translated_name?: { name?: string };
};

type Word = {
  position?: number;
  text_uthmani?: string;
  text?: string;
  line_number?: number;
  char_type_name?: string;
};

type Verse = {
  verse_key: string;
  verse_number: number;
  juz_number?: number;
  page_number?: number;
  text_uthmani?: string;
  words?: Word[];
};

type Fragment = {
  verseKey: string;
  verseNumber: number;
  words: Word[];
  isLast: boolean;
};

function currentBookPage() {
  const foot = document.querySelector<HTMLElement>(".mushaf-page-foot")?.textContent || "";
  const match = foot.match(/page\s*([0-9٠-٩۰-۹]+)/i);
  if (match) {
    const normalized = match[1]
      .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
      .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)));
    const n = Number(normalized);
    if (n >= 1 && n <= 604) return n;
  }
  return Number(window.localStorage.getItem("wopt-mushaf-page") || 1) || 1;
}

function verseParts(key: string) {
  const [chapter, verse] = key.split(":").map(Number);
  return { chapter, verse };
}

export default function QuranTrueMushafEnhancer() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname.endsWith("/quran") && !pathname.endsWith("/quran/")) return;

    const style = document.createElement("style");
    style.dataset.woptTrueMushaf = "true";
    style.textContent = `
      .wopt-true-mushaf{display:none}
      .quran-app.wopt-layout-book .mushaf-text,
      .quran-app.wopt-layout-book .enhanced-surah-title,
      .quran-app.wopt-layout-book .mushaf-page-head,
      .quran-app.wopt-layout-book .mushaf-page-foot{display:none!important}
      .quran-app.wopt-layout-book .wopt-true-mushaf{display:block;position:relative;margin:0 auto;background:var(--wopt-page-color,#fffdf5);color:var(--wopt-reader-color,#111);min-height:calc(100dvh - 190px);padding:22px 28px 112px;border:1px solid rgba(31,94,75,.42);box-shadow:0 10px 35px rgba(55,48,25,.08);direction:rtl}
      .wopt-mushaf-meta{direction:ltr;display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:10px;margin-bottom:16px;color:#66706d;font:700 11px/1.2 Arial,sans-serif}
      .wopt-mushaf-meta span:nth-child(2){color:#2b3431;font-size:12px}.wopt-mushaf-meta span:last-child{text-align:right}
      .wopt-mushaf-lines{direction:rtl;font-family:var(--wopt-reader-font,"Noto Naskh Arabic","Amiri",serif);font-size:clamp(24px,5.25vw,32px);line-height:1.62;color:var(--wopt-reader-color,#111)}
      .wopt-mushaf-line{min-height:1.62em;text-align:justify;text-align-last:center;white-space:normal}
      .wopt-page-ayah{display:inline;border-radius:7px;transition:background .18s ease,box-shadow .18s ease}
      .wopt-page-ayah.wopt-sync-playing{background:rgba(211,170,87,.18);box-shadow:0 0 0 4px rgba(211,170,87,.13)}
      .wopt-page-ayah .quran-word{display:inline;padding:0 .035em;border:0;background:transparent;color:inherit;font:inherit;line-height:inherit}
      .wopt-page-ayah .quran-word.wopt-sync-word{background:#efd78f!important;color:#17362e!important;border-radius:5px}
      .wopt-page-marker{display:inline-grid;place-items:center;width:1.62em;height:1.62em;margin:0 .18em;vertical-align:.03em;border:2px solid #179477;border-radius:50%;color:#0c846a!important;background:transparent!important;font:700 .48em/1 Arial,sans-serif;cursor:pointer;box-shadow:inset 0 0 0 2px var(--wopt-page-color,#fffdf5),inset 0 0 0 3px #179477}
      .wopt-surah-break{direction:rtl;margin:17px 0 10px;text-align:center}
      .wopt-surah-banner{min-height:43px;padding:7px 14px;display:flex;align-items:center;justify-content:center;gap:11px;border:1px solid rgba(23,148,119,.7);background:rgba(23,148,119,.035);color:#111;font-family:var(--wopt-reader-font,"Noto Naskh Arabic",serif)}
      .wopt-surah-banner strong{font-size:21px;font-weight:600}.wopt-surah-banner small{direction:ltr;color:#69716f;font:700 10px/1.2 Arial,sans-serif}
      .wopt-surah-bismillah{margin:9px 0 6px;font-family:var(--wopt-reader-font,"Noto Naskh Arabic",serif);font-size:1.02em;line-height:1.65;color:inherit}
      .wopt-mushaf-footer{direction:ltr;margin-top:18px;padding-top:10px;border-top:1px solid rgba(31,94,75,.16);display:grid;grid-template-columns:1fr auto 1fr;align-items:center;color:#68716e;font:700 10px/1.2 Arial,sans-serif}
      .wopt-mushaf-footer .page-no{font-size:13px;color:#434a47}
      .wopt-page-nav{direction:ltr;display:flex;justify-content:center;gap:9px;margin:12px 0 0}
      .wopt-page-nav button{min-width:92px;height:38px;border:1px solid rgba(31,94,75,.28);border-radius:10px;background:transparent;color:#0b5b47;font:800 10px/1 Arial,sans-serif}
      .wopt-page-loading{min-height:60dvh;display:grid;place-items:center;color:#68716e;font:700 11px Arial,sans-serif}
      @media(max-width:700px){
        .quran-app.wopt-layout-book .mushaf-shell{margin:8px -8px 0!important;padding:0!important;border:0!important;border-radius:0!important;background:transparent!important;box-shadow:none!important}
        .quran-app.wopt-layout-book .wopt-true-mushaf{padding:14px 12px calc(122px + env(safe-area-inset-bottom));min-height:calc(100dvh - 118px);border-left:1px solid rgba(31,94,75,.38);border-right:1px solid rgba(31,94,75,.38);border-top:0;border-bottom:0;box-shadow:none}
        .wopt-mushaf-meta{margin-bottom:11px;font-size:9px}
        .wopt-mushaf-lines{font-size:clamp(23px,6.45vw,29px);line-height:1.58}
        .wopt-mushaf-line{min-height:1.58em}
        .wopt-surah-break{margin:12px 0 7px}.wopt-surah-banner{min-height:38px;padding:5px 10px}.wopt-surah-banner strong{font-size:19px}.wopt-surah-bismillah{margin:7px 0 4px}
        .wopt-page-marker{width:1.55em;height:1.55em}
      }
    `;
    document.head.appendChild(style);

    let container: HTMLElement | null = null;
    let chapters: Chapter[] = [];
    let activePage = 0;
    let requestToken = 0;
    let destroyed = false;

    const chapterInfo = (id: number) => chapters.find((chapter) => chapter.id === id);

    const ensureContainer = () => {
      const shell = document.querySelector<HTMLElement>(".mushaf-shell");
      if (!shell) return null;
      let found = shell.querySelector<HTMLElement>(".wopt-true-mushaf");
      if (!found) {
        found = document.createElement("section");
        found.className = "wopt-true-mushaf";
        shell.insertAdjacentElement("afterbegin", found);
      }
      container = found;
      return found;
    };

    const renderSurahBreak = (chapterId: number) => {
      const chapter = chapterInfo(chapterId);
      const translated = chapter?.translated_name?.name || "";
      return `<div class="wopt-surah-break"><div class="wopt-surah-banner"><strong>${chapter?.name_arabic || `سورة ${chapterId}`}</strong><small>${chapter ? `${chapter.id}. ${chapter.name_simple}${translated ? ` · ${translated}` : ""}` : `Surah ${chapterId}`}</small></div>${chapterId !== 9 ? `<div class="wopt-surah-bismillah">بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ</div>` : ""}</div>`;
    };

    const renderPage = async (page: number, force = false) => {
      const app = document.querySelector<HTMLElement>(".quran-app");
      if (!app?.classList.contains("wopt-layout-book")) return;
      const target = Math.max(1, Math.min(604, page));
      if (!force && activePage === target && container?.dataset.ready === "true") return;
      const host = ensureContainer();
      if (!host) return;
      activePage = target;
      window.localStorage.setItem("wopt-mushaf-page", String(target));
      const token = ++requestToken;
      host.dataset.ready = "false";
      host.innerHTML = `<div class="wopt-page-loading">Loading Mushaf page ${target}…</div>`;

      try {
        const url = `${API}/verses/by_page/${target}?language=en&words=true&word_fields=text_uthmani,line_number,position,char_type_name&fields=text_uthmani,page_number,juz_number&per_page=50`;
        const response = await fetch(url, { cache: "force-cache" });
        if (!response.ok) throw new Error("page");
        const data = await response.json() as { verses?: Verse[] };
        if (destroyed || token !== requestToken) return;
        const verses = data.verses || [];
        if (!verses.length) throw new Error("empty-page");

        const first = verses[0];
        const firstChapter = verseParts(first.verse_key).chapter;
        const lastChapter = verseParts(verses[verses.length - 1].verse_key).chapter;
        const juz = first.juz_number || 1;
        const lineMap = new Map<number, Fragment[]>();
        let fallbackLine = 1;

        for (const verse of verses) {
          const usableWords = (verse.words || []).filter((word) => {
            const type = (word.char_type_name || "word").toLowerCase();
            return type !== "end" && Boolean(word.text_uthmani || word.text);
          });
          if (!usableWords.length) {
            const synthetic: Word = { position: 1, text_uthmani: verse.text_uthmani || "", line_number: fallbackLine };
            usableWords.push(synthetic);
          }
          const grouped = new Map<number, Word[]>();
          for (const word of usableWords) {
            const line = Number(word.line_number || fallbackLine);
            const list = grouped.get(line) || [];
            list.push(word);
            grouped.set(line, list);
            fallbackLine = Math.max(fallbackLine, line);
          }
          const lines = Array.from(grouped.keys()).sort((a, b) => a - b);
          lines.forEach((line, index) => {
            const fragments = lineMap.get(line) || [];
            fragments.push({ verseKey: verse.verse_key, verseNumber: verse.verse_number, words: grouped.get(line) || [], isLast: index === lines.length - 1 });
            lineMap.set(line, fragments);
          });
          fallbackLine += 1;
        }

        const sortedLines = Array.from(lineMap.keys()).sort((a, b) => a - b);
        let lastBannerChapter = -1;
        const linesHtml = sortedLines.map((lineNo) => {
          const fragments = lineMap.get(lineNo) || [];
          const bannerIds = fragments
            .filter((fragment) => fragment.verseNumber === 1)
            .map((fragment) => verseParts(fragment.verseKey).chapter)
            .filter((id) => id !== lastBannerChapter);
          const banners = bannerIds.map((id) => { lastBannerChapter = id; return renderSurahBreak(id); }).join("");
          const line = fragments.map((fragment) => {
            const words = fragment.words.map((word, index) => {
              const pos = word.position || index + 1;
              const text = word.text_uthmani || word.text || "";
              return `<button class="quran-word" type="button" data-word-position="${pos}" aria-label="Play word">${text}</button>`;
            }).join(" ");
            const marker = fragment.isLast ? `<button class="ayah-marker wopt-page-marker" type="button" aria-label="Play ayah ${fragment.verseKey}">${fragment.verseNumber}</button>` : "";
            return `<span class="wopt-page-ayah mushaf-ayah" data-verse-key="${fragment.verseKey}">${words}${marker}</span>`;
          }).join(" ");
          return `${banners}<div class="wopt-mushaf-line" data-line="${lineNo}">${line}</div>`;
        }).join("");

        const firstName = chapterInfo(firstChapter)?.name_simple || `Surah ${firstChapter}`;
        const lastName = chapterInfo(lastChapter)?.name_simple || `Surah ${lastChapter}`;
        const chapterLabel = firstChapter === lastChapter ? firstName : `${firstName} / ${lastName}`;
        host.innerHTML = `
          <div class="wopt-mushaf-meta"><span>${chapterLabel}</span><span>Juz ${juz}</span><span>Page ${target}</span></div>
          <div class="wopt-mushaf-lines">${linesHtml}</div>
          <div class="wopt-mushaf-footer"><span>${chapterLabel}</span><span class="page-no">${target}</span><span>Juz ${juz}</span></div>
          <div class="wopt-page-nav"><button type="button" data-mushaf-page="${target - 1}" ${target <= 1 ? "disabled" : ""}>← Previous</button><button type="button" data-mushaf-page="${target + 1}" ${target >= 604 ? "disabled" : ""}>Next →</button></div>
        `;
        host.dataset.ready = "true";
        host.dataset.page = String(target);
      } catch {
        if (destroyed || token !== requestToken) return;
        host.innerHTML = `<div class="wopt-page-loading">Could not load Mushaf page ${target}. Tap to retry.</div>`;
        host.dataset.ready = "false";
      }
    };

    const loadChapters = async () => {
      try {
        const response = await fetch(`${API}/chapters?language=en`, { cache: "force-cache" });
        if (response.ok) {
          const data = await response.json() as { chapters?: Chapter[] };
          chapters = data.chapters || [];
        }
      } catch { /* page can still render without chapter metadata */ }
    };

    const syncToSourcePage = () => {
      const app = document.querySelector<HTMLElement>(".quran-app");
      if (!app?.classList.contains("wopt-layout-book")) return;
      const page = currentBookPage();
      if (page !== activePage || !container?.dataset.ready) void renderPage(page);
    };

    const onClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      const pageButton = target.closest<HTMLButtonElement>("[data-mushaf-page]");
      if (pageButton && !pageButton.disabled) {
        event.preventDefault();
        const page = Number(pageButton.dataset.mushafPage || 0);
        if (page >= 1 && page <= 604) {
          void renderPage(page, true).then(() => container?.scrollIntoView({ behavior: "smooth", block: "start" }));
        }
        return;
      }
      if (target.closest(".wopt-page-loading") && activePage) void renderPage(activePage, true);
    };

    void loadChapters().finally(() => void renderPage(currentBookPage(), true));
    const observer = new MutationObserver(syncToSourcePage);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["class"] });
    document.addEventListener("click", onClick, true);
    const timer = window.setInterval(syncToSourcePage, 1000);

    return () => {
      destroyed = true;
      window.clearInterval(timer);
      observer.disconnect();
      document.removeEventListener("click", onClick, true);
      container?.remove();
      style.remove();
    };
  }, [pathname]);

  return null;
}
