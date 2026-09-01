"use client";

import { useEffect } from "react";

const STORAGE="hassoun:web-masjid-tv:v2";
const PRAYERS=["fajr","dhuhr","asr","maghrib","isha"] as const;

function read(){try{return JSON.parse(localStorage.getItem(STORAGE)||"{}") as Record<string,any>}catch{return {}}}
function dateKey(now=new Date()){return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`}
function effectiveIqama(settings:Record<string,any>,now=new Date()){
  const fallback={...(settings.iqama||{})} as Record<string,string>;
  const schedule=settings.prayerSchedule&&typeof settings.prayerSchedule==="object"?settings.prayerSchedule as Record<string,any>:{};
  const today=dateKey(now);const keys=Object.keys(schedule).filter(k=>/^\d{4}-\d{2}-\d{2}$/.test(k)&&k<=today).sort();
  const out={...fallback};
  for(const k of keys){const row=schedule[k];for(const p of PRAYERS){let v=String(row?.iqama?.[p]||"").trim();if(p==="maghrib"&&/^sunset$/i.test(v))v=String(row?.adhan?.maghrib||out[p]||"").trim();if(v)out[p]=v}}
  return out;
}
function sameIqama(a:Record<string,any>,b:Record<string,any>){return PRAYERS.every(p=>String(a?.[p]||"")===String(b?.[p]||""))}
function islamicInfo(now=new Date()){
  const formatted=new Intl.DateTimeFormat("en-u-ca-islamic",{day:"numeric",month:"long",year:"numeric"}).format(now);
  const parts=new Intl.DateTimeFormat("en-u-ca-islamic",{day:"numeric",month:"numeric",year:"numeric"}).formatToParts(now);
  const n=(t:string)=>Number(parts.find(p=>p.type===t)?.value||0);const day=n("day"),month=n("month");
  let event="";
  if(month===1&&day===1)event="Islamic New Year";
  else if(month===1&&day===10)event="Ashura";
  else if(month===9&&day===1)event="Ramadan begins";
  else if(month===9&&day===27)event="Laylat al-Qadr";
  else if(month===10&&day===1)event="Eid al-Fitr";
  else if(month===12&&day===9)event="Day of Arafah";
  else if(month===12&&day===10)event="Eid al-Adha";
  return {hijri:formatted,event};
}

export default function TvIslamicCalendarEnhancer(){
  useEffect(()=>{
    const sync=()=>{
      if(location.pathname.includes("/devices")||location.pathname.includes("/pair"))return;
      const s=read();
      const datedIqama=effectiveIqama(s);
      if(Object.keys(s.prayerSchedule||{}).length&&!sameIqama(datedIqama,s.iqama||{})){
        try{localStorage.setItem(STORAGE,JSON.stringify({...s,iqama:datedIqama}));location.reload();return}catch{}
      }
      const showHijri=s.showHijriDate!==false;const showEvents=s.showIslamicEvents!==false;const {hijri,event}=islamicInfo();
      document.querySelectorAll<HTMLElement>(".tv-dates").forEach(box=>{
        const spans=box.querySelectorAll<HTMLElement>("span");if(!spans[0])return;
        let secondary=spans[1];if(!secondary){secondary=document.createElement("span");box.appendChild(secondary)}
        const bits:string[]=[];if(showHijri)bits.push(hijri);if(showEvents&&event)bits.push(event);secondary.textContent=bits.join(" • ");secondary.style.display=bits.length?"":"none";
      });
      document.querySelectorAll<HTMLElement>(".community-date small,.cinematic-date small,.board-date small").forEach(node=>{const bits:string[]=[];if(showHijri)bits.push(hijri);if(showEvents&&event)bits.push(event);node.textContent=bits.join(" • ");node.style.display=bits.length?"":"none"});
    };
    sync();const timer=window.setInterval(sync,1000);window.addEventListener("storage",sync);return()=>{window.clearInterval(timer);window.removeEventListener("storage",sync)};
  },[]);
  return null;
}
