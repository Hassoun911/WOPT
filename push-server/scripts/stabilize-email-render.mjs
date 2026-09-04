import { readFileSync, writeFileSync } from 'node:fs';

const path = new URL('../src/emailDelivery.ts', import.meta.url);
let source = readFileSync(path, 'utf8');

const renderStart = source.indexOf('async function renderEmail(env: Env, row: OutboxRow) {');
const sendStart = source.indexOf('async function sendResend(env: Env, row: OutboxRow, email: RenderedEmail) {');
const helperStart = source.indexOf('function bodyHtml(html: string) {');
if (renderStart < 0 || sendStart < 0 || sendStart <= renderStart) throw new Error('Could not locate production email render block');
const blockStart = helperStart >= 0 && helperStart < renderStart ? helperStart : renderStart;

const stableRender = `async function renderEmail(env: Env, row: OutboxRow) {
  const initialData = dataObject(row.template_data_json);
  const rawData = await ensureManageUrl(env, row, initialData);
  const [profile, content] = await Promise.all([loadProfile(env, row), loadContent(env)]);
  const activeProfile = profile && profile.enabled === 1 ? profile : null;
  const data = { ...rawData };
  if (row.kind === "prayer" && profile) data.upcomingEvent = null;

  // Keep one core email layout. Test templates already contain English + Arabic
  // together, so do not duplicate the whole email into separate language halves.
  let builtIn = row.kind === "prayer"
    ? prayerDashboardEmail(data, "en")
    : builtInSystemEmail(row.kind, data, "en");

  if (!["verification", "manage", "admin_password_reset", "prayer"].includes(row.kind) && row.template_key) {
    const template = await env.DB.prepare(\`SELECT subject_en, subject_ar, html_en, html_ar, text_en, text_ar FROM email_templates WHERE template_key = ? AND enabled = 1 LIMIT 1\`).bind(row.template_key).first<TemplateRow>();
    if (template) {
      const values = templateValues(builtIn, rawData);
      const subjectEn = applyTemplate(template.subject_en, values, false);
      const subjectAr = applyTemplate(template.subject_ar || template.subject_en, values, false);
      const htmlEn = applyTemplate(template.html_en, values, true);
      const htmlAr = applyTemplate(template.html_ar || template.html_en, values, true);
      const textEn = applyTemplate(template.text_en || builtIn.text, values, false);
      const textAr = applyTemplate(template.text_ar || template.text_en || builtIn.text, values, false);
      const sameHtml = htmlAr.trim() === htmlEn.trim();
      const html = sameHtml
        ? htmlEn
        : \`<div style="text-align:center;margin:0 auto">\${htmlEn}<div style="height:1px;background:#e5ded2;margin:14px auto;max-width:520px"></div><div dir="rtl" style="text-align:center">\${htmlAr}</div></div>\`;
      builtIn = {
        subject: subjectAr && subjectAr !== subjectEn ? \`\${subjectEn} | \${subjectAr}\` : subjectEn,
        html,
        text: textAr && textAr !== textEn ? \`\${textEn}\\n\\n\${textAr}\` : textEn,
      };
    }
  }

  const extra = activeProfile ? enhancementHtml(activeProfile, content, rawData, "en") : "";
  return appendEnhancements(builtIn, extra, activeProfile, content, "en", rawData);
}

`;

source = source.slice(0, blockStart) + stableRender + source.slice(sendStart);

const required = [
  'function mixedContentCard(',
  'UPCOMING ISLAMIC OCCASION • المناسبة الإسلامية القادمة',
  'SADAQAH JARIYAH • صدقة جارية',
  'QUR’AN TAHFIZ SCHOOL • مدرسة تحفيظ القرآن',
  'Sponsor / Support • الراعي / الدعم',
  'text-align:center',
  'margin:0 auto;max-width:180px'
];
for (const marker of required) if (!source.includes(marker)) throw new Error('Production email marker missing: ' + marker);
if (source.includes('renderLocalizedCore(') || source.includes('bodyHtml(')) throw new Error('Legacy split-language email renderer survived stabilization');

writeFileSync(path, source);
console.log('Production email renderer stabilized: one mixed bilingual email, centered sections, centered sponsor.');
