import fs from 'node:fs';

const path = 'src/quran/AlHafizClassroom.tsx';
let s = fs.readFileSync(path, 'utf8');

function mustReplace(label, regex, replacement) {
  if (!regex.test(s)) throw new Error(label + ' pattern not found');
  s = s.replace(regex, replacement);
}

// 1) Remove a leading Bismillah from study-card word tokens only.
if (!s.includes('hasBismillahPrefix')) {
  mustReplace(
    'tokenizeAyah',
    /function tokenizeAyah\(ayah: QuranAyah\): LessonWord\[\] \{[\s\S]*?\n\}/,
`function tokenizeAyah(ayah: QuranAyah): LessonWord[] {
  const rawWords = ayah.text
    .split(/\\s+/)
    .map((text) => text.trim())
    .filter(Boolean)
    .filter((text) => /[\\u0621-\\u064Aٱ]/.test(text));
  const normalized = rawWords.map(normalizeArabic);
  const hasBismillahPrefix = normalized.length >= 4 &&
    normalized[0] === "بسم" && normalized[1] === "الله" &&
    normalized[2] === "الرحمن" && normalized[3] === "الرحيم";
  const offset = hasBismillahPrefix ? 4 : 0;
  return rawWords
    .slice(offset)
    .map((text, index) => ({ text, normalized: normalizeArabic(text), surah: ayah.surah, ayah: ayah.ayah, wordIndex: index + 1 + offset }))
    .filter((word) => word.normalized.length > 0);
}`
  );
}

// 2) Track the word currently playing so the UI can highlight it.
if (!s.includes('const [playingWordKey')) {
  mustReplace(
    'studyQuiz state',
    /  const \[studyQuiz, setStudyQuiz\] = useState<StudyQuiz \| null>\(null\);/,
    `  const [studyQuiz, setStudyQuiz] = useState<StudyQuiz | null>(null);\n  const [playingWordKey, setPlayingWordKey] = useState("");\n  const [playingWordUrl, setPlayingWordUrl] = useState("");`
  );
}

if (!s.includes('stillThisWord')) {
  const effectMarker = '  useEffect(() => {\n    if (!loaded) return;\n    void AsyncStorage.setItem(CARD_VIEW_KEY, JSON.stringify(cardViewSettings));\n  }, [cardViewSettings, loaded]);';
  if (!s.includes(effectMarker)) throw new Error('card view persistence effect not found');
  s = s.replace(effectMarker, effectMarker + `\n\n  useEffect(() => {\n    if (!playingWordUrl || !QuranAudio) return;\n    const timer = setInterval(() => {\n      const status = QuranAudio.getStatus();\n      const stillThisWord = status.url === playingWordUrl && (status.state === "loading" || status.state === "playing" || status.state === "paused");\n      if (!stillThisWord) {\n        setPlayingWordKey("");\n        setPlayingWordUrl("");\n      }\n    }, 150);\n    return () => clearInterval(timer);\n  }, [playingWordUrl]);`);
}

mustReplace(
  'playWord function',
  /  async function playWord\(word: LessonWord\) \{[\s\S]*?\n  \}/,
`  async function playWord(word: LessonWord) {
    if (!QuranAudio) return;
    const url = quranWordAudioUrl(word);
    const key = word.surah + ":" + word.ayah + ":" + word.wordIndex;
    setPlayingWordKey(key);
    setPlayingWordUrl(url);
    try {
      await QuranAudio.play(url, 1);
    } catch (error) {
      setPlayingWordKey("");
      setPlayingWordUrl("");
      Alert.alert(t("Word audio unavailable", "تعذر تشغيل الكلمة"), error instanceof Error ? error.message : String(error));
    }
  }`
);

// 3) Replace the generated word map with one that highlights the active word.
const oldWordMap = /\{tokenizeAyah\(ayah\)\.map\(\(word\) => <Pressable key=\{word\.surah \+ ":" \+ word\.ayah \+ ":" \+ word\.wordIndex\} onPress=\{\(\) => void playWord\(word\)\} style=\{styles\.wordButton\}><Text style=\{\[styles\.wordButtonText, \{ fontSize: activeCardView\.fontSize, lineHeight: Math\.round\(activeCardView\.fontSize \* 1\.7\), fontFamily: activeCardView\.fontStyle === "mushaf" \? "serif" : activeCardView\.fontStyle === "classic" \? "sans-serif" : undefined, fontWeight: activeCardView\.fontStyle === "clean" \? "700" : "500" \}\]\}>\{word\.text\}<\/Text><\/Pressable>\)\}/;
if (!s.includes('isPlayingWord = playingWordKey === wordKey')) {
  mustReplace(
    'interactive word map',
    oldWordMap,
    `{tokenizeAyah(ayah).map((word) => { const wordKey = word.surah + ":" + word.ayah + ":" + word.wordIndex; const isPlayingWord = playingWordKey === wordKey; return <Pressable key={wordKey} onPress={() => void playWord(word)} style={[styles.wordButton, isPlayingWord && styles.wordButtonPlaying]}><Text style={[styles.wordButtonText, isPlayingWord && styles.wordButtonTextPlaying, { fontSize: activeCardView.fontSize, lineHeight: Math.round(activeCardView.fontSize * 1.7), fontFamily: activeCardView.fontStyle === "mushaf" ? "serif" : activeCardView.fontStyle === "classic" ? "sans-serif" : undefined, fontWeight: activeCardView.fontStyle === "clean" ? "700" : "500" }]}>{word.text}</Text></Pressable>; })}`
  );
}

// 4) Force ayah-number ornaments into LTR so the brackets do not flip in Arabic layout.
if (!s.includes('String(ayah.ayah) + "﴾')) {
  mustReplace(
    'ayah number',
    /<Text style=\{\[styles\.ayahNumber, \{ fontSize: Math\.max\(16, activeCardView\.fontSize - 8\) \}\]\}>﴿\{ayah\.ayah\}﴾<\/Text>/,
    `<Text style={[styles.ayahNumber, { fontSize: Math.max(16, activeCardView.fontSize - 8), writingDirection: "ltr", textAlign: "left" }]}>{"\\u2066﴿" + String(ayah.ayah) + "﴾\\u2069"}</Text>`
  );
}

// 5) Add visual styles for the active word.
if (!s.includes('wordButtonPlaying:')) {
  const marker = '  wordButton: { paddingHorizontal: 2, paddingVertical: 1, borderRadius: 6 },';
  if (!s.includes(marker)) throw new Error('wordButton style not found');
  s = s.replace(marker, marker + '\n  wordButtonPlaying: { backgroundColor: "#f6d96d", borderWidth: 1, borderColor: "#d6ad35", paddingHorizontal: 5 },');
}
if (!s.includes('wordButtonTextPlaying:')) {
  const marker = '  wordButtonText: { color: "#183e35", textAlign: "right", writingDirection: "rtl" },';
  if (!s.includes(marker)) throw new Error('wordButtonText style not found');
  s = s.replace(marker, marker + '\n  wordButtonTextPlaying: { color: "#0b5b47", fontWeight: "900" },');
}

fs.writeFileSync(path, s);
console.log('Applied Al-Hafiz Bismillah, ayah direction, and active-word polish');
