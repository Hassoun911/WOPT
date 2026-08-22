import { prayerDashboardEmail } from "./prayerEmailTemplate";
import type { Env, Locale } from "./types";

type OutboxRow = {
  id: number;
  delivery_id: number | null;
  subscriber_id: number | null;
  recipient_email: string;
  locale: Locale;
  kind: string;
  template_key: string | null;
  template_data_json: string | null;
  idempotency_key: string | null;
  attempts: number;
};
type TemplateRow = { subject_en: string; subject_ar: string | null; html_en: string; html_ar: string | null; text_en: string | null; text_ar: string | null };
type RenderedEmail = { subject: string; html: string; text: string };
type ProfileRow = {
  template_key: string; enabled: number; include_islamic_occasion: number; include_daily_hadith: number;
  include_daily_surah: number; include_occasion_countdown: number; include_motivation: number;
  include_sadaqah_jariyah: number; include_sponsor: number; sponsor_name: string | null; sponsor_url: string | null;
  sponsor_message_en: string | null; sponsor_message_ar: string | null;
};
type ContentRow = { content_type: "hadith" | "surah" | "motivation"; title_en: string; title_ar: string | null; body_en: string; body_ar: string | null; source_ref: string | null };

function configured(env: Env) { return Boolean(env.RESEND_API_KEY && env.EMAIL_FROM); }
export function emailDeliveryConfigured(env: Env) { return configured(env); }

function escapeHtml(value: unknown) {
  return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}
function dataObject(value: string | null) {
  if (!value) return {} as Record<string, unknown>;
  try { const parsed = JSON.parse(value) as unknown; return parsed && typeof parsed === "object" ? parsed as Record<string, unknown> : {}; } catch { return {}; }
}

function brandedEmail(options: { locale: Locale; eyebrow: string; title: string; intro: string; details?: Array<{ label: string; value: string }>; buttonLabel?: string; buttonUrl?: string; note?: string }) {
  const direction = options.locale === "ar" ? "rtl" : "ltr";
  const textAlign = options.locale === "ar" ? "right" : "left";
  const details = (options.details ?? []).filter((item) => item.value).map((item) => `<tr><td style="padding:8px 0;color:#8a806f;font-size:12px;font-weight:700;vertical-align:top;width:120px">${escapeHtml(item.label)}</td><td style="padding:8px 0;color:#214d42;font-size:13px;font-weight:700;vertical-align:top">${escapeHtml(item.value)}</td></tr>`).join("");
  const action = options.buttonUrl && options.buttonLabel ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:22px"><tr><td align="center"><a href="${escapeHtml(options.buttonUrl)}" style="display:block;background:#0b5b47;color:#fff;text-decoration:none;font-size:15px;font-weight:800;text-align:center;padding:15px 20px;border-radius:14px">${escapeHtml(options.buttonLabel)}</a></td></tr></table>` : "";
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#f6f0e5;font-family:Arial,Helvetica,sans-serif;color:#173f35"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f6f0e5;padding:24px 12px"><tr><td align="center"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#fffdf8;border:1px solid #e3dac9;border-radius:24px;overflow:hidden"><tr><td style="padding:24px 24px 18px;text-align:${textAlign}" dir="${direction}"><table role="presentation" width="100%"><tr><td width="58"><img src="https://hassoun.app/assets/hassoun-logo.png" width="54" height="54" alt="Hassoun" style="display:block;border:0;border-radius:15px;background:#003d33"></td><td style="vertical-align:middle;padding-${options.locale === "ar" ? "right" : "left"}:12px"><div style="font-size:11px;letter-spacing:2px;color:#a17825;font-weight:900">🕌 HASSOUN 🌙</div><div style="font-size:14px;color:#355c52;font-weight:800">🕌 Prayer • 📖 Qur’an • 🤲 Knowledge ✨</div></td></tr></table></td></tr><tr><td style="padding:0 24px 26px;text-align:${textAlign}" dir="${direction}"><div style="font-size:11px;letter-spacing:1.6px;color:#9a8a70;font-weight:800">${escapeHtml(options.eyebrow)}</div><h1 style="margin:9px 0 10px;font-size:28px;line-height:1.18;color:#153f35">${escapeHtml(options.title)}</h1><p style="margin:0;color:#6f746c;font-size:15px;line-height:1.65">${escapeHtml(options.intro)}</p>${details ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:20px;background:#f8f3e9;border:1px solid #e6dccb;border-radius:16px;padding:10px 14px">${details}</table>` : ""}${action}${options.note ? `<p style="margin:18px 0 0;color:#8a8377;font-size:12px;line-height:1.6">${escapeHtml(options.note)}</p>` : ""}</td></tr></table><div style="max-width:520px;margin:14px auto 0;color:#9a9488;font-size:11px;text-align:center">🕌 Hassoun • 🤲 Sadaqah Jariyah 🌙✨</div></td></tr></table></body></html>`;
}

