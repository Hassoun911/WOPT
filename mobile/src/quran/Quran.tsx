import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  BackHandler,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent
} from "react-native";
import {
  allJuz,
  allPages,
  allSurahs,
  ayahsInRange,
  getAyah,
  getSurah,
  getSurahAyahs,
  juzForAyah,
  pageForAyah,
  quranReady,
  quranSource,
  searchQuran,
  type QuranAyah,
  type QuranLocale,
  type QuranSearchResult,
  type QuranSurah
} from "./quranData";

type QuranScreen = "home" | "surahs" | "juz" | "pages" | "search" | "bookmarks" | "memorize" | "reader";
type QuranPosition = { surah: number; ayah: number };
type MemorizeRange = { surah: number; start: number; end: number };

type Props = {
  locale: QuranLocale;
  onBackHome: () => void;
};

const KEYS = {
  last: "wopt:quran:last:v1",
  bookmarks: "wopt:quran:bookmarks:v1",
  memorize: "wopt:quran:memorize:v1"
};

function refKey(position: QuranPosition) {
  return `${position.surah}:${position.ayah}`;
}

function parseRef(value: string): QuranPosition | null {
  const [surah, ayah] = value.split(":").map(Number);
  if (!surah || !ayah) return null;
  return { surah, ayah };
}

function revelationArabic(value: string) {
  return value === "Meccan" ? "مكية" : value === "Medinan" ? "مدنية" : value;
}

