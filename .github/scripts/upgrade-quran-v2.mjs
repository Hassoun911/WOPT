import fs from "node:fs";

const file = "mobile/src/quran/QuranV2.tsx";
let src = fs.readFileSync(file, "utf8");

function mustReplace(before, after, label) {
  if (!src.includes(before)) throw new Error(`Missing patch target: ${label}`);
  src = src.replace(before, after);
}

// Use the dedicated Quran Foundation font/Tajweed renderer in the newest V2 reader.
mustReplace(
  `} from "./quranData";\n`,
  `} from "./quranData";\nimport {\n  QuranPageText,\n  ReaderSettingsSheet,\n  quranPageBackground,\n  useQuranAppearance\n} from "./quranRendering";\n`,
  "quranRendering import"
);

// Fix strict TypeScript inference for the default reciter.
mustReplace(
  `function reciterInfo(id: string) { return RECITERS.find((item) => item.id === id) ?? RECITERS[0]; }`,
  `function reciterInfo(id: string) { return RECITERS.find((item) => item.id === id) ?? RECITERS[0]!; }`,
  "reciterInfo"
);

// Add appearance state next to the existing unified menu state.
mustReplace(
  `  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);\n  const [menuOpen, setMenuOpen] = useState(false);`,
  `  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);\n  const [menuOpen, setMenuOpen] = useState(false);\n  const [appearanceOpen, setAppearanceOpen] = useState(false);\n  const { appearance, setAppearance, reset: resetAppearance } = useQuranAppearance();`,
  "appearance state"
);

// Build exact 604-page Mushaf slices from the already verified local metadata.
mustReplace(
  `  const activeAyah = audioIndex >= 0 ? audioQueue[audioIndex] : undefined;\n  const activeReciter = reciterInfo(prefs.reciter);`,
  `  const activeAyah = audioIndex >= 0 ? audioQueue[audioIndex] : undefined;\n  const activeReciter = reciterInfo(prefs.reciter);\n  const currentPage = pageForAyah(position.surah, position.ayah) ?? 1;\n  const currentJuz = juzForAyah(position.surah, position.ayah) ?? 1;\n  const pageAyahs = useMemo(() => {\n    const start = pages[currentPage - 1];\n    if (!start) return [] as QuranAyah[];\n    const next = pages[currentPage];\n    const startAbs = absoluteIndex(start.surah, start.ayah);\n    const endAbs = next ? absoluteIndex(next.surah, next.ayah) : Number.POSITIVE_INFINITY;\n    const out: QuranAyah[] = [];\n    for (let surahNumber = start.surah; surahNumber <= 114; surahNumber += 1) {\n      for (const ayah of getSurahAyahs(surahNumber)) {\n        const index = absoluteIndex(ayah.surah, ayah.ayah);\n        if (index < startAbs) continue;\n        if (index >= endAbs) return out;\n        out.push(ayah);\n      }\n      if (next && surahNumber > next.surah) break;\n    }\n    return out;\n  }, [currentPage, pages]);\n  const pageSegments = useMemo(() => {\n    const segments: Array<{ surah: number; ayahs: QuranAyah[] }> = [];\n    for (const ayah of pageAyahs) {\n      const previous = segments[segments.length - 1];\n      if (!previous || previous.surah !== ayah.surah) segments.push({ surah: ayah.surah, ayahs: [ayah] });\n      else previous.ayahs.push(ayah);\n    }\n    return segments;\n  }, [pageAyahs]);`,
  "page slicing"
);

// Appearance sheet participates in Android hardware-back behavior.
mustReplace(
  `  const handleBack = () => {\n    if (menuOpen) { setMenuOpen(false); return true; }`,
  `  const handleBack = () => {\n    if (appearanceOpen) { setAppearanceOpen(false); return true; }\n    if (menuOpen) { setMenuOpen(false); return true; }`,
  "appearance back"
);
mustReplace(
  `  }, [screen, backTarget, menuOpen]);`,
  `  }, [screen, backTarget, menuOpen, appearanceOpen]);`,
  "back dependencies"
);

