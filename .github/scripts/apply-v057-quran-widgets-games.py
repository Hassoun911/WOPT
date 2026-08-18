from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[2]


def read(path: str) -> str:
    return (ROOT / path).read_text()


def write(path: str, content: str) -> None:
    target = ROOT / path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content)


def replace_once(path: str, old: str, new: str) -> None:
    text = read(path)
    if old not in text:
        raise SystemExit(f"Missing expected block in {path}: {old[:120]!r}")
    write(path, text.replace(old, new, 1))


def regex_once(path: str, pattern: str, replacement: str) -> None:
    text = read(path)
    updated, count = re.subn(pattern, replacement, text, count=1, flags=re.S)
    if count != 1:
        raise SystemExit(f"Pattern matched {count} times in {path}: {pattern[:120]!r}")
    write(path, updated)


# -----------------------------------------------------------------------------
# Multiplayer backend (Cloudflare Worker + D1)
# -----------------------------------------------------------------------------
write("push-server/migrations/0007_multiplayer_games.sql", r'''CREATE TABLE IF NOT EXISTS game_rooms (
  code TEXT PRIMARY KEY,
  game_type TEXT NOT NULL CHECK (game_type IN ('trivia', 'imposter', 'clue')),
  category TEXT NOT NULL CHECK (category IN ('islamic', 'sports')),
  status TEXT NOT NULL DEFAULT 'lobby' CHECK (status IN ('lobby', 'playing', 'finished')),
  host_player_id TEXT NOT NULL,
  state_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS game_players (
  room_code TEXT NOT NULL,
  player_id TEXT NOT NULL,
  name TEXT NOT NULL,
  score INTEGER NOT NULL DEFAULT 0,
  is_host INTEGER NOT NULL DEFAULT 0,
  joined_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (room_code, player_id),
  FOREIGN KEY (room_code) REFERENCES game_rooms(code) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_game_rooms_updated ON game_rooms(updated_at);
CREATE INDEX IF NOT EXISTS idx_game_players_room ON game_players(room_code, joined_at);
''')

write("push-server/src/games.ts", r'''import type { Env } from "./types";

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
    const imposter = players[bytes[0] % players.length];
    return { phase: "discussion", round, index: roundIndex(round, IMPOSTER_WORDS[room.category].length), votes: {}, imposterId: imposter.player_id };
  }
  const active = players[roundIndex(round, players.length)];
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
    const question = TRIVIA[room.category][state.index % TRIVIA[room.category].length];
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
  const body = await request.json<Record<string, unknown>>();
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
  const body = await request.json<Record<string, unknown>>();
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
  const body = await request.json<Record<string, unknown>>();
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
      const question = TRIVIA[room.category][state.index % TRIVIA[room.category].length];
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
  if (request.method === "GET" && roomMatch) return getRoom(env, roomMatch[1], url.searchParams.get("playerId") ?? "");
  const actionMatch = url.pathname.match(/^\/games\/rooms\/([A-Z2-9]{6})\/action$/);
  if (request.method === "POST" && actionMatch) return action(request, env, actionMatch[1]);
  return null;
}
''')

# Wire multiplayer routes into Worker.
replace_once(
    "push-server/src/index.ts",
    'import { dispatchGlobalPrayerEmails } from "./globalPrayerEmail";\n',
    'import { dispatchGlobalPrayerEmails } from "./globalPrayerEmail";\nimport { handleGames } from "./games";\n'
)
replace_once(
    "push-server/src/index.ts",
    '      } else if (request.method === "POST" && url.pathname === "/support/contact") {\n        response = await submitSupportContact(request, env);\n',
    '      } else if (url.pathname.startsWith("/games/")) {\n        response = (await handleGames(request, env, url)) ?? json({ error: "Not found" }, 404);\n      } else if (request.method === "POST" && url.pathname === "/support/contact") {\n        response = await submitSupportContact(request, env);\n'
)
replace_once(
    "push-server/src/index.ts",
    '    env.DB.prepare("DELETE FROM admin_password_resets WHERE consumed_at IS NOT NULL AND created_at < datetime(\'now\', \'-30 days\')")\n',
    '    env.DB.prepare("DELETE FROM admin_password_resets WHERE consumed_at IS NOT NULL AND created_at < datetime(\'now\', \'-30 days\')"),\n    env.DB.prepare("DELETE FROM game_rooms WHERE updated_at < datetime(\'now\', \'-2 days\')")\n'
)

# -----------------------------------------------------------------------------
# Multiplayer mobile UI + Games hub
# -----------------------------------------------------------------------------
write("mobile/src/MultiplayerGames.tsx", r'''import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

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
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) }
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

  const me = room?.players.find((p) => p.id === playerId);
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
        <View style={styles.header}><Pressable onPress={onBack} style={styles.back}><Text style={styles.backText}>‹</Text></Pressable><View style={styles.headerCopy}><Text style={styles.eyebrow}>🎮 HASSOUN MULTIPLAYER</Text><Text style={styles.title}>{t("Choose a game", "اختر لعبة")}</Text><Text style={styles.subtitle}>{t("Multiplayer only • Islamic or sports topics", "متعدد اللاعبين فقط • مواضيع إسلامية أو رياضية")}</Text></View></View>
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
        <View style={styles.header}><Pressable onPress={() => setGame(null)} style={styles.back}><Text style={styles.backText}>‹</Text></Pressable><View style={styles.headerCopy}><Text style={styles.eyebrow}>{meta?.icon} HASSOUN GAMES</Text><Text style={styles.title}>{ar ? meta?.ar : meta?.en}</Text><Text style={styles.subtitle}>{ar ? meta?.noteAr : meta?.noteEn}</Text></View></View>
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
      <View style={styles.roomTop}><Pressable onPress={leaveRoom} style={styles.back}><Text style={styles.backText}>‹</Text></Pressable><View style={styles.roomCodeWrap}><Text style={styles.roomCodeLabel}>{t("ROOM", "الغرفة")}</Text><Text style={styles.roomCode}>{room.code}</Text></View><View style={styles.roundPill}><Text style={styles.roundText}>{phase === "lobby" ? t("Lobby", "انتظار") : `${t("Round", "جولة")} ${room.state.round ?? 1}`}</Text></View></View>

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
''')

write("mobile/src/QuizGamesHub.tsx", r'''import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import IslamicQuiz from "./IslamicQuiz";
import MultiplayerGames, { type MultiplayerGameType } from "./MultiplayerGames";
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
      <View style={styles.top}><Pressable onPress={onBackHome} style={styles.back}><Text style={styles.backText}>‹</Text></Pressable><View style={styles.copy}><Text style={styles.eyebrow}>🎮 HASSOUN GAMES</Text><Text style={styles.title}>{t("Learn. Play. Compete.", "تعلّم • العب • تنافس")}</Text><Text style={styles.subtitle}>{t("Daily Islamic learning plus live multiplayer games. Multiplayer topics are Islamic or sports only.", "تعلم إسلامي يومي وألعاب جماعية مباشرة. مواضيع اللعب الجماعي إسلامية أو رياضية فقط.")}</Text></View></View>

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
''')

# App: use Games hub and label the existing tab clearly.
replace_once("mobile/App.tsx", 'import IslamicQuiz from "./src/IslamicQuiz";\n', 'import QuizGamesHub from "./src/QuizGamesHub";\n')
replace_once("mobile/App.tsx", '? <IslamicQuiz locale={locale} dateKey={todayKey} stats={quizStats} onStatsChange={setQuizStats} onBackHome={() => setActiveTab("home")} />', '? <QuizGamesHub locale={locale} dateKey={todayKey} stats={quizStats} onStatsChange={setQuizStats} onBackHome={() => setActiveTab("home")} />')
replace_once("mobile/App.tsx", '{ tab: "quiz", emoji: "🧠", en: "Quiz", ar: "مسابقة" },', '{ tab: "quiz", emoji: "🎮", en: "Games", ar: "ألعاب" },')
replace_once("mobile/App.tsx", '            <Text style={styles.quizTitle}>{locale === "ar" ? "المسابقة الإسلامية اليومية" : "Daily Islamic Quiz"}</Text>\n            <Text style={styles.quizDescription}>{locale === "ar" ? "أسئلة للأطفال والكبار مع شارات وسلسلة أيام." : "Kids & Adults questions with badges and daily streaks."}</Text>', '            <Text style={styles.quizTitle}>{locale === "ar" ? "المسابقة والألعاب الجماعية" : "Quiz & Multiplayer Games"}</Text>\n            <Text style={styles.quizDescription}>{locale === "ar" ? "مسابقة يومية + Trivia وImposter وألعاب إسلامية ورياضية جماعية." : "Daily quiz + live Trivia, Imposter and Islamic/sports multiplayer games."}</Text>')

