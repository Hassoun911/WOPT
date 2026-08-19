import { requireAdmin, type AuthenticatedAdmin } from "./adminAuth";
import type { Env } from "./types";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}

async function bodyJson(request: Request) {
  const length = Number(request.headers.get("Content-Length") ?? 0);
  if (length > 32_768) throw new Error("Request body is too large");
  return await request.json() as Record<string, unknown>;
}

function cleanUsername(value: unknown) {
  if (typeof value !== "string") return null;
  const username = value.trim().toLowerCase();
  return /^[a-z0-9._-]{3,40}$/.test(username) ? username : null;
}

function cleanEmail(value: unknown) {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254 ? email : null;
}

function cleanDisplayName(value: unknown) {
  if (value == null) return null;
  const text = String(value).trim().replace(/\s+/g, " ");
  return text ? text.slice(0, 100) : null;
}

function cleanPassword(value: unknown) {
  return typeof value === "string" && value.length >= 12 && value.length <= 200 ? value : null;
}

function base64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function randomToken(bytes = 24) {
  const value = new Uint8Array(bytes);
  crypto.getRandomValues(value);
  return base64Url(value);
}

async function passwordDigest(password: string, salt: string, iterations: number) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: new TextEncoder().encode(salt), iterations }, key, 256);
  return base64Url(new Uint8Array(bits));
}

function ownerOnly(admin: AuthenticatedAdmin) {
  return admin.role === "owner";
}

async function audit(env: Env, admin: AuthenticatedAdmin, action: string, entityId: string, details?: unknown) {
  await env.DB.prepare(
    `INSERT INTO admin_activity_log (admin_user_id, action, entity_type, entity_id, details_json)
     VALUES (?, ?, 'admin_user', ?, ?)`
  ).bind(admin.id, action, entityId, details == null ? null : JSON.stringify(details)).run();
}

export async function listAdminUsers(request: Request, env: Env) {
  const auth = await requireAdmin(request, env);
  if (!auth.admin) return auth.response!;
  if (!ownerOnly(auth.admin)) return json({ error: "Owner role required" }, 403);
  const result = await env.DB.prepare(
    `SELECT a.public_id, a.username, a.email, a.display_name, a.role, a.status,
            a.must_change_password, a.created_at, a.updated_at, a.last_signed_in_at,
            SUM(CASE WHEN s.revoked_at IS NULL AND s.expires_at > CURRENT_TIMESTAMP THEN 1 ELSE 0 END) AS active_sessions
     FROM admin_users a
     LEFT JOIN admin_sessions s ON s.admin_user_id = a.id
     GROUP BY a.id
     ORDER BY CASE a.role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END, a.username`
  ).all();
  return json({ ok: true, users: result.results ?? [] });
}

export async function createAdminUser(request: Request, env: Env) {
  const auth = await requireAdmin(request, env);
  if (!auth.admin) return auth.response!;
  if (!ownerOnly(auth.admin)) return json({ error: "Owner role required" }, 403);
  const body = await bodyJson(request);
  const username = cleanUsername(body.username);
  const email = cleanEmail(body.email);
  const password = cleanPassword(body.password);
  const displayName = cleanDisplayName(body.displayName);
  const role = body.role === "owner" || body.role === "admin" || body.role === "editor" ? body.role : "editor";
  if (!username || !email || !password) return json({ error: "Username, valid email and a 12+ character temporary password are required" }, 400);

  const existing = await env.DB.prepare("SELECT id FROM admin_users WHERE username = ? COLLATE NOCASE OR email = ? COLLATE NOCASE LIMIT 1").bind(username, email).first();
  if (existing) return json({ error: "Username or email is already in use" }, 409);

  const salt = randomToken();
  const iterations = 210_000;
  const digest = await passwordDigest(password, salt, iterations);
  const publicId = crypto.randomUUID();
  await env.DB.prepare(
    `INSERT INTO admin_users (public_id, username, email, display_name, password_hash, password_salt,
       password_iterations, must_change_password, role, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, 'active')`
  ).bind(publicId, username, email, displayName, digest, salt, iterations, role).run();
  await audit(env, auth.admin, "admin.create", publicId, { username, email, role });
  return json({ ok: true, publicId, mustChangePassword: true }, 201);
}

