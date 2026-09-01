"use client";

import { useEffect } from "react";

const API="https://wopt-prayer-push.wopt-windsor.workers.dev";
const LIST_KEY="hassoun:paired-displays:v2";
const PRAYERS=["fajr","dhuhr","asr","maghrib","isha"] as const;
type Device={id:string;code:string;name:string;token:string;pairedAt:string};

function devices():Device[]{try{return JSON.parse(localStorage.getItem(LIST_KEY)||"[]")}catch{return[]}}
function activeDevice():Device|null{const code=document.body.textContent?.match(/\b\d{6}\b/)?.[0];return(code?devices().find(d=>d.code===code):null)||devices()[0]||null}
function dateKey(now=new Date()){return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`}
function effectiveIqama(settings:Record<string,any>,now=new Date()){
  const fallback={...(settings.iqama||{})} as Record<string,string>;
  const schedule=settings.prayerSchedule&&typeof settings.prayerSchedule==="object"?settings.prayerSchedule as Record<string,any>:{};
  const today=dateKey(now);const keys=Object.keys(schedule).filter(k=>/^\d{4}-\d{2}-\d{2}$/.test(k)&&k<=today).sort();const out={...fallback};
  for(const k of keys){const row=schedule[k];for(const p of PRAYERS){let v=String(row?.iqama?.[p]||"").trim();if(p==="maghrib"&&/^sunset$/i.test(v))v=String(row?.adhan?.maghrib||out[p]||"").trim();if(v)out[p]=v}}
  return out;
}
function patchPreview(iqama:Record<string,string>){
  const buttons=Array.from(document.querySelectorAll<HTMLButtonElement>("button"));
  const table=buttons.find(btn=>{const t=btn.textContent||"";return t.includes("SALAH")&&t.includes("AZAN")&&t.includes("IQAMA")&&t.includes("Fajr")&&t.includes("Isha")});
  if(table){Array.from(table.children).forEach(child=>{const row=child as HTMLElement;if(row.children.length!==3)return;const label=(row.children[0].textContent||"").trim().toLowerCase();const p=PRAYERS.find(x=>label.includes(x));if(p)(row.children[2] as HTMLElement).textContent=iqama[p]||"—"})}
  const next=buttons.find(btn=>{const t=btn.textContent||"";return t.includes("NEXT PRAYER")&&t.includes("IQAMA")});
  if(next){const label=(next.children[0]?.textContent||"").toLowerCase();const p=PRAYERS.find(x=>label.includes(x))||"fajr";const target=next.children[2]?.querySelector("b") as HTMLElement|null;if(target)target.textContent=iqama[p]||"—"}
}

export default function PreviewFooterSync(){
  useEffect(()=>{
    let stopped=false;let latestIqama:Record<string,string>|null=null;
    const syncFooter=()=>{
      const candidates=Array.from(document.querySelectorAll<HTMLButtonElement>("button"));
      const footer=candidates.find(btn=>(btn.textContent||"").includes("Powered by")&&!!btn.querySelector("img[alt='Hassoun app']"));
      if(footer){footer.style.justifyContent="flex-end";footer.style.paddingLeft="14px";footer.style.paddingRight="14px";footer.style.gap="7px";footer.style.textAlign="right"}
      if(latestIqama)patchPreview(latestIqama);
    };
    const refreshIqama=async()=>{
      const d=activeDevice();if(!d)return;
      try{const r=await fetch(`${API}/masjid-displays/control/${encodeURIComponent(d.id)}`,{headers:{Authorization:`Bearer ${d.token}`},cache:"no-store"});if(!r.ok)return;const data=await r.json() as {settings?:Record<string,any>};latestIqama=effectiveIqama(data.settings||{});patchPreview(latestIqama)}catch{}
    };
    syncFooter();void refreshIqama();
    const footerId=window.setInterval(syncFooter,500);const iqamaId=window.setInterval(()=>void refreshIqama(),2500);
    const onSchedule=()=>void refreshIqama();window.addEventListener("hassoun-schedule-updated",onSchedule);
    return()=>{stopped=true;void stopped;window.clearInterval(footerId);window.clearInterval(iqamaId);window.removeEventListener("hassoun-schedule-updated",onSchedule)};
  },[]);
  return null;
}
