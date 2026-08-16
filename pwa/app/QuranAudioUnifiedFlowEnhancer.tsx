"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const API = "https://api.quran.com/api/v4";

type Chapter = { id: number; name_simple?: string; name_arabic?: string };

function visiblePrintedPage() {
  const pages = Array.from(document.querySelectorAll<HTMLElement>("[data-printed-page]"));
  if (!pages.length) return null;
  const mid = window.innerHeight * 0.48;
  return pages
    .map((node) => {
      const rect = node.getBoundingClientRect();
      const overlap = Math.max(0, Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0));
      return { node, overlap, distance: Math.abs((rect.top + rect.bottom) / 2 - mid) };
    })
    .sort((a, b) => (b.overlap - a.overlap) || (a.distance - b.distance))[0]?.node || null;
}

function uniqueVerses(root: ParentNode) {
  const seen = new Set<string>();
  return Array.from(root.querySelectorAll<HTMLElement>("[data-verse-key]")).filter((node) => {
    const key = node.dataset.verseKey || "";
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function nearestVerse(verses: HTMLElement[]) {
  if (!verses.length) return null;
  const mid = window.innerHeight * 0.48;
  return verses
    .map((node) => {
      const rect = node.getBoundingClientRect();
      const overlap = Math.max(0, Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0));
      return { node, overlap, distance: Math.abs((rect.top + rect.bottom) / 2 - mid) };
    })
    .sort((a, b) => (b.overlap - a.overlap) || (a.distance - b.distance))[0]?.node || null;
}

function parts(key = "") {
  const [surahRaw, ayahRaw] = key.split(":");
  return { surah: Number(surahRaw) || 1, ayah: Number(ayahRaw) || 1 };
}

export default function QuranAudioUnifiedFlowEnhancer() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname.endsWith("/quran") && !pathname.endsWith("/quran/")) return;

    const style = document.createElement("style");
    style.dataset.woptUnifiedAudio = "true";
    style.textContent = `
      .wopt-unified-start{margin:13px 0 3px;padding:12px;border:1px solid #d9e7e2;border-radius:16px;background:#f8fbfa}
      .wopt-unified-start-title{margin:0 0 8px;color:#52635e;font-size:11px;font-weight:900}
      .wopt-unified-start-grid{display:grid;gap:8px}.wopt-unified-start-grid.multi{grid-template-columns:1fr 1fr}
      .wopt-unified-start button{min-height:52px;border:1px solid #d5e3de;border-radius:13px;background:#fff;color:#174d41;padding:9px 11px;text-align:left;font-size:12px;font-weight:850}
      .wopt-unified-start button.active{background:#e3f5ef;border-color:#51b7a3;color:#0b6653}.wopt-unified-start button span{display:block;margin-top:3px;color:#74817d;font-size:10px;font-weight:500}
      .wopt-unified-start .surah-choice{background:#f4faf7}.wopt-unified-start .surah-choice span{color:#5e746d}
      .wopt-gapless-badge{display:inline-flex!important;width:max-content;margin-top:5px!important;padding:2px 7px;border-radius:999px;background:#e4f4ee;color:#17634f!important;font-size:9px!important;font-weight:850!important}
      @media(max-width:520px){.wopt-unified-start-grid.multi{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);

    let chapters = new Map<number, Chapter>();
    let currentPage: HTMLElement | null = null;
    let verses: HTMLElement[] = [];
    let pageNumber = 1;
    let pendingSelection: HTMLElement | null = null;
    let pendingWasAdded = false;
    let selectedStartKey = "";

    const loadChapters = async () => {
      if (chapters.size) return;
      try {
        const response = await fetch(`${API}/chapters?language=en`);
        if (!response.ok) return;
        const data = await response.json() as { chapters?: Chapter[] };
        chapters = new Map((data.chapters || []).map((chapter) => [chapter.id, chapter]));
      } catch {
        // Numeric labels remain usable if the API is temporarily unavailable.
      }
    };

    const chapterLabel = (surah: number) => {
      const chapter = chapters.get(surah);
      if (!chapter?.name_simple) return `Surah ${surah}`;
      return `${chapter.name_simple}${chapter.name_arabic ? ` · ${chapter.name_arabic}` : ""}`;
    };

    const clearSelection = () => {
      if (pendingSelection && pendingWasAdded) pendingSelection.classList.remove("wopt-menu-selected");
      pendingSelection = null;
      pendingWasAdded = false;
    };

    const selectVerse = (target: HTMLElement | null) => {
      clearSelection();
      if (!target) return;
      pendingSelection = target;
      pendingWasAdded = !target.classList.contains("wopt-menu-selected");
      if (pendingWasAdded) target.classList.add("wopt-menu-selected");
    };

    const bookOverlay = () => document.querySelector<HTMLElement>(".wopt-book-audio-backdrop.open");

    const setContextText = (key: string, page: number, title: string) => {
      const overlay = bookOverlay();
      const { surah, ayah } = parts(key);
      const context = overlay?.querySelector<HTMLElement>("[data-audio-context]");
      const detail = overlay?.querySelector<HTMLElement>("[data-audio-detail]");
      if (context) context.textContent = title;
      if (detail) detail.textContent = `Surah ${surah} · Ayah ${ayah} · Page ${page}`;
    };

    const clickScope = (scope: "page" | "surah" | "quran") => {
      bookOverlay()?.querySelector<HTMLButtonElement>(`[data-scope='${scope}']`)?.click();
    };

    const restoreSelectedContext = (scope: string) => {
      if (!selectedStartKey) return;
      const selected = parts(selectedStartKey);
      if (scope === "surah") {
        const key = `${selected.surah}:1`;
        selectedStartKey = key;
        setContextText(key, pageNumber, `Full ${chapterLabel(selected.surah)}`);
      } else if (scope === "quran") {
        setContextText(selectedStartKey, pageNumber, `Continue from ${selectedStartKey}`);
      }
    };

    const renderStartChoices = async () => {
      const overlay = bookOverlay();
      if (!overlay) return;
      await loadChapters();
      overlay.querySelector(".wopt-unified-start")?.remove();

      const visible = nearestVerse(verses);
      const visibleKey = visible?.dataset.verseKey || verses[0]?.dataset.verseKey || "1:1";
      const firstKey = verses[0]?.dataset.verseKey || visibleKey;
      selectedStartKey = firstKey;
      const surahs = new Map<number, HTMLElement>();
      verses.forEach((verse) => {
        const surah = parts(verse.dataset.verseKey || "").surah;
        if (!surahs.has(surah)) surahs.set(surah, verse);
      });

      const section = document.createElement("div");
      section.className = "wopt-unified-start";
      section.innerHTML = `<div class="wopt-unified-start-title">Where should playback start? · Page ${pageNumber}</div><div class="wopt-unified-start-grid ${surahs.size > 1 ? "multi" : ""}" data-start-grid></div>`;
      const grid = section.querySelector<HTMLElement>("[data-start-grid]")!;
      grid.insertAdjacentHTML("beforeend", `<button type="button" data-unified-kind="page" data-key="${firstKey}"><strong>Top of Page ${pageNumber}</strong><span>Play this mushaf page from ${firstKey}</span></button>`);
      grid.insertAdjacentHTML("beforeend", `<button type="button" data-unified-kind="visible" data-key="${visibleKey}"><strong>Ayah I’m viewing</strong><span>Continue Qur’an from ${visibleKey}</span></button>`);
      surahs.forEach((verse, surah) => {
        grid.insertAdjacentHTML("beforeend", `<button type="button" class="surah-choice" data-unified-kind="surah" data-surah="${surah}" data-key="${verse.dataset.verseKey || `${surah}:1`}"><strong>${chapterLabel(surah)}</strong><span>Play the full Surah from ayah 1</span><span class="wopt-gapless-badge">continuous recording</span></button>`);
      });

      overlay.querySelector<HTMLElement>(".wopt-book-audio-now")?.insertAdjacentElement("afterend", section);
      clickScope("page");
      setContextText(firstKey, pageNumber, `Page ${pageNumber}`);
    };

    const openUnified = async () => {
      clearSelection();
      selectedStartKey = "";
      currentPage = visiblePrintedPage();
      verses = uniqueVerses(currentPage || document);
      const visible = nearestVerse(verses);
      pageNumber = Number(currentPage?.dataset.printedPage || visible?.dataset.page || 1) || 1;

      const bridge = document.querySelector<HTMLButtonElement>("button[data-clean='audio'][aria-hidden='true']")
        || document.querySelector<HTMLButtonElement>("button[data-clean='audio']");
      bridge?.click();
      await renderStartChoices();
    };

    const choose = (button: HTMLButtonElement) => {
      const overlay = bookOverlay();
      const kind = button.dataset.unifiedKind;
      const key = button.dataset.key || "1:1";
      const target = verses.find((verse) => verse.dataset.verseKey === key) || null;
      overlay?.querySelectorAll("[data-unified-kind]").forEach((node) => node.classList.toggle("active", node === button));

      if (kind === "page") {
        selectedStartKey = key;
        clearSelection();
        clickScope("page");
        setContextText(key, pageNumber, `Page ${pageNumber}`);
        return;
      }

      selectVerse(target);
      if (target) target.scrollIntoView({ behavior: "auto", block: "center" });

      if (kind === "visible") {
        selectedStartKey = key;
        clickScope("quran");
        setContextText(key, pageNumber, `Continue from ${key}`);
        return;
      }

      const surah = Number(button.dataset.surah || 0) || parts(key).surah;
      selectedStartKey = `${surah}:1`;
      clickScope("surah");
      setContextText(selectedStartKey, pageNumber, `Full ${chapterLabel(surah)}`);
    };

    const onDocumentClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;

      const toolbarAudio = target.closest<HTMLElement>(".wopt-clean-toolbar [data-clean='play']");
      if (toolbarAudio) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        void openUnified();
        return;
      }

      const startButton = target.closest<HTMLButtonElement>(".wopt-book-audio-backdrop.open [data-unified-kind]");
      if (startButton) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        choose(startButton);
        return;
      }

      const scopeButton = target.closest<HTMLButtonElement>(".wopt-book-audio-backdrop.open [data-scope]");
      if (scopeButton) {
        const scope = scopeButton.dataset.scope || "";
        if (scope === "surah" || scope === "quran") {
          // The legacy chooser recalculates context from the verse nearest the
          // middle of the viewport whenever a scope button is pressed. Restore
          // the explicit start chosen by the user after those handlers finish.
          window.setTimeout(() => restoreSelectedContext(scope), 0);
        }
        return;
      }

      const playButton = target.closest<HTMLButtonElement>(".wopt-book-audio-backdrop.open [data-audio-action='play']");
      if (playButton && pendingSelection) window.setTimeout(clearSelection, 1200);

      if (target.closest(".wopt-book-audio-close") || target === bookOverlay()) clearSelection();
    };

    document.addEventListener("click", onDocumentClick, true);

    return () => {
      document.removeEventListener("click", onDocumentClick, true);
      clearSelection();
      style.remove();
    };
  }, [pathname]);

  return null;
}
