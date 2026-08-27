import type { Env } from "./types";

type GameType = "trivia" | "imposter" | "clue" | "wordrace" | "wordpuzzle";
type GameCategory = "islamic" | "sports" | "general";
type Localized = { en: string; ar: string };
type RoomStatus = "lobby" | "playing" | "finished";

type RoomRow = {
  code: string;
  game_type: GameType;
  category: GameCategory;
  status: RoomStatus;
  host_player_id: string;
  state_json: string;
  created_at: string;
  updated_at: string;
};

type PlayerRow = {
  room_code: string;
  player_id: string;
  name: string;
  score: number;
  is_host: number;
  joined_at: string;
  updated_at?: string;
};

type WordRaceEntry = Record<string, string>;
type GameState = {
  phase?: "lobby" | "question" | "discussion" | "clue" | "wordrace" | "puzzle" | "results";
  round?: number;
  maxRounds?: number;
  index?: number;
  endsAt?: number;
  answers?: Record<string, number>;
  textAnswers?: Record<string, string>;
  votes?: Record<string, string>;
  imposterId?: string;
  activePlayerId?: string;
  lastResult?: { kind: "correct" | "skip"; guessedBy?: string };
  letter?: Localized;
  wordRaceAnswers?: Record<string, WordRaceEntry>;
  wordRaceScores?: Record<string, Record<string, number>>;
};

const DEFAULT_ROUNDS = 5;
const WORD_RACE_CATEGORIES = ["insan", "haiwan", "nabat", "jamad", "balad"] as const;

const TRIVIA: Record<"islamic" | "sports", Array<{ prompt: Localized; choices: Localized[]; answer: number }>> = {
  islamic: [
    { prompt: { en: "How many obligatory daily prayers are there?", ar: "كم عدد الصلوات المفروضة في اليوم؟" }, choices: [{ en: "3", ar: "٣" }, { en: "4", ar: "٤" }, { en: "5", ar: "٥" }, { en: "6", ar: "٦" }], answer: 2 },
    { prompt: { en: "Which Surah opens the Qur’an?", ar: "ما السورة التي يفتتح بها القرآن؟" }, choices: [{ en: "Al-Fatiha", ar: "الفاتحة" }, { en: "Al-Baqarah", ar: "البقرة" }, { en: "Ya-Sin", ar: "يس" }, { en: "Al-Ikhlas", ar: "الإخلاص" }], answer: 0 },
    { prompt: { en: "Muslims fast during which month?", ar: "في أي شهر يصوم المسلمون؟" }, choices: [{ en: "Muharram", ar: "محرم" }, { en: "Ramadan", ar: "رمضان" }, { en: "Rajab", ar: "رجب" }, { en: "Shawwal", ar: "شوال" }], answer: 1 },
    { prompt: { en: "What direction do Muslims face in Salah?", ar: "إلى أي جهة يتوجه المسلمون في الصلاة؟" }, choices: [{ en: "The Kaaba", ar: "الكعبة" }, { en: "Mount Uhud", ar: "جبل أحد" }, { en: "The Nile", ar: "النيل" }, { en: "Any direction", ar: "أي جهة" }], answer: 0 },
    { prompt: { en: "What is the call to prayer called?", ar: "ماذا يسمى النداء إلى الصلاة؟" }, choices: [{ en: "Khutbah", ar: "الخطبة" }, { en: "Adhan", ar: "الأذان" }, { en: "Dhikr", ar: "الذكر" }, { en: "Dua", ar: "الدعاء" }], answer: 1 },
    { prompt: { en: "Which city contains Al-Masjid an-Nabawi?", ar: "في أي مدينة يقع المسجد النبوي؟" }, choices: [{ en: "Makkah", ar: "مكة" }, { en: "Madinah", ar: "المدينة المنورة" }, { en: "Jerusalem", ar: "القدس" }, { en: "Cairo", ar: "القاهرة" }], answer: 1 }
  ],
  sports: [
    { prompt: { en: "How many players from one soccer team are normally on the field?", ar: "كم لاعباً من فريق كرة القدم يكون عادة في الملعب؟" }, choices: [{ en: "9", ar: "٩" }, { en: "10", ar: "١٠" }, { en: "11", ar: "١١" }, { en: "12", ar: "١٢" }], answer: 2 },
    { prompt: { en: "How many points is a basketball free throw worth?", ar: "كم نقطة تساوي الرمية الحرة في كرة السلة؟" }, choices: [{ en: "1", ar: "١" }, { en: "2", ar: "٢" }, { en: "3", ar: "٣" }, { en: "4", ar: "٤" }], answer: 0 },
    { prompt: { en: "The FIFA World Cup is normally held every how many years?", ar: "كل كم سنة تقام كأس العالم لكرة القدم عادة؟" }, choices: [{ en: "2", ar: "٢" }, { en: "3", ar: "٣" }, { en: "4", ar: "٤" }, { en: "5", ar: "٥" }], answer: 2 },
    { prompt: { en: "In tennis, what does ‘love’ mean?", ar: "ماذا تعني كلمة Love في التنس؟" }, choices: [{ en: "Zero", ar: "صفر" }, { en: "One", ar: "واحد" }, { en: "Advantage", ar: "أفضلية" }, { en: "Tie", ar: "تعادل" }], answer: 0 },
    { prompt: { en: "Which sport uses a puck?", ar: "أي رياضة تستخدم القرص؟" }, choices: [{ en: "Ice hockey", ar: "هوكي الجليد" }, { en: "Baseball", ar: "البيسبول" }, { en: "Volleyball", ar: "الكرة الطائرة" }, { en: "Golf", ar: "الغولف" }], answer: 0 },
    { prompt: { en: "A home run belongs to which sport?", ar: "مصطلح Home Run ينتمي لأي رياضة؟" }, choices: [{ en: "Basketball", ar: "كرة السلة" }, { en: "Baseball", ar: "البيسبول" }, { en: "Tennis", ar: "التنس" }, { en: "Soccer", ar: "كرة القدم" }], answer: 1 }
  ]
};