// Fix strict queue indexing in the native audio flow.
mustReplace(
  `  const playQueue = (queue: QuranAyah[], repeat = false) => {\n    if (!queue.length || !QuranAudio) return;\n    setAudioQueue(queue);\n    setAudioIndex(0);\n    setRepeatQueue(repeat);\n    playNativeAyah(queue[0]);\n  };`,
  `  const playQueue = (queue: QuranAyah[], repeat = false) => {\n    if (!queue.length || !QuranAudio) return;\n    const first = queue[0];\n    if (!first) return;\n    setAudioQueue(queue);\n    setAudioIndex(0);\n    setRepeatQueue(repeat);\n    playNativeAyah(first);\n  };`,
  "playQueue"
);
mustReplace(
  `      setAudioIndex(next);\n      playNativeAyah(audioQueue[next]);`,
  `      const nextAyah = audioQueue[next];\n      if (!nextAyah) return;\n      setAudioIndex(next);\n      playNativeAyah(nextAyah);`,
  "nextAudio item"
);
mustReplace(
  `      setAudioIndex(0);\n      playNativeAyah(audioQueue[0]);`,
  `      const first = audioQueue[0];\n      if (!first) return;\n      setAudioIndex(0);\n      playNativeAyah(first);`,
  "repeat first item"
);
mustReplace(
  `    setAudioIndex(prev);\n    playNativeAyah(audioQueue[prev]);`,
  `    const previousAyah = audioQueue[prev];\n    if (!previousAyah) return;\n    setAudioIndex(prev);\n    playNativeAyah(previousAyah);`,
  "previous item"
);

// Page navigation for the physical-Mushaf reader.
mustReplace(
  `  const openReader = (surah: number, ayah = 1, from: Screen = screen) => {`,
  `  const openPage = (page: number) => {\n    const safePage = clamp(page, 1, 604);\n    const start = pages[safePage - 1];\n    if (!start) return;\n    const next = { surah: start.surah, ayah: start.ayah };\n    setPosition(next);\n    setSelectedAyah(null);\n    setRange(null);\n    setRangeSelecting(false);\n    persistLast(next);\n  };\n\n  const openReader = (surah: number, ayah = 1, from: Screen = screen) => {`,
  "openPage"
);

