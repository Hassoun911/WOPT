import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Modal,
  PermissionsAndroid,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import QuranAudio from "../../modules/quran-audio";
import QuranSpeech, { type QuranSpeechStatus } from "../../modules/quran-speech";
import BrandMark from "../BrandMark";
import {
  absoluteIndex,
  allSurahs,
  getAyah,
  getSurah,
  getSurahAyahs,
  type QuranAyah,
  type QuranLocale
} from "./quranData";

type Range = { surah: number; start: number; end: number };
type CardMode = "smart" | "ayah" | "line" | "word";
type TrainingMode = "listen" | "repeat" | "words" | "hide" | "speak" | "weak";
type WordStatus = "correct" | "uncertain" | "incorrect";

type LessonWord = {
  text: string;
  normalized: string;
  surah: number;
  ayah: number;
  wordIndex: number;
};

type LessonCard = {
  id: string;
  label: string;
  ayahs: QuranAyah[];
  words: LessonWord[];
};

type Lesson = {
  id: string;
  title: string;
  sourceLabel: string;
  cardMode: CardMode;
  ayahs: QuranAyah[];
  cards: LessonCard[];
};

type Attempt = {
  id: string;
  lessonId: string;
  cardId: string;
  at: number;
  transcript: string;
  correct: number;
  uncertain: number;
  incorrect: number;
  total: number;
  percent: number;
  feedback: Array<{ word: string; status: WordStatus }>;
};

type Props = {
  locale: QuranLocale;
  initialRange?: Range | null;
  onBack: () => void;
};

const STORAGE_LESSON = "wopt:quran:smart-memorize:lesson:v1";
const STORAGE_ATTEMPTS = "wopt:quran:smart-memorize:attempts:v1";

