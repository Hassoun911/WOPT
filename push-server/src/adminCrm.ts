import { requireAdmin } from "./adminAuth";
import type { Env } from "./types";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

async function bodyJson(request: Request) {
  const length = Number(request.headers.get("Content-Length") ?? 0);
  if (length > 64_000) throw new Error("Request body is too large");
  return (await request.json()) as Record<string, unknown>;
}

async function audit(env: Env, adminId: number, action: string, entityType: string, entityId: string | null, summary: string, details?: unknown) {
  await env.DB.prepare(
    `INSERT INTO admin_audit_log (admin_user_id, action, entity_type, entity_id, summary, details_json)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).bind(adminId, action, entityType, entityId, summary, details === undefined ? null : JSON.stringify(details)).run();
}

function ownerOnly(role: string) {
  return role !== "owner" ? json({ error: "Owner access required" }, 403) : null;
}

function cleanString(value: unknown, max = 5000) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export async function getAdminCrmOverview(request: Request, env: Env) {
  const auth = await requireAdmin(request, env);
  if (!auth.admin) return auth.response!;

  const [content, admins, auditCount, versions] = await Promise.all([
    env.DB.prepare(
      `SELECT COUNT(*) AS total,
              SUM(CASE WHEN status = 'published' THEN 1 ELSE 0 END) AS published,
              SUM(CASE WHEN featured = 1 AND status = 'published' THEN 1 ELSE 0 END) AS featured
       FROM app_content`
    ).first<Record<string, number>>(),
    env.DB.prepare(
      `SELECT COUNT(*) AS total,
              SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) AS active
       FROM admin_users`
    ).first<Record<string, number>>(),
    env.DB.prepare("SELECT COUNT(*) AS total FROM admin_audit_log").first<Record<string, number>>(),
    env.DB.prepare(
      `SELECT setting_key, value_json FROM app_settings
       WHERE setting_key IN ('minimum_android_version','minimum_ios_version','maintenance_mode','force_update_android','force_update_ios')`
    ).all<Record<string, string>>()
  ]);

  const release: Record<string, unknown> = {};
  for (const row of versions.results) {
    try { release[row.setting_key] = JSON.parse(row.value_json); } catch { release[row.setting_key] = row.value_json; }
  }

  return json({ ok: true, content: content ?? {}, admins: admins ?? {}, audit: auditCount ?? {}, release });
}

export async function listAppSettings(request: Request, env: Env) {
  const auth = await requireAdmin(request, env);
  if (!auth.admin) return auth.response!;
  const { results } = await env.DB.prepare(
    `SELECT setting_key, value_json, description, updated_at FROM app_settings ORDER BY setting_key`
  ).all<Record<string, string>>();
  const settings = results.map((row) => {
    let value: unknown = row.value_json;
    try { value = JSON.parse(row.value_json); } catch {}
    return { key: row.setting_key, value, description: row.description, updatedAt: row.updated_at };
  });
  return json({ ok: true, settings });
}

export async function updateAppSetting(request: Request, env: Env, key: string) {
  const auth = await requireAdmin(request, env);
  if (!auth.admin) return auth.response!;
  const body = await bodyJson(request);
  if (!("value" in body)) return json({ error: "value is required" }, 400);
  const exists = await env.DB.prepare("SELECT setting_key FROM app_settings WHERE setting_key = ?").bind(key).first();
  if (!exists) return json({ error: "Unknown setting" }, 404);
  const valueJson = JSON.stringify(body.value);
  if (valueJson.length > 16_000) return json({ error: "Setting value is too large" }, 400);
  await env.DB.prepare(
    `UPDATE app_settings SET value_json = ?, updated_by_admin_id = ?, updated_at = CURRENT_TIMESTAMP WHERE setting_key = ?`
  ).bind(valueJson, auth.admin.id, key).run();
  await audit(env, auth.admin.id, "update", "app_setting", key, `Updated app setting ${key}`, { value: body.value });
  return json({ ok: true, key, value: body.value });
}

export async function listAppContent(request: Request, env: Env, url: URL) {
  const auth = await requireAdmin(request, env);
  if (!auth.admin) return auth.response!;
  const type = cleanString(url.searchParams.get("type"), 30);
  const status = cleanString(url.searchParams.get("status"), 20);
  const q = cleanString(url.searchParams.get("q"), 100);
  const search = `%${q.replace(/[%_]/g, "")}%`;
  const { results } = await env.DB.prepare(
    `SELECT public_id, content_type, title_en, title_ar, body_en, body_ar, source_text,
            metadata_json, status, featured, starts_at, ends_at, created_at, updated_at
     FROM app_content
     WHERE (? = '' OR content_type = ?)
       AND (? = '' OR status = ?)
       AND (? = '' OR title_en LIKE ? COLLATE NOCASE OR COALESCE(title_ar,'') LIKE ? OR COALESCE(body_en,'') LIKE ? COLLATE NOCASE)
     ORDER BY featured DESC, updated_at DESC
     LIMIT 300`
  ).bind(type, type, status, status, q, search, search, search).all<Record<string, unknown>>();
  return json({ ok: true, content: results });
}

export async function createAppContent(request: Request, env: Env) {
  const auth = await requireAdmin(request, env);
  if (!auth.admin) return auth.response!;
  const body = await bodyJson(request);
  const contentType = cleanString(body.contentType, 30);
  const allowed = ["ayah", "hadith", "dua", "announcement", "event", "quran_source", "reciter", "quiz"];
  if (!allowed.includes(contentType)) return json({ error: "Invalid content type" }, 400);
  const titleEn = cleanString(body.titleEn, 200);
  if (!titleEn) return json({ error: "English title is required" }, 400);
  const status = ["draft", "published", "archived"].includes(String(body.status)) ? String(body.status) : "draft";
  const publicId = crypto.randomUUID();
  await env.DB.prepare(
    `INSERT INTO app_content (
       public_id, content_type, title_en, title_ar, body_en, body_ar, source_text,
       metadata_json, status, featured, starts_at, ends_at, created_by_admin_id, updated_by_admin_id
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    publicId,
    contentType,
    titleEn,
    cleanString(body.titleAr, 200) || null,
    cleanString(body.bodyEn, 8000) || null,
    cleanString(body.bodyAr, 8000) || null,
    cleanString(body.sourceText, 1000) || null,
    body.metadata === undefined ? null : JSON.stringify(body.metadata),
    status,
    body.featured === true ? 1 : 0,
    cleanString(body.startsAt, 40) || null,
    cleanString(body.endsAt, 40) || null,
    auth.admin.id,
    auth.admin.id
  ).run();
  await audit(env, auth.admin.id, "create", "app_content", publicId, `Created ${contentType}: ${titleEn}`);
  return json({ ok: true, publicId }, 201);
}

