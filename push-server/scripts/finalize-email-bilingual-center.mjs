import { readFileSync, writeFileSync } from 'node:fs';

const path = new URL('../src/emailDelivery.ts', import.meta.url);
let source = readFileSync(path, 'utf8');

// Center the base/system email layouts too.
source = source.replaceAll('text-align:left', 'text-align:center');
source = source.replaceAll('text-align:right', 'text-align:center');
source = source.replaceAll('text-align:${textAlign}', 'text-align:center');
source = source.replaceAll('display:block;max-width:180px', 'display:block;margin:0 auto;max-width:180px');
source = source.replaceAll('display:block;border:0;border-radius:15px', 'display:block;margin:0 auto;border:0;border-radius:15px');

const mixedCard = `function mixedContentCard(item: ContentRow, accent: string) {
  const arTitle = item.title_ar || (item.content_type === "hadith" ? "الحديث اليومي" : item.content_type === "surah" ? "القرآن اليومي" : "تذكير اليوم");
  const arBody = item.body_ar || (item.content_type === "hadith" ? "علّمنا النبي ﷺ أن الأعمال بالنيات. جدّد نيتك واجعل يومك ذا معنى." : item.content_type === "surah" ? "يذكّرنا الله بأن مع العسر يسراً. واصل التقدم بالصبر والثقة." : "حافظ على صلاتك، وأكثر من ذكر الله، واجعل لك اليوم عملاً صالحاً يستمر نفعه.");
  const ref = item.source_ref ? '<div style="font-size:10px;color:#89938f;margin-top:8px;text-align:center">' + escapeHtml(item.source_ref) + '</div>' : '';
  return '<tr><td align="center" style="padding:0 22px 14px;text-align:center"><table role="presentation" width="100%" style="background:#fffdf8;border:1px solid #e4ddcf;border-radius:16px;margin:0 auto;text-align:center"><tr><td align="center" style="padding:14px;text-align:center">'
    + '<div dir="ltr" style="text-align:center"><div style="font-size:10px;letter-spacing:1.2px;color:' + accent + ';font-weight:900">' + escapeHtml(item.title_en) + '</div><div style="font-size:14px;line-height:1.65;color:#31564c;font-weight:700;margin-top:5px">' + escapeHtml(item.body_en) + '</div></div>'
    + '<div dir="rtl" style="text-align:center;margin-top:10px"><div style="font-size:11px;color:' + accent + ';font-weight:900">' + escapeHtml(arTitle) + '</div><div style="font-size:14px;line-height:1.8;color:#31564c;font-weight:700;margin-top:4px">' + escapeHtml(arBody) + '</div></div>'
    + ref + '</td></tr></table></td></tr>';
}

`;

if (!source.includes('function mixedContentCard(')) {
  const marker = 'function enhancementHtml(';
  const at = source.indexOf(marker);
  if (at < 0) throw new Error('Could not locate enhancementHtml for bilingual email upgrade');
  source = source.slice(0, at) + mixedCard + source.slice(at);
}

