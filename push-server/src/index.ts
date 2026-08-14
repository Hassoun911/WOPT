import { dispatchEvent } from "./dispatch";
import { duePrayerEvents } from "./schedule";
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
    "Access-Control-Allow-Headers": "Content-Type",
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
  await env.DB.prepare(
    `INSERT INTO subscriptions (installation_id, provider, platform, locale, address, app_version)
     VALUES (?, 'expo', ?, ?, ?, ?)
     ON CONFLICT(provider, address) DO UPDATE SET
       installation_id = excluded.installation_id,
       platform = excluded.platform,
       locale = excluded.locale,
       app_version = excluded.app_version,
       enabled = 1,
       updated_at = CURRENT_TIMESTAMP`
  ).bind(body.installationId, platform, locale, token, body.appVersion ?? null).run();
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
  await env.DB.prepare(
    `INSERT INTO subscriptions (installation_id, provider, platform, locale, address, web_p256dh, web_auth)
     VALUES (?, 'web', 'web', ?, ?, ?, ?)
     ON CONFLICT(provider, address) DO UPDATE SET
       installation_id = excluded.installation_id,
       locale = excluded.locale,
       web_p256dh = excluded.web_p256dh,
       web_auth = excluded.web_auth,
       enabled = 1,
       updated_at = CURRENT_TIMESTAMP`
  ).bind(body.installationId, locale, subscription.endpoint, subscription.keys.p256dh, subscription.keys.auth).run();
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
  await env.DB.prepare("DELETE FROM deliveries WHERE created_at < datetime('now', '-60 days')").run();
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
        response = json({ vapidPublicKey: env.VAPID_PUBLIC_KEY });
      } else if (request.method === "POST" && url.pathname === "/subscriptions/expo") {
        response = await registerExpo(request, env);
      } else if (request.method === "POST" && url.pathname === "/subscriptions/web") {
        response = await registerWeb(request, env);
      } else if (request.method === "DELETE" && url.pathname === "/subscriptions") {
        response = await unsubscribe(request, env);
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
