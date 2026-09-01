import fs from 'node:fs';

const path = 'src/masjidDisplays.ts';
let source = fs.readFileSync(path, 'utf8');

if (!source.includes('function instructionalIqamaRows(')) {
  const marker = 'function flexibleAiRows(';
  const helper = `function instructionalIqamaRows(text:string){\n  if(!/(?:IQAMA|IQAMAH).*ONLY|ONLY.*(?:IQAMA|IQAMAH)|APPLY[\\s\\S]{0,100}(?:IQAMA|IQAMAH)/i.test(text))return[];\n  const year=yearFromText(text),defaultMonth=monthFromText(text);const map=new Map<string,Record<string,unknown>>();\n  for(const raw of text.replace(/\\r/g,'').split('\\n')){if(!raw.includes('|'))continue;const cells=raw.split('|').map(x=>x.trim()).filter(Boolean);if(cells.length<6)continue;if(/DATE|FAJR|DHUHR|ASR|MAGHRIB|ISHA/i.test(cells[0])||/^:?-{2,}/.test(cells[0]))continue;const date=flexibleDate(cells[0],year,defaultMonth);if(!date)continue;const vals=cells.slice(1,6);if(vals.length<5)continue;const row=emptyRow(date);row.fajrIqama=prayerClock(vals[0]||'','fajr');row.dhuhrIqama=prayerClock(vals[1]||'','dhuhr');row.asrIqama=prayerClock(vals[2]||'','asr');row.maghribIqama=/SUNSET/i.test(vals[3]||'')?'SUNSET':prayerClock(vals[3]||'','maghrib');row.ishaIqama=prayerClock(vals[4]||'','isha');row.confidence=.999;mergeRow(map,row);}\n  return[...map.values()].sort((a,b)=>String(a.date).localeCompare(String(b.date)));\n}\n`;
  if (!source.includes(marker)) throw new Error('flexibleAiRows marker not found');
  source = source.replace(marker, helper + marker);
}

const start = 'async function extractSchedule(ai:AiBinding,text:string){const map=new Map<string,Record<string,unknown>>();';
const replacement = "async function extractSchedule(ai:AiBinding,text:string){const map=new Map<string,Record<string,unknown>>();const iqamaOnly=/(?:IQAMA|IQAMAH).*ONLY|ONLY.*(?:IQAMA|IQAMAH)|APPLY[\\s\\S]{0,100}(?:IQAMA|IQAMAH)/i.test(text);if(iqamaOnly){for(const row of instructionalIqamaRows(text))mergeRow(map,row);if(map.size)return[...map.values()].sort((a,b)=>String(a.date).localeCompare(String(b.date))).slice(0,370);}";
if (source.includes(start)) source = source.replace(start, replacement);
else if (!source.includes('const iqamaOnly=/(?:IQAMA|IQAMAH).*ONLY')) throw new Error('extractSchedule marker not found');

fs.writeFileSync(path, source);
console.log('Applied instruction-aware Iqama-only schedule parser.');
