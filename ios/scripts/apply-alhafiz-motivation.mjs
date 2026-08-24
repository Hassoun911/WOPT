import fs from 'node:fs';

const path = 'src/quran/AlHafizClassroom.tsx';
let src = fs.readFileSync(path, 'utf8');

function must(condition, message) {
  if (!condition) throw new Error(message);
}

if (src.includes('type Badge = {') && src.includes('AI MEMORIZATION COACH')) {
  console.log('Al-Hafiz motivation upgrade is already applied.');
  process.exit(0);
}

const progressStart = src.indexOf('function distinctPracticeDays(attempts: Attempt[])');
const progressEnd = src.indexOf('function formatDate(value: number, locale: QuranLocale)', progressStart);
must(progressStart >= 0 && progressEnd > progressStart, 'Could not find Al-Hafiz progress helper block');

const progressBlock = String.raw`function practiceDayKeys(attempts: Attempt[]) {
  return [...new Set(attempts.map((attempt) => new Date(attempt.at).toISOString().slice(0, 10)))].sort();
}

function distinctPracticeDays(attempts: Attempt[]) {
  return practiceDayKeys(attempts).length;
}

function practiceStreak(attempts: Attempt[]) {
  const days = new Set(practiceDayKeys(attempts));
  if (!days.size) return 0;
  let cursor = new Date();
  const today = cursor.toISOString().slice(0, 10);
  cursor.setUTCDate(cursor.getUTCDate() - 1);
  const yesterday = cursor.toISOString().slice(0, 10);
  if (!days.has(today) && !days.has(yesterday)) return 0;
  cursor = days.has(today) ? new Date() : new Date(Date.now() - 86_400_000);
  let streak = 0;
  while (days.has(cursor.toISOString().slice(0, 10))) {
    streak += 1;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return streak;
}

function starsEarned(attempts: Attempt[]) {
  return attempts.reduce((sum, attempt) => sum + (attempt.percent >= 95 ? 3 : attempt.percent >= 85 ? 2 : attempt.percent >= 70 ? 1 : 0), 0);
}

type Badge = {
  id: string;
  emoji: string;
  titleEn: string;
  titleAr: string;
  earned: boolean;
  progress: number;
  goal: number;
};

function badgeData(lessons: Lesson[], attempts: Attempt[]): Badge[] {
  const best = attempts.reduce((value, attempt) => Math.max(value, attempt.percent), 0);
  const masteredCards = new Set(
    attempts.filter((a) => a.scope === "card" && a.percent >= 90).map((a) => a.lessonId + ":" + a.cardId)
  ).size;
  const days = distinctPracticeDays(attempts);
  const streak = practiceStreak(attempts);
  const stars = starsEarned(attempts);
  const perfect = attempts.filter((a) => a.percent === 100).length;
  const make = (id: string, emoji: string, titleEn: string, titleAr: string, progress: number, goal: number): Badge => ({
    id, emoji, titleEn, titleAr, progress, goal, earned: progress >= goal
  });
  return [
    make("first", "📘", "First Lesson", "أول درس", lessons.length, 1),
    make("explorer", "🎒", "Lesson Explorer", "مستكشف الدروس", lessons.length, 3),
    make("library", "📚", "Qur’an Library", "مكتبة القرآن", lessons.length, 10),
    make("practice5", "⭐", "Practice Star", "نجم التدريب", attempts.length, 5),
    make("practice15", "🌱", "Rising Hafiz", "حافظ صاعد", attempts.length, 15),
    make("practice50", "🚀", "Learning Hero", "بطل التعلّم", attempts.length, 50),
    make("practice100", "🌟", "100 Practices", "١٠٠ تدريب", attempts.length, 100),
    make("memory80", "💚", "Strong Memory", "ذاكرة قوية", best, 80),
    make("memory95", "🏆", "Excellent Recall", "حفظ ممتاز", best, 95),
    make("perfect", "💯", "Perfect Recitation", "تسميع كامل", perfect, 1),
    make("cards3", "🧠", "Card Master", "متقن البطاقات", masteredCards, 3),
    make("cards10", "👑", "Memory Champion", "بطل الحفظ", masteredCards, 10),
    make("days3", "🔥", "3-Day Learner", "متعلم ٣ أيام", days, 3),
    make("days7", "🗓️", "Week of Qur’an", "أسبوع مع القرآن", days, 7),
    make("streak7", "⚡", "7-Day Streak", "سلسلة ٧ أيام", streak, 7),
    make("streak30", "🌙", "30-Day Journey", "رحلة ٣٠ يوماً", streak, 30),
    make("stars25", "✨", "25 Stars", "٢٥ نجمة", stars, 25),
    make("stars100", "🌠", "100 Stars", "١٠٠ نجمة", stars, 100)
  ];
}

function teacherCoach(lessons: Lesson[], attempts: Attempt[], activeLesson: Lesson | null, locale: QuranLocale) {
  const ar = locale === "ar";
  if (!lessons.length) {
    return ar
      ? "أنا معك خطوة بخطوة 🤖✨ ابدأ بسورة قصيرة أو 3–5 آيات. هدفنا اليوم: درس صغير واحد فقط."
      : "I’m with you step by step 🤖✨ Start with a short Surah or 3–5 ayahs. Today’s mission: create just one small lesson.";
  }
  if (!attempts.length) {
    return ar
      ? "أول تحدٍ لك 🎯 استمع للبطاقة مرتين، اقرأ معها مرة، ثم أخفِ النص وجرّب. أول محاولاتك تبدأ بفتح الشارات."
      : "Your first challenge 🎯 Listen twice, read along once, then hide the text and try. Your first practices start unlocking badges.";
  }
  const relevant = activeLesson ? attempts.filter((a) => a.lessonId === activeLesson.id) : attempts;
  const pool = relevant.length ? relevant : attempts;
  const recent = pool.slice(-5);
  const average = Math.round(recent.reduce((sum, a) => sum + a.percent, 0) / Math.max(1, recent.length));
  const weak = new Map<string, number>();
  recent.forEach((a) => a.feedback.filter((f) => f.status !== "correct").forEach((f) => weak.set(f.word, (weak.get(f.word) ?? 0) + 1)));
  const weakWords = [...weak.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([word]) => word);
  const streak = practiceStreak(attempts);
  if (average >= 95) {
    return ar
      ? "ما شاء الله 🌟 متوسطك " + average + "٪. أنت جاهز لتحدٍ أقوى: اختبر الدرس كاملاً من غير نص. حافظ على سلسلة " + Math.max(1, streak) + " يوم."
      : "Masha’Allah 🌟 Your recent average is " + average + "%. You’re ready for a bigger challenge: test the whole lesson with no text. Keep your " + Math.max(1, streak) + "-day momentum going.";
  }
  if (average >= 82) {
    const focus = weakWords.join(" • ") || (ar ? "أصعب الكلمات" : "your hardest words");
    return ar
      ? "عمل قوي! 💪 متوسطك " + average + "٪. نصيحتي الذكية: راجع " + focus + " ثم أعد بطاقة واحدة وحاول الوصول إلى 95٪."
      : "Strong work! 💪 Your recent average is " + average + "%. AI tip: review " + focus + ", then retest one card and aim for 95%.";
  }
  if (average >= 65) {
    return ar
      ? "أنت تتحسن 🌱 متوسطك " + average + "٪. اجعل التدريب خفيفاً: استمع للبطاقة 2–3 مرات، قسمها إلى مقاطع قصيرة، ثم جرّب مرة أخرى."
      : "You’re improving 🌱 Your recent average is " + average + "%. Keep today light: listen 2–3 times, break the card into short pieces, then try again.";
  }
  return ar
    ? "كل حافظ بدأ بمحاولات صغيرة 💚 متوسطك " + average + "٪. ركّز على بطاقة واحدة، استمع ببطء، وردد آية آية. العودة والمحاولة مرة أخرى هي تقدم."
    : "Every strong memorizer started with small tries 💚 Your recent average is " + average + "%. Focus on one card, listen slowly, repeat ayah by ayah, and try again. Showing up again is progress.";
}

function motivationMessage(lessons: Lesson[], attempts: Attempt[], locale: QuranLocale) {
  const ar = locale === "ar";
  const streak = practiceStreak(attempts);
  const stars = starsEarned(attempts);
  if (!attempts.length) return ar ? "ابدأ اليوم واكسب أول نجومك ⭐ كل آية تحفظها إنجاز." : "Start today and earn your first stars ⭐ Every ayah you learn is a win.";
  if (streak >= 7) return ar ? "🔥 " + streak + " أيام من الاستمرار! أنت تبني عادة جميلة مع القرآن." : "🔥 " + streak + "-day streak! You’re building a beautiful Qur’an habit.";
  if (stars >= 50) return ar ? "🌟 جمعت " + stars + " نجمة! استمر، كل تدريب يقربك من الشارة التالية." : "🌟 You’ve earned " + stars + " stars! Keep going—every practice moves you toward the next badge.";
  if (lessons.length >= 3) return ar ? "🎒 رائع! لديك عدة دروس الآن. اختر درساً واحداً اليوم وأتقن بطاقة واحدة." : "🎒 Great progress! You have several lessons now. Pick one today and master just one card.";
  return ar ? "✨ تقدمك يُحسب حتى لو كان قليلاً. تدرب اليوم لدقائق قليلة وحافظ على الاستمرار." : "✨ Small progress still counts. Practice for a few minutes today and keep your momentum alive.";
}

`;

