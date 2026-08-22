import fs from 'node:fs';

const path = 'src/quran/AlHafizClassroom.tsx';
let src = fs.readFileSync(path, 'utf8');

function replaceOnce(from, to, label) {
  if (!src.includes(from)) throw new Error(`Missing Al-Hafiz anchor: ${label}`);
  src = src.replace(from, to);
}

replaceOnce(
`function distinctPracticeDays(attempts: Attempt[]) {
  return new Set(attempts.map((attempt) => new Date(attempt.at).toISOString().slice(0, 10))).size;
}

function badgeData(lessons: Lesson[], attempts: Attempt[]) {
  const best = attempts.reduce((value, attempt) => Math.max(value, attempt.percent), 0);
  const masteredCards = new Set(attempts.filter((a) => a.scope === "card" && a.percent >= 90).map((a) => \`${a.lessonId}:${a.cardId}\`)).size;
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
  if (average >= 92) return ar ? \`ما شاء الله! متوسطك الأخير ${average}٪. جرّب اختبار الدرس كاملاً بدون إظهار النص لتحصل على إتقان أقوى.\` : \`Masha’Allah! Your recent average is ${average}%. Try a full-lesson test with the text hidden to lock it in.\`;
  if (average >= 75) return ar ? \`أنت تتقدم جيداً (${average}٪). ركّز على ${weakWords.join(" • ") || "الكلمات الصعبة"} واستمع للبطاقة ثم أعد الاختبار.\` : \`You’re building strong recall (${average}%). Focus on ${weakWords.join(" • ") || "your weak words"}, listen once, then retest that card.\`;
  return ar ? \`لا بأس، التعلم خطوة خطوة 🌱 متوسطك ${average}٪. خذ بطاقة واحدة فقط، استمع لها 3 مرات، اقرأها، ثم اختبر نفسك.\` : \`One step at a time 🌱 Your recent average is ${average}%. Work on one card only: listen 3 times, read it, then test yourself.\`;
}

function starsEarned(attempts: Attempt[]) {
  return attempts.reduce((sum, attempt) => sum + (attempt.percent >= 95 ? 3 : attempt.percent >= 85 ? 2 : attempt.percent >= 70 ? 1 : 0), 0);
}
`,
`function practiceDayKeys(attempts: Attempt[]) {
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
  if (!days.has(today)) cursor = new Date(Date.now() - 86_400_000);
  else cursor = new Date();
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

type Badge = { id: string; emoji: string; titleEn: string; titleAr: string; earned: boolean; progress: number; goal: number };

function badgeData(lessons: Lesson[], attempts: Attempt[]): Badge[] {
  const best = attempts.reduce((value, attempt) => Math.max(value, attempt.percent), 0);
  const masteredCards = new Set(attempts.filter((a) => a.scope === "card" && a.percent >= 90).map((a) => \`${a.lessonId}:${a.cardId}\`)).size;
  const days = distinctPracticeDays(attempts);
  const streak = practiceStreak(attempts);
  const stars = starsEarned(attempts);
  const perfect = attempts.filter((a) => a.percent === 100).length;
  const make = (id: string, emoji: string, titleEn: string, titleAr: string, progress: number, goal: number): Badge => ({ id, emoji, titleEn, titleAr, progress, goal, earned: progress >= goal });
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
  if (!lessons.length) return ar ? "أنا معك خطوة بخطوة 🤖✨ ابدأ بسورة قصيرة أو 3–5 آيات. هدفنا اليوم: درس صغير واحد فقط." : "I’m with you step by step 🤖✨ Start with a short Surah or 3–5 ayahs. Today’s mission: create just one small lesson.";
  if (!attempts.length) return ar ? "أول تحدٍ لك 🎯 استمع للبطاقة مرتين، اقرأ معها مرة، ثم أخفِ النص وجرّب. أول محاولة تفتح لك شارة التدريب." : "Your first challenge 🎯 Listen twice, read along once, then hide the text and try. Your first practices start unlocking badges.";
  const relevant = activeLesson ? attempts.filter((a) => a.lessonId === activeLesson.id) : attempts;
  const pool = relevant.length ? relevant : attempts;
  const recent = pool.slice(-5);
  const average = Math.round(recent.reduce((sum, a) => sum + a.percent, 0) / Math.max(1, recent.length));
  const weak = new Map<string, number>();
  recent.forEach((a) => a.feedback.filter((f) => f.status !== "correct").forEach((f) => weak.set(f.word, (weak.get(f.word) ?? 0) + 1)));
  const weakWords = [...weak.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([word]) => word);
  const streak = practiceStreak(attempts);
  if (average >= 95) return ar ? \`ما شاء الله 🌟 متوسطك ${average}٪. أنت جاهز لتحدٍ أقوى: اختبر الدرس كاملاً من غير نص. حافظ على سلسلة ${streak || 1} يوم.\` : \`Masha’Allah 🌟 Your recent average is ${average}%. You’re ready for a bigger challenge: test the whole lesson with no text. Keep your ${streak || 1}-day momentum going.\`;
  if (average >= 82) return ar ? \`عمل قوي! 💪 متوسطك ${average}٪. نصيحتي الذكية: راجع ${weakWords.join(" • ") || "أصعب الكلمات"} ثم أعد بطاقة واحدة فقط لتحاول الوصول إلى 95٪.\` : \`Strong work! 💪 Your recent average is ${average}%. AI tip: review ${weakWords.join(" • ") || "your hardest words"}, then retest one card and aim for 95%.\`;
  if (average >= 65) return ar ? \`أنت تتحسن 🌱 متوسطك ${average}٪. لا تكثر اليوم: استمع للبطاقة 2–3 مرات، قسّمها إلى مقاطع قصيرة، ثم جرّب مرة أخرى.\` : \`You’re improving 🌱 Your recent average is ${average}%. Keep today light: listen 2–3 times, break the card into short pieces, then try again.\`;
  return ar ? \`كل حافظ بدأ بمحاولات صغيرة 💚 متوسطك ${average}٪. ركّز الآن على بطاقة واحدة فقط، استمع ببطء، وردد آية آية. النجاح هو أن تعود وتحاول مرة أخرى.\` : \`Every strong memorizer started with small tries 💚 Your recent average is ${average}%. Focus on one card, listen slowly, repeat ayah by ayah, and try again. Showing up again is progress.\`;
}

function motivationMessage(lessons: Lesson[], attempts: Attempt[], locale: QuranLocale) {
  const ar = locale === "ar";
  const streak = practiceStreak(attempts);
  const stars = starsEarned(attempts);
  if (!attempts.length) return ar ? "ابدأ اليوم واكسب أول نجومك ⭐ كل آية تحفظها إنجاز." : "Start today and earn your first stars ⭐ Every ayah you learn is a win.";
  if (streak >= 7) return ar ? \`🔥 ${streak} أيام من الاستمرار! أنت تبني عادة جميلة مع القرآن.\` : \`🔥 ${streak}-day streak! You’re building a beautiful Qur’an habit.\`;
  if (stars >= 50) return ar ? \`🌟 جمعت ${stars} نجمة! استمر، كل تدريب يقربك من الشارة التالية.\` : \`🌟 You’ve earned ${stars} stars! Keep going—every practice moves you toward the next badge.\`;
  if (lessons.length >= 3) return ar ? "🎒 رائع! لديك عدة دروس الآن. اختر درساً واحداً اليوم وأتقن بطاقة واحدة." : "🎒 Great progress! You have several lessons now. Pick one today and master just one card.";
  return ar ? "✨ تقدمك يُحسب حتى لو كان قليلاً. تدرب اليوم لدقائق قليلة وحافظ على السلسلة." : "✨ Small progress still counts. Practice for a few minutes today and keep your momentum alive.";
}
`,
'progress helpers');

