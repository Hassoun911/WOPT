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
      // Existing Alexa installs still call this route with no location profile.
      // Preserve Windsor as the legacy default, while allowing linked Hassoun
      // accounts/devices to pass their own latitude, longitude and timezone.
      if (!url.searchParams.has("latitude") && !url.searchParams.has("longitude")) {
        url.searchParams.set("latitude", "42.3149");
        url.searchParams.set("longitude", "-83.0364");
        url.searchParams.set("timezone", "America/Toronto");
        if (!url.searchParams.has("location")) url.searchParams.set("location", "Windsor, Ontario");
      }
      return getAlexaContext(new Request(url.toString(), request), env);
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
