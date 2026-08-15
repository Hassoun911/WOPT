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

type PageSurah = {
  id: number;
  firstVerse: number;
  lastVerse: number;
  firstNode: HTMLElement;
};

function escapeHtml(value = "") {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char] || char));
}

export default function QuranContextSurahChooserEnhancer() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname.endsWith("/quran") && !pathname.endsWith("/quran/")) return;

    const style = document.createElement("style");
    style.dataset.woptContextSurah = "true";
    style.textContent = `
      .wopt-context-surah-backdrop{position:fixed;z-index:5600;inset:0;display:none;align-items:flex-end;justify-content:center;background:rgba(16,27,23,.34);padding:12px;backdrop-filter:blur(5px)}
      .wopt-context-surah-backdrop.open{display:flex}
      .wopt-context-surah-sheet{width:min(620px,100%);max-height:min(78vh,720px);overflow:auto;background:#fffdf8;color:#173f35;border-radius:24px;padding:18px;box-shadow:0 26px 80px rgba(0,0,0,.28);font-family:Arial,sans-serif}
      .wopt-context-surah-head{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;padding-bottom:14px;border-bottom:1px solid #e6ebe8}
      .wopt-context-surah-head small{display:block;color:#0d7660;font-size:10px;font-weight:900;letter-spacing:.13em;text-transform:uppercase;margin-bottom:5px}
      .wopt-context-surah-head strong{display:block;font-size:23px;letter-spacing:-.025em}.wopt-context-surah-head p{margin:6px 0 0;color:#73807c;font-size:12px;line-height:1.45}
      .wopt-context-surah-close{width:42px;height:42px;border:0;border-radius:50%;background:#f0f3f2;color:#22483e;font-size:23px;flex:0 0 auto}
      .wopt-context-current{display:grid;gap:8px;padding:14px 0}
      .wopt-context-surah-row{width:100%;border:1px solid #dce5e2;border-radius:17px;background:#fff;display:grid;grid-template-columns:42px 1fr auto;align-items:center;gap:11px;padding:13px;text-align:left;color:#183f35}
      .wopt-context-surah-row:active{background:#edf8f4}.wopt-context-surah-num{width:34px;height:34px;border-radius:50%;display:grid;place-items:center;background:#edf6f3;color:#0d705b;font-size:12px;font-weight:900}
      .wopt-context-surah-row strong{display:block;font-size:15px}.wopt-context-surah-row small{display:block;margin-top:3px;color:#7b8783;font-size:10px}.wopt-context-surah-ar{font:500 22px/1.35 "Noto Naskh Arabic","Amiri",serif;direction:rtl;white-space:nowrap}
      .wopt-context-all{width:100%;min-height:54px;border:1px solid #9fcfc1;border-radius:16px;background:#eaf7f3;color:#0a6652;font-weight:900;font-size:13px;margin-top:2px}
      .quran-app.wopt-context-surah-open .wopt-clean-toolbar{opacity:0!important;pointer-events:none!important;transform:translate(-50%,18px)!important}
      body.wopt-quran-modal-open .wopt-clean-toolbar{opacity:0!important;pointer-events:none!important}
      @media(max-width:600px){.wopt-context-surah-backdrop{padding:0}.wopt-context-surah-sheet{border-radius:24px 24px 0 0;max-height:82vh;padding:16px}.wopt-context-surah-head strong{font-size:21px}.wopt-context-surah-row{padding:12px 10px;grid-template-columns:36px 1fr auto}.wopt-context-surah-ar{font-size:20px}}
    `;
    document.head.appendChild(style);

    const backdrop = document.createElement("div");
    backdrop.className = "wopt-context-surah-backdrop";
    backdrop.innerHTML = `<section class="wopt-context-surah-sheet" role="dialog" aria-modal="true" aria-label="Choose a Surah"><header class="wopt-context-surah-head"><div><small>Qur’an navigation</small><strong>Choose a Surah</strong><p data-context-description>Select a Surah on this page or open the complete Qur’an index.</p></div><button class="wopt-context-surah-close" type="button" aria-label="Close">×</button></header><div class="wopt-context-current"></div><button class="wopt-context-all" type="button">All 114 Surahs</button></section>`;
    document.body.appendChild(backdrop);

    let chapters = new Map<number, Chapter>();
    let pageSurahs: PageSurah[] = [];

    const loadChapters = async () => {
      if (chapters.size) return;
      try {
        const response = await fetch(`${API}/chapters?language=en`);
        if (!response.ok) return;
        const data = await response.json() as { chapters?: Chapter[] };
        chapters = new Map((data.chapters || []).map((chapter) => [chapter.id, chapter]));
      } catch { /* numeric fallback is enough */ }
    };

    const visiblePage = () => {
      const pages = Array.from(document.querySelectorAll<HTMLElement>("[data-printed-page]"));
      if (!pages.length) return 0;
      const target = window.innerHeight * .42;
      return Number(pages.map((node) => {
        const rect = node.getBoundingClientRect();
        const center = Math.max(rect.top, 0) + Math.min(rect.bottom, window.innerHeight);
        return { page: Number(node.dataset.printedPage || 0), distance: Math.abs(center / 2 - target), visible: rect.bottom > 0 && rect.top < window.innerHeight };
      }).filter((item) => item.visible && item.page).sort((a, b) => a.distance - b.distance)[0]?.page || 0);
    };

    const collectPageSurahs = () => {
      const page = visiblePage();
      let nodes = page ? Array.from(document.querySelectorAll<HTMLElement>(`.mushaf-ayah[data-page='${page}'][data-verse-key]`)) : [];
      if (!nodes.length) {
        nodes = Array.from(document.querySelectorAll<HTMLElement>(".mushaf-ayah[data-verse-key]")).filter((node) => {
          const rect = node.getBoundingClientRect();
          return rect.bottom > 0 && rect.top < window.innerHeight;
        });
      }
      const map = new Map<number, PageSurah>();
      for (const node of nodes) {
        const [surahRaw, verseRaw] = (node.dataset.verseKey || "").split(":");
        const id = Number(surahRaw || 0);
        const verse = Number(verseRaw || 0);
        if (!id || !verse) continue;
        const existing = map.get(id);
        if (!existing) map.set(id, { id, firstVerse: verse, lastVerse: verse, firstNode: node });
        else { existing.firstVerse = Math.min(existing.firstVerse, verse); existing.lastVerse = Math.max(existing.lastVerse, verse); }
      }
      pageSurahs = Array.from(map.values()).sort((a, b) => a.id - b.id);
      return { page, rows: pageSurahs };
    };

    const render = () => {
      const { page, rows } = collectPageSurahs();
      const box = backdrop.querySelector<HTMLElement>(".wopt-context-current")!;
      const description = backdrop.querySelector<HTMLElement>("[data-context-description]")!;
      if (!rows.length) {
        description.textContent = "Open the complete Qur’an index to choose any Surah.";
        box.innerHTML = "";
        return;
      }
      description.textContent = rows.length > 1
        ? `Page ${page || "—"} contains ${rows.length} Surahs. Choose the section you want.`
        : `Page ${page || "—"} is in this Surah. You can stay here or open the full list.`;
      box.innerHTML = rows.map((item) => {
        const chapter = chapters.get(item.id);
        const range = item.firstVerse === item.lastVerse ? `Ayah ${item.firstVerse}` : `Ayat ${item.firstVerse}–${item.lastVerse}`;
        return `<button class="wopt-context-surah-row" type="button" data-context-surah="${item.id}"><span class="wopt-context-surah-num">${item.id}</span><span><strong>${escapeHtml(chapter?.name_simple || `Surah ${item.id}`)}</strong><small>${escapeHtml(chapter?.translated_name?.name || "")} · ${range}</small></span><span class="wopt-context-surah-ar">${escapeHtml(chapter?.name_arabic || `سورة ${item.id}`)}</span></button>`;
      }).join("");
    };

    const open = async () => {
      await loadChapters();
      render();
      backdrop.classList.add("open");
      document.querySelector<HTMLElement>(".quran-app")?.classList.add("wopt-context-surah-open");
      document.body.classList.add("wopt-quran-modal-open");
    };

    const close = () => {
      backdrop.classList.remove("open");
      document.querySelector<HTMLElement>(".quran-app")?.classList.remove("wopt-context-surah-open");
      document.body.classList.remove("wopt-quran-modal-open");
    };

    const openFullIndex = () => {
      close();
      window.dispatchEvent(new Event("wopt-quran-open-index"));
      window.setTimeout(() => document.querySelector<HTMLButtonElement>(".wopt-qindex-tab[data-tab='surahs']")?.click(), 80);
    };

    const onBackdrop = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (target === backdrop || target.closest(".wopt-context-surah-close")) { close(); return; }
      if (target.closest(".wopt-context-all")) { openFullIndex(); return; }
      const row = target.closest<HTMLButtonElement>("[data-context-surah]");
      if (!row) return;
      const id = Number(row.dataset.contextSurah || 0);
      const item = pageSurahs.find((entry) => entry.id === id);
      close();
      if (!item) return;
      const rect = item.firstNode.getBoundingClientRect();
      const targetY = Math.max(0, window.scrollY + rect.top - 92);
      window.scrollTo({ top: targetY, behavior: "smooth" });
      item.firstNode.classList.add("wopt-search-target");
      window.setTimeout(() => item.firstNode.classList.remove("wopt-search-target"), 2400);
    };

    const modalSync = () => {
      const anyOpen = Boolean(document.querySelector(".wopt-qindex.open,.wopt-more-backdrop.open,.wopt-search-backdrop.open,.wopt-ref-settings-backdrop.open,.quran-drawer-backdrop.open,.wopt-verse-translate-backdrop.open,.memorize-overlay.open,.wopt-context-surah-backdrop.open"));
      document.body.classList.toggle("wopt-quran-modal-open", anyOpen);
    };

    const onOpen = () => void open();
    const observer = new MutationObserver(modalSync);
    observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["class"] });
    backdrop.addEventListener("click", onBackdrop);
    window.addEventListener("wopt-quran-context-surahs", onOpen);
    modalSync();

    return () => {
      observer.disconnect();
      backdrop.removeEventListener("click", onBackdrop);
      window.removeEventListener("wopt-quran-context-surahs", onOpen);
      document.body.classList.remove("wopt-quran-modal-open");
      document.querySelector<HTMLElement>(".quran-app")?.classList.remove("wopt-context-surah-open");
      backdrop.remove();
      style.remove();
    };
  }, [pathname]);

  return null;
}
