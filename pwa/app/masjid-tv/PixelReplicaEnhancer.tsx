"use client";

import { useEffect } from "react";

const STORAGE="hassoun:web-masjid-tv:v2";
const text=(el:Element|null)=>(el?.textContent||"").trim();
const esc=(s:string)=>s.replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]||c));
const ARABIC=["الفجر","الظهر","العصر","المغرب","العشاء"];
const ICONS=["🌅","☀️","🌤️","🌇","🌙"];
const HIJRI_MONTHS=["Muharram","Safar","Rabi’ al-Awwal","Rabi’ al-Thani","Jumada al-Awwal","Jumada al-Thani","Rajab","Sha’ban","Ramadan","Shawwal","Dhul Qa’dah","Dhul Hijjah"];
function settings(){try{return JSON.parse(localStorage.getItem(STORAGE)||"{}") as Record<string,any>}catch{return {}}}
function hijri(now=new Date()){
  try{const p=new Intl.DateTimeFormat("en-u-ca-islamic",{day:"numeric",month:"numeric",year:"numeric"}).formatToParts(now);const n=(t:string)=>Number(p.find(x=>x.type===t)?.value||0);const d=n("day"),m=n("month"),y=n("year");return d&&y?`${d} ${HIJRI_MONTHS[Math.max(0,Math.min(11,m-1))]} ${y} AH`:""}catch{return ""}
}

