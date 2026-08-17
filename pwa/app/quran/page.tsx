"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Chapter = {
  id: number;
  name_simple: string;
  name_arabic: string;
  translated_name?: { name?: string };
  verses_count: number;
  pages?: number[];
};

type QuranWord = {
  id?: number;
  position?: number;
  text_uthmani?: string;
  text?: string;
  transliteration?: { text?: string };
  translation?: { text?: string };
  audio_url?: string;
};

type Translation = { id?: number; text?: string; resource_name?: string };

type Verse = {
  id: number;
  verse_number: number;
  verse_key: string;
  text_uthmani?: string;
  page_number?: number;
  juz_number?: number;
  words?: QuranWord[];
  translations?: Translation[];
};

type AudioFile = { verse_key?: string; url?: string; audio_url?: string };
type Reciter = { id: number; reciter_name: string; style?: string };
type SearchResult = { verse_key?: string; text?: string; highlighted?: string; translations?: Translation[] };
type LastRead = { chapterId: number; verseKey: string; page?: number; word?: number; savedAt: number };
type Bookmark = LastRead & { label: string };

type ReaderSettings = {
  showTranslation: boolean;
  showTransliteration: boolean;
  fontSize: number;
  lineHeight: number;
  theme: "paper" | "night" | "sepia";
};

type CoachResult = { score: number; matched: number; total: number; missed: string[]; heard: string } | null;

const API = "https://api.quran.com/api/v4";
const AUDIO_CDN = "https://verses.quran.com/";
const DEFAULT_RECITER = 7;
const STORAGE = {
  last: "wopt-quran-last-read",
  bookmarks: "wopt-quran-bookmarks",
  settings: "wopt-quran-reader-settings",
  memorized: "wopt-quran-memorize-selection",
};

function stripHtml(value = "") {
  return value.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
}

function arabicNumber(value: number) {
  return String(value).replace(/\d/g, (digit) => "٠١٢٣٤٥٦٧٨٩"[Number(digit)]);
}

