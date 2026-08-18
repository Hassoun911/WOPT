import type { Env } from "./types";

type GameType = "trivia" | "imposter" | "clue";
type GameCategory = "islamic" | "sports";
type Localized = { en: string; ar: string };

type RoomRow = {
  code: string;
  game_type: GameType;
  category: GameCategory;
  status: "lobby" | "playing" | "finished";
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
};

type GameState = {
  phase?: "lobby" | "question" | "discussion" | "clue" | "results";
  round?: number;
  index?: number;
  endsAt?: number;
  answers?: Record<string, number>;
  votes?: Record<string, string>;
  imposterId?: string;
  activePlayerId?: string;
  lastResult?: { kind: "correct" | "skip"; guessedBy?: string };
};

const TRIVIA: Record<GameCategory, Array<{ prompt: Localized; choices: Localized[]; answer: number }>> = {
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

const IMPOSTER_WORDS: Record<GameCategory, Localized[]> = {
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

const CLUE_WORDS: Record<GameCategory, Localized[]> = {
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
  return value === "trivia" || value === "imposter" || value === "clue";
}

function validCategory(value: unknown): value is GameCategory {
  return value === "islamic" || value === "sports";
}

function randomCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (value) => alphabet[value % alphabet.length]).join("");
}

function parseState(value: string): GameState {
  try { return JSON.parse(value) as GameState; } catch { return {}; }
}

async function roomByCode(env: Env, code: string) {
  return env.DB.prepare("SELECT * FROM game_rooms WHERE code = ?").bind(code).first<RoomRow>();
}

async function playersFor(env: Env, code: string) {
  const rows = await env.DB.prepare("SELECT * FROM game_players WHERE room_code = ? ORDER BY joined_at ASC").bind(code).all<PlayerRow>();
  return rows.results ?? [];
}

async function saveState(env: Env, code: string, status: RoomRow["status"], state: GameState) {
  await env.DB.prepare("UPDATE game_rooms SET status = ?, state_json = ?, updated_at = CURRENT_TIMESTAMP WHERE code = ?")
    .bind(status, JSON.stringify(state), code).run();
}

function roundIndex(round: number, length: number) {
  return length ? (round - 1) % length : 0;
}

function newRound(room: RoomRow, players: PlayerRow[], round: number): GameState {
  if (room.game_type === "trivia") {
    const bank = TRIVIA[room.category];
    return { phase: "question", round, index: roundIndex(round, bank.length), answers: {}, endsAt: Date.now() + 20_000 };
  }
  if (room.game_type === "imposter") {
    const bytes = new Uint8Array(1);
    crypto.getRandomValues(bytes);
    const imposter = players[(bytes[0] ?? 0) % players.length]!;
    return { phase: "discussion", round, index: roundIndex(round, IMPOSTER_WORDS[room.category].length), votes: {}, imposterId: imposter.player_id };
  }
  const active = players[roundIndex(round, players.length)]!;
  return { phase: "clue", round, index: roundIndex(round, CLUE_WORDS[room.category].length), activePlayerId: active.player_id };
}

async function maybeExpireTrivia(env: Env, room: RoomRow) {
  if (room.game_type !== "trivia") return room;
  const state = parseState(room.state_json);
  if (state.phase !== "question" || !state.endsAt || state.endsAt > Date.now()) return room;
  state.phase = "results";
  await saveState(env, room.code, "playing", state);
  return { ...room, state_json: JSON.stringify(state), status: "playing" as const };
}

function publicRoom(room: RoomRow, players: PlayerRow[], playerId: string) {
  const state = parseState(room.state_json);
  const baseState: Record<string, unknown> = {
    phase: state.phase ?? "lobby",
    round: state.round ?? 0,
    endsAt: state.endsAt ?? null,
    activePlayerId: state.activePlayerId ?? null,
    lastResult: state.lastResult ?? null
  };
  const privateState: Record<string, unknown> = {};

  if (room.game_type === "trivia" && typeof state.index === "number") {
    const question = TRIVIA[room.category][state.index % TRIVIA[room.category].length]!;
    baseState.question = { prompt: question.prompt, choices: question.choices };
    baseState.answeredPlayerIds = Object.keys(state.answers ?? {});
    if (state.phase === "results") baseState.correctIndex = question.answer;
    privateState.answer = state.answers?.[playerId] ?? null;
  }

  if (room.game_type === "imposter" && typeof state.index === "number") {
    const word = IMPOSTER_WORDS[room.category][state.index % IMPOSTER_WORDS[room.category].length];
    baseState.votedPlayerIds = Object.keys(state.votes ?? {});
    privateState.vote = state.votes?.[playerId] ?? null;
    if (state.phase === "results") {
      baseState.imposterId = state.imposterId;
      baseState.word = word;
      const counts: Record<string, number> = {};
      Object.values(state.votes ?? {}).forEach((id) => { counts[id] = (counts[id] ?? 0) + 1; });
      const top = Object.entries(counts).sort((a, b) => b[1] - a[1]);
      baseState.caught = Boolean(top[0] && top[0][0] === state.imposterId && (!top[1] || top[0][1] > top[1][1]));
    } else if (state.imposterId === playerId) {
      privateState.role = "imposter";
    } else {
      privateState.role = "player";
      privateState.word = word;
    }
  }

  if (room.game_type === "clue" && typeof state.index === "number") {
    const word = CLUE_WORDS[room.category][state.index % CLUE_WORDS[room.category].length];
    if (state.activePlayerId === playerId && state.phase === "clue") privateState.word = word;
  }

  return {
    room: {
      code: room.code,
      gameType: room.game_type,
      category: room.category,
      status: room.status,
      hostPlayerId: room.host_player_id,
      state: baseState,
      private: privateState,
      players: players.map((player) => ({
        id: player.player_id,
        name: player.name,
        score: player.score,
        isHost: player.is_host === 1
      }))
    }
  };
}

