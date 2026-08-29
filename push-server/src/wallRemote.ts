import type { Env } from "./types";

const PAIR_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const PAIR_TTL_MINUTES = 15;
const MAX_SETTINGS_BYTES = 64_000;
const MAX_STATUS_BYTES = 16_000;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

function validInstallationId(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{16,128}$/.test(value);
}

function cleanName(value: unknown, fallback: string) {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim().slice(0, 64);
  return trimmed || fallback;
}

function randomToken(bytes = 32) {
  const values = new Uint8Array(bytes);
  crypto.getRandomValues(values);
  return Array.from(values, (value) => value.toString(16).padStart(2, "0")).join("");
}

function randomPairCode() {
  const values = new Uint8Array(6);
  crypto.getRandomValues(values);
  return Array.from(values, (value) => PAIR_ALPHABET[value % PAIR_ALPHABET.length]).join("");
}

async function parseBody(request: Request, maxBytes: number) {
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > maxBytes) throw new Error("Request body is too large");
  if (!text) return {} as Record<string, unknown>;
  return JSON.parse(text) as Record<string, unknown>;
}

function bearer(request: Request) {
  const header = request.headers.get("Authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(header);
  return match?.[1]?.trim() ?? "";
}

async function displayByDeviceToken(request: Request, env: Env) {
  const token = bearer(request);
  if (!/^[a-f0-9]{64}$/i.test(token)) return null;
  return env.DB.prepare(
    `SELECT id, installation_id, name, device_token, pairing_code, pairing_expires_at,
            settings_json, settings_version, command_json, command_version, status_json,
            last_seen_at, updated_at
       FROM wall_displays WHERE device_token = ?`
  ).bind(token).first<Record<string, unknown>>();
}

async function displayByControllerToken(request: Request, env: Env) {
  const token = bearer(request);
  if (!/^[a-f0-9]{64}$/i.test(token)) return null;
  return env.DB.prepare(
    `SELECT d.id, d.installation_id, d.name, d.settings_json, d.settings_version,
            d.command_json, d.command_version, d.status_json, d.last_seen_at, d.updated_at,
            c.id AS controller_id, c.controller_name
       FROM wall_controllers c
       JOIN wall_displays d ON d.id = c.display_id
      WHERE c.controller_token = ?`
  ).bind(token).first<Record<string, unknown>>();
}

function parsedJson(value: unknown) {
  if (typeof value !== "string" || !value) return {};
  try { return JSON.parse(value); } catch { return {}; }
}

function publicDisplay(row: Record<string, unknown>) {
  return {
    id: Number(row.id),
    name: String(row.name ?? "Hassoun Wall Display"),
    settings: parsedJson(row.settings_json),
    settingsVersion: Number(row.settings_version ?? 0),
    status: parsedJson(row.status_json),
    lastSeenAt: row.last_seen_at ?? null,
    updatedAt: row.updated_at ?? null
  };
}

export async function registerWallDisplay(request: Request, env: Env) {
  const body = await parseBody(request, MAX_SETTINGS_BYTES);
  if (!validInstallationId(body.installationId)) return json({ error: "Invalid installationId" }, 400);

  const existing = await env.DB.prepare(
    "SELECT id, device_token FROM wall_displays WHERE installation_id = ?"
  ).bind(body.installationId).first<{ id: number; device_token: string }>();

  const suppliedToken = typeof body.deviceToken === "string" ? body.deviceToken : "";
  if (existing && suppliedToken && suppliedToken !== existing.device_token) {
    return json({ error: "Device authentication failed" }, 401);
  }

  const deviceToken = existing?.device_token ?? randomToken();
  const pairCode = randomPairCode();
  const name = cleanName(body.name, "Hassoun Wall Display");
  const settings = body.settings && typeof body.settings === "object" ? body.settings : {};
  const settingsJson = JSON.stringify(settings);
  if (new TextEncoder().encode(settingsJson).byteLength > MAX_SETTINGS_BYTES) return json({ error: "Settings too large" }, 413);

  await env.DB.prepare(
    `INSERT INTO wall_displays (
       installation_id, name, device_token, pairing_code, pairing_expires_at,
       settings_json, settings_version, last_seen_at, updated_at
     ) VALUES (?, ?, ?, ?, datetime('now', '+${PAIR_TTL_MINUTES} minutes'), ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
     ON CONFLICT(installation_id) DO UPDATE SET
       name = excluded.name,
       pairing_code = excluded.pairing_code,
       pairing_expires_at = excluded.pairing_expires_at,
       settings_json = CASE WHEN excluded.settings_json != '{}' THEN excluded.settings_json ELSE wall_displays.settings_json END,
       settings_version = CASE WHEN excluded.settings_json != '{}' THEN wall_displays.settings_version + 1 ELSE wall_displays.settings_version END,
       last_seen_at = CURRENT_TIMESTAMP,
       updated_at = CURRENT_TIMESTAMP`
  ).bind(body.installationId, name, deviceToken, pairCode, settingsJson).run();

  const row = await env.DB.prepare(
    "SELECT id, name, pairing_code, pairing_expires_at, settings_json, settings_version, status_json, last_seen_at, updated_at FROM wall_displays WHERE installation_id = ?"
  ).bind(body.installationId).first<Record<string, unknown>>();
  if (!row) return json({ error: "Display registration failed" }, 500);

  return json({
    ok: true,
    display: publicDisplay(row),
    deviceToken,
    pairingCode: row.pairing_code,
    pairingExpiresAt: row.pairing_expires_at
  });
}

export async function refreshWallPairing(request: Request, env: Env) {
  const row = await displayByDeviceToken(request, env);
  if (!row) return json({ error: "Unauthorized" }, 401);
  const pairCode = randomPairCode();
  await env.DB.prepare(
    `UPDATE wall_displays
        SET pairing_code = ?, pairing_expires_at = datetime('now', '+${PAIR_TTL_MINUTES} minutes'), updated_at = CURRENT_TIMESTAMP
      WHERE id = ?`
  ).bind(pairCode, row.id).run();
  return json({ ok: true, pairingCode: pairCode, pairingExpiresInMinutes: PAIR_TTL_MINUTES });
}

export async function pairWallController(request: Request, env: Env) {
  const body = await parseBody(request, 8_000);
  const code = typeof body.pairingCode === "string" ? body.pairingCode.trim().toUpperCase() : "";
  if (!/^[A-Z2-9]{6}$/.test(code)) return json({ error: "Invalid pairing code" }, 400);
  if (!validInstallationId(body.controllerInstallationId)) return json({ error: "Invalid controllerInstallationId" }, 400);

  const display = await env.DB.prepare(
    `SELECT * FROM wall_displays
      WHERE pairing_code = ? AND pairing_expires_at IS NOT NULL AND pairing_expires_at > CURRENT_TIMESTAMP`
  ).bind(code).first<Record<string, unknown>>();
  if (!display) return json({ error: "Pairing code expired or not found" }, 404);

  const controllerToken = randomToken();
  const controllerName = cleanName(body.controllerName, "Hassoun Controller");
  await env.DB.prepare(
    `INSERT INTO wall_controllers (display_id, controller_installation_id, controller_token, controller_name, last_seen_at)
     VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(display_id, controller_installation_id) DO UPDATE SET
       controller_token = excluded.controller_token,
       controller_name = excluded.controller_name,
       last_seen_at = CURRENT_TIMESTAMP`
  ).bind(display.id, body.controllerInstallationId, controllerToken, controllerName).run();

  // A used code is rotated immediately so it cannot be shared accidentally.
  const nextCode = randomPairCode();
  await env.DB.prepare(
    `UPDATE wall_displays
        SET pairing_code = ?, pairing_expires_at = datetime('now', '+${PAIR_TTL_MINUTES} minutes'), updated_at = CURRENT_TIMESTAMP
      WHERE id = ?`
  ).bind(nextCode, display.id).run();

  return json({ ok: true, controllerToken, display: publicDisplay(display) });
}

export async function getWallControllerState(request: Request, env: Env) {
  const row = await displayByControllerToken(request, env);
  if (!row) return json({ error: "Unauthorized" }, 401);
  await env.DB.prepare("UPDATE wall_controllers SET last_seen_at = CURRENT_TIMESTAMP WHERE id = ?").bind(row.controller_id).run();
  return json({ ok: true, display: publicDisplay(row) });
}

export async function updateWallControllerSettings(request: Request, env: Env) {
  const row = await displayByControllerToken(request, env);
  if (!row) return json({ error: "Unauthorized" }, 401);
  const body = await parseBody(request, MAX_SETTINGS_BYTES);
  if (!body.settings || typeof body.settings !== "object") return json({ error: "settings object required" }, 400);
  const settingsJson = JSON.stringify(body.settings);
  if (new TextEncoder().encode(settingsJson).byteLength > MAX_SETTINGS_BYTES) return json({ error: "Settings too large" }, 413);
  await env.DB.batch([
    env.DB.prepare(
      `UPDATE wall_displays SET settings_json = ?, settings_version = settings_version + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
    ).bind(settingsJson, row.id),
    env.DB.prepare("UPDATE wall_controllers SET last_seen_at = CURRENT_TIMESTAMP WHERE id = ?").bind(row.controller_id)
  ]);
  return json({ ok: true, settingsVersion: Number(row.settings_version ?? 0) + 1 });
}

export async function sendWallControllerCommand(request: Request, env: Env) {
  const row = await displayByControllerToken(request, env);
  if (!row) return json({ error: "Unauthorized" }, 401);
  const body = await parseBody(request, 8_000);
  const command = typeof body.command === "string" ? body.command.trim() : "";
  const allowed = new Set([
    "test_notification", "test_adhan", "enable_alerts", "refresh_prayers", "show_next_prayer",
    "resume_auto", "dim_now", "wake_now", "lock_designer", "unlock_designer"
  ]);
  if (!allowed.has(command)) return json({ error: "Unsupported command" }, 400);
  const payload = body.payload && typeof body.payload === "object" ? body.payload : {};
  const commandJson = JSON.stringify({ command, payload, sentAt: new Date().toISOString() });
  await env.DB.prepare(
    `UPDATE wall_displays SET command_json = ?, command_version = command_version + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
  ).bind(commandJson, row.id).run();
  return json({ ok: true, commandVersion: Number(row.command_version ?? 0) + 1 });
}

export async function getWallDeviceSync(request: Request, env: Env) {
  const row = await displayByDeviceToken(request, env);
  if (!row) return json({ error: "Unauthorized" }, 401);
  await env.DB.prepare("UPDATE wall_displays SET last_seen_at = CURRENT_TIMESTAMP WHERE id = ?").bind(row.id).run();
  return json({
    ok: true,
    settings: parsedJson(row.settings_json),
    settingsVersion: Number(row.settings_version ?? 0),
    command: parsedJson(row.command_json),
    commandVersion: Number(row.command_version ?? 0),
    pairingCode: row.pairing_code,
    pairingExpiresAt: row.pairing_expires_at
  });
}

export async function updateWallDeviceStatus(request: Request, env: Env) {
  const row = await displayByDeviceToken(request, env);
  if (!row) return json({ error: "Unauthorized" }, 401);
  const body = await parseBody(request, MAX_STATUS_BYTES);
  const status = body.status && typeof body.status === "object" ? body.status : {};
  const statusJson = JSON.stringify(status);
  await env.DB.prepare(
    "UPDATE wall_displays SET status_json = ?, last_seen_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
  ).bind(statusJson, row.id).run();
  return json({ ok: true });
}

export async function publishWallDeviceSettings(request: Request, env: Env) {
  const row = await displayByDeviceToken(request, env);
  if (!row) return json({ error: "Unauthorized" }, 401);
  const body = await parseBody(request, MAX_SETTINGS_BYTES);
  if (!body.settings || typeof body.settings !== "object") return json({ error: "settings object required" }, 400);
  const settingsJson = JSON.stringify(body.settings);
  await env.DB.prepare(
    `UPDATE wall_displays SET settings_json = ?, settings_version = settings_version + 1,
      last_seen_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
  ).bind(settingsJson, row.id).run();
  return json({ ok: true });
}

export async function revokeWallController(request: Request, env: Env) {
  const row = await displayByControllerToken(request, env);
  if (!row) return json({ error: "Unauthorized" }, 401);
  await env.DB.prepare("DELETE FROM wall_controllers WHERE id = ?").bind(row.controller_id).run();
  return json({ ok: true });
}
