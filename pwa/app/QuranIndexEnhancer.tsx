"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const API = "https://api.quran.com/api/v4";
const LAST_KEY = "wopt-quran-last-read";
const BOOKMARKS_KEY = "wopt-quran-bookmarks";
const SEARCH_HISTORY_KEY = "wopt-quran-search-history";
const MEMORIZE_KEY = "wopt-quran-memorize-selection";

type Chapter = {
  id: number;
  name_simple: string;
  name_arabic: string;
  translated_name?: { name?: string };
  verses_count: number;
  pages?: number[];
  revelation_place?: string;
};

type LastRead = { chapterId?: number; verseKey?: string; page?: number; savedAt?: number };
type Bookmark = { chapterId?: number; verseKey?: string; page?: number; label?: string };

function escapeHtml(value = "") {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char] || char));
}

function safeJson<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) as T : fallback;
  } catch { return fallback; }
}

export default function QuranIndexEnhancer() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname.endsWith("/quran") && !pathname.endsWith("/quran/")) return;

    const style = document.createElement("style");
    style.dataset.woptQuranIndex = "true";
    style.textContent = `
      .wopt-qindex{position:fixed;z-index:5200;inset:0;background:#f7f7f2;color:#163f35;display:none;overflow:auto;font-family:Arial,sans-serif}.wopt-qindex.open{display:block}
      .wopt-qindex-shell{width:min(900px,100%);margin:0 auto;padding:calc(env(safe-area-inset-top) + 18px) 18px 46px}
      .wopt-qindex-head{display:flex;align-items:center;justify-content:space-between;gap:14px;margin-bottom:18px}.wopt-qindex-brand{display:flex;align-items:center;gap:12px}.wopt-qindex-mark{width:48px;height:48px;border-radius:16px;background:#0d6b57;color:#fff;display:grid;place-items:center;font:700 27px/1 serif}.wopt-qindex-title strong{display:block;font-size:24px;letter-spacing:-.03em}.wopt-qindex-title span{font-size:12px;color:#71807b}.wopt-qindex-close{width:44px;height:44px;border:1px solid #dce4e1;background:#fff;border-radius:50%;font-size:22px;color:#234d42}
      .wopt-qindex-search{display:flex;gap:9px;margin-bottom:16px}.wopt-qindex-search input{flex:1;min-width:0;height:50px;border:1px solid #d7e1dd;border-radius:16px;background:#fff;padding:0 16px;font-size:15px;outline:none}.wopt-qindex-search input:focus{border-color:#249780;box-shadow:0 0 0 3px rgba(36,151,128,.11)}.wopt-qindex-search button{height:50px;border:0;border-radius:16px;background:#0d6b57;color:#fff;padding:0 18px;font-weight:800}
      .wopt-qindex-continue{width:100%;border:1px solid #bedbd2;background:linear-gradient(135deg,#e7f5f0,#f6faf8);border-radius:20px;padding:17px;display:flex;align-items:center;justify-content:space-between;gap:12px;text-align:left;color:#17483d;margin-bottom:14px}.wopt-qindex-continue small{display:block;color:#5f7870;font-size:11px;text-transform:uppercase;font-weight:900;letter-spacing:.11em;margin-bottom:5px}.wopt-qindex-continue strong{font-size:18px}.wopt-qindex-arrow{font-size:26px;color:#0d6b57}
      .wopt-qindex-actions{display:grid;grid-template-columns:repeat(4,1fr);gap:9px;margin-bottom:17px}.wopt-qindex-action{min-height:76px;border:1px solid #dde5e2;border-radius:17px;background:#fff;color:#1d5044;font-weight:800;font-size:12px;padding:10px}.wopt-qindex-action span{display:block;font-size:21px;margin-bottom:6px}
      .wopt-qindex-recent{display:none;margin-bottom:16px}.wopt-qindex-recent.show{display:block}.wopt-qindex-recent-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px}.wopt-qindex-recent-head strong{font-size:12px}.wopt-qindex-recent-head button{border:0;background:transparent;color:#0d6b57;font-size:11px;font-weight:800}.wopt-qindex-chips{display:flex;gap:7px;overflow:auto;padding-bottom:2px}.wopt-qindex-chip{white-space:nowrap;border:1px solid #d6e4df;background:#fff;border-radius:999px;padding:8px 12px;color:#255b4d;font-size:12px}
      .wopt-qindex-tabs{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;background:#e9eeec;border-radius:15px;padding:5px;margin-bottom:13px}.wopt-qindex-tab{border:0;border-radius:11px;background:transparent;color:#687570;font-weight:800;padding:11px 5px}.wopt-qindex-tab.active{background:#fff;color:#0d6b57;box-shadow:0 2px 8px rgba(0,0,0,.05)}
      .wopt-qindex-panel{display:none}.wopt-qindex-panel.active{display:block}.wopt-qindex-filter{width:100%;height:44px;border:1px solid #dde4e2;border-radius:13px;background:#fff;padding:0 13px;margin-bottom:8px;font-size:14px;outline:none}
      .wopt-qindex-surahs{background:#fff;border:1px solid #e0e6e4;border-radius:19px;overflow:hidden}.wopt-qindex-surah{width:100%;border:0;border-bottom:1px solid #edf0ef;background:#fff;display:grid;grid-template-columns:40px 1fr auto;align-items:center;gap:12px;padding:13px 14px;text-align:left;color:#163f35}.wopt-qindex-surah:last-child{border-bottom:0}.wopt-qindex-num{color:#87928e;font-size:11px}.wopt-qindex-surah strong{display:block;font-size:15px}.wopt-qindex-meta{font-size:11px;color:#7b8783;margin-top:3px}.wopt-qindex-ar{font:500 22px/1.4 "Noto Naskh Arabic","Amiri",serif;direction:rtl;white-space:nowrap}
      .wopt-qindex-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:8px}.wopt-qindex-grid button{border:1px solid #dce5e2;background:#fff;border-radius:15px;min-height:60px;color:#194c3f;font-weight:800}.wopt-qindex-grid button small{display:block;margin-top:4px;color:#87928e;font-weight:600;font-size:10px}
      .wopt-qindex-pages{grid-template-columns:repeat(6,1fr)}
      .wopt-qindex-saved{display:grid;gap:9px}.wopt-qindex-empty{padding:28px 16px;text-align:center;border:1px dashed #cad7d2;border-radius:17px;color:#72807b;background:#fff}.wopt-qindex-saved button{border:1px solid #dce5e2;background:#fff;border-radius:15px;padding:14px;text-align:left;color:#194c3f}.wopt-qindex-saved strong{display:block}.wopt-qindex-saved span{display:block;color:#7a8682;font-size:11px;margin-top:4px}
      @media(max-width:650px){.wopt-qindex-shell{padding-left:12px;padding-right:12px}.wopt-qindex-title strong{font-size:22px}.wopt-qindex-actions{grid-template-columns:repeat(4,1fr)}.wopt-qindex-action{min-height:70px;font-size:10px;padding:8px 4px}.wopt-qindex-action span{font-size:19px}.wopt-qindex-grid{grid-template-columns:repeat(4,1fr)}.wopt-qindex-pages{grid-template-columns:repeat(5,1fr)}.wopt-qindex-surah{padding:12px 10px;grid-template-columns:30px 1fr auto}.wopt-qindex-ar{font-size:20px}}
    `;
    document.head.appendChild(style);

    const overlay = document.createElement("div");
    overlay.className = "wopt-qindex";
    overlay.innerHTML = `
      <main class="wopt-qindex-shell">
        <header class="wopt-qindex-head"><div class="wopt-qindex-brand"><div class="wopt-qindex-mark">ق</div><div class="wopt-qindex-title"><strong>Qur’an</strong><span>Read · Listen · Search · Memorize</span></div></div><button class="wopt-qindex-close" type="button" aria-label="Close index">×</button></header>
        <div class="wopt-qindex-search"><input type="search" placeholder="Search Arabic, English, or 2:255" aria-label="Search Qur’an"><button type="button">Search</button></div>
        <button class="wopt-qindex-continue" type="button"><span><small>Continue reading</small><strong>Loading your place…</strong></span><span class="wopt-qindex-arrow">→</span></button>
        <div class="wopt-qindex-actions">
          <button class="wopt-qindex-action" data-quick="bookmarks"><span>☆</span>Bookmarks</button>
          <button class="wopt-qindex-action" data-quick="memorize"><span>✦</span>Memorize</button>
          <button class="wopt-qindex-action" data-quick="audio"><span>▶</span>Listen</button>
          <button class="wopt-qindex-action" data-quick="settings"><span>Aa</span>Reader</button>
        </div>
        <section class="wopt-qindex-recent"><div class="wopt-qindex-recent-head"><strong>Recent searches</strong><button type="button">Clear</button></div><div class="wopt-qindex-chips"></div></section>
        <nav class="wopt-qindex-tabs"><button class="wopt-qindex-tab active" data-tab="surahs">Surahs</button><button class="wopt-qindex-tab" data-tab="juz">Juz</button><button class="wopt-qindex-tab" data-tab="pages">Pages</button><button class="wopt-qindex-tab" data-tab="saved">Saved</button></nav>
        <section class="wopt-qindex-panel active" data-panel="surahs"><input class="wopt-qindex-filter" type="search" placeholder="Filter Surahs by English or Arabic name"><div class="wopt-qindex-surahs"><div class="wopt-qindex-empty">Loading Surahs…</div></div></section>
        <section class="wopt-qindex-panel" data-panel="juz"><div class="wopt-qindex-grid wopt-qindex-juz"></div></section>
        <section class="wopt-qindex-panel" data-panel="pages"><div class="wopt-qindex-grid wopt-qindex-pages"></div></section>
        <section class="wopt-qindex-panel" data-panel="saved"><div class="wopt-qindex-saved"></div></section>
      </main>`;
    document.body.appendChild(overlay);

    let chapters: Chapter[] = [];
    const historyState = () => (window.history.state || {}) as Record<string, unknown>;
    const ensureIndexHistory = () => {
      const current = historyState();
      if (current.woptQuranIndex || current.woptQuranReader || current.woptQuranSearchResult) return;
      window.history.replaceState({ ...current, woptQuranIndex: true }, "", window.location.href);
    };
    const enterReaderHistory = () => {
      const current = historyState();
      if (current.woptQuranReader) return;
      window.history.pushState({ ...current, woptQuranIndex: false, woptQuranReader: true }, "", window.location.href);
    };
    const open = () => { overlay.classList.add("open"); renderLocal(); void loadChapters(); };
    const close = () => overlay.classList.remove("open");
    const setBookPage = (page: number) => {
      enterReaderHistory();
      close();
      window.localStorage.setItem("wopt-quran-book-page-mode", "true");
      window.localStorage.setItem("wopt-quran-text-mode", "arabic");
      window.dispatchEvent(new CustomEvent("wopt-quran-book-mode", { detail: { enabled: true, page } }));
      window.scrollTo({ top: 0, behavior: "auto" });
    };
    const openExisting = (selectors: string[]) => {
      close();
      for (const selector of selectors) {
        const target = document.querySelector<HTMLElement>(selector);
        if (target) { target.click(); return true; }
      }
      return false;
    };

    const renderChapters = (filter = "") => {
      const box = overlay.querySelector<HTMLElement>(".wopt-qindex-surahs")!;
      const q = filter.trim().toLowerCase();
      const list = chapters.filter((chapter) => !q || chapter.name_simple.toLowerCase().includes(q) || chapter.name_arabic.includes(filter) || (chapter.translated_name?.name || "").toLowerCase().includes(q));
      box.innerHTML = list.map((chapter) => `<button class="wopt-qindex-surah" type="button" data-surah="${chapter.id}" data-page="${chapter.pages?.[0] || 1}"><span class="wopt-qindex-num">${chapter.id}</span><span><strong>${escapeHtml(chapter.name_simple)}</strong><span class="wopt-qindex-meta">${escapeHtml(chapter.translated_name?.name || "")} · ${chapter.verses_count} ayat${chapter.revelation_place ? ` · ${escapeHtml(chapter.revelation_place)}` : ""}</span></span><span class="wopt-qindex-ar">${escapeHtml(chapter.name_arabic)}</span></button>`).join("") || `<div class="wopt-qindex-empty">No Surah matches that search.</div>`;
    };

    const loadChapters = async () => {
      if (chapters.length) return;
      try {
        const response = await fetch(`${API}/chapters?language=en`);
        if (!response.ok) throw new Error("chapters");
        const data = await response.json() as { chapters?: Chapter[] };
        chapters = data.chapters || [];
        renderChapters();
        renderLocal();
      } catch {
        overlay.querySelector<HTMLElement>(".wopt-qindex-surahs")!.innerHTML = `<div class="wopt-qindex-empty">Could not load the Surah index. Check your connection and retry.</div>`;
      }
    };

    const renderLocal = () => {
      const last = safeJson<LastRead | null>(LAST_KEY, null);
      const chapter = chapters.find((item) => item.id === last?.chapterId);
      const continueStrong = overlay.querySelector<HTMLElement>(".wopt-qindex-continue strong")!;
      continueStrong.textContent = last ? `${chapter?.name_simple || `Surah ${last.chapterId || ""}`} · ${last.verseKey || ""}${last.page ? ` · Page ${last.page}` : ""}` : "Start from Al-Fatihah";

      const history = safeJson<string[]>(SEARCH_HISTORY_KEY, []);
      const recent = overlay.querySelector<HTMLElement>(".wopt-qindex-recent")!;
      recent.classList.toggle("show", history.length > 0);
      overlay.querySelector<HTMLElement>(".wopt-qindex-chips")!.innerHTML = history.slice(0, 8).map((item) => `<button class="wopt-qindex-chip" type="button" data-recent="${encodeURIComponent(item)}">${escapeHtml(item)}</button>`).join("");

      const bookmarks = safeJson<Bookmark[]>(BOOKMARKS_KEY, []);
      const memorized = safeJson<string[]>(MEMORIZE_KEY, []);
      const saved = overlay.querySelector<HTMLElement>(".wopt-qindex-saved")!;
      const rows = bookmarks.map((bookmark) => `<button type="button" data-saved-page="${bookmark.page || 1}"><strong>${escapeHtml(bookmark.label || bookmark.verseKey || "Saved ayah")}</strong><span>${escapeHtml(bookmark.verseKey || "")}${bookmark.page ? ` · Page ${bookmark.page}` : ""}</span></button>`);
      if (memorized.length) rows.unshift(`<button type="button" data-open-memorize><strong>Memorization selection</strong><span>${memorized.length} selected ayah${memorized.length === 1 ? "" : "s"}</span></button>`);
      saved.innerHTML = rows.join("") || `<div class="wopt-qindex-empty">Your bookmarks and memorization selections will appear here.</div>`;
    };

    overlay.querySelector<HTMLElement>(".wopt-qindex-juz")!.innerHTML = Array.from({ length: 30 }, (_, i) => `<button type="button" data-juz="${i + 1}">Juz ${i + 1}<small>Open</small></button>`).join("");
    overlay.querySelector<HTMLElement>(".wopt-qindex-pages")!.innerHTML = Array.from({ length: 604 }, (_, i) => `<button type="button" data-page="${i + 1}">${i + 1}</button>`).join("");

    const doSearch = (value?: string) => {
      const input = overlay.querySelector<HTMLInputElement>(".wopt-qindex-search input")!;
      const query = (value ?? input.value).trim();
      if (!query) return;
      close();
      const existing = document.querySelector<HTMLInputElement>(".wopt-search-head input");
      const button = document.querySelector<HTMLElement>(".wopt-search-go");
      const trigger = document.querySelector<HTMLElement>("[data-ref='search'],[data-clean='search']");
      trigger?.click();
      window.setTimeout(() => { if (existing && button) { existing.value = query; button.click(); } }, 80);
    };

    const onClick = async (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (target.closest(".wopt-qindex-close")) { enterReaderHistory(); close(); return; }
      const tab = target.closest<HTMLButtonElement>("[data-tab]");
      if (tab) {
        overlay.querySelectorAll(".wopt-qindex-tab").forEach((node) => node.classList.toggle("active", node === tab));
        overlay.querySelectorAll<HTMLElement>(".wopt-qindex-panel").forEach((node) => node.classList.toggle("active", node.dataset.panel === tab.dataset.tab));
        return;
      }
      if (target.closest(".wopt-qindex-search button")) { doSearch(); return; }
      const recent = target.closest<HTMLButtonElement>("[data-recent]");
      if (recent) { doSearch(decodeURIComponent(recent.dataset.recent || "")); return; }
      if (target.closest(".wopt-qindex-recent-head button")) { window.localStorage.removeItem(SEARCH_HISTORY_KEY); renderLocal(); return; }
      const surah = target.closest<HTMLButtonElement>("[data-surah]");
      if (surah) { setBookPage(Number(surah.dataset.page || 1)); return; }
      const page = target.closest<HTMLButtonElement>("[data-page]");
      if (page) { setBookPage(Number(page.dataset.page || 1)); return; }
      const juz = target.closest<HTMLButtonElement>("[data-juz]");
      if (juz) {
        juz.disabled = true;
        const no = Number(juz.dataset.juz || 1);
        try {
          const response = await fetch(`${API}/verses/by_juz/${no}?language=en&words=false&fields=page_number&per_page=1`);
          const data = await response.json();
          setBookPage(Number(data.verses?.[0]?.page_number || 1));
        } catch { juz.disabled = false; }
        return;
      }
      if (target.closest(".wopt-qindex-continue")) {
        const last = safeJson<LastRead | null>(LAST_KEY, null);
        setBookPage(Number(last?.page || chapters.find((item) => item.id === last?.chapterId)?.pages?.[0] || 1));
        return;
      }
      const savedPage = target.closest<HTMLButtonElement>("[data-saved-page]");
      if (savedPage) { setBookPage(Number(savedPage.dataset.savedPage || 1)); return; }
      if (target.closest("[data-open-memorize]")) { close(); document.querySelector<HTMLButtonElement>(".memorize-launch")?.click(); return; }
      const quick = target.closest<HTMLButtonElement>("[data-quick]")?.dataset.quick;
      if (quick === "bookmarks") { close(); const button = Array.from(document.querySelectorAll<HTMLButtonElement>(".quran-top-actions button")).find((node) => /^Bookmarks$/i.test((node.textContent || "").trim())); button?.click(); return; }
      if (quick === "memorize") { close(); document.querySelector<HTMLButtonElement>(".memorize-launch")?.click(); return; }
      if (quick === "audio") { close(); openExisting(["[data-clean='audio']", ".wopt-ref-safe [data-ref='play']"]); return; }
      if (quick === "settings") { close(); openExisting(["[data-clean='reader']", ".wopt-ref-safe [data-ref='settings']"]); return; }
    };

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Enter" && event.target === overlay.querySelector(".wopt-qindex-search input")) doSearch();
    };
    const onFilter = (event: Event) => {
      const input = event.target as HTMLInputElement;
      if (input.matches(".wopt-qindex-filter")) renderChapters(input.value);
    };
    const onOpenEvent = () => {
      const current = historyState();
      if (current.woptQuranReader && !overlay.classList.contains("open")) {
        window.history.back();
        return;
      }
      open();
    };
    const onPopState = (event: PopStateEvent) => {
      const next = (event.state || {}) as Record<string, unknown>;
      if (next.woptQuranIndex) {
        open();
        return;
      }
      if (next.woptQuranReader || next.woptQuranSearchResult) close();
    };

    overlay.addEventListener("click", onClick);
    overlay.addEventListener("keydown", onKey);
    overlay.addEventListener("input", onFilter);
    window.addEventListener("wopt-quran-open-index", onOpenEvent);
    window.addEventListener("popstate", onPopState);

    // Qur’an index is the first in-section history level; reader pages sit one level above it.
    ensureIndexHistory();
    window.setTimeout(open, 80);

    return () => {
      overlay.removeEventListener("click", onClick);
      overlay.removeEventListener("keydown", onKey);
      overlay.removeEventListener("input", onFilter);
      window.removeEventListener("wopt-quran-open-index", onOpenEvent);
      window.removeEventListener("popstate", onPopState);
      overlay.remove();
      style.remove();
    };
  }, [pathname]);

  return null;
}
