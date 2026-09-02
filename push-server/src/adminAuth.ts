import type { Env } from "./types";

type AdminRow = {
  id: number;
  public_id: string;
  username: string;
  email: string;
  display_name: string | null;
  password_hash: string;
  password_salt: string;
  password_iterations: number;
  must_change_password: number;
  role: "owner" | "admin" | "editor";
  status: "active" | "disabled";
};

export type AuthenticatedAdmin = Pick<AdminRow, "id" | "public_id" | "username" | "email" | "display_name" | "role" | "must_change_password">;

const CLOUDFLARE_PBKDF2_ITERATIONS = 100_000;
const CLOUDFLARE_PBKDF2_MAX_ITERATIONS = 100_000;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" }
  });
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

function randomToken(bytes = 32) {
  const value = new Uint8Array(bytes);
  crypto.getRandomValues(value);
  return base64Url(value);
}

async function sha256Hex(input: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function passwordDigest(password: string, salt: string, iterations: number) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: new TextEncoder().encode(salt),
      iterations
    },
    key,
    256
  );
  return base64Url(new Uint8Array(bits));
}

function constantTimeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let result = 0;
  for (let index = 0; index < left.length; index += 1) {
    result |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return result === 0;
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

function cleanPassword(value: unknown) {
  return typeof value === "string" && value.length >= 10 && value.length <= 200 ? value : null;
}

function cleanDisplayName(value: unknown) {
  if (typeof value !== "string") return null;
  const name = value.trim().replace(/\s+/g, " ");
  return name && name.length <= 100 ? name : null;
}

async function adminByLogin(env: Env, login: string) {
  return env.DB.prepare(
    `SELECT id, public_id, username, email, display_name, password_hash, password_salt,
            password_iterations, must_change_password, role, status
     FROM admin_users
     WHERE username = ? COLLATE NOCASE OR email = ? COLLATE NOCASE
     LIMIT 1`
  ).bind(login, login).first<AdminRow>();
}

async function createSession(env: Env, admin: AdminRow) {
  const token = randomToken(36);
  const tokenHash = await sha256Hex(token);
  await env.DB.prepare(
    `INSERT INTO admin_sessions (admin_user_id, token_hash, expires_at)
     VALUES (?, ?, datetime('now', '+7 days'))`
  ).bind(admin.id, tokenHash).run();
  return token;
}

function publicAdmin(admin: AdminRow): AuthenticatedAdmin {
  return {
    id: admin.id,
    public_id: admin.public_id,
    username: admin.username,
    email: admin.email,
    display_name: admin.display_name,
    role: admin.role,
    must_change_password: admin.must_change_password
  };
}

export async function authenticateAdmin(request: Request, env: Env) {
  const authorization = request.headers.get("Authorization") ?? "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match?.[1]) return null;
  const tokenHash = await sha256Hex(match[1]);
  const row = await env.DB.prepare(
    `SELECT a.id, a.public_id, a.username, a.email, a.display_name,
            a.password_hash, a.password_salt, a.password_iterations,
            a.must_change_password, a.role, a.status
     FROM admin_sessions s
     JOIN admin_users a ON a.id = s.admin_user_id
     WHERE s.token_hash = ? AND s.revoked_at IS NULL AND s.expires_at > CURRENT_TIMESTAMP
       AND a.status = 'active'
     LIMIT 1`
  ).bind(tokenHash).first<AdminRow>();
  if (!row) return null;
  await env.DB.prepare(
    "UPDATE admin_sessions SET last_seen_at = CURRENT_TIMESTAMP WHERE token_hash = ?"
  ).bind(tokenHash).run();
  return publicAdmin(row);
}

export async function requireAdmin(request: Request, env: Env) {
  const admin = await authenticateAdmin(request, env);
  if (!admin) return { admin: null, response: json({ error: "Admin authentication required" }, 401) };
  return { admin, response: null };
}

export async function bootstrapAdmin(request: Request, env: Env) {
  const supplied = request.headers.get("X-Admin-Bootstrap-Key") ?? "";
  if (!env.ADMIN_BOOTSTRAP_KEY || supplied !== env.ADMIN_BOOTSTRAP_KEY) {
    return json({ error: "Bootstrap is not authorized" }, 403);
  }
  const existing = await env.DB.prepare("SELECT COUNT(*) AS count FROM admin_users").first<{ count: number }>();
  if ((existing?.count ?? 0) > 0) return json({ error: "Admin bootstrap is already complete" }, 409);

  const body = await bodyJson(request);
  const username = cleanUsername(body.username);
  const email = cleanEmail(body.email);
  const password = cleanPassword(body.password);
  const displayName = cleanDisplayName(body.displayName);
  if (!username || !email || !password) {
    return json({ error: "Username, valid email, and a password of at least 10 characters are required" }, 400);
  }

  const salt = randomToken(24);
  const iterations = CLOUDFLARE_PBKDF2_ITERATIONS;
  const digest = await passwordDigest(password, salt, iterations);
  const publicId = crypto.randomUUID();
  await env.DB.prepare(
    `INSERT INTO admin_users (
       public_id, username, email, display_name, password_hash, password_salt,
       password_iterations, must_change_password, role, status
     ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, 'owner', 'active')`
  ).bind(publicId, username, email, displayName, digest, salt, iterations).run();

  const admin = await adminByLogin(env, username);
  if (!admin) throw new Error("Admin bootstrap failed");
  const token = await createSession(env, admin);
  return json({ ok: true, token, admin: publicAdmin(admin) }, 201);
}

export async function loginAdmin(request: Request, env: Env) {
  const body = await bodyJson(request);
  const login = typeof body.login === "string" ? body.login.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!login || !password) return json({ error: "Login and password are required" }, 400);

  const admin = await adminByLogin(env, login);
  if (!admin || admin.status !== "active") return json({ error: "Invalid login or password" }, 401);
  if (admin.password_iterations > CLOUDFLARE_PBKDF2_MAX_ITERATIONS) {
    return json({ error: "This admin password needs a security migration. Use Forgot password to set a new password." }, 409);
  }
  const digest = await passwordDigest(password, admin.password_salt, admin.password_iterations);
  if (!constantTimeEqual(digest, admin.password_hash)) return json({ error: "Invalid login or password" }, 401);

  const token = await createSession(env, admin);
  await env.DB.prepare(
    "UPDATE admin_users SET last_signed_in_at = CURRENT_TIMESTAMP WHERE id = ?"
  ).bind(admin.id).run();
  return json({ ok: true, token, admin: publicAdmin(admin) });
}

