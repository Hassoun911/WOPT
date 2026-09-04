import { readFileSync, writeFileSync } from 'node:fs';

const path = new URL('../src/emailDelivery.ts', import.meta.url);
let source = readFileSync(path, 'utf8');

function replaceBetween(startMarker, endMarker, replacement, label) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  if (start < 0 || end < 0) throw new Error(`Could not locate ${label}`);
  source = source.slice(0, start) + replacement + '\n\n' + source.slice(end);
}

const contentCard = String.raw`function contentCard(item: ContentRow, _locale: Locale, accent: string) {
  const titleAr = item.title_ar || (item.content_type === "hadith" ? "الحديث اليومي" : item.content_type === "surah" ? "القرآن اليومي" : "تذكير اليوم");
  const bodyAr = item.body_ar || (item.content_type === "hadith" ? "علّمنا النبي ﷺ أن الأعمال بالنيات. جدّد نيتك واجعل يومك ذا معنى." : item.content_type === "surah" ? "يذكّرنا الله بأن مع العسر يسراً. واصل التقدم بالصبر والثقة." : "حافظ على صلاتك، وأكثر من ذكر الله، واجعل لك اليوم عملاً صالحاً يستمر نفعه.");
  const ref = item.source_ref ? '<div style="font-size:10px;color:#89938f;margin-top:7px;text-align:center">' + escapeHtml(item.source_ref) + '</div>' : '';
  return '<tr><td align="center" style="padding:0 22px 14px;text-align:center"><table role="presentation" width="100%" style="background:#fffdf8;border:1px solid #e4ddcf;border-radius:16px;margin:0 auto;text-align:center"><tr><td align="center" style="padding:14px;text-align:center">'
    + '<div dir="ltr" style="text-align:center"><div style="font-size:10px;letter-spacing:1.2px;color:' + accent + ';font-weight:900">' + escapeHtml(item.title_en) + '</div><div style="font-size:14px;line-height:1.65;color:#31564c;font-weight:700;margin-top:5px">' + escapeHtml(item.body_en) + '</div></div>'
    + '<div dir="rtl" style="text-align:center;margin-top:8px"><div style="font-size:11px;color:' + accent + ';font-weight:900">' + escapeHtml(titleAr) + '</div><div style="font-size:14px;line-height:1.8;color:#31564c;font-weight:700;margin-top:4px">' + escapeHtml(bodyAr) + '</div></div>'
    + ref + '</td></tr></table></td></tr>';
}`;