# -----------------------------------------------------------------------------
# Noble Qur'an approved home layout + Juz / Pages navigation and search
# -----------------------------------------------------------------------------
replace_once(
    "mobile/src/quran/QuranV3.tsx",
    'type Screen = "home" | "surahs" | "search" | "bookmarks" | "reader" | "memorize" | "radio";',
    'type Screen = "home" | "surahs" | "juz" | "pages" | "search" | "bookmarks" | "reader" | "memorize" | "radio";'
)
replace_once(
    "mobile/src/quran/QuranV3.tsx",
    'function formatTime(ms: number) {\n',
    'function asciiDigits(value: string) {\n  const arabic = "٠١٢٣٤٥٦٧٨٩";\n  return value.replace(/[٠-٩]/g, (digit) => String(arabic.indexOf(digit)));\n}\n\nfunction formatTime(ms: number) {\n'
)
replace_once(
    "mobile/src/quran/QuranV3.tsx",
    '  const pages = allPages();\n',
    '''  const pages = allPages();
  const pageNumbers = useMemo(() => Array.from({ length: 604 }, (_item, index) => index + 1), []);
  const juzStarts = useMemo(() => {
    const starts: Array<{ juz: number; surah: number; ayah: number; page: number }> = [];
    const seen = new Set<number>();
    for (let surah = 1; surah <= 114; surah += 1) {
      for (const ayah of getSurahAyahs(surah)) {
        const juz = juzForAyah(surah, ayah.ayah);
        if (!juz || seen.has(juz)) continue;
        seen.add(juz);
        starts.push({ juz, surah, ayah: ayah.ayah, page: pageForAyah(surah, ayah.ayah) ?? 1 });
      }
    }
    return starts.sort((a, b) => a.juz - b.juz);
  }, []);
'''
)
replace_once(
    "mobile/src/quran/QuranV3.tsx",
    '''  const turnReaderPage = (direction: -1 | 1) => {''',
    '''  const openJuz = (juz: number, from: Screen = screen) => {
    const start = juzStarts.find((item) => item.juz === clamp(juz, 1, 30));
    if (!start) return;
    openReader(start.surah, start.ayah, from);
  };

  const openMushafPageFrom = (page: number, from: Screen = screen) => {
    const start = pages[clamp(page, 1, 604) - 1];
    if (!start) return;
    openReader(start.surah, start.ayah, from);
  };

  const turnReaderPage = (direction: -1 | 1) => {'''
)

new_home = r'''  const continueSurah = getSurah(lastPosition?.surah ?? 1);
  const continuePage = lastPosition ? pageForAyah(lastPosition.surah, lastPosition.ayah) ?? 1 : 1;
  const continueJuz = lastPosition ? juzForAyah(lastPosition.surah, lastPosition.ayah) ?? 1 : 1;
  const continuePercent = lastPosition && continueSurah ? Math.max(1, Math.min(100, Math.round((lastPosition.ayah / continueSurah.ayahCount) * 100))) : 0;

  const home = (
    <ScrollView style={styles.flex} contentContainerStyle={styles.homeContent} showsVerticalScrollIndicator={false}>
      <View style={styles.heroHeader}>
        <Pressable onPress={onBackHome} style={styles.iconButton}><Text style={styles.back}>{ar ? "›" : "‹"}</Text></Pressable>
        <View style={styles.topCopy}><Text style={styles.eyebrow}>☾ {tr("HASSOUN QUR’AN", "قرآن Hassoun")}</Text><Text style={[styles.heroTitle, ar && styles.rtl]}>{tr("The Noble Qur’an", "القرآن الكريم")}</Text><Text style={[styles.heroSub, ar && styles.rtl]}>{tr("Read • listen • memorize", "اقرأ • استمع • احفظ")}</Text></View>
        <View style={styles.verifiedBadge}><Text style={styles.verifiedText}>✓ {tr("Verified", "موثّق")}</Text></View>
      </View>

      <Pressable onPress={() => setScreen("search")} style={styles.searchBox}><Text style={styles.searchIcon}>⌕</Text><Text style={[styles.searchPlaceholder, ar && styles.rtl]}>{tr("Search any word, ayah, Surah, Juz’ or page", "ابحث بكلمة أو آية أو سورة أو جزء أو صفحة")}</Text><Text style={styles.searchFilter}>☷</Text></Pressable>

      <View style={styles.homeShortcutRow}>
        <Pressable onPress={() => setScreen("surahs")} style={styles.homeShortcut}><Text style={styles.homeShortcutIcon}>🕋</Text><Text style={styles.homeShortcutText}>{tr("Surahs", "السور")}</Text></Pressable>
        <Pressable onPress={() => setScreen("juz")} style={styles.homeShortcut}><Text style={styles.homeShortcutIcon}>❂</Text><Text style={styles.homeShortcutText}>{tr("Juz’", "الأجزاء")}</Text></Pressable>
        <Pressable onPress={() => setScreen("pages")} style={styles.homeShortcut}><Text style={styles.homeShortcutIcon}>📖</Text><Text style={styles.homeShortcutText}>{tr("Pages", "الصفحات")}</Text></Pressable>
        <Pressable onPress={() => setScreen("bookmarks")} style={styles.homeShortcut}><Text style={styles.homeShortcutIcon}>🔖</Text><Text style={styles.homeShortcutText}>{tr("Bookmarks", "العلامات")}</Text></Pressable>
      </View>

      <Pressable onPress={() => openReader(lastPosition?.surah ?? 1, lastPosition?.ayah ?? 1, "home")} style={styles.continueCard}>
        <View style={styles.continueIllustration}><Text style={styles.continueIcon}>📖</Text><Text style={styles.continueMoon}>☾</Text></View>
        <View style={styles.topCopy}><Text style={styles.continueEyebrow}>✦ {tr("CONTINUE READING", "تابع القراءة")}</Text><View style={styles.continueTitleRow}><Text style={[styles.continueTitle, ar && styles.rtl]}>{ar ? continueSurah?.nameArabic : continueSurah?.nameTransliterated}</Text>{!ar ? <Text style={styles.continueArabic}>{continueSurah?.nameArabic}</Text> : null}</View><Text style={[styles.continueMeta, ar && styles.rtl]}>{tr(`Ayah ${lastPosition?.ayah ?? 1} • Page ${continuePage} • Juz’ ${continueJuz}`, `الآية ${num(lastPosition?.ayah ?? 1)} • الصفحة ${num(continuePage)} • الجزء ${num(continueJuz)}`)}</Text><View style={styles.readingTrack}><View style={[styles.readingFill, { width: `${continuePercent}%` }]} /></View><Text style={styles.readingProgress}>{tr(`${continuePercent}% through this Surah`, `${num(continuePercent)}٪ من هذه السورة`)}</Text></View>
        <Text style={styles.lightArrow}>{ar ? "‹" : "›"}</Text>
      </Pressable>

      <Text style={[styles.sectionHeading, ar && styles.rtl]}>{tr("Explore", "استكشف")}</Text>
      <View style={styles.featureGrid}>
        <Pressable onPress={() => setScreen("surahs")} style={styles.featureCard}><View style={styles.featureIcon}><Text style={styles.gridEmoji}>🕋</Text></View><Text style={styles.featureTitle}>{tr("Surahs", "السور")}</Text><Text style={styles.featureMeta}>{tr("114 Surahs", `${num(114)} سورة`)}</Text></Pressable>
        <Pressable onPress={() => setScreen("juz")} style={styles.featureCard}><View style={styles.featureIcon}><Text style={styles.gridEmoji}>❂</Text></View><Text style={styles.featureTitle}>{tr("Juz’", "الأجزاء")}</Text><Text style={styles.featureMeta}>{tr("30 Juz’", `${num(30)} جزء`)}</Text></Pressable>
        <Pressable onPress={() => setScreen("pages")} style={styles.featureCard}><View style={styles.featureIcon}><Text style={styles.gridEmoji}>📖</Text></View><Text style={styles.featureTitle}>{tr("Pages", "الصفحات")}</Text><Text style={styles.featureMeta}>{tr("604 Pages", `${num(604)} صفحة`)}</Text></Pressable>
        <Pressable onPress={() => setScreen("bookmarks")} style={styles.featureCard}><View style={styles.featureIcon}><Text style={styles.gridEmoji}>🔖</Text></View><Text style={styles.featureTitle}>{tr("Bookmarks", "العلامات")}</Text><Text style={styles.featureMeta}>{tr(`${bookmarks.length} saved`, `${num(bookmarks.length)} محفوظة`)}</Text></Pressable>
        <Pressable onPress={() => memorizeRange ? setScreen("memorize") : openReader(lastPosition?.surah ?? 1, lastPosition?.ayah ?? 1, "home")} style={styles.featureCard}><View style={styles.featureIcon}><Text style={styles.gridEmoji}>◌</Text></View><Text style={styles.featureTitle}>{tr("Memorize", "الحفظ")}</Text><Text style={styles.featureMeta}>{tr("Focused practice", "مراجعة مركزة")}</Text></Pressable>
        <Pressable onPress={() => setScreen("radio")} style={[styles.featureCard, styles.radioFeatureCard]}><View style={[styles.featureIcon, styles.radioGridIcon]}><Text style={styles.gridEmoji}>📻</Text></View><Text style={styles.featureTitle}>{tr("Qur’an Radio", "إذاعة القرآن")}</Text><Text style={styles.featureMeta}>{tr("Reciters • playlists", "قراء • قوائم")}</Text></Pressable>
      </View>

      <View style={styles.recentCard}><View style={styles.recentHeader}><Text style={styles.recentTitle}>↻ {tr("Recent", "الأخيرة")}</Text><Text style={styles.recentViewAll}>{tr("Quick access", "وصول سريع")}</Text></View><View style={styles.recentRow}><Pressable onPress={() => openMushafPageFrom(continuePage, "home")} style={styles.recentItem}><Text style={styles.recentIcon}>📖</Text><Text style={styles.recentItemTitle}>{tr("Last Page", "آخر صفحة")}</Text><Text style={styles.recentItemMeta}>{tr(`Page ${continuePage}`, `صفحة ${num(continuePage)}`)}</Text></Pressable><Pressable onPress={() => openJuz(continueJuz, "home")} style={styles.recentItem}><Text style={styles.recentIcon}>❂</Text><Text style={styles.recentItemTitle}>{tr("Last Juz’", "آخر جزء")}</Text><Text style={styles.recentItemMeta}>{tr(`Juz’ ${continueJuz}`, `الجزء ${num(continueJuz)}`)}</Text></Pressable><Pressable onPress={() => setScreen("search")} style={styles.recentItem}><Text style={styles.recentIcon}>⌕</Text><Text style={styles.recentItemTitle}>{tr("Search", "بحث")}</Text><Text style={styles.recentItemMeta}>{query.trim() || tr("Qur’an", "القرآن")}</Text></Pressable></View></View>

      <View style={styles.infoCard}><Text style={styles.infoIcon}>✓</Text><View style={styles.topCopy}><Text style={styles.infoTitle}>{tr("Verified Uthmani Qur’an", "نص عثماني موثّق")}</Text><Text style={styles.infoText}>{tr("Exact Mushaf fonts, Tajweed mode, and local verified Arabic text fallback.", "خطوط المصحف الدقيقة، وضع التجويد، ونص عربي موثّق محفوظ محلياً.")}</Text></View></View>
    </ScrollView>
  );

  const surahList = ('''
