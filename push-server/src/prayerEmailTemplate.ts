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

type LastActivity = {
  label?: string;
  detail?: string;
  occurredAt?: string;
};

const NAMES: Record<PrayerKey, { en: string; ar: string }> = {
  fajr: { en: "Fajr", ar: "الفجر" },
  dhuhr: { en: "Dhuhr", ar: "الظهر" },
  asr: { en: "Asr", ar: "العصر" },
  maghrib: { en: "Maghrib", ar: "المغرب" },
  isha: { en: "Isha", ar: "العشاء" }
};
const PRAYERS: PrayerKey[] = ["fajr", "dhuhr", "asr", "maghrib", "isha"];
const ICONS: Record<PrayerKey, string> = { fajr: "🌅", dhuhr: "☀️", asr: "🌤️", maghrib: "🌇", isha: "🌙" };
const HASSOUN_LOGO = "https://hassoun.app/icon-192.png";
const PROPERTY_COUSINS_LOGO = "https://hassoun.app/property-cousins-sponsor.jpg";
const PROPERTY_COUSINS_SITE = "https://thepropertycousins.net/";
const PROPERTY_COUSINS_ADDRESS = "2055 Sandwich W Pkwy Unit 1200, Windsor, ON N9H 2M8";
const PROPERTY_COUSINS_PHONE = "(519) 970-0202";

