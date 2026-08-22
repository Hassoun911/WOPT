import type { Env } from "./types";

const IMPORT_KEY = "resend_prayer_users_v2";
const PRAYERS = ["fajr", "dhuhr", "asr", "maghrib", "isha"] as const;

// These addresses are the legacy Windsor prayer recipients visible in the
// owner's Resend delivery screen. Suppressed recipients are retained in the
// CRM for history but are never re-enabled for email delivery.
const VERIFIED_LEGACY_RECIPIENTS: Person[] = [
  { email: "solutionsleb@gmail.com", blocked: false },
  { email: "toufic@propertycousins.ca", blocked: true },
  { email: "reemhassoun@gmail.com", blocked: true },
  { email: "ramahassoun740@gmail.com", blocked: false },
  { email: "windsor.hassoun@gmail.com", blocked: false }
];

type ResendEmail = { id?: string; to?: string[] | string; subject?: string; last_event?: string };
type ResendContact = { id?: string; email?: string; unsubscribed?: boolean };
type Person = { email: string; blocked: boolean };

function emailOk(value: unknown) {
  return typeof value === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function base64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function manageHash(env: Env, publicId: string, email: string) {
  const secret = env.EMAIL_LINK_SECRET || env.VAPID_PRIVATE_KEY;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`manage|${publicId}|${email}`));
  const token = base64Url(new Uint8Array(signature));
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function resendGet<T>(env: Env, path: string): Promise<T> {
  if (!env.RESEND_API_KEY) throw new Error("Resend is not configured");
  const response = await fetch(`https://api.resend.com${path}`, {
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, Accept: "application/json" }
  });
  if (!response.ok) throw new Error(`Resend ${path} failed: ${response.status}`);
  return response.json() as Promise<T>;
}

async function historicalPrayerRecipients(env: Env) {
  const people = new Map<string, Person>();
  let after = "";
  for (let page = 0; page < 50; page += 1) {
    const params = new URLSearchParams({ limit: "100" });
    if (after) params.set("after", after);
    const payload = await resendGet<{ data?: ResendEmail[] }>(env, `/emails?${params.toString()}`);
    const rows = payload.data ?? [];
    if (!rows.length) break;
    for (const row of rows) {
      const subject = String(row.subject ?? "");
      if (!/(fajr|dhuhr|zuhr|asr|maghrib|isha|prayer time|athan|adhan|وقت الصلاة|الفجر|الظهر|العصر|المغرب|العشاء)/i.test(subject)) continue;
      const recipients = Array.isArray(row.to) ? row.to : [row.to];
      for (const value of recipients) {
        if (!emailOk(value)) continue;
        const email = String(value).trim().toLowerCase();
        const old = people.get(email);
        people.set(email, { email, blocked: Boolean(old?.blocked || row.last_event === "suppressed") });
      }
    }
    const last = rows.at(-1);
    if (rows.length < 100 || !last?.id) break;
    after = last.id;
  }

  try {
    after = "";
    for (let page = 0; page < 50; page += 1) {
      const params = new URLSearchParams({ limit: "100" });
      if (after) params.set("after", after);
      const payload = await resendGet<{ data?: ResendContact[] }>(env, `/contacts?${params.toString()}`);
      const rows = payload.data ?? [];
      if (!rows.length) break;
      for (const contact of rows) {
        if (!emailOk(contact.email)) continue;
        const email = String(contact.email).trim().toLowerCase();
        const person = people.get(email);
        if (person && contact.unsubscribed === true) person.blocked = true;
      }
      const last = rows.at(-1);
      if (rows.length < 100 || !last?.id) break;
      after = last.id;
    }
  } catch (error) {
    console.warn("Legacy Resend contact-state scan skipped", error);
  }
  return [...people.values()];
}

