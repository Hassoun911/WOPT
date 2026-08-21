import { requireAdmin } from "./adminAuth";
import { processEmailOutbox } from "./emailDelivery";
import type { Env } from "./types";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
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
    manageUrl: "https://hassoun.app/email/manage/",
    upcomingEvent: {
      emoji: "🌙",
      daysLeft: 5,
      nameEn: "Upcoming Islamic Event",
      nameAr: "مناسبة إسلامية قادمة",
      descriptionEn: "Final email-system test: event reminders, Hassoun branding and app links are working together.",
      descriptionAr: "اختبار نهائي لنظام البريد: تذكيرات المناسبات وهوية Hassoun وروابط التطبيق تعمل معاً."
    },
    lastActivity: {
      label: "📖 Qur’an study",
      detail: "Your last activity example is included so the production email can encourage you to continue where you left off.",
      occurredAt: now.toISOString()
    }
  };

  await env.DB.prepare(
    `INSERT INTO email_outbox (
       delivery_id, subscriber_id, recipient_email, locale, kind, template_key,
       template_data_json, idempotency_key, scheduled_at, status
     ) VALUES (NULL, NULL, ?, 'en', 'prayer', 'prayer_alert', ?, ?, CURRENT_TIMESTAMP, 'pending')`
  ).bind(recipient, JSON.stringify(templateData), idempotencyKey).run();

  const result = await processEmailOutbox(env);
  return json({ ok: true, recipient, test: "final_prayer_email", ...result });
}
