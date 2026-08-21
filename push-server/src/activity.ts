import type { Env } from "./types";

const ACTIVITY_KEYS = new Set(["home", "quran", "games", "alerts", "events", "more", "email_alerts", "app_open"]);
const LABELS: Record<string, string> = {
  home: "viewed the prayer dashboard",
  quran: "opened the Qur’an",
  games: "played or viewed Islamic games",
  alerts: "reviewed prayer alerts",
  events: "viewed Islamic events",
  more: "opened app settings",
  email_alerts: "reviewed email prayer alerts",
  app_open: "opened Hassoun"
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}

function cleanText(value: unknown, max: number) {
  if (typeof value !== "string") return null;
  const text = value.trim().replace(/\s+/g, " ");
  return text && text.length <= max ? text : null;
}

function validInstallationId(value: unknown) {
  return typeof value === "string" && /^[A-Za-z0-9_-]{16,128}$/.test(value);
}

export async function recordSubscriberActivity(request: Request, env: Env) {
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  if (!validInstallationId(body.installationId)) return json({ error: "Invalid installationId" }, 400);
  const activityKey = cleanText(body.activity, 40);
  if (!activityKey || !ACTIVITY_KEYS.has(activityKey)) return json({ error: "Invalid activity" }, 400);
  const detail = cleanText(body.detail, 180);
  const platform = cleanText(body.platform, 24);

  const directSubscriber = await env.DB.prepare(
    `SELECT id AS subscriber_id FROM email_subscribers
     WHERE installation_id = ? AND status = 'active'
     ORDER BY updated_at DESC LIMIT 1`
  ).bind(body.installationId).first<{ subscriber_id: number }>();
  const subscription = directSubscriber ?? await env.DB.prepare(
    `SELECT subscriber_id FROM subscriptions
     WHERE installation_id = ? AND subscriber_id IS NOT NULL AND enabled = 1
     ORDER BY updated_at DESC LIMIT 1`
  ).bind(body.installationId).first<{ subscriber_id: number }>();

  // Activity can be reported before a person signs up for email. In that case
  // there is intentionally nothing to store yet; the endpoint remains a no-op.
  if (!subscription?.subscriber_id) return json({ ok: true, linked: false });

  await env.DB.prepare(
    `INSERT INTO subscriber_activity (
       subscriber_id, installation_id, activity_key, activity_label, detail, platform
     ) VALUES (?, ?, ?, ?, ?, ?)`
  ).bind(
    subscription.subscriber_id,
    body.installationId,
    activityKey,
    LABELS[activityKey] || activityKey,
    detail,
    platform
  ).run();

  // Keep only a useful recent history per subscriber.
  await env.DB.prepare(
    `DELETE FROM subscriber_activity
     WHERE subscriber_id = ? AND id NOT IN (
       SELECT id FROM subscriber_activity WHERE subscriber_id = ? ORDER BY occurred_at DESC, id DESC LIMIT 50
     )`
  ).bind(subscription.subscriber_id, subscription.subscriber_id).run();

  return json({ ok: true, linked: true });
}
