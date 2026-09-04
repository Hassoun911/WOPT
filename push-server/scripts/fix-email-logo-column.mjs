import { readFileSync, writeFileSync } from 'node:fs';

for (const file of ['src/adminEmail.ts','src/emailDelivery.ts','migrations/0008_email_template_profiles.sql']) {
  const url = new URL(`../${file}`, import.meta.url);
  const before = readFileSync(url, 'utf8');
  let after = before.replaceAll('sponsor_logo_data', 'sponsor_logo_base64');

  if (file === 'src/emailDelivery.ts') {
    // Use the Announcement profile as the shared sponsor identity/details while each
    // email profile keeps its own include_sponsor on/off switch.
    const oldLoadProfile = `async function loadProfile(env: Env, row: OutboxRow) {
  return env.DB.prepare(
    \`SELECT template_key, enabled, include_islamic_occasion, include_daily_hadith,
            include_daily_surah, include_occasion_countdown, include_motivation,
            include_sadaqah_jariyah, include_sponsor, sponsor_name, sponsor_url,
            sponsor_message_en, sponsor_message_ar, sponsor_logo_base64, sponsor_logo_mime
     FROM email_template_profiles WHERE template_key = ? LIMIT 1\`
  ).bind(profileKey(row)).first<ProfileRow>();
}`;

    const newLoadProfile = `async function loadProfile(env: Env, row: OutboxRow) {
  const profile = await env.DB.prepare(
    \`SELECT template_key, enabled, include_islamic_occasion, include_daily_hadith,
            include_daily_surah, include_occasion_countdown, include_motivation,
            include_sadaqah_jariyah, include_sponsor, sponsor_name, sponsor_url,
            sponsor_message_en, sponsor_message_ar, sponsor_logo_base64, sponsor_logo_mime
     FROM email_template_profiles WHERE template_key = ? LIMIT 1\`
  ).bind(profileKey(row)).first<ProfileRow>();
  if (!profile) return null;

  const globalSponsor = await env.DB.prepare(
    \`SELECT sponsor_name, sponsor_url, sponsor_message_en, sponsor_message_ar,
            sponsor_logo_base64, sponsor_logo_mime
     FROM email_template_profiles WHERE template_key = 'announcement' LIMIT 1\`
  ).first<Pick<ProfileRow, 'sponsor_name' | 'sponsor_url' | 'sponsor_message_en' | 'sponsor_message_ar' | 'sponsor_logo_base64' | 'sponsor_logo_mime'>>();

  if (!globalSponsor) return profile;
  return {
    ...profile,
    sponsor_name: globalSponsor.sponsor_name ?? profile.sponsor_name,
    sponsor_url: globalSponsor.sponsor_url ?? profile.sponsor_url,
    sponsor_message_en: globalSponsor.sponsor_message_en ?? profile.sponsor_message_en,
    sponsor_message_ar: globalSponsor.sponsor_message_ar ?? profile.sponsor_message_ar,
    sponsor_logo_base64: globalSponsor.sponsor_logo_base64 ?? profile.sponsor_logo_base64,
    sponsor_logo_mime: globalSponsor.sponsor_logo_mime ?? profile.sponsor_logo_mime,
  };
}`;

    if (after.includes(oldLoadProfile)) after = after.replace(oldLoadProfile, newLoadProfile);
    else if (!after.includes("template_key = 'announcement' LIMIT 1")) {
      throw new Error('Unable to patch global sponsor inheritance in emailDelivery.ts');
    }

    // Render every Hassoun email as one complete English section followed by one
    // complete Arabic section. This applies to the main body, prayer content,
    // Islamic occasions, hadith, Qur'an, motivation, Sadaqah Jariyah, sponsor,
    // Qur'an School, manage/unsubscribe links, verification and password reset.
    const oldRenderEmail = `async function renderEmail(env: Env, row: OutboxRow) {
  const initialData = dataObject(row.template_data_json);
  const rawData = await ensureManageUrl(env, row, initialData);
  const [profile, content] = await Promise.all([loadProfile(env, row), loadContent(env)]);
  const data = { ...rawData };
  if (row.kind === "prayer" && profile) data.upcomingEvent = null;
  let builtIn = row.kind === "prayer" ? prayerDashboardEmail(data, row.locale) : builtInSystemEmail(row.kind, data, row.locale);

  if (!["verification", "manage", "admin_password_reset", "prayer"].includes(row.kind) && row.template_key) {
    const template = await env.DB.prepare(\`SELECT subject_en, subject_ar, html_en, html_ar, text_en, text_ar FROM email_templates WHERE template_key = ? AND enabled = 1 LIMIT 1\`).bind(row.template_key).first<TemplateRow>();
    if (template) {
      const values = templateValues(builtIn, rawData);
      const subjectSource = row.locale === "ar" ? (template.subject_ar || template.subject_en) : template.subject_en;
      const htmlSource = row.locale === "ar" ? (template.html_ar || template.html_en) : template.html_en;
      const textSource = row.locale === "ar" ? (template.text_ar || template.text_en || builtIn.text) : (template.text_en || builtIn.text);
      builtIn = { subject: applyTemplate(subjectSource, values, false), html: applyTemplate(htmlSource, values, true), text: applyTemplate(textSource, values, false) };
    }
  }

  const activeProfile = profile && profile.enabled === 1 ? profile : null;
  const extra = activeProfile ? enhancementHtml(activeProfile, content, rawData, row.locale) : "";
  return appendEnhancements(builtIn, extra, activeProfile, content, row.locale, rawData);
}`;

    const newRenderEmail = `function bodyHtml(html: string) {
  const match = /<body[^>]*>([\\s\\S]*?)<\\/body>/i.exec(html);
  return match ? match[1] : html;
}

async function renderLocalizedEmail(env: Env, row: OutboxRow, locale: Locale, rawData: Record<string, unknown>, profile: ProfileRow | null, content: Map<string, ContentRow>) {
  const data = { ...rawData };
  if (row.kind === "prayer" && profile) data.upcomingEvent = null;
  let builtIn = row.kind === "prayer" ? prayerDashboardEmail(data, locale) : builtInSystemEmail(row.kind, data, locale);

  if (!["verification", "manage", "admin_password_reset", "prayer"].includes(row.kind) && row.template_key) {
    const template = await env.DB.prepare(\`SELECT subject_en, subject_ar, html_en, html_ar, text_en, text_ar FROM email_templates WHERE template_key = ? AND enabled = 1 LIMIT 1\`).bind(row.template_key).first<TemplateRow>();
    if (template) {
      const values = templateValues(builtIn, rawData);
      const subjectSource = locale === "ar" ? (template.subject_ar || template.subject_en) : template.subject_en;
      const htmlSource = locale === "ar" ? (template.html_ar || template.html_en) : template.html_en;
      const textSource = locale === "ar" ? (template.text_ar || template.text_en || builtIn.text) : (template.text_en || builtIn.text);
      builtIn = { subject: applyTemplate(subjectSource, values, false), html: applyTemplate(htmlSource, values, true), text: applyTemplate(textSource, values, false) };
    }
  }

  const activeProfile = profile && profile.enabled === 1 ? profile : null;
  const extra = activeProfile ? enhancementHtml(activeProfile, content, rawData, locale) : "";
  return appendEnhancements(builtIn, extra, activeProfile, content, locale, rawData);
}

async function renderEmail(env: Env, row: OutboxRow) {
  const initialData = dataObject(row.template_data_json);
  const rawData = await ensureManageUrl(env, row, initialData);
  const [profile, content] = await Promise.all([loadProfile(env, row), loadContent(env)]);

  const english = await renderLocalizedEmail(env, row, "en", rawData, profile, content);
  const arabic = await renderLocalizedEmail(env, row, "ar", rawData, profile, content);
  const divider = \`<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;margin:22px auto"><tr><td style="border-top:2px solid #d9d1c4;text-align:center;padding-top:12px;color:#8c7a5a;font-size:11px;font-weight:900;letter-spacing:1px">العربية • ARABIC</td></tr></table>\`;
  const html = \`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#f6f0e5;font-family:Arial,Helvetica,sans-serif;color:#173f35">\${bodyHtml(english.html)}\${divider}\${bodyHtml(arabic.html)}</body></html>\`;
  const subject = arabic.subject && arabic.subject !== english.subject ? \`\${english.subject} | \${arabic.subject}\` : english.subject;
  const attachments = english.attachments?.length ? english.attachments : arabic.attachments;
  return { subject, html, text: \`ENGLISH\\n\${english.text}\\n\\nالعربية\\n\${arabic.text}\`, attachments };
}`;

    if (after.includes(oldRenderEmail)) after = after.replace(oldRenderEmail, newRenderEmail);
    else if (!after.includes('renderLocalizedEmail') || !after.includes('العربية • ARABIC')) {
      throw new Error('Unable to patch full bilingual email rendering in emailDelivery.ts');
    }
  }

  if (before !== after) writeFileSync(url, after);
}

