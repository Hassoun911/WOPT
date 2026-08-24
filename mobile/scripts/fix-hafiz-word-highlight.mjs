import fs from 'node:fs';

const path = 'src/quran/AlHafizClassroom.tsx';
let s = fs.readFileSync(path, 'utf8');

const stateAnchor = '  const [studyQuiz, setStudyQuiz] = useState<StudyQuiz | null>(null);\n';
if (!s.includes(stateAnchor)) throw new Error('studyQuiz state anchor not found');
s = s.replace(stateAnchor, stateAnchor + '  const [playingWordKey, setPlayingWordKey] = useState("");\n  const [playingWordUrl, setPlayingWordUrl] = useState("");\n');

const effectAnchor = `  useEffect(() => {\n    if (!loaded) return;\n    void AsyncStorage.setItem(CARD_VIEW_KEY, JSON.stringify(cardViewSettings));\n  }, [cardViewSettings, loaded]);\n`;
if (!s.includes(effectAnchor)) throw new Error('card-view effect anchor not found');
s = s.replace(effectAnchor, effectAnchor + `\n  useEffect(() => {\n    if (!playingWordUrl || !QuranAudio) return;\n    const timer = setInterval(() => {\n      const status = QuranAudio.getStatus();\n      const stillThisWord = status.url === playingWordUrl && (status.state === "loading" || status.state === "playing" || status.state === "paused");\n      if (!stillThisWord) {\n        setPlayingWordKey("");\n        setPlayingWordUrl("");\n      }\n    }, 150);\n    return () => clearInterval(timer);\n  }, [playingWordUrl]);\n`);

const playOld = `  async function playWord(word: LessonWord) {\n    if (!QuranAudio) return;\n    try { await QuranAudio.play(quranWordAudioUrl(word), 1); } catch (error) {\n      Alert.alert(t("Word audio unavailable", "تعذر تشغيل الكلمة"), error instanceof Error ? error.message : String(error));\n    }\n  }\n`;
const playNew = `  async function playWord(word: LessonWord) {\n    if (!QuranAudio) return;\n    const url = quranWordAudioUrl(word);\n    const key = word.surah + ":" + word.ayah + ":" + word.wordIndex;\n    setPlayingWordKey(key);\n    setPlayingWordUrl(url);\n    try {\n      await QuranAudio.play(url, 1);\n    } catch (error) {\n      setPlayingWordKey("");\n      setPlayingWordUrl("");\n      Alert.alert(t("Word audio unavailable", "تعذر تشغيل الكلمة"), error instanceof Error ? error.message : String(error));\n    }\n  }\n`;
if (!s.includes(playOld)) throw new Error('playWord anchor not found');
s = s.replace(playOld, playNew);

const renderOld = `{tokenizeAyah(ayah).map((word) => <Pressable key={word.surah + ":" + word.ayah + ":" + word.wordIndex} onPress={() => void playWord(word)} style={styles.wordButton}><Text style={[styles.wordButtonText, { fontSize: activeCardView.fontSize, lineHeight: Math.round(activeCardView.fontSize * 1.7), fontFamily: activeCardView.fontStyle === "mushaf" ? "serif" : activeCardView.fontStyle === "classic" ? "sans-serif" : undefined, fontWeight: activeCardView.fontStyle === "clean" ? "700" : "500" }]}>{word.text}</Text></Pressable>)}`;
const renderNew = `{tokenizeAyah(ayah).map((word) => { const wordKey = word.surah + ":" + word.ayah + ":" + word.wordIndex; const isPlayingWord = playingWordKey === wordKey; return <Pressable key={wordKey} onPress={() => void playWord(word)} style={[styles.wordButton, isPlayingWord && styles.wordButtonPlaying]}><Text style={[styles.wordButtonText, isPlayingWord && styles.wordButtonTextPlaying, { fontSize: activeCardView.fontSize, lineHeight: Math.round(activeCardView.fontSize * 1.7), fontFamily: activeCardView.fontStyle === "mushaf" ? "serif" : activeCardView.fontStyle === "classic" ? "sans-serif" : undefined, fontWeight: activeCardView.fontStyle === "clean" ? "700" : "500" }]}>{word.text}</Text></Pressable>; })}`;
if (!s.includes(renderOld)) throw new Error('word render anchor not found');
s = s.replace(renderOld, renderNew);

const styleAnchor = '  wordButton: { paddingHorizontal: 2, paddingVertical: 1, borderRadius: 6 },\\\n  wordButtonText: { color: "#183e35", textAlign: "right", writingDirection: "rtl" },\\\n';
const styleReplacement = '  wordButton: { paddingHorizontal: 2, paddingVertical: 1, borderRadius: 6 },\\\n  wordButtonPlaying: { backgroundColor: "#f6d96d", borderWidth: 1, borderColor: "#d6ad35", paddingHorizontal: 5 },\\\n  wordButtonText: { color: "#183e35", textAlign: "right", writingDirection: "rtl" },\\\n  wordButtonTextPlaying: { color: "#0b5b47", fontWeight: "900" },\\\n';
if (!s.includes(styleAnchor)) throw new Error('word style anchor not found');
s = s.replace(styleAnchor, styleReplacement);

fs.writeFileSync(path, s);
console.log('Added active-word highlighting during Qur’an word playback');
