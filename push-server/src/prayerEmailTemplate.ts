import type { Locale, PrayerKey } from "./types";

export type PrayerEmailRendered = { subject: string; html: string; text: string };
type PrayerTimes = Partial<Record<PrayerKey, string>>;
type UpcomingEvent = {
  emoji?: string;
  daysLeft?: number;
  nameEn?: string;
  nameAr?: string;
  descriptionEn?: string;
  descriptionAr?: string;
};
type LastActivity = { label?: string; detail?: string; occurredAt?: string };

const NAMES: Record<PrayerKey, { en: string; ar: string }> = {
  fajr: { en: "Fajr", ar: "الفجر" },
  dhuhr: { en: "Dhuhr", ar: "الظهر" },
  asr: { en: "Asr", ar: "العصر" },
  maghrib: { en: "Maghrib", ar: "المغرب" },
  isha: { en: "Isha", ar: "العشاء" }
};
const ICONS: Record<PrayerKey, string> = { fajr: "🌅", dhuhr: "☀️", asr: "🌤️", maghrib: "🌇", isha: "🌙" };
const PRAYERS: PrayerKey[] = ["fajr", "dhuhr", "asr", "maghrib", "isha"];
const HASSOUN_LOGO = "https://hassoun.app/icon-192.png";
const PROPERTY_COUSINS_LOGO = "https://hassoun.app/property-cousins-sponsor.jpg";
const PROPERTY_COUSINS_SITE = "https://thepropertycousins.net/";
const PROPERTY_COUSINS_ADDRESS = "2055 Sandwich W Pkwy Unit 1200, Windsor, ON N9H 2M8";
const PROPERTY_COUSINS_PHONE = "(519) 970-0202";

function esc(value: unknown) {
  return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;").replace(/'/g, "&#039;");
}

function time12(value: unknown) {
  const text = String(value ?? "");
  const match = text.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return text;
  const hour = Number(match[1]);
  return `${hour % 12 || 12}:${match[2]} ${hour >= 12 ? "PM" : "AM"}`;
}

function dateLabel(dateKey: string, locale: Locale) {
  try {
    return new Intl.DateTimeFormat(locale === "ar" ? "ar-CA" : "en-CA", {
      timeZone: "UTC", weekday: "long", month: "long", day: "numeric", year: "numeric"
    }).format(new Date(`${dateKey}T12:00:00Z`));
  } catch { return dateKey; }
}

function hijriLabel(dateKey: string, locale: Locale) {
  try {
    return new Intl.DateTimeFormat(locale === "ar" ? "ar-u-ca-islamic-umalqura" : "en-u-ca-islamic-umalqura", {
      calendar: "islamic-umalqura", timeZone: "UTC", day: "numeric", month: "long", year: "numeric"
    }).format(new Date(`${dateKey}T12:00:00Z`));
  } catch { return ""; }
}

function cta(url: string, label: string, secondary = false) {
  const bg = secondary ? "#f2ede2" : "#0b654f";
  const fg = secondary ? "#17483d" : "#ffffff";
  const border = secondary ? "1px solid #ddd5c7" : "1px solid #0b654f";
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 9px"><tr><td><a href="${esc(url)}" style="display:block;background:${bg};color:${fg};border:${border};text-decoration:none;text-align:center;border-radius:14px;padding:14px 16px;font-size:14px;font-weight:800">${esc(label)}</a></td></tr></table>`;
}