src = src.slice(0, progressStart) + progressBlock + src.slice(progressEnd);

const derivedPattern = /  const badges = badgeData\(lessons, attempts\);[\s\S]*?  const coach = teacherCoach\(lessons, attempts, activeLesson, locale\);\n/;
must(derivedPattern.test(src), 'Could not find Al-Hafiz derived progress state');
src = src.replace(derivedPattern, String.raw`  const badges = badgeData(lessons, attempts);
  const earnedBadges = badges.filter((badge) => badge.earned);
  const stars = starsEarned(attempts);
  const bestScore = attempts.reduce((best, a) => Math.max(best, a.percent), 0);
  const masteredCards = new Set(attempts.filter((a) => a.scope === "card" && a.percent >= 90).map((a) => a.lessonId + ":" + a.cardId)).size;
  const streak = practiceStreak(attempts);
  const coach = teacherCoach(lessons, attempts, activeLesson, locale);
  const motivation = motivationMessage(lessons, attempts, locale);
  const nextBadge = badges.find((badge) => !badge.earned) ?? null;
`);

const summaryStart = src.indexOf('      <View style={styles.summaryRow}>');
const teacherStart = src.indexOf('      <View style={styles.teacherNote}>', summaryStart);
must(summaryStart >= 0 && teacherStart > summaryStart, 'Could not find Al-Hafiz summary section');
const newSummary = String.raw`      <View style={styles.summaryRow}>
        <View style={styles.summaryTile}><Text style={styles.summaryEmoji}>📚</Text><Text style={styles.summaryValue}>{lessons.length}</Text><Text style={styles.summaryLabel}>{t("Lessons", "دروس")}</Text></View>
        <View style={styles.summaryTile}><Text style={styles.summaryEmoji}>🧠</Text><Text style={styles.summaryValue}>{masteredCards}</Text><Text style={styles.summaryLabel}>{t("Mastered", "متقن")}</Text></View>
        <View style={styles.summaryTile}><Text style={styles.summaryEmoji}>🔥</Text><Text style={styles.summaryValue}>{streak}</Text><Text style={styles.summaryLabel}>{t("Day streak", "أيام متتالية")}</Text></View>
        <View style={styles.summaryTile}><Text style={styles.summaryEmoji}>🏆</Text><Text style={styles.summaryValue}>{bestScore}%</Text><Text style={styles.summaryLabel}>{t("Best", "أفضل")}</Text></View>
      </View>

      <View style={styles.motivationBanner}>
        <Text style={styles.motivationEmoji}>🌟</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.motivationLabel}>{t("KEEP LEARNING • YOU’RE DOING GREAT", "استمر بالتعلّم • أنت تتقدم")}</Text>
          <Text style={styles.motivationText}>{motivation}</Text>
        </View>
      </View>

`;
src = src.slice(0, summaryStart) + newSummary + src.slice(teacherStart);

