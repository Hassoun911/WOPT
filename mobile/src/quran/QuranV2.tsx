import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  BackHandler,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View
} from "react-native";
import QuranAudio, { type QuranAudioStatus } from "../../modules/quran-audio";
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

type Props = { locale: QuranLocale; onBackHome: () => void };
type Screen = "home" | "surahs" | "search" | "bookmarks" | "reader" | "memorize";
type Position = { surah: number; ayah: number };
type ReaderMode = "mushaf" | "study";
type FontChoice = "mushaf" | "naskh" | "clean";
type Range = { surah: number; start: number; end: number };

type Prefs = {
  readerMode: ReaderMode;
  font: FontChoice;
  fontSize: number;
  lineHeight: number;
  tajweed: boolean;
  highlightAudio: boolean;
  reciter: string;
  speed: number;
};

const KEYS = {
  last: "wopt:quran:last:v2",
  bookmarks: "wopt:quran:bookmarks:v2",
  prefs: "wopt:quran:prefs:v2",
  memorize: "wopt:quran:memorize:v2"
};

const DEFAULT_PREFS: Prefs = {
  readerMode: "mushaf",
  font: "mushaf",
  fontSize: 29,
  lineHeight: 52,
  tajweed: false,
  highlightAudio: true,
  reciter: "ar.alafasy",
  speed: 1,
};

const RECITERS = [
  { id: "ar.alafasy", en: "Mishary Alafasy", ar: "مشاري العفاسي", bitrate: 128 },
  { id: "ar.husary", en: "Mahmoud Al-Husary", ar: "محمود الحصري", bitrate: 128 },
  { id: "ar.minshawi", en: "Al-Minshawi", ar: "محمد صديق المنشاوي", bitrate: 128 },
  { id: "ar.sudais", en: "Abdul Rahman Al-Sudais", ar: "عبدالرحمن السديس", bitrate: 192 },
  { id: "ar.shuraim", en: "Saud Al-Shuraim", ar: "سعود الشريم", bitrate: 128 },
  { id: "ar.abdulbasit", en: "Abdul Basit", ar: "عبد الباسط عبد الصمد", bitrate: 192 },
  { id: "ar.hudhaify", en: "Ali Al-Hudhaify", ar: "علي الحذيفي", bitrate: 128 },
];

const TAJWEED_COLORS: Record<string, string> = {
  h: "#9b9b9b", s: "#9b9b9b", l: "#9b9b9b",
  n: "#537FFF", p: "#4050FF", m: "#000EBC", q: "#DD0008", o: "#2144C1",
  c: "#D500B7", f: "#9400A8", w: "#58B800", i: "#26BFFD",
  a: "#169777", u: "#169200", d: "#A1A1A1", b: "#A1A1A1", g: "#FF7E1E"
};

function refKey(p: Position) { return `${p.surah}:${p.ayah}`; }
function clamp(value: number, min: number, max: number) { return Math.min(max, Math.max(min, value)); }
function formatTime(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}
function fontFamily(choice: FontChoice) {
  if (choice === "clean") return undefined;
  return "serif";
}
function reciterInfo(id: string) { return RECITERS.find((item) => item.id === id) ?? RECITERS[0]!; }
function audioUrl(ayah: QuranAyah, reciterId: string) {
  const reciter = reciterInfo(reciterId);
  return `https://cdn.islamic.network/quran/audio/${reciter.bitrate}/${reciter.id}/${absoluteIndex(ayah.surah, ayah.ayah) + 1}.mp3`;
}

