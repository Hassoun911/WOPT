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

   const rowHtml=rows.map((r,i)=>`<div style="height:18%;border-top:1px solid rgba(165,138,76,.34);position:relative;color:#f7f4eb"><span style="position:absolute;left:2.4%;top:30%;font-size:1.55vw">${ICONS[i]}</span><div style="position:absolute;left:10%;top:9%;width:34%;line-height:1"><strong style="display:block;font-size:1.36vw;font-family:Arial,Helvetica,sans-serif;letter-spacing:.01em">${esc(r.name)}</strong><span dir="rtl" lang="ar" style="display:block;margin-top:.16vw;color:#f0ce73;font-size:1.78vw;line-height:1.02;font-family:'Aref Ruqaa Ink','Aref Ruqaa','Amiri Quran','Amiri','Scheherazade New','Noto Naskh Arabic',cursive;font-weight:700;text-shadow:0 .08vw .12vw rgba(0,0,0,.34)">${ARABIC[i]}</span></div><span style="position:absolute;left:51%;top:33%;font-size:1.3vw;font-weight:700">${esc(r.adhan)}</span><span style="position:absolute;left:79%;top:33%;font-size:1.3vw;font-weight:800;color:#9be2af">${esc(r.iqama)}</span></div>`).join("");
   const annIcons=["📖","📣","🤲"];
   const annHtml=anns.map((a,i)=>`<div style="position:relative;height:26%;border-top:${i===0?'0':'1px solid rgba(165,138,76,.28)'}"><div style="position:absolute;left:2%;top:24%;width:3.1vw;height:3.1vw;border:1px solid #a58a4c;border-radius:50%;text-align:center;line-height:3.1vw;font-size:1.42vw">${annIcons[i]||"✨"}</div><strong style="position:absolute;left:13%;top:18%;color:#f7f4eb;font-size:1.15vw">${esc(a.title||"Announcement")}</strong><span style="position:absolute;left:13%;top:52%;color:#d8e2dd;font-size:.9vw;line-height:1.2">${esc(a.body||"")}</span></div>`).join("");
   const logoHtml=sourceLogo?`<img src="${esc(sourceLogo)}" alt="Masjid logo" style="position:absolute;left:3.4%;top:2.4%;width:7.6%;height:12.6%;object-fit:contain">`:`<div style="position:absolute;left:4.2%;top:4%;font-size:4.8vw;color:#d7b873">🕌</div>`;

   root.innerHTML=`<div style="position:absolute;inset:0;background:#012f29;color:#f7f4eb;font-family:Arial,Helvetica,sans-serif;overflow:hidden"><div style="position:absolute;inset:0;opacity:.18;background-image:linear-gradient(45deg,rgba(11,101,83,.35) 25%,transparent 25%),linear-gradient(-45deg,rgba(11,101,83,.35) 25%,transparent 25%),linear-gradient(45deg,transparent 75%,rgba(11,101,83,.35) 75%),linear-gradient(-45deg,transparent 75%,rgba(11,101,83,.35) 75%);background-size:54px 54px;background-position:0 0,0 27px,27px -27px,-27px 0"></div>${logoHtml}<div style="position:absolute;left:4.1%;top:14.8%;font-family:Georgia,serif;font-size:2vw;font-weight:700;white-space:nowrap">${esc(mosque)}</div><div style="position:absolute;left:4.2%;top:18.8%;color:#d9b36b;font-size:.82vw;letter-spacing:.2em;text-transform:uppercase">${esc(location)}</div><div id="grand-live-clock" style="position:absolute;left:29%;top:2.5%;width:42%;text-align:center;font-size:5.2vw;line-height:1;font-weight:600;letter-spacing:-.04em;white-space:nowrap">${esc(clock)}</div><div style="position:absolute;left:26%;top:14.6%;width:48%;text-align:center;font-size:1.12vw;font-weight:600">${esc(gregorian)}${hijriText?` <span style="color:#f0ce73">| ${esc(hijriText)}</span>`:""}</div><div style="position:absolute;right:4.1%;top:3.9%;width:29%;text-align:right;color:#f0ce73;font-family:'Amiri Quran','Amiri','Scheherazade New',serif;font-size:1.9vw">📖 وَأَقِيمُوا الصَّلَاةَ وَآتُوا الزَّكَاةَ</div><div style="position:absolute;right:4.1%;top:10.1%;width:30%;text-align:right;color:#f7f4eb;font-size:1.02vw;line-height:1.35;font-weight:600">${esc(verse)}</div><div style="position:absolute;left:4%;top:22%;width:92%;height:11.5%;background:#033a31;border:1px solid #a58a4c;border-radius:18px"><div style="position:absolute;left:16.5%;top:22%;width:3.7vw;height:3.7vw;border:1px solid #a58a4c;border-radius:50%;text-align:center;line-height:3.7vw;font-size:1.7vw">🕋</div><div style="position:absolute;left:23%;top:15%;color:#d9b36b;font-size:1.08vw;font-weight:800">NEXT PRAYER</div><div style="position:absolute;left:23%;top:47%;font-size:1.9vw;font-weight:800">${esc(nextEn)}</div><div style="position:absolute;left:43%;top:16%;width:23%;text-align:center;color:#f0ce73;font-size:3.35vw;font-weight:700">${esc(nextTime)}</div><div style="position:absolute;left:66%;top:15%;width:1px;height:70%;background:#a58a4c"></div><div style="position:absolute;left:72.5%;top:22%;width:3.7vw;height:3.7vw;border:1px solid #a58a4c;border-radius:50%;text-align:center;line-height:3.7vw;font-size:1.65vw">🤲</div><div style="position:absolute;left:79%;top:15%;color:#d9b36b;font-size:1.08vw;font-weight:800">IQAMA</div><div style="position:absolute;left:79%;top:47%;font-size:1.9vw;font-weight:800">${esc(nextIqama)}</div></div><div style="position:absolute;left:4%;top:35.5%;width:41%;height:53%;background:#033a31;border:1px solid #a58a4c;border-radius:18px;overflow:hidden"><div style="height:10%;position:relative;color:#d9b36b;font-size:1.18vw;font-weight:800"><span style="position:absolute;left:4%;top:31%">🕌 SALAH</span><span style="position:absolute;left:51%;top:31%">AZAN</span><span style="position:absolute;left:79%;top:31%">IQAMA</span></div>${rowHtml}</div><div style="position:absolute;left:46.2%;top:35.5%;width:49.8%;height:53%;background:#033a31;border:1px solid #a58a4c;border-radius:18px;overflow:hidden"><div style="position:absolute;left:4%;top:3.6%;color:#d9b36b;font-size:1.28vw;font-weight:800">📣 ANNOUNCEMENTS</div><div style="position:absolute;left:3%;top:13%;width:66%;height:60%">${annHtml}</div><div style="position:absolute;left:3%;bottom:4%;width:66%;height:16%;border:1px solid rgba(217,179,107,.72);border-radius:.75vw;padding:.42vw .7vw;box-sizing:border-box"><span style="font-size:1.55vw;float:left;margin-right:.6vw">🕌</span><strong style="display:block;color:#f1c86f;font-size:1.05vw;letter-spacing:.05em">JUMU’AH • <span dir="rtl" style="font-family:'Aref Ruqaa Ink','Aref Ruqaa','Amiri',serif;font-size:1.35vw">الجمعة</span></strong><span style="display:block;margin-top:.12vw;font-size:.95vw;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:700">${esc(jumuahText)}</span></div><div style="position:absolute;left:72%;top:5%;width:1px;height:88%;background:#a58a4c"></div><div style="position:absolute;left:74%;top:8%;width:24%;text-align:center;color:#d9b36b;font-size:1.05vw;font-weight:800">🤲 SUPPORT YOUR MASJID</div><div style="position:absolute;left:74%;top:17%;width:24%;text-align:center;color:#f7f4eb;font-size:.84vw;font-weight:600">Scan to donate or visit</div><div style="position:absolute;left:77%;top:27%;width:10.5vw;height:10.5vw;background:#f8f5eb;border-radius:12px;color:#111;text-align:center;line-height:10.5vw;font-size:4.8vw">▦</div><div style="position:absolute;left:74%;top:77%;width:24%;text-align:center;color:#f0ce73;font-size:.92vw;font-weight:800">📱 SCAN QR</div><div style="position:absolute;left:74%;top:84%;width:24%;text-align:center;color:#9be2af;font-size:.86vw;font-weight:800">${esc(website.slice(0,28))}</div></div><div style="position:absolute;left:0;bottom:0;width:100%;height:6%;background:#073b32;border-top:1px solid rgba(165,138,76,.45);text-align:center;color:#d5dfda;font-size:.95vw;line-height:5vh;font-weight:700">✨ Powered by Hassoun ✨</div><button class="px-clock-hotspot" type="button" aria-label="Open Masjid Display Studio" style="position:absolute;left:31%;top:1%;width:38%;height:20%;border:0;background:transparent;cursor:pointer"></button></div>`;
  };
  sync();const timer=window.setInterval(sync,500);return()=>{window.clearInterval(timer);document.querySelector(".pixel-replica-one")?.remove()};
 },[]);
 return null;
}
