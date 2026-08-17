"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const API = "https://api.quran.com/api/v4";
const RECITER_KEY = "wopt-quran-audio-reciter-v2";

type Scope = "ayah" | "page" | "surah" | "quran";
type Chapter = { id: number; name_simple?: string; name_arabic?: string; verses_count?: number };
type Reciter = { id: number; name?: string; reciter_name?: string; style?: string | { name?: string | null } };
type Timing = { verse_key: string; timestamp_from: number; timestamp_to: number };
type Stream = { surah: number; reciterId: number; url: string; timings: Timing[] };
type Context = { key: string; surah: number; ayah: number; page: number };
type Segment = { surah: number; startKey?: string; endKey?: string };
type OpenDetail = { key?: string; scope?: Scope };

function isQuranPath(pathname: string) {
  return pathname.endsWith("/quran") || pathname.endsWith("/quran/");
}

function escapeHtml(value = "") {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char] || char));
}

function parseKey(key = "1:1") {
  const [surahRaw, ayahRaw] = key.split(":");
  return { surah: Number(surahRaw) || 1, ayah: Number(ayahRaw) || 1 };
}

function formatTime(value: number) {
  if (!Number.isFinite(value) || value < 0) return "0:00";
  const hours = Math.floor(value / 3600);
  const minutes = Math.floor((value % 3600) / 60);
  const seconds = Math.floor(value % 60);
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
    : `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function isVisible(node: HTMLElement) {
  const style = window.getComputedStyle(node);
  if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity || 1) === 0) return false;
  const rect = node.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.top < window.innerHeight;
}

function visiblePrintedPage() {
  const pages = Array.from(document.querySelectorAll<HTMLElement>("[data-printed-page]"));
  if (!pages.length) return null;
  const target = window.innerHeight * 0.46;
  const visible = pages
    .map((node) => {
      const rect = node.getBoundingClientRect();
      const overlap = Math.max(0, Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0));
      const center = (Math.max(0, rect.top) + Math.min(window.innerHeight, rect.bottom)) / 2;
      return { node, overlap, distance: Math.abs(center - target) };
    })
    .filter((item) => item.overlap > 0)
    .sort((a, b) => (b.overlap - a.overlap) || (a.distance - b.distance));
  return visible[0]?.node || pages[0] || null;
}

function verseNodes(pageNode?: HTMLElement | null) {
  const root: ParentNode = pageNode || document;
  const nodes = Array.from(root.querySelectorAll<HTMLElement>("[data-verse-key]"));
  const seen = new Set<string>();
  return nodes.filter((node) => {
    const key = node.dataset.verseKey || "";
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function visibleVerse(pageNode?: HTMLElement | null) {
  const nodes = verseNodes(pageNode);
  if (!nodes.length) return null;
  const target = window.innerHeight * 0.46;
  return nodes
    .map((node) => {
      const rect = node.getBoundingClientRect();
      const overlap = Math.max(0, Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0));
      const center = (rect.top + rect.bottom) / 2;
      return { node, overlap, distance: Math.abs(center - target) };
    })
    .sort((a, b) => (b.overlap - a.overlap) || (a.distance - b.distance))[0]?.node || nodes[0] || null;
}

export default function QuranAudioSystem() {
  const pathname = usePathname();

  useEffect(() => {
    if (!isQuranPath(pathname)) return;

    document.querySelectorAll(".wopt-audio2-backdrop,.wopt-audio2-mini,.wopt-book-audio-backdrop,.wopt-active-quran-player,.wopt-audio-start-backdrop").forEach((node) => node.remove());
    document.querySelectorAll<HTMLAudioElement>("audio[data-wopt-quran-audio-system],audio[data-wopt-continuous-quran='true']").forEach((node) => { node.pause(); node.remove(); });

    const style = document.createElement("style");
    style.dataset.woptQuranAudioSystem = "true";
    style.textContent = `
      .wopt-ref-reciter-row{display:none!important}
      .wopt-qindex-action[data-quick="audio"]{opacity:.42!important;filter:grayscale(.25);cursor:not-allowed!important}
      .wopt-audio2-backdrop{position:fixed;z-index:5200;inset:0;display:none;align-items:flex-end;justify-content:center;padding:12px;background:rgba(12,27,22,.38);backdrop-filter:blur(5px)}
      .wopt-audio2-backdrop.open{display:flex}
      .wopt-audio2-sheet{width:min(650px,100%);max-height:86dvh;overflow:auto;border-radius:24px;background:#fff;color:#173f35;padding:18px;box-shadow:0 26px 80px rgba(0,0,0,.3);font-family:Arial,sans-serif}
      .wopt-audio2-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}.wopt-audio2-head small{display:block;color:#0c7a62;font-size:10px;font-weight:900;letter-spacing:.13em;text-transform:uppercase}.wopt-audio2-head h2{margin:4px 0 0;font-size:22px;letter-spacing:-.02em}.wopt-audio2-close{width:42px;height:42px;border:0;border-radius:50%;background:#f1f4f3;color:#24483e;font-size:22px;flex:0 0 auto}
      .wopt-audio2-now{margin:14px 0;padding:12px 14px;border-radius:15px;background:#f1f8f5;color:#44645b;font-size:12px;line-height:1.45}.wopt-audio2-now strong{display:block;margin-bottom:3px;color:#153f35;font-size:14px}
      .wopt-audio2-label{display:block;margin:14px 0 7px;color:#566760;font-size:11px;font-weight:900}.wopt-audio2-starts{display:grid;gap:8px}.wopt-audio2-start{width:100%;min-height:58px;border:1px solid #d7e4df;border-radius:15px;background:#fff;color:#174c40;padding:10px 12px;text-align:left}.wopt-audio2-start strong{display:block;font-size:13px}.wopt-audio2-start span{display:block;margin-top:3px;color:#74817d;font-size:10px;line-height:1.4}.wopt-audio2-start.active{border-color:#54b8a4;background:#e7f6f1}.wopt-audio2-section{margin:6px 2px 0;color:#61716c;font-size:10px;font-weight:900;text-transform:uppercase;letter-spacing:.06em}
      .wopt-audio2-select{width:100%;height:49px;border:1px solid #d5e1dd;border-radius:14px;background:#fff;padding:0 12px;color:#193f35;font-size:14px}
      .wopt-audio2-scopes{display:grid;grid-template-columns:1fr 1fr;gap:8px}.wopt-audio2-scopes button{min-height:58px;border:1px solid #d7e4df;border-radius:14px;background:#f9fbfa;color:#185d4e;padding:9px;font-weight:850}.wopt-audio2-scopes button span{display:block;margin-top:3px;color:#76817e;font-size:10px;font-weight:500}.wopt-audio2-scopes button.active{background:#e3f5ef;border-color:#50b6a2;color:#0a6652}
      .wopt-audio2-play{width:100%;height:50px;margin-top:14px;border:0;border-radius:14px;background:#0b6f59;color:#fff;font-size:14px;font-weight:900}.wopt-audio2-status{min-height:18px;margin-top:9px;color:#6d7975;font-size:10px;text-align:center}
      .wopt-audio2-mini{position:fixed;z-index:4550;left:50%;bottom:calc(env(safe-area-inset-bottom,0px) + 82px);transform:translateX(-50%) translateY(18px);width:min(650px,calc(100vw - 20px));display:none;grid-template-columns:minmax(0,1fr) auto;gap:8px 10px;align-items:center;padding:10px 11px;border:1px solid rgba(20,112,91,.18);border-radius:18px;background:rgba(255,255,255,.97);box-shadow:0 16px 46px rgba(17,61,50,.2);backdrop-filter:blur(16px);font-family:Arial,sans-serif;color:#174d41;opacity:0;transition:opacity .16s ease,transform .16s ease}.wopt-audio2-mini.show{display:grid;opacity:1;transform:translateX(-50%) translateY(0)}.wopt-audio2-mini.suppressed{display:none!important;opacity:0!important;pointer-events:none!important}
      .wopt-audio2-copy{min-width:0}.wopt-audio2-copy strong,.wopt-audio2-copy span{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.wopt-audio2-copy strong{font-size:12px}.wopt-audio2-copy span{margin-top:2px;color:#6d7a76;font-size:9px}.wopt-audio2-actions{display:flex;align-items:center;gap:4px}.wopt-audio2-actions button{height:34px;min-width:34px;border:1px solid #d9e4e0;border-radius:10px;background:#fff;color:#175949;font-size:10px;font-weight:900;padding:0 7px}.wopt-audio2-actions button.primary{background:#0b6f59;border-color:#0b6f59;color:#fff}.wopt-audio2-actions button.stop{color:#8a4037}.wopt-audio2-progress{grid-column:1/-1;display:grid;grid-template-columns:32px 1fr 38px;gap:6px;align-items:center}.wopt-audio2-progress span{color:#74807d;font-size:9px;text-align:center}.wopt-audio2-progress input{width:100%;accent-color:#0b6f59}
      .wopt-audio2-follow{box-decoration-break:clone;-webkit-box-decoration-break:clone;background:rgba(26,157,124,.18)!important;box-shadow:0 0 0 3px rgba(26,157,124,.12)!important;border-radius:6px!important;transition:background .12s ease,box-shadow .12s ease}
      .wopt-audio2-follow .quran-word{background:rgba(26,157,124,.12)!important;border-radius:5px!important}
      .wopt-audio2-follow .ayah-marker,.wopt-audio2-follow.wopt-printed-marker{background:#147a64!important;border-color:#147a64!important;color:#fff!important}
      @media(max-width:520px){.wopt-audio2-backdrop{padding:0}.wopt-audio2-sheet{max-height:88dvh;border-radius:24px 24px 0 0;padding:15px}.wopt-audio2-head h2{font-size:20px}.wopt-audio2-mini{bottom:calc(env(safe-area-inset-bottom,0px) + 78px);padding:9px}.wopt-audio2-actions button{min-width:32px;height:32px;padding:0 6px}.wopt-audio2-actions .audio-label{display:none}}
    `;
    document.head.appendChild(style);

    const overlay = document.createElement("div");
    overlay.className = "wopt-audio2-backdrop";
    overlay.innerHTML = `
      <section class="wopt-audio2-sheet" role="dialog" aria-modal="true" aria-label="Qur’an audio">
        <div class="wopt-audio2-head"><div><small>Qur’an audio</small><h2>Listen</h2></div><button class="wopt-audio2-close" type="button" aria-label="Close">×</button></div>
        <div class="wopt-audio2-now"><strong data-audio2-context>Current reading</strong><span data-audio2-detail></span></div>
        <span class="wopt-audio2-label">Where should playback start?</span>
        <div class="wopt-audio2-starts" data-audio2-starts></div>
        <label class="wopt-audio2-label" for="wopt-audio2-reciter">Reciter</label>
        <select class="wopt-audio2-select" id="wopt-audio2-reciter"><option>Loading reciters…</option></select>
        <span class="wopt-audio2-label">Play mode</span>
        <div class="wopt-audio2-scopes">
          <button type="button" data-audio2-scope="ayah">Selected ayah<span>Play one ayah only</span></button>
          <button type="button" data-audio2-scope="page">Current page<span>Play this mushaf page</span></button>
          <button type="button" data-audio2-scope="surah">Current Surah<span>Full Surah from ayah 1</span></button>
          <button type="button" data-audio2-scope="quran">Continue Qur’an<span>Continue from chosen start point</span></button>
        </div>
        <button class="wopt-audio2-play" type="button" data-audio2-play>▶ Play</button>
        <div class="wopt-audio2-status" data-audio2-status>Choose where to begin.</div>
      </section>`;
    document.body.appendChild(overlay);

    const mini = document.createElement("section");
    mini.className = "wopt-audio2-mini";
    mini.setAttribute("aria-label", "Qur’an audio player");
    mini.innerHTML = `
      <div class="wopt-audio2-copy"><strong data-audio2-mini-title>Qur’an audio</strong><span data-audio2-mini-detail>Ready</span></div>
      <div class="wopt-audio2-actions">
        <button type="button" data-audio2-action="back" aria-label="Back 10 seconds">−10</button>
        <button type="button" class="primary" data-audio2-action="toggle" aria-label="Pause">❚❚</button>
        <button type="button" data-audio2-action="forward" aria-label="Forward 10 seconds">+10</button>
        <button type="button" data-audio2-action="options" aria-label="Audio options">☰ <span class="audio-label">Audio</span></button>
        <button type="button" class="stop" data-audio2-action="stop" aria-label="Stop">■</button>
      </div>
      <div class="wopt-audio2-progress"><span data-audio2-elapsed>0:00</span><input type="range" min="0" max="1000" value="0" data-audio2-progress aria-label="Audio progress"><span data-audio2-remaining>-0:00</span></div>`;
    document.body.appendChild(mini);

    const audio = document.createElement("audio");
    audio.preload = "auto";
    audio.setAttribute("playsinline", "true");
    audio.dataset.woptQuranAudioSystem = "true";
    audio.style.display = "none";
    document.body.appendChild(audio);

    const contextTitle = overlay.querySelector<HTMLElement>("[data-audio2-context]")!;
    const contextDetail = overlay.querySelector<HTMLElement>("[data-audio2-detail]")!;
    const startsBox = overlay.querySelector<HTMLElement>("[data-audio2-starts]")!;
    const reciterSelect = overlay.querySelector<HTMLSelectElement>("#wopt-audio2-reciter")!;
    const status = overlay.querySelector<HTMLElement>("[data-audio2-status]")!;
    const miniTitle = mini.querySelector<HTMLElement>("[data-audio2-mini-title]")!;
    const miniDetail = mini.querySelector<HTMLElement>("[data-audio2-mini-detail]")!;
    const miniToggle = mini.querySelector<HTMLButtonElement>("[data-audio2-action='toggle']")!;
    const miniProgress = mini.querySelector<HTMLInputElement>("[data-audio2-progress]")!;
    const miniElapsed = mini.querySelector<HTMLElement>("[data-audio2-elapsed]")!;
    const miniRemaining = mini.querySelector<HTMLElement>("[data-audio2-remaining]")!;

    let chapters = new Map<number, Chapter>();
    let reciters: Reciter[] = [];
    let context: Context = { key: "1:1", surah: 1, ayah: 1, page: 1 };
    let scope: Scope = "page";
    let selectedStartId = "page";
    let currentPageKeys: string[] = [];
    let plan: Segment[] = [];
    let planIndex = 0;
    let activeSegment: { descriptor: Segment; stream: Stream; start: number; end?: number } | null = null;
    let active = false;
    let advancing = false;
    let playToken = 0;
    let lastKey = "";
    let lastPage = 0;
    let nextWarmKey = "";
    let modalSyncFrame = 0;
    let highlightFrame = 0;
    const streamCache = new Map<string, Promise<Stream>>();
    const versePageCache = new Map<string, number>();

    const chapterName = (id: number) => chapters.get(id)?.name_simple || `Surah ${id}`;
    const reciterName = () => reciterSelect.selectedOptions[0]?.textContent?.trim() || "Qur’an reciter";
    const selectedReciter = () => Number(reciterSelect.value || 0) || reciters[0]?.id || 1;

    const visibleForeignDialog = () => {
      const dialogs = Array.from(document.querySelectorAll<HTMLElement>("[role='dialog'][aria-modal='true']"));
      return dialogs.some((dialog) => {
        if (dialog === overlay.querySelector(".wopt-audio2-sheet")) return overlay.classList.contains("open");
        const backdrop = dialog.parentElement;
        if (backdrop?.classList.contains("open")) return true;
        return isVisible(dialog);
      });
    };

    const syncMiniVisibility = () => {
      const shouldSuppress = active && visibleForeignDialog();
      mini.classList.toggle("suppressed", shouldSuppress);
      mini.classList.toggle("show", active && !shouldSuppress);
    };

    const scheduleMiniVisibilitySync = () => {
      if (modalSyncFrame) return;
      modalSyncFrame = window.requestAnimationFrame(() => {
        modalSyncFrame = 0;
        syncMiniVisibility();
      });
    };

    const setScope = (next: Scope) => {
      scope = next;
      overlay.querySelectorAll<HTMLButtonElement>("[data-audio2-scope]").forEach((button) => button.classList.toggle("active", button.dataset.audio2Scope === next));
      updateContextLabels();
    };

    const updateContextLabels = () => {
      contextTitle.textContent = `${chapterName(context.surah)} · ${context.key}`;
      contextDetail.textContent = `Page ${context.page} · ${scope === "surah" ? "Full Surah" : scope === "quran" ? "Continue Qur’an" : scope === "page" ? "Current page" : "Selected ayah"}`;
    };

    const loadResources = async () => {
      if (!chapters.size) {
        try {
          const response = await fetch(`${API}/chapters?language=en`);
          if (response.ok) {
            const data = await response.json() as { chapters?: Chapter[] };
            chapters = new Map((data.chapters || []).map((chapter) => [chapter.id, chapter]));
          }
        } catch { /* numeric labels remain usable */ }
      }
      if (!reciters.length) {
        try {
          const response = await fetch(`${API}/resources/chapter_reciters?language=en`);
          if (response.ok) {
            const data = await response.json() as { reciters?: Reciter[] };
            reciters = data.reciters || [];
          }
        } catch { /* fallback below */ }
        if (!reciters.length) reciters = [{ id: 7, name: "Mishari Rashid al-`Afasy" }];
        const stored = Number(localStorage.getItem(RECITER_KEY) || 0);
        const afasy = reciters.find((item) => /mish|afasy/i.test(item.name || item.reciter_name || ""));
        const chosen = reciters.find((item) => item.id === stored) || afasy || reciters[0];
        reciterSelect.innerHTML = reciters.map((item) => {
          const name = item.name || item.reciter_name || `Reciter ${item.id}`;
          const styleName = typeof item.style === "string" ? item.style : item.style?.name || "";
          return `<option value="${item.id}">${escapeHtml(name)}${styleName ? ` · ${escapeHtml(styleName)}` : ""}</option>`;
        }).join("");
        reciterSelect.value = String(chosen.id);
      }
    };

    const pageForKey = async (key: string) => {
      const cached = versePageCache.get(key);
      if (cached) return cached;
      const localNodes = Array.from(document.querySelectorAll<HTMLElement>(`[data-verse-key="${key}"]`));
      const local = localNodes.find((node) => node.closest(".wopt-printed-reader")) || localNodes[0];
      const localPage = Number(local?.dataset.page || local?.closest<HTMLElement>("[data-printed-page]")?.dataset.printedPage || 0);
      if (localPage) { versePageCache.set(key, localPage); return localPage; }
      try {
        const response = await fetch(`${API}/verses/by_key/${encodeURIComponent(key)}?language=en&words=false&fields=page_number`);
        if (!response.ok) return 0;
        const data = await response.json() as { verse?: { page_number?: number } };
        const page = Number(data.verse?.page_number || 0);
        if (page) versePageCache.set(key, page);
        return page;
      } catch { return 0; }
    };

    const pageKeys = async (page: number) => {
      const roots = Array.from(document.querySelectorAll<HTMLElement>(`[data-printed-page="${page}"]`));
      const visibleRoot = roots.find(isVisible) || roots[0] || null;
      const dom = verseNodes(visibleRoot).map((node) => node.dataset.verseKey || "").filter(Boolean);
      if (dom.length) return dom;
      try {
        const response = await fetch(`${API}/verses/by_page/${page}?language=en&words=false&page=1&per_page=50`);
        if (!response.ok) return [] as string[];
        const data = await response.json() as { verses?: Array<{ verse_key?: string }> };
        return (data.verses || []).map((verse) => verse.verse_key || "").filter(Boolean);
      } catch { return [] as string[]; }
    };

    const renderStartChoices = async () => {
      const pageNode = visiblePrintedPage();
      const visible = visibleVerse(pageNode);
      const page = Number(pageNode?.dataset.printedPage || visible?.dataset.page || context.page || 1) || 1;
      currentPageKeys = await pageKeys(page);
      if (!currentPageKeys.length && visible?.dataset.verseKey) currentPageKeys = [visible.dataset.verseKey];
      const visibleKey = visible?.dataset.verseKey || currentPageKeys[0] || context.key;
      const firstKey = currentPageKeys[0] || visibleKey;
      const surahs = Array.from(new Set(currentPageKeys.map((key) => parseKey(key).surah)));
      const rows: string[] = [
        `<button class="wopt-audio2-start ${selectedStartId === "page" ? "active" : ""}" type="button" data-audio2-start="page" data-key="${firstKey}" data-page="${page}"><strong>Top of Page ${page}</strong><span>Start at ${firstKey} and play this mushaf page.</span></button>`,
        `<button class="wopt-audio2-start ${selectedStartId === "visible" ? "active" : ""}" type="button" data-audio2-start="visible" data-key="${visibleKey}" data-page="${page}"><strong>Ayah I’m viewing</strong><span>Start exactly from ${visibleKey}.</span></button>`,
      ];
      rows.push(`<div class="wopt-audio2-section">${surahs.length > 1 ? "Surahs on this page" : "Surah on this page"}</div>`);
      surahs.forEach((surah) => {
        const key = `${surah}:1`;
        rows.push(`<button class="wopt-audio2-start ${selectedStartId === `surah-${surah}` ? "active" : ""}" type="button" data-audio2-start="surah" data-surah="${surah}" data-key="${key}" data-page="${page}"><strong>${escapeHtml(chapterName(surah))} · ${escapeHtml(chapters.get(surah)?.name_arabic || "")}</strong><span>Start the full Surah from ayah 1.</span></button>`);
      });
      startsBox.innerHTML = rows.join("");
    };

    const contextFromKey = async (key: string, fallbackPage = 1) => {
      const { surah, ayah } = parseKey(key);
      const page = await pageForKey(key) || fallbackPage;
      return { key, surah, ayah, page } as Context;
    };

    const open = async (detail?: OpenDetail) => {
      await loadResources();
      if (detail?.key) {
        context = await contextFromKey(detail.key, context.page);
        scope = detail.scope || "ayah";
        selectedStartId = "external";
      } else if (active && lastKey) {
        context = await contextFromKey(lastKey, context.page);
        selectedStartId = "visible";
      } else {
        const pageNode = visiblePrintedPage();
        const verse = visibleVerse(pageNode);
        const key = verse?.dataset.verseKey || "1:1";
        const page = Number(pageNode?.dataset.printedPage || verse?.dataset.page || 1) || 1;
        context = await contextFromKey(key, page);
        scope = "page";
        selectedStartId = "page";
      }
      await renderStartChoices();
      setScope(scope);
      status.textContent = active ? `Playing ${lastKey || context.key} · ${reciterName()}` : "Choose where to begin.";
      overlay.classList.add("open");
      scheduleMiniVisibilitySync();
    };

    const close = () => {
      overlay.classList.remove("open");
      scheduleMiniVisibilitySync();
    };

    const fetchStream = (reciterId: number, surah: number) => {
      const cacheKey = `${reciterId}:${surah}`;
      const cached = streamCache.get(cacheKey);
      if (cached) return cached;
      const request = fetch(`${API}/chapter_recitations/${reciterId}/${surah}?segments=true`)
        .then(async (response) => {
          if (!response.ok) throw new Error(`audio ${response.status}`);
          const data = await response.json() as { audio_file?: { audio_url?: string; timestamps?: Array<{ verse_key?: string; timestamp_from?: number; timestamp_to?: number }> } };
          const file = data.audio_file;
          if (!file?.audio_url) throw new Error("missing audio url");
          const timings = (file.timestamps || [])
            .filter((item): item is { verse_key: string; timestamp_from: number; timestamp_to: number } => Boolean(item.verse_key) && Number.isFinite(item.timestamp_from) && Number.isFinite(item.timestamp_to))
            .map((item) => ({ verse_key: item.verse_key, timestamp_from: item.timestamp_from, timestamp_to: item.timestamp_to }));
          return { surah, reciterId, url: file.audio_url, timings } as Stream;
        });
      streamCache.set(cacheKey, request);
      request.catch(() => streamCache.delete(cacheKey));
      return request;
    };

    const timingFor = (stream: Stream, key?: string) => key ? stream.timings.find((item) => item.verse_key === key) : undefined;

    const buildPlan = async () => {
      if (scope === "ayah") return [{ surah: context.surah, startKey: context.key, endKey: context.key }] as Segment[];
      if (scope === "surah") return [{ surah: context.surah }] as Segment[];
      if (scope === "quran") {
        const segments: Segment[] = [{ surah: context.surah, startKey: context.key }];
        for (let surah = context.surah + 1; surah <= 114; surah += 1) segments.push({ surah });
        return segments;
      }
      const keys = currentPageKeys.length ? currentPageKeys : await pageKeys(context.page);
      const segments: Segment[] = [];
      keys.forEach((key) => {
        const surah = parseKey(key).surah;
        const last = segments[segments.length - 1];
        if (!last || last.surah !== surah) segments.push({ surah, startKey: key, endKey: key });
        else last.endKey = key;
      });
      return segments.length ? segments : [{ surah: context.surah, startKey: context.key, endKey: context.key }];
    };

    const waitForMedia = (token: number) => new Promise<void>((resolve, reject) => {
      if (token !== playToken) { reject(new Error("cancelled")); return; }
      if (audio.readyState >= 2) { resolve(); return; }
      const timer = window.setTimeout(() => { cleanup(); reject(new Error("Audio took too long to load.")); }, 12000);
      const ready = () => { cleanup(); resolve(); };
      const fail = () => { cleanup(); reject(new Error("Audio could not be loaded.")); };
      const cleanup = () => { window.clearTimeout(timer); audio.removeEventListener("canplay", ready); audio.removeEventListener("error", fail); };
      audio.addEventListener("canplay", ready, { once: true });
      audio.addEventListener("error", fail, { once: true });
    });

    const clearHighlight = () => {
      document.querySelectorAll<HTMLElement>("[data-wopt-audio-highlight='true']").forEach((node) => {
        node.classList.remove("wopt-audio2-follow");
        node.removeAttribute("data-wopt-audio-highlight");
        node.style.removeProperty("background-color");
        node.style.removeProperty("box-shadow");
        node.style.removeProperty("border-radius");
      });
      document.querySelectorAll<HTMLElement>("[data-wopt-audio-highlight-child='true']").forEach((node) => {
        node.removeAttribute("data-wopt-audio-highlight-child");
        node.style.removeProperty("background-color");
        node.style.removeProperty("border-color");
        node.style.removeProperty("border-radius");
        node.style.removeProperty("color");
      });
    };

    const paintHighlight = (target: HTMLElement) => {
      target.classList.add("wopt-audio2-follow");
      target.dataset.woptAudioHighlight = "true";
      target.style.setProperty("background-color", "rgba(24, 156, 122, .24)", "important");
      target.style.setProperty("box-shadow", "0 0 0 4px rgba(24, 156, 122, .14)", "important");
      target.style.setProperty("border-radius", "7px", "important");
      target.querySelectorAll<HTMLElement>(".quran-word").forEach((word) => {
        word.dataset.woptAudioHighlightChild = "true";
        word.style.setProperty("background-color", "rgba(24, 156, 122, .18)", "important");
        word.style.setProperty("border-radius", "5px", "important");
      });
      target.querySelectorAll<HTMLElement>(".ayah-marker,.wopt-printed-marker").forEach((marker) => {
        marker.dataset.woptAudioHighlightChild = "true";
        marker.style.setProperty("background-color", "#147a64", "important");
        marker.style.setProperty("border-color", "#147a64", "important");
        marker.style.setProperty("color", "#fff", "important");
      });
    };

    const nodesForKey = (key: string) => Array.from(document.querySelectorAll<HTMLElement>(`[data-verse-key="${key}"]`));

    const bestNode = (key: string) => {
      const nodes = nodesForKey(key);
      const ranked = nodes.map((node) => {
        const rect = node.getBoundingClientRect();
        const visible = isVisible(node);
        const printed = Boolean(node.closest(".wopt-printed-reader"));
        const overlap = Math.max(0, Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0));
        const centerDistance = Math.abs((rect.top + rect.bottom) / 2 - window.innerHeight * .46);
        return { node, visible, printed, overlap, centerDistance };
      }).sort((a, b) => Number(b.visible) - Number(a.visible) || Number(b.printed) - Number(a.printed) || b.overlap - a.overlap || a.centerDistance - b.centerDistance);
      return ranked[0]?.node || null;
    };

    const highlightAndFollow = async (key: string) => {
      if (!key) return;
      const keyChanged = key !== lastKey;
      if (keyChanged) {
        lastKey = key;
        clearHighlight();
      }

      let node = bestNode(key);
      let page = Number(node?.dataset.page || node?.closest<HTMLElement>("[data-printed-page]")?.dataset.printedPage || 0) || await pageForKey(key);
      if (!node && page) {
        window.dispatchEvent(new CustomEvent("wopt-quran-book-mode", { detail: { enabled: true, page } }));
        const started = Date.now();
        while (!node && Date.now() - started < 3200) {
          await new Promise((resolve) => window.setTimeout(resolve, 80));
          node = bestNode(key);
        }
      }
      if (!node) return;

      page = Number(node.dataset.page || node.closest<HTMLElement>("[data-printed-page]")?.dataset.printedPage || page || 0);
      const visibleMatches = nodesForKey(key).filter(isVisible);
      const targets = visibleMatches.length ? visibleMatches : [node];
      targets.forEach(paintHighlight);

      const followNode = targets.find(isVisible) || node;
      const rect = followNode.getBoundingClientRect();
      const upper = window.innerHeight * .23;
      const lower = window.innerHeight * .63;
      if (keyChanged && (page !== lastPage || rect.top < upper || rect.bottom > lower)) {
        followNode.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
      }
      lastPage = page || lastPage;
    };

    const scheduleHighlightRefresh = () => {
      if (!active || !lastKey || highlightFrame) return;
      highlightFrame = window.requestAnimationFrame(() => {
        highlightFrame = 0;
        if (active && lastKey) void highlightAndFollow(lastKey);
      });
    };

    const currentTiming = () => {
      if (!activeSegment?.stream.timings.length) return undefined;
      const ms = audio.currentTime * 1000;
      return activeSegment.stream.timings.find((item) => ms >= item.timestamp_from && ms < item.timestamp_to)
        || [...activeSegment.stream.timings].reverse().find((item) => ms >= item.timestamp_from)
        || activeSegment.stream.timings[0];
    };

    const updateMediaSession = (key = lastKey || context.key) => {
      if (!("mediaSession" in navigator)) return;
      try {
        const base = pathname.replace(/\/quran\/?$/, "");
        navigator.mediaSession.metadata = new MediaMetadata({
          title: `${chapterName(parseKey(key).surah)} · Ayah ${key}`,
          artist: reciterName(),
          album: "Hassoun",
          artwork: [{ src: `${window.location.origin}${base}/icon-512.png`, sizes: "512x512", type: "image/png" }],
        });
        navigator.mediaSession.playbackState = audio.paused ? "paused" : "playing";
        if (Number.isFinite(audio.duration) && audio.duration > 0) {
          navigator.mediaSession.setPositionState({ duration: audio.duration, playbackRate: audio.playbackRate || 1, position: Math.max(0, Math.min(audio.currentTime || 0, audio.duration)) });
        }
      } catch { /* browser may reject transient position state */ }
    };

    const updateMini = () => {
      if (!active || !activeSegment) return;
      const timing = currentTiming();
      const key = timing?.verse_key || activeSegment.descriptor.startKey || `${activeSegment.descriptor.surah}:1`;
      miniTitle.textContent = `${chapterName(parseKey(key).surah)} · ${key}`;
      miniDetail.textContent = `${reciterName()}${audio.paused ? " · Paused" : ""}`;
      miniToggle.textContent = audio.paused ? "▶" : "❚❚";
      miniToggle.setAttribute("aria-label", audio.paused ? "Play" : "Pause");
      const start = activeSegment.start;
      const end = activeSegment.end ?? (Number.isFinite(audio.duration) ? audio.duration : start);
      const position = Math.max(start, Math.min(audio.currentTime || start, end));
      const duration = Math.max(0, end - start);
      const elapsed = Math.max(0, position - start);
      miniProgress.value = duration > 0 ? String(Math.round((elapsed / duration) * 1000)) : "0";
      miniElapsed.textContent = formatTime(elapsed);
      miniRemaining.textContent = `-${formatTime(Math.max(0, duration - elapsed))}`;
      void highlightAndFollow(key);
      updateMediaSession(key);
      syncMiniVisibility();
    };

    const warmNext = () => {
      const next = plan[planIndex + 1];
      if (!next) return;
      const key = `${selectedReciter()}:${next.surah}`;
      if (key === nextWarmKey) return;
      nextWarmKey = key;
      void fetchStream(selectedReciter(), next.surah).catch(() => undefined);
    };

    const playSegment = async (index: number, token: number) => {
      if (token !== playToken || index < 0 || index >= plan.length) return;
      advancing = true;
      planIndex = index;
      const descriptor = plan[index];
      status.textContent = `Preparing ${chapterName(descriptor.surah)}…`;
      const stream = await fetchStream(selectedReciter(), descriptor.surah);
      if (token !== playToken) return;
      const startTiming = timingFor(stream, descriptor.startKey);
      const endTiming = timingFor(stream, descriptor.endKey);
      const start = (startTiming?.timestamp_from || 0) / 1000;
      const end = endTiming ? endTiming.timestamp_to / 1000 : undefined;
      activeSegment = { descriptor, stream, start, end };
      audio.src = stream.url;
      audio.load();
      await waitForMedia(token);
      if (token !== playToken) return;
      if (start > 0) audio.currentTime = Math.min(start, Math.max(0, audio.duration - .05));
      active = true;
      close();
      try { await audio.play(); }
      catch { status.textContent = "Tap Play again to allow audio on this device."; miniDetail.textContent = "Tap ▶ to start"; }
      advancing = false;
      warmNext();
      updateMini();
    };

    const advance = async () => {
      if (!active || advancing) return;
      if (planIndex + 1 >= plan.length) {
        active = false;
        audio.pause();
        syncMiniVisibility();
        clearHighlight();
        status.textContent = "Finished.";
        return;
      }
      await playSegment(planIndex + 1, playToken).catch((error: unknown) => {
        status.textContent = error instanceof Error ? error.message : "Unable to continue audio.";
      });
    };

    const stop = () => {
      playToken += 1;
      active = false;
      advancing = false;
      plan = [];
      planIndex = 0;
      activeSegment = null;
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
      mini.classList.remove("show", "suppressed");
      clearHighlight();
      lastKey = "";
      lastPage = 0;
      status.textContent = "Stopped.";
      if ("mediaSession" in navigator) {
        try { navigator.mediaSession.playbackState = "none"; } catch { /* ignore */ }
      }
    };

    const startPlayback = async () => {
      await loadResources();
      localStorage.setItem(RECITER_KEY, String(selectedReciter()));
      status.textContent = "Preparing continuous recitation…";
      playToken += 1;
      const token = playToken;
      plan = await buildPlan();
      planIndex = 0;
      lastKey = "";
      lastPage = 0;
      clearHighlight();
      if (!plan.length) { status.textContent = "No audio is available for this selection."; return; }
      await playSegment(0, token).catch((error: unknown) => {
        active = false;
        syncMiniVisibility();
        status.textContent = error instanceof Error ? error.message : "Unable to start audio.";
      });
    };

    const seekRelative = (seconds: number) => {
      if (!activeSegment) return;
      const start = activeSegment.start;
      const end = activeSegment.end ?? (Number.isFinite(audio.duration) ? audio.duration : start);
      audio.currentTime = Math.max(start, Math.min(end, audio.currentTime + seconds));
      updateMini();
    };

    const seekVerse = (direction: -1 | 1) => {
      if (!activeSegment?.stream.timings.length) return;
      const timings = activeSegment.stream.timings;
      const current = currentTiming();
      const at = Math.max(0, timings.findIndex((item) => item.verse_key === current?.verse_key));
      const next = timings[Math.max(0, Math.min(timings.length - 1, at + direction))];
      if (next) {
        audio.currentTime = next.timestamp_from / 1000;
        updateMini();
      }
    };

    const installMediaHandlers = () => {
      if (!("mediaSession" in navigator)) return;
      const safe = (action: MediaSessionAction, handler: MediaSessionActionHandler | null) => {
        try { navigator.mediaSession.setActionHandler(action, handler); } catch { /* unsupported */ }
      };
      safe("play", () => void audio.play());
      safe("pause", () => audio.pause());
      safe("stop", stop);
      safe("seekbackward", (detail) => seekRelative(-(detail.seekOffset || 10)));
      safe("seekforward", (detail) => seekRelative(detail.seekOffset || 10));
      safe("seekto", (detail) => { if (typeof detail.seekTime === "number") { audio.currentTime = Math.max(0, Math.min(audio.duration || detail.seekTime, detail.seekTime)); updateMini(); } });
      safe("previoustrack", () => seekVerse(-1));
      safe("nexttrack", () => seekVerse(1));
    };

    const chooseStart = async (button: HTMLButtonElement) => {
      const kind = button.dataset.audio2Start || "page";
      const key = button.dataset.key || context.key;
      const page = Number(button.dataset.page || context.page) || context.page;
      if (kind === "surah") {
        const surah = Number(button.dataset.surah || parseKey(key).surah) || 1;
        context = { key: `${surah}:1`, surah, ayah: 1, page: await pageForKey(`${surah}:1`) || page };
        selectedStartId = `surah-${surah}`;
        setScope("surah");
      } else {
        context = await contextFromKey(key, page);
        selectedStartId = kind;
        setScope(kind === "page" ? "page" : "quran");
      }
      await renderStartChoices();
      updateContextLabels();
    };

    const onOverlayClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (target === overlay || target.closest(".wopt-audio2-close")) { close(); return; }
      const startButton = target.closest<HTMLButtonElement>("[data-audio2-start]");
      if (startButton) { void chooseStart(startButton); return; }
      const scopeButton = target.closest<HTMLButtonElement>("[data-audio2-scope]");
      if (scopeButton) { setScope(scopeButton.dataset.audio2Scope as Scope); return; }
      if (target.closest("[data-audio2-play]")) void startPlayback();
    };

    const onMiniClick = (event: MouseEvent) => {
      const button = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-audio2-action]");
      if (!button) return;
      const action = button.dataset.audio2Action;
      if (action === "toggle") { if (audio.paused) void audio.play(); else audio.pause(); }
      if (action === "back") seekRelative(-10);
      if (action === "forward") seekRelative(10);
      if (action === "stop") stop();
      if (action === "options") void open();
    };

    const onMiniProgress = () => {
      if (!activeSegment) return;
      const start = activeSegment.start;
      const end = activeSegment.end ?? (Number.isFinite(audio.duration) ? audio.duration : start);
      const duration = Math.max(0, end - start);
      audio.currentTime = start + (Number(miniProgress.value || 0) / 1000) * duration;
      updateMini();
    };

    const onDocumentClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      const toolbarAudio = target.closest(".wopt-clean-toolbar [data-clean='play']");
      if (toolbarAudio) {
        event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation();
        void open();
        return;
      }
      const versePlay = target.closest(".wopt-verse-menu [data-vm='play']");
      if (versePlay) {
        const selected = document.querySelector<HTMLElement>(".wopt-menu-selected[data-verse-key]");
        const key = selected?.dataset.verseKey || "";
        if (!key) return;
        event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation();
        document.querySelector<HTMLElement>(".wopt-verse-menu")?.classList.remove("open");
        void open({ key, scope: "ayah" });
        return;
      }
      const indexAudio = target.closest(".wopt-qindex-action[data-quick='audio']");
      if (indexAudio) {
        event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation();
      }
      window.setTimeout(scheduleMiniVisibilitySync, 0);
    };

    const disableIndexAudio = () => {
      document.querySelectorAll<HTMLButtonElement>(".wopt-qindex-action[data-quick='audio']").forEach((button) => {
        button.disabled = true;
        button.setAttribute("aria-disabled", "true");
        button.title = "Listen from the index will be enabled later";
      });
    };

    const onExternalOpen = (event: Event) => {
      const detail = (event as CustomEvent<OpenDetail>).detail || {};
      void open(detail);
    };

    const onTime = () => {
      if (!active || !activeSegment) return;
      if (activeSegment.end != null && audio.currentTime >= activeSegment.end - .05) { void advance(); return; }
      updateMini();
    };

    const onPlay = () => { if (active) { close(); updateMini(); syncMiniVisibility(); } };
    const onPause = () => updateMini();
    const onEnded = () => void advance();
    const onError = () => { if (active) miniDetail.textContent = "Audio connection interrupted"; };

    reciterSelect.addEventListener("change", () => localStorage.setItem(RECITER_KEY, reciterSelect.value));
    overlay.addEventListener("click", onOverlayClick);
    mini.addEventListener("click", onMiniClick);
    miniProgress.addEventListener("input", onMiniProgress);
    document.addEventListener("click", onDocumentClick, true);
    window.addEventListener("wopt-quran-audio-open", onExternalOpen);
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("playing", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("error", onError);
    installMediaHandlers();
    disableIndexAudio();

    const observer = new MutationObserver((mutations) => {
      disableIndexAudio();
      scheduleMiniVisibilitySync();
      if (!active || !lastKey) return;
      const relevant = mutations.some((mutation) => mutation.type === "childList" && (mutation.addedNodes.length > 0 || mutation.removedNodes.length > 0));
      if (relevant || !document.querySelector(`.wopt-audio2-follow[data-verse-key="${lastKey}"]`)) scheduleHighlightRefresh();
    });
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["class", "style", "aria-hidden"] });

    const highlightSafetyTimer = window.setInterval(() => {
      if (active && lastKey && !document.querySelector(`.wopt-audio2-follow[data-verse-key="${lastKey}"]`)) scheduleHighlightRefresh();
      scheduleMiniVisibilitySync();
    }, 450);

    return () => {
      observer.disconnect();
      window.clearInterval(highlightSafetyTimer);
      if (modalSyncFrame) window.cancelAnimationFrame(modalSyncFrame);
      if (highlightFrame) window.cancelAnimationFrame(highlightFrame);
      stop();
      overlay.removeEventListener("click", onOverlayClick);
      mini.removeEventListener("click", onMiniClick);
      miniProgress.removeEventListener("input", onMiniProgress);
      document.removeEventListener("click", onDocumentClick, true);
      window.removeEventListener("wopt-quran-audio-open", onExternalOpen);
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("playing", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onError);
      clearHighlight();
      audio.remove();
      mini.remove();
      overlay.remove();
      style.remove();
      if ("mediaSession" in navigator) {
        (["play", "pause", "stop", "seekbackward", "seekforward", "seekto", "previoustrack", "nexttrack"] as MediaSessionAction[]).forEach((action) => {
          try { navigator.mediaSession.setActionHandler(action, null); } catch { /* ignore */ }
        });
      }
    };
  }, [pathname]);

  return null;
}
