import { requireAdmin } from "./adminAuth";
import type { Env } from "./types";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}

async function bodyJson(request: Request) {
  const length = Number(request.headers.get("Content-Length") ?? 0);
  if (length > 131_072) throw new Error("Request body is too large");
  return (await request.json()) as Record<string, unknown>;
}

function flag(value: unknown, fallback = 0) {
  if (value === true || value === 1 || value === "1") return 1;
  if (value === false || value === 0 || value === "0") return 0;
  return fallback;
}

function clean(value: unknown, max = 500) {
  if (typeof value !== "string") return null;
  return value.trim().slice(0, max) || null;
}

export async function listAdminEmailTemplates(request: Request, env: Env) {
  const auth = await requireAdmin(request, env);
  if (!auth.admin) return auth.response!;

  const { results: profiles } = await env.DB.prepare(
    `SELECT template_key, name, category, enabled,
            include_islamic_occasion, include_daily_hadith, include_daily_surah,
            include_occasion_countdown, include_motivation, include_sadaqah_jariyah,
            include_sponsor, sponsor_name, sponsor_url, sponsor_message_en,
            sponsor_message_ar, updated_at
     FROM email_template_profiles
     ORDER BY CASE category
       WHEN 'prayer' THEN 1 WHEN 'system' THEN 2 WHEN 'religious_occasion' THEN 3
       WHEN 'daily_content' THEN 4 WHEN 'announcement' THEN 5 WHEN 'community_event' THEN 6
       WHEN 'marketing' THEN 7 ELSE 8 END, name`
  ).all<Record<string, unknown>>();

  const { results: customTemplates } = await env.DB.prepare(
    `SELECT template_key, name, category, subject_en, subject_ar, enabled, updated_at
     FROM email_templates ORDER BY id DESC LIMIT 200`
  ).all<Record<string, unknown>>();

  const { results: content } = await env.DB.prepare(
    `SELECT id, content_type, title_en, title_ar, body_en, body_ar, source_ref, enabled, sort_order
     FROM email_content_library ORDER BY content_type, sort_order, id`
  ).all<Record<string, unknown>>();

  return json({ ok: true, profiles, customTemplates, content });
}

export async function updateAdminEmailTemplate(request: Request, env: Env, templateKey: string) {
  const auth = await requireAdmin(request, env);
  if (!auth.admin) return auth.response!;
  const body = await bodyJson(request);

  const existing = await env.DB.prepare(
    `SELECT template_key, enabled, include_islamic_occasion, include_daily_hadith,
            include_daily_surah, include_occasion_countdown, include_motivation,
            include_sadaqah_jariyah, include_sponsor
     FROM email_template_profiles WHERE template_key = ? LIMIT 1`
  ).bind(templateKey).first<Record<string, unknown>>();
  if (!existing) return json({ error: "Template profile not found" }, 404);

  await env.DB.prepare(
    `UPDATE email_template_profiles SET
       enabled = ?, include_islamic_occasion = ?, include_daily_hadith = ?,
       include_daily_surah = ?, include_occasion_countdown = ?, include_motivation = ?,
       include_sadaqah_jariyah = ?, include_sponsor = ?, sponsor_name = ?, sponsor_url = ?,
       sponsor_message_en = ?, sponsor_message_ar = ?, updated_at = CURRENT_TIMESTAMP
     WHERE template_key = ?`
  ).bind(
    flag(body.enabled, Number(existing.enabled ?? 1)),
    flag(body.includeIslamicOccasion, Number(existing.include_islamic_occasion ?? 1)),
    flag(body.includeDailyHadith, Number(existing.include_daily_hadith ?? 1)),
    flag(body.includeDailySurah, Number(existing.include_daily_surah ?? 1)),
    flag(body.includeOccasionCountdown, Number(existing.include_occasion_countdown ?? 1)),
    flag(body.includeMotivation, Number(existing.include_motivation ?? 1)),
    flag(body.includeSadaqahJariyah, Number(existing.include_sadaqah_jariyah ?? 1)),
    flag(body.includeSponsor, Number(existing.include_sponsor ?? 1)),
    clean(body.sponsorName, 120), clean(body.sponsorUrl, 500),
    clean(body.sponsorMessageEn, 1000), clean(body.sponsorMessageAr, 1000),
    templateKey
  ).run();

  await env.DB.prepare(
    `INSERT INTO admin_activity_log (admin_user_id, action, entity_type, entity_id, details_json)
     VALUES (?, 'email_template_profile_updated', 'email_template_profile', ?, ?)`
  ).bind(auth.admin.id, templateKey, JSON.stringify({ fields: Object.keys(body) })).run();

  return json({ ok: true });
}

export async function updateAdminEmailContent(request: Request, env: Env, id: number) {
  const auth = await requireAdmin(request, env);
  if (!auth.admin) return auth.response!;
  const body = await bodyJson(request);
  const existing = await env.DB.prepare("SELECT id, enabled FROM email_content_library WHERE id = ? LIMIT 1").bind(id).first<{ id: number; enabled: number }>();
  if (!existing) return json({ error: "Content item not found" }, 404);

  await env.DB.prepare(
    `UPDATE email_content_library SET
       title_en = COALESCE(?, title_en), title_ar = COALESCE(?, title_ar),
       body_en = COALESCE(?, body_en), body_ar = COALESCE(?, body_ar),
       source_ref = COALESCE(?, source_ref), enabled = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`
  ).bind(
    clean(body.titleEn, 180), clean(body.titleAr, 180), clean(body.bodyEn, 3000),
    clean(body.bodyAr, 3000), clean(body.sourceRef, 300), flag(body.enabled, existing.enabled), id
  ).run();
  return json({ ok: true });
}
