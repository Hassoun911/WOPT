import { processEmailOutbox } from "./emailDelivery";
import type { Env } from "./types";

type AdminResetRow = {
  id: number;
  admin_user_id: number;
  email: string;
  token_hash: string;
  expires_at: string;
};

const CLOUDFLARE_PBKDF2_ITERATIONS = 100_000;

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

function publicAppUrl(env: Env) {
  return (env.PUBLIC_APP_URL || "https://hassoun911.github.io/Hassoun/").replace(/\/$/, "");
}

async function sendResetEmailDirect(env: Env, recipient: string, resetUrl: string) {
  if (!env.RESEND_API_KEY || !env.EMAIL_FROM) return false;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: env.EMAIL_FROM,
      to: [recipient],
      subject: "Reset your Hassoun admin password",
      text: `Reset your Hassoun admin password. This secure link expires in one hour: ${resetUrl}`,
      html: `<!doctype html><html><body style="font-family:Arial,Helvetica,sans-serif;color:#173f35;background:#f6f0e5;padding:24px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#fffdf8;border:1px solid #e3dac9;border-radius:20px"><tr><td style="padding:28px"><p style="margin:0 0 8px;font-size:12px;font-weight:800;letter-spacing:1.5px;color:#9a8a70">HASSOUN ADMIN</p><h1 style="margin:0 0 12px;font-size:28px;color:#153f35">Reset your admin password</h1><p style="margin:0 0 22px;font-size:15px;line-height:1.6;color:#6f746c">Use the secure link below to create a new admin password.</p><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center"><a href="${resetUrl.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;")}" style="display:inline-block;background:#0b5b47;color:#fff;text-decoration:none;font-size:15px;font-weight:800;padding:14px 20px;border-radius:12px">Reset password</a></td></tr></table><p style="margin:20px 0 0;font-size:12px;line-height:1.5;color:#8a8377">This link expires in one hour.</p></td></tr></table></td></tr></table></body></html>`
    })
  });

  if (!response.ok) {
    console.error("Direct admin reset email failed", {
      status: response.status,
      body: await response.text().catch(() => "")
    });
    return false;
  }

  return true;
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
    `SELECT id, email FROM admin_users
     WHERE LOWER(TRIM(email)) = LOWER(TRIM(?)) AND status = 'active'
     LIMIT 1`
  ).bind(email).first<{ id: number; email: string }>();
  if (!admin) {
    console.warn("Admin password reset requested for non-matching active admin email");
    return accepted;
  }

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

  const resetUrl = `${publicAppUrl(env)}/admin/reset/?token=${encodeURIComponent(token)}`;
  const recipient = admin.email.trim();

  try {
    const directSent = await sendResetEmailDirect(env, recipient, resetUrl);
    if (directSent) return accepted;
  } catch (error) {
    console.error("Direct admin password reset delivery threw", { adminUserId: admin.id, error });
  }

  await env.DB.prepare(
    `INSERT INTO email_outbox (
       recipient_email, locale, kind, template_key, template_data_json, idempotency_key
     ) VALUES (?, 'en', 'admin_password_reset', 'admin_password_reset', ?, ?)`
  ).bind(
    recipient,
    JSON.stringify({ resetUrl }),
    `admin-reset:${admin.id}:${tokenHash}`
  ).run();

  try {
    const delivery = await processEmailOutbox(env);
    if (!delivery.configured) {
      console.error("Admin password reset email provider is not configured", {
        adminUserId: admin.id
      });
    }
  } catch (error) {
    console.error("Admin password reset fallback delivery failed", {
      adminUserId: admin.id,
      error
    });
  }

  return accepted;
}

export async function resetAdminPassword(request: Request, env: Env) {
  const body = await bodyJson(request);
  const token = typeof body.token === "string" ? body.token : "";
  const password = validPassword(body.password);
  if (!token || !password) return json({ error: "A valid reset token and password are required" }, 400);

  const tokenHash = await sha256Hex(token);
  const reset = await env.DB.prepare(
    `SELECT r.id, r.admin_user_id, a.email, r.token_hash, r.expires_at
     FROM admin_password_resets r
     JOIN admin_users a ON a.id = r.admin_user_id
     WHERE r.token_hash = ? AND r.consumed_at IS NULL AND r.expires_at > CURRENT_TIMESTAMP
       AND a.status = 'active'
     LIMIT 1`
  ).bind(tokenHash).first<AdminResetRow>();
  if (!reset) return json({ error: "This password reset link is invalid or expired" }, 403);

  const salt = randomToken(24);
  const iterations = CLOUDFLARE_PBKDF2_ITERATIONS;
  const digest = await passwordDigest(password, salt, iterations);

  const consumed = await env.DB.prepare(
    `UPDATE admin_password_resets
     SET consumed_at = CURRENT_TIMESTAMP
     WHERE id = ? AND consumed_at IS NULL AND expires_at > CURRENT_TIMESTAMP`
  ).bind(reset.id).run();
  if ((consumed.meta.changes ?? 0) !== 1) {
    return json({ error: "This password reset link is invalid or expired" }, 403);
  }

  try {
    const changed = await env.DB.prepare(
      `UPDATE admin_users SET password_hash = ?, password_salt = ?, password_iterations = ?,
       must_change_password = 0, updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND status = 'active'`
    ).bind(digest, salt, iterations, reset.admin_user_id).run();
    if ((changed.meta.changes ?? 0) !== 1) throw new Error("Admin account is no longer active");

    await env.DB.prepare(
      "UPDATE admin_sessions SET revoked_at = CURRENT_TIMESTAMP WHERE admin_user_id = ? AND revoked_at IS NULL"
    ).bind(reset.admin_user_id).run();
  } catch (error) {
    console.error("Admin password reset write failed after token consumption", {
      resetId: reset.id,
      adminUserId: reset.admin_user_id,
      error
    });
    return json({ error: "Password reset could not be completed. Please request a new reset link and try again." }, 500);
  }

  return json({ ok: true, signInAgain: true });
}
