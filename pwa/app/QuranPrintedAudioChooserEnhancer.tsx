"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const API = "https://api.quran.com/api/v4";
const AUDIO_CDN = "https://verses.quran.com/";
const RECITER_KEY = "wopt-quran-page-reciter";

type Reciter = { id: number; reciter_name?: string; style?: string };
type VerseAudio = { verse_key?: string; url?: string; audio_url?: string };
type Verse = { verse_key?: string; audio?: VerseAudio | null };
type QueueItem = { key: string; url: string };
type Scope = "ayah" | "page" | "surah" | "quran";
type Context = { key: string; surah: number; ayah: number; page: number; selected: boolean };

function absoluteAudio(raw?: string) {
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;
  return `${AUDIO_CDN}${raw.replace(/^\/+/, "")}`;
}

function inViewport(node: HTMLElement) {
  const rect = node.getBoundingClientRect();
  return rect.bottom > 70 && rect.top < window.innerHeight - 70;
}

function visiblePrintedPage() {
  const pages = Array.from(document.querySelectorAll<HTMLElement>(".wopt-printed-page-mode [data-printed-page]"));
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

function visibleVerse(pageNode?: HTMLElement | null) {
  const root: ParentNode = pageNode || document;
  const nodes = Array.from(root.querySelectorAll<HTMLElement>("[data-verse-key]"));
  if (!nodes.length) return null;
  const mid = window.innerHeight * 0.48;
  return nodes
    .map((node) => {
      const rect = node.getBoundingClientRect();
      const overlap = Math.max(0, Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0));
      return { node, overlap, distance: Math.abs((rect.top + rect.bottom) / 2 - mid) };
    })
    .sort((a, b) => (b.overlap - a.overlap) || (a.distance - b.distance))[0]?.node || null;
}

function currentContext(): Context {
  const pageNode = visiblePrintedPage();
  const printedPage = Number(pageNode?.dataset.printedPage || 0) || 0;

  const selectedCandidates = Array.from(document.querySelectorAll<HTMLElement>(".wopt-menu-selected[data-verse-key],.wopt-search-hit[data-verse-key]"));
  const selected = selectedCandidates.find((node) => {
    const nodePage = Number(node.dataset.page || node.closest<HTMLElement>("[data-printed-page]")?.dataset.printedPage || 0) || 0;
    if (printedPage && nodePage && nodePage !== printedPage) return false;
    return inViewport(node);
  }) || null;

  const visible = visibleVerse(pageNode);
  const node = selected || visible;
  const key = node?.dataset.verseKey || "1:1";
  const [surahRaw, ayahRaw] = key.split(":");
  const nodePage = Number(node?.dataset.page || node?.closest<HTMLElement>("[data-printed-page]")?.dataset.printedPage || 0) || 0;

  return {
    key,
    surah: Number(surahRaw) || 1,
    ayah: Number(ayahRaw) || 1,
    page: printedPage || nodePage || 1,
    selected: Boolean(selected),
  };
}

