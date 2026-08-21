import { requireAdmin, type AuthenticatedAdmin } from "./adminAuth";
import type { Env, PrayerFile, PrayerKey } from "./types";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

async function bodyJson(request: Request, maxBytes = 64_000) {
  const length = Number(request.headers.get("Content-Length") ?? 0);
  if (length > maxBytes) throw new Error("Request body is too large");
  return (await request.json()) as Record<string, unknown>;
}

function parseJson(value: string | null | undefined, fallback: unknown = null) {
  if (!value) return fallback;
  try { return JSON.parse(value) as unknown; } catch { return fallback; }
}

function cleanText(value: unknown, max = 500) {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text ? text.slice(0, max) : null;
}

function isDateKey(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isPrayer(value: unknown): value is PrayerKey {
  return value === "fajr" || value === "dhuhr" || value === "asr" || value === "maghrib" || value === "isha";
}

function isPrayerTime(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const match = value.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return false;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  return hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59;
}

function canManageSystem(admin: AuthenticatedAdmin) {
  return admin.role === "owner" || admin.role === "admin";
}

async function logActivity(
  env: Env,
  admin: AuthenticatedAdmin,
  action: string,
  entityType: string,
  entityId?: string | null,
  details?: unknown
) {
  await env.DB.prepare(
    `INSERT INTO admin_activity_log (admin_user_id, action, entity_type, entity_id, details_json)
     VALUES (?, ?, ?, ?, ?)`
  ).bind(admin.id, action, entityType, entityId ?? null, details === undefined ? null : JSON.stringify(details)).run();
}

type SettingRow = {
  setting_key: string;
  group_name: string;
  label: string;
  value_json: string;
  is_public: number;
  description: string | null;
  updated_at: string;
};

type ContentRow = {
  public_id: string;
  content_key: string;
  content_type: string;
  locale: string;
  title: string | null;
  body: string | null;
  image_url: string | null;
  deep_link: string | null;
  payload_json: string | null;
  status: string;
  starts_at: string | null;
  ends_at: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

function publicContent(row: ContentRow) {
  return {
    publicId: row.public_id,
    key: row.content_key,
    type: row.content_type,
    locale: row.locale,
    title: row.title,
    body: row.body,
    imageUrl: row.image_url,
    deepLink: row.deep_link,
    payload: parseJson(row.payload_json, null),
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    sortOrder: row.sort_order
  };
}

export async function getPublicControlConfig(env: Env) {
  const [settingsResult, contentResult] = await Promise.all([
    env.DB.prepare(
      `SELECT setting_key, group_name, label, value_json, is_public, description, updated_at
       FROM app_settings WHERE is_public = 1 ORDER BY group_name, setting_key`
    ).all<SettingRow>(),
    env.DB.prepare(
      `SELECT public_id, content_key, content_type, locale, title, body, image_url, deep_link,
              payload_json, status, starts_at, ends_at, sort_order, created_at, updated_at
       FROM app_content
       WHERE status = 'published'
         AND (starts_at IS NULL OR starts_at <= CURRENT_TIMESTAMP)
         AND (ends_at IS NULL OR ends_at > CURRENT_TIMESTAMP)
       ORDER BY sort_order ASC, created_at DESC`
    ).all<ContentRow>()
  ]);

  const settings: Record<string, unknown> = {};
  for (const row of settingsResult.results ?? []) {
    settings[row.setting_key] = parseJson(row.value_json, {});
  }

  return {
    settings,
    content: (contentResult.results ?? []).map(publicContent),
    generatedAt: new Date().toISOString()
  };
}

export async function applyPrayerOverrides(env: Env, file: PrayerFile): Promise<PrayerFile> {
  const result = await env.DB.prepare(
    `SELECT date_key, prayer, time_value
     FROM prayer_time_overrides
     WHERE enabled = 1
       AND date_key >= date('now', '-2 days')
       AND date_key <= date('now', '+400 days')`
  ).all<{ date_key: string; prayer: PrayerKey; time_value: string }>();

  if (!(result.results?.length)) return file;

  const prayerTimes = { ...file.prayer_times };
  for (const override of result.results) {
    const current = prayerTimes[override.date_key];
    if (!current) continue;
    prayerTimes[override.date_key] = { ...current, [override.prayer]: override.time_value };
  }
  return { ...file, prayer_times: prayerTimes };
}

export async function getAdminControlOverview(request: Request, env: Env) {
  const auth = await requireAdmin(request, env);
  if (!auth.admin) return auth.response!;

  const [settings, content, overrides, tickets, releaseChecks, activity] = await Promise.all([
    env.DB.prepare(
      `SELECT setting_key, group_name, label, value_json, is_public, description, updated_at
       FROM app_settings ORDER BY group_name, setting_key`
    ).all<SettingRow>(),
    env.DB.prepare(
      `SELECT public_id, content_key, content_type, locale, title, body, image_url, deep_link,
              payload_json, status, starts_at, ends_at, sort_order, created_at, updated_at
       FROM app_content ORDER BY updated_at DESC LIMIT 100`
    ).all<ContentRow>(),
    env.DB.prepare(
      `SELECT date_key, prayer, time_value, reason, enabled, updated_at
       FROM prayer_time_overrides
       WHERE date_key >= date('now', '-7 days')
       ORDER BY date_key, prayer LIMIT 500`
    ).all(),
    env.DB.prepare(
      `SELECT status, COUNT(*) AS count FROM support_tickets GROUP BY status`
    ).all<{ status: string; count: number }>(),
    env.DB.prepare(
      `SELECT check_key, platform, label, status, details, evidence_url, updated_at
       FROM release_checks ORDER BY platform, check_key`
    ).all(),
    env.DB.prepare(
      `SELECT l.id, l.action, l.entity_type, l.entity_id, l.details_json, l.created_at,
              a.username, a.display_name
       FROM admin_activity_log l
       LEFT JOIN admin_users a ON a.id = l.admin_user_id
       ORDER BY l.id DESC LIMIT 80`
    ).all()
  ]);

  return json({
    ok: true,
    admin: auth.admin,
    settings: (settings.results ?? []).map((row) => ({
      key: row.setting_key,
      group: row.group_name,
      label: row.label,
      value: parseJson(row.value_json, {}),
      isPublic: row.is_public === 1,
      description: row.description,
      updatedAt: row.updated_at
    })),
    content: (content.results ?? []).map((row) => ({ ...publicContent(row), status: row.status, createdAt: row.created_at, updatedAt: row.updated_at })),
    prayerOverrides: overrides.results ?? [],
    supportSummary: tickets.results ?? [],
    releaseChecks: releaseChecks.results ?? [],
    activity: (activity.results ?? []).map((row: any) => ({ ...row, details: parseJson(row.details_json, null), details_json: undefined }))
  });
}

export async function saveAdminSetting(request: Request, env: Env) {
  const auth = await requireAdmin(request, env);
  if (!auth.admin) return auth.response!;
  const body = await bodyJson(request);
  const key = cleanText(body.key, 100);
  const group = cleanText(body.group, 50) ?? "general";
  const label = cleanText(body.label, 120) ?? key;
  const description = cleanText(body.description, 1000);
  if (!key || !/^[a-z0-9_.-]{2,100}$/i.test(key)) return json({ error: "Invalid setting key" }, 400);
  if (!("value" in body)) return json({ error: "Setting value is required" }, 400);

  const existing = await env.DB.prepare("SELECT group_name FROM app_settings WHERE setting_key = ?").bind(key).first<{ group_name: string }>();
  const targetGroup = existing?.group_name ?? group;
  if (targetGroup === "release" && !canManageSystem(auth.admin)) return json({ error: "Admin role required" }, 403);

  const valueJson = JSON.stringify(body.value);
  if (valueJson.length > 50_000) return json({ error: "Setting value is too large" }, 400);
  const isPublic = body.isPublic === false ? 0 : 1;

  await env.DB.prepare(
    `INSERT INTO app_settings (setting_key, group_name, label, value_json, is_public, description, updated_by_admin_id)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(setting_key) DO UPDATE SET
       group_name = excluded.group_name,
       label = excluded.label,
       value_json = excluded.value_json,
       is_public = excluded.is_public,
       description = excluded.description,
       updated_by_admin_id = excluded.updated_by_admin_id,
       updated_at = CURRENT_TIMESTAMP`
  ).bind(key, targetGroup, label, valueJson, isPublic, description, auth.admin.id).run();
  await logActivity(env, auth.admin, "setting.save", "app_setting", key, { group: targetGroup, isPublic: Boolean(isPublic) });
  return json({ ok: true, key });
}

export async function saveAdminContent(request: Request, env: Env) {
  const auth = await requireAdmin(request, env);
  if (!auth.admin) return auth.response!;
  const body = await bodyJson(request);

  const publicId = cleanText(body.publicId, 80) ?? crypto.randomUUID();
  const contentKey = cleanText(body.key, 120);
  const contentType = cleanText(body.type, 40) ?? "announcement";
  const locale = body.locale === "ar" || body.locale === "en" ? body.locale : "both";
  const status = body.status === "published" || body.status === "archived" ? body.status : "draft";
  if (!contentKey) return json({ error: "Content key is required" }, 400);

  const allowedTypes = new Set(["announcement", "banner", "daily_inspiration", "islamic_event", "help", "legal_notice", "custom"]);
  if (!allowedTypes.has(contentType)) return json({ error: "Invalid content type" }, 400);
  const payloadJson = body.payload === undefined || body.payload === null ? null : JSON.stringify(body.payload);

  await env.DB.prepare(
    `INSERT INTO app_content (
       public_id, content_key, content_type, locale, title, body, image_url, deep_link,
       payload_json, status, starts_at, ends_at, sort_order, created_by_admin_id, updated_by_admin_id
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(public_id) DO UPDATE SET
       content_key = excluded.content_key,
       content_type = excluded.content_type,
       locale = excluded.locale,
       title = excluded.title,
       body = excluded.body,
       image_url = excluded.image_url,
       deep_link = excluded.deep_link,
       payload_json = excluded.payload_json,
       status = excluded.status,
       starts_at = excluded.starts_at,
       ends_at = excluded.ends_at,
       sort_order = excluded.sort_order,
       updated_by_admin_id = excluded.updated_by_admin_id,
       updated_at = CURRENT_TIMESTAMP`
  ).bind(
    publicId,
    contentKey,
    contentType,
    locale,
    cleanText(body.title, 240),
    cleanText(body.body, 10_000),
    cleanText(body.imageUrl, 1000),
    cleanText(body.deepLink, 500),
    payloadJson,
    status,
    cleanText(body.startsAt, 80),
    cleanText(body.endsAt, 80),
    Number.isFinite(Number(body.sortOrder)) ? Math.trunc(Number(body.sortOrder)) : 0,
    auth.admin.id,
    auth.admin.id
  ).run();
  await logActivity(env, auth.admin, "content.save", "app_content", publicId, { key: contentKey, status });
  return json({ ok: true, publicId });
}

export async function deleteAdminContent(request: Request, env: Env, url: URL) {
  const auth = await requireAdmin(request, env);
  if (!auth.admin) return auth.response!;
  const publicId = cleanText(url.searchParams.get("publicId"), 80);
  if (!publicId) return json({ error: "publicId is required" }, 400);
  await env.DB.prepare("DELETE FROM app_content WHERE public_id = ?").bind(publicId).run();
  await logActivity(env, auth.admin, "content.delete", "app_content", publicId);
  return json({ ok: true });
}

export async function savePrayerOverride(request: Request, env: Env) {
  const auth = await requireAdmin(request, env);
  if (!auth.admin) return auth.response!;
  const body = await bodyJson(request);
  if (!isDateKey(body.dateKey) || !isPrayer(body.prayer) || !isPrayerTime(body.time)) {
    return json({ error: "dateKey, prayer and a valid 24-hour HH:MM time are required" }, 400);
  }
  const time = body.time.trim().padStart(5, "0");
  const enabled = body.enabled === false ? 0 : 1;
  await env.DB.prepare(
    `INSERT INTO prayer_time_overrides (date_key, prayer, time_value, reason, enabled, updated_by_admin_id)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(date_key, prayer) DO UPDATE SET
       time_value = excluded.time_value,
       reason = excluded.reason,
       enabled = excluded.enabled,
       updated_by_admin_id = excluded.updated_by_admin_id,
       updated_at = CURRENT_TIMESTAMP`
  ).bind(body.dateKey, body.prayer, time, cleanText(body.reason, 1000), enabled, auth.admin.id).run();
  await logActivity(env, auth.admin, "prayer.override.save", "prayer_time", `${body.dateKey}:${body.prayer}`, { time, enabled: Boolean(enabled) });
  return json({ ok: true, dateKey: body.dateKey, prayer: body.prayer, time });
}

export async function deletePrayerOverride(request: Request, env: Env, url: URL) {
  const auth = await requireAdmin(request, env);
  if (!auth.admin) return auth.response!;
  const dateKey = url.searchParams.get("dateKey");
  const prayer = url.searchParams.get("prayer");
  if (!isDateKey(dateKey) || !isPrayer(prayer)) return json({ error: "Valid dateKey and prayer are required" }, 400);
  await env.DB.prepare("DELETE FROM prayer_time_overrides WHERE date_key = ? AND prayer = ?").bind(dateKey, prayer).run();
  await logActivity(env, auth.admin, "prayer.override.delete", "prayer_time", `${dateKey}:${prayer}`);
  return json({ ok: true });
}

export async function listSupportTickets(request: Request, env: Env, url: URL) {
  const auth = await requireAdmin(request, env);
  if (!auth.admin) return auth.response!;
  const status = url.searchParams.get("status") ?? "";
  const q = (url.searchParams.get("q") ?? "").trim().slice(0, 120);
  const where: string[] = [];
  const binds: unknown[] = [];
  if (["open", "in_progress", "resolved", "closed"].includes(status)) { where.push("t.status = ?"); binds.push(status); }
  if (q) { where.push("(t.email LIKE ? OR t.name LIKE ? OR t.subject LIKE ? OR t.message LIKE ?)"); const like = `%${q}%`; binds.push(like, like, like, like); }
  const result = await env.DB.prepare(
    `SELECT t.public_id, t.name, t.email, t.subject, t.message, t.locale, t.platform, t.app_version,
            t.status, t.priority, t.internal_note, t.email_delivery_status, t.created_at, t.updated_at,
            a.username AS assigned_username, a.display_name AS assigned_name
     FROM support_tickets t
     LEFT JOIN admin_users a ON a.id = t.assigned_admin_id
     ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
     ORDER BY CASE t.priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END,
              t.created_at DESC
     LIMIT 250`
  ).bind(...binds).all();
  return json({ ok: true, tickets: result.results ?? [] });
}

export async function updateSupportTicket(request: Request, env: Env) {
  const auth = await requireAdmin(request, env);
  if (!auth.admin) return auth.response!;
  const body = await bodyJson(request);
  const publicId = cleanText(body.publicId, 80);
  const status = String(body.status ?? "");
  const priority = String(body.priority ?? "normal");
  if (!publicId) return json({ error: "publicId is required" }, 400);
  if (!["open", "in_progress", "resolved", "closed"].includes(status)) return json({ error: "Invalid status" }, 400);
  if (!["low", "normal", "high", "urgent"].includes(priority)) return json({ error: "Invalid priority" }, 400);
  const assignToMe = body.assignToMe === true;
  await env.DB.prepare(
    `UPDATE support_tickets
     SET status = ?, priority = ?, internal_note = ?,
         assigned_admin_id = CASE WHEN ? = 1 THEN ? ELSE assigned_admin_id END,
         resolved_at = CASE WHEN ? IN ('resolved', 'closed') THEN COALESCE(resolved_at, CURRENT_TIMESTAMP) ELSE NULL END,
         updated_at = CURRENT_TIMESTAMP
     WHERE public_id = ?`
  ).bind(status, priority, cleanText(body.internalNote, 5000), assignToMe ? 1 : 0, auth.admin.id, status, publicId).run();
  await logActivity(env, auth.admin, "support.update", "support_ticket", publicId, { status, priority, assignToMe });
  return json({ ok: true });
}

export async function listReleaseChecks(request: Request, env: Env) {
  const auth = await requireAdmin(request, env);
  if (!auth.admin) return auth.response!;
  const result = await env.DB.prepare(
    `SELECT check_key, platform, label, status, details, evidence_url, updated_at
     FROM release_checks ORDER BY platform, check_key`
  ).all();
  return json({ ok: true, checks: result.results ?? [] });
}

export async function updateReleaseCheck(request: Request, env: Env) {
  const auth = await requireAdmin(request, env);
  if (!auth.admin) return auth.response!;
  if (!canManageSystem(auth.admin)) return json({ error: "Admin role required" }, 403);
  const body = await bodyJson(request);
  const key = cleanText(body.key, 120);
  const status = String(body.status ?? "");
  if (!key || !["pending", "pass", "fail", "not_applicable"].includes(status)) return json({ error: "Valid key and status are required" }, 400);
  await env.DB.prepare(
    `UPDATE release_checks SET status = ?, details = ?, evidence_url = ?, updated_by_admin_id = ?, updated_at = CURRENT_TIMESTAMP
     WHERE check_key = ?`
  ).bind(status, cleanText(body.details, 4000), cleanText(body.evidenceUrl, 1000), auth.admin.id, key).run();
  await logActivity(env, auth.admin, "release.check.update", "release_check", key, { status });
  return json({ ok: true });
}