const teacherOld = String.raw`          <Text style={styles.teacherLabel}>{t("AI TEACHER • TODAY'S TIP", "المعلم الذكي • نصيحة اليوم")}</Text>
          <Text style={styles.teacherText}>{coach}</Text>`;
const teacherNew = String.raw`          <Text style={styles.teacherLabel}>{t("AI MEMORIZATION COACH • PERSONAL TIP", "مدرب الحفظ الذكي • نصيحة شخصية")}</Text>
          <Text style={styles.teacherText}>{coach}</Text>
          {nextBadge ? <View style={styles.aiMission}><Text style={styles.aiMissionTitle}>🎯 {t("Next mission", "المهمة التالية")}: {ar ? nextBadge.titleAr : nextBadge.titleEn}</Text><Text style={styles.aiMissionText}>{Math.min(nextBadge.progress, nextBadge.goal)}/{nextBadge.goal} • {t("Keep learning to unlock it", "استمر بالتعلّم لفتحها")}</Text><View style={styles.progressTrack}><View style={[styles.progressFill, { width: (Math.min(100, Math.round((nextBadge.progress / Math.max(1, nextBadge.goal)) * 100)) + "%") as any }]} /></View></View> : null}`;
must(src.includes(teacherOld), 'Could not find AI Teacher text');
src = src.replace(teacherOld, teacherNew);

