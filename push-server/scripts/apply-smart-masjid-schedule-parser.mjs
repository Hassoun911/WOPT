import fs from 'node:fs';

const path = 'src/masjidDisplays.ts';
let source = fs.readFileSync(path, 'utf8');
const start = source.indexOf('async function extractSchedule(');
const end = source.indexOf('function scheduleWarnings', start);
if (start < 0 || end < 0) throw new Error('Could not locate schedule parser');

const replacement = String.raw`
const MONTHS:Record<string,number>={JANUARY:1,FEBRUARY:2,MARCH:3,APRIL:4,MAY:5,JUNE:6,JULY:7,AUGUST:8,SEPTEMBER:9,OCTOBER:10,NOVEMBER:11,DECEMBER:12,JAN:1,FEB:2,MAR:3,APR:4,JUN:6,JUL:7,AUG:8,SEP:9,SEPT:9,OCT:10,NOV:11,DEC:12};
function monthFromText(text:string){const upper=text.toUpperCase();for(const [name,num] of Object.entries(MONTHS)){if(new RegExp('\\b'+name+'\\b').test(upper))return num;}return 0;}
function yearFromText(text:string){const m=/\\b(20\\d{2})\\b/.exec(text);return m?Number(m[1]):new Date().getFullYear();}
function dateKeyFor(year:number,month:number,day:number){if(month<1||month>12||day<1||day>31)return'';return String(year)+'-'+String(month).padStart(2,'0')+'-'+String(day).padStart(2,'0');}
function prayerClock(raw:string,kind:'fajr'|'dhuhr'|'asr'|'maghrib'|'isha'){const m=/^(\\d{1,2}):(\\d{2})$/.exec(raw.trim());if(!m)return normalizeTime(raw);let h=Number(m[1]);const min=m[2];if(kind==='fajr')return String(h)+':'+min+' AM';return String(h)+':'+min+' PM';}
function parseStructuredMosqueSchedule(text:string){
  const month=monthFromText(text);if(!month)return[] as Array<Record<string,unknown>>;
  const year=yearFromText(text);
  const upper=text.toUpperCase();const iqIndex=upper.indexOf('IQAMAH TIMINGS');
  const prayerText=iqIndex>=0?text.slice(0,iqIndex):text;
  const iqText=iqIndex>=0?text.slice(iqIndex):'';
  const map=new Map<string,Record<string,unknown>>();
  const dayRe=/^\\s*(\\d{1,2})\\s+.*?\\b(SAT|SUN|MON|TUE|WED|THU|FRI)\\b\\s+(\\d{1,2}:\\d{2})\\s+(\\d{1,2}:\\d{2})\\s+(\\d{1,2}:\\d{2})\\s+(\\d{1,2}:\\d{2})\\s+(\\d{1,2}:\\d{2})\\s+(\\d{1,2}:\\d{2})\\s*$/i;
  for(const line of prayerText.split(/\\r?\\n/)){
    const m=dayRe.exec(line);if(!m)continue;const day=Number(m[1]),date=dateKeyFor(year,month,day);if(!date)continue;
    map.set(date,{date,fajr:prayerClock(m[3],'fajr'),fajrIqama:'',dhuhr:prayerClock(m[5],'dhuhr'),dhuhrIqama:'',asr:prayerClock(m[6],'asr'),asrIqama:'',maghrib:prayerClock(m[7],'maghrib'),maghribIqama:'',isha:prayerClock(m[8],'isha'),ishaIqama:'',confidence:.99});
  }
  const iqRe=/^\\s*(?:[A-Z]{3,12},?\\s+)?(\\d{1,2})\\s+(\\d{1,2}:\\d{2})\\s+(\\d{1,2}:\\d{2})\\s+(\\d{1,2}:\\d{2})\\s+(SUNSET|\\d{1,2}:\\d{2})\\s+(\\d{1,2}:\\d{2})\\s*$/i;
  for(const line of iqText.split(/\\r?\\n/)){
    const m=iqRe.exec(line);if(!m)continue;const date=dateKeyFor(year,month,Number(m[1]));const row=map.get(date);if(!row)continue;
    row.fajrIqama=prayerClock(m[2],'fajr');row.dhuhrIqama=prayerClock(m[3],'dhuhr');row.asrIqama=prayerClock(m[4],'asr');row.maghribIqama=/SUNSET/i.test(m[5])?String(row.maghrib||''):prayerClock(m[5],'maghrib');row.ishaIqama=prayerClock(m[6],'isha');
  }
  return [...map.values()].sort((a,b)=>String(a.date).localeCompare(String(b.date)));
}
async function extractSchedule(ai:AiBinding,text:string){
  const structured=parseStructuredMosqueSchedule(text);if(structured.length>=3)return structured.slice(0,370);
  const chunks:string[]=[];const max=16000;for(let i=0;i<text.length&&chunks.length<30;i+=max)chunks.push(text.slice(i,i+max));const map=new Map<string,Record<string,unknown>>();
  const fallbackYear=yearFromText(text),fallbackMonth=monthFromText(text);
  for(let i=0;i<chunks.length;i++){
    const prompt=`Extract mosque prayer schedule rows from this document chunk. Return ONLY JSON array rows, no markdown. Each row MUST be exactly [date,fajrAdhan,fajrIqama,dhuhrAdhan,dhuhrIqama,asrAdhan,asrIqama,maghribAdhan,maghribIqama,ishaAdhan,ishaIqama,confidence]. Date must be YYYY-MM-DD. The document may have separate PRAYER TIMINGS and IQAMAH TIMINGS tables: merge them by Gregorian day/date. Ignore Sunrise/Shuruq. If Maghrib Iqama says Sunset, use that day's Maghrib Adhan time. Infer AM/PM from prayer context: Fajr is AM; Dhuhr, Asr, Maghrib and Isha are normally PM. If the Gregorian year is omitted, use ${fallbackYear}. If the month is only in a heading, apply month ${fallbackMonth||'shown in the document'} to following day numbers. Do not invent missing prayer values. Understand Salah/Prayer, Adhan/Azan/Athan, Iqama/Iqamah/Jamaat. confidence is 0 to 1. Document chunk ${i+1}/${chunks.length}:\\n${chunks[i]}`;
    try{const result=await ai.run('@cf/meta/llama-3.1-8b-instruct',{messages:[{role:'system',content:'You convert mosque prayer timetables into strict structured JSON. Merge separate adhan and iqama tables by date. Never invent prayer times.'},{role:'user',content:prompt}],max_tokens:6500,temperature:.05}) as {response?:string};for(const row of rowsFromAi(String(result?.response||''))){const date=String(row.date);const old=map.get(date);if(!old||Number(row.confidence||0)>Number(old.confidence||0))map.set(date,row);}}catch(error){console.error('Schedule chunk parse failed',i,error)}
  }
  return [...map.values()].sort((a,b)=>String(a.date).localeCompare(String(b.date))).slice(0,370);
}
`;

source = source.slice(0, start) + replacement + source.slice(end);
fs.writeFileSync(path, source);
console.log('Applied smart mosque schedule parser with direct monthly-table support.');