// Add an owner/admin-only one-click test action for every Email Center template card.
// Every test always goes to the dedicated Hassoun admin mailbox.
{
  const url = new URL('../src/adminEmail.ts', import.meta.url);
  let source = readFileSync(url, 'utf8');
  if (!source.includes('processEmailOutbox')) {
    source = source.replace('import { subscriberManageUrl } from "./subscribers";', 'import { subscriberManageUrl } from "./subscribers";\nimport { processEmailOutbox } from "./emailDelivery";');
  }
  if (!source.includes('async function sendTemplateTest(')) {
    const marker = 'export async function createAdminEmailCampaign(request: Request, env: Env) {';
    const helper = `const ADMIN_TEST_EMAIL = "windsor.hassoun@gmail.com";\n\nasync function sendTemplateTest(env: Env, adminId: number, body: Record<string, unknown>) {\n  const templateKey = clean(body.templateKey, 120);\n  if (!templateKey) return json({ error: "Template key is required" }, 400);\n  const profile = await env.DB.prepare("SELECT template_key, name FROM email_template_profiles WHERE template_key = ? LIMIT 1").bind(templateKey).first<{ template_key: string; name: string }>();\n  if (!profile) return json({ error: "Template profile not found" }, 404);\n  const kind = templateKey === "prayer_alert" ? "prayer" : templateKey;\n  const now = new Date().toISOString();\n  const testData = {\n    message: \`This is a Hassoun test email for \${profile.name}.\`,\n    verificationUrl: "https://hassoun.app/",\n    manageUrl: "https://hassoun.app/",\n    resetUrl: "https://hassoun.app/admin/",\n    prayer: "fajr", prayerTime: "5:30 AM", locationLabel: "Windsor, Ontario", timezone: "America/Toronto",\n    prayerTimes: { fajr: "5:30 AM", dhuhr: "1:30 PM", asr: "5:00 PM", maghrib: "7:45 PM", isha: "9:00 PM" },\n    upcomingEvent: { emoji: "🌙", nameEn: "Test Islamic Occasion", nameAr: "مناسبة إسلامية تجريبية", descriptionEn: "Test preview of the Islamic occasion section.", descriptionAr: "معاينة تجريبية لقسم المناسبة الإسلامية.", daysLeft: 7 }\n  };\n  await env.DB.prepare(\`INSERT INTO email_outbox (recipient_email, locale, kind, template_key, template_data_json, idempotency_key, scheduled_at) VALUES (?, 'en', ?, ?, ?, ?, CURRENT_TIMESTAMP)\`).bind(ADMIN_TEST_EMAIL, kind, templateKey, JSON.stringify(testData), \`admin-template-test:\${templateKey}:\${crypto.randomUUID()}\`).run();\n  const delivery = await processEmailOutbox(env);\n  await logAdmin(env, adminId, "email_template_test_sent", templateKey, { recipient: ADMIN_TEST_EMAIL, delivery });\n  return json({ ok: true, recipient: ADMIN_TEST_EMAIL, templateKey, delivery });\n}\n\n`;
    if (!source.includes(marker)) throw new Error('Unable to find admin Email Center action marker');
    source = source.replace(marker, helper + marker);
  }
  const actionMarker = '  if (body.action === "update_template_profile") return updateTemplateProfile(env, auth.admin.id, body);';
  const testAction = '  if (body.action === "send_template_test") return sendTemplateTest(env, auth.admin.id, body);\n';
  if (!source.includes('body.action === "send_template_test"')) {
    if (!source.includes(actionMarker)) throw new Error('Unable to find admin email action switch');
    source = source.replace(actionMarker, testAction + actionMarker);
  }
  writeFileSync(url, source);
}

console.log('Email schema aligned, bilingual rendering enabled, and admin template test emails wired to windsor.hassoun@gmail.com.');
