import { requireAdmin } from "./adminAuth";
import type { Env } from "./types";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}

async function bodyJson(request: Request) {
  const length = Number(request.headers.get("Content-Length") ?? 0);
  if (length > 16_384) throw new Error("Request body is too large");
  return await request.json() as Record<string, unknown>;
}

async function audit(env: Env, adminId: number, action: string, entityId: string, details?: unknown) {
  await env.DB.prepare(
    `INSERT INTO admin_activity_log (admin_user_id, action, entity_type, entity_id, details_json)
     VALUES (?, ?, 'game_room', ?, ?)`
  ).bind(adminId, action, entityId, details == null ? null : JSON.stringify(details)).run();
}

export async function listAdminGameRooms(request: Request, env: Env, url: URL) {
  const auth = await requireAdmin(request, env);
  if (!auth.admin) return auth.response!;
  const status = url.searchParams.get("status") ?? "";
  const where = ["r.updated_at >= datetime('now', '-7 days')"];
  const binds: unknown[] = [];
  if (["lobby", "playing", "finished"].includes(status)) { where.push("r.status = ?"); binds.push(status); }
  const result = await env.DB.prepare(
    `SELECT r.code, r.game_type, r.category, r.status, r.host_player_id, r.created_at, r.updated_at,
            COUNT(p.player_id) AS player_count,
            GROUP_CONCAT(p.name, ', ') AS player_names
     FROM game_rooms r
     LEFT JOIN game_players p ON p.room_code = r.code
     WHERE ${where.join(" AND ")}
     GROUP BY r.code
     ORDER BY CASE r.status WHEN 'playing' THEN 0 WHEN 'lobby' THEN 1 ELSE 2 END, r.updated_at DESC
     LIMIT 250`
  ).bind(...binds).all();
  return json({ ok: true, rooms: result.results ?? [] });
}

export async function inspectAdminGameRoom(request: Request, env: Env, url: URL) {
  const auth = await requireAdmin(request, env);
  if (!auth.admin) return auth.response!;
  const code = (url.searchParams.get("code") ?? "").trim().toUpperCase();
  if (!/^[A-Z0-9]{4,12}$/.test(code)) return json({ error: "Valid room code is required" }, 400);
  const room = await env.DB.prepare(
    "SELECT code, game_type, category, status, host_player_id, state_json, created_at, updated_at FROM game_rooms WHERE code = ?"
  ).bind(code).first();
  if (!room) return json({ error: "Room not found" }, 404);
  const players = await env.DB.prepare(
    `SELECT player_id, name, score, is_host, joined_at, updated_at
     FROM game_players WHERE room_code = ? ORDER BY is_host DESC, score DESC, joined_at`
  ).bind(code).all();
  return json({ ok: true, room, players: players.results ?? [] });
}

export async function closeAdminGameRoom(request: Request, env: Env) {
  const auth = await requireAdmin(request, env);
  if (!auth.admin) return auth.response!;
  const body = await bodyJson(request);
  const code = typeof body.code === "string" ? body.code.trim().toUpperCase() : "";
  const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 500) : "Admin closed room";
  if (!/^[A-Z0-9]{4,12}$/.test(code)) return json({ error: "Valid room code is required" }, 400);
  const existing = await env.DB.prepare("SELECT status FROM game_rooms WHERE code = ?").bind(code).first<{ status: string }>();
  if (!existing) return json({ error: "Room not found" }, 404);
  await env.DB.prepare(
    `UPDATE game_rooms SET status = 'finished',
       state_json = json_set(COALESCE(state_json, '{}'), '$.adminClosed', 1, '$.adminCloseReason', ?),
       updated_at = CURRENT_TIMESTAMP WHERE code = ?`
  ).bind(reason, code).run();
  await audit(env, auth.admin.id, "game.room.close", code, { reason, previousStatus: existing.status });
  return json({ ok: true });
}

export async function deleteAdminGameRoom(request: Request, env: Env, url: URL) {
  const auth = await requireAdmin(request, env);
  if (!auth.admin) return auth.response!;
  if (auth.admin.role === "editor") return json({ error: "Admin role required" }, 403);
  const code = (url.searchParams.get("code") ?? "").trim().toUpperCase();
  if (!/^[A-Z0-9]{4,12}$/.test(code)) return json({ error: "Valid room code is required" }, 400);
  await env.DB.prepare("DELETE FROM game_rooms WHERE code = ?").bind(code).run();
  await audit(env, auth.admin.id, "game.room.delete", code);
  return json({ ok: true });
}
