import { requireAdmin } from "./adminAuth";
import type { Env, PrayerFile, PrayerKey, PrayerTimes } from "./types";

const DEFAULT_SOURCE = "https://timing.athanplus.com/masjid/widgets/monthly?masjid_id=adJEGWAk&theme=1";
const DEFAULT_OWNER = "Hassoun911";
const DEFAULT_REPO = "WOPT";
const DEFAULT_PATH = "windsor_islamic_association_2026_prayer_times.json";
const PRAYERS: PrayerKey[] = ["fajr", "dhuhr", "asr", "maghrib", "isha"];
type MonthState = { status: "pulled" | "approved"; at: string; source?: string; commitSha?: string | null };
type MonthStates = Record<string, MonthState>;

function json(data: unknown, status = 200, request?: Request, env?: Env) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (request && env) {
    const origin = request.headers.get("Origin");
    headers["Access-Control-Allow-Origin"] = origin === env.ALLOWED_WEB_ORIGIN ? origin : "null";
    headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization";
    headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS";
    headers.Vary = "Origin";
  }
  return new Response(JSON.stringify(data), { status, headers });
}

function decodeHtml(value: string) {
  return value.replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&#39;/g, "'").replace(/&quot;/gi, '"').replace(/&lt;/gi, "<").replace(/&gt;/gi, ">");
}
function cleanCell(value: string) { return decodeHtml(value.replace(/<br\s*\/?>/gi, " ").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim(); }
function to24(value: string, prayer: PrayerKey) {
  const match = value.match(/^(\d{1,2}):(\d{2})/); if (!match) throw new Error(`Invalid ${prayer} time: ${value}`);
  let hour = Number(match[1]); const minute = Number(match[2]); if (prayer !== "fajr" && hour < 12) hour += 12;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}
function daysInMonth(year: number, month: number) { return new Date(Date.UTC(year, month, 0)).getUTCDate(); }

function parseMonthHtml(html: string, monthKey: string): PrayerTimes {
  const [year, month] = monthKey.split("-").map(Number); if (!year || !month || month < 1 || month > 12) throw new Error("Invalid month");
  const rows = [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)]; const out: PrayerTimes = {};
  for (const row of rows) {
    const cells = [...row[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((m) => cleanCell(m[1]));
    if (cells.length < 9) continue; const day = Number(cells[0]);
    if (!Number.isInteger(day) || day < 1 || day > daysInMonth(year, month)) continue;
    if (!/^(MON|TUE|WED|THU|FRI|SAT|SUN)$/i.test(cells[2])) continue;
    const key = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    try { out[key] = { fajr: to24(cells[3], "fajr"), dhuhr: to24(cells[5], "dhuhr"), asr: to24(cells[6], "asr"), maghrib: to24(cells[7], "maghrib"), isha: to24(cells[8], "isha") }; } catch {}
  }
  const expected = daysInMonth(year, month); if (Object.keys(out).length !== expected) throw new Error(`Expected ${expected} prayer rows for ${monthKey}, found ${Object.keys(out).length}`);
  return out;
}

async function fetchSourceMonth(env: Env, monthKey: string) {
  const base = env.ATHANPLUS_MONTHLY_URL || DEFAULT_SOURCE; const url = new URL(base); url.searchParams.set("date", `${monthKey}-01`);
  const response = await fetch(url.toString(), { headers: { Accept: "text/html" }, cf: { cacheTtl: 60 } });
  if (!response.ok) throw new Error(`Al-Hijra source returned ${response.status}`);
  return { sourceUrl: url.toString(), prayerTimes: parseMonthHtml(await response.text(), monthKey) };
}

async function currentSchedule(env: Env): Promise<PrayerFile & Record<string, unknown>> {
  const response = await fetch(env.SCHEDULE_URL, { headers: { Accept: "application/json" }, cf: { cacheTtl: 30 } });
  if (!response.ok) throw new Error(`Current schedule returned ${response.status}`);
  const data = await response.json() as PrayerFile & Record<string, unknown>; if (!data.prayer_times) throw new Error("Current schedule is missing prayer_times"); return data;
}

function validateMonthData(monthKey: string, value: unknown): PrayerTimes {
  if (!value || typeof value !== "object") throw new Error("Prayer month data is required");
  const [year, month] = monthKey.split("-").map(Number); const expected = daysInMonth(year, month); const input = value as Record<string, unknown>; const out: PrayerTimes = {};
  for (let day = 1; day <= expected; day += 1) {
    const key = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`; const row = input[key] as Record<string, unknown> | undefined; if (!row) throw new Error(`Missing ${key}`);
    const normalized = {} as Record<PrayerKey, string>;
    for (const prayer of PRAYERS) { const raw = typeof row[prayer] === "string" ? String(row[prayer]).trim() : ""; if (!/^\d{2}:\d{2}$/.test(raw)) throw new Error(`Invalid ${prayer} time for ${key}`); normalized[prayer] = raw; }
    out[key] = normalized;
  }
  return out;
}

function encodeBase64(text: string) { const bytes = new TextEncoder().encode(text); let binary = ""; const chunk = 0x8000; for (let i = 0; i < bytes.length; i += chunk) binary += String.fromCharCode(...bytes.subarray(i, i + chunk)); return btoa(binary); }

async function publishToGitHub(env: Env, schedule: Record<string, unknown>, monthKey: string) {
  const token = env.GITHUB_SCHEDULE_TOKEN; if (!token) throw new Error("GitHub schedule publishing is not configured yet");
  const owner = env.GITHUB_SCHEDULE_OWNER || DEFAULT_OWNER; const repo = env.GITHUB_SCHEDULE_REPO || DEFAULT_REPO; const path = env.GITHUB_SCHEDULE_PATH || DEFAULT_PATH;
  const api = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${path.split("/").map(encodeURIComponent).join("/")}`;
  const headers = { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "User-Agent": "Hassoun-Prayer-Schedule-Admin", "X-GitHub-Api-Version": "2022-11-28" };
  const current = await fetch(`${api}?ref=main`, { headers }); if (!current.ok) throw new Error(`GitHub read failed: ${current.status}`);
  const currentJson = await current.json() as { sha?: string }; if (!currentJson.sha) throw new Error("GitHub file SHA is missing");
  const update = await fetch(api, { method: "PUT", headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify({ message: `Update Windsor prayer schedule for ${monthKey}`, content: encodeBase64(`${JSON.stringify(schedule, null, 2)}\n`), sha: currentJson.sha, branch: "main" }) });
  if (!update.ok) throw new Error(`GitHub publish failed: ${update.status} ${await update.text()}`);
  return ((await update.json()) as { commit?: { sha?: string; html_url?: string } }).commit || null;
}

async function setSetting(env: Env, key: string, value: unknown, adminId?: number | null) { await env.DB.prepare(`INSERT INTO app_settings (setting_key,value_json,description,updated_by_admin_id) VALUES (?,?,?,?) ON CONFLICT(setting_key) DO UPDATE SET value_json=excluded.value_json,updated_by_admin_id=excluded.updated_by_admin_id,updated_at=CURRENT_TIMESTAMP`).bind(key, JSON.stringify(value), "Prayer schedule automation setting", adminId ?? null).run(); }
async function getSetting<T>(env: Env, key: string, fallback: T): Promise<T> { const row = await env.DB.prepare("SELECT value_json FROM app_settings WHERE setting_key=? LIMIT 1").bind(key).first<{ value_json: string }>(); if (!row) return fallback; try { return JSON.parse(row.value_json) as T; } catch { return fallback; } }
async function updateMonthState(env: Env, month: string, state: MonthState, adminId?: number | null) { const states = await getSetting<MonthStates>(env, "prayer_schedule_month_states", {}); states[month] = state; await setSetting(env, "prayer_schedule_month_states", states, adminId); return states; }
function yearOverview(schedule: PrayerFile, states: MonthStates, year: number) {
  return Array.from({ length: 12 }, (_, index) => {
    const month = `${year}-${String(index + 1).padStart(2, "0")}`;
    const daysOnFile = Object.keys(schedule.prayer_times).filter((key) => key.startsWith(`${month}-`)).length;
    const state = states[month];
    return { month, daysOnFile, onFile: daysOnFile > 0, status: state?.status || "not-approved", at: state?.at || null, source: state?.source || null, commitSha: state?.commitSha || null };
  });
}

async function requireOperator(request: Request, env: Env) { const auth = await requireAdmin(request, env); if (!auth.admin) return { admin: null, response: auth.response! }; if (auth.admin.role !== "owner" && auth.admin.role !== "admin") return { admin: null, response: json({ error: "Owner or admin access required" }, 403, request, env) }; return { admin: auth.admin, response: null }; }

export async function handleAdminPrayerSchedule(request: Request, env: Env, url: URL) {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: { "Access-Control-Allow-Origin": request.headers.get("Origin") === env.ALLOWED_WEB_ORIGIN ? env.ALLOWED_WEB_ORIGIN : "null", "Access-Control-Allow-Headers": "Content-Type, Authorization", "Access-Control-Allow-Methods": "GET, POST, OPTIONS", Vary: "Origin" } });
  const auth = await requireOperator(request, env); if (!auth.admin) return auth.response!;
  try {
    if (request.method === "GET") {
      const month = url.searchParams.get("month") || new Intl.DateTimeFormat("en-CA", { timeZone: "America/Toronto", year: "numeric", month: "2-digit" }).format(new Date());
      const schedule = await currentSchedule(env); const monthTimes = Object.fromEntries(Object.entries(schedule.prayer_times).filter(([key]) => key.startsWith(`${month}-`)));
      const autoSync = await getSetting(env, "prayer_schedule_auto_sync", false); const lastAuto = await getSetting(env, "prayer_schedule_last_auto", null as null | Record<string, unknown>); const monthStates = await getSetting<MonthStates>(env, "prayer_schedule_month_states", {});
      const year = Number(month.slice(0, 4)) || new Date().getUTCFullYear();
      return json({ ok: true, month, prayerTimes: monthTimes, sourceUrl: env.ATHANPLUS_MONTHLY_URL || DEFAULT_SOURCE, scheduleUrl: env.SCHEDULE_URL, autoSync, lastAuto, githubPublishingConfigured: Boolean(env.GITHUB_SCHEDULE_TOKEN), selectedMonthState: monthStates[month] || null, yearOverview: yearOverview(schedule, monthStates, year) }, 200, request, env);
    }
    if (request.method !== "POST") return json({ error: "Method not allowed" }, 405, request, env);
    const body = await request.json() as Record<string, unknown>; const action = typeof body.action === "string" ? body.action : ""; const month = typeof body.month === "string" && /^\d{4}-\d{2}$/.test(body.month) ? body.month : new Date().toISOString().slice(0, 7);
    if (action === "preview") {
      const pulled = await fetchSourceMonth(env, month); await updateMonthState(env, month, { status: "pulled", at: new Date().toISOString(), source: "Al-Hijra AthanPlus" }, auth.admin.id);
      return json({ ok: true, month, sourceUrl: pulled.sourceUrl, prayerTimes: pulled.prayerTimes, monthState: { status: "pulled", at: new Date().toISOString(), source: "Al-Hijra AthanPlus" } }, 200, request, env);
    }
    if (action === "set_auto") { const enabled = body.enabled === true; await setSetting(env, "prayer_schedule_auto_sync", enabled, auth.admin.id); return json({ ok: true, autoSync: enabled }, 200, request, env); }
    if (action === "publish") {
      const monthData = body.prayerTimes ? validateMonthData(month, body.prayerTimes) : (await fetchSourceMonth(env, month)).prayerTimes;
      const schedule = await currentSchedule(env) as Record<string, unknown> & { prayer_times: PrayerTimes }; schedule.prayer_times = { ...schedule.prayer_times, ...monthData };
      const metadata = schedule.metadata && typeof schedule.metadata === "object" ? schedule.metadata as Record<string, unknown> : {}; schedule.metadata = { ...metadata, last_updated: new Date().toISOString(), monthly_source: env.ATHANPLUS_MONTHLY_URL || DEFAULT_SOURCE };
      const commit = await publishToGitHub(env, schedule, month); await setSetting(env, "prayer_schedule_last_publish", { month, at: new Date().toISOString(), commitSha: commit?.sha || null, source: "admin" }, auth.admin.id);
      await updateMonthState(env, month, { status: "approved", at: new Date().toISOString(), source: "admin", commitSha: commit?.sha || null }, auth.admin.id);
      return json({ ok: true, month, commit }, 200, request, env);
    }
    return json({ error: "Unknown action" }, 400, request, env);
  } catch (error) { return json({ error: error instanceof Error ? error.message : "Prayer schedule request failed" }, 500, request, env); }
}

export async function autoSyncPrayerSchedule(env: Env, scheduledTime: number) {
  const enabled = await getSetting(env, "prayer_schedule_auto_sync", false); if (!enabled || !env.GITHUB_SCHEDULE_TOKEN) return;
  const now = new Date(scheduledTime); const local = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Toronto", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  const already = await getSetting(env, "prayer_schedule_last_auto", null as null | { checkedDate?: string; month?: string; status?: string }); if (already?.checkedDate === local) return;
  const [year, month, day] = local.split("-").map(Number); const targetDate = new Date(Date.UTC(year, month - 1 + (day >= 25 ? 1 : 0), 1)); const targetMonth = `${targetDate.getUTCFullYear()}-${String(targetDate.getUTCMonth() + 1).padStart(2, "0")}`;
  try {
    const pulled = await fetchSourceMonth(env, targetMonth); const schedule = await currentSchedule(env) as Record<string, unknown> & { prayer_times: PrayerTimes }; let changed = false;
    for (const [date, row] of Object.entries(pulled.prayerTimes)) if (JSON.stringify(schedule.prayer_times[date]) !== JSON.stringify(row)) { changed = true; break; }
    let commit: { sha?: string; html_url?: string } | null = null;
    if (changed) { schedule.prayer_times = { ...schedule.prayer_times, ...pulled.prayerTimes }; const metadata = schedule.metadata && typeof schedule.metadata === "object" ? schedule.metadata as Record<string, unknown> : {}; schedule.metadata = { ...metadata, last_updated: new Date(scheduledTime).toISOString(), monthly_source: env.ATHANPLUS_MONTHLY_URL || DEFAULT_SOURCE }; commit = await publishToGitHub(env, schedule, targetMonth); }
    await updateMonthState(env, targetMonth, { status: "approved", at: new Date(scheduledTime).toISOString(), source: "auto-sync", commitSha: commit?.sha || null });
    await setSetting(env, "prayer_schedule_last_auto", { checkedDate: local, month: targetMonth, status: changed ? "published" : "no-change", commitSha: commit?.sha || null, at: new Date(scheduledTime).toISOString() });
  } catch (error) { await setSetting(env, "prayer_schedule_last_auto", { checkedDate: local, month: targetMonth, status: "error", error: error instanceof Error ? error.message : String(error), at: new Date(scheduledTime).toISOString() }); }
}
