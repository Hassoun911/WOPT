"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const API = "https://api.quran.com/api/v4";
const BOOK_KEY = "wopt-quran-book-page-mode";
const LAST_KEY = "wopt-quran-last-read";

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
  char_type_name?: string;
};

type Verse = {
  verse_key?: string;
  verse_number?: number;
  page_number?: number;
  juz_number?: number;
  text_uthmani?: string;
  words?: Word[];
};

function arabicNumber(value: number) {
  return String(value).replace(/\d/g, (digit) => "٠١٢٣٤٥٦٧٨٩"[Number(digit)]);
}

function escapeHtml(value = "") {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char] || char));
}

function savedPage() {
  try {
    const saved = JSON.parse(window.localStorage.getItem(LAST_KEY) || "null") as { page?: number } | null;
    return Number(saved?.page || 0) || 0;
  } catch {
    return 0;
  }
}

function visibleUnderlyingPage() {
  const verses = Array.from(document.querySelectorAll<HTMLElement>(".mushaf-shell .mushaf-ayah[data-page]"));
  if (!verses.length) return 0;
  const viewportMid = window.innerHeight * 0.5;
  const best = verses
    .map((node) => ({ node, distance: Math.abs((node.getBoundingClientRect().top + node.getBoundingClientRect().bottom) / 2 - viewportMid) }))
    .sort((a, b) => a.distance - b.distance)[0]?.node;
  return Number(best?.dataset.page || 0) || 0;
}

