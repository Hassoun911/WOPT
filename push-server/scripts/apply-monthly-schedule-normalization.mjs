import fs from 'node:fs';

const path='src/masjidDisplays.ts';
let source=fs.readFileSync(path,'utf8');

if(!source.includes('function normalizeScheduleMarkdown(')){
  const marker='function flexibleAiRows(';
  const helper=`function normalizeScheduleMarkdown(text:string){\n  return text.replace(/!\\[[^\\]]*\\]\\([^)]*\\)/g,' ').replace(/\\[image\\]\\([^)]*\\)/gi,' ').replace(/\\*\\*/g,'').replace(/__/g,'').replace(/<br\\s*\\/?\\s*>/gi,' ').replace(/\\u00a0/g,' ');\n}\nfunction carryForwardIqama(rows:Array<Record<string,unknown>>){\n  const sorted=[...rows].sort((a,b)=>String(a.date).localeCompare(String(b.date)));let current:Record<string,string>={};\n  for(const row of sorted){const next={fajr:String(row.fajrIqama||''),dhuhr:String(row.dhuhrIqama||''),asr:String(row.asrIqama||''),maghrib:String(row.maghribIqama||''),isha:String(row.ishaIqama||'')};\n    if(Object.values(next).some(Boolean))current={...current,...Object.fromEntries(Object.entries(next).filter(([,v])=>v))};\n    for(const p of ['fajr','dhuhr','asr','maghrib','isha']){const k=p+'Iqama';if(!String(row[k]||'')&&current[p])row[k]=current[p];}\n    if(String(row.maghribIqama||'').toUpperCase()==='SUNSET'&&row.maghrib)row.maghribIqama=row.maghrib;\n  }return sorted;\n}\n`;
  if(!source.includes(marker))throw new Error('flexibleAiRows marker not found');
  source=source.replace(marker,helper+marker);
}

const extractStart='async function extractSchedule(ai:AiBinding,text:string){';
if(source.includes(extractStart)&&!source.includes('text=normalizeScheduleMarkdown(text);'))source=source.replace(extractStart,extractStart+'text=normalizeScheduleMarkdown(text);');

source=source.replace("if(map.size>=3)return[...map.values()].sort((a,b)=>String(a.date).localeCompare(String(b.date))).slice(0,370);","if(map.size>=3)return carryForwardIqama([...map.values()]).slice(0,370);");
source=source.replace("return[...map.values()].sort((a,b)=>String(a.date).localeCompare(String(b.date))).slice(0,370);}","return carryForwardIqama([...map.values()]).slice(0,370);}");

fs.writeFileSync(path,source);
console.log('Applied markdown normalization and effective-date Iqama carry-forward.');