// Replace the old entire-Surah faux Mushaf with a true page slice rendered by the exact chosen Quran font.
const oldReaderScroll = `      <ScrollView style={styles.flex} contentContainerStyle={prefs.readerMode === "mushaf" ? styles.mushafWrap : styles.studyWrap} showsVerticalScrollIndicator={false}>\n        <View style={prefs.readerMode === "mushaf" ? styles.mushafSheet : styles.studySheet}>\n          <View style={styles.surahHeader}><Text style={styles.surahArabic}>{readerSurah.nameArabic}</Text>{!ar ? <Text style={styles.surahEnglish}>{readerSurah.nameTransliterated} • {readerSurah.nameEnglish}</Text> : null}</View>\n          {readerSurah.number !== 1 && readerSurah.number !== 9 ? <Text style={[styles.basmala, { fontFamily: fontFamily(prefs.font), fontSize: prefs.fontSize - 2 }]}>بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ</Text> : null}\n          {prefs.readerMode === "mushaf" ? <Text style={styles.mushafText}>{readerAyahs.map((ayah) => <Text key={refKey(ayah)}>{renderAyahText(ayah)}</Text>)}</Text> : readerAyahs.map((ayah) => <Pressable key={refKey(ayah)} onPress={() => handleAyahTap(ayah)} style={[styles.studyAyah, activeAyah?.surah === ayah.surah && activeAyah?.ayah === ayah.ayah && prefs.highlightAudio && styles.studyPlaying]}><View style={styles.studyTop}><Text style={styles.ayahPill}>{num(ayah.ayah)}</Text><Pressable onPress={() => playAyah(ayah)} style={styles.smallPlay}><Text>▶️</Text></Pressable></View><Text style={[styles.studyArabic, { fontFamily: fontFamily(prefs.font), fontSize: prefs.fontSize, lineHeight: prefs.lineHeight }]}>{prefs.tajweed && tajweedText[ayah.ayah] ? parseTajweed(tajweedText[ayah.ayah]).map((part, i) => <Text key={i} style={part.color ? { color: part.color } : undefined}>{part.text}</Text>) : ayah.text}</Text></Pressable>)}\n        </View>\n      </ScrollView>`;
const newReaderScroll = `      {prefs.readerMode === "mushaf" ? (\n        <View style={styles.readerPageBody}>\n          <ScrollView style={styles.flex} contentContainerStyle={styles.mushafWrap} showsVerticalScrollIndicator={false}>\n            <View style={[styles.mushafSheet, { backgroundColor: quranPageBackground(appearance.pageTheme) }]}>\n              <View style={styles.mushafPageMeta}><Text style={styles.mushafMetaText}>{ar ? readerSurah.nameArabic : readerSurah.nameTransliterated}</Text><Text style={styles.mushafMetaText}>{tr(\`Juz \${currentJuz}\`, \`الجزء \${num(currentJuz)}\`)}</Text></View>\n              {pageSegments.map((segment) => {\n                const segmentSurah = getSurah(segment.surah);\n                const beginsSurah = segment.ayahs[0]?.ayah === 1;\n                return (\n                  <View key={\`page-\${currentPage}-surah-\${segment.surah}\`}>\n                    {beginsSurah ? <View style={styles.surahHeader}><Text style={styles.surahArabic}>{segmentSurah?.nameArabic}</Text>{!ar ? <Text style={styles.surahEnglish}>{segmentSurah?.nameTransliterated} • {segmentSurah?.nameEnglish}</Text> : null}</View> : null}\n                    {beginsSurah && segment.surah !== 1 && segment.surah !== 9 ? <Text style={[styles.basmala, { color: appearance.pageTheme === "dark" && appearance.textColor === "#111111" ? "#f2efe7" : appearance.textColor, fontSize: Math.max(22, appearance.fontSize - 2), lineHeight: Math.round(Math.max(22, appearance.fontSize - 2) * appearance.lineHeightMultiplier) }]}>بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ</Text> : null}\n                    <QuranPageText\n                      page={currentPage}\n                      ayahs={segment.ayahs}\n                      appearance={appearance}\n                      locale={locale}\n                      selectedKey={selectedAyah ? refKey(selectedAyah) : null}\n                      highlightedKey={prefs.highlightAudio && activeAyah ? refKey(activeAyah) : null}\n                      onPressAyah={handleAyahTap}\n                    />\n                  </View>\n                );\n              })}\n              <Text style={styles.mushafPageNumber}>{num(currentPage)}</Text>\n            </View>\n          </ScrollView>\n          <View style={styles.pageNav}><Pressable disabled={currentPage <= 1} onPress={() => openPage(currentPage - 1)} style={[styles.pageNavButton, currentPage <= 1 && styles.disabled]}><Text style={styles.pageNavText}>{ar ? "›" : "‹"} {tr("Previous", "السابق")}</Text></Pressable><View style={styles.pageNumberPill}><Text style={styles.pageNumberPillText}>📖 {tr(\`Page \${currentPage}\`, \`صفحة \${num(currentPage)}\`)}</Text></View><Pressable disabled={currentPage >= 604} onPress={() => openPage(currentPage + 1)} style={[styles.pageNavButton, currentPage >= 604 && styles.disabled]}><Text style={styles.pageNavText}>{tr("Next", "التالي")} {ar ? "‹" : "›"}</Text></Pressable></View>\n        </View>\n      ) : (\n        <ScrollView style={styles.flex} contentContainerStyle={styles.studyWrap} showsVerticalScrollIndicator={false}>\n          <View style={styles.studySheet}>\n            <View style={styles.surahHeader}><Text style={styles.surahArabic}>{readerSurah.nameArabic}</Text>{!ar ? <Text style={styles.surahEnglish}>{readerSurah.nameTransliterated} • {readerSurah.nameEnglish}</Text> : null}</View>\n            {readerSurah.number !== 1 && readerSurah.number !== 9 ? <Text style={[styles.basmala, { fontSize: Math.max(22, appearance.fontSize - 2), lineHeight: Math.round(Math.max(22, appearance.fontSize - 2) * appearance.lineHeightMultiplier) }]}>بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ</Text> : null}\n            {readerAyahs.map((ayah) => <Pressable key={refKey(ayah)} onPress={() => handleAyahTap(ayah)} style={[styles.studyAyah, activeAyah?.surah === ayah.surah && activeAyah?.ayah === ayah.ayah && prefs.highlightAudio && styles.studyPlaying]}><View style={styles.studyTop}><Text style={styles.ayahPill}>{num(ayah.ayah)}</Text><Pressable onPress={() => playAyah(ayah)} style={styles.smallPlay}><Text>▶️</Text></Pressable></View><Text style={[styles.studyArabic, { fontSize: appearance.fontSize, lineHeight: Math.round(appearance.fontSize * appearance.lineHeightMultiplier) }]}>{ayah.text}</Text></Pressable>)}\n          </View>\n        </ScrollView>\n      )}`;
mustReplace(oldReaderScroll, newReaderScroll, "reader body");