const IMPOSTER_WORDS: Record<"islamic" | "sports", Localized[]> = {
  islamic: [
    { en: "Kaaba", ar: "الكعبة" }, { en: "Ramadan", ar: "رمضان" }, { en: "Zamzam", ar: "زمزم" },
    { en: "Sujood", ar: "السجود" }, { en: "Minaret", ar: "المئذنة" }, { en: "Madinah", ar: "المدينة" },
    { en: "Tasbih", ar: "التسبيح" }, { en: "Iftar", ar: "الإفطار" }
  ],
  sports: [
    { en: "Penalty kick", ar: "ركلة جزاء" }, { en: "Basketball", ar: "كرة السلة" }, { en: "Goalkeeper", ar: "حارس المرمى" },
    { en: "Tennis racket", ar: "مضرب التنس" }, { en: "World Cup", ar: "كأس العالم" }, { en: "Home run", ar: "هوم رن" },
    { en: "Touchdown", ar: "تاتش داون" }, { en: "Olympics", ar: "الأولمبياد" }
  ]
};

const CLUE_WORDS: Record<"islamic" | "sports", Localized[]> = {
  islamic: [
    { en: "Prayer mat", ar: "سجادة الصلاة" }, { en: "Adhan", ar: "الأذان" }, { en: "Qibla", ar: "القبلة" },
    { en: "Eid", ar: "العيد" }, { en: "Mushaf", ar: "المصحف" }, { en: "Sawm", ar: "الصيام" },
    { en: "Wudu", ar: "الوضوء" }, { en: "Hajj", ar: "الحج" }
  ],
  sports: [
    { en: "Corner kick", ar: "ركلة ركنية" }, { en: "Three-pointer", ar: "ثلاثية" }, { en: "Goal line", ar: "خط المرمى" },
    { en: "Serve", ar: "الإرسال" }, { en: "Referee", ar: "الحكم" }, { en: "Hat trick", ar: "هاتريك" },
    { en: "Relay race", ar: "سباق التتابع" }, { en: "Penalty box", ar: "منطقة الجزاء" }
  ]
};

const LETTERS: Localized[] = [
  { en: "A", ar: "أ" }, { en: "B", ar: "ب" }, { en: "T", ar: "ت" }, { en: "J", ar: "ج" },
  { en: "D", ar: "د" }, { en: "R", ar: "ر" }, { en: "S", ar: "س" }, { en: "F", ar: "ف" },
  { en: "K", ar: "ك" }, { en: "M", ar: "م" }, { en: "N", ar: "ن" }, { en: "H", ar: "ه" }
];