export default function QuranPrintedAudioChooserEnhancer() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname.endsWith("/quran") && !pathname.endsWith("/quran/")) return;

    const style = document.createElement("style");
    style.dataset.woptBookAudio = "true";
    style.textContent = `
      .wopt-book-audio-backdrop{position:fixed;z-index:4700;inset:0;display:none;align-items:flex-end;justify-content:center;padding:12px;background:rgba(0,0,0,.34);backdrop-filter:blur(3px)}
      .wopt-book-audio-backdrop.open{display:flex}
      .wopt-book-audio-sheet{width:min(650px,100%);max-height:86dvh;overflow:auto;background:#fff;color:#173d34;border-radius:24px;padding:18px;box-shadow:0 26px 80px rgba(0,0,0,.3);font-family:Arial,sans-serif}
      .wopt-book-audio-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}.wopt-book-audio-head small{display:block;color:#18806a;font-size:10px;font-weight:900;letter-spacing:.14em;text-transform:uppercase}.wopt-book-audio-head h2{margin:4px 0 0;font-size:23px}.wopt-book-audio-close{width:42px;height:42px;border:0;border-radius:50%;background:#f1f4f3;font-size:22px;color:#24483e}
      .wopt-book-audio-now{margin:14px 0;padding:12px 14px;border-radius:15px;background:#f2f8f6;color:#31564d;font-size:12px;line-height:1.5}.wopt-book-audio-now strong{display:block;color:#123f34;font-size:14px;margin-bottom:3px}
      .wopt-book-audio-label{display:block;margin:14px 0 7px;font-size:11px;font-weight:900;color:#52635e}.wopt-book-audio-select{width:100%;height:50px;border:1px solid #d6e2de;border-radius:14px;background:#fff;padding:0 13px;font-size:14px;color:#193e35}
      .wopt-book-audio-scopes{display:grid;grid-template-columns:1fr 1fr;gap:9px}.wopt-book-audio-scopes button{min-height:58px;border:1px solid #d8e5e1;border-radius:14px;background:#f8fbfa;color:#195d4e;font-weight:800;padding:9px}.wopt-book-audio-scopes button.active{background:#e3f5ef;border-color:#51b7a3;color:#0b6653}.wopt-book-audio-scopes button:disabled{opacity:.42}.wopt-book-audio-scopes button small{display:block;margin-top:3px;color:#75817e;font-size:10px;font-weight:500}
      .wopt-book-audio-controls{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-top:14px}.wopt-book-audio-controls button{height:48px;border:1px solid #d7e4df;border-radius:13px;background:#fff;color:#174d41;font-weight:900}.wopt-book-audio-controls button.primary{background:#0b6653;color:#fff;border-color:#0b6653}.wopt-book-audio-status{margin-top:11px;min-height:20px;color:#697773;font-size:11px;text-align:center}.wopt-book-audio-progress{display:grid;grid-template-columns:auto 1fr auto;gap:8px;align-items:center;margin-top:10px}.wopt-book-audio-progress span{font-size:10px;color:#6d7976}.wopt-book-audio-progress input{width:100%;accent-color:#0b6653}
      .wopt-page-audio-playing{background:rgba(48,169,143,.13)!important;box-shadow:0 0 0 4px rgba(48,169,143,.11)!important;border-radius:6px!important}
      @media(max-width:520px){.wopt-book-audio-sheet{padding:15px;border-radius:20px}.wopt-book-audio-head h2{font-size:20px}.wopt-book-audio-scopes button{min-height:54px;font-size:12px}.wopt-book-audio-controls button{font-size:12px}}
    `;
    document.head.appendChild(style);

    const overlay = document.createElement("div");
    overlay.className = "wopt-book-audio-backdrop";
    overlay.innerHTML = `
      <section class="wopt-book-audio-sheet" role="dialog" aria-modal="true" aria-label="Qur’an audio options">
        <div class="wopt-book-audio-head"><div><small>Qur’an audio</small><h2>Choose what to play</h2></div><button type="button" class="wopt-book-audio-close" aria-label="Close">×</button></div>
        <div class="wopt-book-audio-now"><strong data-audio-context>Current reading</strong><span data-audio-detail></span></div>
        <label class="wopt-book-audio-label" for="wopt-book-reciter">Reciter</label>
        <select id="wopt-book-reciter" class="wopt-book-audio-select"><option value="7">Loading reciters…</option></select>
        <span class="wopt-book-audio-label">Play</span>
        <div class="wopt-book-audio-scopes">
          <button type="button" data-scope="ayah">Selected ayah<small>Play one selected ayah</small></button>
          <button type="button" data-scope="page" class="active">Current page<small>Play this exact mushaf page</small></button>
          <button type="button" data-scope="surah">Current Surah<small>Play the Surah containing this page</small></button>
          <button type="button" data-scope="quran">Continue Qur’an<small>Continue from this ayah onward</small></button>
        </div>
        <div class="wopt-book-audio-controls"><button type="button" class="primary" data-audio-action="play">▶ Play</button><button type="button" data-audio-action="pause">❚❚ Pause</button><button type="button" data-audio-action="stop">■ Stop</button></div>
        <div class="wopt-book-audio-progress"><span data-elapsed>0:00</span><input type="range" min="0" max="1000" value="0" data-progress><span data-remaining>-0:00</span></div>
        <div class="wopt-book-audio-status" data-status>Choose a reciter and what you want to hear.</div>
      </section>`;
    document.body.appendChild(overlay);

    const audio = new Audio();
    audio.preload = "metadata";
    const reciterSelect = overlay.querySelector<HTMLSelectElement>("#wopt-book-reciter")!;
    const contextLabel = overlay.querySelector<HTMLElement>("[data-audio-context]")!;
    const detailLabel = overlay.querySelector<HTMLElement>("[data-audio-detail]")!;
    const status = overlay.querySelector<HTMLElement>("[data-status]")!;
    const progress = overlay.querySelector<HTMLInputElement>("[data-progress]")!;
    const elapsed = overlay.querySelector<HTMLElement>("[data-elapsed]")!;
    const remaining = overlay.querySelector<HTMLElement>("[data-remaining]")!;

    let reciters: Reciter[] = [];
    let scope: Scope = "page";
    let queue: QueueItem[] = [];
    let index = 0;
    let context = currentContext();
    let queueSignature = "";
    let building = false;

    const fmt = (seconds: number) => {
      if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
      const m = Math.floor(seconds / 60);
      const s = Math.floor(seconds % 60);
      return `${m}:${String(s).padStart(2, "0")}`;
    };

    const contextSignature = (ctx = context, useScope = scope) => `${ctx.key}|${ctx.page}|${ctx.surah}|${useScope}|${selectedReciter()}`;

    const clearHighlight = () => document.querySelectorAll(".wopt-page-audio-playing").forEach((node) => node.classList.remove("wopt-page-audio-playing"));
    const highlight = (key: string) => {
      clearHighlight();
      const nodes = Array.from(document.querySelectorAll<HTMLElement>(`[data-verse-key="${key}"]`));
      const node = nodes.find(inViewport) || nodes[0];
      if (!node) return;
      node.classList.add("wopt-page-audio-playing");
      const rect = node.getBoundingClientRect();
      if (rect.top < 90 || rect.bottom > window.innerHeight - 120) node.scrollIntoView({ behavior: "smooth", block: "center" });
    };

    const resetQueue = (resetAudio = true) => {
      queue = [];
      queueSignature = "";
      index = 0;
      if (resetAudio) {
        audio.pause();
        audio.removeAttribute("src");
        audio.load();
      }
      progress.value = "0";
      elapsed.textContent = "0:00";
      remaining.textContent = "-0:00";
      clearHighlight();
    };

    const selectedReciter = () => Number(reciterSelect.value || localStorage.getItem(RECITER_KEY) || 7) || 7;

    const updateContext = () => {
      const next = currentContext();
      const changed = next.key !== context.key || next.page !== context.page || next.surah !== context.surah;
      context = next;
      if (changed) resetQueue(true);
      contextLabel.textContent = context.selected ? `Selected ayah ${context.key}` : `Page ${context.page}`;
      detailLabel.textContent = `Surah ${context.surah} · Ayah ${context.ayah} · Page ${context.page}`;
      const ayahButton = overlay.querySelector<HTMLButtonElement>("[data-scope='ayah']");
      if (ayahButton) ayahButton.disabled = !context.selected;
      if (!context.selected && scope === "ayah") setScope("page");
    };

    const setScope = (next: Scope) => {
      if (scope !== next) resetQueue(true);
      scope = next;
      overlay.querySelectorAll<HTMLButtonElement>("[data-scope]").forEach((button) => button.classList.toggle("active", button.dataset.scope === next));
    };

    const verseQueueFromResponse = (verses: Verse[]) => verses
      .map((verse) => ({ key: verse.verse_key || "", url: absoluteAudio(verse.audio?.url || verse.audio?.audio_url) }))
      .filter((item) => item.key && item.url);

    const fetchPage = async (page: number, reciter: number) => {
      const response = await fetch(`${API}/verses/by_page/${page}?language=en&words=false&audio=${reciter}&fields=verse_key&page=1&per_page=50`);
      if (!response.ok) throw new Error("page audio");
      const data = await response.json() as { verses?: Verse[] };
      return verseQueueFromResponse(data.verses || []);
    };

    const fetchSurah = async (surah: number, reciter: number) => {
      const all: QueueItem[] = [];
      let page = 1;
      while (page <= 12) {
        const response = await fetch(`${API}/verses/by_chapter/${surah}?language=en&words=false&audio=${reciter}&fields=verse_key&page=${page}&per_page=50`);
        if (!response.ok) throw new Error("surah audio");
        const data = await response.json() as { verses?: Verse[]; pagination?: { total_pages?: number } };
        all.push(...verseQueueFromResponse(data.verses || []));
        const totalPages = Number(data.pagination?.total_pages || 1);
        if (page >= totalPages) break;
        page += 1;
      }
      return all;
    };

    const fetchAyah = async (key: string, reciter: number) => {
      const response = await fetch(`${API}/verses/by_key/${encodeURIComponent(key)}?language=en&words=false&audio=${reciter}&fields=verse_key`);
      if (!response.ok) throw new Error("ayah audio");
      const data = await response.json() as { verse?: Verse };
      return verseQueueFromResponse(data.verse ? [data.verse] : []);
    };

    const buildQueue = async () => {
      if (building) return [] as QueueItem[];
      building = true;
      status.textContent = `Loading audio for page ${context.page}…`;
      try {
        const reciter = selectedReciter();
        localStorage.setItem(RECITER_KEY, String(reciter));
        let next: QueueItem[] = [];
        if (scope === "ayah") next = await fetchAyah(context.key, reciter);
        else if (scope === "page") next = await fetchPage(context.page, reciter);
        else {
          const firstSurah = await fetchSurah(context.surah, reciter);
          if (scope === "surah") next = firstSurah;
          else {
            const start = firstSurah.findIndex((item) => item.key === context.key);
            next = firstSurah.slice(start >= 0 ? start : 0);
          }
        }
        queueSignature = contextSignature();
        return next;
      } finally {
        building = false;
      }
    };

    const stopLegacyPlayers = () => {
      const stopButton = document.querySelector<HTMLButtonElement>(".wopt-quran-player [data-player='stop']");
      stopButton?.click();
    };

    const playItem = async (at: number) => {
      if (!queue.length || at < 0 || at >= queue.length) return;
      index = at;
      const item = queue[index];
      highlight(item.key);
      status.textContent = `Playing ${item.key} · ${reciterSelect.options[reciterSelect.selectedIndex]?.text || "reciter"}`;
      if (audio.src !== item.url) audio.src = item.url;
      await audio.play();
    };

    const play = async () => {
      updateContext();
      stopLegacyPlayers();
      const sig = contextSignature();
      if (queue.length && queueSignature === sig && audio.src && audio.paused) {
        await audio.play();
        status.textContent = `Resumed ${queue[index]?.key || context.key}.`;
        return;
      }
      resetQueue(true);
      queue = await buildQueue();
      if (!queue.length) {
        status.textContent = `Audio could not be loaded for page ${context.page}.`;
        return;
      }
      await playItem(0);
    };

    const stop = () => {
      resetQueue(true);
      status.textContent = "Stopped.";
    };

    const loadReciters = async () => {
      try {
        const response = await fetch(`${API}/resources/recitations?language=en`);
        if (!response.ok) throw new Error("reciters");
        const data = await response.json() as { recitations?: Reciter[] };
        reciters = data.recitations || [];
        const saved = Number(localStorage.getItem(RECITER_KEY) || 7) || 7;
        reciterSelect.innerHTML = reciters.map((item) => `<option value="${item.id}">${item.reciter_name || `Reciter ${item.id}`}${item.style ? ` · ${item.style}` : ""}</option>`).join("");
        if (reciters.some((item) => item.id === saved)) reciterSelect.value = String(saved);
      } catch {
        reciterSelect.innerHTML = `<option value="7">Mishari Rashid al-` + `Afasy</option>`;
      }
    };

    const open = (preferred?: Scope) => {
      const before = context;
      updateContext();
      if (before.key !== context.key || before.page !== context.page) resetQueue(true);
      if (preferred) setScope(preferred);
      else setScope(context.selected ? "ayah" : "page");
      overlay.classList.add("open");
      if (!reciters.length) void loadReciters();
      status.textContent = `Ready for page ${context.page}, Surah ${context.surah}.`;
    };
    const close = () => overlay.classList.remove("open");

    const onDocumentClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      const audioButton = target.closest<HTMLElement>("[data-clean='audio']");
      const versePlay = target.closest<HTMLElement>(".wopt-verse-actions [data-action='play'], .wopt-verse-menu [data-action='play'], [data-verse-action='play']");
      if (!audioButton && !versePlay) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      open(versePlay ? "ayah" : undefined);
    };

    const onOverlayClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (target === overlay || target.closest(".wopt-book-audio-close")) { close(); return; }
      const scopeButton = target.closest<HTMLButtonElement>("[data-scope]");
      if (scopeButton && !scopeButton.disabled) { setScope(scopeButton.dataset.scope as Scope); return; }
      const action = target.closest<HTMLButtonElement>("[data-audio-action]")?.dataset.audioAction;
      if (action === "play") void play();
      if (action === "pause") { audio.pause(); status.textContent = "Paused."; }
      if (action === "stop") stop();
    };

    audio.addEventListener("ended", () => {
      if (index + 1 < queue.length) {
        void playItem(index + 1);
        return;
      }
      if (scope === "quran" && context.surah < 114) {
        context = { ...context, surah: context.surah + 1, ayah: 1, key: `${context.surah + 1}:1` };
        resetQueue(false);
        void buildQueue().then((next) => {
          queue = next;
          index = 0;
          if (queue.length) void playItem(0);
        });
        return;
      }
      status.textContent = "Finished.";
      clearHighlight();
    });

    audio.addEventListener("timeupdate", () => {
      if (!audio.duration || !Number.isFinite(audio.duration)) return;
      progress.value = String(Math.round((audio.currentTime / audio.duration) * 1000));
      elapsed.textContent = fmt(audio.currentTime);
      remaining.textContent = `-${fmt(Math.max(0, audio.duration - audio.currentTime))}`;
    });

    progress.addEventListener("input", () => {
      if (!audio.duration || !Number.isFinite(audio.duration)) return;
      audio.currentTime = (Number(progress.value) / 1000) * audio.duration;
    });

    reciterSelect.addEventListener("change", () => {
      localStorage.setItem(RECITER_KEY, reciterSelect.value);
      resetQueue(true);
      status.textContent = "Reciter changed. Press Play.";
    });

    document.addEventListener("click", onDocumentClick, true);
    overlay.addEventListener("click", onOverlayClick);
    void loadReciters();

    return () => {
      document.removeEventListener("click", onDocumentClick, true);
      overlay.removeEventListener("click", onOverlayClick);
      stop();
      overlay.remove();
      style.remove();
    };
  }, [pathname]);

  return null;
}
