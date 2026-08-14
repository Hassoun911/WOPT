"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

const API = "https://api.quran.com/api/v4";
const AUDIO_CDN = "https://verses.quran.com/";
const WORD_CDN = "https://audio.qurancdn.com/";

type AudioFile = { verse_key?: string; url?: string; audio_url?: string };
type WordAudio = { position?: number; audio_url?: string };
type VerseAudioWords = { verse_key?: string; words?: WordAudio[] };
type ChapterReciter = { id: number; name: string; style?: { name?: string | null } };
type ChapterInfo = { id: number; name_simple: string; name_arabic: string; translated_name?: { name?: string } };
type ChapterAudio = { audio_file?: { audio_url?: string } };
type PlayerMode = "surah" | "loop" | "quran";

function absoluteAudio(raw?: string) {
  if (!raw) return null;
  if (/^https?:\/\//.test(raw)) return raw;
  return `${AUDIO_CDN}${raw.replace(/^\/+/, "")}`;
}

function absoluteWordAudio(raw?: string) {
  if (!raw) return null;
  if (/^https?:\/\//.test(raw)) return raw;
  return `${WORD_CDN}${raw.replace(/^\/+/, "")}`;
}

function chapterFromPage() {
  const node = document.querySelector<HTMLElement>("[data-verse-key]");
  const key = node?.dataset.verseKey;
  return key ? Number(key.split(":")[0]) : null;
}

function ayahReciterFromPage() {
  return Number(document.querySelector<HTMLSelectElement>(".audio-tools select")?.value || 7);
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

export default function QuranAudioEnhancer() {
  const pathname = usePathname();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const playingRef = useRef(false);
  const pausedRef = useRef(false);
  const modeRef = useRef<PlayerMode>("surah");
  const currentChapterRef = useRef(1);
  const chapterReciterRef = useRef(7);
  const speedRef = useRef(1);
  const chaptersRef = useRef<ChapterInfo[]>([]);
  const chapterRecitersRef = useRef<ChapterReciter[]>([]);
  const wordCache = useRef(new Map<number, Map<string, string>>());

  useEffect(() => {
    if (!pathname.endsWith("/quran") && !pathname.endsWith("/quran/")) return;

    const style = document.createElement("style");
    style.dataset.woptQuranEnhancer = "true";
    style.textContent = `
      .enhanced-surah-title{padding:28px 18px 22px;text-align:center;border-bottom:1px solid var(--q-line);background:linear-gradient(180deg,rgba(11,91,71,.055),transparent)}
      .enhanced-surah-title .surah-ornament{display:flex;align-items:center;justify-content:center;gap:14px;color:var(--q-green);font-size:11px;font-weight:900;letter-spacing:.16em;text-transform:uppercase}
      .enhanced-surah-title .surah-ornament:before,.enhanced-surah-title .surah-ornament:after{content:"";width:58px;height:1px;background:var(--q-line)}
      .enhanced-surah-title h2{margin:10px 0 2px;font-family:"Noto Naskh Arabic","Amiri","Traditional Arabic",serif;font-size:38px;line-height:1.25;font-weight:500;color:var(--q-ink)}
      .enhanced-surah-title .surah-english{display:block;color:var(--q-muted);font-size:12px;font-weight:750;letter-spacing:.04em}
      .enhanced-surah-title .bismillah{margin:24px 0 0;font-family:"Noto Naskh Arabic","Amiri","Traditional Arabic",serif;font-size:31px;line-height:1.6;color:var(--q-ink);direction:rtl}
      .enhanced-surah-title .audio-hint{margin:12px 0 0;color:var(--q-muted);font-size:10px;line-height:1.55}
      .quran-word.wopt-word-playing{background:rgba(211,170,87,.22)!important;box-shadow:0 0 0 4px rgba(211,170,87,.14)}
      .ayah-marker.wopt-ayah-playing{background:rgba(211,170,87,.2);border-radius:999px;box-shadow:0 0 0 5px rgba(211,170,87,.14)}
      .wopt-quran-player{position:sticky;z-index:16;top:72px;max-width:1320px;margin:10px auto 0;padding:12px 14px;border:1px solid rgba(11,91,71,.16);border-radius:20px;background:rgba(7,63,51,.96);color:#fff;box-shadow:0 16px 42px rgba(7,49,39,.2);backdrop-filter:blur(18px)}
      .wopt-player-top{display:grid;grid-template-columns:minmax(190px,1fr) auto;gap:14px;align-items:center}
      .wopt-now-playing small{display:block;color:#acd2c5;font-size:9px;font-weight:850;letter-spacing:.12em;text-transform:uppercase}.wopt-now-playing strong{display:block;margin-top:3px;font-size:14px}.wopt-now-playing span{display:block;margin-top:2px;color:#d2e7df;font-size:10px}
      .wopt-player-actions{display:flex;gap:6px;align-items:center;flex-wrap:wrap;justify-content:flex-end}.wopt-player-actions button,.wopt-player-actions select{min-height:34px;border:1px solid rgba(255,255,255,.2);border-radius:10px;background:rgba(255,255,255,.06);color:#fff;font-size:9px;font-weight:750;padding:0 10px}.wopt-player-actions option{color:#111}.wopt-player-actions button.active{background:#fff;color:#0b5b47}
      .wopt-player-progress{margin-top:10px;display:grid;grid-template-columns:auto 1fr auto;gap:10px;align-items:center}.wopt-player-progress span{font-size:9px;color:#c9e0d8;font-variant-numeric:tabular-nums}.wopt-player-progress input{width:100%;accent-color:#fff}
      .wopt-player-modes{margin-top:9px;display:flex;gap:6px;flex-wrap:wrap}.wopt-player-modes button{min-height:32px;padding:0 10px;border:1px solid rgba(255,255,255,.17);border-radius:9px;background:transparent;color:#d9ebe4;font-size:9px;font-weight:750}.wopt-player-modes button.active{background:rgba(255,255,255,.95);color:#0b5b47}
      @media(max-width:700px){.enhanced-surah-title{padding:24px 10px 18px}.enhanced-surah-title h2{font-size:34px}.enhanced-surah-title .bismillah{font-size:27px}.enhanced-surah-title .audio-hint{font-size:9px}.wopt-quran-player{top:7px;margin-top:8px;padding:10px;border-radius:17px}.wopt-player-top{grid-template-columns:1fr}.wopt-player-actions{justify-content:flex-start}.wopt-player-actions select.reciter{max-width:190px}.wopt-player-progress{grid-template-columns:38px 1fr 45px}.wopt-player-modes{overflow-x:auto;flex-wrap:nowrap;padding-bottom:2px}.wopt-player-modes button{white-space:nowrap}}
    `;
    document.head.appendChild(style);

    const audio = new Audio();
    audio.preload = "metadata";
    audioRef.current = audio;

    const basePath = pathname.replace(/\/quran\/?$/, "");
    const artwork = `${window.location.origin}${basePath}/icon-512.png`;

    const clearHighlights = () => {
      document.querySelectorAll(".wopt-word-playing,.wopt-ayah-playing,.mushaf-ayah.playing").forEach((node) => node.classList.remove("wopt-word-playing", "wopt-ayah-playing", "playing"));
    };

    const player = document.createElement("section");
    player.className = "wopt-quran-player";
    player.innerHTML = `
      <div class="wopt-player-top">
        <div class="wopt-now-playing"><small>Qur’an audio</small><strong>Ready to listen</strong><span>Choose how you want to play</span></div>
        <div class="wopt-player-actions">
          <button type="button" data-player="play">▶ Play</button>
          <button type="button" data-player="stop">■ Stop</button>
          <button type="button" data-player="mute">Mute</button>
          <select class="reciter" data-player="reciter" aria-label="Reciter"><option value="7">Loading reciters…</option></select>
          <select data-player="speed" aria-label="Playback speed"><option value="0.75">0.75×</option><option value="1" selected>1×</option><option value="1.25">1.25×</option><option value="1.5">1.5×</option><option value="2">2×</option></select>
        </div>
      </div>
      <div class="wopt-player-progress"><span data-player="elapsed">0:00</span><input data-player="progress" type="range" min="0" max="1000" value="0" aria-label="Audio progress"><span data-player="remaining">-0:00</span></div>
      <div class="wopt-player-modes"><button class="active" data-mode="surah">Play Surah once</button><button data-mode="loop">Loop Surah</button><button data-mode="quran">Continue Qur’an from here</button></div>
    `;

    const toolbar = document.querySelector(".quran-reader-toolbar");
    toolbar?.insertAdjacentElement("afterend", player);

    const nowStrong = player.querySelector<HTMLElement>(".wopt-now-playing strong");
    const nowSpan = player.querySelector<HTMLElement>(".wopt-now-playing span");
    const playButton = player.querySelector<HTMLButtonElement>("[data-player='play']");
    const muteButton = player.querySelector<HTMLButtonElement>("[data-player='mute']");
    const reciterSelect = player.querySelector<HTMLSelectElement>("[data-player='reciter']");
    const speedSelect = player.querySelector<HTMLSelectElement>("[data-player='speed']");
    const progress = player.querySelector<HTMLInputElement>("[data-player='progress']");
    const elapsed = player.querySelector<HTMLElement>("[data-player='elapsed']");
    const remaining = player.querySelector<HTMLElement>("[data-player='remaining']");

    const chapterInfo = (chapterId: number) => chaptersRef.current.find((item) => item.id === chapterId);
    const reciterInfo = () => chapterRecitersRef.current.find((item) => item.id === chapterReciterRef.current);

    const updatePlayerLabels = () => {
      const chapter = chapterInfo(currentChapterRef.current);
      const reciter = reciterInfo();
      if (nowStrong) nowStrong.textContent = chapter ? `${chapter.name_simple} · ${chapter.name_arabic}` : `Surah ${currentChapterRef.current}`;
      if (nowSpan) nowSpan.textContent = `${reciter?.name || "Qur’an reciter"} · Surah ${currentChapterRef.current} of 114`;
    };

    const updatePosition = () => {
      if (!audio.duration || !Number.isFinite(audio.duration)) return;
      if (progress) progress.value = String(Math.round((audio.currentTime / audio.duration) * 1000));
      if (elapsed) elapsed.textContent = formatTime(audio.currentTime);
      if (remaining) remaining.textContent = `-${formatTime(Math.max(0, audio.duration - audio.currentTime))}`;
      if ("mediaSession" in navigator) {
        try {
          navigator.mediaSession.setPositionState({ duration: audio.duration, playbackRate: audio.playbackRate || 1, position: Math.min(audio.currentTime, audio.duration) });
        } catch { /* browser may not expose position state */ }
      }
    };

    const updateMediaMetadata = () => {
      if (!("mediaSession" in navigator) || !("MediaMetadata" in window)) return;
      const chapter = chapterInfo(currentChapterRef.current);
      const reciter = reciterInfo();
      navigator.mediaSession.metadata = new MediaMetadata({
        title: chapter ? `${chapter.name_simple} (${chapter.name_arabic})` : `Surah ${currentChapterRef.current}`,
        artist: reciter?.name || "Windsor Qur’an",
        album: `Windsor Qur’an · Surah ${currentChapterRef.current} of 114`,
        artwork: [{ src: artwork, sizes: "512x512", type: "image/png" }],
      });
    };

    const setPlaybackState = (state: "none" | "paused" | "playing") => {
      if ("mediaSession" in navigator) navigator.mediaSession.playbackState = state;
    };

    const stopLongPlayer = () => {
      playingRef.current = false;
      pausedRef.current = false;
      audio.pause();
      audio.currentTime = 0;
      setPlaybackState("none");
      clearHighlights();
      if (playButton) playButton.textContent = "▶ Play";
      const original = document.querySelector<HTMLButtonElement>(".audio-tools button");
      if (original) original.textContent = "▶ Listen";
      updatePosition();
    };

    const getChapterAudio = async (chapterId: number) => {
      const response = await fetch(`${API}/chapter_recitations/${chapterReciterRef.current}/${chapterId}`);
      if (!response.ok) throw new Error("chapter-audio");
      const data = await response.json() as ChapterAudio;
      const src = data.audio_file?.audio_url;
      if (!src) throw new Error("chapter-audio");
      return src;
    };

    const startChapter = async (chapterId: number) => {
      currentChapterRef.current = Math.max(1, Math.min(114, chapterId));
      playingRef.current = true;
      pausedRef.current = false;
      updatePlayerLabels();
      updateMediaMetadata();
      const src = await getChapterAudio(currentChapterRef.current);
      audio.src = src;
      audio.playbackRate = speedRef.current;
      await audio.play();
      setPlaybackState("playing");
      if (playButton) playButton.textContent = "❚❚ Pause";
      const original = document.querySelector<HTMLButtonElement>(".audio-tools button");
      if (original) original.textContent = "■ Stop";
    };

    const finishChapter = () => {
      if (!playingRef.current) return;
      if (modeRef.current === "loop") {
        void startChapter(currentChapterRef.current);
      } else if (modeRef.current === "quran" && currentChapterRef.current < 114) {
        void startChapter(currentChapterRef.current + 1);
      } else {
        stopLongPlayer();
      }
    };

    audio.addEventListener("loadedmetadata", updatePosition);
    audio.addEventListener("durationchange", updatePosition);
    audio.addEventListener("timeupdate", updatePosition);
    audio.addEventListener("ratechange", updatePosition);
    audio.addEventListener("ended", finishChapter);
    audio.addEventListener("play", () => { pausedRef.current = false; setPlaybackState("playing"); if (playButton) playButton.textContent = "❚❚ Pause"; });
    audio.addEventListener("pause", () => { if (playingRef.current && !audio.ended) { pausedRef.current = true; setPlaybackState("paused"); if (playButton) playButton.textContent = "▶ Resume"; } });

    const playOrPause = async () => {
      if (playingRef.current && !audio.paused) { audio.pause(); return; }
      if (playingRef.current && audio.paused && audio.src) { await audio.play(); return; }
      const current = chapterFromPage() || currentChapterRef.current || 1;
      try { await startChapter(current); } catch { stopLongPlayer(); }
    };

    const seekBy = (seconds: number) => {
      if (!audio.duration) return;
      audio.currentTime = Math.max(0, Math.min(audio.duration, audio.currentTime + seconds));
      updatePosition();
    };

    const changeChapter = async (delta: number) => {
      const next = Math.max(1, Math.min(114, currentChapterRef.current + delta));
      if (next === currentChapterRef.current) return;
      try { await startChapter(next); } catch { stopLongPlayer(); }
    };

    if ("mediaSession" in navigator) {
      const handlers: Array<[MediaSessionAction, MediaSessionActionHandler]> = [
        ["play", () => { void playOrPause(); }],
        ["pause", () => audio.pause()],
        ["stop", () => stopLongPlayer()],
        ["seekbackward", (details) => seekBy(-(details.seekOffset || 10))],
        ["seekforward", (details) => seekBy(details.seekOffset || 10)],
        ["seekto", (details) => { if (typeof details.seekTime === "number" && audio.duration) { audio.currentTime = Math.max(0, Math.min(audio.duration, details.seekTime)); updatePosition(); } }],
        ["previoustrack", () => { void changeChapter(-1); }],
        ["nexttrack", () => { void changeChapter(1); }],
      ];
      handlers.forEach(([action, handler]) => { try { navigator.mediaSession.setActionHandler(action, handler); } catch { /* unsupported action */ } });
    }

    progress?.addEventListener("input", () => {
      if (!audio.duration) return;
      audio.currentTime = (Number(progress.value) / 1000) * audio.duration;
      updatePosition();
    });

    player.addEventListener("click", (event) => {
      const target = event.target as HTMLElement;
      const action = target.closest<HTMLElement>("[data-player]")?.dataset.player;
      if (action === "play") void playOrPause();
      if (action === "stop") stopLongPlayer();
      if (action === "mute") { audio.muted = !audio.muted; if (muteButton) muteButton.textContent = audio.muted ? "Unmute" : "Mute"; }
      const modeButton = target.closest<HTMLButtonElement>("[data-mode]");
      if (modeButton) {
        modeRef.current = modeButton.dataset.mode as PlayerMode;
        player.querySelectorAll("[data-mode]").forEach((node) => node.classList.toggle("active", node === modeButton));
      }
    });

    reciterSelect?.addEventListener("change", async () => {
      chapterReciterRef.current = Number(reciterSelect.value);
      updatePlayerLabels();
      updateMediaMetadata();
      if (playingRef.current) {
        try { await startChapter(currentChapterRef.current); } catch { stopLongPlayer(); }
      }
    });

    speedSelect?.addEventListener("change", () => {
      speedRef.current = Number(speedSelect.value) || 1;
      audio.playbackRate = speedRef.current;
      updatePosition();
    });

    Promise.all([
      fetch(`${API}/resources/chapter_reciters?language=en`).then((response) => response.ok ? response.json() : Promise.reject()),
      fetch(`${API}/chapters?language=en`).then((response) => response.ok ? response.json() : Promise.reject()),
    ]).then(([reciterData, chapterData]) => {
      chapterRecitersRef.current = reciterData.reciters || [];
      chaptersRef.current = chapterData.chapters || [];
      if (chapterRecitersRef.current.length && reciterSelect) {
        reciterSelect.innerHTML = "";
        chapterRecitersRef.current.forEach((reciter) => {
          const option = document.createElement("option");
          option.value = String(reciter.id);
          option.textContent = `${reciter.name}${reciter.style?.name ? ` · ${reciter.style.name}` : ""}`;
          reciterSelect.appendChild(option);
        });
        const preferred = chapterRecitersRef.current.find((item) => /mishary|alafasy/i.test(item.name)) || chapterRecitersRef.current[0];
        chapterReciterRef.current = preferred.id;
        reciterSelect.value = String(preferred.id);
      }
      currentChapterRef.current = chapterFromPage() || 1;
      updatePlayerLabels();
    }).catch(() => undefined);

    const playAyah = async (verseKey: string, marker?: HTMLElement) => {
      stopLongPlayer();
      const chapterId = Number(verseKey.split(":")[0]);
      try {
        const response = await fetch(`${API}/recitations/${ayahReciterFromPage()}/by_chapter/${chapterId}?per_page=300&segments=true`);
        if (!response.ok) throw new Error("audio");
        const data = await response.json();
        const files = (data.audio_files || []) as AudioFile[];
        const verseNumber = Number(verseKey.split(":")[1]);
        const file = files.find((item) => item.verse_key === verseKey) || files[verseNumber - 1];
        const src = absoluteAudio(file?.url || file?.audio_url);
        if (!src) throw new Error("audio");
        marker?.classList.add("wopt-ayah-playing");
        document.querySelector<HTMLElement>(`[data-verse-key="${verseKey}"]`)?.classList.add("playing");
        audio.src = src;
        audio.playbackRate = speedRef.current;
        audio.onended = () => { clearHighlights(); setPlaybackState("none"); };
        await audio.play();
        if ("mediaSession" in navigator && "MediaMetadata" in window) navigator.mediaSession.metadata = new MediaMetadata({ title: `Ayah ${verseKey}`, artist: reciterInfo()?.name || "Windsor Qur’an", album: chapterInfo(chapterId)?.name_simple || `Surah ${chapterId}`, artwork: [{ src: artwork, sizes: "512x512", type: "image/png" }] });
      } catch { clearHighlights(); }
    };

    const loadWordMap = async (chapterId: number) => {
      const cached = wordCache.current.get(chapterId);
      if (cached) return cached;
      const response = await fetch(`${API}/verses/by_chapter/${chapterId}?words=true&word_fields=audio&per_page=300`);
      if (!response.ok) throw new Error("word-audio");
      const data = await response.json();
      const map = new Map<string, string>();
      for (const verse of (data.verses || []) as VerseAudioWords[]) {
        for (const word of verse.words || []) {
          const src = absoluteWordAudio(word.audio_url);
          if (src && verse.verse_key && word.position) map.set(`${verse.verse_key}:${word.position}`, src);
        }
      }
      wordCache.current.set(chapterId, map);
      return map;
    };

    const playWord = async (button: HTMLElement) => {
      stopLongPlayer();
      const verse = button.closest<HTMLElement>("[data-verse-key]");
      const verseKey = verse?.dataset.verseKey;
      const position = Number(button.dataset.wordPosition || 0);
      if (!verseKey || !position) return;
      try {
        const chapterId = Number(verseKey.split(":")[0]);
        const map = await loadWordMap(chapterId);
        const src = map.get(`${verseKey}:${position}`);
        if (!src) throw new Error("word-audio");
        button.classList.add("wopt-word-playing");
        audio.src = src;
        audio.playbackRate = speedRef.current;
        audio.onended = () => { clearHighlights(); setPlaybackState("none"); };
        await audio.play();
      } catch { clearHighlights(); }
    };

    const enhanceHeader = () => {
      const shell = document.querySelector<HTMLElement>(".mushaf-shell");
      const chapterId = chapterFromPage();
      if (!shell || !chapterId) return;
      currentChapterRef.current = chapterId;
      const current = shell.querySelector<HTMLElement>(".enhanced-surah-title");
      if (current?.dataset.chapter === String(chapterId)) return;
      current?.remove();
      const arabic = document.querySelector<HTMLElement>(".quran-heading-block h1")?.textContent?.trim() || "سورة";
      const english = document.querySelector<HTMLElement>(".quran-title-line strong")?.textContent?.trim() || `Surah ${chapterId}`;
      const translated = document.querySelector<HTMLElement>(".quran-title-line span")?.textContent?.trim() || "";
      const wrap = document.createElement("div");
      wrap.className = "enhanced-surah-title";
      wrap.dataset.chapter = String(chapterId);
      const ornament = document.createElement("div"); ornament.className = "surah-ornament"; ornament.textContent = `Surah ${chapterId}`;
      const h2 = document.createElement("h2"); h2.dir = "rtl"; h2.textContent = arabic;
      const en = document.createElement("span"); en.className = "surah-english"; en.textContent = translated ? `${english} · ${translated}` : english;
      wrap.append(ornament, h2, en);
      if (chapterId !== 9) { const bismillah = document.createElement("p"); bismillah.className = "bismillah"; bismillah.lang = "ar"; bismillah.textContent = "بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ"; wrap.appendChild(bismillah); }
      const hint = document.createElement("p"); hint.className = "audio-hint"; hint.textContent = "Tap a word to hear that word · tap an ayah number for that verse · use the player for the full Surah or continuous Qur’an"; wrap.appendChild(hint);
      shell.querySelector(".mushaf-page-head")?.insertAdjacentElement("afterend", wrap);
      if (!playingRef.current) updatePlayerLabels();
    };

    const onClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      const originalListen = target.closest<HTMLButtonElement>(".audio-tools button");
      if (originalListen) { event.preventDefault(); event.stopPropagation(); void playOrPause(); return; }
      const word = target.closest<HTMLElement>(".quran-word");
      if (word) { void playWord(word); return; }
      const marker = target.closest<HTMLElement>(".ayah-marker");
      if (marker) {
        const verseKey = marker.closest<HTMLElement>("[data-verse-key]")?.dataset.verseKey;
        if (verseKey) { event.preventDefault(); event.stopPropagation(); void playAyah(verseKey, marker); }
      }
    };

    const observer = new MutationObserver(() => enhanceHeader());
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    document.addEventListener("click", onClick, true);
    const timer = window.setTimeout(enhanceHeader, 250);

    return () => {
      window.clearTimeout(timer);
      observer.disconnect();
      document.removeEventListener("click", onClick, true);
      stopLongPlayer();
      audio.pause();
      player.remove();
      style.remove();
      if ("mediaSession" in navigator) {
        (["play","pause","stop","seekbackward","seekforward","seekto","previoustrack","nexttrack"] as MediaSessionAction[]).forEach((action) => { try { navigator.mediaSession.setActionHandler(action, null); } catch { /* ignore */ } });
      }
    };
  }, [pathname]);

  return null;
}