regex_once("mobile/src/quran/QuranV3.tsx", r'  const home = \(\n.*?\n  const surahList = \(', new_home)

new_search_block = r'''  const juzList = (
    <View style={styles.flex}>{topBar(tr("Browse by Juz’", "التصفح حسب الجزء"), tr("30 equal parts of the Qur’an", "ثلاثون جزءاً من القرآن"))}<FlatList data={juzStarts} keyExtractor={(item) => String(item.juz)} contentContainerStyle={styles.listContent} renderItem={({ item }) => { const surah = getSurah(item.surah); return <Pressable onPress={() => openJuz(item.juz, "juz")} style={styles.juzRow}><View style={styles.juzBadge}><Text style={styles.juzBadgeText}>{num(item.juz)}</Text></View><View style={styles.topCopy}><Text style={styles.rowTitle}>{tr(`Juz’ ${item.juz}`, `الجزء ${num(item.juz)}`)}</Text><Text style={styles.rowMeta}>{ar ? surah?.nameArabic : surah?.nameTransliterated} • {tr(`Ayah ${item.ayah}`, `الآية ${num(item.ayah)}`)}</Text></View><Text style={styles.juzPage}>{tr(`Page ${item.page}`, `صفحة ${num(item.page)}`)}</Text></Pressable>; }} /></View>
  );

  const pageList = (
    <View style={styles.flex}>{topBar(tr("Browse by Pages", "التصفح حسب الصفحات"), tr("604 Mushaf pages", "٦٠٤ صفحات من المصحف"))}<View style={styles.pageSearchRow}><TextInput value={pageJump} onChangeText={setPageJump} keyboardType="number-pad" placeholder={tr("Go to page 1–604", "اذهب إلى صفحة ١–٦٠٤")} placeholderTextColor="#8a938f" style={styles.pageSearchInput} /><Pressable onPress={() => openMushafPageFrom(Number(asciiDigits(pageJump)) || 1, "pages")} style={styles.pageGo}><Text style={styles.pageGoText}>{tr("Go", "اذهب")}</Text></Pressable></View><FlatList data={pageNumbers} numColumns={6} keyExtractor={(item) => String(item)} contentContainerStyle={styles.pageGrid} columnWrapperStyle={styles.pageGridRow} renderItem={({ item }) => <Pressable onPress={() => openMushafPageFrom(item, "pages")} style={styles.pageTile}><Text style={styles.pageTileText}>{num(item)}</Text></Pressable>} /></View>
  );

  const handleSearchNavigate = () => {
    const raw = asciiDigits(query.trim().toLowerCase());
    const pageMatch = raw.match(/^(?:page|p|صفحة)\s*#?\s*(\d{1,3})$/i);
    if (pageMatch) { openMushafPageFrom(clamp(Number(pageMatch[1]), 1, 604), "search"); return; }
    const juzMatch = raw.match(/^(?:juz|juz'|juz’|جزء|الجزء)\s*#?\s*(\d{1,2})$/i);
    if (juzMatch) { openJuz(clamp(Number(juzMatch[1]), 1, 30), "search"); }
  };

  const search = (
    <View style={styles.flex}>{topBar(tr("Search Qur’an", "البحث في القرآن"), tr("Word • Ayah • Surah • Juz’ • Page", "كلمة • آية • سورة • جزء • صفحة"))}<View style={styles.searchInputWrap}><TextInput value={query} onChangeText={setQuery} onSubmitEditing={handleSearchNavigate} autoFocus placeholder={tr("Try الرحمة, Al-Kahf, Juz 30, Page 603…", "جرّب: الرحمة، الكهف، جزء ٣٠، صفحة ٦٠٣…")} placeholderTextColor="#8a938f" style={[styles.searchInput, ar && styles.rtl]} /><View style={styles.searchQuickRow}><Pressable onPress={() => setScreen("juz")} style={styles.searchQuick}><Text style={styles.searchQuickIcon}>❂</Text><Text style={styles.searchQuickText}>{tr("By Juz’", "حسب الجزء")}</Text></Pressable><Pressable onPress={() => setScreen("pages")} style={styles.searchQuick}><Text style={styles.searchQuickIcon}>📖</Text><Text style={styles.searchQuickText}>{tr("By Pages", "حسب الصفحة")}</Text></Pressable><Pressable onPress={() => setScreen("bookmarks")} style={styles.searchQuick}><Text style={styles.searchQuickIcon}>🔖</Text><Text style={styles.searchQuickText}>{tr("Bookmarks", "العلامات")}</Text></Pressable></View></View><FlatList<QuranSearchResult> data={searchResults} keyExtractor={(item, index) => item.kind === "surah" ? `s-${item.surah.number}-${index}` : `a-${item.ayah?.surah}-${item.ayah?.ayah}`} contentContainerStyle={styles.listContent} ListEmptyComponent={<Text style={styles.empty}>{query.trim() ? tr("No text matches. For direct navigation type ‘Juz 30’ or ‘Page 603’.", "لا توجد نتائج نصية. للانتقال المباشر اكتب «جزء ٣٠» أو «صفحة ٦٠٣».") : tr("Type to search", "اكتب للبحث")}</Text>} renderItem={({ item }) => <Pressable onPress={() => openReader(item.surah.number, item.ayah?.ayah ?? 1, "search")} style={styles.searchResult}><Text style={styles.resultTitle}>{ar ? item.surah.nameArabic : item.surah.nameTransliterated} {item.ayah ? `${num(item.surah.number)}:${num(item.ayah.ayah)}` : ""}</Text>{item.ayah ? <Text style={styles.resultArabic} numberOfLines={3}>{item.ayah.text}</Text> : <Text style={styles.rowMeta}>{item.surah.nameEnglish}</Text>}</Pressable>} /></View>
  );

  const bookmarkAyahs ='''
regex_once("mobile/src/quran/QuranV3.tsx", r'  const search = \(\n.*?\n  const bookmarkAyahs =', new_search_block)

replace_once(
    "mobile/src/quran/QuranV3.tsx",
    '  if (screen === "surahs") body = surahList;\n  else if (screen === "search") body = search;',
    '  if (screen === "surahs") body = surahList;\n  else if (screen === "juz") body = juzList;\n  else if (screen === "pages") body = pageList;\n  else if (screen === "search") body = search;'
)

