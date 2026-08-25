import { requireAdmin } from "./adminAuth";
import type { Env } from "./types";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

export async function getAdminDashboard(request: Request, env: Env) {
  const auth = await requireAdmin(request, env);
  if (!auth.admin) return auth.response!;

  const [subscribers, devices, outbox, pushCampaigns, emails, supportContacts] = await Promise.all([
    env.DB.prepare(
      `SELECT COUNT(*) AS total,
              SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) AS active,
              SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending,
              SUM(CASE WHEN status = 'unsubscribed' THEN 1 ELSE 0 END) AS unsubscribed
       FROM email_subscribers`
    ).first<Record<string, number>>(),
    env.DB.prepare(
      `SELECT COUNT(*) AS total,
              SUM(CASE WHEN enabled = 1 THEN 1 ELSE 0 END) AS active,
              SUM(CASE WHEN enabled = 1 AND platform = 'android' THEN 1 ELSE 0 END) AS android,
              SUM(CASE WHEN enabled = 1 AND platform = 'ios' THEN 1 ELSE 0 END) AS ios,
              SUM(CASE WHEN enabled = 1 AND platform = 'web' THEN 1 ELSE 0 END) AS web
       FROM subscriptions`
    ).first<Record<string, number>>(),
    env.DB.prepare(
      `SELECT COUNT(*) AS pending FROM email_outbox WHERE status = 'pending'`
    ).first<Record<string, number>>(),
    env.DB.prepare(
      `SELECT COUNT(*) AS total,
              SUM(CASE WHEN status = 'scheduled' THEN 1 ELSE 0 END) AS scheduled,
              SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) AS sent
       FROM push_campaigns`
    ).first<Record<string, number>>(),
    env.DB.prepare(
      `SELECT COUNT(*) AS total,
              SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) AS sent,
              SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failed
       FROM email_deliveries`
    ).first<Record<string, number>>(),
    env.DB.prepare(
      `SELECT COUNT(*) AS total,
              SUM(CASE WHEN status = 'new' THEN 1 ELSE 0 END) AS new,
              SUM(CASE WHEN email_status = 'sent' THEN 1 ELSE 0 END) AS emailed,
              SUM(CASE WHEN email_status = 'failed' THEN 1 ELSE 0 END) AS email_failed
       FROM support_contacts`
    ).first<Record<string, number>>()
  ]);

  return json({
    ok: true,
    admin: auth.admin,
    subscribers: subscribers ?? {},
    devices: devices ?? {},
    emailOutbox: outbox ?? {},
    pushCampaigns: pushCampaigns ?? {},
    emailDeliveries: emails ?? {},
    supportContacts: supportContacts ?? {}
  });
}

export async function listAdminSubscribers(request: Request, env: Env, url: URL) {
  const auth = await requireAdmin(request, env);
  if (!auth.admin) return auth.response!;

  const query = (url.searchParams.get("q") ?? "").trim().slice(0, 100);
  const status = (url.searchParams.get("status") ?? "").trim();
  const limit = Math.min(200, Math.max(1, Number(url.searchParams.get("limit") ?? 100) || 100));
  const search = `%${query.replace(/[%_]/g, "")}%`;

  const { results } = await env.DB.prepare(
    `SELECT s.public_id, s.email, s.display_name, s.locale, s.status,
            s.latitude, s.longitude, s.timezone, s.country_code, s.country_name,
            s.region, s.city, s.calculation_method, s.madhab, s.verified_at,
            s.created_at, s.updated_at,
            p.prayer_alerts, p.daily_prayer_schedule, p.religious_occasions,
            p.daily_content, p.announcements, p.community_events, p.marketing,
            (SELECT COUNT(*) FROM subscriptions d WHERE d.subscriber_id = s.id AND d.enabled = 1) AS linked_devices
     FROM email_subscribers s
     LEFT JOIN subscriber_email_preferences p ON p.subscriber_id = s.id
     WHERE (? = '' OR s.status = ?)
       AND (? = '' OR s.email LIKE ? COLLATE NOCASE OR COALESCE(s.city, '') LIKE ? COLLATE NOCASE
            OR COALESCE(s.country_name, '') LIKE ? COLLATE NOCASE)
     ORDER BY s.id DESC
     LIMIT ?`
  ).bind(status, status, query, search, search, search, limit).all<Record<string, unknown>>();

  return json({ ok: true, subscribers: results });
}

export async function listAdminSupportContacts(request: Request, env: Env, url: URL) {
  const auth = await requireAdmin(request, env);
  if (!auth.admin) return auth.response!;

  const query = (url.searchParams.get("q") ?? "").trim().slice(0, 100);
  const status = (url.searchParams.get("status") ?? "").trim().slice(0, 30);
  const platform = (url.searchParams.get("platform") ?? "").trim().slice(0, 30);
  const limit = Math.min(200, Math.max(1, Number(url.searchParams.get("limit") ?? 100) || 100));
  const search = `%${query.replace(/[%_]/g, "")}%`;

  const { results } = await env.DB.prepare(
    `SELECT public_id, name, email, subject, message, locale, platform, app_version,
            source, status, email_recipient, email_status, email_provider_id,
            email_error, created_at, updated_at
     FROM support_contacts
     WHERE (? = '' OR status = ?)
       AND (? = '' OR platform = ?)
       AND (? = '' OR email LIKE ? COLLATE NOCASE OR COALESCE(name, '') LIKE ? COLLATE NOCASE
            OR subject LIKE ? COLLATE NOCASE OR message LIKE ? COLLATE NOCASE)
     ORDER BY id DESC
     LIMIT ?`
  ).bind(status, status, platform, platform, query, search, search, search, search, limit).all<Record<string, unknown>>();

  return json({ ok: true, contacts: results });
}
