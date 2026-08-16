import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ViewToken
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
  type QuranSearchResult
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

export default function Quran({ locale, onBackHome }: Props) {
  const [screen, setScreen] = useState<QuranScreen>("home");
  const [readerPosition, setReaderPosition] = useState<QuranPosition>({ surah: 1, ayah: 1 });
  const [lastPosition, setLastPosition] = useState<QuranPosition | null>(null);
  const [bookmarks, setBookmarks] = useState<string[]>([]);
  const [memorizeRange, setMemorizeRange] = useState<MemorizeRange | null>(null);
  const [query, setQuery] = useState("");
  const [selectedAyah, setSelectedAyah] = useState<QuranAyah | null>(null);
  const [memorizeHidden, setMemorizeHidden] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const listRef = useRef<FlatList<QuranAyah>>(null);
  const lastSeenRef = useRef("");

  const source = quranSource();
  const surahs = allSurahs();
  const pages = allPages();
  const juz = allJuz();
  const readerSurah = getSurah(readerPosition.surah);
  const readerAyahs = useMemo(() => getSurahAyahs(readerPosition.surah), [readerPosition.surah]);
  const searchResults = useMemo(() => searchQuran(query, 80), [query]);
  const memorizeAyahs = useMemo(
    () => memorizeRange ? ayahsInRange(memorizeRange.surah, memorizeRange.start, memorizeRange.surah, memorizeRange.end) : [],
    [memorizeRange]
  );

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

  const openReader = (surah: number, ayah = 1) => {
    if (!getAyah(surah, ayah)) return;
    setSelectedAyah(null);
    setReaderPosition({ surah, ayah });
    persistLast({ surah, ayah });
    setScreen("reader");
  };

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

  const onVisibleAyahsChanged = useRef(({ viewableItems }: { viewableItems: Array<ViewToken<QuranAyah>> }) => {
    const ayah = viewableItems.find((token) => token.isViewable)?.item;
    if (ayah) persistLast({ surah: ayah.surah, ayah: ayah.ayah });
  }).current;

  useEffect(() => {
    if (screen !== "reader" || readerPosition.ayah <= 1) return;
    const timer = setTimeout(() => {
      listRef.current?.scrollToIndex({ index: Math.max(0, readerPosition.ayah - 1), animated: false, viewPosition: 0.12 });
    }, 120);
    return () => clearTimeout(timer);
  }, [readerPosition, screen]);

  if (!quranReady()) {
    return (
      <View style={styles.notReady}>
        <Text style={styles.notReadyIcon}>📖</Text>
        <Text style={styles.notReadyTitle}>Native Qur’an data is preparing</Text>
        <Text style={styles.notReadyText}>This development source tree contains only a placeholder. Android builds generate and validate all 6,236 Tanzil Uthmani ayahs before compiling.</Text>
        <Pressable onPress={onBackHome} style={styles.primaryButton}><Text style={styles.primaryButtonText}>Back to Home</Text></Pressable>
      </View>
    );
  }

  const topBar = (title: string, subtitle?: string, back: QuranScreen | "app" = "home") => (
    <View style={styles.topBar}>
      <Pressable onPress={() => back === "app" ? onBackHome() : setScreen(back)} style={styles.backButton}>
        <Text style={styles.backText}>‹</Text>
      </Pressable>
      <View style={styles.topCopy}>
        <Text style={styles.topTitle}>{title}</Text>
        {subtitle ? <Text style={styles.topSubtitle}>{subtitle}</Text> : null}
      </View>
      <Pressable onPress={() => setScreen("search")} style={styles.searchIconButton}><Text style={styles.searchIcon}>⌕</Text></Pressable>
    </View>
  );

  const homeScreen = (
    <ScrollView style={styles.flex} contentContainerStyle={styles.homeContent} showsVerticalScrollIndicator={false}>
      <View style={styles.quranHeader}>
        <Pressable onPress={onBackHome} style={styles.backButton}><Text style={styles.backText}>‹</Text></Pressable>
        <View style={styles.topCopy}>
          <Text style={styles.quranEyebrow}>WOPT • NATIVE ANDROID</Text>
          <Text style={styles.quranTitle}>{locale === "ar" ? "القرآن الكريم" : "The Qur’an"}</Text>
        </View>
        <View style={styles.verifiedPill}><Text style={styles.verifiedText}>✓ Verified</Text></View>
      </View>

      <Pressable onPress={() => setScreen("search")} style={styles.searchBox}>
        <Text style={styles.searchBoxIcon}>⌕</Text>
        <Text style={styles.searchPlaceholder}>{locale === "ar" ? "ابحث في القرآن أو السور" : "Search Arabic, Surah name or number"}</Text>
      </Pressable>

      {lastPosition && getAyah(lastPosition.surah, lastPosition.ayah) ? (
        <Pressable onPress={() => openReader(lastPosition.surah, lastPosition.ayah)} style={styles.continueCard}>
          <View style={styles.continueIcon}><Text style={styles.continueEmoji}>📖</Text></View>
          <View style={styles.continueCopy}>
            <Text style={styles.continueEyebrow}>{locale === "ar" ? "متابعة القراءة" : "CONTINUE READING"}</Text>
            <Text style={styles.continueTitle}>{getSurah(lastPosition.surah)?.nameTransliterated}</Text>
            <Text style={styles.continueMeta}>Ayah {lastPosition.ayah} • Page {pageForAyah(lastPosition.surah, lastPosition.ayah) ?? "—"} • Juz {juzForAyah(lastPosition.surah, lastPosition.ayah) ?? "—"}</Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </Pressable>
      ) : (
        <Pressable onPress={() => openReader(1, 1)} style={styles.continueCard}>
          <View style={styles.continueIcon}><Text style={styles.continueEmoji}>📖</Text></View>
          <View style={styles.continueCopy}>
            <Text style={styles.continueEyebrow}>BEGIN READING</Text>
            <Text style={styles.continueTitle}>Al-Faatiha</Text>
            <Text style={styles.continueMeta}>Start at the beginning of the Qur’an</Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </Pressable>
      )}

      <Text style={styles.sectionTitle}>Browse</Text>
      <View style={styles.grid}>
        <Pressable onPress={() => setScreen("surahs")} style={styles.gridCard}><Text style={styles.gridEmoji}>☷</Text><Text style={styles.gridTitle}>Surahs</Text><Text style={styles.gridMeta}>114 chapters</Text></Pressable>
        <Pressable onPress={() => setScreen("juz")} style={styles.gridCard}><Text style={styles.gridEmoji}>◫</Text><Text style={styles.gridTitle}>Juz</Text><Text style={styles.gridMeta}>30 parts</Text></Pressable>
        <Pressable onPress={() => setScreen("pages")} style={styles.gridCard}><Text style={styles.gridEmoji}>▤</Text><Text style={styles.gridTitle}>Pages</Text><Text style={styles.gridMeta}>604 pages</Text></Pressable>
        <Pressable onPress={() => setScreen("bookmarks")} style={styles.gridCard}><Text style={styles.gridEmoji}>★</Text><Text style={styles.gridTitle}>Bookmarks</Text><Text style={styles.gridMeta}>{bookmarks.length} saved</Text></Pressable>
      </View>

      <Pressable onPress={() => memorizeRange ? setScreen("memorize") : openReader(lastPosition?.surah ?? 1, lastPosition?.ayah ?? 1)} style={styles.memorizeCard}>
        <View style={styles.memorizeIcon}><Text style={styles.memorizeEmoji}>🧠</Text></View>
        <View style={styles.continueCopy}>
          <Text style={styles.memorizeEyebrow}>MEMORIZATION</Text>
          <Text style={styles.memorizeTitle}>{memorizeRange ? `${getSurah(memorizeRange.surah)?.nameTransliterated} ${memorizeRange.start}${memorizeRange.end > memorizeRange.start ? `–${memorizeRange.end}` : ""}` : "Choose an ayah to memorize"}</Text>
          <Text style={styles.memorizeMeta}>Focus mode • reveal/hide • selected ayah range</Text>
        </View>
        <Text style={styles.chevron}>›</Text>
      </Pressable>

      <View style={styles.sourceCard}>
        <Text style={styles.sourceIcon}>✓</Text>
        <View style={styles.continueCopy}>
          <Text style={styles.sourceTitle}>Verified Uthmani Arabic</Text>
          <Text style={styles.sourceText}>{source.name} v{source.version} • Medina Mushaf-compatible Unicode • bundled offline</Text>
        </View>
      </View>
    </ScrollView>
  );

  const surahScreen = (
    <View style={styles.flex}>
      {topBar("Surahs", "114 chapters")}
      <FlatList
        data={surahs}
        keyExtractor={(item) => String(item.number)}
        contentContainerStyle={styles.listContent}
        initialNumToRender={18}
        windowSize={8}
        renderItem={({ item }) => (
          <Pressable onPress={() => openReader(item.number, 1)} style={styles.surahRow}>
            <View style={styles.numberBadge}><Text style={styles.numberText}>{item.number}</Text></View>
            <View style={styles.rowCopy}>
              <Text style={styles.rowTitle}>{item.nameTransliterated}</Text>
              <Text style={styles.rowMeta}>{item.nameEnglish} • {item.ayahCount} ayahs • {item.revelationType}</Text>
            </View>
            <Text style={styles.arabicSurahName}>{item.nameArabic}</Text>
          </Pressable>
        )}
      />
    </View>
  );

  const juzScreen = (
    <View style={styles.flex}>
      {topBar("Juz", "30 parts")}
      <FlatList
        data={juz}
        keyExtractor={(item) => String(item.juz)}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <Pressable onPress={() => openReader(item.surah, item.ayah)} style={styles.simpleRow}>
            <View style={styles.numberBadge}><Text style={styles.numberText}>{item.juz}</Text></View>
            <View style={styles.rowCopy}><Text style={styles.rowTitle}>Juz {item.juz}</Text><Text style={styles.rowMeta}>{getSurah(item.surah)?.nameTransliterated} • Ayah {item.ayah}</Text></View>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
        )}
      />
    </View>
  );

  const pagesScreen = (
    <View style={styles.flex}>
      {topBar("Pages", "Medina Mushaf • 604 pages")}
      <FlatList
        data={pages}
        keyExtractor={(item) => String(item.page)}
        contentContainerStyle={styles.listContent}
        initialNumToRender={24}
        windowSize={8}
        renderItem={({ item }) => (
          <Pressable onPress={() => openReader(item.surah, item.ayah)} style={styles.simpleRow}>
            <View style={styles.numberBadge}><Text style={styles.numberText}>{item.page}</Text></View>
            <View style={styles.rowCopy}><Text style={styles.rowTitle}>Page {item.page}</Text><Text style={styles.rowMeta}>{getSurah(item.surah)?.nameTransliterated} • Ayah {item.ayah}</Text></View>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
        )}
      />
    </View>
  );

  const searchScreen = (
    <View style={styles.flex}>
      {topBar("Search Qur’an", "Arabic text, Surah name or number")}
      <View style={styles.searchInputWrap}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          autoFocus
          placeholder="Search الرحمة, Al-Kahf, 18…"
          placeholderTextColor="#909a96"
          style={styles.searchInput}
          textAlign={/^[\u0600-\u06FF]/.test(query) ? "right" : "left"}
        />
      </View>
      <FlatList<QuranSearchResult>
        data={query.trim() ? searchResults : []}
        keyExtractor={(item, index) => item.kind === "surah" ? `s-${item.surah.number}-${index}` : `a-${item.ayah?.surah}-${item.ayah?.ayah}`}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={<Text style={styles.emptyLabel}>{query.trim() ? "No matches found." : "Type Arabic text, a Surah name, or Surah number."}</Text>}
        renderItem={({ item }) => (
          <Pressable onPress={() => openReader(item.surah.number, item.ayah?.ayah ?? 1)} style={styles.searchResult}>
            <View style={styles.rowCopy}>
              <Text style={styles.rowTitle}>{item.surah.nameTransliterated} {item.ayah ? `${item.surah.number}:${item.ayah.ayah}` : `• Surah ${item.surah.number}`}</Text>
              {item.ayah ? <Text style={styles.searchArabic} numberOfLines={2}>{item.ayah.text}</Text> : <Text style={styles.rowMeta}>{item.surah.nameEnglish} • {item.surah.ayahCount} ayahs</Text>}
            </View>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
        )}
      />
    </View>
  );

  const bookmarkItems = bookmarks.map(parseRef).filter((item): item is QuranPosition => Boolean(item)).map((item) => getAyah(item.surah, item.ayah)).filter((item): item is QuranAyah => Boolean(item));
  const bookmarksScreen = (
    <View style={styles.flex}>
      {topBar("Bookmarks", `${bookmarkItems.length} saved ayahs`)}
      <FlatList
        data={bookmarkItems}
        keyExtractor={(item) => refKey(item)}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={<Text style={styles.emptyLabel}>Tap an ayah in the reader and choose Bookmark.</Text>}
        renderItem={({ item }) => (
          <Pressable onPress={() => openReader(item.surah, item.ayah)} style={styles.bookmarkRow}>
            <Text style={styles.bookmarkRef}>{getSurah(item.surah)?.nameTransliterated} {item.surah}:{item.ayah}</Text>
            <Text style={styles.bookmarkArabic} numberOfLines={3}>{item.text}</Text>
          </Pressable>
        )}
      />
    </View>
  );

  const memorizeScreen = memorizeRange ? (
    <ScrollView style={styles.flex} contentContainerStyle={styles.memorizeContent} showsVerticalScrollIndicator={false}>
      {topBar("Memorize", `${getSurah(memorizeRange.surah)?.nameTransliterated} • ${memorizeRange.start}${memorizeRange.end > memorizeRange.start ? `–${memorizeRange.end}` : ""}`)}
      <View style={styles.rangeCard}>
        <Text style={styles.rangeTitle}>Selected range</Text>
        <View style={styles.rangeRow}>
          <Pressable onPress={() => updateMemorizeRange({ ...memorizeRange, end: Math.max(memorizeRange.start, memorizeRange.end - 1) })} style={styles.rangeButton}><Text style={styles.rangeButtonText}>−</Text></Pressable>
          <Text style={styles.rangeValue}>Ayah {memorizeRange.start}{memorizeRange.end > memorizeRange.start ? `–${memorizeRange.end}` : ""}</Text>
          <Pressable onPress={() => updateMemorizeRange({ ...memorizeRange, end: memorizeRange.end + 1 })} style={styles.rangeButton}><Text style={styles.rangeButtonText}>+</Text></Pressable>
        </View>
        <Pressable onPress={() => setMemorizeHidden((value) => !value)} style={styles.hideButton}><Text style={styles.hideButtonText}>{memorizeHidden ? "Reveal Arabic" : "Hide Arabic to test yourself"}</Text></Pressable>
      </View>

      {memorizeAyahs.map((ayah) => (
        <View key={refKey(ayah)} style={styles.memoryAyah}>
          <Text style={styles.memoryRef}>{ayah.surah}:{ayah.ayah}</Text>
          <Text style={[styles.memoryArabic, memorizeHidden && styles.hiddenArabic]}>{memorizeHidden ? "••••••••••••••••••••" : ayah.text}</Text>
        </View>
      ))}
      <Pressable onPress={() => openReader(memorizeRange.surah, memorizeRange.start)} style={styles.primaryButton}><Text style={styles.primaryButtonText}>Open in reader</Text></Pressable>
    </ScrollView>
  ) : (
    <View style={styles.notReady}><Text style={styles.notReadyTitle}>No memorization range yet</Text><Text style={styles.notReadyText}>Open any Surah, tap an ayah, then choose Memorize.</Text><Pressable onPress={() => setScreen("surahs")} style={styles.primaryButton}><Text style={styles.primaryButtonText}>Choose Surah</Text></Pressable></View>
  );

  const readerScreen = readerSurah ? (
    <View style={styles.flex}>
      {topBar(readerSurah.nameTransliterated, `${readerSurah.nameArabic} • ${readerSurah.ayahCount} ayahs • Page ${pageForAyah(readerPosition.surah, readerPosition.ayah) ?? "—"}`)}
      <FlatList
        ref={listRef}
        data={readerAyahs}
        keyExtractor={(item) => refKey(item)}
        contentContainerStyle={styles.readerContent}
        initialNumToRender={10}
        maxToRenderPerBatch={12}
        windowSize={7}
        removeClippedSubviews
        onViewableItemsChanged={onVisibleAyahsChanged}
        viewabilityConfig={{ itemVisiblePercentThreshold: 55 }}
        onScrollToIndexFailed={({ index, averageItemLength }) => {
          listRef.current?.scrollToOffset({ offset: Math.max(0, index * averageItemLength), animated: false });
          setTimeout(() => listRef.current?.scrollToIndex({ index, animated: false, viewPosition: 0.1 }), 120);
        }}
        renderItem={({ item }) => {
          const selected = selectedAyah?.surah === item.surah && selectedAyah?.ayah === item.ayah;
          const bookmarked = bookmarks.includes(refKey(item));
          return (
            <View style={[styles.ayahCard, selected && styles.ayahCardSelected]}>
              <Pressable onPress={() => setSelectedAyah(selected ? null : item)}>
                <View style={styles.ayahTopRow}>
                  <View style={styles.ayahNumber}><Text style={styles.ayahNumberText}>{item.ayah}</Text></View>
                  <Text style={styles.ayahMeta}>Juz {juzForAyah(item.surah, item.ayah) ?? "—"} • Page {pageForAyah(item.surah, item.ayah) ?? "—"}{bookmarked ? " • ★" : ""}</Text>
                </View>
                <Text style={styles.ayahArabic}>{item.text}</Text>
              </Pressable>
              {selected ? (
                <View style={styles.ayahActions}>
                  <Pressable onPress={() => toggleBookmark(item)} style={styles.actionButton}><Text style={styles.actionIcon}>{bookmarked ? "★" : "☆"}</Text><Text style={styles.actionText}>{bookmarked ? "Saved" : "Bookmark"}</Text></Pressable>
                  <Pressable onPress={() => startMemorizing(item)} style={styles.actionButton}><Text style={styles.actionIcon}>🧠</Text><Text style={styles.actionText}>Memorize</Text></Pressable>
                  <Pressable onPress={() => setScreen("search")} style={styles.actionButton}><Text style={styles.actionIcon}>⌕</Text><Text style={styles.actionText}>Search</Text></Pressable>
                </View>
              ) : null}
            </View>
          );
        }}
      />
    </View>
  ) : null;

  if (!loaded) return <View style={styles.notReady}><Text style={styles.notReadyText}>Loading Qur’an…</Text></View>;
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
  homeContent: { padding: 18, paddingBottom: 34 },
  quranHeader: { flexDirection: "row", alignItems: "center", gap: 11, marginBottom: 16 },
  quranEyebrow: { color: "#9a7a3d", fontSize: 8, fontWeight: "900", letterSpacing: 1.2 },
  quranTitle: { color: "#173f35", fontSize: 28, fontWeight: "900", marginTop: 1 },
  verifiedPill: { paddingHorizontal: 9, paddingVertical: 6, borderRadius: 99, backgroundColor: "#e4f2ec" },
  verifiedText: { color: "#0b6a51", fontSize: 9, fontWeight: "900" },
  topBar: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingVertical: 12, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#e5e1d8" },
  topCopy: { flex: 1 },
  topTitle: { color: "#173f35", fontSize: 17, fontWeight: "900" },
  topSubtitle: { color: "#78857f", fontSize: 9, marginTop: 2 },
  backButton: { width: 39, height: 39, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: "#fff", borderWidth: 1, borderColor: "#dfdbd1" },
  backText: { color: "#17483c", fontSize: 30, lineHeight: 31, marginTop: -2 },
  searchIconButton: { width: 39, height: 39, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: "#edf5f1" },
  searchIcon: { color: "#0b604b", fontSize: 24 },
  searchBox: { minHeight: 52, flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#fff", borderRadius: 17, borderWidth: 1, borderColor: "#ddd9cf", paddingHorizontal: 14 },
  searchBoxIcon: { color: "#0b604b", fontSize: 22 },
  searchPlaceholder: { color: "#7e8a85", fontSize: 12, flex: 1 },
  continueCard: { marginTop: 14, minHeight: 108, flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#0a634d", borderRadius: 24, padding: 16 },
  continueIcon: { width: 52, height: 52, borderRadius: 17, backgroundColor: "rgba(255,255,255,.13)", alignItems: "center", justifyContent: "center" },
  continueEmoji: { fontSize: 26 },
  continueCopy: { flex: 1 },
  continueEyebrow: { color: "#c3ddd4", fontSize: 8, fontWeight: "900", letterSpacing: 1.3 },
  continueTitle: { color: "#fff", fontSize: 21, fontWeight: "900", marginTop: 3 },
  continueMeta: { color: "#cce2da", fontSize: 10, marginTop: 4 },
  chevron: { color: "#0b604b", fontSize: 29, fontWeight: "300" },
  sectionTitle: { color: "#173f35", fontSize: 18, fontWeight: "900", marginTop: 22, marginBottom: 10 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  gridCard: { width: "48%", minHeight: 112, backgroundColor: "#fff", borderWidth: 1, borderColor: "#e0ddd5", borderRadius: 21, padding: 14 },
  gridEmoji: { color: "#0a634d", fontSize: 25, fontWeight: "700" },
  gridTitle: { color: "#173f35", fontSize: 15, fontWeight: "900", marginTop: 9 },
  gridMeta: { color: "#89938f", fontSize: 10, marginTop: 2 },
  memorizeCard: { marginTop: 13, minHeight: 104, flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#efe8d9", borderRadius: 22, padding: 15, borderWidth: 1, borderColor: "#e1d7c3" },
  memorizeIcon: { width: 50, height: 50, borderRadius: 17, backgroundColor: "#fff8e8", alignItems: "center", justifyContent: "center" },
  memorizeEmoji: { fontSize: 25 },
  memorizeEyebrow: { color: "#9a7a3d", fontSize: 8, fontWeight: "900", letterSpacing: 1.2 },
  memorizeTitle: { color: "#284d44", fontSize: 15, fontWeight: "900", marginTop: 3 },
  memorizeMeta: { color: "#837f71", fontSize: 9, marginTop: 3 },
  sourceCard: { marginTop: 13, minHeight: 76, flexDirection: "row", alignItems: "center", gap: 11, backgroundColor: "#edf5f1", borderRadius: 20, padding: 13 },
  sourceIcon: { width: 36, height: 36, borderRadius: 18, textAlign: "center", textAlignVertical: "center", backgroundColor: "#0b654f", color: "#fff", fontWeight: "900" },
  sourceTitle: { color: "#17483c", fontSize: 12, fontWeight: "900" },
  sourceText: { color: "#70817a", fontSize: 9, lineHeight: 13, marginTop: 3 },
  listContent: { padding: 12, paddingBottom: 30 },
  surahRow: { minHeight: 76, flexDirection: "row", alignItems: "center", gap: 11, backgroundColor: "#fff", borderRadius: 18, borderWidth: 1, borderColor: "#e3dfd6", padding: 12, marginBottom: 8 },
  simpleRow: { minHeight: 68, flexDirection: "row", alignItems: "center", gap: 11, backgroundColor: "#fff", borderRadius: 18, borderWidth: 1, borderColor: "#e3dfd6", padding: 12, marginBottom: 8 },
  numberBadge: { minWidth: 39, height: 39, paddingHorizontal: 6, borderRadius: 13, backgroundColor: "#edf5f1", alignItems: "center", justifyContent: "center" },
  numberText: { color: "#0a654f", fontWeight: "900", fontSize: 11 },
  rowCopy: { flex: 1 },
  rowTitle: { color: "#173f35", fontSize: 13, fontWeight: "900" },
  rowMeta: { color: "#85908b", fontSize: 9, marginTop: 3 },
  arabicSurahName: { color: "#17483c", fontSize: 18, fontWeight: "700", maxWidth: 98, textAlign: "right" },
  searchInputWrap: { padding: 12, backgroundColor: "#f7f4ec" },
  searchInput: { minHeight: 50, borderRadius: 16, borderWidth: 1, borderColor: "#dcd8ce", backgroundColor: "#fff", paddingHorizontal: 14, color: "#173f35", fontSize: 14 },
  emptyLabel: { color: "#7e8a85", textAlign: "center", padding: 30, lineHeight: 20 },
  searchResult: { flexDirection: "row", alignItems: "center", gap: 9, backgroundColor: "#fff", borderRadius: 18, borderWidth: 1, borderColor: "#e3dfd6", padding: 13, marginBottom: 8 },
  searchArabic: { color: "#244b40", fontSize: 18, lineHeight: 30, textAlign: "right", marginTop: 5 },
  bookmarkRow: { backgroundColor: "#fff", borderRadius: 18, borderWidth: 1, borderColor: "#e3dfd6", padding: 14, marginBottom: 9 },
  bookmarkRef: { color: "#0b654f", fontSize: 10, fontWeight: "900" },
  bookmarkArabic: { color: "#244b40", fontSize: 20, lineHeight: 33, textAlign: "right", marginTop: 8 },
  readerContent: { padding: 12, paddingBottom: 42 },
  ayahCard: { backgroundColor: "#fff", borderRadius: 20, borderWidth: 1, borderColor: "#e3dfd6", padding: 15, marginBottom: 10 },
  ayahCardSelected: { borderColor: "#8dbbaa", backgroundColor: "#fbfefc" },
  ayahTopRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  ayahNumber: { width: 34, height: 34, borderRadius: 12, backgroundColor: "#edf5f1", alignItems: "center", justifyContent: "center" },
  ayahNumberText: { color: "#0b654f", fontSize: 10, fontWeight: "900" },
  ayahMeta: { color: "#89938f", fontSize: 9 },
  ayahArabic: { color: "#183e34", fontSize: 25, lineHeight: 44, textAlign: "right", writingDirection: "rtl", marginTop: 10 },
  ayahActions: { flexDirection: "row", gap: 7, marginTop: 12, paddingTop: 11, borderTopWidth: 1, borderTopColor: "#ece8df" },
  actionButton: { flex: 1, minHeight: 54, borderRadius: 14, backgroundColor: "#f3f5f1", alignItems: "center", justifyContent: "center", padding: 6 },
  actionIcon: { fontSize: 17, color: "#0b654f" },
  actionText: { color: "#31564b", fontSize: 8, fontWeight: "800", marginTop: 2 },
  memorizeContent: { paddingBottom: 35 },
  rangeCard: { margin: 14, backgroundColor: "#fff", borderRadius: 20, borderWidth: 1, borderColor: "#e0ddd4", padding: 15 },
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
  notReady: { flex: 1, backgroundColor: "#f7f4ec", alignItems: "center", justifyContent: "center", padding: 28 },
  notReadyIcon: { fontSize: 44 },
  notReadyTitle: { color: "#173f35", fontSize: 20, fontWeight: "900", textAlign: "center", marginTop: 10 },
  notReadyText: { color: "#73817b", fontSize: 12, lineHeight: 19, textAlign: "center", marginTop: 7 }
});