const WORD_PUZZLES: Array<{ clue: Localized; answer: Localized }> = [
  { clue: { en: "The direction Muslims face in prayer", ar: "الجهة التي يتوجه إليها المسلم في الصلاة" }, answer: { en: "QIBLA", ar: "قبلة" } },
  { clue: { en: "Month of fasting", ar: "شهر الصيام" }, answer: { en: "RAMADAN", ar: "رمضان" } },
  { clue: { en: "Call to prayer", ar: "النداء إلى الصلاة" }, answer: { en: "ADHAN", ar: "أذان" } },
  { clue: { en: "The holy book of Islam", ar: "كتاب الإسلام المقدس" }, answer: { en: "QURAN", ar: "قرآن" } },
  { clue: { en: "Pilgrimage to Makkah", ar: "الحج إلى مكة" }, answer: { en: "HAJJ", ar: "حج" } },
  { clue: { en: "A place where Muslims pray together", ar: "مكان صلاة المسلمين جماعة" }, answer: { en: "MOSQUE", ar: "مسجد" } },
  { clue: { en: "Breaking the fast at sunset", ar: "كسر الصيام عند المغرب" }, answer: { en: "IFTAR", ar: "إفطار" } },
  { clue: { en: "Purification before Salah", ar: "الطهارة قبل الصلاة" }, answer: { en: "WUDU", ar: "وضوء" } }
];

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}

function cleanName(value: unknown) {
  if (typeof value !== "string") return "";
  return value.trim().replace(/\s+/g, " ").slice(0, 24);
}
function validPlayerId(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{8,128}$/.test(value);
}
function validGame(value: unknown): value is GameType {
  return value === "trivia" || value === "imposter" || value === "clue" || value === "wordrace" || value === "wordpuzzle";
}
function validCategory(value: unknown): value is GameCategory {
  return value === "islamic" || value === "sports" || value === "general";
}
function randomCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint8Array(6); crypto.getRandomValues(bytes);
  return Array.from(bytes, (value) => alphabet[value % alphabet.length]).join("");
}
function randomIndex(length: number) {
  const bytes = new Uint8Array(1); crypto.getRandomValues(bytes);
  return length ? (bytes[0] ?? 0) % length : 0;
}
function roundIndex(round: number, length: number) { return length ? (round - 1) % length : 0; }
function parseState(value: string): GameState { try { return JSON.parse(value) as GameState; } catch { return {}; } }
function normalize(value: string) {
  return value.trim().toLocaleLowerCase().normalize("NFKD")
    .replace(/[\u064B-\u065F\u0670]/g, "")
    .replace(/[إأآٱ]/g, "ا")
    .replace(/[^\p{L}\p{N}]+/gu, "");
}
function startsWithLetter(value: string, letter: Localized) {
  const n = normalize(value); if (!n) return false;
  return n.startsWith(normalize(letter.en)) || n.startsWith(normalize(letter.ar));
}
function shuffleWord(value: string) {
  const chars = [...value];
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomIndex(i + 1); [chars[i], chars[j]] = [chars[j]!, chars[i]!];
  }
  const mixed = chars.join("");
  return normalize(mixed) === normalize(value) && chars.length > 2 ? [...chars.slice(1), chars[0]!].join("") : mixed;
}

async function roomByCode(env: Env, code: string) {
  return env.DB.prepare("SELECT * FROM game_rooms WHERE code = ?").bind(code).first<RoomRow>();
}
async function playersFor(env: Env, code: string) {
  const rows = await env.DB.prepare("SELECT * FROM game_players WHERE room_code = ? ORDER BY joined_at ASC").bind(code).all<PlayerRow>();
  return rows.results ?? [];
}
async function saveState(env: Env, code: string, status: RoomStatus, state: GameState) {
  await env.DB.prepare("UPDATE game_rooms SET status=?,state_json=?,updated_at=CURRENT_TIMESTAMP WHERE code=?")
    .bind(status, JSON.stringify(state), code).run();
}
async function settingFor(env: Env, gameType: GameType) {
  return await env.DB.prepare("SELECT enabled,max_rounds FROM game_settings WHERE game_type=?").bind(gameType).first<{ enabled: number; max_rounds: number }>()
    ?? { enabled: 1, max_rounds: DEFAULT_ROUNDS };
}

