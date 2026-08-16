import type { Env, Locale, PrayerKey } from "./types";

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

type TemplateRow = {
  subject_en: string;
  subject_ar: string | null;
  html_en: string;
  html_ar: string | null;
  text_en: string | null;
  text_ar: string | null;
};

type RenderedEmail = {
  subject: string;
  html: string;
  text: string;
};

function configured(env: Env) {
  return Boolean(env.RESEND_API_KEY && env.EMAIL_FROM);
}

export function emailDeliveryConfigured(env: Env) {
  return configured(env);
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function dataObject(value: string | null) {
  if (!value) return {} as Record<string, unknown>;
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" ? parsed as Record<string, unknown> : {};
  } catch {
    return {} as Record<string, unknown>;
  }
}

function prayerName(prayer: unknown, locale: Locale) {
  const names: Record<PrayerKey, { en: string; ar: string }> = {
    fajr: { en: "Fajr", ar: "الفجر" },
    dhuhr: { en: "Dhuhr", ar: "الظهر" },
    asr: { en: "Asr", ar: "العصر" },
    maghrib: { en: "Maghrib", ar: "المغرب" },
    isha: { en: "Isha", ar: "العشاء" }
  };
  if (typeof prayer !== "string" || !(prayer in names)) return locale === "ar" ? "الصلاة" : "Prayer";
  return names[prayer as PrayerKey][locale];
}