const enhancementHtml = String.raw`function enhancementHtml(profile: ProfileRow, content: Map<string, ContentRow>, data: Record<string, unknown>, _locale: Locale) {
  const blocks: string[] = [];
  const event = data.upcomingEvent && typeof data.upcomingEvent === "object" ? data.upcomingEvent as Record<string, unknown> : null;
  if (event && (profile.include_islamic_occasion === 1 || profile.include_occasion_countdown === 1)) {
    const nameEn = String(event.nameEn ?? "Upcoming Islamic Occasion");
    const nameAr = String(event.nameAr ?? "مناسبة إسلامية قادمة");
    const descEn = String(event.descriptionEn ?? "An upcoming Islamic occasion and reminder from Hassoun.");
    const descAr = String(event.descriptionAr ?? "مناسبة إسلامية قادمة وتذكير من حسون.");
    const days = Number(event.daysLeft ?? 0);
    blocks.push('<tr><td align="center" style="padding:0 22px 14px;text-align:center"><table role="presentation" width="100%" style="background:#fff3cc;border:1px solid #e1c56f;border-radius:16px;margin:0 auto;text-align:center"><tr><td align="center" style="padding:14px;text-align:center">'
      + '<div style="font-size:10px;letter-spacing:1.2px;color:#9a772c;font-weight:900">UPCOMING ISLAMIC OCCASION • المناسبة الإسلامية القادمة</div>'
      + '<div dir="ltr" style="font-size:19px;font-weight:900;color:#173f35;margin-top:5px;text-align:center">' + escapeHtml(event.emoji || "🌙") + ' ' + escapeHtml(nameEn) + '</div>'
      + '<div dir="ltr" style="font-size:13px;line-height:1.5;color:#60716b;margin-top:5px;text-align:center">' + escapeHtml(descEn) + '</div>'
      + '<div dir="rtl" style="font-size:18px;font-weight:900;color:#173f35;margin-top:8px;text-align:center">' + escapeHtml(event.emoji || "🌙") + ' ' + escapeHtml(nameAr) + '</div>'
      + '<div dir="rtl" style="font-size:13px;line-height:1.8;color:#60716b;margin-top:5px;text-align:center">' + escapeHtml(descAr) + '</div>'
      + (profile.include_occasion_countdown === 1 ? '<div style="display:inline-block;margin-top:10px;background:#0b654f;color:white;border-radius:99px;padding:6px 10px;font-size:11px;font-weight:900">' + escapeHtml(days + ' days remaining • متبقي ' + days + ' أيام') + '</div>' : '')
      + '</td></tr></table></td></tr>');
  }
  if (profile.include_daily_hadith === 1 && content.get("hadith")) blocks.push(contentCard(content.get("hadith")!, "en", "#9a772c"));
  if (profile.include_daily_surah === 1 && content.get("surah")) blocks.push(contentCard(content.get("surah")!, "en", "#08735a"));
  if (profile.include_motivation === 1 && content.get("motivation")) blocks.push(contentCard(content.get("motivation")!, "en", "#5b6d9a"));
  if (profile.include_sadaqah_jariyah === 1) {
    blocks.push('<tr><td align="center" style="padding:0 22px 14px;text-align:center"><table role="presentation" width="100%" style="background:#edf6f2;border:1px solid #cfe3db;border-radius:16px;margin:0 auto"><tr><td align="center" style="padding:14px;text-align:center"><div style="font-size:10px;letter-spacing:1.2px;color:#08735a;font-weight:900">SADAQAH JARIYAH • صدقة جارية</div><div dir="ltr" style="font-size:14px;line-height:1.6;color:#31564c;font-weight:800;margin-top:5px;text-align:center">Hassoun is a Sadaqah Jariyah for Abdul Jalil Hassoun and Salwa Hassoun. May Allah accept it and let its benefit continue.</div><div dir="rtl" style="font-size:14px;line-height:1.8;color:#31564c;font-weight:800;margin-top:7px;text-align:center">حسون صدقة جارية عن عبد الجليل حسون وسلمى حسون. نسأل الله أن يتقبله وأن يستمر نفعه.</div></td></tr></table></td></tr>');
  }
  if (profile.include_sponsor === 1) {
    const sponsorName = profile.sponsor_name || "Sponsor & Support";
    const sponsorEn = profile.sponsor_message_en || "Support this Sadaqah Jariyah and help keep Hassoun available and growing.";
    const sponsorAr = profile.sponsor_message_ar || "ادعم هذه الصدقة الجارية وساهم في استمرار حسون وتطوره.";
    const logo = profile.sponsor_logo_base64 ? '<div style="margin:0 auto 10px;text-align:center"><img src="cid:sponsor-logo" alt="' + escapeHtml(sponsorName) + '" style="display:block;margin:0 auto;max-width:180px;max-height:72px;width:auto;height:auto;border:0;object-fit:contain"></div>' : '';
    const link = profile.sponsor_url ? '<a href="' + escapeHtml(profile.sponsor_url) + '" style="display:inline-block;margin-top:9px;background:#173f35;color:white;text-decoration:none;border-radius:10px;padding:8px 12px;font-size:11px;font-weight:900">Sponsor / Support • الراعي / الدعم</a>' : '';
    blocks.push('<tr><td align="center" style="padding:0 22px 18px;text-align:center"><table role="presentation" width="100%" style="background:#f8f3e9;border:1px solid #e5dac6;border-radius:16px;margin:0 auto"><tr><td align="center" style="padding:14px;text-align:center">' + logo + '<div style="font-size:11px;letter-spacing:1.2px;color:#9a772c;font-weight:900;text-align:center">' + escapeHtml(sponsorName) + '</div><div dir="ltr" style="font-size:13px;line-height:1.55;color:#53655f;margin-top:5px;text-align:center">' + escapeHtml(sponsorEn) + '</div><div dir="rtl" style="font-size:13px;line-height:1.8;color:#53655f;margin-top:6px;text-align:center">' + escapeHtml(sponsorAr) + '</div>' + link + '</td></tr></table></td></tr>');
  }
  return blocks.length ? '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;margin:14px auto 0;text-align:center">' + blocks.join("") + '</table>' : "";
}`;