export default function Quran({ locale, onBackHome }: Props) {
  const ar = locale === "ar";
  const tr = (en: string, arabic: string) => ar ? arabic : en;
  const num = (value: number) => ar ? new Intl.NumberFormat("ar").format(value) : String(value);
  const surahName = (surah: QuranSurah | undefined) => !surah ? "" : ar ? surah.nameArabic : surah.nameTransliterated;

  const [screen, setScreen] = useState<QuranScreen>("home");
  const [readerPosition, setReaderPosition] = useState<QuranPosition>({ surah: 1, ayah: 1 });
  const [readerBackTarget, setReaderBackTarget] = useState<QuranScreen>("home");
  const [lastPosition, setLastPosition] = useState<QuranPosition | null>(null);
  const [bookmarks, setBookmarks] = useState<string[]>([]);
  const [memorizeRange, setMemorizeRange] = useState<MemorizeRange | null>(null);
  const [query, setQuery] = useState("");
  const [selectedAyah, setSelectedAyah] = useState<QuranAyah | null>(null);
  const [searchHighlight, setSearchHighlight] = useState<QuranPosition | null>(null);
  const [searchHighlightQuery, setSearchHighlightQuery] = useState("");
  const [searchFocusOnOpen, setSearchFocusOnOpen] = useState(false);
  const [memorizeHidden, setMemorizeHidden] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const searchListRef = useRef<FlatList<QuranSearchResult>>(null);
  const searchScrollOffsetRef = useRef(0);
  const lastSeenRef = useRef("");

  // The reader deliberately uses ScrollView instead of FlatList. A Surah has at
  // most 286 ayahs, and rendering that bounded set avoids FlatList viewability /
  // scrollToIndex crashes that were occurring when opening Surah/Juz/Page links.
  const readerScrollRef = useRef<ScrollView>(null);
  const readerOffsetsRef = useRef<Record<string, number>>({});
  const pendingReaderScrollRef = useRef<string | null>(null);

  const source = quranSource();
  const surahs = allSurahs();
  const pages = allPages();
  const juz = allJuz();
  const readerSurah = getSurah(readerPosition.surah);
  const readerAyahs = useMemo(() => getSurahAyahs(readerPosition.surah), [readerPosition.surah]);
  const searchResults = useMemo(() => query.trim() ? searchQuran(query, 80) : [], [query]);
  const memorizeAyahs = useMemo(
    () => memorizeRange ? ayahsInRange(memorizeRange.surah, memorizeRange.start, memorizeRange.surah, memorizeRange.end) : [],
    [memorizeRange]
  );
  const basmala = getAyah(1, 1)?.text ?? "بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ";

  useEffect(() => {
    void (async () => {
      const [savedLast, savedBookmarks, savedMemorize] = await Promise.all([
        AsyncStorage.getItem(KEYS.last),
        AsyncStorage.getItem(KEYS.bookmarks),
        AsyncStorage.getItem(KEYS.memorize)
      ]);
      try {
        if (savedLast) {
          const value = JSON.parse(savedLast) as QuranPosition;
          if (getAyah(value.surah, value.ayah)) setLastPosition(value);
        }
      } catch {}
      try {
        if (savedBookmarks) setBookmarks(JSON.parse(savedBookmarks) as string[]);
      } catch {}
      try {
        if (savedMemorize) setMemorizeRange(JSON.parse(savedMemorize) as MemorizeRange);
      } catch {}
      setLoaded(true);
    })();
  }, []);

  const persistLast = (position: QuranPosition) => {
    const key = refKey(position);
    if (lastSeenRef.current === key) return;
    lastSeenRef.current = key;
    setLastPosition(position);
    void AsyncStorage.setItem(KEYS.last, JSON.stringify(position));
  };

  const openSearch = () => {
    setSearchFocusOnOpen(true);
    setScreen("search");
  };

  const restoreSearch = () => {
    setSearchFocusOnOpen(false);
    setScreen("search");
    setTimeout(() => {
      searchListRef.current?.scrollToOffset({ offset: searchScrollOffsetRef.current, animated: false });
    }, 80);
  };

  const openReader = (
    surah: number,
    ayah = 1,
    options?: { backTo?: QuranScreen; highlightSearch?: boolean }
  ) => {
    const target = getAyah(surah, ayah);
    if (!target) return;
    const safePosition = { surah: target.surah, ayah: target.ayah };
    readerOffsetsRef.current = {};
    pendingReaderScrollRef.current = refKey(safePosition);
    setSelectedAyah(null);
    setReaderPosition(safePosition);
    setReaderBackTarget(options?.backTo ?? screen);
    if (options?.highlightSearch) {
      setSearchHighlight(safePosition);
      setSearchHighlightQuery(query.trim());
    } else {
      setSearchHighlight(null);
      setSearchHighlightQuery("");
    }
    persistLast(safePosition);
    setScreen("reader");
  };

  const openSearchResult = (item: QuranSearchResult) => {
    const ayah = item.ayah?.ayah ?? 1;
    openReader(item.surah.number, ayah, { backTo: "search", highlightSearch: Boolean(item.ayah) });
  };

  const handleBack = () => {
    if (screen === "reader") {
      if (readerBackTarget === "search") restoreSearch();
      else setScreen(readerBackTarget === "reader" ? "home" : readerBackTarget);
      return true;
    }
    if (screen === "home") {
      onBackHome();
      return true;
    }
    setScreen("home");
    return true;
  };

  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", handleBack);
    return () => subscription.remove();
  }, [screen, readerBackTarget]);

  const toggleBookmark = (ayah: QuranAyah) => {
    const key = refKey(ayah);
    const next = bookmarks.includes(key) ? bookmarks.filter((item) => item !== key) : [key, ...bookmarks];
    setBookmarks(next);
    void AsyncStorage.setItem(KEYS.bookmarks, JSON.stringify(next));
  };

  const startMemorizing = (ayah: QuranAyah) => {
    const next = { surah: ayah.surah, start: ayah.ayah, end: ayah.ayah };
    setMemorizeRange(next);
    setMemorizeHidden(false);
    void AsyncStorage.setItem(KEYS.memorize, JSON.stringify(next));
    setScreen("memorize");
  };

  const updateMemorizeRange = (next: MemorizeRange) => {
    const surah = getSurah(next.surah);
    if (!surah) return;
    const safe = {
      surah: next.surah,
      start: Math.max(1, Math.min(next.start, surah.ayahCount)),
      end: Math.max(1, Math.min(next.end, surah.ayahCount))
    };
    if (safe.end < safe.start) safe.end = safe.start;
    setMemorizeRange(safe);
    void AsyncStorage.setItem(KEYS.memorize, JSON.stringify(safe));
  };

  const registerAyahOffset = (ayah: QuranAyah, event: LayoutChangeEvent) => {
    const key = refKey(ayah);
    const y = event.nativeEvent.layout.y;
    readerOffsetsRef.current[key] = y;
    if (pendingReaderScrollRef.current === key) {
      pendingReaderScrollRef.current = null;
      setTimeout(() => readerScrollRef.current?.scrollTo({ y: Math.max(0, y - 12), animated: false }), 0);
    }
  };

  const persistReaderFromScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = event.nativeEvent.contentOffset.y + 120;
    let nearest: QuranAyah | undefined;
    let nearestY = -1;
    for (const ayah of readerAyahs) {
      const ayahY = readerOffsetsRef.current[refKey(ayah)];
      if (typeof ayahY === "number" && ayahY <= y && ayahY >= nearestY) {
        nearest = ayah;
        nearestY = ayahY;
      }
    }
    if (nearest) persistLast({ surah: nearest.surah, ayah: nearest.ayah });
  };

  if (!quranReady()) {
    return (
      <View style={styles.centered}>
        <Text style={styles.bigIcon}>📖</Text>
        <Text style={styles.centerTitle}>{tr("Qur’an data unavailable", "بيانات القرآن غير متاحة")}</Text>
        <Text style={styles.centerText}>{tr("The verified offline Qur’an bundle is required before the reader can open.", "يلزم توفر نسخة القرآن الموثقة المحفوظة داخل التطبيق لفتح القارئ.")}</Text>
        <Pressable onPress={onBackHome} style={styles.primaryButton}><Text style={styles.primaryButtonText}>{tr("Back to Home", "العودة للرئيسية")}</Text></Pressable>
      </View>
    );
  }

  if (!loaded) {
    return <View style={styles.centered}><Text style={styles.centerText}>{tr("Loading Qur’an…", "جارٍ تحميل القرآن…")}</Text></View>;
  }

  const topBar = (title: string, subtitle?: string, showSearch = true) => (
    <View style={styles.topBar}>
      <Pressable onPress={handleBack} style={styles.backButton}><Text style={styles.backText}>{ar ? "›" : "‹"}</Text></Pressable>
      <View style={styles.topCopy}>
        <Text style={[styles.topTitle, ar && styles.rtl]}>{title}</Text>
        {subtitle ? <Text style={[styles.topSubtitle, ar && styles.rtl]}>{subtitle}</Text> : null}
      </View>
      {showSearch ? <Pressable onPress={openSearch} style={styles.searchIconButton}><Text style={styles.searchIcon}>🔎</Text></Pressable> : <View style={styles.topSpacer} />}
    </View>
  );

  const currentLastSurah = lastPosition ? getSurah(lastPosition.surah) : undefined;
  const currentMemorizeSurah = memorizeRange ? getSurah(memorizeRange.surah) : undefined;

  const homeScreen = (
    <ScrollView style={styles.flex} contentContainerStyle={styles.homeContent} showsVerticalScrollIndicator={false}>
      <View style={styles.quranHeader}>
        <Pressable onPress={onBackHome} style={styles.backButton}><Text style={styles.backText}>{ar ? "›" : "‹"}</Text></Pressable>
        <View style={styles.topCopy}>
          <Text style={[styles.quranEyebrow, ar && styles.rtl]}>{tr("WOPT • NATIVE ANDROID", "ووبت • قارئ أندرويد أصلي")}</Text>
          <Text style={[styles.quranTitle, ar && styles.rtl]}>{tr("The Qur’an", "القرآن الكريم")}</Text>
        </View>
        <View style={styles.verifiedPill}><Text style={styles.verifiedText}>{tr("✓ Verified", "✓ موثّق")}</Text></View>
      </View>

      <Pressable onPress={openSearch} style={styles.searchBox}>
        <Text style={styles.searchBoxIcon}>🔎</Text>
        <Text style={[styles.searchPlaceholder, ar && styles.rtl]}>{tr("Search Arabic, Surah name or number", "ابحث بكلمة أو آية أو اسم سورة أو رقمها")}</Text>
      </Pressable>

      {lastPosition && getAyah(lastPosition.surah, lastPosition.ayah) ? (
        <Pressable onPress={() => openReader(lastPosition.surah, lastPosition.ayah, { backTo: "home" })} style={styles.continueCard}>
          <View style={styles.continueIcon}><Text style={styles.continueEmoji}>📖</Text></View>
          <View style={styles.continueCopy}>
            <Text style={[styles.continueEyebrow, ar && styles.rtl]}>{tr("CONTINUE READING", "تابع القراءة")}</Text>
            <Text style={[styles.continueTitle, ar && styles.rtl]}>{surahName(currentLastSurah)}</Text>
            <Text style={[styles.continueMeta, ar && styles.rtl]}>{tr(
              `Ayah ${lastPosition.ayah} • Page ${pageForAyah(lastPosition.surah, lastPosition.ayah) ?? "—"} • Juz ${juzForAyah(lastPosition.surah, lastPosition.ayah) ?? "—"}`,
              `الآية ${num(lastPosition.ayah)} • الصفحة ${num(pageForAyah(lastPosition.surah, lastPosition.ayah) ?? 0)} • الجزء ${num(juzForAyah(lastPosition.surah, lastPosition.ayah) ?? 0)}`
            )}</Text>
          </View>
          <Text style={styles.lightChevron}>{ar ? "‹" : "›"}</Text>
        </Pressable>
      ) : (
        <Pressable onPress={() => openReader(1, 1, { backTo: "home" })} style={styles.continueCard}>
          <View style={styles.continueIcon}><Text style={styles.continueEmoji}>📖</Text></View>
          <View style={styles.continueCopy}>
            <Text style={[styles.continueEyebrow, ar && styles.rtl]}>{tr("BEGIN READING", "ابدأ القراءة")}</Text>
            <Text style={[styles.continueTitle, ar && styles.rtl]}>{tr("Al-Faatiha", "سورة الفاتحة")}</Text>
            <Text style={[styles.continueMeta, ar && styles.rtl]}>{tr("Start at the beginning of the Qur’an", "ابدأ من أول القرآن الكريم")}</Text>
          </View>
          <Text style={styles.lightChevron}>{ar ? "‹" : "›"}</Text>
        </Pressable>
      )}

      <Text style={[styles.sectionTitle, ar && styles.rtl]}>✨ {tr("Explore the Qur’an", "تصفّح القرآن")}</Text>
      <View style={styles.grid}>
        <Pressable onPress={() => setScreen("surahs")} style={styles.gridCard}><Text style={styles.gridEmoji}>📚</Text><Text style={[styles.gridTitle, ar && styles.rtl]}>{tr("Surahs", "السور")}</Text><Text style={[styles.gridMeta, ar && styles.rtl]}>{tr("114 chapters", `${num(114)} سورة`)}</Text></Pressable>
        <Pressable onPress={() => setScreen("juz")} style={styles.gridCard}><Text style={styles.gridEmoji}>🧩</Text><Text style={[styles.gridTitle, ar && styles.rtl]}>{tr("Juz", "الأجزاء")}</Text><Text style={[styles.gridMeta, ar && styles.rtl]}>{tr("30 parts", `${num(30)} جزءًا`)}</Text></Pressable>
        <Pressable onPress={() => setScreen("pages")} style={styles.gridCard}><Text style={styles.gridEmoji}>📄</Text><Text style={[styles.gridTitle, ar && styles.rtl]}>{tr("Pages", "الصفحات")}</Text><Text style={[styles.gridMeta, ar && styles.rtl]}>{tr("604 pages", `${num(604)} صفحة`)}</Text></Pressable>
        <Pressable onPress={() => setScreen("bookmarks")} style={styles.gridCard}><Text style={styles.gridEmoji}>⭐</Text><Text style={[styles.gridTitle, ar && styles.rtl]}>{tr("Bookmarks", "العلامات المحفوظة")}</Text><Text style={[styles.gridMeta, ar && styles.rtl]}>{tr(`${bookmarks.length} saved`, `${num(bookmarks.length)} محفوظة`)}</Text></Pressable>
      </View>

      <Pressable onPress={() => memorizeRange ? setScreen("memorize") : openReader(lastPosition?.surah ?? 1, lastPosition?.ayah ?? 1, { backTo: "home" })} style={styles.memorizeCard}>
        <View style={styles.memorizeIcon}><Text style={styles.memorizeEmoji}>🧠</Text></View>
        <View style={styles.continueCopy}>
          <Text style={[styles.memorizeEyebrow, ar && styles.rtl]}>{tr("SMART MEMORIZATION", "الحفظ الذكي")}</Text>
          <Text style={[styles.memorizeTitle, ar && styles.rtl]}>{memorizeRange ? `${surahName(currentMemorizeSurah)} • ${tr("Ayah", "الآية")} ${num(memorizeRange.start)}${memorizeRange.end > memorizeRange.start ? `–${num(memorizeRange.end)}` : ""}` : tr("Choose an ayah to memorize", "اختر آية لبدء الحفظ")}</Text>
          <Text style={[styles.memorizeMeta, ar && styles.rtl]}>{tr("Focus • hide/reveal • selected range", "تركيز • إخفاء وإظهار • نطاق مختار")}</Text>
        </View>
        <Text style={styles.chevron}>{ar ? "‹" : "›"}</Text>
      </Pressable>

      <View style={styles.sourceCard}>
        <Text style={styles.sourceIcon}>✓</Text>
        <View style={styles.continueCopy}>
          <Text style={[styles.sourceTitle, ar && styles.rtl]}>{tr("Verified Uthmani Arabic", "نص عثماني عربي موثّق")}</Text>
          <Text style={[styles.sourceText, ar && styles.rtl]}>{tr(
            `${source.name} v${source.version} • bundled offline • ${source.verifiedCounts.ayahs} verified ayahs`,
            `مصدر موثّق • متاح دون إنترنت • ${num(source.verifiedCounts.ayahs)} آية موثّقة`
          )}</Text>
        </View>
      </View>
    </ScrollView>
  );

  const surahScreen = (
    <View style={styles.flex}>
      {topBar(tr("Surahs", "السور"), tr("114 chapters", `${num(114)} سورة`))}
      <FlatList
        data={surahs}
        keyExtractor={(item) => String(item.number)}
        contentContainerStyle={styles.listContent}
        initialNumToRender={16}
        maxToRenderPerBatch={16}
        windowSize={7}
        renderItem={({ item }) => (
          <Pressable onPress={() => openReader(item.number, 1, { backTo: "surahs" })} style={styles.surahRow}>
            <View style={styles.numberBadge}><Text style={styles.numberText}>{num(item.number)}</Text></View>
            <View style={styles.rowCopy}>
              <Text style={[styles.rowTitle, ar && styles.rtl]}>{ar ? item.nameArabic : item.nameTransliterated}</Text>
              <Text style={[styles.rowMeta, ar && styles.rtl]}>{ar ? `${num(item.ayahCount)} آية • ${revelationArabic(item.revelationType)}` : `${item.nameEnglish} • ${item.ayahCount} ayahs • ${item.revelationType}`}</Text>
            </View>
            {!ar ? <Text style={styles.arabicSurahName}>{item.nameArabic}</Text> : <Text style={styles.rowEmoji}>📖</Text>}
          </Pressable>
        )}
      />
    </View>
  );

  const juzScreen = (
    <View style={styles.flex}>
      {topBar(tr("Juz", "الأجزاء"), tr("30 parts", `${num(30)} جزءًا`))}
      <FlatList
        data={juz}
        keyExtractor={(item) => String(item.juz)}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <Pressable onPress={() => openReader(item.surah, item.ayah, { backTo: "juz" })} style={styles.simpleRow}>
            <View style={styles.numberBadge}><Text style={styles.numberText}>{num(item.juz)}</Text></View>
            <View style={styles.rowCopy}><Text style={[styles.rowTitle, ar && styles.rtl]}>{tr(`Juz ${item.juz}`, `الجزء ${num(item.juz)}`)}</Text><Text style={[styles.rowMeta, ar && styles.rtl]}>{ar ? `${surahName(getSurah(item.surah))} • الآية ${num(item.ayah)}` : `${surahName(getSurah(item.surah))} • Ayah ${item.ayah}`}</Text></View>
            <Text style={styles.chevron}>{ar ? "‹" : "›"}</Text>
          </Pressable>
        )}
      />
    </View>
  );

  const pagesScreen = (
    <View style={styles.flex}>
      {topBar(tr("Pages", "الصفحات"), tr("Medina Mushaf • 604 pages", `مصحف المدينة • ${num(604)} صفحة`))}
      <FlatList
        data={pages}
        keyExtractor={(item) => String(item.page)}
        contentContainerStyle={styles.listContent}
        initialNumToRender={20}
        maxToRenderPerBatch={20}
        windowSize={7}
        renderItem={({ item }) => (
          <Pressable onPress={() => openReader(item.surah, item.ayah, { backTo: "pages" })} style={styles.simpleRow}>
            <View style={styles.numberBadge}><Text style={styles.numberText}>{num(item.page)}</Text></View>
            <View style={styles.rowCopy}><Text style={[styles.rowTitle, ar && styles.rtl]}>{tr(`Page ${item.page}`, `الصفحة ${num(item.page)}`)}</Text><Text style={[styles.rowMeta, ar && styles.rtl]}>{ar ? `${surahName(getSurah(item.surah))} • الآية ${num(item.ayah)}` : `${surahName(getSurah(item.surah))} • Ayah ${item.ayah}`}</Text></View>
            <Text style={styles.chevron}>{ar ? "‹" : "›"}</Text>
          </Pressable>
        )}
      />
    </View>
  );

  const onSearchScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    searchScrollOffsetRef.current = event.nativeEvent.contentOffset.y;
  };

  const searchScreen = (
    <View style={styles.flex}>
      {topBar(tr("Search Qur’an", "البحث في القرآن"), tr("Open a match in the reader, then return to these results", "افتح النتيجة في المصحف ثم ارجع إلى نفس نتائج البحث"), false)}
      <View style={styles.searchInputWrap}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          autoFocus={searchFocusOnOpen}
          placeholder={tr("Search الرحمة, Al-Kahf, 18…", "ابحث: الرحمة، الكهف، ١٨…")}
          placeholderTextColor="#909a96"
          style={[styles.searchInput, ar && styles.rtl]}
          textAlign={ar || /^[\u0600-\u06FF]/.test(query) ? "right" : "left"}
        />
      </View>
      <FlatList<QuranSearchResult>
        ref={searchListRef}
        data={searchResults}
        keyExtractor={(item, index) => item.kind === "surah" ? `s-${item.surah.number}-${index}` : `a-${item.ayah?.surah}-${item.ayah?.ayah}`}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.listContent}
        onScroll={onSearchScroll}
        scrollEventThrottle={32}
        ListEmptyComponent={<Text style={[styles.emptyLabel, ar && styles.rtl]}>{query.trim() ? tr("No matches found.", "لم يتم العثور على نتائج.") : tr("Type Arabic text, a Surah name, or Surah number.", "اكتب كلمة أو آية أو اسم سورة أو رقمها.")}</Text>}
        renderItem={({ item }) => (
          <Pressable onPress={() => openSearchResult(item)} style={styles.searchResult}>
            <View style={styles.rowCopy}>
              <Text style={[styles.rowTitle, ar && styles.rtl]}>{ar ? `${item.surah.nameArabic} ${item.ayah ? `${num(item.surah.number)}:${num(item.ayah.ayah)}` : `• سورة ${num(item.surah.number)}`}` : `${item.surah.nameTransliterated} ${item.ayah ? `${item.surah.number}:${item.ayah.ayah}` : `• Surah ${item.surah.number}`}`}</Text>
              {item.ayah ? <Text style={styles.searchArabic} numberOfLines={3}>{item.ayah.text}</Text> : <Text style={[styles.rowMeta, ar && styles.rtl]}>{ar ? `${num(item.surah.ayahCount)} آية` : `${item.surah.nameEnglish} • ${item.surah.ayahCount} ayahs`}</Text>}
              <View style={[styles.openInQuranPill, ar && styles.alignRight]}><Text style={styles.openInQuranText}>📖 {tr("Open in Qur’an", "عرض في المصحف")}</Text></View>
            </View>
            <Text style={styles.chevron}>{ar ? "‹" : "›"}</Text>
          </Pressable>
        )}
      />
    </View>
  );

  const bookmarkItems = bookmarks
    .map(parseRef)
    .filter((item): item is QuranPosition => Boolean(item))
    .map((item) => getAyah(item.surah, item.ayah))
    .filter((item): item is QuranAyah => Boolean(item));

  const bookmarksScreen = (
    <View style={styles.flex}>
      {topBar(tr("Bookmarks", "العلامات المحفوظة"), tr(`${bookmarkItems.length} saved ayahs`, `${num(bookmarkItems.length)} آية محفوظة`))}
      <FlatList
        data={bookmarkItems}
        keyExtractor={(item) => refKey(item)}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={<Text style={[styles.emptyLabel, ar && styles.rtl]}>{tr("Tap an ayah in the reader and choose Bookmark.", "اضغط على آية في المصحف ثم اختر حفظ العلامة.")}</Text>}
        renderItem={({ item }) => (
          <Pressable onPress={() => openReader(item.surah, item.ayah, { backTo: "bookmarks" })} style={styles.bookmarkRow}>
            <Text style={[styles.bookmarkRef, ar && styles.rtl]}>{surahName(getSurah(item.surah))} {num(item.surah)}:{num(item.ayah)}</Text>
            <Text style={styles.bookmarkArabic} numberOfLines={3}>{item.text}</Text>
          </Pressable>
        )}
      />
    </View>
  );

  const memorizeScreen = memorizeRange ? (
    <ScrollView style={styles.flex} contentContainerStyle={styles.memorizeContent} showsVerticalScrollIndicator={false}>
      {topBar(tr("Memorize", "الحفظ"), `${surahName(getSurah(memorizeRange.surah))} • ${tr("Ayah", "الآية")} ${num(memorizeRange.start)}${memorizeRange.end > memorizeRange.start ? `–${num(memorizeRange.end)}` : ""}`)}
      <View style={styles.rangeCard}>
        <Text style={[styles.rangeTitle, ar && styles.rtl]}>🧠 {tr("Selected range", "النطاق المختار")}</Text>
        <View style={styles.rangeRow}>
          <Pressable onPress={() => updateMemorizeRange({ ...memorizeRange, end: Math.max(memorizeRange.start, memorizeRange.end - 1) })} style={styles.rangeButton}><Text style={styles.rangeButtonText}>−</Text></Pressable>
          <Text style={styles.rangeValue}>{tr("Ayah", "الآية")} {num(memorizeRange.start)}{memorizeRange.end > memorizeRange.start ? `–${num(memorizeRange.end)}` : ""}</Text>
          <Pressable onPress={() => updateMemorizeRange({ ...memorizeRange, end: memorizeRange.end + 1 })} style={styles.rangeButton}><Text style={styles.rangeButtonText}>+</Text></Pressable>
        </View>
        <Pressable onPress={() => setMemorizeHidden((value) => !value)} style={styles.hideButton}><Text style={styles.hideButtonText}>{memorizeHidden ? tr("Reveal Arabic", "إظهار النص العربي") : tr("Hide Arabic to test yourself", "إخفاء النص لاختبار الحفظ")}</Text></Pressable>
      </View>
      {memorizeAyahs.map((ayah) => <View key={refKey(ayah)} style={styles.memoryAyah}><Text style={styles.memoryRef}>{num(ayah.surah)}:{num(ayah.ayah)}</Text><Text style={[styles.memoryArabic, memorizeHidden && styles.hiddenArabic]}>{memorizeHidden ? "••••••••••••••••••••" : ayah.text}</Text></View>)}
      <Pressable onPress={() => openReader(memorizeRange.surah, memorizeRange.start, { backTo: "memorize" })} style={styles.primaryButton}><Text style={styles.primaryButtonText}>📖 {tr("Open in reader", "فتح في المصحف")}</Text></Pressable>
    </ScrollView>
  ) : (
    <View style={styles.centered}><Text style={styles.bigIcon}>🧠</Text><Text style={styles.centerTitle}>{tr("No memorization range yet", "لم يتم اختيار آيات للحفظ بعد")}</Text><Text style={styles.centerText}>{tr("Open any Surah, tap an ayah, then choose Memorize.", "افتح أي سورة واضغط على آية ثم اختر الحفظ.")}</Text><Pressable onPress={() => setScreen("surahs")} style={styles.primaryButton}><Text style={styles.primaryButtonText}>{tr("Choose Surah", "اختر سورة")}</Text></Pressable></View>
  );

  const readerScreen = readerSurah ? (
    <View style={styles.flex}>
      {topBar(
        ar ? readerSurah.nameArabic : readerSurah.nameTransliterated,
        ar
          ? `${num(readerSurah.ayahCount)} آية • الصفحة ${num(pageForAyah(readerPosition.surah, readerPosition.ayah) ?? 0)} • الجزء ${num(juzForAyah(readerPosition.surah, readerPosition.ayah) ?? 0)}`
          : `${readerSurah.nameArabic} • ${readerSurah.ayahCount} ayahs • Page ${pageForAyah(readerPosition.surah, readerPosition.ayah) ?? "—"}`
      )}
      <ScrollView
        ref={readerScrollRef}
        style={styles.flex}
        contentContainerStyle={styles.readerContent}
        showsVerticalScrollIndicator={false}
        onScrollEndDrag={persistReaderFromScroll}
        onMomentumScrollEnd={persistReaderFromScroll}
      >
        <View style={styles.surahHeaderCard}>
          <Text style={styles.surahHeaderArabic}>🌙 {readerSurah.nameArabic}</Text>
          {!ar ? <Text style={styles.surahHeaderEnglish}>{readerSurah.nameTransliterated} • {readerSurah.nameEnglish}</Text> : <Text style={styles.surahHeaderEnglish}>{num(readerSurah.ayahCount)} آية • {revelationArabic(readerSurah.revelationType)}</Text>}
          {readerSurah.number !== 1 && readerSurah.number !== 9 ? <Text style={styles.basmala}>{basmala}</Text> : null}
        </View>

        {readerAyahs.map((item) => {
          const selected = selectedAyah?.surah === item.surah && selectedAyah?.ayah === item.ayah;
          const searchMatched = searchHighlight?.surah === item.surah && searchHighlight?.ayah === item.ayah;
          const bookmarked = bookmarks.includes(refKey(item));
          return (
            <View key={refKey(item)} onLayout={(event) => registerAyahOffset(item, event)} style={[styles.ayahCard, selected && styles.ayahCardSelected, searchMatched && styles.ayahCardSearchMatch]}>
              <Pressable onPress={() => { setSelectedAyah(selected ? null : item); persistLast({ surah: item.surah, ayah: item.ayah }); }}>
                <View style={styles.ayahTopRow}>
                  <View style={styles.ayahNumber}><Text style={styles.ayahNumberText}>{num(item.ayah)}</Text></View>
                  <View style={styles.ayahMetaWrap}>
                    {searchMatched ? <View style={styles.searchMatchPill}><Text style={styles.searchMatchText}>✨ {tr("SEARCH MATCH", "نتيجة البحث")}</Text></View> : null}
                    <Text style={[styles.ayahMeta, ar && styles.rtl]}>{ar ? `الجزء ${num(juzForAyah(item.surah, item.ayah) ?? 0)} • الصفحة ${num(pageForAyah(item.surah, item.ayah) ?? 0)}${bookmarked ? " • ★" : ""}` : `Juz ${juzForAyah(item.surah, item.ayah) ?? "—"} • Page ${pageForAyah(item.surah, item.ayah) ?? "—"}${bookmarked ? " • ★" : ""}`}</Text>
                  </View>
                </View>
                {searchMatched && searchHighlightQuery ? <Text style={[styles.searchMatchQuery, ar && styles.rtl]}>{tr(`From search: ${searchHighlightQuery}`, `من البحث: ${searchHighlightQuery}`)}</Text> : null}
                <Text style={styles.ayahArabic}>{item.text}</Text>
              </Pressable>
              {selected ? (
                <View style={styles.ayahActions}>
                  <Pressable onPress={() => toggleBookmark(item)} style={styles.actionButton}><Text style={styles.actionIcon}>{bookmarked ? "★" : "☆"}</Text><Text style={styles.actionText}>{bookmarked ? tr("Saved", "محفوظة") : tr("Bookmark", "حفظ علامة")}</Text></Pressable>
                  <Pressable onPress={() => startMemorizing(item)} style={styles.actionButton}><Text style={styles.actionIcon}>🧠</Text><Text style={styles.actionText}>{tr("Memorize", "حفظ الآية")}</Text></Pressable>
                  <Pressable onPress={openSearch} style={styles.actionButton}><Text style={styles.actionIcon}>🔎</Text><Text style={styles.actionText}>{tr("Search", "بحث")}</Text></Pressable>
                </View>
              ) : null}
            </View>
          );
        })}
      </ScrollView>
    </View>
  ) : (
    <View style={styles.centered}><Text style={styles.bigIcon}>📖</Text><Text style={styles.centerText}>{tr("Unable to open this Qur’an position.", "تعذر فتح هذا الموضع في القرآن.")}</Text><Pressable onPress={() => setScreen("home")} style={styles.primaryButton}><Text style={styles.primaryButtonText}>{tr("Qur’an Home", "القرآن الرئيسية")}</Text></Pressable></View>
  );

  if (screen === "surahs") return surahScreen;
  if (screen === "juz") return juzScreen;
  if (screen === "pages") return pagesScreen;
  if (screen === "search") return searchScreen;
  if (screen === "bookmarks") return bookmarksScreen;
  if (screen === "memorize") return memorizeScreen;
  if (screen === "reader") return readerScreen;
  return homeScreen;
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: "#f7f4ec" },
  rtl: { textAlign: "right", writingDirection: "rtl" },
  alignRight: { alignSelf: "flex-end" },
  homeContent: { padding: 18, paddingBottom: 34 },
  quranHeader: { flexDirection: "row", alignItems: "center", gap: 11, marginBottom: 16 },
  quranEyebrow: { color: "#9a7a3d", fontSize: 8, fontWeight: "900", letterSpacing: 1.1 },
  quranTitle: { color: "#173f35", fontSize: 29, fontWeight: "900", marginTop: 1 },
  verifiedPill: { paddingHorizontal: 9, paddingVertical: 6, borderRadius: 99, backgroundColor: "#e4f2ec", borderWidth: 1, borderColor: "#cce5da" },
  verifiedText: { color: "#0b6a51", fontSize: 9, fontWeight: "900" },
  topBar: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingVertical: 12, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#e5e1d8" },
  topCopy: { flex: 1 },
  topTitle: { color: "#173f35", fontSize: 18, fontWeight: "900" },
  topSubtitle: { color: "#78857f", fontSize: 9, marginTop: 2 },
  topSpacer: { width: 39 },
  backButton: { width: 39, height: 39, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: "#fff", borderWidth: 1, borderColor: "#dfdbd1" },
  backText: { color: "#17483c", fontSize: 30, lineHeight: 31, marginTop: -2 },
  searchIconButton: { width: 39, height: 39, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: "#edf5f1" },
  searchIcon: { fontSize: 17 },
  searchBox: { minHeight: 55, flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#fff", borderRadius: 18, borderWidth: 1, borderColor: "#ddd9cf", paddingHorizontal: 14 },
  searchBoxIcon: { fontSize: 19 },
  searchPlaceholder: { color: "#6f7e78", fontSize: 12, flex: 1 },
  continueCard: { marginTop: 14, minHeight: 112, flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#0a634d", borderRadius: 25, padding: 16, elevation: 3 },
  continueIcon: { width: 54, height: 54, borderRadius: 18, backgroundColor: "rgba(255,255,255,.13)", alignItems: "center", justifyContent: "center" },
  continueEmoji: { fontSize: 27 },
  continueCopy: { flex: 1 },
  continueEyebrow: { color: "#c3ddd4", fontSize: 8, fontWeight: "900", letterSpacing: 1.2 },
  continueTitle: { color: "#fff", fontSize: 21, fontWeight: "900", marginTop: 3 },
  continueMeta: { color: "#cce2da", fontSize: 10, marginTop: 4 },
  lightChevron: { color: "#e4f3ed", fontSize: 30 },
  chevron: { color: "#0b604b", fontSize: 29 },
  sectionTitle: { color: "#173f35", fontSize: 19, fontWeight: "900", marginTop: 22, marginBottom: 10 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  gridCard: { width: "48%", minHeight: 116, backgroundColor: "#fff", borderWidth: 1, borderColor: "#e0ddd5", borderRadius: 22, padding: 14, elevation: 1 },
  gridEmoji: { fontSize: 28 },
  gridTitle: { color: "#173f35", fontSize: 15, fontWeight: "900", marginTop: 9 },
  gridMeta: { color: "#89938f", fontSize: 10, marginTop: 2 },
  memorizeCard: { marginTop: 13, minHeight: 108, flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#efe8d9", borderRadius: 23, padding: 15, borderWidth: 1, borderColor: "#e1d7c3" },
  memorizeIcon: { width: 52, height: 52, borderRadius: 18, backgroundColor: "#fff8e8", alignItems: "center", justifyContent: "center" },
  memorizeEmoji: { fontSize: 26 },
  memorizeEyebrow: { color: "#9a7a3d", fontSize: 8, fontWeight: "900", letterSpacing: 1.1 },
  memorizeTitle: { color: "#284d44", fontSize: 15, fontWeight: "900", marginTop: 3 },
  memorizeMeta: { color: "#837f71", fontSize: 9, marginTop: 3 },
  sourceCard: { marginTop: 13, minHeight: 78, flexDirection: "row", alignItems: "center", gap: 11, backgroundColor: "#edf5f1", borderRadius: 21, padding: 13 },
  sourceIcon: { width: 36, height: 36, borderRadius: 18, textAlign: "center", textAlignVertical: "center", backgroundColor: "#0b654f", color: "#fff", fontWeight: "900" },
  sourceTitle: { color: "#17483c", fontSize: 12, fontWeight: "900" },
  sourceText: { color: "#70817a", fontSize: 9, lineHeight: 13, marginTop: 3 },
  listContent: { padding: 12, paddingBottom: 30 },
  surahRow: { minHeight: 78, flexDirection: "row", alignItems: "center", gap: 11, backgroundColor: "#fff", borderRadius: 19, borderWidth: 1, borderColor: "#e3dfd6", padding: 12, marginBottom: 8 },
  simpleRow: { minHeight: 70, flexDirection: "row", alignItems: "center", gap: 11, backgroundColor: "#fff", borderRadius: 19, borderWidth: 1, borderColor: "#e3dfd6", padding: 12, marginBottom: 8 },
  numberBadge: { minWidth: 40, height: 40, paddingHorizontal: 6, borderRadius: 14, backgroundColor: "#edf5f1", alignItems: "center", justifyContent: "center" },
  numberText: { color: "#0a654f", fontWeight: "900", fontSize: 11 },
  rowCopy: { flex: 1 },
  rowTitle: { color: "#173f35", fontSize: 14, fontWeight: "900" },
  rowMeta: { color: "#85908b", fontSize: 9, marginTop: 3 },
  rowEmoji: { fontSize: 22 },
  arabicSurahName: { color: "#17483c", fontSize: 18, fontWeight: "700", maxWidth: 105, textAlign: "right" },
  searchInputWrap: { padding: 12, backgroundColor: "#f7f4ec" },
  searchInput: { minHeight: 52, borderRadius: 17, borderWidth: 1, borderColor: "#dcd8ce", backgroundColor: "#fff", paddingHorizontal: 14, color: "#173f35", fontSize: 14 },
  emptyLabel: { color: "#7e8a85", textAlign: "center", padding: 30, lineHeight: 20 },
  searchResult: { flexDirection: "row", alignItems: "center", gap: 9, backgroundColor: "#fff", borderRadius: 19, borderWidth: 1, borderColor: "#e3dfd6", padding: 13, marginBottom: 8 },
  searchArabic: { color: "#244b40", fontSize: 19, lineHeight: 31, textAlign: "right", marginTop: 5, writingDirection: "rtl" },
  openInQuranPill: { alignSelf: "flex-start", marginTop: 8, backgroundColor: "#e8f4ee", borderRadius: 99, paddingHorizontal: 10, paddingVertical: 6 },
  openInQuranText: { color: "#0b654f", fontSize: 9, fontWeight: "900" },
  bookmarkRow: { backgroundColor: "#fff", borderRadius: 19, borderWidth: 1, borderColor: "#e3dfd6", padding: 14, marginBottom: 9 },
  bookmarkRef: { color: "#0b654f", fontSize: 10, fontWeight: "900" },
  bookmarkArabic: { color: "#244b40", fontSize: 20, lineHeight: 33, textAlign: "right", writingDirection: "rtl", marginTop: 8 },
  readerContent: { padding: 12, paddingBottom: 44 },
  surahHeaderCard: { backgroundColor: "#efe8d9", borderRadius: 23, borderWidth: 1, borderColor: "#dfd2bb", padding: 18, marginBottom: 12, alignItems: "center" },
  surahHeaderArabic: { color: "#173f35", fontSize: 28, fontWeight: "800", textAlign: "center", writingDirection: "rtl" },
  surahHeaderEnglish: { color: "#7d776d", fontSize: 10, marginTop: 5 },
  basmala: { color: "#173f35", fontSize: 25, lineHeight: 41, textAlign: "center", writingDirection: "rtl", marginTop: 14 },
  ayahCard: { backgroundColor: "#fff", borderRadius: 21, borderWidth: 1, borderColor: "#e3dfd6", padding: 15, marginBottom: 10 },
  ayahCardSelected: { borderColor: "#8dbbaa", backgroundColor: "#fbfefc" },
  ayahCardSearchMatch: { borderWidth: 2, borderColor: "#c59b42", backgroundColor: "#fff9e9" },
  ayahTopRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  ayahNumber: { width: 35, height: 35, borderRadius: 12, backgroundColor: "#edf5f1", alignItems: "center", justifyContent: "center" },
  ayahNumberText: { color: "#0b654f", fontSize: 10, fontWeight: "900" },
  ayahMetaWrap: { flex: 1, alignItems: "flex-end" },
  ayahMeta: { color: "#89938f", fontSize: 9 },
  searchMatchPill: { backgroundColor: "#f1d995", borderRadius: 99, paddingHorizontal: 8, paddingVertical: 4, marginBottom: 5 },
  searchMatchText: { color: "#6e5217", fontSize: 8, fontWeight: "900", letterSpacing: 0.5 },
  searchMatchQuery: { color: "#87681f", fontSize: 9, fontWeight: "800", marginTop: 8 },
  ayahArabic: { color: "#183e34", fontSize: 26, lineHeight: 45, textAlign: "right", writingDirection: "rtl", marginTop: 10 },
  ayahActions: { flexDirection: "row", gap: 7, marginTop: 12, paddingTop: 11, borderTopWidth: 1, borderTopColor: "#ece8df" },
  actionButton: { flex: 1, minHeight: 56, borderRadius: 15, backgroundColor: "#f3f5f1", alignItems: "center", justifyContent: "center", padding: 6 },
  actionIcon: { fontSize: 18, color: "#0b654f" },
  actionText: { color: "#31564b", fontSize: 8, fontWeight: "800", marginTop: 2, textAlign: "center" },
  memorizeContent: { paddingBottom: 35 },
  rangeCard: { margin: 14, backgroundColor: "#fff", borderRadius: 21, borderWidth: 1, borderColor: "#e0ddd4", padding: 15 },
  rangeTitle: { color: "#173f35", fontSize: 14, fontWeight: "900" },
  rangeRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 13 },
  rangeButton: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "#edf5f1" },
  rangeButtonText: { color: "#0b654f", fontSize: 25, fontWeight: "700" },
  rangeValue: { color: "#173f35", fontSize: 15, fontWeight: "900" },
  hideButton: { minHeight: 45, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "#0b654f", marginTop: 13 },
  hideButtonText: { color: "#fff", fontSize: 10, fontWeight: "900" },
  memoryAyah: { marginHorizontal: 14, marginBottom: 9, backgroundColor: "#fff", borderRadius: 20, borderWidth: 1, borderColor: "#e0ddd4", padding: 16 },
  memoryRef: { color: "#9a7a3d", fontSize: 9, fontWeight: "900" },
  memoryArabic: { color: "#183e34", fontSize: 27, lineHeight: 46, textAlign: "right", writingDirection: "rtl", marginTop: 8 },
  hiddenArabic: { letterSpacing: 3, color: "#9ca6a1", textAlign: "center" },
  primaryButton: { minHeight: 48, margin: 14, borderRadius: 15, backgroundColor: "#0b654f", alignItems: "center", justifyContent: "center", paddingHorizontal: 18 },
  primaryButtonText: { color: "#fff", fontSize: 12, fontWeight: "900" },
  centered: { flex: 1, backgroundColor: "#f7f4ec", alignItems: "center", justifyContent: "center", padding: 28 },
  bigIcon: { fontSize: 44 },
  centerTitle: { color: "#173f35", fontSize: 20, fontWeight: "900", textAlign: "center", marginTop: 10 },
  centerText: { color: "#73817b", fontSize: 12, lineHeight: 19, textAlign: "center", marginTop: 7 }
});