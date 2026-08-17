import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Clipboard from "expo-clipboard";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  BackHandler,
  FlatList,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  useWindowDimensions
} from "react-native";
import QuranAudio, { type QuranAudioStatus } from "../../modules/quran-audio";
import SmartMemorize from "./SmartMemorize";
import {
  absoluteIndex,
  allPages,
  allSurahs,
  getAyah,
  getSurah,
  getSurahAyahs,
  juzForAyah,
  pageForAyah,
  quranReady,
  searchQuran,
  type QuranAyah,
  type QuranLocale,
  type QuranSearchResult,
  type QuranSurah
} from "./quranData";
import {
  QuranPageText,
  ReaderSettingsSheet,
  quranPageBackground,
  useQuranAppearance
} from "./quranRendering";

type Props = {
  locale: QuranLocale;
  onBackHome: () => void;
  onAppNavVisibilityChange?: (visible: boolean) => void;
  onLocalAudioSurfaceChange?: (visible: boolean) => void;
};
type Screen = "home" | "surahs" | "search" | "bookmarks" | "reader" | "memorize" | "radio";
type Position = { surah: number; ayah: number };
type ReaderMode = "mushaf" | "study";
type Range = { surah: number; start: number; end: number };

type AudioPrefs = {
  readerMode: ReaderMode;
  highlightAudio: boolean;
  reciter: string;
  speed: number;
};

type Reciter = { id: string; en: string; ar: string; bitrate: number };

const KEYS = {
  last: "wopt:quran:last:v3",
  bookmarks: "wopt:quran:bookmarks:v3",
  audioPrefs: "wopt:quran:audio-prefs:v3",
  memorize: "wopt:quran:memorize:v3",
  radioPlaylist: "wopt:quran:radio-playlist:v1"
};

const DEFAULT_AUDIO_PREFS: AudioPrefs = {
  readerMode: "mushaf",
  highlightAudio: true,
  reciter: "ar.alafasy",
  speed: 1
};

const RECITERS: Reciter[] = [
  { id: "ar.alafasy", en: "Mishary Alafasy", ar: "مشاري العفاسي", bitrate: 128 },
  { id: "ar.husary", en: "Mahmoud Al-Husary", ar: "محمود الحصري", bitrate: 128 },
  { id: "ar.minshawi", en: "Al-Minshawi", ar: "محمد صديق المنشاوي", bitrate: 128 },
  { id: "ar.sudais", en: "Abdul Rahman Al-Sudais", ar: "عبدالرحمن السديس", bitrate: 192 },
  { id: "ar.shuraim", en: "Saud Al-Shuraim", ar: "سعود الشريم", bitrate: 128 },
  { id: "ar.abdulbasit", en: "Abdul Basit", ar: "عبد الباسط عبد الصمد", bitrate: 192 },
  { id: "ar.hudhaify", en: "Ali Al-Hudhaify", ar: "علي الحذيفي", bitrate: 128 }
];

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function refKey(position: Position) {
  return `${position.surah}:${position.ayah}`;
}

