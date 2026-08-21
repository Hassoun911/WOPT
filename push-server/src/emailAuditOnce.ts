import { processEmailOutbox } from "./emailDelivery";
import type { Env } from "./types";

type SchemaRow = { name: string; sql: string | null };
type CountRow = { count: number };
type ColumnRow = { name: string; type: string };

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
}

function safeIdentifier(value: string) {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(value) ? value : null;
}

export async function auditEmailSystemsOnce(env: Env) {
  const { results } = await env.DB.prepare(
    `SELECT name, sql FROM sqlite_schema
     WHERE type = 'table'
       AND (
         lower(name) LIKE '%email%' OR lower(name) LIKE '%subscriber%'
         OR lower(name) LIKE '%subscription%' OR lower(name) LIKE '%user%'
       )
     ORDER BY name`
  ).all<SchemaRow>();

  const tables: Array<{ name: string; count: number; columns: string[] }> = [];
  for (const row of results) {
    const name = safeIdentifier(row.name);
    if (!name || name.startsWith("sqlite_")) continue;
    const count = await env.DB.prepare(`SELECT COUNT(*) AS count FROM ${name}`).first<CountRow>();
    const columns = await env.DB.prepare(`PRAGMA table_info(${name})`).all<ColumnRow>();
    tables.push({ name, count: Number(count?.count ?? 0), columns: columns.results.map((column) => column.name) });
  }

  return json({
    ok: true,
    privacy: "No subscriber values are returned. Only table names, counts, and column names.",
    tables
  });
}

export async function sendOwnerAdminEmailTestOnce(env: Env) {
  const key = "final-admin-email-test-2026-08-21-v2";
  const existing = await env.DB.prepare(
    `SELECT status, attempts, sent_at FROM email_outbox WHERE idempotency_key = ? LIMIT 1`
  ).bind(key).first<{ status: string; attempts: number; sent_at: string | null }>();
  if (existing) return json({ ok: true, alreadyQueued: true, status: existing.status, attempts: existing.attempts, sent: Boolean(existing.sent_at) });

  const owner = await env.DB.prepare(
    `SELECT email, COALESCE(display_name, username, 'Hassoun Admin') AS display_name
     FROM admin_users WHERE role = 'owner' AND status = 'active' ORDER BY id LIMIT 1`
  ).first<{ email: string; display_name: string }>();
  if (!owner?.email) return json({ error: "Active owner admin not found" }, 404);

  const data = {
    kind: "athan",
    prayer: "dhuhr",
    prayerLabel: "Dhuhr",
    prayerTime: "13:36",
    prayerDate: "2026-08-21",
    prayerTimes: { fajr: "05:13", dhuhr: "13:36", asr: "17:27", maghrib: "20:30", isha: "21:56" },
    displayName: owner.display_name,
    locationLabel: "Windsor, Ontario",
    timezone: "America/Toronto",
    appUrl: "https://hassoun.app",
    manageUrl: "https://hassoun.app/email/manage/",
    upcomingEvent: {
      emoji: "🌙",
      daysLeft: 5,
      nameEn: "Upcoming Islamic Event",
      nameAr: "مناسبة إسلامية قادمة",
      descriptionEn: "This final test confirms the new Hassoun email layout, Islamic-event reminder, app links and sponsor section.",
      descriptionAr: "هذا الاختبار النهائي يؤكد تصميم بريد Hassoun الجديد وتذكير المناسبات وروابط التطبيق وقسم الرعاية."
    },
    lastActivity: {
      label: "📖 Qur’an study",
      detail: "Continue where you left off and keep building your learning streak in Hassoun.",
      occurredAt: new Date().toISOString()
    }
  };

  await env.DB.prepare(
    `INSERT INTO email_outbox (
       delivery_id, subscriber_id, recipient_email, locale, kind, template_key,
       template_data_json, idempotency_key, scheduled_at, status
     ) VALUES (NULL, NULL, ?, 'en', 'prayer', 'prayer_alert', ?, ?, CURRENT_TIMESTAMP, 'pending')`
  ).bind(owner.email.trim().toLowerCase(), JSON.stringify(data), key).run();

  const result = await processEmailOutbox(env);
  const status = await env.DB.prepare(
    `SELECT status, attempts, sent_at FROM email_outbox WHERE idempotency_key = ? LIMIT 1`
  ).bind(key).first<{ status: string; attempts: number; sent_at: string | null }>();
  return json({ ok: true, recipient: "owner_admin_only", delivery: status, processor: result });
}
