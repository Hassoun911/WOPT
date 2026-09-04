import { readFileSync, writeFileSync } from 'node:fs';

const path = new URL('../src/emailDelivery.ts', import.meta.url);
let source = readFileSync(path, 'utf8');

// Always center every visible part of the email.
source = source.replaceAll('text-align:left', 'text-align:center');
source = source.replaceAll('text-align:right', 'text-align:center');
source = source.replaceAll('text-align:${textAlign}', 'text-align:center');
source = source.replaceAll('display:block;max-width:180px', 'display:block;margin:0 auto;max-width:180px');
source = source.replaceAll('display:block;border:0;border-radius:15px', 'display:block;margin:0 auto;border:0;border-radius:15px');
source = source.replaceAll('<td style="padding:14px">', '<td align="center" style="padding:14px;text-align:center">');
source = source.replaceAll('<td style="padding:15px">', '<td align="center" style="padding:15px;text-align:center">');

// If the schema patch produced the mixed bilingual renderer, make Arabic fallbacks real.
source = source.replace(
  'const arTitle = item.title_ar || item.title_en;',
  'const arTitle = item.title_ar || (item.content_type === "hadith" ? "الحديث اليومي" : item.content_type === "surah" ? "القرآن اليومي" : "تذكير اليوم");'
);
source = source.replace(
  'const arBody = item.body_ar || item.body_en;',
  'const arBody = item.body_ar || (item.content_type === "hadith" ? "علّمنا النبي ﷺ أن الأعمال بالنيات. جدّد نيتك واجعل يومك ذا معنى." : item.content_type === "surah" ? "يذكّرنا الله بأن مع العسر يسراً. واصل التقدم بالصبر والثقة." : "حافظ على صلاتك، وأكثر من ذكر الله، واجعل لك اليوم عملاً صالحاً يستمر نفعه.");'
);

// Safety fallback: if the previous patch did NOT replace the legacy one-language card,
// replace that legacy card here with a guaranteed English+Arabic centered card.
if (!source.includes('function bilingualContentCard(') && source.includes('function contentCard(')) {
  const replacement = `function contentCard(item: ContentRow, _locale: Locale, accent: string) {
  const arTitle = item.title_ar || (item.content_type === "hadith" ? "الحديث اليومي" : item.content_type === "surah" ? "القرآن اليومي" : "تذكير اليوم");
  const arBody = item.body_ar || (item.content_type === "hadith" ? "علّمنا النبي ﷺ أن الأعمال بالنيات. جدّد نيتك واجعل يومك ذا معنى." : item.content_type === "surah" ? "يذكّرنا الله بأن مع العسر يسراً. واصل التقدم بالصبر والثقة." : "حافظ على صلاتك، وأكثر من ذكر الله، واجعل لك اليوم عملاً صالحاً يستمر نفعه.");
  const ref = item.source_ref ? '<div style="font-size:10px;color:#89938f;margin-top:7px;text-align:center">' + escapeHtml(item.source_ref) + '</div>' : '';
  return '<tr><td align="center" style="padding:0 22px 14px;text-align:center"><table role="presentation" width="100%" style="background:#fffdf8;border:1px solid #e4ddcf;border-radius:16px;margin:0 auto;text-align:center"><tr><td align="center" style="padding:14px;text-align:center">'
    + '<div dir="ltr" style="text-align:center"><div style="font-size:10px;letter-spacing:1.2px;color:' + accent + ';font-weight:900">' + escapeHtml(item.title_en) + '</div><div style="font-size:14px;line-height:1.65;color:#31564c;font-weight:700;margin-top:5px">' + escapeHtml(item.body_en) + '</div></div>'
    + '<div dir="rtl" style="text-align:center;margin-top:8px"><div style="font-size:11px;color:' + accent + ';font-weight:900">' + escapeHtml(arTitle) + '</div><div style="font-size:14px;line-height:1.8;color:#31564c;font-weight:700;margin-top:4px">' + escapeHtml(arBody) + '</div></div>'
    + ref + '</td></tr></table></td></tr>';
}`;
  const pattern = /function contentCard\([\s\S]*?\n\}\n\nfunction enhancementHtml/;
  if (!pattern.test(source)) throw new Error('Legacy contentCard exists but could not be upgraded');
  source = source.replace(pattern, replacement + '\n\nfunction enhancementHtml');
}

// Guarantee the common fixed sections are bilingual and centered even when the
// legacy enhancement renderer survived an earlier runtime patch.
source = source.replace(
  /<div style="font-size:10px;letter-spacing:1\.2px;color:#08735a;font-weight:900">SADAQAH JARIYAH<\/div><div style="font-size:14px;line-height:1\.6;color:#31564c;font-weight:800;margin-top:5px">Hassoun is a Sadaqah Jariyah for Abdul Jalil Hassoun and Salwa Hassoun\. May Allah accept it and let its benefit continue\.<\/div>/g,
  '<div style="font-size:10px;letter-spacing:1.2px;color:#08735a;font-weight:900;text-align:center">SADAQAH JARIYAH • صدقة جارية</div><div dir="ltr" style="font-size:14px;line-height:1.6;color:#31564c;font-weight:800;margin-top:5px;text-align:center">Hassoun is a Sadaqah Jariyah for Abdul Jalil Hassoun and Salwa Hassoun. May Allah accept it and let its benefit continue.</div><div dir="rtl" style="font-size:14px;line-height:1.8;color:#31564c;font-weight:800;margin-top:7px;text-align:center">حسون صدقة جارية عن عبد الجليل حسون وسلمى حسون. نسأل الله أن يتقبله وأن يستمر نفعه.</div>'
);

// Final verification: a deployment must not succeed unless Arabic and centered
// bilingual rendering are physically present in the generated Worker source.
const hasArabic = source.includes('الحديث اليومي') && source.includes('القرآن اليومي') && source.includes('صدقة جارية');
const hasCentered = source.includes('text-align:center');
const hasBilingualCard = source.includes('function bilingualContentCard(') || (source.includes('function contentCard(') && source.includes('dir="rtl"'));
if (!hasArabic || !hasCentered || !hasBilingualCard) {
  throw new Error(`Bilingual email verification failed: arabic=${hasArabic} centered=${hasCentered} bilingualCard=${hasBilingualCard}`);
}

writeFileSync(path, source);
console.log('Verified bilingual English+Arabic mixed sections and centered email output.');
