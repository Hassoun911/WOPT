"use client";

const EVENTS = [
  [1,1,"🌙","Islamic New Year","The first day of Muharram and the beginning of a new Hijri year."],
  [1,10,"🤲","Day of Ashura","The 10th of Muharram, a significant day of fasting and remembrance."],
  [3,12,"✨","12 Rabi al-Awwal","A date widely associated with the birth of Prophet Muhammad ﷺ."],
  [7,27,"🌌","Isra & Mi'raj","A traditional date remembering the Night Journey and Ascension."],
  [8,15,"🌕","Mid-Sha'ban","The middle of Sha'ban, observed in different ways across Muslim communities."],
  [9,1,"🏮","Ramadan Begins","The beginning of the blessed month of fasting, Qur'an and worship."],
  [9,27,"⭐","Laylat al-Qadr (27th night)","A commonly highlighted night within the last ten nights of Ramadan."],
  [10,1,"🎉","Eid al-Fitr","The celebration marking the completion of Ramadan."],
  [12,8,"🕋","Hajj Days Begin","The 8th of Dhul-Hijjah, the beginning of the central days of Hajj."],
  [12,9,"🤍","Day of Arafah","The 9th of Dhul-Hijjah and the greatest day of Hajj."],
  [12,10,"🕌","Eid al-Adha","The Festival of Sacrifice on the 10th of Dhul-Hijjah."],
] as const;

const HIJRI_EPOCH = 1948439.5;
function gregorianToJulianDay(year:number, month:number, day:number){let y=year,m=month;if(m<=2){y-=1;m+=12;}const a=Math.floor(y/100),b=2-a+Math.floor(a/4);return Math.floor(365.25*(y+4716))+Math.floor(30.6001*(m+1))+day+b-1524.5;}
function islamicToJulianDay(year:number, month:number, day:number){return day+Math.ceil(29.5*(month-1))+(year-1)*354+Math.floor((3+11*year)/30)+HIJRI_EPOCH-1;}
function hijriParts(date:Date){const jd=Math.floor(gregorianToJulianDay(date.getUTCFullYear(),date.getUTCMonth()+1,date.getUTCDate())+1)+0.5;const year=Math.floor((30*(jd-HIJRI_EPOCH)+10646)/10631);const month=Math.min(12,Math.max(1,Math.ceil((jd-(29+islamicToJulianDay(year,1,1)))/29.5)+1));const day=Math.max(1,Math.floor(jd-islamicToJulianDay(year,month,1)+1));return {year,month,day};}
function occurrences(year:number){const found:{date:Date;emoji:string;name:string;description:string;hijri:string}[]=[];for(let t=Date.UTC(year,0,1,12);t<Date.UTC(year+1,0,1,12);t+=86400000){const date=new Date(t);const h=hijriParts(date);for(const [m,d,emoji,name,description] of EVENTS){if(h.month===m&&h.day===d)found.push({date,emoji,name,description,hijri:`${d}/${m}/${h.year} AH`});}}return found;}

export default function EventsPage(){
  const now=new Date();
  const all=[...occurrences(now.getUTCFullYear()),...occurrences(now.getUTCFullYear()+1)].filter(e=>e.date.getTime()>=Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate())).slice(0,12);
  return <main className="parity-page"><section className="parity-hero"><div><div className="eyebrow">ISLAMIC CALENDAR</div><h1>Islamic events</h1><p>The same core Hijri event calendar used by the Android app.</p></div><div className="hero-badge">🌙</div></section><section className="event-list">{all.map((event)=>{const days=Math.max(0,Math.round((event.date.getTime()-Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate()))/86400000));return <article className="event-card" key={`${event.name}-${event.date.toISOString()}`}><div className="event-emoji">{event.emoji}</div><div className="event-body"><div className="event-top"><h2>{event.name}</h2><span>{days===0?"Today":`${days}d`}</span></div><p>{event.description}</p><small>{event.date.toLocaleDateString("en-CA",{weekday:"short",month:"long",day:"numeric",year:"numeric"})} • {event.hijri}</small></div></article>})}</section></main>;
}
