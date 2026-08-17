from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f"Missing patch target: {label}")
    return text.replace(old, new, 1)

quran = Path("mobile/src/quran/QuranV3.tsx")
s = quran.read_text()

s = replace_once(
    s,
    '  const [bookmarks, setBookmarks] = useState<string[]>([]);\n  const [audioPrefs, setAudioPrefs] = useState<AudioPrefs>(DEFAULT_AUDIO_PREFS);',
    '  const [bookmarks, setBookmarks] = useState<string[]>([]);\n  const [bookmarkNotice, setBookmarkNotice] = useState<string | null>(null);\n  const [audioPrefs, setAudioPrefs] = useState<AudioPrefs>(DEFAULT_AUDIO_PREFS);',
    "bookmark notice state",
)

s = replace_once(
    s,
    '  const selectedIsLooping = selectedIsActive && repeatQueue && audioQueue.length === 1;\n  const autoSpread = width >= 700;',
    '  const selectedIsLooping = selectedIsActive && repeatQueue && audioQueue.length === 1;\n  const selectedIsBookmarked = Boolean(selectedAyah && bookmarks.includes(refKey(selectedAyah)));\n  const autoSpread = width >= 700;',
    "selected bookmark state",
)

s = replace_once(
    s,
    '  const toggleBookmark = (ayah: QuranAyah) => {\n    const key = refKey(ayah);\n    const next = bookmarks.includes(key) ? bookmarks.filter((item) => item !== key) : [key, ...bookmarks];\n    setBookmarks(next);\n    void AsyncStorage.setItem(KEYS.bookmarks, JSON.stringify(next));\n  };',
    '''  const toggleBookmark = (ayah: QuranAyah) => {\n    const key = refKey(ayah);\n    const alreadySaved = bookmarks.includes(key);\n    const next = alreadySaved ? bookmarks.filter((item) => item !== key) : [key, ...bookmarks];\n    setBookmarks(next);\n    void AsyncStorage.setItem(KEYS.bookmarks, JSON.stringify(next));\n    const surahName = ar ? getSurah(ayah.surah)?.nameArabic : getSurah(ayah.surah)?.nameTransliterated;\n    setBookmarkNotice(alreadySaved\n      ? tr(`Bookmark removed • ${surahName ?? "Qur’an"} ${ayah.surah}:${ayah.ayah}`, `تمت إزالة العلامة • ${surahName ?? "القرآن"} ${num(ayah.surah)}:${num(ayah.ayah)}`)\n      : tr(`Bookmarked • ${surahName ?? "Qur’an"} ${ayah.surah}:${ayah.ayah}`, `تم الحفظ في العلامات • ${surahName ?? "القرآن"} ${num(ayah.surah)}:${num(ayah.ayah)}`));\n  };''',
    "bookmark toggle confirmation",
)

anchor = '  const startMemorizing = (ayah: QuranAyah) => {'
if anchor not in s:
    raise SystemExit("Missing patch target: bookmark notice timeout anchor")
s = s.replace(
    anchor,
    '''  useEffect(() => {\n    if (!bookmarkNotice) return;\n    const timer = setTimeout(() => setBookmarkNotice(null), 1800);\n    return () => clearTimeout(timer);\n  }, [bookmarkNotice]);\n\n  const startMemorizing = (ayah: QuranAyah) => {''',
    1,
)

old_page = '<QuranPageText page={page} ayahs={segment.ayahs} appearance={appearance} locale={locale} selectedKey={selectedAyah ? refKey(selectedAyah) : null} highlightedKey={audioPrefs.highlightAudio && activeAyah ? refKey(activeAyah) : null} onPressAyah={(ayah) => { setSelectedAyah((current) => current?.surah === ayah.surah && current?.ayah === ayah.ayah ? null : ayah); persistLast({ surah: ayah.surah, ayah: ayah.ayah }); }} />'
new_page = '<QuranPageText page={page} ayahs={segment.ayahs} appearance={appearance} locale={locale} selectedKey={selectedAyah ? refKey(selectedAyah) : null} highlightedKey={audioPrefs.highlightAudio && activeAyah ? refKey(activeAyah) : null} bookmarkedKeys={bookmarks} onPressAyah={(ayah) => { setSelectedAyah((current) => current?.surah === ayah.surah && current?.ayah === ayah.ayah ? null : ayah); persistLast({ surah: ayah.surah, ayah: ayah.ayah }); }} />'
s = replace_once(s, old_page, new_page, "bookmarks passed to mushaf renderer")

s = replace_once(
    s,
    '<View style={styles.studyTop}><Text style={styles.ayahPill}>{num(ayah.ayah)}</Text><Pressable onPress={() => playAyah(ayah)} style={styles.smallPlay}><Text>▶️</Text></Pressable></View>',
    '<View style={styles.studyTop}><View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}><Text style={styles.ayahPill}>{num(ayah.ayah)}</Text>{bookmarks.includes(refKey(ayah)) ? <Text style={{ fontSize: 16 }}>🔖</Text> : null}</View><Pressable onPress={() => playAyah(ayah)} style={styles.smallPlay}><Text>▶️</Text></Pressable></View>',
    "study bookmark mark",
)

