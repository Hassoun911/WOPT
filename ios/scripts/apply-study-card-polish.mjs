import fs from 'node:fs';

const path = 'src/quran/AlHafizClassroom.tsx';
let s = fs.readFileSync(path, 'utf8');

// Keep Bismillah as a Surah heading, not memorization-card content.
const tokenizeRegex = /function tokenizeAyah\(ayah: QuranAyah\): LessonWord\[\] \{[\s\S]*?\n\}/;
if (!tokenizeRegex.test(s)) throw new Error('tokenizeAyah function not found');
s = s.replace(tokenizeRegex, `function tokenizeAyah(ayah: QuranAyah): LessonWord[] {
  let tokens = ayah.text
    .split(/\\s+/)
    .map((text) => text.trim())
    .filter(Boolean)
    .filter((text) => /[\\u0621-\\u064Aٱ]/.test(text));

  // Surah 1 includes the Bismillah as ayah 1, and Surah 9 has no opening Bismillah.
  // For every other Surah, remove the opening Bismillah from study-card words only.
  if (ayah.ayah === 1 && ayah.surah !== 1 && ayah.surah !== 9 && tokens.length >= 4) {
    const opening = tokens.slice(0, 4).map(normalizeArabic).join(" ");
    if (opening === "بسم الله الرحمن الرحيم") tokens = tokens.slice(4);
  }

  return tokens
    .map((text, index) => ({ text, normalized: normalizeArabic(text), surah: ayah.surah, ayah: ayah.ayah, wordIndex: index + 1 }))
    .filter((word) => word.normalized.length > 0);
}`);

// Track the word whose audio is currently playing.
const stateNeedle = '  const [studyQuiz, setStudyQuiz] = useState<StudyQuiz | null>(null);\n';
if (!s.includes(stateNeedle)) throw new Error('studyQuiz state anchor not found');
if (!s.includes('playingWordKey')) {
  s = s.replace(stateNeedle, stateNeedle + '  const [playingWordKey, setPlayingWordKey] = useState("");\n');
}

// Replace word playback with playback-state highlighting and safe cleanup.
const playWordRegex = /  async function playWord\(word: LessonWord\) \{[\s\S]*?\n  \}\n\n  async function ensureCardTranslations/;
if (!playWordRegex.test(s)) throw new Error('playWord function not found');
s = s.replace(playWordRegex, `  function wordKey(word: LessonWord) {
    return word.surah + ":" + word.ayah + ":" + word.wordIndex;
  }

  function clearWordHighlightWhenAudioStops(key: string, url: string) {
    let checks = 0;
    const timer = setInterval(() => {
      checks += 1;
      if (!QuranAudio) {
        clearInterval(timer);
        setPlayingWordKey((current) => current === key ? "" : current);
        return;
      }
      const status = QuranAudio.getStatus();
      const sameAudio = !status.url || status.url === url;
      const active = status.state === "loading" || status.state === "playing";
      // Give the native player a short moment to transition from idle to loading.
      if (checks > 3 && (!sameAudio || !active)) {
        clearInterval(timer);
        setPlayingWordKey((current) => current === key ? "" : current);
      }
      if (checks > 120) {
        clearInterval(timer);
        setPlayingWordKey((current) => current === key ? "" : current);
      }
    }, 100);
  }

  async function playWord(word: LessonWord) {
    if (!QuranAudio) return;
    const key = wordKey(word);
    const url = quranWordAudioUrl(word);
    setPlayingWordKey(key);
    try {
      await QuranAudio.play(url, 1);
      clearWordHighlightWhenAudioStops(key, url);
    } catch (error) {
      setPlayingWordKey((current) => current === key ? "" : current);
      Alert.alert(t("Word audio unavailable", "تعذر تشغيل الكلمة"), error instanceof Error ? error.message : String(error));
    }
  }

  async function ensureCardTranslations`);

// Highlight the tapped word while its individual audio is active.
const wordPressableNeedle = 'style={styles.wordButton}><Text style={[styles.wordButtonText,';
if (!s.includes(wordPressableNeedle)) throw new Error('word button render anchor not found');
s = s.replaceAll(
  wordPressableNeedle,
  'style={[styles.wordButton, playingWordKey === wordKey(word) && styles.wordButtonPlaying]}><Text style={[styles.wordButtonText, playingWordKey === wordKey(word) && styles.wordButtonTextPlaying,'
);

// Force ayah marker into LTR isolation so Arabic layout cannot mirror the decorative brackets.
s = s.replaceAll('}>﴿{ayah.ayah}﴾</Text>', '}>{"\\u2066﴿" + ayah.ayah + "﴾\\u2069"}</Text>');

// Add visual states without changing the existing card palette/layout.
const styleAnchor = '  wordButton: {';
if (!s.includes(styleAnchor)) throw new Error('wordButton style anchor not found');
if (!s.includes('wordButtonPlaying:')) {
  s = s.replace(styleAnchor,
`  wordButtonPlaying: { backgroundColor: "#f4d76c", borderColor: "#c89a24", borderWidth: 1, borderRadius: 10, paddingHorizontal: 4 },
  wordButtonTextPlaying: { color: "#133f34", fontWeight: "900" },
${styleAnchor}`);
}

const ayahStyleRegex = /  ayahNumber: \{([^}]*)\}/;
if (!ayahStyleRegex.test(s)) throw new Error('ayahNumber style not found');
s = s.replace(ayahStyleRegex, (_m, body) => `  ayahNumber: {${body}, writingDirection: "ltr", textAlign: "left" }`);

fs.writeFileSync(path, s);
console.log('Applied study-card polish: Bismillah removed, ayah brackets fixed, active word highlighted');