const badgeOld = String.raw`        {badges.map((badge) => <View key={badge.id} style={[styles.badge, !badge.earned && styles.badgeLocked]}><Text style={styles.badgeEmoji}>{badge.earned ? badge.emoji : "🔒"}</Text><Text style={styles.badgeTitle}>{badge.title}</Text></View>)}`;
const badgeNew = String.raw`        {badges.map((badge) => <View key={badge.id} style={[styles.badge, !badge.earned && styles.badgeLocked]}><Text style={styles.badgeEmoji}>{badge.earned ? badge.emoji : "🔒"}</Text><Text style={styles.badgeTitle}>{ar ? badge.titleAr : badge.titleEn}</Text><Text style={styles.badgeProgress}>{badge.earned ? t("Earned ✓", "تم الفوز ✓") : Math.min(badge.progress, badge.goal) + "/" + badge.goal}</Text></View>)}`;
must(src.includes(badgeOld), 'Could not find badge shelf rendering');
src = src.replace(badgeOld, badgeNew);

const footerStyle = '  footer: { color: "#877c69", fontSize: 9.5, lineHeight: 14, textAlign: "center", paddingHorizontal: 12 }';
must(src.includes(footerStyle), 'Could not find style insertion point');
const extraStyles = String.raw`  motivationBanner: { backgroundColor: "#eaf5e9", borderRadius: 20, padding: 13, borderWidth: 1, borderColor: "#a9cfad", flexDirection: "row", gap: 10, alignItems: "center" },
  motivationEmoji: { fontSize: 30 },
  motivationLabel: { color: "#2f7155", fontSize: 8.5, fontWeight: "900", letterSpacing: .7 },
  motivationText: { color: "#34554a", fontSize: 12, lineHeight: 17, fontWeight: "800", marginTop: 3 },
  aiMission: { marginTop: 9, backgroundColor: "rgba(255,255,255,.55)", borderRadius: 12, padding: 9 },
  aiMissionTitle: { color: "#4a5f55", fontSize: 10.5, fontWeight: "900" },
  aiMissionText: { color: "#786a4d", fontSize: 9.5, fontWeight: "800", marginTop: 3 },
  progressTrack: { height: 6, borderRadius: 3, backgroundColor: "#ddd3b5", marginTop: 7, overflow: "hidden" },
  progressFill: { height: 6, borderRadius: 3, backgroundColor: "#2f765c" },
  badgeProgress: { color: "#8a7651", fontSize: 8.5, fontWeight: "800", marginTop: 5, textAlign: "center" },
`;
src = src.replace(footerStyle, extraStyles + footerStyle);

fs.writeFileSync(path, src);
console.log('Applied Al-Hafiz motivation, badges, streaks, and AI coach upgrade.');