function builtInSystemEmail(kind: string, data: Record<string, unknown>, locale: Locale): RenderedEmail {
  if (kind === "verification") {
    const verificationUrl = String(data.verificationUrl ?? ""); const location = String(data.locationLabel ?? ""); const timezone = String(data.timezone ?? "");
    const subject = locale === "ar" ? "🕌📧 تأكيد تنبيهات الصلاة عبر البريد 🤲✨" : "🕌📧 Confirm your Hassoun prayer email alerts 🤲✨";
    return { subject, text: locale === "ar" ? `أكد تنبيهات الصلاة. الموقع: ${location}. ${verificationUrl}` : `Confirm your prayer email alerts. Location: ${location}. ${verificationUrl}`, html: brandedEmail({ locale, eyebrow: locale === "ar" ? "🕌✨ خطوة أخيرة 🤲" : "🕌✨ ONE LAST STEP 🤲", title: locale === "ar" ? "أكد تنبيهات الصلاة" : "Confirm your prayer email alerts", intro: locale === "ar" ? "أكد بريدك لتفعيل التنبيهات حسب موقعك ومواقيت الصلاة المحلية." : "Confirm your email to activate local prayer alerts.", details: [{ label: locale === "ar" ? "الموقع" : "Prayer location", value: location }, { label: locale === "ar" ? "المنطقة الزمنية" : "Time zone", value: timezone }], buttonLabel: locale === "ar" ? "تأكيد التنبيهات" : "Confirm email alerts", buttonUrl: verificationUrl, note: locale === "ar" ? "تنتهي صلاحية الرابط خلال 24 ساعة." : "This confirmation link expires in 24 hours." }) };
  }
  if (kind === "manage") {
    const manageUrl = String(data.manageUrl ?? ""); const subject = locale === "ar" ? "🕌⚙️ إدارة تنبيهات Hassoun 🔔🌙" : "🕌⚙️ Manage your Hassoun email alerts 🔔🌙";
    return { subject, text: `${subject}: ${manageUrl}`, html: brandedEmail({ locale, eyebrow: locale === "ar" ? "⚙️🕌 إعدادات التنبيهات 🔔" : "⚙️🕌 ALERT SETTINGS 🔔", title: locale === "ar" ? "إدارة تنبيهات الصلاة" : "Manage your prayer alerts", intro: locale === "ar" ? "عدّل التنبيهات أو موقع الصلاة أو ألغِ الاشتراك." : "Change reminder timing, prayer location, or unsubscribe.", buttonLabel: locale === "ar" ? "فتح الإعدادات" : "Open alert settings", buttonUrl: manageUrl }) };
  }
  if (kind === "admin_password_reset") {
    const resetUrl = String(data.resetUrl ?? ""); const subject = locale === "ar" ? "🔐🕌 إعادة تعيين كلمة مرور إدارة Hassoun ✨" : "🔐🕌 Reset your Hassoun admin password ✨";
    return { subject, text: `${subject}: ${resetUrl}`, html: brandedEmail({ locale, eyebrow: "HASSOUN ADMIN", title: locale === "ar" ? "إعادة تعيين كلمة المرور" : "Reset your admin password", intro: locale === "ar" ? "استخدم الرابط الآمن لإنشاء كلمة مرور جديدة." : "Use this secure link to create a new admin password.", buttonLabel: locale === "ar" ? "إعادة تعيين كلمة المرور" : "Reset password", buttonUrl: resetUrl, note: locale === "ar" ? "تنتهي صلاحية الرابط خلال ساعة." : "This link expires in one hour." }) };
  }
  const subject = locale === "ar" ? "🕌🌙 تنبيه من Hassoun 🤲✨" : "🕌🌙 Hassoun notification 🤲✨";
  return { subject, text: String(data.message ?? subject), html: brandedEmail({ locale, eyebrow: "HASSOUN", title: locale === "ar" ? "تنبيه جديد" : "New notification", intro: String(data.message ?? subject) }) };
}

