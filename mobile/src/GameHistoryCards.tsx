import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

const API_BASE = String(Constants.expoConfig?.extra?.pushApiUrl || "https://wopt-prayer-push.wopt-windsor.workers.dev").replace(/\/$/, "");
const PLAYER_ID_KEY = "wopt:games:player-id:v1";

type Locale = "en" | "ar";
type History = {
  sessionId: string;
  roomCode: string;
  playerName: string;
  gameType: "trivia" | "imposter" | "clue";
  category: "islamic" | "sports";
  result: "win" | "loss" | "tie";
  playerScore: number;
  winningScore: number;
  winnerNames: string[];
  participants: Array<{ id: string; name: string; score: number }>;
  startedAt?: string | null;
  finishedAt: string;
};

type Props = { locale: Locale; refreshKey?: number };

const GAME = {
  trivia: { icon: "⚡", en: "Live Trivia", ar: "مسابقة مباشرة" },
  imposter: { icon: "🕵️", en: "Imposter", ar: "المندس" },
  clue: { icon: "🎯", en: "Clue Battle", ar: "معركة التلميحات" }
} as const;

export default function GameHistoryCards({ locale, refreshKey = 0 }: Props) {
  const ar = locale === "ar";
  const [items, setItems] = useState<History[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const load = useCallback(async () => {
    const playerId = await AsyncStorage.getItem(PLAYER_ID_KEY);
    if (!playerId) return;
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/games/history?playerId=${encodeURIComponent(playerId)}`);
      if (!response.ok) return;
      const payload = await response.json() as { history?: History[] };
      setItems(payload.history || []);
    } catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load, refreshKey]);

  if (loading && !items.length) return <View style={styles.loading}><ActivityIndicator color="#0b654f" /><Text style={styles.loadingText}>{ar ? "تحميل سجل الألعاب…" : "Loading game history…"}</Text></View>;
  if (!items.length) return null;

  const visible = expanded ? items : items.slice(0, 4);
  return <View style={styles.section}>
    <View style={styles.heading}><View><Text style={styles.eyebrow}>{ar ? "سجل اللعب" : "SESSION HISTORY"}</Text><Text style={styles.title}>{ar ? "ألعابك الأخيرة" : "Recent sessions"}</Text><Text style={styles.subtitle}>{ar ? "من لعبت معه، متى، والنتيجة." : "Who you played with, when and how it ended."}</Text></View><Pressable onPress={() => void load()} style={styles.refresh}><Text style={styles.refreshText}>↻</Text></Pressable></View>
    <View style={styles.cards}>{visible.map((item) => {
      const meta = GAME[item.gameType];
      const opponents = item.participants.filter((p) => p.name !== item.playerName).map((p) => p.name).join(", ") || (ar ? "لاعبون" : "Players");
      const resultLabel = item.result === "win" ? (ar ? "فوز" : "WIN") : item.result === "tie" ? (ar ? "تعادل" : "TIE") : (ar ? "خسارة" : "LOSS");
      const when = new Intl.DateTimeFormat(ar ? "ar-CA" : "en-CA", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(item.finishedAt));
      return <View key={item.sessionId} style={styles.card}>
        <View style={styles.cardTop}><View style={styles.gameIcon}><Text style={styles.gameEmoji}>{meta.icon}</Text></View><View style={styles.gameCopy}><Text style={styles.gameTitle}>{ar ? meta.ar : meta.en}</Text><Text style={styles.gameMeta}>{item.category === "islamic" ? `☾ ${ar ? "إسلامي" : "Islamic"}` : `⚽ ${ar ? "رياضة" : "Sports"}`} • {when}</Text></View><View style={[styles.resultPill, item.result === "win" ? styles.win : item.result === "tie" ? styles.tie : styles.loss]}><Text style={styles.resultText}>{resultLabel}</Text></View></View>
        <View style={styles.scoreRow}><View><Text style={styles.scoreLabel}>{ar ? "نتيجتك" : "YOUR SCORE"}</Text><Text style={styles.score}>{item.playerScore}</Text></View><Text style={styles.vs}>vs</Text><View style={styles.opponentBlock}><Text style={styles.scoreLabel}>{ar ? "لعبت مع" : "PLAYED WITH"}</Text><Text numberOfLines={2} style={styles.opponents}>{opponents}</Text></View></View>
        <View style={styles.footer}><Text style={styles.room}># {item.roomCode}</Text><Text style={styles.winner}>🏆 {ar ? "الفائز" : "Winner"}: {item.winnerNames.join(", ") || "—"}</Text></View>
      </View>;
    })}</View>
    {items.length > 4 ? <Pressable onPress={() => setExpanded((v) => !v)} style={styles.more}><Text style={styles.moreText}>{expanded ? (ar ? "عرض أقل" : "Show less") : (ar ? `عرض الكل (${items.length})` : `View all (${items.length})`)}</Text></Pressable> : null}
  </View>;
}

const styles = StyleSheet.create({
  section: { marginTop: 24 }, heading: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }, eyebrow: { color: "#a17b32", fontSize: 10, fontWeight: "900", letterSpacing: 1.2 }, title: { color: "#173f35", fontSize: 21, fontWeight: "900", marginTop: 3 }, subtitle: { color: "#75827d", fontSize: 12, marginTop: 3 }, refresh: { width: 38, height: 38, borderRadius: 13, backgroundColor: "#fff", borderWidth: 1, borderColor: "#dfddd5", alignItems: "center", justifyContent: "center" }, refreshText: { color: "#0b654f", fontSize: 20, fontWeight: "900" },
  cards: { gap: 10 }, card: { borderRadius: 22, backgroundColor: "#fff", borderWidth: 1, borderColor: "#dfddd5", padding: 14 }, cardTop: { flexDirection: "row", alignItems: "center", gap: 10 }, gameIcon: { width: 46, height: 46, borderRadius: 15, backgroundColor: "#f1ece0", alignItems: "center", justifyContent: "center" }, gameEmoji: { fontSize: 23 }, gameCopy: { flex: 1 }, gameTitle: { color: "#173f35", fontSize: 15, fontWeight: "900" }, gameMeta: { color: "#79857f", fontSize: 10.5, marginTop: 3 }, resultPill: { borderRadius: 99, paddingHorizontal: 10, paddingVertical: 6 }, win: { backgroundColor: "#dff3e9" }, tie: { backgroundColor: "#fff2cd" }, loss: { backgroundColor: "#f7e4e1" }, resultText: { color: "#214d41", fontSize: 10, fontWeight: "900" },
  scoreRow: { flexDirection: "row", alignItems: "center", marginTop: 13, paddingTop: 12, borderTopWidth: 1, borderTopColor: "#eeeae1" }, scoreLabel: { color: "#9b8b6d", fontSize: 8.5, fontWeight: "900", letterSpacing: .8 }, score: { color: "#0b654f", fontSize: 27, fontWeight: "900", marginTop: 2 }, vs: { color: "#a3aaa6", fontSize: 11, fontWeight: "900", marginHorizontal: 16 }, opponentBlock: { flex: 1 }, opponents: { color: "#324f47", fontSize: 13, lineHeight: 18, fontWeight: "800", marginTop: 3 }, footer: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8, marginTop: 10 }, room: { color: "#8d9691", fontSize: 9.5, fontWeight: "800" }, winner: { color: "#64756f", fontSize: 10.5, fontWeight: "700", flex: 1, textAlign: "right" },
  more: { marginTop: 10, minHeight: 42, borderRadius: 14, backgroundColor: "#eaf4ef", alignItems: "center", justifyContent: "center" }, moreText: { color: "#0b654f", fontSize: 12, fontWeight: "900" }, loading: { marginTop: 18, flexDirection: "row", alignItems: "center", gap: 8 }, loadingText: { color: "#718079", fontSize: 12 }
});
