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

async function requireOperator(request: Request, env: Env) {
  const auth = await requireAdmin(request, env);
  if (!auth.admin) return { admin: null, response: auth.response! };
  if (auth.admin.role !== "owner" && auth.admin.role !== "admin") {
    return { admin: null, response: json({ error: "Owner or admin access required" }, 403) };
  }
  return { admin: auth.admin, response: null };
}

export async function listRestrictedSubscribers(request: Request, env: Env, url: URL) {
  const auth = await requireOperator(request, env);
  if (!auth.admin) return auth.response!;
  return listAdminSubscribers(request, env, url);
}

export async function listRestrictedAppSettings(request: Request, env: Env) {
  const auth = await requireOperator(request, env);
  if (!auth.admin) return auth.response!;
  return listAppSettings(request, env);
}

export async function updateRestrictedAppSetting(request: Request, env: Env, key: string) {
  const auth = await requireOperator(request, env);
  if (!auth.admin) return auth.response!;
  return updateAppSetting(request, env, key);
}

export async function updateRestrictedSubscriberStatus(request: Request, env: Env, publicId: string) {
  const auth = await requireOperator(request, env);
  if (!auth.admin) return auth.response!;
  return updateSubscriberStatus(request, env, publicId);
}

export async function listRestrictedAuditLog(request: Request, env: Env, url: URL) {
  const auth = await requireOperator(request, env);
  if (!auth.admin) return auth.response!;
  return listAuditLog(request, env, url);
}

export async function createRestrictedPushCampaign(request: Request, env: Env) {
  const auth = await requireOperator(request, env);
  if (!auth.admin) return auth.response!;
  return createAdminPushCampaign(request, env);
}

export async function listRestrictedPushCampaigns(request: Request, env: Env) {
  const auth = await requireOperator(request, env);
  if (!auth.admin) return auth.response!;
  return listAdminPushCampaigns(request, env);
}

export async function createRestrictedEmailCampaign(request: Request, env: Env) {
  const auth = await requireOperator(request, env);
  if (!auth.admin) return auth.response!;
  return createAdminEmailCampaign(request, env);
}

export async function listRestrictedEmailCampaigns(request: Request, env: Env) {
  const auth = await requireOperator(request, env);
  if (!auth.admin) return auth.response!;
  return listAdminEmailCampaigns(request, env);
}
