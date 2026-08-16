import type { Env, Locale, PrayerKey } from "./types";

const PRAYERS: PrayerKey[] = ["fajr", "dhuhr", "asr", "maghrib", "isha"];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function response(data: unknown, status = 200, headers: HeadersInit = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...headers }
  });
}

async function bodyJson(request: Request) {
  const length = Number(request.headers.get("Content-Length") ?? 0);
  if (length > 32_768) throw new Error("Request body is too large");
  return (await request.json()) as Record<string, unknown>;
}

function normalizeEmail(value: unknown) {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  return email.length <= 254 && EMAIL_RE.test(email) ? email : null;
}

function cleanText(value: unknown, max: number) {
  if (typeof value !== "string") return null;
  const text = value.trim().replace(/\s+/g, " ");
  return text && text.length <= max ? text : null;
}

function validLocale(value: unknown): Locale {
  return value === "ar" ? "ar" : "en";
}

function validTimezone(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 80) return false;
  try {
    new Intl.DateTimeFormat("en", { timeZone: value }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

function coordinate(value: unknown, min: number, max: number) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) return null;
  return value;
}

function countryCode(value: unknown) {
  if (typeof value !== "string") return null;
  const code = value.trim().toUpperCase();
  return /^[A-Z]{2}$/.test(code) ? code : null;
}

function base64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function hmacToken(secret: string, input: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(input));
  return base64Url(new Uint8Array(signature));
}

