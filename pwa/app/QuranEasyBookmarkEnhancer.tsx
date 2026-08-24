"use client";

import { useEffect, useMemo, useState } from "react";

type LastRead = {
  chapterId: number;
  verseKey: string;
  page?: number;
  word?: number;
  savedAt: number;
};

type SavedPlace = LastRead & {
  scrollY: number;
  label: string;
};

type Bookmark = LastRead & { label: string };

const LAST_KEY = "wopt-quran-last-read";
const BOOKMARKS_KEY = "wopt-quran-bookmarks";
const EASY_PLACE_KEY = "wopt-quran-easy-place-v1";
const RESTORE_KEY = "wopt-quran-restore-exact-once";

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) as T : fallback;
  } catch {
    return fallback;
  }
}

export default function QuranEasyBookmarkEnhancer() {
  const [active, setActive] = useState(false);
  const [saved, setSaved] = useState<SavedPlace | null>(null);
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    const onRoute = () => setActive(window.location.pathname.includes("/quran"));
    onRoute();
    window.addEventListener("popstate", onRoute);
    const timer = window.setInterval(onRoute, 700);
    return () => {
      window.removeEventListener("popstate", onRoute);
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    if (!active) return;
    setSaved(readJson<SavedPlace | null>(EASY_PLACE_KEY, null));
    if (window.sessionStorage.getItem(RESTORE_KEY) === "1") {
      const place = readJson<SavedPlace | null>(EASY_PLACE_KEY, null);
      window.sessionStorage.removeItem(RESTORE_KEY);
      if (place) {
        window.setTimeout(() => window.scrollTo({ top: Math.max(0, place.scrollY), behavior: "smooth" }), 1250);
      }
    }
  }, [active]);

  const savedLabel = useMemo(() => {
    if (!saved) return "";
    const page = saved.page ? ` · Page ${saved.page}` : "";
    return `${saved.verseKey}${page}`;
  }, [saved]);

  if (!active) return null;

  const saveCurrentPlace = () => {
    const last = readJson<LastRead | null>(LAST_KEY, null);
    if (!last?.verseKey) return;
    const place: SavedPlace = {
      ...last,
      scrollY: window.scrollY,
      savedAt: Date.now(),
      label: `My reading place · ${last.verseKey}`,
    };
    window.localStorage.setItem(EASY_PLACE_KEY, JSON.stringify(place));

    const bookmarks = readJson<Bookmark[]>(BOOKMARKS_KEY, []);
    const bookmark: Bookmark = {
      chapterId: place.chapterId,
      verseKey: place.verseKey,
      page: place.page,
      word: place.word,
      savedAt: place.savedAt,
      label: place.label,
    };
    const next = [bookmark, ...bookmarks.filter((item) => item.label !== "My reading place" && !item.label?.startsWith("My reading place ·"))].slice(0, 100);
    window.localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(next));
    setSaved(place);
    setFlash(true);
    window.setTimeout(() => setFlash(false), 1800);
  };

  const continueReading = () => {
    if (!saved) return;
    window.localStorage.setItem(LAST_KEY, JSON.stringify({
      chapterId: saved.chapterId,
      verseKey: saved.verseKey,
      page: saved.page,
      word: saved.word,
      savedAt: saved.savedAt,
    } satisfies LastRead));
    window.sessionStorage.setItem(RESTORE_KEY, "1");
    window.location.assign("/quran");
  };

  return (
    <div style={{ position: "fixed", right: 14, bottom: 92, zIndex: 1200, display: "grid", gap: 8, justifyItems: "end", maxWidth: "calc(100vw - 28px)" }}>
      {saved && (
        <button
          type="button"
          onClick={continueReading}
          aria-label={`Continue reading from ${savedLabel}`}
          style={{
            border: "1px solid rgba(11,91,71,.18)",
            borderRadius: 18,
            background: "rgba(255,255,255,.97)",
            boxShadow: "0 8px 30px rgba(0,0,0,.13)",
            padding: "9px 13px",
            color: "#0b5b47",
            fontWeight: 800,
            fontSize: 13,
            cursor: "pointer",
          }}
        >
          ▶ Continue · {savedLabel}
        </button>
      )}
      <button
        type="button"
        onClick={saveCurrentPlace}
        aria-label="Save my current Qur’an reading place"
        style={{
          border: 0,
          borderRadius: 999,
          background: flash ? "#177957" : "#0b5b47",
          color: "white",
          boxShadow: "0 10px 32px rgba(11,91,71,.30)",
          padding: "13px 18px",
          fontWeight: 900,
          fontSize: 15,
          cursor: "pointer",
          minHeight: 48,
        }}
      >
        {flash ? "✓ Place saved" : "🔖 Save My Place"}
      </button>
    </div>
  );
}
