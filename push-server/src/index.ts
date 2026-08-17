import { getAdminDashboard, listAdminSubscribers } from "./adminData";
import {
  createAdminEmailCampaign,
  dispatchDueAdminEmailCampaigns,
  listAdminEmailCampaigns,
  refreshAdminEmailCampaignStatuses
} from "./adminEmail";
import {
  bootstrapAdmin,
  changeAdminPassword,
  getAdminMe,
  loginAdmin,
  logoutAdmin
} from "./adminAuth";
import { requestAdminPasswordReset, resetAdminPassword } from "./adminPasswordReset";
import {
  createAdminPushCampaign,
  dispatchDueAdminPushCampaigns,
  listAdminPushCampaigns
} from "./adminPush";
import { dispatchEvent } from "./dispatch";
import { emailDeliveryConfigured, processEmailOutbox } from "./emailDelivery";
import { dispatchGlobalPrayerEmails } from "./globalPrayerEmail";
import { duePrayerEvents } from "./schedule";
import {
  getSubscriberPreferences,
  subscribeByEmail,
  unsubscribeEmail,
  updateSubscriberPreferences,
  verifyEmailSubscription
} from "./subscribers";
import type { Env, Locale, PrayerFile } from "./types";

let cachedSchedule: { expiresAt: number; data: PrayerFile } | null = null;

function json(data: unknown, status = 200, headers: HeadersInit = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...headers }
  });
}

function corsHeaders(request: Request, env: Env) {
  const origin = request.headers.get("Origin");
  const allowed = origin && origin === env.ALLOWED_WEB_ORIGIN ? origin : "null";
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Admin-Bootstrap-Key",
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    Vary: "Origin"
  };
}

async function bodyJson(request: Request) {
  const length = Number(request.headers.get("Content-Length") ?? 0);
  if (length > 16_384) throw new Error("Request body is too large");
  return (await request.json()) as Record<string, unknown>;
}

function validInstallId(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{16,128}$/.test(value);
}

function validLocale(value: unknown): value is Locale {
  return value === "en" || value === "ar";
}

function webPreferences(value: unknown) {
  const preferences = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  return {
    twenty: preferences.twenty === true ? 1 : 0,
    ten: preferences.ten === true ? 1 : 0,
    athan: preferences.prayer === true || preferences.athan === true ? 1 : 0
  };
}

async function registerExpo(request: Request, env: Env) {
  const body = await bodyJson(request);
  const token = body.token;
  const platform = body.platform;
  if (!validInstallId(body.installationId)) return json({ error: "Invalid installationId" }, 400);
  if (typeof token !== "string" || !/^ExponentPushToken\[[^\]]+\]$|^ExpoPushToken\[[^\]]+\]$/.test(token)) {
    return json({ error: "Invalid Expo push token" }, 400);
  }
  if (platform !== "android" && platform !== "ios") return json({ error: "Invalid platform" }, 400);
  const locale = validLocale(body.locale) ? body.locale : "en";
  const prayerPushEnabled = platform === "android" ? 0 : 1;
  await env.DB.prepare(
    `INSERT INTO subscriptions (
       installation_id, provider, platform, locale, address, app_version,
       notify_twenty, notify_ten, notify_athan
     )
     VALUES (?, 'expo', ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(provider, address) DO UPDATE SET
       installation_id = excluded.installation_id,
       platform = excluded.platform,
       locale = excluded.locale,
       app_version = excluded.app_version,
       notify_twenty = excluded.notify_twenty,
       notify_ten = excluded.notify_ten,
       notify_athan = excluded.notify_athan,
       enabled = 1,
       updated_at = CURRENT_TIMESTAMP`
  ).bind(
    body.installationId,
    platform,
    locale,
    token,
    body.appVersion ?? null,
    prayerPushEnabled,
    prayerPushEnabled,
    prayerPushEnabled
  ).run();
  return json({ ok: true });
}

async function registerWeb(request: Request, env: Env) {
  const body = await bodyJson(request);
  const subscription = body.subscription as {
    endpoint?: unknown;
    keys?: { p256dh?: unknown; auth?: unknown };
  } | undefined;
  if (!validInstallId(body.installationId)) return json({ error: "Invalid installationId" }, 400);
  if (
    !subscription ||
    typeof subscription.endpoint !== "string" ||
    !subscription.endpoint.startsWith("https://") ||
    typeof subscription.keys?.p256dh !== "string" ||
    typeof subscription.keys.auth !== "string"
  ) {
    return json({ error: "Invalid web push subscription" }, 400);
  }
  const locale = validLocale(body.locale) ? body.locale : "en";
  const preferences = webPreferences(body.preferences);
  await env.DB.prepare(
    `INSERT INTO subscriptions (
       installation_id, provider, platform, locale, address, web_p256dh, web_auth,
       notify_twenty, notify_ten, notify_athan
     )
     VALUES (?, 'web', 'web', ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(provider, address) DO UPDATE SET
       installation_id = excluded.installation_id,
       locale = excluded.locale,
       web_p256dh = excluded.web_p256dh,
       web_auth = excluded.web_auth,
       notify_twenty = excluded.notify_twenty,
       notify_ten = excluded.notify_ten,
       notify_athan = excluded.notify_athan,
       enabled = 1,
       updated_at = CURRENT_TIMESTAMP`
  ).bind(
    body.installationId,
    locale,
    subscription.endpoint,
    subscription.keys.p256dh,
    subscription.keys.auth,
    preferences.twenty,
    preferences.ten,
    preferences.athan
  ).run();
  return json({ ok: true });
}