export default function PixelReplicaEnhancer(){
 useEffect(()=>{
  let lastDataKey="";
  const sync=()=>{
   const shell=document.querySelector<HTMLElement>(".webtv-shell.layout-grand");
   const source=document.querySelector<HTMLElement>(".template-grand");
   if(!shell||!source){document.querySelector(".pixel-replica-one")?.remove();lastDataKey="";return}
   let root=shell.querySelector<HTMLElement>(".pixel-replica-one");
   if(!root){root=document.createElement("section");root.className="pixel-replica-one";root.style.background="#012f29";root.style.overflow="hidden";shell.appendChild(root);root.addEventListener("click",e=>{if((e.target as Element).closest(".px-clock-hotspot"))(source.querySelector(".tv-clock") as HTMLButtonElement|null)?.click()})}

   const s=settings();
   const mosque=text(source.querySelector(".tv-brand strong"))||"YOUR MASJID NAME";
   const location=text(source.querySelector(".tv-brand small"))||"MOSQUE LOCATION NOT SET";
   const sourceLogo=source.querySelector<HTMLImageElement>(".tv-brand img")?.src||"";
   const clock=text(source.querySelector(".tv-clock"));
   const dates=[...source.querySelectorAll(".tv-dates span")].map(text);
   const gregorian=dates[0]||new Date().toLocaleDateString(undefined,{weekday:"long",month:"long",day:"numeric",year:"numeric"});
   const hijriText=s.showHijriDate===false?"":hijri();
   const verse=text(source.querySelector(".header-verse"))||"Indeed, in the remembrance of Allah do hearts find rest.";
   const nextEn=text(source.querySelector(".next-name strong"))||"Fajr";
   const nextTime=text(source.querySelector(".next-time b"))||"—";
   const nextIqama=text(source.querySelector(".next-time small")).replace(/^Iqama\s*/i,"")||"—";
   const rows=[...source.querySelectorAll(".tv-prayer-table .table-row")].slice(0,5).map((r,i)=>({name:(text(r.querySelector("strong")).match(/Fajr|Dhuhr|Asr|Maghrib|Isha/i)?.[0]||["Fajr","Dhuhr","Asr","Maghrib","Isha"][i]),adhan:text(r.querySelector("b:not(.iqama)")),iqama:text(r.querySelector("b.iqama"))||"—"}));
   const anns=[...source.querySelectorAll(".tv-announcements article")].slice(0,3).map(a=>({title:text(a.querySelector("strong")),body:text(a.querySelector("p"))}));
   const websiteRaw=text(source.querySelector(".tv-donation strong"));
   const website=!websiteRaw||/Add donation|website link in setup/i.test(websiteRaw)?"Add link in Studio":websiteRaw;
   const jumuah=Array.isArray(s.jumuah)?s.jumuah.filter((j:any)=>String(j?.time||"").trim()).slice(0,2):[];
   const jumuahText=jumuah.length?jumuah.map((j:any)=>`${String(j.label||"Jumu’ah")} · ${String(j.time)}`).join("   •   "):"Jumu’ah time not set";
   const dataKey=JSON.stringify({mosque,location,sourceLogo,gregorian,hijriText,verse,nextEn,nextTime,nextIqama,rows,anns,website,jumuahText});
   if(dataKey===lastDataKey){const n=root.querySelector<HTMLElement>("#grand-live-clock");if(n&&n.textContent!==clock)n.textContent=clock;return}
   lastDataKey=dataKey;

   const rowHtml=rows.map((r,i)=>`<div style="height:18%;border-top:1px solid rgba(165,138,76,.34);position:relative;color:#f7f4eb"><span style="position:absolute;left:3%;top:31%;font-size:1.35vw">${ICONS[i]}</span><div style="position:absolute;left:11%;top:16%;width:31%;line-height:1.05"><strong style="display:block;font-size:1.18vw;font-family:Arial,Helvetica,sans-serif">${esc(r.name)}</strong><span dir="rtl" lang="ar" style="display:block;margin-top:.16vw;color:#e6c468;font-size:1.28vw;font-family:'Aref Ruqaa','Amiri','Scheherazade New','Noto Naskh Arabic',serif;font-weight:700">${ARABIC[i]}</span></div><span style="position:absolute;left:51%;top:36%;font-size:1.12vw;font-weight:600">${esc(r.adhan)}</span><span style="position:absolute;left:79%;top:36%;font-size:1.12vw;font-weight:700;color:#83d49d">${esc(r.iqama)}</span></div>`).join("");
   const annIcons=["📖","📣","🤲"];
   const annHtml=anns.map((a,i)=>`<div style="position:relative;height:26%;border-top:${i===0?'0':'1px solid rgba(165,138,76,.28)'}"><div style="position:absolute;left:2%;top:25%;width:2.8vw;height:2.8vw;border:1px solid #a58a4c;border-radius:50%;text-align:center;line-height:2.8vw;font-size:1.25vw">${annIcons[i]||"✨"}</div><strong style="position:absolute;left:12%;top:21%;color:#f7f4eb;font-size:1vw">${esc(a.title||"Announcement")}</strong><span style="position:absolute;left:12%;top:53%;color:#c8d5cf;font-size:.78vw">${esc(a.body||"")}</span></div>`).join("");
   const logoHtml=sourceLogo?`<img src="${esc(sourceLogo)}" alt="Masjid logo" style="position:absolute;left:3.6%;top:2.6%;width:7.2%;height:11.8%;object-fit:contain">`:`<div style="position:absolute;left:4.2%;top:4%;font-size:4.6vw;color:#d7b873">🕌</div>`;

   root.innerHTML=`<div style="position:absolute;inset:0;background:#012f29;color:#f7f4eb;font-family:Arial,Helvetica,sans-serif;overflow:hidden"><div style="position:absolute;inset:0;opacity:.18;background-image:linear-gradient(45deg,rgba(11,101,83,.35) 25%,transparent 25%),linear-gradient(-45deg,rgba(11,101,83,.35) 25%,transparent 25%),linear-gradient(45deg,transparent 75%,rgba(11,101,83,.35) 75%),linear-gradient(-45deg,transparent 75%,rgba(11,101,83,.35) 75%);background-size:54px 54px;background-position:0 0,0 27px,27px -27px,-27px 0"></div>${logoHtml}<div style="position:absolute;left:4.3%;top:14.6%;font-family:Georgia,serif;font-size:1.75vw;font-weight:700;white-space:nowrap">${esc(mosque)}</div><div style="position:absolute;left:4.4%;top:18.4%;color:#d9b36b;font-size:.68vw;letter-spacing:.2em;text-transform:uppercase">${esc(location)}</div><div id="grand-live-clock" style="position:absolute;left:31%;top:3.1%;width:38%;text-align:center;font-size:4.7vw;line-height:1;font-weight:500;letter-spacing:-.04em;white-space:nowrap">${esc(clock)}</div><div style="position:absolute;left:28%;top:14.3%;width:44%;text-align:center;font-size:.92vw">${esc(gregorian)}${hijriText?` <span style="color:#e6c468">| ${esc(hijriText)}</span>`:""}</div><div style="position:absolute;right:4.3%;top:4.3%;width:28%;text-align:right;color:#d9b36b;font-family:'Amiri','Scheherazade New',serif;font-size:1.5vw">📖 وَأَقِيمُوا الصَّلَاةَ وَآتُوا الزَّكَاةَ</div><div style="position:absolute;right:4.3%;top:9.7%;width:29%;text-align:right;color:#f7f4eb;font-size:.86vw;line-height:1.4">${esc(verse)}</div><div style="position:absolute;left:4%;top:22%;width:92%;height:11.5%;background:#033a31;border:1px solid #a58a4c;border-radius:18px"><div style="position:absolute;left:17%;top:24%;width:3.4vw;height:3.4vw;border:1px solid #a58a4c;border-radius:50%;text-align:center;line-height:3.4vw;font-size:1.55vw">🕋</div><div style="position:absolute;left:23%;top:18%;color:#d9b36b;font-size:.9vw">NEXT PRAYER</div><div style="position:absolute;left:23%;top:49%;font-size:1.62vw;font-weight:700">${esc(nextEn)}</div><div style="position:absolute;left:44%;top:20%;width:22%;text-align:center;color:#d9b36b;font-size:2.8vw;font-weight:500">${esc(nextTime)}</div><div style="position:absolute;left:66%;top:18%;width:1px;height:64%;background:#a58a4c"></div><div style="position:absolute;left:73%;top:24%;width:3.4vw;height:3.4vw;border:1px solid #a58a4c;border-radius:50%;text-align:center;line-height:3.4vw;font-size:1.5vw">🤲</div><div style="position:absolute;left:79%;top:18%;color:#d9b36b;font-size:.9vw">IQAMA</div><div style="position:absolute;left:79%;top:49%;font-size:1.62vw">${esc(nextIqama)}</div></div><div style="position:absolute;left:4%;top:35.5%;width:41%;height:53%;background:#033a31;border:1px solid #a58a4c;border-radius:18px;overflow:hidden"><div style="height:10%;position:relative;color:#d9b36b;font-size:1vw;font-weight:700"><span style="position:absolute;left:5%;top:34%">🕌 SALAH</span><span style="position:absolute;left:51%;top:34%">AZAN</span><span style="position:absolute;left:79%;top:34%">IQAMA</span></div>${rowHtml}</div><div style="position:absolute;left:46.2%;top:35.5%;width:49.8%;height:53%;background:#033a31;border:1px solid #a58a4c;border-radius:18px;overflow:hidden"><div style="position:absolute;left:4%;top:4%;color:#d9b36b;font-size:1.08vw;font-weight:700">📣 ANNOUNCEMENTS</div><div style="position:absolute;left:3%;top:13%;width:66%;height:60%">${annHtml}</div><div style="position:absolute;left:3%;bottom:4%;width:66%;height:16%;border:1px solid rgba(217,179,107,.72);border-radius:.75vw;padding:.45vw .7vw;box-sizing:border-box"><span style="font-size:1.35vw;float:left;margin-right:.55vw">🕌</span><strong style="display:block;color:#f1c86f;font-size:.88vw;letter-spacing:.06em">JUMU’AH • الجمعة</strong><span style="display:block;margin-top:.18vw;font-size:.8vw;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(jumuahText)}</span></div><div style="position:absolute;left:72%;top:5%;width:1px;height:88%;background:#a58a4c"></div><div style="position:absolute;left:74%;top:9%;width:24%;text-align:center;color:#d9b36b;font-size:.9vw;font-weight:700">🤲 SUPPORT YOUR MASJID</div><div style="position:absolute;left:74%;top:17%;width:24%;text-align:center;color:#f7f4eb;font-size:.72vw">Scan to donate or visit</div><div style="position:absolute;left:78%;top:28%;width:8.8vw;height:8.8vw;background:#f8f5eb;border-radius:10px;color:#111;text-align:center;line-height:8.8vw;font-size:4vw">▦</div><div style="position:absolute;left:74%;top:76%;width:24%;text-align:center;color:#e6c468;font-size:.8vw">📱 SCAN QR</div><div style="position:absolute;left:74%;top:83%;width:24%;text-align:center;color:#83d49d;font-size:.72vw;font-weight:700">${esc(website.slice(0,28))}</div></div><div style="position:absolute;left:0;bottom:0;width:100%;height:6%;background:#073b32;border-top:1px solid rgba(165,138,76,.45);text-align:center;color:#bccbc3;font-size:.85vw;line-height:5vh">✨ Powered by Hassoun ✨</div><button class="px-clock-hotspot" type="button" aria-label="Open Masjid Display Studio" style="position:absolute;left:31%;top:1%;width:38%;height:20%;border:0;background:transparent;cursor:pointer"></button></div>`;
  };
  sync();const timer=window.setInterval(sync,500);return()=>{window.clearInterval(timer);document.querySelector(".pixel-replica-one")?.remove()};
 },[]);
 return null;
}