export async function updateAppContent(request: Request, env: Env, publicId: string) {
  const auth = await requireAdmin(request, env);
  if (!auth.admin) return auth.response!;
  const current = await env.DB.prepare("SELECT * FROM app_content WHERE public_id = ?").bind(publicId).first<Record<string, unknown>>();
  if (!current) return json({ error: "Content not found" }, 404);
  const body = await bodyJson(request);
  const titleEn = "titleEn" in body ? cleanString(body.titleEn, 200) : String(current.title_en ?? "");
  const status = "status" in body && ["draft", "published", "archived"].includes(String(body.status)) ? String(body.status) : String(current.status);
  await env.DB.prepare(
    `UPDATE app_content SET
       title_en = ?, title_ar = ?, body_en = ?, body_ar = ?, source_text = ?, metadata_json = ?,
       status = ?, featured = ?, starts_at = ?, ends_at = ?, updated_by_admin_id = ?, updated_at = CURRENT_TIMESTAMP
     WHERE public_id = ?`
  ).bind(
    titleEn,
    "titleAr" in body ? cleanString(body.titleAr, 200) || null : current.title_ar,
    "bodyEn" in body ? cleanString(body.bodyEn, 8000) || null : current.body_en,
    "bodyAr" in body ? cleanString(body.bodyAr, 8000) || null : current.body_ar,
    "sourceText" in body ? cleanString(body.sourceText, 1000) || null : current.source_text,
    "metadata" in body ? JSON.stringify(body.metadata) : current.metadata_json,
    status,
    "featured" in body ? (body.featured === true ? 1 : 0) : current.featured,
    "startsAt" in body ? cleanString(body.startsAt, 40) || null : current.starts_at,
    "endsAt" in body ? cleanString(body.endsAt, 40) || null : current.ends_at,
    auth.admin.id,
    publicId
  ).run();
  await audit(env, auth.admin.id, "update", "app_content", publicId, `Updated content: ${titleEn}`);
  return json({ ok: true });
}

