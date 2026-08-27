import { requireAdmin } from "./adminAuth";
import type { Env } from "./types";

type AdminRole = "owner" | "admin" | string;
function json(data: unknown, status = 200) { return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } }); }
async function operator(request: Request, env: Env) {
  const auth = await requireAdmin(request, env);
  if (!auth.admin) return { admin: null, response: auth.response! };
  if (auth.admin.role !== "owner" && auth.admin.role !== "admin") return { admin: null, response: json({ error: "Owner or admin access required" }, 403) };
  return { admin: auth.admin as { role: AdminRole }, response: null };
}

export async function getAdminGames(request: Request, env: Env) {
  const auth = await operator(request, env); if (!auth.admin) return auth.response!;
  const [settings, rooms, results, counts] = await Promise.all([
    env.DB.prepare("SELECT game_type,enabled,max_rounds,updated_at FROM game_settings ORDER BY game_type").all(),
    env.DB.prepare(`SELECT r.code,r.game_type,r.category,r.status,r.created_at,r.updated_at,r.state_json,
      COUNT(p.player_id) player_count, COALESCE(MAX(p.score),0) top_score
      FROM game_rooms r LEFT JOIN game_players p ON p.room_code=r.code
      WHERE r.status!='finished' GROUP BY r.code ORDER BY r.updated_at DESC LIMIT 50`).all(),
    env.DB.prepare("SELECT id,room_code,game_type,category,winner_names,scores_json,rounds_played,ended_reason,created_at FROM game_results ORDER BY created_at DESC LIMIT 50").all(),
    env.DB.prepare("SELECT game_type,COUNT(*) total FROM game_results GROUP BY game_type ORDER BY total DESC").all()
  ]);
  return json({ ok: true, settings: settings.results ?? [], activeRooms: rooms.results ?? [], recentResults: results.results ?? [], totals: counts.results ?? [] });
}

export async function updateAdminGameSetting(request: Request, env: Env, gameType: string) {
  const auth = await operator(request, env); if (!auth.admin) return auth.response!;
  if (!/^(trivia|imposter|clue|wordrace|wordpuzzle)$/.test(gameType)) return json({ error: "Invalid game" }, 400);
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return json({ error: "Invalid request body" }, 400);
  const enabled = body.enabled === false ? 0 : 1;
  const maxRounds = Math.max(1, Math.min(20, Math.round(Number(body.maxRounds) || 5)));
  await env.DB.prepare(`INSERT INTO game_settings (game_type,enabled,max_rounds,updated_at) VALUES (?,?,?,CURRENT_TIMESTAMP)
    ON CONFLICT(game_type) DO UPDATE SET enabled=excluded.enabled,max_rounds=excluded.max_rounds,updated_at=CURRENT_TIMESTAMP`)
    .bind(gameType, enabled, maxRounds).run();
  return json({ ok: true, gameType, enabled: Boolean(enabled), maxRounds });
}

export async function closeAdminGameRoom(request: Request, env: Env, code: string) {
  const auth = await operator(request, env); if (!auth.admin) return auth.response!;
  if (!/^[A-Z2-9]{6}$/.test(code)) return json({ error: "Invalid room code" }, 400);
  const room = await env.DB.prepare("SELECT code,game_type,category,status,state_json FROM game_rooms WHERE code=?").bind(code).first<{code:string;game_type:string;category:string;status:string;state_json:string}>();
  if (!room) return json({ error: "Room not found" }, 404);
  const players = await env.DB.prepare("SELECT player_id id,name,score FROM game_players WHERE room_code=? ORDER BY score DESC,joined_at ASC").bind(code).all<{id:string;name:string;score:number}>();
  const list = players.results ?? [];
  const top = list.length ? Math.max(...list.map((p) => p.score)) : 0;
  const winners = list.filter((p) => p.score === top).map((p) => p.name);
  let state: Record<string, unknown> = {}; try { state = JSON.parse(room.state_json) as Record<string, unknown>; } catch {}
  const rounds = Number(state.round || 0);
  state.phase = "results"; delete state.endsAt;
  await env.DB.batch([
    env.DB.prepare("UPDATE game_rooms SET status='finished',state_json=?,updated_at=CURRENT_TIMESTAMP WHERE code=?").bind(JSON.stringify(state), code),
    env.DB.prepare(`INSERT OR IGNORE INTO game_results (room_code,game_type,category,winner_names,scores_json,rounds_played,ended_reason)
      VALUES (?,?,?,?,?,?,'admin_closed')`).bind(code, room.game_type, room.category, winners.join(", "), JSON.stringify(list), rounds)
  ]);
  return json({ ok: true, code, winners });
}