async function importPerson(env: Env, person: Person) {
  const existing = await env.DB.prepare("SELECT id FROM email_subscribers WHERE email = ? COLLATE NOCASE LIMIT 1")
    .bind(person.email).first<{ id: number }>();
  if (existing) return { inserted: false, blocked: person.blocked };

  const publicId = crypto.randomUUID();
  const hash = await manageHash(env, publicId, person.email);
  const status = person.blocked ? "unsubscribed" : "active";
  const inserted = await env.DB.prepare(
    `INSERT INTO email_subscribers (
       public_id, email, locale, latitude, longitude, timezone,
       country_code, country_name, region, city, calculation_method, madhab,
       status, manage_token_hash, verified_at, unsubscribed_at
     ) VALUES (?, ?, 'en', 42.3149, -83.0364, 'America/Toronto',
       'CA', 'Canada', 'Ontario', 'Windsor', 3, 'standard', ?, ?,
       CASE WHEN ? = 'active' THEN CURRENT_TIMESTAMP ELSE NULL END,
       CASE WHEN ? = 'active' THEN NULL ELSE CURRENT_TIMESTAMP END)`
  ).bind(publicId, person.email, status, hash, status, status).run();
  if ((inserted.meta.changes ?? 0) !== 1) return { inserted: false, blocked: person.blocked };

  const row = await env.DB.prepare("SELECT id FROM email_subscribers WHERE email = ? COLLATE NOCASE LIMIT 1")
    .bind(person.email).first<{ id: number }>();
  if (!row) throw new Error("Imported subscriber could not be reloaded");

  const enabled = person.blocked ? 0 : 1;
  const statements: D1PreparedStatement[] = [
    env.DB.prepare(
      `INSERT OR IGNORE INTO subscriber_email_preferences (
         subscriber_id, prayer_alerts, daily_prayer_schedule, religious_occasions,
         daily_content, announcements, community_events, marketing
       ) VALUES (?, ?, 0, 1, 0, 1, 1, 0)`
    ).bind(row.id, enabled)
  ];
  for (const prayer of PRAYERS) {
    statements.push(env.DB.prepare(
      `INSERT OR IGNORE INTO subscriber_prayer_preferences (
         subscriber_id, prayer, email_twenty, email_ten, email_athan
       ) VALUES (?, ?, 0, 0, ?)`
    ).bind(row.id, prayer, enabled));
  }
  await env.DB.batch(statements);
  return { inserted: true, blocked: person.blocked };
}

export async function importLegacyResendUsersOnce(env: Env) {
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS one_time_imports (
       import_key TEXT PRIMARY KEY,
       completed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
       summary_json TEXT
     )`
  ).run();
  const done = await env.DB.prepare("SELECT summary_json FROM one_time_imports WHERE import_key = ? LIMIT 1")
    .bind(IMPORT_KEY).first<{ summary_json: string | null }>();
  if (done) return { skipped: true, summary: done.summary_json };
  if (!env.RESEND_API_KEY) return { skipped: true, reason: "resend_not_configured" };

  let discovered: Person[] = [];
  try {
    discovered = await historicalPrayerRecipients(env);
  } catch (error) {
    console.warn("Historical Resend prayer scan failed; using verified legacy set", error);
  }

  const merged = new Map<string, Person>();
  for (const person of discovered) merged.set(person.email, { ...person });
  for (const person of VERIFIED_LEGACY_RECIPIENTS) {
    const current = merged.get(person.email);
    merged.set(person.email, { email: person.email, blocked: Boolean(person.blocked || current?.blocked) });
  }
  const people = [...merged.values()];

  let inserted = 0;
  let blocked = 0;
  for (const person of people) {
    const result = await importPerson(env, person);
    if (result.inserted) inserted += 1;
    if (person.blocked) blocked += 1;
  }
  const summary = JSON.stringify({ discovered: people.length, inserted, blocked });
  await env.DB.prepare("INSERT INTO one_time_imports (import_key, summary_json) VALUES (?, ?)")
    .bind(IMPORT_KEY, summary).run();
  console.log("Legacy Resend prayer-user import completed", { discovered: people.length, inserted, blocked });
  return { skipped: false, discovered: people.length, inserted, blocked };
}
