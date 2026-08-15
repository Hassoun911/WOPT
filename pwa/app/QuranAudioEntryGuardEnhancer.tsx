"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const API = "https://api.quran.com/api/v4";

type ChapterName = { id: number; name_simple?: string; name_arabic?: string };
type StartChoice = { kind: "page" | "visible" | "surah"; surah?: number; key?: string };

function inViewport(node: HTMLElement) {
  const rect = node.getBoundingClientRect();
  return rect.bottom > 70 && rect.top < window.innerHeight - 100;
}

function visiblePrintedPage() {
  const pages = Array.from(document.querySelectorAll<HTMLElement>("[data-printed-page]"));
  if (!pages.length) return null;
  const mid = window.innerHeight * 0.48;
  return pages
    .map((node) => {
      const rect = node.getBoundingClientRect();
      const overlap = Math.max(0, Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0));
      const distance = Math.abs((rect.top + rect.bottom) / 2 - mid);
      return { node, overlap, distance };
    })
    .sort((a, b) => (b.overlap - a.overlap) || (a.distance - b.distance))[0]?.node || null;
}

function pageVerses(pageNode: HTMLElement | null) {
  const root: ParentNode = pageNode || document;
  return Array.from(root.querySelectorAll<HTMLElement>("[data-verse-key]"))
    .filter((node, index, all) => node.dataset.verseKey && all.findIndex((candidate) => candidate.dataset.verseKey === node.dataset.verseKey) === index);
}

function visibleVerse(pageNode: HTMLElement | null) {
  const verses = pageVerses(pageNode);
  const visible = verses.filter(inViewport);
  const candidates = visible.length ? visible : verses;
  const mid = window.innerHeight * 0.48;
  return candidates
    .map((node) => {
      const rect = node.getBoundingClientRect();
      return { node, distance: Math.abs((rect.top + rect.bottom) / 2 - mid) };
    })
    .sort((a, b) => a.distance - b.distance)[0]?.node || null;
}

function keyParts(key = "") {
  const [surahRaw, ayahRaw] = key.split(":");
  return { surah: Number(surahRaw) || 0, ayah: Number(ayahRaw) || 0 };
}