replaceOnce(
`  const badges = badgeData(lessons, attempts);
  const earnedBadges = badges.filter((badge) => badge.earned);
  const stars = starsEarned(attempts);
  const bestScore = attempts.reduce((best, a) => Math.max(best, a.percent), 0);
  const masteredCards = new Set(attempts.filter((a) => a.scope === "card" && a.percent >= 90).map((a) => \`${a.lessonId}:${a.cardId}\`)).size;
  const coach = teacherCoach(lessons, attempts, activeLesson, locale);
`,
`  const badges = badgeData(lessons, attempts);
  const earnedBadges = badges.filter((badge) => badge.earned);
  const stars = starsEarned(attempts);
  const bestScore = attempts.reduce((best, a) => Math.max(best, a.percent), 0);
  const masteredCards = new Set(attempts.filter((a) => a.scope === "card" && a.percent >= 90).map((a) => \`${a.lessonId}:${a.cardId}\`)).size;
  const streak = practiceStreak(attempts);
  const coach = teacherCoach(lessons, attempts, activeLesson, locale);
  const motivation = motivationMessage(lessons, attempts, locale);
  const nextBadge = badges.find((badge) => !badge.earned) ?? null;
`,
'derived motivation state');

replaceOnce(
`      <View style={styles.summaryRow}>
        <View style={styles.summaryTile}><Text style={styles.summaryEmoji}>📚</Text><Text style={styles.summaryValue}>{lessons.length}</Text><Text style={styles.summaryLabel}>{t("Lessons", "دروس")}</Text></View>
        <View style={styles.summaryTile}><Text style={styles.summaryEmoji}>🧠</Text><Text style={styles.summaryValue}>{masteredCards}</Text><Text style={styles.summaryLabel}>{t("Mastered", "متقن")}</Text></View>
        <View style={styles.summaryTile}><Text style={styles.summaryEmoji}>🏆</Text><Text style={styles.summaryValue}>{bestScore}%</Text><Text style={styles.summaryLabel}>{t("Best", "أفضل")}</Text></View>
      </View>

      <View style={styles.teacherNote}>
`,
`      <View style={styles.summaryRow}>
        <View style={styles.summaryTile}><Text style={styles.summaryEmoji}>📚</Text><Text style={styles.summaryValue}>{lessons.length}</Text><Text style={styles.summaryLabel}>{t("Lessons", "دروس")}</Text></View>
        <View style={styles.summaryTile}><Text style={styles.summaryEmoji}>🧠</Text><Text style={styles.summaryValue}>{masteredCards}</Text><Text style={styles.summaryLabel}>{t("Mastered", "متقن")}</Text></View>
        <View style={styles.summaryTile}><Text style={styles.summaryEmoji}>🔥</Text><Text style={styles.summaryValue}>{streak}</Text><Text style={styles.summaryLabel}>{t("Day streak", "أيام متتالية")}</Text></View>
        <View style={styles.summaryTile}><Text style={styles.summaryEmoji}>🏆</Text><Text style={styles.summaryValue}>{bestScore}%</Text><Text style={styles.summaryLabel}>{t("Best", "أفضل")}</Text></View>
      </View>

      <View style={styles.motivationBanner}><Text style={styles.motivationEmoji}>🌟</Text><View style={{ flex: 1 }}><Text style={styles.motivationLabel}>{t("KEEP LEARNING • YOU’RE DOING GREAT", "استمر بالتعلّم • أنت تتقدم")}</Text><Text style={styles.motivationText}>{motivation}</Text></View></View>

      <View style={styles.teacherNote}>
`,
'motivation banner');