function esc(value: unknown) {
  return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

function time12(value: unknown) {
  const text = String(value ?? "");
  const match = text.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return text;
  const hour = Number(match[1]);
  const suffix = hour >= 12 ? "PM" : "AM";
  return `${hour % 12 || 12}:${match[2]} ${suffix}`;
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

function button(url: string, label: string, background = "#0b654f") {
  return `<a href="${esc(url)}" style="display:inline-block;background:${background};color:#fff;text-decoration:none;border-radius:14px;padding:13px 17px;font-size:13px;font-weight:900;margin:4px">${esc(label)}</a>`;
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
  const greeting = firstName ? t(`Assalamu Alaikum ${firstName} 👋`, `السلام عليكم ${firstName} 👋`) : t("Assalamu Alaikum 👋", "السلام عليكم 👋");
  const appUrl = String(data.appUrl || "https://hassoun.app/").replace(/\/$/, "");
  const manageUrl = String(data.manageUrl ?? "");
  const prayerTimes = (data.prayerTimes && typeof data.prayerTimes === "object" ? data.prayerTimes : {}) as PrayerTimes;
  const event = (data.upcomingEvent && typeof data.upcomingEvent === "object" ? data.upcomingEvent : null) as UpcomingEvent | null;
  const lastActivity = (data.lastActivity && typeof data.lastActivity === "object" ? data.lastActivity : null) as LastActivity | null;

  const subject = ar
    ? kind === "twenty" ? `🕌 ${prayer} بعد ٢٠ دقيقة • استعد للصلاة` : kind === "ten" ? `⏰ ${prayer} بعد ١٠ دقائق • Hassoun` : `🕌 حان وقت ${prayer} • حيّ على الصلاة`
    : kind === "twenty" ? `🕌 ${prayer} in 20 minutes — prepare for prayer` : kind === "ten" ? `⏰ ${prayer} in 10 minutes — Hassoun` : `🕌 It’s time for ${prayer} — Hayya ‘ala-s-Salah`;

  const heroKicker = kind === "twenty" ? t("20 MINUTES TO PRAYER", "متبقي ٢٠ دقيقة") : kind === "ten" ? t("10 MINUTES TO PRAYER", "متبقي ١٠ دقائق") : t("IT’S PRAYER TIME", "حان وقت الصلاة");
  const intro = kind === "athan"
    ? t("May Allah accept your prayer. Open Hassoun after Salah for Qur’an, daily learning, Islamic events and games.", "تقبّل الله صلاتك. افتح Hassoun بعد الصلاة للقرآن والتعلّم اليومي والمناسبات والألعاب الإسلامية.")
    : t("A gentle reminder to prepare, make wudu and step away from distractions before prayer begins.", "تذكير لطيف للاستعداد والوضوء والابتعاد عن المشتتات قبل دخول وقت الصلاة.");

  const rows = PRAYERS.map((key) => {
    const active = key === prayerKey;
    return `<td width="20%" style="padding:3px"><div style="border-radius:14px;border:1px solid ${active ? "#0b654f" : "#e7dfd1"};background:${active ? "#0b654f" : "#fffdf8"};padding:9px 3px;text-align:center"><div style="font-size:17px">${ICONS[key]}</div><div style="font-size:10px;font-weight:900;color:${active ? "#fff" : "#173f35"};margin-top:4px">${esc(NAMES[key][locale])}</div><div style="font-size:10px;font-weight:900;color:${active ? "#f6d97f" : "#31584d"};margin-top:4px">${esc(time12(prayerTimes[key]))}</div></div></td>`;
  }).join("");

  const eventBlock = event && typeof event.daysLeft === "number" && event.daysLeft >= 0 && event.daysLeft <= 15
    ? `<tr><td style="padding:0 22px 18px"><div style="background:#fff4cf;border:1px solid #e2c56b;border-radius:18px;padding:16px;text-align:${ar ? "right" : "left"}"><div style="font-size:10px;letter-spacing:1px;color:#98752e;font-weight:900">${esc(t("🌙 UPCOMING ISLAMIC EVENT", "🌙 المناسبة الإسلامية القادمة"))}</div><div style="font-size:19px;font-weight:900;color:#173f35;margin-top:5px">${esc(event.emoji || "🌙")} ${esc(ar ? event.nameAr : event.nameEn)}</div><div style="font-size:13px;color:#5f6f69;margin-top:6px;line-height:1.5">${esc(ar ? event.descriptionAr : event.descriptionEn)}</div><div style="margin-top:9px;font-size:12px;font-weight:900;color:#0b654f">${esc(ar ? `متبقي ${event.daysLeft} يوم` : `${event.daysLeft} days remaining`)}</div></div></td></tr>`
    : "";

  const activityBlock = lastActivity?.label
    ? `<tr><td style="padding:0 22px 18px"><div style="background:#eef5f2;border-radius:18px;padding:16px;text-align:${ar ? "right" : "left"}"><div style="font-size:10px;color:#9a7a39;font-weight:900;letter-spacing:1px">${esc(t("WELCOME BACK", "مرحباً بعودتك"))}</div><div style="font-size:16px;color:#173f35;font-weight:900;margin-top:5px">${esc(lastActivity.label)}</div>${lastActivity.detail ? `<div style="font-size:12px;color:#61736c;margin-top:5px">${esc(lastActivity.detail)}</div>` : ""}</div></td></tr>`
    : "";

  const ctas = `<tr><td align="center" style="padding:0 18px 18px">${button(`${appUrl}/`, t("✨ Open Hassoun", "✨ افتح Hassoun"))}${button(`${appUrl}/quran`, t("📖 Read Qur’an", "📖 اقرأ القرآن"), "#9a7628")}${button(`${appUrl}/?open=quiz`, t("🧠 Play & Learn", "🧠 العب وتعلّم"), "#31584d")}</td></tr>`;

  const manage = manageUrl ? `<tr><td align="center" style="padding:0 22px 18px"><a href="${esc(manageUrl)}" style="color:#0b654f;font-size:12px;font-weight:800">${esc(t("Manage my prayer email alerts", "إدارة تنبيهات الصلاة عبر البريد"))}</a></td></tr>` : "";

  const sponsor = `<tr><td style="padding:20px 22px;background:#f8f1e4;border-top:1px solid #eadfc9;text-align:center"><div style="font-size:11px;letter-spacing:1.2px;color:#806a42;font-weight:900">${esc(t("THIS PROJECT IS SADAQAH JARIYAH", "هذا المشروع صدقة جارية"))}</div><p style="margin:7px auto 14px;max-width:500px;color:#5e675f;font-size:12px;line-height:1.55">${esc(t("Hassoun is built as an ongoing charity to help Muslims stay connected to Salah, Qur’an and beneficial Islamic knowledge. Please make dua for everyone who supports it.", "تم بناء Hassoun كصدقة جارية لمساعدة المسلمين على المحافظة على الصلاة والقرآن والعلم النافع. نسألكم الدعاء لكل من يدعم هذا المشروع."))}</p><div style="font-size:10px;color:#8c806c;font-weight:800;margin-bottom:8px">${esc(t("Proudly sponsored by", "برعاية"))}</div><a href="${PROPERTY_COUSINS_SITE}" style="text-decoration:none"><img src="${PROPERTY_COUSINS_LOGO}" alt="The Property Cousins Realty Inc." width="210" style="display:block;max-width:210px;width:100%;height:auto;margin:0 auto 10px;border:0"><div style="font-size:13px;color:#173f35;font-weight:900">THE PROPERTY COUSINS REALTY INC.</div></a><div style="font-size:11px;color:#756d60;line-height:1.55;margin-top:5px">${PROPERTY_COUSINS_ADDRESS}<br>${PROPERTY_COUSINS_PHONE}</div></td></tr>`;

  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#f2ede3;font-family:Arial,Helvetica,sans-serif;color:#173f35"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f2ede3;padding:20px 10px"><tr><td align="center"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#fffdf8;border:1px solid #ded5c5;border-radius:26px;overflow:hidden" dir="${ar ? "rtl" : "ltr"}"><tr><td style="padding:18px 22px"><table role="presentation" width="100%"><tr><td width="58"><img src="${HASSOUN_LOGO}" width="52" height="52" alt="Hassoun" style="display:block;border-radius:15px;background:#003d33"></td><td style="padding-${ar ? "right" : "left"}:11px;text-align:${ar ? "right" : "left"}"><div style="font-size:12px;font-weight:900;letter-spacing:2px;color:#a0782c">HASSOUN</div><div style="font-size:12px;color:#65756f;margin-top:2px">${esc(t("Prayer • Qur’an • Knowledge", "الصلاة • القرآن • المعرفة"))}</div></td><td style="text-align:${ar ? "left" : "right"};font-size:10px;color:#8e9189">📍 ${esc(location)}</td></tr></table></td></tr><tr><td style="background:#075b48;padding:23px 22px;text-align:${ar ? "right" : "left"}"><div style="font-size:10px;letter-spacing:1.5px;color:#eed27d;font-weight:900">${esc(heroKicker)}</div><div style="font-size:15px;color:#d7e7e1;font-weight:700;margin-top:8px">${esc(greeting)}</div><table role="presentation" width="100%"><tr><td><div style="font-size:31px;color:#fff;font-weight:900;margin-top:7px">${esc(prayer)}</div><div style="font-size:13px;color:#c8ded7;margin-top:4px">${esc(NAMES[prayerKey][ar ? "en" : "ar"])}</div></td><td style="text-align:${ar ? "left" : "right"};vertical-align:bottom"><div style="font-size:28px;color:#fff;font-weight:900">${esc(prayerTime)}</div></td></tr></table><div style="height:1px;background:rgba(255,255,255,.16);margin:17px 0 10px"></div><div style="font-size:12px;color:#d7e7e1">${esc(dateLabel(prayerDate, locale))} • ${esc(hijriLabel(prayerDate, locale))}</div></td></tr><tr><td style="padding:18px 22px 12px;text-align:${ar ? "right" : "left"}"><p style="margin:0;color:#355c52;font-size:15px;line-height:1.65;font-weight:700">${esc(intro)}</p></td></tr><tr><td style="padding:8px 18px 18px"><div style="font-size:12px;font-weight:900;padding:0 4px 8px">${esc(t("Today’s prayer schedule", "جدول صلوات اليوم"))}</div><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr>${rows}</tr></table></td></tr><tr><td style="padding:0 22px 18px"><div style="background:#edf5f1;border-radius:18px;padding:15px;text-align:${ar ? "right" : "left"}"><div style="font-size:10px;color:#9a7a39;font-weight:900;letter-spacing:1px">${esc(t("💚 DAILY REMINDER", "💚 تذكير اليوم"))}</div><div style="font-size:17px;line-height:1.6;color:#244d42;font-weight:800;margin-top:5px">${esc(t("Hearts find comfort in the remembrance of Allah.", "ألا بذكر الله تطمئن القلوب."))}</div><div style="font-size:10px;color:#73837d;margin-top:4px">Qur’an 13:28</div></div></td></tr>${activityBlock}${eventBlock}${ctas}${manage}${sponsor}<tr><td style="padding:14px 22px 20px;text-align:center;color:#97958d;font-size:10px;line-height:1.5">${esc(t("Prayer times follow your current saved prayer location. Windsor uses the official local source; other locations use GPS-based calculations. Islamic-event dates may vary by local moon sighting.", "مواقيت الصلاة تتبع موقع الصلاة المحفوظ لديك. تستخدم وندسور المصدر المحلي الرسمي، بينما تستخدم المواقع الأخرى حسابات مبنية على GPS. قد تختلف تواريخ المناسبات حسب رؤية الهلال المحلية."))}</td></tr></table></td></tr></table></body></html>`;

  const scheduleText = PRAYERS.map((key) => `${NAMES[key][locale]} ${time12(prayerTimes[key])}`).join(" • ");
  const eventText = event && typeof event.daysLeft === "number" && event.daysLeft <= 15 ? `\n${event.emoji || "🌙"} ${ar ? event.nameAr : event.nameEn} — ${event.daysLeft} ${t("days", "يوم")}` : "";
  const activityText = lastActivity?.label ? `\n${t("Last time in Hassoun", "آخر نشاط في Hassoun")}: ${lastActivity.label}${lastActivity.detail ? ` — ${lastActivity.detail}` : ""}` : "";
  const text = `${greeting}\n${subject}\n${prayerTime} • ${location}\n${dateLabel(prayerDate, locale)} • ${hijriLabel(prayerDate, locale)}\n${scheduleText}${activityText}${eventText}\n\n${t("Open Hassoun", "افتح Hassoun")}: ${appUrl}/\n${t("This project is Sadaqah Jariyah, sponsored by The Property Cousins Realty Inc.", "هذا المشروع صدقة جارية برعاية The Property Cousins Realty Inc.")}\n${PROPERTY_COUSINS_ADDRESS} • ${PROPERTY_COUSINS_PHONE}${manageUrl ? `\n${manageUrl}` : ""}`;
  return { subject, html, text };
}