s = replace_once(
    s,
    '<Pressable onPress={() => toggleBookmark(selectedAyah)} style={styles.actionTool}><Text style={styles.actionToolIcon}>🔖</Text><Text style={styles.actionToolLabel}>{tr("Save", "حفظ")}</Text></Pressable>',
    '<Pressable onPress={() => toggleBookmark(selectedAyah)} style={[styles.actionTool, selectedIsBookmarked && styles.actionToolActive]}><Text style={styles.actionToolIcon}>{selectedIsBookmarked ? "🔖" : "♡"}</Text><Text style={[styles.actionToolLabel, selectedIsBookmarked && styles.actionToolLabelActive]}>{selectedIsBookmarked ? tr("Saved", "محفوظ") : tr("Bookmark", "علامة")}</Text></Pressable>',
    "bookmark action state",
)

s = replace_once(
    s,
    '    <View style={styles.flex} onTouchStart={revealAppNav} onTouchMove={revealAppNav}>\n      {body}',
    '''    <View style={styles.flex} onTouchStart={revealAppNav} onTouchMove={revealAppNav}>\n      {body}\n      {bookmarkNotice ? (\n        <View pointerEvents="none" style={{ position: "absolute", top: 88, left: 20, right: 20, alignItems: "center", zIndex: 80 }}>\n          <View style={{ maxWidth: 440, borderRadius: 18, paddingHorizontal: 16, paddingVertical: 11, backgroundColor: "rgba(13,86,69,.97)", borderWidth: 1, borderColor: "#d9bd70", shadowColor: "#000", shadowOpacity: .2, shadowRadius: 8, elevation: 12 }}>\n            <Text style={{ color: "#fff", fontWeight: "800", textAlign: "center" }}>🔖 {bookmarkNotice}</Text>\n          </View>\n        </View>\n      ) : null}''',
    "bookmark toast",
)

quran.write_text(s)

rendering = Path("mobile/src/quran/quranRendering.tsx")
r = rendering.read_text()

r = replace_once(
    r,
    '  selectedKey,\n  highlightedKey,\n  onPressAyah',
    '  selectedKey,\n  highlightedKey,\n  bookmarkedKeys,\n  onPressAyah',
    "renderer bookmark destructuring",
)

r = replace_once(
    r,
    '  selectedKey?: string | null;\n  highlightedKey?: string | null;\n  onPressAyah: (ayah: QuranAyah) => void;',
    '  selectedKey?: string | null;\n  highlightedKey?: string | null;\n  bookmarkedKeys?: string[];\n  onPressAyah: (ayah: QuranAyah) => void;',
    "renderer bookmark prop type",
)

r = replace_once(
    r,
    '          const selected = selectedKey === key;\n          const highlighted = highlightedKey === key;\n          const raw = remoteText[key];',
    '          const selected = selectedKey === key;\n          const highlighted = highlightedKey === key;\n          const bookmarked = bookmarkedKeys?.includes(key) ?? false;\n          const raw = remoteText[key];',
    "renderer bookmark lookup",
)

r = replace_once(
    r,
    '                {" "}\n              </Text>',
    '                {bookmarked ? <Text style={{ fontFamily: undefined, fontSize: Math.max(14, appearance.fontSize * 0.52) }}> 🔖 </Text> : null}\n                {" "}\n              </Text>',
    "tajweed bookmark marker",
)

r = replace_once(
    r,
    '                {markerGlyph ? <Text style={{ color: "#0b8b69", fontFamily }}>{markerGlyph}</Text> : null}{" "}',
    '                {markerGlyph ? <Text style={{ color: "#0b8b69", fontFamily }}>{markerGlyph}</Text> : null}{bookmarked ? <Text style={{ fontFamily: undefined, fontSize: Math.max(14, appearance.fontSize * 0.52) }}> 🔖 </Text> : null}{" "}',
    "qcf bookmark marker",
)

r = replace_once(
    r,
    '{text}<Text style={{ color: "#0b8b69", fontFamily }}> ﴿{numberForLocale(ayah.ayah, locale)}﴾ </Text>',
    '{text}<Text style={{ color: "#0b8b69", fontFamily }}> ﴿{numberForLocale(ayah.ayah, locale)}﴾ </Text>{bookmarked ? <Text style={{ fontFamily: undefined, fontSize: Math.max(14, appearance.fontSize * 0.52) }}>🔖 </Text> : null}',
    "fallback bookmark marker",
)

rendering.write_text(r)

config = Path("mobile/app.config.ts")
c = config.read_text()
c = c.replace('version: "0.5.5"', 'version: "0.5.6"', 1)
c = c.replace('versionCode: 27', 'versionCode: 28', 1)
config.write_text(c)

print("Applied Quran bookmark confirmation + visible marker UX for v0.5.6")
