import AsyncStorage from "@react-native-async-storage/async-storage";

export type QuizMode = "kids" | "adults";
export type QuizLocale = "en" | "ar";

type Localized = { en: string; ar: string };

export type QuizQuestion = {
  id: string;
  mode: QuizMode;
  prompt: Localized;
  choices: Localized[];
  answerIndex: number;
  explanation: Localized;
  reference: string;
};

export type QuizStats = {
  totalWins: number;
  streak: number;
  bestStreak: number;
  lastWinDate: string | null;
  completed: string[];
};

export type QuizBadge = {
  key: string;
  emoji: string;
  name: Localized;
  minWins: number;
};

const STORAGE_KEY = "wopt:islamic-quiz-stats:v1";

export const BADGES: readonly [QuizBadge, ...QuizBadge[]] = [
  { key: "explorer", emoji: "🌱", name: { en: "Explorer", ar: "المستكشف" }, minWins: 0 },
  { key: "crescent", emoji: "🌙", name: { en: "Crescent", ar: "الهلال" }, minWins: 1 },
  { key: "lantern", emoji: "🏮", name: { en: "Lantern", ar: "الفانوس" }, minWins: 3 },
  { key: "minaret", emoji: "🕌", name: { en: "Minaret", ar: "المئذنة" }, minWins: 7 },
  { key: "star", emoji: "⭐", name: { en: "Knowledge Star", ar: "نجم المعرفة" }, minWins: 15 },
  { key: "scholar", emoji: "🏆", name: { en: "Scholar", ar: "العالِم" }, minWins: 30 }
];

