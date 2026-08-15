"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const API = "https://api.quran.com/api/v4";
const LAST_READ_KEY = "wopt-quran-last-read";
const SEARCH_HISTORY_KEY = "wopt-quran-search-history";
const SEARCH_TARGET_KEY = "wopt-quran-search-target";

type SearchResult = {
  verse_key?: string;
  text?: string;
  highlighted?: string;
  translations?: Array<{ text?: string }>;
};

type SearchTarget = { verseKey: string; query: string; savedAt: number };

function stripHtml(value = "") {
  const div = document.createElement("div");
  div.innerHTML = value;
  return (div.textContent || div.innerText || "").replace(/\s+/g, " ").trim();
}

function normalize(value: string) {
  return value
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, "")
    .replace(/[إأآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/[^\u0621-\u063A\u0641-\u064A\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function homePath(pathname: string) {
  if (pathname === "/WOPT/quran" || pathname === "/WOPT/quran/") return "/WOPT/";
  return pathname.replace(/\/quran\/?$/, "/");
}

function readHistory() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(SEARCH_HISTORY_KEY) || "[]") as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string").slice(0, 8) : [];
  } catch {
    return [] as string[];
  }
}

function saveHistory(query: string) {
  const next = [query, ...readHistory().filter((item) => item.toLowerCase() !== query.toLowerCase())].slice(0, 8);
  window.localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(next));
  return next;
}

