"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const API = "https://api.quran.com/api/v4";

type Chapter = { id: number; name_simple?: string; name_arabic?: string };
type ChapterReciter = { id: number; name?: string; style?: { name?: string | null } };

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

function surahOf(key = "") {
  return Number(key.split(":")[0]) || 0;
}

function normalizeName(value = "") {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\b(al|ash|sheikh|shaykh|recitation|murattal|mujawwad)\b/g, " ").replace(/\s+/g, " ").trim();
}

function formatTime(value: number) {
  if (!Number.isFinite(value) || value < 0) return "0:00";
  const minutes = Math.floor(value / 60);
  const seconds = Math.floor(value % 60);
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export default function QuranAudioUnifiedFlowEnhancer() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname.endsWith("/quran") && !pathname.endsWith("/quran/")) return;

    const style = document.createElement("style");
    style.dataset.woptUnifiedAudio = "true";
    style.textContent = `
      .wopt-unified-start{margin:13px 0 2px;padding:12px;border:1px solid #d9e7e2;border-radius:16px;background:#f8fbfa}
      .wopt-unified-start-title{margin:0 0 8px;color:#52635e;font-size:11px;font-weight:900}
      .wopt-unified-start-grid{display:grid;gap:8px}.wopt-unified-start-grid.multi{grid-template-columns:1fr 1fr}
      .wopt-unified-start button{min-height:52px;border:1px solid #d5e3de;border-radius:13px;background:#fff;color:#174d41;padding:9px 11px;text-align:left;font-size:12px;font-weight:850}
      .wopt-unified-start button.active{background:#e3f5ef;border-color:#51b7a3;color:#0b6653}.wopt-unified-start button span{display:block;margin-top:3px;color:#74817d;font-size:10px;font-weight:500}
      .wopt-unified-start .surah-choice{background:#f4faf7}
      .wopt-full-surah-badge{display:inline-flex;align-items:center;gap:5px;margin-left:6px;padding:3px 7px;border-radius:999px;background:#e4f4ee;color:#17634f;font-size:9px;font-weight:850;vertical-align:middle}
      @media(max-width:520px){.wopt-unified-start-grid.multi{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);

    let chapters = new Map<number, Chapter>();
    let chapterReciters: ChapterReciter[] = [];
    let currentPage: HTMLElement | null = null;
    let pageVerses: HTMLElement[] = [];
    let pageNumber = 1;
    let pendingTarget: HTMLElement | null = null;
    let pendingTargetAdded = false;
    let selectedSurah = 0;
    let fullSurahActive = false;
    let loadingFullSurah = false;

    const fullAudio = new Audio();
    fullAudio.preload = "auto";

    const clearPendingTarget = () => {
      if (pendingTarget && pendingTargetAdded) pendingTarget.classList.remove("wopt-menu-selected");
      pendingTarget = null;
      pendingTargetAdded = false;
    };

    const selectTarget = (target: HTMLElement | null) => {
      clearPendingTarget();
      if (!target) return;
      pendingTarget = target;
      pendingTargetAdded = !target.classList.contains("wopt-menu-selected");
      if (pendingTargetAdded) target.classList.add("wopt-menu-selected");
    };

    const loadReferenceData = async () => {
      if (chapters.size && chapterReciters.length) return;
      const [chapterResult, reciterResult] = await Promise.allSettled([
        fetch(`${API}/chapters?language=en`).then((response) => response.ok ? response.json() : Promise.reject()),
        fetch(`${API}/resources/chapter_reciters?language=en`).then((response) => response.ok ? response.json() : Promise.reject()),
      ]);
      if (chapterResult.status === "fulfilled") {
        chapters = new Map(((chapterResult.value.chapters || []) as Chapter[]).map((chapter) => [chapter.id, chapter]));
      }
      if (reciterResult.status === "fulfilled") chapterReciters = (reciterResult.value.reciters || []) as ChapterReciter[];
    };

    const chapterLabel = (surah: number) => {
      const chapter = chapters.get(surah);
      return chapter?.name_simple ? `${chapter.name_simple}${chapter.name_arabic ? ` · ${chapter.name_arabic}` : ""}` : `Surah ${surah}`;
    };

    const overlay = () => document.querySelector<HTMLElement>(".wopt-book-audio-backdrop.open");
    const statusNode = () => overlay()?.querySelector<HTMLElement>("[data-status]") || null;
    const progressNode = () => overlay()?.querySelector<HTMLInputElement>("[data-progress]") || null;
    const elapsedNode = () => overlay()?.querySelector<HTMLElement>("[data-elapsed]") || null;
    const remainingNode = () => overlay()?.querySelector<HTMLElement>("[data-remaining]") || null;

    const updateFullProgress = () => {
      if (!fullAudio.duration || !Number.isFinite(fullAudio.duration)) return;
      const progress = progressNode();
      if (progress) progress.value = String(Math.round((fullAudio.currentTime / fullAudio.duration) * 1000));
      const elapsed = elapsedNode();
      const remaining = remainingNode();
      if (elapsed) elapsed.textContent = formatTime(fullAudio.currentTime);
      if (remaining) remaining.textContent = `-${formatTime(Math.max(0, fullAudio.duration - fullAudio.currentTime))}`;
      if ("mediaSession" in navigator) {
        try { navigator.mediaSession.setPositionState({ duration: fullAudio.duration, position: Math.min(fullAudio.currentTime, fullAudio.duration), playbackRate: fullAudio.playbackRate || 1 }); } catch { /* unsupported */ }
      }
    };

    const setMedia = (surah: number, reciterName: string) => {
      if (!("mediaSession" in navigator)) return;
      const chapter = chapters.get(surah);
      if ("MediaMetadata" in window) {
        const basePath = pathname.replace(/\/quran\/?$/, "");
        navigator.mediaSession.metadata = new MediaMetadata({
          title: chapter ? `${chapter.name_simple || `Surah ${surah}`} ${chapter.name_arabic ? `(${chapter.name_arabic})` : ""}` : `Surah ${surah}`,
          artist: reciterName || "Qur’an recitation",
          album: "Windsor Qur’an",
          artwork: [{ src: `${window.location.origin}${basePath}/icon-512.png`, sizes: "512x512", type: "image/png" }],
        });
      }
      navigator.mediaSession.playbackState = fullAudio.paused ? "paused" : "playing";
    };

    const stopFullSurah = () => {
      fullAudio.pause();
      fullAudio.removeAttribute("src");
      fullAudio.load();
      fullSurahActive = false;
      loadingFullSurah = false;
      if ("mediaSession" in navigator) navigator.mediaSession.playbackState = "none";
      const status = statusNode();
      if (status) status.textContent = "Stopped.";
      const progress = progressNode(); if (progress) progress.value = "0";
      const elapsed = elapsedNode(); if (elapsed) elapsed.textContent = "0:00";
      const remaining = remainingNode(); if (remaining) remaining.textContent = "-0:00";
    };

    const selectedChapterReciter = async () => {
      await loadReferenceData();
      const select = overlay()?.querySelector<HTMLSelectElement>("#wopt-book-reciter");
      const label = select?.options[select.selectedIndex]?.text || "Mishari Rashid al-`Afasy";
      const wanted = normalizeName(label);
      let best = chapterReciters.find((item) => {
        const name = normalizeName(item.name || "");
        return name && wanted && (name.includes(wanted) || wanted.includes(name));
      });
      if (!best) best = chapterReciters.find((item) => /mishar|afasy/i.test(item.name || ""));
      if (!best) best = chapterReciters[0];
      return { id: best?.id || 7, name: best?.name || label };
    };

    const playFullSurah = async () => {
      if (!selectedSurah || loadingFullSurah) return;
      if (fullSurahActive && fullAudio.src) {
        await fullAudio.play();
        if ("mediaSession" in navigator) navigator.mediaSession.playbackState = "playing";
        const status = statusNode(); if (status) status.textContent = `Playing full ${chapterLabel(selectedSurah)}.`;
        return;
      }
      loadingFullSurah = true;
      const status = statusNode(); if (status) status.textContent = `Loading full ${chapterLabel(selectedSurah)}…`;
      try {
        const reciter = await selectedChapterReciter();
        const response = await fetch(`${API}/chapter_recitations/${reciter.id}/${selectedSurah}`);
        if (!response.ok) throw new Error("chapter audio");
        const data = await response.json() as { audio_file?: { audio_url?: string } };
        const src = data.audio_file?.audio_url;
        if (!src) throw new Error("chapter audio");
        fullAudio.src = src;
        fullAudio.playbackRate = 1;
        fullSurahActive = true;
        await fullAudio.play();
        setMedia(selectedSurah, reciter.name);
        if (status) status.textContent = `Playing full ${chapterLabel(selectedSurah)} · ${reciter.name}`;
      } catch {
        fullSurahActive = false;
        if (status) status.textContent = "Full Surah audio could not be loaded. Try another reciter.";
      } finally {
        loadingFullSurah = false;
      }
    };

    const renderStartChoices = async () => {
      const bookOverlay = overlay();
      if (!bookOverlay) return;
      await loadReferenceData();
      bookOverlay.querySelector(".wopt-unified-start")?.remove();

      const visible = nearestVerse(pageVerses);
      const visibleKey = visible?.dataset.verseKey || pageVerses[0]?.dataset.verseKey || "1:1";
      const firstKey = pageVerses[0]?.dataset.verseKey || visibleKey;
      const starts = new Map<number, HTMLElement>();
      pageVerses.forEach((verse) => {
        const surah = surahOf(verse.dataset.verseKey || "");
        if (surah && !starts.has(surah)) starts.set(surah, verse);
      });

      const section = document.createElement("div");
      section.className = "wopt-unified-start";
      section.innerHTML = `<div class="wopt-unified-start-title">Where should playback start? · Page ${pageNumber}</div><div class="wopt-unified-start-grid ${starts.size > 1 ? "multi" : ""}" data-unified-grid></div>`;
      const grid = section.querySelector<HTMLElement>("[data-unified-grid]")!;
      grid.insertAdjacentHTML("beforeend", `<button type="button" data-unified-kind="page" data-key="${firstKey}"><strong>Top of Page ${pageNumber}</strong><span>Begin with ${firstKey}</span></button>`);
      grid.insertAdjacentHTML("beforeend", `<button type="button" data-unified-kind="visible" data-key="${visibleKey}"><strong>Ayah I’m viewing</strong><span>Continue from ${visibleKey}</span></button>`);
      starts.forEach((verse, surah) => {
        grid.insertAdjacentHTML("beforeend", `<button type="button" class="surah-choice" data-unified-kind="surah" data-surah="${surah}" data-key="${verse.dataset.verseKey || ""}"><strong>${chapterLabel(surah)}</strong><span>Play the full Surah from ayah 1 <span class="wopt-full-surah-badge">gapless</span></span></button>`);
      });

      const now = bookOverlay.querySelector<HTMLElement>(".wopt-book-audio-now");
      now?.insertAdjacentElement("afterend", section);
    };

    const openUnified = async () => {
      stopFullSurah();
      selectedSurah = 0;
      clearPendingTarget();
      currentPage = visiblePrintedPage();
      pageVerses = uniqueVerses(currentPage || document);
      const visible = nearestVerse(pageVerses);
      pageNumber = Number(currentPage?.dataset.printedPage || visible?.dataset.page || 1) || 1;
      const bridge = document.querySelector<HTMLButtonElement>("button[data-clean='audio'][aria-hidden='true']") || document.querySelector<HTMLButtonElement>("button[data-clean='audio']");
      bridge?.click();
      await renderStartChoices();
    };

    const chooseStart = (button: HTMLButtonElement) => {
      const kind = button.dataset.unifiedKind;
      const key = button.dataset.key || "";
      const target = pageVerses.find((verse) => verse.dataset.verseKey === key) || null;
      const bookOverlay = overlay();
      bookOverlay?.querySelectorAll("[data-unified-kind]").forEach((node) => node.classList.toggle("active", node === button));
      stopFullSurah();

      if (kind === "page") {
        selectedSurah = 0;
        clearPendingTarget();
        bookOverlay?.querySelector<HTMLButtonElement>("[data-scope='page']")?.click();
        return;
      }

      selectTarget(target);
      if (target) target.scrollIntoView({ behavior: "auto", block: "center" });

      if (kind === "visible") {
        selectedSurah = 0;
        bookOverlay?.querySelector<HTMLButtonElement>("[data-scope='quran']")?.click();
        return;
      }

      selectedSurah = Number(button.dataset.surah || 0) || surahOf(key);
      bookOverlay?.querySelector<HTMLButtonElement>("[data-scope='surah']")?.click();
      const context = bookOverlay?.querySelector<HTMLElement>("[data-audio-context]");
      const detail = bookOverlay?.querySelector<HTMLElement>("[data-audio-detail]");
      if (context) context.textContent = `Full ${chapterLabel(selectedSurah)}`;
      if (detail) detail.textContent = `Surah ${selectedSurah} · starts at ayah 1 · continuous recording`;
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
        chooseStart(startButton);
        return;
      }

      const bookOverlay = overlay();
      if (!bookOverlay) return;
      const actionButton = target.closest<HTMLButtonElement>("[data-audio-action]");
      const action = actionButton?.dataset.audioAction;
      const scope = bookOverlay.querySelector<HTMLButtonElement>("[data-scope].active")?.dataset.scope;
      if (!action || scope !== "surah" || !selectedSurah) return;

      if (action === "play") {
        event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation();
        void playFullSurah();
        window.setTimeout(clearPendingTarget, 500);
      } else if (action === "pause" && (fullSurahActive || loadingFullSurah)) {
        event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation();
        fullAudio.pause();
        if ("mediaSession" in navigator) navigator.mediaSession.playbackState = "paused";
        const status = statusNode(); if (status) status.textContent = "Paused.";
      } else if (action === "stop" && (fullSurahActive || loadingFullSurah)) {
        event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation();
        stopFullSurah();
      }
    };

    const onProgress = (event: Event) => {
      if (!fullSurahActive || !fullAudio.duration) return;
      const input = event.target as HTMLInputElement;
      if (!input.matches(".wopt-book-audio-backdrop.open [data-progress]")) return;
      fullAudio.currentTime = (Number(input.value) / 1000) * fullAudio.duration;
      updateFullProgress();
    };

    fullAudio.addEventListener("timeupdate", updateFullProgress);
    fullAudio.addEventListener("loadedmetadata", updateFullProgress);
    fullAudio.addEventListener("play", () => { if ("mediaSession" in navigator) navigator.mediaSession.playbackState = "playing"; });
    fullAudio.addEventListener("pause", () => { if (fullSurahActive && "mediaSession" in navigator) navigator.mediaSession.playbackState = "paused"; });
    fullAudio.addEventListener("ended", () => {
      fullSurahActive = false;
      const status = statusNode(); if (status) status.textContent = "Surah finished.";
      if ("mediaSession" in navigator) navigator.mediaSession.playbackState = "none";
    });

    if ("mediaSession" in navigator) {
      try { navigator.mediaSession.setActionHandler("play", () => { if (fullSurahActive) void fullAudio.play(); }); } catch { /* unsupported */ }
      try { navigator.mediaSession.setActionHandler("pause", () => { if (fullSurahActive) fullAudio.pause(); }); } catch { /* unsupported */ }
      try { navigator.mediaSession.setActionHandler("stop", () => { if (fullSurahActive) stopFullSurah(); }); } catch { /* unsupported */ }
      try { navigator.mediaSession.setActionHandler("seekbackward", (details) => { if (fullSurahActive) fullAudio.currentTime = Math.max(0, fullAudio.currentTime - (details.seekOffset || 10)); }); } catch { /* unsupported */ }
      try { navigator.mediaSession.setActionHandler("seekforward", (details) => { if (fullSurahActive && fullAudio.duration) fullAudio.currentTime = Math.min(fullAudio.duration, fullAudio.currentTime + (details.seekOffset || 10)); }); } catch { /* unsupported */ }
    }

    document.addEventListener("click", onDocumentClick, true);
    document.addEventListener("input", onProgress, true);

    return () => {
      document.removeEventListener("click", onDocumentClick, true);
      document.removeEventListener("input", onProgress, true);
      clearPendingTarget();
      stopFullSurah();
      fullAudio.remove();
      style.remove();
    };
  }, [pathname]);

  return null;
}
