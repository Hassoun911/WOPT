import webpush from "web-push";
import { requireAdmin } from "./adminAuth";
import type { Env, Locale } from "./types";

const EXPO_URL = "https://exp.host/--/api/v2/push/send";

type Category = "announcement" | "religious_occasion" | "community_event" | "daily_content" | "marketing" | "system";
type Audience = "all_devices" | "linked_subscribers" | "anonymous_devices" | "custom";
type TargetPlatform = "all" | "android" | "ios" | "web";
type TargetLocale = "all" | "en" | "ar";

type CampaignRow = {
  id: number;
  public_id: string;
  name: string;
  category: Category;
  title_en: string;
  title_ar: string | null;
  body_en: string;
  body_ar: string | null;
  deep_link: string | null;
  image_url: string | null;
  audience: Audience;
  target_platform: TargetPlatform;
  target_locale: TargetLocale;
  target_country_code: string | null;
  target_city: string | null;
  target_timezone: string | null;
  priority: "normal" | "high";
  status: string;
  scheduled_at: string | null;
};

type TargetSubscription = {
  id: number;
  subscriber_id: number | null;
  provider: "expo" | "web";
  platform: "android" | "ios" | "web";
  locale: Locale;
  address: string;
  web_p256dh: string | null;
  web_auth: string | null;
  notify_announcements: number;
  notify_community_events: number;
  notify_marketing: number;
  country_code: string | null;
  city: string | null;
  timezone: string | null;
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

async function bodyJson(request: Request) {
  const length = Number(request.headers.get("Content-Length") ?? 0);
  if (length > 65_536) throw new Error("Request body is too large");
  return (await request.json()) as Record<string, unknown>;
}

function cleanText(value: unknown, max: number) {
  if (typeof value !== "string") return null;
  const text = value.trim();
  return text && text.length <= max ? text : null;
}

function category(value: unknown): Category {
  return ["announcement", "religious_occasion", "community_event", "daily_content", "marketing", "system"].includes(String(value))
    ? value as Category
    : "announcement";
}

function audience(value: unknown): Audience {
  return ["all_devices", "linked_subscribers", "anonymous_devices", "custom"].includes(String(value))
    ? value as Audience
    : "all_devices";
}

function targetPlatform(value: unknown): TargetPlatform {
  return ["all", "android", "ios", "web"].includes(String(value)) ? value as TargetPlatform : "all";
}

function targetLocale(value: unknown): TargetLocale {
  return ["all", "en", "ar"].includes(String(value)) ? value as TargetLocale : "all";
}

function scheduledAt(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return new Date().toISOString();
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
}

async function logAdmin(env: Env, adminId: number, action: string, entityType: string, entityId: string, details: unknown) {
  await env.DB.prepare(
    `INSERT INTO admin_activity_log (admin_user_id, action, entity_type, entity_id, details_json)
     VALUES (?, ?, ?, ?, ?)`
  ).bind(adminId, action, entityType, entityId, JSON.stringify(details ?? {})).run();
}

export async function createAdminPushCampaign(request: Request, env: Env) {
  const auth = await requireAdmin(request, env);
  if (!auth.admin) return auth.response!;
  const body = await bodyJson(request);
  const titleEn = cleanText(body.titleEn, 120);
  const bodyEn = cleanText(body.bodyEn, 500);
  if (!titleEn || !bodyEn) return json({ error: "English title and body are required" }, 400);

  const titleAr = cleanText(body.titleAr, 120);
  const bodyAr = cleanText(body.bodyAr, 500);
  const when = scheduledAt(body.scheduledAt);
  if (!when) return json({ error: "Invalid scheduled time" }, 400);
  const publicId = crypto.randomUUID();
  const name = cleanText(body.name, 120) || titleEn;
  const campaignCategory = category(body.category);
  const campaignAudience = audience(body.audience);
  const platform = targetPlatform(body.targetPlatform);
  const locale = targetLocale(body.targetLocale);
  const countryCode = typeof body.targetCountryCode === "string" && /^[A-Za-z]{2}$/.test(body.targetCountryCode.trim())
    ? body.targetCountryCode.trim().toUpperCase()
    : null;
  const city = cleanText(body.targetCity, 100);
  const timezone = cleanText(body.targetTimezone, 80);
  const priority = body.priority === "high" ? "high" : "normal";

  await env.DB.prepare(
    `INSERT INTO push_campaigns (
       public_id, name, category, title_en, title_ar, body_en, body_ar,
       deep_link, image_url, audience, target_platform, target_locale,
       target_country_code, target_city, target_timezone, priority,
       status, scheduled_at, created_by_admin_id
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'scheduled', ?, ?)`
  ).bind(
    publicId,
    name,
    campaignCategory,
    titleEn,
    titleAr,
    bodyEn,
    bodyAr,
    cleanText(body.deepLink, 500),
    cleanText(body.imageUrl, 1000),
    campaignAudience,
    platform,
    locale,
    countryCode,
    city,
    timezone,
    priority,
    when,
    auth.admin.id
  ).run();

  await logAdmin(env, auth.admin.id, "push_campaign_created", "push_campaign", publicId, {
    scheduledAt: when,
    category: campaignCategory,
    audience: campaignAudience,
    platform,
    locale
  });
  return json({ ok: true, publicId, status: "scheduled", scheduledAt: when }, 201);
}

export async function listAdminPushCampaigns(request: Request, env: Env) {
  const auth = await requireAdmin(request, env);
  if (!auth.admin) return auth.response!;
  const { results } = await env.DB.prepare(
    `SELECT p.public_id, p.name, p.category, p.title_en, p.title_ar, p.body_en, p.body_ar,
            p.audience, p.target_platform, p.target_locale, p.target_country_code,
            p.target_city, p.target_timezone, p.priority, p.status, p.scheduled_at,
            p.started_at, p.sent_at, p.created_at,
            SUM(CASE WHEN d.status = 'sent' THEN 1 ELSE 0 END) AS sent_count,
            SUM(CASE WHEN d.status = 'failed' THEN 1 ELSE 0 END) AS failed_count,
            COUNT(d.subscription_id) AS delivery_count
     FROM push_campaigns p
     LEFT JOIN push_campaign_deliveries d ON d.campaign_id = p.id
     GROUP BY p.id
     ORDER BY p.id DESC
     LIMIT 100`
  ).all<Record<string, unknown>>();
  return json({ ok: true, campaigns: results });
}

function wantsCategory(subscription: TargetSubscription, campaign: CampaignRow) {
  if (campaign.category === "marketing") return subscription.notify_marketing === 1;
  if (campaign.category === "community_event") return subscription.notify_community_events === 1;
  return subscription.notify_announcements === 1;
}

function matchesTarget(subscription: TargetSubscription, campaign: CampaignRow) {
  if (!wantsCategory(subscription, campaign)) return false;
  if (campaign.audience === "linked_subscribers" && !subscription.subscriber_id) return false;
  if (campaign.audience === "anonymous_devices" && subscription.subscriber_id) return false;
  if (campaign.target_platform !== "all" && subscription.platform !== campaign.target_platform) return false;
  if (campaign.target_locale !== "all" && subscription.locale !== campaign.target_locale) return false;
  if (campaign.target_country_code && subscription.country_code !== campaign.target_country_code) return false;
  if (campaign.target_city && subscription.city?.toLowerCase() !== campaign.target_city.toLowerCase()) return false;
  if (campaign.target_timezone && subscription.timezone !== campaign.target_timezone) return false;
  return true;
}

function localizedMessage(campaign: CampaignRow, locale: Locale) {
  if (locale === "ar" && campaign.title_ar && campaign.body_ar) {
    return { title: campaign.title_ar, body: campaign.body_ar };
  }
  return { title: campaign.title_en, body: campaign.body_en };
}

async function disableSubscription(env: Env, subscriptionId: number) {
  await env.DB.prepare(
    "UPDATE subscriptions SET enabled = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
  ).bind(subscriptionId).run();
}

async function sendExpo(env: Env, subscription: TargetSubscription, campaign: CampaignRow) {
  const message = localizedMessage(campaign, subscription.locale);
  const response = await fetch(EXPO_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(env.EXPO_ACCESS_TOKEN ? { Authorization: `Bearer ${env.EXPO_ACCESS_TOKEN}` } : {})
    },
    body: JSON.stringify({
      to: subscription.address,
      title: message.title,
      body: message.body,
      sound: "default",
      channelId: subscription.platform === "android" ? "wopt-general-v1" : undefined,
      priority: campaign.priority,
      data: {
        type: "admin_push",
        campaignId: campaign.public_id,
        category: campaign.category,
        deepLink: campaign.deep_link,
        imageUrl: campaign.image_url
      }
    })
  });
  if (!response.ok) throw new Error(`Expo push failed: ${response.status}`);
  const payload = await response.json() as {
    data?: { id?: string; status?: string; details?: { error?: string } };
  };
  if (payload.data?.details?.error === "DeviceNotRegistered") {
    await disableSubscription(env, subscription.id);
    return { invalid: true, ticket: undefined };
  }
  if (payload.data?.status === "error") throw new Error("Expo rejected admin notification");
  return { invalid: false, ticket: payload.data?.id };
}

