import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  PermissionsAndroid,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View
} from "react-native";
import QuranAudio from "../../modules/quran-audio";
import QuranSpeech, { type QuranSpeechStatus } from "../../modules/quran-speech";
import BrandMark from "../BrandMark";
import {
  absoluteIndex,
  allPages,
  allSurahs,
  ayahsInRange,
  getSurah,
  getSurahAyahs,
  pageForAyah,
  type QuranAyah,
  type QuranLocale
} from "./quranData";
import { QuranPageText, useQuranAppearance } from "./quranRendering";

type Range = { surah: number; start: number; end: number };
type SourceMode = "range" | "surah" | "page" | "paste";
type TestScope = "card" | "lesson" | null;
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
  title: string;
  ayahs: QuranAyah[];
  words: LessonWord[];
};

type Lesson = {
  id: string;
  title: string;
  sourceLabel: string;
  ayahs: QuranAyah[];
  cards: LessonCard[];
  createdAt: number;
  updatedAt: number;
  currentCard: number;
  tajweed: boolean;
};

type Attempt = {
  id: string;
  lessonId: string;
  cardId: string;
  scope: "card" | "lesson";
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

const LESSONS_KEY = "wopt:quran:al-hafiz:lessons:v2";
const ATTEMPTS_KEY = "wopt:quran:al-hafiz:attempts:v2";
const ACTIVE_KEY = "wopt:quran:al-hafiz:active:v2";
const OLD_LESSON_KEY = "wopt:quran:smart-memorize:lesson:v1";
const OLD_ATTEMPTS_KEY = "wopt:quran:smart-memorize:attempts:v1";

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

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
  return ayah.text
    .split(/\s+/)
    .map((text) => text.trim())
    .filter(Boolean)
    .filter((text) => /[\u0621-\u064Aٱ]/.test(text))
    .map((text, index) => ({ text, normalized: normalizeArabic(text), surah: ayah.surah, ayah: ayah.ayah, wordIndex: index + 1 }))
    .filter((word) => word.normalized.length > 0);
}

function lessonWords(ayahs: QuranAyah[]) {
  return ayahs.flatMap(tokenizeAyah);
}

function makeBalancedCards(ayahs: QuranAyah[]) {
  if (!ayahs.length) return [] as LessonCard[];
  const totalWords = lessonWords(ayahs).length;
  const targetCards = clamp(Math.round(totalWords / 22), 1, Math.min(12, ayahs.length));
  const targetWords = Math.max(1, Math.ceil(totalWords / targetCards));
  const groups: QuranAyah[][] = [];
  let current: QuranAyah[] = [];
  let currentWords = 0;

  ayahs.forEach((ayah, index) => {
    const words = tokenizeAyah(ayah).length;
    const remainingAyahs = ayahs.length - index;
    const remainingCards = targetCards - groups.length;
    if (current.length && currentWords >= targetWords && remainingAyahs >= remainingCards) {
      groups.push(current);
      current = [];
      currentWords = 0;
    }
    current.push(ayah);
    currentWords += words;
  });
  if (current.length) groups.push(current);

  return groups.map((group, index) => ({
    id: `card-${index + 1}`,
    title: `Card ${index + 1}`,
    ayahs: group,
    words: lessonWords(group)
  }));
}

function makeLesson(ayahs: QuranAyah[], sourceLabel: string, title?: string): Lesson | null {
  if (!ayahs.length) return null;
  const first = ayahs[0]!;
  const last = ayahs[ayahs.length - 1]!;
  const surah = getSurah(first.surah);
  const defaultTitle = first.surah === last.surah
    ? `${surah?.nameTransliterated ?? surah?.nameArabic ?? `Surah ${first.surah}`} ${first.ayah === last.ayah ? `• ${first.ayah}` : `• ${first.ayah}–${last.ayah}`}`
    : `${first.surah}:${first.ayah} – ${last.surah}:${last.ayah}`;
  const now = Date.now();
  return {
    id: `lesson-${now}-${Math.random().toString(36).slice(2, 7)}`,
    title: title?.trim() || defaultTitle,
    sourceLabel,
    ayahs,
    cards: makeBalancedCards(ayahs),
    createdAt: now,
    updatedAt: now,
    currentCard: 0,
    tajweed: false
  };
}

function pageAyahs(page: number) {
  const pages = allPages();
  const start = pages[clamp(page, 1, 604) - 1];
  if (!start) return [];
  const next = pages[clamp(page, 1, 604)];
  if (!next) return ayahsInRange(start.surah, start.ayah, 114, getSurahAyahs(114).length);
  const endAbs = absoluteIndex(next.surah, next.ayah) - 1;
  if (endAbs < 0) return [];
  let endSurah = start.surah;
  let endAyah = start.ayah;
  for (let surah = start.surah; surah <= next.surah; surah += 1) {
    for (const ayah of getSurahAyahs(surah)) {
      const idx = absoluteIndex(ayah.surah, ayah.ayah);
      if (idx > endAbs) break;
      endSurah = ayah.surah;
      endAyah = ayah.ayah;
    }
  }
  return ayahsInRange(start.surah, start.ayah, endSurah, endAyah);
}

