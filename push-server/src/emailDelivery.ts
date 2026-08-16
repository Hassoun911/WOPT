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

function builtInPrayerEmail(data: Record<string, unknown>, locale: Locale): RenderedEmail {
  const prayer = prayerName(data.prayer, locale);
  const kind = data.kind;
  const prayerTime = String(data.prayerTime ?? "");
  const location = String(data.locationLabel ?? (locale === "ar" ? "موقعك" : "your location"));
  const timezone = String(data.timezone ?? "");
  const manageUrl = String(data.manageUrl ?? "");

  if (locale === "ar") {
    const subject = kind === "twenty"
      ? `بقي ٢٠ دقيقة على صلاة ${prayer}`
      : kind === "ten"
        ? `بقي ١٠ دقائق على صلاة ${prayer}`
        : `حان وقت صلاة ${prayer}`;
    const text = `${subject}\n${prayerTime} • ${location}\n${timezone}${manageUrl ? `\nإدارة التنبيهات: ${manageUrl}` : ""}`;
    const html = `<div dir="rtl" style="font-family:Arial,sans-serif;line-height:1.7;color:#173f35"><h2>${escapeHtml(subject)}</h2><p><strong>${escapeHtml(prayerTime)}</strong> • ${escapeHtml(location)}</p><p style="color:#617871">${escapeHtml(timezone)}</p>${manageUrl ? `<p><a href="${escapeHtml(manageUrl)}">إدارة تنبيهات البريد</a></p>` : ""}</div>`;
    return { subject, text, html };
  }

  const subject = kind === "twenty"
    ? `${prayer} in 20 minutes`
    : kind === "ten"
      ? `${prayer} in 10 minutes`
      : `It is time for ${prayer}`;
  const text = `${subject}\n${prayerTime} • ${location}\n${timezone}${manageUrl ? `\nManage alerts: ${manageUrl}` : ""}`;
  const html = `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#173f35"><h2>${escapeHtml(subject)}</h2><p><strong>${escapeHtml(prayerTime)}</strong> • ${escapeHtml(location)}</p><p style="color:#617871">${escapeHtml(timezone)}</p>${manageUrl ? `<p><a href="${escapeHtml(manageUrl)}">Manage email alerts</a></p>` : ""}</div>`;
  return { subject, text, html };
}

function builtInSystemEmail(kind: string, data: Record<string, unknown>, locale: Locale): RenderedEmail {
  if (kind === "verification") {
    const verificationUrl = String(data.verificationUrl ?? "");
    if (locale === "ar") {
      return {
        subject: "تأكيد تنبيهات مواقيت الصلاة عبر البريد",
        text: `أكد تنبيهات WOPT عبر البريد: ${verificationUrl}`,
        html: `<div dir="rtl" style="font-family:Arial,sans-serif;line-height:1.7;color:#173f35"><h2>تأكيد تنبيهات الصلاة</h2><p>اضغط الزر لتأكيد بريدك وتفعيل التنبيهات حسب موقعك.</p><p><a href="${escapeHtml(verificationUrl)}" style="display:inline-block;padding:12px 18px;background:#0b5b47;color:#fff;text-decoration:none;border-radius:10px">تأكيد البريد</a></p></div>`
      };
    }
    return {
      subject: "Confirm your WOPT prayer email alerts",
      text: `Confirm your WOPT prayer email alerts: ${verificationUrl}`,
      html: `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#173f35"><h2>Confirm prayer email alerts</h2><p>Confirm your email to activate prayer alerts for your detected location.</p><p><a href="${escapeHtml(verificationUrl)}" style="display:inline-block;padding:12px 18px;background:#0b5b47;color:#fff;text-decoration:none;border-radius:10px">Confirm email</a></p></div>`
    };
  }

  if (kind === "manage") {
    const manageUrl = String(data.manageUrl ?? "");
    if (locale === "ar") {
      return {
        subject: "إدارة تنبيهات WOPT عبر البريد",
        text: `إدارة التنبيهات: ${manageUrl}`,
        html: `<div dir="rtl" style="font-family:Arial,sans-serif;line-height:1.7;color:#173f35"><h2>إدارة تنبيهات البريد</h2><p><a href="${escapeHtml(manageUrl)}">فتح إعدادات التنبيهات</a></p></div>`
      };
    }
    return {
      subject: "Manage your WOPT email alerts",
      text: `Manage your WOPT email alerts: ${manageUrl}`,
      html: `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#173f35"><h2>Manage email alerts</h2><p><a href="${escapeHtml(manageUrl)}">Open your alert settings</a></p></div>`
    };
  }

  return {
    subject: locale === "ar" ? "تنبيه من WOPT" : "WOPT notification",
    text: String(data.message ?? "WOPT notification"),
    html: `<p>${escapeHtml(data.message ?? "WOPT notification")}</p>`
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
