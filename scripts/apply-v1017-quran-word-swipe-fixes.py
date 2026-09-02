from pathlib import Path

qpath = Path('mobile/src/quran/QuranV3.tsx')
q = qpath.read_text(encoding='utf-8')

# Make the Arabic-book swipe direction explicit and remove any ambiguous ternary.
old = '''      onPanResponderRelease: (_event, gestureState) => {\n        if (Math.abs(gestureState.dx) < 42) return;\n        turnReaderPage(gestureState.dx < 0 ? 1 : -1);\n      },'''
new = '''      onPanResponderRelease: (_event, gestureState) => {\n        const horizontal = Math.abs(gestureState.dx);\n        const vertical = Math.abs(gestureState.dy);\n        if (horizontal < 42 || horizontal <= vertical * 1.25) return;\n        // Arabic-book paging: finger LEFT opens the NEXT page; finger RIGHT goes BACK.\n        if (gestureState.dx <= -42) turnReaderPage(1);\n        else if (gestureState.dx >= 42) turnReaderPage(-1);\n      },'''
if old in q:
    q = q.replace(old, new, 1)

# Never let the old opposite behavior survive anywhere in the generated reader.
q = q.replace('turnReaderPage(gestureState.dx > 0 ? 1 : -1);', 'if (gestureState.dx <= -42) turnReaderPage(1); else if (gestureState.dx >= 42) turnReaderPage(-1);')

# Word-audio metadata type.
type_anchor = 'type Range = { surah: number; start: number; end: number };\n'
if type_anchor in q and 'type QuranWordAudio' not in q:
    q = q.replace(type_anchor, type_anchor + 'type QuranWordAudio = { position: number; text: string; audioUrl: string };\n', 1)

# Word audio state beside selected ayah.
state_anchor = '  const [selectedAyah, setSelectedAyah] = useState<QuranAyah | null>(null);\n'
if state_anchor in q and 'selectedWordsLoading' not in q:
    q = q.replace(state_anchor, state_anchor + '  const [selectedWords, setSelectedWords] = useState<QuranWordAudio[]>([]);\n  const [selectedWordsLoading, setSelectedWordsLoading] = useState(false);\n', 1)

# Load verified word-by-word metadata for the selected ayah.
effect_anchor = '  useEffect(() => {\n    if (!bookmarkNotice) return;\n'
if effect_anchor in q and 'audio.qurancdn.com' not in q:
    word_effect = '''  useEffect(() => {\n    let active = true;\n    if (!selectedAyah) {\n      setSelectedWords([]);\n      setSelectedWordsLoading(false);\n      return () => { active = false; };\n    }\n    setSelectedWordsLoading(true);\n    void fetch(`https://api.quran.com/api/v4/verses/by_key/${selectedAyah.surah}:${selectedAyah.ayah}?words=true&word_fields=text_uthmani,audio_url,position`)\n      .then((response) => { if (!response.ok) throw new Error(`Word audio request failed: ${response.status}`); return response.json(); })\n      .then((payload: { verse?: { words?: Array<{ position?: number; text_uthmani?: string; audio_url?: string; char_type_name?: string }> } }) => {\n        if (!active) return;\n        const words = (payload.verse?.words ?? [])\n          .filter((word) => word.char_type_name !== \"end\" && Boolean(word.text_uthmani) && Boolean(word.audio_url))\n          .map((word, index) => ({\n            position: word.position ?? index + 1,\n            text: word.text_uthmani ?? \"\",\n            audioUrl: (word.audio_url ?? \"\").startsWith(\"http\") ? (word.audio_url ?? \"\") : `https://audio.qurancdn.com/${(word.audio_url ?? \"\").replace(/^\\/+/, \"\")}`\n          }));\n        setSelectedWords(words);\n      })\n      .catch(() => { if (active) setSelectedWords([]); })\n      .finally(() => { if (active) setSelectedWordsLoading(false); });\n    return () => { active = false; };\n  }, [selectedAyah?.surah, selectedAyah?.ayah]);\n\n'''
    q = q.replace(effect_anchor, word_effect + effect_anchor, 1)

# Direct word playback through the existing native Quran player.
play_anchor = '  const playAyah = (ayah: QuranAyah, repeat = false) => playQueue([ayah], repeat);\n'
if play_anchor in q and 'const playSelectedWord' not in q:
    direct = '''  const playSelectedWord = (word: QuranWordAudio) => {\n    if (!QuranAudio || !selectedAyah) {\n      Alert.alert(tr(\"Audio unavailable\", \"الصوت غير متاح\"), tr(\"Word audio could not start on this device.\", \"تعذر تشغيل صوت الكلمة على هذا الجهاز.\"));\n      return;\n    }\n    const surah = getSurah(selectedAyah.surah);\n    const payload = JSON.stringify([{\n      url: word.audioUrl,\n      title: `${word.text} • ${ar ? surah?.nameArabic : surah?.nameTransliterated ?? `Surah ${selectedAyah.surah}`}`,\n      subtitle: `${tr(\"Word\", \"كلمة\")} ${num(word.position)} • Hassoun`\n    }]);\n    setRepeatQueue(false);\n    completionRef.current = null;\n    setAudioStatus((previous) => ({ ...previous, available: true, state: \"loading\", title: word.text }));\n    try { QuranAudio.playQueue(payload, 0, false, 1); }\n    catch (error) { Alert.alert(tr(\"Playback failed\", \"فشل التشغيل\"), error instanceof Error ? error.message : tr(\"Please try again.\", \"يرجى المحاولة مرة أخرى.\")); }\n  };\n\n'''
    q = q.replace(play_anchor, direct + play_anchor, 1)