const QUESTIONS: QuizQuestion[] = [
  {
    id: "kids-ramadan",
    mode: "kids",
    prompt: { en: "In which month do Muslims fast?", ar: "في أي شهر يصوم المسلمون؟" },
    choices: [
      { en: "Ramadan", ar: "رمضان" },
      { en: "Muharram", ar: "محرم" },
      { en: "Rajab", ar: "رجب" },
      { en: "Shawwal", ar: "شوال" }
    ],
    answerIndex: 0,
    explanation: { en: "Ramadan is the month of fasting and the month in which the Qur’an was revealed.", ar: "رمضان هو شهر الصيام والشهر الذي أُنزل فيه القرآن." },
    reference: "Qur’an 2:185"
  },
  {
    id: "kids-qibla",
    mode: "kids",
    prompt: { en: "What direction do Muslims face in prayer?", ar: "إلى أين يتجه المسلمون في الصلاة؟" },
    choices: [
      { en: "Al-Masjid al-Haram in Makkah", ar: "المسجد الحرام في مكة" },
      { en: "The sunrise", ar: "الشروق" },
      { en: "Any mountain", ar: "أي جبل" },
      { en: "Any direction", ar: "أي اتجاه" }
    ],
    answerIndex: 0,
    explanation: { en: "The Qur’an directs Muslims to face al-Masjid al-Haram.", ar: "يوجه القرآن المسلمين نحو المسجد الحرام." },
    reference: "Qur’an 2:144"
  },
  {
    id: "kids-qadr",
    mode: "kids",
    prompt: { en: "Laylat al-Qadr is better than how many months?", ar: "ليلة القدر خير من كم شهر؟" },
    choices: [
      { en: "100", ar: "١٠٠" },
      { en: "500", ar: "٥٠٠" },
      { en: "1,000", ar: "١٠٠٠" },
      { en: "10", ar: "١٠" }
    ],
    answerIndex: 2,
    explanation: { en: "Surah al-Qadr says it is better than a thousand months.", ar: "تقول سورة القدر إنها خير من ألف شهر." },
    reference: "Qur’an 97:3"
  },
  {
    id: "kids-yunus",
    mode: "kids",
    prompt: { en: "Which prophet was swallowed by a great fish?", ar: "أي نبي ابتلعه الحوت؟" },
    choices: [
      { en: "Yunus", ar: "يونس عليه السلام" },
      { en: "Nuh", ar: "نوح عليه السلام" },
      { en: "Musa", ar: "موسى عليه السلام" },
      { en: "Ibrahim", ar: "إبراهيم عليه السلام" }
    ],
    answerIndex: 0,
    explanation: { en: "The Qur’an describes Prophet Yunus being swallowed by the fish.", ar: "يذكر القرآن ابتلاع الحوت لنبي الله يونس عليه السلام." },
    reference: "Qur’an 37:139–142"
  },
  {
    id: "kids-nuh",
    mode: "kids",
    prompt: { en: "Which prophet was commanded to build the Ark?", ar: "أي نبي أُمر بصنع السفينة؟" },
    choices: [
      { en: "Nuh", ar: "نوح عليه السلام" },
      { en: "Isa", ar: "عيسى عليه السلام" },
      { en: "Yusuf", ar: "يوسف عليه السلام" },
      { en: "Dawud", ar: "داود عليه السلام" }
    ],
    answerIndex: 0,
    explanation: { en: "Allah commanded Prophet Nuh to construct the Ark.", ar: "أمر الله نبيه نوحاً عليه السلام بصنع السفينة." },
    reference: "Qur’an 11:37"
  },
  {
    id: "kids-iqra",
    mode: "kids",
    prompt: { en: "What does the first word of Surah al-‘Alaq tell us to do?", ar: "ماذا تأمرنا أول كلمة في سورة العلق؟" },
    choices: [
      { en: "Read / Recite", ar: "اقرأ" },
      { en: "Sleep", ar: "نم" },
      { en: "Travel", ar: "سافر" },
      { en: "Eat", ar: "كُل" }
    ],
    answerIndex: 0,
    explanation: { en: "Surah al-‘Alaq begins with the command to read or recite in the name of your Lord.", ar: "تبدأ سورة العلق بالأمر بالقراءة باسم الله." },
    reference: "Qur’an 96:1"
  },
  {
    id: "adult-burden",
    mode: "adults",
    prompt: { en: "Which verse says Allah does not burden a soul beyond its capacity?", ar: "أي آية تقرر أن الله لا يكلف نفساً إلا وسعها؟" },
    choices: [
      { en: "Al-Baqarah 2:286", ar: "البقرة ٢:٢٨٦" },
      { en: "Al-Fatihah 1:1", ar: "الفاتحة ١:١" },
      { en: "Al-Ikhlas 112:1", ar: "الإخلاص ١١٢:١" },
      { en: "Al-Kawthar 108:1", ar: "الكوثر ١٠٨:١" }
    ],
    answerIndex: 0,
    explanation: { en: "This principle appears in the closing verse of Surah al-Baqarah.", ar: "يرد هذا المعنى في آخر آية من سورة البقرة." },
    reference: "Qur’an 2:286"
  },
  {
    id: "adult-kursi",
    mode: "adults",
    prompt: { en: "In which surah is Ayat al-Kursi found?", ar: "في أي سورة توجد آية الكرسي؟" },
    choices: [
      { en: "Al-Baqarah", ar: "البقرة" },
      { en: "Al-Mulk", ar: "الملك" },
      { en: "Ya-Sin", ar: "يس" },
      { en: "Maryam", ar: "مريم" }
    ],
    answerIndex: 0,
    explanation: { en: "Ayat al-Kursi is verse 255 of Surah al-Baqarah.", ar: "آية الكرسي هي الآية ٢٥٥ من سورة البقرة." },
    reference: "Qur’an 2:255"
  },
  {
    id: "adult-compulsion",
    mode: "adults",
    prompt: { en: "‘There is no compulsion in religion’ appears in which verse?", ar: "في أي آية ورد معنى: لا إكراه في الدين؟" },
    choices: [
      { en: "2:256", ar: "٢:٢٥٦" },
      { en: "24:35", ar: "٢٤:٣٥" },
      { en: "36:1", ar: "٣٦:١" },
      { en: "55:13", ar: "٥٥:١٣" }
    ],
    answerIndex: 0,
    explanation: { en: "This statement appears in Surah al-Baqarah, verse 256.", ar: "يرد هذا المعنى في سورة البقرة، الآية ٢٥٦." },
    reference: "Qur’an 2:256"
  },
  {
    id: "adult-hardship",
    mode: "adults",
    prompt: { en: "Which surah repeats that with hardship comes ease?", ar: "أي سورة تكرر أن مع العسر يسراً؟" },
    choices: [
      { en: "Ash-Sharh", ar: "الشرح" },
      { en: "Al-Fil", ar: "الفيل" },
      { en: "Al-Masad", ar: "المسد" },
      { en: "Quraysh", ar: "قريش" }
    ],
    answerIndex: 0,
    explanation: { en: "Surah Ash-Sharh repeats this reassurance in consecutive verses.", ar: "تكرر سورة الشرح هذا الوعد في آيتين متتاليتين." },
    reference: "Qur’an 94:5–6"
  },
  {
    id: "adult-revelation",
    mode: "adults",
    prompt: { en: "The opening verses traditionally identified with the first revelation are in which surah?", ar: "الآيات الافتتاحية المرتبطة ببداية الوحي تقع في أي سورة؟" },
    choices: [
      { en: "Al-‘Alaq", ar: "العلق" },
      { en: "Al-Baqarah", ar: "البقرة" },
      { en: "Al-Falaq", ar: "الفلق" },
      { en: "At-Tin", ar: "التين" }
    ],
    answerIndex: 0,
    explanation: { en: "Surah al-‘Alaq opens with the command to read or recite in the name of your Lord.", ar: "تبدأ سورة العلق بالأمر بالقراءة باسم الله." },
    reference: "Qur’an 96:1–5"
  },
  {
    id: "adult-house",
    mode: "adults",
    prompt: { en: "Who raised the foundations of the Sacred House according to Qur’an 2:127?", ar: "من رفع قواعد البيت بحسب سورة البقرة ٢:١٢٧؟" },
    choices: [
      { en: "Ibrahim and Ismail", ar: "إبراهيم وإسماعيل عليهما السلام" },
      { en: "Musa and Harun", ar: "موسى وهارون عليهما السلام" },
      { en: "Dawud and Sulayman", ar: "داود وسليمان عليهما السلام" },
      { en: "Nuh and Lut", ar: "نوح ولوط عليهما السلام" }
    ],
    answerIndex: 0,
    explanation: { en: "The verse names Ibrahim and Ismail as they raise the foundations of the House.", ar: "تذكر الآية إبراهيم وإسماعيل عليهما السلام وهما يرفعان قواعد البيت." },
    reference: "Qur’an 2:127"
  }
];