function brandedEmail(options: {
  locale: Locale;
  eyebrow: string;
  title: string;
  intro: string;
  details?: Array<{ label: string; value: string }>;
  buttonLabel?: string;
  buttonUrl?: string;
  note?: string;
}) {
  const direction = options.locale === "ar" ? "rtl" : "ltr";
  const textAlign = options.locale === "ar" ? "right" : "left";
  const details = (options.details ?? []).filter((item) => item.value).map((item) => `
    <tr>
      <td style="padding:8px 0;color:#8a806f;font-size:12px;font-weight:700;vertical-align:top;width:120px">${escapeHtml(item.label)}</td>
      <td style="padding:8px 0;color:#214d42;font-size:13px;font-weight:700;vertical-align:top">${escapeHtml(item.value)}</td>
    </tr>`).join("");
  const action = options.buttonUrl && options.buttonLabel
    ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:22px"><tr><td align="center"><a href="${escapeHtml(options.buttonUrl)}" style="display:block;background:#0b5b47;color:#ffffff;text-decoration:none;font-size:15px;font-weight:800;text-align:center;padding:15px 20px;border-radius:14px">${escapeHtml(options.buttonLabel)}</a></td></tr></table>`
    : "";

  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
  <body style="margin:0;padding:0;background:#f6f0e5;font-family:Arial,Helvetica,sans-serif;color:#173f35">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f6f0e5;padding:24px 12px">
      <tr><td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#fffdf8;border:1px solid #e3dac9;border-radius:24px;overflow:hidden">
          <tr><td style="padding:24px 24px 18px;text-align:${textAlign}" dir="${direction}">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr>
              <td style="vertical-align:middle"><div style="width:44px;height:44px;line-height:44px;text-align:center;border-radius:14px;background:#0b5b47;color:#fff;font-size:24px;font-weight:900">و</div></td>
              <td style="vertical-align:middle;padding-${options.locale === "ar" ? "right" : "left"}:12px;width:100%"><div style="font-size:10px;letter-spacing:2px;color:#9a8a70;font-weight:800">WOPT</div><div style="font-size:14px;color:#355c52;font-weight:800">Prayer Times</div></td>
            </tr></table>
          </td></tr>
          <tr><td style="padding:0 24px 26px;text-align:${textAlign}" dir="${direction}">
            <div style="font-size:11px;letter-spacing:1.6px;color:#9a8a70;font-weight:800;text-transform:uppercase">${escapeHtml(options.eyebrow)}</div>
            <h1 style="margin:9px 0 10px;font-size:28px;line-height:1.18;color:#153f35">${escapeHtml(options.title)}</h1>
            <p style="margin:0;color:#6f746c;font-size:15px;line-height:1.65">${escapeHtml(options.intro)}</p>
            ${details ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:20px;background:#f8f3e9;border:1px solid #e6dccb;border-radius:16px;padding:10px 14px">${details}</table>` : ""}
            ${action}
            ${options.note ? `<p style="margin:18px 0 0;color:#8a8377;font-size:12px;line-height:1.6">${escapeHtml(options.note)}</p>` : ""}
          </td></tr>
        </table>
        <div style="max-width:520px;margin:14px auto 0;color:#9a9488;font-size:11px;line-height:1.5;text-align:center">WOPT • Prayer alerts based on your local time zone</div>
      </td></tr>
    </table>
  </body></html>`;
}

function builtInPrayerEmail(data: Record<string, unknown>, locale: Locale): RenderedEmail {
  const prayer = prayerName(data.prayer, locale);
  const kind = data.kind;
  const prayerTime = String(data.prayerTime ?? "");
  const location = String(data.locationLabel ?? (locale === "ar" ? "موقعك" : "your location"));
  const timezone = String(data.timezone ?? "");
  const manageUrl = String(data.manageUrl ?? "");

  const subject = locale === "ar"
    ? kind === "twenty" ? `بقي ٢٠ دقيقة على صلاة ${prayer}` : kind === "ten" ? `بقي ١٠ دقائق على صلاة ${prayer}` : `حان وقت صلاة ${prayer}`
    : kind === "twenty" ? `${prayer} in 20 minutes` : kind === "ten" ? `${prayer} in 10 minutes` : `It is time for ${prayer}`;

  const html = brandedEmail({
    locale,
    eyebrow: locale === "ar" ? "تنبيه الصلاة" : "PRAYER ALERT",
    title: subject,
    intro: locale === "ar" ? "هذا التنبيه مبني على مواقيت الصلاة المحلية لموقعك." : "This alert is based on the local prayer schedule for your location.",
    details: [
      { label: locale === "ar" ? "الوقت" : "Prayer time", value: prayerTime },
      { label: locale === "ar" ? "الموقع" : "Location", value: location },
      { label: locale === "ar" ? "المنطقة الزمنية" : "Time zone", value: timezone }
    ],
    buttonLabel: manageUrl ? (locale === "ar" ? "إدارة التنبيهات" : "Manage email alerts") : undefined,
    buttonUrl: manageUrl || undefined
  });
  const text = `${subject}\n${prayerTime} • ${location}\n${timezone}${manageUrl ? `\n${locale === "ar" ? "إدارة التنبيهات" : "Manage alerts"}: ${manageUrl}` : ""}`;
  return { subject, html, text };
}

function builtInSystemEmail(kind: string, data: Record<string, unknown>, locale: Locale): RenderedEmail {
  if (kind === "verification") {
    const verificationUrl = String(data.verificationUrl ?? "");
    const location = String(data.locationLabel ?? "");
    const timezone = String(data.timezone ?? "");
    const subject = locale === "ar" ? "تأكيد تنبيهات الصلاة عبر البريد" : "Confirm your WOPT prayer email alerts";
    return {
      subject,
      text: locale === "ar"
        ? `أكد تنبيهات الصلاة عبر البريد. الموقع: ${location}. المنطقة الزمنية: ${timezone}. ${verificationUrl}`
        : `Confirm your prayer email alerts. Location: ${location}. Time zone: ${timezone}. ${verificationUrl}`,
      html: brandedEmail({
        locale,
        eyebrow: locale === "ar" ? "خطوة أخيرة" : "ONE LAST STEP",
        title: locale === "ar" ? "أكد تنبيهات الصلاة" : "Confirm your prayer email alerts",
        intro: locale === "ar"
          ? "أكد بريدك لتفعيل التنبيهات حسب موقعك ومواقيت الصلاة المحلية."
          : "Confirm your email to activate alerts based on your detected location and local prayer times.",
        details: [
          { label: locale === "ar" ? "موقع الصلاة" : "Prayer location", value: location },
          { label: locale === "ar" ? "المنطقة الزمنية" : "Time zone", value: timezone }
        ],
        buttonLabel: locale === "ar" ? "تأكيد تنبيهات البريد" : "Confirm email alerts",
        buttonUrl: verificationUrl,
        note: locale === "ar" ? "تنتهي صلاحية رابط التأكيد خلال 24 ساعة." : "This confirmation link expires in 24 hours."
      })
    };
  }

  if (kind === "manage") {
    const manageUrl = String(data.manageUrl ?? "");
    const subject = locale === "ar" ? "إدارة تنبيهات WOPT عبر البريد" : "Manage your WOPT email alerts";
    return {
      subject,
      text: `${subject}: ${manageUrl}`,
      html: brandedEmail({
        locale,
        eyebrow: locale === "ar" ? "إعدادات التنبيهات" : "ALERT SETTINGS",
        title: locale === "ar" ? "إدارة تنبيهات الصلاة" : "Manage your prayer alerts",
        intro: locale === "ar" ? "استخدم الرابط الآمن لتعديل تنبيهاتك أو موقع الصلاة أو إلغاء الاشتراك." : "Use your secure link to change reminder timing, prayer location, or unsubscribe.",
        buttonLabel: locale === "ar" ? "فتح إعدادات التنبيهات" : "Open alert settings",
        buttonUrl: manageUrl
      })
    };
  }

  if (kind === "admin_password_reset") {
    const resetUrl = String(data.resetUrl ?? "");
    const subject = locale === "ar" ? "إعادة تعيين كلمة مرور إدارة WOPT" : "Reset your WOPT admin password";
    return {
      subject,
      text: `${subject}: ${resetUrl}`,
      html: brandedEmail({
        locale,
        eyebrow: "WOPT ADMIN",
        title: locale === "ar" ? "إعادة تعيين كلمة المرور" : "Reset your admin password",
        intro: locale === "ar" ? "استخدم هذا الرابط الآمن لإنشاء كلمة مرور جديدة." : "Use this secure link to create a new admin password.",
        buttonLabel: locale === "ar" ? "إعادة تعيين كلمة المرور" : "Reset password",
        buttonUrl: resetUrl,
        note: locale === "ar" ? "تنتهي صلاحية الرابط خلال ساعة واحدة." : "This link expires in one hour."
      })
    };
  }

  return {
    subject: locale === "ar" ? "تنبيه من WOPT" : "WOPT notification",
    text: String(data.message ?? "WOPT notification"),
    html: brandedEmail({
      locale,
      eyebrow: "WOPT",
      title: locale === "ar" ? "تنبيه جديد" : "New notification",
      intro: String(data.message ?? "WOPT notification")
    })
  };
}

function templateValues(rendered: RenderedEmail, data: Record<string, unknown>) {
  return {
    ...data,
    emailSubject: rendered.subject,
    emailHtml: rendered.html,
    emailText: rendered.text
  } as Record<string, unknown>;
}

function applyTemplate(template: string, values: Record<string, unknown>, html: boolean) {
  return template.replace(/\{\{([A-Za-z0-9_]+)\}\}/g, (_match, key: string) => {
    const value = values[key] ?? "";
    return html && key !== "emailHtml" ? escapeHtml(value) : String(value);
  });
}

async function renderEmail(env: Env, row: OutboxRow) {
  const data = dataObject(row.template_data_json);
  const builtIn = row.kind === "prayer"
    ? builtInPrayerEmail(data, row.locale)
    : builtInSystemEmail(row.kind, data, row.locale);

  // Core WOPT system emails are rendered in code so their responsive design
  // cannot be replaced by an older plain-text database template.
  if (["verification", "manage", "admin_password_reset", "prayer"].includes(row.kind)) return builtIn;

  if (!row.template_key) return builtIn;
  const template = await env.DB.prepare(
    `SELECT subject_en, subject_ar, html_en, html_ar, text_en, text_ar
     FROM email_templates WHERE template_key = ? AND enabled = 1 LIMIT 1`
  ).bind(row.template_key).first<TemplateRow>();
  if (!template) return builtIn;

  const values = templateValues(builtIn, data);
  const subjectSource = row.locale === "ar" ? (template.subject_ar || template.subject_en) : template.subject_en;
  const htmlSource = row.locale === "ar" ? (template.html_ar || template.html_en) : template.html_en;
  const textSource = row.locale === "ar"
    ? (template.text_ar || template.text_en || builtIn.text)
    : (template.text_en || builtIn.text);
  return {
    subject: applyTemplate(subjectSource, values, false),
    html: applyTemplate(htmlSource, values, true),
    text: applyTemplate(textSource, values, false)
  };
}

async function sendResend(env: Env, row: OutboxRow, email: RenderedEmail) {
  if (!env.RESEND_API_KEY || !env.EMAIL_FROM) throw new Error("Email provider is not configured");
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
      ...(row.idempotency_key ? { "Idempotency-Key": row.idempotency_key.slice(0, 256) } : {})
    },
    body: JSON.stringify({
      from: env.EMAIL_FROM,
      to: [row.recipient_email],
      subject: email.subject,
      html: email.html,
      text: email.text,
      ...(env.EMAIL_REPLY_TO ? { reply_to: env.EMAIL_REPLY_TO } : {})
    })
  });
  const payload = await response.json().catch(() => ({})) as { id?: string; message?: string; error?: { message?: string } };
  if (!response.ok || !payload.id) {
    throw new Error(payload.error?.message || payload.message || `Email provider failed: ${response.status}`);
  }
  return payload.id;
}

async function claimOutbox(env: Env, id: number) {
  const result = await env.DB.prepare(
    `UPDATE email_outbox SET status = 'sending', attempts = attempts + 1, updated_at = CURRENT_TIMESTAMP
     WHERE id = ? AND status = 'pending'`
  ).bind(id).run();
  return (result.meta.changes ?? 0) === 1;
}

async function markSent(env: Env, row: OutboxRow, providerMessageId: string, subject: string) {
  await env.DB.batch([
    env.DB.prepare(
      `UPDATE email_outbox SET status = 'sent', sent_at = CURRENT_TIMESTAMP,
       last_error = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
    ).bind(row.id),
    ...(row.delivery_id ? [env.DB.prepare(
      `UPDATE email_deliveries SET status = 'sent', provider_message_id = ?, sent_at = CURRENT_TIMESTAMP,
       subject_snapshot = ? WHERE id = ?`
    ).bind(providerMessageId, subject, row.delivery_id)] : [])
  ]);
}

