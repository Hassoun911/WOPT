import fs from 'node:fs';

const lambdaPath = 'integrations/alexa/lambda/index.mjs';
let text = fs.readFileSync(lambdaPath, 'utf8');
const start = text.indexOf('const prayerTile = ');
const end = text.indexOf('\nfunction supportsAPL', start);
if (start < 0 || end < 0) throw new Error('Alexa dashboard section not found');

const BG_URL = 'https://raw.githubusercontent.com/Hassoun911/WOPT/main/integrations/alexa/assets/alexa-dashboard-approved-960x600%20(1).png?raw=1';
const T=(textValue,left,top,width,size,color='#FFFFFF',weight=700,extra={})=>({type:'Text',position:'absolute',left:`${left}dp`,top:`${top}dp`,width:`${width}dp`,text:textValue,fontSize:`${size}dp`,fontWeight:weight,color,maxLines:1,...extra});

const apl={type:'APL',version:'2024.3',theme:'light',mainTemplate:{parameters:['hassounData'],items:[{type:'Container',width:'960dp',height:'600dp',items:[
  {type:'Image',position:'absolute',left:'0dp',top:'0dp',width:'960dp',height:'600dp',source:BG_URL,scale:'best-fill',align:'center'},
  T('${hassounData.location}',640,39,190,18,'#0C555E',700),
  T('${hassounData.dateLabel}',640,66,210,13,'#9AA7A4',500),
  T('${hassounData.hijriDate}',640,87,210,13,'#10BCA8',600),
  T('${hassounData.nextPrayer.name}',76,188,300,43,'#FFFFFF',700),
  T('${hassounData.nextPrayer.arabicName}',76,247,300,27,'#FFFFFF',700),
  T('${hassounData.nextPrayer.displayTime}',76,291,250,27,'#FFFFFF',700),
  T('${hassounData.nextPrayer.timeUntil}',120,338,205,17,'#FFFFFF',700),
  T('${hassounData.dateLabel}',612,180,270,18,'#0D5960',700),
  T('${hassounData.hijriDate}',612,209,245,14,'#12B6A2',500),
  T('${hassounData.eventName}',612,311,230,19,'#0D5960',700),
  T('${hassounData.eventWhen}',612,341,210,14,'#7B8785',500)
]}]}};

const dashboardCode=`const HASSOUN_DASHBOARD = ${JSON.stringify(apl,null,2)};\n`;
text=text.slice(0,start)+dashboardCode+text.slice(end+1);
text=text.replace('return new Intl.DateTimeFormat("en-CA", { weekday: "long", month: "long", day: "numeric" }).format(new Date(`${dateKey}T12:00:00Z`));','return new Intl.DateTimeFormat("en-CA", { weekday: "long", month: "long", day: "numeric", year: "numeric" }).format(new Date(`${dateKey}T12:00:00Z`));');
if(!text.includes('arabicName: ({ fajr: "الفجر"')) text=text.replace('nextPrayer: {\n      ...next,','nextPrayer: {\n      ...next,\n      arabicName: ({ fajr: "الفجر", dhuhr: "الظهر", asr: "العصر", maghrib: "المغرب", isha: "العشاء" })[next.prayer] || "الصلاة",');
fs.writeFileSync(lambdaPath,text);
console.log('Applied exact approved 960x600 PNG background with live overlays.');