export default function QuranAudioEntryGuardEnhancer() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname.endsWith("/quran") && !pathname.endsWith("/quran/")) return;

    const style = document.createElement("style");
    style.dataset.woptAudioEntryGuard = "true";
    style.textContent = `
      .wopt-qindex-action[data-quick="audio"]{opacity:.42!important;filter:grayscale(.25);cursor:not-allowed!important}
      .wopt-audio-start-backdrop{position:fixed;z-index:4850;inset:0;display:none;align-items:flex-end;justify-content:center;padding:12px;background:rgba(0,0,0,.36);backdrop-filter:blur(3px)}
      .wopt-audio-start-backdrop.open{display:flex}
      .wopt-audio-start-sheet{width:min(620px,100%);max-height:82dvh;overflow:auto;border-radius:24px;background:#fff;color:#173d34;padding:18px;box-shadow:0 26px 80px rgba(0,0,0,.3);font-family:Arial,sans-serif}
      .wopt-audio-start-head{display:flex;align-items:flex-start;justify-content:space-between;gap:14px}.wopt-audio-start-head small{display:block;color:#16806a;font-size:10px;font-weight:900;letter-spacing:.13em;text-transform:uppercase}.wopt-audio-start-head h2{margin:4px 0 0;font-size:22px}.wopt-audio-start-close{width:42px;height:42px;border:0;border-radius:50%;background:#f1f4f3;color:#24483e;font-size:22px}
      .wopt-audio-start-note{margin:12px 0 14px;padding:11px 13px;border-radius:14px;background:#f2f8f6;color:#4f6861;font-size:12px;line-height:1.5}.wopt-audio-start-note strong{color:#164b3e}
      .wopt-audio-start-options{display:grid;gap:9px}.wopt-audio-start-option{width:100%;min-height:62px;border:1px solid #d8e5e1;border-radius:15px;background:#fff;color:#174d41;padding:11px 13px;text-align:left;font-weight:850}.wopt-audio-start-option:active{background:#eaf6f2}.wopt-audio-start-option span{display:block;margin-top:4px;color:#71807b;font-size:11px;font-weight:500}.wopt-audio-start-option.surah{background:#f7fbf9;border-color:#cae2da}
      .wopt-audio-start-section{margin:15px 2px 7px;color:#52635e;font-size:11px;font-weight:900}.wopt-audio-start-loading{padding:12px;text-align:center;color:#75817d;font-size:11px}
      @media(max-width:520px){.wopt-audio-start-sheet{padding:15px;border-radius:20px}.wopt-audio-start-head h2{font-size:20px}}
    `;
    document.head.appendChild(style);

    const hiddenBridge = document.createElement("button");
    hiddenBridge.type = "button";
    hiddenBridge.dataset.clean = "audio";
    hiddenBridge.tabIndex = -1;
    hiddenBridge.setAttribute("aria-hidden", "true");
    hiddenBridge.style.display = "none";
    document.body.appendChild(hiddenBridge);

    const overlay = document.createElement("div");
    overlay.className = "wopt-audio-start-backdrop";
    overlay.innerHTML = `
      <section class="wopt-audio-start-sheet" role="dialog" aria-modal="true" aria-label="Choose where Qur’an audio starts">
        <div class="wopt-audio-start-head"><div><small>Qur’an audio</small><h2>Where should playback start?</h2></div><button class="wopt-audio-start-close" type="button" aria-label="Close">×</button></div>
        <div class="wopt-audio-start-note" data-start-note></div>
        <div class="wopt-audio-start-options" data-start-options></div>
      </section>`;
    document.body.appendChild(overlay);

    const note = overlay.querySelector<HTMLElement>("[data-start-note]")!;
    const options = overlay.querySelector<HTMLElement>("[data-start-options]")!;
    let chapters = new Map<number, ChapterName>();
    let currentPage: HTMLElement | null = null;
    let currentVerses: HTMLElement[] = [];
    let pageNumber = 1;

    const chapterLabel = (surah: number) => {
      const chapter = chapters.get(surah);
      return chapter?.name_simple ? `${chapter.name_simple} · ${chapter.name_arabic || `Surah ${surah}`}` : `Surah ${surah}`;
    };

    const disableIndexListen = () => {
      document.querySelectorAll<HTMLButtonElement>(".wopt-qindex-action[data-quick='audio']").forEach((button) => {
        button.disabled = true;
        button.setAttribute("aria-disabled", "true");
        button.title = "Listen from the index will be added later";
      });
    };

    const loadChapters = async () => {
      if (chapters.size) return;
      try {
        const response = await fetch(`${API}/chapters?language=en`);
        if (!response.ok) return;
        const data = await response.json() as { chapters?: ChapterName[] };
        chapters = new Map((data.chapters || []).map((chapter) => [chapter.id, chapter]));
      } catch {
        // Numeric Surah labels remain usable offline or when the API is unavailable.
      }
    };

    const renderOptions = () => {
      const visible = visibleVerse(currentPage);
      const visibleKey = visible?.dataset.verseKey || currentVerses[0]?.dataset.verseKey || "1:1";
      const surahStarts = new Map<number, string>();
      currentVerses.forEach((verse) => {
        const key = verse.dataset.verseKey || "";
        const { surah } = keyParts(key);
        if (surah && !surahStarts.has(surah)) surahStarts.set(surah, key);
      });
      const multi = surahStarts.size > 1;

      note.innerHTML = multi
        ? `<strong>Page ${pageNumber} contains more than one Surah.</strong><br>Choose the exact place you want the recitation to begin.`
        : `<strong>Page ${pageNumber}</strong><br>Choose where you want the recitation to begin before the player opens.`;

      const firstKey = currentVerses[0]?.dataset.verseKey || visibleKey;
      const rows = [
        `<button class="wopt-audio-start-option" type="button" data-start-kind="page"><strong>Start at top of Page ${pageNumber}</strong><span>Begin with ${firstKey} and play this mushaf page.</span></button>`,
        `<button class="wopt-audio-start-option" type="button" data-start-kind="visible" data-key="${visibleKey}"><strong>Start from the ayah I am viewing</strong><span>Continue from Ayah ${visibleKey} onward.</span></button>`,
      ];

      rows.push(`<div class="wopt-audio-start-section">${multi ? "Choose a Surah shown on this page" : "Surah on this page"}</div>`);
      surahStarts.forEach((key, surah) => {
        rows.push(`<button class="wopt-audio-start-option surah" type="button" data-start-kind="surah" data-surah="${surah}" data-key="${key}"><strong>${chapterLabel(surah)}</strong><span>Start where this Surah appears on Page ${pageNumber} · ${key}</span></button>`);
      });
      options.innerHTML = rows.join("");
    };

    const openStartChooser = async () => {
      currentPage = visiblePrintedPage();
      currentVerses = pageVerses(currentPage);
      const visible = visibleVerse(currentPage);
      pageNumber = Number(currentPage?.dataset.printedPage || visible?.dataset.page || 1) || 1;
      overlay.classList.add("open");
      options.innerHTML = `<div class="wopt-audio-start-loading">Checking the Surahs on Page ${pageNumber}…</div>`;
      await loadChapters();
      renderOptions();
    };

    const clearTemporarySelection = (node: HTMLElement | null, added: boolean) => {
      if (node && added) node.classList.remove("wopt-menu-selected");
    };

    const openExistingAudioChooser = (scope: "page" | "surah" | "quran", target: HTMLElement | null = null) => {
      const hadSelection = Boolean(target?.classList.contains("wopt-menu-selected"));
      if (target && !hadSelection) target.classList.add("wopt-menu-selected");
      hiddenBridge.click();
      window.setTimeout(() => {
        document.querySelector<HTMLButtonElement>(`.wopt-book-audio-backdrop.open [data-scope='${scope}']`)?.click();
        clearTemporarySelection(target, Boolean(target && !hadSelection));
      }, 0);
    };

    const choose = (choice: StartChoice) => {
      overlay.classList.remove("open");
      if (choice.kind === "page") {
        openExistingAudioChooser("page");
        return;
      }

      const key = choice.key || "";
      const target = currentVerses.find((verse) => verse.dataset.verseKey === key)
        || document.querySelector<HTMLElement>(`[data-verse-key='${key}']`);
      if (!target) {
        openExistingAudioChooser("page");
        return;
      }

      if (choice.kind === "visible") {
        openExistingAudioChooser("quran", target);
        return;
      }

      target.scrollIntoView({ behavior: "smooth", block: "center" });
      window.setTimeout(() => openExistingAudioChooser("quran", target), 180);
    };

    const onDocumentClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      const toolbarAudio = target.closest<HTMLElement>(".wopt-clean-toolbar [data-clean='play']");
      if (!toolbarAudio) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      void openStartChooser();
    };

    const onOverlayClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (target === overlay || target.closest(".wopt-audio-start-close")) {
        overlay.classList.remove("open");
        return;
      }
      const button = target.closest<HTMLButtonElement>("[data-start-kind]");
      if (!button) return;
      const kind = button.dataset.startKind as StartChoice["kind"];
      choose({ kind, surah: Number(button.dataset.surah || 0) || undefined, key: button.dataset.key || undefined });
    };

    document.addEventListener("click", onDocumentClick, true);
    overlay.addEventListener("click", onOverlayClick);
    disableIndexListen();
    const observer = new MutationObserver(disableIndexListen);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      document.removeEventListener("click", onDocumentClick, true);
      overlay.removeEventListener("click", onOverlayClick);
      observer.disconnect();
      overlay.remove();
      hiddenBridge.remove();
      style.remove();
    };
  }, [pathname]);

  return null;
}
