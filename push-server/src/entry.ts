import app from "./index";
import { getAlexaContext } from "./alexaData";
import { autoSyncPrayerSchedule, handleAdminPrayerSchedule } from "./adminPrayerSchedule";
import { handleLocationUsage } from "./locationUsage";
import { applyLinkedAlexaLocation, handleVoiceAccounts } from "./voiceAccounts";
import type { Env } from "./types";

function voiceCors(request: Request, env: Env, response: Response) {
  const origin = request.headers.get("origin");
  const allowed = env.ALLOWED_WEB_ORIGIN || "https://hassoun.app";
  const headers = new Headers(response.headers);
  if (origin && (origin === allowed || origin === "https://hassoun.app")) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Vary", "Origin");
  }
  headers.set("Access-Control-Allow-Headers", "Authorization, Content-Type");
  headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

async function alexaDashboardArtwork(): Promise<Response> {
  const source = "https://raw.githubusercontent.com/Hassoun911/WOPT/main/integrations/alexa/assets/dashboard-bg.b64";
  const upstream = await fetch(source, { cf: { cacheTtl: 86400, cacheEverything: true } as never });
  if (!upstream.ok) return new Response("Alexa dashboard artwork unavailable", { status: 502 });
  const encoded = (await upstream.text()).trim();
  const binary = atob(encoded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new Response(bytes, {
    status: 200,
    headers: {
      "Content-Type": "image/jpeg",
      "Cache-Control": "public, max-age=86400, s-maxage=86400",
      "Access-Control-Allow-Origin": "*"
    }
  });
}

const handler: ExportedHandler<Env> = {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Public HTTPS artwork endpoint for Alexa APL. APL image components do not
    // reliably render data: URLs, so serve the approved dashboard as image/jpeg.
    if (request.method === "GET" && url.pathname === "/voice/alexa/dashboard.jpg") {
      return alexaDashboardArtwork();
    }

    // Hassoun voice-account/OAuth endpoints. These power passwordless account
    // linking plus saved prayer locations and per-Echo location assignments.
    if (url.pathname.startsWith("/oauth/alexa/") || url.pathname.startsWith("/voice/account")) {
      if (request.method === "OPTIONS") return voiceCors(request, env, new Response(null, { status: 204 }));
      const response = await handleVoiceAccounts(request, env);
      if (response) return voiceCors(request, env, response);
    }

    // Keep the Alexa voice endpoint permanent at the Worker entry point.
    if (request.method === "GET" && url.pathname === "/voice/alexa/context") {
      // If Alexa provided a linked Hassoun access token, resolve the saved
      // per-device location first. Unlinked/legacy installs keep Windsor as a
      // backward-compatible default until the customer links an account.
      const linkedRequest = await applyLinkedAlexaLocation(request, env);
      const linkedUrl = new URL(linkedRequest.url);
      if (!linkedUrl.searchParams.has("latitude") && !linkedUrl.searchParams.has("longitude")) {
        linkedUrl.searchParams.set("latitude", "42.3149");
        linkedUrl.searchParams.set("longitude", "-83.0364");
        linkedUrl.searchParams.set("timezone", "America/Toronto");
        if (!linkedUrl.searchParams.has("location")) linkedUrl.searchParams.set("location", "Windsor, Ontario");
      }
      return getAlexaContext(new Request(linkedUrl.toString(), linkedRequest), env);
    }

    // Anonymous/coarse location coverage. This stores only 0.1-degree buckets
    // and aggregate usage counts; it never stores a device ID, email or IP.
    if (url.pathname === "/location-usage" || url.pathname === "/admin/location-usage") {
      return handleLocationUsage(request, env);
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