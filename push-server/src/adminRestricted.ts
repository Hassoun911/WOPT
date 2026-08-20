import { requireAdmin } from "./adminAuth";
import { listAdminSubscribers } from "./adminData";
import {
  listAppSettings,
  listAuditLog,
  updateAppSetting,
  updateSubscriberStatus
} from "./adminCrm";
import { createAdminEmailCampaign, listAdminEmailCampaigns } from "./adminEmail";
import { createAdminPushCampaign, listAdminPushCampaigns } from "./adminPush";
import type { Env } from "./types";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

async function authenticated(request: Request, env: Env) {
  const auth = await requireAdmin(request, env);
  if (!auth.admin) return { admin: null, response: auth.response! };
  return { admin: auth.admin, response: null };
}

async function requireOperator(request: Request, env: Env) {
  const auth = await authenticated(request, env);
  if (!auth.admin) return auth;
  if (auth.admin.role !== "owner" && auth.admin.role !== "admin") {
    return { admin: null, response: json({ error: "Owner or admin access required" }, 403) };
  }
  return auth;
}

function isOperator(role: string) {
  return role === "owner" || role === "admin";
}

export async function listRestrictedSubscribers(request: Request, env: Env, url: URL) {
  const auth = await authenticated(request, env);
  if (!auth.admin) return auth.response!;
  if (!isOperator(auth.admin.role)) return json({ ok: true, subscribers: [] });
  return listAdminSubscribers(request, env, url);
}

export async function listRestrictedAppSettings(request: Request, env: Env) {
  const auth = await authenticated(request, env);
  if (!auth.admin) return auth.response!;
  if (!isOperator(auth.admin.role)) return json({ ok: true, settings: [] });
  return listAppSettings(request, env);
}

export async function updateRestrictedAppSetting(request: Request, env: Env, key: string) {
  const auth = await requireOperator(request, env);
  if (!auth.admin) return auth.response!;
  return updateAppSetting(request, env, key);
}

export async function updateRestrictedSubscriberStatus(request: Request, env: Env, publicId: string | undefined) {
  const auth = await requireOperator(request, env);
  if (!auth.admin) return auth.response!;
  if (!publicId) return json({ error: "Subscriber id is required" }, 400);
  return updateSubscriberStatus(request, env, publicId);
}

export async function listRestrictedAuditLog(request: Request, env: Env, url: URL) {
  const auth = await authenticated(request, env);
  if (!auth.admin) return auth.response!;
  if (!isOperator(auth.admin.role)) return json({ ok: true, entries: [] });
  return listAuditLog(request, env, url);
}

export async function createRestrictedPushCampaign(request: Request, env: Env) {
  const auth = await requireOperator(request, env);
  if (!auth.admin) return auth.response!;
  return createAdminPushCampaign(request, env);
}

export async function listRestrictedPushCampaigns(request: Request, env: Env) {
  const auth = await authenticated(request, env);
  if (!auth.admin) return auth.response!;
  if (!isOperator(auth.admin.role)) return json({ ok: true, campaigns: [] });
  return listAdminPushCampaigns(request, env);
}

export async function createRestrictedEmailCampaign(request: Request, env: Env) {
  const auth = await requireOperator(request, env);
  if (!auth.admin) return auth.response!;
  return createAdminEmailCampaign(request, env);
}

export async function listRestrictedEmailCampaigns(request: Request, env: Env) {
  const auth = await authenticated(request, env);
  if (!auth.admin) return auth.response!;
  if (!isOperator(auth.admin.role)) return json({ ok: true, campaigns: [] });
  return listAdminEmailCampaigns(request, env);
}
