import { requireAdmin } from "./adminAuth";
import { subscriberManageUrl } from "./subscribers";
import type { Env, Locale } from "./types";

type Category = "religious_occasion" | "daily_content" | "announcement" | "community_event" | "marketing" | "system";
type Audience = "all_subscribers" | "custom";
type TargetLocale = "all" | "en" | "ar";

type CampaignRow = {
  id: number;
  public_id: string;
  name: string;
  template_key: string | null;
  category: Category;
  audience: Audience;
  target_locale: TargetLocale;
  target_country_code: string | null;
  target_city: string | null;
  target_timezone: string | null;
  status: string;
  scheduled_at: string | null;
};

type SubscriberRow = {
  id: number;
  public_id: string;
  email: string;
  locale: Locale;
  country_code: string | null;
  country_name: string | null;
  region: string | null;
  city: string | null;
  timezone: string;
  religious_occasions: number;
  daily_content: number;
  announcements: number;
  community_events: number;
  marketing: number;
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

async function bodyJson(request: Request) {
  const length = Number(request.headers.get("Content-Length") ?? 0);
  if (length > 131_072) throw new Error("Request body is too large");
  return (await request.json()) as Record<string, unknown>;
}

function clean(value: unknown, max: number) {
  if (typeof value !== "string") return null;
  const text = value.trim();
  return text && text.length <= max ? text : null;
}

function category(value: unknown): Category {
  return ["religious_occasion", "daily_content", "announcement", "community_event", "marketing", "system"].includes(String(value))
    ? value as Category
    : "announcement";
}

function audience(value: unknown): Audience {
  return value === "custom" ? "custom" : "all_subscribers";
}

function targetLocale(value: unknown): TargetLocale {
  return value === "en" || value === "ar" ? value : "all";
}

function scheduleTime(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return new Date().toISOString();
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
}

function templateCategory(categoryValue: Category) {
  return categoryValue;
}

function outboxKind(categoryValue: Category) {
  if (categoryValue === "system") return "announcement";
  return categoryValue;
}

function categoryAllowed(subscriber: SubscriberRow, campaign: CampaignRow) {
  if (campaign.category === "system") return true;
  if (campaign.category === "religious_occasion") return subscriber.religious_occasions === 1;
  if (campaign.category === "daily_content") return subscriber.daily_content === 1;
  if (campaign.category === "community_event") return subscriber.community_events === 1;
  if (campaign.category === "marketing") return subscriber.marketing === 1;
  return subscriber.announcements === 1;
}

function matchesTarget(subscriber: SubscriberRow, campaign: CampaignRow) {
  if (!categoryAllowed(subscriber, campaign)) return false;
  if (campaign.target_locale !== "all" && subscriber.locale !== campaign.target_locale) return false;
  if (campaign.target_country_code && subscriber.country_code !== campaign.target_country_code) return false;
  if (campaign.target_city && subscriber.city?.toLowerCase() !== campaign.target_city.toLowerCase()) return false;
  if (campaign.target_timezone && subscriber.timezone !== campaign.target_timezone) return false;
  return true;
}

async function logAdmin(env: Env, adminId: number, action: string, entityId: string, details: unknown) {
  await env.DB.prepare(
    `INSERT INTO admin_activity_log (admin_user_id, action, entity_type, entity_id, details_json)
     VALUES (?, ?, 'email_campaign', ?, ?)`
  ).bind(adminId, action, entityId, JSON.stringify(details ?? {})).run();
}

export async function createAdminEmailCampaign(request: Request, env: Env) {
  const auth = await requireAdmin(request, env);
  if (!auth.admin) return auth.response!;
  const body = await bodyJson(request);

  const subjectEn = clean(body.subjectEn, 180);
  const htmlEn = clean(body.htmlEn, 50_000);
  const textEn = clean(body.textEn, 20_000) || (typeof body.htmlEn === "string" ? body.htmlEn.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 20_000) : null);
  if (!subjectEn || !htmlEn) return json({ error: "English subject and HTML message are required" }, 400);

  const campaignCategory = category(body.category);
  const publicId = crypto.randomUUID();
  const templateKey = `campaign_${publicId.replace(/-/g, "")}`;
  const when = scheduleTime(body.scheduledAt);
  if (!when) return json({ error: "Invalid scheduled time" }, 400);

  const subjectAr = clean(body.subjectAr, 180);
  const htmlAr = clean(body.htmlAr, 50_000);
  const textAr = clean(body.textAr, 20_000);
  const name = clean(body.name, 120) || subjectEn;
  const campaignAudience = audience(body.audience);
  const locale = targetLocale(body.targetLocale);
  const countryCode = typeof body.targetCountryCode === "string" && /^[A-Za-z]{2}$/.test(body.targetCountryCode.trim())
    ? body.targetCountryCode.trim().toUpperCase()
    : null;
  const city = clean(body.targetCity, 100);
  const timezone = clean(body.targetTimezone, 80);

  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO email_templates (
         template_key, name, category, subject_en, subject_ar, html_en, html_ar,
         text_en, text_ar, enabled
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`
    ).bind(templateKey, name, templateCategory(campaignCategory), subjectEn, subjectAr, htmlEn, htmlAr, textEn, textAr),
    env.DB.prepare(
      `INSERT INTO email_campaigns (
         public_id, name, template_key, category, audience, target_locale,
         target_country_code, target_city, target_timezone, status, scheduled_at,
         created_by_admin_id
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'scheduled', ?, ?)`
    ).bind(
      publicId,
      name,
      templateKey,
      campaignCategory,
      campaignAudience,
      locale,
      countryCode,
      city,
      timezone,
      when,
      auth.admin.id
    )
  ]);

  await logAdmin(env, auth.admin.id, "email_campaign_created", publicId, {
    scheduledAt: when,
    category: campaignCategory,
    audience: campaignAudience,
    locale,
    countryCode,
    city,
    timezone
  });
  return json({ ok: true, publicId, status: "scheduled", scheduledAt: when }, 201);
}

export async function listAdminEmailCampaigns(request: Request, env: Env) {
  const auth = await requireAdmin(request, env);
  if (!auth.admin) return auth.response!;
  const { results } = await env.DB.prepare(
    `SELECT c.public_id, c.name, c.category, c.audience, c.target_locale,
            c.target_country_code, c.target_city, c.target_timezone, c.status,
            c.scheduled_at, c.started_at, c.sent_at, c.created_at,
            t.subject_en, t.subject_ar,
            SUM(CASE WHEN d.status = 'sent' THEN 1 ELSE 0 END) AS sent_count,
            SUM(CASE WHEN d.status = 'failed' THEN 1 ELSE 0 END) AS failed_count,
            SUM(CASE WHEN d.status = 'pending' THEN 1 ELSE 0 END) AS pending_count,
            COUNT(d.id) AS delivery_count
     FROM email_campaigns c
     LEFT JOIN email_templates t ON t.template_key = c.template_key
     LEFT JOIN email_deliveries d ON d.campaign_id = c.id
     GROUP BY c.id
     ORDER BY c.id DESC
     LIMIT 100`
  ).all<Record<string, unknown>>();
  return json({ ok: true, campaigns: results });
}

async function subscribers(env: Env) {
  const { results } = await env.DB.prepare(
    `SELECT s.id, s.public_id, s.email, s.locale, s.country_code, s.country_name,
            s.region, s.city, s.timezone,
            p.religious_occasions, p.daily_content, p.announcements,
            p.community_events, p.marketing
     FROM email_subscribers s
     JOIN subscriber_email_preferences p ON p.subscriber_id = s.id
     WHERE s.status = 'active'`
  ).all<SubscriberRow>();
  return results;
}

async function claimCampaignDelivery(env: Env, campaign: CampaignRow, subscriber: SubscriberRow) {
  const eventId = `campaign:${campaign.id}:${subscriber.id}`;
  const inserted = await env.DB.prepare(
    `INSERT OR IGNORE INTO email_deliveries (
       event_id, campaign_id, subscriber_id, recipient_email, template_key,
       status, notification_kind, scheduled_for
     ) VALUES (?, ?, ?, ?, ?, 'pending', 'campaign', ?)`
  ).bind(
    eventId,
    campaign.id,
    subscriber.id,
    subscriber.email,
    campaign.template_key,
    campaign.scheduled_at || new Date().toISOString()
  ).run();
  if ((inserted.meta.changes ?? 0) !== 1) return null;
  return env.DB.prepare(
    "SELECT id FROM email_deliveries WHERE event_id = ? AND subscriber_id = ? LIMIT 1"
  ).bind(eventId, subscriber.id).first<{ id: number }>();
}

async function enqueueCampaign(env: Env, campaign: CampaignRow) {
  const candidates = (await subscribers(env)).filter((subscriber) => matchesTarget(subscriber, campaign));
  let queued = 0;
  for (const subscriber of candidates) {
    const delivery = await claimCampaignDelivery(env, campaign, subscriber);
    if (!delivery) continue;
    const manageUrl = await subscriberManageUrl(env, subscriber.public_id, subscriber.email);
    const idempotencyKey = `email-campaign:${campaign.id}:${subscriber.id}`;
    await env.DB.prepare(
      `INSERT OR IGNORE INTO email_outbox (
         delivery_id, subscriber_id, recipient_email, locale, kind, template_key,
         template_data_json, idempotency_key
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      delivery.id,
      subscriber.id,
      subscriber.email,
      subscriber.locale,
      outboxKind(campaign.category),
      campaign.template_key,
      JSON.stringify({
        manageUrl,
        locationLabel: [subscriber.city, subscriber.region, subscriber.country_name].filter(Boolean).join(", "),
        timezone: subscriber.timezone,
        campaignId: campaign.public_id
      }),
      idempotencyKey
    ).run();
    queued += 1;
  }
  return queued;
}