function normalizeArabic(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, "")
    .replace(/[ٱأإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/ـ/g, "")
    .replace(/[^\u0621-\u063A\u0641-\u064A\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenizeAyah(ayah: QuranAyah): LessonWord[] {
  const tokens = ayah.text
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean)
    .filter((token) => /[\u0621-\u064Aٱ]/.test(token));

  return tokens.map((text, index) => ({
    text,
    normalized: normalizeArabic(text),
    surah: ayah.surah,
    ayah: ayah.ayah,
    wordIndex: index + 1
  })).filter((word) => word.normalized.length > 0);
}

function pad3(value: number) {
  return String(value).padStart(3, "0");
}

function wordAudioUrl(word: LessonWord) {
  return `https://audio.qurancdn.com/wbw/${pad3(word.surah)}_${pad3(word.ayah)}_${pad3(word.wordIndex)}.mp3`;
}

function ayahAudioUrl(ayah: QuranAyah, reciter = "ar.alafasy", bitrate = 128) {
  return `https://cdn.islamic.network/quran/audio/${bitrate}/${reciter}/${absoluteIndex(ayah.surah, ayah.ayah) + 1}.mp3`;
}

function createCards(ayahs: QuranAyah[], mode: CardMode): LessonCard[] {
  const cards: LessonCard[] = [];
  for (const ayah of ayahs) {
    const words = tokenizeAyah(ayah);
    if (!words.length) continue;

    if (mode === "word") {
      words.forEach((word, index) => cards.push({
        id: `${ayah.surah}:${ayah.ayah}:w${index + 1}`,
        label: `Word ${index + 1}`,
        ayahs: [ayah],
        words: [word]
      }));
      continue;
    }

    if (mode === "ayah") {
      cards.push({ id: `${ayah.surah}:${ayah.ayah}`, label: `Ayah ${ayah.ayah}`, ayahs: [ayah], words });
      continue;
    }

    const chunkSize = mode === "line" ? 7 : words.length <= 10 ? words.length : 6;
    for (let start = 0; start < words.length; start += chunkSize) {
      const chunk = words.slice(start, start + chunkSize);
      cards.push({
        id: `${ayah.surah}:${ayah.ayah}:${start}`,
        label: mode === "line" ? `Line ${Math.floor(start / chunkSize) + 1}` : `Part ${Math.floor(start / chunkSize) + 1}`,
        ayahs: [ayah],
        words: chunk
      });
    }
  }
  return cards;
}

function buildLesson(ayahs: QuranAyah[], mode: CardMode, sourceLabel: string): Lesson | null {
  if (!ayahs.length) return null;
  const first = ayahs[0]!;
  const last = ayahs[ayahs.length - 1]!;
  const surah = getSurah(first.surah);
  const title = first.surah === last.surah
    ? `${surah?.nameArabic ?? ""} ${first.ayah === last.ayah ? first.ayah : `${first.ayah}–${last.ayah}`}`
    : `${first.surah}:${first.ayah} – ${last.surah}:${last.ayah}`;
  return {
    id: `${first.surah}:${first.ayah}-${last.surah}:${last.ayah}-${mode}`,
    title,
    sourceLabel,
    cardMode: mode,
    ayahs,
    cards: createCards(ayahs, mode)
  };
}

function findImportedAyahs(text: string): QuranAyah[] {
  const target = normalizeArabic(text);
  if (target.length < 3) return [];

  for (const surah of allSurahs()) {
    const ayahs = getSurahAyahs(surah.number);
    const normalized = ayahs.map((ayah) => normalizeArabic(ayah.text));
    const starts: number[] = [];
    let joined = "";
    normalized.forEach((part, index) => {
      starts[index] = joined.length;
      joined += (index ? " " : "") + part;
    });
    const found = joined.indexOf(target);
    if (found < 0) continue;
    const end = found + target.length;
    let first = 0;
    let last = normalized.length - 1;
    for (let i = 0; i < normalized.length; i += 1) {
      const start = starts[i] ?? 0;
      const nextStart = i + 1 < normalized.length ? (starts[i + 1] ?? joined.length) : joined.length;
      if (found >= start && found < nextStart) first = i;
      if (end > start) last = i;
      if (start > end) break;
    }
    return ayahs.slice(first, last + 1);
  }
  return [];
}

function editDistance(a: string, b: string) {
  const previous = Array.from({ length: b.length + 1 }, (_v, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    const current = [i];
    for (let j = 1; j <= b.length; j += 1) {
      current[j] = Math.min(
        (current[j - 1] ?? 0) + 1,
        (previous[j] ?? 0) + 1,
        (previous[j - 1] ?? 0) + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
    for (let j = 0; j < current.length; j += 1) previous[j] = current[j] ?? 0;
  }
  return previous[b.length] ?? Math.max(a.length, b.length);
}

function wordSimilarity(a: string, b: string) {
  if (!a && !b) return 1;
  const length = Math.max(a.length, b.length, 1);
  return 1 - editDistance(a, b) / length;
}

function scoreRecitation(expected: LessonWord[], transcript: string) {
  const spoken = normalizeArabic(transcript).split(" ").filter(Boolean);
  const n = expected.length;
  const m = spoken.length;
  const dp = Array.from({ length: n + 1 }, () => Array(m + 1).fill(0));
  for (let i = 0; i <= n; i += 1) dp[i]![0] = i;
  for (let j = 0; j <= m; j += 1) dp[0]![j] = j;
  for (let i = 1; i <= n; i += 1) {
    for (let j = 1; j <= m; j += 1) {
      const cost = expected[i - 1]!.normalized === spoken[j - 1] ? 0 : 1;
      dp[i]![j] = Math.min(dp[i - 1]![j]! + 1, dp[i]![j - 1]! + 1, dp[i - 1]![j - 1]! + cost);
    }
  }

  const feedback: Array<{ word: string; status: WordStatus }> = [];
  let i = n;
  let j = m;
  const reverse: Array<{ index: number; status: WordStatus }> = [];
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0) {
      const expectedWord = expected[i - 1]!;
      const spokenWord = spoken[j - 1] ?? "";
      const substitution = dp[i - 1]![j - 1]! + (expectedWord.normalized === spokenWord ? 0 : 1);
      if (dp[i]![j] === substitution) {
        const similarity = wordSimilarity(expectedWord.normalized, spokenWord);
        reverse.push({ index: i - 1, status: similarity === 1 ? "correct" : similarity >= 0.72 ? "uncertain" : "incorrect" });
        i -= 1;
        j -= 1;
        continue;
      }
    }
    if (i > 0 && dp[i]![j] === dp[i - 1]![j]! + 1) {
      reverse.push({ index: i - 1, status: "incorrect" });
      i -= 1;
      continue;
    }
    if (j > 0) j -= 1;
  }

  const statusByIndex = new Map(reverse.map((item) => [item.index, item.status]));
  expected.forEach((word, index) => feedback.push({ word: word.text, status: statusByIndex.get(index) ?? "incorrect" }));
  const correct = feedback.filter((item) => item.status === "correct").length;
  const uncertain = feedback.filter((item) => item.status === "uncertain").length;
  const incorrect = feedback.length - correct - uncertain;
  return { feedback, correct, uncertain, incorrect, total: feedback.length, percent: feedback.length ? Math.round((correct / feedback.length) * 100) : 0 };
}

function encouragement(current: Attempt, previous?: Attempt) {
  if (current.percent >= 95) return "🏆 Masha’Allah — excellent recall!";
  if (previous && current.percent > previous.percent) return `🌟 Masha’Allah — you improved by ${current.percent - previous.percent}%!`;
  if (current.percent >= 80) return "💚 Great effort — one more round can make this strong.";
  if (current.percent >= 60) return "📈 You’re building it. Review the red words and try again.";
  return "🌱 Keep going — listen once, then try the line again.";
}

const TIPS = [
  "🎧 Listen before reading the card aloud.",
  "🔁 Repeat one short phrase several times before adding more.",
  "🙈 Hide the Arabic and recite from memory, then reveal it.",
  "🔗 Link the last words of one card to the first words of the next.",
  "⏱️ Review after a short break, then again the next day.",
  "🐢 Use slower recitation while learning difficult phrases.",
  "🎯 Practice red/weak words individually before repeating the full card.",
  "📿 Review yesterday’s lesson before adding new material."
];

export default function SmartMemorize({ locale, initialRange, onBack }: Props) {
  const ar = locale === "ar";
  const t = (en: string, arabic: string) => ar ? arabic : en;
  const num = (value: number) => ar ? new Intl.NumberFormat("ar").format(value) : String(value);

  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [cardIndex, setCardIndex] = useState(0);
  const [trainingMode, setTrainingMode] = useState<TrainingMode>("listen");
  const [hidden, setHidden] = useState(false);
  const [tipsOpen, setTipsOpen] = useState(false);
  const [setupOpen, setSetupOpen] = useState(false);
  const [cardMode, setCardMode] = useState<CardMode>("smart");
  const [sourceSurah, setSourceSurah] = useState(initialRange?.surah ?? 1);
  const [rangeStart, setRangeStart] = useState(String(initialRange?.start ?? 1));
  const [rangeEnd, setRangeEnd] = useState(String(initialRange?.end ?? 1));
  const [pastedText, setPastedText] = useState("");
  const [feedback, setFeedback] = useState<Array<{ word: string; status: WordStatus }> | null>(null);
  const [lastAttempt, setLastAttempt] = useState<Attempt | null>(null);
  const [speechStatus, setSpeechStatus] = useState<QuranSpeechStatus>({ available: Boolean(QuranSpeech), state: "idle", transcript: "", partialTranscript: "" });
  const processedTranscript = useRef("");

  const [audioQueue, setAudioQueue] = useState<string[]>([]);
  const [audioIndex, setAudioIndex] = useState(-1);
  const [audioRepeats, setAudioRepeats] = useState(1);
  const [audioRound, setAudioRound] = useState(1);
  const [audioLoop, setAudioLoop] = useState(false);
  const audioCompletion = useRef<string | null>(null);

  const currentCard = lesson?.cards[cardIndex];
  const lessonAttempts = useMemo(() => lesson ? attempts.filter((item) => item.lessonId === lesson.id) : [], [attempts, lesson]);
  const currentCardAttempts = useMemo(() => currentCard ? lessonAttempts.filter((item) => item.cardId === currentCard.id) : [], [lessonAttempts, currentCard]);
  const bestScore = currentCardAttempts.reduce((best, item) => Math.max(best, item.percent), 0);
  const weakWords = useMemo(() => {
    const counts = new Map<string, number>();
    lessonAttempts.forEach((attempt) => attempt.feedback.forEach((item) => {
      if (item.status !== "correct") counts.set(item.word, (counts.get(item.word) ?? 0) + 1);
    }));
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20);
  }, [lessonAttempts]);

  useEffect(() => {
    void (async () => {
      try {
        const [savedLesson, savedAttempts] = await Promise.all([
          AsyncStorage.getItem(STORAGE_LESSON),
          AsyncStorage.getItem(STORAGE_ATTEMPTS)
        ]);
        if (savedLesson) setLesson(JSON.parse(savedLesson) as Lesson);
        if (savedAttempts) setAttempts(JSON.parse(savedAttempts) as Attempt[]);
      } catch {}
    })();
  }, []);

  useEffect(() => {
    if (!initialRange) return;
    const ayahs = getSurahAyahs(initialRange.surah).slice(initialRange.start - 1, initialRange.end);
    const next = buildLesson(ayahs, cardMode, t("Selected Qur’an passage", "المقطع المحدد من القرآن"));
    if (!next) return;
    setLesson(next);
    setCardIndex(0);
    setFeedback(null);
    void AsyncStorage.setItem(STORAGE_LESSON, JSON.stringify(next));
  }, [initialRange?.surah, initialRange?.start, initialRange?.end]);

  useEffect(() => {
    const timer = setInterval(() => {
      if (QuranAudio && audioIndex >= 0) {
        const status = QuranAudio.getStatus();
        if (status.state === "completed" && status.url && audioCompletion.current !== status.url) {
          audioCompletion.current = status.url;
          const nextIndex = audioIndex + 1;
          if (nextIndex < audioQueue.length) {
            setAudioIndex(nextIndex);
            void QuranAudio.play(audioQueue[nextIndex]!, 1);
          } else if (audioLoop || audioRound < audioRepeats) {
            setAudioRound((round) => round + 1);
            setAudioIndex(0);
            void QuranAudio.play(audioQueue[0]!, 1);
          } else {
            setAudioIndex(-1);
            setAudioQueue([]);
          }
        }
      }

      if (QuranSpeech && (speechStatus.state === "listening" || speechStatus.state === "processing")) {
        const status = QuranSpeech.getStatus();
        setSpeechStatus(status);
        if (status.state === "done" && status.transcript && status.transcript !== processedTranscript.current) {
          processedTranscript.current = status.transcript;
          if (currentCard) saveScoredAttempt(currentCard, status.transcript);
        }
      }
    }, 350);
    return () => clearInterval(timer);
  }, [audioIndex, audioQueue, audioLoop, audioRepeats, audioRound, speechStatus.state, currentCard?.id]);

  const saveLesson = (next: Lesson) => {
    setLesson(next);
    setCardIndex(0);
    setFeedback(null);
    setLastAttempt(null);
    setSetupOpen(false);
    void AsyncStorage.setItem(STORAGE_LESSON, JSON.stringify(next));
  };

  const makeRangeLesson = (wholeSurah = false) => {
    const surah = getSurah(sourceSurah);
    if (!surah) return;
    const start = wholeSurah ? 1 : Math.max(1, Math.min(Number(rangeStart) || 1, surah.ayahCount));
    const end = wholeSurah ? surah.ayahCount : Math.max(start, Math.min(Number(rangeEnd) || start, surah.ayahCount));
    const ayahs = getSurahAyahs(sourceSurah).slice(start - 1, end);
    const next = buildLesson(ayahs, cardMode, wholeSurah ? t("Entire Surah", "السورة كاملة") : t("Ayah range", "نطاق آيات"));
    if (next) saveLesson(next);
  };

  const importPasted = () => {
    const ayahs = findImportedAyahs(pastedText);
    if (!ayahs.length) {
      Alert.alert(
        t("Qur’an match not confirmed", "لم يتم تأكيد مطابقة النص"),
        t("Hassoun could not confidently match this pasted text to the verified Qur’an. It will not silently treat unmatched text as Qur’an.", "لم يتمكن Hassoun من مطابقة النص بثقة مع القرآن الموثق، لذلك لن يعامل النص غير المطابق على أنه قرآن.")
      );
      return;
    }
    const next = buildLesson(ayahs, cardMode, t("Imported & verified Qur’an text", "نص قرآني مستورد وتم التحقق منه"));
    if (next) saveLesson(next);
  };

  const rebuildCards = (mode: CardMode) => {
    setCardMode(mode);
    if (!lesson) return;
    const next = { ...lesson, cardMode: mode, cards: createCards(lesson.ayahs, mode) };
    saveLesson(next);
  };

  const playUrls = (urls: string[], repeats = 1, loop = false, speed = 1) => {
    if (!QuranAudio || !urls.length) return;
    QuranSpeech?.cancel();
    setAudioQueue(urls);
    setAudioIndex(0);
    setAudioRepeats(Math.max(1, repeats));
    setAudioRound(1);
    setAudioLoop(loop);
    audioCompletion.current = null;
    void QuranAudio.play(urls[0]!, speed);
  };

  const playCard = (card: LessonCard, repeats = 1, loop = false, slow = false) => {
    const isFullAyah = card.ayahs.length === 1 && card.words.length === tokenizeAyah(card.ayahs[0]!).length;
    const urls = isFullAyah
      ? [ayahAudioUrl(card.ayahs[0]!)]
      : card.words.map(wordAudioUrl);
    playUrls(urls, repeats, loop, slow ? 0.75 : 1);
  };

  const playWholeLesson = () => {
    if (!lesson) return;
    playUrls(lesson.ayahs.map((ayah) => ayahAudioUrl(ayah)), 1, false, 1);
  };

  const startSpeech = async () => {
    if (!QuranSpeech || !currentCard) {
      Alert.alert(t("Speech check unavailable", "فحص التلاوة غير متاح"), t("This Android build does not contain the speech-recognition module.", "هذا الإصدار لا يحتوي على وحدة التعرف على الصوت."));
      return;
    }
    if (Platform.OS === "android") {
      const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO, {
        title: t("Microphone for memorization", "الميكروفون للحفظ"),
        message: t("Hassoun uses the microphone only when you tap Speak & Check so it can compare your recitation with the selected Qur’an words.", "يستخدم Hassoun الميكروفون فقط عند الضغط على التلاوة والفحص لمقارنة تلاوتك بكلمات القرآن المحددة."),
        buttonPositive: t("Allow", "سماح"),
        buttonNegative: t("Not now", "ليس الآن")
      });
      if (result !== PermissionsAndroid.RESULTS.GRANTED) return;
    }
    QuranAudio?.stop();
    processedTranscript.current = "";
    setFeedback(null);
    setLastAttempt(null);
    await QuranSpeech.start("ar-SA");
    setSpeechStatus({ available: true, state: "listening", transcript: "", partialTranscript: "" });
  };

  const stopSpeech = () => {
    QuranSpeech?.stop();
    setSpeechStatus((status) => ({ ...status, state: "processing" }));
  };

  const saveScoredAttempt = (card: LessonCard, transcript: string) => {
    const scored = scoreRecitation(card.words, transcript);
    const attempt: Attempt = {
      id: `${Date.now()}`,
      lessonId: lesson?.id ?? "lesson",
      cardId: card.id,
      at: Date.now(),
      transcript,
      ...scored
    };
    const nextAttempts = [attempt, ...attempts].slice(0, 500);
    setAttempts(nextAttempts);
    setFeedback(scored.feedback);
    setLastAttempt(attempt);
    setSpeechStatus((status) => ({ ...status, state: "done", transcript }));
    void AsyncStorage.setItem(STORAGE_ATTEMPTS, JSON.stringify(nextAttempts));
  };

  const splitCurrentCard = () => {
    if (!lesson || !currentCard || currentCard.words.length < 2) return;
    const midpoint = Math.ceil(currentCard.words.length / 2);
    const first: LessonCard = { ...currentCard, id: `${currentCard.id}:a`, label: `${currentCard.label} A`, words: currentCard.words.slice(0, midpoint) };
    const second: LessonCard = { ...currentCard, id: `${currentCard.id}:b`, label: `${currentCard.label} B`, words: currentCard.words.slice(midpoint) };
    const cards = [...lesson.cards];
    cards.splice(cardIndex, 1, first, second);
    saveLesson({ ...lesson, cards });
  };

  const mergeNextCard = () => {
    if (!lesson || !currentCard || cardIndex >= lesson.cards.length - 1) return;
    const nextCard = lesson.cards[cardIndex + 1]!;
    const merged: LessonCard = {
      id: `${currentCard.id}+${nextCard.id}`,
      label: `${currentCard.label} + ${nextCard.label}`,
      ayahs: [...currentCard.ayahs, ...nextCard.ayahs.filter((ayah) => !currentCard.ayahs.some((existing) => existing.surah === ayah.surah && existing.ayah === ayah.ayah))],
      words: [...currentCard.words, ...nextCard.words]
    };
    const cards = [...lesson.cards];
    cards.splice(cardIndex, 2, merged);
    saveLesson({ ...lesson, cards });
  };

  const statusForWord = (index: number): WordStatus | null => feedback?.[index]?.status ?? null;
  const previousAttempt = currentCardAttempts.find((attempt) => attempt.id !== lastAttempt?.id);

  const setup = (
    <ScrollView contentContainerStyle={styles.setupContent} showsVerticalScrollIndicator={false}>
      <View style={styles.headerRow}>
        <Pressable onPress={lesson ? () => setSetupOpen(false) : onBack} style={styles.roundButton}><Text style={styles.backText}>{ar ? "›" : "‹"}</Text></Pressable>
        <BrandMark size={40} />
        <View style={styles.flex}><Text style={[styles.eyebrow, ar && styles.rtl]}>HASSOUN • {t("SMART MEMORIZE", "الحفظ الذكي")}</Text><Text style={[styles.title, ar && styles.rtl]}>{t("Create a lesson", "أنشئ درس حفظ")}</Text></View>
        <Pressable onPress={() => setTipsOpen(true)} style={styles.tipButton}><Text style={styles.tipButtonText}>💡</Text></Pressable>
      </View>

      <Text style={[styles.helper, ar && styles.rtl]}>{t("Choose a Surah/range or paste Qur’an text. Pasted text is matched back to Hassoun’s verified Qur’an before it becomes a lesson.", "اختر سورة أو نطاق آيات أو الصق نصاً قرآنياً. يتم مطابقة النص مع القرآن الموثق قبل تحويله إلى درس.")}</Text>

      <View style={styles.panel}>
        <Text style={[styles.panelTitle, ar && styles.rtl]}>🕋 {t("Choose from Qur’an", "اختر من القرآن")}</Text>
        <View style={styles.surahStepper}>
          <Pressable onPress={() => setSourceSurah((value) => Math.max(1, value - 1))} style={styles.stepButton}><Text style={styles.stepText}>−</Text></Pressable>
          <View style={styles.flex}><Text style={styles.surahName}>{getSurah(sourceSurah)?.nameArabic}</Text><Text style={styles.surahMeta}>{t(`Surah ${sourceSurah}`, `سورة ${num(sourceSurah)}`)}</Text></View>
          <Pressable onPress={() => setSourceSurah((value) => Math.min(114, value + 1))} style={styles.stepButton}><Text style={styles.stepText}>+</Text></Pressable>
        </View>
        <View style={styles.rangeRow}>
          <View style={styles.inputGroup}><Text style={styles.inputLabel}>{t("From ayah", "من آية")}</Text><TextInput value={rangeStart} onChangeText={setRangeStart} keyboardType="number-pad" style={styles.numberInput} /></View>
          <View style={styles.inputGroup}><Text style={styles.inputLabel}>{t("To ayah", "إلى آية")}</Text><TextInput value={rangeEnd} onChangeText={setRangeEnd} keyboardType="number-pad" style={styles.numberInput} /></View>
        </View>
        <View style={styles.actionRow}><Pressable onPress={() => makeRangeLesson(false)} style={styles.primary}><Text style={styles.primaryText}>📖 {t("Use range", "استخدم النطاق")}</Text></Pressable><Pressable onPress={() => makeRangeLesson(true)} style={styles.secondary}><Text style={styles.secondaryText}>🌙 {t("Whole Surah", "السورة كاملة")}</Text></Pressable></View>
      </View>

      <View style={styles.panel}>
        <Text style={[styles.panelTitle, ar && styles.rtl]}>📥 {t("Paste / import Qur’an text", "لصق / استيراد نص قرآني")}</Text>
        <TextInput value={pastedText} onChangeText={setPastedText} multiline placeholder={t("Paste an ayah or passage here…", "الصق آية أو مقطعاً هنا…")} placeholderTextColor="#9aa29e" style={[styles.pasteInput, ar && styles.rtl]} />
        <Pressable onPress={importPasted} style={styles.verifyButton}><Text style={styles.verifyButtonText}>✓ {t("Verify & create lesson", "تحقق وأنشئ الدرس")}</Text></Pressable>
      </View>

      <Text style={[styles.sectionLabel, ar && styles.rtl]}>{t("HOW SHOULD Hassoun BREAK IT INTO CARDS?", "كيف يقسم Hassoun الدرس إلى بطاقات؟")}</Text>
      <View style={styles.modeGrid}>{([
        ["smart", "✨", t("Smart", "ذكي")],
        ["ayah", "☪️", t("Ayah", "آية")],
        ["line", "📖", t("Line", "سطر")],
        ["word", "🔤", t("Word", "كلمة")]
      ] as Array<[CardMode, string, string]>).map(([mode, icon, label]) => <Pressable key={mode} onPress={() => setCardMode(mode)} style={[styles.modeCard, cardMode === mode && styles.modeCardActive]}><Text style={styles.modeIcon}>{icon}</Text><Text style={[styles.modeText, cardMode === mode && styles.modeTextActive]}>{label}</Text></Pressable>)}</View>
    </ScrollView>
  );

  if (!lesson || setupOpen) {
    return <View style={styles.flex}>{setup}</View>;
  }

  const card = currentCard;
  if (!card) return <View style={styles.flex}>{setup}</View>;

  return (
    <View style={styles.flex}>
      <ScrollView contentContainerStyle={styles.lessonContent} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <Pressable onPress={onBack} style={styles.roundButton}><Text style={styles.backText}>{ar ? "›" : "‹"}</Text></Pressable>
          <BrandMark size={40} />
          <View style={styles.flex}><Text style={[styles.eyebrow, ar && styles.rtl]}>HASSOUN • {t("SMART MEMORIZE", "الحفظ الذكي")}</Text><Text style={[styles.lessonTitle, ar && styles.rtl]}>{lesson.title}</Text><Text style={[styles.lessonMeta, ar && styles.rtl]}>{lesson.sourceLabel} • {num(lesson.cards.length)} {t("cards", "بطاقات")}</Text></View>
          <Pressable onPress={() => setTipsOpen(true)} style={styles.tipButton}><Text style={styles.tipButtonText}>💡</Text></Pressable>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.stat}><Text style={styles.statValue}>{num(cardIndex + 1)}/{num(lesson.cards.length)}</Text><Text style={styles.statLabel}>{t("Card", "البطاقة")}</Text></View>
          <View style={styles.stat}><Text style={styles.statValue}>{num(bestScore)}%</Text><Text style={styles.statLabel}>{t("Best", "الأفضل")}</Text></View>
          <View style={styles.stat}><Text style={styles.statValue}>{num(lessonAttempts.length)}</Text><Text style={styles.statLabel}>{t("Attempts", "المحاولات")}</Text></View>
          <View style={styles.stat}><Text style={styles.statValue}>{num(weakWords.length)}</Text><Text style={styles.statLabel}>{t("Weak words", "كلمات للمراجعة")}</Text></View>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.trainingRow}>{([
          ["listen", "🎧", t("Listen", "استمع")],
          ["repeat", "🔁", t("Repeat", "كرر")],
          ["words", "🔤", t("Words", "كلمات")],
          ["hide", "🙈", t("Hide", "إخفاء")],
          ["speak", "🎙️", t("Speak & Check", "تلاوة وفحص")],
          ["weak", "🎯", t("Weak words", "الكلمات الضعيفة")]
        ] as Array<[TrainingMode, string, string]>).map(([mode, icon, label]) => <Pressable key={mode} onPress={() => { setTrainingMode(mode); if (mode === "hide") setHidden(true); else if (mode !== "speak") setHidden(false); }} style={[styles.trainingChip, trainingMode === mode && styles.trainingChipActive]}><Text style={styles.trainingIcon}>{icon}</Text><Text style={[styles.trainingText, trainingMode === mode && styles.trainingTextActive]}>{label}</Text></Pressable>)}</ScrollView>

        {trainingMode === "weak" ? (
          <View style={styles.panel}>
            <Text style={[styles.panelTitle, ar && styles.rtl]}>🎯 {t("Words to review", "كلمات تحتاج مراجعة")}</Text>
            {weakWords.length ? <View style={styles.weakWrap}>{weakWords.map(([word, count]) => <View key={word} style={styles.weakChip}><Text style={styles.weakWord}>{word}</Text><Text style={styles.weakCount}>×{count}</Text></View>)}</View> : <Text style={styles.helper}>{t("Complete a Speak & Check attempt and Hassoun will collect the words that need more practice.", "أكمل محاولة تلاوة وفحص وسيجمع Hassoun الكلمات التي تحتاج إلى تدريب إضافي.")}</Text>}
          </View>
        ) : (
          <View style={styles.lessonCard}>
            <View style={styles.cardTop}><View><Text style={styles.cardEyebrow}>{t("CARD", "بطاقة")} {num(cardIndex + 1)}</Text><Text style={styles.cardLabel}>{card.label}</Text></View><View style={styles.cardTools}><Pressable onPress={splitCurrentCard} style={styles.toolPill}><Text style={styles.toolText}>✂️</Text></Pressable><Pressable onPress={mergeNextCard} style={styles.toolPill}><Text style={styles.toolText}>🔗</Text></Pressable></View></View>

            {hidden || trainingMode === "hide" ? (
              <Pressable onPress={() => setHidden((value) => !value)} style={styles.hiddenBox}><Text style={styles.hiddenDots}>••••••••••••••</Text><Text style={styles.hiddenHint}>👁️ {t("Tap to reveal", "اضغط للإظهار")}</Text></Pressable>
            ) : (
              <View style={styles.wordsWrap}>{card.words.map((word, index) => {
                const status = statusForWord(index);
                return <Pressable key={`${word.surah}:${word.ayah}:${word.wordIndex}:${index}`} onPress={() => playUrls([wordAudioUrl(word)])} style={[styles.wordChip, status === "correct" && styles.wordCorrect, status === "uncertain" && styles.wordUncertain, status === "incorrect" && styles.wordIncorrect]}><Text style={[styles.wordText, status === "correct" && styles.wordTextCorrect, status === "uncertain" && styles.wordTextUncertain, status === "incorrect" && styles.wordTextIncorrect]}>{word.text}</Text></Pressable>;
              })}</View>
            )}

            <View style={styles.playGrid}>
              <Pressable onPress={() => playCard(card, 1)} style={styles.playAction}><Text style={styles.playIcon}>▶️</Text><Text style={styles.playLabel}>{t("Once", "مرة")}</Text></Pressable>
              <Pressable onPress={() => playCard(card, 3)} style={styles.playAction}><Text style={styles.playIcon}>3×</Text><Text style={styles.playLabel}>{t("Repeat", "تكرار")}</Text></Pressable>
              <Pressable onPress={() => playCard(card, 1, true)} style={styles.playAction}><Text style={styles.playIcon}>🔁</Text><Text style={styles.playLabel}>{t("Loop", "مستمر")}</Text></Pressable>
              <Pressable onPress={() => playCard(card, 1, false, true)} style={styles.playAction}><Text style={styles.playIcon}>🐢</Text><Text style={styles.playLabel}>{t("Slow", "بطيء")}</Text></Pressable>
            </View>

            {trainingMode === "words" ? <Text style={styles.wordHint}>👆 {t("Tap any word to hear it by itself.", "اضغط على أي كلمة لسماعها منفردة.")}</Text> : null}

            {trainingMode === "speak" ? (
              <View style={styles.speechPanel}>
                <Text style={styles.speechTitle}>🎙️ {t("Recite this card", "رتّل هذه البطاقة")}</Text>
                <Text style={styles.speechNote}>{t("Learning feedback only — this is not a religious ruling on Tajweed correctness.", "هذه ملاحظات تعليمية فقط وليست حكماً شرعياً على صحة أحكام التجويد.")}</Text>
                {speechStatus.state === "listening" ? <Pressable onPress={stopSpeech} style={styles.recordingButton}><Text style={styles.recordingText}>⏹️ {t("Finish reciting", "أنهِ التلاوة")}</Text></Pressable> : <Pressable onPress={startSpeech} style={styles.speakButton}><Text style={styles.speakButtonText}>🎤 {t("Start Speak & Check", "ابدأ التلاوة والفحص")}</Text></Pressable>}
                {speechStatus.state === "listening" ? <Text style={styles.liveText}>● {t("Listening…", "يستمع الآن…")} {speechStatus.partialTranscript}</Text> : null}
                {speechStatus.state === "processing" ? <Text style={styles.liveText}>⏳ {t("Checking your words…", "جارٍ فحص الكلمات…")}</Text> : null}
                {speechStatus.state === "error" ? <Text style={styles.errorText}>{speechStatus.error}</Text> : null}
                {lastAttempt ? <View style={styles.scoreBox}><Text style={styles.scoreBig}>{num(lastAttempt.correct)} / {num(lastAttempt.total)} {t("correct", "صحيحة")}</Text><Text style={styles.scoreWrong}>{num(lastAttempt.uncertain + lastAttempt.incorrect)} {t("to review", "للمراجعة")}</Text><Text style={styles.encouragement}>{encouragement(lastAttempt, previousAttempt)}</Text><Text style={styles.transcriptText}>{t("Heard:", "تم سماع:")} {lastAttempt.transcript}</Text></View> : null}
              </View>
            ) : null}
          </View>
        )}

        <View style={styles.cardNav}>
          <Pressable disabled={cardIndex === 0} onPress={() => { setCardIndex((index) => Math.max(0, index - 1)); setFeedback(null); setLastAttempt(null); }} style={[styles.navButton, cardIndex === 0 && styles.disabled]}><Text style={styles.navText}>‹ {t("Previous", "السابق")}</Text></Pressable>
          <Pressable onPress={playWholeLesson} style={styles.lessonPlay}><Text style={styles.lessonPlayText}>▶️ {t("Play lesson", "تشغيل الدرس")}</Text></Pressable>
          <Pressable disabled={cardIndex >= lesson.cards.length - 1} onPress={() => { setCardIndex((index) => Math.min(lesson.cards.length - 1, index + 1)); setFeedback(null); setLastAttempt(null); }} style={[styles.navButton, cardIndex >= lesson.cards.length - 1 && styles.disabled]}><Text style={styles.navText}>{t("Next", "التالي")} ›</Text></Pressable>
        </View>

        <View style={styles.panel}>
          <View style={styles.panelHeader}><Text style={[styles.panelTitle, ar && styles.rtl]}>✨ {t("Lesson setup", "إعداد الدرس")}</Text><Pressable onPress={() => setSetupOpen(true)} style={styles.newLessonPill}><Text style={styles.newLessonText}>＋ {t("New lesson", "درس جديد")}</Text></Pressable></View>
          <View style={styles.modeGrid}>{(["smart", "ayah", "line", "word"] as CardMode[]).map((mode) => <Pressable key={mode} onPress={() => rebuildCards(mode)} style={[styles.smallMode, lesson.cardMode === mode && styles.smallModeActive]}><Text style={[styles.smallModeText, lesson.cardMode === mode && styles.smallModeTextActive]}>{mode === "smart" ? `✨ ${t("Smart", "ذكي")}` : mode === "ayah" ? `☪️ ${t("Ayah", "آية")}` : mode === "line" ? `📖 ${t("Line", "سطر")}` : `🔤 ${t("Word", "كلمة")}`}</Text></Pressable>)}</View>
        </View>
      </ScrollView>

      <Modal visible={tipsOpen} transparent animationType="slide" onRequestClose={() => setTipsOpen(false)}>
        <View style={styles.modalShade}><View style={styles.tipsSheet}><View style={styles.sheetHeader}><Text style={styles.tipsTitle}>💡 {t("Memorization techniques", "تقنيات الحفظ")}</Text><Pressable onPress={() => setTipsOpen(false)} style={styles.closeButton}><Text style={styles.closeText}>×</Text></Pressable></View><ScrollView contentContainerStyle={styles.tipsList}>{TIPS.map((tip, index) => <View key={index} style={styles.tipRow}><Text style={[styles.tipText, ar && styles.rtl]}>{tip}</Text></View>)}</ScrollView></View></View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: "#f6f3eb" },
  rtl: { textAlign: "right", writingDirection: "rtl" },
  setupContent: { padding: 18, paddingBottom: 80 },
  lessonContent: { padding: 16, paddingBottom: 100 },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 13 },
  roundButton: { width: 42, height: 42, borderRadius: 15, backgroundColor: "#fff", borderWidth: 1, borderColor: "#e0ddd5", alignItems: "center", justifyContent: "center" },
  backText: { color: "#15483c", fontSize: 28, lineHeight: 30 },
  tipButton: { width: 44, height: 44, borderRadius: 15, backgroundColor: "#fff4cf", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#ead89b" },
  tipButtonText: { fontSize: 22 },
  eyebrow: { color: "#9a7a34", fontSize: 9, fontWeight: "900", letterSpacing: 1.3 },
  title: { color: "#173f35", fontSize: 27, fontWeight: "900", marginTop: 3 },
  lessonTitle: { color: "#173f35", fontSize: 21, fontWeight: "900", marginTop: 2 },
  lessonMeta: { color: "#7f8a85", fontSize: 9, marginTop: 2 },
  helper: { color: "#73807b", fontSize: 12, lineHeight: 18, marginBottom: 14 },
  panel: { backgroundColor: "#fff", borderRadius: 22, borderWidth: 1, borderColor: "#e0ddd5", padding: 15, marginBottom: 13 },
  panelHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10 },
  panelTitle: { color: "#173f35", fontSize: 15, fontWeight: "900", marginBottom: 11 },
  surahStepper: { flexDirection: "row", alignItems: "center", gap: 10, padding: 9, backgroundColor: "#f7f6f1", borderRadius: 17 },
  stepButton: { width: 40, height: 40, borderRadius: 13, backgroundColor: "#e8f3ee", alignItems: "center", justifyContent: "center" },
  stepText: { color: "#0b654f", fontSize: 23, fontWeight: "900" },
  surahName: { color: "#173f35", fontSize: 22, fontWeight: "800", textAlign: "center", writingDirection: "rtl" },
  surahMeta: { color: "#86918d", fontSize: 8, textAlign: "center", marginTop: 2 },
  rangeRow: { flexDirection: "row", gap: 10, marginTop: 12 },
  inputGroup: { flex: 1 },
  inputLabel: { color: "#6d7a75", fontSize: 9, fontWeight: "800", marginBottom: 5 },
  numberInput: { height: 46, borderRadius: 14, backgroundColor: "#f7f6f1", borderWidth: 1, borderColor: "#e3e0d8", paddingHorizontal: 12, color: "#173f35", fontWeight: "900", textAlign: "center" },
  actionRow: { flexDirection: "row", gap: 8, marginTop: 12 },
  primary: { flex: 1, minHeight: 46, borderRadius: 15, backgroundColor: "#0b654f", alignItems: "center", justifyContent: "center", paddingHorizontal: 12 },
  primaryText: { color: "#fff", fontSize: 11, fontWeight: "900" },
  secondary: { flex: 1, minHeight: 46, borderRadius: 15, backgroundColor: "#edf5f1", alignItems: "center", justifyContent: "center", paddingHorizontal: 12 },
  secondaryText: { color: "#0b654f", fontSize: 11, fontWeight: "900" },
  pasteInput: { minHeight: 120, borderRadius: 16, backgroundColor: "#f8f7f3", borderWidth: 1, borderColor: "#e2dfd7", padding: 12, color: "#203f37", fontSize: 18, lineHeight: 31, textAlignVertical: "top" },
  verifyButton: { marginTop: 10, minHeight: 45, borderRadius: 14, backgroundColor: "#e9f5ef", alignItems: "center", justifyContent: "center" },
  verifyButtonText: { color: "#0a6b52", fontSize: 11, fontWeight: "900" },
  sectionLabel: { color: "#8d743d", fontSize: 9, fontWeight: "900", letterSpacing: 1.1, marginTop: 3, marginBottom: 8 },
  modeGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  modeCard: { width: "48%", minHeight: 72, borderRadius: 18, backgroundColor: "#fff", borderWidth: 1, borderColor: "#e2dfd7", alignItems: "center", justifyContent: "center" },
  modeCardActive: { backgroundColor: "#e8f4ee", borderColor: "#0b7659" },
  modeIcon: { fontSize: 22 },
  modeText: { color: "#52635d", fontSize: 10, fontWeight: "900", marginTop: 4 },
  modeTextActive: { color: "#0b654f" },
  statsRow: { flexDirection: "row", gap: 6, marginBottom: 12 },
  stat: { flex: 1, minHeight: 62, borderRadius: 16, backgroundColor: "#fff", borderWidth: 1, borderColor: "#e4e1d9", alignItems: "center", justifyContent: "center", padding: 5 },
  statValue: { color: "#17483c", fontSize: 13, fontWeight: "900" },
  statLabel: { color: "#8a9490", fontSize: 7, marginTop: 3, textAlign: "center" },
  trainingRow: { gap: 7, paddingBottom: 12 },
  trainingChip: { minHeight: 46, borderRadius: 16, backgroundColor: "#fff", borderWidth: 1, borderColor: "#e1ded6", flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 11 },
  trainingChipActive: { backgroundColor: "#0b654f", borderColor: "#0b654f" },
  trainingIcon: { fontSize: 15 },
  trainingText: { color: "#56655f", fontSize: 9, fontWeight: "900" },
  trainingTextActive: { color: "#fff" },
  lessonCard: { backgroundColor: "#fffdf7", borderRadius: 25, borderWidth: 1, borderColor: "#ded7c8", padding: 16, shadowColor: "#7b6d52", shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: 5 }, elevation: 2 },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  cardEyebrow: { color: "#a38542", fontSize: 8, fontWeight: "900", letterSpacing: 1.2 },
  cardLabel: { color: "#173f35", fontSize: 14, fontWeight: "900", marginTop: 2 },
  cardTools: { flexDirection: "row", gap: 6 },
  toolPill: { width: 36, height: 36, borderRadius: 12, backgroundColor: "#f2efe7", alignItems: "center", justifyContent: "center" },
  toolText: { fontSize: 16 },
  wordsWrap: { flexDirection: "row-reverse", flexWrap: "wrap", justifyContent: "center", gap: 5, minHeight: 130, alignContent: "center", paddingVertical: 12 },
  wordChip: { borderRadius: 10, paddingHorizontal: 3, paddingVertical: 3 },
  wordText: { color: "#111", fontSize: 31, lineHeight: 49, writingDirection: "rtl", fontWeight: "500" },
  wordCorrect: { backgroundColor: "#e3f5e8" }, wordTextCorrect: { color: "#14733d" },
  wordUncertain: { backgroundColor: "#fff0c9" }, wordTextUncertain: { color: "#a56a00" },
  wordIncorrect: { backgroundColor: "#fde5e4" }, wordTextIncorrect: { color: "#c62828" },
  hiddenBox: { minHeight: 150, alignItems: "center", justifyContent: "center", borderRadius: 18, backgroundColor: "#f6f2e8", marginVertical: 5 },
  hiddenDots: { color: "#a19a88", fontSize: 28, letterSpacing: 4 },
  hiddenHint: { color: "#6d7b75", fontSize: 10, marginTop: 9, fontWeight: "800" },
  playGrid: { flexDirection: "row", gap: 7, marginTop: 14 },
  playAction: { flex: 1, minHeight: 62, borderRadius: 16, backgroundColor: "#f0f5f2", alignItems: "center", justifyContent: "center" },
  playIcon: { color: "#0b654f", fontSize: 16, fontWeight: "900" },
  playLabel: { color: "#466158", fontSize: 8, fontWeight: "900", marginTop: 4 },
  wordHint: { color: "#71807a", fontSize: 9, textAlign: "center", marginTop: 10 },
  speechPanel: { marginTop: 14, borderRadius: 18, backgroundColor: "#edf6f2", borderWidth: 1, borderColor: "#d4e9df", padding: 13 },
  speechTitle: { color: "#173f35", fontSize: 13, fontWeight: "900" },
  speechNote: { color: "#728079", fontSize: 8, lineHeight: 12, marginTop: 4 },
  speakButton: { minHeight: 48, borderRadius: 15, backgroundColor: "#0b654f", alignItems: "center", justifyContent: "center", marginTop: 11 },
  speakButtonText: { color: "#fff", fontSize: 11, fontWeight: "900" },
  recordingButton: { minHeight: 48, borderRadius: 15, backgroundColor: "#a93434", alignItems: "center", justifyContent: "center", marginTop: 11 },
  recordingText: { color: "#fff", fontSize: 11, fontWeight: "900" },
  liveText: { color: "#0a6b52", fontSize: 10, fontWeight: "800", marginTop: 9 },
  errorText: { color: "#b02b2b", fontSize: 9, marginTop: 8 },
  scoreBox: { marginTop: 11, borderRadius: 16, backgroundColor: "#fff", padding: 12 },
  scoreBig: { color: "#0b654f", fontSize: 20, fontWeight: "900" },
  scoreWrong: { color: "#b34a39", fontSize: 10, fontWeight: "900", marginTop: 2 },
  encouragement: { color: "#4c5f58", fontSize: 11, lineHeight: 16, fontWeight: "800", marginTop: 8 },
  transcriptText: { color: "#88928e", fontSize: 8, lineHeight: 12, marginTop: 7 },
  cardNav: { flexDirection: "row", alignItems: "center", gap: 7, marginTop: 12, marginBottom: 13 },
  navButton: { flex: 1, minHeight: 46, borderRadius: 15, backgroundColor: "#fff", borderWidth: 1, borderColor: "#e1ded6", alignItems: "center", justifyContent: "center" },
  navText: { color: "#31574d", fontSize: 9, fontWeight: "900" },
  lessonPlay: { flex: 1.15, minHeight: 46, borderRadius: 15, backgroundColor: "#0b654f", alignItems: "center", justifyContent: "center" },
  lessonPlayText: { color: "#fff", fontSize: 9, fontWeight: "900" },
  disabled: { opacity: 0.35 },
  newLessonPill: { borderRadius: 99, backgroundColor: "#edf5f1", paddingHorizontal: 10, paddingVertical: 7 },
  newLessonText: { color: "#0b654f", fontSize: 8, fontWeight: "900" },
  smallMode: { width: "48%", minHeight: 37, borderRadius: 12, backgroundColor: "#f7f6f1", alignItems: "center", justifyContent: "center" },
  smallModeActive: { backgroundColor: "#dff0e8" },
  smallModeText: { color: "#6b7873", fontSize: 8, fontWeight: "800" },
  smallModeTextActive: { color: "#0b654f" },
  weakWrap: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 7 },
  weakChip: { flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 12, backgroundColor: "#fde9e5", paddingHorizontal: 9, paddingVertical: 7 },
  weakWord: { color: "#a52e2e", fontSize: 18, writingDirection: "rtl" },
  weakCount: { color: "#ba5a4b", fontSize: 8, fontWeight: "900" },
  modalShade: { flex: 1, backgroundColor: "rgba(0,0,0,.42)", justifyContent: "flex-end" },
  tipsSheet: { maxHeight: "78%", backgroundColor: "#fbfaf7", borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: "hidden" },
  sheetHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 18, borderBottomWidth: 1, borderBottomColor: "#e6e2da" },
  tipsTitle: { color: "#173f35", fontSize: 18, fontWeight: "900" },
  closeButton: { width: 36, height: 36, borderRadius: 13, backgroundColor: "#eeece6", alignItems: "center", justifyContent: "center" },
  closeText: { color: "#475b54", fontSize: 22 },
  tipsList: { padding: 16, paddingBottom: 28 },
  tipRow: { borderRadius: 17, backgroundColor: "#fff", borderWidth: 1, borderColor: "#e4e1d9", padding: 13, marginBottom: 8 },
  tipText: { color: "#3f5a52", fontSize: 12, lineHeight: 18, fontWeight: "700" }
});
