import fs from 'node:fs';

function replaceOnce(text, from, to, label) {
  if (!text.includes(from)) throw new Error(`Missing source for ${label}`);
  return text.replace(from, to);
}

// Persist the native FCM token sent by the Android app.
const indexPath = 'src/index.ts';
let index = fs.readFileSync(indexPath, 'utf8');
const registerPattern = /async function registerExpo\(request:Request,env:Env\)\{[\s\S]*?return json\(\{ok:true\}\)\}/;
if (!registerPattern.test(index)) throw new Error('Could not locate registerExpo');
index = index.replace(registerPattern, `async function registerExpo(request:Request,env:Env){
  const body=await bodyJson(request),token=body.token,platform=body.platform;
  if(!validInstallId(body.installationId))return json({error:"Invalid installationId"},400);
  if(typeof token!=="string"||!/^ExponentPushToken\\[[^\\]]+\\]$|^ExpoPushToken\\[[^\\]]+\\]$/.test(token))return json({error:"Invalid Expo push token"},400);
  if(platform!=="android"&&platform!=="ios")return json({error:"Invalid platform"},400);
  const locale=validLocale(body.locale)?body.locale:"en",prayerPushEnabled=platform==="android"?0:1;
  const nativeToken=platform==="android"&&typeof body.nativeToken==="string"&&body.nativeToken.length>20&&body.nativeToken.length<4096?body.nativeToken:null;
  const nativeTokenType=platform==="android"&&typeof body.nativeTokenType==="string"?body.nativeTokenType.slice(0,32):null;
  await env.DB.prepare(\`INSERT INTO subscriptions (installation_id, provider, platform, locale, address, app_version, notify_twenty, notify_ten, notify_athan, native_token, native_token_type) VALUES (?, 'expo', ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(provider, address) DO UPDATE SET installation_id=excluded.installation_id,platform=excluded.platform,locale=excluded.locale,app_version=excluded.app_version,notify_twenty=excluded.notify_twenty,notify_ten=excluded.notify_ten,notify_athan=excluded.notify_athan,native_token=excluded.native_token,native_token_type=excluded.native_token_type,enabled=1,updated_at=CURRENT_TIMESTAMP\`).bind(body.installationId,platform,locale,token,body.appVersion??null,prayerPushEnabled,prayerPushEnabled,prayerPushEnabled,nativeToken,nativeTokenType).run();
  return json({ok:true,nativePushRegistered:Boolean(nativeToken)});
}`);
fs.writeFileSync(indexPath, index);

// Add the Firebase secret to the Worker env type.
const typesPath = 'src/types.ts';
let types = fs.readFileSync(typesPath, 'utf8');
if (!types.includes('FIREBASE_SERVICE_ACCOUNT_JSON?: string;')) {
  types = replaceOnce(types, '  EXPO_ACCESS_TOKEN?: string;\n', '  EXPO_ACCESS_TOKEN?: string;\n  FIREBASE_SERVICE_ACCOUNT_JSON?: string;\n', 'Firebase env type');
}
fs.writeFileSync(typesPath, types);

// Route Android admin pushes directly through FCM when the native token and Firebase credential exist.
const adminPath = 'src/adminPush.ts';
let admin = fs.readFileSync(adminPath, 'utf8');
if (!admin.includes('import { sendFcmMessage } from "./fcm";')) {
  admin = replaceOnce(admin, 'import { requireAdmin } from "./adminAuth";\n', 'import { requireAdmin } from "./adminAuth";\nimport { sendFcmMessage } from "./fcm";\n', 'FCM import');
}
if (!admin.includes('native_token: string | null;')) {
  admin = replaceOnce(admin, '  web_auth: string | null;\n', '  web_auth: string | null;\n  native_token: string | null;\n  native_token_type: string | null;\n', 'native token subscription fields');
}
if (!admin.includes('async function sendNativeFcm')) {
  admin = replaceOnce(admin, 'async function sendExpo(env: Env, subscription: TargetSubscription, campaign: CampaignRow) {', `async function sendNativeFcm(env: Env, subscription: TargetSubscription, campaign: CampaignRow) {
  if (!subscription.native_token) throw new Error("Missing native FCM token");
  const message = localizedMessage(campaign, subscription.locale);
  try {
    const ticket = await sendFcmMessage(env, {
      token: subscription.native_token,
      title: message.title,
      body: message.body,
      priority: campaign.priority,
      data: {
        type: "admin_push",
        campaignId: campaign.public_id,
        category: campaign.category,
        deepLink: campaign.deep_link || "",
        imageUrl: campaign.image_url || ""
      }
    });
    return { invalid: false, ticket };
  } catch (error) {
    const status = (error as Error & { fcmStatus?: string }).fcmStatus;
    if (status === "UNREGISTERED" || status === "INVALID_ARGUMENT") {
      await env.DB.prepare("UPDATE subscriptions SET native_token = NULL, native_token_type = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(subscription.id).run();
      return { invalid: true, ticket: undefined };
    }
    throw error;
  }
}

async function sendExpo(env: Env, subscription: TargetSubscription, campaign: CampaignRow) {`, 'native FCM sender');
}
admin = replaceOnce(
  admin,
  '    `SELECT s.id, s.subscriber_id, s.provider, s.platform, s.locale, s.address,\n            s.web_p256dh, s.web_auth, s.notify_announcements, s.notify_community_events,',
  '    `SELECT s.id, s.subscriber_id, s.provider, s.platform, s.locale, s.address,\n            s.web_p256dh, s.web_auth, s.native_token, s.native_token_type, s.notify_announcements, s.notify_community_events,',
  'native token select'
);
admin = replaceOnce(
  admin,
  '      const result = subscription.provider === "expo"\n        ? await sendExpo(env, subscription, campaign)\n        : await sendWeb(env, subscription, campaign);',
  '      const result = subscription.platform === "android" && subscription.native_token && env.FIREBASE_SERVICE_ACCOUNT_JSON\n        ? await sendNativeFcm(env, subscription, campaign)\n        : subscription.provider === "expo"\n          ? await sendExpo(env, subscription, campaign)\n          : await sendWeb(env, subscription, campaign);',
  'direct FCM dispatch'
);
fs.writeFileSync(adminPath, admin);

console.log('Applied native FCM token persistence and direct Android FCM routing');
