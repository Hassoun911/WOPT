import worker from "./index";
import { recordSubscriberActivity } from "./activity";
import { getLocationPrayerTimes } from "./locationPrayer";
import type { Env } from "./types";

const ADMIN_ORIGINS = new Set([
  "https://admin.hassoun.app",
  "https://hassoun-admin-crm.vercel.app"
]);
const PUBLIC_ORIGINS = new Set([
  "https://hassoun.app",
  "https://www.hassoun.app",
  "https://hassoun911.github.io"
]);

const BACKEND_VERSION = "gps-prayer-email-activity-2026-08-20-2";

function allowedOrigin(request: Request, env: Env) {
  const origin = request.headers.get("Origin");
  if (!origin) return null;
  const configured = [env.ALLOWED_WEB_ORIGIN, env.PUBLIC_APP_URL?.replace(/\/$/, "")].filter(Boolean);
  if (configured.includes(origin) || ADMIN_ORIGINS.has(origin) || PUBLIC_ORIGINS.has(origin)) return origin;
  try {
    const url = new URL(origin);
    if (url.protocol === "https:" && url.hostname.endsWith(".vercel.app") && url.hostname.startsWith("hassoun-admin-")) return origin;
  } catch {}
  return null;
}

function withCors(request: Request, response: Response, env: Env) {
  const origin = allowedOrigin(request, env);
  if (!origin) return response;
  const headers = new Headers(response.headers);
  headers.set("Access-Control-Allow-Origin", origin);
  headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Admin-Bootstrap-Key");
  headers.set("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  headers.set("Vary", "Origin");
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

export default {
  async fetch(request: Request, env: Env) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS" && ["/prayer-times", "/activity"].includes(url.pathname)) {
      const origin = allowedOrigin(request, env);
      return new Response(null, { status: 204, headers: origin ? {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        Vary: "Origin"
      } : {} });
    }
    if (request.method === "GET" && url.pathname === "/health") {
      return withCors(request, Response.json({ ok: true, service: "wopt-prayer-push", backendVersion: BACKEND_VERSION }), env);
    }
    if (request.method === "GET" && url.pathname === "/prayer-times") {
      try {
        return withCors(request, await getLocationPrayerTimes(url, env), env);
      } catch (error) {
        console.error("GPS prayer time request failed", error);
        return withCors(request, Response.json({ error: "Prayer times unavailable" }, { status: 502 }), env);
      }
    }
    if (request.method === "POST" && url.pathname === "/activity") {
      try {
        return withCors(request, await recordSubscriberActivity(request, env), env);
      } catch (error) {
        console.error("Activity tracking failed", error);
        return withCors(request, Response.json({ error: "Activity unavailable" }, { status: 500 }), env);
      }
    }
    return withCors(request, await worker.fetch(request, env), env);
  },

  async scheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext) {
    return worker.scheduled(controller, env, ctx);
  }
} satisfies ExportedHandler<Env>;
