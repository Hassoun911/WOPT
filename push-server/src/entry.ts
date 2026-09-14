import app from "./index";
import { getAlexaContext } from "./alexaData";
import { autoSyncPrayerSchedule, handleAdminPrayerSchedule } from "./adminPrayerSchedule";
import type { Env } from "./types";

const handler: ExportedHandler<Env> = {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Keep the Alexa voice endpoint permanent at the Worker entry point.
    // Several legacy deployment workflows deploy the Worker without running
    // the route-patching scripts, which could remove this route and make the
    // Alexa Lambda receive a 404. Intercept it here before delegating every
    // other request to the existing Worker.
    if (request.method === "GET" && url.pathname === "/voice/alexa/context") {
      return getAlexaContext(request, env);
    }

    // Prayer schedule admin is also routed here so it stays available even if
    // older generated Worker bundles are deployed by legacy workflows.
    if (url.pathname === "/admin/prayer-schedule") {
      return handleAdminPrayerSchedule(request, env, url);
    }

    if (!app.fetch) return new Response(JSON.stringify({ error: "Worker fetch handler unavailable" }), { status: 500, headers: { "Content-Type": "application/json" } });
    return app.fetch(request, env);
  },

  async scheduled(controller, env, ctx) {
    ctx.waitUntil(autoSyncPrayerSchedule(env, controller.scheduledTime));
    if (app.scheduled) await app.scheduled(controller, env, ctx);
  }
};

export default handler;
