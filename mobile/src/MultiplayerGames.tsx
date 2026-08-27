import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import BrandMark from "./BrandMark";
import GameHistoryCards from "./GameHistoryCards";

type Locale = "en" | "ar";
export type MultiplayerGameType = "trivia" | "imposter" | "clue" | "wordrace" | "wordpuzzle";
type Category = "islamic" | "sports" | "general";
type Localized = { en: string; ar: string };
type Player = { id: string; name: string; score: number; isHost: boolean };
type Room = {
  code: string;
  gameType: MultiplayerGameType;
  category: Category;
  status: "lobby" | "playing" | "finished";
  hostPlayerId: string;
  players: Player[];
  winners?: Player[];
  state: {
    phase?: string;
    round?: number;
    maxRounds?: number;
    endsAt?: number | null;
    activePlayerId?: string | null;
    question?: { prompt: Localized; choices: Localized[] };
    answeredPlayerIds?: string[];
    correctIndex?: number;
    letter?: Localized | null;
    wordRaceCategories?: string[];
    submittedPlayerIds?: string[];
    puzzle?: { clue: Localized; scrambled: Localized };
    puzzleAnswer?: Localized;
  };
  private: {
    answer?: number | null;
    role?: "imposter" | "player";
    word?: Localized;
    vote?: string | null;
    wordRaceAnswers?: Record<string, string> | null;
    textAnswer?: string | null;
  };
};

type Props = { locale: Locale; initialGame?: MultiplayerGameType; onBack: () => void };
const API_BASE = String(Constants.expoConfig?.extra?.pushApiUrl || "https://wopt-prayer-push.wopt-windsor.workers.dev").replace(/\/$/, "");
const PLAYER_ID_KEY = "wopt:games:player-id:v1";
const PLAYER_NAME_KEY = "wopt:games:player-name:v1";
const WORD_RACE_LABELS: Record<string, { en: string; ar: string }> = {
  insan: { en: "Insan / Name", ar: "إنسان / اسم" },
  haiwan: { en: "Haiwan / Animal", ar: "حيوان" },
  nabat: { en: "Nabat / Plant or Food", ar: "نبات / طعام" },
  jamad: { en: "Jamad / Object", ar: "جماد / شيء" },
  balad: { en: "Balad / Country or City", ar: "بلد / مدينة" }
};
const META: Record<MultiplayerGameType, { icon: string; en: string; ar: string; noteEn: string; noteAr: string; general?: boolean }> = {
  trivia: { icon: "⚡", en: "Live Trivia", ar: "مسابقة مباشرة", noteEn: "5 timed rounds • highest score wins", noteAr: "٥ جولات مؤقتة • أعلى نتيجة تفوز" },
  imposter: { icon: "🕵️", en: "Imposter", ar: "المندس", noteEn: "5 rounds • find who does not know the secret", noteAr: "٥ جولات • اكتشف من لا يعرف الكلمة" },
  clue: { icon: "🎯", en: "Clue Battle", ar: "معركة التلميحات", noteEn: "5 clue rounds • score together", noteAr: "٥ جولات تلميحات • اجمعوا النقاط" },
  wordrace: { icon: "✍️", en: "Insan • Haiwan • Shiee", ar: "إنسان • حيوان • شيء", noteEn: "Name • Animal • Plant • Object • Country/City", noteAr: "اسم • حيوان • نبات • جماد • بلد/مدينة", general: true },
  wordpuzzle: { icon: "🧩", en: "Word Puzzle", ar: "لغز الكلمات", noteEn: "Unscramble and solve 5 timed puzzles", noteAr: "حل ٥ ألغاز كلمات مؤقتة", general: true }
};