export function prayerDashboardEmail(data: Record<string, unknown>, locale: Locale): PrayerEmailRendered {
  const ar = locale === "ar";
  const t = (en: string, arabic: string) => ar ? arabic : en;
  const prayerKey = (typeof data.prayer === "string" && data.prayer in NAMES ? data.prayer : "fajr") as PrayerKey;
  const prayer = NAMES[prayerKey][locale];
  const kind = String(data.kind ?? "athan");
  const prayerDate = String(data.prayerDate ?? new Date().toISOString().slice(0, 10));
  const prayerTime = time12(data.prayerTime);
  const location = String(data.locationLabel ?? t("your current location", "موقعك الحالي"));
  const displayName = String(data.displayName ?? "").trim();
  const firstName = displayName ? displayName.split(/\s+/)[0] : "";
  const greeting = firstName ? t(`Assalamu Alaikum ${firstName}`, `السلام عليكم ${firstName}`) : t("Assalamu Alaikum", "السلام عليكم");
  const appUrl = String(data.appUrl || "https://hassoun.app").replace(/\/$/, "");
  const manageUrl = String(data.manageUrl ?? "");
  const prayerTimes = (data.prayerTimes && typeof data.prayerTimes === "object" ? data.prayerTimes : {}) as PrayerTimes;
  const event = (data.upcomingEvent && typeof data.upcomingEvent === "object" ? data.upcomingEvent : null) as UpcomingEvent | null;
  const lastActivity = (data.lastActivity && typeof data.lastActivity === "object" ? data.lastActivity : null) as LastActivity | null;

  const subject = ar
    ? kind === "twenty" ? `🕌 ${prayer} بعد ٢٠ دقيقة` : kind === "ten" ? `⏰ ${prayer} بعد ١٠ دقائق` : `🕌 حان وقت ${prayer}`
    : kind === "twenty" ? `🕌 ${prayer} in 20 minutes` : kind === "ten" ? `⏰ ${prayer} in 10 minutes` : `🕌 It’s time for ${prayer}`;

  const heroKicker = kind === "twenty" ? t("20 MINUTES TO PRAYER", "متبقي ٢٠ دقيقة") : kind === "ten" ? t("10 MINUTES TO PRAYER", "متبقي ١٠ دقائق") : t("IT’S PRAYER TIME", "حان وقت الصلاة");
  const intro = kind === "athan"
    ? t("May Allah accept your prayer. Take a quiet moment for Salah, then return to Hassoun for Qur’an and beneficial learning.", "تقبّل الله صلاتك. خذ لحظة هادئة للصلاة، ثم عد إلى Hassoun للقرآن والعلم النافع.")
    : t("A gentle reminder to prepare, make wudu and step away from distractions before prayer begins.", "تذكير لطيف للاستعداد والوضوء والابتعاد عن المشتتات قبل دخول وقت الصلاة.");

  const scheduleRows = PRAYERS.map((key) => {
    const active = key === prayerKey;
    return `<tr><td style="padding:0 22px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-top:1px solid #ece6dc"><tr><td width="46" style="padding:12px 0;font-size:20px">${ICONS[key]}</td><td style="padding:12px 0;text-align:${ar ? "right" : "left"}"><div style="font-size:14px;font-weight:800;color:${active ? "#0b654f" : "#294e45"}">${esc(NAMES[key][locale])}</div><div style="font-size:11px;color:#8d958f;margin-top:2px">${esc(NAMES[key][ar ? "en" : "ar"])}</div></td><td align="${ar ? "left" : "right"}" style="padding:12px 0"><span style="display:inline-block;min-width:82px;text-align:center;border-radius:12px;padding:8px 10px;background:${active ? "#0b654f" : "#f4f1ea"};color:${active ? "#fff" : "#31574d"};font-size:13px;font-weight:900">${esc(time12(prayerTimes[key]))}</span></td></tr></table></td></tr>`;
  }).join("");

  const eventBlock = event && typeof event.daysLeft === "number" && event.daysLeft >= 0 && event.daysLeft <= 15
    ? `<tr><td style="padding:18px 22px 0"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#fff6dc;border:1px solid #ead18a;border-radius:18px"><tr><td style="padding:16px;text-align:${ar ? "right" : "left"}"><div style="font-size:10px;letter-spacing:1.2px;color:#9a762d;font-weight:900">${esc(t("UPCOMING ISLAMIC EVENT", "المناسبة الإسلامية القادمة"))}</div><div style="font-size:18px;font-weight:900;color:#173f35;margin-top:6px">${esc(event.emoji || "🌙")} ${esc(ar ? event.nameAr : event.nameEn)}</div><div style="font-size:13px;color:#64716c;line-height:1.55;margin-top:7px">${esc(ar ? event.descriptionAr : event.descriptionEn)}</div><div style="font-size:12px;color:#0b654f;font-weight:900;margin-top:9px">${esc(ar ? `متبقي ${event.daysLeft} يوم` : `${event.daysLeft} days remaining`)}</div></td></tr></table></td></tr>`
    : "";

  const activityBlock = lastActivity?.label
    ? `<tr><td style="padding:14px 22px 0"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#eef5f2;border:1px solid #dbe8e2;border-radius:18px"><tr><td style="padding:15px;text-align:${ar ? "right" : "left"}"><div style="font-size:10px;letter-spacing:1.2px;color:#8f743a;font-weight:900">${esc(t("WELCOME BACK", "مرحباً بعودتك"))}</div><div style="font-size:15px;color:#173f35;font-weight:900;margin-top:6px">${esc(lastActivity.label)}</div>${lastActivity.detail ? `<div style="font-size:12px;color:#65756f;line-height:1.5;margin-top:5px">${esc(lastActivity.detail)}</div>` : ""}</td></tr></table></td></tr>`
    : "";

  const actions = `<tr><td style="padding:20px 22px 4px">${cta(`${appUrl}/`, t("Open Hassoun", "افتح Hassoun"))}${cta(`${appUrl}/quran/`, t("Read Qur’an", "اقرأ القرآن"), true)}${manageUrl ? `<div style="text-align:center;padding:7px 0 2px"><a href="${esc(manageUrl)}" style="color:#0b654f;font-size:12px;font-weight:800;text-decoration:underline">${esc(t("Manage prayer email alerts", "إدارة تنبيهات الصلاة عبر البريد"))}</a></div>` : ""}</td></tr>`;

  const sponsor = `<tr><td style="padding:18px 22px 22px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f7f1e6;border-radius:18px"><tr><td align="center" style="padding:16px"><div style="font-size:10px;letter-spacing:1.1px;color:#806a42;font-weight:900">${esc(t("THIS PROJECT IS SADAQAH JARIYAH", "هذا المشروع صدقة جارية"))}</div><div style="font-size:11px;line-height:1.55;color:#6f6b62;margin:7px 0 12px">${esc(t("Hassoun is built to help Muslims stay connected to Salah, Qur’an and beneficial knowledge.", "تم بناء Hassoun لمساعدة المسلمين على المحافظة على الصلاة والقرآن والعلم النافع."))}</div><a href="${PROPERTY_COUSINS_SITE}" style="text-decoration:none"><img src="${PROPERTY_COUSINS_LOGO}" width="170" alt="The Property Cousins Realty Inc." style="display:block;width:170px;max-width:100%;height:auto;margin:0 auto 8px;border:0"><div style="font-size:11px;font-weight:900;color:#173f35">THE PROPERTY COUSINS REALTY INC.</div></a><div style="font-size:10px;line-height:1.5;color:#817b70;margin-top:5px">${PROPERTY_COUSINS_ADDRESS}<br>${PROPERTY_COUSINS_PHONE}</div></td></tr></table></td></tr>`;

  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>@media only screen and (max-width:620px){.outer{padding:0!important}.card{border-radius:0!important;border-left:0!important;border-right:0!important}.hero-pad{padding:22px 18px!important}.header-pad{padding:17px 18px!important}}</style></head><body style="margin:0;background:#f1ede5;font-family:Arial,Helvetica,sans-serif;color:#173f35"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" class="outer" style="background:#f1ede5;padding:18px 8px"><tr><td align="center"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" class="card" style="max-width:600px;background:#fffdf9;border:1px solid #ded7cb;border-radius:24px;overflow:hidden" dir="${ar ? "rtl" : "ltr"}"><tr><td class="header-pad" style="padding:18px 22px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td width="58"><img src="${HASSOUN_LOGO}" width="50" height="50" alt="Hassoun" style="display:block;border-radius:14px;border:0"></td><td style="padding-${ar ? "right" : "left"}:10px;text-align:${ar ? "right" : "left"}"><div style="font-size:12px;font-weight:900;letter-spacing:1.7px;color:#9b762f">HASSOUN</div><div style="font-size:12px;color:#70807a;margin-top:3px">${esc(t("Prayer • Qur’an • Knowledge", "الصلاة • القرآن • المعرفة"))}</div></td><td align="${ar ? "left" : "right"}" style="font-size:10px;color:#8f958f">📍 ${esc(location)}</td></tr></table></td></tr><tr><td class="hero-pad" style="background:#0b654f;padding:26px 22px;text-align:${ar ? "right" : "left"}"><div style="font-size:10px;letter-spacing:1.4px;color:#f0d27a;font-weight:900">${esc(heroKicker)}</div><div style="font-size:14px;color:#d8e9e3;font-weight:700;margin-top:8px">${esc(greeting)}</div><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:7px"><tr><td><div style="font-size:34px;line-height:1.1;color:#fff;font-weight:900">${esc(prayer)}</div><div style="font-size:14px;color:#c8ddd6;margin-top:4px">${esc(NAMES[prayerKey][ar ? "en" : "ar"])}</div></td><td align="${ar ? "left" : "right"}" valign="bottom"><div style="font-size:28px;color:#fff;font-weight:900;white-space:nowrap">${esc(prayerTime)}</div></td></tr></table><div style="border-top:1px solid rgba(255,255,255,.18);margin-top:18px;padding-top:13px;font-size:13px;line-height:1.55;color:#dcebe6">${esc(intro)}</div></td></tr><tr><td style="padding:18px 22px 9px;text-align:${ar ? "right" : "left"}"><div style="font-size:11px;color:#9b762f;font-weight:900;letter-spacing:1px">${esc(t("TODAY’S PRAYERS", "صلوات اليوم"))}</div><div style="font-size:17px;color:#173f35;font-weight:900;margin-top:5px">${esc(dateLabel(prayerDate, locale))}</div>${hijriLabel(prayerDate, locale) ? `<div style="font-size:12px;color:#7b8782;margin-top:4px">🌙 ${esc(hijriLabel(prayerDate, locale))}</div>` : ""}</td></tr>${scheduleRows}${eventBlock}${activityBlock}${actions}${sponsor}</table><div style="max-width:600px;text-align:center;padding:12px 10px 20px;color:#99958d;font-size:10px">Hassoun • ${esc(location)}</div></td></tr></table></body></html>`;

  const text = [
    greeting,
    `${prayer} — ${prayerTime}`,
    intro,
    `${t("Location", "الموقع")}: ${location}`,
    `${t("Date", "التاريخ")}: ${dateLabel(prayerDate, locale)}`,
    ...PRAYERS.map((key) => `${NAMES[key][locale]}: ${time12(prayerTimes[key])}`),
    event ? `${t("Upcoming", "القادمة")}: ${ar ? event.nameAr : event.nameEn}` : "",
    lastActivity?.label ? `${t("Last activity", "آخر نشاط")}: ${lastActivity.label}` : "",
    `${t("Open Hassoun", "افتح Hassoun")}: ${appUrl}`,
    manageUrl ? `${t("Manage alerts", "إدارة التنبيهات")}: ${manageUrl}` : "",
    `The Property Cousins Realty Inc. — ${PROPERTY_COUSINS_ADDRESS} — ${PROPERTY_COUSINS_PHONE}`
  ].filter(Boolean).join("\n");

  return { subject, html, text };
}
