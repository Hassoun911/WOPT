import type { Locale, PrayerKey } from "./types";

export type PrayerEmailRendered = { subject: string; html: string; text: string };
type PrayerTimes = Partial<Record<PrayerKey, string>>;
type UpcomingEvent = { emoji?: string; daysLeft?: number; nameEn?: string; nameAr?: string; descriptionEn?: string; descriptionAr?: string };

const NAMES: Record<PrayerKey, { en: string; ar: string }> = {
  fajr: { en: "Fajr", ar: "الفجر" }, dhuhr: { en: "Dhuhr", ar: "الظهر" }, asr: { en: "Asr", ar: "العصر" },
  maghrib: { en: "Maghrib", ar: "المغرب" }, isha: { en: "Isha", ar: "العشاء" }
};
const PRAYERS: PrayerKey[] = ["fajr", "dhuhr", "asr", "maghrib", "isha"];
const ICONS: Record<PrayerKey, string> = { fajr: "☀", dhuhr: "◉", asr: "☼", maghrib: "◐", isha: "☾" };

function esc(value: unknown) { return String(value ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\"/g,"&quot;").replace(/'/g,"&#039;"); }
function time12(value: unknown) { const text=String(value??""); const m=text.match(/^(\d{1,2}):(\d{2})/); if(!m)return text; const h=Number(m[1]); return `${h%12||12}:${m[2]} ${h>=12?"PM":"AM"}`; }
function gregorianLabel(dateKey:string){ try{return new Intl.DateTimeFormat("en-CA",{timeZone:"UTC",weekday:"long",month:"long",day:"numeric",year:"numeric"}).format(new Date(`${dateKey}T12:00:00Z`));}catch{return dateKey;} }
function hijriLabel(dateKey:string){ try{return new Intl.DateTimeFormat("ar-u-ca-islamic-umalqura",{calendar:"islamic-umalqura",timeZone:"UTC",day:"numeric",month:"long",year:"numeric"}).format(new Date(`${dateKey}T12:00:00Z`));}catch{return "";} }

export function prayerDashboardEmail(data: Record<string, unknown>, _locale: Locale): PrayerEmailRendered {
  const prayerKey=(typeof data.prayer==="string"&&data.prayer in NAMES?data.prayer:"fajr") as PrayerKey;
  const kind=String(data.kind??"athan");
  const prayerDate=String(data.prayerDate??new Date().toISOString().slice(0,10));
  const prayerTime=time12(data.prayerTime);
  const location=String(data.locationLabel??"your location");
  const manageUrl=String(data.manageUrl??"");
  const prayerTimes=(data.prayerTimes&&typeof data.prayerTimes==="object"?data.prayerTimes:{}) as PrayerTimes;
  const event=(data.upcomingEvent&&typeof data.upcomingEvent==="object"?data.upcomingEvent:null) as UpcomingEvent|null;
  const enPrayer=NAMES[prayerKey].en, arPrayer=NAMES[prayerKey].ar;

  const enSubject=kind==="twenty"?`🕌🌙 ${enPrayer} in 20 minutes`:kind==="ten"?`🕌✨ ${enPrayer} in 10 minutes`:`🕌🌙 It’s prayer time — ${enPrayer}`;
  const arSubject=kind==="twenty"?`بقي ٢٠ دقيقة على صلاة ${arPrayer}`:kind==="ten"?`بقي ١٠ دقائق على صلاة ${arPrayer}`:`حان وقت صلاة ${arPrayer}`;
  const subject=`${enSubject} | ${arSubject}`;
  const kickerEn=kind==="twenty"?"20 MINUTES TO PRAYER":kind==="ten"?"10 MINUTES TO PRAYER":"IT'S PRAYER TIME";
  const kickerAr=kind==="twenty"?"متبقي ٢٠ دقيقة":kind==="ten"?"متبقي ١٠ دقائق":"حان وقت الصلاة";

  const prayerRows=PRAYERS.map(key=>{ const active=key===prayerKey; const bg=active?"#0b654f":"#fffdf8"; const fg=active?"#fff":"#173f35"; const muted=active?"#c9dfd7":"#89928e";
    return `<td width="20%" style="padding:4px"><div style="min-height:92px;border-radius:15px;border:1px solid ${active?"#0b654f":"#e7dfd1"};background:${bg};padding:10px 5px;text-align:center"><div style="font-size:17px;color:${active?"#f0d27a":"#a98138"}">${ICONS[key]}</div><div style="font-size:11px;font-weight:800;color:${fg};margin-top:5px">${esc(NAMES[key].en)}</div><div dir="rtl" style="font-size:10px;font-weight:800;color:${muted};margin-top:2px">${esc(NAMES[key].ar)}</div><div style="font-size:11px;font-weight:900;color:${active?"#f6d97f":"#31584d"};margin-top:5px">${esc(time12(prayerTimes[key]))}</div></div></td>`; }).join("");

  const eventBlock=event&&typeof event.daysLeft==="number"&&event.daysLeft<=15?`<tr><td style="padding:0 22px 18px"><table role="presentation" width="100%" style="background:#fff4cf;border:1px solid #e2c56b;border-radius:18px"><tr><td style="padding:15px;text-align:center"><div style="font-size:10px;letter-spacing:1.2px;color:#98752e;font-weight:900">UPCOMING ISLAMIC EVENT • المناسبة الإسلامية القادمة</div><div style="font-size:19px;font-weight:900;color:#173f35;margin-top:7px">${esc(event.emoji||"🌙")} ${esc(event.nameEn||"")}</div><div dir="rtl" style="font-size:18px;font-weight:900;color:#173f35;margin-top:3px">${esc(event.nameAr||event.nameEn||"")}</div><div style="font-size:13px;color:#5f6f69;margin-top:7px;line-height:1.5">${esc(event.descriptionEn||"")}</div><div dir="rtl" style="font-size:13px;color:#5f6f69;margin-top:4px;line-height:1.8">${esc(event.descriptionAr||event.descriptionEn||"")}</div><div style="display:inline-block;margin-top:10px;background:#0b654f;color:#fff;border-radius:99px;padding:7px 11px;font-size:11px;font-weight:900">${event.daysLeft} days remaining • متبقي ${event.daysLeft} يوم</div></td></tr></table></td></tr>`:"";
  const action=manageUrl?`<tr><td align="center" style="padding:0 22px 22px"><a href="${esc(manageUrl)}" style="display:block;background:#0b654f;color:#fff;text-decoration:none;border-radius:14px;padding:14px 18px;font-size:13px;font-weight:900;text-align:center">Manage prayer alerts • إدارة تنبيهات الصلاة</a></td></tr>`:"";
  const logo="https://raw.githubusercontent.com/Hassoun911/WOPT/main/pwa/public/assets/hassoun-logo.png";

  const html=`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#f2ede3;font-family:Arial,Helvetica,sans-serif;color:#173f35"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f2ede3;padding:20px 10px"><tr><td align="center"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#fffdf8;border:1px solid #ded5c5;border-radius:26px;overflow:hidden;box-shadow:0 8px 30px rgba(40,56,48,.08)">
  <tr><td style="padding:18px 22px;background:#fffdf8;text-align:center"><img src="${logo}" width="52" height="52" alt="Prayer" style="display:inline-block;border-radius:15px;background:#003d33"><div style="font-size:12px;font-weight:900;letter-spacing:2px;color:#a0782c;margin-top:8px">PRAYER TIME • وقت الصلاة</div><div style="font-size:12px;color:#65756f;margin-top:3px">Prayer • Qur’an • Knowledge<br><span dir="rtl">الصلاة • القرآن • المعرفة</span></div><div style="font-size:10px;color:#8e9189;margin-top:6px">${esc(location)}</div></td></tr>
  <tr><td style="background:#075b48;padding:23px 22px;text-align:center"><div style="font-size:10px;letter-spacing:1.5px;color:#eed27d;font-weight:900">${esc(kickerEn)} • <span dir="rtl">${esc(kickerAr)}</span></div><div style="font-size:31px;color:#fff;font-weight:900;margin-top:8px">${esc(enPrayer)} <span style="font-size:24px;color:#c8ded7" dir="rtl">• ${esc(arPrayer)}</span></div><div style="font-size:28px;color:#fff;font-weight:900;margin-top:8px">${esc(prayerTime)}</div><div style="height:1px;background:rgba(255,255,255,.16);margin:17px 0 10px"></div><div style="font-size:12px;color:#d7e7e1">${esc(gregorianLabel(prayerDate))}<br><span dir="rtl">${esc(hijriLabel(prayerDate))}</span></div></td></tr>
  <tr><td style="padding:19px 18px 8px;text-align:center"><div style="font-size:12px;font-weight:900;color:#173f35;padding:0 4px 8px">Today’s prayer schedule • جدول صلوات اليوم</div><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr>${prayerRows}</tr></table></td></tr>
  <tr><td style="padding:10px 22px 18px"><table role="presentation" width="100%" style="background:#edf5f1;border-radius:18px"><tr><td style="padding:15px;text-align:center"><div style="font-size:10px;color:#9a7a39;font-weight:900;letter-spacing:1px">DAILY REMINDER • تذكير اليوم</div><div style="font-size:17px;line-height:1.6;color:#244d42;font-weight:800;margin-top:6px">Hearts find comfort in the remembrance of Allah.</div><div dir="rtl" style="font-size:17px;line-height:1.8;color:#244d42;font-weight:800;margin-top:4px">ألا بذكر الله تطمئن القلوب.</div><div style="font-size:10px;color:#73837d;margin-top:5px">Qur’an 13:28</div></td></tr></table></td></tr>
  ${eventBlock}${action}
  <tr><td style="padding:0 22px 22px;text-align:center;color:#97958d;font-size:10px;line-height:1.7">Prayer times are based on your selected location and time zone. Islamic-event dates may vary by local moon sighting.<br><span dir="rtl">مواقيت الصلاة حسب موقعك ومنطقتك الزمنية، وقد تختلف تواريخ المناسبات بحسب رؤية الهلال المحلية.</span></td></tr>
</table><div style="max-width:600px;margin:12px auto 0;text-align:center;color:#9b988f;font-size:10px">Stay connected to prayer • ابقَ متصلاً بالصلاة</div></td></tr></table></body></html>`;

  const scheduleText=PRAYERS.map(key=>`${NAMES[key].en}/${NAMES[key].ar} ${time12(prayerTimes[key])}`).join(" • ");
  const text=`${subject}\n${prayerTime} • ${location}\n${gregorianLabel(prayerDate)} • ${hijriLabel(prayerDate)}\n${scheduleText}\nHearts find comfort in the remembrance of Allah.\nألا بذكر الله تطمئن القلوب.${manageUrl?`\n${manageUrl}`:""}`;
  return {subject,html,text};
}