function newRound(room: RoomRow, players: PlayerRow[], round: number, maxRounds: number): GameState {
  if (room.game_type === "trivia") {
    const bank = TRIVIA[room.category === "sports" ? "sports" : "islamic"];
    return { phase: "question", round, maxRounds, index: roundIndex(round, bank.length), answers: {}, endsAt: Date.now() + 20_000 };
  }
  if (room.game_type === "imposter") {
    const bank = IMPOSTER_WORDS[room.category === "sports" ? "sports" : "islamic"];
    const imposter = players[randomIndex(players.length)]!;
    return { phase: "discussion", round, maxRounds, index: roundIndex(round, bank.length), votes: {}, imposterId: imposter.player_id, endsAt: Date.now() + 60_000 };
  }
  if (room.game_type === "clue") {
    const bank = CLUE_WORDS[room.category === "sports" ? "sports" : "islamic"];
    const active = players[roundIndex(round, players.length)]!;
    return { phase: "clue", round, maxRounds, index: roundIndex(round, bank.length), activePlayerId: active.player_id, endsAt: Date.now() + 60_000 };
  }
  if (room.game_type === "wordrace") {
    return { phase: "wordrace", round, maxRounds, letter: LETTERS[roundIndex(round + randomIndex(LETTERS.length), LETTERS.length)]!, wordRaceAnswers: {}, endsAt: Date.now() + 90_000 };
  }
  return { phase: "puzzle", round, maxRounds, index: roundIndex(round + randomIndex(WORD_PUZZLES.length), WORD_PUZZLES.length), textAnswers: {}, endsAt: Date.now() + 30_000 };
}

async function finishRoom(env: Env, room: RoomRow, state: GameState, reason = "completed") {
  const freshPlayers = await playersFor(env, room.code);
  const topScore = freshPlayers.length ? Math.max(...freshPlayers.map((p) => p.score)) : 0;
  const winners = freshPlayers.filter((p) => p.score === topScore).map((p) => p.name);
  await saveState(env, room.code, "finished", { ...state, phase: "results", endsAt: undefined });
  await env.DB.prepare(
    `INSERT OR IGNORE INTO game_results (room_code,game_type,category,winner_names,scores_json,rounds_played,ended_reason)
     VALUES (?,?,?,?,?,?,?)`
  ).bind(
    room.code, room.game_type, room.category, winners.join(", "),
    JSON.stringify(freshPlayers.map((p) => ({ id: p.player_id, name: p.name, score: p.score }))),
    state.round ?? 0, reason
  ).run();
}

async function closeTrivia(env: Env, room: RoomRow, state: GameState, players: PlayerRow[]) {
  if (state.phase !== "question" || typeof state.index !== "number") return;
  state.phase = "results"; state.endsAt = undefined;
  if ((state.round ?? 0) >= (state.maxRounds ?? DEFAULT_ROUNDS)) await finishRoom(env, room, state);
  else await saveState(env, room.code, "playing", state);
}

async function closeImposter(env: Env, room: RoomRow, state: GameState, players: PlayerRow[]) {
  if (state.phase !== "discussion" || !state.imposterId) return;
  const votes = state.votes ?? {};
  const counts: Record<string, number> = {};
  Object.values(votes).forEach((id) => { counts[id] = (counts[id] ?? 0) + 1; });
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const caught = Boolean(top[0] && top[0][0] === state.imposterId && (!top[1] || top[0][1] > top[1][1]));
  const statements = [];
  for (const [voter, target] of Object.entries(votes)) {
    if (target === state.imposterId) statements.push(env.DB.prepare("UPDATE game_players SET score=score+1 WHERE room_code=? AND player_id=?").bind(room.code, voter));
  }
  if (!caught) statements.push(env.DB.prepare("UPDATE game_players SET score=score+2 WHERE room_code=? AND player_id=?").bind(room.code, state.imposterId));
  if (statements.length) await env.DB.batch(statements);
  state.phase = "results"; state.endsAt = undefined;
  if ((state.round ?? 0) >= (state.maxRounds ?? DEFAULT_ROUNDS)) await finishRoom(env, room, state);
  else await saveState(env, room.code, "playing", state);
}

async function closeClue(env: Env, room: RoomRow, state: GameState) {
  if (state.phase !== "clue") return;
  state.phase = "results"; state.endsAt = undefined; state.lastResult = state.lastResult ?? { kind: "skip" };
  if ((state.round ?? 0) >= (state.maxRounds ?? DEFAULT_ROUNDS)) await finishRoom(env, room, state);
  else await saveState(env, room.code, "playing", state);
}