async function createRoom(request: Request, env: Env) {
  const body = (await request.json()) as Record<string, unknown>;
  if (!validPlayerId(body.playerId)) return json({ error: "Invalid player" }, 400);
  if (!validGame(body.gameType) || !validCategory(body.category)) return json({ error: "Invalid game or category" }, 400);
  const name = cleanName(body.playerName);
  if (name.length < 2) return json({ error: "Enter your name" }, 400);

  let code = randomCode();
  for (let i = 0; i < 5 && await roomByCode(env, code); i += 1) code = randomCode();
  const state: GameState = { phase: "lobby", round: 0 };
  await env.DB.batch([
    env.DB.prepare("INSERT INTO game_rooms (code, game_type, category, status, host_player_id, state_json) VALUES (?, ?, ?, 'lobby', ?, ?)")
      .bind(code, body.gameType, body.category, body.playerId, JSON.stringify(state)),
    env.DB.prepare("INSERT INTO game_players (room_code, player_id, name, score, is_host) VALUES (?, ?, ?, 0, 1)")
      .bind(code, body.playerId, name)
  ]);
  const room = await roomByCode(env, code);
  const players = await playersFor(env, code);
  return json(publicRoom(room!, players, body.playerId));
}

async function joinRoom(request: Request, env: Env) {
  const body = (await request.json()) as Record<string, unknown>;
  if (!validPlayerId(body.playerId)) return json({ error: "Invalid player" }, 400);
  const code = typeof body.code === "string" ? body.code.trim().toUpperCase() : "";
  const name = cleanName(body.playerName);
  if (!/^[A-Z2-9]{6}$/.test(code) || name.length < 2) return json({ error: "Check the room code and name" }, 400);
  const room = await roomByCode(env, code);
  if (!room) return json({ error: "Room not found" }, 404);
  const current = await playersFor(env, code);
  if (current.length >= 12 && !current.some((p) => p.player_id === body.playerId)) return json({ error: "Room is full" }, 409);
  if (room.status !== "lobby" && !current.some((p) => p.player_id === body.playerId)) return json({ error: "Game already started" }, 409);
  await env.DB.prepare(
    `INSERT INTO game_players (room_code, player_id, name, score, is_host)
     VALUES (?, ?, ?, 0, 0)
     ON CONFLICT(room_code, player_id) DO UPDATE SET name = excluded.name, updated_at = CURRENT_TIMESTAMP`
  ).bind(code, body.playerId, name).run();
  const players = await playersFor(env, code);
  return json(publicRoom(room, players, body.playerId));
}

async function getRoom(env: Env, code: string, playerId: string) {
  if (!validPlayerId(playerId)) return json({ error: "Invalid player" }, 400);
  let room = await roomByCode(env, code);
  if (!room) return json({ error: "Room not found" }, 404);
  const players = await playersFor(env, code);
  if (!players.some((p) => p.player_id === playerId)) return json({ error: "Join the room first" }, 403);
  room = await maybeExpireTrivia(env, room);
  await env.DB.prepare("UPDATE game_players SET updated_at = CURRENT_TIMESTAMP WHERE room_code = ? AND player_id = ?").bind(code, playerId).run();
  return json(publicRoom(room, players, playerId));
}

