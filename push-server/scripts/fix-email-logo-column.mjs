import { readFileSync, writeFileSync } from 'node:fs';

const root = new URL('../', import.meta.url);

for (const file of ['src/adminEmail.ts', 'src/emailDelivery.ts', 'migrations/0008_email_template_profiles.sql']) {
  const url = new URL(file, root);
  const before = readFileSync(url, 'utf8');
  const after = before.replaceAll('sponsor_logo_data', 'sponsor_logo_base64');
  if (after !== before) writeFileSync(url, after);
}

const deliveryUrl = new URL('src/emailDelivery.ts', root);
let source = readFileSync(deliveryUrl, 'utf8');

const loadProfileReplacement = `async function loadProfile(env: Env, row: OutboxRow) {
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

source = source.replace(/async function loadProfile\(env: Env, row: OutboxRow\) \{[\s\S]*?\n\}\n\nasync function loadContent/, `${loadProfileReplacement}\n\nasync function loadContent`);

const mixedEnhancements = `function bilingualContentCard(item: ContentRow, accent: string) {
  const arTitle = item.title_ar || item.title_en;
  const arBody = item.body_ar || item.body_en;
  const source = item.source_ref ? \`<div style="font-size:10px;color:#89938f;margin-top:6px">\${escapeHtml(item.source_ref)}</div>\` : "";
  return \`<tr><td style="padding:0 22px 14px"><table role="presentation" width="100%" style="background:#fffdf8;border:1px solid #e4ddcf;border-radius:16px"><tr><td style="padding:14px"><div dir="ltr" style="text-align:left"><div style="font-size:10px;letter-spacing:1.2px;color:\${accent};font-weight:900">\${escapeHtml(item.title_en)}</div><div style="font-size:14px;line-height:1.65;color:#31564c;font-weight:700;margin-top:5px">\${escapeHtml(item.body_en)}</div>\${source}</div><div style="height:1px;background:#e7e1d6;margin:12px 0"></div><div dir="rtl" style="text-align:right"><div style="font-size:11px;color:\${accent};font-weight:900">\${escapeHtml(arTitle)}</div><div style="font-size:14px;line-height:1.8;color:#31564c;font-weight:700;margin-top:5px">\${escapeHtml(arBody)}</div>\${source}</div></td></tr></table></td></tr>\`;
}

function enhancementHtml(profile: ProfileRow, content: Map<string, ContentRow>, data: Record<string, unknown>, _locale: Locale) {
  const blocks: string[] = [];
  const event = data.upcomingEvent && typeof data.upcomingEvent === "object" ? data.upcomingEvent as Record<string, unknown> : null;
  if (event && (profile.include_islamic_occasion === 1 || profile.include_occasion_countdown === 1)) {
    const nameEn = String(event.nameEn ?? event.nameAr ?? "");
    const nameAr = String(event.nameAr ?? event.nameEn ?? "");
    const descriptionEn = String(event.descriptionEn ?? event.descriptionAr ?? "");
    const descriptionAr = String(event.descriptionAr ?? event.descriptionEn ?? "");
    const days = Number(event.daysLeft ?? 0);
    const enCountdown = profile.include_occasion_countdown === 1 ? \`<div style="display:inline-block;margin-top:9px;background:#0b654f;color:white;border-radius:99px;padding:6px 10px;font-size:11px;font-weight:900">\${escapeHtml(\`\${days} days remaining\`)}</div>\` : "";
    const arCountdown = profile.include_occasion_countdown === 1 ? \`<div style="display:inline-block;margin-top:9px;background:#0b654f;color:white;border-radius:99px;padding:6px 10px;font-size:11px;font-weight:900">\${escapeHtml(\`متبقي \${days} يوم\`)}</div>\` : "";
    const enDetails = profile.include_islamic_occasion === 1 ? \`<div style="font-size:19px;font-weight:900;color:#173f35">\${escapeHtml(event.emoji || "🌙")} \${escapeHtml(nameEn)}</div><div style="font-size:13px;line-height:1.5;color:#60716b;margin-top:5px">\${escapeHtml(descriptionEn)}</div>\` : "";
    const arDetails = profile.include_islamic_occasion === 1 ? \`<div style="font-size:19px;font-weight:900;color:#173f35">\${escapeHtml(event.emoji || "🌙")} \${escapeHtml(nameAr)}</div><div style="font-size:13px;line-height:1.8;color:#60716b;margin-top:5px">\${escapeHtml(descriptionAr)}</div>\` : "";
    blocks.push(\`<tr><td style="padding:0 22px 14px"><table role="presentation" width="100%" style="background:#fff3cc;border:1px solid #e1c56f;border-radius:16px"><tr><td style="padding:14px"><div dir="ltr" style="text-align:left"><div style="font-size:10px;letter-spacing:1.2px;color:#9a772c;font-weight:900">UPCOMING ISLAMIC OCCASION</div>\${enDetails}\${enCountdown}</div><div style="height:1px;background:#e1c56f;margin:12px 0"></div><div dir="rtl" style="text-align:right"><div style="font-size:11px;color:#9a772c;font-weight:900">المناسبة الإسلامية القادمة</div>\${arDetails}\${arCountdown}</div></td></tr></table></td></tr>\`);
  }
  if (profile.include_daily_hadith === 1 && content.get("hadith")) blocks.push(bilingualContentCard(content.get("hadith")!, "#9a772c"));
  if (profile.include_daily_surah === 1 && content.get("surah")) blocks.push(bilingualContentCard(content.get("surah")!, "#08735a"));
  if (profile.include_motivation === 1 && content.get("motivation")) blocks.push(bilingualContentCard(content.get("motivation")!, "#5b6d9a"));
  if (profile.include_sadaqah_jariyah === 1) {
    blocks.push(\`<tr><td style="padding:0 22px 14px"><table role="presentation" width="100%" style="background:#edf6f2;border:1px solid #cfe3db;border-radius:16px"><tr><td style="padding:14px"><div dir="ltr" style="text-align:left"><div style="font-size:10px;letter-spacing:1.2px;color:#08735a;font-weight:900">SADAQAH JARIYAH</div><div style="font-size:14px;line-height:1.6;color:#31564c;font-weight:800;margin-top:5px">Hassoun is a Sadaqah Jariyah for Abdul Jalil Hassoun and Salwa Hassoun. May Allah accept it and let its benefit continue.</div></div><div style="height:1px;background:#cfe3db;margin:12px 0"></div><div dir="rtl" style="text-align:right"><div style="font-size:11px;color:#08735a;font-weight:900">صدقة جارية</div><div style="font-size:14px;line-height:1.8;color:#31564c;font-weight:800;margin-top:5px">هذا المشروع صدقة جارية عن عبد الجليل حسون وسلمى حسون. نسأل الله أن يتقبله وينفع به.</div></div></td></tr></table></td></tr>\`);
  }
  if (profile.include_sponsor === 1) {
    const sponsorName = profile.sponsor_name || "Sponsor & Support";
    const sponsorMessageEn = profile.sponsor_message_en || "Support this Sadaqah Jariyah and help keep Hassoun available and growing.";
    const sponsorMessageAr = profile.sponsor_message_ar || "يمكنك دعم هذه الصدقة الجارية والمساهمة في استمرارها.";
    const link = profile.sponsor_url ? \`<a href="\${escapeHtml(profile.sponsor_url)}" style="display:inline-block;margin-top:10px;background:#173f35;color:white;text-decoration:none;border-radius:10px;padding:8px 12px;font-size:11px;font-weight:900">Sponsor / Support • زيارة الراعي</a>\` : "";
    const logo = profile.sponsor_logo_base64 ? \`<div style="margin-bottom:10px"><img src="cid:sponsor-logo" alt="\${escapeHtml(sponsorName)}" style="display:block;max-width:180px;max-height:72px;width:auto;height:auto;border:0;object-fit:contain"></div>\` : "";
    blocks.push(\`<tr><td style="padding:0 22px 18px"><table role="presentation" width="100%" style="background:#f8f3e9;border:1px solid #e5dac6;border-radius:16px"><tr><td style="padding:14px">\${logo}<div dir="ltr" style="text-align:left"><div style="font-size:10px;letter-spacing:1.2px;color:#9a772c;font-weight:900">\${escapeHtml(sponsorName)}</div><div style="font-size:13px;line-height:1.55;color:#53655f;margin-top:5px">\${escapeHtml(sponsorMessageEn)}</div></div><div style="height:1px;background:#e5dac6;margin:12px 0"></div><div dir="rtl" style="text-align:right"><div style="font-size:13px;line-height:1.8;color:#53655f">\${escapeHtml(sponsorMessageAr)}</div></div>\${link}</td></tr></table></td></tr>\`);
  }
  if (!blocks.length) return "";
  return \`<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;margin:14px auto 0">\${blocks.join("")}</table>\`;
}

function universalFooter(data: Record<string, unknown>, _locale: Locale) {
  const manageUrl = typeof data.manageUrl === "string" ? data.manageUrl : "";
  const manageLink = manageUrl ? \`<tr><td style="padding:2px 22px 18px;text-align:center"><a href="\${escapeHtml(manageUrl)}" style="color:#6e7d77;font-size:11px;text-decoration:underline">Manage email preferences or unsubscribe • إدارة البريد أو إلغاء الاشتراك</a></td></tr>\` : "";
  const html = \`<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;margin:14px auto 0"><tr><td style="padding:0 22px 14px"><table role="presentation" width="100%" style="background:#e9f4ef;border:1px solid #c9e0d7;border-radius:16px"><tr><td style="padding:15px"><div dir="ltr" style="text-align:left"><div style="font-size:10px;letter-spacing:1.2px;color:#08735a;font-weight:900">QUR’AN TAHFIZ SCHOOL</div><div style="font-size:13px;line-height:1.6;color:#49645b;margin-top:5px">Continue memorization, revision, assignments and progress with the Student, Teacher and Parent Qur’an School experience.</div></div><div style="height:1px;background:#c9e0d7;margin:12px 0"></div><div dir="rtl" style="text-align:right"><div style="font-size:11px;color:#08735a;font-weight:900">مدرسة تحفيظ القرآن</div><div style="font-size:13px;line-height:1.8;color:#49645b;margin-top:5px">تابع الحفظ والمراجعة والواجبات والتقدم من خلال تجربة الطالب والمعلم وولي الأمر.</div></div><a href="\${HASSOUN_WEB}/school/" style="display:inline-block;margin-top:10px;background:#0b604b;color:#fff;text-decoration:none;border-radius:10px;padding:9px 12px;font-size:11px;font-weight:900">Open Qur’an School • فتح مدرسة القرآن</a></td></tr></table></td></tr>\${manageLink}</table>\`;
  const text = \`Qur’an Tahfiz School: \${HASSOUN_WEB}/school/\\nمدرسة تحفيظ القرآن: \${HASSOUN_WEB}/school/\${manageUrl ? \`\\nManage email preferences or unsubscribe / إدارة البريد أو إلغاء الاشتراك: \${manageUrl}\` : ""}\`;
  return { html, text };
}

function sponsorAttachment(profile: ProfileRow | null): InlineAttachment[] | undefined {
  if (!profile || profile.include_sponsor !== 1 || !profile.sponsor_logo_base64 || !profile.sponsor_logo_mime) return undefined;
  const extension = profile.sponsor_logo_mime === "image/jpeg" ? "jpg" : "png";
  return [{ content: profile.sponsor_logo_base64, filename: \`sponsor-logo.\${extension}\`, content_type: profile.sponsor_logo_mime, content_id: "sponsor-logo" }];
}

function appendEnhancements(rendered: RenderedEmail, extraHtml: string, profile: ProfileRow | null, content: Map<string, ContentRow>, locale: Locale, data: Record<string, unknown>) {
  const textParts: string[] = [];
  if (profile) {
    const hadith = content.get("hadith");
    const surah = content.get("surah");
    const motivation = content.get("motivation");
    if (profile.include_daily_hadith === 1 && hadith) textParts.push(\`\${hadith.title_en}: \${hadith.body_en}\\n\${hadith.title_ar || hadith.title_en}: \${hadith.body_ar || hadith.body_en}\`);
    if (profile.include_daily_surah === 1 && surah) textParts.push(\`\${surah.title_en}: \${surah.body_en}\\n\${surah.title_ar || surah.title_en}: \${surah.body_ar || surah.body_en}\`);
    if (profile.include_motivation === 1 && motivation) textParts.push(\`\${motivation.title_en}: \${motivation.body_en}\\n\${motivation.title_ar || motivation.title_en}: \${motivation.body_ar || motivation.body_en}\`);
    if (profile.include_sadaqah_jariyah === 1) textParts.push("Hassoun is a Sadaqah Jariyah for Abdul Jalil Hassoun and Salwa Hassoun.\\nهذا المشروع صدقة جارية عن عبد الجليل حسون وسلمى حسون.");
    if (profile.include_sponsor === 1) textParts.push(\`\${profile.sponsor_message_en || "Support this Sadaqah Jariyah and help keep Hassoun available and growing."}\\n\${profile.sponsor_message_ar || "يمكنك دعم هذه الصدقة الجارية والمساهمة في استمرارها."}\`);
  }
  const universal = universalFooter(data, locale);
  const additions = \`\${extraHtml}\${universal.html}\`;
  const html = rendered.html.includes("</body>") ? rendered.html.replace("</body>", \`\${additions}</body>\`) : \`\${rendered.html}\${additions}\`;
  return { ...rendered, html, text: \`\${rendered.text}\${textParts.length ? \`\\n\\n\${textParts.join("\\n\\n")}\` : ""}\\n\\n\${universal.text}\`, attachments: sponsorAttachment(profile) };
}`;

source = source.replace(/function contentCard\([\s\S]*?function appendEnhancements\([\s\S]*?\n\}\n\nasync function renderEmail/, `${mixedEnhancements}\n\nasync function renderEmail`);

const mixedRender = `function bodyHtml(html: string) {
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
      builtIn = { subject: applyTemplate(subjectSource, values, false), html: applyTemplate(htmlSource, values, true), text: applyTemplate(textSource, values, false) };
    }
  }
  return builtIn;
}

async function renderEmail(env: Env, row: OutboxRow) {
  const initialData = dataObject(row.template_data_json);
  const rawData = await ensureManageUrl(env, row, initialData);
  const [profile, content] = await Promise.all([loadProfile(env, row), loadContent(env)]);
  const activeProfile = profile && profile.enabled === 1 ? profile : null;

  const english = await renderLocalizedCore(env, row, "en", rawData, profile);
  const arabic = await renderLocalizedCore(env, row, "ar", rawData, profile);
  const coreDivider = \`<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;margin:10px auto"><tr><td style="border-top:1px solid #ddd4c6"></td></tr></table>\`;
  const coreHtml = \`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#f6f0e5;font-family:Arial,Helvetica,sans-serif;color:#173f35">\${bodyHtml(english.html)}\${coreDivider}\${bodyHtml(arabic.html)}</body></html>\`;
  const subject = arabic.subject && arabic.subject !== english.subject ? \`\${english.subject} | \${arabic.subject}\` : english.subject;
  const core = { subject, html: coreHtml, text: \`\${english.text}\\n\\n\${arabic.text}\` };
  const extra = activeProfile ? enhancementHtml(activeProfile, content, rawData, "en") : "";
  return appendEnhancements(core, extra, activeProfile, content, "en", rawData);
}`;

source = source.replace(/(?:function bodyHtml\([\s\S]*?)?async function renderEmail\(env: Env, row: OutboxRow\) \{[\s\S]*?\n\}\n\nasync function sendResend/, `${mixedRender}\n\nasync function sendResend`);

writeFileSync(deliveryUrl, source);
console.log('Email schema aligned. English and Arabic now render together inside each email section.');