const universalFooter = String.raw`function universalFooter(data: Record<string, unknown>, _locale: Locale) {
  const manageUrl = typeof data.manageUrl === "string" ? data.manageUrl : "";
  const html = '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;margin:14px auto 0;text-align:center"><tr><td align="center" style="padding:0 22px 14px;text-align:center"><table role="presentation" width="100%" style="background:#e9f4ef;border:1px solid #c9e0d7;border-radius:16px;margin:0 auto"><tr><td align="center" style="padding:15px;text-align:center"><div style="font-size:10px;letter-spacing:1.2px;color:#08735a;font-weight:900">Qur’an Tahfiz School • مدرسة تحفيظ القرآن</div><div dir="ltr" style="font-size:13px;line-height:1.6;color:#49645b;margin-top:5px;text-align:center">Continue memorization, revision, assignments and progress with the Student, Teacher and Parent Qur’an School experience.</div><div dir="rtl" style="font-size:13px;line-height:1.8;color:#49645b;margin-top:6px;text-align:center">تابع الحفظ والمراجعة والواجبات والتقدم من خلال تجربة الطالب والمعلم وولي الأمر في مدرسة القرآن.</div><a href="' + HASSOUN_WEB + '/school/" style="display:inline-block;margin-top:10px;background:#0b604b;color:#fff;text-decoration:none;border-radius:10px;padding:9px 12px;font-size:11px;font-weight:900">Open Qur’an School • فتح مدرسة القرآن</a></td></tr></table></td></tr>' + (manageUrl ? '<tr><td align="center" style="padding:2px 22px 18px;text-align:center"><a href="' + escapeHtml(manageUrl) + '" style="color:#6e7d77;font-size:11px;text-decoration:underline">Manage email preferences or unsubscribe • إدارة البريد أو إلغاء الاشتراك</a></td></tr>' : '') + '</table>';
  const text = 'Qur’an Tahfiz School • مدرسة تحفيظ القرآن: ' + HASSOUN_WEB + '/school/' + (manageUrl ? '\nManage email preferences or unsubscribe • إدارة البريد أو إلغاء الاشتراك: ' + manageUrl : '');
  return { html, text };
}`;

