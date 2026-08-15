"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const API = "https://api.quran.com/api/v4";

type Scope = "ayah" | "page" | "surah" | "quran";
type ReadingContext = { surah: number; ayah: number; page: number; key: string };
type ChapterReciter = { id: number; name?: string; reciter_name?: string; style?: { name?: string | null } | string };
type VerseTiming = { verse_key: string; timestamp_from: number; timestamp_to: number };
type ChapterStream = { surah: number; reciterId: number; url: string; timings: VerseTiming[] };
type SegmentDescriptor = { surah: number; firstKey?: string; lastKey?: string; startAtContext?: boolean };
type ActiveSegment = { descriptor: SegmentDescriptor; stream: ChapterStream; startMs: number; endMs?: number };

function formatTime(value: number) {
  if (!Number.isFinite(value) || value < 0) return "0:00";
  const hours = Math.floor(value / 3600);
  const minutes = Math.floor((value % 3600) / 60);
  const seconds = Math.floor(value % 60);
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
    : `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function normalizeName(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/mishari/g, "mishary")
    .replace(/al[ -]?afasy/g, "alafasy")
    .replace(/abdulbaset/g, "abdulbasit")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b(?:sheikh|shaykh|qari|reciter|murattal|mujawwad|al|el)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function reciterScore(selected: string, candidate: string) {
  const a = normalizeName(selected);
  const b = normalizeName(candidate);
  if (!a || !b) return 0;
  if (a === b) return 100;
  if (a.includes(b) || b.includes(a)) return 80;
  const aTokens = new Set(a.split(" "));
  const bTokens = new Set(b.split(" "));
  let common = 0;
  aTokens.forEach((token) => { if (bTokens.has(token)) common += 1; });
  const denominator = Math.max(aTokens.size, bTokens.size, 1);
  return (common / denominator) * 60;
}

function timingFor(stream: ChapterStream, key?: string) {
  if (!key) return undefined;
  return stream.timings.find((item) => item.verse_key === key);
}

export default function QuranContinuousAudioEnhancer() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname.endsWith("/quran") && !pathname.endsWith("/quran/")) return;

    const audio = document.createElement("audio");
    audio.preload = "auto";
    audio.dataset.woptContinuousQuran = "true";
    audio.setAttribute("playsinline", "true");
    audio.style.display = "none";
    document.body.appendChild(audio);

    const streamCache = new Map<string, Promise<ChapterStream>>();
    let chapterRecitersPromise: Promise<ChapterReciter[]> | null = null;
    let active = false;
    let scope: Scope | null = null;
    let signature = "";
    let segmentPlan: SegmentDescriptor[] = [];
    let segmentIndex = 0;
    let activeSegment: ActiveSegment | null = null;
    let activeReciter: ChapterReciter | null = null;
    let activeContext: ReadingContext | null = null;
    let transitionId = 0;
    let transitioning = false;
    let bypassLegacy = false;
    let lastHighlighted = "";
    let primedKey = "";

    const statusNode = () => document.querySelector<HTMLElement>(".wopt-book-audio-backdrop [data-status]");
    const progressNode = () => document.querySelector<HTMLInputElement>(".wopt-book-audio-backdrop [data-progress]");
    const elapsedNode = () => document.querySelector<HTMLElement>(".wopt-book-audio-backdrop [data-elapsed]");
    const remainingNode = () => document.querySelector<HTMLElement>(".wopt-book-audio-backdrop [data-remaining]");
    const reciterSelect = () => document.querySelector<HTMLSelectElement>("#wopt-book-reciter");

    const setStatus = (text: string) => {
      const node = statusNode();
      if (node) node.textContent = text;
    };

    const selectedScope = (): Scope => {
      const selected = document.querySelector<HTMLButtonElement>(".wopt-book-audio-backdrop [data-scope].active")?.dataset.scope as Scope | undefined;
      return selected || "page";
    };

    const selectedReciterName = () => {
      const select = reciterSelect();
      const text = select?.selectedOptions?.[0]?.textContent || "";
      return text.split("·")[0].trim() || "Qur’an reciter";
    };

    const readContext = (): ReadingContext => {
      const detail = document.querySelector<HTMLElement>(".wopt-book-audio-backdrop [data-audio-detail]")?.textContent || "";
      const match = detail.match(/Surah\s+(\d+)\s*·\s*Ayah\s+(\d+)\s*·\s*Page\s+(\d+)/i);
      if (match) {
        const surah = Number(match[1]) || 1;
        const ayah = Number(match[2]) || 1;
        const page = Number(match[3]) || 1;
        return { surah, ayah, page, key: `${surah}:${ayah}` };
      }

      const pageNode = Array.from(document.querySelectorAll<HTMLElement>("[data-printed-page]"))
        .find((node) => {
          const rect = node.getBoundingClientRect();
          return rect.bottom > 60 && rect.top < window.innerHeight - 60;
        });
      const verse = pageNode?.querySelector<HTMLElement>("[data-verse-key]") || document.querySelector<HTMLElement>("[data-verse-key]");
      const key = verse?.dataset.verseKey || "1:1";
      const [surahRaw, ayahRaw] = key.split(":");
      const page = Number(pageNode?.dataset.printedPage || verse?.dataset.page || 1) || 1;
      return { surah: Number(surahRaw) || 1, ayah: Number(ayahRaw) || 1, page, key };
    };

    const loadChapterReciters = () => {
      if (chapterRecitersPromise) return chapterRecitersPromise;
      chapterRecitersPromise = fetch(`${API}/resources/chapter_reciters?language=en`)
        .then((response) => {
          if (!response.ok) throw new Error("chapter reciters");
          return response.json();
        })
        .then((data: { reciters?: ChapterReciter[] }) => data.reciters || [])
        .catch(() => [] as ChapterReciter[]);
      return chapterRecitersPromise;
    };

    const mapReciter = async () => {
      const selectedName = selectedReciterName();
      const selectId = Number(reciterSelect()?.value || 0);
      const reciters = await loadChapterReciters();
      if (!reciters.length) return null;

      const nameOf = (item: ChapterReciter) => item.name || item.reciter_name || "";
      const sameId = reciters.find((item) => item.id === selectId);
      if (sameId && reciterScore(selectedName, nameOf(sameId)) >= 35) return sameId;

      let best: ChapterReciter | null = null;
      let bestScore = 0;
      for (const item of reciters) {
        const score = reciterScore(selectedName, nameOf(item));
        if (score > bestScore) { best = item; bestScore = score; }
      }
      return bestScore >= 20 ? best : null;
    };

    const fetchStream = (reciterId: number, surah: number) => {
      const cacheKey = `${reciterId}:${surah}`;
      const cached = streamCache.get(cacheKey);
      if (cached) return cached;

      const request = fetch(`${API}/chapter_recitations/${reciterId}/${surah}?segments=true`)
        .then(async (response) => {
          if (!response.ok) throw new Error(`chapter stream ${response.status}`);
          const data = await response.json() as {
            audio_file?: { audio_url?: string; timestamps?: Array<{ verse_key?: string; timestamp_from?: number; timestamp_to?: number }> };
          };
          const file = data.audio_file;
          if (!file?.audio_url) throw new Error("chapter stream url");
          const timings = (file.timestamps || [])
            .filter((item): item is { verse_key: string; timestamp_from: number; timestamp_to: number } => Boolean(item.verse_key) && Number.isFinite(item.timestamp_from) && Number.isFinite(item.timestamp_to))
            .map((item) => ({ verse_key: item.verse_key, timestamp_from: item.timestamp_from, timestamp_to: item.timestamp_to }));
          return { surah, reciterId, url: file.audio_url, timings } as ChapterStream;
        });

      streamCache.set(cacheKey, request);
      request.catch(() => streamCache.delete(cacheKey));
      return request;
    };

    const pageVerseKeys = async (page: number) => {
      const root = document.querySelector<HTMLElement>(`[data-printed-page="${page}"]`);
      const domKeys = Array.from(root?.querySelectorAll<HTMLElement>("[data-verse-key]") || [])
        .map((node) => node.dataset.verseKey || "")
        .filter(Boolean);
      const uniqueDom = domKeys.filter((key, index) => domKeys.indexOf(key) === index);
      if (uniqueDom.length) return uniqueDom;

      const response = await fetch(`${API}/verses/by_page/${page}?language=en&words=false&fields=verse_key&page=1&per_page=50`);
      if (!response.ok) return [] as string[];
      const data = await response.json() as { verses?: Array<{ verse_key?: string }> };
      return (data.verses || []).map((verse) => verse.verse_key || "").filter(Boolean);
    };

    const buildPagePlan = async (page: number) => {
      const keys = await pageVerseKeys(page);
      const plan: SegmentDescriptor[] = [];
      for (const key of keys) {
        const surah = Number(key.split(":")[0]) || 1;
        const last = plan[plan.length - 1];
        if (!last || last.surah !== surah) plan.push({ surah, firstKey: key, lastKey: key });
        else last.lastKey = key;
      }
      return plan;
    };

    const clearHighlight = () => {
      document.querySelectorAll(".wopt-page-audio-playing").forEach((node) => node.classList.remove("wopt-page-audio-playing"));
      lastHighlighted = "";
    };

    const highlight = (key: string) => {
      if (!key || key === lastHighlighted) return;
      clearHighlight();
      const nodes = Array.from(document.querySelectorAll<HTMLElement>(`[data-verse-key="${key}"]`));
      const visible = nodes.find((node) => {
        const rect = node.getBoundingClientRect();
        return rect.bottom > 70 && rect.top < window.innerHeight - 70;
      });
      (visible || nodes[0])?.classList.add("wopt-page-audio-playing");
      lastHighlighted = key;
    };

    const waitForMetadata = (token: number) => new Promise<void>((resolve, reject) => {
      if (token !== transitionId) { reject(new Error("cancelled")); return; }
      if (audio.readyState >= 1 && Number.isFinite(audio.duration)) { resolve(); return; }
      const timeout = window.setTimeout(() => { cleanup(); reject(new Error("audio timeout")); }, 10000);
      const ready = () => { cleanup(); resolve(); };
      const failed = () => { cleanup(); reject(new Error("audio load")); };
      const cleanup = () => {
        window.clearTimeout(timeout);
        audio.removeEventListener("loadedmetadata", ready);
        audio.removeEventListener("canplay", ready);
        audio.removeEventListener("error", failed);
      };
      audio.addEventListener("loadedmetadata", ready, { once: true });
      audio.addEventListener("canplay", ready, { once: true });
      audio.addEventListener("error", failed, { once: true });
    });

    const resetProgress = () => {
      const progress = progressNode();
      const elapsed = elapsedNode();
      const remaining = remainingNode();
      if (progress) progress.value = "0";
      if (elapsed) elapsed.textContent = "0:00";
      if (remaining) remaining.textContent = "-0:00";
    };

    const updateProgress = () => {
      if (!active || !activeSegment) return;
      const start = activeSegment.startMs / 1000;
      const end = activeSegment.endMs != null
        ? activeSegment.endMs / 1000
        : (Number.isFinite(audio.duration) ? audio.duration : start);
      if (!Number.isFinite(end) || end <= start) return;
      const position = Math.max(start, Math.min(audio.currentTime || start, end));
      const relative = position - start;
      const duration = end - start;
      const progress = progressNode();
      const elapsed = elapsedNode();
      const remaining = remainingNode();
      if (progress) progress.value = String(Math.round((relative / duration) * 1000));
      if (elapsed) elapsed.textContent = formatTime(relative);
      if (remaining) remaining.textContent = `-${formatTime(Math.max(0, duration - relative))}`;
    };

    const currentTiming = () => {
      if (!activeSegment?.stream.timings.length) return undefined;
      const ms = audio.currentTime * 1000;
      return activeSegment.stream.timings.find((item) => ms >= item.timestamp_from && ms < item.timestamp_to)
        || activeSegment.stream.timings.findLast?.((item) => ms >= item.timestamp_from)
        || activeSegment.stream.timings[0];
    };

    const updateNowPlaying = () => {
      if (!active || !activeSegment) return;
      const timing = currentTiming();
      const key = timing?.verse_key || activeSegment.descriptor.firstKey || `${activeSegment.descriptor.surah}:1`;
      highlight(key);
      const reciterName = activeReciter?.name || activeReciter?.reciter_name || selectedReciterName();
      setStatus(`Playing ${key} · ${reciterName}`);
    };

    const clearContinuousState = (clearSource: boolean) => {
      active = false;
      scope = null;
      signature = "";
      segmentPlan = [];
      segmentIndex = 0;
      activeSegment = null;
      activeReciter = null;
      activeContext = null;
      transitioning = false;
      transitionId += 1;
      audio.pause();
      if (clearSource) {
        audio.removeAttribute("src");
        audio.load();
        primedKey = "";
      }
      resetProgress();
      clearHighlight();
    };

    const stopContinuous = (announce = true) => {
      clearContinuousState(true);
      if (announce) setStatus("Stopped.");
    };

    const prepareDescriptor = async (descriptor: SegmentDescriptor, reciter: ChapterReciter, context: ReadingContext) => {
      const stream = await fetchStream(reciter.id, descriptor.surah);
      let startMs = 0;
      let endMs: number | undefined;

      if (descriptor.startAtContext) startMs = timingFor(stream, context.key)?.timestamp_from || 0;
      else if (descriptor.firstKey) startMs = timingFor(stream, descriptor.firstKey)?.timestamp_from || 0;

      if (descriptor.lastKey) {
        const last = timingFor(stream, descriptor.lastKey);
        if (!last) throw new Error("page timing");
        endMs = last.timestamp_to;
      }

      if ((descriptor.startAtContext || descriptor.firstKey) && stream.timings.length && startMs === 0) {
        const requested = descriptor.startAtContext ? context.key : descriptor.firstKey;
        if (requested !== `${descriptor.surah}:1`) throw new Error("start timing");
      }

      return { descriptor, stream, startMs, endMs } as ActiveSegment;
    };

    const primeCurrent = async () => {
      if (active) return;
      const nextScope = selectedScope();
      if (nextScope === "ayah") return;
      const context = readContext();
      const reciter = await mapReciter();
      if (!reciter) return;
      try {
        let firstSurah = context.surah;
        if (nextScope === "page") {
          const keys = await pageVerseKeys(context.page);
          if (keys.length) firstSurah = Number(keys[0].split(":")[0]) || firstSurah;
        }
        const stream = await fetchStream(reciter.id, firstSurah);
        const key = `${reciter.id}:${firstSurah}`;
        if (!active && primedKey !== key) {
          audio.src = stream.url;
          audio.preload = "auto";
          audio.load();
          primedKey = key;
        }
      } catch { /* legacy player remains available */ }
    };

    const preloadNextSurah = () => {
      if (!active || scope !== "quran" || !activeReciter || !activeSegment) return;
      const next = activeSegment.descriptor.surah + 1;
      if (next > 114) return;
      void fetchStream(activeReciter.id, next).then((stream) => {
        const link = document.createElement("link");
        link.rel = "prefetch";
        link.as = "audio";
        link.href = stream.url;
        link.dataset.woptQuranPrefetch = "true";
        document.head.appendChild(link);
        window.setTimeout(() => link.remove(), 30000);
      }).catch(() => undefined);
    };

    const playSegment = async (descriptor: SegmentDescriptor, index: number, token: number) => {
      if (!activeReciter || !activeContext || token !== transitionId) return;
      transitioning = true;
      const segment = await prepareDescriptor(descriptor, activeReciter, activeContext);
      if (token !== transitionId) return;
      activeSegment = segment;
      segmentIndex = index;

      if (audio.src !== segment.stream.url) {
        audio.src = segment.stream.url;
        audio.preload = "auto";
        audio.load();
      }
      await waitForMetadata(token);
      if (token !== transitionId) return;

      const startSeconds = segment.startMs / 1000;
      try { audio.currentTime = Math.max(0, Math.min(startSeconds, Number.isFinite(audio.duration) ? audio.duration : startSeconds)); } catch { /* wait for browser */ }
      updateProgress();
      await audio.play();
      if (token !== transitionId) return;
      active = true;
      transitioning = false;
      updateNowPlaying();
      preloadNextSurah();
    };

    const finish = () => {
      const finishedScope = scope;
      active = false;
      transitioning = false;
      audio.pause();
      clearHighlight();
      if ("mediaSession" in navigator) navigator.mediaSession.playbackState = "none";
      setStatus(finishedScope === "page" ? "Finished this page." : finishedScope === "surah" ? "Finished this Surah." : "Finished.");
    };

    const advance = async () => {
      if (!activeSegment || !activeReciter || !activeContext || transitioning) return;
      const token = transitionId;
      transitioning = true;
      try {
        if (scope === "page") {
          const nextIndex = segmentIndex + 1;
          if (nextIndex >= segmentPlan.length) { finish(); return; }
          await playSegment(segmentPlan[nextIndex], nextIndex, token);
          return;
        }
        if (scope === "quran") {
          const nextSurah = activeSegment.descriptor.surah + 1;
          if (nextSurah > 114) { finish(); return; }
          activeContext = { surah: nextSurah, ayah: 1, page: activeContext.page, key: `${nextSurah}:1` };
          await playSegment({ surah: nextSurah }, 0, token);
          return;
        }
        finish();
      } catch {
        setStatus("Could not continue the audio. Press Play to retry.");
        active = false;
        transitioning = false;
      }
    };

    const startContinuous = async (playButton: HTMLButtonElement) => {
      const nextScope = selectedScope();
      if (nextScope === "ayah") return;
      const context = readContext();
      const nextSignature = `${nextScope}|${context.key}|${context.page}|${reciterSelect()?.value || ""}`;

      if (active && signature === nextSignature) {
        if (audio.paused) {
          await audio.play();
          setStatus(`Resumed ${currentTiming()?.verse_key || context.key}.`);
        }
        return;
      }

      clearContinuousState(false);
      const token = transitionId;
      scope = nextScope;
      signature = nextSignature;
      activeContext = context;
      setStatus("Preparing continuous recitation…");

      const legacyStop = document.querySelector<HTMLButtonElement>(".wopt-quran-player [data-player='stop']");
      legacyStop?.click();

      try {
        const reciter = await mapReciter();
        if (!reciter) throw new Error("continuous reciter");
        activeReciter = reciter;

        if (nextScope === "page") {
          segmentPlan = await buildPagePlan(context.page);
          if (!segmentPlan.length) throw new Error("page plan");
        } else if (nextScope === "surah") {
          segmentPlan = [{ surah: context.surah }];
        } else {
          segmentPlan = [{ surah: context.surah, startAtContext: true }];
        }

        await playSegment(segmentPlan[0], 0, token);
      } catch {
        clearContinuousState(true);
        setStatus("Continuous audio is not available for this reciter. Using verse audio instead…");
        bypassLegacy = true;
        try { playButton.click(); } finally { bypassLegacy = false; }
      }
    };

    const onDocumentClick = (event: MouseEvent) => {
      if (bypassLegacy) return;
      const target = event.target as HTMLElement;
      const scopeButton = target.closest<HTMLButtonElement>(".wopt-book-audio-backdrop [data-scope]");
      if (scopeButton) {
        if (active) stopContinuous(false);
        window.setTimeout(() => { void primeCurrent(); }, 0);
        return;
      }

      const actionButton = target.closest<HTMLButtonElement>(".wopt-book-audio-backdrop [data-audio-action]");
      if (!actionButton) return;
      const action = actionButton.dataset.audioAction;
      const nextScope = selectedScope();

      if (nextScope === "ayah" && !active) return;
      if (action === "play" && nextScope !== "ayah") {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        void startContinuous(actionButton);
        return;
      }
      if (active && action === "pause") {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        audio.pause();
        setStatus("Paused.");
        return;
      }
      if (active && action === "stop") {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        stopContinuous(true);
      }
    };

    const onDocumentChange = (event: Event) => {
      const target = event.target as HTMLElement;
      if (!target.closest("#wopt-book-reciter")) return;
      if (active) stopContinuous(false);
      primedKey = "";
      window.setTimeout(() => { void primeCurrent(); }, 0);
    };

    const onProgressInput = (event: Event) => {
      if (!active || !activeSegment) return;
      const target = event.target as HTMLInputElement;
      if (!target.matches(".wopt-book-audio-backdrop [data-progress]")) return;
      event.stopImmediatePropagation();
      const start = activeSegment.startMs / 1000;
      const end = activeSegment.endMs != null ? activeSegment.endMs / 1000 : audio.duration;
      if (!Number.isFinite(end) || end <= start) return;
      audio.currentTime = start + (Number(target.value) / 1000) * (end - start);
      updateProgress();
      updateNowPlaying();
    };

    audio.addEventListener("timeupdate", () => {
      if (!active || !activeSegment) return;
      updateProgress();
      updateNowPlaying();
      if (scope === "page" && activeSegment.endMs != null && !transitioning && audio.currentTime * 1000 >= activeSegment.endMs - 15) {
        void advance();
      }
    });
    audio.addEventListener("ended", () => { if (active) void advance(); });
    audio.addEventListener("play", () => {
      if (active || transitioning) {
        if ("mediaSession" in navigator) navigator.mediaSession.playbackState = "playing";
        updateNowPlaying();
      }
    });
    audio.addEventListener("pause", () => {
      if (active && !audio.ended && "mediaSession" in navigator) navigator.mediaSession.playbackState = "paused";
    });

    // Load the small chapter-reciter list immediately so pressing Play does not have to wait for it.
    void loadChapterReciters();

    let observedOverlay: HTMLElement | null = null;
    let overlayObserver: MutationObserver | null = null;
    const attachOverlayObserver = () => {
      const overlay = document.querySelector<HTMLElement>(".wopt-book-audio-backdrop");
      if (!overlay || overlay === observedOverlay) return;
      overlayObserver?.disconnect();
      observedOverlay = overlay;
      overlayObserver = new MutationObserver(() => {
        if (overlay.classList.contains("open")) void primeCurrent();
      });
      overlayObserver.observe(overlay, { attributes: true, attributeFilter: ["class"] });
      if (overlay.classList.contains("open")) void primeCurrent();
    };
    const bodyObserver = new MutationObserver(attachOverlayObserver);
    bodyObserver.observe(document.body, { childList: true, subtree: true });
    attachOverlayObserver();

    document.addEventListener("click", onDocumentClick, true);
    document.addEventListener("change", onDocumentChange, true);
    document.addEventListener("input", onProgressInput, true);

    return () => {
      transitionId += 1;
      bodyObserver.disconnect();
      overlayObserver?.disconnect();
      document.removeEventListener("click", onDocumentClick, true);
      document.removeEventListener("change", onDocumentChange, true);
      document.removeEventListener("input", onProgressInput, true);
      audio.pause();
      audio.remove();
      document.querySelectorAll("link[data-wopt-quran-prefetch]").forEach((node) => node.remove());
      clearHighlight();
    };
  }, [pathname]);

  return null;
}