function makePlayerId() { return `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`; }
async function api(path: string, init?: RequestInit) {
  const response = await fetch(`${API_BASE}${path}`, { ...init, headers: { "Content-Type": "application/json" } });
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
  const [wordRace, setWordRace] = useState<Record<string, string>>({});
  const [puzzleAnswer, setPuzzleAnswer] = useState("");

  useEffect(() => { void (async () => {
    let id = await AsyncStorage.getItem(PLAYER_ID_KEY);
    if (!id) { id = makePlayerId(); await AsyncStorage.setItem(PLAYER_ID_KEY, id); }
    setPlayerId(id); setPlayerName((await AsyncStorage.getItem(PLAYER_NAME_KEY)) ?? "");
  })(); }, []);
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 500); return () => clearInterval(timer); }, []);
  useEffect(() => {
    if (!room?.code || !playerId) return;
    const timer = setInterval(() => { void api(`/games/rooms/${room.code}?playerId=${encodeURIComponent(playerId)}`).then(setRoom).catch(() => {}); }, 1200);
    return () => clearInterval(timer);
  }, [room?.code, playerId]);

  const isHost = room?.hostPlayerId === playerId;
  const secondsLeft = room?.state.endsAt ? Math.max(0, Math.ceil((room.state.endsAt - now) / 1000)) : null;
  const meta = game ? META[game] : null;
  const sortedPlayers = useMemo(() => room ? [...room.players].sort((a, b) => b.score - a.score) : [], [room]);
  const withBusy = async (run: () => Promise<Room>) => {
    setBusy(true); setError(null);
    try { setRoom(await run()); }
    catch (e) { setError(e instanceof Error ? e.message : t("Something went wrong", "حدث خطأ")); }
    finally { setBusy(false); }
  };
  const rememberName = async () => {
    const clean = playerName.trim().replace(/\s+/g, " ").slice(0, 24);
    setPlayerName(clean); if (clean) await AsyncStorage.setItem(PLAYER_NAME_KEY, clean); return clean;
  };
  const createRoom = async () => {
    if (!game || !playerId) return;
    const name = await rememberName(); if (name.length < 2) { setError(t("Enter your name first.", "اكتب اسمك أولاً.")); return; }
    await withBusy(() => api("/games/rooms", { method: "POST", body: JSON.stringify({ playerId, playerName: name, gameType: game, category: META[game].general ? "general" : category }) }));
  };
  const joinRoom = async () => {
    if (!playerId) return;
    const name = await rememberName(); const code = joinCode.trim().toUpperCase();
    if (name.length < 2 || code.length !== 6) { setError(t("Enter your name and 6-character room code.", "اكتب اسمك ورمز الغرفة المكون من ٦ أحرف.")); return; }
    await withBusy(async () => { const joined = await api("/games/rooms/join", { method: "POST", body: JSON.stringify({ playerId, playerName: name, code }) }); setGame(joined.gameType); setCategory(joined.category); return joined; });
  };
  const act = async (type: string, extra: Record<string, unknown> = {}) => {
    if (!room || !playerId) return;
    await withBusy(() => api(`/games/rooms/${room.code}/action`, { method: "POST", body: JSON.stringify({ playerId, type, ...extra }) }));
  };
  const leaveRoom = () => { setRoom(null); setJoinCode(""); setWordRace({}); setPuzzleAnswer(""); };

  if (!game && !room) {
    return <ScrollView style={styles.flex} contentContainerStyle={styles.screen} showsVerticalScrollIndicator={false}>
      <View style={styles.header}><Pressable onPress={onBack} style={styles.back}><Text style={styles.backText}>‹</Text></Pressable><BrandMark size={44}/><View style={styles.copy}><Text style={styles.eyebrow}>HASSOUN • MULTIPLAYER</Text><Text style={styles.title}>{t("Choose a game", "اختر لعبة")}</Text><Text style={styles.subtitle}>{t("Every match has a score, round limit and winner.", "كل لعبة لها نتيجة وعدد جولات وفائز.")}</Text></View></View>
      {(Object.keys(META) as MultiplayerGameType[]).map(id => { const item=META[id]; return <Pressable key={id} onPress={()=>setGame(id)} style={styles.gameCard}><View style={styles.gameIcon}><Text style={styles.gameEmoji}>{item.icon}</Text></View><View style={styles.copy}><Text style={styles.gameTitle}>{ar?item.ar:item.en}</Text><Text style={styles.gameNote}>{ar?item.noteAr:item.noteEn}</Text><View style={styles.tags}><Text style={styles.tag}>🏁 5 {t("rounds","جولات")}</Text><Text style={styles.tag}>👥 2–12</Text></View></View><Text style={styles.arrow}>›</Text></Pressable>; })}
      <GameHistoryCards locale={locale}/>
    </ScrollView>;
  }

  if (!room) {
    return <ScrollView style={styles.flex} contentContainerStyle={styles.screen} showsVerticalScrollIndicator={false}>
      <View style={styles.header}><Pressable onPress={()=>setGame(null)} style={styles.back}><Text style={styles.backText}>‹</Text></Pressable><BrandMark size={44}/><View style={styles.copy}><Text style={styles.eyebrow}>HASSOUN • GAMES</Text><Text style={styles.title}>{ar?meta?.ar:meta?.en}</Text><Text style={styles.subtitle}>{ar?meta?.noteAr:meta?.noteEn}</Text></View></View>
      <View style={styles.setupCard}><Text style={styles.label}>{t("YOUR NAME","اسمك")}</Text><TextInput value={playerName} onChangeText={setPlayerName} placeholder={t("Player name","اسم اللاعب")} placeholderTextColor="#9aa39f" style={styles.input} maxLength={24}/>{meta?.general?<View style={styles.generalPill}><Text style={styles.generalPillText}>🌍 {t("General word game • 5 rounds","لعبة كلمات عامة • ٥ جولات")}</Text></View>:<><Text style={styles.label}>{t("TOPIC","الموضوع")}</Text><View style={styles.categoryRow}><Pressable onPress={()=>setCategory("islamic")} style={[styles.categoryButton,category==="islamic"&&styles.categoryActive]}><Text style={[styles.categoryText,category==="islamic"&&styles.categoryTextActive]}>☾ {t("Islamic","إسلامي")}</Text></Pressable><Pressable onPress={()=>setCategory("sports")} style={[styles.categoryButton,category==="sports"&&styles.categoryActive]}><Text style={[styles.categoryText,category==="sports"&&styles.categoryTextActive]}>⚽ {t("Sports","رياضة")}</Text></Pressable></View></>}
      <Pressable onPress={()=>void createRoom()} disabled={busy} style={styles.primary}>{busy?<ActivityIndicator color="#fff"/>:<Text style={styles.primaryText}>＋ {t("Create multiplayer room","إنشاء غرفة جماعية")}</Text>}</Pressable></View>
      <View style={styles.orRow}><View style={styles.orLine}/><Text style={styles.orText}>{t("OR JOIN FRIENDS","أو انضم لأصدقائك")}</Text><View style={styles.orLine}/></View>
      <View style={styles.joinCard}><TextInput value={joinCode} onChangeText={v=>setJoinCode(v.toUpperCase().replace(/[^A-Z2-9]/g,"").slice(0,6))} autoCapitalize="characters" placeholder="ROOM CODE" placeholderTextColor="#9aa39f" style={[styles.input,styles.codeInput]} maxLength={6}/><Pressable onPress={()=>void joinRoom()} disabled={busy} style={styles.secondary}><Text style={styles.secondaryText}>{t("Join room","انضم للغرفة")}</Text></Pressable></View>
      {error?<Text style={styles.error}>{error}</Text>:null}
    </ScrollView>;
  }

  const phase=room.state.phase??"lobby";
  const submitted=Boolean(room.state.submittedPlayerIds?.includes(playerId));
  return <ScrollView style={styles.flex} contentContainerStyle={styles.screen} showsVerticalScrollIndicator={false}>
    <View style={styles.roomTop}><Pressable onPress={leaveRoom} style={styles.back}><Text style={styles.backText}>‹</Text></Pressable><BrandMark size={40}/><View style={styles.roomCodeWrap}><Text style={styles.roomCodeLabel}>{t("ROOM","الغرفة")}</Text><Text style={styles.roomCode}>{room.code}</Text></View><View style={styles.roundPill}><Text style={styles.roundText}>{phase==="lobby"?t("Lobby","انتظار"):`${t("Round","جولة")} ${room.state.round??1}/${room.state.maxRounds??5}`}</Text></View></View>
    <View style={styles.roomHero}><Text style={styles.roomHeroIcon}>{META[room.gameType].icon}</Text><View style={styles.copy}><Text style={styles.roomHeroTitle}>{ar?META[room.gameType].ar:META[room.gameType].en}</Text><Text style={styles.roomHeroMeta}>👥 {room.players.length}/12 • 🏁 {room.state.maxRounds??5} {t("rounds","جولات")}</Text></View>{secondsLeft!==null&&room.status==="playing"?<View style={styles.timer}><Text style={styles.timerText}>{secondsLeft}s</Text></View>:null}</View>

    {room.status==="finished"?<View style={styles.playCard}><Text style={styles.resultIcon}>🏆</Text><Text style={styles.playTitle}>{(room.winners?.length??0)>1?t("It’s a tie!","تعادل!"):t("We have a winner!","لدينا فائز!")}</Text><Text style={styles.winnerText}>{(room.winners??[]).map(w=>`${w.name} • ${w.score}`).join(" · ")}</Text><Text style={styles.playText}>{t("The game ended automatically and the result was saved.","انتهت اللعبة تلقائياً وتم حفظ النتيجة.")}</Text><Pressable onPress={leaveRoom} style={styles.primary}><Text style={styles.primaryText}>{t("Back to games","العودة للألعاب")}</Text></Pressable></View>:null}

    <View style={styles.scoreboard}>{sortedPlayers.map(p=><View key={p.id} style={[styles.playerRow,p.id===playerId&&styles.playerMe]}><View style={styles.avatar}><Text style={styles.avatarText}>{p.name.slice(0,1).toUpperCase()}</Text></View><Text style={styles.playerName}>{p.name}{p.isHost?" 👑":""}</Text><Text style={styles.playerScore}>{p.score}</Text></View>)}</View>

    {room.status!=="finished"&&phase==="lobby"?<View style={styles.playCard}><Text style={styles.playTitle}>{t("Invite friends with the room code","ادعُ أصدقاءك باستخدام رمز الغرفة")}</Text><Text style={styles.playText}>{t(`At least 2 players. This match ends automatically after ${room.state.maxRounds??5} rounds.`,`يلزم لاعبان على الأقل. تنتهي اللعبة تلقائياً بعد ${room.state.maxRounds??5} جولات.`)}</Text>{isHost?<Pressable onPress={()=>void act("start")} disabled={busy||room.players.length<2} style={[styles.primary,(busy||room.players.length<2)&&styles.disabled]}><Text style={styles.primaryText}>▶ {t("Start game","ابدأ اللعبة")}</Text></Pressable>:<Text style={styles.waiting}>{t("Waiting for the host…","بانتظار المضيف…")}</Text>}</View>:null}

    {room.status!=="finished"&&room.gameType==="trivia"&&phase==="question"&&room.state.question?<View style={styles.playCard}><Text style={styles.playTitle}>{ar?room.state.question.prompt.ar:room.state.question.prompt.en}</Text>{room.state.question.choices.map((c,i)=><Pressable key={i} disabled={room.private.answer!=null} onPress={()=>void act("answer",{answer:i})} style={[styles.choice,room.private.answer===i&&styles.choicePicked]}><Text style={styles.choiceText}>{ar?c.ar:c.en}</Text></Pressable>)}</View>:null}

    {room.status!=="finished"&&room.gameType==="imposter"&&phase==="discussion"?<View style={styles.playCard}><Text style={styles.playTitle}>{room.private.role==="imposter"?t("🕵️ You are the Imposter","🕵️ أنت المندس"):t("Secret word","الكلمة السرية")}</Text><Text style={styles.secret}>{room.private.role==="imposter"?t("Blend in without knowing the secret","حاول الاندماج دون معرفة الكلمة"):(ar?room.private.word?.ar:room.private.word?.en)}</Text><Text style={styles.playText}>{t("Discuss, then vote before time runs out.","ناقشوا ثم صوّتوا قبل انتهاء الوقت.")}</Text>{room.players.filter(p=>p.id!==playerId).map(p=><Pressable key={p.id} disabled={room.private.vote!=null} onPress={()=>void act("vote",{targetPlayerId:p.id})} style={styles.choice}><Text style={styles.choiceText}>{p.name}</Text></Pressable>)}</View>:null}

    {room.status!=="finished"&&room.gameType==="clue"&&phase==="clue"?<View style={styles.playCard}><Text style={styles.playTitle}>{t("Clue Battle","معركة التلميحات")}</Text>{room.state.activePlayerId===playerId?<><Text style={styles.playText}>{t("Give clues for this word:","أعط تلميحات لهذه الكلمة:")}</Text><Text style={styles.secret}>{ar?room.private.word?.ar:room.private.word?.en}</Text>{room.players.filter(p=>p.id!==playerId).map(p=><Pressable key={p.id} onPress={()=>void act("clue_correct",{guessedBy:p.id})} style={styles.choice}><Text style={styles.choiceText}>✓ {p.name} {t("guessed it","خمنها")}</Text></Pressable>)}<Pressable onPress={()=>void act("clue_skip")} style={styles.secondary}><Text style={styles.secondaryText}>{t("Skip","تخطي")}</Text></Pressable></>:<Text style={styles.waiting}>{t("Listen to the clue and guess before time runs out.","استمع للتلميح وخمّن قبل انتهاء الوقت.")}</Text>}</View>:null}

    {room.status!=="finished"&&room.gameType==="wordrace"&&phase==="wordrace"?<View style={styles.playCard}><Text style={styles.playTitle}>✍️ {t("Letter","الحرف")} {room.state.letter?.en} • {room.state.letter?.ar}</Text><Text style={styles.playText}>{t("10 unique • 5 duplicate • 0 blank/wrong letter • 20 if only valid answer","١٠ فريد • ٥ مكرر • ٠ فارغ/حرف خاطئ • ٢٠ إذا كنت الوحيد بإجابة صحيحة")}</Text>{(room.state.wordRaceCategories??Object.keys(WORD_RACE_LABELS)).map(k=>{const l=WORD_RACE_LABELS[k]??{en:k,ar:k};return <View key={k}><Text style={styles.label}>{ar?l.ar:l.en}</Text><TextInput editable={!submitted} value={wordRace[k]??""} onChangeText={v=>setWordRace(current=>({...current,[k]:v}))} placeholder={room.state.letter?.en??""} placeholderTextColor="#9aa39f" style={styles.input}/></View>})}<Pressable disabled={busy||submitted} onPress={()=>void act("wordrace_submit",{answers:wordRace})} style={[styles.primary,(busy||submitted)&&styles.disabled]}><Text style={styles.primaryText}>{submitted?t("Submitted ✓","تم الإرسال ✓"):t("STOP! Submit answers","توقف! أرسل الإجابات")}</Text></Pressable></View>:null}

    {room.status!=="finished"&&room.gameType==="wordpuzzle"&&phase==="puzzle"&&room.state.puzzle?<View style={styles.playCard}><Text style={styles.playTitle}>🧩 {t("Word Puzzle","لغز الكلمات")}</Text><Text style={styles.playText}>{ar?room.state.puzzle.clue.ar:room.state.puzzle.clue.en}</Text><Text style={styles.scramble}>{ar?room.state.puzzle.scrambled.ar:room.state.puzzle.scrambled.en}</Text><TextInput editable={room.private.textAnswer==null} value={puzzleAnswer} onChangeText={setPuzzleAnswer} placeholder={t("Your answer","إجابتك")} placeholderTextColor="#9aa39f" style={styles.input}/><Pressable disabled={busy||!puzzleAnswer.trim()||room.private.textAnswer!=null} onPress={()=>void act("puzzle_answer",{answer:puzzleAnswer})} style={[styles.primary,(busy||!puzzleAnswer.trim()||room.private.textAnswer!=null)&&styles.disabled]}><Text style={styles.primaryText}>{room.private.textAnswer!=null?t("Submitted ✓","تم الإرسال ✓"):t("Submit answer","أرسل الإجابة")}</Text></Pressable></View>:null}

    {room.status!=="finished"&&phase==="results"?<View style={styles.playCard}><Text style={styles.resultIcon}>✅</Text><Text style={styles.playTitle}>{t("Round complete","انتهت الجولة")}</Text>{room.state.puzzleAnswer?<Text style={styles.secret}>{t("Answer","الإجابة")}: {ar?room.state.puzzleAnswer.ar:room.state.puzzleAnswer.en}</Text>:null}{isHost?<Pressable onPress={()=>{setWordRace({});setPuzzleAnswer("");void act("next")}} style={styles.primary}><Text style={styles.primaryText}>{t("Next round","الجولة التالية")}</Text></Pressable>:<Text style={styles.waiting}>{t("Waiting for host…","بانتظار المضيف…")}</Text>}</View>:null}

    {room.status==="playing"&&isHost?<Pressable onPress={()=>void act("finish")} style={styles.finish}><Text style={styles.finishText}>🏁 {t("End match early","إنهاء اللعبة مبكراً")}</Text></Pressable>:null}
    {error?<Text style={styles.error}>{error}</Text>:null}
  </ScrollView>;
}