const renderEmail = String.raw`async function renderEmail(env: Env, row: OutboxRow) {
  const initialData = dataObject(row.template_data_json);
  const rawData = await ensureManageUrl(env, row, initialData);
  const [profile, content] = await Promise.all([loadProfile(env, row), loadContent(env)]);
  const activeProfile = profile && profile.enabled === 1 ? profile : null;
  const data = { ...rawData };
  if (row.kind === "prayer") data.upcomingEvent = null;

  const enBase = row.kind === "prayer" ? prayerDashboardEmail(data, "en") : builtInSystemEmail(row.kind, data, "en");
  const arBase = row.kind === "prayer" ? prayerDashboardEmail(data, "ar") : builtInSystemEmail(row.kind, data, "ar");
  let core = enBase;

  if (!["verification", "manage", "admin_password_reset", "prayer"].includes(row.kind) && row.template_key) {
    const template = await env.DB.prepare('SELECT subject_en, subject_ar, html_en, html_ar, text_en, text_ar FROM email_templates WHERE template_key = ? AND enabled = 1 LIMIT 1').bind(row.template_key).first<TemplateRow>();
    if (template) {
      const valuesEn = templateValues(enBase, rawData);
      const valuesAr = templateValues(arBase, rawData);
      const htmlEn = applyTemplate(template.html_en, valuesEn, true).replace(/text-align:(?:left|right)/g, 'text-align:center');
      const htmlAr = applyTemplate(template.html_ar || template.html_en, valuesAr, true).replace(/text-align:(?:left|right)/g, 'text-align:center');
      const subjectEn = applyTemplate(template.subject_en, valuesEn, false);
      const subjectAr = applyTemplate(template.subject_ar || template.subject_en, valuesAr, false);
      core = {
        subject: subjectAr !== subjectEn ? subjectEn + ' | ' + subjectAr : subjectEn,
        html: '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#f6f0e5;font-family:Arial,Helvetica,sans-serif;color:#173f35;text-align:center"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f6f0e5;padding:24px 12px;text-align:center"><tr><td align="center"><table role="presentation" width="100%" style="max-width:620px;margin:0 auto;background:#fffdf8;border:1px solid #e3dac9;border-radius:20px"><tr><td align="center" style="padding:22px;text-align:center"><div dir="ltr" style="text-align:center">' + htmlEn + '</div><div dir="rtl" style="text-align:center;margin-top:12px">' + htmlAr + '</div></td></tr></table></td></tr></table></body></html>',
        text: (template.text_en || enBase.text) + '\n\n' + (template.text_ar || arBase.text),
      };
    }
  } else if (row.kind !== "prayer") {
    const enHtml = bodyHtml(enBase.html).replace(/text-align:(?:left|right)/g, 'text-align:center');
    const arHtml = bodyHtml(arBase.html).replace(/text-align:(?:left|right)/g, 'text-align:center');
    core = { subject: arBase.subject !== enBase.subject ? enBase.subject + ' | ' + arBase.subject : enBase.subject, html: '<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0;background:#f6f0e5;text-align:center"><div style="max-width:620px;margin:0 auto;text-align:center">' + enHtml + '<div dir="rtl" style="text-align:center;margin-top:12px">' + arHtml + '</div></div></body></html>', text: enBase.text + '\n\n' + arBase.text };
  } else if (arBase.subject !== enBase.subject) {
    core = { ...enBase, subject: enBase.subject + ' | ' + arBase.subject };
  }

  const extra = activeProfile ? enhancementHtml(activeProfile, content, rawData, "en") : "";
  return appendEnhancements(core, extra, activeProfile, content, "en", rawData);
}`;

replaceBetween('function contentCard(', 'function enhancementHtml(', contentCard, 'contentCard');
replaceBetween('function enhancementHtml(', 'function universalFooter(', enhancementHtml, 'enhancementHtml');
replaceBetween('function universalFooter(', 'function sponsorAttachment(', universalFooter, 'universalFooter');
replaceBetween('async function renderEmail(', 'async function sendResend(', renderEmail, 'renderEmail');

source = source.replaceAll('text-align:left', 'text-align:center').replaceAll('text-align:right', 'text-align:center');
source = source.replaceAll('display:block;max-width:180px', 'display:block;margin:0 auto;max-width:180px');

for (const required of ['الحديث اليومي','القرآن اليومي','صدقة جارية','مدرسة تحفيظ القرآن','الراعي / الدعم']) {
  if (!source.includes(required)) throw new Error('Bilingual email marker missing: ' + required);
}

writeFileSync(path, source);
console.log('Forced bilingual mixed sections and centered all Hassoun email content.');