export const EMPTY_QUIZ_STATS: QuizStats = {
  totalWins: 0,
  streak: 0,
  bestStreak: 0,
  lastWinDate: null,
  completed: []
};

function hash(value: string) {
  let result = 0;
  for (let index = 0; index < value.length; index += 1) {
    result = (result * 31 + value.charCodeAt(index)) >>> 0;
  }
  return result;
}

function dayNumber(dateKey: string) {
  const [year = 1970, month = 1, day = 1] = dateKey.split("-").map(Number);
  return Math.floor(Date.UTC(year, month - 1, day) / 86_400_000);
}

export function dailyQuizQuestions(mode: QuizMode, dateKey: string, count = 3): QuizQuestion[] {
  const pool = QUESTIONS.filter((question) => question.mode === mode);
  if (!pool.length) return [];
  if (pool.length <= count) return pool;
  const start = hash(`${mode}:${dateKey}`) % pool.length;
  return Array.from({ length: count }, (_unused, index) => pool[(start + index) % pool.length] ?? pool[0]!);
}

export function badgeForWins(totalWins: number): QuizBadge {
  return [...BADGES].reverse().find((badge) => totalWins >= badge.minWins) ?? BADGES[0];
}

export function nextBadge(totalWins: number): QuizBadge | null {
  return BADGES.find((badge) => badge.minWins > totalWins) ?? null;
}

export function completedToday(stats: QuizStats, mode: QuizMode, dateKey: string) {
  return stats.completed.includes(`${dateKey}:${mode}`);
}

export async function loadQuizStats(): Promise<QuizStats> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY_QUIZ_STATS;
    const parsed = JSON.parse(raw) as Partial<QuizStats>;
    return {
      totalWins: Number.isFinite(parsed.totalWins) ? Math.max(0, Number(parsed.totalWins)) : 0,
      streak: Number.isFinite(parsed.streak) ? Math.max(0, Number(parsed.streak)) : 0,
      bestStreak: Number.isFinite(parsed.bestStreak) ? Math.max(0, Number(parsed.bestStreak)) : 0,
      lastWinDate: typeof parsed.lastWinDate === "string" ? parsed.lastWinDate : null,
      completed: Array.isArray(parsed.completed) ? parsed.completed.filter((value): value is string => typeof value === "string").slice(-180) : []
    };
  } catch {
    return EMPTY_QUIZ_STATS;
  }
}

export async function recordQuizWin(stats: QuizStats, mode: QuizMode, dateKey: string) {
  const completionKey = `${dateKey}:${mode}`;
  if (stats.completed.includes(completionKey)) return stats;

  let streak = 1;
  if (stats.lastWinDate === dateKey) {
    streak = stats.streak;
  } else if (stats.lastWinDate && dayNumber(dateKey) - dayNumber(stats.lastWinDate) === 1) {
    streak = stats.streak + 1;
  }

  const updated: QuizStats = {
    totalWins: stats.totalWins + 1,
    streak,
    bestStreak: Math.max(stats.bestStreak, streak),
    lastWinDate: dateKey,
    completed: [...stats.completed, completionKey].slice(-180)
  };
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  return updated;
}
