import type { Env, Locale, PrayerKey } from "./types";

const PRAYERS: PrayerKey[] = ["fajr", "dhuhr", "asr", "maghrib", "isha"];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function response(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" }
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
  if (!env.EMAIL_LINK_SECRET) throw new Error("EMAIL_LINK_SECRET is not configured");
  return env.EMAIL_LINK_SECRET;
}

function publicAppUrl(env: Env) {
  return (env.PUBLIC_APP_URL || "https://hassoun911.github.io/WOPT").replace(/\/$/, "");
}

async function manageToken(env: Env, publicId: string, email: string) {
  return hmacToken(linkSecret(env), `manage|${publicId}|${email}`);
}

async function verificationToken(env: Env, publicId: string, email: string, expiresAt: string) {
  return hmacToken(linkSecret(env), `verify|${publicId}|${email}|${expiresAt}`);
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
  const verifyUrl = `${publicAppUrl(env)}/?emailVerify=${encodeURIComponent(publicId)}&token=${encodeURIComponent(token)}`;
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
  return token;
}

async function queueManageLink(
  env: Env,
  subscriberId: number,
  publicId: string,
  email: string,
  locale: Locale
) {
  const token = await manageToken(env, publicId, email);
  const manageUrl = `${publicAppUrl(env)}/?emailManage=${encodeURIComponent(publicId)}&token=${encodeURIComponent(token)}`;
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
  country_code: string;
  country_name: string | null;
  region: string | null;
  city: string;
  timezone: string;
  calculation_method: number | null;
  madhab: "standard" | "hanafi";
  status: string;
  verification_token_hash: string | null;
  verification_expires_at: string | null;
  manage_token_hash: string;
};

async function subscriberByEmail(env: Env, email: string) {
  return env.DB.prepare(
    `SELECT id, public_id, email, locale, country_code, country_name, region, city, timezone,
            calculation_method, madhab, status, verification_token_hash, verification_expires_at,
            manage_token_hash
     FROM email_subscribers WHERE email = ? COLLATE NOCASE LIMIT 1`
  ).bind(email).first<SubscriberRow>();
}

async function subscriberByPublicId(env: Env, publicId: string) {
  return env.DB.prepare(
    `SELECT id, public_id, email, locale, country_code, country_name, region, city, timezone,
            calculation_method, madhab, status, verification_token_hash, verification_expires_at,
            manage_token_hash
     FROM email_subscribers WHERE public_id = ? LIMIT 1`
  ).bind(publicId).first<SubscriberRow>();
}

async function validateManage(env: Env, subscriber: SubscriberRow, token: string) {
  const expected = await manageToken(env, subscriber.public_id, subscriber.email);
  if (token !== expected) return false;
  return (await sha256Hex(token)) === subscriber.manage_token_hash;
}

