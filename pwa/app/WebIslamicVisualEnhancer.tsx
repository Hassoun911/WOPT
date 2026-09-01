"use client";

import {useEffect} from "react";

const prayerKeys=["fajr","dhuhr","asr","maghrib","isha"] as const;

function prayerIcon(kind:string){
 const art:Record<string,string>={
  fajr:'<path d="M18 58h64M27 58c9-18 37-18 46 0"/><path d="M58 20a14 14 0 1 0 9 24 17 17 0 1 1-9-24z"/>',
  dhuhr:'<circle cx="50" cy="42" r="14"/><path d="M50 13v12M50 59v12M21 42h12M67 42h12M29 21l9 9M62 54l9 9M71 21l-9 9M38 54l-9 9"/>',
  asr:'<circle cx="37" cy="35" r="12"/><path d="M37 12v10M14 35h10M20 18l8 8M54 18l-8 8"/><path d="M20 75h60M31 75l22-25 22 25"/>',
  maghrib:'<path d="M18 60h64M26 60a24 24 0 0 1 48 0M28 71h44M36 81h28"/><path d="M50 25v10M27 38l8 6M73 38l-8 6"/>',
  isha:'<path d="M55 20a18 18 0 1 0 11 31 21 21 0 1 1-11-31z"/><path d="M73 22l2.5 6 6 2.5-6 2.5-2.5 6-2.5-6-6-2.5 6-2.5z"/><path d="M28 78h44M35 78V64c0-9 7-16 15-16s15 7 15 16v14"/>'
 };
 return `<svg viewBox="0 0 100 100" aria-hidden="true" class="islamic-prayer-art" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M15 88V42c0-20 15-34 35-34s35 14 35 34v46H15z"/><path d="M24 88h52"/>${art[kind]||art.fajr}</svg>`;
}
function sectionIcon(kind:string){
 const body=kind==="ayah"?'<path d="M18 22c14-5 24-2 32 5v50c-8-7-18-10-32-5V22zm64 0c-14-5-24-2-32 5v50c8-7 18-10 32-5V22z"/>':kind==="dua"?'<path d="M28 76c-9-9-13-20-11-31 1-7 8-8 11-2l8 15V30c0-7 8-8 10-1l4 24 4-24c2-7 10-6 10 1v28l8-15c3-6 10-5 11 2 2 11-2 22-11 31-11 10-33 10-44 0z"/>':'<path d="M50 12l7 18 19-7-7 19 18 8-18 8 7 19-19-7-7 18-7-18-19 7 7-19-18-8 18-8-7-19 19 7z"/><circle cx="50" cy="50" r="13"/>';
 return `<svg viewBox="0 0 100 100" aria-hidden="true" class="islamic-section-art" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
}

export default function WebIslamicVisualEnhancer(){
 useEffect(()=>{
  if(location.pathname!=="/"&&location.pathname!=="")return;
  let stopped=false;
  const sync=()=>{
   if(stopped)return;
   const next=document.querySelector<HTMLElement>(".next-prayer-card");
   if(next&&!next.querySelector("[data-islamic-next-art]")){
    const wrap=document.createElement("div");wrap.dataset.islamicNextArt="1";wrap.className="islamic-next-art";wrap.innerHTML='<svg viewBox="0 0 180 120" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 108V52c0-24 18-42 42-42s42 18 42 42v56"/><path d="M116 108V66c0-17 12-30 29-30s29 13 29 30v42"/><path d="M8 108h168"/><path d="M133 24a13 13 0 1 0 9 22 16 16 0 1 1-9-22z"/><path d="M151 19l2 5 5 2-5 2-2 5-2-5-5-2 5-2z"/></svg>';
    next.appendChild(wrap);
   }
   document.querySelectorAll<HTMLElement>(".prayer-card").forEach((card,i)=>{
    if(card.querySelector("[data-islamic-prayer-art]"))return;
    const holder=document.createElement("span");holder.dataset.islamicPrayerArt="1";holder.className="prayer-art-holder";holder.innerHTML=prayerIcon(prayerKeys[i]||"fajr");card.prepend(holder);
   });
   document.querySelectorAll<HTMLElement>(".daily-card").forEach(card=>{
    if(card.querySelector("[data-islamic-daily-art]"))return;
    const kind=card.classList.contains("ayah")?"ayah":card.classList.contains("dua")?"dua":"hadith";
    const holder=document.createElement("span");holder.dataset.islamicDailyArt="1";holder.className="daily-art-holder";holder.innerHTML=sectionIcon(kind);card.appendChild(holder);
    const old=card.querySelector<HTMLElement>(".daily-card-top b");if(old)old.style.display="none";
   });
  };
  sync();const mo=new MutationObserver(sync);mo.observe(document.body,{childList:true,subtree:true});return()=>{stopped=true;mo.disconnect()};
 },[]);
 return null;
}