# Replace the Quran home/search style cluster with the richer approved layout styles.
regex_once(
    "mobile/src/quran/QuranV3.tsx",
    r'  homeContent: \{.*?\n  bookmarkCard:',
    r'''  homeContent: { padding: 17, paddingBottom: 30 }, heroHeader: { flexDirection: "row", gap: 11, alignItems: "center", marginBottom: 16 }, eyebrow: { color: "#a17c36", fontSize: 9, fontWeight: "900", letterSpacing: .8 }, heroTitle: { color: "#173f35", fontSize: 29, fontWeight: "900" }, heroSub: { color: "#7c8782", fontSize: 10, marginTop: 2 }, verifiedBadge: { borderRadius: 99, paddingHorizontal: 9, paddingVertical: 6, backgroundColor: "#e7f4ee" }, verifiedText: { color: "#0b6a51", fontSize: 9, fontWeight: "900" },
  searchBox: { height: 58, borderRadius: 20, backgroundColor: "#fff", borderWidth: 1, borderColor: "#dedad1", flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 15 }, searchIcon: { color: "#0b654f", fontSize: 22, fontWeight: "900" }, searchPlaceholder: { color: "#74817c", flex: 1, fontSize: 10.5 }, searchFilter: { color: "#0b654f", fontSize: 18 },
  homeShortcutRow: { flexDirection: "row", gap: 6, marginTop: 10 }, homeShortcut: { flex: 1, minHeight: 47, borderRadius: 18, backgroundColor: "#fbfaf6", borderWidth: 1, borderColor: "#e3d8bf", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, paddingHorizontal: 5 }, homeShortcutIcon: { fontSize: 13 }, homeShortcutText: { color: "#244b40", fontSize: 8, fontWeight: "900" },
  continueCard: { marginTop: 14, minHeight: 150, borderRadius: 27, backgroundColor: "#075a46", padding: 15, flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderColor: "#287a64" }, continueIllustration: { width: 77, height: 102, borderRadius: 26, backgroundColor: "rgba(255,255,255,.08)", alignItems: "center", justifyContent: "center", position: "relative" }, continueIcon: { fontSize: 42 }, continueMoon: { position: "absolute", top: 6, right: 9, color: "#e5c66e", fontSize: 18 }, continueEyebrow: { color: "#e1c66e", fontSize: 7.5, fontWeight: "900", letterSpacing: .7 }, continueTitleRow: { flexDirection: "row", alignItems: "baseline", gap: 8, marginTop: 4 }, continueTitle: { color: "#fff", fontSize: 24, fontWeight: "900" }, continueArabic: { color: "#e5c66e", fontSize: 18, writingDirection: "rtl" }, continueMeta: { color: "#d0e1db", fontSize: 9, marginTop: 3 }, readingTrack: { height: 5, borderRadius: 4, backgroundColor: "rgba(255,255,255,.15)", marginTop: 10, overflow: "hidden" }, readingFill: { height: 5, borderRadius: 4, backgroundColor: "#e4bd63" }, readingProgress: { color: "#c7dcd5", fontSize: 7.5, marginTop: 4 }, lightArrow: { color: "#fff", fontSize: 28 },
  sectionHeading: { color: "#173f35", fontSize: 19, fontWeight: "900", marginTop: 22, marginBottom: 10 }, featureGrid: { flexDirection: "row", flexWrap: "wrap", gap: 7 }, featureCard: { width: "31.8%", minHeight: 126, backgroundColor: "#fff", borderWidth: 1, borderColor: "#e1ddd4", borderRadius: 21, padding: 11, justifyContent: "center" }, radioFeatureCard: { backgroundColor: "#f6f1e6", borderColor: "#e3d7bf" }, featureIcon: { width: 41, height: 41, borderRadius: 14, backgroundColor: "#edf5f1", alignItems: "center", justifyContent: "center" }, gridEmoji: { fontSize: 21 }, featureTitle: { color: "#173f35", fontSize: 12, fontWeight: "900", marginTop: 9 }, featureMeta: { color: "#89928e", fontSize: 7.5, lineHeight: 11, marginTop: 2 }, radioGridIcon: { backgroundColor: "#fff7e5" },
  recentCard: { marginTop: 14, borderRadius: 21, backgroundColor: "#eef4ef", borderWidth: 1, borderColor: "#d8e4dc", padding: 11 }, recentHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, recentTitle: { color: "#17483c", fontSize: 11, fontWeight: "900" }, recentViewAll: { color: "#648078", fontSize: 7.5, fontWeight: "800" }, recentRow: { flexDirection: "row", gap: 6, marginTop: 9 }, recentItem: { flex: 1, minHeight: 72, borderRadius: 15, backgroundColor: "#fff", borderWidth: 1, borderColor: "#e0e4df", padding: 8, justifyContent: "center" }, recentIcon: { fontSize: 16 }, recentItemTitle: { color: "#204a3f", fontSize: 8.5, fontWeight: "900", marginTop: 4 }, recentItemMeta: { color: "#89938f", fontSize: 6.8, marginTop: 2 },
  infoCard: { marginTop: 14, borderRadius: 20, padding: 14, flexDirection: "row", gap: 10, alignItems: "center", backgroundColor: "#075a46", borderWidth: 1, borderColor: "#287a64" }, infoIcon: { width: 34, height: 34, textAlign: "center", textAlignVertical: "center", borderRadius: 17, backgroundColor: "#e4bd63", color: "#17483c", fontSize: 18, fontWeight: "900" }, infoTitle: { color: "#fff", fontSize: 12, fontWeight: "900" }, infoText: { color: "#c8ded6", fontSize: 8.5, lineHeight: 13, marginTop: 3 },
  listContent: { padding: 12, paddingBottom: 28 }, row: { minHeight: 76, borderRadius: 19, backgroundColor: "#fff", borderWidth: 1, borderColor: "#e2ded5", padding: 12, marginBottom: 8, flexDirection: "row", alignItems: "center", gap: 11 }, numberBadge: { width: 40, height: 40, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "#edf5f1" }, numberText: { color: "#0b654f", fontWeight: "900", fontSize: 11 }, rowTitle: { color: "#173f35", fontSize: 14, fontWeight: "900" }, rowMeta: { color: "#85908b", fontSize: 9, marginTop: 3 }, rowArabic: { color: "#0b654f", fontSize: 18, writingDirection: "rtl" },
  juzRow: { minHeight: 72, borderRadius: 18, backgroundColor: "#fff", borderWidth: 1, borderColor: "#e2ded5", padding: 11, marginBottom: 7, flexDirection: "row", alignItems: "center", gap: 10 }, juzBadge: { width: 42, height: 42, borderRadius: 21, backgroundColor: "#0b654f", alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "#d9bd70" }, juzBadgeText: { color: "#fff", fontSize: 11, fontWeight: "900" }, juzPage: { color: "#8b7958", fontSize: 8, fontWeight: "800" },
  pageSearchRow: { flexDirection: "row", gap: 7, padding: 12, paddingBottom: 5 }, pageSearchInput: { flex: 1, minHeight: 48, borderRadius: 15, backgroundColor: "#fff", borderWidth: 1, borderColor: "#ded9cf", paddingHorizontal: 12, color: "#173f35", fontSize: 10 }, pageGo: { width: 72, borderRadius: 15, backgroundColor: "#0b654f", alignItems: "center", justifyContent: "center" }, pageGoText: { color: "#fff", fontSize: 9, fontWeight: "900" }, pageGrid: { padding: 10, paddingBottom: 30 }, pageGridRow: { gap: 5, marginBottom: 5 }, pageTile: { flex: 1, minHeight: 45, borderRadius: 12, backgroundColor: "#fff", borderWidth: 1, borderColor: "#e1ddd4", alignItems: "center", justifyContent: "center" }, pageTileText: { color: "#17483c", fontSize: 9, fontWeight: "900" },
  searchInputWrap: { padding: 12 }, searchInput: { minHeight: 52, borderRadius: 17, backgroundColor: "#fff", borderWidth: 1, borderColor: "#ddd8ce", paddingHorizontal: 14, color: "#173f35" }, searchQuickRow: { flexDirection: "row", gap: 6, marginTop: 8 }, searchQuick: { flex: 1, minHeight: 58, borderRadius: 15, backgroundColor: "#fff", borderWidth: 1, borderColor: "#e1ddd4", alignItems: "center", justifyContent: "center", padding: 5 }, searchQuickIcon: { fontSize: 17 }, searchQuickText: { color: "#244b40", fontSize: 7.5, fontWeight: "900", marginTop: 3 }, empty: { textAlign: "center", color: "#7b8782", padding: 30 }, searchResult: { backgroundColor: "#fff", borderRadius: 18, borderWidth: 1, borderColor: "#e1ddd4", padding: 13, marginBottom: 8 }, resultTitle: { color: "#17483c", fontSize: 11, fontWeight: "900" }, resultArabic: { color: "#203f37", fontSize: 21, lineHeight: 34, textAlign: "right", writingDirection: "rtl", marginTop: 6 },
  bookmarkCard:'''
)

