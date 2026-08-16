"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const API = "https://api.quran.com/api/v4";

type VersePayload = { verse?: { page_number?: number } };

function isQuranPath(pathname: string) {
  return pathname.endsWith("/quran") || pathname.endsWith("/quran/");
}

export default function QuranActiveAudioUiEnhancer() {
  const pathname = usePathname();

  useEffect(() => {
    if (!isQuranPath(pathname)) return;

    const style = document.createElement("style");
    style.dataset.woptActiveQuranAudio = "true";
    style.textContent = `
      .wopt-active-quran-player{position:fixed;z-index:4550;left:50%;bottom:calc(env(safe-area-inset-bottom,0px) + 88px);transform:translateX(-50%) translateY(18px);width:min(620px,calc(100vw - 20px));display:none;grid-template-columns:1fr auto;gap:9px 12px;align-items:center;padding:11px 12px;border:1px solid rgba(21,112,91,.18);border-radius:20px;background:rgba(255,255,255,.97);box-shadow:0 18px 50px rgba(17,61,50,.2);backdrop-filter:blur(16px);font-family:Arial,sans-serif;color:#174d41;opacity:0;transition:opacity .18s ease,transform .18s ease}
      .wopt-active-quran-player.show{display:grid;opacity:1;transform:translateX(-50%) translateY(0)}
      .wopt-active-quran-copy{min-width:0}.wopt-active-quran-copy strong{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px;line-height:1.25}.wopt-active-quran-copy span{display:block;margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#687873;font-size:10px}
      .wopt-active-quran-actions{display:flex;align-items:center;gap:5px}.wopt-active-quran-actions button{height:36px;min-width:36px;padding:0 9px;border:1px solid #d8e5e0;border-radius:11px;background:#fff;color:#175949;font-size:11px;font-weight:900}.wopt-active-quran-actions button.primary{background:#0b6e59;border-color:#0b6e59;color:#fff}.wopt-active-quran-actions button.stop{color:#8b4037}
      .wopt-active-quran-progress{grid-column:1/-1;display:grid;grid-template-columns:auto 1fr auto;gap:7px;align-items:center}.wopt-active-quran-progress span{min-width:31px;color:#72807c;font-size:9px;text-align:center}.wopt-active-quran-progress input{width:100%;accent-color:#0b6e59}
      .wopt-printed-ayah.wopt-audio-following,.mushaf-ayah.wopt-audio-following{background:rgba(29,153,125,.16)!important;box-shadow:0 0 0 4px rgba(29,153,125,.10)!important;border-radius:6px!important;transition:background .16s ease,box-shadow .16s ease}
      @media(max-width:520px){.wopt-active-quran-player{bottom:calc(env(safe-area-inset-bottom,0px) + 82px);padding:10px}.wopt-active-quran-actions{gap:4px}.wopt-active-quran-actions button{min-width:34px;height:34px;padding:0 7px;font-size:10px}.wopt-active-quran-actions .options-label{display:none}}
    `;
    document.head.appendChild(style);

    const panel = document.createElement("section");
    panel.className = "wopt-active-quran-player";
    panel.setAttribute("aria-label", "Active Qur’an audio player");
    panel.innerHTML = `
      <div class="wopt-active-quran-copy"><strong data-mini-title>Qur’an audio</strong><span data-mini-detail>Ready</span></div>
      <div class="wopt-active-quran-actions">
        <button type="button" data-mini-action="back" aria-label="Back 10 seconds">−10</button>
        <button type="button" class="primary" data-mini-action="toggle" aria-label="Pause">❚❚</button>
        <button type="button" data-mini-action="forward" aria-label="Forward 10 seconds">+10</button>
        <button type="button" data-mini-action="options" aria-label="Audio options">☰ <span class="options-label">Audio</span></button>
        <button type="button" class="stop" data-mini-action="stop" aria-label="Stop">■</button>
      </div>
      <div class="wopt-active-quran-progress"><span data-mini-elapsed>0:00</span><input type="range" min="0" max="1000" value="0" data-mini-progress aria-label="Audio progress"><span data-mini-remaining>-0:00</span></div>`;
    document.body.appendChild(panel);

    const titleNode = panel.querySelector<HTMLElement>("[data-mini-title]")!;
    const detailNode = panel.querySelector<HTMLElement>("[data-mini-detail]")!;
    const toggleButton = panel.querySelector<HTMLButtonElement>("[data-mini-action='toggle']")!;
    const miniProgress = panel.querySelector<HTMLInputElement>("[data-mini-progress]")!;
    const miniElapsed = panel.querySelector<HTMLElement>("[data-mini-elapsed]")!;
    const miniRemaining = panel.querySelector<HTMLElement>("[data-mini-remaining]")!;

    let media: HTMLAudioElement | null = null;
    let unbindMedia: (() => void) | null = null;
    let statusObserver: MutationObserver | null = null;
    let observedStatus: HTMLElement | null = null;
    let lastKey = "";
    let lastReciter = "Qur’an reciter";
    let followToken = 0;
    const pageCache = new Map<string, number>();

    const masterProgress = () => document.querySelector<HTMLInputElement>(".wopt-book-audio-backdrop [data-progress]");
    const masterElapsed = () => document.querySelector<HTMLElement>(".wopt-book-audio-backdrop [data-elapsed]");
    const masterRemaining = () => document.querySelector<HTMLElement>(".wopt-book-audio-backdrop [data-remaining]");
    const statusNode = () => document.querySelector<HTMLElement>(".wopt-book-audio-backdrop [data-status]");

    const clearFollow = () => {
      document.querySelectorAll(".wopt-audio-following").forEach((node) => node.classList.remove("wopt-audio-following"));
    };

    const bestVerseNode = (key: string) => {
      const nodes = Array.from(document.querySelectorAll<HTMLElement>(`[data-verse-key="${key}"]`));
      const printed = nodes.find((node) => Boolean(node.closest(".wopt-printed-reader")));
      if (printed) return printed;
      return nodes.find((node) => {
        const rect = node.getBoundingClientRect();
        return rect.bottom > 70 && rect.top < window.innerHeight - 110;
      }) || nodes[0] || null;
    };

    const scrollToVerse = (node: HTMLElement, force = false) => {
      clearFollow();
      node.classList.add("wopt-audio-following");
      const rect = node.getBoundingClientRect();
      const upper = window.innerHeight * 0.28;
      const lower = window.innerHeight * 0.68;
      if (force || rect.top < upper || rect.bottom > lower) {
        node.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
      }
    };

    const pageForVerse = async (key: string) => {
      const cached = pageCache.get(key);
      if (cached) return cached;
      try {
        const response = await fetch(`${API}/verses/by_key/${encodeURIComponent(key)}?language=en&words=false&fields=page_number`);
        if (!response.ok) return 0;
        const data = await response.json() as VersePayload;
        const page = Number(data.verse?.page_number || 0);
        if (page) pageCache.set(key, page);
        return page;
      } catch {
        return 0;
      }
    };

    const followVerse = async (key: string) => {
      if (!key) return;
      const token = ++followToken;
      const existing = bestVerseNode(key);
      if (existing) {
        scrollToVerse(existing);
        return;
      }

      const page = await pageForVerse(key);
      if (!page || token !== followToken) return;
      const currentPage = Number(document.querySelector<HTMLElement>(".wopt-printed-reader > .wopt-printed-page[data-printed-page]")?.dataset.printedPage || 0);
      if (page !== currentPage) {
        window.dispatchEvent(new CustomEvent("wopt-quran-book-mode", { detail: { enabled: true, page } }));
      }

      const started = Date.now();
      const find = () => {
        if (token !== followToken) return;
        const node = bestVerseNode(key);
        if (node) {
          scrollToVerse(node, true);
          return;
        }
        if (Date.now() - started < 3500) window.setTimeout(find, 90);
      };
      find();
    };

    const updateMediaSession = () => {
      if (!("mediaSession" in navigator) || !media) return;
      const session = navigator.mediaSession;
      try {
        if ("MediaMetadata" in window) {
          const base = pathname.replace(/\/quran\/?$/, "");
          session.metadata = new MediaMetadata({
            title: lastKey ? `Qur’an ${lastKey}` : "Qur’an audio",
            artist: lastReciter,
            album: "Windsor Prayer Times",
            artwork: [{ src: `${window.location.origin}${base}/icon-512.png`, sizes: "512x512", type: "image/png" }],
          });
        }
        session.playbackState = media.paused ? "paused" : "playing";
        if (Number.isFinite(media.duration) && media.duration > 0) {
          session.setPositionState({ duration: media.duration, playbackRate: media.playbackRate || 1, position: Math.max(0, Math.min(media.currentTime || 0, media.duration)) });
        }
      } catch { /* browser can reject transient position state */ }
    };

    const installMediaHandlers = () => {
      if (!("mediaSession" in navigator) || !media) return;
      const session = navigator.mediaSession;
      const safe = (action: MediaSessionAction, handler: MediaSessionActionHandler | null) => {
        try { session.setActionHandler(action, handler); } catch { /* unsupported */ }
      };
      safe("play", () => { if (media) void media.play(); });
      safe("pause", () => media?.pause());
      safe("stop", () => panel.querySelector<HTMLButtonElement>("[data-mini-action='stop']")?.click());
      safe("seekbackward", (details) => { if (media) media.currentTime = Math.max(0, media.currentTime - (details.seekOffset || 10)); });
      safe("seekforward", (details) => { if (media && Number.isFinite(media.duration)) media.currentTime = Math.min(media.duration, media.currentTime + (details.seekOffset || 10)); });
      safe("seekto", (details) => { if (media && typeof details.seekTime === "number") media.currentTime = Math.max(0, Math.min(media.duration || details.seekTime, details.seekTime)); });
    };

    const mirrorProgress = () => {
      const source = masterProgress();
      const elapsed = masterElapsed();
      const remaining = masterRemaining();
      if (source) miniProgress.value = source.value;
      if (elapsed?.textContent) miniElapsed.textContent = elapsed.textContent;
      if (remaining?.textContent) miniRemaining.textContent = remaining.textContent;
    };

    const syncStatus = () => {
      const text = statusNode()?.textContent?.trim() || "";
      const match = text.match(/(?:Playing|Resumed)\s+(\d+:\d+)(?:\s*·\s*(.+))?/i);
      if (match) {
        const key = match[1];
        const reciter = match[2]?.trim();
        if (reciter) lastReciter = reciter;
        titleNode.textContent = `Ayah ${key}`;
        detailNode.textContent = lastReciter;
        if (key !== lastKey) {
          lastKey = key;
          void followVerse(key);
        }
      } else if (/Paused\./i.test(text)) {
        detailNode.textContent = `${lastReciter} · Paused`;
      } else if (/Preparing/i.test(text)) {
        titleNode.textContent = "Preparing Qur’an audio…";
      } else if (/Stopped\.|Finished\./i.test(text)) {
        panel.classList.remove("show");
        clearFollow();
      }
      mirrorProgress();
      updateMediaSession();
    };

    const watchStatus = () => {
      const node = statusNode();
      if (!node || node === observedStatus) return;
      statusObserver?.disconnect();
      observedStatus = node;
      statusObserver = new MutationObserver(syncStatus);
      statusObserver.observe(node, { subtree: true, childList: true, characterData: true });
      syncStatus();
    };

    const syncPanel = () => {
      if (!media) return;
      const hasSource = Boolean(media.currentSrc || media.src);
      const shouldShow = hasSource && (!media.ended && (!media.paused || media.currentTime > 0));
      panel.classList.toggle("show", shouldShow);
      toggleButton.textContent = media.paused ? "▶" : "❚❚";
      toggleButton.setAttribute("aria-label", media.paused ? "Play" : "Pause");
      mirrorProgress();
      syncStatus();
    };

    const bindMedia = (next: HTMLAudioElement) => {
      if (media === next) return;
      unbindMedia?.();
      media = next;
      const onPlay = () => { panel.classList.add("show"); syncPanel(); installMediaHandlers(); };
      const onPause = () => syncPanel();
      const onEnded = () => { syncPanel(); clearFollow(); };
      const onTime = () => { mirrorProgress(); window.requestAnimationFrame(syncStatus); updateMediaSession(); };
      const onMeta = () => { syncPanel(); installMediaHandlers(); };
      next.addEventListener("play", onPlay);
      next.addEventListener("playing", onPlay);
      next.addEventListener("pause", onPause);
      next.addEventListener("ended", onEnded);
      next.addEventListener("timeupdate", onTime);
      next.addEventListener("loadedmetadata", onMeta);
      next.addEventListener("durationchange", onMeta);
      unbindMedia = () => {
        next.removeEventListener("play", onPlay);
        next.removeEventListener("playing", onPlay);
        next.removeEventListener("pause", onPause);
        next.removeEventListener("ended", onEnded);
        next.removeEventListener("timeupdate", onTime);
        next.removeEventListener("loadedmetadata", onMeta);
        next.removeEventListener("durationchange", onMeta);
      };
      installMediaHandlers();
      syncPanel();
    };

    const findMedia = () => {
      const next = document.querySelector<HTMLAudioElement>("audio[data-wopt-continuous-quran='true']");
      if (next) bindMedia(next);
      watchStatus();
    };

    const onPanelClick = (event: MouseEvent) => {
      const button = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-mini-action]");
      if (!button || !media) return;
      const action = button.dataset.miniAction;
      if (action === "toggle") {
        if (media.paused) void media.play(); else media.pause();
      } else if (action === "back") {
        media.currentTime = Math.max(0, media.currentTime - 10);
      } else if (action === "forward") {
        if (Number.isFinite(media.duration)) media.currentTime = Math.min(media.duration, media.currentTime + 10);
      } else if (action === "stop") {
        const stop = document.querySelector<HTMLButtonElement>(".wopt-book-audio-backdrop [data-audio-action='stop']");
        if (stop) stop.click();
        else { media.pause(); media.currentTime = 0; panel.classList.remove("show"); clearFollow(); }
      } else if (action === "options") {
        document.querySelector<HTMLButtonElement>(".wopt-clean-toolbar [data-clean='play']")?.click();
      }
      syncPanel();
    };

    const onMiniProgress = () => {
      const source = masterProgress();
      if (!source) return;
      source.value = miniProgress.value;
      source.dispatchEvent(new Event("input", { bubbles: true }));
      mirrorProgress();
    };

    panel.addEventListener("click", onPanelClick);
    miniProgress.addEventListener("input", onMiniProgress);

    const observer = new MutationObserver(findMedia);
    observer.observe(document.body, { subtree: true, childList: true });
    const timer = window.setInterval(findMedia, 500);
    findMedia();

    return () => {
      window.clearInterval(timer);
      observer.disconnect();
      statusObserver?.disconnect();
      unbindMedia?.();
      panel.removeEventListener("click", onPanelClick);
      miniProgress.removeEventListener("input", onMiniProgress);
      clearFollow();
      panel.remove();
      style.remove();
    };
  }, [pathname]);

  return null;
}
