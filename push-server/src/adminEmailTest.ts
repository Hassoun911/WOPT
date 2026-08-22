import { requireAdmin } from "./adminAuth";
import { processEmailOutbox } from "./emailDelivery";
import type { Env } from "./types";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}

function clean(value: unknown, max: number) {
  if (typeof value !== "string") return null;
  const text = value.trim();
  return text && text.length <= max ? text : null;
}

export async function sendAdminTemplateTest(request: Request, env: Env) {
  const auth = await requireAdmin(request, env);
  if (!auth.admin) return auth.response!;
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const key = clean(body.templateKey, 120);
  if (!key) return json({ error: "Template key is required" }, 400);

  const profile = await env.DB.prepare(
    "SELECT template_key FROM email_template_profiles WHERE template_key = ? LIMIT 1"
  ).bind(key).first<{ template_key: string }>();
  if (!profile) return json({ error: "Template profile not found" }, 404);

  const recipient = "windsor.hassoun@gmail.com";
  const now = new Date();
  const dateKey = now.toISOString().slice(0, 10);
  const kind = key === "prayer_alert" ? "prayer" : key;
  const idempotencyKey = `admin-template-test:${key}:${crypto.randomUUID()}`;
  const templateData = {
    forceTemplatePreview: true,
    kind: "athan",
    prayer: "maghrib",
    prayerLabel: "Maghrib",
    prayerTime: "20:22",
    prayerDate: dateKey,
    prayerTimes: { fajr: "05:12", dhuhr: "13:35", asr: "17:23", maghrib: "20:22", isha: "21:46" },
    locationLabel: "Windsor, Ontario",
    timezone: "America/Toronto",
    message: `This is a Hassoun test of the ${key} email template.`,
    verificationUrl: "https://admin.hassoun.app/admin/email",
    manageUrl: "https://admin.hassoun.app/admin/email",
    resetUrl: "https://admin.hassoun.app/admin/email",
    upcomingEvent: {
      emoji: "🕌",
      daysLeft: 36,
      nameEn: "Mawlid an-Nabi",
      nameAr: "المولد النبوي",
      descriptionEn: "A blessed occasion to remember the life and character of the Prophet Muhammad ﷺ.",
      descriptionAr: "مناسبة مباركة لذكر سيرة وأخلاق النبي محمد ﷺ."
    }
  };

  const inserted = await env.DB.prepare(
    `INSERT INTO email_outbox
      (delivery_id,subscriber_id,recipient_email,locale,kind,template_key,template_data_json,idempotency_key,scheduled_at,status)
     VALUES (NULL,NULL,?,'en',?,NULL,?,?,CURRENT_TIMESTAMP,'pending')`
  ).bind(recipient, kind, JSON.stringify(templateData), idempotencyKey).run();
  const outboxId = Number(inserted.meta.last_row_id ?? 0);
  if (!outboxId) return json({ error: "Unable to queue test email" }, 500);

  for (let round = 0; round < 12; round += 1) {
    await processEmailOutbox(env);
    const row = await env.DB.prepare(
      "SELECT status,last_error,sent_at FROM email_outbox WHERE id = ? LIMIT 1"
    ).bind(outboxId).first<{ status: string; last_error: string | null; sent_at: string | null }>();
    if (row?.status === "sent") {
      return json({ ok: true, recipient, templateKey: key, outboxId, status: "sent", sentAt: row.sent_at });
    }
    if (row?.status === "failed" || row?.last_error) {
      return json({ error: row.last_error || "Test email failed", recipient, templateKey: key, outboxId }, 502);
    }
  }
  return json({ error: "Test email is still queued. Please try again in a moment.", recipient, templateKey: key, outboxId }, 503);
}

export async function sendFinalPrayerEmailTest(request: Request, env: Env) {
  const auth = await requireAdmin(request, env);
  if (!auth.admin) return auth.response!;
  const recipient = auth.admin.email.trim().toLowerCase();
  const now = new Date();
  const dateKey = now.toISOString().slice(0, 10);
  const idempotencyKey = `admin-final-prayer-email:${auth.admin.id}:${now.toISOString()}`;
  const displayName = auth.admin.display_name || auth.admin.username || "Hassoun Admin";
  const templateData = {
    forceTemplatePreview: true,
    kind: "athan",
    prayer: "dhuhr",
    prayerLabel: "Dhuhr",
    prayerTime: "13:35",
    prayerDate: dateKey,
    prayerTimes: { fajr: "05:11", dhuhr: "13:35", asr: "17:24", maghrib: "20:28", isha: "21:49" },
    displayName,
    locationLabel: "Windsor, Ontario",
    timezone: "America/Toronto",
    appUrl: "https://hassoun.app",
    manageUrl: "https://admin.hassoun.app/admin/email",
    upcomingEvent: { emoji: "🌙", daysLeft: 5, nameEn: "Upcoming Islamic Event", nameAr: "مناسبة إسلامية قادمة" }
  };
  await env.DB.prepare(
    `INSERT INTO email_outbox (delivery_id,subscriber_id,recipient_email,locale,kind,template_key,template_data_json,idempotency_key,scheduled_at,status)
     VALUES (NULL,NULL,?,'en','prayer','prayer_alert',?,?,CURRENT_TIMESTAMP,'pending')`
  ).bind(recipient, JSON.stringify(templateData), idempotencyKey).run();
  const result = await processEmailOutbox(env);
  return json({ ok: true, recipient, test: "final_prayer_email", ...result });
}
