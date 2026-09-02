import { requireAdmin } from "./adminAuth";
import type { Env } from "./types";

const CLOUDFLARE_PBKDF2_ITERATIONS = 100_000;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}

async function bodyJson(request: Request) {
  const length = Number(request.headers.get("Content-Length") ?? 0);
  if (length > 16_384) throw new Error("Request body is too large");
  return (await request.json()) as Record<string, unknown>;
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

export async function createAdminTeamMember(request: Request, env: Env) {
  const auth = await requireAdmin(request, env);
  if (!auth.admin) return auth.response!;
  if (auth.admin.role !== "owner") return json({ error: "Owner access required" }, 403);

  const body = await bodyJson(request);
  const username = typeof body.username === "string" ? body.username.trim().toLowerCase() : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const displayName = typeof body.displayName === "string" ? body.displayName.trim().slice(0, 100) : null;
  const password = typeof body.temporaryPassword === "string" ? body.temporaryPassword : "";
  const role = body.role === "editor" ? "editor" : "admin";

  if (!/^[a-z0-9._-]{3,40}$/.test(username)) return json({ error: "Username must be 3-40 letters, numbers, dot, dash or underscore" }, 400);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return json({ error: "Valid email is required" }, 400);
  if (password.length < 10 || password.length > 200) return json({ error: "Temporary password must be at least 10 characters" }, 400);

  const duplicate = await env.DB.prepare("SELECT id FROM admin_users WHERE username = ? COLLATE NOCASE OR email = ? COLLATE NOCASE").bind(username, email).first();
  if (duplicate) return json({ error: "Username or email is already in use" }, 409);

  const salt = randomToken();
  const iterations = CLOUDFLARE_PBKDF2_ITERATIONS;
  const digest = await passwordDigest(password, salt, iterations);
  const publicId = crypto.randomUUID();
  await env.DB.prepare(
    `INSERT INTO admin_users (public_id, username, email, display_name, password_hash, password_salt,
       password_iterations, must_change_password, role, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, 'active')`
  ).bind(publicId, username, email, displayName || null, digest, salt, iterations, role).run();

  await env.DB.prepare(
    `INSERT INTO admin_audit_log (admin_user_id, action, entity_type, entity_id, summary, details_json)
     VALUES (?, 'create', 'admin_user', ?, ?, ?)`
  ).bind(auth.admin.id, publicId, `Created ${role} ${username}`, JSON.stringify({ email, role })).run();

  return json({ ok: true, publicId, username, email, role, mustChangePassword: true }, 201);
}
