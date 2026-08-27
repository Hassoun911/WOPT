import fs from 'node:fs';

const path='app/admin/push/page.tsx';
let s=fs.readFileSync(path,'utf8');

s=s.replace(
  "setWhen('');setPushEnabled(true);setEditingFrom(x.public_id)",
  "setWhen('');setPushEnabled(true);setTickerEnabled(true);setDuration('until-cleared');setEditingFrom(x.public_id)"
);

const old="await call('/admin/push/campaigns',token,{method:'POST',body:JSON.stringify({name:x.name||x.title_en,titleEn:x.title_en,titleAr:x.title_ar||undefined,bodyEn:x.body_en,bodyAr:x.body_ar||undefined,category:'announcement',audience:'all_devices',targetPlatform:x.target_platform||'all',targetLocale:x.target_locale||'all',targetCountryCode:x.target_country_code||undefined,targetCity:x.target_city||undefined,priority:'high',scheduledAt:new Date().toISOString()})});setNotice('Push resent and queued for delivery.');";
const replacement="const resentAt=new Date();await call('/admin/push/campaigns',token,{method:'POST',body:JSON.stringify({name:x.name||x.title_en,titleEn:x.title_en,titleAr:x.title_ar||undefined,bodyEn:x.body_en,bodyAr:x.body_ar||undefined,category:'announcement',audience:'all_devices',targetPlatform:x.target_platform||'all',targetLocale:x.target_locale||'all',targetCountryCode:x.target_country_code||undefined,targetCity:x.target_city||undefined,priority:'high',scheduledAt:resentAt.toISOString()})});await call('/admin/settings/scrolling_ticker',token,{method:'POST',body:JSON.stringify({value:{enabled:true,textEn:x.body_en||x.title_en||x.name,textAr:x.body_ar||x.body_en||x.title_ar||x.title_en||x.name,startsAt:resentAt.toISOString(),expiresAt:null,updatedAt:resentAt.toISOString()}})});setNotice('Push resent and scrolling bar reactivated.');";
if(!s.includes(old) && !s.includes("Push resent and scrolling bar reactivated.")) throw new Error('resend marker not found');
s=s.replace(old,replacement);

fs.writeFileSync(path,s);
console.log('Resend now reactivates scrolling ticker and Edit & resend enables both channels');