export default function QuranPrintedPageEnhancer() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname.endsWith("/quran") && !pathname.endsWith("/quran/")) return;

    const app = document.querySelector<HTMLElement>(".quran-app");
    if (!app) return;

    const style = document.createElement("style");
    style.dataset.woptPrintedPages = "true";
    style.textContent = `
      .wopt-printed-reader{display:none;max-width:760px;margin:0 auto;padding:22px 18px 52px;color:var(--wopt-reader-color,#111);background:var(--wopt-reader-bg,#fff)}
      .quran-app.wopt-printed-page-mode .wopt-clean-reader-head,.quran-app.wopt-printed-page-mode .mushaf-shell{display:none!important}
      .quran-app.wopt-printed-page-mode .wopt-printed-reader{display:block}
      .wopt-printed-top{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin:0 0 14px;font:700 12px/1.35 Arial,sans-serif;color:#5f6465}
      .wopt-printed-surah-tabs{display:flex;flex-wrap:wrap;gap:6px;min-width:0}
      .wopt-printed-surah-tabs span{padding:4px 8px;border-radius:999px;background:#f3f7f5;color:#31594f;white-space:nowrap}
      .wopt-printed-location{margin-left:auto;white-space:nowrap;text-align:right}
      .wopt-printed-page{border:1px solid rgba(20,113,92,.22);background:var(--wopt-reader-bg,#fff);box-shadow:0 12px 34px rgba(27,69,58,.07);padding:16px 18px 14px;min-height:calc(100dvh - 150px);display:flex;flex-direction:column}
      .wopt-printed-content{direction:rtl;text-align:var(--wopt-reader-align,justify);font-family:var(--wopt-reader-font,"Noto Naskh Arabic","Amiri",serif);font-size:var(--wopt-reader-size,30px);line-height:var(--wopt-reader-line,1.9);color:var(--wopt-reader-color,#111);flex:1}
      .wopt-printed-surah-banner{position:relative;display:flex;align-items:center;justify-content:center;min-height:50px;margin:4px 0 10px;border:1.5px solid #16816c;background:rgba(250,248,240,.8);overflow:hidden}
      .wopt-printed-surah-banner:before,.wopt-printed-surah-banner:after{content:"✦  ❈  ✦";position:absolute;top:50%;transform:translateY(-50%);color:#16816c;font-size:12px;letter-spacing:3px;opacity:.9}.wopt-printed-surah-banner:before{left:12px}.wopt-printed-surah-banner:after{right:12px}
      .wopt-printed-surah-banner strong{position:relative;z-index:1;padding:0 74px;background:rgba(250,248,240,.94);font:600 23px/1.4 var(--wopt-reader-font,"Noto Naskh Arabic","Amiri",serif);color:#111;white-space:nowrap}
      .wopt-printed-bismillah{margin:2px 0 10px;text-align:center;font:500 25px/1.55 var(--wopt-reader-font,"Noto Naskh Arabic","Amiri",serif);color:var(--wopt-reader-color,#111)}
      .wopt-printed-ayah{display:inline;box-decoration-break:clone;-webkit-box-decoration-break:clone}
      .wopt-printed-ayah.wopt-menu-selected{background:rgba(59,170,168,.12)!important;box-shadow:0 0 0 3px rgba(59,170,168,.08)!important;border-radius:5px!important}
      .wopt-printed-ayah .quran-word{display:inline;cursor:pointer;border-radius:4px;transition:background .12s ease}.wopt-printed-ayah .quran-word:active{background:rgba(37,158,131,.12)}
      .wopt-printed-marker{display:inline-grid;place-items:center;min-width:1.55em;height:1.55em;margin:0 .16em;border:1.5px solid #16816c;border-radius:50%;color:#16816c;font:700 .5em/1 Arial,sans-serif;vertical-align:.12em}
      .wopt-printed-footer{display:flex;align-items:center;justify-content:center;gap:18px;margin-top:12px;padding-top:10px;border-top:1px solid rgba(0,0,0,.07);font:700 12px/1 Arial,sans-serif;color:#69716f}
      .wopt-printed-footer button{width:34px;height:34px;border:1px solid #d8e1de;border-radius:50%;background:#fff;color:#176d5b;font-size:18px}.wopt-printed-footer button:disabled{opacity:.3}
      .wopt-printed-loading{display:grid;place-items:center;min-height:55dvh;color:#78817e;font:13px/1.5 Arial,sans-serif;text-align:center}
      .wopt-printed-error{padding:28px;text-align:center;color:#8a4f45;font:13px/1.6 Arial,sans-serif}
      @media(max-width:700px){
        .wopt-printed-reader{padding:14px 10px 44px}.wopt-printed-top{font-size:11px;margin-bottom:10px}.wopt-printed-page{padding:12px 12px 10px;min-height:calc(100dvh - 125px);box-shadow:none}
        .wopt-printed-surah-banner{min-height:46px;margin:2px 0 8px}.wopt-printed-surah-banner strong{font-size:21px;padding:0 62px}.wopt-printed-bismillah{font-size:23px;margin-bottom:8px}.wopt-printed-content{font-size:var(--wopt-reader-size,29px)}
      }
    `;
    document.head.appendChild(style);

    const reader = document.createElement("section");
    reader.className = "wopt-printed-reader";
    reader.setAttribute("aria-label", "Printed Qur’an page");
    reader.innerHTML = `<div class="wopt-printed-loading">Preparing mushaf page…</div>`;
    app.appendChild(reader);

    let chapters = new Map<number, Chapter>();
    let currentPage = savedPage() || visibleUnderlyingPage() || 1;
    let lastUnderlyingChapter = "";
    let loadingToken = 0;
    let startX = 0;
    let startY = 0;
    let enabled = window.localStorage.getItem(BOOK_KEY) !== "false";

    const setEnabled = (value: boolean) => {
      enabled = value;
      window.localStorage.setItem(BOOK_KEY, value ? "true" : "false");
      const textMode = window.localStorage.getItem("wopt-quran-text-mode") || "arabic";
      app.classList.toggle("wopt-printed-page-mode", value && textMode === "arabic");
      if (value && textMode === "arabic") void loadPage(currentPage);
    };

    const loadChapters = async () => {
      if (chapters.size) return;
      try {
        const response = await fetch(`${API}/chapters?language=en`);
        if (!response.ok) return;
        const data = await response.json() as { chapters?: Chapter[] };
        chapters = new Map((data.chapters || []).map((chapter) => [chapter.id, chapter]));
      } catch { /* page still renders numeric Surah labels */ }
    };

    const chapterFor = (id: number) => chapters.get(id);

    const wordHtml = (verse: Verse) => {
      const words = (verse.words || []).filter((word) => word.char_type_name !== "end" && !/^\d+$/.test((word.text_uthmani || word.text || "").trim()));
      if (!words.length) return escapeHtml(verse.text_uthmani || "");
      return words.map((word, index) => `<span class="quran-word" data-word-position="${Number(word.position || index + 1)}">${escapeHtml(word.text_uthmani || word.text || "")}</span>`).join(" ");
    };

    const renderPage = (page: number, verses: Verse[]) => {
      if (!verses.length) {
        reader.innerHTML = `<div class="wopt-printed-error">This Qur’an page could not be loaded.</div>`;
        return;
      }
      const surahIds = Array.from(new Set(verses.map((verse) => Number((verse.verse_key || "1:1").split(":")[0]))));
      const juz = verses[0]?.juz_number || "—";
      const tabs = surahIds.map((id) => {
        const chapter = chapterFor(id);
        return `<span>${escapeHtml(chapter?.name_simple || `Surah ${id}`)}</span>`;
      }).join("");

      let content = "";
      let lastSurah = 0;
      verses.forEach((verse) => {
        const key = verse.verse_key || "";
        const surahId = Number(key.split(":")[0]) || lastSurah || 1;
        const verseNo = Number(verse.verse_number || key.split(":")[1] || 0);
        if (surahId !== lastSurah && verseNo === 1) {
          const chapter = chapterFor(surahId);
          const arabicName = chapter?.name_arabic || `سورة ${surahId}`;
          content += `<div class="wopt-printed-surah-banner" data-surah-start="${surahId}"><strong>${escapeHtml(arabicName.startsWith("سورة") ? arabicName : `سورة ${arabicName}`)}</strong></div>`;
          if (surahId !== 9) content += `<div class="wopt-printed-bismillah">بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ</div>`;
        }
        lastSurah = surahId;
        content += `<span class="mushaf-ayah wopt-printed-ayah" id="printed-ayah-${key.replace(":", "-")}" data-verse-key="${escapeHtml(key)}" data-page="${page}" data-juz="${escapeHtml(String(verse.juz_number || juz))}">${wordHtml(verse)} <span class="ayah-marker wopt-printed-marker" aria-label="Ayah ${verseNo}">${arabicNumber(verseNo)}</span></span> `;
      });

      reader.innerHTML = `
        <div class="wopt-printed-top">
          <div class="wopt-printed-surah-tabs">${tabs}</div>
          <div class="wopt-printed-location">Juz ${escapeHtml(String(juz))} · Page ${page}</div>
        </div>
        <article class="wopt-printed-page" data-printed-page="${page}">
          <div class="wopt-printed-content">${content}</div>
          <footer class="wopt-printed-footer"><button type="button" data-page-prev aria-label="Previous page" ${page <= 1 ? "disabled" : ""}>‹</button><span>${page}</span><button type="button" data-page-next aria-label="Next page" ${page >= 604 ? "disabled" : ""}>›</button></footer>
        </article>`;
    };

    const loadPage = async (page: number) => {
      if (!enabled) return;
      const token = ++loadingToken;
      currentPage = Math.max(1, Math.min(604, page));
      reader.innerHTML = `<div class="wopt-printed-loading">Loading page ${currentPage}…</div>`;
      await loadChapters();
      try {
        const response = await fetch(`${API}/verses/by_page/${currentPage}?language=en&words=true&fields=text_uthmani,page_number,juz_number&word_fields=text_uthmani&per_page=50`);
        if (!response.ok) throw new Error("page");
        const data = await response.json() as { verses?: Verse[] };
        if (token !== loadingToken) return;
        renderPage(currentPage, data.verses || []);
      } catch {
        if (token !== loadingToken) return;
        reader.innerHTML = `<div class="wopt-printed-error">Unable to load Qur’an page ${currentPage}. Please try again.</div>`;
      }
    };

    const goPage = (page: number) => {
      if (page < 1 || page > 604) return;
      currentPage = page;
      window.scrollTo({ top: 0, behavior: "auto" });
      void loadPage(page);
    };

    const onReaderClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (target.closest("[data-page-prev]")) { goPage(currentPage - 1); return; }
      if (target.closest("[data-page-next]")) { goPage(currentPage + 1); return; }
    };

    const onPointerDown = (event: PointerEvent) => { startX = event.clientX; startY = event.clientY; };
    const onPointerUp = (event: PointerEvent) => {
      const dx = event.clientX - startX;
      const dy = event.clientY - startY;
      if (Math.abs(dx) < 70 || Math.abs(dx) < Math.abs(dy) * 1.35) return;
      if (dx < 0) goPage(currentPage + 1); else goPage(currentPage - 1);
    };

    const onBookMode = (event: Event) => {
      const detail = (event as CustomEvent<{ enabled?: boolean; page?: number }>).detail || {};
      if (detail.page) currentPage = detail.page;
      setEnabled(detail.enabled !== false);
    };

    const sync = () => {
      const mode = window.localStorage.getItem("wopt-quran-text-mode") || "arabic";
      app.classList.toggle("wopt-printed-page-mode", enabled && mode === "arabic");
      if (!enabled || mode !== "arabic") return;
      const underlyingChapter = document.querySelector<HTMLElement>(".mushaf-shell .mushaf-ayah[data-verse-key]")?.dataset.verseKey?.split(":")[0] || "";
      if (underlyingChapter && underlyingChapter !== lastUnderlyingChapter) {
        lastUnderlyingChapter = underlyingChapter;
        const page = Number(document.querySelector<HTMLElement>(".mushaf-shell .mushaf-ayah[data-page]")?.dataset.page || 0);
        if (page && page !== currentPage) void loadPage(page);
      }
    };

    reader.addEventListener("click", onReaderClick);
    reader.addEventListener("pointerdown", onPointerDown, { passive: true });
    reader.addEventListener("pointerup", onPointerUp, { passive: true });
    window.addEventListener("wopt-quran-book-mode", onBookMode as EventListener);
    const timer = window.setInterval(sync, 450);

    setEnabled(enabled);
    sync();

    return () => {
      window.clearInterval(timer);
      reader.removeEventListener("click", onReaderClick);
      reader.removeEventListener("pointerdown", onPointerDown);
      reader.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("wopt-quran-book-mode", onBookMode as EventListener);
      app.classList.remove("wopt-printed-page-mode");
      reader.remove();
      style.remove();
    };
  }, [pathname]);

  return null;
}
