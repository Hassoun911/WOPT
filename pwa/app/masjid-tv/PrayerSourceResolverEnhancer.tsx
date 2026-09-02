"use client";

import { useEffect } from "react";

const STORAGE="hassoun:web-masjid-tv:v2";
const API="https://wopt-prayer-push.wopt-windsor.workers.dev";
const LIST_KEY="hassoun:paired-displays:v2";
const WIA="https://raw.githubusercontent.com/Hassoun911/WOPT/main/windsor_islamic_association_2026_prayer_times.json";
const PRAYERS=["fajr","dhuhr","asr","maghrib","isha"] as const;
type Device={id:string;code:string;name:string;token:string;pairedAt:string};
type Remote={name:string;settings:Record<string,any>;revision?:number};

function dateKey(d=new Date()){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`}
function devices():Device[]{try{return JSON.parse(localStorage.getItem(LIST_KEY)||"[]")}catch{return[]}}
function activeDevice(){const list=devices();const saved=sessionStorage.getItem("hassoun:studio-active-display-code");return list.find(x=>x.code===saved)||list[0]||null}
async function loadRemote(d:Device){const r=await fetch(`${API}/masjid-displays/control/${encodeURIComponent(d.id)}`,{headers:{Authorization:`Bearer ${d.token}`},cache:"no-store"});if(!r.ok)throw new Error("Could not load display");return await r.json() as Remote}
async function saveRemote(d:Device,remote:Remote,patch:Record<string,any>){const settings={...remote.settings,...patch};const r=await fetch(`${API}/masjid-displays/control/${encodeURIComponent(d.id)}`,{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${d.token}`},body:JSON.stringify({name:remote.name,settings})});if(!r.ok)throw new Error("Could not save prayer source");return {...remote,settings}}
function readLocal(){try{return JSON.parse(localStorage.getItem(STORAGE)||"{}") as Record<string,any>}catch{return {}}}
function writeLocal(settings:Record<string,any>){localStorage.setItem(STORAGE,JSON.stringify(settings));window.dispatchEvent(new StorageEvent("storage",{key:STORAGE,newValue:JSON.stringify(settings)}))}
function complete(row:any){return PRAYERS.every(p=>String(row?.adhan?.[p]||"").trim())}
function normalizeAladhan(t:any){return {fajr:t.Fajr||"",dhuhr:t.Dhuhr||"",asr:t.Asr||"",maghrib:t.Maghrib||"",isha:t.Isha||""}}
async function resolveToday(settings:Record<string,any>){
  const today=dateKey();
  if(settings.prayerSourceMode==="manual"||complete(settings.prayerSchedule?.[today]))return settings;
  let adhan:Record<string,string>|null=null;let source="";
  const city=String(settings.prayerCity||settings.mosqueLocation||"").toLowerCase();
  const mosque=String(settings.selectedMosqueName||settings.mosqueName||"").toLowerCase();
  const windsor=city.includes("windsor")||mosque.includes("al hijra")||mosque.includes("windsor islamic");
  try{
    if(windsor){const r=await fetch(WIA,{cache:"no-store"});if(r.ok){const j=await r.json();adhan=j.prayer_times?.[today]||null;if(adhan)source="Official Windsor Islamic Association timetable"}}
    if(!adhan&&Number.isFinite(Number(settings.prayerLatitude))&&Number.isFinite(Number(settings.prayerLongitude))){const ts=Math.floor(Date.now()/1000);const method=Number(settings.calculationMethod||2);const url=`https://api.aladhan.com/v1/timings/${ts}?latitude=${encodeURIComponent(settings.prayerLatitude)}&longitude=${encodeURIComponent(settings.prayerLongitude)}&method=${method}`;const r=await fetch(url,{cache:"no-store"});if(r.ok){const j=await r.json();adhan=normalizeAladhan(j?.data?.timings||{});source="Calculated by coordinates (AlAdhan)"}}
    if(!adhan&&settings.prayerCity){const method=Number(settings.calculationMethod||2);const url=`https://api.aladhan.com/v1/timingsByCity?city=${encodeURIComponent(settings.prayerCity)}&country=${encodeURIComponent(settings.prayerCountry||"Canada")}&method=${method}`;const r=await fetch(url,{cache:"no-store"});if(r.ok){const j=await r.json();adhan=normalizeAladhan(j?.data?.timings||{});source="Calculated by city (AlAdhan)"}}
  }catch{}
  if(!adhan||!PRAYERS.every(p=>String(adhan?.[p]||"").trim()))return settings;
  const prayerSchedule={...(settings.prayerSchedule||{})};
  prayerSchedule[today]={...(prayerSchedule[today]||{}),adhan:{...adhan,...(prayerSchedule[today]?.adhan||{})}};
  return {...settings,prayerSchedule,prayerSourceResolved:source,mosqueLocation:settings.mosqueLocation||settings.prayerCity||""};
}