export async function dispatchDueAdminEmailCampaigns(env: Env) {
  const { results } = await env.DB.prepare(
    `SELECT id, public_id, name, template_key, category, audience, target_locale,
            target_country_code, target_city, target_timezone, status, scheduled_at
     FROM email_campaigns
     WHERE status = 'scheduled' AND scheduled_at <= CURRENT_TIMESTAMP
     ORDER BY scheduled_at, id
     LIMIT 10`
  ).all<CampaignRow>();

  for (const campaign of results) {
    const claimed = await env.DB.prepare(
      `UPDATE email_campaigns SET status = 'sending', started_at = CURRENT_TIMESTAMP,
       updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'scheduled'`
    ).bind(campaign.id).run();
    if ((claimed.meta.changes ?? 0) !== 1) continue;
    try {
      const queued = await enqueueCampaign(env, campaign);
      if (queued === 0) {
        await env.DB.prepare(
          `UPDATE email_campaigns SET status = 'sent', sent_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP WHERE id = ?`
        ).bind(campaign.id).run();
      }
    } catch (error) {
      console.error("Admin email campaign queue failed", { campaignId: campaign.public_id, error });
      await env.DB.prepare(
        `UPDATE email_campaigns SET status = 'failed', updated_at = CURRENT_TIMESTAMP WHERE id = ?`
      ).bind(campaign.id).run();
    }
  }
  return { processed: results.length };
}

export async function refreshAdminEmailCampaignStatuses(env: Env) {
  const { results } = await env.DB.prepare(
    `SELECT id FROM email_campaigns WHERE status = 'sending' LIMIT 50`
  ).all<{ id: number }>();
  for (const campaign of results) {
    const counts = await env.DB.prepare(
      `SELECT COUNT(*) AS total,
              SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending,
              SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) AS sent,
              SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failed
       FROM email_deliveries WHERE campaign_id = ?`
    ).bind(campaign.id).first<{ total: number; pending: number; sent: number; failed: number }>();
    if (!counts || counts.total === 0 || (counts.pending ?? 0) > 0) continue;
    const finalStatus = (counts.sent ?? 0) > 0 ? "sent" : "failed";
    await env.DB.prepare(
      `UPDATE email_campaigns SET status = ?, sent_at = CASE WHEN ? = 'sent' THEN CURRENT_TIMESTAMP ELSE sent_at END,
       updated_at = CURRENT_TIMESTAMP WHERE id = ?`
    ).bind(finalStatus, finalStatus, campaign.id).run();
  }
}
