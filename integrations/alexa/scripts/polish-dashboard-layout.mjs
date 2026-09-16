import fs from 'node:fs';

const lambdaPath = 'integrations/alexa/lambda/index.mjs';
let text = fs.readFileSync(lambdaPath, 'utf8');
const start = text.indexOf('const prayerTile = ');
const end = text.indexOf('\nfunction supportsAPL', start);
if (start < 0 || end < 0) throw new Error('Alexa dashboard section not found');

const BG_URL = 'https://raw.githubusercontent.com/Hassoun911/WOPT/main/integrations/alexa/assets/alexa-dashboard-approved-960x600.png?v=20260916-4';
const T=(textValue,left,top,width,size,color='#FFFFFF',weight=700,extra={})=>({type:'Text',position:'absolute',left:`${left}dp`,top:`${top}dp`,width:`${width}dp`,text:textValue,fontSize:`${size}dp`,fontWeight:weight,color,maxLines:1,...extra});
const F=(left,top,width,height,color,radius=0,extra={})=>({type:'Frame',position:'absolute',left:`${left}dp`,top:`${top}dp`,width:`${width}dp`,height:`${height}dp`,backgroundColor:color,borderRadius:`${radius}dp`,...extra});

const prayerTimeItems=[];
const tileTimes={fajr:{x:58,bg:'#1B9489',color:'#FFFFFF'},dhuhr:{x:242,bg:'#FBF7F1',color:'#0D5960'},asr:{x:426,bg:'#F9F6F0',color:'#0D5960'},maghrib:{x:610,bg:'#FBF7F1',color:'#0D5960'},isha:{x:794,bg:'#FFFDFC',color:'#0D5960'}};
for(const key of ['fajr','dhuhr','asr','maghrib','isha']){
  const c=tileTimes[key];
  prayerTimeItems.push(F(c.x-4,486,118,34,c.bg,0));
  prayerTimeItems.push(T(`\${hassounData.prayers.${key}.displayTime}`,c.x,491,108,20,c.color,700));
}

const apl={type:'APL',version:'2024.3',theme:'light',mainTemplate:{parameters:['hassounData'],items:[{type:'Container',width:'960dp',height:'600dp',items:[
{type:'Image',position:'absolute',left:'0dp',top:'0dp',width:'960dp',height:'600dp',source:BG_URL,scale:'best-fill',align:'center'},

// Remove the sample values baked into the approved artwork, while preserving the artwork itself.
F(632,31,218,79,'#FFFBF7',0),
F(602,168,266,63,'#FCF7EE',0),
F(602,299,250,62,'#FCF5E9',0),
F(66,178,286,67,'#15978E',0),
F(66,240,240,48,'#116C66',0),
F(66,286,210,39,'#116C66',0),
F(112,329,230,51,'#0F7D72',0),

// Live values, drawn once.
T('${hassounData.location}',640,39,190,18,'#0C555E',700),
T('${hassounData.dateLabel}',640,66,210,13,'#9AA7A4',500),
T('${hassounData.hijriDate}',640,87,210,13,'#10BCA8',600),

T('${hassounData.nextPrayer.name}',76,188,300,43,'#FFFFFF',700),
T('${hassounData.nextPrayer.arabicName}',76,247,300,27,'#FFFFFF',700),
T('${hassounData.nextPrayer.displayTime}',76,291,250,27,'#FFFFFF',700),
T('${hassounData.nextPrayer.timeUntil}',120,338,205,17,'#FFFFFF',700),
T('until Adhan',120,359,170,12,'#FFFFFF',500),

T('${hassounData.dateLabel}',612,180,270,18,'#0D5960',700),
T('${hassounData.hijriDate}',612,209,245,14,'#12B6A2',500),
T('${hassounData.eventName}',612,311,230,19,'#0D5960',700),
T('${hassounData.eventWhen}',612,341,210,14,'#7B8785',500),

...prayerTimeItems
]}]}};
const dashboardCode=`const HASSOUN_DASHBOARD = ${JSON.stringify(apl,null,2)};\n`;
text=text.slice(0,start)+dashboardCode+text.slice(end+1);
text=text.replace('return new Intl.DateTimeFormat("en-CA", { weekday: "long", month: "long", day: "numeric" }).format(new Date(`${dateKey}T12:00:00Z`));','return new Intl.DateTimeFormat("en-CA", { weekday: "long", month: "long", day: "numeric", year: "numeric" }).format(new Date(`${dateKey}T12:00:00Z`));');
if(!text.includes('arabicName: ({ fajr: "الفجر"')) text=text.replace('nextPrayer: {\n      ...next,','nextPrayer: {\n      ...next,\n      arabicName: ({ fajr: "الفجر", dhuhr: "الظهر", asr: "العصر", maghrib: "المغرب", isha: "العشاء" })[next.prayer] || "الصلاة",');
fs.writeFileSync(lambdaPath,text);
console.log('Applied exact approved 960x600 PNG background with clean live values and no duplicate sample text.');
