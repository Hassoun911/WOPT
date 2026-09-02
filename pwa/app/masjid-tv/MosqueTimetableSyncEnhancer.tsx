"use client";

import { useEffect } from "react";

const API = "https://wopt-prayer-push.wopt-windsor.workers.dev";
const STORAGE = "hassoun:web-masjid-tv:v2";
const LIST_KEY = "hassoun:paired-displays:v2";
const PRAYERS = ["fajr", "dhuhr", "asr", "maghrib", "isha"] as const;
type Prayer = typeof PRAYERS[number];
type Device = { id:string; code:string; name:string; token:string; pairedAt:string };
type Remote = { name:string; settings:Record<string,any>; revision?:number };
type Timetable = {
  found?:boolean;
  source?:string;
  slug?:string;
  mosqueName?:string;
  adhan?:Record<Prayer,string>;
  iqama?:Record<Prayer,string>;
  jumuah?:Array<{label?:string;time?:string}>;
  iqamaAvailable?:boolean;
  jumuahAvailable?:boolean;
};

function dateKey(d=new Date()){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`}
function readLocal(){try{return JSON.parse(localStorage.getItem(STORAGE)||"{}") as Record<string,any>}catch{return {}}}
function writeLocal(s:Record<string,any>){localStorage.setItem(STORAGE,JSON.stringify(s));window.dispatchEvent(new StorageEvent("storage",{key:STORAGE,newValue:JSON.stringify(s)}))}
function devices():Device[]{try{return JSON.parse(localStorage.getItem(LIST_KEY)||"[]")}catch{return[]}}
function activeDevice(){const list=devices();const saved=sessionStorage.getItem("hassoun:studio-active-display-code");return list.find(x=>x.code===saved)||list[0]||null}
function nonEmpty(v:any){return String(v??"").trim()}
function hasManualJumuah(s:Record<string,any>){return Array.isArray(s.jumuah)&&s.jumuah.some((x:any)=>nonEmpty(x?.time))}
function meaningful(settings:Record<string,any>){return nonEmpty(settings.selectedMosqueName||settings.mosqueName||settings.prayerCity||settings.mosqueLocation)}

async function fetchTimetable(settings:Record<string,any>):Promise<Timetable|null>{
  if(settings.prayerSourceMode==="manual"||!meaningful(settings))return null;
  const params=new URLSearchParams({
    name:String(settings.selectedMosqueName||settings.mosqueName||""),
    city:String(settings.prayerCity||settings.mosqueLocation||""),
    postal:String(settings.prayerPostalCode||""),
    date:dateKey(),
  });
  try{
    const r=await fetch(`${API}/mosque-timetable?${params.toString()}`,{cache:"no-store"});
    if(!r.ok)return null;
    const data=await r.json() as Timetable;
    return data.found?data:null;
  }catch{return null}
}

function mergeTimetable(settings:Record<string,any>,data:Timetable){
  const today=dateKey();
  const schedule={...(settings.prayerSchedule||{})};
  const current=schedule[today]||{};
  const apiAdhan=data.adhan||{} as Record<Prayer,string>;
  const apiIqama=data.iqama||{} as Record<Prayer,string>;
  const adhan:Record<string,string>={};
  const iqama:Record<string,string>={};
  for(const p of PRAYERS){
    adhan[p]=nonEmpty(current?.adhan?.[p])||nonEmpty(apiAdhan[p]);
    iqama[p]=nonEmpty(current?.iqama?.[p])||nonEmpty(settings?.iqama?.[p])||nonEmpty(apiIqama[p]);
  }
  schedule[today]={...current,adhan,iqama};
  const apiJumuah=Array.isArray(data.jumuah)?data.jumuah.filter(x=>nonEmpty(x?.time)).slice(0,3).map((x,i)=>({label:nonEmpty(x.label)||(i===0?"1st Jumu’ah":i===1?"2nd Jumu’ah":"3rd Jumu’ah"),time:nonEmpty(x.time)})):[];
  const jumuah=hasManualJumuah(settings)?settings.jumuah:apiJumuah;
  const details=[data.source||"Mosque timetable",data.iqamaAvailable?"Iqama":"",data.jumuahAvailable?"Jumu’ah":""].filter(Boolean).join(" · ");
  return {
    ...settings,
    prayerSchedule:schedule,
    jumuah,
    prayerSourceResolved:details,
    mosqueTimetableSlug:data.slug||settings.mosqueTimetableSlug||"",
    mosqueTimetableName:data.mosqueName||settings.mosqueTimetableName||"",
    mosqueTimetableLastSync:new Date().toISOString(),
  };
}

async function loadRemote(d:Device){const r=await fetch(`${API}/masjid-displays/control/${encodeURIComponent(d.id)}`,{headers:{Authorization:`Bearer ${d.token}`},cache:"no-store"});if(!r.ok)return null;return await r.json() as Remote}
async function saveRemote(d:Device,remote:Remote,settings:Record<string,any>){await fetch(`${API}/masjid-displays/control/${encodeURIComponent(d.id)}`,{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${d.token}`},body:JSON.stringify({name:remote.name,settings})})}

export default function MosqueTimetableSyncEnhancer(){
  useEffect(()=>{
    let stopped=false;
    const syncLocal=async()=>{
      if(stopped||location.pathname.includes("/masjid-tv/devices"))return;
      const current=readLocal();
      const data=await fetchTimetable(current);if(!data)return;
      const next=mergeTimetable(current,data);
      if(JSON.stringify(next)!==JSON.stringify(current))writeLocal(next);
    };
    const syncRemote=async()=>{
      if(stopped||!location.pathname.includes("/masjid-tv/devices"))return;
      const device=activeDevice();if(!device)return;
      const remote=await loadRemote(device);if(!remote)return;
      const data=await fetchTimetable(remote.settings||{});if(!data)return;
      const next=mergeTimetable(remote.settings||{},data);
      const a={...remote.settings,mosqueTimetableLastSync:undefined};
      const b={...next,mosqueTimetableLastSync:undefined};
      if(JSON.stringify(a)!==JSON.stringify(b))await saveRemote(device,remote,next);
    };
    void syncLocal();void syncRemote();
    const localTimer=window.setInterval(()=>void syncLocal(),5*60*1000);
    const remoteTimer=window.setInterval(()=>void syncRemote(),5*60*1000);
    const onStorage=()=>{window.setTimeout(()=>{void syncLocal();void syncRemote()},600)};
    window.addEventListener("storage",onStorage);
    return()=>{stopped=true;window.clearInterval(localTimer);window.clearInterval(remoteTimer);window.removeEventListener("storage",onStorage)};
  },[]);
  return null;
}