# -----------------------------------------------------------------------------
# Widget preferences bridge
# -----------------------------------------------------------------------------
write("mobile/modules/hassoun-widget/index.ts", r'''import { Platform } from "react-native";
import { requireNativeModule } from "expo-modules-core";

export type HassounWidgetLayout = "compact" | "next" | "full" | "square" | "vertical" | "slim";
export type HassounWidgetTheme = "emerald" | "ivory" | "ocean" | "sunset" | "midnight";
export type HassounWidgetTimeSize = "small" | "medium" | "large" | "xlarge";
export type HassounWidgetCountdownStyle = "circle" | "pill" | "minimal";
export type HassounWidgetFocus = "next" | "balanced" | "all";
export type HassounWidgetPreferences = {
  layout: HassounWidgetLayout;
  theme: HassounWidgetTheme;
  showCountdown: boolean;
  showHijri: boolean;
  showGregorian: boolean;
  showAllPrayers: boolean;
  showLocation: boolean;
  showLogo: boolean;
  showArabicNames: boolean;
  highlightNext: boolean;
  timeSize: HassounWidgetTimeSize;
  countdownStyle: HassounWidgetCountdownStyle;
  focus: HassounWidgetFocus;
  locale: "en" | "ar";
};

export type HassounWidgetCapabilities = { available: boolean; pinningSupported: boolean; lockScreenEligible: boolean; sdkInt: number };

type NativeWidget = {
  setPreferences: (
    layout: HassounWidgetLayout, theme: HassounWidgetTheme, showCountdown: boolean, showHijri: boolean,
    showGregorian: boolean, showAllPrayers: boolean, showLocation: boolean, showLogo: boolean,
    showArabicNames: boolean, highlightNext: boolean, timeSize: HassounWidgetTimeSize,
    countdownStyle: HassounWidgetCountdownStyle, focus: HassounWidgetFocus, locale: "en" | "ar"
  ) => void;
  getPreferences: () => HassounWidgetPreferences;
  syncPrayerSchedule: (scheduleJson: string, locale: "en" | "ar") => void;
  refresh: () => void;
  requestPin: () => boolean;
  getCapabilities: () => HassounWidgetCapabilities;
};

let native: NativeWidget | null = null;
if (Platform.OS === "android") { try { native = requireNativeModule<NativeWidget>("HassounWidget"); } catch { native = null; } }

const defaults: HassounWidgetPreferences = {
  layout: "full", theme: "emerald", showCountdown: true, showHijri: true, showGregorian: true,
  showAllPrayers: true, showLocation: false, showLogo: true, showArabicNames: true, highlightNext: true,
  timeSize: "large", countdownStyle: "circle", focus: "next", locale: "en"
};

const HassounWidget = {
  available: Boolean(native),
  setPreferences(preferences: HassounWidgetPreferences) {
    native?.setPreferences(
      preferences.layout, preferences.theme, preferences.showCountdown, preferences.showHijri,
      preferences.showGregorian, preferences.showAllPrayers, preferences.showLocation, preferences.showLogo,
      preferences.showArabicNames, preferences.highlightNext, preferences.timeSize, preferences.countdownStyle,
      preferences.focus, preferences.locale
    );
  },
  getPreferences() { return { ...defaults, ...(native?.getPreferences() ?? {}) }; },
  syncPrayerSchedule(scheduleJson: string, locale: "en" | "ar") { native?.syncPrayerSchedule(scheduleJson, locale); },
  refresh() { native?.refresh(); },
  requestPin() { return native?.requestPin() ?? false; },
  getCapabilities(): HassounWidgetCapabilities { return native?.getCapabilities() ?? { available: false, pinningSupported: false, lockScreenEligible: false, sdkInt: 0 }; }
};
export default HassounWidget;
''')

write("mobile/modules/hassoun-widget/android/src/main/java/ca/wopt/hassounwidget/HassounWidgetModule.kt", r'''package ca.wopt.hassounwidget

import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Context
import android.os.Build
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File

class HassounWidgetModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("HassounWidget")

    Function("setPreferences") {
      layout: String, theme: String, showCountdown: Boolean, showHijri: Boolean, showGregorian: Boolean,
      showAllPrayers: Boolean, showLocation: Boolean, showLogo: Boolean, showArabicNames: Boolean,
      highlightNext: Boolean, timeSize: String, countdownStyle: String, focus: String, locale: String ->
      val context = appContext.reactContext ?: return@Function null
      context.getSharedPreferences(HassounWidgetStore.PREFS, Context.MODE_PRIVATE).edit()
        .putString("layout", layout.takeIf { it in setOf("compact", "next", "full", "square", "vertical", "slim") } ?: "full")
        .putString("theme", theme.takeIf { it in setOf("emerald", "ivory", "ocean", "sunset", "midnight") } ?: "emerald")
        .putBoolean("showCountdown", showCountdown).putBoolean("showHijri", showHijri).putBoolean("showGregorian", showGregorian)
        .putBoolean("showAllPrayers", showAllPrayers).putBoolean("showLocation", showLocation).putBoolean("showLogo", showLogo)
        .putBoolean("showArabicNames", showArabicNames).putBoolean("highlightNext", highlightNext)
        .putString("timeSize", timeSize.takeIf { it in setOf("small", "medium", "large", "xlarge") } ?: "large")
        .putString("countdownStyle", countdownStyle.takeIf { it in setOf("circle", "pill", "minimal") } ?: "circle")
        .putString("focus", focus.takeIf { it in setOf("next", "balanced", "all") } ?: "next")
        .putString("locale", if (locale == "ar") "ar" else "en").apply()
      HassounPrayerWidgetProvider.updateAll(context)
      null
    }

    Function("getPreferences") {
      val context = appContext.reactContext
      if (context == null) return@Function defaults()
      val prefs = context.getSharedPreferences(HassounWidgetStore.PREFS, Context.MODE_PRIVATE)
      mapOf(
        "layout" to (prefs.getString("layout", "full") ?: "full"), "theme" to (prefs.getString("theme", "emerald") ?: "emerald"),
        "showCountdown" to prefs.getBoolean("showCountdown", true), "showHijri" to prefs.getBoolean("showHijri", true),
        "showGregorian" to prefs.getBoolean("showGregorian", true), "showAllPrayers" to prefs.getBoolean("showAllPrayers", true),
        "showLocation" to prefs.getBoolean("showLocation", false), "showLogo" to prefs.getBoolean("showLogo", true),
        "showArabicNames" to prefs.getBoolean("showArabicNames", true), "highlightNext" to prefs.getBoolean("highlightNext", true),
        "timeSize" to (prefs.getString("timeSize", "large") ?: "large"), "countdownStyle" to (prefs.getString("countdownStyle", "circle") ?: "circle"),
        "focus" to (prefs.getString("focus", "next") ?: "next"), "locale" to (prefs.getString("locale", "en") ?: "en")
      )
    }

    Function("syncPrayerSchedule") { scheduleJson: String, locale: String ->
      val context = appContext.reactContext ?: return@Function null
      File(context.filesDir, HassounWidgetStore.SCHEDULE_FILE).writeText(scheduleJson)
      context.getSharedPreferences(HassounWidgetStore.PREFS, Context.MODE_PRIVATE).edit().putString("locale", if (locale == "ar") "ar" else "en").apply()
      HassounPrayerWidgetProvider.updateAll(context); null
    }
    Function("refresh") { val context = appContext.reactContext ?: return@Function null; HassounPrayerWidgetProvider.updateAll(context); null }
    Function("requestPin") {
      val context = appContext.reactContext ?: return@Function false
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return@Function false
      val manager = AppWidgetManager.getInstance(context)
      if (!manager.isRequestPinAppWidgetSupported) return@Function false
      manager.requestPinAppWidget(ComponentName(context, HassounPrayerWidgetProvider::class.java), null, null)
    }
    Function("getCapabilities") {
      val context = appContext.reactContext
      val pinning = context != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && AppWidgetManager.getInstance(context).isRequestPinAppWidgetSupported
      mapOf("available" to (context != null), "pinningSupported" to pinning, "lockScreenEligible" to (Build.VERSION.SDK_INT >= 36), "sdkInt" to Build.VERSION.SDK_INT)
    }
  }

  private fun defaults() = mapOf(
    "layout" to "full", "theme" to "emerald", "showCountdown" to true, "showHijri" to true,
    "showGregorian" to true, "showAllPrayers" to true, "showLocation" to false, "showLogo" to true,
    "showArabicNames" to true, "highlightNext" to true, "timeSize" to "large", "countdownStyle" to "circle",
    "focus" to "next", "locale" to "en"
  )
}
''')

# Patterned layer-list backgrounds so the Islamic geometry actually renders.
for name, base, pattern in [
    ("patterned", "hassoun_widget_background", "hassoun_widget_pattern_emerald"),
    ("patterned_ivory", "hassoun_widget_background_ivory", "hassoun_widget_pattern_ivory"),
    ("patterned_ocean", "hassoun_widget_background_ocean", "hassoun_widget_pattern_ocean"),
    ("patterned_sunset", "hassoun_widget_background_sunset", "hassoun_widget_pattern_sunset"),
    ("patterned_midnight", "hassoun_widget_background_midnight", "hassoun_widget_pattern_midnight")
]:
    write(f"mobile/modules/hassoun-widget/android/src/main/res/drawable/hassoun_widget_{name}.xml", f'''<?xml version="1.0" encoding="utf-8"?>\n<layer-list xmlns:android="http://schemas.android.com/apk/res/android">\n  <item android:drawable="@drawable/{base}" />\n  <item android:drawable="@drawable/{pattern}" />\n</layer-list>\n''')

write("mobile/modules/hassoun-widget/android/src/main/res/drawable/hassoun_widget_countdown_circle.xml", '''<?xml version="1.0" encoding="utf-8"?>\n<shape xmlns:android="http://schemas.android.com/apk/res/android" android:shape="oval"><solid android:color="#F2E0A8"/><stroke android:width="2dp" android:color="#E7C967"/></shape>\n''')
write("mobile/modules/hassoun-widget/android/src/main/res/drawable/hassoun_widget_countdown_minimal.xml", '''<?xml version="1.0" encoding="utf-8"?>\n<shape xmlns:android="http://schemas.android.com/apk/res/android" android:shape="rectangle"><solid android:color="#14000000"/><stroke android:width="1dp" android:color="#55F2D27A"/><corners android:radius="18dp"/></shape>\n''')