async function closeWordRace(env: Env, room: RoomRow, state: GameState, players: PlayerRow[]) {
  if (state.phase !== "wordrace" || !state.letter) return;
  const submissions = state.wordRaceAnswers ?? {};
  const scores: Record<string, Record<string, number>> = {};
  const increments: Record<string, number> = {};
  for (const category of WORD_RACE_CATEGORIES) {
    const valid = players.map((p) => ({ id: p.player_id, answer: String(submissions[p.player_id]?.[category] ?? "").trim() }))
      .filter((x) => x.answer && startsWithLetter(x.answer, state.letter!));
    const counts: Record<string, number> = {};
    valid.forEach((x) => { const key = normalize(x.answer); counts[key] = (counts[key] ?? 0) + 1; });
    for (const p of players) {
      scores[p.player_id] ??= {};
      const answer = String(submissions[p.player_id]?.[category] ?? "").trim();
      let points = 0;
      if (answer && startsWithLetter(answer, state.letter)) {
        const same = counts[normalize(answer)] ?? 0;
        if (valid.length === 1) points = 20;
        else if (same > 1) points = 5;
        else points = 10;
      }
      scores[p.player_id]![category] = points;
      increments[p.player_id] = (increments[p.player_id] ?? 0) + points;
    }
  }
  const statements = Object.entries(increments).map(([id, points]) => env.DB.prepare("UPDATE game_players SET score=score+? WHERE room_code=? AND player_id=?").bind(points, room.code, id));
  if (statements.length) await env.DB.batch(statements);
  state.wordRaceScores = scores; state.phase = "results"; state.endsAt = undefined;
  if ((state.round ?? 0) >= (state.maxRounds ?? DEFAULT_ROUNDS)) await finishRoom(env, room, state);
  else await saveState(env, room.code, "playing", state);
}

async function closePuzzle(env: Env, room: RoomRow, state: GameState) {
  if (state.phase !== "puzzle") return;
  state.phase = "results"; state.endsAt = undefined;
  if ((state.round ?? 0) >= (state.maxRounds ?? DEFAULT_ROUNDS)) await finishRoom(env, room, state);
  else await saveState(env, room.code, "playing", state);
}

async function maybeExpireRoom(env: Env, room: RoomRow) {
  if (room.status !== "playing") return room;
  const state = parseState(room.state_json);
  if (!state.endsAt || state.endsAt > Date.now()) return room;
  const players = await playersFor(env, room.code);
  if (room.game_type === "trivia") await closeTrivia(env, room, state, players);
  else if (room.game_type === "imposter") await closeImposter(env, room, state, players);
  else if (room.game_type === "clue") await closeClue(env, room, state);
  else if (room.game_type === "wordrace") await closeWordRace(env, room, state, players);
  else if (room.game_type === "wordpuzzle") await closePuzzle(env, room, state);
  return (await roomByCode(env, room.code)) ?? room;
}

