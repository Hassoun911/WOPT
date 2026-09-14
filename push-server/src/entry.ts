import app from "./index";
import { getAlexaContext } from "./alexaData";
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

    if (!app.fetch) return new Response(JSON.stringify({ error: "Worker fetch handler unavailable" }), { status: 500, headers: { "Content-Type": "application/json" } });
    return app.fetch(request, env);
  },

  async scheduled(controller, env, ctx) {
    if (app.scheduled) await app.scheduled(controller, env, ctx);
  }
};

export default handler;