function decorateSubject(subject: string) {
  return /[🕌🌙🤲📖✨🔔⏰⏳]/u.test(subject) ? subject : `🕌🌙 ${subject} 🤲✨`;
}

function templateValues(rendered: RenderedEmail, data: Record<string, unknown>) { return { ...data, emailSubject: rendered.subject, emailHtml: rendered.html, emailText: rendered.text } as Record<string, unknown>; }
function applyTemplate(template: string, values: Record<string, unknown>, html: boolean) {
  return template.replace(/\{\{([A-Za-z0-9_]+)\}\}/g, (_match, key: string) => { const value = values[key] ?? ""; return html && key !== "emailHtml" ? escapeHtml(value) : String(value); });
}

function profileKey(row: OutboxRow) {
  if (row.kind === "prayer") return "prayer_alert";
  if (["verification", "manage", "admin_password_reset", "religious_occasion", "daily_content", "announcement", "community_event", "marketing"].includes(row.kind)) return row.kind;
  return "announcement";
}

async function loadProfile(env: Env, row: OutboxRow) {
  return env.DB.prepare(
    `SELECT template_key, enabled, include_islamic_occasion, include_daily_hadith,
            include_daily_surah, include_occasion_countdown, include_motivation,
            include_sadaqah_jariyah, include_sponsor, sponsor_name, sponsor_url,
            sponsor_message_en, sponsor_message_ar
     FROM email_template_profiles WHERE template_key = ? LIMIT 1`
  ).bind(profileKey(row)).first<ProfileRow>();
}

async function loadContent(env: Env) {
  const { results } = await env.DB.prepare(
    `SELECT content_type, title_en, title_ar, body_en, body_ar, source_ref
     FROM email_content_library WHERE enabled = 1 ORDER BY sort_order, id`
  ).all<ContentRow>();
  const map = new Map<string, ContentRow>();
  for (const item of results) if (!map.has(item.content_type)) map.set(item.content_type, item);
  return map;
}

function contentCard(item: ContentRow, locale: Locale, accent: string) {
  const ar = locale === "ar"; const title = ar ? (item.title_ar || item.title_en) : item.title_en; const body = ar ? (item.body_ar || item.body_en) : item.body_en;
  return `<tr><td style="padding:0 22px 14px"><table role="presentation" width="100%" style="background:#fffdf8;border:1px solid #e4ddcf;border-radius:16px"><tr><td dir="${ar ? "rtl" : "ltr"}" style="padding:14px;text-align:${ar ? "right" : "left"}"><div style="font-size:10px;letter-spacing:1.2px;color:${accent};font-weight:900">${escapeHtml(title)}</div><div style="font-size:14px;line-height:1.65;color:#31564c;font-weight:700;margin-top:5px">${escapeHtml(body)}</div>${item.source_ref ? `<div style="font-size:10px;color:#89938f;margin-top:6px">${escapeHtml(item.source_ref)}</div>` : ""}</td></tr></table></td></tr>`;
}