async function unsubscribe(request: Request, env: Env) {
  const body = await bodyJson(request);
  if (!validInstallId(body.installationId)) return json({ error: "Invalid installationId" }, 400);
  await env.DB.prepare(
    "UPDATE subscriptions SET enabled = 0, updated_at = CURRENT_TIMESTAMP WHERE installation_id = ?"
  ).bind(body.installationId).run();
  return json({ ok: true });
}

async function loadSchedule(env: Env) {
  if (cachedSchedule && cachedSchedule.expiresAt > Date.now()) return cachedSchedule.data;
  const response = await fetch(env.SCHEDULE_URL, { cf: { cacheTtl: 300, cacheEverything: true } });
  if (!response.ok) throw new Error(`Schedule fetch failed: ${response.status}`);
  const data = (await response.json()) as PrayerFile;
  if (!data.prayer_times) throw new Error("Schedule is missing prayer_times");
  cachedSchedule = { expiresAt: Date.now() + 300_000, data };
  return data;
}

async function runScheduled(env: Env, scheduledTime: number) {
  const schedule = await loadSchedule(env);
  const events = duePrayerEvents(schedule.prayer_times, new Date(scheduledTime));
  for (const event of events) await dispatchEvent(env, event);

  await dispatchDueAdminPushCampaigns(env);
  await dispatchDueAdminEmailCampaigns(env);

  await dispatchGlobalPrayerEmails(env, scheduledTime);
  await processEmailOutbox(env);
  await refreshAdminEmailCampaignStatuses(env);

  await env.DB.batch([
    env.DB.prepare("DELETE FROM deliveries WHERE created_at < datetime('now', '-60 days')"),
    env.DB.prepare("DELETE FROM email_outbox WHERE status IN ('sent', 'cancelled') AND created_at < datetime('now', '-90 days')"),
    env.DB.prepare("DELETE FROM location_prayer_cache WHERE prayer_date < date('now', '-45 days')"),
    env.DB.prepare("DELETE FROM admin_sessions WHERE expires_at < datetime('now', '-30 days')"),
    env.DB.prepare("DELETE FROM admin_password_resets WHERE consumed_at IS NOT NULL AND created_at < datetime('now', '-30 days')")
  ]);
}

export default {
  async fetch(request: Request, env: Env) {
    const url = new URL(request.url);
    const cors = corsHeaders(request, env);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    try {
      let response: Response;
      if (request.method === "GET" && url.pathname === "/health") {
        response = json({ ok: true, service: "wopt-prayer-push" });
      } else if (request.method === "GET" && url.pathname === "/config") {
        response = json({
          vapidPublicKey: env.VAPID_PUBLIC_KEY,
          emailSignup: true,
          emailDeliveryConfigured: emailDeliveryConfigured(env),
          automaticLocation: true
        });
      } else if (request.method === "POST" && url.pathname === "/subscriptions/expo") {
        response = await registerExpo(request, env);
      } else if (request.method === "POST" && url.pathname === "/subscriptions/web") {
        response = await registerWeb(request, env);
      } else if (request.method === "DELETE" && url.pathname === "/subscriptions") {
        response = await unsubscribe(request, env);
      } else if (request.method === "POST" && url.pathname === "/email/subscribers") {
        response = await subscribeByEmail(request, env);
      } else if (request.method === "GET" && url.pathname === "/email/subscribers/verify") {
        response = await verifyEmailSubscription(url, env);
      } else if (request.method === "GET" && url.pathname === "/email/subscribers/preferences") {
        response = await getSubscriberPreferences(url, env);
      } else if (request.method === "POST" && url.pathname === "/email/subscribers/preferences") {
        response = await updateSubscriberPreferences(request, env);
      } else if (request.method === "POST" && url.pathname === "/email/subscribers/unsubscribe") {
        response = await unsubscribeEmail(request, env);
      } else if (request.method === "POST" && url.pathname === "/admin/bootstrap") {
        response = await bootstrapAdmin(request, env);
      } else if (request.method === "POST" && url.pathname === "/admin/login") {
        response = await loginAdmin(request, env);
      } else if (request.method === "POST" && url.pathname === "/admin/logout") {
        response = await logoutAdmin(request, env);
      } else if (request.method === "GET" && url.pathname === "/admin/me") {
        response = await getAdminMe(request, env);
      } else if (request.method === "POST" && url.pathname === "/admin/password") {
        response = await changeAdminPassword(request, env);
      } else if (request.method === "POST" && url.pathname === "/admin/password/forgot") {
        response = await requestAdminPasswordReset(request, env);
      } else if (request.method === "POST" && url.pathname === "/admin/password/reset") {
        response = await resetAdminPassword(request, env);
      } else if (request.method === "GET" && url.pathname === "/admin/dashboard") {
        response = await getAdminDashboard(request, env);
      } else if (request.method === "GET" && url.pathname === "/admin/subscribers") {
        response = await listAdminSubscribers(request, env, url);
      } else if (request.method === "POST" && url.pathname === "/admin/push/campaigns") {
        response = await createAdminPushCampaign(request, env);
      } else if (request.method === "GET" && url.pathname === "/admin/push/campaigns") {
        response = await listAdminPushCampaigns(request, env);
      } else if (request.method === "POST" && url.pathname === "/admin/email/campaigns") {
        response = await createAdminEmailCampaign(request, env);
      } else if (request.method === "GET" && url.pathname === "/admin/email/campaigns") {
        response = await listAdminEmailCampaigns(request, env);
      } else {
        response = json({ error: "Not found" }, 404);
      }
      const headers = new Headers(response.headers);
      Object.entries(cors).forEach(([key, value]) => headers.set(key, value));
      return new Response(response.body, { status: response.status, headers });
    } catch (error) {
      console.error(error);
      return json({ error: "Request failed" }, 500, cors);
    }
  },

  async scheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(runScheduled(env, controller.scheduledTime));
  }
} satisfies ExportedHandler<Env>;
