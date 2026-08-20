import type { Env } from "./types";

// Password-reset flow is deployed from the protected working branch.
type AdminResetRow = {
  id: number;
  admin_user_id: number;
  email: string;
  token_hash: string;
  expires_at: string;
};

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

function randomToken(bytes = 36) {
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

function validEmail(value: unknown) {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254 ? email : null;
}

function validPassword(value: unknown) {
  return typeof value === "string" && value.length >= 10 && value.length <= 200 ? value : null;
}

function publicAppUrl() {
  return "https://admin.hassoun.app";
}

export async function requestAdminPasswordReset(request: Request, env: Env) {
  const body = await bodyJson(request);
  const email = validEmail(body.email);
  const accepted = json({
    ok: true,
    message: "If that email belongs to an active Hassoun admin, a reset link will be sent."
  });
  if (!email) return accepted;

  const admin = await env.DB.prepare(
    `SELECT id, email FROM admin_users WHERE email = ? COLLATE NOCASE AND status = 'active' LIMIT 1`
  ).bind(email).first<{ id: number; email: string }>();
  if (!admin) return accepted;

  const token = randomToken();
  const tokenHash = await sha256Hex(token);
  await env.DB.prepare(
    `UPDATE admin_password_resets SET consumed_at = CURRENT_TIMESTAMP
     WHERE admin_user_id = ? AND consumed_at IS NULL`
  ).bind(admin.id).run();

  await env.DB.prepare(
    `INSERT INTO admin_password_resets (admin_user_id, token_hash, expires_at)
     VALUES (?, ?, datetime('now', '+1 hour'))`
  ).bind(admin.id, tokenHash).run();

  const resetUrl = `${publicAppUrl()}/admin/reset/?token=${encodeURIComponent(token)}`;
  await env.DB.prepare(
    `INSERT INTO email_outbox (
       recipient_email, locale, kind, template_key, template_data_json, idempotency_key
     ) VALUES (?, 'en', 'admin_password_reset', 'admin_password_reset', ?, ?)`
  ).bind(
    admin.email,
    JSON.stringify({ resetUrl }),
    `admin-reset:${admin.id}:${tokenHash}`
  ).run();

  return accepted;
}

export async function resetAdminPassword(request: Request, env: Env) {
  try {
    const body = await bodyJson(request);
    const token = typeof body.token === "string" ? body.token.trim() : "";
    const password = validPassword(body.password);
    if (!token || !password) {
      return json({ error: "A valid reset token and password are required" }, 400);
    }

    const tokenHash = await sha256Hex(token);
    const reset = await env.DB.prepare(
      `SELECT r.id, r.admin_user_id, a.email, r.token_hash, r.expires_at
       FROM admin_password_resets r
       JOIN admin_users a ON a.id = r.admin_user_id
       WHERE r.token_hash = ? AND r.consumed_at IS NULL AND r.expires_at > CURRENT_TIMESTAMP
         AND a.status = 'active'
       LIMIT 1`
    ).bind(tokenHash).first<AdminResetRow>();
    if (!reset) {
      return json({ error: "This password reset link is invalid or expired. Request a new reset link and use the newest email." }, 403);
    }

    const salt = randomToken(24);
    const iterations = 100_000;
    let digest: string;
    try {
      digest = await passwordDigest(password, salt, iterations);
    } catch (error) {
      console.error("Admin reset password hashing failed", error);
      return json({ error: "Password security processing failed. Please try again." }, 500);
    }

    const userUpdate = await env.DB.prepare(
      `UPDATE admin_users
       SET password_hash = ?, password_salt = ?, password_iterations = ?,
           must_change_password = 0, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`
    ).bind(digest, salt, iterations, reset.admin_user_id).run();
    if (!userUpdate.success) {
      return json({ error: "Could not update the admin password." }, 500);
    }

    const resetUpdate = await env.DB.prepare(
      "UPDATE admin_password_resets SET consumed_at = CURRENT_TIMESTAMP WHERE id = ?"
    ).bind(reset.id).run();
    if (!resetUpdate.success) {
      return json({ error: "Password changed, but the reset token could not be finalized. Please sign in and change the password again." }, 500);
    }

    await env.DB.prepare(
      "UPDATE admin_sessions SET revoked_at = CURRENT_TIMESTAMP WHERE admin_user_id = ? AND revoked_at IS NULL"
    ).bind(reset.admin_user_id).run();

    return json({ ok: true, signInAgain: true });
  } catch (error) {
    console.error("Admin password reset failed", error);
    const message = error instanceof Error ? error.message : "Unknown reset failure";
    return json({ error: `Password reset failed: ${message}` }, 500);
  }
}
