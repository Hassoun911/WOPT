"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

const API = "https://api.quran.com/api/v4";
const AUDIO_CDN = "https://verses.quran.com/";

type AudioFile = { verse_key?: string; url?: string; audio_url?: string };
type WordAudio = { position?: number; audio_url?: string };
type VerseAudioWords = { verse_key?: string; words?: WordAudio[] };

function absoluteAudio(raw?: string) {
  if (!raw) return null;
  if (/^https?:\/\//.test(raw)) return raw;
  return `${AUDIO_CDN}${raw.replace(/^\/+/, "")}`;
}

function chapterFromPage() {
  const node = document.querySelector<HTMLElement>("[data-verse-key]");
  const key = node?.dataset.verseKey;
  return key ? Number(key.split(":")[0]) : null;
}

function reciterFromPage() {
  return Number(document.querySelector<HTMLSelectElement>(".audio-tools select")?.value || 7);
}

export default function QuranAudioEnhancer() {
  const pathname = usePathname();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const playingRef = useRef(false);
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
      @media(max-width:700px){.enhanced-surah-title{padding:24px 10px 18px}.enhanced-surah-title h2{font-size:34px}.enhanced-surah-title .bismillah{font-size:27px}.enhanced-surah-title .audio-hint{font-size:9px}}
    `;
    document.head.appendChild(style);

    const clearHighlights = () => {
      document.querySelectorAll(".wopt-word-playing,.wopt-ayah-playing").forEach((node) => node.classList.remove("wopt-word-playing", "wopt-ayah-playing"));
    };

    const stop = () => {
      playingRef.current = false;
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        audioRef.current.onended = null;
      }
      clearHighlights();
      const listen = document.querySelector<HTMLButtonElement>(".audio-tools button");
      if (listen) listen.textContent = "▶ Listen to Surah";
    };

    const playSource = async (src: string, onEnded?: () => void) => {
      if (!audioRef.current) audioRef.current = new Audio();
      audioRef.current.pause();
      audioRef.current.src = src;
      audioRef.current.onended = onEnded || (() => stop());
      await audioRef.current.play();
    };

    const loadRecitationFiles = async (chapterId: number, reciterId: number) => {
      const response = await fetch(`${API}/recitations/${reciterId}/by_chapter/${chapterId}?per_page=300&segments=true`);
      if (!response.ok) throw new Error("audio");
      const data = await response.json();
      return (data.audio_files || (data.audio_file ? [data.audio_file] : [])) as AudioFile[];
    };

    const playWholeSurah = async () => {
      const chapterId = chapterFromPage();
      if (!chapterId) return;
      const button = document.querySelector<HTMLButtonElement>(".audio-tools button");
      try {
        stop();
        playingRef.current = true;
        if (button) button.textContent = "■ Stop Surah";
        const files = await loadRecitationFiles(chapterId, reciterFromPage());
        let index = 0;
        const next = async () => {
          if (!playingRef.current) return;
          const file = files[index];
          if (!file) { stop(); return; }
          const src = absoluteAudio(file.url || file.audio_url);
          index += 1;
          if (!src) { void next(); return; }
          const key = file.verse_key || `${chapterId}:${index}`;
          clearHighlights();
          document.querySelector<HTMLElement>(`[data-verse-key="${key}"]`)?.classList.add("playing");
          await playSource(src, () => {
            document.querySelector<HTMLElement>(`[data-verse-key="${key}"]`)?.classList.remove("playing");
            void next();
          });
        };
        await next();
      } catch {
        stop();
      }
    };

    const playAyah = async (verseKey: string, marker?: HTMLElement) => {
      const chapterId = Number(verseKey.split(":")[0]);
      try {
        stop();
        playingRef.current = true;
        const files = await loadRecitationFiles(chapterId, reciterFromPage());
        const verseNumber = Number(verseKey.split(":")[1]);
        const file = files.find((item) => item.verse_key === verseKey) || files[verseNumber - 1];
        const src = absoluteAudio(file?.url || file?.audio_url);
        if (!src) throw new Error("audio");
        marker?.classList.add("wopt-ayah-playing");
        document.querySelector<HTMLElement>(`[data-verse-key="${verseKey}"]`)?.classList.add("playing");
        await playSource(src, () => stop());
      } catch {
        stop();
      }
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
          const src = absoluteAudio(word.audio_url);
          if (src && verse.verse_key && word.position) map.set(`${verse.verse_key}:${word.position}`, src);
        }
      }
      wordCache.current.set(chapterId, map);
      return map;
    };

    const playWord = async (button: HTMLElement) => {
      const verse = button.closest<HTMLElement>("[data-verse-key]");
      const verseKey = verse?.dataset.verseKey;
      const position = Number(button.dataset.wordPosition || 0);
      if (!verseKey || !position) return;
      try {
        stop();
        playingRef.current = true;
        const chapterId = Number(verseKey.split(":")[0]);
        const map = await loadWordMap(chapterId);
        const src = map.get(`${verseKey}:${position}`);
        if (!src) throw new Error("word-audio");
        button.classList.add("wopt-word-playing");
        await playSource(src, () => stop());
      } catch {
        stop();
      }
    };

    const enhanceHeader = () => {
      const shell = document.querySelector<HTMLElement>(".mushaf-shell");
      const chapterId = chapterFromPage();
      if (!shell || !chapterId) return;
      const current = shell.querySelector<HTMLElement>(".enhanced-surah-title");
      if (current?.dataset.chapter === String(chapterId)) return;
      current?.remove();

      const arabic = document.querySelector<HTMLElement>(".quran-heading-block h1")?.textContent?.trim() || "سورة";
      const english = document.querySelector<HTMLElement>(".quran-title-line strong")?.textContent?.trim() || `Surah ${chapterId}`;
      const translated = document.querySelector<HTMLElement>(".quran-title-line span")?.textContent?.trim() || "";

      const wrap = document.createElement("div");
      wrap.className = "enhanced-surah-title";
      wrap.dataset.chapter = String(chapterId);
      const ornament = document.createElement("div");
      ornament.className = "surah-ornament";
      ornament.textContent = `Surah ${chapterId}`;
      const h2 = document.createElement("h2");
      h2.dir = "rtl";
      h2.textContent = arabic;
      const en = document.createElement("span");
      en.className = "surah-english";
      en.textContent = translated ? `${english} · ${translated}` : english;
      wrap.append(ornament, h2, en);
      if (chapterId !== 9) {
        const bismillah = document.createElement("p");
        bismillah.className = "bismillah";
        bismillah.lang = "ar";
        bismillah.textContent = "بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ";
        wrap.appendChild(bismillah);
      }
      const hint = document.createElement("p");
      hint.className = "audio-hint";
      hint.textContent = "Tap a word to hear that word · tap an ayah number to hear that verse · Listen plays the full Surah";
      wrap.appendChild(hint);
      shell.querySelector(".mushaf-page-head")?.insertAdjacentElement("afterend", wrap);
    };

    const onClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      const listen = target.closest<HTMLButtonElement>(".audio-tools button");
      if (listen) {
        event.preventDefault();
        event.stopPropagation();
        if (playingRef.current) stop(); else void playWholeSurah();
        return;
      }
      const word = target.closest<HTMLElement>(".quran-word");
      if (word) {
        void playWord(word);
        return;
      }
      const marker = target.closest<HTMLElement>(".ayah-marker");
      if (marker) {
        const verseKey = marker.closest<HTMLElement>("[data-verse-key]")?.dataset.verseKey;
        if (verseKey) {
          event.preventDefault();
          event.stopPropagation();
          void playAyah(verseKey, marker);
        }
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
      stop();
      style.remove();
    };
  }, [pathname]);

  return null;
}