async function sha256Hex(input: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function linkSecret(env: Env) {
  // A dedicated secret is preferred, but the already-private stable VAPID key
  // keeps signup/manage links functional until EMAIL_LINK_SECRET is configured.
  return env.EMAIL_LINK_SECRET || env.VAPID_PRIVATE_KEY;
}

function publicAppUrl(env: Env) {
  return (env.PUBLIC_APP_URL || "https://hassoun911.github.io/WOPT/").replace(/\/$/, "");
}

function publicApiUrl(env: Env) {
  return (env.PUBLIC_API_URL || "https://wopt-prayer-push.wopt-windsor.workers.dev").replace(/\/$/, "");
}

async function manageToken(env: Env, publicId: string, email: string) {
  return hmacToken(linkSecret(env), `manage|${publicId}|${email}`);
}

async function verificationToken(env: Env, publicId: string, email: string, expiresAt: string) {
  return hmacToken(linkSecret(env), `verify|${publicId}|${email}|${expiresAt}`);
}

export async function subscriberManageUrl(env: Env, publicId: string, email: string) {
  const token = await manageToken(env, publicId, email);
  return `${publicAppUrl(env)}/?emailManage=${encodeURIComponent(publicId)}&token=${encodeURIComponent(token)}`;
}

function preferenceFlag(value: unknown, fallback: number) {
  return value === true ? 1 : value === false ? 0 : fallback;
}

function prayerPreferences(body: Record<string, unknown>) {
  const raw = body.prayers && typeof body.prayers === "object"
    ? body.prayers as Record<string, unknown>
    : {};
  return PRAYERS.map((prayer) => {
    const prefs = raw[prayer] && typeof raw[prayer] === "object"
      ? raw[prayer] as Record<string, unknown>
      : {};
    return {
      prayer,
      twenty: preferenceFlag(prefs.twenty, 0),
      ten: preferenceFlag(prefs.ten, 0),
      athan: preferenceFlag(prefs.athan, 1)
    };
  });
}

function generalPreferences(body: Record<string, unknown>) {
  const prefs = body.preferences && typeof body.preferences === "object"
    ? body.preferences as Record<string, unknown>
    : {};
  return {
    prayerAlerts: preferenceFlag(prefs.prayerAlerts, 1),
    dailyPrayerSchedule: preferenceFlag(prefs.dailyPrayerSchedule, 0),
    religiousOccasions: preferenceFlag(prefs.religiousOccasions, 1),
    dailyContent: preferenceFlag(prefs.dailyContent, 0),
    announcements: preferenceFlag(prefs.announcements, 1),
    communityEvents: preferenceFlag(prefs.communityEvents, 1),
    marketing: preferenceFlag(prefs.marketing, 0)
  };
}

async function queueVerification(
  env: Env,
  subscriberId: number,
  publicId: string,
  email: string,
  locale: Locale,
  expiresAt: string
) {
  const token = await verificationToken(env, publicId, email, expiresAt);
  const verifyUrl = `${publicApiUrl(env)}/email/subscribers/verify?id=${encodeURIComponent(publicId)}&token=${encodeURIComponent(token)}`;
  await env.DB.prepare(
    `INSERT INTO email_outbox (
       subscriber_id, recipient_email, locale, kind, template_key, template_data_json
     ) VALUES (?, ?, ?, 'verification', 'subscriber_verification', ?)`
  ).bind(
    subscriberId,
    email,
    locale,
    JSON.stringify({ verificationUrl: verifyUrl, expiresAt })
  ).run();
}

async function queueManageLink(
  env: Env,
  subscriberId: number,
  publicId: string,
  email: string,
  locale: Locale
) {
  const manageUrl = await subscriberManageUrl(env, publicId, email);
  await env.DB.prepare(
    `INSERT INTO email_outbox (
       subscriber_id, recipient_email, locale, kind, template_key, template_data_json
     ) VALUES (?, ?, ?, 'manage', 'subscriber_manage', ?)`
  ).bind(subscriberId, email, locale, JSON.stringify({ manageUrl })).run();
}

async function replacePreferences(env: Env, subscriberId: number, body: Record<string, unknown>) {
  const general = generalPreferences(body);
  await env.DB.prepare(
    `INSERT INTO subscriber_email_preferences (
       subscriber_id, prayer_alerts, daily_prayer_schedule, religious_occasions,
       daily_content, announcements, community_events, marketing
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(subscriber_id) DO UPDATE SET
       prayer_alerts = excluded.prayer_alerts,
       daily_prayer_schedule = excluded.daily_prayer_schedule,
       religious_occasions = excluded.religious_occasions,
       daily_content = excluded.daily_content,
       announcements = excluded.announcements,
       community_events = excluded.community_events,
       marketing = excluded.marketing,
       updated_at = CURRENT_TIMESTAMP`
  ).bind(
    subscriberId,
    general.prayerAlerts,
    general.dailyPrayerSchedule,
    general.religiousOccasions,
    general.dailyContent,
    general.announcements,
    general.communityEvents,
    general.marketing
  ).run();

  for (const pref of prayerPreferences(body)) {
    await env.DB.prepare(
      `INSERT INTO subscriber_prayer_preferences (
         subscriber_id, prayer, email_twenty, email_ten, email_athan
       ) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(subscriber_id, prayer) DO UPDATE SET
         email_twenty = excluded.email_twenty,
         email_ten = excluded.email_ten,
         email_athan = excluded.email_athan,
         updated_at = CURRENT_TIMESTAMP`
    ).bind(subscriberId, pref.prayer, pref.twenty, pref.ten, pref.athan).run();
  }
}

type SubscriberRow = {
  id: number;
  public_id: string;
  email: string;
  locale: Locale;
  latitude: number;
  longitude: number;
  timezone: string;
  country_code: string | null;
  country_name: string | null;
  region: string | null;
  city: string | null;
  calculation_method: number | null;
  madhab: "standard" | "hanafi";
  status: string;
  verification_token_hash: string | null;
  verification_expires_at: string | null;
  manage_token_hash: string;
};

const SUBSCRIBER_SELECT = `
  SELECT id, public_id, email, locale, latitude, longitude, timezone,
         country_code, country_name, region, city, calculation_method, madhab,
         status, verification_token_hash, verification_expires_at, manage_token_hash
  FROM email_subscribers`;

async function subscriberByEmail(env: Env, email: string) {
  return env.DB.prepare(`${SUBSCRIBER_SELECT} WHERE email = ? COLLATE NOCASE LIMIT 1`)
    .bind(email).first<SubscriberRow>();
}

async function subscriberByPublicId(env: Env, publicId: string) {
  return env.DB.prepare(`${SUBSCRIBER_SELECT} WHERE public_id = ? LIMIT 1`)
    .bind(publicId).first<SubscriberRow>();
}

async function validateManage(env: Env, subscriber: SubscriberRow, token: string) {
  const expected = await manageToken(env, subscriber.public_id, subscriber.email);
  if (token !== expected) return false;
  return (await sha256Hex(token)) === subscriber.manage_token_hash;
}

function locationFromBody(body: Record<string, unknown>) {
  const latitude = coordinate(body.latitude, -90, 90);
  const longitude = coordinate(body.longitude, -180, 180);
  const timezone = body.timezone;
  if (latitude === null || longitude === null || !validTimezone(timezone)) return null;
  return {
    latitude,
    longitude,
    timezone,
    countryCode: countryCode(body.countryCode),
    countryName: cleanText(body.countryName, 100),
    region: cleanText(body.region, 100),
    city: cleanText(body.city, 100)
  };
}

function calculationMethod(value: unknown) {
  return Number.isInteger(value) && Number(value) >= 0 && Number(value) <= 99 ? Number(value) : 3;
}

async function linkInstallation(env: Env, subscriberId: number, value: unknown) {
  const installationId = cleanText(value, 128);
  if (!installationId || !/^[A-Za-z0-9_-]{16,128}$/.test(installationId)) return;
  await env.DB.prepare(
    "UPDATE subscriptions SET subscriber_id = ? WHERE installation_id = ?"
  ).bind(subscriberId, installationId).run();
}

export async function subscribeByEmail(request: Request, env: Env) {
  const body = await bodyJson(request);
  const email = normalizeEmail(body.email);
  const location = locationFromBody(body);
  const displayName = cleanText(body.displayName, 100);
  const locale = validLocale(body.locale);
  const madhab = body.madhab === "hanafi" ? "hanafi" : "standard";
  const method = calculationMethod(body.calculationMethod);

  if (!email) return response({ error: "Enter a valid email address" }, 400);
  if (!location) return response({ error: "Location permission is required to select local prayer times" }, 400);

  const existing = await subscriberByEmail(env, email);
  if (existing?.status === "active") {
    await queueManageLink(env, existing.id, existing.public_id, existing.email, existing.locale);
    await linkInstallation(env, existing.id, body.installationId);
    return response({
      ok: true,
      alreadySubscribed: true,
      message: "This email is already subscribed. A secure manage link has been sent."
    });
  }

  const publicId = existing?.public_id ?? crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const verifyToken = await verificationToken(env, publicId, email, expiresAt);
  const manage = await manageToken(env, publicId, email);
  const verifyHash = await sha256Hex(verifyToken);
  const manageHash = await sha256Hex(manage);

  if (existing) {
    await env.DB.prepare(
      `UPDATE email_subscribers SET
         display_name = ?, locale = ?, latitude = ?, longitude = ?, timezone = ?,
         country_code = ?, country_name = ?, region = ?, city = ?, calculation_method = ?,
         madhab = ?, location_updated_at = CURRENT_TIMESTAMP, status = 'pending',
         verification_token_hash = ?, verification_expires_at = ?, manage_token_hash = ?,
         unsubscribed_at = NULL, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`
    ).bind(
      displayName,
      locale,
      location.latitude,
      location.longitude,
      location.timezone,
      location.countryCode,
      location.countryName,
      location.region,
      location.city,
      method,
      madhab,
      verifyHash,
      expiresAt,
      manageHash,
      existing.id
    ).run();
    await replacePreferences(env, existing.id, body);
    await linkInstallation(env, existing.id, body.installationId);
    await queueVerification(env, existing.id, publicId, email, locale, expiresAt);
    return response({ ok: true, verificationRequired: true });
  }

  await env.DB.prepare(
    `INSERT INTO email_subscribers (
       public_id, email, display_name, locale, latitude, longitude, timezone,
       country_code, country_name, region, city, calculation_method, madhab, status,
       verification_token_hash, verification_expires_at, manage_token_hash
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)`
  ).bind(
    publicId,
    email,
    displayName,
    locale,
    location.latitude,
    location.longitude,
    location.timezone,
    location.countryCode,
    location.countryName,
    location.region,
    location.city,
    method,
    madhab,
    verifyHash,
    expiresAt,
    manageHash
  ).run();

  const created = await subscriberByEmail(env, email);
  if (!created) throw new Error("Subscriber creation failed");
  await replacePreferences(env, created.id, body);
  await linkInstallation(env, created.id, body.installationId);
  await queueVerification(env, created.id, publicId, email, locale, expiresAt);

  return response({
    ok: true,
    verificationRequired: true,
    location: {
      city: location.city,
      region: location.region,
      countryCode: location.countryCode,
      countryName: location.countryName,
      timezone: location.timezone
    }
  });
}

export async function verifyEmailSubscription(url: URL, env: Env) {
  const publicId = url.searchParams.get("id") ?? "";
  const token = url.searchParams.get("token") ?? "";
  if (!publicId || !token) return response({ error: "Invalid verification link" }, 400);
  const subscriber = await subscriberByPublicId(env, publicId);
  if (!subscriber) return response({ error: "Verification link is invalid" }, 400);
  if (subscriber.status === "active") {
    return response({ ok: true, active: true, alreadyVerified: true });
  }
  if (subscriber.status !== "pending" || !subscriber.verification_expires_at || !subscriber.verification_token_hash) {
    return response({ error: "Verification link is invalid or already used" }, 400);
  }
  if (Date.parse(subscriber.verification_expires_at) <= Date.now()) {
    return response({ error: "Verification link has expired" }, 410);
  }
  const expected = await verificationToken(env, subscriber.public_id, subscriber.email, subscriber.verification_expires_at);
  if (token !== expected || (await sha256Hex(token)) !== subscriber.verification_token_hash) {
    return response({ error: "Invalid verification token" }, 403);
  }
  await env.DB.prepare(
    `UPDATE email_subscribers SET status = 'active', verified_at = CURRENT_TIMESTAMP,
       verification_token_hash = NULL, verification_expires_at = NULL,
       updated_at = CURRENT_TIMESTAMP WHERE id = ?`
  ).bind(subscriber.id).run();

  const locationLabel = [subscriber.city, subscriber.region, subscriber.country_name].filter(Boolean).join(", ");
  const destination = `${publicAppUrl(env)}/?emailVerified=1`;
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>WOPT Email Alerts</title></head><body style="font-family:system-ui,-apple-system,sans-serif;background:#f5f2e9;color:#173f35;padding:32px"><main style="max-width:560px;margin:auto;background:#fff;border-radius:24px;padding:28px"><h1 style="margin-top:0">Email alerts are active</h1><p>Prayer-time email alerts are now enabled${locationLabel ? ` for ${locationLabel}` : ""}.</p><p>Time zone: <strong>${subscriber.timezone}</strong></p><p><a href="${destination}">Return to Windsor Prayer Times</a></p></main></body></html>`;
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}

export async function getSubscriberPreferences(url: URL, env: Env) {
  const publicId = url.searchParams.get("id") ?? "";
  const token = url.searchParams.get("token") ?? "";
  const subscriber = await subscriberByPublicId(env, publicId);
  if (!subscriber || !(await validateManage(env, subscriber, token))) {
    return response({ error: "Invalid manage link" }, 403);
  }
  const general = await env.DB.prepare(
    `SELECT prayer_alerts, daily_prayer_schedule, religious_occasions, daily_content,
            announcements, community_events, marketing
     FROM subscriber_email_preferences WHERE subscriber_id = ?`
  ).bind(subscriber.id).first<Record<string, number>>();
  const prayers = await env.DB.prepare(
    `SELECT prayer, email_twenty, email_ten, email_athan
     FROM subscriber_prayer_preferences WHERE subscriber_id = ? ORDER BY prayer`
  ).bind(subscriber.id).all<Record<string, unknown>>();
  return response({
    ok: true,
    subscription: {
      email: subscriber.email,
      locale: subscriber.locale,
      latitude: subscriber.latitude,
      longitude: subscriber.longitude,
      timezone: subscriber.timezone,
      city: subscriber.city,
      countryCode: subscriber.country_code,
      countryName: subscriber.country_name,
      region: subscriber.region,
      calculationMethod: subscriber.calculation_method,
      madhab: subscriber.madhab,
      status: subscriber.status,
      preferences: general,
      prayers: prayers.results
    }
  });
}

export async function updateSubscriberPreferences(request: Request, env: Env) {
  const body = await bodyJson(request);
  const publicId = cleanText(body.id, 80) ?? "";
  const token = typeof body.token === "string" ? body.token : "";
  const subscriber = await subscriberByPublicId(env, publicId);
  if (!subscriber || !(await validateManage(env, subscriber, token))) {
    return response({ error: "Invalid manage link" }, 403);
  }

  let latitude = subscriber.latitude;
  let longitude = subscriber.longitude;
  let timezone = subscriber.timezone;
  let detectedCountryCode = subscriber.country_code;
  let countryName = subscriber.country_name;
  let region = subscriber.region;
  let city = subscriber.city;

  const hasLocationUpdate = body.latitude !== undefined || body.longitude !== undefined || body.timezone !== undefined;
  if (hasLocationUpdate) {
    const location = locationFromBody(body);
    if (!location) return response({ error: "Invalid location settings" }, 400);
    latitude = location.latitude;
    longitude = location.longitude;
    timezone = location.timezone;
    detectedCountryCode = location.countryCode;
    countryName = location.countryName;
    region = location.region;
    city = location.city;
  }

  const locale = body.locale === undefined ? subscriber.locale : validLocale(body.locale);
  const madhab = body.madhab === undefined ? subscriber.madhab : body.madhab === "hanafi" ? "hanafi" : "standard";
  const method = body.calculationMethod === undefined
    ? (subscriber.calculation_method ?? 3)
    : calculationMethod(body.calculationMethod);

  await env.DB.prepare(
    `UPDATE email_subscribers SET locale = ?, latitude = ?, longitude = ?, timezone = ?,
       country_code = ?, country_name = ?, region = ?, city = ?, calculation_method = ?, madhab = ?,
       location_updated_at = CASE WHEN ? THEN CURRENT_TIMESTAMP ELSE location_updated_at END,
       updated_at = CURRENT_TIMESTAMP WHERE id = ?`
  ).bind(
    locale,
    latitude,
    longitude,
    timezone,
    detectedCountryCode,
    countryName,
    region,
    city,
    method,
    madhab,
    hasLocationUpdate ? 1 : 0,
    subscriber.id
  ).run();
  await replacePreferences(env, subscriber.id, body);
  return response({ ok: true });
}

export async function unsubscribeEmail(request: Request, env: Env) {
  const body = await bodyJson(request);
  const publicId = cleanText(body.id, 80) ?? "";
  const token = typeof body.token === "string" ? body.token : "";
  const subscriber = await subscriberByPublicId(env, publicId);
  if (!subscriber || !(await validateManage(env, subscriber, token))) {
    return response({ error: "Invalid unsubscribe link" }, 403);
  }
  await env.DB.prepare(
    `UPDATE email_subscribers SET status = 'unsubscribed', unsubscribed_at = CURRENT_TIMESTAMP,
       updated_at = CURRENT_TIMESTAMP WHERE id = ?`
  ).bind(subscriber.id).run();
  await env.DB.prepare(
    "UPDATE email_outbox SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP WHERE subscriber_id = ? AND status = 'pending'"
  ).bind(subscriber.id).run();
  return response({ ok: true, unsubscribed: true });
}