function publicRoom(room: RoomRow, players: PlayerRow[], playerId: string) {
  const state = parseState(room.state_json);
  const baseState: Record<string, unknown> = {
    phase: state.phase ?? "lobby", round: state.round ?? 0, maxRounds: state.maxRounds ?? DEFAULT_ROUNDS,
    endsAt: state.endsAt ?? null, activePlayerId: state.activePlayerId ?? null, lastResult: state.lastResult ?? null,
    wordRaceCategories: WORD_RACE_CATEGORIES
  };
  const privateState: Record<string, unknown> = {};
  if (room.game_type === "trivia" && typeof state.index === "number") {
    const bank = TRIVIA[room.category === "sports" ? "sports" : "islamic"];
    const q = bank[state.index % bank.length]!;
    baseState.question = { prompt: q.prompt, choices: q.choices };
    baseState.answeredPlayerIds = Object.keys(state.answers ?? {});
    if (state.phase === "results") baseState.correctIndex = q.answer;
    privateState.answer = state.answers?.[playerId] ?? null;
  }
  if (room.game_type === "imposter" && typeof state.index === "number") {
    const bank = IMPOSTER_WORDS[room.category === "sports" ? "sports" : "islamic"];
    const word = bank[state.index % bank.length]!;
    baseState.votedPlayerIds = Object.keys(state.votes ?? {});
    privateState.vote = state.votes?.[playerId] ?? null;
    if (state.phase === "results") {
      baseState.imposterId = state.imposterId; baseState.word = word;
    } else if (state.imposterId === playerId) privateState.role = "imposter";
    else { privateState.role = "player"; privateState.word = word; }
  }
  if (room.game_type === "clue" && typeof state.index === "number") {
    const bank = CLUE_WORDS[room.category === "sports" ? "sports" : "islamic"];
    if (state.activePlayerId === playerId && state.phase === "clue") privateState.word = bank[state.index % bank.length]!;
  }
  if (room.game_type === "wordrace") {
    baseState.letter = state.letter ?? null;
    baseState.submittedPlayerIds = Object.keys(state.wordRaceAnswers ?? {});
    if (state.phase === "results") baseState.wordRaceScores = state.wordRaceScores ?? {};
    privateState.wordRaceAnswers = state.wordRaceAnswers?.[playerId] ?? null;
  }
  if (room.game_type === "wordpuzzle" && typeof state.index === "number") {
    const puzzle = WORD_PUZZLES[state.index % WORD_PUZZLES.length]!;
    baseState.puzzle = { clue: puzzle.clue, scrambled: { en: shuffleWord(puzzle.answer.en), ar: shuffleWord(puzzle.answer.ar) } };
    baseState.answeredPlayerIds = Object.keys(state.textAnswers ?? {});
    if (state.phase === "results") baseState.puzzleAnswer = puzzle.answer;
    privateState.textAnswer = state.textAnswers?.[playerId] ?? null;
  }
  const max = players.length ? Math.max(...players.map((p) => p.score)) : 0;
  return { room: {
    code: room.code, gameType: room.game_type, category: room.category, status: room.status, hostPlayerId: room.host_player_id,
    state: baseState, private: privateState,
    players: players.map((p) => ({ id: p.player_id, name: p.name, score: p.score, isHost: p.is_host === 1 })),
    winners: room.status === "finished" ? players.filter((p) => p.score === max).map((p) => ({ id: p.player_id, name: p.name, score: p.score })) : []
  }};
}

async function createRoom(request: Request, env: Env) {
  const body = await request.json() as Record<string, unknown>;
  if (!validPlayerId(body.playerId)) return json({ error: "Invalid player" }, 400);
  if (!validGame(body.gameType)) return json({ error: "Invalid game" }, 400);
  let category: GameCategory = validCategory(body.category) ? body.category : "general";
  if (body.gameType === "wordrace" || body.gameType === "wordpuzzle") category = "general";
  if ((body.gameType === "trivia" || body.gameType === "imposter" || body.gameType === "clue") && category === "general") category = "islamic";
  const setting = await settingFor(env, body.gameType);
  if (!setting.enabled) return json({ error: "This game is currently disabled" }, 403);
  const name = cleanName(body.playerName); if (name.length < 2) return json({ error: "Enter your name" }, 400);
  let code = randomCode(); for (let i = 0; i < 5 && await roomByCode(env, code); i++) code = randomCode();
  const state: GameState = { phase: "lobby", round: 0, maxRounds: Math.max(1, Math.min(20, setting.max_rounds || DEFAULT_ROUNDS)) };
  await env.DB.batch([
    env.DB.prepare("INSERT INTO game_rooms (code,game_type,category,status,host_player_id,state_json) VALUES (?,?,?,'lobby',?,?)").bind(code, body.gameType, category, body.playerId, JSON.stringify(state)),
    env.DB.prepare("INSERT INTO game_players (room_code,player_id,name,score,is_host) VALUES (?,?,?,0,1)").bind(code, body.playerId, name)
  ]);
  return json(publicRoom((await roomByCode(env, code))!, await playersFor(env, code), body.playerId));
}

