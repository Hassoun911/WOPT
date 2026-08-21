import type { Env } from "./types";

type RoomRow = { code: string; game_type: "trivia" | "imposter" | "clue"; category: "islamic" | "sports"; status: "lobby" | "playing" | "finished"; host_player_id: string; state_json: string; created_at: string };
type PlayerRow = { player_id: string; name: string; score: number; is_host: number };

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}

function validPlayerId(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{8,128}$/.test(value);
}

function publicFinishedRoom(room: RoomRow, players: PlayerRow[]) {
  let state: Record<string, unknown> = {};
  try { state = JSON.parse(room.state_json || "{}"); } catch {}
  return {
    room: {
      code: room.code,
      gameType: room.game_type,
      category: room.category,
      status: "finished" as const,
      hostPlayerId: room.host_player_id,
      state: {
        phase: "results",
        round: typeof state.round === "number" ? state.round : 0,
        endsAt: null,
        activePlayerId: state.activePlayerId ?? null,
        lastResult: state.lastResult ?? null
      },
      private: {},
      players: players.map((player) => ({
        id: player.player_id,
        name: player.name,
        score: player.score,
        isHost: player.is_host === 1
      }))
    },
    saved: true
  };
}

export async function finishGameSession(request: Request, env: Env, code: string) {
  const body = (await request.json()) as Record<string, unknown>;
  if (!validPlayerId(body.playerId)) return json({ error: "Invalid player" }, 400);
  const room = await env.DB.prepare("SELECT code, game_type, category, status, host_player_id, state_json, created_at FROM game_rooms WHERE code = ?")
    .bind(code).first<RoomRow>();
  if (!room) return json({ error: "Room not found" }, 404);
  if (room.host_player_id !== body.playerId) return json({ error: "Only the host can end the game" }, 403);

  const playerRows = await env.DB.prepare("SELECT player_id, name, score, is_host FROM game_players WHERE room_code = ? ORDER BY joined_at ASC")
    .bind(code).all<PlayerRow>();
  const players = playerRows.results ?? [];
  if (!players.length) return json({ error: "No players in this room" }, 409);

  let state: Record<string, unknown> = {};
  try { state = JSON.parse(room.state_json || "{}"); } catch {}
  state.phase = "results";

  if (room.status !== "finished") {
    await env.DB.prepare("UPDATE game_rooms SET status = 'finished', state_json = ?, updated_at = CURRENT_TIMESTAMP WHERE code = ?")
      .bind(JSON.stringify(state), code).run();

    const winningScore = players.reduce((max, player) => Math.max(max, player.score), 0);
    const winners = players.filter((player) => player.score === winningScore);
    const winnerNames = winners.map((player) => player.name);
    const participants = players.map((player) => ({ id: player.player_id, name: player.name, score: player.score }));
    const sessionId = `${room.code}:${room.created_at}`;
    const statements = players.map((player) => {
      const isWinner = winners.some((winner) => winner.player_id === player.player_id);
      const result = isWinner ? (winners.length > 1 ? "tie" : "win") : "loss";
      return env.DB.prepare(
        `INSERT OR IGNORE INTO game_session_history (
           session_id, room_code, player_id, player_name, game_type, category, result,
           player_score, winning_score, winner_names_json, participants_json, started_at, finished_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`
      ).bind(
        sessionId, room.code, player.player_id, player.name, room.game_type, room.category, result,
        player.score, winningScore, JSON.stringify(winnerNames), JSON.stringify(participants), room.created_at
      );
    });
    if (statements.length) await env.DB.batch(statements);
  }

  const finishedRoom: RoomRow = { ...room, status: "finished", state_json: JSON.stringify(state) };
  return json(publicFinishedRoom(finishedRoom, players));
}

export async function listGameHistory(url: URL, env: Env) {
  const playerId = url.searchParams.get("playerId") ?? "";
  if (!validPlayerId(playerId)) return json({ error: "Invalid player" }, 400);
  const { results } = await env.DB.prepare(
    `SELECT session_id, room_code, player_name, game_type, category, result, player_score,
            winning_score, winner_names_json, participants_json, started_at, finished_at
     FROM game_session_history
     WHERE player_id = ?
     ORDER BY finished_at DESC, id DESC
     LIMIT 100`
  ).bind(playerId).all<Record<string, unknown>>();

  return json({
    ok: true,
    history: results.map((row) => ({
      sessionId: row.session_id,
      roomCode: row.room_code,
      playerName: row.player_name,
      gameType: row.game_type,
      category: row.category,
      result: row.result,
      playerScore: row.player_score,
      winningScore: row.winning_score,
      winnerNames: typeof row.winner_names_json === "string" ? JSON.parse(row.winner_names_json) : [],
      participants: typeof row.participants_json === "string" ? JSON.parse(row.participants_json) : [],
      startedAt: row.started_at,
      finishedAt: row.finished_at
    }))
  });
}
