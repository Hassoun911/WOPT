import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import IslamicQuiz from "./IslamicQuiz";
import MultiplayerGames, { type MultiplayerGameType } from "./MultiplayerGames";
import BrandMark from "./BrandMark";
import type { QuizLocale, QuizStats } from "./islamicQuiz";

type Props = { locale: QuizLocale; dateKey: string; stats: QuizStats; onStatsChange: (stats: QuizStats) => void; onBackHome: () => void };

type ViewMode = "hub" | "daily" | "multiplayer";

const games: Array<{ id: MultiplayerGameType; icon: string; en: string; ar: string; noteEn: string; noteAr: string }> = [
  { id: "trivia", icon: "⚡", en: "Live Trivia", ar: "مسابقة مباشرة", noteEn: "Timed multiplayer questions", noteAr: "أسئلة جماعية مؤقتة" },
  { id: "imposter", icon: "🕵️", en: "Imposter", ar: "المندس", noteEn: "Find who does not know the secret", noteAr: "اكتشف من لا يعرف الكلمة السرية" },
  { id: "clue", icon: "🎯", en: "Clue Battle", ar: "معركة التلميحات", noteEn: "Give clues and race to guess", noteAr: "أعط تلميحات وتسابقوا في التخمين" }
];

export default function QuizGamesHub({ locale, dateKey, stats, onStatsChange, onBackHome }: Props) {
  const [mode, setMode] = useState<ViewMode>("hub");
  const [selectedGame, setSelectedGame] = useState<MultiplayerGameType | undefined>();
  const ar = locale === "ar";
  const t = (en: string, arabic: string) => ar ? arabic : en;

  if (mode === "daily") return <IslamicQuiz locale={locale} dateKey={dateKey} stats={stats} onStatsChange={onStatsChange} onBackHome={() => setMode("hub")} />;
  if (mode === "multiplayer") return <MultiplayerGames locale={locale} initialGame={selectedGame} onBack={() => { setSelectedGame(undefined); setMode("hub"); }} />;

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.screen} showsVerticalScrollIndicator={false}>
      <View style={styles.top}><Pressable onPress={onBackHome} style={styles.back}><Text style={styles.backText}>‹</Text></Pressable><BrandMark size={44} /><View style={styles.copy}><Text style={styles.eyebrow}>🎮 HASSOUN GAMES</Text><Text style={styles.title}>{t("Learn. Play. Compete.", "تعلّم • العب • تنافس")}</Text><Text style={styles.subtitle}>{t("Daily Islamic learning plus live multiplayer games. Multiplayer topics are Islamic or sports only.", "تعلم إسلامي يومي وألعاب جماعية مباشرة. مواضيع اللعب الجماعي إسلامية أو رياضية فقط.")}</Text></View></View>

      <Pressable onPress={() => setMode("daily")} style={styles.dailyCard}><View style={styles.dailyIcon}><Text style={styles.bigEmoji}>🧠</Text></View><View style={styles.copy}><Text style={styles.kicker}>{t("DAILY LEARNING", "تعلم يومي")}</Text><Text style={styles.dailyTitle}>{t("Daily Islamic Quiz", "المسابقة الإسلامية اليومية")}</Text><Text style={styles.dailyNote}>{t("Kids & Adults • streaks • badges • verified sources", "أطفال وكبار • سلسلة • شارات • مصادر موثقة")}</Text></View><Text style={styles.dailyArrow}>›</Text></Pressable>

      <View style={styles.sectionHead}><View><Text style={styles.kicker}>{t("MULTIPLAYER", "متعدد اللاعبين")}</Text><Text style={styles.sectionTitle}>{t("Play with friends", "العب مع الأصدقاء")}</Text></View><View style={styles.livePill}><Text style={styles.liveText}>● LIVE</Text></View></View>

      {games.map((game) => <Pressable key={game.id} onPress={() => { setSelectedGame(game.id); setMode("multiplayer"); }} style={styles.gameCard}><View style={styles.gameIcon}><Text style={styles.gameEmoji}>{game.icon}</Text></View><View style={styles.copy}><Text style={styles.gameTitle}>{ar ? game.ar : game.en}</Text><Text style={styles.gameNote}>{ar ? game.noteAr : game.noteEn}</Text><View style={styles.tags}><Text style={styles.tag}>☾ {t("Islamic", "إسلامي")}</Text><Text style={styles.tag}>⚽ {t("Sports", "رياضة")}</Text><Text style={styles.tag}>👥 2–12</Text></View></View><Text style={styles.arrow}>›</Text></Pressable>)}

      <View style={styles.safety}><Text style={styles.safetyIcon}>✓</Text><View style={styles.copy}><Text style={styles.safetyTitle}>{t("Focused, family-friendly topics", "مواضيع هادفة ومناسبة للعائلة")}</Text><Text style={styles.safetyText}>{t("Multiplayer content is limited to Islamic knowledge and sports. No gambling or inappropriate categories.", "المحتوى الجماعي محصور بالمعرفة الإسلامية والرياضة دون قمار أو فئات غير مناسبة.")}</Text></View></View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: "#f7f4ec" }, screen: { padding: 17, paddingBottom: 38 }, top: { flexDirection: "row", gap: 11, alignItems: "center", marginBottom: 15 }, copy: { flex: 1 }, back: { width: 44, height: 44, borderRadius: 15, backgroundColor: "#fff", borderWidth: 1, borderColor: "#dedbd3", alignItems: "center", justifyContent: "center" }, backText: { color: "#0b654f", fontSize: 31, lineHeight: 33 },
  eyebrow: { color: "#a17c36", fontSize: 9, fontWeight: "900", letterSpacing: 1.1 }, title: { color: "#173f35", fontSize: 27, fontWeight: "900", marginTop: 4 }, subtitle: { color: "#76837e", fontSize: 10, lineHeight: 15, marginTop: 4 },
  dailyCard: { minHeight: 122, borderRadius: 25, backgroundColor: "#0b654f", padding: 15, flexDirection: "row", alignItems: "center", gap: 12 }, dailyIcon: { width: 61, height: 61, borderRadius: 20, backgroundColor: "rgba(255,255,255,.13)", alignItems: "center", justifyContent: "center" }, bigEmoji: { fontSize: 30 }, kicker: { color: "#d9bd70", fontSize: 7.5, fontWeight: "900", letterSpacing: 1 }, dailyTitle: { color: "#fff", fontSize: 18, fontWeight: "900", marginTop: 3 }, dailyNote: { color: "#c7ded5", fontSize: 8.5, lineHeight: 13, marginTop: 3 }, dailyArrow: { color: "#fff", fontSize: 29 },
  sectionHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 21, marginBottom: 9 }, sectionTitle: { color: "#173f35", fontSize: 19, fontWeight: "900", marginTop: 2 }, livePill: { borderRadius: 99, backgroundColor: "#e8f4ee", paddingHorizontal: 10, paddingVertical: 6 }, liveText: { color: "#0b7759", fontSize: 7, fontWeight: "900" },
  gameCard: { minHeight: 115, borderRadius: 23, backgroundColor: "#fff", borderWidth: 1, borderColor: "#e1ddd4", padding: 13, marginBottom: 9, flexDirection: "row", alignItems: "center", gap: 11 }, gameIcon: { width: 55, height: 55, borderRadius: 18, backgroundColor: "#edf5f1", alignItems: "center", justifyContent: "center" }, gameEmoji: { fontSize: 27 }, gameTitle: { color: "#173f35", fontSize: 16, fontWeight: "900" }, gameNote: { color: "#7d8984", fontSize: 8.5, marginTop: 3 }, tags: { flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 7 }, tag: { color: "#5e716b", fontSize: 6.5, fontWeight: "800", backgroundColor: "#f3f4f0", borderRadius: 99, paddingHorizontal: 6, paddingVertical: 3, overflow: "hidden" }, arrow: { color: "#0b654f", fontSize: 27 },
  safety: { marginTop: 6, borderRadius: 20, backgroundColor: "#e9f4ef", borderWidth: 1, borderColor: "#d0e5dc", padding: 13, flexDirection: "row", alignItems: "center", gap: 10 }, safetyIcon: { width: 34, height: 34, borderRadius: 17, textAlign: "center", textAlignVertical: "center", backgroundColor: "#0b654f", color: "#fff", fontWeight: "900" }, safetyTitle: { color: "#17483c", fontSize: 11, fontWeight: "900" }, safetyText: { color: "#70817a", fontSize: 8, lineHeight: 12, marginTop: 2 }
});