function formatTime(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

function reciterInfo(id: string) {
  return RECITERS.find((item) => item.id === id) ?? RECITERS[0]!;
}

function audioUrl(ayah: QuranAyah, reciterId: string) {
  const reciter = reciterInfo(reciterId);
  return `https://cdn.islamic.network/quran/audio/${reciter.bitrate}/${reciter.id}/${absoluteIndex(ayah.surah, ayah.ayah) + 1}.mp3`;
}

function pageAyahsFor(page: number, pages: Array<{ page: number; surah: number; ayah: number }>) {
  const start = pages[page - 1];
  if (!start) return [] as QuranAyah[];
  const next = pages[page];
  const startAbs = absoluteIndex(start.surah, start.ayah);
  const endAbs = next ? absoluteIndex(next.surah, next.ayah) : Number.POSITIVE_INFINITY;
  const out: QuranAyah[] = [];
  for (let surahNumber = start.surah; surahNumber <= 114; surahNumber += 1) {
    for (const ayah of getSurahAyahs(surahNumber)) {
      const index = absoluteIndex(ayah.surah, ayah.ayah);
      if (index < startAbs) continue;
      if (index >= endAbs) return out;
      out.push(ayah);
    }
    if (next && surahNumber > next.surah) break;
  }
  return out;
}

function pageSegmentsFor(page: number, pages: Array<{ page: number; surah: number; ayah: number }>) {
  const segments: Array<{ surah: number; ayahs: QuranAyah[] }> = [];
  for (const ayah of pageAyahsFor(page, pages)) {
    const previous = segments[segments.length - 1];
    if (!previous || previous.surah !== ayah.surah) segments.push({ surah: ayah.surah, ayahs: [ayah] });
    else previous.ayahs.push(ayah);
  }
  return segments;
}

function buildSurahQueue(startSurah: number, endSurah: number) {
  const queue: QuranAyah[] = [];
  for (let surah = clamp(startSurah, 1, 114); surah <= clamp(endSurah, 1, 114); surah += 1) {
    queue.push(...getSurahAyahs(surah));
  }
  return queue;
}

export default function QuranV3({ locale, onBackHome, onAppNavVisibilityChange, onLocalAudioSurfaceChange }: Props) {
  const { width } = useWindowDimensions();
  const ar = locale === "ar";
  const tr = (en: string, arabic: string) => ar ? arabic : en;
  const num = (value: number) => ar ? new Intl.NumberFormat("ar").format(value) : String(value);

  const [screen, setScreen] = useState<Screen>("home");
  const [backTarget, setBackTarget] = useState<Screen>("home");
  const [position, setPosition] = useState<Position>({ surah: 1, ayah: 1 });
  const [lastPosition, setLastPosition] = useState<Position | null>(null);
  const [bookmarks, setBookmarks] = useState<string[]>([]);
  const [bookmarkNotice, setBookmarkNotice] = useState<string | null>(null);
  const [audioPrefs, setAudioPrefs] = useState<AudioPrefs>(DEFAULT_AUDIO_PREFS);
  const [selectedAyah, setSelectedAyah] = useState<QuranAyah | null>(null);
  const [memorizeRange, setMemorizeRange] = useState<Range | null>(null);
  const [memorizeHidden, setMemorizeHidden] = useState(false);
  const [query, setQuery] = useState("");
  const [pageJump, setPageJump] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [appearanceOpen, setAppearanceOpen] = useState(false);
  const [playerVisible, setPlayerVisible] = useState(true);
  const [copiedSelection, setCopiedSelection] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const [radioSurah, setRadioSurah] = useState(1);
  const [radioPlaylist, setRadioPlaylist] = useState<number[]>([]);
  const [radioStartSurah, setRadioStartSurah] = useState(1);
  const [radioEndSurah, setRadioEndSurah] = useState(114);
  const [radioOngoing, setRadioOngoing] = useState(true);

  const [audioQueue, setAudioQueue] = useState<QuranAyah[]>([]);
  const [audioIndex, setAudioIndex] = useState(-1);
  const [repeatQueue, setRepeatQueue] = useState(false);
  const [audioStatus, setAudioStatus] = useState<QuranAudioStatus>({
    available: Boolean(QuranAudio),
    state: "idle",
    positionMs: 0,
    durationMs: 0,
    speed: 1
  });
  const completionRef = useRef<string | null>(null);
  const appNavHideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const verticalGestureStartY = useRef<number | null>(null);
  const readerTapStart = useRef<{ x: number; y: number; time: number } | null>(null);
  const readerAtTop = useRef(true);
  const readerAtBottom = useRef(false);

  const { appearance, setAppearance, reset: resetAppearance } = useQuranAppearance();
  const surahs = allSurahs();
  const pages = allPages();
  const readerSurah = getSurah(position.surah);
  const readerAyahs = useMemo(() => getSurahAyahs(position.surah), [position.surah]);
  const searchResults = useMemo(() => query.trim() ? searchQuran(query, 100) : [], [query]);
  const currentPage = pageForAyah(position.surah, position.ayah) ?? 1;
  const currentJuz = juzForAyah(position.surah, position.ayah) ?? 1;
  const activeAyah = audioIndex >= 0 ? audioQueue[audioIndex] : undefined;
  const activeReciter = reciterInfo(audioPrefs.reciter);
  const playerAyah = activeAyah ?? (screen === "reader" ? getAyah(position.surah, position.ayah) : undefined);
  const playerSurah = playerAyah ? getSurah(playerAyah.surah) : undefined;
  const selectedIsActive = Boolean(selectedAyah && activeAyah && selectedAyah.surah === activeAyah.surah && selectedAyah.ayah === activeAyah.ayah);
  const selectedIsPlaying = selectedIsActive && audioStatus.state === "playing";
  const selectedIsPaused = selectedIsActive && audioStatus.state === "paused";
  const selectedIsLooping = selectedIsActive && repeatQueue && audioQueue.length === 1;
  const selectedIsBookmarked = Boolean(selectedAyah && bookmarks.includes(refKey(selectedAyah)));
  const autoSpread = width >= 700;
  const spreadMode = appearance.bookMode === "spread" || (appearance.bookMode === "auto" && autoSpread);

  // Reader, Radio and the Quran menu own the audio controls while they are visible.
  // Everywhere else, App.tsx may show the single global persistent player.
  useEffect(() => {
    onLocalAudioSurfaceChange?.(screen === "reader" || screen === "radio" || menuOpen);
  }, [screen, menuOpen, onLocalAudioSurfaceChange]);

  useEffect(() => () => {
    onLocalAudioSurfaceChange?.(false);
  }, [onLocalAudioSurfaceChange]);

  useEffect(() => {
    void (async () => {
      const [savedLast, savedBookmarks, savedAudioPrefs, savedMemorize, savedRadioPlaylist] = await Promise.all([
        AsyncStorage.getItem(KEYS.last),
        AsyncStorage.getItem(KEYS.bookmarks),
        AsyncStorage.getItem(KEYS.audioPrefs),
        AsyncStorage.getItem(KEYS.memorize),
        AsyncStorage.getItem(KEYS.radioPlaylist)
      ]);
      try { if (savedLast) setLastPosition(JSON.parse(savedLast) as Position); } catch {}
      try { if (savedBookmarks) setBookmarks(JSON.parse(savedBookmarks) as string[]); } catch {}
      try { if (savedAudioPrefs) setAudioPrefs({ ...DEFAULT_AUDIO_PREFS, ...JSON.parse(savedAudioPrefs) }); } catch {}
      try { if (savedMemorize) setMemorizeRange(JSON.parse(savedMemorize) as Range); } catch {}
      try { if (savedRadioPlaylist) setRadioPlaylist(JSON.parse(savedRadioPlaylist) as number[]); } catch {}
      setLoaded(true);
    })();
  }, []);

  const persistAudioPrefs = (patch: Partial<AudioPrefs>) => {
    setAudioPrefs((current) => {
      const next = { ...current, ...patch };
      void AsyncStorage.setItem(KEYS.audioPrefs, JSON.stringify(next));
      return next;
    });
  };

  const persistLast = (next: Position) => {
    setLastPosition(next);
    void AsyncStorage.setItem(KEYS.last, JSON.stringify(next));
  };

  const persistPlaylist = (next: number[]) => {
    setRadioPlaylist(next);
    void AsyncStorage.setItem(KEYS.radioPlaylist, JSON.stringify(next));
  };

  const openReader = (surah: number, ayah = 1, from: Screen = screen) => {
    const target = getAyah(surah, ayah);
    if (!target) return;
    const next = { surah: target.surah, ayah: target.ayah };
    setPosition(next);
    setSelectedAyah(null);
    setBackTarget(from === "reader" ? "home" : from);
    persistLast(next);
    setScreen("reader");
  };

  const openPage = (page: number) => {
    const safe = clamp(page, 1, 604);
    const start = pages[safe - 1];
    if (!start) return;
    const next = { surah: start.surah, ayah: start.ayah };
    readerAtTop.current = true;
    readerAtBottom.current = false;
    setPosition(next);
    setSelectedAyah(null);
    persistLast(next);
  };

  const turnReaderPage = (direction: -1 | 1) => {
    if (spreadMode) {
      const left = currentPage === 1 ? 1 : currentPage % 2 === 0 ? currentPage : currentPage - 1;
      openPage(direction > 0 ? Math.min(604, left + 2) : Math.max(1, left - 2));
      return;
    }
    openPage(clamp(currentPage + direction, 1, 604));
  };

  const readerPanResponder = useMemo(
    () => PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponderCapture: (_event, gestureState) => {
        if (appearance.browseMode !== "horizontal") return false;
        const horizontal = Math.abs(gestureState.dx);
        const vertical = Math.abs(gestureState.dy);
        return horizontal > 12 && horizontal > vertical * 1.15;
      },
      onPanResponderTerminationRequest: () => false,
      onPanResponderRelease: (_event, gestureState) => {
        if (appearance.browseMode !== "horizontal") return;
        const distance = Math.abs(gestureState.dx);
        const speed = Math.abs(gestureState.vx);
        if (distance < 48 && speed < 0.35) return;
        // Arabic-book direction: higher / next pages live to the left.
        // Swipe right to advance to the next page; swipe left to go back.
        turnReaderPage(gestureState.dx > 0 ? 1 : -1);
      }
    }),
    [appearance.browseMode, currentPage, spreadMode]
  );

  const handleVerticalTouchStart = (event: { nativeEvent: { pageY: number } }) => {
    if (appearance.browseMode !== "vertical") return;
    verticalGestureStartY.current = event.nativeEvent.pageY;
  };

  const handleVerticalTouchEnd = (event: { nativeEvent: { pageY: number } }) => {
    if (appearance.browseMode !== "vertical") {
      verticalGestureStartY.current = null;
      return;
    }
    const start = verticalGestureStartY.current;
    verticalGestureStartY.current = null;
    if (start == null) return;
    const dy = event.nativeEvent.pageY - start;
    if (Math.abs(dy) < 60) return;
    if (dy < 0 && readerAtBottom.current) turnReaderPage(1);
    else if (dy > 0 && readerAtTop.current) turnReaderPage(-1);
  };


  const handleReaderSurfaceTouchStart = (event: { nativeEvent: { pageX: number; pageY: number } }) => {
    readerTapStart.current = { x: event.nativeEvent.pageX, y: event.nativeEvent.pageY, time: Date.now() };
  };

  const handleReaderSurfaceTouchEnd = (event: { nativeEvent: { pageX: number; pageY: number } }) => {
    const start = readerTapStart.current;
    readerTapStart.current = null;
    if (!start) return;
    const dx = event.nativeEvent.pageX - start.x;
    const dy = event.nativeEvent.pageY - start.y;
    const elapsed = Date.now() - start.time;
    if (Math.abs(dx) <= 10 && Math.abs(dy) <= 10 && elapsed <= 350) {
      setPlayerVisible((visible) => !visible);
    }
  };

  const handleBack = () => {
    if (appearanceOpen) { setAppearanceOpen(false); return true; }
    if (menuOpen) { setMenuOpen(false); return true; }
    if (screen === "home") { onBackHome(); return true; }
    if (screen === "reader") { setScreen(backTarget); return true; }
    setScreen("home");
    return true;
  };

  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", handleBack);
    return () => subscription.remove();
  }, [screen, backTarget, menuOpen, appearanceOpen]);

  const clearAppNavTimer = () => {
    if (appNavHideTimer.current) {
      clearTimeout(appNavHideTimer.current);
      appNavHideTimer.current = null;
    }
  };

  const scheduleAppNavHide = () => {
    clearAppNavTimer();
    appNavHideTimer.current = setTimeout(() => {
      onAppNavVisibilityChange?.(false);
      appNavHideTimer.current = null;
    }, 1800);
  };

  const revealAppNav = () => {
    if (screen === "reader" || screen === "radio") return;
    onAppNavVisibilityChange?.(true);
    if (screen !== "home") scheduleAppNavHide();
  };

  useEffect(() => {
    clearAppNavTimer();
    if (screen === "reader" || screen === "radio") {
      onAppNavVisibilityChange?.(false);
      return;
    }
    onAppNavVisibilityChange?.(true);
    if (screen !== "home") scheduleAppNavHide();
    return clearAppNavTimer;
  }, [screen, onAppNavVisibilityChange]);

  useEffect(() => () => {
    clearAppNavTimer();
    onAppNavVisibilityChange?.(true);
  }, [onAppNavVisibilityChange]);

  const toggleBookmark = (ayah: QuranAyah) => {
    const key = refKey(ayah);
    const alreadySaved = bookmarks.includes(key);
    const next = alreadySaved ? bookmarks.filter((item) => item !== key) : [key, ...bookmarks];
    setBookmarks(next);
    void AsyncStorage.setItem(KEYS.bookmarks, JSON.stringify(next));
    const surahName = ar ? getSurah(ayah.surah)?.nameArabic : getSurah(ayah.surah)?.nameTransliterated;
    setBookmarkNotice(alreadySaved
      ? tr(`Bookmark removed • ${surahName ?? "Qur’an"} ${ayah.surah}:${ayah.ayah}`, `تمت إزالة العلامة • ${surahName ?? "القرآن"} ${num(ayah.surah)}:${num(ayah.ayah)}`)
      : tr(`Bookmarked • ${surahName ?? "Qur’an"} ${ayah.surah}:${ayah.ayah}`, `تم الحفظ في العلامات • ${surahName ?? "القرآن"} ${num(ayah.surah)}:${num(ayah.ayah)}`));
  };

  useEffect(() => {
    if (!bookmarkNotice) return;
    const timer = setTimeout(() => setBookmarkNotice(null), 1800);
    return () => clearTimeout(timer);
  }, [bookmarkNotice]);

  const startMemorizing = (ayah: QuranAyah) => {
    const next = { surah: ayah.surah, start: ayah.ayah, end: ayah.ayah };
    setMemorizeRange(next);
    setMemorizeHidden(false);
    void AsyncStorage.setItem(KEYS.memorize, JSON.stringify(next));
    setScreen("memorize");
  };

  const nativeQueuePayload = (queue: QuranAyah[], reciterId = audioPrefs.reciter) => JSON.stringify(
    queue.map((ayah) => {
      const surah = getSurah(ayah.surah);
      const reciter = reciterInfo(reciterId);
      return {
        url: audioUrl(ayah, reciterId),
        title: `${ar ? surah?.nameArabic : surah?.nameTransliterated ?? `Surah ${ayah.surah}`} • ${tr("Ayah", "الآية")} ${num(ayah.ayah)}`,
        subtitle: `${ar ? reciter.ar : reciter.en} • Hassoun`
      };
    })
  );

  const playNativeAyah = (ayah: QuranAyah, reciterId = audioPrefs.reciter) => {
    if (!QuranAudio) return;
    completionRef.current = null;
    QuranAudio.playQueue(nativeQueuePayload([ayah], reciterId), 0, false, audioPrefs.speed);
  };

  const playQueue = (queue: QuranAyah[], repeat = false) => {
    const first = queue[0];
    if (!first || !QuranAudio) return;
    setAudioQueue(queue);
    setAudioIndex(0);
    setRepeatQueue(repeat);
    completionRef.current = null;
    QuranAudio.playQueue(nativeQueuePayload(queue), 0, repeat, audioPrefs.speed);
  };

  const playAyah = (ayah: QuranAyah, repeat = false) => playQueue([ayah], repeat);
  const playSurah = (surah: number, repeat = false) => playQueue(getSurahAyahs(surah), repeat);

  const toggleSelectedPlayback = (ayah: QuranAyah) => {
    const sameAyah = activeAyah?.surah === ayah.surah && activeAyah?.ayah === ayah.ayah;
    if (!sameAyah) {
      playAyah(ayah, false);
      return;
    }
    if (audioStatus.state === "playing") QuranAudio?.pause();
    else if (audioStatus.state === "paused") QuranAudio?.resume();
    else playAyah(ayah, repeatQueue);
  };

  const stopSelectedPlayback = () => {
    QuranAudio?.stop();
    setAudioQueue([]);
    setAudioIndex(-1);
    setRepeatQueue(false);
    completionRef.current = null;
  };

  const replaySelected = (ayah: QuranAyah) => {
    playAyah(ayah, false);
  };

  const toggleSelectedLoop = (ayah: QuranAyah) => {
    const sameAyah = activeAyah?.surah === ayah.surah && activeAyah?.ayah === ayah.ayah && audioQueue.length === 1;
    if (!sameAyah) {
      playAyah(ayah, true);
      return;
    }
    const nextRepeat = !repeatQueue;
    setRepeatQueue(nextRepeat);
    QuranAudio?.setRepeat(nextRepeat);
    if (audioStatus.state === "completed" || audioStatus.state === "idle") playAyah(ayah, nextRepeat);
  };

  const copySelectedText = async (ayah: QuranAyah) => {
    await Clipboard.setStringAsync(ayah.text);
    setCopiedSelection(true);
    setTimeout(() => setCopiedSelection(false), 1400);
  };

  const translateSelectedText = async (ayah: QuranAyah) => {
    try {
      const response = await fetch(`https://api.alquran.cloud/v1/ayah/${ayah.surah}:${ayah.ayah}/en.sahih`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json() as { data?: { text?: string } };
      const translation = payload.data?.text?.trim();
      if (!translation) throw new Error("No translation returned");
      const surahName = getSurah(ayah.surah)?.nameTransliterated ?? `Surah ${ayah.surah}`;
      Alert.alert(`${surahName} • Ayah ${ayah.ayah}`, translation);
    } catch {
      Alert.alert(tr("Translation unavailable", "الترجمة غير متاحة"), tr("Please check your internet connection and try again.", "تحقق من اتصال الإنترنت وحاول مرة أخرى."));
    }
  };

  const togglePlayerPlayback = () => {
    if (audioStatus.state === "playing") { QuranAudio?.pause(); return; }
    if (audioStatus.state === "paused" || audioStatus.state === "completed") { QuranAudio?.resume(); return; }
    if (!activeAyah) { playSurah(position.surah, false); return; }
    QuranAudio?.resume();
  };

  const playPlaylist = (repeat = false) => {
    const queue: QuranAyah[] = [];
    for (const surah of radioPlaylist) queue.push(...getSurahAyahs(surah));
    playQueue(queue, repeat);
  };

  const playFullQuranRange = (repeat = false) => {
    const end = radioOngoing ? 114 : Math.max(radioStartSurah, radioEndSurah);
    playQueue(buildSurahQueue(radioStartSurah, end), repeat);
  };

  const stopAudio = () => {
    QuranAudio?.stop();
    setAudioQueue([]);
    setAudioIndex(-1);
    setRepeatQueue(false);
    setAudioStatus({ available: Boolean(QuranAudio), state: "idle", positionMs: 0, durationMs: 0, speed: audioPrefs.speed });
  };

  const nextAudio = () => {
    QuranAudio?.next();
  };

  const previousAudio = () => {
    QuranAudio?.previous();
  };

  useEffect(() => {
    const timer = setInterval(() => {
      if (!QuranAudio) return;
      const status = QuranAudio.getStatus();
      setAudioStatus(status);
      if (typeof status.queueIndex === "number" && status.queueIndex >= 0 && status.queueIndex < audioQueue.length) {
        setAudioIndex((current) => current === status.queueIndex ? current : status.queueIndex!);
      }
      if (typeof status.repeat === "boolean") setRepeatQueue(status.repeat);
      if (status.state === "idle" && audioQueue.length) {
        setAudioQueue([]);
        setAudioIndex(-1);
        setRepeatQueue(false);
      }
    }, 450);
    return () => clearInterval(timer);
  }, [audioQueue.length]);

  useEffect(() => {
    if (!activeAyah) return;
    persistLast({ surah: activeAyah.surah, ayah: activeAyah.ayah });
  }, [audioIndex]);

  const updateReciter = (id: string) => {
    persistAudioPrefs({ reciter: id });
    if (audioQueue.length) {
      const startIndex = Math.max(0, audioIndex);
      setTimeout(() => QuranAudio?.playQueue(nativeQueuePayload(audioQueue, id), startIndex, repeatQueue, audioPrefs.speed), 20);
    }
  };

  const updateSpeed = (speed: number) => {
    const safe = Math.round(clamp(speed, 0.5, 2) * 10) / 10;
    persistAudioPrefs({ speed: safe });
    QuranAudio?.setSpeed(safe);
  };


  if (!quranReady()) {
    return <View style={styles.centered}><Text style={styles.big}>📖</Text><Text style={styles.centerTitle}>{tr("Qur’an data unavailable", "بيانات القرآن غير متاحة")}</Text><Pressable onPress={onBackHome} style={styles.primary}><Text style={styles.primaryText}>{tr("Back", "رجوع")}</Text></Pressable></View>;
  }
  if (!loaded) return <View style={styles.centered}><Text>{tr("Loading Qur’an…", "جارٍ تحميل القرآن…")}</Text></View>;

  const topBar = (title: string, subtitle?: string) => (
    <View style={styles.topBar}>
      <Pressable onPress={handleBack} style={styles.iconButton}><Text style={styles.back}>{ar ? "›" : "‹"}</Text></Pressable>
      <View style={styles.topCopy}><Text style={[styles.topTitle, ar && styles.rtl]}>{title}</Text>{subtitle ? <Text style={[styles.topSubtitle, ar && styles.rtl]}>{subtitle}</Text> : null}</View>
      <Pressable onPress={() => setMenuOpen(true)} style={styles.topMenuButton}><Text style={styles.topMenuIcon}>☰</Text></Pressable>
    </View>
  );

  const miniPlayer = playerAyah ? (
    <View style={styles.miniPlayer}>
      <Pressable disabled={!activeAyah} onPress={() => QuranAudio?.seekBy(-10000)} style={[styles.playerControl, !activeAyah && styles.playerControlDisabled]}><Text style={styles.playerControlText}>−10</Text></Pressable>
      <Pressable onPress={togglePlayerPlayback} style={styles.playerMain}><Text style={styles.playerMainText}>{audioStatus.state === "playing" ? "Ⅱ" : "▶"}</Text></Pressable>
      <Pressable disabled={!activeAyah} onPress={() => QuranAudio?.seekBy(10000)} style={[styles.playerControl, !activeAyah && styles.playerControlDisabled]}><Text style={styles.playerControlText}>+10</Text></Pressable>
      <Pressable onPress={() => updateSpeed(audioPrefs.speed >= 2 ? 0.5 : audioPrefs.speed + 0.1)} style={styles.playerSpeedPill}><Text style={styles.playerSpeedText}>{audioPrefs.speed.toFixed(1)}×</Text></Pressable>
    </View>
  ) : null;

  const home = (
    <ScrollView style={styles.flex} contentContainerStyle={styles.homeContent} showsVerticalScrollIndicator={false}>
      <View style={styles.heroHeader}>
        <Pressable onPress={onBackHome} style={styles.iconButton}><Text style={styles.back}>{ar ? "›" : "‹"}</Text></Pressable>
        <View style={styles.topCopy}><Text style={styles.eyebrow}>🌙 {tr("HASSOUN QUR’AN", "قرآن Hassoun")}</Text><Text style={[styles.heroTitle, ar && styles.rtl]}>{tr("The Noble Qur’an", "القرآن الكريم")}</Text><Text style={[styles.heroSub, ar && styles.rtl]}>{tr("Read • listen • memorize", "اقرأ • استمع • احفظ")}</Text></View>
        <View style={styles.verifiedBadge}><Text style={styles.verifiedText}>✓ {tr("Verified", "موثّق")}</Text></View>
      </View>

      <Pressable onPress={() => setScreen("search")} style={styles.searchBox}><Text style={styles.searchIcon}>⌕</Text><Text style={[styles.searchPlaceholder, ar && styles.rtl]}>{tr("Search any word, ayah or Surah", "ابحث بكلمة أو آية أو سورة")}</Text></Pressable>

      <Pressable onPress={() => openReader(lastPosition?.surah ?? 1, lastPosition?.ayah ?? 1, "home")} style={styles.continueCard}>
        <View style={styles.continueIconBubble}><Text style={styles.continueIcon}>📖</Text></View>
        <View style={styles.topCopy}><Text style={styles.continueEyebrow}>✨ {tr("CONTINUE READING", "تابع القراءة")}</Text><Text style={[styles.continueTitle, ar && styles.rtl]}>{lastPosition ? (ar ? getSurah(lastPosition.surah)?.nameArabic : getSurah(lastPosition.surah)?.nameTransliterated) : tr("Al-Faatiha", "الفاتحة")}</Text><Text style={[styles.continueMeta, ar && styles.rtl]}>{lastPosition ? tr(`Ayah ${lastPosition.ayah} • Page ${pageForAyah(lastPosition.surah, lastPosition.ayah) ?? "—"}`, `الآية ${num(lastPosition.ayah)} • الصفحة ${num(pageForAyah(lastPosition.surah, lastPosition.ayah) ?? 0)}`) : tr("Begin from the opening of the Qur’an", "ابدأ من فاتحة الكتاب")}</Text></View>
        <Text style={styles.lightArrow}>{ar ? "‹" : "›"}</Text>
      </Pressable>

      <Text style={[styles.sectionHeading, ar && styles.rtl]}>{tr("Explore", "استكشف")}</Text>
      <View style={styles.grid}>
        <Pressable onPress={() => setScreen("surahs")} style={styles.gridCard}><View style={styles.gridIcon}><Text style={styles.gridEmoji}>🕋</Text></View><Text style={styles.gridTitle}>{tr("Surahs", "السور")}</Text><Text style={styles.gridMeta}>{tr("114 Surahs", `${num(114)} سورة`)}</Text></Pressable>
        <Pressable onPress={() => setScreen("radio")} style={[styles.gridCard, styles.radioGridCard]}><View style={[styles.gridIcon, styles.radioGridIcon]}><Text style={styles.gridEmoji}>📻</Text></View><Text style={styles.gridTitle}>{tr("Qur’an Radio", "إذاعة القرآن")}</Text><Text style={styles.gridMeta}>{tr("Reciters • playlists • full Qur’an", "قراء • قوائم • القرآن كاملاً")}</Text></Pressable>
        <Pressable onPress={() => setScreen("bookmarks")} style={styles.gridCard}><View style={styles.gridIcon}><Text style={styles.gridEmoji}>🔖</Text></View><Text style={styles.gridTitle}>{tr("Bookmarks", "العلامات")}</Text><Text style={styles.gridMeta}>{tr(`${bookmarks.length} saved`, `${num(bookmarks.length)} محفوظة`)}</Text></Pressable>
        <Pressable onPress={() => memorizeRange ? setScreen("memorize") : openReader(lastPosition?.surah ?? 1, lastPosition?.ayah ?? 1, "home")} style={styles.gridCard}><View style={styles.gridIcon}><Text style={styles.gridEmoji}>📿</Text></View><Text style={styles.gridTitle}>{tr("Memorize", "الحفظ")}</Text><Text style={styles.gridMeta}>{tr("Focused practice", "مراجعة مركزة")}</Text></Pressable>
      </View>

      <View style={styles.infoCard}><Text style={styles.infoIcon}>✓</Text><View style={styles.topCopy}><Text style={styles.infoTitle}>{tr("Verified Uthmani Qur’an", "نص عثماني موثّق")}</Text><Text style={styles.infoText}>{tr("Exact Mushaf fonts, Tajweed mode, and local verified Arabic text fallback.", "خطوط المصحف الدقيقة، وضع التجويد، ونص عربي موثّق محفوظ محلياً.")}</Text></View></View>
    </ScrollView>
  );

  const surahList = (
    <View style={styles.flex}>{topBar(tr("Surahs", "السور"), tr("114 Surahs", `${num(114)} سورة`))}<FlatList data={surahs} keyExtractor={(item) => String(item.number)} contentContainerStyle={styles.listContent} renderItem={({ item }) => <Pressable onPress={() => openReader(item.number, 1, "surahs")} style={styles.row}><View style={styles.numberBadge}><Text style={styles.numberText}>{num(item.number)}</Text></View><View style={styles.topCopy}><Text style={[styles.rowTitle, ar && styles.rtl]}>{ar ? item.nameArabic : item.nameTransliterated}</Text><Text style={[styles.rowMeta, ar && styles.rtl]}>{ar ? `${num(item.ayahCount)} آية` : `${item.nameEnglish} • ${item.ayahCount} ayahs`}</Text></View><Text style={styles.rowArabic}>{item.nameArabic}</Text></Pressable>} /></View>
  );

  const search = (
    <View style={styles.flex}>{topBar(tr("Search Qur’an", "البحث في القرآن"), tr("Arabic text, Surah name or number", "كلمة عربية أو اسم سورة أو رقمها"))}<View style={styles.searchInputWrap}><TextInput value={query} onChangeText={setQuery} autoFocus placeholder={tr("Search الرحمة, Al-Kahf, 18…", "ابحث: الرحمة، الكهف، ١٨…")} placeholderTextColor="#8a938f" style={[styles.searchInput, ar && styles.rtl]} /></View><FlatList<QuranSearchResult> data={searchResults} keyExtractor={(item, index) => item.kind === "surah" ? `s-${item.surah.number}-${index}` : `a-${item.ayah?.surah}-${item.ayah?.ayah}`} contentContainerStyle={styles.listContent} ListEmptyComponent={<Text style={styles.empty}>{query.trim() ? tr("No matches found", "لا توجد نتائج") : tr("Type to search", "اكتب للبحث")}</Text>} renderItem={({ item }) => <Pressable onPress={() => openReader(item.surah.number, item.ayah?.ayah ?? 1, "search")} style={styles.searchResult}><Text style={styles.resultTitle}>{ar ? item.surah.nameArabic : item.surah.nameTransliterated} {item.ayah ? `${num(item.surah.number)}:${num(item.ayah.ayah)}` : ""}</Text>{item.ayah ? <Text style={styles.resultArabic} numberOfLines={3}>{item.ayah.text}</Text> : <Text style={styles.rowMeta}>{item.surah.nameEnglish}</Text>}</Pressable>} /></View>
  );

  const bookmarkAyahs = bookmarks.map((key) => {
    const parts = key.split(":").map(Number);
    const surah = parts[0];
    const ayah = parts[1];
    return surah && ayah ? getAyah(surah, ayah) : undefined;
  }).filter(Boolean) as QuranAyah[];

  const bookmarkScreen = (
    <View style={styles.flex}>{topBar(tr("Bookmarks", "العلامات"), tr(`${bookmarkAyahs.length} saved ayahs`, `${num(bookmarkAyahs.length)} آية محفوظة`))}<FlatList data={bookmarkAyahs} keyExtractor={refKey} contentContainerStyle={styles.listContent} ListEmptyComponent={<Text style={styles.empty}>{tr("Tap an ayah in the Mushaf and save it here.", "اضغط على آية في المصحف ثم احفظها هنا.")}</Text>} renderItem={({ item }) => <Pressable onPress={() => openReader(item.surah, item.ayah, "bookmarks")} style={styles.bookmarkCard}><Text style={styles.bookmarkRef}>🔖 {ar ? getSurah(item.surah)?.nameArabic : getSurah(item.surah)?.nameTransliterated} {num(item.surah)}:{num(item.ayah)}</Text><Text style={styles.bookmarkArabic}>{item.text}</Text></Pressable>} /></View>
  );

  const surahStepper = (value: number, onChange: (next: number) => void) => {
    const surah = getSurah(value);
    return <View style={styles.surahStepper}><Pressable onPress={() => onChange(clamp(value - 1, 1, 114))} style={styles.stepperButton}><Text style={styles.stepperButtonText}>−</Text></Pressable><View style={styles.surahStepperCopy}><Text style={styles.surahStepperNumber}>{tr(`Surah ${value}`, `سورة ${num(value)}`)}</Text><Text style={styles.surahStepperName}>{ar ? surah?.nameArabic : surah?.nameTransliterated}</Text></View><Pressable onPress={() => onChange(clamp(value + 1, 1, 114))} style={styles.stepperButton}><Text style={styles.stepperButtonText}>+</Text></Pressable></View>;
  };

  const radioAudioActive = audioStatus.state !== "idle" && audioStatus.state !== "error";
  const radioProgress = audioStatus.durationMs > 0 ? Math.min(1, Math.max(0, audioStatus.positionMs / audioStatus.durationMs)) : 0;
  const radioRemaining = Math.max(0, audioStatus.durationMs - audioStatus.positionMs);

  const radioScreen = (
    <ScrollView style={styles.flex} contentContainerStyle={styles.radioContent} showsVerticalScrollIndicator={false}>
      {topBar(tr("Qur’an Radio", "إذاعة القرآن"), tr("A richer continuous listening studio", "استماع قرآني متواصل وتحكم كامل"))}

      <View style={styles.radioStudioHero}>
        <View style={styles.radioStudioTop}>
          <View style={styles.radioStudioBadge}><Text style={styles.radioStudioBadgeIcon}>{radioAudioActive ? "🎧" : "📻"}</Text></View>
          <View style={styles.topCopy}>
            <Text style={[styles.radioStudioEyebrow, ar && styles.rtl]}>{radioAudioActive ? tr("NOW PLAYING", "يعمل الآن") : tr("HASSOUN QUR’AN AUDIO", "صوت القرآن • حسّون")}</Text>
            <Text numberOfLines={1} style={[styles.radioStudioTitle, ar && styles.rtl]}>{radioAudioActive ? (audioStatus.title || tr("Qur’an playback", "تشغيل القرآن")) : tr("Your Qur’an listening studio", "استوديو الاستماع للقرآن")}</Text>
            <Text numberOfLines={1} style={[styles.radioStudioMeta, ar && styles.rtl]}>{radioAudioActive ? (audioStatus.subtitle || (ar ? activeReciter.ar : activeReciter.en)) : tr("Choose a reciter, Surah, playlist, or continuous range.", "اختر القارئ أو السورة أو قائمة تشغيل أو نطاقاً متواصلاً.")}</Text>
          </View>
          {radioAudioActive ? <Pressable onPress={stopAudio} style={styles.radioHeroStop}><Text style={styles.radioHeroStopText}>■</Text></Pressable> : null}
        </View>

        {radioAudioActive ? (
          <>
            <View style={styles.radioProgressTrack}><View style={[styles.radioProgressFill, { width: `${Math.max(2, radioProgress * 100)}%` }]} /></View>
            <View style={styles.radioTimeRow}><Text style={styles.radioTimeText}>{formatTime(audioStatus.positionMs)}</Text><Text style={styles.radioTimeText}>−{formatTime(radioRemaining)}</Text></View>
            <View style={styles.radioTransportRow}>
              <Pressable onPress={previousAudio} style={styles.radioTransportSide}><Text style={styles.radioTransportArrow}>‹</Text></Pressable>
              <Pressable onPress={() => QuranAudio?.seekBy(-10000)} style={styles.radioTransportMini}><Text style={styles.radioTransportMiniText}>−10</Text></Pressable>
              <Pressable onPress={togglePlayerPlayback} style={styles.radioTransportMain}><Text style={styles.radioTransportMainText}>{audioStatus.state === "playing" ? "Ⅱ" : "▶"}</Text></Pressable>
              <Pressable onPress={() => QuranAudio?.seekBy(10000)} style={styles.radioTransportMini}><Text style={styles.radioTransportMiniText}>+10</Text></Pressable>
              <Pressable onPress={nextAudio} style={styles.radioTransportSide}><Text style={styles.radioTransportArrow}>›</Text></Pressable>
            </View>
            <View style={styles.radioQuickRow}>
              <Pressable onPress={() => { const next = !repeatQueue; setRepeatQueue(next); QuranAudio?.setRepeat(next); }} style={[styles.radioQuickPill, repeatQueue && styles.radioQuickPillActive]}><Text style={[styles.radioQuickText, repeatQueue && styles.radioQuickTextActive]}>∞ {tr("Loop", "تكرار")}</Text></Pressable>
              <Pressable onPress={() => updateSpeed(audioPrefs.speed >= 2 ? 0.5 : audioPrefs.speed + 0.1)} style={styles.radioQuickPill}><Text style={styles.radioQuickText}>{audioPrefs.speed.toFixed(1)}× {tr("Speed", "السرعة")}</Text></Pressable>
              <View style={styles.radioQueuePill}><Text style={styles.radioQueueText}>{audioStatus.queueSize ?? audioQueue.length} {tr("items", "مقطع")}</Text></View>
            </View>
          </>
        ) : null}
      </View>

      <View style={styles.radioSectionHead}><View><Text style={styles.radioSectionKicker}>{tr("VOICE", "الصوت")}</Text><Text style={styles.radioSectionTitle}>{tr("Choose your reciter", "اختر القارئ")}</Text></View><Text style={styles.radioSectionHint}>🎙️</Text></View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.reciterRow}>{RECITERS.map((item) => <Pressable key={item.id} onPress={() => updateReciter(item.id)} style={[styles.reciterChip, audioPrefs.reciter === item.id && styles.reciterChipActive]}><Text style={[styles.reciterChipText, audioPrefs.reciter === item.id && styles.reciterChipTextActive]}>{ar ? item.ar : item.en}</Text></Pressable>)}</ScrollView>

      <View style={styles.radioStudioCard}>
        <View style={styles.radioCardHeader}><View style={styles.radioCardIconWrap}><Text style={styles.radioCardIconText}>▶</Text></View><View style={styles.topCopy}><Text style={styles.radioStudioCardTitle}>{tr("Play a Surah", "تشغيل سورة")}</Text><Text style={styles.radioStudioCardMeta}>{tr("Listen once, keep it looping, or save it to your queue.", "استمع مرة أو كرر السورة أو أضفها إلى قائمتك.")}</Text></View></View>
        {surahStepper(radioSurah, setRadioSurah)}
        <View style={styles.radioPillActions}>
          <Pressable onPress={() => playSurah(radioSurah, false)} style={styles.radioPrimaryPill}><Text style={styles.radioPrimaryPillIcon}>▶</Text><Text style={styles.radioPrimaryPillText}>{tr("Play", "تشغيل")}</Text></Pressable>
          <Pressable onPress={() => playSurah(radioSurah, true)} style={styles.radioGlassPill}><Text style={styles.radioGlassPillText}>∞ {tr("Loop", "تكرار")}</Text></Pressable>
          <Pressable onPress={() => { if (!radioPlaylist.includes(radioSurah)) persistPlaylist([...radioPlaylist, radioSurah]); }} style={styles.radioGlassPill}><Text style={styles.radioGlassPillText}>＋ {tr("Queue", "القائمة")}</Text></Pressable>
        </View>
      </View>

      <View style={styles.radioStudioCard}>
        <View style={styles.radioCardHeader}><View style={styles.radioCardIconWrap}><Text style={styles.radioCardIconText}>♫</Text></View><View style={styles.topCopy}><Text style={styles.radioStudioCardTitle}>{tr("My listening queue", "قائمة الاستماع")}</Text><Text style={styles.radioStudioCardMeta}>{radioPlaylist.length ? tr(`${radioPlaylist.length} Surahs ready to play`, `${num(radioPlaylist.length)} سور جاهزة للتشغيل`) : tr("Build a playlist from the Surah player above.", "أضف سوراً من المشغل أعلاه لإنشاء قائمتك.")}</Text></View>{radioPlaylist.length ? <Pressable onPress={() => persistPlaylist([])} style={styles.clearPill}><Text style={styles.clearPillText}>{tr("Clear", "مسح")}</Text></Pressable> : null}</View>
        {radioPlaylist.length ? <View style={styles.playlistWrap}>{radioPlaylist.map((surahNumber, index) => { const surah = getSurah(surahNumber); return <View key={`${surahNumber}-${index}`} style={styles.playlistItem}><View style={styles.playlistNumber}><Text style={styles.playlistNumberText}>{index + 1}</Text></View><View style={styles.topCopy}><Text style={styles.playlistTitle}>{ar ? surah?.nameArabic : surah?.nameTransliterated}</Text><Text style={styles.playlistMeta}>{tr(`Surah ${surahNumber}`, `سورة ${num(surahNumber)}`)}</Text></View><Pressable onPress={() => persistPlaylist(radioPlaylist.filter((_item, itemIndex) => itemIndex !== index))} style={styles.removePlaylist}><Text style={styles.removePlaylistText}>×</Text></Pressable></View>; })}</View> : <View style={styles.radioEmptyQueue}><Text style={styles.radioEmptyQueueIcon}>🎵</Text><Text style={styles.radioEmptyQueueText}>{tr("Your queue is empty", "قائمة التشغيل فارغة")}</Text></View>}
        <View style={styles.radioPillActions}>
          <Pressable disabled={!radioPlaylist.length} onPress={() => playPlaylist(false)} style={[styles.radioPrimaryPill, !radioPlaylist.length && styles.disabled]}><Text style={styles.radioPrimaryPillIcon}>▶</Text><Text style={styles.radioPrimaryPillText}>{tr("Play queue", "تشغيل القائمة")}</Text></Pressable>
          <Pressable disabled={!radioPlaylist.length} onPress={() => playPlaylist(true)} style={[styles.radioGlassPill, !radioPlaylist.length && styles.disabled]}><Text style={styles.radioGlassPillText}>∞ {tr("Loop", "تكرار")}</Text></Pressable>
        </View>
      </View>

      <View style={[styles.radioStudioCard, styles.radioContinuousCard]}>
        <View style={styles.radioCardHeader}><View style={[styles.radioCardIconWrap, styles.radioMoonWrap]}><Text style={styles.radioCardIconText}>☾</Text></View><View style={styles.topCopy}><Text style={styles.radioStudioCardTitle}>{tr("Continuous Qur’an", "القرآن المتواصل")}</Text><Text style={styles.radioStudioCardMeta}>{tr("Start anywhere and let Hassoun continue through the Qur’an, even with the screen locked.", "ابدأ من أي سورة ودع حسّون يواصل التلاوة حتى مع قفل الشاشة.")}</Text></View></View>
        <Text style={styles.radioFieldLabel}>{tr("START FROM", "ابدأ من")}</Text>
        {surahStepper(radioStartSurah, (next) => { setRadioStartSurah(next); if (radioEndSurah < next) setRadioEndSurah(next); })}
        <View style={styles.ongoingRow}><View style={styles.topCopy}><Text style={styles.ongoingTitle}>{tr("Continue to the end", "الاستمرار إلى النهاية")}</Text><Text style={styles.ongoingText}>{tr("Turn this off if you want a specific ending Surah.", "أوقفه إذا أردت تحديد سورة للنهاية.")}</Text></View><Switch value={radioOngoing} onValueChange={setRadioOngoing} /></View>
        {!radioOngoing ? <><Text style={styles.radioFieldLabel}>{tr("STOP AFTER", "توقف بعد")}</Text>{surahStepper(radioEndSurah, (next) => setRadioEndSurah(Math.max(radioStartSurah, next)))}</> : null}
        <View style={styles.radioPillActions}>
          <Pressable onPress={() => playFullQuranRange(false)} style={styles.radioPrimaryPill}><Text style={styles.radioPrimaryPillIcon}>▶</Text><Text style={styles.radioPrimaryPillText}>{tr("Start listening", "ابدأ الاستماع")}</Text></Pressable>
          <Pressable onPress={() => playFullQuranRange(true)} style={styles.radioGlassPill}><Text style={styles.radioGlassPillText}>∞ {tr("Loop range", "تكرار النطاق")}</Text></Pressable>
        </View>
      </View>
    </ScrollView>
  );

  const renderMushafPage = (page: number) => {
    const segments = pageSegmentsFor(page, pages);
    const pageStart = pages[page - 1];
    const pageJuz = pageStart ? juzForAyah(pageStart.surah, pageStart.ayah) ?? currentJuz : currentJuz;
    const firstSurah = segments[0] ? getSurah(segments[0].surah) : undefined;
    return (
      <View style={[styles.mushafPage, { backgroundColor: quranPageBackground(appearance.pageTheme) }]}>
        <View style={styles.pageTopLine}><Text style={styles.pageMeta}>{firstSurah?.nameArabic ?? ""}</Text><Text style={styles.pageMeta}>{tr(`Juz ${pageJuz}`, `الجزء ${num(pageJuz)}`)}</Text></View>
        {segments.map((segment) => {
          const segmentSurah = getSurah(segment.surah);
          const beginsSurah = segment.ayahs[0]?.ayah === 1;
          const showStandaloneBasmala = beginsSurah && segment.surah !== 1 && segment.surah !== 9 && (appearance.tajweed || appearance.font === "qpc-hafs");
          const textColor = appearance.pageTheme === "dark" && appearance.textColor === "#111111" ? "#f2efe7" : appearance.textColor;
          return (
            <View key={`${page}-${segment.surah}`}>
              {beginsSurah ? (
                <View style={styles.surahFrame}>
                  <View style={styles.surahFrameInner}>
                    <View style={styles.surahFrameSide}>
                      <View style={styles.surahFrameDiamond} />
                      <View style={styles.surahFrameLine} />
                      <View style={styles.surahFrameDiamondSmall} />
                    </View>
                    <Text
                      style={styles.surahFrameText}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.72}
                    >{`سورة ${segmentSurah?.nameArabic ?? ""}`}</Text>
                    <View style={styles.surahFrameSide}>
                      <View style={styles.surahFrameDiamondSmall} />
                      <View style={styles.surahFrameLine} />
                      <View style={styles.surahFrameDiamond} />
                    </View>
                  </View>
                </View>
              ) : null}
              {showStandaloneBasmala ? <Text style={[styles.basmala, { color: textColor, fontSize: Math.max(21, appearance.fontSize - 3), lineHeight: Math.round(Math.max(21, appearance.fontSize - 3) * appearance.lineHeightMultiplier) }]}>بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ</Text> : null}
              <QuranPageText page={page} ayahs={segment.ayahs} appearance={appearance} locale={locale} selectedKey={selectedAyah ? refKey(selectedAyah) : null} highlightedKey={audioPrefs.highlightAudio && activeAyah ? refKey(activeAyah) : null} bookmarkedKeys={bookmarks} onPressAyah={(ayah) => { setSelectedAyah((current) => current?.surah === ayah.surah && current?.ayah === ayah.ayah ? null : ayah); persistLast({ surah: ayah.surah, ayah: ayah.ayah }); }} />
            </View>
          );
        })}
        <View style={styles.pageBottom}><Text style={styles.pageNumber}>{num(page)}</Text></View>
      </View>
    );
  };

  const spreadLeftPage = currentPage === 1 ? null : currentPage % 2 === 0 ? currentPage : currentPage - 1;
  const spreadRightPage = currentPage === 1 ? 1 : Math.min(604, (spreadLeftPage ?? 1) + 1);
  const previousBookPage = spreadMode ? Math.max(1, (spreadLeftPage ?? 2) - 2) : currentPage - 1;
  const nextBookPage = spreadMode ? Math.min(604, (spreadLeftPage ?? 0) + 2) : currentPage + 1;

  const reader = readerSurah ? (
    <View style={styles.flex}>
      {topBar(ar ? readerSurah.nameArabic : readerSurah.nameTransliterated, tr(`Page ${currentPage} • Juz ${currentJuz}`, `الصفحة ${num(currentPage)} • الجزء ${num(currentJuz)}`))}
      {audioPrefs.readerMode === "mushaf" ? (
        <View style={styles.readerBody} onTouchStart={handleReaderSurfaceTouchStart} onTouchEnd={handleReaderSurfaceTouchEnd} {...readerPanResponder.panHandlers}>
          <ScrollView
            key={`mushaf-${currentPage}-${appearance.browseMode}`}
            style={styles.flex}
            contentContainerStyle={[styles.bookCanvas, spreadMode && styles.bookCanvasSpread]}
            showsVerticalScrollIndicator={false}
            scrollEventThrottle={16}
            onTouchStart={handleVerticalTouchStart}
            onTouchEnd={handleVerticalTouchEnd}
            onScroll={({ nativeEvent }) => {
              readerAtTop.current = nativeEvent.contentOffset.y <= 8;
              readerAtBottom.current = nativeEvent.contentOffset.y + nativeEvent.layoutMeasurement.height >= nativeEvent.contentSize.height - 8;
            }}
          >
            {spreadMode ? <View style={styles.bookSpread}>{spreadLeftPage ? <View style={styles.bookPageSlot}>{renderMushafPage(spreadLeftPage)}</View> : <View style={[styles.bookPageSlot, styles.blankBookPage]} /> }<View style={styles.bookGutter} /><View style={styles.bookPageSlot}>{renderMushafPage(spreadRightPage)}</View></View> : renderMushafPage(currentPage)}
          </ScrollView>
        </View>
      ) : (
        <ScrollView style={styles.flex} contentContainerStyle={styles.studyWrap} showsVerticalScrollIndicator={false}><View style={styles.studySurahHeader}><Text style={styles.studySurahArabic}>{readerSurah.nameArabic}</Text>{!ar ? <Text style={styles.studySurahEnglish}>{readerSurah.nameTransliterated} • {readerSurah.nameEnglish}</Text> : null}</View>{readerAyahs.map((ayah) => { const playing = activeAyah?.surah === ayah.surah && activeAyah?.ayah === ayah.ayah && audioPrefs.highlightAudio; return <Pressable key={refKey(ayah)} onPress={() => { setSelectedAyah(ayah); persistLast({ surah: ayah.surah, ayah: ayah.ayah }); }} style={[styles.studyAyah, playing && styles.studyPlaying]}><View style={styles.studyTop}><View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}><Text style={styles.ayahPill}>{num(ayah.ayah)}</Text>{bookmarks.includes(refKey(ayah)) ? <Text style={{ fontSize: 16 }}>🔖</Text> : null}</View><Pressable onPress={() => playAyah(ayah)} style={styles.smallPlay}><Text>▶️</Text></Pressable></View><Text style={[styles.studyArabic, { fontSize: appearance.fontSize, lineHeight: Math.round(appearance.fontSize * appearance.lineHeightMultiplier) }]}>{ayah.text}</Text></Pressable>; })}</ScrollView>
      )}
      {selectedAyah ? (
        <View style={styles.ayahActions}>
          <View style={styles.actionHeader}>
            <View style={styles.actionDot} />
            <Text style={styles.actionRef} numberOfLines={1}>{ar ? getSurah(selectedAyah.surah)?.nameArabic : getSurah(selectedAyah.surah)?.nameTransliterated} • {tr("Ayah", "الآية")} {num(selectedAyah.ayah)}</Text>
            <Pressable onPress={() => setSelectedAyah(null)} style={styles.actionClose}><Text style={styles.actionCloseText}>×</Text></Pressable>
          </View>
          <View style={styles.actionTransport}>
            <Pressable onPress={() => toggleSelectedPlayback(selectedAyah)} style={[styles.actionCircle, styles.actionCircleMain]}>
              <Text style={styles.actionCircleMainIcon}>{selectedIsPlaying ? "Ⅱ" : "▶"}</Text>
              <Text style={styles.actionCircleMainLabel}>{selectedIsPlaying ? tr("Pause", "إيقاف مؤقت") : selectedIsPaused ? tr("Resume", "متابعة") : tr("Play", "تشغيل")}</Text>
            </Pressable>
            <Pressable disabled={!selectedIsActive} onPress={stopSelectedPlayback} style={[styles.actionCircle, !selectedIsActive && styles.actionDisabled]}>
              <Text style={styles.actionCircleIcon}>■</Text><Text style={styles.actionCircleLabel}>{tr("Stop", "إيقاف")}</Text>
            </Pressable>
            <Pressable onPress={() => replaySelected(selectedAyah)} style={styles.actionCircle}>
              <Text style={styles.actionCircleIcon}>↻</Text><Text style={styles.actionCircleLabel}>{tr("Replay", "إعادة")}</Text>
            </Pressable>
            <Pressable onPress={() => toggleSelectedLoop(selectedAyah)} style={[styles.actionCircle, selectedIsLooping && styles.actionCircleActive]}>
              <Text style={styles.actionCircleIcon}>∞</Text><Text style={styles.actionCircleLabel}>{selectedIsLooping ? tr("Loop on", "تكرار مفعل") : tr("Loop", "تكرار")}</Text>
            </Pressable>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.actionTools}>
            <Pressable onPress={() => translateSelectedText(selectedAyah)} style={styles.actionTool}><Text style={styles.actionToolIcon}>文</Text><Text style={styles.actionToolLabel}>{tr("Translate", "ترجمة")}</Text></Pressable>
            <Pressable onPress={() => copySelectedText(selectedAyah)} style={[styles.actionTool, copiedSelection && styles.actionToolActive]}><Text style={styles.actionToolIcon}>⧉</Text><Text style={[styles.actionToolLabel, copiedSelection && styles.actionToolLabelActive]}>{copiedSelection ? tr("Copied", "تم النسخ") : tr("Copy", "نسخ")}</Text></Pressable>
            <Pressable onPress={() => toggleBookmark(selectedAyah)} style={[styles.actionTool, selectedIsBookmarked && styles.actionToolActive]}><Text style={styles.actionToolIcon}>{selectedIsBookmarked ? "🔖" : "♡"}</Text><Text style={[styles.actionToolLabel, selectedIsBookmarked && styles.actionToolLabelActive]}>{selectedIsBookmarked ? tr("Saved", "محفوظ") : tr("Bookmark", "علامة")}</Text></Pressable>
            <Pressable onPress={() => startMemorizing(selectedAyah)} style={styles.actionTool}><Text style={styles.actionToolIcon}>◌</Text><Text style={styles.actionToolLabel}>{tr("Memorize", "حفظ")}</Text></Pressable>
          </ScrollView>
        </View>
      ) : null}
    </View>
  ) : null;

  const memorize = memorizeRange ? (
    <ScrollView style={styles.flex} contentContainerStyle={styles.memoryWrap} showsVerticalScrollIndicator={false}>{topBar(tr("Memorize", "الحفظ"), `${ar ? getSurah(memorizeRange.surah)?.nameArabic : getSurah(memorizeRange.surah)?.nameTransliterated} • ${num(memorizeRange.start)}–${num(memorizeRange.end)}`)}<View style={styles.memoryControls}><Pressable onPress={() => playQueue(getSurahAyahs(memorizeRange.surah).slice(memorizeRange.start - 1, memorizeRange.end), true)} style={styles.memoryButton}><Text style={styles.memoryButtonText}>🔁 {tr("Repeat selection", "تكرار المقطع")}</Text></Pressable><Pressable onPress={() => setMemorizeHidden((value) => !value)} style={styles.memoryButton}><Text style={styles.memoryButtonText}>{memorizeHidden ? `👁️ ${tr("Reveal", "إظهار")}` : `🙈 ${tr("Hide Arabic", "إخفاء النص")}`}</Text></Pressable></View>{getSurahAyahs(memorizeRange.surah).slice(memorizeRange.start - 1, memorizeRange.end).map((ayah) => <View key={refKey(ayah)} style={styles.memoryCard}><Text style={styles.bookmarkRef}>{num(ayah.ayah)}</Text><Text style={[styles.memoryArabic, memorizeHidden && styles.hidden]}>{memorizeHidden ? "••••••••••••••••" : ayah.text}</Text></View>)}</ScrollView>
  ) : <View style={styles.centered}><Text style={styles.big}>📿</Text><Text style={styles.centerTitle}>{tr("Choose an ayah first", "اختر آية أولاً")}</Text><Pressable onPress={() => setScreen("surahs")} style={styles.primary}><Text style={styles.primaryText}>{tr("Choose Surah", "اختر سورة")}</Text></Pressable></View>;

  const menu = (
    <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}>
      <Pressable style={styles.menuBackdrop} onPress={() => setMenuOpen(false)}>
        <Pressable style={styles.menuSheet} onPress={(event) => event.stopPropagation()}>
          <View style={styles.menuHero}><View style={styles.menuMoon}><Text style={styles.menuMoonText}>☾</Text></View><View style={styles.topCopy}><Text style={[styles.menuTitle, ar && styles.rtl]}>{tr("Qur’an Menu", "قائمة القرآن")}</Text><Text style={[styles.menuSubtitle, ar && styles.rtl]}>{tr("Read, listen and navigate", "قراءة واستماع وتنقل")}</Text></View><Pressable onPress={() => setMenuOpen(false)} style={styles.menuClose}><Text style={styles.menuCloseText}>×</Text></Pressable></View>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.menuContent}>
            <Text style={styles.menuSectionLabel}>{tr("QUICK ACCESS", "وصول سريع")}</Text>
            <View style={styles.menuQuickGrid}><Pressable onPress={() => { setScreen("surahs"); setMenuOpen(false); }} style={styles.menuQuickCard}><Text style={styles.menuQuickIcon}>🕋</Text><Text style={styles.menuQuickTitle}>{tr("Surahs", "السور")}</Text></Pressable><Pressable onPress={() => { setScreen("search"); setMenuOpen(false); }} style={styles.menuQuickCard}><Text style={styles.menuQuickIcon}>⌕</Text><Text style={styles.menuQuickTitle}>{tr("Search", "بحث")}</Text></Pressable><Pressable onPress={() => { setScreen("bookmarks"); setMenuOpen(false); }} style={styles.menuQuickCard}><Text style={styles.menuQuickIcon}>🔖</Text><Text style={styles.menuQuickTitle}>{tr("Bookmarks", "العلامات")}</Text></Pressable><Pressable onPress={() => { setScreen("radio"); setMenuOpen(false); }} style={[styles.menuQuickCard, styles.menuQuickRadio]}><Text style={styles.menuQuickIcon}>📻</Text><Text style={styles.menuQuickTitle}>{tr("Qur’an Radio", "إذاعة القرآن")}</Text></Pressable></View>

            <View style={styles.menuElegantCard}><View style={styles.menuCardHeader}><View style={styles.menuCardIcon}><Text>🎧</Text></View><View style={styles.topCopy}><Text style={styles.menuCardTitle}>{tr("Listening", "الاستماع")}</Text><Text style={styles.menuCardSubtitle}>{ar ? activeReciter.ar : activeReciter.en} · {audioPrefs.speed.toFixed(1)}×</Text></View></View><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.reciterRow}>{RECITERS.map((item) => <Pressable key={item.id} onPress={() => updateReciter(item.id)} style={[styles.reciterChip, audioPrefs.reciter === item.id && styles.reciterChipActive]}><Text style={[styles.reciterChipText, audioPrefs.reciter === item.id && styles.reciterChipTextActive]}>{ar ? item.ar : item.en}</Text></Pressable>)}</ScrollView><View style={styles.speedRow}><Text style={styles.speedLabel}>{tr("Speed", "السرعة")}</Text><Pressable onPress={() => updateSpeed(audioPrefs.speed - 0.1)} style={styles.speedButton}><Text style={styles.speedButtonText}>−</Text></Pressable><Text style={styles.speedValue}>{audioPrefs.speed.toFixed(1)}×</Text><Pressable onPress={() => updateSpeed(audioPrefs.speed + 0.1)} style={styles.speedButton}><Text style={styles.speedButtonText}>+</Text></Pressable></View>{activeAyah ? <View style={styles.transport}><Pressable onPress={() => QuranAudio?.seekBy(-10000)} style={styles.transportButton}><Text>↩ 10</Text></Pressable><Pressable onPress={() => audioStatus.state === "playing" ? QuranAudio?.pause() : QuranAudio?.resume()} style={styles.transportMain}><Text>{audioStatus.state === "playing" ? "⏸" : "▶"}</Text></Pressable><Pressable onPress={() => QuranAudio?.seekBy(10000)} style={styles.transportButton}><Text>10 ↪</Text></Pressable><Pressable onPress={stopAudio} style={styles.transportButton}><Text>⏹</Text></Pressable></View> : null}</View>

            <View style={styles.menuElegantCard}><View style={styles.menuCardHeader}><View style={styles.menuCardIcon}><Text>📖</Text></View><View style={styles.topCopy}><Text style={styles.menuCardTitle}>{tr("Reading", "القراءة")}</Text><Text style={styles.menuCardSubtitle}>{appearance.font === "qcf-v2" ? "King Fahad Complex V2" : appearance.font === "qcf-v1" ? "King Fahad Complex V1" : "QPC Uthmani Hafs"}</Text></View></View><Pressable onPress={() => { setMenuOpen(false); setTimeout(() => setAppearanceOpen(true), 100); }} style={styles.menuSettingRow}><View style={styles.settingGlyph}><Text style={styles.settingGlyphText}>Aa</Text></View><View style={styles.topCopy}><Text style={styles.menuSettingTitle}>{tr("Font, Tajweed & page style", "الخط والتجويد وشكل الصفحة")}</Text><Text style={styles.menuSettingMeta}>{appearance.fontSize} · {appearance.tajweed ? tr("Tajweed on", "التجويد مفعّل") : tr("Tajweed off", "التجويد متوقف")} · {spreadMode ? tr("Open book", "كتاب مفتوح") : tr("Single page", "صفحة واحدة")} · {appearance.browseMode === "horizontal" ? tr("Swipe", "سحب أفقي") : tr("Scroll", "تمرير رأسي")}</Text></View><Text style={styles.menuChevron}>{ar ? "‹" : "›"}</Text></Pressable><View style={styles.readerModeRow}><Pressable onPress={() => persistAudioPrefs({ readerMode: "mushaf" })} style={[styles.readerModeButton, audioPrefs.readerMode === "mushaf" && styles.readerModeButtonActive]}><Text style={[styles.readerModeText, audioPrefs.readerMode === "mushaf" && styles.readerModeTextActive]}>📖 {tr("Mushaf", "المصحف")}</Text></Pressable><Pressable onPress={() => persistAudioPrefs({ readerMode: "study" })} style={[styles.readerModeButton, audioPrefs.readerMode === "study" && styles.readerModeButtonActive]}><Text style={[styles.readerModeText, audioPrefs.readerMode === "study" && styles.readerModeTextActive]}>📿 {tr("Study", "الدراسة")}</Text></Pressable></View><View style={styles.highlightRow}><View style={styles.topCopy}><Text style={styles.highlightTitle}>{tr("Follow recitation", "متابعة التلاوة")}</Text><Text style={styles.highlightMeta}>{tr("Highlight the ayah being recited", "تمييز الآية التي تتم تلاوتها")}</Text></View><Switch value={audioPrefs.highlightAudio} onValueChange={(value) => persistAudioPrefs({ highlightAudio: value })} /></View></View>

            <View style={styles.menuElegantCard}><Text style={styles.menuCardTitle}>🧭 {tr("Go to Mushaf page", "الذهاب إلى صفحة المصحف")}</Text><View style={styles.jumpRow}><TextInput value={pageJump} onChangeText={setPageJump} keyboardType="number-pad" placeholder="1–604" style={styles.pageInput} /><Pressable onPress={() => { const page = clamp(Number(pageJump) || 1, 1, 604); const start = pages[page - 1]; if (start) openReader(start.surah, start.ayah, screen); setMenuOpen(false); }} style={styles.jumpButton}><Text style={styles.jumpButtonText}>{tr("Go", "اذهب")}</Text></Pressable></View></View>

            <Pressable onPress={() => { setMenuOpen(false); onBackHome(); }} style={styles.returnWopt}><Text style={styles.returnWoptText}>⌂ {tr("Return to Hassoun Home", "العودة إلى الرئيسية")}</Text></Pressable>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );

  let body = home;
  if (screen === "surahs") body = surahList;
  else if (screen === "search") body = search;
  else if (screen === "bookmarks") body = bookmarkScreen;
  else if (screen === "radio") body = radioScreen;
  else if (screen === "reader" && reader) body = reader;
  else if (screen === "memorize") body = <SmartMemorize locale={locale} initialRange={memorizeRange} onBack={() => setScreen(memorizeRange ? "reader" : "home")} />;

  return (
    <View style={styles.flex} onTouchStart={revealAppNav} onTouchMove={revealAppNav}>
      {body}
      {bookmarkNotice ? (
        <View pointerEvents="none" style={{ position: "absolute", top: 88, left: 20, right: 20, alignItems: "center", zIndex: 80 }}>
          <View style={{ maxWidth: 440, borderRadius: 18, paddingHorizontal: 16, paddingVertical: 11, backgroundColor: "rgba(13,86,69,.97)", borderWidth: 1, borderColor: "#d9bd70", shadowColor: "#000", shadowOpacity: .2, shadowRadius: 8, elevation: 12 }}>
            <Text style={{ color: "#fff", fontWeight: "800", textAlign: "center" }}>🔖 {bookmarkNotice}</Text>
          </View>
        </View>
      ) : null}
      {screen === "reader" && playerVisible && !selectedAyah && !menuOpen && !appearanceOpen ? miniPlayer : null}
      {menu}
      <ReaderSettingsSheet visible={appearanceOpen} locale={locale} appearance={appearance} setAppearance={setAppearance} reset={resetAppearance} onDone={() => setAppearanceOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: "#f6f3eb" },
  rtl: { textAlign: "right", writingDirection: "rtl" },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 28, backgroundColor: "#f6f3eb" },
  big: { fontSize: 46 }, centerTitle: { color: "#173f35", fontSize: 20, fontWeight: "900", marginTop: 10 },
  primary: { marginTop: 18, backgroundColor: "#0b654f", borderRadius: 15, paddingHorizontal: 20, paddingVertical: 13 }, primaryText: { color: "#fff", fontWeight: "900" },
  topBar: { minHeight: 67, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12, paddingVertical: 9, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#e7e2d8" },
  topCopy: { flex: 1 }, topTitle: { color: "#173f35", fontSize: 18, fontWeight: "900" }, topSubtitle: { color: "#7d8984", fontSize: 9, marginTop: 2 },
  iconButton: { width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "#fff", borderWidth: 1, borderColor: "#ded9cf" }, back: { fontSize: 31, color: "#17483c", lineHeight: 32 },
  topMenuButton: { width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "#edf5f1" }, topMenuIcon: { color: "#0b654f", fontSize: 18, fontWeight: "900" },
  homeContent: { padding: 17, paddingBottom: 28 }, heroHeader: { flexDirection: "row", gap: 11, alignItems: "center", marginBottom: 16 }, eyebrow: { color: "#a17c36", fontSize: 9, fontWeight: "900", letterSpacing: .8 }, heroTitle: { color: "#173f35", fontSize: 29, fontWeight: "900" }, heroSub: { color: "#7c8782", fontSize: 10, marginTop: 2 }, verifiedBadge: { borderRadius: 99, paddingHorizontal: 9, paddingVertical: 6, backgroundColor: "#e7f4ee" }, verifiedText: { color: "#0b6a51", fontSize: 9, fontWeight: "900" },
  searchBox: { height: 57, borderRadius: 19, backgroundColor: "#fff", borderWidth: 1, borderColor: "#dedad1", flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 15 }, searchIcon: { color: "#0b654f", fontSize: 22, fontWeight: "900" }, searchPlaceholder: { color: "#74817c", flex: 1, fontSize: 11 },
  continueCard: { marginTop: 14, minHeight: 112, borderRadius: 26, backgroundColor: "#0a634d", padding: 16, flexDirection: "row", alignItems: "center", gap: 12 }, continueIconBubble: { width: 55, height: 55, borderRadius: 18, backgroundColor: "rgba(255,255,255,.12)", alignItems: "center", justifyContent: "center" }, continueIcon: { fontSize: 28 }, continueEyebrow: { color: "#d3e7df", fontSize: 8, fontWeight: "900" }, continueTitle: { color: "#fff", fontSize: 21, fontWeight: "900", marginTop: 4 }, continueMeta: { color: "#c7ded5", fontSize: 10, marginTop: 4 }, lightArrow: { color: "#fff", fontSize: 28 },
  sectionHeading: { color: "#173f35", fontSize: 19, fontWeight: "900", marginTop: 22, marginBottom: 10 }, grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 }, gridCard: { width: "48%", minHeight: 128, backgroundColor: "#fff", borderWidth: 1, borderColor: "#e1ddd4", borderRadius: 23, padding: 15 }, radioGridCard: { backgroundColor: "#f3eee1", borderColor: "#e1d5bd" }, gridIcon: { width: 44, height: 44, borderRadius: 15, backgroundColor: "#edf5f1", alignItems: "center", justifyContent: "center" }, radioGridIcon: { backgroundColor: "#fff8e7" }, gridEmoji: { fontSize: 23 }, gridTitle: { color: "#173f35", fontSize: 15, fontWeight: "900", marginTop: 10 }, gridMeta: { color: "#89928e", fontSize: 9, lineHeight: 13, marginTop: 3 },
  infoCard: { marginTop: 14, borderRadius: 20, padding: 14, flexDirection: "row", gap: 10, alignItems: "center", backgroundColor: "#e9f4ef", borderWidth: 1, borderColor: "#d3e8de" }, infoIcon: { width: 34, height: 34, textAlign: "center", textAlignVertical: "center", borderRadius: 17, backgroundColor: "#0b654f", color: "#fff", fontSize: 18, fontWeight: "900" }, infoTitle: { color: "#17483c", fontSize: 12, fontWeight: "900" }, infoText: { color: "#70817a", fontSize: 9, lineHeight: 14, marginTop: 3 },
  listContent: { padding: 12, paddingBottom: 28 }, row: { minHeight: 76, borderRadius: 19, backgroundColor: "#fff", borderWidth: 1, borderColor: "#e2ded5", padding: 12, marginBottom: 8, flexDirection: "row", alignItems: "center", gap: 11 }, numberBadge: { width: 40, height: 40, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "#edf5f1" }, numberText: { color: "#0b654f", fontWeight: "900", fontSize: 11 }, rowTitle: { color: "#173f35", fontSize: 14, fontWeight: "900" }, rowMeta: { color: "#85908b", fontSize: 9, marginTop: 3 }, rowArabic: { color: "#0b654f", fontSize: 18, writingDirection: "rtl" },
  searchInputWrap: { padding: 12 }, searchInput: { minHeight: 52, borderRadius: 17, backgroundColor: "#fff", borderWidth: 1, borderColor: "#ddd8ce", paddingHorizontal: 14, color: "#173f35" }, empty: { textAlign: "center", color: "#7b8782", padding: 30 }, searchResult: { backgroundColor: "#fff", borderRadius: 18, borderWidth: 1, borderColor: "#e1ddd4", padding: 13, marginBottom: 8 }, resultTitle: { color: "#17483c", fontSize: 11, fontWeight: "900" }, resultArabic: { color: "#203f37", fontSize: 21, lineHeight: 34, textAlign: "right", writingDirection: "rtl", marginTop: 6 },
  bookmarkCard: { backgroundColor: "#fff", borderRadius: 18, borderWidth: 1, borderColor: "#e1ddd4", padding: 14, marginBottom: 8 }, bookmarkRef: { color: "#9a7838", fontSize: 9, fontWeight: "900" }, bookmarkArabic: { fontSize: 23, lineHeight: 38, color: "#183e34", textAlign: "right", writingDirection: "rtl", marginTop: 8 },
  radioContent: { paddingBottom: 34 },
  radioStudioHero: { margin: 14, marginBottom: 8, padding: 16, borderRadius: 28, backgroundColor: "#103f35", borderWidth: 1, borderColor: "#285b4e", shadowColor: "#000", shadowOpacity: .16, shadowRadius: 9, shadowOffset: { width: 0, height: 5 }, elevation: 8 },
  radioStudioTop: { flexDirection: "row", alignItems: "center", gap: 11 },
  radioStudioBadge: { width: 52, height: 52, borderRadius: 18, backgroundColor: "rgba(255,255,255,.11)", alignItems: "center", justifyContent: "center" },
  radioStudioBadgeIcon: { fontSize: 25 },
  radioStudioEyebrow: { color: "#e0bd68", fontSize: 7, fontWeight: "900", letterSpacing: 1.2 },
  radioStudioTitle: { color: "#fff", fontSize: 17, fontWeight: "900", marginTop: 3 },
  radioStudioMeta: { color: "#b8d2c9", fontSize: 8, marginTop: 3 },
  radioHeroStop: { width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(255,255,255,.10)", alignItems: "center", justifyContent: "center" },
  radioHeroStopText: { color: "#f1d7cf", fontSize: 11, fontWeight: "900" },
  radioProgressTrack: { height: 4, borderRadius: 4, backgroundColor: "rgba(255,255,255,.13)", overflow: "hidden", marginTop: 15 },
  radioProgressFill: { height: 4, borderRadius: 4, backgroundColor: "#e1bd66" },
  radioTimeRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 4 },
  radioTimeText: { color: "#a9c8be", fontSize: 7, fontWeight: "800" },
  radioTransportRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 9 },
  radioTransportSide: { width: 38, height: 38, borderRadius: 19, backgroundColor: "rgba(255,255,255,.08)", alignItems: "center", justifyContent: "center" },
  radioTransportArrow: { color: "#fff", fontSize: 26, lineHeight: 28, fontWeight: "700" },
  radioTransportMini: { width: 38, height: 38, borderRadius: 19, backgroundColor: "rgba(255,255,255,.08)", alignItems: "center", justifyContent: "center" },
  radioTransportMiniText: { color: "#dceae5", fontSize: 8, fontWeight: "900" },
  radioTransportMain: { width: 52, height: 52, borderRadius: 26, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", shadowColor: "#000", shadowOpacity: .18, shadowRadius: 5, shadowOffset: { width: 0, height: 3 }, elevation: 5 },
  radioTransportMainText: { color: "#0b654f", fontSize: 19, fontWeight: "900" },
  radioQuickRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 11 },
  radioQuickPill: { minHeight: 31, borderRadius: 16, paddingHorizontal: 10, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,.08)", borderWidth: 1, borderColor: "rgba(255,255,255,.08)" },
  radioQuickPillActive: { backgroundColor: "#e4c46f", borderColor: "#e4c46f" },
  radioQuickText: { color: "#d8e7e1", fontSize: 7, fontWeight: "900" },
  radioQuickTextActive: { color: "#173f35" },
  radioQueuePill: { minHeight: 31, borderRadius: 16, paddingHorizontal: 10, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,.12)" },
  radioQueueText: { color: "#b9d4ca", fontSize: 7, fontWeight: "900" },
  radioSectionHead: { marginHorizontal: 16, marginTop: 14, marginBottom: 7, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  radioSectionKicker: { color: "#a17c36", fontSize: 7, fontWeight: "900", letterSpacing: 1.1 },
  radioSectionTitle: { color: "#173f35", fontSize: 15, fontWeight: "900", marginTop: 2 },
  radioSectionHint: { fontSize: 20 },
  radioStudioCard: { marginHorizontal: 14, marginTop: 11, borderRadius: 24, backgroundColor: "#fff", borderWidth: 1, borderColor: "#e1ddd4", padding: 14, shadowColor: "#493d2e", shadowOpacity: .045, shadowRadius: 5, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
  radioContinuousCard: { backgroundColor: "#fbfaf6", borderColor: "#ded7c9" },
  radioCardIconWrap: { width: 40, height: 40, borderRadius: 14, backgroundColor: "#e9f4ef", alignItems: "center", justifyContent: "center" },
  radioMoonWrap: { backgroundColor: "#f4edda" },
  radioCardIconText: { color: "#0b654f", fontSize: 17, fontWeight: "900" },
  radioStudioCardTitle: { color: "#173f35", fontSize: 14, fontWeight: "900" },
  radioStudioCardMeta: { color: "#7f8c87", fontSize: 8, lineHeight: 12, marginTop: 3 },
  radioPillActions: { flexDirection: "row", gap: 7, marginTop: 11 },
  radioPrimaryPill: { flex: 1.2, minHeight: 46, borderRadius: 16, backgroundColor: "#0b654f", flexDirection: "row", gap: 6, alignItems: "center", justifyContent: "center", paddingHorizontal: 9 },
  radioPrimaryPillIcon: { color: "#fff", fontSize: 14, fontWeight: "900" },
  radioPrimaryPillText: { color: "#fff", fontSize: 8, fontWeight: "900", textAlign: "center" },
  radioGlassPill: { flex: 1, minHeight: 46, borderRadius: 16, backgroundColor: "#edf5f1", alignItems: "center", justifyContent: "center", paddingHorizontal: 8 },
  radioGlassPillText: { color: "#245044", fontSize: 8, fontWeight: "900", textAlign: "center" },
  radioEmptyQueue: { minHeight: 88, marginTop: 10, borderRadius: 18, backgroundColor: "#f7f6f2", borderWidth: 1, borderColor: "#eeebe4", alignItems: "center", justifyContent: "center" },
  radioEmptyQueueIcon: { fontSize: 22, opacity: .65 },
  radioEmptyQueueText: { color: "#8c9691", fontSize: 8, fontWeight: "800", marginTop: 4 }, radioHero: { margin: 14, marginBottom: 5, padding: 16, borderRadius: 24, backgroundColor: "#0a634d", flexDirection: "row", alignItems: "center", gap: 12 }, radioHeroIcon: { width: 58, height: 58, borderRadius: 19, backgroundColor: "rgba(255,255,255,.13)", alignItems: "center", justifyContent: "center" }, radioHeroEmoji: { fontSize: 29 }, radioHeroTitle: { color: "#fff", fontSize: 18, fontWeight: "900" }, radioHeroText: { color: "#cee2da", fontSize: 9, lineHeight: 14, marginTop: 4 }, radioSectionLabel: { color: "#97783d", fontSize: 9, fontWeight: "900", letterSpacing: 1, marginHorizontal: 16, marginTop: 14, marginBottom: 8 }, reciterRow: { gap: 7, paddingHorizontal: 14, paddingBottom: 3 }, reciterChip: { borderRadius: 99, borderWidth: 1, borderColor: "#d8d3c9", backgroundColor: "#fff", paddingHorizontal: 11, paddingVertical: 9 }, reciterChipActive: { backgroundColor: "#0b654f", borderColor: "#0b654f" }, reciterChipText: { color: "#53645e", fontSize: 9, fontWeight: "800" }, reciterChipTextActive: { color: "#fff" },
  radioCard: { marginHorizontal: 14, marginTop: 12, borderRadius: 23, backgroundColor: "#fff", borderWidth: 1, borderColor: "#e1ddd4", padding: 15 }, radioCardHeader: { flexDirection: "row", alignItems: "center", gap: 10 }, radioCardTitle: { color: "#173f35", fontSize: 15, fontWeight: "900" }, radioCardHint: { color: "#7b8782", fontSize: 9, lineHeight: 14, marginTop: 4 }, radioFieldLabel: { color: "#8d743d", fontSize: 8, fontWeight: "900", letterSpacing: .7, marginTop: 14, marginBottom: 7 }, surahStepper: { minHeight: 68, borderRadius: 18, backgroundColor: "#f6f5f0", flexDirection: "row", alignItems: "center", gap: 9, padding: 9, marginTop: 12 }, stepperButton: { width: 46, height: 46, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: "#e7f2ed" }, stepperButtonText: { color: "#0b654f", fontSize: 26, fontWeight: "700" }, surahStepperCopy: { flex: 1, alignItems: "center" }, surahStepperNumber: { color: "#8a918e", fontSize: 8, fontWeight: "800" }, surahStepperName: { color: "#173f35", fontSize: 15, fontWeight: "900", marginTop: 2 }, radioActionRow: { flexDirection: "row", gap: 7, marginTop: 11 }, radioAction: { flex: 1, minHeight: 66, borderRadius: 16, backgroundColor: "#edf5f1", alignItems: "center", justifyContent: "center", padding: 6 }, radioActionIcon: { fontSize: 18 }, radioActionText: { color: "#31564b", fontSize: 8, fontWeight: "900", textAlign: "center", marginTop: 3 }, clearPill: { borderRadius: 99, paddingHorizontal: 10, paddingVertical: 7, backgroundColor: "#f2eee5" }, clearPillText: { color: "#7a6950", fontSize: 8, fontWeight: "900" }, playlistWrap: { marginTop: 10, gap: 6 }, playlistItem: { minHeight: 58, borderRadius: 16, backgroundColor: "#f8f7f3", flexDirection: "row", alignItems: "center", gap: 9, padding: 9 }, playlistNumber: { width: 34, height: 34, borderRadius: 11, backgroundColor: "#e7f2ed", alignItems: "center", justifyContent: "center" }, playlistNumberText: { color: "#0b654f", fontSize: 9, fontWeight: "900" }, playlistTitle: { color: "#173f35", fontSize: 11, fontWeight: "900" }, playlistMeta: { color: "#8a938f", fontSize: 8, marginTop: 2 }, removePlaylist: { width: 34, height: 34, borderRadius: 11, alignItems: "center", justifyContent: "center", backgroundColor: "#f1ece6" }, removePlaylistText: { color: "#8a5d55", fontSize: 20 }, emptyPlaylist: { minHeight: 62, marginTop: 10, borderRadius: 16, backgroundColor: "#f8f7f3", alignItems: "center", justifyContent: "center", padding: 12 }, emptyPlaylistText: { color: "#8a938f", fontSize: 9, textAlign: "center" }, twoActionRow: { flexDirection: "row", gap: 8, marginTop: 11 }, radioPrimary: { flex: 1, minHeight: 47, borderRadius: 15, backgroundColor: "#0b654f", alignItems: "center", justifyContent: "center", paddingHorizontal: 10 }, radioPrimaryText: { color: "#fff", fontSize: 9, fontWeight: "900", textAlign: "center" }, radioSecondary: { flex: 1, minHeight: 47, borderRadius: 15, backgroundColor: "#edf5f1", alignItems: "center", justifyContent: "center", paddingHorizontal: 10 }, radioSecondaryText: { color: "#0b654f", fontSize: 9, fontWeight: "900", textAlign: "center" }, ongoingRow: { marginTop: 12, borderRadius: 17, backgroundColor: "#f3f6f4", padding: 12, flexDirection: "row", alignItems: "center", gap: 10 }, ongoingTitle: { color: "#244b40", fontSize: 10, fontWeight: "900" }, ongoingText: { color: "#83908a", fontSize: 8, marginTop: 2 },
  readerBody: { flex: 1, backgroundColor: "#e9e5dc" }, bookCanvas: { padding: 8, paddingBottom: 12 }, bookCanvasSpread: { flexGrow: 1, justifyContent: "center" }, bookSpread: { flexDirection: "row", alignItems: "stretch", justifyContent: "center", gap: 0 }, bookPageSlot: { flex: 1, minWidth: 0 }, blankBookPage: { backgroundColor: "#e0d9ca", borderRadius: 14, opacity: .55, margin: 3 }, bookGutter: { width: 12, backgroundColor: "#d2cab9", borderLeftWidth: 1, borderRightWidth: 1, borderColor: "#c4bba8" }, mushafPage: { minHeight: 650, borderRadius: 13, borderWidth: 1, borderColor: "#d8d0c0", paddingHorizontal: 14, paddingTop: 11, paddingBottom: 12, shadowColor: "#342d23", shadowOpacity: .08, shadowRadius: 5, shadowOffset: { width: 0, height: 2 }, elevation: 2 }, pageTopLine: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 24, borderBottomWidth: 1, borderBottomColor: "#e2dbc9", marginBottom: 8 }, pageMeta: { color: "#70736e", fontSize: 8, fontWeight: "800" }, surahFrame: { marginVertical: 12, paddingVertical: 3, paddingHorizontal: 3, borderTopWidth: 1, borderBottomWidth: 1, borderColor: "#0b7a5d", backgroundColor: "rgba(11,122,93,.025)" }, surahFrameInner: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9, paddingHorizontal: 6 }, surahFrameSide: { flex: 1, minWidth: 34, flexDirection: "row", alignItems: "center", gap: 4 }, surahFrameLine: { flex: 1, height: 1, backgroundColor: "#0b7a5d", opacity: .8 }, surahFrameDiamond: { width: 10, height: 10, borderWidth: 1.5, borderColor: "#0b7a5d", transform: [{ rotate: "45deg" }] }, surahFrameDiamondSmall: { width: 6, height: 6, borderWidth: 1, borderColor: "#0b7a5d", transform: [{ rotate: "45deg" }] }, surahFrameText: { minWidth: 118, maxWidth: "60%", flexShrink: 1, color: "#173f35", fontSize: 22, lineHeight: 32, fontWeight: "700", textAlign: "center", writingDirection: "rtl", includeFontPadding: false }, basmala: { textAlign: "center", writingDirection: "rtl", marginVertical: 9 }, pageBottom: { alignItems: "center", marginTop: 8 }, pageNumber: { color: "#6b706d", fontSize: 10, fontWeight: "800" }, bookNav: { minHeight: 55, flexDirection: "row", alignItems: "center", gap: 7, padding: 7, backgroundColor: "#fff", borderTopWidth: 1, borderTopColor: "#ded9cf" }, bookNavButton: { flex: 1, minHeight: 42, borderRadius: 13, backgroundColor: "#edf5f1", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, paddingHorizontal: 6 }, bookNavArrow: { color: "#0b654f", fontSize: 18, fontWeight: "900" }, bookNavText: { color: "#0b654f", fontSize: 8, fontWeight: "900", textAlign: "center" }, pageCenterPill: { minWidth: 72, minHeight: 42, borderRadius: 13, backgroundColor: "#0b654f", alignItems: "center", justifyContent: "center" }, pageCenterText: { color: "#fff", fontSize: 9, fontWeight: "900" },
  studyWrap: { padding: 11, paddingBottom: 20 }, studySurahHeader: { borderRadius: 20, backgroundColor: "#efe8d9", borderWidth: 1, borderColor: "#dfd2bb", padding: 16, alignItems: "center", marginBottom: 10 }, studySurahArabic: { color: "#173f35", fontSize: 28, fontWeight: "900", writingDirection: "rtl" }, studySurahEnglish: { color: "#7d776d", fontSize: 9, marginTop: 3 }, studyAyah: { backgroundColor: "#fff", borderRadius: 20, borderWidth: 1, borderColor: "#e1ddd4", padding: 15, marginBottom: 9 }, studyPlaying: { borderColor: "#0b8b69", borderWidth: 2, backgroundColor: "#f5fff9" }, studyTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" }, ayahPill: { minWidth: 34, textAlign: "center", backgroundColor: "#edf5f1", color: "#0b654f", padding: 7, borderRadius: 11, fontWeight: "900" }, smallPlay: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: "#edf5f1" }, studyArabic: { color: "#173f35", textAlign: "right", writingDirection: "rtl", marginTop: 9 },
  ayahActions: { backgroundColor: "#103f35", borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingHorizontal: 10, paddingTop: 8, paddingBottom: 9, shadowColor: "#000", shadowOpacity: .18, shadowRadius: 8, shadowOffset: { width: 0, height: -2 }, elevation: 12 }, actionHeader: { minHeight: 24, flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 3, marginBottom: 5 }, actionDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#e6c76e" }, actionRef: { flex: 1, color: "#d7e7e1", fontSize: 8, fontWeight: "900" }, actionClose: { width: 24, height: 24, borderRadius: 12, backgroundColor: "rgba(255,255,255,.09)", alignItems: "center", justifyContent: "center" }, actionCloseText: { color: "#d7e7e1", fontSize: 17, lineHeight: 19, fontWeight: "700" }, actionTransport: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 6 }, actionCircle: { flex: 1, minHeight: 48, borderRadius: 15, backgroundColor: "rgba(255,255,255,.09)", alignItems: "center", justifyContent: "center", paddingHorizontal: 4 }, actionCircleMain: { backgroundColor: "#f7faf8" }, actionCircleActive: { backgroundColor: "#d8bd68" }, actionDisabled: { opacity: .32 }, actionCircleIcon: { color: "#f3f8f6", fontSize: 16, fontWeight: "900" }, actionCircleLabel: { color: "#d5e5df", fontSize: 6.5, fontWeight: "900", marginTop: 2, textAlign: "center" }, actionCircleMainIcon: { color: "#0b654f", fontSize: 17, fontWeight: "900" }, actionCircleMainLabel: { color: "#0b654f", fontSize: 6.5, fontWeight: "900", marginTop: 2, textAlign: "center" }, actionTools: { gap: 6, paddingTop: 7, paddingRight: 4 }, actionTool: { minWidth: 78, height: 34, borderRadius: 17, paddingHorizontal: 10, backgroundColor: "rgba(255,255,255,.08)", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5 }, actionToolActive: { backgroundColor: "#e4cf8b" }, actionToolIcon: { color: "#f4f8f6", fontSize: 12, fontWeight: "900" }, actionToolLabel: { color: "#d8e7e2", fontSize: 7, fontWeight: "900" }, actionToolLabelActive: { color: "#173f35" },
  memoryWrap: { paddingBottom: 22 }, memoryControls: { flexDirection: "row", gap: 8, margin: 12 }, memoryButton: { flex: 1, minHeight: 46, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "#edf5f1" }, memoryButtonText: { color: "#31564b", fontSize: 9, fontWeight: "900" }, memoryCard: { backgroundColor: "#fff", borderRadius: 19, borderWidth: 1, borderColor: "#e0ddd4", padding: 15, marginHorizontal: 12, marginBottom: 8 }, memoryArabic: { color: "#183e34", fontSize: 28, lineHeight: 48, textAlign: "right", writingDirection: "rtl", marginTop: 7 }, hidden: { color: "#9ca6a1", textAlign: "center", letterSpacing: 3 },
  miniPlayer: { position: "absolute", left: 48, right: 48, bottom: 18, minHeight: 56, borderRadius: 28, backgroundColor: "rgba(16,63,53,.96)", paddingHorizontal: 9, paddingVertical: 6, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderWidth: 1, borderColor: "rgba(255,255,255,.12)", shadowColor: "#000", shadowOpacity: .22, shadowRadius: 9, shadowOffset: { width: 0, height: 4 }, elevation: 12, zIndex: 50 }, playerHeader: { flexDirection: "row", alignItems: "center", gap: 9 }, playerBadge: { width: 36, height: 36, borderRadius: 13, backgroundColor: "rgba(255,255,255,.1)", alignItems: "center", justifyContent: "center" }, playerBadgeText: { fontSize: 17 }, miniCopy: { flex: 1 }, miniEyebrow: { color: "#b8d7ce", fontSize: 7, fontWeight: "900" }, miniTitle: { color: "#fff", fontSize: 11, fontWeight: "900", marginTop: 2 }, miniMeta: { color: "#a9c7be", fontSize: 7, marginTop: 2 }, playerMore: { width: 34, height: 34, borderRadius: 12, backgroundColor: "rgba(255,255,255,.08)", alignItems: "center", justifyContent: "center" }, playerMoreText: { color: "#d5e5df", fontSize: 13, fontWeight: "900" }, playerTransport: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 }, playerControl: { width: 38, height: 38, borderRadius: 19, backgroundColor: "rgba(255,255,255,.09)", alignItems: "center", justifyContent: "center" }, playerControlDisabled: { opacity: .35 }, playerControlText: { color: "#e4efeb", fontSize: 9, fontWeight: "900" }, playerControlArrow: { color: "#fff", fontSize: 25, lineHeight: 27, fontWeight: "700" }, playerMain: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: "#fff" }, playerMainText: { color: "#0b654f", fontSize: 17, fontWeight: "900" }, playerSpeedPill: { minWidth: 42, height: 38, borderRadius: 19, backgroundColor: "#dcebe5", alignItems: "center", justifyContent: "center", paddingHorizontal: 6 }, playerSpeedText: { color: "#17483c", fontSize: 8, fontWeight: "900" },
  quranDock: { minHeight: 58, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12, paddingVertical: 7, backgroundColor: "#fff", borderTopWidth: 1, borderTopColor: "#ddd9d0" }, quranDockIcon: { width: 40, height: 40, borderRadius: 14, backgroundColor: "#0b654f", alignItems: "center", justifyContent: "center" }, quranDockIconText: { color: "#fff", fontSize: 17, fontWeight: "900" }, quranDockText: { flex: 1, color: "#173f35", fontSize: 12, fontWeight: "900" }, quranDockArrow: { color: "#0b654f", fontSize: 25 },
  menuBackdrop: { flex: 1, backgroundColor: "rgba(20,29,26,.48)", justifyContent: "flex-end" }, menuSheet: { maxHeight: "90%", backgroundColor: "#f8f6f0", borderTopLeftRadius: 30, borderTopRightRadius: 30, overflow: "hidden" }, menuHero: { minHeight: 82, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 18, backgroundColor: "#0b654f" }, menuMoon: { width: 48, height: 48, borderRadius: 17, backgroundColor: "rgba(255,255,255,.12)", alignItems: "center", justifyContent: "center" }, menuMoonText: { color: "#f1d58d", fontSize: 29 }, menuTitle: { color: "#fff", fontSize: 21, fontWeight: "900" }, menuSubtitle: { color: "#c8e0d8", fontSize: 9, marginTop: 3 }, menuClose: { width: 40, height: 40, borderRadius: 14, backgroundColor: "rgba(255,255,255,.12)", alignItems: "center", justifyContent: "center" }, menuCloseText: { color: "#fff", fontSize: 24, lineHeight: 26 }, menuContent: { padding: 15, paddingBottom: 28 }, menuSectionLabel: { color: "#997b43", fontSize: 8, fontWeight: "900", letterSpacing: 1, marginBottom: 8 }, menuQuickGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 }, menuQuickCard: { width: "48%", minHeight: 78, borderRadius: 18, backgroundColor: "#fff", borderWidth: 1, borderColor: "#e1ddd4", padding: 12, justifyContent: "center" }, menuQuickRadio: { backgroundColor: "#f4efe2", borderColor: "#e1d5bd" }, menuQuickIcon: { fontSize: 21 }, menuQuickTitle: { color: "#173f35", fontSize: 11, fontWeight: "900", marginTop: 5 }, menuElegantCard: { marginTop: 10, borderRadius: 21, backgroundColor: "#fff", borderWidth: 1, borderColor: "#e1ddd4", padding: 13 }, menuCardHeader: { flexDirection: "row", alignItems: "center", gap: 10 }, menuCardIcon: { width: 40, height: 40, borderRadius: 14, backgroundColor: "#edf5f1", alignItems: "center", justifyContent: "center" }, menuCardTitle: { color: "#173f35", fontSize: 13, fontWeight: "900" }, menuCardSubtitle: { color: "#83908a", fontSize: 8, marginTop: 2 }, speedRow: { flexDirection: "row", alignItems: "center", gap: 7, marginTop: 11 }, speedLabel: { flex: 1, color: "#53645e", fontSize: 9, fontWeight: "900" }, speedButton: { width: 38, height: 38, borderRadius: 12, backgroundColor: "#edf5f1", alignItems: "center", justifyContent: "center" }, speedButtonText: { color: "#0b654f", fontSize: 20, fontWeight: "900" }, speedValue: { minWidth: 46, textAlign: "center", color: "#173f35", fontSize: 10, fontWeight: "900" }, transport: { flexDirection: "row", gap: 6, marginTop: 10 }, transportButton: { flex: 1, minHeight: 41, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: "#edf5f1" }, transportMain: { width: 50, minHeight: 41, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: "#0b654f" }, menuSettingRow: { minHeight: 64, marginTop: 10, borderRadius: 16, backgroundColor: "#f5f5f1", flexDirection: "row", alignItems: "center", gap: 10, padding: 10 }, settingGlyph: { width: 41, height: 41, borderRadius: 13, backgroundColor: "#0b654f", alignItems: "center", justifyContent: "center" }, settingGlyphText: { color: "#fff", fontSize: 13, fontWeight: "900" }, menuSettingTitle: { color: "#173f35", fontSize: 10, fontWeight: "900" }, menuSettingMeta: { color: "#84908b", fontSize: 8, marginTop: 2 }, menuChevron: { color: "#0b654f", fontSize: 23 }, readerModeRow: { flexDirection: "row", gap: 7, marginTop: 9 }, readerModeButton: { flex: 1, minHeight: 42, borderRadius: 13, backgroundColor: "#f4f4f0", alignItems: "center", justifyContent: "center" }, readerModeButtonActive: { backgroundColor: "#0b654f" }, readerModeText: { color: "#53645e", fontSize: 9, fontWeight: "900" }, readerModeTextActive: { color: "#fff" }, highlightRow: { flexDirection: "row", alignItems: "center", gap: 9, marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: "#ece8df" }, highlightTitle: { color: "#244b40", fontSize: 9, fontWeight: "900" }, highlightMeta: { color: "#84908b", fontSize: 7, marginTop: 2 }, jumpRow: { flexDirection: "row", gap: 8, marginTop: 9 }, pageInput: { flex: 1, height: 45, borderRadius: 13, borderWidth: 1, borderColor: "#ded9cf", backgroundColor: "#f9f8f5", paddingHorizontal: 12 }, jumpButton: { width: 80, height: 45, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: "#0b654f" }, jumpButtonText: { color: "#fff", fontWeight: "900" }, returnWopt: { minHeight: 48, marginTop: 12, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: "#ebe7dd" }, returnWoptText: { color: "#53645e", fontSize: 10, fontWeight: "900" },
  disabled: { opacity: .35 }
});