async function joinRoom(request: Request, env: Env) {
  const body = await request.json() as Record<string, unknown>;
  if (!validPlayerId(body.playerId)) return json({ error: "Invalid player" }, 400);
  const code = typeof body.code === "string" ? body.code.trim().toUpperCase() : "";
  const name = cleanName(body.playerName);
  if (!/^[A-Z2-9]{6}$/.test(code) || name.length < 2) return json({ error: "Check the room code and name" }, 400);
  let room = await roomByCode(env, code); if (!room) return json({ error: "Room not found" }, 404);
  room = await maybeExpireRoom(env, room);
  const current = await playersFor(env, code);
  if (current.length >= 12 && !current.some((p) => p.player_id === body.playerId)) return json({ error: "Room is full" }, 409);
  if (room.status !== "lobby" && !current.some((p) => p.player_id === body.playerId)) return json({ error: "Game already started" }, 409);
  await env.DB.prepare(`INSERT INTO game_players (room_code,player_id,name,score,is_host) VALUES (?,?,?,0,0)
    ON CONFLICT(room_code,player_id) DO UPDATE SET name=excluded.name,updated_at=CURRENT_TIMESTAMP`).bind(code, body.playerId, name).run();
  return json(publicRoom(room, await playersFor(env, code), body.playerId));
}

async function getRoom(env: Env, code: string, playerId: string) {
  if (!validPlayerId(playerId)) return json({ error: "Invalid player" }, 400);
  let room = await roomByCode(env, code); if (!room) return json({ error: "Room not found" }, 404);
  const before = await playersFor(env, code); if (!before.some((p) => p.player_id === playerId)) return json({ error: "Join the room first" }, 403);
  room = await maybeExpireRoom(env, room);
  await env.DB.prepare("UPDATE game_players SET updated_at=CURRENT_TIMESTAMP WHERE room_code=? AND player_id=?").bind(code, playerId).run();
  return json(publicRoom(room, await playersFor(env, code), playerId));
}