function enhancementHtml(profile: ProfileRow, content: Map<string, ContentRow>, data: Record<string, unknown>, locale: Locale) {
  const ar = locale === "ar"; const blocks: string[] = [];
  const event = data.upcomingEvent && typeof data.upcomingEvent === "object" ? data.upcomingEvent as Record<string, unknown> : null;
  if (event && (profile.include_islamic_occasion === 1 || profile.include_occasion_countdown === 1)) {
    const name = String(ar ? event.nameAr ?? event.nameEn ?? "" : event.nameEn ?? event.nameAr ?? "");
    const description = String(ar ? event.descriptionAr ?? event.descriptionEn ?? "" : event.descriptionEn ?? event.descriptionAr ?? "");
    const days = Number(event.daysLeft ?? 0);
    const countdown = profile.include_occasion_countdown === 1 ? `<div style="display:inline-block;margin-top:9px;background:#0b654f;color:white;border-radius:99px;padding:6px 10px;font-size:11px;font-weight:900">${escapeHtml(ar ? `🌙 متبقي ${days} يوم ✨` : `🌙 ${days} days remaining ✨`)}</div>` : "";
    const details = profile.include_islamic_occasion === 1 ? `<div style="font-size:19px;font-weight:900;color:#173f35">${escapeHtml(event.emoji || "🌙")} ${escapeHtml(name)}</div><div style="font-size:13px;line-height:1.5;color:#60716b;margin-top:5px">${escapeHtml(description)}</div>` : "";
    blocks.push(`<tr><td style="padding:0 22px 14px"><table role="presentation" width="100%" style="background:#fff3cc;border:1px solid #e1c56f;border-radius:16px"><tr><td dir="${ar ? "rtl" : "ltr"}" style="padding:14px;text-align:${ar ? "right" : "left"}"><div style="font-size:10px;letter-spacing:1.2px;color:#9a772c;font-weight:900">${escapeHtml(ar ? "🌙✨ المناسبة الإسلامية القادمة ✨🌙" : "🌙✨ UPCOMING ISLAMIC OCCASION ✨🌙")}</div>${details}${countdown}</td></tr></table></td></tr>`);
  }
  if (profile.include_daily_hadith === 1 && content.get("hadith")) blocks.push(contentCard(content.get("hadith")!, locale, "#9a772c"));
  if (profile.include_daily_surah === 1 && content.get("surah")) blocks.push(contentCard(content.get("surah")!, locale, "#08735a"));
  if (profile.include_motivation === 1 && content.get("motivation")) blocks.push(contentCard(content.get("motivation")!, locale, "#5b6d9a"));
  if (profile.include_sadaqah_jariyah === 1) {
    blocks.push(`<tr><td style="padding:0 22px 14px"><table role="presentation" width="100%" style="background:#edf6f2;border:1px solid #cfe3db;border-radius:16px"><tr><td dir="${ar ? "rtl" : "ltr"}" style="padding:14px;text-align:${ar ? "right" : "left"}"><div style="font-size:10px;letter-spacing:1.2px;color:#08735a;font-weight:900">${escapeHtml(ar ? "صدقة جارية" : "SADAQAH JARIYAH")}</div><div style="font-size:14px;line-height:1.6;color:#31564c;font-weight:800;margin-top:5px">${escapeHtml(ar ? "هذا المشروع صدقة جارية عن عبد الجليل حسون وسلمى حسون. نسأل الله أن يتقبله وينفع به." : "🤲🌙 🤲🌙 Hassoun is a Sadaqah Jariyah for Abdul Jalil Hassoun and Salwa Hassoun. 🕌✨ 🕌✨ May Allah accept it and let its benefit continue.")}</div></td></tr></table></td></tr>`);
  }
  if (profile.include_sponsor === 1) {
    const sponsorName = profile.sponsor_name || (ar ? "قسم الرعاية والدعم" : "Sponsor & Support");
    const sponsorMessage = ar ? (profile.sponsor_message_ar || "يمكنك دعم هذه الصدقة الجارية والمساهمة في استمرارها.") : (profile.sponsor_message_en || "🤝🌙 🤝🌙 Support this Sadaqah Jariyah and help keep Hassoun available and growing. 🤲✨ 🤲✨");
    const link = profile.sponsor_url ? `<a href="${escapeHtml(profile.sponsor_url)}" style="display:inline-block;margin-top:9px;background:#173f35;color:white;text-decoration:none;border-radius:10px;padding:8px 12px;font-size:11px;font-weight:900">${escapeHtml(ar ? "زيارة الراعي" : "Sponsor / Support")}</a>` : "";
    blocks.push(`<tr><td style="padding:0 22px 18px"><table role="presentation" width="100%" style="background:#f8f3e9;border:1px solid #e5dac6;border-radius:16px"><tr><td dir="${ar ? "rtl" : "ltr"}" style="padding:14px;text-align:${ar ? "right" : "left"}"><div style="font-size:10px;letter-spacing:1.2px;color:#9a772c;font-weight:900">${escapeHtml(sponsorName)}</div><div style="font-size:13px;line-height:1.55;color:#53655f;margin-top:5px">${escapeHtml(sponsorMessage)}</div>${link}</td></tr></table></td></tr>`);
  }
  if (!blocks.length) return "";
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;margin:14px auto 0">${blocks.join("")}</table>`;
}

