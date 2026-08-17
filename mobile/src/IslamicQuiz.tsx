import { useEffect, useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import {
  badgeForWins,
  completedToday,
  dailyQuizQuestions,
  nextBadge,
  recordQuizWin,
  type QuizLocale,
  type QuizMode,
  type QuizStats
} from "./islamicQuiz";

type Props = {
  locale: QuizLocale;
  dateKey: string;
  stats: QuizStats;
  onStatsChange: (stats: QuizStats) => void;
  onBackHome: () => void;
};

export default function IslamicQuiz({ locale, dateKey, stats, onStatsChange, onBackHome }: Props) {
  const [mode, setMode] = useState<QuizMode>("kids");
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);
  const [resultStats, setResultStats] = useState<QuizStats | null>(null);

  const questions = useMemo(() => dailyQuizQuestions(mode, dateKey), [mode, dateKey]);
  const question = questions[index] ?? questions[0]!;
  const badge = badgeForWins(stats.totalWins);
  const upcoming = nextBadge(stats.totalWins);
  const alreadyDone = completedToday(stats, mode, dateKey);

  useEffect(() => {
    setIndex(0);
    setSelected(null);
    setScore(0);
    setFinished(false);
    setResultStats(null);
  }, [mode, dateKey]);

  const copy = locale === "ar" ? {
    title: "مسابقة إسلامية يومية",
    subtitle: "ثلاثة أسئلة كل يوم. تعلّم، حافظ على السلسلة، وارفع شارتك.",
    kids: "الأطفال",
    adults: "الكبار",
    question: "السؤال",
    of: "من",
    correct: "إجابة صحيحة ✨",
    wrong: "ليست الإجابة الصحيحة هذه المرة",
    next: "التالي",
    finish: "إنهاء المسابقة",
    passed: "فزت بمسابقة اليوم!",
    missed: "قريب جداً — حاول مرة أخرى",
    retry: "العب مرة أخرى",
    score: "النتيجة",
    streak: "سلسلة الأيام",
    wins: "إجمالي الانتصارات",
    badge: "شارتك",
    completed: "لقد فزت بهذه المسابقة اليوم. يمكنك اللعب مجدداً للتدريب، لكن الفوز يُحسب مرة واحدة يومياً لكل مستوى.",
    home: "العودة للرئيسية",
    nextBadge: "الشارة القادمة",
    moreWins: "انتصارات إضافية",
    source: "المصدر"
  } : {
    title: "Daily Islamic Quiz",
    subtitle: "Three questions every day. Learn, keep your streak, and level up your badge.",
    kids: "Kids",
    adults: "Adults",
    question: "Question",
    of: "of",
    correct: "Correct ✨",
    wrong: "Not quite this time",
    next: "Next question",
    finish: "Finish quiz",
    passed: "You won today’s quiz!",
    missed: "So close — try again",
    retry: "Play again",
    score: "Score",
    streak: "Day streak",
    wins: "Total wins",
    badge: "Your badge",
    completed: "You already won this quiz today. You can replay for practice, but a win counts once per day for each level.",
    home: "Back to Home",
    nextBadge: "Next badge",
    moreWins: "more wins",
    source: "Source"
  };

  if (!questions.length) {
    return (
      <View style={styles.emptyScreen}>
        <Text style={styles.resultEmoji}>📚</Text>
        <Text style={styles.resultTitle}>Quiz unavailable</Text>
        <Pressable onPress={onBackHome} style={styles.primaryButton}><Text style={styles.primaryButtonText}>{copy.home}</Text></Pressable>
      </View>
    );
  }

  const choose = (choiceIndex: number) => {
    if (selected !== null) return;
    setSelected(choiceIndex);
    if (choiceIndex === question.answerIndex) setScore((value) => value + 1);
  };

  const restart = () => {
    setIndex(0);
    setSelected(null);
    setScore(0);
    setFinished(false);
    setResultStats(null);
  };

  const advance = async () => {
    if (selected === null) return;
    if (index < questions.length - 1) {
      setIndex((value) => value + 1);
      setSelected(null);
      return;
    }

    setFinished(true);
    if (score >= 2 && !alreadyDone) {
      const updated = await recordQuizWin(stats, mode, dateKey);
      setResultStats(updated);
      onStatsChange(updated);
    } else {
      setResultStats(stats);
    }
  };

  if (finished) {
    const shownStats = resultStats ?? stats;
    const won = score >= 2;
    const resultBadge = badgeForWins(shownStats.totalWins);
    return (
      <ScrollView contentContainerStyle={styles.screen} showsVerticalScrollIndicator={false}>
        <View style={styles.resultHero}>
          <Text style={styles.resultEmoji}>{won ? "🎉" : "🌱"}</Text>
          <Text style={styles.resultTitle}>{won ? copy.passed : copy.missed}</Text>
          <Text style={styles.resultScore}>{copy.score}: {score}/{questions.length}</Text>
        </View>

        <View style={styles.badgeCard}>
          <View style={styles.badgeIcon}><Text style={styles.badgeEmoji}>{resultBadge.emoji}</Text></View>
          <View style={styles.badgeCopy}>
            <Text style={styles.metaLabel}>{copy.badge}</Text>
            <Text style={styles.badgeName}>{resultBadge.name[locale]}</Text>
          </View>
          <View style={styles.statBubble}>
            <Text style={styles.statNumber}>{shownStats.totalWins}</Text>
            <Text style={styles.statTiny}>{copy.wins}</Text>
          </View>
        </View>

        {alreadyDone ? <Text style={styles.completedNote}>{copy.completed}</Text> : null}

        <Pressable onPress={restart} style={styles.primaryButton}>
          <Text style={styles.primaryButtonText}>{copy.retry}</Text>
        </Pressable>
        <Pressable onPress={onBackHome} style={styles.secondaryButton}>
          <Text style={styles.secondaryButtonText}>{copy.home}</Text>
        </Pressable>
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.screen} showsVerticalScrollIndicator={false}>
      <View style={styles.topRow}>
        <View style={styles.titleWrap}>
          <Text style={styles.eyebrow}>🧠 HASSOUN QUIZ</Text>
          <Text style={styles.title}>{copy.title}</Text>
          <Text style={styles.subtitle}>{copy.subtitle}</Text>
        </View>
        <View style={styles.badgeMini}>
          <Text style={styles.badgeMiniEmoji}>{badge.emoji}</Text>
          <Text style={styles.badgeMiniText}>{badge.name[locale]}</Text>
        </View>
      </View>

      <View style={styles.modeTabs}>
        <Pressable onPress={() => setMode("kids")} style={[styles.modeButton, mode === "kids" && styles.modeButtonActive]}>
          <Text style={[styles.modeText, mode === "kids" && styles.modeTextActive]}>🧒 {copy.kids}</Text>
        </Pressable>
        <Pressable onPress={() => setMode("adults")} style={[styles.modeButton, mode === "adults" && styles.modeButtonActive]}>
          <Text style={[styles.modeText, mode === "adults" && styles.modeTextActive]}>🧠 {copy.adults}</Text>
        </Pressable>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statCard}><Text style={styles.statIcon}>🔥</Text><Text style={styles.statNumber}>{stats.streak}</Text><Text style={styles.statLabel}>{copy.streak}</Text></View>
        <View style={styles.statCard}><Text style={styles.statIcon}>🏆</Text><Text style={styles.statNumber}>{stats.totalWins}</Text><Text style={styles.statLabel}>{copy.wins}</Text></View>
        <View style={styles.statCard}><Text style={styles.statIcon}>{badge.emoji}</Text><Text style={styles.statNumber}>{badge.name[locale]}</Text><Text style={styles.statLabel}>{copy.badge}</Text></View>
      </View>

      {upcoming ? (
        <View style={styles.progressCard}>
          <Text style={styles.progressEmoji}>{upcoming.emoji}</Text>
          <View style={styles.progressCopy}>
            <Text style={styles.progressTitle}>{copy.nextBadge}: {upcoming.name[locale]}</Text>
            <Text style={styles.progressText}>{Math.max(0, upcoming.minWins - stats.totalWins)} {copy.moreWins}</Text>
          </View>
        </View>
      ) : null}

      {alreadyDone ? <Text style={styles.completedNote}>{copy.completed}</Text> : null}

      <View style={styles.questionCard}>
        <View style={styles.questionTop}>
          <Text style={styles.questionCounter}>{copy.question} {index + 1} {copy.of} {questions.length}</Text>
          <Text style={styles.questionMode}>{mode === "kids" ? "🌙" : "📚"}</Text>
        </View>
        <Text style={styles.questionText}>{question.prompt[locale]}</Text>

        <View style={styles.choiceList}>
          {question.choices.map((choice, choiceIndex) => {
            const isSelected = selected === choiceIndex;
            const isCorrect = selected !== null && choiceIndex === question.answerIndex;
            const isWrong = isSelected && choiceIndex !== question.answerIndex;
            return (
              <Pressable key={`${question.id}-${choiceIndex}`} onPress={() => choose(choiceIndex)} style={[styles.choice, isCorrect && styles.choiceCorrect, isWrong && styles.choiceWrong]}>
                <View style={[styles.choiceLetter, isCorrect && styles.choiceLetterCorrect, isWrong && styles.choiceLetterWrong]}>
                  <Text style={styles.choiceLetterText}>{String.fromCharCode(65 + choiceIndex)}</Text>
                </View>
                <Text style={styles.choiceText}>{choice[locale]}</Text>
                {isCorrect ? <Text style={styles.choiceResult}>✓</Text> : null}
                {isWrong ? <Text style={styles.choiceResult}>×</Text> : null}
              </Pressable>
            );
          })}
        </View>

        {selected !== null ? (
          <View style={[styles.explanation, selected === question.answerIndex ? styles.explanationCorrect : styles.explanationWrong]}>
            <Text style={styles.explanationTitle}>{selected === question.answerIndex ? copy.correct : copy.wrong}</Text>
            <Text style={styles.explanationText}>{question.explanation[locale]}</Text>
            <Text style={styles.reference}>{copy.source}: {question.reference}</Text>
          </View>
        ) : null}
      </View>

      <Pressable onPress={() => void advance()} disabled={selected === null} style={[styles.primaryButton, selected === null && styles.primaryButtonDisabled]}>
        <Text style={styles.primaryButtonText}>{index === questions.length - 1 ? copy.finish : copy.next}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { padding: 18, paddingBottom: 32, backgroundColor: "#f7f4ec" },
  emptyScreen: { flex: 1, backgroundColor: "#f7f4ec", alignItems: "center", justifyContent: "center", padding: 24 },
  topRow: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  titleWrap: { flex: 1 },
  eyebrow: { color: "#17705b", fontSize: 10, fontWeight: "900", letterSpacing: 1.4 },
  title: { color: "#173f35", fontSize: 28, lineHeight: 33, fontWeight: "900", marginTop: 5 },
  subtitle: { color: "#6d7d77", fontSize: 13, lineHeight: 19, marginTop: 5 },
  badgeMini: { minWidth: 88, alignItems: "center", backgroundColor: "#fff", borderRadius: 18, padding: 10, borderWidth: 1, borderColor: "#e1ddd3" },
  badgeMiniEmoji: { fontSize: 27 },
  badgeMiniText: { color: "#385a51", fontSize: 10, fontWeight: "800", marginTop: 3, textAlign: "center" },
  modeTabs: { flexDirection: "row", gap: 8, marginTop: 18, backgroundColor: "#ebe6dc", borderRadius: 16, padding: 4 },
  modeButton: { flex: 1, minHeight: 44, alignItems: "center", justifyContent: "center", borderRadius: 12 },
  modeButtonActive: { backgroundColor: "#fff", shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 8, elevation: 1 },
  modeText: { color: "#7a817d", fontSize: 13, fontWeight: "800" },
  modeTextActive: { color: "#0b5b47" },
  statsRow: { flexDirection: "row", gap: 8, marginTop: 12 },
  statCard: { flex: 1, minHeight: 82, alignItems: "center", justifyContent: "center", backgroundColor: "#fff", borderRadius: 17, borderWidth: 1, borderColor: "#e2dfd6", padding: 8 },
  statIcon: { fontSize: 19 },
  statNumber: { color: "#173f35", fontSize: 16, fontWeight: "900", marginTop: 3, textAlign: "center" },
  statLabel: { color: "#8a928e", fontSize: 9, fontWeight: "700", marginTop: 2, textAlign: "center" },
  progressCard: { flexDirection: "row", alignItems: "center", gap: 11, marginTop: 12, backgroundColor: "#edf5f0", borderRadius: 17, padding: 13 },
  progressEmoji: { fontSize: 25 },
  progressCopy: { flex: 1 },
  progressTitle: { color: "#204e41", fontSize: 12, fontWeight: "900" },
  progressText: { color: "#71817b", fontSize: 10, marginTop: 2 },
  completedNote: { color: "#6b654f", backgroundColor: "#fff6db", borderRadius: 14, padding: 12, fontSize: 11, lineHeight: 17, marginTop: 12 },
  questionCard: { marginTop: 15, backgroundColor: "#fff", borderRadius: 24, borderWidth: 1, borderColor: "#dfddd5", padding: 18 },
  questionTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  questionCounter: { color: "#178066", fontSize: 10, fontWeight: "900", letterSpacing: 1 },
  questionMode: { fontSize: 22 },
  questionText: { color: "#173f35", fontSize: 21, lineHeight: 28, fontWeight: "900", marginTop: 13 },
  choiceList: { gap: 9, marginTop: 17 },
  choice: { minHeight: 58, flexDirection: "row", alignItems: "center", gap: 11, borderRadius: 16, borderWidth: 1.5, borderColor: "#e0e3df", backgroundColor: "#fbfcfa", paddingHorizontal: 12 },
  choiceCorrect: { borderColor: "#58a98d", backgroundColor: "#ebf7f1" },
  choiceWrong: { borderColor: "#d99688", backgroundColor: "#fff0ed" },
  choiceLetter: { width: 32, height: 32, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: "#eef1ed" },
  choiceLetterCorrect: { backgroundColor: "#cde9de" },
  choiceLetterWrong: { backgroundColor: "#f5d7d0" },
  choiceLetterText: { color: "#4d615a", fontSize: 12, fontWeight: "900" },
  choiceText: { flex: 1, color: "#2e5148", fontSize: 13, lineHeight: 18, fontWeight: "700" },
  choiceResult: { color: "#0b5b47", fontSize: 18, fontWeight: "900" },
  explanation: { marginTop: 14, borderRadius: 15, padding: 13 },
  explanationCorrect: { backgroundColor: "#edf8f3" },
  explanationWrong: { backgroundColor: "#fff5ec" },
  explanationTitle: { color: "#174f40", fontSize: 13, fontWeight: "900" },
  explanationText: { color: "#657770", fontSize: 11, lineHeight: 17, marginTop: 4 },
  reference: { color: "#0b7057", fontSize: 10, fontWeight: "800", marginTop: 6 },
  primaryButton: { minHeight: 55, borderRadius: 17, backgroundColor: "#0b5b47", alignItems: "center", justifyContent: "center", marginTop: 14, paddingHorizontal: 16, alignSelf: "stretch" },
  primaryButtonDisabled: { opacity: 0.35 },
  primaryButtonText: { color: "#fff", fontSize: 14, fontWeight: "900" },
  secondaryButton: { minHeight: 51, borderRadius: 17, backgroundColor: "#fff", borderWidth: 1, borderColor: "#d8ddd8", alignItems: "center", justifyContent: "center", marginTop: 9 },
  secondaryButtonText: { color: "#245548", fontSize: 13, fontWeight: "900" },
  resultHero: { alignItems: "center", paddingVertical: 26 },
  resultEmoji: { fontSize: 54 },
  resultTitle: { color: "#173f35", fontSize: 27, fontWeight: "900", marginTop: 10, textAlign: "center" },
  resultScore: { color: "#73827c", fontSize: 14, fontWeight: "800", marginTop: 5 },
  badgeCard: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#fff", borderRadius: 22, borderWidth: 1, borderColor: "#e0ddd5", padding: 15 },
  badgeIcon: { width: 54, height: 54, borderRadius: 18, backgroundColor: "#f0f6f2", alignItems: "center", justifyContent: "center" },
  badgeEmoji: { fontSize: 30 },
  badgeCopy: { flex: 1 },
  metaLabel: { color: "#8d9893", fontSize: 9, fontWeight: "900", letterSpacing: 1 },
  badgeName: { color: "#173f35", fontSize: 17, fontWeight: "900", marginTop: 3 },
  statBubble: { alignItems: "center", minWidth: 66 },
  statTiny: { color: "#89948f", fontSize: 9, textAlign: "center" }
});
