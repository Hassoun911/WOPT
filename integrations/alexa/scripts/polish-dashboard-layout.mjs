import fs from 'node:fs';

const lambdaPath = 'integrations/alexa/lambda/index.mjs';
let text = fs.readFileSync(lambdaPath, 'utf8');
const start = text.indexOf('const prayerTile = ');
const end = text.indexOf('\nfunction supportsAPL', start);
if (start < 0 || end < 0) throw new Error('Alexa dashboard section not found');

const T=(textValue,left,top,width,size,color='#FFFFFF',weight=700,extra={})=>({type:'Text',position:'absolute',left:`${left}dp`,top:`${top}dp`,width:`${width}dp`,text:textValue,fontSize:`${size}dp`,fontWeight:weight,color,maxLines:1,...extra});
const F=(left,top,width,height,color,radius=18,extra={})=>({type:'Frame',position:'absolute',left:`${left}dp`,top:`${top}dp`,width:`${width}dp`,height:`${height}dp`,backgroundColor:color,borderRadius:`${radius}dp`,...extra});

const arabic={fajr:'الفجر',dhuhr:'الظهر',asr:'العصر',maghrib:'المغرب',isha:'العشاء'};
const english={fajr:'Fajr',dhuhr:'Dhuhr',asr:'Asr',maghrib:'Maghrib',isha:'Isha'};
const icons={fajr:'☾',dhuhr:'☀',asr:'☀',maghrib:'◒',isha:'☾'};
const iconColors={fajr:'#F4E09A',dhuhr:'#D8A72E',asr:'#D8A72E',maghrib:'#E97728',isha:'#6B58D9'};
const tileX={fajr:40,dhuhr:224,asr:408,maghrib:592,isha:776};
const prayerItems=[];
for(const key of ['fajr','dhuhr','asr','maghrib','isha']){
  const x=tileX[key];
  const active=`\${hassounData.nextPrayer.prayer == '${key}'}`;
  prayerItems.push(F(x,420,144,108,`${active} ? '#19A08F' : '#FFFDF8'`,18,{borderWidth:'1dp',borderColor:`${active} ? '#19A08F' : '#E7DED2'`}));
  prayerItems.push(T(english[key],x+18,438,90,17,`${active} ? '#FFFFFF' : '#0B5960'`,700));
  prayerItems.push(T(arabic[key],x+18,465,90,14,`${active} ? '#FFFFFF' : '#0B5960'`,700));
  prayerItems.push(T(`\${hassounData.prayers.${key}.displayTime}`,x+18,493,105,20,`${active} ? '#FFFFFF' : '#0B5960'`,700));
  prayerItems.push(T(icons[key],x+104,438,24,22,iconColors[key],700,{textAlign:'center'}));
}

