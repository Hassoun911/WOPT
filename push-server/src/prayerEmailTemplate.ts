import type { Locale, PrayerKey } from "./types";

export type PrayerEmailRendered={subject:string;html:string;text:string};
type PrayerTimes=Partial<Record<PrayerKey,string>>;
const NAMES:Record<PrayerKey,{en:string;ar:string}>={fajr:{en:"Fajr",ar:"الفجر"},dhuhr:{en:"Dhuhr",ar:"الظهر"},asr:{en:"Asr",ar:"العصر"},maghrib:{en:"Maghrib",ar:"المغرب"},isha:{en:"Isha",ar:"العشاء"}};
const PRAYERS:PrayerKey[]=["fajr","dhuhr","asr","maghrib","isha"];
const ICONS:Record<PrayerKey,string>={fajr:"🌅",dhuhr:"☀️",asr:"🌤️",maghrib:"🌇",isha:"🌙"};
function esc(v:unknown){return String(v??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\"/g,"&quot;").replace(/'/g,"&#039;")}
function time12(v:unknown){const t=String(v??""),m=t.match(/^(\d{1,2}):(\d{2})/);if(!m)return t;const h=Number(m[1]);return`${h%12||12}:${m[2]} ${h>=12?"PM":"AM"}`}
function clockMinutes(v:unknown){const m=String(v??"").match(/^(\d{1,2}):(\d{2})/);if(!m)return null;const h=Number(m[1]),min=Number(m[2]);return h>=0&&h<24&&min>=0&&min<60?h*60+min:null}
function durationLabel(total:number){const n=Math.max(0,Math.round(total));if(n===0)return"now";if(n<60)return`${n} min`;const h=Math.floor(n/60),m=n%60;return m?`${h}h ${m}m`:`${h}h`}
function durationLabelAr(total:number){const n=Math.max(0,Math.round(total));if(n===0)return"الآن";if(n<60)return`${n} دقيقة`;const h=Math.floor(n/60),m=n%60;return m?`${h} س ${m} د`:`${h} س`}
function dateLabel(dateKey:string,locale:Locale,calendar?:string){try{return new Intl.DateTimeFormat(locale==="ar"?(calendar?"ar-u-ca-islamic-umalqura":"ar-CA"):(calendar?"en-u-ca-islamic-umalqura":"en-CA"),{calendar:calendar||undefined,timeZone:"UTC",weekday:calendar?undefined:"long",month:"long",day:"numeric",year:"numeric"}).format(new Date(`${dateKey}T12:00:00Z`))}catch{return calendar?"":dateKey}}

export function prayerDashboardEmail(data:Record<string,unknown>,_locale:Locale):PrayerEmailRendered{
 const key=(typeof data.prayer==="string"&&data.prayer in NAMES?data.prayer:"fajr") as PrayerKey;
 const kind=String(data.kind??"athan"),date=String(data.prayerDate??new Date().toISOString().slice(0,10)),rawPrayerTime=String(data.prayerTime??""),ptime=time12(rawPrayerTime),location=String(data.locationLabel??"Windsor, Ontario"),manageUrl=String(data.manageUrl??""),times=(data.prayerTimes&&typeof data.prayerTimes==="object"?data.prayerTimes:{}) as PrayerTimes;
 const explicitRemaining=typeof data.minutesUntilPrayer==="number"&&Number.isFinite(data.minutesUntilPrayer)?Math.max(0,Number(data.minutesUntilPrayer)):null;
 const currentRemaining=explicitRemaining??(kind==="twenty"?20:kind==="ten"?10:0);
 const currentIndex=PRAYERS.indexOf(key),nextKey=PRAYERS[(currentIndex+1)%PRAYERS.length]??"fajr",nextRaw=String(times[nextKey]??""),nextTime=time12(nextRaw);
 const currentClock=clockMinutes(rawPrayerTime||times[key]),nextClock=clockMinutes(nextRaw);
 let nextRemaining:number|null=null;
 if(currentClock!==null&&nextClock!==null){let gap=nextClock-currentClock;if(gap<=0)gap+=24*60;nextRemaining=currentRemaining+gap;}
 const currentCountdown=durationLabel(currentRemaining),currentCountdownAr=durationLabelAr(currentRemaining),nextCountdown=nextRemaining===null?"":durationLabel(nextRemaining),nextCountdownAr=nextRemaining===null?"":durationLabelAr(nextRemaining);
 const enStatus=currentRemaining===0?`${NAMES[key].en} is now`:`${NAMES[key].en} in ${currentCountdown}`;
 const arStatus=currentRemaining===0?`حان وقت ${NAMES[key].ar}`:`${NAMES[key].ar} بعد ${currentCountdownAr}`;
 const enSubject=currentRemaining===0?`🕌🔔 ${NAMES[key].en} prayer now`:`🕌⏳ ${NAMES[key].en} in ${currentCountdown}`;
 const arSubject=currentRemaining===0?`حان وقت صلاة ${NAMES[key].ar}`:`صلاة ${NAMES[key].ar} بعد ${currentCountdownAr}`;
 const subject=`${enSubject} • ${arSubject} 🌙`;
 const nextMeta=nextCountdown?`${nextTime} • in ${nextCountdown}`:nextTime;
 const nextMetaAr=nextCountdownAr?`${nextTime} • بعد ${nextCountdownAr}`:nextTime;
 const manage=manageUrl?`<tr><td class="edge" style="padding:0 14px 12px"><a href="${esc(manageUrl)}" style="display:block;text-align:center;background:#08735a;color:#fff;text-decoration:none;border-radius:11px;padding:11px;font-size:11px;font-weight:900">⚙️ Manage alerts • إدارة التنبيهات</a></td></tr>`:"";
 const logo="https://admin.hassoun.app/hassoun-logo.png";
 const html=`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>@media(max-width:520px){.shell{width:100%!important}.edge{padding-left:10px!important;padding-right:10px!important}.prayer-name{font-size:21px!important}.countdown{font-size:18px!important}}</style></head><body style="margin:0;background:#edf0ee;font-family:Arial,Helvetica,sans-serif;color:#173f35"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#edf0ee;padding:10px 6px"><tr><td align="center"><table class="shell" role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:500px;background:#fff;border:1px solid #d8e2de;border-radius:20px;overflow:hidden">
 <tr><td style="background:#064d3e;padding:13px 14px;color:white"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td width="48" valign="middle"><img src="${logo}" width="44" height="44" alt="Hassoun" style="display:block;border-radius:12px;border:1px solid #d8bd68;background:#063b31"></td><td valign="middle" style="padding-left:10px"><div style="font-size:9px;letter-spacing:1.4px;color:#e8cc75;font-weight:900">HASSOUN • PRAYER ALERT</div><div class="prayer-name" style="font-size:23px;line-height:1.15;font-weight:950;margin-top:3px">${ICONS[key]} ${esc(enStatus)}</div><div dir="rtl" style="font-size:13px;color:#f0ddd0;font-weight:800;margin-top:3px;text-align:left">${esc(arStatus)}</div></td></tr></table></td></tr>
 <tr><td class="edge" style="padding:12px 14px 8px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f7f3e8;border:1px solid #e6dcc5;border-radius:14px"><tr><td style="padding:12px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td valign="middle"><div style="font-size:9px;color:#8c7849;font-weight:900">${esc(NAMES[key].en.toUpperCase())} • ${esc(NAMES[key].ar)}</div><div style="font-size:18px;color:#173f35;font-weight:950;margin-top:4px">${esc(ptime)}</div></td><td align="right" valign="middle"><div style="font-size:9px;color:#8c7849;font-weight:900">TIME LEFT</div><div class="countdown" style="font-size:20px;color:#08735a;font-weight:950;margin-top:4px">${esc(currentCountdown)}</div><div dir="rtl" style="font-size:10px;color:#678078;font-weight:800;margin-top:2px">${esc(currentCountdownAr)}</div></td></tr></table></td></tr></table></td></tr>
 <tr><td class="edge" style="padding:0 14px 8px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#eaf8f2;border:1px solid #cfe9de;border-radius:14px"><tr><td width="42" align="center" valign="middle" style="font-size:19px;padding:11px 4px">${ICONS[nextKey]}</td><td valign="middle" style="padding:10px 5px"><div style="font-size:9px;color:#71847d;font-weight:900">NEXT PRAYER • الصلاة القادمة</div><div style="font-size:14px;color:#08735a;font-weight:950;margin-top:3px">${esc(NAMES[nextKey].en)} • ${esc(NAMES[nextKey].ar)}</div></td><td width="135" align="right" valign="middle" style="padding:10px 11px 10px 4px"><div style="font-size:13px;color:#173f35;font-weight:950;white-space:nowrap">${esc(nextMeta)}</div><div dir="rtl" style="font-size:9px;color:#6b8078;font-weight:800;margin-top:3px;white-space:nowrap">${esc(nextMetaAr)}</div></td></tr></table></td></tr>
 <tr><td style="background:#f8faf9;border-top:1px solid #e2e9e6;text-align:center;padding:8px 10px;color:#71817b;font-size:9px;line-height:1.55">📍 ${esc(location)} • ${esc(dateLabel(date,"en"))}<br><span dir="rtl">${esc(dateLabel(date,"ar"))}</span> • ${esc(dateLabel(date,"en","islamic-umalqura"))}</td></tr>
 <!--HASSOUN_ENHANCEMENTS-->
 ${manage}
 <tr><td style="border-top:1px solid #e1e8e5;text-align:center;padding:10px 12px;color:#74847e;font-size:8.5px;line-height:1.55"><strong style="color:#08735a">☾ HASSOUN</strong> • Prayer • Qur’an • Knowledge<br><span dir="rtl">الصلاة • القرآن • المعرفة</span></td></tr>
 </table></td></tr></table></body></html>`;
 const nextText=nextCountdown?`${NAMES[nextKey].en}/${NAMES[nextKey].ar} ${nextTime} (${nextCountdown})`:`${NAMES[nextKey].en}/${NAMES[nextKey].ar} ${nextTime}`;
 const text=`${subject}\n${NAMES[key].en}/${NAMES[key].ar} ${ptime} — ${currentCountdown}\nNext / الصلاة القادمة: ${nextText}\n${location}\n${dateLabel(date,"en")}${manageUrl?`\n\nManage alerts / إدارة التنبيهات: ${manageUrl}`:""}`;
 return{subject,html,text}
}