replaceOnce(
`          <Text style={styles.teacherLabel}>{t("AI TEACHER • TODAY'S TIP", "المعلم الذكي • نصيحة اليوم")}</Text>
          <Text style={styles.teacherText}>{coach}</Text>
`,
`          <Text style={styles.teacherLabel}>{t("AI MEMORIZATION COACH • PERSONAL TIP", "مدرب الحفظ الذكي • نصيحة شخصية")}</Text>
          <Text style={styles.teacherText}>{coach}</Text>
          {nextBadge ? <View style={styles.aiMission}><Text style={styles.aiMissionTitle}>🎯 {t("Next mission", "المهمة التالية")}: {ar ? nextBadge.titleAr : nextBadge.titleEn}</Text><Text style={styles.aiMissionText}>{Math.min(nextBadge.progress, nextBadge.goal)}/{nextBadge.goal} • {t("Keep learning to unlock it", "استمر بالتعلّم لفتحها")}</Text><View style={styles.progressTrack}><View style={[styles.progressFill, { width: \`${Math.min(100, Math.round((nextBadge.progress / Math.max(1, nextBadge.goal)) * 100))}%\` }]} /></View></View> : null}
`,
'AI coach mission');

replaceOnce(
`        {badges.map((badge) => <View key={badge.id} style={[styles.badge, !badge.earned && styles.badgeLocked]}><Text style={styles.badgeEmoji}>{badge.earned ? badge.emoji : "🔒"}</Text><Text style={styles.badgeTitle}>{badge.title}</Text></View>)}
`,
`        {badges.map((badge) => <View key={badge.id} style={[styles.badge, !badge.earned && styles.badgeLocked]}><Text style={styles.badgeEmoji}>{badge.earned ? badge.emoji : "🔒"}</Text><Text style={styles.badgeTitle}>{ar ? badge.titleAr : badge.titleEn}</Text><Text style={styles.badgeProgress}>{badge.earned ? t("Earned ✓", "تم الفوز ✓") : \`${Math.min(badge.progress, badge.goal)}/${badge.goal}\`}</Text></View>)}
`,
'badge shelf progress');

