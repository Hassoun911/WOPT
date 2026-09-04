import { requireAdmin } from "./adminAuth";
import { listAdminSubscribers } from "./adminData";
import { listAppSettings, listAuditLog, updateAppSetting, updateSubscriberStatus } from "./adminCrm";
import { createAdminEmailCampaign, listAdminEmailCampaigns } from "./adminEmail";
import { createAdminPushCampaign, dispatchDueAdminPushCampaigns, listAdminPushCampaigns } from "./adminPush";
import { processEmailOutbox } from "./emailDelivery";
import { subscribeByEmail } from "./subscribers";
import type { Env } from "./types";
function json(data:unknown,status=200){return new Response(JSON.stringify(data),{status,headers:{"Content-Type":"application/json"}})}
async function authenticated(request:Request,env:Env){const auth=await requireAdmin(request,env);if(!auth.admin)return {admin:null,response:auth.response!};return {admin:auth.admin,response:null}}
async function requireOperator(request:Request,env:Env){const auth=await authenticated(request,env);if(!auth.admin)return auth;if(auth.admin.role!=="owner"&&auth.admin.role!=="admin")return {admin:null,response:json({error:"Owner or admin access required"},403)};return auth}
const isOperator=(role:string)=>role==="owner"||role==="admin";
const ADMIN_TEST_EMAIL="windsor.hassoun@gmail.com";
const TEST_ARABIC_NAMES:Record<string,string>={announcement:"إعلان",community_event:"فعالية مجتمعية",daily_content:"المحتوى الإسلامي اليومي",marketing:"رسالة تسويقية",religious_occasion:"مناسبة إسلامية"};
export async function listRestrictedSubscribers(request:Request,env:Env,url:URL){const auth=await authenticated(request,env);if(!auth.admin)return auth.response!;if(!isOperator(auth.admin.role))return json({ok:true,subscribers:[]});return listAdminSubscribers(request,env,url)}
async function createRestrictedSubscriber(request:Request,env:Env){const auth=await requireOperator(request,env);if(!auth.admin)return auth.response!;const clone=request.clone();const body=await clone.json().catch(()=>null) as Record<string,unknown>|null;if(!body)return json({error:"Invalid request body"},400);const email=typeof body.email==="string"?body.email.trim().toLowerCase():"";if(!email)return json({error:"Email is required"},400);const signup=await subscribeByEmail(request,env);if(!signup.ok)return signup;const row=await env.DB.prepare("SELECT id,public_id,email FROM email_subscribers WHERE email=? COLLATE NOCASE LIMIT 1").bind(email).first<{id:number;public_id:string;email:string}>();if(!row)return json({error:"Subscriber creation failed"},500);await env.DB.batch([env.DB.prepare("UPDATE email_subscribers SET status='active',unsubscribed_at=NULL,verification_token_hash=NULL,verification_expires_at=NULL,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(row.id),env.DB.prepare("UPDATE email_outbox SET status='cancelled',updated_at=CURRENT_TIMESTAMP WHERE subscriber_id=? AND kind='verification' AND status='pending'").bind(row.id)]);return json({ok:true,subscriber:{public_id:row.public_id,email:row.email,status:"active"}})}
async function sendRestrictedTemplateTest(env:Env,templateKey:string){
  const profile=await env.DB.prepare("SELECT template_key,name,category FROM email_template_profiles WHERE template_key=? LIMIT 1").bind(templateKey).first<{template_key:string;name:string;category:string}>();
  if(!profile)return json({error:"Template profile not found"},404);
  const kind=templateKey==="prayer_alert"?"prayer":templateKey;
  const testData={message:profile.name,verificationUrl:"https://hassoun.app/",manageUrl:"https://hassoun.app/",resetUrl:"https://hassoun.app/admin/",prayer:"fajr",prayerTime:"5:30 AM",locationLabel:"Windsor, Ontario",timezone:"America/Toronto",prayerTimes:{fajr:"5:30 AM",dhuhr:"1:30 PM",asr:"5:00 PM",maghrib:"7:45 PM",isha:"9:00 PM"},upcomingEvent:{emoji:"🌙",nameEn:"Upcoming Islamic Occasion",nameAr:"المناسبة الإسلامية القادمة",descriptionEn:"An upcoming Islamic occasion and reminder from Hassoun.",descriptionAr:"مناسبة إسلامية قادمة وتذكير من حسون.",daysLeft:7}};
  const systemKinds=new Set(["verification","manage","admin_password_reset","prayer"]);
  let renderTemplateKey:string|null=null;
  if(!systemKinds.has(kind)){
    renderTemplateKey=`admin_test_${crypto.randomUUID().replace(/-/g,"")}`;
    const titleEn=profile.name;
    const titleAr=TEST_ARABIC_NAMES[kind]||profile.name;
    const bodyEn=`<div style="font-family:Arial,sans-serif"><h2 style="margin:0 0 10px">${titleEn}</h2><p style="margin:0">This is the message area that recipients will see for this ${titleEn.toLowerCase()} email.</p></div>`;
    const bodyAr=`<div dir="rtl" style="font-family:Arial,sans-serif;text-align:right"><h2 style="margin:0 0 10px">${titleAr}</h2><p style="margin:0">هذه هي منطقة الرسالة التي سيشاهدها المستلمون في هذا البريد.</p></div>`;
    await env.DB.prepare("INSERT INTO email_templates (template_key,name,category,subject_en,subject_ar,html_en,html_ar,text_en,text_ar,enabled) VALUES (?,?,?,?,?,?,?,?,?,1)").bind(renderTemplateKey,`Admin test ${profile.name}`,profile.category,titleEn,titleAr,bodyEn,bodyAr,`${titleEn}\nThis is the message area recipients will see.`,`${titleAr}\nهذه هي منطقة الرسالة التي سيشاهدها المستلمون.`).run();
  }
  try{
    if(renderTemplateKey){
      await env.DB.prepare("INSERT INTO email_outbox (recipient_email,locale,kind,template_key,template_data_json,idempotency_key,scheduled_at) VALUES (?,'en',?,?,?,?,CURRENT_TIMESTAMP)").bind(ADMIN_TEST_EMAIL,kind,renderTemplateKey,JSON.stringify(testData),`admin-template-test:${templateKey}:${crypto.randomUUID()}`).run();
    }else{
      await env.DB.prepare("INSERT INTO email_outbox (recipient_email,locale,kind,template_data_json,idempotency_key,scheduled_at) VALUES (?,'en',?,?,?,CURRENT_TIMESTAMP)").bind(ADMIN_TEST_EMAIL,kind,JSON.stringify(testData),`admin-template-test:${templateKey}:${crypto.randomUUID()}`).run();
    }
    const delivery=await processEmailOutbox(env);
    return json({ok:true,recipient:ADMIN_TEST_EMAIL,templateKey,delivery,productionReplica:true});
  }finally{
    if(renderTemplateKey)await env.DB.prepare("DELETE FROM email_templates WHERE template_key=?").bind(renderTemplateKey).run();
  }
}
export async function listRestrictedAppSettings(request:Request,env:Env){const auth=await authenticated(request,env);if(!auth.admin)return auth.response!;if(!isOperator(auth.admin.role))return json({ok:true,settings:[]});return listAppSettings(request,env)}
export async function updateRestrictedAppSetting(request:Request,env:Env,key:string){const auth=await requireOperator(request,env);if(!auth.admin)return auth.response!;return updateAppSetting(request,env,key)}
export async function updateRestrictedSubscriberStatus(request:Request,env:Env,publicId:string|undefined){const auth=await requireOperator(request,env);if(!auth.admin)return auth.response!;if(!publicId)return json({error:"Subscriber id is required"},400);if(publicId==="create")return createRestrictedSubscriber(request,env);return updateSubscriberStatus(request,env,publicId)}
export async function listRestrictedAuditLog(request:Request,env:Env,url:URL){const auth=await authenticated(request,env);if(!auth.admin)return auth.response!;if(!isOperator(auth.admin.role))return json({ok:true,entries:[]});return listAuditLog(request,env,url)}
export async function createRestrictedPushCampaign(request:Request,env:Env){const auth=await requireOperator(request,env);if(!auth.admin)return auth.response!;const response=await createAdminPushCampaign(request,env);if(response.ok)await dispatchDueAdminPushCampaigns(env);return response}
export async function listRestrictedPushCampaigns(request:Request,env:Env){const auth=await authenticated(request,env);if(!auth.admin)return auth.response!;if(!isOperator(auth.admin.role))return json({ok:true,campaigns:[]});return listAdminPushCampaigns(request,env)}
export async function createRestrictedEmailCampaign(request:Request,env:Env){const auth=await requireOperator(request,env);if(!auth.admin)return auth.response!;const clone=request.clone();const body=await clone.json().catch(()=>null) as Record<string,unknown>|null;if(body?.action==="send_template_test"){const templateKey=typeof body.templateKey==="string"?body.templateKey.trim():"";if(!templateKey)return json({error:"Template key is required"},400);return sendRestrictedTemplateTest(env,templateKey)}return createAdminEmailCampaign(request,env)}
export async function listRestrictedEmailCampaigns(request:Request,env:Env){const auth=await authenticated(request,env);if(!auth.admin)return auth.response!;if(!isOperator(auth.admin.role))return json({ok:true,campaigns:[]});return listAdminEmailCampaigns(request,env)}