export async function updateAdminUser(request: Request, env: Env) {
  const auth = await requireAdmin(request, env);
  if (!auth.admin) return auth.response!;
  if (!ownerOnly(auth.admin)) return json({ error: "Owner role required" }, 403);
  const body = await bodyJson(request);
  const publicId = typeof body.publicId === "string" ? body.publicId.trim() : "";
  if (!publicId) return json({ error: "publicId is required" }, 400);

  const target = await env.DB.prepare(
    "SELECT id, public_id, username, email, role, status FROM admin_users WHERE public_id = ? LIMIT 1"
  ).bind(publicId).first<{ id: number; public_id: string; username: string; email: string; role: string; status: string }>();
  if (!target) return json({ error: "Administrator not found" }, 404);

  const self = target.id === auth.admin.id;
  const role = body.role === "owner" || body.role === "admin" || body.role === "editor" ? body.role : target.role;
  const status = body.status === "disabled" || body.status === "active" ? body.status : target.status;
  const email = body.email === undefined ? target.email : cleanEmail(body.email);
  const displayName = body.displayName === undefined ? undefined : cleanDisplayName(body.displayName);
  if (!email) return json({ error: "Valid email is required" }, 400);
  if (self && status === "disabled") return json({ error: "You cannot disable your own administrator account" }, 400);
  if (self && role !== "owner") return json({ error: "You cannot remove your own owner role" }, 400);

  if (target.role === "owner" && (role !== "owner" || status !== "active")) {
    const owners = await env.DB.prepare("SELECT COUNT(*) AS count FROM admin_users WHERE role = 'owner' AND status = 'active'").first<{ count: number }>();
    if ((owners?.count ?? 0) <= 1) return json({ error: "At least one active owner must remain" }, 400);
  }

  await env.DB.prepare(
    `UPDATE admin_users SET email = ?, display_name = COALESCE(?, display_name), role = ?, status = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`
  ).bind(email, displayName === undefined ? null : displayName, role, status, target.id).run();
  if (status === "disabled") {
    await env.DB.prepare("UPDATE admin_sessions SET revoked_at = CURRENT_TIMESTAMP WHERE admin_user_id = ? AND revoked_at IS NULL").bind(target.id).run();
  }
  await audit(env, auth.admin, "admin.update", publicId, { role, status, email });
  return json({ ok: true });
}

export async function resetAdminUserPassword(request: Request, env: Env) {
  const auth = await requireAdmin(request, env);
  if (!auth.admin) return auth.response!;
  if (!ownerOnly(auth.admin)) return json({ error: "Owner role required" }, 403);
  const body = await bodyJson(request);
  const publicId = typeof body.publicId === "string" ? body.publicId.trim() : "";
  const password = cleanPassword(body.password);
  if (!publicId || !password) return json({ error: "publicId and a 12+ character temporary password are required" }, 400);
  const target = await env.DB.prepare("SELECT id FROM admin_users WHERE public_id = ?").bind(publicId).first<{ id: number }>();
  if (!target) return json({ error: "Administrator not found" }, 404);
  const salt = randomToken();
  const iterations = 210_000;
  const digest = await passwordDigest(password, salt, iterations);
  await env.DB.prepare(
    `UPDATE admin_users SET password_hash = ?, password_salt = ?, password_iterations = ?, must_change_password = 1,
       updated_at = CURRENT_TIMESTAMP WHERE id = ?`
  ).bind(digest, salt, iterations, target.id).run();
  await env.DB.prepare("UPDATE admin_sessions SET revoked_at = CURRENT_TIMESTAMP WHERE admin_user_id = ? AND revoked_at IS NULL").bind(target.id).run();
  await audit(env, auth.admin, "admin.password.reset", publicId);
  return json({ ok: true, mustChangePassword: true });
}

export async function revokeAdminUserSessions(request: Request, env: Env) {
  const auth = await requireAdmin(request, env);
  if (!auth.admin) return auth.response!;
  if (!ownerOnly(auth.admin)) return json({ error: "Owner role required" }, 403);
  const body = await bodyJson(request);
  const publicId = typeof body.publicId === "string" ? body.publicId.trim() : "";
  if (!publicId) return json({ error: "publicId is required" }, 400);
  const target = await env.DB.prepare("SELECT id FROM admin_users WHERE public_id = ?").bind(publicId).first<{ id: number }>();
  if (!target) return json({ error: "Administrator not found" }, 404);
  await env.DB.prepare("UPDATE admin_sessions SET revoked_at = CURRENT_TIMESTAMP WHERE admin_user_id = ? AND revoked_at IS NULL").bind(target.id).run();
  await audit(env, auth.admin, "admin.sessions.revoke", publicId);
  return json({ ok: true });
}