function appendEnhancements(rendered: RenderedEmail, extraHtml: string, profile: ProfileRow, content: Map<string, ContentRow>, locale: Locale) {
  if (!extraHtml) return rendered;
  const textParts: string[] = [];
  if (profile.include_daily_hadith === 1 && content.get("hadith")) textParts.push(`${content.get("hadith")!.title_en}: ${content.get("hadith")!.body_en}${content.get("hadith")!.source_ref ? ` (${content.get("hadith")!.source_ref})` : ""}`);
  if (profile.include_daily_surah === 1 && content.get("surah")) textParts.push(`${content.get("surah")!.title_en}: ${content.get("surah")!.body_en}${content.get("surah")!.source_ref ? ` (${content.get("surah")!.source_ref})` : ""}`);
  if (profile.include_motivation === 1 && content.get("motivation")) textParts.push(`${content.get("motivation")!.title_en}: ${content.get("motivation")!.body_en}`);
  if (profile.include_sadaqah_jariyah === 1) textParts.push("🤲🌙 🤲🌙 Hassoun is a Sadaqah Jariyah for Abdul Jalil Hassoun and Salwa Hassoun. 🕌✨ 🕌✨");
  if (profile.include_sponsor === 1) textParts.push(profile.sponsor_message_en || "🤝🌙 🤝🌙 Support this Sadaqah Jariyah and help keep Hassoun available and growing. 🤲✨ 🤲✨");
  const html = rendered.html.includes("</body>") ? rendered.html.replace("</body>", `${extraHtml}</body>`) : `${rendered.html}${extraHtml}`;
  return { ...rendered, html, text: `${rendered.text}${textParts.length ? `\n\n${textParts.join("\n")}` : ""}` };
}

async function renderEmail(env: Env, row: OutboxRow) {
  const rawData = dataObject(row.template_data_json);
  const [profile, content] = await Promise.all([loadProfile(env, row), loadContent(env)]);
  const data = { ...rawData };
  let builtIn = row.kind === "prayer" ? prayerDashboardEmail(data, row.locale) : builtInSystemEmail(row.kind, data, row.locale);

  if (!["verification", "manage", "admin_password_reset", "prayer"].includes(row.kind) && row.template_key) {
    const template = await env.DB.prepare(`SELECT subject_en, subject_ar, html_en, html_ar, text_en, text_ar FROM email_templates WHERE template_key = ? AND enabled = 1 LIMIT 1`).bind(row.template_key).first<TemplateRow>();
    if (template) {
      const values = templateValues(builtIn, rawData);
      const subjectSource = row.locale === "ar" ? (template.subject_ar || template.subject_en) : template.subject_en;
      const htmlSource = row.locale === "ar" ? (template.html_ar || template.html_en) : template.html_en;
      const textSource = row.locale === "ar" ? (template.text_ar || template.text_en || builtIn.text) : (template.text_en || builtIn.text);
      builtIn = { subject: applyTemplate(subjectSource, values, false), html: applyTemplate(htmlSource, values, true), text: applyTemplate(textSource, values, false) };
    }
  }

  if (!profile || profile.enabled !== 1) return { ...builtIn, subject: decorateSubject(builtIn.subject) };
  const extra = enhancementHtml(profile, content, rawData, row.locale);
  const enhanced = appendEnhancements(builtIn, extra, profile, content, row.locale);
  return { ...enhanced, subject: decorateSubject(enhanced.subject) };
}