export async function subscribeByEmail(request: Request, env: Env) {
  const body = await bodyJson(request);
  const email = normalizeEmail(body.email);
  const city = cleanText(body.city, 100);
  const countryCode = typeof body.countryCode === "string" ? body.countryCode.trim().toUpperCase() : "";
  const countryName = cleanText(body.countryName, 100);
  const region = cleanText(body.region, 100);
  const timezone = body.timezone;
  const displayName = cleanText(body.displayName, 100);
  const locale = validLocale(body.locale);
  const madhab = body.madhab === "hanafi" ? "hanafi" : "standard";
  const calculationMethod = Number.isInteger(body.calculationMethod) && Number(body.calculationMethod) >= 0 && Number(body.calculationMethod) <= 99
    ? Number(body.calculationMethod)
    : null;

  if (!email) return response({ error: "Enter a valid email address" }, 400);
  if (!city) return response({ error: "City is required" }, 400);
  if (!/^[A-Z]{2}$/.test(countryCode)) return response({ error: "Country code must be a 2-letter ISO code" }, 400);
  if (!validTimezone(timezone)) return response({ error: "Enter a valid IANA time zone" }, 400);

  const existing = await subscriberByEmail(env, email);
  if (existing?.status === "active") {
    await queueManageLink(env, existing.id, existing.public_id, existing.email, existing.locale);
    return response({ ok: true, message: "Check your email to manage the existing subscription." });
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
         display_name = ?, locale = ?, country_code = ?, country_name = ?, region = ?, city = ?,
         timezone = ?, calculation_method = ?, madhab = ?, status = 'pending',
         verification_token_hash = ?, verification_expires_at = ?, manage_token_hash = ?,
         unsubscribed_at = NULL, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`
    ).bind(
      displayName,
      locale,
      countryCode,
      countryName,
      region,
      city,
      timezone,
      calculationMethod,
      madhab,
      verifyHash,
      expiresAt,
      manageHash,
      existing.id
    ).run();
    await replacePreferences(env, existing.id, body);
    await queueVerification(env, existing.id, publicId, email, locale, expiresAt);
    return response({ ok: true, verificationRequired: true });
  }

  await env.DB.prepare(
    `INSERT INTO email_subscribers (
       public_id, email, display_name, locale, country_code, country_name, region, city, timezone,
       calculation_method, madhab, status, verification_token_hash, verification_expires_at,
       manage_token_hash
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)`
  ).bind(
    publicId,
    email,
    displayName,
    locale,
    countryCode,
    countryName,
    region,
    city,
    timezone,
    calculationMethod,
    madhab,
    verifyHash,
    expiresAt,
    manageHash
  ).run();

  const created = await subscriberByEmail(env, email);
  if (!created) throw new Error("Subscriber creation failed");
  await replacePreferences(env, created.id, body);
  await queueVerification(env, created.id, publicId, email, locale, expiresAt);

  const installationId = cleanText(body.installationId, 128);
  if (installationId && /^[A-Za-z0-9_-]{16,128}$/.test(installationId)) {
    await env.DB.prepare(
      "UPDATE subscriptions SET subscriber_id = ? WHERE installation_id = ?"
    ).bind(created.id, installationId).run();
  }

  return response({ ok: true, verificationRequired: true });
}

export async function verifyEmailSubscription(url: URL, env: Env) {
  const publicId = url.searchParams.get("id") ?? "";
  const token = url.searchParams.get("token") ?? "";
  if (!publicId || !token) return response({ error: "Invalid verification link" }, 400);
  const subscriber = await subscriberByPublicId(env, publicId);
  if (!subscriber || subscriber.status !== "pending" || !subscriber.verification_expires_at || !subscriber.verification_token_hash) {
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
  return response({ ok: true, active: true });
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
      city: subscriber.city,
      countryCode: subscriber.country_code,
      countryName: subscriber.country_name,
      region: subscriber.region,
      timezone: subscriber.timezone,
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

  const city = body.city === undefined ? subscriber.city : cleanText(body.city, 100);
  const countryCode = body.countryCode === undefined
    ? subscriber.country_code
    : typeof body.countryCode === "string" ? body.countryCode.trim().toUpperCase() : "";
  const timezone = body.timezone === undefined ? subscriber.timezone : body.timezone;
  const locale = body.locale === undefined ? subscriber.locale : validLocale(body.locale);
  const madhab = body.madhab === undefined ? subscriber.madhab : body.madhab === "hanafi" ? "hanafi" : "standard";
  const calculationMethod = body.calculationMethod === undefined
    ? subscriber.calculation_method
    : Number.isInteger(body.calculationMethod) && Number(body.calculationMethod) >= 0 && Number(body.calculationMethod) <= 99
      ? Number(body.calculationMethod)
      : null;

  if (!city || !/^[A-Z]{2}$/.test(countryCode) || !validTimezone(timezone)) {
    return response({ error: "Invalid location settings" }, 400);
  }

  await env.DB.prepare(
    `UPDATE email_subscribers SET locale = ?, country_code = ?, country_name = ?, region = ?,
       city = ?, timezone = ?, calculation_method = ?, madhab = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`
  ).bind(
    locale,
    countryCode,
    body.countryName === undefined ? subscriber.country_name : cleanText(body.countryName, 100),
    body.region === undefined ? subscriber.region : cleanText(body.region, 100),
    city,
    timezone,
    calculationMethod,
    madhab,
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
