import fs from 'node:fs';

const pushPath='src/adminPush.ts';
const restrictedPath='src/adminRestricted.ts';
const indexPath='src/index.ts';

let push=fs.readFileSync(pushPath,'utf8');
if(!push.includes('export async function deleteAdminPushCampaign')){
  const marker='\nfunction wantsCategory(subscription: TargetSubscription, campaign: CampaignRow) {';
  if(!push.includes(marker)) throw new Error('adminPush marker not found');
  const fn=`\nexport async function deleteAdminPushCampaign(request: Request, env: Env, publicId: string) {\n  const auth = await requireAdmin(request, env);\n  if (!auth.admin) return auth.response!;\n  const row = await env.DB.prepare(\"SELECT id, public_id, status FROM push_campaigns WHERE public_id = ? LIMIT 1\").bind(publicId).first<{ id:number; public_id:string; status:string }>();\n  if (!row) return json({ error: \"Push campaign not found\" }, 404);\n  await env.DB.batch([\n    env.DB.prepare(\"DELETE FROM push_campaign_deliveries WHERE campaign_id = ?\").bind(row.id),\n    env.DB.prepare(\"DELETE FROM push_campaigns WHERE id = ?\").bind(row.id)\n  ]);\n  await logAdmin(env, auth.admin.id, \"push_campaign_deleted\", \"push_campaign\", publicId, { previousStatus: row.status });\n  return json({ ok:true, publicId });\n}\n`;
  push=push.replace(marker,fn+marker);
  fs.writeFileSync(pushPath,push);
}

let restricted=fs.readFileSync(restrictedPath,'utf8');
restricted=restricted.replace(
  'import { createAdminPushCampaign, dispatchDueAdminPushCampaigns, listAdminPushCampaigns } from "./adminPush";',
  'import { createAdminPushCampaign, deleteAdminPushCampaign, dispatchDueAdminPushCampaigns, listAdminPushCampaigns } from "./adminPush";'
);
if(!restricted.includes('deleteRestrictedPushCampaign')){
  const marker='export async function listRestrictedPushCampaigns';
  const insert='export async function deleteRestrictedPushCampaign(request:Request,env:Env,publicId:string){const auth=await requireOperator(request,env);if(!auth.admin)return auth.response!;return deleteAdminPushCampaign(request,env,publicId)}\n';
  if(!restricted.includes(marker)) throw new Error('adminRestricted marker not found');
  restricted=restricted.replace(marker,insert+marker);
}
fs.writeFileSync(restrictedPath,restricted);

let index=fs.readFileSync(indexPath,'utf8');
index=index.replace(
  'createRestrictedEmailCampaign, createRestrictedPushCampaign, listRestrictedAppSettings',
  'createRestrictedEmailCampaign, createRestrictedPushCampaign, deleteRestrictedPushCampaign, listRestrictedAppSettings'
);
if(!index.includes('deleteRestrictedPushCampaign(request,env,url.pathname.split("/")[4]')){
  const marker='else if(request.method==="POST"&&url.pathname==="/admin/push/campaigns")response=await createRestrictedPushCampaign(request,env);';
  const route='else if(request.method==="DELETE"&&/^\\/admin\\/push\\/campaigns\\/[^/]+$/.test(url.pathname))response=await deleteRestrictedPushCampaign(request,env,url.pathname.split("/")[4]??"");';
  if(!index.includes(marker)) throw new Error('index push route marker not found');
  index=index.replace(marker,route+marker);
}
fs.writeFileSync(indexPath,index);
console.log('Applied CRM push delete action backend');