export async function logoutAdmin(request: Request, env: Env) {
  const authorization = request.headers.get("Authorization") ?? "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match?.[1]) return json({ ok: true });
  const tokenHash = await sha256Hex(match[1]);
  await env.DB.prepare(
    "UPDATE admin_sessions SET revoked_at = CURRENT_TIMESTAMP WHERE token_hash = ?"
  ).bind(tokenHash).run();
  return json({ ok: true });
}

export async function getAdminMe(request: Request, env: Env) {
  const admin = await authenticateAdmin(request, env);
  if (!admin) return json({ error: "Admin authentication required" }, 401);
  return json({ ok: true, admin });
}

export async function changeAdminPassword(request: Request, env: Env) {
  const auth = await requireAdmin(request, env);
  if (!auth.admin) return auth.response!;
  const body = await bodyJson(request);
  const password = cleanPassword(body.password);
  if (!password) return json({ error: "Password must be at least 10 characters" }, 400);

  const salt = randomToken(24);
  const iterations = CLOUDFLARE_PBKDF2_ITERATIONS;
  const digest = await passwordDigest(password, salt, iterations);
  await env.DB.prepare(
    `UPDATE admin_users SET password_hash = ?, password_salt = ?, password_iterations = ?,
       must_change_password = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
  ).bind(digest, salt, iterations, auth.admin.id).run();
  await env.DB.prepare(
    "UPDATE admin_sessions SET revoked_at = CURRENT_TIMESTAMP WHERE admin_user_id = ?"
  ).bind(auth.admin.id).run();
  return json({ ok: true, signInAgain: true });
}