# Add compact Word / Ayah-Phrase / Surah playback controls to the selected-ayah panel.
header_anchor = '''          <View style={styles.actionHeader}>\n            <View style={styles.actionDot} />\n            <Text style={styles.actionRef} numberOfLines={1}>{ar ? getSurah(selectedAyah.surah)?.nameArabic : getSurah(selectedAyah.surah)?.nameTransliterated} • {tr(\"Ayah\", \"الآية\")} {num(selectedAyah.ayah)}</Text>\n            <Pressable onPress={() => setSelectedAyah(null)} style={styles.actionClose}><Text style={styles.actionCloseText}>×</Text></Pressable>\n          </View>\n'''
if header_anchor in q and 'styles.wordAudioRow' not in q:
    controls = '''          <View style={styles.selectionPlayRow}>\n            <Pressable onPress={() => toggleSelectedPlayback(selectedAyah)} style={styles.selectionPlayPill}><Text style={styles.selectionPlayPillText}>▶ {tr(\"Ayah / phrase\", \"الآية / العبارة\")}</Text></Pressable>\n            <Pressable onPress={() => playSurah(selectedAyah.surah, false)} style={styles.selectionPlayPill}><Text style={styles.selectionPlayPillText}>▶ {tr(\"Surah\", \"السورة\")}</Text></Pressable>\n          </View>\n          <View style={styles.wordAudioBlock}>\n            <Text style={styles.wordAudioLabel}>{selectedWordsLoading ? tr(\"Loading words…\", \"جارٍ تحميل الكلمات…\") : tr(\"Tap a word to hear only that word\", \"اضغط على كلمة لسماع هذه الكلمة فقط\")}</Text>\n            {selectedWords.length ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.wordAudioRow}>{selectedWords.map((word) => <Pressable key={`${selectedAyah.surah}:${selectedAyah.ayah}:${word.position}`} onPress={() => playSelectedWord(word)} style={styles.wordAudioChip}><Text style={styles.wordAudioChipText}>{word.text}</Text></Pressable>)}</ScrollView> : null}\n          </View>\n'''
    q = q.replace(header_anchor, header_anchor + controls, 1)

# Styles for compact selection playback controls.
style_anchor = '  actionTransport: { flexDirection: "row", alignItems: "center", justifyContent: "space-around", paddingHorizontal: 6 },\n'
if style_anchor in q and 'wordAudioChip:' not in q:
    styles = '''  selectionPlayRow: { flexDirection: \"row\", gap: 7, paddingHorizontal: 10, paddingBottom: 7 },\n  selectionPlayPill: { flex: 1, minHeight: 36, borderRadius: 13, backgroundColor: \"#edf5f1\", borderWidth: 1, borderColor: \"#cfe0d8\", alignItems: \"center\", justifyContent: \"center\", paddingHorizontal: 8 },\n  selectionPlayPillText: { color: \"#0b654f\", fontSize: 8.5, fontWeight: \"900\" },\n  wordAudioBlock: { paddingHorizontal: 10, paddingBottom: 8 },\n  wordAudioLabel: { color: \"#6e7d77\", fontSize: 7.5, fontWeight: \"800\", marginBottom: 5 },\n  wordAudioRow: { gap: 6, paddingRight: 8 },\n  wordAudioChip: { minHeight: 34, borderRadius: 12, backgroundColor: \"#fffaf0\", borderWidth: 1, borderColor: \"#dfd2b7\", paddingHorizontal: 10, alignItems: \"center\", justifyContent: \"center\" },\n  wordAudioChipText: { color: \"#173f35\", fontSize: 16, writingDirection: \"rtl\" },\n'''
    q = q.replace(style_anchor, styles + style_anchor, 1)

# Required guarantees for the next build.
required = [
    'gestureState.dx <= -42) turnReaderPage(1)',
    'gestureState.dx >= 42) turnReaderPage(-1)',
    'Tap a word to hear only that word',
    'https://audio.qurancdn.com/',
    'Ayah / phrase',
]
for marker in required:
    if marker not in q:
        raise SystemExit(f'Missing v1.0.17 Quran requirement: {marker}')
if 'turnReaderPage(gestureState.dx > 0 ? 1 : -1)' in q:
    raise SystemExit('Wrong right-swipe-next logic is still present')
qpath.write_text(q, encoding='utf-8')
print('Applied v1.0.17 Quran word/phrase/surah playback and swipe-direction fixes.')
