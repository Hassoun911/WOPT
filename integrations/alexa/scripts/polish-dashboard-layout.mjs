import fs from 'node:fs';

const lambdaPath = 'integrations/alexa/lambda/index.mjs';
let text = fs.readFileSync(lambdaPath, 'utf8');
const start = text.indexOf('const prayerTile = ');
const end = text.indexOf('\nfunction supportsAPL', start);
if (start < 0 || end < 0) throw new Error('Alexa dashboard section not found');

const BG_URL = 'https://raw.githubusercontent.com/Hassoun911/WOPT/main/integrations/alexa/assets/ChatGPT%20Image%20Sep%2015%2C%202026%2C%2011_39_29%20PM.png?v=20260916-clean-final';
const T=(textValue,left,top,width,size,color='#FFFFFF',weight=700,extra={})=>({type:'Text',position:'absolute',left:`${left}dp`,top:`${top}dp`,width:`${width}dp`,text:textValue,fontSize:`${size}dp`,fontWeight:weight,color,maxLines:1,...extra});

const prayerMeta={
  fajr:{x:62,en:'Fajr',ar:'الفجر',color:'#FFFFFF'},
  dhuhr:{x:247,en:'Dhuhr',ar:'الظهر',color:'#0D5960'},
  asr:{x:419,en:'Asr',ar:'العصر',color:'#0D5960'},
  maghrib:{x:590,en:'Maghrib',ar:'المغرب',color:'#0D5960'},
  isha:{x:770,en:'Isha',ar:'العشاء',color:'#0D5960'}
};
const prayerItems=[];
for(const key of ['fajr','dhuhr','asr','maghrib','isha']){
  const p=prayerMeta[key];
  prayerItems.push(T(p.en,p.x,426,112,17,p.color,700));
  prayerItems.push(T(p.ar,p.x,452,112,14,p.color,600));
  prayerItems.push(T(`\${hassounData.prayers.${key}.displayTime}`,p.x,486,112,18,p.color,700));
}

const apl={type:'APL',version:'2024.3',theme:'light',mainTemplate:{parameters:['hassounData'],items:[{type:'Container',width:'960dp',height:'600dp',items:[
  {type:'Image',position:'absolute',left:'0dp',top:'0dp',width:'960dp',height:'600dp',source:BG_URL,scale:'best-fill',align:'center'},

  // Dynamic user/device prayer location — intentionally more prominent.
  T('${hassounData.location}',626,53,270,22,'#0C555E',700),
  T('${hassounData.dateLabel}',626,84,250,13,'#8A9996',600),
  T('${hassounData.hijriDate}',626,106,250,13,'#10BCA8',700),

  T('${hassounData.nextPrayer.name}',78,166,285,42,'#FFFFFF',700),
  T('${hassounData.nextPrayer.arabicName}',78,217,240,25,'#FFFFFF',700),
  T('${hassounData.nextPrayer.displayTime}',78,261,220,27,'#FFFFFF',700),
  T('${hassounData.nextPrayer.timeUntil}',105,321,270,16,'#FFFFFF',700,{textAlign:'center'}),
  T('until Adhan',105,343,270,12,'#FFFFFF',500,{textAlign:'center'}),

  T('${hassounData.dateLabel}',588,160,276,18,'#0D5960',700),
  T('${hassounData.hijriDate}',588,187,250,14,'#12B6A2',500),

  T('${hassounData.eventName}',588,289,230,19,'#0D5960',700),
  T('${hassounData.eventWhen}',588,317,210,14,'#7B8785',500),

  ...prayerItems
]}]}};

const dashboardCode=`const HASSOUN_DASHBOARD = ${JSON.stringify(apl,null,2)};\n`;
text=text.slice(0,start)+dashboardCode+text.slice(end+1);
text=text.replace('return new Intl.DateTimeFormat("en-CA", { weekday: "long", month: "long", day: "numeric" }).format(new Date(`${dateKey}T12:00:00Z`));','return new Intl.DateTimeFormat("en-CA", { weekday: "long", month: "long", day: "numeric", year: "numeric" }).format(new Date(`${dateKey}T12:00:00Z`));');
text=text.replace('location: data.location || "Windsor, Ontario",','location: data.city || data.location || "Prayer location",');
if(!text.includes('arabicName: ({ fajr: "الفجر"')) text=text.replace('nextPrayer: {\n      ...next,','nextPrayer: {\n      ...next,\n      arabicName: ({ fajr: "الفجر", dhuhr: "الظهر", asr: "العصر", maghrib: "المغرب", isha: "العشاء" })[next.prayer] || "الصلاة",');
fs.writeFileSync(lambdaPath,text);
console.log('Raised and enlarged dynamic Alexa city header; removed Windsor-only dashboard fallback.');
