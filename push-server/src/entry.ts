import worker from "./index";
import type { Env } from "./types";

const ADMIN_ORIGINS = new Set([
  "https://admin.hassoun.app",
  "https://hassoun-admin-crm.vercel.app"
]);

const BACKEND_VERSION = "reset-fix-2026-08-20-1";

function withAdminCors(request: Request, response: Response, env: Env) {
  const origin = request.headers.get("Origin");
  if (!origin || (origin !== env.ALLOWED_WEB_ORIGIN && !ADMIN_ORIGINS.has(origin))) {
    return response;
  }

  const headers = new Headers(response.headers);
  headers.set("Access-Control-Allow-Origin", origin);
  headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Admin-Bootstrap-Key");
  headers.set("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  headers.set("Vary", "Origin");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

export default {
  async fetch(request: Request, env: Env) {
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/health") {
      return withAdminCors(
        request,
        Response.json({ ok: true, service: "wopt-prayer-push", backendVersion: BACKEND_VERSION }),
        env
      );
    }

    const response = await worker.fetch(request, env);
    return withAdminCors(request, response, env);
  },

  async scheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext) {
    return worker.scheduled(controller, env, ctx);
  }
} satisfies ExportedHandler<Env>;
