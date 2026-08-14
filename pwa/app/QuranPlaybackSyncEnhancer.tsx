"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

const API = "https://api.quran.com/api/v4";

type Timestamp = {
  verse_key: string;
  timestamp_from: number;
  timestamp_to: number;
  segments?: [number, number, number][] | null;
};

type ChapterAudioResponse = {
  audio_file?: {
    timestamps?: Timestamp[];
  };
};

function chapterFromPage() {
  const node = document.querySelector<HTMLElement>("[data-verse-key]");
  const key = node?.dataset.verseKey;
  return key ? Number(key.split(":")[0]) : null;
}

function currentReciterId() {
  return Number(document.querySelector<HTMLSelectElement>(".wopt-quran-player [data-player='reciter']")?.value || 7);
}

function parseClock(text = "") {
  const clean = text.replace(/^-/, "").trim();
  const parts = clean.split(":").map(Number);
  if (!parts.length || parts.some((value) => !Number.isFinite(value))) return 0;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return parts[0];
}

function isDuplicateVerseNumber(text = "") {
  return /^[\s٠-٩۰-۹0-9]+$/.test(text.trim()) && text.trim().length > 0;
}

export default function QuranPlaybackSyncEnhancer() {
  const pathname = usePathname();
  const timestampsRef = useRef<Timestamp[]>([]);
  const cacheRef = useRef(new Map<string, Timestamp[]>());
  const lastVerseRef = useRef<string | null>(null);
  const lastWordRef = useRef<string | null>(null);
  const lastScrollAtRef = useRef(0);

  useEffect(() => {
    if (!pathname.endsWith("/quran") && !pathname.endsWith("/quran/")) return;

    const style = document.createElement("style");
    style.dataset.woptPlaybackSync = "true";
    style.textContent = `
      .mushaf-ayah.wopt-sync-playing{
        background:rgba(211,170,87,.18)!important;
        box-shadow:0 0 0 7px rgba(211,170,87,.13)!important;
        border-radius:10px;
        transition:background .18s ease,box-shadow .18s ease;
      }
      .quran-word.wopt-sync-word{
        background:#efd78f!important;
        color:#17362e!important;
        box-shadow:0 0 0 3px rgba(211,170,87,.2);
        border-radius:6px;
      }
      .quran-word.wopt-duplicate-number{display:none!important}
    `;
    document.head.appendChild(style);

    const clearSyncHighlight = () => {
      document.querySelectorAll(".wopt-sync-playing").forEach((node) => node.classList.remove("wopt-sync-playing"));
      document.querySelectorAll(".wopt-sync-word").forEach((node) => node.classList.remove("wopt-sync-word"));
      lastVerseRef.current = null;
      lastWordRef.current = null;
    };

    const cleanDuplicateNumbers = () => {
      document.querySelectorAll<HTMLElement>(".mushaf-ayah .quran-word").forEach((word) => {
        if (isDuplicateVerseNumber(word.textContent || "")) word.classList.add("wopt-duplicate-number");
        else word.classList.remove("wopt-duplicate-number");
      });
    };

    const loadTimestamps = async (chapterId: number, reciterId: number) => {
      const key = `${reciterId}:${chapterId}`;
      const cached = cacheRef.current.get(key);
      if (cached) {
        timestampsRef.current = cached;
        return cached;
      }
      try {
        const response = await fetch(`${API}/chapter_recitations/${reciterId}/${chapterId}?segments=true`);
        if (!response.ok) throw new Error("timestamps");
        const data = await response.json() as ChapterAudioResponse;
        const timestamps = data.audio_file?.timestamps || [];
        cacheRef.current.set(key, timestamps);
        timestampsRef.current = timestamps;
        return timestamps;
      } catch {
        timestampsRef.current = [];
        return [];
      }
    };

    const ensureTimestamps = async () => {
      const chapterId = chapterFromPage();
      if (!chapterId) return;
      await loadTimestamps(chapterId, currentReciterId());
    };

    const getPlaybackMs = () => {
      const player = document.querySelector<HTMLElement>(".wopt-quran-player");
      const progress = player?.querySelector<HTMLInputElement>("[data-player='progress']");
      const elapsed = player?.querySelector<HTMLElement>("[data-player='elapsed']")?.textContent || "0:00";
      const remaining = player?.querySelector<HTMLElement>("[data-player='remaining']")?.textContent || "-0:00";
      if (!player || !progress) return null;

      const elapsedSeconds = parseClock(elapsed);
      const remainingSeconds = parseClock(remaining);
      const totalSeconds = elapsedSeconds + remainingSeconds;
      if (elapsedSeconds > 0 || totalSeconds > 0) return elapsedSeconds * 1000;

      const timestamps = timestampsRef.current;
      const endMs = timestamps[timestamps.length - 1]?.timestamp_to || 0;
      const ratio = Math.max(0, Math.min(1, Number(progress.value || 0) / Number(progress.max || 1000)));
      return endMs ? ratio * endMs : null;
    };

    const maybeScrollTo = (node: HTMLElement) => {
      const rect = node.getBoundingClientRect();
      const topSafe = Math.max(170, window.innerHeight * 0.22);
      const bottomSafe = window.innerHeight * 0.72;
      const now = Date.now();
      if ((rect.top < topSafe || rect.bottom > bottomSafe) && now - lastScrollAtRef.current > 900) {
        lastScrollAtRef.current = now;
        node.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
      }
    };

    const sync = () => {
      cleanDuplicateNumbers();
      const player = document.querySelector<HTMLElement>(".wopt-quran-player");
      const playButton = player?.querySelector<HTMLButtonElement>("[data-player='play']");
      const playing = !!playButton && /Pause/i.test(playButton.textContent || "");
      if (!playing) return;

      const currentMs = getPlaybackMs();
      if (currentMs == null || !timestampsRef.current.length) return;

      const timing = timestampsRef.current.find((item) => currentMs >= item.timestamp_from && currentMs < item.timestamp_to)
        || timestampsRef.current[timestampsRef.current.length - 1];
      if (!timing?.verse_key) return;

      const ayah = document.querySelector<HTMLElement>(`[data-verse-key="${timing.verse_key}"]`);
      if (!ayah) return;

      if (lastVerseRef.current !== timing.verse_key) {
        document.querySelectorAll(".wopt-sync-playing").forEach((node) => node.classList.remove("wopt-sync-playing"));
        ayah.classList.add("wopt-sync-playing");
        lastVerseRef.current = timing.verse_key;
        maybeScrollTo(ayah);
      }

      const segment = timing.segments?.find((item) => currentMs >= item[1] && currentMs < item[2]);
      if (segment) {
        const wordKey = `${timing.verse_key}:${segment[0]}`;
        if (lastWordRef.current !== wordKey) {
          document.querySelectorAll(".wopt-sync-word").forEach((node) => node.classList.remove("wopt-sync-word"));
          const word = ayah.querySelector<HTMLElement>(`[data-word-position="${segment[0]}"]`);
          if (word && !word.classList.contains("wopt-duplicate-number")) word.classList.add("wopt-sync-word");
          lastWordRef.current = wordKey;
        }
      }
    };

    const observer = new MutationObserver(() => {
      cleanDuplicateNumbers();
      void ensureTimestamps();
    });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });

    const timer = window.setInterval(sync, 180);
    const refreshTimer = window.setInterval(() => void ensureTimestamps(), 1400);
    void ensureTimestamps();
    cleanDuplicateNumbers();

    const onClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (target.closest("[data-player='stop']")) clearSyncHighlight();
      if (target.closest("[data-mode]")) void ensureTimestamps();
    };
    document.addEventListener("click", onClick, true);

    return () => {
      window.clearInterval(timer);
      window.clearInterval(refreshTimer);
      observer.disconnect();
      document.removeEventListener("click", onClick, true);
      clearSyncHighlight();
      style.remove();
    };
  }, [pathname]);

  return null;
}