// Use the new appearance sheet instead of placeholder Mushaf/Naskh/Clean controls.
const oldReadingControls = `            <Text style={styles.menuLabel}>{tr("Qur’an font", "خط القرآن")}</Text>\n            <View style={styles.threeCol}>{(["mushaf", "naskh", "clean"] as FontChoice[]).map((choice) => <Pressable key={choice} onPress={() => persistPrefs({ font: choice })} style={[styles.smallChoice, prefs.font === choice && styles.choiceActive]}><Text style={prefs.font === choice ? styles.choiceTextActive : styles.choiceText}>{choice === "mushaf" ? tr("Mushaf", "مصحف") : choice === "naskh" ? tr("Naskh", "نسخ") : tr("Clean", "واضح")}</Text></Pressable>)}</View>\n\n            <Text style={styles.menuLabel}>{tr("Font size", "حجم الخط")} · {prefs.fontSize}</Text>\n            <View style={styles.stepRow}><Pressable onPress={() => persistPrefs({ fontSize: clamp(prefs.fontSize - 1, 20, 42) })} style={styles.stepButton}><Text style={styles.stepText}>A−</Text></Pressable><View style={styles.stepValue}><Text style={styles.stepValueText}>{prefs.fontSize}</Text></View><Pressable onPress={() => persistPrefs({ fontSize: clamp(prefs.fontSize + 1, 20, 42) })} style={styles.stepButton}><Text style={styles.stepText}>A+</Text></Pressable></View>\n\n            <Text style={styles.menuLabel}>{tr("Line spacing", "تباعد السطور")} · {prefs.lineHeight}</Text>\n            <View style={styles.stepRow}><Pressable onPress={() => persistPrefs({ lineHeight: clamp(prefs.lineHeight - 2, 36, 72) })} style={styles.stepButton}><Text style={styles.stepText}>−</Text></Pressable><View style={styles.stepValue}><Text style={styles.stepValueText}>{prefs.lineHeight}</Text></View><Pressable onPress={() => persistPrefs({ lineHeight: clamp(prefs.lineHeight + 2, 36, 72) })} style={styles.stepButton}><Text style={styles.stepText}>+</Text></Pressable></View>\n\n            <View style={styles.menuToggle}><View style={styles.toggleCopy}><Text style={styles.toggleTitle}>🎨 {tr("Tajweed colours", "ألوان التجويد")}</Text><Text style={styles.toggleSub}>{tr("Verified rule colouring; cached after first load", "ألوان أحكام التجويد وتُحفظ بعد أول تحميل")}</Text></View><Switch value={prefs.tajweed} onValueChange={(value) => persistPrefs({ tajweed: value })} /></View>`;
const newReadingControls = `            <Pressable onPress={() => { setMenuOpen(false); setTimeout(() => setAppearanceOpen(true), 120); }} style={styles.appearanceLauncher}><View style={styles.appearanceIcon}><Text style={styles.appearanceIconText}>Aa</Text></View><View style={styles.toggleCopy}><Text style={styles.toggleTitle}>🎨 {tr("Qur’an appearance", "مظهر القرآن")}</Text><Text style={styles.toggleSub}>{tr(appearance.font === "qcf-v2" ? "King Fahad Complex V2" : appearance.font === "qcf-v1" ? "King Fahad Complex V1" : "QPC Uthmani Hafs", appearance.font === "qcf-v2" ? "مجمع الملك فهد V2" : appearance.font === "qcf-v1" ? "مجمع الملك فهد V1" : "عثماني حفص QPC")} · {appearance.fontSize} · {appearance.tajweed ? tr("Tajweed on", "التجويد مفعّل") : tr("Tajweed off", "التجويد متوقف")}</Text></View><Text style={styles.launchArrow}>{ar ? "‹" : "›"}</Text></Pressable>`;
mustReplace(oldReadingControls, newReadingControls, "reading controls");

