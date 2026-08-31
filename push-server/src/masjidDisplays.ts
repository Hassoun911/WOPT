import type { Env } from "./types";

type JsonMap = Record<string, unknown>;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}

async function body(request: Request) {
  return await request.json() as JsonMap;
}

function clean(value: unknown, max = 80) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, max) : "";
}

function validDeviceId(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{12,80}$/.test(value);
}
function validCode(value: unknown): value is string {
  return typeof value === "string" && /^\d{6}$/.test(value);
}
function validSecret(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{20,160}$/.test(value);
}

function randomToken(bytesCount = 24) {
  const bytes = new Uint8Array(bytesCount);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");
}

function bearer(request: Request) {
  const value = request.headers.get("Authorization") || "";
  const match = /^Bearer\s+([A-Za-z0-9_-]{20,200})$/i.exec(value);
  return match?.[1] || "";
}

async function controllerAllowed(request: Request, env: Env, deviceId: string) {
  const token = bearer(request);
  if (!token) return false;
  const row = await env.DB.prepare("SELECT id FROM masjid_display_controllers WHERE device_id=? AND controller_token=?").bind(deviceId, token).first();
  if (!row) return false;
  await env.DB.prepare("UPDATE masjid_display_controllers SET last_seen_at=CURRENT_TIMESTAMP WHERE device_id=? AND controller_token=?").bind(deviceId, token).run();
  return true;
}

export async function handleMasjidDisplays(request: Request, env: Env, url: URL): Promise<Response | null> {
  if (!url.pathname.startsWith("/masjid-displays/")) return null;

  if (request.method === "POST" && url.pathname === "/masjid-displays/register") {
    const data = await body(request);
    if (!validDeviceId(data.deviceId) || !validCode(data.pairCode) || !validSecret(data.deviceSecret)) return json({ error: "Invalid display registration" }, 400);
    const existing = await env.DB.prepare("SELECT device_secret FROM masjid_displays WHERE device_id=?").bind(data.deviceId).first<{device_secret:string}>();
    if (existing && existing.device_secret !== data.deviceSecret) return json({ error: "Display secret mismatch" }, 403);
    const name = clean(data.name, 40) || "Masjid Display";
    const settings = data.settings && typeof data.settings === "object" ? JSON.stringify(data.settings) : "{}";
    if (existing) {
      await env.DB.prepare("UPDATE masjid_displays SET pair_code=?,name=?,settings_json=?,last_seen_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE device_id=?").bind(data.pairCode, name, settings, data.deviceId).run();
    } else {
      await env.DB.prepare("INSERT INTO masjid_displays (device_id,pair_code,device_secret,name,settings_json) VALUES (?,?,?,?,?)").bind(data.deviceId, data.pairCode, data.deviceSecret, name, settings).run();
    }
    return json({ ok: true, deviceId: data.deviceId, pairCode: data.pairCode, name });
  }

  if (request.method === "POST" && url.pathname === "/masjid-displays/pair") {
    const data = await body(request);
    if (!validCode(data.code)) return json({ error: "Enter the 6-digit code shown on the display" }, 400);
    const display = await env.DB.prepare("SELECT device_id,name,settings_json,revision FROM masjid_displays WHERE pair_code=?").bind(data.code).first<{device_id:string;name:string;settings_json:string;revision:number}>();
    if (!display) return json({ error: "Pairing code not found" }, 404);
    const token = randomToken(28);
    const controllerName = clean(data.controllerName, 50) || "Hassoun Browser";
    await env.DB.prepare("INSERT INTO masjid_display_controllers (device_id,controller_token,controller_name) VALUES (?,?,?)").bind(display.device_id, token, controllerName).run();
    let settings: unknown = {};
    try { settings = JSON.parse(display.settings_json || "{}"); } catch {}
    return json({ ok: true, deviceId: display.device_id, name: display.name, token, settings, revision: display.revision });
  }

  const deviceMatch = /^\/masjid-displays\/device\/([A-Za-z0-9_-]{12,80})$/.exec(url.pathname);
  if (deviceMatch && request.method === "GET") {
    const deviceId = deviceMatch[1];
    const secret = url.searchParams.get("secret") || "";
    const display = await env.DB.prepare("SELECT device_secret,name,settings_json,revision,pair_code FROM masjid_displays WHERE device_id=?").bind(deviceId).first<{device_secret:string;name:string;settings_json:string;revision:number;pair_code:string}>();
    if (!display || display.device_secret !== secret) return json({ error: "Display not found" }, 404);
    await env.DB.prepare("UPDATE masjid_displays SET last_seen_at=CURRENT_TIMESTAMP WHERE device_id=?").bind(deviceId).run();
    let settings: unknown = {};
    try { settings = JSON.parse(display.settings_json || "{}"); } catch {}
    return json({ ok: true, deviceId, name: display.name, settings, revision: display.revision, pairCode: display.pair_code });
  }

  const controlMatch = /^\/masjid-displays\/control\/([A-Za-z0-9_-]{12,80})$/.exec(url.pathname);
  if (controlMatch && request.method === "GET") {
    const deviceId = controlMatch[1];
    if (!(await controllerAllowed(request, env, deviceId))) return json({ error: "Not paired" }, 401);
    const display = await env.DB.prepare("SELECT name,settings_json,revision,last_seen_at FROM masjid_displays WHERE device_id=?").bind(deviceId).first<{name:string;settings_json:string;revision:number;last_seen_at:string}>();
    if (!display) return json({ error: "Display not found" }, 404);
    let settings: unknown = {};
    try { settings = JSON.parse(display.settings_json || "{}"); } catch {}
    return json({ ok: true, deviceId, name: display.name, settings, revision: display.revision, lastSeenAt: display.last_seen_at });
  }

  if (controlMatch && request.method === "POST") {
    const deviceId = controlMatch[1];
    if (!(await controllerAllowed(request, env, deviceId))) return json({ error: "Not paired" }, 401);
    const data = await body(request);
    const fields: string[] = [];
    const values: unknown[] = [];
    if (data.name !== undefined) { fields.push("name=?"); values.push(clean(data.name, 40) || "Masjid Display"); }
    if (data.settings && typeof data.settings === "object") { fields.push("settings_json=?"); values.push(JSON.stringify(data.settings)); }
    if (!fields.length) return json({ error: "Nothing to update" }, 400);
    fields.push("revision=revision+1", "updated_at=CURRENT_TIMESTAMP");
    await env.DB.prepare(`UPDATE masjid_displays SET ${fields.join(",")} WHERE device_id=?`).bind(...values, deviceId).run();
    return json({ ok: true });
  }

  return json({ error: "Not found" }, 404);
}