function findImportedAyahs(text: string) {
  const target = normalizeArabic(text);
  if (target.length < 3) return [] as QuranAyah[];
  for (const surah of allSurahs()) {
    const ayahs = getSurahAyahs(surah.number);
    const normalized = ayahs.map((ayah) => normalizeArabic(ayah.text));
    const joined = normalized.join(" ");
    const found = joined.indexOf(target);
    if (found < 0) continue;
    let cursor = 0;
    let first = 0;
    let last = 0;
    normalized.forEach((part, index) => {
      const start = cursor;
      const end = start + part.length;
      if (found >= start && found <= end) first = index;
      if (found + target.length >= start) last = index;
      cursor = end + 1;
    });
    return ayahs.slice(first, last + 1);
  }
  return [] as QuranAyah[];
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

function similarity(a: string, b: string) {
  if (!a && !b) return 1;
  return 1 - editDistance(a, b) / Math.max(1, a.length, b.length);
}

function scoreRecitation(expected: LessonWord[], transcript: string) {
  const spoken = normalizeArabic(transcript).split(" ").filter(Boolean);
  const feedback = expected.map((word, index) => {
    const direct = spoken[index] ?? "";
    let score = similarity(word.normalized, direct);
    if (score < 0.72) {
      for (let offset = -2; offset <= 2; offset += 1) {
        const candidate = spoken[index + offset] ?? "";
        score = Math.max(score, similarity(word.normalized, candidate));
      }
    }
    const status: WordStatus = score >= 0.94 ? "correct" : score >= 0.72 ? "uncertain" : "incorrect";
    return { word: word.text, status };
  });
  const correct = feedback.filter((item) => item.status === "correct").length;
  const uncertain = feedback.filter((item) => item.status === "uncertain").length;
  const incorrect = feedback.length - correct - uncertain;
  const percent = feedback.length ? Math.round(((correct + uncertain * 0.45) / feedback.length) * 100) : 0;
  return { feedback, correct, uncertain, incorrect, total: feedback.length, percent };
}

function distinctPracticeDays(attempts: Attempt[]) {
  return new Set(attempts.map((attempt) => new Date(attempt.at).toISOString().slice(0, 10))).size;
}

function badgeData(lessons: Lesson[], attempts: Attempt[]) {
  const best = attempts.reduce((value, attempt) => Math.max(value, attempt.percent), 0);
  const masteredCards = new Set(attempts.filter((a) => a.scope === "card" && a.percent >= 90).map((a) => `${a.lessonId}:${a.cardId}`)).size;
  const days = distinctPracticeDays(attempts);
  return [
    { id: "first", emoji: "📘", title: "First Lesson", earned: lessons.length >= 1 },
    { id: "books", emoji: "🎒", title: "Lesson Explorer", earned: lessons.length >= 3 },
    { id: "practice", emoji: "⭐", title: "Practice Star", earned: attempts.length >= 5 },
    { id: "rising", emoji: "🌱", title: "Rising Hafiz", earned: attempts.length >= 15 },
    { id: "memory", emoji: "💚", title: "Strong Memory", earned: best >= 80 },
    { id: "excellent", emoji: "🏆", title: "Excellent Recall", earned: best >= 95 },
    { id: "cards", emoji: "🧠", title: "Card Master", earned: masteredCards >= 3 },
    { id: "days", emoji: "🔥", title: "Keep Going", earned: days >= 3 }
  ];
}

function teacherCoach(lessons: Lesson[], attempts: Attempt[], activeLesson: Lesson | null, locale: QuranLocale) {
  const ar = locale === "ar";
  if (!lessons.length) return ar ? "ابدأ درساً صغيراً اليوم. اختر سورة قصيرة أو عدة آيات، وسنقسمها إلى بطاقات سهلة." : "Start small today. Pick a short Surah or a few ayahs and I’ll turn them into easy study cards.";
  if (!attempts.length) return ar ? "المعلم جاهز 🎓 استمع لكل بطاقة مرتين، ثم أخفِ النص وجرّب التسميع." : "Teacher is ready 🎓 Listen to each card twice, then hide the text and try your first recitation test.";
  const relevant = activeLesson ? attempts.filter((a) => a.lessonId === activeLesson.id) : attempts;
  const pool = relevant.length ? relevant : attempts;
  const recent = pool.slice(-5);
  const average = Math.round(recent.reduce((sum, a) => sum + a.percent, 0) / Math.max(1, recent.length));
  const weak = new Map<string, number>();
  recent.forEach((a) => a.feedback.filter((f) => f.status !== "correct").forEach((f) => weak.set(f.word, (weak.get(f.word) ?? 0) + 1)));
  const weakWords = [...weak.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([word]) => word);
  if (average >= 92) return ar ? `ما شاء الله! متوسطك الأخير ${average}٪. جرّب اختبار الدرس كاملاً بدون إظهار النص لتحصل على إتقان أقوى.` : `Masha’Allah! Your recent average is ${average}%. Try a full-lesson test with the text hidden to lock it in.`;
  if (average >= 75) return ar ? `أنت تتقدم جيداً (${average}٪). ركّز على ${weakWords.join(" • ") || "الكلمات الصعبة"} واستمع للبطاقة ثم أعد الاختبار.` : `You’re building strong recall (${average}%). Focus on ${weakWords.join(" • ") || "your weak words"}, listen once, then retest that card.`;
  return ar ? `لا بأس، التعلم خطوة خطوة 🌱 متوسطك ${average}٪. خذ بطاقة واحدة فقط، استمع لها 3 مرات، اقرأها، ثم اختبر نفسك.` : `One step at a time 🌱 Your recent average is ${average}%. Work on one card only: listen 3 times, read it, then test yourself.`;
}

function starsEarned(attempts: Attempt[]) {
  return attempts.reduce((sum, attempt) => sum + (attempt.percent >= 95 ? 3 : attempt.percent >= 85 ? 2 : attempt.percent >= 70 ? 1 : 0), 0);
}

function formatDate(value: number, locale: QuranLocale) {
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-CA" : "en-CA", { month: "short", day: "numeric" }).format(new Date(value));
}

export default function AlHafizClassroom({ locale, initialRange, onBack }: Props) {
  const ar = locale === "ar";
  const t = (en: string, arabic: string) => ar ? arabic : en;
  const { appearance } = useQuranAppearance();
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [newLessonOpen, setNewLessonOpen] = useState(false);
  const [sourceMode, setSourceMode] = useState<SourceMode>(initialRange ? "range" : "surah");
  const [surahNumber, setSurahNumber] = useState(initialRange?.surah ?? 1);
  const [startAyah, setStartAyah] = useState(String(initialRange?.start ?? 1));
  const [endAyah, setEndAyah] = useState(String(initialRange?.end ?? 5));
  const [pageNumber, setPageNumber] = useState("1");
  const [pastedText, setPastedText] = useState("");
  const [lessonName, setLessonName] = useState("");
  const [testScope, setTestScope] = useState<TestScope>(null);
  const [speechStatus, setSpeechStatus] = useState<QuranSpeechStatus>({ available: Boolean(QuranSpeech), state: "idle", transcript: "", partialTranscript: "" });
  const [latestAttempt, setLatestAttempt] = useState<Attempt | null>(null);
  const polling = useRef<ReturnType<typeof setInterval> | null>(null);
  const handledTranscript = useRef("");

  const activeLesson = lessons.find((item) => item.id === activeId) ?? null;
  const activeCard = activeLesson?.cards[clamp(activeLesson.currentCard, 0, Math.max(0, activeLesson.cards.length - 1))] ?? null;
  const lessonAttempts = activeLesson ? attempts.filter((attempt) => attempt.lessonId === activeLesson.id) : [];
  const cardAttempts = activeCard ? lessonAttempts.filter((attempt) => attempt.cardId === activeCard.id) : [];
  const bestCard = cardAttempts.reduce((best, a) => Math.max(best, a.percent), 0);
  const badges = badgeData(lessons, attempts);
  const earnedBadges = badges.filter((badge) => badge.earned);
  const stars = starsEarned(attempts);
  const bestScore = attempts.reduce((best, a) => Math.max(best, a.percent), 0);
  const masteredCards = new Set(attempts.filter((a) => a.scope === "card" && a.percent >= 90).map((a) => `${a.lessonId}:${a.cardId}`)).size;
  const coach = teacherCoach(lessons, attempts, activeLesson, locale);

  useEffect(() => {
    void (async () => {
      const [savedLessons, savedAttempts, savedActive, oldLesson, oldAttempts] = await Promise.all([
        AsyncStorage.getItem(LESSONS_KEY), AsyncStorage.getItem(ATTEMPTS_KEY), AsyncStorage.getItem(ACTIVE_KEY),
        AsyncStorage.getItem(OLD_LESSON_KEY), AsyncStorage.getItem(OLD_ATTEMPTS_KEY)
      ]);
      let nextLessons: Lesson[] = [];
      let nextAttempts: Attempt[] = [];
      try { if (savedLessons) nextLessons = JSON.parse(savedLessons) as Lesson[]; } catch {}
      try { if (savedAttempts) nextAttempts = JSON.parse(savedAttempts) as Attempt[]; } catch {}

      if (!nextLessons.length && oldLesson) {
        try {
          const old = JSON.parse(oldLesson) as { title?: string; sourceLabel?: string; ayahs?: QuranAyah[] };
          const migrated = makeLesson(old.ayahs ?? [], old.sourceLabel ?? "Imported lesson", old.title);
          if (migrated) nextLessons = [migrated];
        } catch {}
      }
      if (!nextAttempts.length && oldAttempts && nextLessons.length) {
        try {
          const old = JSON.parse(oldAttempts) as Array<Partial<Attempt> & { percent?: number; feedback?: Array<{ word: string; status: WordStatus }> }>;
          nextAttempts = old.map((attempt, index) => ({
            id: attempt.id ?? `migrated-${index}`,
            lessonId: nextLessons[0]!.id,
            cardId: attempt.cardId ?? "__whole__",
            scope: attempt.cardId === "__whole__" ? "lesson" : "card",
            at: attempt.at ?? Date.now(), transcript: attempt.transcript ?? "",
            correct: attempt.correct ?? 0, uncertain: attempt.uncertain ?? 0, incorrect: attempt.incorrect ?? 0,
            total: attempt.total ?? 0, percent: attempt.percent ?? 0, feedback: attempt.feedback ?? []
          }));
        } catch {}
      }
      setLessons(nextLessons);
      setAttempts(nextAttempts);
      const firstActive = savedActive && nextLessons.some((l) => l.id === savedActive) ? savedActive : nextLessons[0]?.id ?? null;
      setActiveId(firstActive);
      setNewLessonOpen(nextLessons.length === 0);
      setLoaded(true);
    })();
  }, []);

  useEffect(() => () => {
    if (polling.current) clearInterval(polling.current);
    try { QuranSpeech?.cancel(); } catch {}
  }, []);

  useEffect(() => {
    if (!loaded) return;
    void AsyncStorage.setItem(LESSONS_KEY, JSON.stringify(lessons));
  }, [lessons, loaded]);

  useEffect(() => {
    if (!loaded) return;
    void AsyncStorage.setItem(ATTEMPTS_KEY, JSON.stringify(attempts.slice(-1000)));
  }, [attempts, loaded]);

  useEffect(() => {
    if (!loaded) return;
    if (activeId) void AsyncStorage.setItem(ACTIVE_KEY, activeId);
    else void AsyncStorage.removeItem(ACTIVE_KEY);
  }, [activeId, loaded]);

  function updateActiveLesson(updater: (lesson: Lesson) => Lesson) {
    if (!activeLesson) return;
    setLessons((items) => items.map((lesson) => lesson.id === activeLesson.id ? { ...updater(lesson), updatedAt: Date.now() } : lesson));
  }

  function createLesson() {
    let ayahs: QuranAyah[] = [];
    let sourceLabel = "";
    const surah = getSurah(surahNumber);
    if (sourceMode === "surah") {
      ayahs = getSurahAyahs(surahNumber);
      sourceLabel = `${t("Surah", "سورة")} ${surah?.nameTransliterated ?? surah?.nameArabic ?? surahNumber}`;
    } else if (sourceMode === "range") {
      const max = getSurahAyahs(surahNumber).length;
      const start = clamp(Number(startAyah) || 1, 1, Math.max(1, max));
      const end = clamp(Number(endAyah) || start, start, Math.max(start, max));
      ayahs = getSurahAyahs(surahNumber).slice(start - 1, end);
      sourceLabel = `${surah?.nameTransliterated ?? surahNumber} ${start}–${end}`;
    } else if (sourceMode === "page") {
      const page = clamp(Number(pageNumber) || 1, 1, 604);
      ayahs = pageAyahs(page);
      sourceLabel = `${t("Mushaf page", "صفحة المصحف")} ${page}`;
    } else {
      ayahs = findImportedAyahs(pastedText);
      sourceLabel = t("Pasted Qur’an text", "نص قرآن مستورد");
    }
    if (!ayahs.length) {
      Alert.alert(t("Could not create lesson", "تعذر إنشاء الدرس"), t("Choose a valid Surah/range/page or paste Qur’an text exactly as it appears in the Mushaf.", "اختر سورة أو آيات أو صفحة صحيحة، أو الصق نص القرآن كما يظهر في المصحف."));
      return;
    }
    const lesson = makeLesson(ayahs, sourceLabel, lessonName);
    if (!lesson) return;
    setLessons((items) => [lesson, ...items]);
    setActiveId(lesson.id);
    setNewLessonOpen(false);
    setLessonName("");
    setPastedText("");
    setLatestAttempt(null);
  }

  function playAyahs(ayahs: QuranAyah[]) {
    if (!QuranAudio || !ayahs.length) return;
    const first = ayahs[0]!;
    const last = ayahs[ayahs.length - 1]!;
    QuranAudio.playRange(absoluteIndex(first.surah, first.ayah) + 1, absoluteIndex(last.surah, last.ayah) + 1, "ar.alafasy", 128, "Mishary Alafasy", false, 1);
  }

  async function ensureMicrophone() {
    if (Platform.OS !== "android") return true;
    const permission = PermissionsAndroid.PERMISSIONS.RECORD_AUDIO;
    const current = await PermissionsAndroid.check(permission);
    if (current) return true;
    return (await PermissionsAndroid.request(permission, { title: t("Microphone for recitation", "الميكروفون للتسميع"), message: t("Al-Hafiz listens only while you choose Test Me so it can compare your recitation with the lesson.", "يستمع الحافظ فقط أثناء اختيار اختبرني لمقارنة تسميعك بالدرس."), buttonPositive: t("Allow", "سماح"), buttonNegative: t("Not now", "ليس الآن") })) === PermissionsAndroid.RESULTS.GRANTED;
  }

  async function startTest(scope: "card" | "lesson") {
    if (!activeLesson || !QuranSpeech) {
      Alert.alert(t("Recitation test unavailable", "اختبار التسميع غير متاح"), t("Speech recognition is not available on this device build.", "التعرف على الكلام غير متاح في هذا الإصدار على الجهاز."));
      return;
    }
    if (scope === "card" && !activeCard) return;
    if (!(await ensureMicrophone())) return;
    handledTranscript.current = "";
    setLatestAttempt(null);
    setTestScope(scope);
    try {
      await QuranSpeech.start("ar-SA");
      setSpeechStatus(QuranSpeech.getStatus());
      if (polling.current) clearInterval(polling.current);
      polling.current = setInterval(() => {
        if (!QuranSpeech) return;
        const status = QuranSpeech.getStatus();
        setSpeechStatus(status);
        if (status.state === "done" && status.transcript && status.transcript !== handledTranscript.current) {
          handledTranscript.current = status.transcript;
          finishScore(scope, status.transcript);
        }
      }, 300);
    } catch (error) {
      setTestScope(null);
      Alert.alert(t("Could not start listening", "تعذر بدء الاستماع"), error instanceof Error ? error.message : String(error));
    }
  }

  function stopTest() {
    try { QuranSpeech?.stop(); } catch {}
  }

  function finishScore(scope: "card" | "lesson", transcript: string) {
    if (!activeLesson) return;
    const expected = scope === "lesson" ? lessonWords(activeLesson.ayahs) : activeCard?.words ?? [];
    const scored = scoreRecitation(expected, transcript);
    const attempt: Attempt = {
      id: `attempt-${Date.now()}`,
      lessonId: activeLesson.id,
      cardId: scope === "lesson" ? "__whole__" : activeCard?.id ?? "__whole__",
      scope, at: Date.now(), transcript, ...scored
    };
    setAttempts((items) => [...items, attempt]);
    setLatestAttempt(attempt);
    setTestScope(null);
    if (polling.current) { clearInterval(polling.current); polling.current = null; }
  }

  function resetCard() {
    if (!activeLesson || !activeCard) return;
    Alert.alert(t("Reset this card?", "إعادة ضبط هذه البطاقة؟"), t("Its saved test results will be removed.", "سيتم حذف نتائج الاختبار المحفوظة لهذه البطاقة."), [
      { text: t("Cancel", "إلغاء"), style: "cancel" },
      { text: t("Reset", "إعادة ضبط"), style: "destructive", onPress: () => {
        setAttempts((items) => items.filter((a) => !(a.lessonId === activeLesson.id && a.cardId === activeCard.id)));
        setLatestAttempt(null);
      }}
    ]);
  }

  function resetLesson() {
    if (!activeLesson) return;
    Alert.alert(t("Reset lesson progress?", "إعادة ضبط تقدم الدرس؟"), t("The lesson stays, but all its scores and progress are cleared.", "سيبقى الدرس، لكن سيتم حذف جميع درجاته وتقدمه."), [
      { text: t("Cancel", "إلغاء"), style: "cancel" },
      { text: t("Reset", "إعادة ضبط"), style: "destructive", onPress: () => {
        setAttempts((items) => items.filter((a) => a.lessonId !== activeLesson.id));
        updateActiveLesson((lesson) => ({ ...lesson, currentCard: 0 }));
        setLatestAttempt(null);
      }}
    ]);
  }

  function deleteLesson(lesson: Lesson) {
    Alert.alert(t("Delete lesson?", "حذف الدرس؟"), lesson.title, [
      { text: t("Cancel", "إلغاء"), style: "cancel" },
      { text: t("Delete", "حذف"), style: "destructive", onPress: () => {
        setLessons((items) => items.filter((item) => item.id !== lesson.id));
        setAttempts((items) => items.filter((attempt) => attempt.lessonId !== lesson.id));
        if (activeId === lesson.id) setActiveId(null);
      }}
    ]);
  }

  if (!loaded) return <View style={styles.loading}><Text style={styles.loadingText}>{t("Opening Al-Hafiz classroom…", "جاري فتح صف الحافظ…")}</Text></View>;

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.screen} showsVerticalScrollIndicator={false}>
      <View style={styles.woodHeader}>
        <Pressable onPress={onBack} style={styles.back}><Text style={styles.backText}>‹</Text></Pressable>
        <BrandMark size={42} />
        <View style={{ flex: 1 }}>
          <Text style={styles.classLabel}>🎓 {t("AL-HAFIZ CLASSROOM", "صف الحافظ")}</Text>
          <Text style={styles.headerTitle}>{t("My Qur’an Teacher", "معلمي للقرآن")}</Text>
        </View>
        <View style={styles.starBox}><Text style={styles.starText}>⭐ {stars}</Text></View>
      </View>

      <View style={styles.summaryRow}>
        <View style={styles.summaryTile}><Text style={styles.summaryEmoji}>📚</Text><Text style={styles.summaryValue}>{lessons.length}</Text><Text style={styles.summaryLabel}>{t("Lessons", "دروس")}</Text></View>
        <View style={styles.summaryTile}><Text style={styles.summaryEmoji}>🧠</Text><Text style={styles.summaryValue}>{masteredCards}</Text><Text style={styles.summaryLabel}>{t("Mastered", "متقن")}</Text></View>
        <View style={styles.summaryTile}><Text style={styles.summaryEmoji}>🏆</Text><Text style={styles.summaryValue}>{bestScore}%</Text><Text style={styles.summaryLabel}>{t("Best", "أفضل")}</Text></View>
      </View>

      <View style={styles.teacherNote}>
        <View style={styles.teacherAvatar}><Text style={styles.teacherAvatarText}>🤖</Text></View>
        <View style={{ flex: 1 }}>
          <Text style={styles.teacherLabel}>{t("AI TEACHER • TODAY'S TIP", "المعلم الذكي • نصيحة اليوم")}</Text>
          <Text style={styles.teacherText}>{coach}</Text>
        </View>
      </View>

      <View style={styles.sectionHead}>
        <Text style={styles.sectionTitle}>🏅 {t("My badge shelf", "رف الشارات")}</Text>
        <Text style={styles.sectionMeta}>{earnedBadges.length}/{badges.length}</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.badgeRow}>
        {badges.map((badge) => <View key={badge.id} style={[styles.badge, !badge.earned && styles.badgeLocked]}><Text style={styles.badgeEmoji}>{badge.earned ? badge.emoji : "🔒"}</Text><Text style={styles.badgeTitle}>{badge.title}</Text></View>)}
      </ScrollView>

      {!activeLesson ? (
        <View>
          <View style={styles.sectionHead}><Text style={styles.sectionTitle}>📒 {t("My lessons", "دروسي")}</Text><Pressable style={styles.addSmall} onPress={() => setNewLessonOpen(true)}><Text style={styles.addSmallText}>＋ {t("New", "جديد")}</Text></Pressable></View>
          {lessons.length ? lessons.map((lesson) => {
            const lessonScores = attempts.filter((a) => a.lessonId === lesson.id);
            const best = lessonScores.reduce((value, a) => Math.max(value, a.percent), 0);
            return <Pressable key={lesson.id} style={styles.folderCard} onPress={() => { setActiveId(lesson.id); setLatestAttempt(null); }}>
              <View style={styles.folderTab}><Text style={styles.folderTabText}>📁</Text></View>
              <View style={{ flex: 1 }}><Text style={styles.folderTitle}>{lesson.title}</Text><Text style={styles.folderSub}>{lesson.sourceLabel} • {lesson.cards.length} {t("cards", "بطاقات")}</Text><Text style={styles.folderProgress}>⭐ {t("Best score", "أفضل درجة")}: {best}% • {t("Practiced", "تدرب")}: {lessonScores.length}</Text></View>
              <Pressable onPress={() => deleteLesson(lesson)} style={styles.deleteMini}><Text>🗑️</Text></Pressable>
            </Pressable>;
          }) : <View style={styles.emptyDesk}><Text style={styles.emptyEmoji}>📚✨</Text><Text style={styles.emptyTitle}>{t("Your lesson shelf is ready", "رف دروسك جاهز")}</Text><Text style={styles.emptyText}>{t("Create a Surah, ayah range, Mushaf page or pasted Qur’an lesson. Al-Hafiz will make study cards automatically.", "أنشئ درساً من سورة أو آيات أو صفحة مصحف أو نص قرآن، وسيقسمه الحافظ إلى بطاقات تلقائياً.")}</Text></View>}
        </View>
      ) : (
        <View>
          <View style={styles.lessonTopRow}><Pressable style={styles.shelfButton} onPress={() => setActiveId(null)}><Text style={styles.shelfButtonText}>← {t("My lessons", "دروسي")}</Text></Pressable><Pressable style={styles.newLessonButton} onPress={() => setNewLessonOpen(true)}><Text style={styles.newLessonButtonText}>＋ {t("New lesson", "درس جديد")}</Text></Pressable></View>

          <View style={styles.chalkboard}>
            <View style={styles.boardTop}><View style={{ flex: 1 }}><Text style={styles.boardEyebrow}>✏️ {t("TODAY'S LESSON", "درس اليوم")}</Text><Text style={styles.boardTitle}>{activeLesson.title}</Text><Text style={styles.boardSub}>{activeLesson.sourceLabel} • {activeLesson.cards.length} {t("study cards", "بطاقات دراسة")}</Text></View><View style={styles.tajweedWrap}><Text style={styles.tajweedText}>🎨 {t("Tajweed", "تجويد")}</Text><Switch value={activeLesson.tajweed} onValueChange={(tajweed) => updateActiveLesson((lesson) => ({ ...lesson, tajweed }))} trackColor={{ false: "#66746f", true: "#d4b34e" }} thumbColor="#fff" /></View></View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.cardTabs}>
              {activeLesson.cards.map((card, index) => {
                const score = attempts.filter((a) => a.lessonId === activeLesson.id && a.cardId === card.id).reduce((best, a) => Math.max(best, a.percent), 0);
                const selected = index === activeLesson.currentCard;
                return <Pressable key={card.id} style={[styles.cardTab, selected && styles.cardTabActive]} onPress={() => { updateActiveLesson((lesson) => ({ ...lesson, currentCard: index })); setLatestAttempt(null); }}><Text style={[styles.cardTabText, selected && styles.cardTabTextActive]}>{index + 1}</Text>{score >= 90 ? <Text style={styles.masterStar}>★</Text> : null}</Pressable>;
              })}
            </ScrollView>

            {activeCard ? <View style={styles.flashcard}>
              <View style={styles.flashcardTop}><Text style={styles.flashcardLabel}>🗂️ {t("CARD", "بطاقة")} {activeLesson.currentCard + 1}/{activeLesson.cards.length}</Text><Text style={styles.flashcardScore}>⭐ {t("Best", "أفضل")}: {bestCard}%</Text></View>
              {testScope ? <View style={styles.hiddenTest}><Text style={styles.hiddenMic}>🎙️</Text><Text style={styles.hiddenTitle}>{t("Text hidden — recite from memory", "النص مخفي — سمّع من حفظك")}</Text><Text style={styles.hiddenSub}>{speechStatus.partialTranscript || speechStatus.transcript || t("I'm listening…", "أنا أستمع…")}</Text></View> : activeLesson.tajweed ? (
                <View style={styles.tajweedPageWrap}>
                  {Array.from(new Set(activeCard.ayahs.map((ayah) => pageForAyah(ayah.surah, ayah.ayah) ?? 1))).map((page) => <QuranPageText key={page} page={page} ayahs={activeCard.ayahs.filter((ayah) => (pageForAyah(ayah.surah, ayah.ayah) ?? 1) === page)} appearance={{ ...appearance, tajweed: true, pageTheme: "white", textColor: "#183d33", fontSize: Math.min(32, Math.max(24, appearance.fontSize)) }} locale={locale} onPressAyah={() => {}} />)}
                </View>
              ) : <Text style={styles.arabicCard}>{activeCard.ayahs.map((ayah) => `${ayah.text} ﴿${ayah.ayah}﴾`).join("  ")}</Text>}

              {!testScope ? <View style={styles.studyActions}>
                <Pressable style={styles.studyButton} onPress={() => playAyahs(activeCard.ayahs)}><Text style={styles.studyButtonText}>▶️ {t("Play card", "تشغيل البطاقة")}</Text></Pressable>
                <Pressable style={styles.testButton} onPress={() => void startTest("card")}><Text style={styles.testButtonText}>🎙️ {t("Test this card", "اختبر هذه البطاقة")}</Text></Pressable>
              </View> : <Pressable style={styles.stopButton} onPress={stopTest}><Text style={styles.stopButtonText}>⏹ {t("I'm done — grade me", "انتهيت — قيّمني")}</Text></Pressable>}
            </View> : null}

            {!testScope ? <View style={styles.wholeLessonRow}><Pressable style={styles.wholeAudio} onPress={() => playAyahs(activeLesson.ayahs)}><Text style={styles.wholeAudioText}>🔊 {t("Play whole lesson", "تشغيل الدرس كاملاً")}</Text></Pressable><Pressable style={styles.wholeTest} onPress={() => void startTest("lesson")}><Text style={styles.wholeTestText}>📝 {t("Test whole lesson", "اختبار الدرس كاملاً")}</Text></Pressable></View> : null}
          </View>

          {latestAttempt ? <View style={styles.gradePaper}><View style={styles.gradeCircle}><Text style={styles.gradeValue}>{latestAttempt.percent}%</Text><Text style={styles.gradeLetter}>{latestAttempt.percent >= 95 ? "A+" : latestAttempt.percent >= 85 ? "A" : latestAttempt.percent >= 75 ? "B" : latestAttempt.percent >= 60 ? "C" : "Keep going"}</Text></View><View style={{ flex: 1 }}><Text style={styles.gradeTitle}>{latestAttempt.percent >= 90 ? t("Masha’Allah! Excellent work!", "ما شاء الله! عمل ممتاز!") : t("Teacher's review", "مراجعة المعلم")}</Text><Text style={styles.gradeStats}>✅ {latestAttempt.correct}  •  🟡 {latestAttempt.uncertain}  •  ❌ {latestAttempt.incorrect}</Text><View style={styles.feedbackWords}>{latestAttempt.feedback.slice(0, 24).map((item, index) => <Text key={`${item.word}-${index}`} style={[styles.feedbackWord, item.status === "correct" ? styles.correctWord : item.status === "uncertain" ? styles.uncertainWord : styles.incorrectWord]}>{item.word}</Text>)}</View></View></View> : null}

          <View style={styles.teacherDesk}>
            <Text style={styles.deskTitle}>🍎 {t("Teacher's desk", "مكتب المعلم")}</Text>
            <Text style={styles.deskTip}>{coach}</Text>
            <View style={styles.deskActions}><Pressable style={styles.resetCard} onPress={resetCard}><Text style={styles.resetCardText}>↺ {t("Reset card", "إعادة البطاقة")}</Text></Pressable><Pressable style={styles.resetLesson} onPress={resetLesson}><Text style={styles.resetLessonText}>🧹 {t("Reset lesson", "إعادة الدرس")}</Text></Pressable></View>
          </View>
        </View>
      )}

      {(newLessonOpen || (!activeLesson && !lessons.length)) ? <View style={styles.newLessonPanel}>
        <View style={styles.notebookHead}><Text style={styles.notebookTitle}>📝 {t("Create a new lesson", "إنشاء درس جديد")}</Text>{lessons.length ? <Pressable onPress={() => setNewLessonOpen(false)}><Text style={styles.closeText}>✕</Text></Pressable> : null}</View>
        <TextInput value={lessonName} onChangeText={setLessonName} placeholder={t("Optional lesson name", "اسم الدرس اختياري")} placeholderTextColor="#9b8c77" style={styles.lessonNameInput} />
        <View style={styles.sourceTabs}>{(["surah", "range", "page", "paste"] as SourceMode[]).map((mode) => <Pressable key={mode} style={[styles.sourceTab, sourceMode === mode && styles.sourceTabActive]} onPress={() => setSourceMode(mode)}><Text style={[styles.sourceTabText, sourceMode === mode && styles.sourceTabTextActive]}>{mode === "surah" ? `📖 ${t("Surah", "سورة")}` : mode === "range" ? `🔢 ${t("Ayahs", "آيات")}` : mode === "page" ? `📄 ${t("Page", "صفحة")}` : `📋 ${t("Paste", "لصق")}`}</Text></Pressable>)}</View>

        {sourceMode === "surah" || sourceMode === "range" ? <View><Text style={styles.fieldLabel}>{t("Choose Surah number (1–114)", "اختر رقم السورة (١–١١٤)")}</Text><TextInput keyboardType="number-pad" value={String(surahNumber)} onChangeText={(value) => setSurahNumber(clamp(Number(value) || 1, 1, 114))} style={styles.numberInput} /><Text style={styles.surahHint}>{getSurah(surahNumber)?.nameArabic} • {getSurah(surahNumber)?.nameTransliterated}</Text>{sourceMode === "range" ? <View style={styles.rangeRow}><View style={{ flex: 1 }}><Text style={styles.fieldLabel}>{t("From ayah", "من آية")}</Text><TextInput keyboardType="number-pad" value={startAyah} onChangeText={setStartAyah} style={styles.numberInput} /></View><View style={{ flex: 1 }}><Text style={styles.fieldLabel}>{t("To ayah", "إلى آية")}</Text><TextInput keyboardType="number-pad" value={endAyah} onChangeText={setEndAyah} style={styles.numberInput} /></View></View> : null}</View> : null}
        {sourceMode === "page" ? <View><Text style={styles.fieldLabel}>{t("Mushaf page (1–604)", "صفحة المصحف (١–٦٠٤)")}</Text><TextInput keyboardType="number-pad" value={pageNumber} onChangeText={setPageNumber} style={styles.numberInput} /></View> : null}
        {sourceMode === "paste" ? <View><Text style={styles.fieldLabel}>{t("Paste the Qur’an lines here", "الصق آيات القرآن هنا")}</Text><TextInput value={pastedText} onChangeText={setPastedText} multiline textAlignVertical="top" placeholder={t("Paste one ayah, a few lines, or a longer passage…", "الصق آية أو عدة أسطر أو مقطعاً أطول…")} placeholderTextColor="#9b8c77" style={styles.pasteInput} /></View> : null}
        <View style={styles.autoCardsNote}><Text style={styles.autoCardsIcon}>🗂️✨</Text><Text style={styles.autoCardsText}>{t("Make it cards is automatic: Al-Hafiz balances the selected Qur’an into small study cards without changing the ayah order.", "إنشاء البطاقات تلقائي: يقسم الحافظ القرآن المختار إلى بطاقات صغيرة متوازنة مع الحفاظ على ترتيب الآيات.")}</Text></View>
        <Pressable style={styles.createButton} onPress={createLesson}><Text style={styles.createButtonText}>✨ {t("Create lesson & make cards", "إنشاء الدرس والبطاقات")}</Text></Pressable>
      </View> : null}

      <Text style={styles.footer}>{t("Al-Hafiz helps with practice; a qualified Qur’an teacher remains the best source for precise tajweed and recitation correction.", "الحافظ يساعد في التدريب، ويبقى معلم القرآن المؤهل أفضل مرجع لتصحيح التجويد والتلاوة بدقة.")}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#efe7d4" },
  screen: { padding: 16, paddingBottom: 56, gap: 14 },
  loading: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#efe7d4" }, loadingText: { color: "#21483d", fontWeight: "800" },
  woodHeader: { backgroundColor: "#8a5c35", borderRadius: 22, borderWidth: 3, borderColor: "#6f4528", padding: 12, flexDirection: "row", alignItems: "center", gap: 10 },
  back: { width: 38, height: 38, borderRadius: 12, backgroundColor: "#f6e8c9", alignItems: "center", justifyContent: "center" }, backText: { fontSize: 30, lineHeight: 31, color: "#315b4c" },
  classLabel: { color: "#f4df9a", fontSize: 10, fontWeight: "900", letterSpacing: 1 }, headerTitle: { color: "#fff8e9", fontSize: 20, fontWeight: "900", marginTop: 2 },
  starBox: { backgroundColor: "#f4d66f", borderRadius: 14, paddingHorizontal: 10, paddingVertical: 7 }, starText: { color: "#5c4620", fontWeight: "900" },
  summaryRow: { flexDirection: "row", gap: 9 }, summaryTile: { flex: 1, backgroundColor: "#fffaf0", borderRadius: 18, paddingVertical: 11, alignItems: "center", borderWidth: 1, borderColor: "#dcccae" }, summaryEmoji: { fontSize: 20 }, summaryValue: { color: "#21483d", fontSize: 20, fontWeight: "900", marginTop: 3 }, summaryLabel: { color: "#7d7464", fontSize: 10, fontWeight: "800" },
  teacherNote: { backgroundColor: "#fff4c8", borderRadius: 20, padding: 14, borderWidth: 1, borderColor: "#e0c66b", flexDirection: "row", gap: 11, alignItems: "center" }, teacherAvatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: "#1f5748", alignItems: "center", justifyContent: "center" }, teacherAvatarText: { fontSize: 25 }, teacherLabel: { color: "#8e6c20", fontSize: 9, fontWeight: "900", letterSpacing: .8 }, teacherText: { color: "#3f4c43", fontSize: 12, lineHeight: 18, fontWeight: "700", marginTop: 4 },
  sectionHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 2 }, sectionTitle: { color: "#254c40", fontSize: 17, fontWeight: "900" }, sectionMeta: { color: "#8b765b", fontSize: 11, fontWeight: "800" },
  badgeRow: { gap: 8, paddingRight: 20 }, badge: { width: 104, minHeight: 86, borderRadius: 18, backgroundColor: "#fff9e9", borderWidth: 1.5, borderColor: "#d4b657", padding: 10, alignItems: "center", justifyContent: "center" }, badgeLocked: { opacity: .45, borderColor: "#c9c1ae" }, badgeEmoji: { fontSize: 26 }, badgeTitle: { color: "#4d574f", fontSize: 10, fontWeight: "900", textAlign: "center", marginTop: 5 },
  addSmall: { backgroundColor: "#245e4d", borderRadius: 12, paddingHorizontal: 11, paddingVertical: 7 }, addSmallText: { color: "#fff", fontWeight: "900", fontSize: 11 },
  folderCard: { backgroundColor: "#e6bd64", borderRadius: 19, borderWidth: 2, borderColor: "#bd9140", padding: 13, flexDirection: "row", gap: 10, alignItems: "center", marginBottom: 9 }, folderTab: { width: 42, height: 42, borderRadius: 12, backgroundColor: "#f8d989", alignItems: "center", justifyContent: "center" }, folderTabText: { fontSize: 22 }, folderTitle: { color: "#493c27", fontSize: 15, fontWeight: "900" }, folderSub: { color: "#735f3e", fontSize: 10.5, marginTop: 3 }, folderProgress: { color: "#5a513d", fontSize: 10, fontWeight: "800", marginTop: 5 }, deleteMini: { padding: 8 },
  emptyDesk: { backgroundColor: "#fffaf0", borderRadius: 22, borderWidth: 1, borderColor: "#d9ccb1", padding: 20, alignItems: "center" }, emptyEmoji: { fontSize: 34 }, emptyTitle: { color: "#264b40", fontSize: 17, fontWeight: "900", marginTop: 8 }, emptyText: { color: "#756d5f", fontSize: 12, lineHeight: 18, textAlign: "center", marginTop: 7 },
  lessonTopRow: { flexDirection: "row", justifyContent: "space-between", gap: 8 }, shelfButton: { backgroundColor: "#fff9e9", borderRadius: 13, borderWidth: 1, borderColor: "#d6c9ad", paddingHorizontal: 11, paddingVertical: 8 }, shelfButtonText: { color: "#31594d", fontWeight: "900", fontSize: 11 }, newLessonButton: { backgroundColor: "#2d6856", borderRadius: 13, paddingHorizontal: 11, paddingVertical: 8 }, newLessonButtonText: { color: "#fff", fontWeight: "900", fontSize: 11 },
  chalkboard: { backgroundColor: "#183e35", borderRadius: 24, borderWidth: 6, borderColor: "#8a5c35", padding: 14 }, boardTop: { flexDirection: "row", gap: 10, alignItems: "flex-start" }, boardEyebrow: { color: "#f4d66f", fontSize: 9, fontWeight: "900", letterSpacing: 1 }, boardTitle: { color: "#fffdf3", fontSize: 21, fontWeight: "900", marginTop: 4 }, boardSub: { color: "#bcd0c8", fontSize: 10.5, marginTop: 4 }, tajweedWrap: { alignItems: "center", gap: 3 }, tajweedText: { color: "#f7e5a7", fontSize: 9, fontWeight: "900" },
  cardTabs: { gap: 7, paddingVertical: 13 }, cardTab: { width: 38, height: 38, borderRadius: 10, backgroundColor: "#345e52", alignItems: "center", justifyContent: "center", position: "relative" }, cardTabActive: { backgroundColor: "#f4d66f" }, cardTabText: { color: "#d6e1dc", fontWeight: "900" }, cardTabTextActive: { color: "#244b40" }, masterStar: { position: "absolute", right: -3, top: -8, color: "#ffdc54", fontSize: 13 },
  flashcard: { backgroundColor: "#fffdf4", borderRadius: 20, padding: 15, borderWidth: 2, borderColor: "#e5d4a2" }, flashcardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" }, flashcardLabel: { color: "#99762a", fontSize: 10, fontWeight: "900" }, flashcardScore: { color: "#557066", fontSize: 10, fontWeight: "900" }, arabicCard: { color: "#183e35", fontSize: 28, lineHeight: 52, textAlign: "right", writingDirection: "rtl", marginVertical: 15 }, tajweedPageWrap: { marginTop: 12 },
  studyActions: { flexDirection: "row", gap: 8, marginTop: 12 }, studyButton: { flex: 1, backgroundColor: "#e7f1ec", borderRadius: 14, padding: 11, alignItems: "center" }, studyButtonText: { color: "#245a4b", fontWeight: "900", fontSize: 11 }, testButton: { flex: 1, backgroundColor: "#f4d66f", borderRadius: 14, padding: 11, alignItems: "center" }, testButtonText: { color: "#51431f", fontWeight: "900", fontSize: 11 },
  hiddenTest: { minHeight: 190, alignItems: "center", justifyContent: "center", padding: 18 }, hiddenMic: { fontSize: 40 }, hiddenTitle: { color: "#244f42", fontSize: 17, fontWeight: "900", textAlign: "center", marginTop: 10 }, hiddenSub: { color: "#748279", fontSize: 12, lineHeight: 18, textAlign: "center", marginTop: 7 }, stopButton: { backgroundColor: "#b1453e", borderRadius: 14, padding: 12, alignItems: "center", marginTop: 10 }, stopButtonText: { color: "#fff", fontWeight: "900" },
  wholeLessonRow: { flexDirection: "row", gap: 8, marginTop: 11 }, wholeAudio: { flex: 1, backgroundColor: "#315f52", borderRadius: 14, padding: 11, alignItems: "center" }, wholeAudioText: { color: "#fff", fontWeight: "900", fontSize: 10.5 }, wholeTest: { flex: 1, backgroundColor: "#d8b34b", borderRadius: 14, padding: 11, alignItems: "center" }, wholeTestText: { color: "#31473f", fontWeight: "900", fontSize: 10.5 },
  gradePaper: { backgroundColor: "#fffdf7", borderRadius: 20, borderWidth: 1, borderColor: "#d9cdb4", padding: 14, flexDirection: "row", gap: 12, alignItems: "flex-start" }, gradeCircle: { width: 72, height: 72, borderRadius: 36, backgroundColor: "#f3d86f", alignItems: "center", justifyContent: "center", borderWidth: 3, borderColor: "#d4b147" }, gradeValue: { color: "#324b42", fontSize: 19, fontWeight: "900" }, gradeLetter: { color: "#765f27", fontSize: 9, fontWeight: "900" }, gradeTitle: { color: "#294e42", fontSize: 14, fontWeight: "900" }, gradeStats: { color: "#6d786f", fontSize: 11, marginTop: 4, fontWeight: "800" }, feedbackWords: { flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 8 }, feedbackWord: { fontSize: 12, paddingHorizontal: 5, paddingVertical: 3, borderRadius: 6, overflow: "hidden" }, correctWord: { backgroundColor: "#daf1df", color: "#286039" }, uncertainWord: { backgroundColor: "#fff0b7", color: "#775d1c" }, incorrectWord: { backgroundColor: "#f8d8d4", color: "#9c3931" },
  teacherDesk: { backgroundColor: "#fff7df", borderRadius: 19, borderWidth: 1, borderColor: "#d9c89f", padding: 14 }, deskTitle: { color: "#564a35", fontSize: 15, fontWeight: "900" }, deskTip: { color: "#625d51", fontSize: 11.5, lineHeight: 17, marginTop: 6 }, deskActions: { flexDirection: "row", gap: 8, marginTop: 11 }, resetCard: { flex: 1, backgroundColor: "#e9efe9", borderRadius: 12, padding: 10, alignItems: "center" }, resetCardText: { color: "#36584e", fontWeight: "900", fontSize: 10.5 }, resetLesson: { flex: 1, backgroundColor: "#f4dfd8", borderRadius: 12, padding: 10, alignItems: "center" }, resetLessonText: { color: "#8a4a42", fontWeight: "900", fontSize: 10.5 },
  newLessonPanel: { backgroundColor: "#fffaf0", borderRadius: 22, borderWidth: 2, borderColor: "#d5c19a", padding: 15 }, notebookHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, notebookTitle: { color: "#345247", fontSize: 17, fontWeight: "900" }, closeText: { color: "#866e4d", fontSize: 20 }, lessonNameInput: { marginTop: 12, backgroundColor: "#fff", borderRadius: 13, borderWidth: 1, borderColor: "#d9cbb1", padding: 11, color: "#344d45" }, sourceTabs: { flexDirection: "row", flexWrap: "wrap", gap: 7, marginTop: 11 }, sourceTab: { backgroundColor: "#ede7d8", borderRadius: 12, paddingHorizontal: 10, paddingVertical: 8 }, sourceTabActive: { backgroundColor: "#2d6555" }, sourceTabText: { color: "#655e50", fontSize: 10.5, fontWeight: "900" }, sourceTabTextActive: { color: "#fff" }, fieldLabel: { color: "#776a57", fontSize: 10, fontWeight: "900", marginTop: 12, marginBottom: 5 }, numberInput: { backgroundColor: "#fff", borderRadius: 12, borderWidth: 1, borderColor: "#d7c8ad", padding: 10, color: "#334e45", fontWeight: "800" }, surahHint: { color: "#8b7659", fontSize: 11, marginTop: 5 }, rangeRow: { flexDirection: "row", gap: 9 }, pasteInput: { minHeight: 125, backgroundColor: "#fff", borderRadius: 14, borderWidth: 1, borderColor: "#d7c8ad", padding: 11, color: "#324a43", fontSize: 13, lineHeight: 21 }, autoCardsNote: { backgroundColor: "#edf5ed", borderRadius: 15, padding: 11, flexDirection: "row", gap: 8, marginTop: 12, alignItems: "center" }, autoCardsIcon: { fontSize: 22 }, autoCardsText: { flex: 1, color: "#557066", fontSize: 10.5, lineHeight: 15 }, createButton: { backgroundColor: "#2b6554", borderRadius: 15, padding: 13, alignItems: "center", marginTop: 12 }, createButtonText: { color: "#fff", fontSize: 12, fontWeight: "900" },
  footer: { color: "#877c69", fontSize: 9.5, lineHeight: 14, textAlign: "center", paddingHorizontal: 12 }
});