const apl={
  type:'APL',version:'2024.3',theme:'light',
  mainTemplate:{parameters:['hassounData'],items:[{
    type:'Frame',width:'100vw',height:'100vh',backgroundColor:'#F7F2E8',item:{
      type:'Container',width:'960dp',height:'600dp',items:[
        // Header
        F(40,32,48,48,'#1AA896',24),
        T('H',40,40,48,28,'#FFFFFF',700,{textAlign:'center'}),
        T('HASSOUN',104,35,250,30,'#0D6B66',700),
        T('Prayer Dashboard',104,69,220,16,'#9AA7A4',500),
        T('⌖',612,44,20,16,'#0D6B66',700,{textAlign:'center'}),
        T('${hassounData.location}',640,39,190,18,'#0C555E',700),
        T('${hassounData.dateLabel}',640,66,210,13,'#9AA7A4',500),
        T('${hassounData.hijriDate}',640,87,210,13,'#10BCA8',600),
        T('☾',860,34,42,30,'#F1D74F',700,{textAlign:'center'}),
        T('${hassounData.weatherTemp}',842,78,76,14,'#647876',700,{textAlign:'center',when:"${hassounData.weatherTemp != ''}"}),
        T('${hassounData.weatherLabel}',838,96,84,11,'#9AA7A4',500,{textAlign:'center',when:"${hassounData.weatherLabel != ''}"}),

        // Main next prayer card
        F(40,116,520,272,'#18A392',22),
        T('NEXT PRAYER',76,148,180,13,'#F4FFFD',700,{letterSpacing:2}),
        T('☾',500,146,28,24,'#FAEA73',700,{textAlign:'center'}),
        T('${hassounData.nextPrayer.name}',76,188,300,43,'#FFFFFF',700),
        T('${hassounData.nextPrayer.arabicName}',76,247,300,27,'#FFFFFF',700),
        T('${hassounData.nextPrayer.displayTime}',76,291,250,27,'#FFFFFF',700),
        F(64,332,300,46,'#118575',23),
        T('◷',82,342,28,21,'#F5D83C',700,{textAlign:'center'}),
        T('${hassounData.nextPrayer.timeUntil}',120,338,205,17,'#FFFFFF',700),
        T('until Adhan',120,359,170,12,'#FFFFFF',500),

        // subtle mosque silhouette
        F(397,234,82,104,'#FFFFFF',16,{opacity:0.12}),
        F(368,272,22,66,'#FFFFFF',11,{opacity:0.12}),
        F(486,272,22,66,'#FFFFFF',11,{opacity:0.12}),
        F(426,207,24,30,'#FFFFFF',12,{opacity:0.12}),
        F(423,193,30,18,'#FFFFFF',15,{opacity:0.12}),
        F(426,300,24,38,'#0D7A6D',12,{opacity:0.25}),
        F(376,258,7,14,'#FFFFFF',4,{opacity:0.18}),
        F(494,258,7,14,'#FFFFFF',4,{opacity:0.18}),
        F(380,184,118,64,'transparent',56,{borderWidth:'8dp',borderColor:'#78D2C8',opacity:0.45}),

        // right cards
        F(590,132,330,112,'#FFFDF8',18,{borderWidth:'1dp',borderColor:'#E7DED2'}),
        T('TODAY',612,151,130,12,'#8A9693',700,{letterSpacing:2}),
        T('${hassounData.dateLabel}',612,180,245,18,'#0D5960',700),
        T('${hassounData.hijriDate}',612,209,245,14,'#12B6A2',500),
        T('▣',868,151,28,22,'#C5D1CE',700,{textAlign:'center'}),

        F(590,262,330,112,'#FFFDF8',18,{borderWidth:'1dp',borderColor:'#E7DED2'}),
        T('NEXT ISLAMIC EVENT',612,281,230,12,'#8A9693',700,{letterSpacing:2}),
        T('${hassounData.eventName}',612,311,230,19,'#0D5960',700),
        T('${hassounData.eventWhen}',612,341,210,14,'#7B8785',500),
        T('♜',866,283,28,24,'#E0B532',700,{textAlign:'center'}),

        ...prayerItems,

        T('Closer to what matters.',40,556,300,20,'#0D8A7B',400,{fontStyle:'italic'}),
        T('—  FAITH  |  FAMILY  |  COMMUNITY',650,562,270,10,'#C4CECB',500,{textAlign:'right',letterSpacing:1.2})
      ]
    }
  }]}
};

const dashboardCode=`const HASSOUN_DASHBOARD = ${JSON.stringify(apl,null,2)};\n`;
text=text.slice(0,start)+dashboardCode+text.slice(end+1);
text=text.replace('return new Intl.DateTimeFormat("en-CA", { weekday: "long", month: "long", day: "numeric" }).format(new Date(`${dateKey}T12:00:00Z`));','return new Intl.DateTimeFormat("en-CA", { weekday: "long", month: "long", day: "numeric", year: "numeric" }).format(new Date(`${dateKey}T12:00:00Z`));');
if(!text.includes('arabicName: ({ fajr: "الفجر"')) text=text.replace('nextPrayer: {\n      ...next,','nextPrayer: {\n      ...next,\n      arabicName: ({ fajr: "الفجر", dhuhr: "الظهر", asr: "العصر", maghrib: "المغرب", isha: "العشاء" })[next.prayer] || "الصلاة",');
if(!text.includes('weatherTemp:')) text=text.replace('hijriDate: data.hijriDate || "",','hijriDate: data.hijriDate || "",\n    weatherTemp: data.weather?.temperature || data.weatherTemp || "",\n    weatherLabel: data.weather?.label || data.weatherLabel || "",');
fs.writeFileSync(lambdaPath,text);
console.log('Applied native 960x600 Hassoun Alexa dashboard; no external image dependency.');