function parseTajweed(value: string) {
  const parts: Array<{ text: string; color?: string }> = [];
  let rest = value;
  const marker = /\[([a-z])(?::[^\[]*)?\[([^\]]*)\]/i;
  while (rest.length) {
    const match = marker.exec(rest);
    if (!match || match.index === undefined) {
      parts.push({ text: rest });
      break;
    }
    if (match.index > 0) parts.push({ text: rest.slice(0, match.index) });
    parts.push({ text: match[2] ?? "", color: TAJWEED_COLORS[(match[1] ?? "").toLowerCase()] });
    rest = rest.slice(match.index + match[0].length);
  }
  return parts;
}

export default function QuranV2({ locale, onBackHome }: Props) {
  const ar = locale === "ar";
  const tr = (en: string, arabic: string) => ar ? arabic : en;
  const num = (n: number) => ar ? new Intl.NumberFormat("ar").format(n) : String(n);

  const [screen, setScreen] = useState<Screen>("home");
  const [position, setPosition] = useState<Position>({ surah: 1, ayah: 1 });
  const [lastPosition, setLastPosition] = useState<Position | null>(null);
  const [backTarget, setBackTarget] = useState<Screen>("home");
  const [bookmarks, setBookmarks] = useState<string[]>([]);
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  const [menuOpen, setMenuOpen] = useState(false);
  const [appearanceOpen, setAppearanceOpen] = useState(false);
  const { appearance, setAppearance, reset: resetAppearance } = useQuranAppearance();
  const [selectedAyah, setSelectedAyah] = useState<QuranAyah | null>(null);
  const [range, setRange] = useState<Range | null>(null);
  const [rangeSelecting, setRangeSelecting] = useState(false);
  const [memorizeRange, setMemorizeRange] = useState<Range | null>(null);
  const [memorizeHidden, setMemorizeHidden] = useState(false);
  const [query, setQuery] = useState("");
  const [pageJump, setPageJump] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [tajweedText, setTajweedText] = useState<Record<number, string>>({});
  const [tajweedLoading, setTajweedLoading] = useState(false);

  const [audioQueue, setAudioQueue] = useState<QuranAyah[]>([]);
  const [audioIndex, setAudioIndex] = useState(-1);
  const [repeatQueue, setRepeatQueue] = useState(false);
  const [audioStatus, setAudioStatus] = useState<QuranAudioStatus>({ available: Boolean(QuranAudio), state: "idle", positionMs: 0, durationMs: 0, speed: 1 });
  const completionRef = useRef<string | null>(null);

  const surahs = allSurahs();
  const pages = allPages();
  const readerSurah = getSurah(position.surah);
  const readerAyahs = useMemo(() => getSurahAyahs(position.surah), [position.surah]);
  const searchResults = useMemo(() => query.trim() ? searchQuran(query, 100) : [], [query]);
  const activeAyah = audioIndex >= 0 ? audioQueue[audioIndex] : undefined;
  const activeReciter = reciterInfo(prefs.reciter);
  const currentPage = pageForAyah(position.surah, position.ayah) ?? 1;
  const currentJuz = juzForAyah(position.surah, position.ayah) ?? 1;
  const pageAyahs = useMemo(() => {
    const start = pages[currentPage - 1];
    if (!start) return [] as QuranAyah[];
    const next = pages[currentPage];
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
  }, [currentPage, pages]);
  const pageSegments = useMemo(() => {
    const segments: Array<{ surah: number; ayahs: QuranAyah[] }> = [];
    for (const ayah of pageAyahs) {
      const previous = segments[segments.length - 1];
      if (!previous || previous.surah !== ayah.surah) segments.push({ surah: ayah.surah, ayahs: [ayah] });
      else previous.ayahs.push(ayah);
    }
    return segments;
  }, [pageAyahs]);

  useEffect(() => {
    void (async () => {
      const [savedLast, savedBookmarks, savedPrefs, savedMemorize] = await Promise.all([
        AsyncStorage.getItem(KEYS.last),
        AsyncStorage.getItem(KEYS.bookmarks),
        AsyncStorage.getItem(KEYS.prefs),
        AsyncStorage.getItem(KEYS.memorize)
      ]);
      try { if (savedLast) setLastPosition(JSON.parse(savedLast)); } catch {}
      try { if (savedBookmarks) setBookmarks(JSON.parse(savedBookmarks)); } catch {}
      try { if (savedPrefs) setPrefs({ ...DEFAULT_PREFS, ...JSON.parse(savedPrefs) }); } catch {}
      try { if (savedMemorize) setMemorizeRange(JSON.parse(savedMemorize)); } catch {}
      setLoaded(true);
    })();
  }, []);

  useEffect(() => {
    if (!prefs.tajweed || !readerSurah) {
      setTajweedText({});
      return;
    }
    let cancelled = false;
    void (async () => {
      const cacheKey = `wopt:quran:tajweed:surah:${readerSurah.number}:v1`;
      setTajweedLoading(true);
      try {
        const cached = await AsyncStorage.getItem(cacheKey);
        if (cached && !cancelled) {
          setTajweedText(JSON.parse(cached));
          setTajweedLoading(false);
          return;
        }
        const response = await fetch(`https://api.alquran.cloud/v1/surah/${readerSurah.number}/quran-tajweed`);
        const payload = await response.json();
        const next: Record<number, string> = {};
        for (const ayah of payload?.data?.ayahs ?? []) next[ayah.numberInSurah] = ayah.text;
        if (!cancelled) setTajweedText(next);
        if (Object.keys(next).length) await AsyncStorage.setItem(cacheKey, JSON.stringify(next));
      } catch {
        if (!cancelled) setTajweedText({});
      } finally {
        if (!cancelled) setTajweedLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [prefs.tajweed, readerSurah?.number]);

  const persistPrefs = (patch: Partial<Prefs>) => {
    setPrefs((current) => {
      const next = { ...current, ...patch };
      void AsyncStorage.setItem(KEYS.prefs, JSON.stringify(next));
      return next;
    });
  };

  const persistLast = (next: Position) => {
    setLastPosition(next);
    void AsyncStorage.setItem(KEYS.last, JSON.stringify(next));
  };

  const openPage = (page: number) => {
    const safePage = clamp(page, 1, 604);
    const start = pages[safePage - 1];
    if (!start) return;
    const next = { surah: start.surah, ayah: start.ayah };
    setPosition(next);
    setSelectedAyah(null);
    setRange(null);
    setRangeSelecting(false);
    persistLast(next);
  };

  const openReader = (surah: number, ayah = 1, from: Screen = screen) => {
    const target = getAyah(surah, ayah);
    if (!target) return;
    const next = { surah: target.surah, ayah: target.ayah };
    setPosition(next);
    setSelectedAyah(null);
    setRange(null);
    setRangeSelecting(false);
    setBackTarget(from === "reader" ? "home" : from);
    persistLast(next);
    setScreen("reader");
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

  const toggleBookmark = (ayah: QuranAyah) => {
    const key = refKey(ayah);
    const next = bookmarks.includes(key) ? bookmarks.filter((item) => item !== key) : [key, ...bookmarks];
    setBookmarks(next);
    void AsyncStorage.setItem(KEYS.bookmarks, JSON.stringify(next));
  };

  const startRange = (ayah: QuranAyah) => {
    setRange({ surah: ayah.surah, start: ayah.ayah, end: ayah.ayah });
    setRangeSelecting(true);
  };

  const handleAyahTap = (ayah: QuranAyah) => {
    if (rangeSelecting && range?.surah === ayah.surah) {
      setRange({ ...range, start: Math.min(range.start, ayah.ayah), end: Math.max(range.start, ayah.ayah) });
      setRangeSelecting(false);
      setSelectedAyah(ayah);
    } else {
      setSelectedAyah((current) => current?.surah === ayah.surah && current?.ayah === ayah.ayah ? null : ayah);
      persistLast({ surah: ayah.surah, ayah: ayah.ayah });
    }
  };

  const playNativeAyah = (ayah: QuranAyah) => {
    if (!QuranAudio) return;
    completionRef.current = null;
    void QuranAudio.play(audioUrl(ayah, prefs.reciter), prefs.speed);
  };

  const playQueue = (queue: QuranAyah[], repeat = false) => {
    if (!queue.length || !QuranAudio) return;
    const first = queue[0];
    if (!first) return;
    setAudioQueue(queue);
    setAudioIndex(0);
    setRepeatQueue(repeat);
    playNativeAyah(first);
  };

  const playAyah = (ayah: QuranAyah, repeat = false) => playQueue([ayah], repeat);
  const playSurah = (surahNumber: number, fromAyah = 1, repeat = false) => playQueue(getSurahAyahs(surahNumber).slice(Math.max(0, fromAyah - 1)), repeat);
  const playRange = (selectedRange: Range | null = range, repeat = false) => {
    if (!selectedRange) return;
    playQueue(getSurahAyahs(selectedRange.surah).slice(selectedRange.start - 1, selectedRange.end), repeat);
  };
  const continueQuran = (from: Position) => {
    const queue: QuranAyah[] = [];
    for (let s = from.surah; s <= 114; s += 1) {
      const ayahs = getSurahAyahs(s);
      queue.push(...(s === from.surah ? ayahs.slice(from.ayah - 1) : ayahs));
    }
    playQueue(queue, false);
  };

  const stopAudio = () => {
    QuranAudio?.stop();
    setAudioQueue([]);
    setAudioIndex(-1);
    setRepeatQueue(false);
    setAudioStatus({ available: Boolean(QuranAudio), state: "idle", positionMs: 0, durationMs: 0, speed: prefs.speed });
  };

  const nextAudio = () => {
    if (!audioQueue.length) return;
    const next = audioIndex + 1;
    if (next < audioQueue.length) {
      const nextAyah = audioQueue[next];
      if (!nextAyah) return;
      setAudioIndex(next);
      playNativeAyah(nextAyah);
    } else if (repeatQueue) {
      const first = audioQueue[0];
      if (!first) return;
      setAudioIndex(0);
      playNativeAyah(first);
    } else {
      stopAudio();
    }
  };

  const previousAudio = () => {
    if (!audioQueue.length) return;
    const prev = Math.max(0, audioIndex - 1);
    const previousAyah = audioQueue[prev];
    if (!previousAyah) return;
    setAudioIndex(prev);
    playNativeAyah(previousAyah);
  };

  useEffect(() => {
    const timer = setInterval(() => {
      if (!QuranAudio) return;
      const status = QuranAudio.getStatus();
      setAudioStatus(status);
      if (status.state === "completed" && status.url && completionRef.current !== status.url) {
        completionRef.current = status.url;
        nextAudio();
      }
    }, 450);
    return () => clearInterval(timer);
  }, [audioQueue, audioIndex, repeatQueue, prefs.reciter, prefs.speed]);

  useEffect(() => {
    if (audioIndex >= 0 && activeAyah) {
      persistLast({ surah: activeAyah.surah, ayah: activeAyah.ayah });
      if (position.surah !== activeAyah.surah) setPosition({ surah: activeAyah.surah, ayah: activeAyah.ayah });
    }
  }, [audioIndex]);

  const updateReciter = (id: string) => {
    persistPrefs({ reciter: id });
    if (activeAyah) setTimeout(() => { if (QuranAudio) void QuranAudio.play(audioUrl(activeAyah, id), prefs.speed); }, 20);
  };

  const updateSpeed = (speed: number) => {
    const safe = clamp(speed, 0.5, 2);
    persistPrefs({ speed: safe });
    QuranAudio?.setSpeed(safe);
  };

  const renderAyahText = (ayah: QuranAyah) => {
    const playing = prefs.highlightAudio && activeAyah?.surah === ayah.surah && activeAyah?.ayah === ayah.ayah && audioStatus.state !== "idle";
    const selected = selectedAyah?.surah === ayah.surah && selectedAyah?.ayah === ayah.ayah;
    const inRange = range?.surah === ayah.surah && ayah.ayah >= range.start && ayah.ayah <= range.end;
    const textStyle = {
      fontFamily: fontFamily(prefs.font),
      fontSize: prefs.fontSize,
      lineHeight: prefs.lineHeight,
    } as const;
    const source = prefs.tajweed ? tajweedText[ayah.ayah] : undefined;

    return (
      <Text
        onPress={() => handleAyahTap(ayah)}
        style={[styles.inlineAyah, textStyle, playing && styles.audioHighlight, inRange && styles.rangeHighlight, selected && styles.selectedHighlight]}
      >
        {source ? parseTajweed(source).map((part, index) => <Text key={`${ayah.ayah}-${index}`} style={part.color ? { color: part.color } : undefined}>{part.text}</Text>) : ayah.text}
        <Text style={styles.verseNumber}> ﴿{num(ayah.ayah)}﴾ </Text>
      </Text>
    );
  };

  if (!quranReady()) return <View style={styles.centered}><Text style={styles.big}>📖</Text><Text style={styles.title}>{tr("Qur’an data unavailable", "بيانات القرآن غير متاحة")}</Text><Pressable onPress={onBackHome} style={styles.primary}><Text style={styles.primaryText}>{tr("Back", "رجوع")}</Text></Pressable></View>;
  if (!loaded) return <View style={styles.centered}><Text>{tr("Loading Qur’an…", "جارٍ تحميل القرآن…")}</Text></View>;

  const topBar = (title: string, subtitle?: string, showMenu = true) => (
    <View style={styles.topBar}>
      <Pressable onPress={handleBack} style={styles.iconButton}><Text style={styles.back}>{ar ? "›" : "‹"}</Text></Pressable>
      <View style={styles.topCopy}><Text style={[styles.topTitle, ar && styles.rtl]}>{title}</Text>{subtitle ? <Text style={[styles.topSubtitle, ar && styles.rtl]}>{subtitle}</Text> : null}</View>
      {showMenu ? <Pressable onPress={() => setMenuOpen(true)} style={styles.menuButton}><Text style={styles.menuIcon}>☰</Text></Pressable> : <View style={{ width: 42 }} />}
    </View>
  );

  const miniPlayer = activeAyah ? (
    <Pressable onPress={() => setMenuOpen(true)} style={styles.miniPlayer}>
      <View style={styles.miniCopy}>
        <Text style={styles.miniEyebrow}>🎧 {ar ? activeReciter.ar : activeReciter.en}</Text>
        <Text style={styles.miniTitle}>{ar ? getSurah(activeAyah.surah)?.nameArabic : getSurah(activeAyah.surah)?.nameTransliterated} {num(activeAyah.surah)}:{num(activeAyah.ayah)}</Text>
        <Text style={styles.miniMeta}>{formatTime(audioStatus.positionMs)} / {formatTime(audioStatus.durationMs)} · {prefs.speed.toFixed(1)}×</Text>
      </View>
      <Pressable onPress={(event) => { event.stopPropagation(); previousAudio(); }} style={styles.playerButton}><Text>⏮️</Text></Pressable>
      <Pressable onPress={(event) => { event.stopPropagation(); audioStatus.state === "playing" ? QuranAudio?.pause() : QuranAudio?.resume(); }} style={styles.playerButton}><Text>{audioStatus.state === "playing" ? "⏸️" : "▶️"}</Text></Pressable>
      <Pressable onPress={(event) => { event.stopPropagation(); nextAudio(); }} style={styles.playerButton}><Text>⏭️</Text></Pressable>
    </Pressable>
  ) : null;

  const home = (
    <ScrollView style={styles.flex} contentContainerStyle={styles.homeContent} showsVerticalScrollIndicator={false}>
      <View style={styles.homeHeader}>
        <Pressable onPress={onBackHome} style={styles.iconButton}><Text style={styles.back}>{ar ? "›" : "‹"}</Text></Pressable>
        <View style={styles.topCopy}><Text style={styles.eyebrow}>🌙 {tr("HASSOUN QUR’AN", "قرآن Hassoun")}</Text><Text style={[styles.heroTitle, ar && styles.rtl]}>{tr("The Noble Qur’an", "القرآن الكريم")}</Text><Text style={[styles.heroSub, ar && styles.rtl]}>{tr("Read • listen • memorize", "اقرأ • استمع • احفظ")}</Text></View>
        <Pressable onPress={() => setMenuOpen(true)} style={styles.menuButton}><Text style={styles.menuIcon}>☰</Text></Pressable>
      </View>

      <Pressable onPress={() => setScreen("search")} style={styles.searchBox}><Text>🔎</Text><Text style={[styles.searchPlaceholder, ar && styles.rtl]}>{tr("Search the Qur’an", "ابحث في القرآن")}</Text></Pressable>

      <Pressable onPress={() => openReader(lastPosition?.surah ?? 1, lastPosition?.ayah ?? 1, "home")} style={styles.continueCard}>
        <Text style={styles.continueIcon}>📖</Text><View style={styles.topCopy}><Text style={styles.continueEyebrow}>✨ {tr("CONTINUE READING", "تابع القراءة")}</Text><Text style={[styles.continueTitle, ar && styles.rtl]}>{lastPosition ? (ar ? getSurah(lastPosition.surah)?.nameArabic : getSurah(lastPosition.surah)?.nameTransliterated) : tr("Al-Faatiha", "الفاتحة")}</Text><Text style={[styles.continueMeta, ar && styles.rtl]}>{lastPosition ? tr(`Ayah ${lastPosition.ayah} • Page ${pageForAyah(lastPosition.surah, lastPosition.ayah) ?? "—"}`, `الآية ${num(lastPosition.ayah)} • الصفحة ${num(pageForAyah(lastPosition.surah, lastPosition.ayah) ?? 0)}`) : tr("Start from the beginning", "ابدأ من البداية")}</Text></View><Text style={styles.lightArrow}>{ar ? "‹" : "›"}</Text>
      </Pressable>

      <View style={styles.grid}>
        <Pressable onPress={() => setScreen("surahs")} style={styles.gridCard}><Text style={styles.gridEmoji}>🕋</Text><Text style={styles.gridTitle}>{tr("Surahs", "السور")}</Text><Text style={styles.gridMeta}>{tr("114 Surahs", `${num(114)} سورة`)}</Text></Pressable>
        <Pressable onPress={() => setScreen("bookmarks")} style={styles.gridCard}><Text style={styles.gridEmoji}>🔖</Text><Text style={styles.gridTitle}>{tr("Bookmarks", "العلامات")}</Text><Text style={styles.gridMeta}>{tr(`${bookmarks.length} saved`, `${num(bookmarks.length)} محفوظة`)}</Text></Pressable>
        <Pressable onPress={() => memorizeRange ? setScreen("memorize") : openReader(lastPosition?.surah ?? 1, lastPosition?.ayah ?? 1, "home")} style={styles.gridCard}><Text style={styles.gridEmoji}>📿</Text><Text style={styles.gridTitle}>{tr("Memorize", "الحفظ")}</Text><Text style={styles.gridMeta}>{tr("Focused practice", "مراجعة مركزة")}</Text></Pressable>
        <Pressable onPress={() => setMenuOpen(true)} style={styles.gridCard}><Text style={styles.gridEmoji}>🎧</Text><Text style={styles.gridTitle}>{tr("Qur’an Menu", "قائمة القرآن")}</Text><Text style={styles.gridMeta}>{tr("Audio & reading", "الصوت والقراءة")}</Text></Pressable>
      </View>

      <View style={styles.infoCard}><Text style={styles.infoIcon}>✅</Text><View style={styles.topCopy}><Text style={styles.infoTitle}>{tr("Verified Uthmani text", "نص عثماني موثّق")}</Text><Text style={styles.infoText}>{tr("Arabic text stays stored locally. Audio streams only when used.", "يبقى النص العربي محفوظًا داخل التطبيق، ويتم بث الصوت عند الاستخدام فقط.")}</Text></View></View>
    </ScrollView>
  );

  const surahList = (
    <View style={styles.flex}>{topBar(tr("Surahs", "السور"), tr("Tap any Surah to open", "اضغط على أي سورة لفتحها"))}<FlatList data={surahs} keyExtractor={(item) => String(item.number)} contentContainerStyle={styles.listContent} renderItem={({ item }) => <Pressable onPress={() => openReader(item.number, 1, "surahs")} style={styles.row}><View style={styles.numberBadge}><Text style={styles.numberText}>{num(item.number)}</Text></View><View style={styles.topCopy}><Text style={[styles.rowTitle, ar && styles.rtl]}>{ar ? item.nameArabic : item.nameTransliterated}</Text><Text style={[styles.rowMeta, ar && styles.rtl]}>{ar ? `${num(item.ayahCount)} آية` : `${item.nameEnglish} • ${item.ayahCount} ayahs`}</Text></View><Text>📖</Text></Pressable>} /></View>
  );

  const search = (
    <View style={styles.flex}>{topBar(tr("Search Qur’an", "البحث في القرآن"), tr("Arabic, Surah name or number", "كلمة عربية أو اسم سورة أو رقمها"))}<View style={styles.searchInputWrap}><TextInput value={query} onChangeText={setQuery} placeholder={tr("Search…", "ابحث…")} placeholderTextColor="#8a938f" style={[styles.searchInput, ar && styles.rtl]} /></View><FlatList<QuranSearchResult> data={searchResults} keyExtractor={(item, i) => item.kind === "surah" ? `s-${item.surah.number}-${i}` : `a-${item.ayah?.surah}-${item.ayah?.ayah}`} contentContainerStyle={styles.listContent} ListEmptyComponent={<Text style={styles.empty}>{query.trim() ? tr("No matches found", "لا توجد نتائج") : tr("Type to search", "اكتب للبحث")}</Text>} renderItem={({ item }) => <Pressable onPress={() => openReader(item.surah.number, item.ayah?.ayah ?? 1, "search")} style={styles.searchResult}><Text style={styles.resultTitle}>{ar ? item.surah.nameArabic : item.surah.nameTransliterated} {item.ayah ? `${num(item.surah.number)}:${num(item.ayah.ayah)}` : ""}</Text>{item.ayah ? <Text style={styles.resultArabic} numberOfLines={3}>{item.ayah.text}</Text> : null}</Pressable>} /></View>
  );

  const bookmarkAyahs = bookmarks.map((key) => { const parts = key.split(":").map(Number); const s = parts[0]; const a = parts[1]; return s && a ? getAyah(s, a) : undefined; }).filter(Boolean) as QuranAyah[];
  const bookmarkScreen = (
    <View style={styles.flex}>{topBar(tr("Bookmarks", "العلامات"), tr(`${bookmarkAyahs.length} saved`, `${num(bookmarkAyahs.length)} محفوظة`))}<FlatList data={bookmarkAyahs} keyExtractor={refKey} contentContainerStyle={styles.listContent} ListEmptyComponent={<Text style={styles.empty}>{tr("No bookmarks yet", "لا توجد علامات بعد")}</Text>} renderItem={({ item }) => <Pressable onPress={() => openReader(item.surah, item.ayah, "bookmarks")} style={styles.bookmarkCard}><Text style={styles.bookmarkRef}>🔖 {ar ? getSurah(item.surah)?.nameArabic : getSurah(item.surah)?.nameTransliterated} {num(item.surah)}:{num(item.ayah)}</Text><Text style={styles.bookmarkArabic}>{item.text}</Text></Pressable>} /></View>
  );

  const reader = readerSurah ? (
    <View style={styles.flex}>
      {topBar(ar ? readerSurah.nameArabic : readerSurah.nameTransliterated, tr(`Page ${pageForAyah(position.surah, position.ayah) ?? "—"} • Juz ${juzForAyah(position.surah, position.ayah) ?? "—"}`, `الصفحة ${num(pageForAyah(position.surah, position.ayah) ?? 0)} • الجزء ${num(juzForAyah(position.surah, position.ayah) ?? 0)}`))}
      {rangeSelecting ? <View style={styles.rangeBanner}><Text style={styles.rangeBannerText}>✨ {tr("Tap the last ayah of the phrase/range", "اضغط على آخر آية في المقطع")}</Text></View> : null}
      {prefs.tajweed && tajweedLoading ? <View style={styles.tajweedBanner}><Text style={styles.tajweedBannerText}>🎨 {tr("Loading verified Tajweed colours…", "جارٍ تحميل ألوان التجويد الموثقة…")}</Text></View> : null}
      {prefs.readerMode === "mushaf" ? (
        <View style={styles.readerPageBody}>
          <ScrollView style={styles.flex} contentContainerStyle={styles.mushafWrap} showsVerticalScrollIndicator={false}>
            <View style={[styles.mushafSheet, { backgroundColor: quranPageBackground(appearance.pageTheme) }]}>
              <View style={styles.mushafPageMeta}><Text style={styles.mushafMetaText}>{ar ? readerSurah.nameArabic : readerSurah.nameTransliterated}</Text><Text style={styles.mushafMetaText}>{tr(`Juz ${currentJuz}`, `الجزء ${num(currentJuz)}`)}</Text></View>
              {pageSegments.map((segment) => {
                const segmentSurah = getSurah(segment.surah);
                const beginsSurah = segment.ayahs[0]?.ayah === 1;
                return (
                  <View key={`page-${currentPage}-surah-${segment.surah}`}>
                    {beginsSurah ? <View style={styles.surahHeader}><Text style={styles.surahArabic}>{segmentSurah?.nameArabic}</Text>{!ar ? <Text style={styles.surahEnglish}>{segmentSurah?.nameTransliterated} • {segmentSurah?.nameEnglish}</Text> : null}</View> : null}
                    {beginsSurah && segment.surah !== 1 && segment.surah !== 9 ? <Text style={[styles.basmala, { color: appearance.pageTheme === "dark" && appearance.textColor === "#111111" ? "#f2efe7" : appearance.textColor, fontSize: Math.max(22, appearance.fontSize - 2), lineHeight: Math.round(Math.max(22, appearance.fontSize - 2) * appearance.lineHeightMultiplier) }]}>بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ</Text> : null}
                    <QuranPageText
                      page={currentPage}
                      ayahs={segment.ayahs}
                      appearance={appearance}
                      locale={locale}
                      selectedKey={selectedAyah ? refKey(selectedAyah) : null}
                      highlightedKey={prefs.highlightAudio && activeAyah ? refKey(activeAyah) : null}
                      onPressAyah={handleAyahTap}
                    />
                  </View>
                );
              })}
              <Text style={styles.mushafPageNumber}>{num(currentPage)}</Text>
            </View>
          </ScrollView>
          <View style={styles.pageNav}><Pressable disabled={currentPage <= 1} onPress={() => openPage(currentPage - 1)} style={[styles.pageNavButton, currentPage <= 1 && styles.disabled]}><Text style={styles.pageNavText}>{ar ? "›" : "‹"} {tr("Previous", "السابق")}</Text></Pressable><View style={styles.pageNumberPill}><Text style={styles.pageNumberPillText}>📖 {tr(`Page ${currentPage}`, `صفحة ${num(currentPage)}`)}</Text></View><Pressable disabled={currentPage >= 604} onPress={() => openPage(currentPage + 1)} style={[styles.pageNavButton, currentPage >= 604 && styles.disabled]}><Text style={styles.pageNavText}>{tr("Next", "التالي")} {ar ? "‹" : "›"}</Text></Pressable></View>
        </View>
      ) : (
        <ScrollView style={styles.flex} contentContainerStyle={styles.studyWrap} showsVerticalScrollIndicator={false}>
          <View style={styles.studySheet}>
            <View style={styles.surahHeader}><Text style={styles.surahArabic}>{readerSurah.nameArabic}</Text>{!ar ? <Text style={styles.surahEnglish}>{readerSurah.nameTransliterated} • {readerSurah.nameEnglish}</Text> : null}</View>
            {readerSurah.number !== 1 && readerSurah.number !== 9 ? <Text style={[styles.basmala, { fontSize: Math.max(22, appearance.fontSize - 2), lineHeight: Math.round(Math.max(22, appearance.fontSize - 2) * appearance.lineHeightMultiplier) }]}>بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ</Text> : null}
            {readerAyahs.map((ayah) => <Pressable key={refKey(ayah)} onPress={() => handleAyahTap(ayah)} style={[styles.studyAyah, activeAyah?.surah === ayah.surah && activeAyah?.ayah === ayah.ayah && prefs.highlightAudio && styles.studyPlaying]}><View style={styles.studyTop}><Text style={styles.ayahPill}>{num(ayah.ayah)}</Text><Pressable onPress={() => playAyah(ayah)} style={styles.smallPlay}><Text>▶️</Text></Pressable></View><Text style={[styles.studyArabic, { fontSize: appearance.fontSize, lineHeight: Math.round(appearance.fontSize * appearance.lineHeightMultiplier) }]}>{ayah.text}</Text></Pressable>)}
          </View>
        </ScrollView>
      )}
      {selectedAyah ? <View style={styles.ayahActions}><Text style={styles.actionRef}>{ar ? getSurah(selectedAyah.surah)?.nameArabic : getSurah(selectedAyah.surah)?.nameTransliterated} • {tr("Ayah", "الآية")} {num(selectedAyah.ayah)}</Text><View style={styles.actionRow}><Pressable onPress={() => playAyah(selectedAyah)} style={styles.actionButton}><Text style={styles.actionEmoji}>▶️</Text><Text style={styles.actionLabel}>{tr("Play", "تشغيل")}</Text></Pressable><Pressable onPress={() => playAyah(selectedAyah, true)} style={styles.actionButton}><Text style={styles.actionEmoji}>🔁</Text><Text style={styles.actionLabel}>{tr("Repeat", "تكرار")}</Text></Pressable><Pressable onPress={() => startRange(selectedAyah)} style={styles.actionButton}><Text style={styles.actionEmoji}>✨</Text><Text style={styles.actionLabel}>{tr("Phrase", "مقطع")}</Text></Pressable><Pressable onPress={() => toggleBookmark(selectedAyah)} style={styles.actionButton}><Text style={styles.actionEmoji}>🔖</Text><Text style={styles.actionLabel}>{tr("Save", "حفظ")}</Text></Pressable><Pressable onPress={() => { const next = { surah: selectedAyah.surah, start: selectedAyah.ayah, end: selectedAyah.ayah }; setMemorizeRange(next); void AsyncStorage.setItem(KEYS.memorize, JSON.stringify(next)); setScreen("memorize"); }} style={styles.actionButton}><Text style={styles.actionEmoji}>📿</Text><Text style={styles.actionLabel}>{tr("Memorize", "حفظ")}</Text></Pressable></View></View> : null}
      {miniPlayer}
    </View>
  ) : null;

  const memorize = memorizeRange ? (
    <View style={styles.flex}>{topBar(tr("Memorize", "الحفظ"), `${ar ? getSurah(memorizeRange.surah)?.nameArabic : getSurah(memorizeRange.surah)?.nameTransliterated} • ${num(memorizeRange.start)}–${num(memorizeRange.end)}`)}<ScrollView contentContainerStyle={styles.memoryWrap}><View style={styles.memoryControls}><Pressable onPress={() => playRange(memorizeRange, true)} style={styles.memoryButton}><Text>🔁 {tr("Repeat selection", "تكرار المقطع")}</Text></Pressable><Pressable onPress={() => setMemorizeHidden((v) => !v)} style={styles.memoryButton}><Text>{memorizeHidden ? `👁️ ${tr("Reveal", "إظهار")}` : `🙈 ${tr("Hide Arabic", "إخفاء النص")}`}</Text></Pressable></View>{getSurahAyahs(memorizeRange.surah).slice(memorizeRange.start - 1, memorizeRange.end).map((ayah) => <View key={refKey(ayah)} style={styles.memoryCard}><Text style={styles.bookmarkRef}>{num(ayah.ayah)}</Text><Text style={[styles.memoryArabic, memorizeHidden && styles.hidden]}>{memorizeHidden ? "••••••••••••••••" : ayah.text}</Text></View>)}</ScrollView>{miniPlayer}</View>
  ) : <View style={styles.centered}><Text style={styles.big}>📿</Text><Text style={styles.title}>{tr("Choose an ayah first", "اختر آية أولاً")}</Text><Pressable onPress={() => setScreen("surahs")} style={styles.primary}><Text style={styles.primaryText}>{tr("Choose Surah", "اختر سورة")}</Text></Pressable></View>;

  const menu = (
    <Modal visible={menuOpen} transparent animationType="slide" onRequestClose={() => setMenuOpen(false)}>
      <Pressable style={styles.modalBackdrop} onPress={() => setMenuOpen(false)}>
        <Pressable style={styles.sheet} onPress={(event) => event.stopPropagation()}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}><View><Text style={styles.sheetTitle}>☰ {tr("Qur’an Menu", "قائمة القرآن")}</Text><Text style={styles.sheetSub}>{tr("Everything in one place", "كل الإعدادات في مكان واحد")}</Text></View><Pressable onPress={() => setMenuOpen(false)} style={styles.closeButton}><Text>✕</Text></Pressable></View>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.sheetContent}>
            <Text style={styles.menuSection}>🎧 {tr("AUDIO", "الصوت")}</Text>
            <Text style={styles.menuLabel}>{tr("Reciter", "القارئ")}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>{RECITERS.map((item) => <Pressable key={item.id} onPress={() => updateReciter(item.id)} style={[styles.chip, prefs.reciter === item.id && styles.chipActive]}><Text style={[styles.chipText, prefs.reciter === item.id && styles.chipTextActive]}>{ar ? item.ar : item.en}</Text></Pressable>)}</ScrollView>

            <View style={styles.menuToggle}><View style={styles.toggleCopy}><Text style={styles.toggleTitle}>✨ {tr("Highlight while audio plays", "تمييز النص أثناء التشغيل")}</Text><Text style={styles.toggleSub}>{tr("Follow the current ayah automatically", "تمييز الآية الحالية تلقائيًا")}</Text></View><Switch value={prefs.highlightAudio} onValueChange={(value) => persistPrefs({ highlightAudio: value })} /></View>

            <Text style={styles.menuLabel}>{tr("Playback speed", "سرعة التشغيل")} · {prefs.speed.toFixed(1)}×</Text>
            <View style={styles.stepRow}><Pressable onPress={() => updateSpeed(prefs.speed - 0.1)} style={styles.stepButton}><Text style={styles.stepText}>−</Text></Pressable><View style={styles.stepValue}><Text style={styles.stepValueText}>{prefs.speed.toFixed(1)}×</Text></View><Pressable onPress={() => updateSpeed(prefs.speed + 0.1)} style={styles.stepButton}><Text style={styles.stepText}>+</Text></Pressable></View>

            {readerSurah ? <View style={styles.menuGrid}><Pressable onPress={() => { playSurah(readerSurah.number, 1); setMenuOpen(false); }} style={styles.menuAction}><Text style={styles.menuActionEmoji}>▶️</Text><Text style={styles.menuActionText}>{tr("Play Surah", "تشغيل السورة")}</Text></Pressable><Pressable onPress={() => { playSurah(readerSurah.number, 1, true); setMenuOpen(false); }} style={styles.menuAction}><Text style={styles.menuActionEmoji}>🔁</Text><Text style={styles.menuActionText}>{tr("Loop Surah", "تكرار السورة")}</Text></Pressable><Pressable onPress={() => { continueQuran(position); setMenuOpen(false); }} style={styles.menuAction}><Text style={styles.menuActionEmoji}>⏩</Text><Text style={styles.menuActionText}>{tr("Continue Qur’an", "متابعة القرآن")}</Text></Pressable><Pressable disabled={!range} onPress={() => { playRange(range, repeatQueue); setMenuOpen(false); }} style={[styles.menuAction, !range && styles.disabled]}><Text style={styles.menuActionEmoji}>✨</Text><Text style={styles.menuActionText}>{tr("Play phrase/range", "تشغيل المقطع")}</Text></Pressable></View> : null}

            {activeAyah ? <View style={styles.transport}><Pressable onPress={() => QuranAudio?.seekBy(-10000)} style={styles.transportButton}><Text>↩️ 10</Text></Pressable><Pressable onPress={() => audioStatus.state === "playing" ? QuranAudio?.pause() : QuranAudio?.resume()} style={styles.transportMain}><Text>{audioStatus.state === "playing" ? "⏸️" : "▶️"}</Text></Pressable><Pressable onPress={() => QuranAudio?.seekBy(10000)} style={styles.transportButton}><Text>10 ↪️</Text></Pressable><Pressable onPress={stopAudio} style={styles.transportButton}><Text>⏹️</Text></Pressable></View> : null}

            <View style={styles.divider} />
            <Text style={styles.menuSection}>📖 {tr("READING", "القراءة")}</Text>
            <Text style={styles.menuLabel}>{tr("Reader layout", "شكل القارئ")}</Text>
            <View style={styles.twoCol}><Pressable onPress={() => persistPrefs({ readerMode: "mushaf" })} style={[styles.choice, prefs.readerMode === "mushaf" && styles.choiceActive]}><Text style={prefs.readerMode === "mushaf" ? styles.choiceTextActive : styles.choiceText}>📖 {tr("Mushaf", "المصحف")}</Text></Pressable><Pressable onPress={() => persistPrefs({ readerMode: "study" })} style={[styles.choice, prefs.readerMode === "study" && styles.choiceActive]}><Text style={prefs.readerMode === "study" ? styles.choiceTextActive : styles.choiceText}>📿 {tr("Study", "الدراسة")}</Text></Pressable></View>

            <Pressable onPress={() => { setMenuOpen(false); setTimeout(() => setAppearanceOpen(true), 120); }} style={styles.appearanceLauncher}><View style={styles.appearanceIcon}><Text style={styles.appearanceIconText}>Aa</Text></View><View style={styles.toggleCopy}><Text style={styles.toggleTitle}>🎨 {tr("Qur’an appearance", "مظهر القرآن")}</Text><Text style={styles.toggleSub}>{tr(appearance.font === "qcf-v2" ? "King Fahad Complex V2" : appearance.font === "qcf-v1" ? "King Fahad Complex V1" : "QPC Uthmani Hafs", appearance.font === "qcf-v2" ? "مجمع الملك فهد V2" : appearance.font === "qcf-v1" ? "مجمع الملك فهد V1" : "عثماني حفص QPC")} · {appearance.fontSize} · {appearance.tajweed ? tr("Tajweed on", "التجويد مفعّل") : tr("Tajweed off", "التجويد متوقف")}</Text></View><Text style={styles.launchArrow}>{ar ? "‹" : "›"}</Text></Pressable>

            <View style={styles.divider} />
            <Text style={styles.menuSection}>🧭 {tr("NAVIGATION", "التنقل")}</Text>
            <View style={styles.menuGrid}><Pressable onPress={() => { setScreen("surahs"); setMenuOpen(false); }} style={styles.menuAction}><Text style={styles.menuActionEmoji}>🕋</Text><Text style={styles.menuActionText}>{tr("Surahs", "السور")}</Text></Pressable><Pressable onPress={() => { setScreen("search"); setMenuOpen(false); }} style={styles.menuAction}><Text style={styles.menuActionEmoji}>🔎</Text><Text style={styles.menuActionText}>{tr("Search", "بحث")}</Text></Pressable><Pressable onPress={() => { setScreen("bookmarks"); setMenuOpen(false); }} style={styles.menuAction}><Text style={styles.menuActionEmoji}>🔖</Text><Text style={styles.menuActionText}>{tr("Bookmarks", "العلامات")}</Text></Pressable><Pressable onPress={() => { if (memorizeRange) setScreen("memorize"); setMenuOpen(false); }} style={[styles.menuAction, !memorizeRange && styles.disabled]}><Text style={styles.menuActionEmoji}>📿</Text><Text style={styles.menuActionText}>{tr("Memorize", "الحفظ")}</Text></Pressable></View>

            <Text style={styles.menuLabel}>{tr("Go to Mushaf page", "الذهاب إلى صفحة")}</Text>
            <View style={styles.jumpRow}><TextInput value={pageJump} onChangeText={setPageJump} keyboardType="number-pad" placeholder="1–604" style={styles.pageInput} /><Pressable onPress={() => { const page = clamp(Number(pageJump) || 1, 1, 604); const start = pages[page - 1]; if (start) openReader(start.surah, start.ayah, screen); setMenuOpen(false); }} style={styles.jumpButton}><Text style={styles.jumpButtonText}>{tr("Go", "اذهب")}</Text></Pressable></View>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );

  let body = home;
  if (screen === "surahs") body = surahList;
  else if (screen === "search") body = search;
  else if (screen === "bookmarks") body = bookmarkScreen;
  else if (screen === "reader" && reader) body = reader;
  else if (screen === "memorize") body = memorize;

  return <View style={styles.flex}>{body}{screen !== "reader" && screen !== "memorize" ? miniPlayer : null}{menu}<ReaderSettingsSheet visible={appearanceOpen} locale={locale} appearance={appearance} setAppearance={setAppearance} reset={resetAppearance} onDone={() => setAppearanceOpen(false)} /></View>;
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: "#f7f4ec" },
  rtl: { textAlign: "right", writingDirection: "rtl" },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 28, backgroundColor: "#f7f4ec" },
  big: { fontSize: 46 }, title: { fontSize: 20, fontWeight: "900", color: "#173f35", marginTop: 10 },
  primary: { backgroundColor: "#0b654f", borderRadius: 15, paddingHorizontal: 20, paddingVertical: 13, marginTop: 18 }, primaryText: { color: "white", fontWeight: "900" },
  topBar: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#e6e1d7" },
  topCopy: { flex: 1 }, topTitle: { color: "#173f35", fontSize: 18, fontWeight: "900" }, topSubtitle: { color: "#7d8984", fontSize: 9, marginTop: 2 },
  iconButton: { width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "#fff", borderWidth: 1, borderColor: "#ded9cf" }, back: { fontSize: 31, color: "#17483c", lineHeight: 32 },
  menuButton: { width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "#0b654f" }, menuIcon: { color: "white", fontSize: 20, fontWeight: "900" },
  homeContent: { padding: 17, paddingBottom: 120 }, homeHeader: { flexDirection: "row", gap: 11, alignItems: "center", marginBottom: 16 }, eyebrow: { color: "#a17c36", fontSize: 9, fontWeight: "900", letterSpacing: .8 }, heroTitle: { color: "#173f35", fontSize: 29, fontWeight: "900" }, heroSub: { color: "#7c8782", fontSize: 10, marginTop: 2 },
  searchBox: { height: 56, borderRadius: 19, backgroundColor: "#fff", borderWidth: 1, borderColor: "#dedad1", flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 15 }, searchPlaceholder: { color: "#74817c", flex: 1 },
  continueCard: { marginTop: 14, minHeight: 112, borderRadius: 26, backgroundColor: "#0a634d", padding: 16, flexDirection: "row", alignItems: "center", gap: 12 }, continueIcon: { fontSize: 29 }, continueEyebrow: { color: "#d3e7df", fontSize: 8, fontWeight: "900" }, continueTitle: { color: "white", fontSize: 21, fontWeight: "900", marginTop: 4 }, continueMeta: { color: "#c7ded5", fontSize: 10, marginTop: 4 }, lightArrow: { color: "white", fontSize: 28 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 15 }, gridCard: { width: "48%", minHeight: 118, backgroundColor: "#fff", borderWidth: 1, borderColor: "#e1ddd4", borderRadius: 23, padding: 15 }, gridEmoji: { fontSize: 25 }, gridTitle: { color: "#173f35", fontSize: 15, fontWeight: "900", marginTop: 9 }, gridMeta: { color: "#89928e", fontSize: 9, marginTop: 3 },
  infoCard: { marginTop: 14, borderRadius: 20, padding: 14, flexDirection: "row", gap: 10, backgroundColor: "#e9f4ef", borderWidth: 1, borderColor: "#d3e8de" }, infoIcon: { fontSize: 24 }, infoTitle: { color: "#17483c", fontSize: 12, fontWeight: "900" }, infoText: { color: "#70817a", fontSize: 9, lineHeight: 14, marginTop: 3 },
  listContent: { padding: 12, paddingBottom: 120 }, row: { minHeight: 76, borderRadius: 19, backgroundColor: "#fff", borderWidth: 1, borderColor: "#e2ded5", padding: 12, marginBottom: 8, flexDirection: "row", alignItems: "center", gap: 11 }, numberBadge: { width: 40, height: 40, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "#edf5f1" }, numberText: { color: "#0b654f", fontWeight: "900", fontSize: 11 }, rowTitle: { color: "#173f35", fontSize: 14, fontWeight: "900" }, rowMeta: { color: "#85908b", fontSize: 9, marginTop: 3 },
  searchInputWrap: { padding: 12 }, searchInput: { minHeight: 52, borderRadius: 17, backgroundColor: "white", borderWidth: 1, borderColor: "#ddd8ce", paddingHorizontal: 14, color: "#173f35" }, empty: { textAlign: "center", color: "#7b8782", padding: 30 }, searchResult: { backgroundColor: "white", borderRadius: 18, borderWidth: 1, borderColor: "#e1ddd4", padding: 13, marginBottom: 8 }, resultTitle: { color: "#17483c", fontSize: 11, fontWeight: "900" }, resultArabic: { color: "#203f37", fontSize: 21, lineHeight: 34, textAlign: "right", writingDirection: "rtl", marginTop: 6 },
  bookmarkCard: { backgroundColor: "white", borderRadius: 18, borderWidth: 1, borderColor: "#e1ddd4", padding: 14, marginBottom: 8 }, bookmarkRef: { color: "#9a7838", fontSize: 9, fontWeight: "900" }, bookmarkArabic: { fontSize: 23, lineHeight: 38, color: "#183e34", textAlign: "right", writingDirection: "rtl", marginTop: 8 },
  rangeBanner: { backgroundColor: "#fff1c7", padding: 9 }, rangeBannerText: { color: "#7b5d17", fontSize: 10, fontWeight: "900", textAlign: "center" }, tajweedBanner: { backgroundColor: "#edf2ff", padding: 8 }, tajweedBannerText: { color: "#4050aa", fontSize: 9, fontWeight: "800", textAlign: "center" },
  readerPageBody: { flex: 1, backgroundColor: "#f2efe6" }, mushafWrap: { padding: 10, paddingBottom: 16 }, studyWrap: { padding: 11, paddingBottom: 150 }, mushafSheet: { backgroundColor: "#fcf9ef", borderRadius: 15, borderWidth: 1, borderColor: "#ded7c8", padding: 16, minHeight: 650 }, studySheet: { backgroundColor: "transparent" }, mushafPageMeta: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }, mushafMetaText: { color: "#69716e", fontSize: 9, fontWeight: "800" }, mushafPageNumber: { color: "#6f7673", fontSize: 11, fontWeight: "800", textAlign: "center", marginTop: 14 }, pageNav: { flexDirection: "row", alignItems: "center", gap: 7, backgroundColor: "#fff", borderTopWidth: 1, borderTopColor: "#e3ded4", padding: 8 }, pageNavButton: { flex: 1, minHeight: 42, borderRadius: 13, backgroundColor: "#edf5f1", alignItems: "center", justifyContent: "center" }, pageNavText: { color: "#0b654f", fontSize: 9, fontWeight: "900" }, pageNumberPill: { minWidth: 92, minHeight: 42, borderRadius: 13, backgroundColor: "#0b654f", alignItems: "center", justifyContent: "center", paddingHorizontal: 8 }, pageNumberPillText: { color: "#fff", fontSize: 9, fontWeight: "900" },
  surahHeader: { alignItems: "center", borderWidth: 1, borderColor: "#0b8063", backgroundColor: "#f8f3e7", padding: 10, marginBottom: 12 }, surahArabic: { fontSize: 25, color: "#173f35", fontWeight: "900", writingDirection: "rtl" }, surahEnglish: { color: "#7d776d", fontSize: 9, marginTop: 3 }, basmala: { textAlign: "center", writingDirection: "rtl", color: "#111", lineHeight: 44, marginVertical: 9 }, mushafText: { textAlign: "right", writingDirection: "rtl" }, inlineAyah: { color: "#111", textAlign: "right", writingDirection: "rtl" }, verseNumber: { color: "#0b8b69", fontSize: 19, fontWeight: "700" }, audioHighlight: { backgroundColor: "#dff4e8" }, rangeHighlight: { backgroundColor: "#fff2be" }, selectedHighlight: { backgroundColor: "#dbe9ff" },
  studyAyah: { backgroundColor: "white", borderRadius: 20, borderWidth: 1, borderColor: "#e1ddd4", padding: 15, marginBottom: 9 }, studyPlaying: { borderColor: "#0b8b69", borderWidth: 2, backgroundColor: "#f5fff9" }, studyTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" }, ayahPill: { minWidth: 34, textAlign: "center", backgroundColor: "#edf5f1", color: "#0b654f", padding: 7, borderRadius: 11, fontWeight: "900" }, smallPlay: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: "#edf5f1" }, studyArabic: { color: "#173f35", textAlign: "right", writingDirection: "rtl", marginTop: 9 },
  ayahActions: { backgroundColor: "white", borderTopWidth: 1, borderTopColor: "#e1ddd4", padding: 9 }, actionRef: { color: "#17483c", fontSize: 9, fontWeight: "900", marginBottom: 7 }, actionRow: { flexDirection: "row", gap: 6 }, actionButton: { flex: 1, minHeight: 50, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: "#f0f5f2" }, actionEmoji: { fontSize: 17 }, actionLabel: { color: "#31564b", fontSize: 7, fontWeight: "900", marginTop: 2 },
  miniPlayer: { backgroundColor: "#113f35", paddingHorizontal: 11, paddingVertical: 9, flexDirection: "row", alignItems: "center", gap: 6, borderTopWidth: 1, borderTopColor: "#2b5d51" }, miniCopy: { flex: 1 }, miniEyebrow: { color: "#bdd9d0", fontSize: 7, fontWeight: "900" }, miniTitle: { color: "white", fontSize: 11, fontWeight: "900", marginTop: 2 }, miniMeta: { color: "#b9d1c9", fontSize: 8, marginTop: 2 }, playerButton: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,.1)" },
  memoryWrap: { padding: 12, paddingBottom: 120 }, memoryControls: { flexDirection: "row", gap: 8, marginBottom: 10 }, memoryButton: { flex: 1, minHeight: 46, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "#edf5f1" }, memoryCard: { backgroundColor: "white", borderRadius: 19, borderWidth: 1, borderColor: "#e0ddd4", padding: 15, marginBottom: 8 }, memoryArabic: { color: "#183e34", fontSize: 28, lineHeight: 48, textAlign: "right", writingDirection: "rtl", marginTop: 7 }, hidden: { color: "#9ca6a1", textAlign: "center", letterSpacing: 3 },
  modalBackdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,.45)" }, sheet: { maxHeight: "92%", backgroundColor: "#fbfaf6", borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingTop: 8 }, sheetHandle: { width: 44, height: 5, borderRadius: 99, backgroundColor: "#c9c5bc", alignSelf: "center", marginBottom: 7 }, sheetHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 17, paddingBottom: 11, borderBottomWidth: 1, borderBottomColor: "#e5e0d6" }, sheetTitle: { color: "#173f35", fontSize: 20, fontWeight: "900" }, sheetSub: { color: "#83908a", fontSize: 9, marginTop: 2 }, closeButton: { width: 40, height: 40, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: "#efede7" }, sheetContent: { padding: 16, paddingBottom: 42 },
  menuSection: { color: "#9a7838", fontSize: 10, fontWeight: "900", letterSpacing: .8, marginBottom: 10 }, menuLabel: { color: "#31564b", fontSize: 10, fontWeight: "900", marginTop: 10, marginBottom: 7 }, chipsRow: { gap: 7, paddingBottom: 3 }, chip: { borderRadius: 99, borderWidth: 1, borderColor: "#d8d3c9", backgroundColor: "white", paddingHorizontal: 11, paddingVertical: 9 }, chipActive: { backgroundColor: "#0b654f", borderColor: "#0b654f" }, chipText: { color: "#53645e", fontSize: 9, fontWeight: "800" }, chipTextActive: { color: "white" },
  menuToggle: { marginTop: 11, padding: 13, borderRadius: 17, backgroundColor: "white", borderWidth: 1, borderColor: "#e1ddd4", flexDirection: "row", alignItems: "center", gap: 10 }, appearanceLauncher: { marginTop: 11, padding: 13, borderRadius: 17, backgroundColor: "#edf6f2", borderWidth: 1, borderColor: "#d5e9e0", flexDirection: "row", alignItems: "center", gap: 11 }, appearanceIcon: { width: 43, height: 43, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "#0b654f" }, appearanceIconText: { color: "#fff", fontSize: 14, fontWeight: "900" }, launchArrow: { color: "#0b654f", fontSize: 25, fontWeight: "800" }, toggleCopy: { flex: 1 }, toggleTitle: { color: "#173f35", fontSize: 11, fontWeight: "900" }, toggleSub: { color: "#87918d", fontSize: 8, marginTop: 3 },
  stepRow: { flexDirection: "row", gap: 8, alignItems: "center" }, stepButton: { width: 55, height: 44, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: "#edf5f1" }, stepText: { color: "#0b654f", fontSize: 16, fontWeight: "900" }, stepValue: { flex: 1, height: 44, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: "white", borderWidth: 1, borderColor: "#e0dbd2" }, stepValueText: { color: "#173f35", fontWeight: "900" },
  menuGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 }, menuAction: { width: "48%", minHeight: 72, borderRadius: 17, backgroundColor: "white", borderWidth: 1, borderColor: "#e1ddd4", padding: 11, alignItems: "center", justifyContent: "center" }, menuActionEmoji: { fontSize: 20 }, menuActionText: { color: "#31564b", fontSize: 9, fontWeight: "900", textAlign: "center", marginTop: 5 }, disabled: { opacity: .38 },
  transport: { flexDirection: "row", gap: 7, marginTop: 10 }, transportButton: { flex: 1, height: 45, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: "#edf5f1" }, transportMain: { width: 55, height: 45, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: "#0b654f" }, divider: { height: 1, backgroundColor: "#e4ded4", marginVertical: 18 },
  twoCol: { flexDirection: "row", gap: 8 }, threeCol: { flexDirection: "row", gap: 7 }, choice: { flex: 1, minHeight: 44, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: "white", borderWidth: 1, borderColor: "#ded9cf" }, smallChoice: { flex: 1, minHeight: 42, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: "white", borderWidth: 1, borderColor: "#ded9cf" }, choiceActive: { backgroundColor: "#0b654f", borderColor: "#0b654f" }, choiceText: { color: "#53645e", fontSize: 9, fontWeight: "900" }, choiceTextActive: { color: "white", fontSize: 9, fontWeight: "900" },
  jumpRow: { flexDirection: "row", gap: 8 }, pageInput: { flex: 1, height: 46, borderRadius: 13, borderWidth: 1, borderColor: "#ded9cf", backgroundColor: "white", paddingHorizontal: 12 }, jumpButton: { width: 80, height: 46, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: "#0b654f" }, jumpButtonText: { color: "white", fontWeight: "900" }
});