async function sendResend(env: Env, row: OutboxRow, email: RenderedEmail) {
  if (!env.RESEND_API_KEY || !env.EMAIL_FROM) throw new Error("Email provider is not configured");
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json", ...(row.idempotency_key ? { "Idempotency-Key": row.idempotency_key.slice(0, 256) } : {}) },
    body: JSON.stringify({ from: env.EMAIL_FROM.includes("<") ? env.EMAIL_FROM.replace(/^[^<]+</, "Hassoun <") : `Hassoun <${env.EMAIL_FROM}>`, to: [row.recipient_email], subject: email.subject, html: email.html, text: email.text, ...(env.EMAIL_REPLY_TO ? { reply_to: env.EMAIL_REPLY_TO } : {}) })
  });
  const payload = await response.json().catch(() => ({})) as { id?: string; message?: string; error?: { message?: string } };
  if (!response.ok || !payload.id) throw new Error(payload.error?.message || payload.message || `Email provider failed: ${response.status}`);
  return payload.id;
}

async function claimOutbox(env: Env, id: number) {
  const result = await env.DB.prepare(`UPDATE email_outbox SET status = 'sending', attempts = attempts + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'pending'`).bind(id).run();
  return (result.meta.changes ?? 0) === 1;
}
async function markSent(env: Env, row: OutboxRow, providerMessageId: string, subject: string) {
  await env.DB.batch([
    env.DB.prepare(`UPDATE email_outbox SET status = 'sent', sent_at = CURRENT_TIMESTAMP, last_error = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).bind(row.id),
    ...(row.delivery_id ? [env.DB.prepare(`UPDATE email_deliveries SET status = 'sent', provider_message_id = ?, sent_at = CURRENT_TIMESTAMP, subject_snapshot = ? WHERE id = ?`).bind(providerMessageId, subject, row.delivery_id)] : [])
  ]);
}
async function markFailure(env: Env, row: OutboxRow, error: unknown) {
  const message = String(error instanceof Error ? error.message : error).slice(0, 1000); const finalFailure = row.attempts + 1 >= 4;
  const statements: D1PreparedStatement[] = [env.DB.prepare(finalFailure ? `UPDATE email_outbox SET status = 'failed', last_error = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?` : `UPDATE email_outbox SET status = 'pending', last_error = ?, scheduled_at = datetime('now', '+5 minutes'), updated_at = CURRENT_TIMESTAMP WHERE id = ?`).bind(message, row.id)];
  if (finalFailure && row.delivery_id) statements.push(env.DB.prepare(`UPDATE email_deliveries SET status = 'failed', error_message = ? WHERE id = ?`).bind(message, row.delivery_id));
  await env.DB.batch(statements);
}

export async function processEmailOutbox(env: Env) {
  if (!configured(env)) return { configured: false, processed: 0, sent: 0 };
  const { results } = await env.DB.prepare(`SELECT id, delivery_id, subscriber_id, recipient_email, locale, kind, template_key, template_data_json, idempotency_key, attempts FROM email_outbox WHERE status = 'pending' AND scheduled_at <= CURRENT_TIMESTAMP AND attempts < 4 ORDER BY id LIMIT 25`).all<OutboxRow>();
  let sent = 0;
  for (const row of results) {
    if (!(await claimOutbox(env, row.id))) continue;
    try { const email = await renderEmail(env, row); const providerMessageId = await sendResend(env, row, email); await markSent(env, row, providerMessageId, email.subject); sent += 1; }
    catch (error) { await markFailure(env, row, error); console.error("Email delivery failed", { outboxId: row.id, error }); }
  }
  return { configured: true, processed: results.length, sent };
}
