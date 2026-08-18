import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import BrandMark from "./BrandMark";

type Locale = "en" | "ar";
export type MultiplayerGameType = "trivia" | "imposter" | "clue";
type Category = "islamic" | "sports";
type Localized = { en: string; ar: string };

type Player = { id: string; name: string; score: number; isHost: boolean };
type Room = {
  code: string;
  gameType: MultiplayerGameType;
  category: Category;
  status: "lobby" | "playing" | "finished";
  hostPlayerId: string;
  players: Player[];
  state: {
    phase?: string;
    round?: number;
    endsAt?: number | null;
    activePlayerId?: string | null;
    question?: { prompt: Localized; choices: Localized[] };
    answeredPlayerIds?: string[];
    correctIndex?: number;
    votedPlayerIds?: string[];
    imposterId?: string;
    word?: Localized;
    caught?: boolean;
    lastResult?: { kind: "correct" | "skip"; guessedBy?: string } | null;
  };
  private: { answer?: number | null; role?: "imposter" | "player"; word?: Localized; vote?: string | null };
};

type Props = { locale: Locale; initialGame?: MultiplayerGameType; onBack: () => void };

const API_BASE = String(Constants.expoConfig?.extra?.pushApiUrl || "https://wopt-prayer-push.wopt-windsor.workers.dev").replace(/\/$/, "");
const PLAYER_ID_KEY = "wopt:games:player-id:v1";
const PLAYER_NAME_KEY = "wopt:games:player-name:v1";

const META: Record<MultiplayerGameType, { icon: string; en: string; ar: string; noteEn: string; noteAr: string }> = {
  trivia: { icon: "⚡", en: "Live Trivia", ar: "مسابقة مباشرة", noteEn: "Timed questions • fastest minds win", noteAr: "أسئلة مؤقتة • تنافس مباشر" },
  imposter: { icon: "🕵️", en: "Imposter", ar: "المندس", noteEn: "Find who does not know the secret", noteAr: "اكتشف من لا يعرف الكلمة السرية" },
  clue: { icon: "🎯", en: "Clue Battle", ar: "معركة التلميحات", noteEn: "Give clues • friends guess • score together", noteAr: "أعط تلميحات • خمنوا • اجمعوا النقاط" }
};

