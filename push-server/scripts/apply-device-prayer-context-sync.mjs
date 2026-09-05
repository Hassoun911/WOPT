import fs from 'node:fs';

const indexPath = 'src/index.ts';
const emailPath = 'src/globalPrayerEmail.ts';

let index = fs.readFileSync(indexPath, 'utf8');
const registerExpo = `async function registerExpo(request:Request,env:Env){
  const body=await bodyJson(request),token=body.token,platform=body.platform;
  if(!validInstallId(body.installationId))return json({error:"Invalid installationId"},400);
  if(typeof token!=="string"||!/^ExponentPushToken\\[[^\\]]+\\]$|^ExpoPushToken\\[[^\\]]+\\]$/.test(token))return json({error:"Invalid Expo push token"},400);
  if(platform!=="android"&&platform!=="ios")return json({error:"Invalid platform"},400);
  const locale=validLocale(body.locale)?body.locale:"en",prayerPushEnabled=platform==="android"?0:1;
  await env.DB.prepare(\`INSERT INTO subscriptions (installation_id, provider, platform, locale, address, app_version, notify_twenty, notify_ten, notify_athan) VALUES (?, 'expo', ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(provider, address) DO UPDATE SET installation_id=excluded.installation_id,platform=excluded.platform,locale=excluded.locale,app_version=excluded.app_version,notify_twenty=excluded.notify_twenty,notify_ten=excluded.notify_ten,notify_athan=excluded.notify_athan,enabled=1,updated_at=CURRENT_TIMESTAMP\`).bind(body.installationId,platform,locale,token,body.appVersion??null,prayerPushEnabled,prayerPushEnabled,prayerPushEnabled).run();

  const latitude=typeof body.latitude==="number"&&Number.isFinite(body.latitude)&&body.latitude>=-90&&body.latitude<=90?body.latitude:null;
  const longitude=typeof body.longitude==="number"&&Number.isFinite(body.longitude)&&body.longitude>=-180&&body.longitude<=180?body.longitude:null;
  const timezone=typeof body.scheduleTimeZone==="string"&&body.scheduleTimeZone.length<=80?body.scheduleTimeZone:null;
  let timezoneValid=false;
  if(timezone){try{new Intl.DateTimeFormat("en",{timeZone:timezone}).format(new Date());timezoneValid=true}catch{}}
  const method=Number.isInteger(body.calculationMethod)&&Number(body.calculationMethod)>=0&&Number(body.calculationMethod)<=99?Number(body.calculationMethod):null;
  const school=body.calculationSchool===1?1:0;
  const highLatitude=Number.isInteger(body.highLatitude)&&Number(body.highLatitude)>=0&&Number(body.highLatitude)<=3?Number(body.highLatitude):3;
  const tune=typeof body.tune==="string"&&/^-?\\d{1,2}(,-?\\d{1,2}){8}$/.test(body.tune)?body.tune:"0,0,0,0,0,0,0,0,0";
  const label=typeof body.locationLabel==="string"?body.locationLabel.trim().slice(0,200):"";
  const labelParts=label.split(",").map((part)=>part.trim()).filter(Boolean);
  const city=labelParts[0]||null,region=labelParts[1]||null;

  if(latitude!==null&&longitude!==null&&timezone&&timezoneValid){
    const linked=await env.DB.prepare("SELECT subscriber_id FROM subscriptions WHERE installation_id=? AND subscriber_id IS NOT NULL LIMIT 1").bind(body.installationId).first<{subscriber_id:number}>();
    if(linked?.subscriber_id){
      await env.DB.prepare(\`UPDATE email_subscribers SET latitude=?, longitude=?, timezone=?, city=COALESCE(?,city), region=COALESCE(?,region), calculation_method=COALESCE(?,calculation_method), madhab=?, high_latitude=?, tune=?, location_updated_at=CURRENT_TIMESTAMP, updated_at=CURRENT_TIMESTAMP WHERE id=?\`).bind(latitude,longitude,timezone,city,region,method,school===1?"hanafi":"standard",highLatitude,tune,linked.subscriber_id).run();
    }
  }
  return json({ok:true,contextSynced:latitude!==null&&longitude!==null&&Boolean(timezone&&timezoneValid)});
}
`;

const expoPattern = /async function registerExpo\(request:Request,env:Env\)\{.*?\}(?=\n?async function registerWeb)/s;
if (!expoPattern.test(index)) throw new Error('registerExpo function not found');
index = index.replace(expoPattern, registerExpo);
fs.writeFileSync(indexPath, index);

let email = fs.readFileSync(emailPath, 'utf8');
email = email.replace(
  'calculation_method: number | null; madhab: "standard" | "hanafi"; prayer: PrayerKey;',
  'calculation_method: number | null; madhab: "standard" | "hanafi"; high_latitude: number; tune: string; prayer: PrayerKey;'
);
email = email.replace(
  'return [subscriber.latitude.toFixed(4), subscriber.longitude.toFixed(4), subscriber.timezone, methodFor(subscriber), subscriber.madhab].join("|");',
  'return [subscriber.latitude.toFixed(4), subscriber.longitude.toFixed(4), subscriber.timezone, methodFor(subscriber), subscriber.madhab, subscriber.high_latitude, subscriber.tune].join("|");'
);
email = email.replace(
  's.country_code, s.country_name, s.region, s.city, s.calculation_method, s.madhab,\n            p.prayer,',
  's.country_code, s.country_name, s.region, s.city, s.calculation_method, s.madhab, s.high_latitude, s.tune,\n            p.prayer,'
);
email = email.replace(
  'calculation_method: row.calculation_method, madhab: row.madhab, preferences: {}',
  'calculation_method: row.calculation_method, madhab: row.madhab, high_latitude: row.high_latitude, tune: row.tune, preferences: {}'
);
const apiAnchor = 'url.searchParams.set("latitude", String(subscriber.latitude)); url.searchParams.set("longitude", String(subscriber.longitude)); url.searchParams.set("method", String(methodFor(subscriber))); url.searchParams.set("school", subscriber.madhab === "hanafi" ? "1" : "0");';
const apiReplacement = apiAnchor + ' url.searchParams.set("latitudeAdjustmentMethod", String(subscriber.high_latitude ?? 3)); url.searchParams.set("tune", subscriber.tune || "0,0,0,0,0,0,0,0,0");';
if (!email.includes(apiAnchor)) throw new Error('global prayer API anchor not found');
email = email.replace(apiAnchor, apiReplacement);

for (const required of ['high_latitude', 'subscriber.tune', 'latitudeAdjustmentMethod']) {
  if (!email.includes(required)) throw new Error(`globalPrayerEmail missing ${required}`);
}
fs.writeFileSync(emailPath, email);

console.log('Applied canonical device -> push/email prayer context synchronization');