async function action(request: Request, env: Env, code: string) {
  const body = (await request.json()) as Record<string, unknown>;
  if (!validPlayerId(body.playerId)) return json({ error: "Invalid player" }, 400);
  const actionType = typeof body.type === "string" ? body.type : "";
  let room = await roomByCode(env, code);
  if (!room) return json({ error: "Room not found" }, 404);
  let players = await playersFor(env, code);
  const player = players.find((p) => p.player_id === body.playerId);
  if (!player) return json({ error: "Join the room first" }, 403);
  room = await maybeExpireTrivia(env, room);
  let state = parseState(room.state_json);
  const isHost = room.host_player_id === body.playerId;

  if (actionType === "start") {
    if (!isHost) return json({ error: "Only the host can start" }, 403);
    if (players.length < 2) return json({ error: "At least 2 players are required" }, 409);
    state = newRound(room, players, 1);
    await saveState(env, code, "playing", state);
  } else if (actionType === "next") {
    const activeCanAdvance = room.game_type === "clue" && state.activePlayerId === body.playerId;
    if (!isHost && !activeCanAdvance) return json({ error: "Only the host or active clue player can continue" }, 403);
    if (state.phase !== "results") return json({ error: "Round is not finished" }, 409);
    state = newRound(room, players, (state.round ?? 0) + 1);
    await saveState(env, code, "playing", state);
  } else if (actionType === "answer" && room.game_type === "trivia") {
    if (state.phase !== "question" || typeof state.index !== "number") return json({ error: "Question is closed" }, 409);
    const answer = Number(body.answer);
    if (!Number.isInteger(answer) || answer < 0 || answer > 3) return json({ error: "Invalid answer" }, 400);
    const answers = { ...(state.answers ?? {}) };
    if (answers[player.player_id] === undefined) {
      answers[player.player_id] = answer;
      const question = TRIVIA[room.category][state.index % TRIVIA[room.category].length]!;
      if (answer === question.answer) {
        await env.DB.prepare("UPDATE game_players SET score = score + 1, updated_at = CURRENT_TIMESTAMP WHERE room_code = ? AND player_id = ?")
          .bind(code, player.player_id).run();
      }
    }
    state.answers = answers;
    if (Object.keys(answers).length >= players.length) state.phase = "results";
    await saveState(env, code, "playing", state);
  } else if (actionType === "vote" && room.game_type === "imposter") {
    if (state.phase !== "discussion" || !state.imposterId) return json({ error: "Voting is closed" }, 409);
    const target = typeof body.targetPlayerId === "string" ? body.targetPlayerId : "";
    if (!players.some((p) => p.player_id === target) || target === player.player_id) return json({ error: "Invalid vote" }, 400);
    const votes = { ...(state.votes ?? {}), [player.player_id]: target };
    state.votes = votes;
    if (Object.keys(votes).length >= players.length) {
      state.phase = "results";
      const counts: Record<string, number> = {};
      Object.values(votes).forEach((id) => { counts[id] = (counts[id] ?? 0) + 1; });
      const top = Object.entries(counts).sort((a, b) => b[1] - a[1]);
      const caught = Boolean(top[0] && top[0][0] === state.imposterId && (!top[1] || top[0][1] > top[1][1]));
      const statements = [];
      for (const [voter, votedFor] of Object.entries(votes)) {
        if (votedFor === state.imposterId) statements.push(env.DB.prepare("UPDATE game_players SET score = score + 1 WHERE room_code = ? AND player_id = ?").bind(code, voter));
      }
      if (!caught) statements.push(env.DB.prepare("UPDATE game_players SET score = score + 2 WHERE room_code = ? AND player_id = ?").bind(code, state.imposterId));
      if (statements.length) await env.DB.batch(statements);
    }
    await saveState(env, code, "playing", state);
  } else if ((actionType === "clue_correct" || actionType === "clue_skip") && room.game_type === "clue") {
    if (state.phase !== "clue" || state.activePlayerId !== player.player_id) return json({ error: "Only the active clue player can score this round" }, 403);
    if (actionType === "clue_correct") {
      const guessedBy = typeof body.guessedBy === "string" ? body.guessedBy : "";
      if (!players.some((p) => p.player_id === guessedBy) || guessedBy === player.player_id) return json({ error: "Choose who guessed it" }, 400);
      await env.DB.batch([
        env.DB.prepare("UPDATE game_players SET score = score + 1 WHERE room_code = ? AND player_id = ?").bind(code, player.player_id),
        env.DB.prepare("UPDATE game_players SET score = score + 1 WHERE room_code = ? AND player_id = ?").bind(code, guessedBy)
      ]);
      state.lastResult = { kind: "correct", guessedBy };
    } else {
      state.lastResult = { kind: "skip" };
    }
    state.phase = "results";
    await saveState(env, code, "playing", state);
  } else {
    return json({ error: "Invalid game action" }, 400);
  }

  room = (await roomByCode(env, code))!;
  players = await playersFor(env, code);
  return json(publicRoom(room, players, body.playerId));
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
