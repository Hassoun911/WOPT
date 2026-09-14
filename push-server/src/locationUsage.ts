import { requireAdmin } from "./adminAuth";
import type { Env } from "./types";

type UsageBody = {
  latitude?: unknown;
  longitude?: unknown;
  timezone?: unknown;
  placeLabel?: unknown;
  city?: unknown;
  region?: unknown;
  countryName?: unknown;
  platform?: unknown;
};

function json(data: unknown, status = 200, request?: Request, env?: Env) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (request && env) {
    const origin = request.headers.get("Origin");
    headers["Access-Control-Allow-Origin"] = origin && origin === env.ALLOWED_WEB_ORIGIN ? origin : "*";
    headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization";
    headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS";
    headers.Vary = "Origin";
  }
  return new Response(JSON.stringify(data), { status, headers });
}

function text(value: unknown, max = 120) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function normalizePlatform(value: unknown) {
  const v = text(value, 16).toLowerCase();
  return v === "mobile" || v === "web" || v === "alexa" ? v : "other";
}

function rounded(value: number) {
  return Math.round(value * 10) / 10;
}

function locationKey(latitude: number, longitude: number, timezone: string) {
  return `geo:${rounded(latitude).toFixed(1)},${rounded(longitude).toFixed(1)}|${timezone}`;
}

export async function handleLocationUsage(request: Request, env: Env) {
  if (request.method === "OPTIONS") return json({ ok: true }, 200, request, env);

  if (request.method === "POST") {
    const length = Number(request.headers.get("Content-Length") || 0);
    if (length > 4096) return json({ error: "Payload too large" }, 413, request, env);
    const body = await request.json().catch(() => ({})) as UsageBody;
    const latitude = Number(body.latitude);
    const longitude = Number(body.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
      return json({ error: "Invalid location" }, 400, request, env);
    }

    const timezone = text(body.timezone, 80) || "UTC";
    const placeLabel = text(body.placeLabel, 140);
    const city = text(body.city, 80);
    const region = text(body.region, 80);
    const countryName = text(body.countryName, 80);
    const platform = normalizePlatform(body.platform);
    const key = locationKey(latitude, longitude, timezone);
    const latBucket = rounded(latitude);
    const lonBucket = rounded(longitude);
    const mobile = platform === "mobile" ? 1 : 0;
    const web = platform === "web" ? 1 : 0;
    const alexa = platform === "alexa" ? 1 : 0;

    await env.DB.prepare(`
      INSERT INTO app_location_usage (
        location_key, latitude_bucket, longitude_bucket, timezone,
        place_label, city, region, country_name,
        hit_count, mobile_hits, web_hits, alexa_hits
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)
      ON CONFLICT(location_key) DO UPDATE SET
        place_label = CASE WHEN excluded.place_label <> '' THEN excluded.place_label ELSE app_location_usage.place_label END,
        city = CASE WHEN excluded.city <> '' THEN excluded.city ELSE app_location_usage.city END,
        region = CASE WHEN excluded.region <> '' THEN excluded.region ELSE app_location_usage.region END,
        country_name = CASE WHEN excluded.country_name <> '' THEN excluded.country_name ELSE app_location_usage.country_name END,
        last_seen = CURRENT_TIMESTAMP,
        hit_count = app_location_usage.hit_count + 1,
        mobile_hits = app_location_usage.mobile_hits + excluded.mobile_hits,
        web_hits = app_location_usage.web_hits + excluded.web_hits,
        alexa_hits = app_location_usage.alexa_hits + excluded.alexa_hits
    `).bind(key, latBucket, lonBucket, timezone, placeLabel, city, region, countryName, mobile, web, alexa).run();

    return json({ ok: true }, 200, request, env);
  }

  if (request.method === "GET") {
    const auth = await requireAdmin(request, env);
    if (!auth.admin) return auth.response!;

    const [stats, top] = await Promise.all([
      env.DB.prepare(`
        SELECT
          COUNT(*) total,
          SUM(CASE WHEN last_seen >= datetime('now','-15 minutes') THEN 1 ELSE 0 END) live,
          SUM(CASE WHEN last_seen >= datetime('now','-24 hours') THEN 1 ELSE 0 END) today,
          SUM(CASE WHEN last_seen >= datetime('now','-30 days') THEN 1 ELSE 0 END) active30d,
          SUM(CASE WHEN last_seen < datetime('now','-30 days') THEN 1 ELSE 0 END) historical,
          SUM(CASE WHEN mobile_hits > 0 THEN 1 ELSE 0 END) mobile,
          SUM(CASE WHEN web_hits > 0 THEN 1 ELSE 0 END) web,
          SUM(CASE WHEN alexa_hits > 0 THEN 1 ELSE 0 END) alexa,
          SUM(hit_count) observations
        FROM app_location_usage
      `).first<Record<string, number>>(),
      env.DB.prepare(`
        SELECT location_key, latitude_bucket, longitude_bucket, timezone,
               place_label, city, region, country_name,
               first_seen, last_seen, hit_count, mobile_hits, web_hits, alexa_hits, legacy_hits
        FROM app_location_usage
        ORDER BY last_seen DESC, hit_count DESC
        LIMIT 20
      `).all<Record<string, unknown>>()
    ]);

    return json({ ok: true, stats: stats || {}, locations: top.results || [] }, 200, request, env);
  }

  return json({ error: "Method not allowed" }, 405, request, env);
}