async function markFailure(env: Env, row: OutboxRow, error: unknown) {
  const message = String(error instanceof Error ? error.message : error).slice(0, 1000);
  const finalFailure = row.attempts + 1 >= 4;
  const statements: D1PreparedStatement[] = [env.DB.prepare(
    finalFailure
      ? `UPDATE email_outbox SET status = 'failed', last_error = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
      : `UPDATE email_outbox SET status = 'pending', last_error = ?, scheduled_at = datetime('now', '+5 minutes'), updated_at = CURRENT_TIMESTAMP WHERE id = ?`
  ).bind(message, row.id)];
  if (finalFailure && row.delivery_id) {
    statements.push(env.DB.prepare(
      `UPDATE email_deliveries SET status = 'failed', error_message = ? WHERE id = ?`
    ).bind(message, row.delivery_id));
  }
  await env.DB.batch(statements);
}

export async function processEmailOutbox(env: Env) {
  if (!configured(env)) return { configured: false, processed: 0, sent: 0 };

  const { results } = await env.DB.prepare(
    `SELECT id, delivery_id, subscriber_id, recipient_email, locale, kind, template_key,
            template_data_json, idempotency_key, attempts
     FROM email_outbox
     WHERE status = 'pending' AND scheduled_at <= CURRENT_TIMESTAMP AND attempts < 4
     ORDER BY id
     LIMIT 25`
  ).all<OutboxRow>();

  let sent = 0;
  for (const row of results) {
    if (!(await claimOutbox(env, row.id))) continue;
    try {
      const email = await renderEmail(env, row);
      const providerMessageId = await sendResend(env, row, email);
      await markSent(env, row, providerMessageId, email.subject);
      sent += 1;
    } catch (error) {
      await markFailure(env, row, error);
      console.error("Email delivery failed", { outboxId: row.id, error });
    }
  }
  return { configured: true, processed: results.length, sent };
}