export async function listAdminTeam(request: Request, env: Env) {
  const auth = await requireAdmin(request, env);
  if (!auth.admin) return auth.response!;
  if (ownerOnly(auth.admin.role)) return ownerOnly(auth.admin.role)!;
  const { results } = await env.DB.prepare(
    `SELECT public_id, username, email, display_name, role, status, must_change_password, created_at, updated_at, last_signed_in_at
     FROM admin_users ORDER BY CASE role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END, username`
  ).all<Record<string, unknown>>();
  return json({ ok: true, admins: results });
}

export async function updateAdminTeamMember(request: Request, env: Env, publicId: string) {
  const auth = await requireAdmin(request, env);
  if (!auth.admin) return auth.response!;
  const denied = ownerOnly(auth.admin.role);
  if (denied) return denied;
  if (publicId === auth.admin.public_id) return json({ error: "You cannot change your own role or status here" }, 400);
  const body = await bodyJson(request);
  const member = await env.DB.prepare("SELECT id, username, role, status FROM admin_users WHERE public_id = ?").bind(publicId).first<Record<string, unknown>>();
  if (!member) return json({ error: "Admin not found" }, 404);
  if (member.role === "owner") return json({ error: "The owner account cannot be changed here" }, 400);
  const role = ["admin", "editor"].includes(String(body.role)) ? String(body.role) : String(member.role);
  const status = ["active", "disabled"].includes(String(body.status)) ? String(body.status) : String(member.status);
  await env.DB.prepare("UPDATE admin_users SET role = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE public_id = ?")
    .bind(role, status, publicId).run();
  if (status === "disabled") {
    await env.DB.prepare("UPDATE admin_sessions SET revoked_at = CURRENT_TIMESTAMP WHERE admin_user_id = ? AND revoked_at IS NULL")
      .bind(member.id).run();
  }
  await audit(env, auth.admin.id, "update", "admin_user", publicId, `Updated admin ${member.username}`, { role, status });
  return json({ ok: true });
}

export async function updateSubscriberStatus(request: Request, env: Env, publicId: string) {
  const auth = await requireAdmin(request, env);
  if (!auth.admin) return auth.response!;
  const body = await bodyJson(request);
  const status = String(body.status ?? "");
  if (!["pending", "active", "unsubscribed", "bounced", "disabled"].includes(status)) return json({ error: "Invalid subscriber status" }, 400);
  const subscriber = await env.DB.prepare("SELECT id, email FROM email_subscribers WHERE public_id = ?").bind(publicId).first<{ id: number; email: string }>();
  if (!subscriber) return json({ error: "Subscriber not found" }, 404);
  await env.DB.prepare("UPDATE email_subscribers SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE public_id = ?").bind(status, publicId).run();
  if (status === "disabled" || status === "unsubscribed") {
    await env.DB.prepare("UPDATE subscriptions SET enabled = 0, updated_at = CURRENT_TIMESTAMP WHERE subscriber_id = ?").bind(subscriber.id).run();
  }
  await audit(env, auth.admin.id, "update", "subscriber", publicId, `Changed ${subscriber.email} status to ${status}`);
  return json({ ok: true });
}

export async function listAuditLog(request: Request, env: Env, url: URL) {
  const auth = await requireAdmin(request, env);
  if (!auth.admin) return auth.response!;
  const limit = Math.min(300, Math.max(1, Number(url.searchParams.get("limit") ?? 100) || 100));
  const { results } = await env.DB.prepare(
    `SELECT l.id, l.action, l.entity_type, l.entity_id, l.summary, l.details_json, l.created_at,
            a.username, a.display_name
     FROM admin_audit_log l
     LEFT JOIN admin_users a ON a.id = l.admin_user_id
     ORDER BY l.id DESC LIMIT ?`
  ).bind(limit).all<Record<string, unknown>>();
  return json({ ok: true, entries: results });
}