export default function QuranHeaderSearchEnhancer() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname.endsWith("/quran") && !pathname.endsWith("/quran/")) return;

    const style = document.createElement("style");
    style.dataset.woptQuranHeaderSearch = "true";
    style.textContent = `
      .wopt-ref-safe-brand{font-family:Arial,sans-serif!important;font-weight:900!important;font-size:24px!important;letter-spacing:-.02em!important;cursor:pointer!important}
      .wopt-search-backdrop{position:fixed;z-index:3600;inset:0;display:none;background:rgba(0,0,0,.38);align-items:flex-start;justify-content:center;padding:calc(env(safe-area-inset-top) + 74px) 12px 18px}.wopt-search-backdrop.open{display:flex}
      .wopt-search-sheet{width:min(720px,100%);max-height:82dvh;overflow:hidden;border-radius:22px;background:#fff;box-shadow:0 26px 80px rgba(0,0,0,.28);display:flex;flex-direction:column}
      .wopt-search-head{display:flex;align-items:center;gap:9px;padding:14px;border-bottom:1px solid #ececec}.wopt-search-head input{flex:1;min-width:0;height:46px;border:1px solid #d8dcda;border-radius:14px;padding:0 14px;font-size:16px;outline:none}.wopt-search-head input:focus{border-color:#35aaa8;box-shadow:0 0 0 3px rgba(53,170,168,.12)}.wopt-search-go{height:46px;padding:0 16px;border:0;border-radius:14px;background:#0b6653;color:#fff;font-weight:800}.wopt-search-close{width:42px;height:42px;border:0;border-radius:50%;background:#f1f3f2;font-size:22px}
      .wopt-search-help{padding:10px 16px;color:#77807d;font-size:12px;border-bottom:1px solid #f0f0f0}.wopt-search-results{overflow:auto;padding:8px 10px 14px}.wopt-search-status{padding:22px 16px;text-align:center;color:#65706d}.wopt-search-result{width:100%;border:0;border-bottom:1px solid #eceeee;background:#fff;padding:14px 10px;text-align:left}.wopt-search-result:last-child{border-bottom:0}.wopt-search-key{display:inline-block;margin-bottom:7px;padding:4px 8px;border-radius:999px;background:#eaf7f3;color:#0b6653;font-size:11px;font-weight:900}.wopt-search-ar{font-family:"Noto Naskh Arabic","Amiri",serif;direction:rtl;text-align:right;font-size:23px;line-height:1.65;color:#171717}.wopt-search-en{margin-top:6px;color:#5f6664;font-size:13px;line-height:1.45}
      .wopt-search-history{padding:14px 16px 10px;border-bottom:1px solid #f0f0f0}.wopt-search-history-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:9px}.wopt-search-history-head strong{font-size:12px;color:#4e5956}.wopt-search-history-head button{border:0;background:transparent;color:#0b6653;font-size:11px;font-weight:800}.wopt-search-chips{display:flex;gap:7px;flex-wrap:wrap}.wopt-search-chip{border:1px solid #dbe7e3;border-radius:999px;background:#f4faf8;color:#174f42;padding:7px 11px;font-size:12px}.wopt-search-history.empty{display:none}
      .mushaf-ayah.wopt-search-hit{background:#fff5c7!important;box-shadow:0 0 0 5px rgba(246,196,69,.22)!important;border-radius:8px!important;transition:background .25s ease,box-shadow .25s ease}.quran-word.wopt-search-word{background:#f3d77a!important;color:#111!important;border-radius:5px!important;box-shadow:0 0 0 3px rgba(243,215,122,.22)!important}
      @media(max-width:600px){.wopt-search-backdrop{padding:calc(env(safe-area-inset-top) + 58px) 8px 8px}.wopt-search-sheet{max-height:88dvh;border-radius:18px}.wopt-search-head{padding:10px}.wopt-search-head input{font-size:15px}.wopt-search-ar{font-size:21px}.wopt-ref-safe-brand{font-size:22px!important}}
    `;
    document.head.appendChild(style);

    const overlay = document.createElement("div");
    overlay.className = "wopt-search-backdrop";
    overlay.innerHTML = `
      <section class="wopt-search-sheet" role="dialog" aria-modal="true" aria-label="Search Qur’an">
        <div class="wopt-search-head">
          <input type="search" inputmode="search" autocomplete="off" placeholder="Search Arabic, English, 2:255, or paste Qur’an text" aria-label="Search Qur’an">
          <button class="wopt-search-go" type="button">Search</button>
          <button class="wopt-search-close" type="button" aria-label="Close">×</button>
        </div>
        <div class="wopt-search-help">Search any Arabic or English word/phrase, paste Qur’an text, or enter a verse like 2:255.</div>
        <div class="wopt-search-history empty"><div class="wopt-search-history-head"><strong>Recent searches</strong><button type="button" data-clear-history>Clear</button></div><div class="wopt-search-chips"></div></div>
        <div class="wopt-search-results"><div class="wopt-search-status">Type something to search the full Qur’an.</div></div>
      </section>`;
    document.body.appendChild(overlay);

    const input = overlay.querySelector<HTMLInputElement>("input")!;
    const results = overlay.querySelector<HTMLElement>(".wopt-search-results")!;
    const historyBox = overlay.querySelector<HTMLElement>(".wopt-search-history")!;
    const chips = overlay.querySelector<HTMLElement>(".wopt-search-chips")!;
    let searching = false;
    let activeQuery = "";

    const renderHistory = () => {
      const history = readHistory();
      historyBox.classList.toggle("empty", !history.length);
      chips.innerHTML = history.map((item) => `<button class="wopt-search-chip" type="button" data-history="${encodeURIComponent(item)}">${item.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</button>`).join("");
    };

    const render = (items: SearchResult[]) => {
      if (!items.length) {
        results.innerHTML = `<div class="wopt-search-status">No matching ayat found. Try a shorter phrase.</div>`;
        return;
      }
      results.innerHTML = items.slice(0, 40).map((item) => {
        const key = item.verse_key || "";
        const arabic = stripHtml(item.text || item.highlighted || "");
        const english = stripHtml(item.translations?.[0]?.text || "");
        return `<button class="wopt-search-result" type="button" data-key="${key}"><span class="wopt-search-key">${key}</span><div class="wopt-search-ar">${arabic}</div>${english ? `<div class="wopt-search-en">${english}</div>` : ""}</button>`;
      }).join("");
    };

    const runSearch = async (forced?: string) => {
      if (searching) return;
      const query = (forced ?? input.value).trim();
      if (!query) return;
      input.value = query;
      activeQuery = query;
      saveHistory(query);
      renderHistory();
      searching = true;
      results.innerHTML = `<div class="wopt-search-status">Searching the Qur’an…</div>`;
      try {
        const direct = query.match(/^\s*(\d{1,3})\s*[:\/]\s*(\d{1,3})\s*$/);
        if (direct) {
          const key = `${Number(direct[1])}:${Number(direct[2])}`;
          const response = await fetch(`${API}/verses/by_key/${encodeURIComponent(key)}?language=en&words=false&translations=131&fields=text_uthmani`);
          if (!response.ok) throw new Error("verse");
          const data = await response.json();
          const verse = data.verse || {};
          render([{ verse_key: verse.verse_key || key, text: verse.text_uthmani || "", translations: verse.translations || [] }]);
        } else {
          const response = await fetch(`${API}/search?q=${encodeURIComponent(query)}&size=40&page=1&language=en`);
          if (!response.ok) throw new Error("search");
          const data = await response.json();
          render(data.search?.results || data.results || []);
        }
      } catch {
        results.innerHTML = `<div class="wopt-search-status">Search could not load. Check your connection and try again.</div>`;
      } finally {
        searching = false;
      }
    };

    const applyPendingHighlight = () => {
      let target: SearchTarget | null = null;
      try { target = JSON.parse(window.localStorage.getItem(SEARCH_TARGET_KEY) || "null") as SearchTarget | null; } catch { target = null; }
      if (!target?.verseKey || Date.now() - target.savedAt > 120000) return false;
      const ayah = document.querySelector<HTMLElement>(`[data-verse-key="${target.verseKey}"]`);
      if (!ayah) return false;
      document.querySelectorAll(".wopt-search-hit,.wopt-search-word").forEach((node) => node.classList.remove("wopt-search-hit", "wopt-search-word"));
      ayah.classList.add("wopt-search-hit");
      const q = normalize(target.query);
      if (q && !/^\d{1,3}\s*[:\/]\s*\d{1,3}$/.test(target.query)) {
        const terms = q.split(" ").filter((term) => term.length > 1);
        ayah.querySelectorAll<HTMLElement>(".quran-word").forEach((word) => {
          const text = normalize(word.textContent || "");
          if (terms.some((term) => text.includes(term) || term.includes(text))) word.classList.add("wopt-search-word");
        });
      }
      ayah.scrollIntoView({ behavior: "smooth", block: "center" });
      window.setTimeout(() => {
        ayah.classList.remove("wopt-search-hit");
        ayah.querySelectorAll(".wopt-search-word").forEach((word) => word.classList.remove("wopt-search-word"));
      }, 9000);
      window.localStorage.removeItem(SEARCH_TARGET_KEY);
      return true;
    };

    const open = () => {
      renderHistory();
      overlay.classList.add("open");
      window.setTimeout(() => input.focus(), 40);
    };
    const close = () => overlay.classList.remove("open");

    const capture = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      const brand = target.closest<HTMLElement>(".wopt-ref-safe-brand,[data-ref='home']");
      if (brand) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        window.location.href = homePath(pathname);
        return;
      }
      const search = target.closest<HTMLElement>("[data-ref='search']");
      if (search) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        open();
      }
    };

    document.addEventListener("click", capture, true);
    overlay.addEventListener("click", (event) => {
      const target = event.target as HTMLElement;
      if (target === overlay || target.closest(".wopt-search-close")) {
        close();
        return;
      }
      if (target.closest(".wopt-search-go")) {
        void runSearch();
        return;
      }
      if (target.closest("[data-clear-history]")) {
        window.localStorage.removeItem(SEARCH_HISTORY_KEY);
        renderHistory();
        return;
      }
      const history = target.closest<HTMLButtonElement>(".wopt-search-chip[data-history]");
      if (history?.dataset.history) {
        const query = decodeURIComponent(history.dataset.history);
        void runSearch(query);
        return;
      }
      const result = target.closest<HTMLButtonElement>(".wopt-search-result[data-key]");
      if (result?.dataset.key) {
        const key = result.dataset.key;
        const chapterId = Number(key.split(":")[0]);
        const query = activeQuery || input.value.trim();
        window.localStorage.setItem(LAST_READ_KEY, JSON.stringify({ chapterId, verseKey: key, savedAt: Date.now() }));
        window.localStorage.setItem(SEARCH_TARGET_KEY, JSON.stringify({ verseKey: key, query, savedAt: Date.now() } satisfies SearchTarget));
        close();
        window.location.reload();
      }
    });
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        void runSearch();
      }
      if (event.key === "Escape") close();
    });

    renderHistory();
    let highlightAttempts = 0;
    const highlightTimer = window.setInterval(() => {
      highlightAttempts += 1;
      if (applyPendingHighlight() || highlightAttempts > 30) window.clearInterval(highlightTimer);
    }, 350);

    return () => {
      window.clearInterval(highlightTimer);
      document.removeEventListener("click", capture, true);
      overlay.remove();
      style.remove();
    };
  }, [pathname]);

  return null;
}
