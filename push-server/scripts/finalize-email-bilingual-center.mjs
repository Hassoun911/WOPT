import { readFileSync, writeFileSync } from 'node:fs';

const path = new URL('../src/emailDelivery.ts', import.meta.url);
let source = readFileSync(path, 'utf8');

// The Email Center schema patch already generates bilingual cards. This final pass
// makes the generated output deterministic: true Arabic fallbacks and centered UI.
source = source.replace(
  'const arTitle = item.title_ar || item.title_en;',
  'const arTitle = item.title_ar || (item.content_type === "hadith" ? "الحديث اليومي" : item.content_type === "surah" ? "القرآن اليومي" : "تذكير اليوم");'
);
source = source.replace(
  'const arBody = item.body_ar || item.body_en;',
  'const arBody = item.body_ar || (item.content_type === "hadith" ? "علّمنا النبي ﷺ أن الأعمال بالنيات. جدّد نيتك واجعل يومك ذا معنى." : item.content_type === "surah" ? "يذكّرنا الله بأن مع العسر يسراً. واصل التقدم بالصبر والثقة." : "حافظ على صلاتك، وأكثر من ذكر الله، واجعل لك اليوم عملاً صالحاً يستمر نفعه.");'
);

// Center every visible part of the email, including English, Arabic, buttons,
// sponsor content, footer content, and inline images.
source = source.replaceAll('text-align:left', 'text-align:center');
source = source.replaceAll('text-align:right', 'text-align:center');
source = source.replaceAll('text-align:${textAlign}', 'text-align:center');
source = source.replaceAll('display:block;max-width:180px', 'display:block;margin:0 auto;max-width:180px');
source = source.replaceAll('display:block;border:0;border-radius:15px', 'display:block;margin:0 auto;border:0;border-radius:15px');
source = source.replaceAll('<td style="padding:14px">', '<td align="center" style="padding:14px;text-align:center">');
source = source.replaceAll('<td style="padding:15px">', '<td align="center" style="padding:15px;text-align:center">');

writeFileSync(path, source);
console.log('Finalized bilingual Arabic fallbacks and centered all email content.');