function normalizeArabic(value: string) {
  return value
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, "")
    .replace(/[إأآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/[^\u0621-\u063A\u0641-\u064A\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function compareRecitation(target: string, heard: string): CoachResult {
  const expected = normalizeArabic(target).split(" ").filter(Boolean);
  const spoken = normalizeArabic(heard).split(" ").filter(Boolean);
  if (!expected.length) return null;
  let cursor = 0;
  let matched = 0;
  const missed: string[] = [];
  for (const word of expected) {
    let found = -1;
    for (let i = cursor; i < Math.min(spoken.length, cursor + 5); i += 1) {
      if (spoken[i] === word) { found = i; break; }
    }
    if (found >= 0) {
      matched += 1;
      cursor = found + 1;
    } else {
      missed.push(word);
    }
  }
  return {
    score: Math.round((matched / expected.length) * 100),
    matched,
    total: expected.length,
    missed: missed.slice(0, 16),
    heard,
  };
}

function safeJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const value = window.localStorage.getItem(key);
    return value ? JSON.parse(value) as T : fallback;
  } catch {
    return fallback;
  }
}

function verseText(verse: Verse) {
  if (verse.words?.length) {
    return verse.words.map((word) => word.text_uthmani || word.text || "").filter(Boolean).join(" ");
  }
  return verse.text_uthmani || "";
}

function verseTransliteration(verse: Verse) {
  if (!verse.words?.length) return "";
  return verse.words.map((word) => word.transliteration?.text || "").filter(Boolean).join(" ");
}

function audioUrl(file?: AudioFile) {
  const raw = file?.url || file?.audio_url;
  if (!raw) return null;
  if (/^https?:\/\//.test(raw)) return raw;
  return `${AUDIO_CDN}${raw.replace(/^\/+/, "")}`;
}

export default function QuranPage() {
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [chapterId, setChapterId] = useState(1);
  const [verses, setVerses] = useState<Verse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [reciters, setReciters] = useState<Reciter[]>([]);
  const [reciterId, setReciterId] = useState(DEFAULT_RECITER);
  const [audioFiles, setAudioFiles] = useState<AudioFile[]>([]);
  const [playingKey, setPlayingKey] = useState<string | null>(null);
  const [repeatCount, setRepeatCount] = useState(1);
  const [settings, setSettings] = useState<ReaderSettings>({ showTranslation: false, showTransliteration: false, fontSize: 42, lineHeight: 2.05, theme: "paper" });
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [lastRead, setLastRead] = useState<LastRead | null>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [memorizeOpen, setMemorizeOpen] = useState(false);
  const [memorizeStep, setMemorizeStep] = useState<"read" | "first" | "hidden">("read");
  const [coachListening, setCoachListening] = useState(false);
  const [coachResult, setCoachResult] = useState<CoachResult>(null);
  const [drawer, setDrawer] = useState<"surahs" | "bookmarks" | "settings" | null>(null);
  const [selectedVerse, setSelectedVerse] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const repeatRef = useRef(0);
  const observerRef = useRef<IntersectionObserver | null>(null);

  const chapter = chapters.find((item) => item.id === chapterId);
  const selectedVerses = useMemo(() => verses.filter((verse) => selectedKeys.includes(verse.verse_key)), [verses, selectedKeys]);
  const focusVerses = selectedVerses.length ? selectedVerses : verses.slice(0, Math.min(3, verses.length));
  const focusArabic = useMemo(() => focusVerses.map(verseText).join(" "), [focusVerses]);

  useEffect(() => {
    setSettings(safeJson(STORAGE.settings, settings));
    setBookmarks(safeJson(STORAGE.bookmarks, [] as Bookmark[]));
    const savedLast = safeJson<LastRead | null>(STORAGE.last, null);
    setLastRead(savedLast);
    if (savedLast?.chapterId) setChapterId(savedLast.chapterId);
    setSelectedKeys(safeJson(STORAGE.memorized, [] as string[]));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    window.localStorage.setItem(STORAGE.settings, JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    window.localStorage.setItem(STORAGE.bookmarks, JSON.stringify(bookmarks));
  }, [bookmarks]);

  useEffect(() => {
    window.localStorage.setItem(STORAGE.memorized, JSON.stringify(selectedKeys));
  }, [selectedKeys]);

  useEffect(() => {
    Promise.all([
      fetch(`${API}/chapters?language=en`).then((r) => r.json()),
      fetch(`${API}/resources/recitations?language=en`).then((r) => r.json()),
    ]).then(([chapterData, reciterData]) => {
      setChapters(chapterData.chapters || []);
      setReciters(reciterData.recitations || []);
    }).catch(() => setError("Unable to load Qur’an resources right now."));
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    setAudioFiles([]);
    setPlayingKey(null);
    const url = `${API}/verses/by_chapter/${chapterId}?language=en&words=true&translations=131&fields=text_uthmani,page_number,juz_number&word_fields=text_uthmani,translation,transliteration,audio&per_page=300`;
    fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error("reader");
        return r.json();
      })
      .then((data) => {
        if (cancelled) return;
        setVerses(data.verses || []);
        setLoading(false);
        window.setTimeout(() => {
          const saved = safeJson<LastRead | null>(STORAGE.last, null);
          const target = saved?.chapterId === chapterId ? saved.verseKey : `${chapterId}:1`;
          document.getElementById(`ayah-${target.replace(":", "-")}`)?.scrollIntoView({ block: "center" });
        }, 250);
      })
      .catch(() => {
        if (!cancelled) {
          setLoading(false);
          setError("The Qur’an text service could not be reached. Your saved reading position and bookmarks are still safe.");
        }
      });
    return () => { cancelled = true; };
  }, [chapterId]);

  useEffect(() => {
    observerRef.current?.disconnect();
    if (!verses.length) return;
    observerRef.current = new IntersectionObserver((entries) => {
      const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (!visible) return;
      const key = visible.target.getAttribute("data-verse-key");
      const page = Number(visible.target.getAttribute("data-page") || 0) || undefined;
      if (!key) return;
      const state: LastRead = { chapterId, verseKey: key, page, savedAt: Date.now() };
      setLastRead(state);
      window.localStorage.setItem(STORAGE.last, JSON.stringify(state));
    }, { threshold: [0.45, 0.7] });
    document.querySelectorAll("[data-verse-key]").forEach((element) => observerRef.current?.observe(element));
    return () => observerRef.current?.disconnect();
  }, [verses, chapterId]);

  const loadAudio = async () => {
    if (audioFiles.length) return audioFiles;
    const response = await fetch(`${API}/recitations/${reciterId}/by_chapter/${chapterId}?per_page=300&segments=true`);
    if (!response.ok) throw new Error("audio");
    const data = await response.json();
    const files = data.audio_files || data.audio_file ? (data.audio_files || [data.audio_file]) : [];
    setAudioFiles(files);
    return files as AudioFile[];
  };

  const playVerse = async (key: string, repeats = repeatCount) => {
    try {
      const files = await loadAudio();
      const file = files.find((item) => item.verse_key === key) || files[Number(key.split(":")[1]) - 1];
      const src = audioUrl(file);
      if (!src) throw new Error("audio");
      if (!audioRef.current) audioRef.current = new Audio();
      audioRef.current.pause();
      audioRef.current.src = src;
      repeatRef.current = Math.max(1, repeats);
      setPlayingKey(key);
      audioRef.current.onended = () => {
        repeatRef.current -= 1;
        if (repeatRef.current > 0 && audioRef.current) {
          audioRef.current.currentTime = 0;
          void audioRef.current.play();
        } else {
          setPlayingKey(null);
        }
      };
      await audioRef.current.play();
    } catch {
      setError("Audio is temporarily unavailable for this reciter. Try another reciter.");
    }
  };

  const playSelection = async () => {
    if (!focusVerses.length) return;
    let index = 0;
    const files = await loadAudio().catch(() => [] as AudioFile[]);
    if (!files.length) return;
    if (!audioRef.current) audioRef.current = new Audio();
    const playNext = () => {
      const verse = focusVerses[index];
      if (!verse) { setPlayingKey(null); return; }
      const file = files.find((item) => item.verse_key === verse.verse_key) || files[verse.verse_number - 1];
      const src = audioUrl(file);
      if (!src) { index += 1; playNext(); return; }
      setPlayingKey(verse.verse_key);
      audioRef.current!.src = src;
      audioRef.current!.onended = () => { index += 1; playNext(); };
      void audioRef.current!.play();
    };
    playNext();
  };

  const stopAudio = () => {
    audioRef.current?.pause();
    if (audioRef.current) audioRef.current.currentTime = 0;
    setPlayingKey(null);
  };

  const performSearch = async () => {
    const query = search.trim();
    if (!query) return;
    setSearching(true);
    setSearchResults([]);
    setError("");
    try {
      const response = await fetch(`${API}/search?q=${encodeURIComponent(query)}&size=30&page=1&language=en`);
      if (!response.ok) throw new Error("search");
      const data = await response.json();
      const results = data.search?.results || data.results || [];
      setSearchResults(results);
      if (!results.length) setError("No matching verses found. Try a shorter Arabic or English phrase.");
    } catch {
      const normalized = normalizeArabic(query);
      const local = verses.filter((verse) => normalizeArabic(verseText(verse)).includes(normalized) || stripHtml(verse.translations?.[0]?.text || "").toLowerCase().includes(query.toLowerCase()));
      setSearchResults(local.map((verse) => ({ verse_key: verse.verse_key, text: verseText(verse), translations: verse.translations })));
      if (!local.length) setError("Global search is temporarily unavailable. Search within the open Surah returned no matches.");
    } finally {
      setSearching(false);
    }
  };

  const openSearchResult = (result: SearchResult) => {
    const key = result.verse_key;
    if (!key) return;
    const targetChapter = Number(key.split(":")[0]);
    setSearchResults([]);
    setSearch("");
    if (targetChapter !== chapterId) {
      setChapterId(targetChapter);
      window.setTimeout(() => document.getElementById(`ayah-${key.replace(":", "-")}`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 900);
    } else {
      document.getElementById(`ayah-${key.replace(":", "-")}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

  const toggleSelection = (key: string) => {
    if (!selectionMode) {
      setSelectedVerse(key);
      return;
    }
    setSelectedKeys((current) => current.includes(key) ? current.filter((item) => item !== key) : [...current, key].sort((a, b) => Number(a.split(":")[1]) - Number(b.split(":")[1])));
  };

  const saveBookmark = (verse: Verse, word?: number) => {
    const item: Bookmark = {
      chapterId,
      verseKey: verse.verse_key,
      page: verse.page_number,
      word,
      savedAt: Date.now(),
      label: `${chapter?.name_simple || "Surah"} ${verse.verse_key}`,
    };
    setBookmarks((current) => [item, ...current.filter((bookmark) => bookmark.verseKey !== item.verseKey)].slice(0, 100));
  };

  const updateExactPosition = (verse: Verse, word: number) => {
    const state: LastRead = { chapterId, verseKey: verse.verse_key, page: verse.page_number, word, savedAt: Date.now() };
    setLastRead(state);
    window.localStorage.setItem(STORAGE.last, JSON.stringify(state));
  };

  const resumeReading = () => {
    if (!lastRead) return;
    if (lastRead.chapterId !== chapterId) setChapterId(lastRead.chapterId);
    window.setTimeout(() => {
      const target = document.getElementById(`ayah-${lastRead.verseKey.replace(":", "-")}`);
      target?.scrollIntoView({ behavior: "smooth", block: "center" });
      if (lastRead.word) target?.querySelector(`[data-word-position="${lastRead.word}"]`)?.classList.add("resume-word-flash");
    }, lastRead.chapterId === chapterId ? 50 : 850);
  };

  const startCoach = () => {
    const Recognition = (window as typeof window & { webkitSpeechRecognition?: new () => any; SpeechRecognition?: new () => any }).SpeechRecognition
      || (window as typeof window & { webkitSpeechRecognition?: new () => any }).webkitSpeechRecognition;
    if (!Recognition) {
      setError("Recitation listening is not supported by this browser. Chrome on Android is recommended.");
      return;
    }
    const recognition = new Recognition();
    recognition.lang = "ar-SA";
    recognition.interimResults = true;
    recognition.continuous = true;
    let finalText = "";
    recognition.onresult = (event: any) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const text = event.results[i][0]?.transcript || "";
        if (event.results[i].isFinal) finalText += ` ${text}`;
        else interim += ` ${text}`;
      }
      setCoachResult(compareRecitation(focusArabic, `${finalText} ${interim}`));
    };
    recognition.onerror = () => setCoachListening(false);
    recognition.onend = () => setCoachListening(false);
    setCoachResult(null);
    setCoachListening(true);
    recognition.start();
    (window as typeof window & { __woptRecognition?: any }).__woptRecognition = recognition;
  };

  const stopCoach = () => {
    (window as typeof window & { __woptRecognition?: any }).__woptRecognition?.stop?.();
    setCoachListening(false);
  };

  const currentTranslation = selectedVerse ? verses.find((verse) => verse.verse_key === selectedVerse) : null;

  return (
    <main className={`quran-app quran-theme-${settings.theme}`}>
      <header className="quran-topbar">
        <a className="quran-brand" href="/" aria-label="Back to prayer times"><span>و</span><div><strong>Windsor Qur’an</strong><small>Read · Listen · Memorize</small></div></a>
        <div className="quran-top-actions">
          <button type="button" onClick={() => setDrawer("surahs")}>Surahs</button>
          <button type="button" onClick={() => setDrawer("bookmarks")}>Bookmarks</button>
          <button type="button" onClick={() => setDrawer("settings")}>Aa</button>
        </div>
      </header>

      <section className="quran-command-zone">
        <div className="quran-heading-block">
          <p className="quran-kicker">THE HOLY QUR’AN</p>
          <h1>{chapter?.name_arabic || "القرآن الكريم"}</h1>
          <div className="quran-title-line"><strong>{chapter?.name_simple || "Qur’an"}</strong><span>{chapter?.translated_name?.name || ""}</span></div>
          {chapter && <p>{chapter.verses_count} verses{chapter.pages?.length ? ` · pages ${chapter.pages[0]}–${chapter.pages[chapter.pages.length - 1]}` : ""}</p>}
        </div>

        <div className="quran-search-wrap">
          <div className="quran-search-box">
            <span aria-hidden="true">⌕</span>
            <input value={search} onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => event.key === "Enter" && void performSearch()} placeholder="Search any Arabic or English word, phrase, or paste an ayah…" />
            <button type="button" onClick={() => void performSearch()} disabled={searching}>{searching ? "Searching…" : "Search"}</button>
          </div>
          {searchResults.length > 0 && (
            <div className="quran-search-results">
              <div className="search-results-head"><strong>{searchResults.length} matches</strong><button type="button" onClick={() => setSearchResults([])}>Close</button></div>
              {searchResults.map((result, index) => (
                <button className="quran-search-result" type="button" key={`${result.verse_key}-${index}`} onClick={() => openSearchResult(result)}>
                  <span>{result.verse_key}</span>
                  <div><p dir="rtl">{stripHtml(result.highlighted || result.text || "")}</p><small>{stripHtml(result.translations?.[0]?.text || "")}</small></div>
                </button>
              ))}
            </div>
          )}
        </div>

        {lastRead && (
          <button className="continue-card" type="button" onClick={resumeReading}>
            <span>Continue reading</span>
            <strong>{chapters.find((item) => item.id === lastRead.chapterId)?.name_simple || `Surah ${lastRead.chapterId}`} · {lastRead.verseKey}{lastRead.word ? ` · word ${lastRead.word}` : ""}</strong>
            <b>→</b>
          </button>
        )}
      </section>

      <section className="quran-reader-toolbar" aria-label="Qur’an reader tools">
        <div className="toolbar-group">
          <button className={settings.showTranslation ? "active" : ""} type="button" onClick={() => setSettings((value) => ({ ...value, showTranslation: !value.showTranslation }))}>Translation</button>
          <button className={settings.showTransliteration ? "active" : ""} type="button" onClick={() => setSettings((value) => ({ ...value, showTransliteration: !value.showTransliteration }))}>Transliteration</button>
          <button className={selectionMode ? "active" : ""} type="button" onClick={() => setSelectionMode((value) => !value)}>{selectionMode ? "Selecting…" : "Select ayat"}</button>
        </div>
        <div className="toolbar-group audio-tools">
          <select value={reciterId} onChange={(event) => { stopAudio(); setReciterId(Number(event.target.value)); setAudioFiles([]); }} aria-label="Choose reciter">
            {(reciters.length ? reciters : [{ id: 7, reciter_name: "Mishary Rashid Alafasy" }, { id: 3, reciter_name: "Abdur-Rahman as-Sudais" }, { id: 1, reciter_name: "AbdulBaset AbdulSamad" }]).map((reciter) => <option key={reciter.id} value={reciter.id}>{reciter.reciter_name}{reciter.style ? ` · ${reciter.style}` : ""}</option>)}
          </select>
          <button type="button" onClick={playingKey ? stopAudio : () => verses[0] && void playVerse(verses[0].verse_key)}>{playingKey ? "■ Stop" : "▶ Listen"}</button>
        </div>
        <button className="memorize-launch" type="button" onClick={() => setMemorizeOpen(true)}>✦ Memorize {selectedKeys.length ? `(${selectedKeys.length})` : ""}</button>
      </section>

      {error && <div className="quran-status-message">{error}<button type="button" onClick={() => setError("")}>×</button></div>}

      <section className="mushaf-shell">
        <div className="mushaf-page-head"><span>{chapter?.name_simple}</span><span>بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ</span><span>{chapter?.name_arabic}</span></div>
        {loading ? (
          <div className="quran-loading"><div /><p>Loading verified Qur’an text…</p></div>
        ) : (
          <div className="mushaf-text" dir="rtl" style={{ fontSize: `${settings.fontSize}px`, lineHeight: settings.lineHeight }}>
            {verses.map((verse) => {
              const selected = selectedKeys.includes(verse.verse_key);
              const words = verse.words?.length ? verse.words : verseText(verse).split(/\s+/).map((text, index) => ({ position: index + 1, text_uthmani: text }));
              return (
                <span
                  className={`mushaf-ayah ${selected ? "selected" : ""} ${playingKey === verse.verse_key ? "playing" : ""}`}
                  key={verse.verse_key}
                  id={`ayah-${verse.verse_key.replace(":", "-")}`}
                  data-verse-key={verse.verse_key}
                  data-page={verse.page_number || ""}
                  onClick={() => toggleSelection(verse.verse_key)}
                >
                  {words.map((word, index) => (
                    <button
                      className="quran-word"
                      type="button"
                      key={`${verse.verse_key}-${word.position || index}`}
                      data-word-position={word.position || index + 1}
                      onClick={(event) => { event.stopPropagation(); updateExactPosition(verse, word.position || index + 1); if (!selectionMode) setSelectedVerse(verse.verse_key); }}
                      title={word.translation?.text || word.transliteration?.text || ""}
                    >{word.text_uthmani || word.text}</button>
                  ))}
                  <button className="ayah-marker" type="button" onClick={(event) => { event.stopPropagation(); setSelectedVerse(verse.verse_key); }} aria-label={`Verse ${verse.verse_number}`}>۝{arabicNumber(verse.verse_number)}</button>{" "}
                  {settings.showTransliteration && <span className="inline-transliteration" dir="ltr">{verseTransliteration(verse)}</span>}
                  {settings.showTranslation && <span className="inline-translation" dir="ltr">{stripHtml(verse.translations?.[0]?.text || "")}</span>}
                </span>
              );
            })}
          </div>
        )}
        <div className="mushaf-page-foot"><span>Juz {verses[0]?.juz_number || "—"}</span><span>{lastRead?.page ? `Page ${lastRead.page}` : "Hassoun Qur’an Reader"}</span></div>
      </section>

      {selectedVerse && currentTranslation && (
        <aside className="verse-action-dock">
          <div><strong>{currentTranslation.verse_key}</strong><span>Verse tools</span></div>
          <button type="button" onClick={() => void playVerse(currentTranslation.verse_key)}>▶ Play</button>
          <button type="button" onClick={() => saveBookmark(currentTranslation)}>☆ Save</button>
          <button type="button" onClick={() => { setSelectedKeys([currentTranslation.verse_key]); setMemorizeOpen(true); }}>✦ Memorize</button>
          <button type="button" onClick={() => navigator.clipboard.writeText(`${verseText(currentTranslation)}\n${stripHtml(currentTranslation.translations?.[0]?.text || "")}\n${currentTranslation.verse_key}`)}>Copy</button>
          <button className="dock-close" type="button" onClick={() => setSelectedVerse(null)}>×</button>
        </aside>
      )}

      <nav className="quran-mobile-nav" aria-label="Primary navigation">
        <a href="/"><span>◷</span>Today</a>
        <a className="active" href="/quran"><span>۞</span>Qur’an</a>
        <a href="/?open=alerts"><span>◔</span>Alerts</a>
        <a href="/?open=settings"><span>⚙</span>Settings</a>
      </nav>

      {drawer && (
        <div className="quran-drawer-backdrop" onMouseDown={() => setDrawer(null)}>
          <aside className="quran-drawer" onMouseDown={(event) => event.stopPropagation()}>
            <div className="quran-drawer-head"><div><p>QUR’AN</p><h2>{drawer === "surahs" ? "Choose a Surah" : drawer === "bookmarks" ? "Saved places" : "Reader settings"}</h2></div><button type="button" onClick={() => setDrawer(null)}>×</button></div>
            {drawer === "surahs" && <div className="surah-list">{chapters.map((item) => <button className={item.id === chapterId ? "current" : ""} type="button" key={item.id} onClick={() => { setChapterId(item.id); setDrawer(null); window.scrollTo({ top: 0, behavior: "smooth" }); }}><span>{item.id}</span><div><strong>{item.name_simple}</strong><small>{item.translated_name?.name} · {item.verses_count} ayat</small></div><b>{item.name_arabic}</b></button>)}</div>}
            {drawer === "bookmarks" && <div className="bookmark-list">{bookmarks.length ? bookmarks.map((bookmark) => <button type="button" key={`${bookmark.verseKey}-${bookmark.savedAt}`} onClick={() => { setChapterId(bookmark.chapterId); setDrawer(null); window.setTimeout(() => document.getElementById(`ayah-${bookmark.verseKey.replace(":", "-")}`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 800); }}><div><strong>{bookmark.label}</strong><small>{bookmark.page ? `Page ${bookmark.page}` : "Saved verse"}{bookmark.word ? ` · word ${bookmark.word}` : ""}</small></div><span>→</span></button>) : <div className="empty-state">Tap a verse, then choose <b>Save</b>. Your bookmarks stay on this device.</div>}</div>}
            {drawer === "settings" && <div className="reader-settings">
              <label><span>Arabic size <b>{settings.fontSize}px</b></span><input type="range" min="28" max="64" value={settings.fontSize} onChange={(event) => setSettings((value) => ({ ...value, fontSize: Number(event.target.value) }))} /></label>
              <label><span>Line spacing <b>{settings.lineHeight.toFixed(1)}</b></span><input type="range" min="1.5" max="2.8" step="0.1" value={settings.lineHeight} onChange={(event) => setSettings((value) => ({ ...value, lineHeight: Number(event.target.value) }))} /></label>
              <div className="theme-buttons"><button className={settings.theme === "paper" ? "active" : ""} onClick={() => setSettings((value) => ({ ...value, theme: "paper" }))}>Paper</button><button className={settings.theme === "sepia" ? "active" : ""} onClick={() => setSettings((value) => ({ ...value, theme: "sepia" }))}>Sepia</button><button className={settings.theme === "night" ? "active" : ""} onClick={() => setSettings((value) => ({ ...value, theme: "night" }))}>Night</button></div>
              <div className="setting-switch"><div><strong>Translation</strong><small>Show English verse meaning beneath each ayah.</small></div><button className={settings.showTranslation ? "on" : ""} onClick={() => setSettings((value) => ({ ...value, showTranslation: !value.showTranslation }))}><span /></button></div>
              <div className="setting-switch"><div><strong>English-letter Arabic</strong><small>Show transliteration from the verified word data.</small></div><button className={settings.showTransliteration ? "on" : ""} onClick={() => setSettings((value) => ({ ...value, showTransliteration: !value.showTransliteration }))}><span /></button></div>
            </div>}
          </aside>
        </div>
      )}

      {memorizeOpen && (
        <div className="memorize-overlay">
          <section className="memorize-workspace">
            <header><div><p>SMART STUDY</p><h2>Memorize & Recite</h2><span>{focusVerses.length} ayah{focusVerses.length === 1 ? "" : "s"} selected · {chapter?.name_simple}</span></div><button type="button" onClick={() => { stopCoach(); stopAudio(); setMemorizeOpen(false); }}>×</button></header>
            <div className="memorize-controls">
              <div className="memory-stage"><button className={memorizeStep === "read" ? "active" : ""} onClick={() => setMemorizeStep("read")}>Read</button><button className={memorizeStep === "first" ? "active" : ""} onClick={() => setMemorizeStep("first")}>First-word hints</button><button className={memorizeStep === "hidden" ? "active" : ""} onClick={() => setMemorizeStep("hidden")}>Recall</button></div>
              <div className="memory-audio"><select value={reciterId} onChange={(event) => { setReciterId(Number(event.target.value)); setAudioFiles([]); }}>{reciters.map((reciter) => <option key={reciter.id} value={reciter.id}>{reciter.reciter_name}</option>)}</select><select value={repeatCount} onChange={(event) => setRepeatCount(Number(event.target.value))}><option value="1">Play once</option><option value="2">Repeat ×2</option><option value="3">Repeat ×3</option><option value="5">Repeat ×5</option><option value="10">Repeat ×10</option></select><button onClick={() => void playSelection()}>▶ Play selection</button></div>
            </div>

            <div className={`memorize-text stage-${memorizeStep}`} dir="rtl">
              {focusVerses.map((verse) => {
                const words = verse.words?.length ? verse.words : verseText(verse).split(/\s+/).map((text, index) => ({ position: index + 1, text_uthmani: text }));
                return <div className={playingKey === verse.verse_key ? "playing" : ""} key={verse.verse_key}>
                  <p className="memory-arabic">
                    {memorizeStep === "hidden" ? <button className="reveal-ayah" type="button" onClick={(event) => event.currentTarget.classList.toggle("revealed")}>Tap to reveal {verse.verse_key}<span>{verseText(verse)} ۝{arabicNumber(verse.verse_number)}</span></button> : words.map((word, index) => <span className={memorizeStep === "first" && index > 0 ? "memory-hidden-word" : ""} key={index}>{word.text_uthmani || word.text} </span>)}
                    {memorizeStep !== "hidden" && <b>۝{arabicNumber(verse.verse_number)}</b>}
                  </p>
                  <p className="memory-transliteration" dir="ltr">{verseTransliteration(verse)}</p>
                  <p className="memory-translation" dir="ltr">{stripHtml(verse.translations?.[0]?.text || "")}</p>
                  <div className="memory-verse-actions"><button onClick={() => void playVerse(verse.verse_key, repeatCount)}>▶ Ayah</button><button onClick={() => saveBookmark(verse)}>☆ Save</button></div>
                </div>;
              })}
            </div>

            <section className="recitation-coach">
              <div className="coach-heading"><span>AI RECITATION COACH</span><h3>Recite the selected passage</h3><p>Uses Arabic speech recognition to compare the words and sequence you recite with the selected Qur’an text. It does not alter the Qur’an and is not a replacement for a qualified tajweed teacher.</p></div>
              <div className="coach-action-row"><button className={coachListening ? "recording" : ""} onClick={coachListening ? stopCoach : startCoach}>{coachListening ? "■ Stop listening" : "● Start reciting"}</button>{coachResult && <div className="coach-score"><strong>{coachResult.score}%</strong><span>{coachResult.matched} of {coachResult.total} words matched</span></div>}</div>
              {coachResult && <div className="coach-feedback"><div><strong>What the phone heard</strong><p dir="rtl">{coachResult.heard || "Listening…"}</p></div><div><strong>Words to review</strong><p dir="rtl">{coachResult.missed.length ? coachResult.missed.join(" · ") : "Excellent sequence match."}</p></div></div>}
            </section>
          </section>
        </div>
      )}
    </main>
  );
}