async function sendWeb(env: Env, subscription: TargetSubscription, campaign: CampaignRow) {
  if (!subscription.web_p256dh || !subscription.web_auth) throw new Error("Incomplete web subscription");
  webpush.setVapidDetails(env.VAPID_SUBJECT, env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY);
  const message = localizedMessage(campaign, subscription.locale);
  try {
    await webpush.sendNotification(
      {
        endpoint: subscription.address,
        keys: { p256dh: subscription.web_p256dh, auth: subscription.web_auth }
      },
      JSON.stringify({
        title: message.title,
        body: message.body,
        type: "admin_push",
        campaignId: campaign.public_id,
        category: campaign.category,
        url: campaign.deep_link || "/",
        image: campaign.image_url || undefined
      }),
      { TTL: 3600, urgency: campaign.priority === "high" ? "high" : "normal" }
    );
    return { invalid: false, ticket: undefined };
  } catch (error) {
    const statusCode = (error as { statusCode?: number }).statusCode;
    if (statusCode === 404 || statusCode === 410) {
      await disableSubscription(env, subscription.id);
      return { invalid: true, ticket: undefined };
    }
    throw error;
  }
}

async function targetSubscriptions(env: Env) {
  const { results } = await env.DB.prepare(
    `SELECT s.id, s.subscriber_id, s.provider, s.platform, s.locale, s.address,
            s.web_p256dh, s.web_auth, s.notify_announcements, s.notify_community_events,
            s.notify_marketing,
            COALESCE(s.country_code, e.country_code) AS country_code,
            COALESCE(s.city, e.city) AS city,
            COALESCE(s.timezone, e.timezone) AS timezone
     FROM subscriptions s
     LEFT JOIN email_subscribers e ON e.id = s.subscriber_id
     WHERE s.enabled = 1`
  ).all<TargetSubscription>();
  return results;
}