replaceOnce(
`  summaryRow: { flexDirection: "row", gap: 9 }, summaryTile: { flex: 1, backgroundColor: "#fffaf0", borderRadius: 18, paddingVertical: 11, alignItems: "center", borderWidth: 1, borderColor: "#dcccae" }, summaryEmoji: { fontSize: 20 }, summaryValue: { color: "#21483d", fontSize: 20, fontWeight: "900", marginTop: 3 }, summaryLabel: { color: "#7d7464", fontSize: 10, fontWeight: "800" },
  teacherNote: { backgroundColor: "#fff4c8", borderRadius: 20, padding: 14, borderWidth: 1, borderColor: "#e0c66b", flexDirection: "row", gap: 11, alignItems: "center" }, teacherAvatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: "#1f5748", alignItems: "center", justifyContent: "center" }, teacherAvatarText: { fontSize: 25 }, teacherLabel: { color: "#8e6c20", fontSize: 9, fontWeight: "900", letterSpacing: .8 }, teacherText: { color: "#3f4c43", fontSize: 12, lineHeight: 18, fontWeight: "700", marginTop: 4 },
`,
`  summaryRow: { flexDirection: "row", gap: 7 }, summaryTile: { flex: 1, backgroundColor: "#fffaf0", borderRadius: 18, paddingVertical: 10, alignItems: "center", borderWidth: 1, borderColor: "#dcccae" }, summaryEmoji: { fontSize: 18 }, summaryValue: { color: "#21483d", fontSize: 18, fontWeight: "900", marginTop: 3 }, summaryLabel: { color: "#7d7464", fontSize: 8.5, fontWeight: "800", textAlign: "center" },
  motivationBanner: { backgroundColor: "#eaf5e9", borderRadius: 20, padding: 13, borderWidth: 1, borderColor: "#a9cfad", flexDirection: "row", gap: 10, alignItems: "center" }, motivationEmoji: { fontSize: 30 }, motivationLabel: { color: "#2f7155", fontSize: 8.5, fontWeight: "900", letterSpacing: .7 }, motivationText: { color: "#34554a", fontSize: 12, lineHeight: 17, fontWeight: "800", marginTop: 3 },
  teacherNote: { backgroundColor: "#fff4c8", borderRadius: 20, padding: 14, borderWidth: 1, borderColor: "#e0c66b", flexDirection: "row", gap: 11, alignItems: "center" }, teacherAvatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: "#1f5748", alignItems: "center", justifyContent: "center" }, teacherAvatarText: { fontSize: 25 }, teacherLabel: { color: "#8e6c20", fontSize: 9, fontWeight: "900", letterSpacing: .8 }, teacherText: { color: "#3f4c43", fontSize: 12, lineHeight: 18, fontWeight: "700", marginTop: 4 }, aiMission: { marginTop: 9, backgroundColor: "rgba(255,255,255,.55)", borderRadius: 12, padding: 9 }, aiMissionTitle: { color: "#4a5f55", fontSize: 10.5, fontWeight: "900" }, aiMissionText: { color: "#786a4d", fontSize: 9.5, fontWeight: "800", marginTop: 3 }, progressTrack: { height: 6, borderRadius: 3, backgroundColor: "#ddd3b5", marginTop: 7, overflow: "hidden" }, progressFill: { height: 6, borderRadius: 3, backgroundColor: "#2f765c" },
`,
'motivation styles');

replaceOnce(
`  badgeRow: { gap: 8, paddingRight: 20 }, badge: { width: 104, minHeight: 86, borderRadius: 18, backgroundColor: "#fff9e9", borderWidth: 1.5, borderColor: "#d4b657", padding: 10, alignItems: "center", justifyContent: "center" }, badgeLocked: { opacity: .45, borderColor: "#c9c1ae" }, badgeEmoji: { fontSize: 26 }, badgeTitle: { color: "#4d574f", fontSize: 10, fontWeight: "900", textAlign: "center", marginTop: 5 },
`,
`  badgeRow: { gap: 8, paddingRight: 20 }, badge: { width: 108, minHeight: 103, borderRadius: 18, backgroundColor: "#fff9e9", borderWidth: 1.5, borderColor: "#d4b657", padding: 10, alignItems: "center", justifyContent: "center" }, badgeLocked: { opacity: .58, borderColor: "#c9c1ae" }, badgeEmoji: { fontSize: 27 }, badgeTitle: { color: "#4d574f", fontSize: 9.8, fontWeight: "900", textAlign: "center", marginTop: 5 }, badgeProgress: { color: "#8a7651", fontSize: 8.5, fontWeight: "800", marginTop: 5, textAlign: "center" },
`,
'badge styles');

fs.writeFileSync(path, src);
console.log('Applied Al-Hafiz motivation, badges, streaks, and AI coach upgrade.');