export default function PrayerSourceResolverEnhancer(){
  useEffect(()=>{
    let stopped=false;
    const tv=async()=>{if(stopped||location.pathname.includes('/masjid-tv/devices'))return;const s=readLocal();const n=await resolveToday(s);if(JSON.stringify(n)!==JSON.stringify(s))writeLocal(n)};
    void tv();const tvTimer=window.setInterval(()=>void tv(),60000);

    const admin=async()=>{
      if(stopped||!location.pathname.includes('/masjid-tv/devices'))return;
      const device=activeDevice();if(!device)return;
      const h=Array.from(document.querySelectorAll('h2')).find(x=>(x.textContent||'').includes('Live display editor'));
      const section=h?.closest('section');if(!section||section.querySelector('[data-prayer-source-resolver="1"]'))return;
      let remote:Remote;try{remote=await loadRemote(device)}catch{return}
      const box=document.createElement('details');box.dataset.prayerSourceResolver='1';box.open=true;box.style.cssText='margin:12px 0;padding:14px;border:1px solid #806f3e;border-radius:14px;background:#082f2a;color:white';
      box.innerHTML=`<summary style="cursor:pointer;color:#efc56a;font-size:18px;font-weight:900">Prayer location & source</summary><div style="display:grid;gap:10px;margin-top:12px"><label>Source mode<select data-mode style="padding:10px;border-radius:9px;background:#082b26;color:#fff;border:1px solid #56776e"><option value="auto">Automatic — best source</option><option value="official">Prefer official mosque timetable</option><option value="calculated">Calculated by city / coordinates</option><option value="manual">Manual only</option></select></label><div style="display:grid;grid-template-columns:1fr 1fr;gap:8px"><label>City<input data-city style="width:100%;padding:10px;border-radius:9px;background:#082b26;color:#fff;border:1px solid #56776e" placeholder="Windsor"></label><label>Country<input data-country style="width:100%;padding:10px;border-radius:9px;background:#082b26;color:#fff;border:1px solid #56776e" placeholder="Canada"></label></div><label>Search mosque<input data-search style="width:100%;padding:10px;border-radius:9px;background:#082b26;color:#fff;border:1px solid #56776e" placeholder="Al Hijra Mosque"></label><button data-find style="padding:10px 14px;border-radius:999px;border:1px solid #d3af58;background:#d9b36b;color:#15342b;font-weight:900;cursor:pointer">Find mosques</button><div data-results style="display:grid;gap:7px"></div><div style="display:grid;grid-template-columns:1fr 1fr;gap:8px"><label>Latitude<input data-lat style="width:100%;padding:10px;border-radius:9px;background:#082b26;color:#fff;border:1px solid #56776e"></label><label>Longitude<input data-lon style="width:100%;padding:10px;border-radius:9px;background:#082b26;color:#fff;border:1px solid #56776e"></label></div><label>Calculation method<select data-method style="padding:10px;border-radius:9px;background:#082b26;color:#fff;border:1px solid #56776e"><option value="2">ISNA</option><option value="3">Muslim World League</option><option value="4">Umm Al-Qura</option><option value="5">Egyptian Authority</option></select></label><div data-source-status style="font-size:12px;color:#aee5bf"></div></div>`;
      section.insertBefore(box,section.firstChild?.nextSibling||null);
      const q=<T extends HTMLElement>(s:string)=>box.querySelector<T>(s)!;
      const mode=q<HTMLSelectElement>('[data-mode]'),city=q<HTMLInputElement>('[data-city]'),country=q<HTMLInputElement>('[data-country]'),search=q<HTMLInputElement>('[data-search]'),lat=q<HTMLInputElement>('[data-lat]'),lon=q<HTMLInputElement>('[data-lon]'),method=q<HTMLSelectElement>('[data-method]'),status=q<HTMLElement>('[data-source-status]'),results=q<HTMLElement>('[data-results]');
      mode.value=String(remote.settings.prayerSourceMode||'auto');city.value=String(remote.settings.prayerCity||'Windsor');country.value=String(remote.settings.prayerCountry||'Canada');search.value=String(remote.settings.selectedMosqueName||'');lat.value=String(remote.settings.prayerLatitude||'');lon.value=String(remote.settings.prayerLongitude||'');method.value=String(remote.settings.calculationMethod||2);status.textContent=remote.settings.prayerSourceResolved?`Current source: ${remote.settings.prayerSourceResolved}`:'Automatic source resolver ready';
      const persist=async(patch:Record<string,any>)=>{try{status.textContent='Saving…';remote=await saveRemote(device,remote,patch);status.textContent='Saved · display will refresh automatically'}catch(e){status.textContent=e instanceof Error?e.message:'Save failed'}};
      mode.onchange=()=>void persist({prayerSourceMode:mode.value});city.onchange=()=>void persist({prayerCity:city.value,mosqueLocation:city.value});country.onchange=()=>void persist({prayerCountry:country.value});lat.onchange=()=>void persist({prayerLatitude:lat.value});lon.onchange=()=>void persist({prayerLongitude:lon.value});method.onchange=()=>void persist({calculationMethod:Number(method.value)});
      q<HTMLButtonElement>('[data-find]').onclick=async()=>{results.innerHTML='<span style="color:#9fc1b6">Searching…</span>';try{const query=[search.value,'mosque',city.value,country.value].filter(Boolean).join(' ');const r=await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=8&q=${encodeURIComponent(query)}`,{headers:{'Accept-Language':'en'}});const rows=await r.json() as any[];results.innerHTML='';if(!rows.length){results.textContent='No mosque results found. You can still use city-based prayer times.';return}rows.forEach(row=>{const b=document.createElement('button');b.type='button';b.style.cssText='text-align:left;padding:10px;border-radius:10px;border:1px solid #44675d;background:#0a3b34;color:#fff;cursor:pointer';b.textContent=row.display_name;b.onclick=()=>{search.value=String(row.name||row.display_name.split(',')[0]||'Mosque');lat.value=String(row.lat||'');lon.value=String(row.lon||'');void persist({selectedMosqueName:search.value,mosqueName:search.value,mosqueLocation:[city.value,country.value].filter(Boolean).join(', '),prayerCity:city.value,prayerCountry:country.value,prayerLatitude:lat.value,prayerLongitude:lon.value,prayerSourceMode:'auto'});results.innerHTML='<span style="color:#aee5bf">Mosque selected. Prayer source will resolve automatically.</span>'};results.appendChild(b)})}catch{results.textContent='Mosque search is temporarily unavailable. City-based prayer times will still work.'}};
    };
    void admin();const adminTimer=window.setInterval(()=>void admin(),1000);
    return()=>{stopped=true;window.clearInterval(tvTimer);window.clearInterval(adminTimer);document.querySelector('[data-prayer-source-resolver]')?.remove()}
  },[]);
  return null;
}