async function claimDelivery(env: Env, campaignId: number, subscriptionId: number) {
  const result = await env.DB.prepare(
    `INSERT OR IGNORE INTO push_campaign_deliveries (campaign_id, subscription_id, status)
     VALUES (?, ?, 'pending')`
  ).bind(campaignId, subscriptionId).run();
  return (result.meta.changes ?? 0) === 1;
}

async function finishCampaign(env: Env, campaign: CampaignRow, failed: boolean) {
  await env.DB.prepare(
    `UPDATE push_campaigns SET status = ?, sent_at = CASE WHEN ? = 0 THEN CURRENT_TIMESTAMP ELSE sent_at END,
       updated_at = CURRENT_TIMESTAMP WHERE id = ?`
  ).bind(failed ? "failed" : "sent", failed ? 1 : 0, campaign.id).run();
}

async function dispatchCampaign(env: Env, campaign: CampaignRow) {
  const subscriptions = (await targetSubscriptions(env)).filter((subscription) => matchesTarget(subscription, campaign));
  let failures = 0;
  for (const subscription of subscriptions) {
    if (!(await claimDelivery(env, campaign.id, subscription.id))) continue;
    try {
      const result = subscription.provider === "expo"
        ? await sendExpo(env, subscription, campaign)
        : await sendWeb(env, subscription, campaign);
      await env.DB.prepare(
        `UPDATE push_campaign_deliveries SET status = ?, provider_ticket_id = ?, sent_at = CURRENT_TIMESTAMP
         WHERE campaign_id = ? AND subscription_id = ?`
      ).bind(
        result.invalid ? "invalid_device" : "sent",
        result.ticket ?? null,
        campaign.id,
        subscription.id
      ).run();
    } catch (error) {
      failures += 1;
      await env.DB.prepare(
        `UPDATE push_campaign_deliveries SET status = 'failed', error_message = ?
         WHERE campaign_id = ? AND subscription_id = ?`
      ).bind(String(error instanceof Error ? error.message : error).slice(0, 1000), campaign.id, subscription.id).run();
    }
  }
  await finishCampaign(env, campaign, failures > 0 && subscriptions.length > 0 && failures === subscriptions.length);
}

export async function dispatchDueAdminPushCampaigns(env: Env) {
  const { results } = await env.DB.prepare(
    `SELECT id, public_id, name, category, title_en, title_ar, body_en, body_ar,
            deep_link, image_url, audience, target_platform, target_locale,
            target_country_code, target_city, target_timezone, priority, status, scheduled_at
     FROM push_campaigns
     WHERE status = 'scheduled' AND scheduled_at <= CURRENT_TIMESTAMP
     ORDER BY scheduled_at, id
     LIMIT 10`
  ).all<CampaignRow>();

  for (const campaign of results) {
    const claimed = await env.DB.prepare(
      `UPDATE push_campaigns SET status = 'sending', started_at = CURRENT_TIMESTAMP,
       updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'scheduled'`
    ).bind(campaign.id).run();
    if ((claimed.meta.changes ?? 0) !== 1) continue;
    try {
      await dispatchCampaign(env, campaign);
    } catch (error) {
      console.error("Admin push campaign failed", { campaignId: campaign.public_id, error });
      await finishCampaign(env, campaign, true);
    }
  }
  return { processed: results.length };
}