// Safer bookmark parsing under strict TypeScript.
mustReplace(
  `  const bookmarkAyahs = bookmarks.map((key) => { const [s, a] = key.split(":").map(Number); return getAyah(s, a); }).filter(Boolean) as QuranAyah[];`,
  `  const bookmarkAyahs = bookmarks.map((key) => { const parts = key.split(":").map(Number); const s = parts[0]; const a = parts[1]; return s && a ? getAyah(s, a) : undefined; }).filter(Boolean) as QuranAyah[];`,
  "bookmark parsing"
);

// Render the dedicated appearance sheet alongside the unified menu.
mustReplace(
  `  return <View style={styles.flex}>{body}{screen !== "reader" && screen !== "memorize" ? miniPlayer : null}{menu}</View>;`,
  `  return <View style={styles.flex}>{body}{screen !== "reader" && screen !== "memorize" ? miniPlayer : null}{menu}<ReaderSettingsSheet visible={appearanceOpen} locale={locale} appearance={appearance} setAppearance={setAppearance} reset={resetAppearance} onDone={() => setAppearanceOpen(false)} /></View>;`,
  "appearance sheet render"
);

// Styles for the page reader and settings launcher.
mustReplace(
  `  mushafWrap: { padding: 10, paddingBottom: 150 }, studyWrap: { padding: 11, paddingBottom: 150 }, mushafSheet: { backgroundColor: "#fcf9ef", borderRadius: 15, borderWidth: 1, borderColor: "#ded7c8", padding: 16, minHeight: 650 }, studySheet: { backgroundColor: "transparent" },`,
  `  readerPageBody: { flex: 1, backgroundColor: "#f2efe6" }, mushafWrap: { padding: 10, paddingBottom: 16 }, studyWrap: { padding: 11, paddingBottom: 150 }, mushafSheet: { backgroundColor: "#fcf9ef", borderRadius: 15, borderWidth: 1, borderColor: "#ded7c8", padding: 16, minHeight: 650 }, studySheet: { backgroundColor: "transparent" }, mushafPageMeta: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }, mushafMetaText: { color: "#69716e", fontSize: 9, fontWeight: "800" }, mushafPageNumber: { color: "#6f7673", fontSize: 11, fontWeight: "800", textAlign: "center", marginTop: 14 }, pageNav: { flexDirection: "row", alignItems: "center", gap: 7, backgroundColor: "#fff", borderTopWidth: 1, borderTopColor: "#e3ded4", padding: 8 }, pageNavButton: { flex: 1, minHeight: 42, borderRadius: 13, backgroundColor: "#edf5f1", alignItems: "center", justifyContent: "center" }, pageNavText: { color: "#0b654f", fontSize: 9, fontWeight: "900" }, pageNumberPill: { minWidth: 92, minHeight: 42, borderRadius: 13, backgroundColor: "#0b654f", alignItems: "center", justifyContent: "center", paddingHorizontal: 8 }, pageNumberPillText: { color: "#fff", fontSize: 9, fontWeight: "900" },`,
  "page styles"
);
mustReplace(
  `  menuToggle: { marginTop: 11, padding: 13, borderRadius: 17, backgroundColor: "white", borderWidth: 1, borderColor: "#e1ddd4", flexDirection: "row", alignItems: "center", gap: 10 }, toggleCopy: { flex: 1 }, toggleTitle: { color: "#173f35", fontSize: 11, fontWeight: "900" }, toggleSub: { color: "#87918d", fontSize: 8, marginTop: 3 },`,
  `  menuToggle: { marginTop: 11, padding: 13, borderRadius: 17, backgroundColor: "white", borderWidth: 1, borderColor: "#e1ddd4", flexDirection: "row", alignItems: "center", gap: 10 }, appearanceLauncher: { marginTop: 11, padding: 13, borderRadius: 17, backgroundColor: "#edf6f2", borderWidth: 1, borderColor: "#d5e9e0", flexDirection: "row", alignItems: "center", gap: 11 }, appearanceIcon: { width: 43, height: 43, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "#0b654f" }, appearanceIconText: { color: "#fff", fontSize: 14, fontWeight: "900" }, launchArrow: { color: "#0b654f", fontSize: 25, fontWeight: "800" }, toggleCopy: { flex: 1 }, toggleTitle: { color: "#173f35", fontSize: 11, fontWeight: "900" }, toggleSub: { color: "#87918d", fontSize: 8, marginTop: 3 },`,
  "appearance launcher styles"
);

fs.writeFileSync(file, src);
console.log("Quran V2 upgraded with exact Mushaf fonts, Tajweed appearance controls, page rendering, and strict audio fixes.");
