"use client";

import { useEffect } from "react";

const STORAGE="hassoun:web-masjid-tv:v2";

function read(){try{return JSON.parse(localStorage.getItem(STORAGE)||"{}") as Record<string,unknown>}catch{return {}}}
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
      const s=read();const showHijri=s.showHijriDate!==false;const showEvents=s.showIslamicEvents!==false;const {hijri,event}=islamicInfo();
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
