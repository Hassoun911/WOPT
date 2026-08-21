import { requireAdmin } from "./adminAuth";
import type { Env } from "./types";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}

async function bodyJson(request: Request) {
  const length = Number(request.headers.get("Content-Length") ?? 0);
  if (length > 64_000) throw new Error("Request body is too large");
  return (await request.json()) as Record<string, unknown>;
}

async function requireOperator(request: Request, env: Env) {
  const auth = await requireAdmin(request, env);
  if (!auth.admin) return auth;
  if (auth.admin.role !== "owner" && auth.admin.role !== "admin") {
    return { admin: null, response: json({ error: "Owner or admin access required" }, 403) };
  }
  return auth;
}

async function audit(env: Env, adminId: number, action: string, entityType: string, entityId: string | null, summary: string, details?: unknown) {
  await env.DB.prepare(
    `INSERT INTO admin_audit_log (admin_user_id, action, entity_type, entity_id, summary, details_json)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).bind(adminId, action, entityType, entityId, summary, details === undefined ? null : JSON.stringify(details)).run();
}

function bool(value: unknown) { return value === true || value === 1 || value === "1" ? 1 : 0; }
function text(value: unknown, max = 200) { return typeof value === "string" ? value.trim().slice(0, max) : ""; }
function numberOrNull(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

async function subscriberByPublicId(env: Env, publicId: string) {
  return env.DB.prepare(`SELECT * FROM email_subscribers WHERE public_id = ?`).bind(publicId).first<Record<string, unknown>>();
}

export async function getAdminUser360(request: Request, env: Env, publicId: string) {
  const auth = await requireOperator(request, env);
  if (!auth.admin) return auth.response!;
  const subscriber = await subscriberByPublicId(env, publicId);
  if (!subscriber) return json({ error: "Subscriber not found" }, 404);
  const subscriberId = Number(subscriber.id);

  const [emailPreferences, prayerPreferences, devices, activity, deliveries] = await Promise.all([
    env.DB.prepare(`SELECT prayer_alerts, daily_prayer_schedule, religious_occasions, daily_content, announcements, community_events, marketing, updated_at FROM subscriber_email_preferences WHERE subscriber_id = ?`).bind(subscriberId).first<Record<string, unknown>>(),
    env.DB.prepare(`SELECT prayer, email_twenty, email_ten, email_athan, updated_at FROM subscriber_prayer_preferences WHERE subscriber_id = ? ORDER BY CASE prayer WHEN 'fajr' THEN 1 WHEN 'dhuhr' THEN 2 WHEN 'asr' THEN 3 WHEN 'maghrib' THEN 4 ELSE 5 END`).bind(subscriberId).all<Record<string, unknown>>(),
    env.DB.prepare(`SELECT id, installation_id, provider, platform, locale, enabled, app_version, notify_twenty, notify_ten, notify_athan, notify_announcements, notify_community_events, notify_marketing, latitude, longitude, timezone, country_code, city, location_updated_at, created_at, updated_at FROM subscriptions WHERE subscriber_id = ? OR installation_id = ? ORDER BY updated_at DESC`).bind(subscriberId, subscriber.installation_id ?? "").all<Record<string, unknown>>(),
    env.DB.prepare(`SELECT id, installation_id, activity_key, activity_label, detail, platform, occurred_at FROM subscriber_activity WHERE subscriber_id = ? ORDER BY occurred_at DESC, id DESC LIMIT 100`).bind(subscriberId).all<Record<string, unknown>>(),
    env.DB.prepare(`SELECT id, notification_kind, prayer, status, scheduled_for, subject_snapshot, sent_at, delivered_at, error_code, error_message, created_at FROM email_deliveries WHERE subscriber_id = ? ORDER BY id DESC LIMIT 50`).bind(subscriberId).all<Record<string, unknown>>()
  ]);

  return json({ ok: true, subscriber, emailPreferences: emailPreferences ?? {}, prayerPreferences: prayerPreferences.results, devices: devices.results, activity: activity.results, recentEmailDeliveries: deliveries.results });
}

export async function listAdminDevices360(request: Request, env: Env, url: URL) {
  const auth = await requireOperator(request, env);
  if (!auth.admin) return auth.response!;
  const q = text(url.searchParams.get("q"), 100);
  const search = `%${q.replace(/[%_]/g, "")}%`;
  const { results } = await env.DB.prepare(
    `SELECT d.id, d.installation_id, d.provider, d.platform, d.locale, d.enabled, d.app_version,
            d.notify_twenty, d.notify_ten, d.notify_athan, d.notify_announcements, d.notify_community_events, d.notify_marketing,
            d.latitude, d.longitude, d.timezone, d.country_code, d.city, d.location_updated_at, d.created_at, d.updated_at,
            s.public_id AS subscriber_public_id, s.email AS subscriber_email, s.display_name AS subscriber_name
     FROM subscriptions d LEFT JOIN email_subscribers s ON s.id = d.subscriber_id
     WHERE (? = '' OR d.installation_id LIKE ? OR COALESCE(d.city,'') LIKE ? COLLATE NOCASE OR COALESCE(d.country_code,'') LIKE ? COLLATE NOCASE OR COALESCE(s.email,'') LIKE ? COLLATE NOCASE)
     ORDER BY d.updated_at DESC LIMIT 500`
  ).bind(q, search, search, search, search).all<Record<string, unknown>>();
  return json({ ok: true, devices: results });
}

export async function updateAdminSubscriberProfile(request: Request, env: Env, publicId: string) {
  const auth = await requireOperator(request, env);
  if (!auth.admin) return auth.response!;
  const current = await subscriberByPublicId(env, publicId);
  if (!current) return json({ error: "Subscriber not found" }, 404);
  const body = await bodyJson(request);
  const latitude = "latitude" in body ? numberOrNull(body.latitude) : Number(current.latitude);
  const longitude = "longitude" in body ? numberOrNull(body.longitude) : Number(current.longitude);
  if (latitude === null || longitude === null || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return json({ error: "Valid latitude and longitude are required" }, 400);
  const status = ["pending", "active", "unsubscribed", "bounced", "disabled"].includes(String(body.status)) ? String(body.status) : String(current.status);
  const locale = body.locale === "ar" ? "ar" : body.locale === "en" ? "en" : String(current.locale);
  const madhab = body.madhab === "hanafi" ? "hanafi" : body.madhab === "standard" ? "standard" : String(current.madhab);
  const calculationMethod = "calculationMethod" in body ? numberOrNull(body.calculationMethod) : current.calculation_method;
  await env.DB.prepare(
    `UPDATE email_subscribers SET display_name = ?, locale = ?, latitude = ?, longitude = ?, timezone = ?, country_code = ?, country_name = ?, region = ?, city = ?, calculation_method = ?, madhab = ?, status = ?, location_updated_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE public_id = ?`
  ).bind(
    "displayName" in body ? text(body.displayName, 100) || null : current.display_name,
    locale, latitude, longitude,
    "timezone" in body ? text(body.timezone, 100) || String(current.timezone) : current.timezone,
    "countryCode" in body ? text(body.countryCode, 10) || null : current.country_code,
    "countryName" in body ? text(body.countryName, 100) || null : current.country_name,
    "region" in body ? text(body.region, 100) || null : current.region,
    "city" in body ? text(body.city, 100) || null : current.city,
    calculationMethod, madhab, status, publicId
  ).run();
  if (status === "disabled" || status === "unsubscribed") {
    await env.DB.prepare(`UPDATE subscriptions SET enabled = 0, updated_at = CURRENT_TIMESTAMP WHERE subscriber_id = ?`).bind(current.id).run();
  }
  await audit(env, auth.admin.id, "update", "subscriber_profile", publicId, `Updated subscriber profile ${current.email}`, body);
  return json({ ok: true });
}

export async function updateAdminSubscriberPreferences(request: Request, env: Env, publicId: string) {
  const auth = await requireOperator(request, env);
  if (!auth.admin) return auth.response!;
  const subscriber = await subscriberByPublicId(env, publicId);
  if (!subscriber) return json({ error: "Subscriber not found" }, 404);
  const body = await bodyJson(request);
  const subscriberId = Number(subscriber.id);
  const email = (body.email ?? {}) as Record<string, unknown>;
  await env.DB.prepare(
    `INSERT INTO subscriber_email_preferences (subscriber_id, prayer_alerts, daily_prayer_schedule, religious_occasions, daily_content, announcements, community_events, marketing, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(subscriber_id) DO UPDATE SET prayer_alerts=excluded.prayer_alerts, daily_prayer_schedule=excluded.daily_prayer_schedule, religious_occasions=excluded.religious_occasions, daily_content=excluded.daily_content, announcements=excluded.announcements, community_events=excluded.community_events, marketing=excluded.marketing, updated_at=CURRENT_TIMESTAMP`
  ).bind(subscriberId, bool(email.prayerAlerts), bool(email.dailyPrayerSchedule), bool(email.religiousOccasions), bool(email.dailyContent), bool(email.announcements), bool(email.communityEvents), bool(email.marketing)).run();

  const prayers = (body.prayers ?? {}) as Record<string, unknown>;
  for (const prayer of ["fajr", "dhuhr", "asr", "maghrib", "isha"]) {
    const p = (prayers[prayer] ?? {}) as Record<string, unknown>;
    await env.DB.prepare(
      `INSERT INTO subscriber_prayer_preferences (subscriber_id, prayer, email_twenty, email_ten, email_athan, updated_at)
       VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(subscriber_id, prayer) DO UPDATE SET email_twenty=excluded.email_twenty, email_ten=excluded.email_ten, email_athan=excluded.email_athan, updated_at=CURRENT_TIMESTAMP`
    ).bind(subscriberId, prayer, bool(p.twenty), bool(p.ten), bool(p.athan)).run();
  }
  await audit(env, auth.admin.id, "update", "subscriber_preferences", publicId, `Updated email/prayer preferences for ${subscriber.email}`, body);
  return json({ ok: true });
}

export async function updateAdminDevice360(request: Request, env: Env, deviceId: number) {
  const auth = await requireOperator(request, env);
  if (!auth.admin) return auth.response!;
  const current = await env.DB.prepare(`SELECT * FROM subscriptions WHERE id = ?`).bind(deviceId).first<Record<string, unknown>>();
  if (!current) return json({ error: "Device not found" }, 404);
  const body = await bodyJson(request);
  const enabled = "enabled" in body ? bool(body.enabled) : Number(current.enabled);
  const latitude = "latitude" in body ? numberOrNull(body.latitude) : current.latitude;
  const longitude = "longitude" in body ? numberOrNull(body.longitude) : current.longitude;
  await env.DB.prepare(
    `UPDATE subscriptions SET enabled = ?, locale = ?, notify_twenty = ?, notify_ten = ?, notify_athan = ?, notify_announcements = ?, notify_community_events = ?, notify_marketing = ?, latitude = ?, longitude = ?, timezone = ?, country_code = ?, city = ?, location_updated_at = CASE WHEN ? = 1 THEN CURRENT_TIMESTAMP ELSE location_updated_at END, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
  ).bind(
    enabled,
    body.locale === "ar" ? "ar" : body.locale === "en" ? "en" : current.locale,
    "notifyTwenty" in body ? bool(body.notifyTwenty) : current.notify_twenty,
    "notifyTen" in body ? bool(body.notifyTen) : current.notify_ten,
    "notifyAthan" in body ? bool(body.notifyAthan) : current.notify_athan,
    "notifyAnnouncements" in body ? bool(body.notifyAnnouncements) : current.notify_announcements,
    "notifyCommunityEvents" in body ? bool(body.notifyCommunityEvents) : current.notify_community_events,
    "notifyMarketing" in body ? bool(body.notifyMarketing) : current.notify_marketing,
    latitude, longitude,
    "timezone" in body ? text(body.timezone, 100) || current.timezone : current.timezone,
    "countryCode" in body ? text(body.countryCode, 10) || null : current.country_code,
    "city" in body ? text(body.city, 100) || null : current.city,
    ("latitude" in body || "longitude" in body || "timezone" in body || "city" in body || "countryCode" in body) ? 1 : 0,
    deviceId
  ).run();
  await audit(env, auth.admin.id, "update", "device", String(deviceId), `Updated device ${current.installation_id}`, body);
  return json({ ok: true });
}