async function action(request: Request, env: Env, code: string) {
  const body = await request.json() as Record<string, unknown>;
  if (!validPlayerId(body.playerId)) return json({ error: "Invalid player" }, 400);
  const actionType = typeof body.type === "string" ? body.type : "";
  let room = await roomByCode(env, code); if (!room) return json({ error: "Room not found" }, 404);
  let players = await playersFor(env, code); const player = players.find((p) => p.player_id === body.playerId);
  if (!player) return json({ error: "Join the room first" }, 403);
  room = await maybeExpireRoom(env, room); players = await playersFor(env, code);
  let state = parseState(room.state_json); const isHost = room.host_player_id === body.playerId;
  if (room.status === "finished" && actionType !== "finish") return json(publicRoom(room, players, body.playerId));

  if (actionType === "start") {
    if (!isHost) return json({ error: "Only the host can start" }, 403);
    if (players.length < 2) return json({ error: "At least 2 players are required" }, 409);
    state = newRound(room, players, 1, state.maxRounds ?? DEFAULT_ROUNDS); await saveState(env, code, "playing", state);
  } else if (actionType === "next") {
    if (!isHost) return json({ error: "Only the host can continue" }, 403);
    if (state.phase !== "results") return json({ error: "Round is not finished" }, 409);
    if ((state.round ?? 0) >= (state.maxRounds ?? DEFAULT_ROUNDS)) await finishRoom(env, room, state);
    else { state = newRound(room, players, (state.round ?? 0) + 1, state.maxRounds ?? DEFAULT_ROUNDS); await saveState(env, code, "playing", state); }
  } else if (actionType === "finish") {
    if (!isHost) return json({ error: "Only the host can end the game" }, 403);
    await finishRoom(env, room, state, "ended_early");
  } else if (actionType === "answer" && room.game_type === "trivia") {
    if (state.phase !== "question" || typeof state.index !== "number") return json({ error: "Question is closed" }, 409);
    const answer = Number(body.answer); if (!Number.isInteger(answer) || answer < 0 || answer > 3) return json({ error: "Invalid answer" }, 400);
    const answers = { ...(state.answers ?? {}) };
    if (answers[player.player_id] === undefined) {
      answers[player.player_id] = answer;
      const bank = TRIVIA[room.category === "sports" ? "sports" : "islamic"]; const q = bank[state.index % bank.length]!;
      if (answer === q.answer) await env.DB.prepare("UPDATE game_players SET score=score+1 WHERE room_code=? AND player_id=?").bind(code, player.player_id).run();
    }
    state.answers = answers;
    if (Object.keys(answers).length >= players.length) await closeTrivia(env, room, state, players); else await saveState(env, code, "playing", state);
  } else if (actionType === "vote" && room.game_type === "imposter") {
    if (state.phase !== "discussion" || !state.imposterId) return json({ error: "Voting is closed" }, 409);
    const target = typeof body.targetPlayerId === "string" ? body.targetPlayerId : "";
    if (!players.some((p) => p.player_id === target) || target === player.player_id) return json({ error: "Invalid vote" }, 400);
    state.votes = { ...(state.votes ?? {}), [player.player_id]: target };
    if (Object.keys(state.votes).length >= players.length) await closeImposter(env, room, state, players); else await saveState(env, code, "playing", state);
  } else if ((actionType === "clue_correct" || actionType === "clue_skip") && room.game_type === "clue") {
    if (state.phase !== "clue" || state.activePlayerId !== player.player_id) return json({ error: "Only the active clue player can score this round" }, 403);
    if (actionType === "clue_correct") {
      const guessedBy = typeof body.guessedBy === "string" ? body.guessedBy : "";
      if (!players.some((p) => p.player_id === guessedBy) || guessedBy === player.player_id) return json({ error: "Choose who guessed it" }, 400);
      await env.DB.batch([
        env.DB.prepare("UPDATE game_players SET score=score+1 WHERE room_code=? AND player_id=?").bind(code, player.player_id),
        env.DB.prepare("UPDATE game_players SET score=score+1 WHERE room_code=? AND player_id=?").bind(code, guessedBy)
      ]); state.lastResult = { kind: "correct", guessedBy };
    } else state.lastResult = { kind: "skip" };
    await closeClue(env, room, state);
  } else if (actionType === "wordrace_submit" && room.game_type === "wordrace") {
    if (state.phase !== "wordrace") return json({ error: "Round is closed" }, 409);
    const raw = body.answers && typeof body.answers === "object" ? body.answers as Record<string, unknown> : {};
    const entry: WordRaceEntry = {};
    WORD_RACE_CATEGORIES.forEach((key) => { entry[key] = typeof raw[key] === "string" ? String(raw[key]).trim().slice(0, 50) : ""; });
    state.wordRaceAnswers = { ...(state.wordRaceAnswers ?? {}), [player.player_id]: entry };
    if (Object.keys(state.wordRaceAnswers).length >= players.length) await closeWordRace(env, room, state, players); else await saveState(env, code, "playing", state);
  } else if (actionType === "puzzle_answer" && room.game_type === "wordpuzzle") {
    if (state.phase !== "puzzle" || typeof state.index !== "number") return json({ error: "Puzzle is closed" }, 409);
    const text = typeof body.answer === "string" ? body.answer.trim().slice(0, 60) : ""; if (!text) return json({ error: "Enter an answer" }, 400);
    const answers = { ...(state.textAnswers ?? {}) };
    if (answers[player.player_id] === undefined) {
      answers[player.player_id] = text;
      const puzzle = WORD_PUZZLES[state.index % WORD_PUZZLES.length]!;
      if (normalize(text) === normalize(puzzle.answer.en) || normalize(text) === normalize(puzzle.answer.ar)) {
        await env.DB.prepare("UPDATE game_players SET score=score+2 WHERE room_code=? AND player_id=?").bind(code, player.player_id).run();
      }
    }
    state.textAnswers = answers;
    if (Object.keys(answers).length >= players.length) await closePuzzle(env, room, state); else await saveState(env, code, "playing", state);
  } else return json({ error: "Invalid game action" }, 400);

  room = (await roomByCode(env, code))!; players = await playersFor(env, code);
  return json(publicRoom(room, players, body.playerId));
}

export async function expireDueGameRooms(env: Env) {
  const rows = await env.DB.prepare("SELECT * FROM game_rooms WHERE status='playing' ORDER BY updated_at ASC LIMIT 50").all<RoomRow>();
  for (const room of rows.results ?? []) await maybeExpireRoom(env, room);
}

export async function handleGames(request: Request, env: Env, url: URL): Promise<Response | null> {
  if (request.method === "POST" && url.pathname === "/games/rooms") return createRoom(request, env);
  if (request.method === "POST" && url.pathname === "/games/rooms/join") return joinRoom(request, env);
  const roomMatch = url.pathname.match(/^\/games\/rooms\/([A-Z2-9]{6})$/);
  if (request.method === "GET" && roomMatch) return getRoom(env, roomMatch[1]!, url.searchParams.get("playerId") ?? "");
  const actionMatch = url.pathname.match(/^\/games\/rooms\/([A-Z2-9]{6})\/action$/);
  if (request.method === "POST" && actionMatch) return action(request, env, actionMatch[1]!);
  return null;
}