# More balanced native layouts: next prayer left, large central countdown, Adhan time right.
write("mobile/modules/hassoun-widget/android/src/main/res/layout/hassoun_prayer_widget.xml", r'''<?xml version="1.0" encoding="utf-8"?>
<LinearLayout xmlns:android="http://schemas.android.com/apk/res/android" android:id="@+id/widget_root" android:layout_width="match_parent" android:layout_height="match_parent" android:orientation="vertical" android:gravity="center_vertical" android:background="@drawable/hassoun_widget_patterned" android:padding="12dp">
  <LinearLayout android:layout_width="match_parent" android:layout_height="wrap_content" android:orientation="horizontal" android:gravity="center_vertical">
    <ImageView android:id="@+id/widget_logo" android:layout_width="44dp" android:layout_height="44dp" android:contentDescription="Hassoun" android:scaleType="fitCenter" android:src="@drawable/hassoun_widget_logo" />
    <LinearLayout android:layout_width="0dp" android:layout_height="wrap_content" android:layout_weight="1" android:layout_marginStart="8dp" android:orientation="vertical"><TextView android:id="@+id/widget_header" android:layout_width="match_parent" android:layout_height="wrap_content" android:text="HASSOUN" android:textColor="#FFFFFF" android:textStyle="bold" android:textSize="11sp"/><TextView android:id="@+id/widget_brand_subtitle" android:layout_width="match_parent" android:layout_height="wrap_content" android:layout_marginTop="1dp" android:textColor="#BFDCD2" android:textStyle="bold" android:textSize="6.5sp"/></LinearLayout>
    <LinearLayout android:layout_width="wrap_content" android:layout_height="wrap_content" android:gravity="end" android:orientation="vertical"><TextView android:id="@+id/widget_date" android:layout_width="wrap_content" android:layout_height="wrap_content" android:textColor="#F7F1DE" android:textStyle="bold" android:textSize="8sp"/><TextView android:id="@+id/widget_hijri" android:layout_width="wrap_content" android:layout_height="wrap_content" android:layout_marginTop="1dp" android:textColor="#D8C17A" android:textSize="7.5sp"/></LinearLayout>
  </LinearLayout>
  <View android:layout_width="match_parent" android:layout_height="1dp" android:layout_marginTop="6dp" android:background="#2DFFFFFF" />
  <LinearLayout android:layout_width="match_parent" android:layout_height="66dp" android:layout_marginTop="5dp" android:orientation="horizontal" android:gravity="center_vertical">
    <LinearLayout android:layout_width="0dp" android:layout_height="wrap_content" android:layout_weight="1" android:orientation="vertical"><TextView android:id="@+id/widget_next_label" android:layout_width="wrap_content" android:layout_height="wrap_content" android:text="NEXT PRAYER" android:textColor="#E5C76E" android:textStyle="bold" android:textSize="7sp"/><TextView android:id="@+id/widget_next_name" android:layout_width="wrap_content" android:layout_height="wrap_content" android:textColor="#FFFFFF" android:textStyle="bold" android:textSize="23sp" android:maxLines="1"/><TextView android:id="@+id/widget_next_secondary" android:layout_width="wrap_content" android:layout_height="wrap_content" android:textColor="#BFD9D1" android:textSize="8sp" android:maxLines="1"/></LinearLayout>
    <Chronometer android:id="@+id/widget_countdown" android:layout_width="64dp" android:layout_height="64dp" android:layout_marginHorizontal="5dp" android:gravity="center" android:background="@drawable/hassoun_widget_countdown_circle" android:padding="5dp" android:textColor="#17483C" android:textStyle="bold" android:textSize="10sp" android:maxLines="2" />
    <LinearLayout android:layout_width="0dp" android:layout_height="wrap_content" android:layout_weight="1" android:gravity="end" android:orientation="vertical"><TextView android:layout_width="wrap_content" android:layout_height="wrap_content" android:text="ADHAN" android:textColor="#C7DDD6" android:textStyle="bold" android:textSize="6sp"/><TextView android:id="@+id/widget_next_time" android:layout_width="wrap_content" android:layout_height="wrap_content" android:textColor="#FFFFFF" android:textStyle="bold" android:textSize="24sp" android:maxLines="1"/></LinearLayout>
  </LinearLayout>
  <LinearLayout android:id="@+id/widget_prayer_strip" android:layout_width="match_parent" android:layout_height="wrap_content" android:layout_marginTop="6dp" android:orientation="horizontal" android:gravity="center_vertical">
    <TextView android:id="@+id/widget_prayer_fajr" android:layout_width="0dp" android:layout_height="40dp" android:layout_weight="1" android:layout_marginEnd="2dp" android:gravity="center" android:background="@drawable/hassoun_widget_prayer_chip" android:textStyle="bold" android:textSize="7.5sp" android:maxLines="2"/>
    <TextView android:id="@+id/widget_prayer_dhuhr" android:layout_width="0dp" android:layout_height="40dp" android:layout_weight="1" android:layout_marginHorizontal="2dp" android:gravity="center" android:background="@drawable/hassoun_widget_prayer_chip" android:textStyle="bold" android:textSize="7.5sp" android:maxLines="2"/>
    <TextView android:id="@+id/widget_prayer_asr" android:layout_width="0dp" android:layout_height="40dp" android:layout_weight="1" android:layout_marginHorizontal="2dp" android:gravity="center" android:background="@drawable/hassoun_widget_prayer_chip" android:textStyle="bold" android:textSize="7.5sp" android:maxLines="2"/>
    <TextView android:id="@+id/widget_prayer_maghrib" android:layout_width="0dp" android:layout_height="40dp" android:layout_weight="1" android:layout_marginHorizontal="2dp" android:gravity="center" android:background="@drawable/hassoun_widget_prayer_chip" android:textStyle="bold" android:textSize="7.5sp" android:maxLines="2"/>
    <TextView android:id="@+id/widget_prayer_isha" android:layout_width="0dp" android:layout_height="40dp" android:layout_weight="1" android:layout_marginStart="2dp" android:gravity="center" android:background="@drawable/hassoun_widget_prayer_chip" android:textStyle="bold" android:textSize="7.5sp" android:maxLines="2"/>
  </LinearLayout>
  <TextView android:id="@+id/widget_location" android:layout_width="match_parent" android:layout_height="wrap_content" android:layout_marginTop="4dp" android:textColor="#AFCFC5" android:textSize="7sp" android:maxLines="1" />
</LinearLayout>
''')

write("mobile/modules/hassoun-widget/android/src/main/res/layout/hassoun_prayer_widget_vertical.xml", r'''<?xml version="1.0" encoding="utf-8"?>
<LinearLayout xmlns:android="http://schemas.android.com/apk/res/android" android:id="@+id/widget_root" android:layout_width="match_parent" android:layout_height="match_parent" android:orientation="vertical" android:gravity="center_horizontal" android:background="@drawable/hassoun_widget_patterned" android:padding="12dp">
  <ImageView android:id="@+id/widget_logo" android:layout_width="48dp" android:layout_height="48dp" android:src="@drawable/hassoun_widget_logo" android:scaleType="fitCenter" android:contentDescription="Hassoun"/>
  <TextView android:id="@+id/widget_header" android:layout_width="wrap_content" android:layout_height="wrap_content" android:text="HASSOUN" android:textColor="#FFFFFF" android:textStyle="bold" android:textSize="11sp"/><TextView android:id="@+id/widget_brand_subtitle" android:layout_width="wrap_content" android:layout_height="wrap_content" android:textColor="#BFDCD2" android:textStyle="bold" android:textSize="6.5sp"/>
  <LinearLayout android:layout_width="match_parent" android:layout_height="wrap_content" android:layout_marginTop="5dp" android:orientation="horizontal" android:gravity="center"><TextView android:id="@+id/widget_date" android:layout_width="0dp" android:layout_height="wrap_content" android:layout_weight="1" android:textColor="#F7F1DE" android:textStyle="bold" android:textSize="8sp"/><TextView android:id="@+id/widget_hijri" android:layout_width="0dp" android:layout_height="wrap_content" android:layout_weight="1" android:gravity="end" android:textColor="#D8C17A" android:textSize="7.5sp"/></LinearLayout>
  <TextView android:id="@+id/widget_next_label" android:layout_width="wrap_content" android:layout_height="wrap_content" android:layout_marginTop="8dp" android:text="NEXT PRAYER" android:textColor="#E5C76E" android:textStyle="bold" android:textSize="7sp"/><TextView android:id="@+id/widget_next_name" android:layout_width="wrap_content" android:layout_height="wrap_content" android:textColor="#FFFFFF" android:textStyle="bold" android:textSize="25sp"/><TextView android:id="@+id/widget_next_secondary" android:layout_width="wrap_content" android:layout_height="wrap_content" android:textColor="#BFD9D1" android:textSize="8sp"/>
  <TextView android:id="@+id/widget_next_time" android:layout_width="wrap_content" android:layout_height="wrap_content" android:layout_marginTop="2dp" android:textColor="#FFFFFF" android:textStyle="bold" android:textSize="24sp"/>
  <Chronometer android:id="@+id/widget_countdown" android:layout_width="72dp" android:layout_height="72dp" android:layout_marginTop="5dp" android:gravity="center" android:background="@drawable/hassoun_widget_countdown_circle" android:padding="5dp" android:textColor="#17483C" android:textStyle="bold" android:textSize="10sp" android:maxLines="2"/>
  <LinearLayout android:id="@+id/widget_prayer_strip" android:layout_width="match_parent" android:layout_height="wrap_content" android:layout_marginTop="8dp" android:orientation="vertical">
    <TextView android:id="@+id/widget_prayer_fajr" android:layout_width="match_parent" android:layout_height="30dp" android:gravity="center" android:background="@drawable/hassoun_widget_prayer_chip" android:textStyle="bold" android:textSize="8sp"/><TextView android:id="@+id/widget_prayer_dhuhr" android:layout_width="match_parent" android:layout_height="30dp" android:layout_marginTop="3dp" android:gravity="center" android:background="@drawable/hassoun_widget_prayer_chip" android:textStyle="bold" android:textSize="8sp"/><TextView android:id="@+id/widget_prayer_asr" android:layout_width="match_parent" android:layout_height="30dp" android:layout_marginTop="3dp" android:gravity="center" android:background="@drawable/hassoun_widget_prayer_chip" android:textStyle="bold" android:textSize="8sp"/><TextView android:id="@+id/widget_prayer_maghrib" android:layout_width="match_parent" android:layout_height="30dp" android:layout_marginTop="3dp" android:gravity="center" android:background="@drawable/hassoun_widget_prayer_chip" android:textStyle="bold" android:textSize="8sp"/><TextView android:id="@+id/widget_prayer_isha" android:layout_width="match_parent" android:layout_height="30dp" android:layout_marginTop="3dp" android:gravity="center" android:background="@drawable/hassoun_widget_prayer_chip" android:textStyle="bold" android:textSize="8sp"/>
  </LinearLayout><TextView android:id="@+id/widget_location" android:layout_width="wrap_content" android:layout_height="wrap_content" android:layout_marginTop="5dp" android:textColor="#AFCFC5" android:textSize="7sp"/>
</LinearLayout>
''')

