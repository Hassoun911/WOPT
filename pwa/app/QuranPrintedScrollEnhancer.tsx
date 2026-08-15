"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const API = "https://api.quran.com/api/v4";

type Chapter = { id: number; name_simple: string; name_arabic: string };
type Word = { position?: number; text_uthmani?: string; text?: string; char_type_name?: string };
type Verse = { verse_key?: string; verse_number?: number; page_number?: number; juz_number?: number; text_uthmani?: string; words?: Word[] };

function arabicNumber(value: number) {
  return String(value).replace(/\d/g, (digit) => "٠١٢٣٤٥٦٧٨٩"[Number(digit)]);
}

function escapeHtml(value = "") {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char] || char));
}

export default function QuranPrintedScrollEnhancer() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname.endsWith("/quran") && !pathname.endsWith("/quran/")) return;

    const style = document.createElement("style");
    style.dataset.woptPrintedScroll = "true";
    style.textContent = `
      .quran-app.wopt-printed-page-mode .wopt-printed-reader{overflow:visible!important}
      .wopt-scroll-page-wrap{margin-top:18px}
      .wopt-scroll-page-meta{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin:0 0 10px;font:700 11px/1.35 Arial,sans-serif;color:#5f6465}
      .wopt-scroll-page-surahs{display:flex;flex-wrap:wrap;gap:6px;min-width:0}
      .wopt-scroll-page-surahs span{padding:4px 8px;border-radius:999px;background:#f3f7f5;color:#31594f;white-space:nowrap}
      .wopt-scroll-page-location{margin-left:auto;white-space:nowrap;text-align:right}
      .wopt-scroll-page-wrap .wopt-printed-page{margin:0}
      .wopt-scroll-loading{padding:26px 10px;text-align:center;color:#78817e;font:12px/1.5 Arial,sans-serif}
      .wopt-scroll-end{padding:24px 10px;text-align:center;color:#82908c;font:11px/1.4 Arial,sans-serif}
      @media(max-width:700px){.wopt-scroll-page-wrap{margin-top:12px}.wopt-scroll-page-meta{font-size:10px;margin:0 3px 8px}}
    `;
    document.head.appendChild(style);

    let chapters = new Map<number, Chapter>();
    let reader: HTMLElement | null = null;
    let basePage = 0;
    let minPage = 0;
    let maxPage = 0;
    let loadingPrev = false;
    let loadingNext = false;
    const pageCache = new Map<number, Verse[]>();
    const mountedPages = new Set<number>();

    const loadChapters = async () => {
      if (chapters.size) return;
      try {
        const response = await fetch(`${API}/chapters?language=en`);
        if (!response.ok) return;
        const data = await response.json() as { chapters?: Chapter[] };
        chapters = new Map((data.chapters || []).map((chapter) => [chapter.id, chapter]));
      } catch { /* numeric labels remain usable */ }
    };

    const loadVerses = async (page: number) => {
      if (pageCache.has(page)) return pageCache.get(page)!;
      const response = await fetch(`${API}/verses/by_page/${page}?language=en&words=true&fields=text_uthmani,page_number,juz_number&word_fields=text_uthmani&per_page=50`);
      if (!response.ok) throw new Error("page");
      const data = await response.json() as { verses?: Verse[] };
      const verses = data.verses || [];
      pageCache.set(page, verses);
      return verses;
    };

    const wordHtml = (verse: Verse) => {
      const words = (verse.words || []).filter((word) => word.char_type_name !== "end" && !/^\d+$/.test((word.text_uthmani || word.text || "").trim()));
      if (!words.length) return escapeHtml(verse.text_uthmani || "");
      return words.map((word, index) => `<span class="quran-word" data-word-position="${Number(word.position || index + 1)}">${escapeHtml(word.text_uthmani || word.text || "")}</span>`).join(" ");
    };

    const buildPage = (page: number, verses: Verse[]) => {
      const wrap = document.createElement("section");
      wrap.className = "wopt-scroll-page-wrap";
      wrap.dataset.scrollPage = String(page);

      const juz = verses[0]?.juz_number || "—";
      const surahIds = Array.from(new Set(verses.map((verse) => Number((verse.verse_key || "1:1").split(":")[0]))));
      const tabs = surahIds.map((id) => `<span>${escapeHtml(chapters.get(id)?.name_simple || `Surah ${id}`)}</span>`).join("");

      let content = "";
      let lastSurah = 0;
      for (const verse of verses) {
        const key = verse.verse_key || "";
        const surahId = Number(key.split(":")[0]) || lastSurah || 1;
        const verseNo = Number(verse.verse_number || key.split(":")[1] || 0);
        if (surahId !== lastSurah && verseNo === 1) {
          const chapter = chapters.get(surahId);
          const arabicName = chapter?.name_arabic || `سورة ${surahId}`;
          content += `<div class="wopt-printed-surah-banner" data-surah-start="${surahId}"><strong>${escapeHtml(arabicName.startsWith("سورة") ? arabicName : `سورة ${arabicName}`)}</strong></div>`;
          if (surahId !== 9) content += `<div class="wopt-printed-bismillah">بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ</div>`;
        }
        lastSurah = surahId;
        content += `<span class="mushaf-ayah wopt-printed-ayah" id="printed-scroll-ayah-${key.replace(":", "-")}" data-verse-key="${escapeHtml(key)}" data-page="${page}" data-juz="${escapeHtml(String(verse.juz_number || juz))}">${wordHtml(verse)} <span class="ayah-marker wopt-printed-marker" aria-label="Ayah ${verseNo}">${arabicNumber(verseNo)}</span></span> `;
      }

      wrap.innerHTML = `
        <div class="wopt-scroll-page-meta">
          <div class="wopt-scroll-page-surahs">${tabs}</div>
          <div class="wopt-scroll-page-location">Juz ${escapeHtml(String(juz))} · Page ${page}</div>
        </div>
        <article class="wopt-printed-page" data-printed-page="${page}">
          <div class="wopt-printed-content">${content}</div>
          <footer class="wopt-printed-footer"><span>${page}</span></footer>
        </article>`;
      return wrap;
    };

    const appendPage = async (page: number) => {
      if (!reader || page < 1 || page > 604 || mountedPages.has(page)) return;
      const verses = await loadVerses(page);
      if (!reader || mountedPages.has(page)) return;
      reader.appendChild(buildPage(page, verses));
      mountedPages.add(page);
      maxPage = Math.max(maxPage, page);
    };

    const prependPage = async (page: number) => {
      if (!reader || page < 1 || page > 604 || mountedPages.has(page)) return;
      const oldHeight = document.documentElement.scrollHeight;
      const oldY = window.scrollY;
      const verses = await loadVerses(page);
      if (!reader || mountedPages.has(page)) return;
      const firstExtra = reader.querySelector<HTMLElement>(".wopt-scroll-page-wrap");
      const baseArticle = reader.querySelector<HTMLElement>(":scope > .wopt-printed-page");
      const node = buildPage(page, verses);
      if (firstExtra) reader.insertBefore(node, firstExtra);
      else if (baseArticle) reader.insertBefore(node, baseArticle);
      else reader.prepend(node);
      mountedPages.add(page);
      minPage = Math.min(minPage || page, page);
      requestAnimationFrame(() => {
        const delta = document.documentElement.scrollHeight - oldHeight;
        window.scrollTo({ top: oldY + delta, behavior: "auto" });
      });
    };

    const loadAround = async () => {
      await loadChapters();
      if (basePage > 1) await prependPage(basePage - 1).catch(() => undefined);
      if (basePage < 604) await appendPage(basePage + 1).catch(() => undefined);
    };

    const resetForCurrent = () => {
      const nextReader = document.querySelector<HTMLElement>(".wopt-printed-reader");
      const article = nextReader?.querySelector<HTMLElement>(":scope > .wopt-printed-page[data-printed-page]");
      const page = Number(article?.dataset.printedPage || 0);
      if (!nextReader || !page) return;
      if (nextReader === reader && page === basePage) return;
      reader = nextReader;
      reader.querySelectorAll(".wopt-scroll-page-wrap,.wopt-scroll-loading,.wopt-scroll-end").forEach((node) => node.remove());
      mountedPages.clear();
      basePage = page;
      minPage = page;
      maxPage = page;
      mountedPages.add(page);
      void loadAround();
    };

    const onScroll = () => {
      if (!reader || !document.querySelector(".quran-app.wopt-printed-page-mode")) return;
      const rect = reader.getBoundingClientRect();
      const nearBottom = rect.bottom - window.innerHeight < window.innerHeight * 1.4;
      const nearTop = rect.top > -window.innerHeight * 0.75;

      if (nearBottom && !loadingNext && maxPage < 604) {
        loadingNext = true;
        void appendPage(maxPage + 1).catch(() => undefined).finally(() => { loadingNext = false; });
      }
      if (nearTop && !loadingPrev && minPage > 1) {
        loadingPrev = true;
        void prependPage(minPage - 1).catch(() => undefined).finally(() => { loadingPrev = false; });
      }

      const pages = Array.from(reader.querySelectorAll<HTMLElement>("[data-printed-page]"));
      if (pages.length) {
        const mid = window.innerHeight * 0.45;
        const nearest = pages.map((node) => ({ node, d: Math.abs((node.getBoundingClientRect().top + node.getBoundingClientRect().bottom) / 2 - mid) })).sort((a, b) => a.d - b.d)[0]?.node;
        const visiblePage = Number(nearest?.dataset.printedPage || 0);
        if (visiblePage) {
          try {
            const previous = JSON.parse(window.localStorage.getItem("wopt-quran-last-read") || "{}") as Record<string, unknown>;
            window.localStorage.setItem("wopt-quran-last-read", JSON.stringify({ ...previous, page: visiblePage, savedAt: Date.now() }));
          } catch { /* ignore storage failure */ }
        }
      }
    };

    const observer = new MutationObserver(() => resetForCurrent());
    const app = document.querySelector<HTMLElement>(".quran-app");
    if (app) observer.observe(app, { subtree: true, childList: true });
    window.addEventListener("scroll", onScroll, { passive: true });
    const timer = window.setInterval(resetForCurrent, 500);
    resetForCurrent();

    return () => {
      window.clearInterval(timer);
      window.removeEventListener("scroll", onScroll);
      observer.disconnect();
      document.querySelectorAll(".wopt-scroll-page-wrap,.wopt-scroll-loading,.wopt-scroll-end").forEach((node) => node.remove());
      style.remove();
    };
  }, [pathname]);

  return null;
}