const styles=StyleSheet.create({
  flex:{flex:1,backgroundColor:"#f7f4ec"},screen:{padding:17,paddingBottom:40},header:{flexDirection:"row",gap:11,alignItems:"center",marginBottom:15},copy:{flex:1},back:{width:44,height:44,borderRadius:15,backgroundColor:"#fff",borderWidth:1,borderColor:"#dedbd3",alignItems:"center",justifyContent:"center"},backText:{color:"#0b654f",fontSize:31,lineHeight:33},eyebrow:{color:"#a17c36",fontSize:9,fontWeight:"900",letterSpacing:1.1},title:{color:"#173f35",fontSize:26,fontWeight:"900",marginTop:4},subtitle:{color:"#76837e",fontSize:10,lineHeight:15,marginTop:4},gameCard:{minHeight:108,borderRadius:22,backgroundColor:"#fff",borderWidth:1,borderColor:"#e1ddd4",padding:13,marginBottom:9,flexDirection:"row",alignItems:"center",gap:11},gameIcon:{width:56,height:56,borderRadius:18,backgroundColor:"#edf5f1",alignItems:"center",justifyContent:"center"},gameEmoji:{fontSize:28},gameTitle:{color:"#173f35",fontSize:16,fontWeight:"900"},gameNote:{color:"#7d8984",fontSize:8.5,lineHeight:13,marginTop:3},tags:{flexDirection:"row",gap:5,marginTop:7},tag:{fontSize:7,color:"#5e716b",backgroundColor:"#f3f4f0",paddingHorizontal:7,paddingVertical:4,borderRadius:99,overflow:"hidden"},arrow:{color:"#0b654f",fontSize:27},setupCard:{backgroundColor:"#fff",borderRadius:22,borderWidth:1,borderColor:"#e1ddd4",padding:15},label:{fontSize:8,fontWeight:"900",letterSpacing:.8,color:"#6f7e78",marginTop:10,marginBottom:5},input:{height:48,borderWidth:1,borderColor:"#d9d6ce",borderRadius:13,paddingHorizontal:13,color:"#173f35",backgroundColor:"#fff",fontSize:15},categoryRow:{flexDirection:"row",gap:8,marginBottom:14},categoryButton:{flex:1,borderWidth:1,borderColor:"#d7d7d0",borderRadius:12,paddingVertical:11,alignItems:"center"},categoryActive:{backgroundColor:"#0b654f",borderColor:"#0b654f"},categoryText:{color:"#586a64",fontWeight:"800"},categoryTextActive:{color:"#fff"},primary:{marginTop:14,minHeight:50,borderRadius:14,backgroundColor:"#0b654f",alignItems:"center",justifyContent:"center",paddingHorizontal:14},primaryText:{color:"#fff",fontWeight:"900",fontSize:14},secondary:{marginTop:10,minHeight:47,borderRadius:14,borderWidth:1,borderColor:"#0b654f",alignItems:"center",justifyContent:"center",paddingHorizontal:14},secondaryText:{color:"#0b654f",fontWeight:"900"},disabled:{opacity:.45},generalPill:{marginTop:12,padding:11,borderRadius:12,backgroundColor:"#edf5f1"},generalPillText:{color:"#0b654f",fontWeight:"800"},orRow:{flexDirection:"row",alignItems:"center",gap:8,marginVertical:15},orLine:{height:1,backgroundColor:"#ddd9d0",flex:1},orText:{fontSize:8,color:"#8b948f",fontWeight:"900"},joinCard:{backgroundColor:"#fff",borderRadius:20,borderWidth:1,borderColor:"#e1ddd4",padding:14},codeInput:{textAlign:"center",letterSpacing:3,fontWeight:"900"},error:{color:"#a43c31",backgroundColor:"#fff0ed",padding:11,borderRadius:12,marginTop:12},roomTop:{flexDirection:"row",alignItems:"center",gap:9},roomCodeWrap:{flex:1},roomCodeLabel:{fontSize:7,fontWeight:"900",color:"#9a814f"},roomCode:{fontSize:21,fontWeight:"900",letterSpacing:2,color:"#173f35"},roundPill:{backgroundColor:"#edf5f1",paddingHorizontal:10,paddingVertical:7,borderRadius:99},roundText:{fontSize:8,fontWeight:"900",color:"#0b654f"},roomHero:{marginTop:13,borderRadius:22,backgroundColor:"#173f35",padding:14,flexDirection:"row",alignItems:"center",gap:12},roomHeroIcon:{fontSize:30},roomHeroTitle:{color:"#fff",fontSize:18,fontWeight:"900"},roomHeroMeta:{color:"#c8ddd5",fontSize:9,marginTop:3},timer:{width:50,height:50,borderRadius:25,backgroundColor:"#fff",alignItems:"center",justifyContent:"center"},timerText:{color:"#0b654f",fontSize:15,fontWeight:"900"},scoreboard:{marginTop:12,backgroundColor:"#fff",borderRadius:19,borderWidth:1,borderColor:"#e1ddd4",overflow:"hidden"},playerRow:{flexDirection:"row",alignItems:"center",padding:10,borderBottomWidth:1,borderBottomColor:"#eeeae2",gap:9},playerMe:{backgroundColor:"#f0f7f3"},avatar:{width:30,height:30,borderRadius:15,backgroundColor:"#173f35",alignItems:"center",justifyContent:"center"},avatarText:{color:"#fff",fontWeight:"900"},playerName:{flex:1,color:"#173f35",fontWeight:"800"},playerScore:{fontWeight:"900",fontSize:17,color:"#a17c36"},playCard:{marginTop:12,backgroundColor:"#fff",borderRadius:21,borderWidth:1,borderColor:"#e1ddd4",padding:15},playTitle:{fontSize:18,fontWeight:"900",color:"#173f35",textAlign:"center"},playText:{fontSize:10,lineHeight:15,color:"#71807a",textAlign:"center",marginTop:7},waiting:{color:"#71807a",textAlign:"center",fontWeight:"800",padding:14},choice:{borderWidth:1,borderColor:"#dcd9d2",borderRadius:13,padding:12,marginTop:8,backgroundColor:"#faf9f5"},choicePicked:{borderColor:"#0b654f",backgroundColor:"#eaf5ef"},choiceText:{color:"#173f35",fontWeight:"800",textAlign:"center"},secret:{fontSize:22,fontWeight:"900",color:"#0b654f",textAlign:"center",paddingVertical:15},scramble:{fontSize:27,fontWeight:"900",letterSpacing:4,color:"#a17c36",textAlign:"center",paddingVertical:16},resultIcon:{fontSize:34,textAlign:"center",marginBottom:6},winnerText:{fontSize:18,color:"#a17c36",fontWeight:"900",textAlign:"center",marginTop:7},finish:{marginTop:12,borderRadius:14,borderWidth:1,borderColor:"#efc5be",backgroundColor:"#fff0ed",padding:12,alignItems:"center"},finishText:{color:"#9b3429",fontWeight:"900"}
});
