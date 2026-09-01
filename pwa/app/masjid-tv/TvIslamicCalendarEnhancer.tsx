"use client";

import { useEffect } from "react";

const STORAGE="hassoun:web-masjid-tv:v2";
const HIJRI_MONTHS=["Muharram","Safar","Rabi’ al-Awwal","Rabi’ al-Thani","Jumada al-Awwal","Jumada al-Thani","Rajab","Sha’ban","Ramadan","Shawwal","Dhul Qa’dah","Dhul Hijjah"];

function read(){try{return JSON.parse(localStorage.getItem(STORAGE)||"{}") as Record<string,any>}catch{return {}}}
function islamicInfo(now=new Date()){
  try{
    const parts=new Intl.DateTimeFormat("en-u-ca-islamic",{day:"numeric",month:"numeric",year:"numeric"}).formatToParts(now);
    const n=(t:string)=>Number(parts.find(p=>p.type===t)?.value||0);const day=n("day"),month=n("month"),year=n("year");
    const monthName=HIJRI_MONTHS[Math.max(0,Math.min(11,month-1))]||"Hijri";
    const hijri=day&&year?`${day} ${monthName} ${year} AH`:"";
    let event="";
    if(month===1&&day===1)event="Islamic New Year";
    else if(month===1&&day===10)event="Ashura";
    else if(month===9&&day===1)event="Ramadan begins";
    else if(month===9&&day===27)event="Laylat al-Qadr";
    else if(month===10&&day===1)event="Eid al-Fitr";
    else if(month===12&&day===9)event="Day of Arafah";
    else if(month===12&&day===10)event="Eid al-Adha";
    return {hijri,event};
  }catch{return {hijri:"",event:""}}
}

export default function TvIslamicCalendarEnhancer(){
  useEffect(()=>{
    const sync=()=>{
      if(location.pathname.includes("/devices")||location.pathname.includes("/pair"))return;
      const s=read();const {hijri,event}=islamicInfo();
      document.documentElement.dataset.hassounHijri=s.showHijriDate===false?"":hijri;
      document.documentElement.dataset.hassounIslamicEvent=s.showIslamicEvents===false?"":event;
      // Important: do not rewrite the rendered TV date here. The active layout renderer
      // owns the visible date so two timers cannot fight and cause flicker.
    };
    sync();const timer=window.setInterval(sync,60000);window.addEventListener("storage",sync);
    return()=>{window.clearInterval(timer);window.removeEventListener("storage",sync)};
  },[]);
  return null;
}