# Lock screen stays transparent but now emphasizes time/countdown.
replace_once("mobile/modules/hassoun-widget/android/src/main/res/layout/hassoun_prayer_widget_lockscreen.xml", 'android:textSize="18sp"\n        android:maxLines="1"', 'android:textSize="24sp"\n        android:maxLines="1"')
replace_once("mobile/modules/hassoun-widget/android/src/main/res/layout/hassoun_prayer_widget_lockscreen.xml", 'android:textSize="7sp"\n        android:shadowColor="#A0000000"', 'android:textSize="10sp"\n        android:shadowColor="#A0000000"')

# Provider: preferences, patterned backgrounds, large time, configurable countdown/focus.
replace_once("mobile/modules/hassoun-widget/android/src/main/java/ca/wopt/hassounwidget/HassounPrayerWidgetProvider.kt", 'import android.os.SystemClock\n', 'import android.os.SystemClock\nimport android.util.TypedValue\n')
replace_once(
    "mobile/modules/hassoun-widget/android/src/main/java/ca/wopt/hassounwidget/HassounPrayerWidgetProvider.kt",
    '      val showLocation = prefs.getBoolean("showLocation", false)\n      val schedule = loadSchedule(context)\n',
    '''      val showLocation = prefs.getBoolean("showLocation", false)
      val showLogo = prefs.getBoolean("showLogo", true)
      val showArabicNames = prefs.getBoolean("showArabicNames", true)
      val highlightNext = prefs.getBoolean("highlightNext", true)
      val timeSize = prefs.getString("timeSize", "large") ?: "large"
      val countdownStyle = prefs.getString("countdownStyle", "circle") ?: "circle"
      val focus = prefs.getString("focus", "next") ?: "next"
      val schedule = loadSchedule(context)
'''
)
replace_once(
    "mobile/modules/hassoun-widget/android/src/main/java/ca/wopt/hassounwidget/HassounPrayerWidgetProvider.kt",
    '      views.setTextViewText(R.id.widget_header, "HASSOUN")\n',
    '''      views.setViewVisibility(R.id.widget_logo, if (showLogo) View.VISIBLE else View.GONE)
      views.setTextViewText(R.id.widget_header, "HASSOUN")
'''
)
replace_once(
    "mobile/modules/hassoun-widget/android/src/main/java/ca/wopt/hassounwidget/HassounPrayerWidgetProvider.kt",
    '        views.setTextViewText(R.id.widget_next_secondary, if (locale == "ar") englishNames[next.key] ?: next.key else arabicNames[next.key] ?: next.key)\n        views.setTextViewText(R.id.widget_next_time, formatClock(next.timeText, locale))\n\n        val delay =',
    '''        val secondaryName = if (locale == "ar") englishNames[next.key] ?: next.key else arabicNames[next.key] ?: next.key
        views.setTextViewText(R.id.widget_next_secondary, if (showArabicNames) secondaryName else "")
        views.setViewVisibility(R.id.widget_next_secondary, if (showArabicNames) View.VISIBLE else View.GONE)
        views.setTextViewText(R.id.widget_next_time, formatClock(next.timeText, locale))
        val timeSp = when (timeSize) { "small" -> 18f; "medium" -> 22f; "xlarge" -> 30f; else -> 26f }
        val prayerNameSp = when (focus) { "all" -> 20f; "balanced" -> 23f; else -> 26f }
        views.setTextViewTextSize(R.id.widget_next_time, TypedValue.COMPLEX_UNIT_SP, timeSp)
        views.setTextViewTextSize(R.id.widget_next_name, TypedValue.COMPLEX_UNIT_SP, prayerNameSp)

        val delay ='''
)
replace_once(
    "mobile/modules/hassoun-widget/android/src/main/java/ca/wopt/hassounwidget/HassounPrayerWidgetProvider.kt",
    '''          views.setViewVisibility(R.id.widget_countdown, View.VISIBLE)
          views.setChronometer(R.id.widget_countdown, SystemClock.elapsedRealtime() + delay, if (locale == "ar") "⏳ %s" else "⏳ %s left", true)
''',
    '''          views.setViewVisibility(R.id.widget_countdown, View.VISIBLE)
          val countFormat = when (countdownStyle) {
            "minimal" -> if (locale == "ar") "%s متبقي" else "%s left"
            "pill" -> if (locale == "ar") "⏳ %s متبقي" else "⏳ %s left"
            else -> if (locale == "ar") "%s\\nمتبقي" else "%s\\nLEFT"
          }
          views.setChronometer(R.id.widget_countdown, SystemClock.elapsedRealtime() + delay, countFormat, true)
          views.setInt(R.id.widget_countdown, "setBackgroundResource", when (countdownStyle) {
            "minimal" -> R.drawable.hassoun_widget_countdown_minimal
            "pill" -> R.drawable.hassoun_widget_countdown
            else -> R.drawable.hassoun_widget_countdown_circle
          })
          views.setTextViewTextSize(R.id.widget_countdown, TypedValue.COMPLEX_UNIT_SP, if (countdownStyle == "circle") 10f else 8.5f)
'''
)
replace_once(
    "mobile/modules/hassoun-widget/android/src/main/java/ca/wopt/hassounwidget/HassounPrayerWidgetProvider.kt",
    '''        val fullLayout = isLockScreen || layout == "full" || layout == "vertical"
        if (fullLayout && (showAllPrayers || isLockScreen)) {
          views.setViewVisibility(R.id.widget_prayer_strip, View.VISIBLE)
          bindPrayerStrip(views, next.day, locale, next.key, isLockScreen, theme)
''',
    '''        val supportsPrayerStrip = isLockScreen || layout in setOf("full", "vertical", "square", "slim", "next", "compact")
        if (supportsPrayerStrip && (showAllPrayers || isLockScreen)) {
          views.setViewVisibility(R.id.widget_prayer_strip, View.VISIBLE)
          bindPrayerStrip(views, next.day, locale, next.key, isLockScreen, theme, showArabicNames, highlightNext, timeSize, focus)
'''
)
replace_once(
    "mobile/modules/hassoun-widget/android/src/main/java/ca/wopt/hassounwidget/HassounPrayerWidgetProvider.kt",
    '    private fun bindPrayerStrip(views: RemoteViews, day: JSONObject, locale: String, nextKey: String, lockScreen: Boolean = false, theme: String = "emerald") {',
    '    private fun bindPrayerStrip(views: RemoteViews, day: JSONObject, locale: String, nextKey: String, lockScreen: Boolean = false, theme: String = "emerald", showArabicNames: Boolean = true, highlightNext: Boolean = true, timeSize: String = "large", focus: String = "next") {'
)
replace_once(
    "mobile/modules/hassoun-widget/android/src/main/java/ca/wopt/hassounwidget/HassounPrayerWidgetProvider.kt",
    '''        val name = if (locale == "ar") arabicNames[key] ?: key else englishNames[key] ?: key
        val time = formatClock(day.optString(key, "--:--"), locale)
        val active = key == nextKey
        views.setTextViewText(id, "${if (active) "● " else ""}$name\\n$time")
''',
    '''        val name = if (locale == "ar") arabicNames[key] ?: key else englishNames[key] ?: key
        val otherName = if (locale == "ar") englishNames[key] ?: key else arabicNames[key] ?: key
        val time = formatClock(day.optString(key, "--:--"), locale)
        val active = highlightNext && key == nextKey
        val displayName = if (showArabicNames) "$name • $otherName" else name
        views.setTextViewText(id, "${if (active) "● " else ""}$displayName\\n$time")
        val stripSp = when { focus == "all" -> 8.8f; timeSize == "xlarge" -> 8.6f; timeSize == "small" -> 7.2f; else -> 8f }
        views.setTextViewTextSize(id, TypedValue.COMPLEX_UNIT_SP, stripSp)
'''
)
replace_once(
    "mobile/modules/hassoun-widget/android/src/main/java/ca/wopt/hassounwidget/HassounPrayerWidgetProvider.kt",
    '''        "ivory" -> R.drawable.hassoun_widget_background_ivory
        "ocean" -> R.drawable.hassoun_widget_background_ocean
        "sunset" -> R.drawable.hassoun_widget_background_sunset
        "midnight" -> R.drawable.hassoun_widget_background_midnight
        else -> R.drawable.hassoun_widget_background
''',
    '''        "ivory" -> R.drawable.hassoun_widget_patterned_ivory
        "ocean" -> R.drawable.hassoun_widget_patterned_ocean
        "sunset" -> R.drawable.hassoun_widget_patterned_sunset
        "midnight" -> R.drawable.hassoun_widget_patterned_midnight
        else -> R.drawable.hassoun_widget_patterned
'''
)