const enhancement = `function enhancementHtml(profile: ProfileRow, content: Map<string, ContentRow>, data: Record<string, unknown>, _locale: Locale) {
  const blocks: string[] = [];
  const event = data.upcomingEvent && typeof data.upcomingEvent === "object" ? data.upcomingEvent as Record<string, unknown> : null;
  if (event && (profile.include_islamic_occasion === 1 || profile.include_occasion_countdown === 1)) {
    const nameEn = String(event.nameEn ?? event.nameAr ?? "Upcoming Islamic Occasion");
    const nameAr = String(event.nameAr ?? event.nameEn ?? "المناسبة الإسلامية القادمة");
    const descriptionEn = String(event.descriptionEn ?? event.descriptionAr ?? "An upcoming Islamic occasion and reminder from Hassoun.");
    const descriptionAr = String(event.descriptionAr ?? event.descriptionEn ?? "مناسبة إسلامية قادمة وتذكير من حسون.");
    const days = Number(event.daysLeft ?? 0);
    const details = profile.include_islamic_occasion === 1
      ? '<div style="font-size:10px;letter-spacing:1.2px;color:#9a772c;font-weight:900;text-align:center">UPCOMING ISLAMIC OCCASION • المناسبة الإسلامية القادمة</div>'
        + '<div dir="ltr" style="font-size:19px;font-weight:900;color:#173f35;text-align:center;margin-top:5px">' + escapeHtml(event.emoji || "🌙") + ' ' + escapeHtml(nameEn) + '</div>'
        + '<div dir="ltr" style="font-size:13px;line-height:1.5;color:#60716b;margin-top:5px;text-align:center">' + escapeHtml(descriptionEn) + '</div>'
        + '<div dir="rtl" style="font-size:19px;font-weight:900;color:#173f35;text-align:center;margin-top:9px">' + escapeHtml(event.emoji || "🌙") + ' ' + escapeHtml(nameAr) + '</div>'
        + '<div dir="rtl" style="font-size:13px;line-height:1.7;color:#60716b;margin-top:5px;text-align:center">' + escapeHtml(descriptionAr) + '</div>'
      : '';
    const countdown = profile.include_occasion_countdown === 1
      ? '<div style="display:inline-block;margin-top:10px;background:#0b654f;color:white;border-radius:99px;padding:6px 10px;font-size:11px;font-weight:900;text-align:center">' + escapeHtml(days + ' days remaining') + ' • ' + escapeHtml('متبقي ' + days + ' يوم') + '</div>'
      : '';
    blocks.push('<tr><td align="center" style="padding:0 22px 14px;text-align:center"><table role="presentation" width="100%" style="background:#fff3cc;border:1px solid #e1c56f;border-radius:16px;margin:0 auto"><tr><td align="center" style="padding:14px;text-align:center">' + details + countdown + '</td></tr></table></td></tr>');
  }
  if (profile.include_daily_hadith === 1 && content.get("hadith")) blocks.push(mixedContentCard(content.get("hadith")!, "#9a772c"));
  if (profile.include_daily_surah === 1 && content.get("surah")) blocks.push(mixedContentCard(content.get("surah")!, "#08735a"));
  if (profile.include_motivation === 1 && content.get("motivation")) blocks.push(mixedContentCard(content.get("motivation")!, "#5b6d9a"));
  if (profile.include_sadaqah_jariyah === 1) {
    blocks.push('<tr><td align="center" style="padding:0 22px 14px;text-align:center"><table role="presentation" width="100%" style="background:#edf6f2;border:1px solid #cfe3db;border-radius:16px;margin:0 auto"><tr><td align="center" style="padding:14px;text-align:center"><div style="font-size:10px;letter-spacing:1.2px;color:#08735a;font-weight:900;text-align:center">SADAQAH JARIYAH • صدقة جارية</div><div dir="ltr" style="font-size:14px;line-height:1.6;color:#31564c;font-weight:800;margin-top:5px;text-align:center">Hassoun is a Sadaqah Jariyah for Abdul Jalil Hassoun and Salwa Hassoun. May Allah accept it and let its benefit continue.</div><div dir="rtl" style="font-size:14px;line-height:1.8;color:#31564c;font-weight:800;margin-top:8px;text-align:center">حسون صدقة جارية عن عبد الجليل حسون وسلمى حسون. نسأل الله أن يتقبله وأن يستمر نفعه.</div></td></tr></table></td></tr>');
  }
  if (profile.include_sponsor === 1) {
    const sponsorName = profile.sponsor_name || "Sponsor & Support";
    const sponsorMessageEn = profile.sponsor_message_en || "Support this Sadaqah Jariyah and help keep Hassoun available and growing.";
    const sponsorMessageAr = profile.sponsor_message_ar || "ادعم هذه الصدقة الجارية وساهم في استمرار حسون ونموه.";
    const logo = profile.sponsor_logo_base64 ? '<div style="margin-bottom:10px;text-align:center"><img src="cid:sponsor-logo" alt="' + escapeHtml(sponsorName) + '" style="display:block;margin:0 auto;max-width:180px;max-height:72px;width:auto;height:auto;border:0;object-fit:contain"></div>' : '';
    const link = profile.sponsor_url ? '<a href="' + escapeHtml(profile.sponsor_url) + '" style="display:inline-block;margin-top:10px;background:#173f35;color:white;text-decoration:none;border-radius:10px;padding:8px 12px;font-size:11px;font-weight:900;text-align:center">Sponsor / Support • الراعي / الدعم</a>' : '';
    blocks.push('<tr><td align="center" style="padding:0 22px 18px;text-align:center"><table role="presentation" width="100%" style="background:#f8f3e9;border:1px solid #e5dac6;border-radius:16px;margin:0 auto"><tr><td align="center" style="padding:14px;text-align:center">' + logo + '<div style="font-size:11px;letter-spacing:1.2px;color:#9a772c;font-weight:900;text-align:center">' + escapeHtml(sponsorName) + '</div><div dir="ltr" style="font-size:13px;line-height:1.55;color:#53655f;margin-top:5px;text-align:center">' + escapeHtml(sponsorMessageEn) + '</div><div dir="rtl" style="font-size:13px;line-height:1.8;color:#53655f;margin-top:7px;text-align:center">' + escapeHtml(sponsorMessageAr) + '</div>' + link + '</td></tr></table></td></tr>');
  }
  if (!blocks.length) return "";
  return '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;margin:14px auto 0;text-align:center">' + blocks.join("") + '</table>';
}

`;

const enhancementPattern = /function enhancementHtml\([\s\S]*?\n\}\n\nfunction universalFooter/;
if (!enhancementPattern.test(source)) throw new Error('Could not replace enhancementHtml');
source = source.replace(enhancementPattern, enhancement + 'function universalFooter');

