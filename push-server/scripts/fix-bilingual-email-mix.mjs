import { readFileSync, writeFileSync } from 'node:fs';

const url = new URL('../src/emailDelivery.ts', import.meta.url);
let source = readFileSync(url, 'utf8');

const replacement = `function bodyHtml(html: string) {
  const match = /<body[^>]*>([\\s\\S]*?)<\\/body>/i.exec(html);
  return match ? match[1] : html;
}

async function renderLocalizedCore(env: Env, row: OutboxRow, locale: Locale, rawData: Record<string, unknown>, profile: ProfileRow | null) {
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
      builtIn = {
        subject: applyTemplate(subjectSource, values, false),
        html: applyTemplate(htmlSource, values, true),
        text: applyTemplate(textSource, values, false)
      };
    }
  }
  return builtIn;
}

function mixedTemplateShell(englishHtml: string, arabicHtml: string) {
  return \`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#f6f0e5;font-family:Arial,Helvetica,sans-serif;color:#173f35"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f6f0e5;padding:24px 12px"><tr><td align="center"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#fffdf8;border:1px solid #e3dac9;border-radius:24px;overflow:hidden"><tr><td style="padding:24px 24px 18px"><table role="presentation" width="100%"><tr><td width="58"><img src="https://raw.githubusercontent.com/Hassoun911/WOPT/main/pwa/public/assets/hassoun-logo.png" width="54" height="54" alt="Hassoun" style="display:block;border:0;border-radius:15px;background:#003d33"></td><td style="vertical-align:middle;padding-left:12px"><div style="font-size:11px;letter-spacing:2px;color:#a17825;font-weight:900">HASSOUN</div><div style="font-size:14px;color:#355c52;font-weight:800">Prayer • Qur’an • Knowledge</div></td></tr></table></td></tr><tr><td style="padding:0 24px 26px"><div dir="ltr" style="text-align:left">\${englishHtml}</div><div style="height:1px;background:#ddd4c6;margin:18px 0"></div><div dir="rtl" style="text-align:right">\${arabicHtml}</div></td></tr></table><div style="max-width:520px;margin:14px auto 0;color:#9a9488;font-size:11px;text-align:center">Hassoun</div></td></tr></table></body></html>\`;
}

async function renderEmail(env: Env, row: OutboxRow) {
  const initialData = dataObject(row.template_data_json);
  const rawData = await ensureManageUrl(env, row, initialData);
  const [profile, content] = await Promise.all([loadProfile(env, row), loadContent(env)]);
  const activeProfile = profile && profile.enabled === 1 ? profile : null;

  const english = await renderLocalizedCore(env, row, "en", rawData, profile);
  const arabic = await renderLocalizedCore(env, row, "ar", rawData, profile);
  const subject = arabic.subject && arabic.subject !== english.subject ? \`\${english.subject} | \${arabic.subject}\` : english.subject;

  let coreHtml: string;
  if (row.template_key && !["verification", "manage", "admin_password_reset", "prayer"].includes(row.kind)) {
    coreHtml = mixedTemplateShell(bodyHtml(english.html), bodyHtml(arabic.html));
  } else {
    coreHtml = mixedTemplateShell(bodyHtml(english.html), bodyHtml(arabic.html));
  }

  const core: RenderedEmail = {
    subject,
    html: coreHtml,
    text: \`\${english.text}\\n\\n\${arabic.text}\`
  };
  const extra = activeProfile ? enhancementHtml(activeProfile, content, rawData, "en") : "";
  return appendEnhancements(core, extra, activeProfile, content, "en", rawData);
}`;

const pattern = /function bodyHtml\([\s\S]*?async function renderEmail\(env: Env, row: OutboxRow\) \{[\s\S]*?\n\}\n\nasync function sendResend/;
if (!pattern.test(source)) {
  throw new Error('Unable to locate bilingual render block in emailDelivery.ts');
}
source = source.replace(pattern, `${replacement}\n\nasync function sendResend`);
writeFileSync(url, source);
console.log('Mixed bilingual email body and bilingual subject fixed.');
