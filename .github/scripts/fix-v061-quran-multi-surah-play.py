from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
path = ROOT / "mobile/src/quran/QuranV3.tsx"
text = path.read_text()
marker = "MULTI_SURAH_PLAY_CHOOSER_V061"

if marker not in text:
    text = text.replace(
        '  const [playerVisible, setPlayerVisible] = useState(true);\n',
        '  const [playerVisible, setPlayerVisible] = useState(true);\n  const [readerPlayChooserOpen, setReaderPlayChooserOpen] = useState(false);\n'
    )

    active_block = '''  const activeAyahOnVisiblePage = Boolean(\n    activeAyah && visibleReaderPages.includes(pageForAyah(activeAyah.surah, activeAyah.ayah) ?? -1)\n  );\n'''
    choices_block = '''  const activeAyahOnVisiblePage = Boolean(\n    activeAyah && visibleReaderPages.includes(pageForAyah(activeAyah.surah, activeAyah.ayah) ?? -1)\n  );\n  // MULTI_SURAH_PLAY_CHOOSER_V061\n  // A Mushaf page may contain the end of one Surah plus one or more new Surahs.\n  // Keep one playback choice per visible Surah, starting at the first ayah the\n  // user can actually see on this page/spread.\n  const visibleReaderSurahChoices = (() => {\n    const firstVisible = new Map<number, QuranAyah>();\n    for (const page of visibleReaderPages) {\n      for (const ayah of pageAyahsFor(page, pages)) {\n        if (!firstVisible.has(ayah.surah)) firstVisible.set(ayah.surah, ayah);\n      }\n    }\n    return [...firstVisible.values()].map((ayah) => ({\n      surah: ayah.surah,\n      startAyah: ayah.ayah,\n      surahInfo: getSurah(ayah.surah)\n    }));\n  })();\n  const readerAudioStartedFromVisibleView = Boolean(\n    audioQueue[0] && (\n      visibleReaderPages.includes(pageForAyah(audioQueue[0].surah, audioQueue[0].ayah) ?? -1) ||\n      activeAyahOnVisiblePage\n    )\n  );\n'''
    if active_block not in text:
        raise SystemExit("Could not find active visible-page block")
    text = text.replace(active_block, choices_block, 1)

    text = text.replace(
        '    setSelectedAyah(null);\n    persistLast(next);\n',
        '    setSelectedAyah(null);\n    setReaderPlayChooserOpen(false);\n    persistLast(next);\n',
        1
    )

    text = text.replace(
        '  const handleBack = () => {\n    if (appearanceOpen) { setAppearanceOpen(false); return true; }\n',
        '  const handleBack = () => {\n    if (readerPlayChooserOpen) { setReaderPlayChooserOpen(false); return true; }\n    if (appearanceOpen) { setAppearanceOpen(false); return true; }\n'
    )

    old_play_helpers = '''  const playAyah = (ayah: QuranAyah, repeat = false) => playQueue([ayah], repeat);\n  const playSurah = (surah: number, repeat = false) => playQueue(getSurahAyahs(surah), repeat);\n  const playVisibleReaderPages = (repeat = false) => {\n    const queue = visibleReaderPages.flatMap((page) => pageAyahsFor(page, pages));\n    playQueue(queue, repeat);\n  };\n'''
    new_play_helpers = '''  const playAyah = (ayah: QuranAyah, repeat = false) => playQueue([ayah], repeat);\n  const playSurah = (surah: number, repeat = false) => playQueue(getSurahAyahs(surah), repeat);\n  const playVisibleReaderPages = (repeat = false) => {\n    const queue = visibleReaderPages.flatMap((page) => pageAyahsFor(page, pages));\n    playQueue(queue, repeat);\n  };\n  const playReaderSurahFromVisibleAyah = (surah: number, startAyah: number, repeat = false) => {\n    // Start exactly where this Surah first appears on the visible Mushaf page,\n    // then keep playing the same Surah across as many following pages as needed.\n    const queue = getSurahAyahs(surah).filter((ayah) => ayah.ayah >= startAyah);\n    setReaderPlayChooserOpen(false);\n    playQueue(queue, repeat);\n  };\n  const startReaderPlaybackFromView = () => {\n    if (!visibleReaderSurahChoices.length) return;\n    if (visibleReaderSurahChoices.length === 1) {\n      const choice = visibleReaderSurahChoices[0]!;\n      playReaderSurahFromVisibleAyah(choice.surah, choice.startAyah, false);\n      return;\n    }\n    // Do not silently choose the first Surah when several are visible.\n    setReaderPlayChooserOpen(true);\n  };\n'''
    if old_play_helpers not in text:
        raise SystemExit("Could not find reader play helper block")
    text = text.replace(old_play_helpers, new_play_helpers, 1)

    old_toggle = '''  const togglePlayerPlayback = () => {\n    if (screen === "reader") {\n      // Reader playback always belongs to what is visible now. If the native\n      // session is playing/paused on another page, replace it with the current\n      // page (or current two-page spread) instead of resuming unrelated audio.\n      if (!activeAyahOnVisiblePage) {\n        playVisibleReaderPages(false);\n        return;\n      }\n      if (audioStatus.state === "playing") { QuranAudio?.pause(); return; }\n      if (audioStatus.state === "paused") { QuranAudio?.resume(); return; }\n      // A completed visible-page queue should replay that page from its first ayah.\n      playVisibleReaderPages(false);\n      return;\n    }\n'''
    new_toggle = '''  const togglePlayerPlayback = () => {\n    if (screen === "reader") {\n      // Pause/resume only when this reader session was started from the current\n      // visible page/spread. If the existing audio belongs somewhere else, Play\n      // starts from what the user is looking at instead.\n      if (readerAudioStartedFromVisibleView && audioStatus.state === "playing") { QuranAudio?.pause(); return; }\n      if (readerAudioStartedFromVisibleView && audioStatus.state === "paused") { QuranAudio?.resume(); return; }\n      startReaderPlaybackFromView();\n      return;\n    }\n'''
    if old_toggle not in text:
        raise SystemExit("Could not find reader player toggle block")
    text = text.replace(old_toggle, new_toggle, 1)

    settings_line = '      <ReaderSettingsSheet visible={appearanceOpen} locale={locale} appearance={appearance} setAppearance={setAppearance} reset={resetAppearance} onDone={() => setAppearanceOpen(false)} />\n'
    chooser = '''      <Modal visible={readerPlayChooserOpen} transparent animationType="fade" onRequestClose={() => setReaderPlayChooserOpen(false)}>\n        <View style={styles.readerPlayChooserShade}>\n          <View style={styles.readerPlayChooserCard}>\n            <View style={styles.readerPlayChooserHeader}>\n              <BrandMark size={44} />\n              <View style={styles.topCopy}>\n                <Text style={[styles.readerPlayChooserEyebrow, ar && styles.rtl]}>HASSOUN • {tr("QUR’AN PLAYBACK", "تشغيل القرآن")}</Text>\n                <Text style={[styles.readerPlayChooserTitle, ar && styles.rtl]}>{tr("Which Surah do you want to play?", "أي سورة تريد تشغيلها؟")}</Text>\n                <Text style={[styles.readerPlayChooserNote, ar && styles.rtl]}>{tr("This page contains more than one Surah. Choose one and Hassoun will continue it to the end, even across following pages.", "هذه الصفحة تحتوي على أكثر من سورة. اختر سورة وسيواصل حسّون تشغيلها حتى نهايتها حتى لو امتدت إلى صفحات تالية.")}</Text>\n              </View>\n            </View>\n            <ScrollView style={styles.readerPlayChooserList} showsVerticalScrollIndicator={false}>\n              {visibleReaderSurahChoices.map((choice) => (\n                <Pressable key={`reader-play-${choice.surah}`} onPress={() => playReaderSurahFromVisibleAyah(choice.surah, choice.startAyah, false)} style={styles.readerPlayChooserOption}>\n                  <View style={styles.readerPlayChooserNumber}><Text style={styles.readerPlayChooserNumberText}>{num(choice.surah)}</Text></View>\n                  <View style={styles.topCopy}>\n                    <Text style={[styles.readerPlayChooserArabic, ar && styles.rtl]}>{choice.surahInfo?.nameArabic ?? `سورة ${num(choice.surah)}`}</Text>\n                    <Text style={[styles.readerPlayChooserEnglish, ar && styles.rtl]}>{choice.surahInfo?.nameTransliterated ?? tr(`Surah ${choice.surah}`, `سورة ${num(choice.surah)}`)}</Text>\n                    <Text style={[styles.readerPlayChooserStart, ar && styles.rtl]}>\n                      {choice.startAyah === 1\n                        ? tr("Play from the beginning • continue to end of Surah", "تشغيل من البداية • متابعة حتى نهاية السورة")\n                        : tr(`Start at visible Ayah ${choice.startAyah} • continue to end of Surah`, `ابدأ من الآية الظاهرة ${num(choice.startAyah)} • متابعة حتى نهاية السورة`)}\n                    </Text>\n                  </View>\n                  <Text style={styles.readerPlayChooserPlay}>▶</Text>\n                </Pressable>\n              ))}\n            </ScrollView>\n            <Pressable onPress={() => setReaderPlayChooserOpen(false)} style={styles.readerPlayChooserCancel}><Text style={styles.readerPlayChooserCancelText}>{tr("Cancel", "إلغاء")}</Text></Pressable>\n          </View>\n        </View>\n      </Modal>\n''' + settings_line
    if settings_line not in text:
        raise SystemExit("Could not find settings sheet insertion point")
    text = text.replace(settings_line, chooser, 1)

    style_anchor = '  flex: { flex: 1, backgroundColor: "#f6f3eb" },\n'
    chooser_styles = '''  flex: { flex: 1, backgroundColor: "#f6f3eb" },\n  readerPlayChooserShade: { flex: 1, backgroundColor: "rgba(0,25,20,.56)", justifyContent: "center", padding: 20 },\n  readerPlayChooserCard: { width: "100%", maxWidth: 520, maxHeight: "78%", alignSelf: "center", borderRadius: 28, backgroundColor: "#fffdf8", borderWidth: 1, borderColor: "#d8c99d", padding: 16, shadowColor: "#000", shadowOpacity: .24, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 16 },\n  readerPlayChooserHeader: { flexDirection: "row", alignItems: "center", gap: 11, marginBottom: 12 },\n  readerPlayChooserEyebrow: { color: "#a17825", fontSize: 7.5, fontWeight: "900", letterSpacing: 1 },\n  readerPlayChooserTitle: { color: "#173f35", fontSize: 19, fontWeight: "900", marginTop: 2 },\n  readerPlayChooserNote: { color: "#738079", fontSize: 8.5, lineHeight: 13, marginTop: 4 },\n  readerPlayChooserList: { maxHeight: 390 },\n  readerPlayChooserOption: { minHeight: 84, borderRadius: 20, backgroundColor: "#f8f5ed", borderWidth: 1, borderColor: "#e1d8c5", padding: 11, marginBottom: 8, flexDirection: "row", alignItems: "center", gap: 10 },\n  readerPlayChooserNumber: { width: 42, height: 42, borderRadius: 14, backgroundColor: "#0b654f", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#d9bd70" },\n  readerPlayChooserNumberText: { color: "#fff", fontSize: 10, fontWeight: "900" },\n  readerPlayChooserArabic: { color: "#173f35", fontSize: 18, fontWeight: "800", writingDirection: "rtl" },\n  readerPlayChooserEnglish: { color: "#355d51", fontSize: 10, fontWeight: "900", marginTop: 1 },\n  readerPlayChooserStart: { color: "#8b7958", fontSize: 7.5, lineHeight: 11, marginTop: 3 },\n  readerPlayChooserPlay: { width: 36, height: 36, borderRadius: 18, overflow: "hidden", textAlign: "center", textAlignVertical: "center", backgroundColor: "#0b654f", color: "#fff", fontSize: 13, fontWeight: "900" },\n  readerPlayChooserCancel: { minHeight: 44, borderRadius: 15, backgroundColor: "#edf2ee", alignItems: "center", justifyContent: "center", marginTop: 4 },\n  readerPlayChooserCancelText: { color: "#31564b", fontSize: 10, fontWeight: "900" },\n'''
    if style_anchor not in text:
        raise SystemExit("Could not find StyleSheet anchor")
    text = text.replace(style_anchor, chooser_styles, 1)

    path.write_text(text)

# Hard assertions so a build cannot silently omit the requested behavior.
final = path.read_text()
for required in [
    marker,
    'readerPlayChooserOpen',
    'Which Surah do you want to play?',
    'playReaderSurahFromVisibleAyah',
    'continue to end of Surah',
    'BrandMark size={44}',
]:
    if required not in final:
        raise SystemExit(f"Missing multi-Surah playback requirement: {required}")

print("Applied multi-Surah Mushaf Play popup and continue-to-end playback behavior.")
