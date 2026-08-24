import fs from 'node:fs';

const path = 'src/quran/AlHafizClassroom.tsx';
let s = fs.readFileSync(path, 'utf8');

function replaceOnce(label, from, to) {
  if (s.includes(to)) return;
  if (!s.includes(from)) throw new Error(label + ' anchor not found');
  s = s.replace(from, to);
}

const stateAnchor = '  const [studyQuiz, setStudyQuiz] = useState<StudyQuiz | null>(null);\n';
const statePatched = stateAnchor + '  const [playingWordKey, setPlayingWordKey] = useState("");\n  const [playingWordUrl, setPlayingWordUrl] = useState("");\n';
replaceOnce('studyQuiz state', stateAnchor, statePatched);

const effectAnchor = `  useEffect(() => {\n    if (!loaded) return;\n    void AsyncStorage.setItem(CARD_VIEW_KEY, JSON.stringify(cardViewSettings));\n  }, [cardViewSettings, loaded]);\n`;
const effectPatched = effectAnchor + `\n  useEffect(() => {\n    if (!playingWordUrl || !QuranAudio) return;\n    const timer = setInterval(() => {\n      const status = QuranAudio.getStatus();\n      const stillThisWord = status.url === playingWordUrl && (status.state === "loading" || status.state === "playing" || status.state === "paused");\n      if (!stillThisWord) {\n        setPlayingWordKey("");\n        setPlayingWordUrl("");\n      }\n    }, 150);\n    return () => clearInterval(timer);\n  }, [playingWordUrl]);\n`;
replaceOnce('card-view effect', effectAnchor, effectPatched);

const playOld = `  async function playWord(word: LessonWord) {\n    if (!QuranAudio) return;\n    try { await QuranAudio.play(quranWordAudioUrl(word), 1); } catch (error) {\n      Alert.alert(t("Word audio unavailable", "تعذر تشغيل الكلمة"), error instanceof Error ? error.message : String(error));\n    }\n  }\n`;
const playNew = `  async function playWord(word: LessonWord) {\n    if (!QuranAudio) return;\n    const url = quranWordAudioUrl(word);\n    const key = word.surah + ":" + word.ayah + ":" + word.wordIndex;\n    setPlayingWordKey(key);\n    setPlayingWordUrl(url);\n    try {\n      await QuranAudio.play(url, 1);\n    } catch (error) {\n      setPlayingWordKey("");\n      setPlayingWordUrl("");\n      Alert.alert(t("Word audio unavailable", "تعذر تشغيل الكلمة"), error instanceof Error ? error.message : String(error));\n    }\n  }\n`;
replaceOnce('playWord', playOld, playNew);

const renderOld = `{tokenizeAyah(ayah).map((word) => <Pressable key={word.surah + ":" + word.ayah + ":" + word.wordIndex} onPress={() => void playWord(word)} style={styles.wordButton}><Text style={[styles.wordButtonText, { fontSize: activeCardView.fontSize, lineHeight: Math.round(activeCardView.fontSize * 1.7), fontFamily: activeCardView.fontStyle === "mushaf" ? "serif" : activeCardView.fontStyle === "classic" ? "sans-serif" : undefined, fontWeight: activeCardView.fontStyle === "clean" ? "700" : "500" }]}>{word.text}</Text></Pressable>)}`;
const renderNew = `{tokenizeAyah(ayah).map((word) => { const wordKey = word.surah + ":" + word.ayah + ":" + word.wordIndex; const isPlayingWord = playingWordKey === wordKey; return <Pressable key={wordKey} onPress={() => void playWord(word)} style={[styles.wordButton, isPlayingWord && styles.wordButtonPlaying]}><Text style={[styles.wordButtonText, isPlayingWord && styles.wordButtonTextPlaying, { fontSize: activeCardView.fontSize, lineHeight: Math.round(activeCardView.fontSize * 1.7), fontFamily: activeCardView.fontStyle === "mushaf" ? "serif" : activeCardView.fontStyle === "classic" ? "sans-serif" : undefined, fontWeight: activeCardView.fontStyle === "clean" ? "700" : "500" }]}>{word.text}</Text></Pressable>; })}`;
replaceOnce('word render', renderOld, renderNew);

if (!s.includes('wordButtonPlaying:')) {
  const wordButtonLine = '  wordButton: { paddingHorizontal: 2, paddingVertical: 1, borderRadius: 6 },\n';
  if (!s.includes(wordButtonLine)) throw new Error('wordButton style anchor not found');
  s = s.replace(wordButtonLine, wordButtonLine + '  wordButtonPlaying: { backgroundColor: "#f6d96d", borderWidth: 1, borderColor: "#d6ad35", paddingHorizontal: 5 },\n');
}

if (!s.includes('wordButtonTextPlaying:')) {
  const wordTextLine = '  wordButtonText: { color: "#183e35", textAlign: "right", writingDirection: "rtl" },\n';
  if (!s.includes(wordTextLine)) throw new Error('wordButtonText style anchor not found');
  s = s.replace(wordTextLine, wordTextLine + '  wordButtonTextPlaying: { color: "#0b5b47", fontWeight: "900" },\n');
}

fs.writeFileSync(path, s);
console.log('Added resilient active-word highlighting during Qur’an word playback');