const footer = `function universalFooter(data: Record<string, unknown>, _locale: Locale) {
  const manageUrl = typeof data.manageUrl === "string" ? data.manageUrl : "";
  const html = '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;margin:14px auto 0;text-align:center"><tr><td align="center" style="padding:0 22px 14px;text-align:center"><table role="presentation" width="100%" style="background:#e9f4ef;border:1px solid #c9e0d7;border-radius:16px;margin:0 auto"><tr><td align="center" style="padding:15px;text-align:center"><div style="font-size:10px;letter-spacing:1.2px;color:#08735a;font-weight:900;text-align:center">QUR’AN TAHFIZ SCHOOL • مدرسة تحفيظ القرآن</div><div dir="ltr" style="font-size:13px;line-height:1.6;color:#49645b;margin-top:5px;text-align:center">Continue memorization, revision, assignments and progress with the Student, Teacher and Parent Qur’an School experience.</div><div dir="rtl" style="font-size:13px;line-height:1.8;color:#49645b;margin-top:7px;text-align:center">تابع الحفظ والمراجعة والواجبات والتقدم من خلال تجربة الطالب والمعلم وولي الأمر.</div><a href="' + HASSOUN_WEB + '/school/" style="display:inline-block;margin-top:10px;background:#0b604b;color:#fff;text-decoration:none;border-radius:10px;padding:9px 12px;font-size:11px;font-weight:900;text-align:center">Open Qur’an School • فتح مدرسة القرآن</a></td></tr></table></td></tr>' + (manageUrl ? '<tr><td align="center" style="padding:2px 22px 18px;text-align:center"><a href="' + escapeHtml(manageUrl) + '" style="color:#6e7d77;font-size:11px;text-decoration:underline;text-align:center">Manage email preferences or unsubscribe • إدارة البريد أو إلغاء الاشتراك</a></td></tr>' : '') + '</table>';
  const text = 'Qur’an Tahfiz School / مدرسة تحفيظ القرآن: ' + HASSOUN_WEB + '/school/' + (manageUrl ? '\\nManage email preferences or unsubscribe / إدارة البريد أو إلغاء الاشتراك: ' + manageUrl : '');
  return { html, text };
}

`;

const footerPattern = /function universalFooter\([\s\S]*?\n\}\n\nfunction sponsorAttachment/;
if (!footerPattern.test(source)) throw new Error('Could not replace universalFooter');
source = source.replace(footerPattern, footer + 'function sponsorAttachment');

// Keep the plain-text alternative bilingual as well.
const appendReplacement = `function appendEnhancements(rendered: RenderedEmail, extraHtml: string, profile: ProfileRow | null, content: Map<string, ContentRow>, _locale: Locale, data: Record<string, unknown>) {
  const textParts: string[] = [];
  if (profile) {
    const addContent = (key: "hadith" | "surah" | "motivation") => {
      const item = content.get(key); if (!item) return;
      const arTitle = item.title_ar || (key === "hadith" ? "الحديث اليومي" : key === "surah" ? "القرآن اليومي" : "تذكير اليوم");
      const arBody = item.body_ar || item.body_en;
      textParts.push(item.title_en + ': ' + item.body_en + '\\n' + arTitle + ': ' + arBody + (item.source_ref ? ' (' + item.source_ref + ')' : ''));
    };
    if (profile.include_daily_hadith === 1) addContent("hadith");
    if (profile.include_daily_surah === 1) addContent("surah");
    if (profile.include_motivation === 1) addContent("motivation");
    if (profile.include_sadaqah_jariyah === 1) textParts.push('Hassoun is a Sadaqah Jariyah for Abdul Jalil Hassoun and Salwa Hassoun.\\nحسون صدقة جارية عن عبد الجليل حسون وسلمى حسون.');
    if (profile.include_sponsor === 1) textParts.push((profile.sponsor_message_en || 'Sponsor & Support') + '\\n' + (profile.sponsor_message_ar || 'الراعي والدعم'));
  }
  const universal = universalFooter(data, "en");
  const additions = extraHtml + universal.html;
  const html = rendered.html.includes("</body>") ? rendered.html.replace("</body>", additions + "</body>") : rendered.html + additions;
  return { ...rendered, html, text: rendered.text + (textParts.length ? '\\n\\n' + textParts.join('\\n\\n') : '') + '\\n\\n' + universal.text, attachments: sponsorAttachment(profile) };
}

`;

const appendPattern = /function appendEnhancements\([\s\S]*?\n\}\n\nasync function renderEmail/;
if (!appendPattern.test(source)) throw new Error('Could not replace appendEnhancements');
source = source.replace(appendPattern, appendReplacement + 'async function renderEmail');

const required = [
  'function mixedContentCard(',
  'UPCOMING ISLAMIC OCCASION • المناسبة الإسلامية القادمة',
  'SADAQAH JARIYAH • صدقة جارية',
  'QUR’AN TAHFIZ SCHOOL • مدرسة تحفيظ القرآن',
  'Sponsor / Support • الراعي / الدعم',
  'text-align:center'
];
for (const marker of required) if (!source.includes(marker)) throw new Error('Bilingual email marker missing: ' + marker);

writeFileSync(path, source);
console.log('Verified every Hassoun email section is mixed English+Arabic and centered.');