function makePlayerId() {
  return `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
}

async function api(path: string, init?: RequestInit) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json" }
  });
  const payload = await response.json() as { room?: Room; error?: string };
  if (!response.ok || !payload.room) throw new Error(payload.error || `Request failed (${response.status})`);
  return payload.room;
}

export default function MultiplayerGames({ locale, initialGame, onBack }: Props) {
  const ar = locale === "ar";
  const t = (en: string, arabic: string) => ar ? arabic : en;
  const [game, setGame] = useState<MultiplayerGameType | null>(initialGame ?? null);
  const [category, setCategory] = useState<Category>("islamic");
  const [playerId, setPlayerId] = useState("");
  const [playerName, setPlayerName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [room, setRoom] = useState<Room | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    void (async () => {
      let id = await AsyncStorage.getItem(PLAYER_ID_KEY);
      if (!id) {
        id = makePlayerId();
        await AsyncStorage.setItem(PLAYER_ID_KEY, id);
      }
      setPlayerId(id);
      setPlayerName((await AsyncStorage.getItem(PLAYER_NAME_KEY)) ?? "");
    })();
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!room?.code || !playerId) return;
    const timer = setInterval(() => {
      void api(`/games/rooms/${room.code}?playerId=${encodeURIComponent(playerId)}`)
        .then(setRoom)
        .catch(() => {});
    }, 1200);
    return () => clearInterval(timer);
  }, [room?.code, playerId]);

  const isHost = room?.hostPlayerId === playerId;
  const activePlayer = room?.players.find((p) => p.id === room.state.activePlayerId);
  const secondsLeft = room?.state.endsAt ? Math.max(0, Math.ceil((room.state.endsAt - now) / 1000)) : null;
  const meta = game ? META[game] : null;

  const withBusy = async (run: () => Promise<Room>) => {
    setBusy(true); setError(null);
    try { setRoom(await run()); }
    catch (e) { setError(e instanceof Error ? e.message : t("Something went wrong", "حدث خطأ")); }
    finally { setBusy(false); }
  };

  const rememberName = async () => {
    const clean = playerName.trim().replace(/\s+/g, " ").slice(0, 24);
    setPlayerName(clean);
    if (clean) await AsyncStorage.setItem(PLAYER_NAME_KEY, clean);
    return clean;
  };

  const createRoom = async () => {
    if (!game || !playerId) return;
    const name = await rememberName();
    if (name.length < 2) { setError(t("Enter your name first.", "اكتب اسمك أولاً.")); return; }
    await withBusy(() => api("/games/rooms", { method: "POST", body: JSON.stringify({ playerId, playerName: name, gameType: game, category }) }));
  };

  const joinRoom = async () => {
    if (!playerId) return;
    const name = await rememberName();
    const code = joinCode.trim().toUpperCase();
    if (name.length < 2 || code.length !== 6) { setError(t("Enter your name and 6-character room code.", "اكتب اسمك ورمز الغرفة المكون من ٦ أحرف.")); return; }
    await withBusy(async () => {
      const joined = await api("/games/rooms/join", { method: "POST", body: JSON.stringify({ playerId, playerName: name, code }) });
      setGame(joined.gameType);
      setCategory(joined.category);
      return joined;
    });
  };

  const act = async (type: string, extra: Record<string, unknown> = {}) => {
    if (!room || !playerId) return;
    await withBusy(() => api(`/games/rooms/${room.code}/action`, { method: "POST", body: JSON.stringify({ playerId, type, ...extra }) }));
  };

  const leaveRoom = () => { setRoom(null); setJoinCode(""); };

  if (!game && !room) {
    return (
      <ScrollView style={styles.flex} contentContainerStyle={styles.screen} showsVerticalScrollIndicator={false}>
        <View style={styles.header}><Pressable onPress={onBack} style={styles.back}><Text style={styles.backText}>‹</Text></Pressable><BrandMark size={44} /><View style={styles.headerCopy}><Text style={styles.eyebrow}>HASSOUN • MULTIPLAYER</Text><Text style={styles.title}>{t("Choose a game", "اختر لعبة")}</Text><Text style={styles.subtitle}>{t("Multiplayer only • Islamic or sports topics", "متعدد اللاعبين فقط • مواضيع إسلامية أو رياضية")}</Text></View></View>
        {(Object.keys(META) as MultiplayerGameType[]).map((id) => {
          const item = META[id];
          return <Pressable key={id} onPress={() => setGame(id)} style={styles.gameCard}><View style={styles.gameIcon}><Text style={styles.gameEmoji}>{item.icon}</Text></View><View style={styles.gameCopy}><Text style={styles.gameTitle}>{ar ? item.ar : item.en}</Text><Text style={styles.gameNote}>{ar ? item.noteAr : item.noteEn}</Text><View style={styles.topicRow}><Text style={styles.topicPill}>☾ {t("Islamic", "إسلامي")}</Text><Text style={styles.topicPill}>⚽ {t("Sports", "رياضة")}</Text></View></View><Text style={styles.arrow}>›</Text></Pressable>;
        })}
      </ScrollView>
    );
  }

  if (!room) {
    return (
      <ScrollView style={styles.flex} contentContainerStyle={styles.screen} showsVerticalScrollIndicator={false}>
        <View style={styles.header}><Pressable onPress={() => setGame(null)} style={styles.back}><Text style={styles.backText}>‹</Text></Pressable><BrandMark size={44} /><View style={styles.headerCopy}><Text style={styles.eyebrow}>HASSOUN • GAMES</Text><Text style={styles.title}>{ar ? meta?.ar : meta?.en}</Text><Text style={styles.subtitle}>{ar ? meta?.noteAr : meta?.noteEn}</Text></View></View>
        <View style={styles.setupCard}>
          <Text style={styles.label}>{t("YOUR NAME", "اسمك")}</Text>
          <TextInput value={playerName} onChangeText={setPlayerName} placeholder={t("Player name", "اسم اللاعب")} placeholderTextColor="#9aa39f" style={styles.input} maxLength={24} />
          <Text style={styles.label}>{t("TOPIC", "الموضوع")}</Text>
          <View style={styles.categoryRow}>
            <Pressable onPress={() => setCategory("islamic")} style={[styles.categoryButton, category === "islamic" && styles.categoryActive]}><Text style={[styles.categoryText, category === "islamic" && styles.categoryTextActive]}>☾ {t("Islamic", "إسلامي")}</Text></Pressable>
            <Pressable onPress={() => setCategory("sports")} style={[styles.categoryButton, category === "sports" && styles.categoryActive]}><Text style={[styles.categoryText, category === "sports" && styles.categoryTextActive]}>⚽ {t("Sports", "رياضة")}</Text></Pressable>
          </View>
          <Pressable onPress={() => void createRoom()} disabled={busy} style={styles.primary}>{busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>＋ {t("Create multiplayer room", "إنشاء غرفة جماعية")}</Text>}</Pressable>
        </View>
        <View style={styles.orRow}><View style={styles.orLine} /><Text style={styles.orText}>{t("OR JOIN FRIENDS", "أو انضم لأصدقائك")}</Text><View style={styles.orLine} /></View>
        <View style={styles.joinCard}><TextInput value={joinCode} onChangeText={(v) => setJoinCode(v.toUpperCase().replace(/[^A-Z2-9]/g, "").slice(0, 6))} autoCapitalize="characters" placeholder="ROOM CODE" placeholderTextColor="#9aa39f" style={[styles.input, styles.codeInput]} maxLength={6} /><Pressable onPress={() => void joinRoom()} disabled={busy} style={styles.secondary}><Text style={styles.secondaryText}>{t("Join room", "انضم للغرفة")}</Text></Pressable></View>
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </ScrollView>
    );
  }

  const phase = room.state.phase ?? "lobby";
  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.screen} showsVerticalScrollIndicator={false}>
      <View style={styles.roomTop}><Pressable onPress={leaveRoom} style={styles.back}><Text style={styles.backText}>‹</Text></Pressable><BrandMark size={40} /><View style={styles.roomCodeWrap}><Text style={styles.roomCodeLabel}>{t("ROOM", "الغرفة")}</Text><Text style={styles.roomCode}>{room.code}</Text></View><View style={styles.roundPill}><Text style={styles.roundText}>{phase === "lobby" ? t("Lobby", "انتظار") : `${t("Round", "جولة")} ${room.state.round ?? 1}`}</Text></View></View>

      <View style={styles.roomHero}><Text style={styles.roomHeroIcon}>{META[room.gameType].icon}</Text><View style={styles.headerCopy}><Text style={styles.roomHeroTitle}>{ar ? META[room.gameType].ar : META[room.gameType].en}</Text><Text style={styles.roomHeroMeta}>{room.category === "islamic" ? `☾ ${t("Islamic", "إسلامي")}` : `⚽ ${t("Sports", "رياضة")}`} • {room.players.length}/12</Text></View></View>

      <View style={styles.scoreboard}>{room.players.map((p) => <View key={p.id} style={[styles.playerRow, p.id === playerId && styles.playerMe]}><View style={styles.avatar}><Text style={styles.avatarText}>{p.name.slice(0, 1).toUpperCase()}</Text></View><Text style={styles.playerName}>{p.name}{p.isHost ? " 👑" : ""}</Text><Text style={styles.playerScore}>{p.score}</Text></View>)}</View>

      {phase === "lobby" ? <View style={styles.playCard}><Text style={styles.playTitle}>{t("Invite friends with the room code", "ادعُ أصدقاءك باستخدام رمز الغرفة")}</Text><Text style={styles.playText}>{t("At least 2 players are required. Everyone can join from another phone using this code.", "يلزم لاعبان على الأقل. يمكن للجميع الانضمام من هاتف آخر باستخدام الرمز.")}</Text>{isHost ? <Pressable onPress={() => void act("start")} disabled={busy || room.players.length < 2} style={[styles.primary, room.players.length < 2 && styles.disabled]}><Text style={styles.primaryText}>▶ {t("Start game", "ابدأ اللعبة")}</Text></Pressable> : <Text style={styles.waiting}>⌛ {t("Waiting for host to start…", "بانتظار المضيف لبدء اللعبة…")}</Text>}</View> : null}

      {room.gameType === "trivia" && phase === "question" && room.state.question ? <View style={styles.playCard}><View style={styles.timerCircle}><Text style={styles.timerNumber}>{secondsLeft ?? 20}</Text><Text style={styles.timerLabel}>{t("SEC", "ث")}</Text></View><Text style={styles.question}>{room.state.question.prompt[locale]}</Text><View style={styles.answers}>{room.state.question.choices.map((choice, index) => { const mine = room.private.answer === index; const locked = room.private.answer !== null && room.private.answer !== undefined; return <Pressable key={index} disabled={locked} onPress={() => void act("answer", { answer: index })} style={[styles.answer, mine && styles.answerSelected, locked && !mine && styles.answerLocked]}><Text style={styles.answerLetter}>{String.fromCharCode(65 + index)}</Text><Text style={styles.answerText}>{choice[locale]}</Text></Pressable>; })}</View>{room.private.answer !== null && room.private.answer !== undefined ? <Text style={styles.waiting}>✓ {t("Answer locked — waiting for everyone", "تم تثبيت إجابتك — بانتظار الجميع")}</Text> : null}</View> : null}

      {room.gameType === "trivia" && phase === "results" && room.state.question ? <View style={styles.playCard}><Text style={styles.resultIcon}>🏆</Text><Text style={styles.playTitle}>{t("Answer", "الإجابة")}</Text><Text style={styles.resultAnswer}>{room.state.question.choices[room.state.correctIndex ?? 0]?.[locale]}</Text>{isHost ? <Pressable onPress={() => void act("next")} style={styles.primary}><Text style={styles.primaryText}>{t("Next question", "السؤال التالي")} ›</Text></Pressable> : <Text style={styles.waiting}>{t("Waiting for host…", "بانتظار المضيف…")}</Text>}</View> : null}

      {room.gameType === "imposter" && phase === "discussion" ? <View style={styles.playCard}>{room.private.role === "imposter" ? <><Text style={styles.secretIcon}>🕵️</Text><Text style={styles.secretDanger}>{t("YOU ARE THE IMPOSTER", "أنت المندس")}</Text><Text style={styles.playText}>{t("You do not know the secret. Blend in, listen carefully, and avoid being voted out.", "أنت لا تعرف الكلمة السرية. اندمج واستمع جيداً وحاول ألا يتم كشفك.")}</Text></> : <><Text style={styles.secretIcon}>🔐</Text><Text style={styles.playTitle}>{t("Your secret", "كلمتك السرية")}</Text><Text style={styles.secretWord}>{room.private.word?.[locale]}</Text><Text style={styles.playText}>{t("Describe it without saying the word. Then vote for the imposter.", "صفها دون ذكر الكلمة ثم صوّت للمندس.")}</Text></>}<Text style={styles.voteTitle}>{t("WHO IS THE IMPOSTER?", "من هو المندس؟")}</Text><View style={styles.voteGrid}>{room.players.filter((p) => p.id !== playerId).map((p) => <Pressable key={p.id} disabled={Boolean(room.private.vote)} onPress={() => void act("vote", { targetPlayerId: p.id })} style={[styles.voteButton, room.private.vote === p.id && styles.voteSelected]}><Text style={styles.voteText}>{p.name}</Text></Pressable>)}</View>{room.private.vote ? <Text style={styles.waiting}>✓ {t("Vote submitted — waiting for everyone", "تم التصويت — بانتظار الجميع")}</Text> : null}</View> : null}

      {room.gameType === "imposter" && phase === "results" ? <View style={styles.playCard}><Text style={styles.resultIcon}>{room.state.caught ? "🎯" : "🕵️"}</Text><Text style={styles.playTitle}>{room.state.caught ? t("Imposter caught!", "تم كشف المندس!") : t("The imposter escaped!", "نجا المندس!")}</Text><Text style={styles.resultAnswer}>{room.players.find((p) => p.id === room.state.imposterId)?.name}</Text><Text style={styles.playText}>{t("Secret", "الكلمة")}: {room.state.word?.[locale]}</Text>{isHost ? <Pressable onPress={() => void act("next")} style={styles.primary}><Text style={styles.primaryText}>{t("Next round", "الجولة التالية")} ›</Text></Pressable> : <Text style={styles.waiting}>{t("Waiting for host…", "بانتظار المضيف…")}</Text>}</View> : null}

      {room.gameType === "clue" && phase === "clue" ? <View style={styles.playCard}><Text style={styles.secretIcon}>🎯</Text><Text style={styles.playTitle}>{activePlayer?.id === playerId ? t("You give the clues", "أنت تعطي التلميحات") : t(`${activePlayer?.name ?? "Player"} gives the clues`, `${activePlayer?.name ?? "اللاعب"} يعطي التلميحات`)}</Text>{activePlayer?.id === playerId ? <><Text style={styles.secretWord}>{room.private.word?.[locale]}</Text><Text style={styles.playText}>{t("Describe the word without saying it. When someone guesses, tap their name.", "صف الكلمة دون قولها. عندما يخمن أحدهم اضغط على اسمه.")}</Text><View style={styles.voteGrid}>{room.players.filter((p) => p.id !== playerId).map((p) => <Pressable key={p.id} onPress={() => void act("clue_correct", { guessedBy: p.id })} style={styles.voteButton}><Text style={styles.voteText}>✓ {p.name}</Text></Pressable>)}</View><Pressable onPress={() => void act("clue_skip")} style={styles.skip}><Text style={styles.skipText}>{t("Skip word", "تخطي الكلمة")}</Text></Pressable></> : <><Text style={styles.bigHint}>💭</Text><Text style={styles.playText}>{t("Listen to the clues and guess the secret word out loud.", "استمع للتلميحات وحاول تخمين الكلمة بصوت عالٍ.")}</Text></>}</View> : null}

      {room.gameType === "clue" && phase === "results" ? <View style={styles.playCard}><Text style={styles.resultIcon}>{room.state.lastResult?.kind === "correct" ? "✨" : "↻"}</Text><Text style={styles.playTitle}>{room.state.lastResult?.kind === "correct" ? t("Great clue!", "تلميح رائع!") : t("Word skipped", "تم تخطي الكلمة")}</Text>{room.state.lastResult?.guessedBy ? <Text style={styles.playText}>{t("Guessed by", "خمنها")}: {room.players.find((p) => p.id === room.state.lastResult?.guessedBy)?.name}</Text> : null}{(isHost || room.state.activePlayerId === playerId) ? <Pressable onPress={() => void act("next")} style={styles.primary}><Text style={styles.primaryText}>{t("Next word", "الكلمة التالية")} ›</Text></Pressable> : <Text style={styles.waiting}>{t("Waiting for next word…", "بانتظار الكلمة التالية…")}</Text>}</View> : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {busy ? <ActivityIndicator style={{ marginTop: 12 }} color="#0b654f" /> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: "#f7f4ec" }, screen: { padding: 17, paddingBottom: 38 },
  header: { flexDirection: "row", alignItems: "center", gap: 11, marginBottom: 17 }, headerCopy: { flex: 1 },
  back: { width: 44, height: 44, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: "#fff", borderWidth: 1, borderColor: "#dedbd3" }, backText: { color: "#0b654f", fontSize: 31, lineHeight: 33 },
  eyebrow: { color: "#a27d32", fontSize: 9, fontWeight: "900", letterSpacing: 1.1 }, title: { color: "#173f35", fontSize: 27, fontWeight: "900", marginTop: 4 }, subtitle: { color: "#76837e", fontSize: 11, lineHeight: 16, marginTop: 3 },
  gameCard: { minHeight: 126, borderRadius: 24, backgroundColor: "#fff", borderWidth: 1, borderColor: "#e1ddd4", padding: 14, marginBottom: 10, flexDirection: "row", alignItems: "center", gap: 12 }, gameIcon: { width: 62, height: 62, borderRadius: 21, backgroundColor: "#e9f4ef", alignItems: "center", justifyContent: "center" }, gameEmoji: { fontSize: 31 }, gameCopy: { flex: 1 }, gameTitle: { color: "#173f35", fontSize: 18, fontWeight: "900" }, gameNote: { color: "#7d8984", fontSize: 9, lineHeight: 14, marginTop: 3 }, arrow: { color: "#0b654f", fontSize: 28 }, topicRow: { flexDirection: "row", gap: 5, marginTop: 8 }, topicPill: { color: "#45665d", fontSize: 7.5, fontWeight: "800", backgroundColor: "#f2f4f0", paddingHorizontal: 7, paddingVertical: 4, borderRadius: 99, overflow: "hidden" },
  setupCard: { backgroundColor: "#fff", borderRadius: 24, borderWidth: 1, borderColor: "#e1ddd4", padding: 16 }, label: { color: "#9a7b3f", fontSize: 8, fontWeight: "900", letterSpacing: 1, marginBottom: 6, marginTop: 5 }, input: { minHeight: 52, borderRadius: 16, borderWidth: 1, borderColor: "#dedad1", backgroundColor: "#faf9f6", paddingHorizontal: 13, color: "#173f35", fontSize: 12 }, categoryRow: { flexDirection: "row", gap: 8, marginBottom: 7 }, categoryButton: { flex: 1, minHeight: 48, borderRadius: 15, backgroundColor: "#f1f1ed", alignItems: "center", justifyContent: "center" }, categoryActive: { backgroundColor: "#0b654f" }, categoryText: { color: "#64736e", fontWeight: "900", fontSize: 11 }, categoryTextActive: { color: "#fff" },
  primary: { minHeight: 52, borderRadius: 17, backgroundColor: "#0b654f", alignItems: "center", justifyContent: "center", marginTop: 12, paddingHorizontal: 12 }, primaryText: { color: "#fff", fontSize: 11, fontWeight: "900", textAlign: "center" }, secondary: { minHeight: 50, borderRadius: 16, backgroundColor: "#e8f3ee", alignItems: "center", justifyContent: "center", paddingHorizontal: 16 }, secondaryText: { color: "#0b654f", fontSize: 11, fontWeight: "900" }, disabled: { opacity: .35 },
  orRow: { flexDirection: "row", alignItems: "center", gap: 8, marginVertical: 17 }, orLine: { flex: 1, height: 1, backgroundColor: "#dedad1" }, orText: { color: "#969d99", fontSize: 7, fontWeight: "900" }, joinCard: { gap: 8 }, codeInput: { textAlign: "center", letterSpacing: 4, fontSize: 18, fontWeight: "900" }, error: { color: "#9b3d37", backgroundColor: "#fdeceb", borderRadius: 13, padding: 10, marginTop: 10, fontSize: 10, textAlign: "center" },
  roomTop: { flexDirection: "row", alignItems: "center", gap: 10 }, roomCodeWrap: { flex: 1 }, roomCodeLabel: { color: "#94815a", fontSize: 7, fontWeight: "900" }, roomCode: { color: "#173f35", fontSize: 23, fontWeight: "900", letterSpacing: 3 }, roundPill: { borderRadius: 99, backgroundColor: "#e8f3ee", paddingHorizontal: 11, paddingVertical: 7 }, roundText: { color: "#0b654f", fontSize: 9, fontWeight: "900" }, roomHero: { marginTop: 13, borderRadius: 22, backgroundColor: "#103f35", padding: 14, flexDirection: "row", alignItems: "center", gap: 10 }, roomHeroIcon: { fontSize: 30 }, roomHeroTitle: { color: "#fff", fontSize: 17, fontWeight: "900" }, roomHeroMeta: { color: "#bfd7cf", fontSize: 9, marginTop: 3 },
  scoreboard: { marginTop: 10, gap: 6 }, playerRow: { minHeight: 50, borderRadius: 15, backgroundColor: "#fff", borderWidth: 1, borderColor: "#e2dfd7", flexDirection: "row", alignItems: "center", paddingHorizontal: 10, gap: 8 }, playerMe: { borderColor: "#89baa9", backgroundColor: "#f2faf6" }, avatar: { width: 32, height: 32, borderRadius: 11, backgroundColor: "#e9f4ef", alignItems: "center", justifyContent: "center" }, avatarText: { color: "#0b654f", fontSize: 12, fontWeight: "900" }, playerName: { flex: 1, color: "#264b41", fontSize: 11, fontWeight: "900" }, playerScore: { color: "#a17c36", fontSize: 16, fontWeight: "900" },
  playCard: { marginTop: 12, borderRadius: 24, backgroundColor: "#fff", borderWidth: 1, borderColor: "#e1ddd4", padding: 16 }, playTitle: { color: "#173f35", fontSize: 17, fontWeight: "900", textAlign: "center" }, playText: { color: "#76837e", fontSize: 10, lineHeight: 16, textAlign: "center", marginTop: 6 }, waiting: { color: "#6e7c77", fontSize: 9, fontWeight: "800", textAlign: "center", marginTop: 13 },
  timerCircle: { width: 68, height: 68, borderRadius: 34, alignSelf: "center", backgroundColor: "#0b654f", borderWidth: 4, borderColor: "#e6ca7b", alignItems: "center", justifyContent: "center" }, timerNumber: { color: "#fff", fontSize: 23, fontWeight: "900" }, timerLabel: { color: "#d7e8e2", fontSize: 6, fontWeight: "900" }, question: { color: "#173f35", fontSize: 20, lineHeight: 27, fontWeight: "900", textAlign: "center", marginTop: 13 }, answers: { gap: 8, marginTop: 14 }, answer: { minHeight: 56, borderRadius: 16, borderWidth: 1, borderColor: "#dedad1", flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 10 }, answerSelected: { borderColor: "#0b654f", backgroundColor: "#e8f5ef" }, answerLocked: { opacity: .55 }, answerLetter: { width: 32, height: 32, borderRadius: 11, textAlign: "center", textAlignVertical: "center", backgroundColor: "#edf5f1", color: "#0b654f", fontWeight: "900" }, answerText: { flex: 1, color: "#294b42", fontSize: 11, fontWeight: "800" },
  resultIcon: { fontSize: 38, textAlign: "center", marginBottom: 5 }, resultAnswer: { color: "#a17c36", fontSize: 22, fontWeight: "900", textAlign: "center", marginTop: 10 }, secretIcon: { fontSize: 39, textAlign: "center" }, secretDanger: { color: "#9c443e", fontSize: 17, fontWeight: "900", textAlign: "center", marginTop: 7 }, secretWord: { color: "#0b654f", fontSize: 29, lineHeight: 36, fontWeight: "900", textAlign: "center", marginTop: 10 }, voteTitle: { color: "#9a7a3c", fontSize: 8, fontWeight: "900", letterSpacing: 1, marginTop: 18, textAlign: "center" }, voteGrid: { flexDirection: "row", flexWrap: "wrap", gap: 7, marginTop: 8 }, voteButton: { minWidth: "47%", flexGrow: 1, minHeight: 46, borderRadius: 14, backgroundColor: "#edf5f1", alignItems: "center", justifyContent: "center", paddingHorizontal: 8 }, voteSelected: { backgroundColor: "#d9bd70" }, voteText: { color: "#264b41", fontSize: 10, fontWeight: "900" }, skip: { minHeight: 43, borderRadius: 14, marginTop: 9, alignItems: "center", justifyContent: "center", backgroundColor: "#f4eee5" }, skipText: { color: "#816a4c", fontSize: 9, fontWeight: "900" }, bigHint: { fontSize: 46, textAlign: "center", marginTop: 10 }
});