# -----------------------------------------------------------------------------
# Widget Studio: add controls and make preview respond to them
# -----------------------------------------------------------------------------
replace_once(
    "mobile/src/SettingsHub.tsx",
    'import HassounWidget, { type HassounWidgetLayout, type HassounWidgetPreferences, type HassounWidgetTheme } from "../modules/hassoun-widget";',
    'import HassounWidget, { type HassounWidgetCountdownStyle, type HassounWidgetFocus, type HassounWidgetLayout, type HassounWidgetPreferences, type HassounWidgetTheme, type HassounWidgetTimeSize } from "../modules/hassoun-widget";'
)
replace_once(
    "mobile/src/SettingsHub.tsx",
    '    const widgetLogo = require("../assets/icon.png");\n',
    '''    const widgetLogo = require("../assets/icon.png");
    const previewTimeSize = widgetPrefs.timeSize === "xlarge" ? 28 : widgetPrefs.timeSize === "large" ? 23 : widgetPrefs.timeSize === "medium" ? 19 : 16;
    const previewPrayerSize = widgetPrefs.focus === "next" ? 29 : widgetPrefs.focus === "balanced" ? 25 : 21;
'''
)
replace_once(
    "mobile/src/SettingsHub.tsx",
    '<Image source={widgetLogo} style={styles.previewLogo} resizeMode="contain" />',
    '{widgetPrefs.showLogo ? <Image source={widgetLogo} style={styles.previewLogo} resizeMode="contain" /> : null}'
)
replace_once(
    "mobile/src/SettingsHub.tsx",
    '<View style={styles.previewPrayerRow}><View><Text style={[styles.previewTiny, { color: previewTheme.accent }]}>NEXT PRAYER</Text><Text style={[styles.previewPrayer, { color: previewTheme.fg }]}>Dhuhr</Text><Text style={[styles.previewArabic, { color: previewTheme.muted }]}>الظهر</Text></View><View style={styles.previewTimeBlock}><Text style={[styles.previewTime, { color: previewTheme.fg }]}>1:36 p.m.</Text>{widgetPrefs.showCountdown && <Text style={[styles.previewCountdown, { color: previewTheme.accent }]}>⏳ 50:34 left</Text>}</View></View>',
    '<View style={styles.previewPrayerRow}><View style={styles.previewSide}><Text style={[styles.previewTiny, { color: previewTheme.accent }]}>NEXT PRAYER</Text><Text style={[styles.previewPrayer, { color: previewTheme.fg, fontSize: previewPrayerSize }]}>Dhuhr</Text>{widgetPrefs.showArabicNames ? <Text style={[styles.previewArabic, { color: previewTheme.muted }]}>الظهر</Text> : null}</View>{widgetPrefs.showCountdown ? <View style={[styles.previewCountdownCenter, widgetPrefs.countdownStyle === "circle" && styles.previewCountdownCircle, widgetPrefs.countdownStyle === "pill" && styles.previewCountdownPill, { borderColor: previewTheme.accent }]}><Text style={[styles.previewCountdownBig, { color: widgetPrefs.countdownStyle === "circle" ? "#173f35" : previewTheme.accent }]}>50:34</Text><Text style={[styles.previewCountdownLabel, { color: widgetPrefs.countdownStyle === "circle" ? "#31564b" : previewTheme.muted }]}>LEFT</Text></View> : null}<View style={[styles.previewTimeBlock, styles.previewSide]}><Text style={[styles.previewTiny, { color: previewTheme.muted }]}>ADHAN</Text><Text style={[styles.previewTime, { color: previewTheme.fg, fontSize: previewTimeSize }]}>1:36 p.m.</Text></View></View>'
)
replace_once(
    "mobile/src/SettingsHub.tsx",
    '''          ["showCountdown", t("Live countdown", "العد التنازلي المباشر")],
          ["showHijri", t("Hijri date", "التاريخ الهجري")],''',
    '''          ["showCountdown", t("Live countdown", "العد التنازلي المباشر")],
          ["showLogo", t("Hassoun logo", "شعار Hassoun")],
          ["showArabicNames", t("Arabic prayer names", "أسماء الصلوات بالعربية")],
          ["highlightNext", t("Highlight next prayer", "تمييز الصلاة القادمة")],
          ["showHijri", t("Hijri date", "التاريخ الهجري")],'''
)

controls_block = r'''
        <Text style={styles.sectionLabel}>{t("NEXT PRAYER TIME SIZE", "حجم وقت الصلاة القادمة")}</Text>
        <View style={styles.optionGrid}>{([ ["small", t("Small", "صغير")], ["medium", t("Medium", "متوسط")], ["large", t("Large", "كبير")], ["xlarge", t("Extra large", "كبير جداً")] ] as Array<[HassounWidgetTimeSize, string]>).map(([value, label]) => <Pressable key={value} onPress={() => updateWidget({ timeSize: value })} style={[styles.optionChip, widgetPrefs.timeSize === value && styles.optionChipActive]}><Text style={[styles.optionChipText, widgetPrefs.timeSize === value && styles.optionChipTextActive]}>{label}</Text></Pressable>)}</View>

        <Text style={styles.sectionLabel}>{t("COUNTDOWN STYLE", "شكل العد التنازلي")}</Text>
        <View style={styles.optionGrid}>{([ ["circle", t("Circle", "دائرة")], ["pill", t("Pill", "كبسولة")], ["minimal", t("Minimal", "بسيط")] ] as Array<[HassounWidgetCountdownStyle, string]>).map(([value, label]) => <Pressable key={value} onPress={() => updateWidget({ countdownStyle: value })} style={[styles.optionChip, widgetPrefs.countdownStyle === value && styles.optionChipActive]}><Text style={[styles.optionChipText, widgetPrefs.countdownStyle === value && styles.optionChipTextActive]}>{label}</Text></Pressable>)}</View>

        <Text style={styles.sectionLabel}>{t("LAYOUT EMPHASIS", "تركيز التصميم")}</Text>
        <View style={styles.optionGrid}>{([ ["next", t("Next prayer", "الصلاة القادمة")], ["balanced", t("Balanced", "متوازن")], ["all", t("All prayers", "كل الصلوات")] ] as Array<[HassounWidgetFocus, string]>).map(([value, label]) => <Pressable key={value} onPress={() => updateWidget({ focus: value })} style={[styles.optionChip, widgetPrefs.focus === value && styles.optionChipActive]}><Text style={[styles.optionChipText, widgetPrefs.focus === value && styles.optionChipTextActive]}>{label}</Text></Pressable>)}</View>
'''
replace_once(
    "mobile/src/SettingsHub.tsx",
    '        <Pressable onPress={() => {\n          const ok = HassounWidget.requestPin();',
    controls_block + '\n        <Pressable onPress={() => {\n          const ok = HassounWidget.requestPin();'
)
replace_once(
    "mobile/src/SettingsHub.tsx",
    '  previewPrayerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginTop: 12 },',
    '  previewPrayerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 12, gap: 6 }, previewSide: { flex: 1 }, previewCountdownCenter: { minWidth: 64, minHeight: 48, borderRadius: 20, borderWidth: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 6 }, previewCountdownCircle: { width: 66, height: 66, borderRadius: 33, backgroundColor: "#F2E0A8" }, previewCountdownPill: { minWidth: 76, minHeight: 42, borderRadius: 22, backgroundColor: "rgba(0,0,0,.12)" }, previewCountdownBig: { fontSize: 11, fontWeight: "900" }, previewCountdownLabel: { fontSize: 5.5, fontWeight: "900", marginTop: 1 },'
)
replace_once(
    "mobile/src/SettingsHub.tsx",
    '  toggleLabel: { color: "#264b41", fontSize: 12, fontWeight: "800" },',
    '  toggleLabel: { color: "#264b41", fontSize: 12, fontWeight: "800" }, optionGrid: { flexDirection: "row", flexWrap: "wrap", gap: 7, marginBottom: 8 }, optionChip: { minWidth: "22%", flexGrow: 1, minHeight: 43, borderRadius: 14, backgroundColor: "#fff", borderWidth: 1, borderColor: "#dedbd3", alignItems: "center", justifyContent: "center", paddingHorizontal: 8 }, optionChipActive: { backgroundColor: "#0b654f", borderColor: "#0b654f" }, optionChipText: { color: "#53645e", fontSize: 8.5, fontWeight: "900", textAlign: "center" }, optionChipTextActive: { color: "#fff" },'
)

# -----------------------------------------------------------------------------
# Version bump
# -----------------------------------------------------------------------------
replace_once("mobile/app.config.ts", '  version: "0.5.6",', '  version: "0.5.7",')
replace_once("mobile/app.config.ts", '    versionCode: 28,', '    versionCode: 29,')

print("Applied Hassoun v0.5.7: widgets, Noble Qur'an navigation, and multiplayer games.")
