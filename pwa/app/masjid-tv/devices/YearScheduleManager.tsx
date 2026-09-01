"use client";

import {useEffect} from "react";

const API="https://wopt-prayer-push.wopt-windsor.workers.dev";
const LIST_KEY="hassoun:paired-displays:v2";
type Device={id:string;code:string;name:string;token:string;pairedAt:string};
const MONTHS=["January","February","March","April","May","June","July","August","September","October","November","December"];
const PRAYERS=["fajr","dhuhr","asr","maghrib","isha"] as const;

function devices():Device[]{try{return JSON.parse(localStorage.getItem(LIST_KEY)||"[]")}catch{return[]}}
function activeDevice():Device|null{const code=document.body.textContent?.match(/\b\d{6}\b/)?.[0];return(code?devices().find(d=>d.code===code):null)||devices()[0]||null}
async function load(device:Device){const r=await fetch(`${API}/masjid-displays/control/${encodeURIComponent(device.id)}`,{headers:{Authorization:`Bearer ${device.token}`},cache:"no-store"});if(!r.ok)throw new Error("Could not load display schedule");return await r.json() as {name:string;settings:Record<string,any>}}
async function save(device:Device,current:{name:string;settings:Record<string,any>}){const r=await fetch(`${API}/masjid-displays/control/${encodeURIComponent(device.id)}`,{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${device.token}`},body:JSON.stringify(current)});if(!r.ok)throw new Error("Could not save schedule changes")}
function daysInMonth(year:number,month:number){return new Date(year,month,0).getDate()}
function key(year:number,month:number,day:number){return `${year}-${String(month).padStart(2,"0")}-${String(day).padStart(2,"0")}`}
function rowHealth(row:any){if(!row)return 10;let issues=0;for(const p of PRAYERS){if(!row.adhan?.[p])issues++;if(!row.iqama?.[p])issues++;}return issues}
function withIqamaCarryForward(schedule:Record<string,any>){
 const next:Record<string,any>={...schedule};
 const dates=Object.keys(schedule).filter(d=>/^\d{4}-\d{2}-\d{2}$/.test(d)).sort();
 const last:Record<string,string>={fajr:"",dhuhr:"",asr:"",maghrib:"",isha:""};
 for(const date of dates){
  const row=schedule[date]||{};const iq={...(row.iqama||{})};
  for(const p of PRAYERS){const current=String(iq[p]||"").trim();if(current)last[p]=current;else if(last[p])iq[p]=last[p]}
  next[date]={...row,adhan:{...(row.adhan||{})},iqama:iq};
 }
 return next;
}
const btn="padding:8px 12px;border-radius:10px;border:1px solid #d9b36b;background:#d9b36b;color:#102c25;font-weight:900;cursor:pointer";

export default function YearScheduleManager(){
 useEffect(()=>{
  let stopped=false;
  const enhance=async()=>{
   if(stopped)return;
   const heading=Array.from(document.querySelectorAll<HTMLHeadingElement>("h3")).find(h=>(h.textContent||"").includes("Prayer table & Iqama"));
   const host=heading?.parentElement;if(!host||host.querySelector("[data-year-schedule-manager='1']"))return;
   const device=activeDevice();if(!device)return;

   const panel=document.createElement("section");panel.dataset.yearScheduleManager="1";panel.style.cssText="display:grid;gap:10px;padding:13px;border:1px solid #826f45;border-radius:13px;background:#082f2a;margin:8px 0";
   panel.innerHTML='<div style="display:flex;justify-content:space-between;gap:10px;align-items:center"><div><strong style="color:#f1c86f;font-size:17px">Full year prayer calendar</strong><div style="font-size:11px;color:#a8c2b9;margin-top:3px">Click a month to review or edit it.</div></div><button data-refresh-year type="button">Refresh</button></div><div data-year-alerts></div><div data-month-grid style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px"></div>';
   panel.querySelectorAll("button").forEach(b=>b.setAttribute("style",btn));host.insertBefore(panel,heading.nextSibling);
   const grid=panel.querySelector<HTMLElement>("[data-month-grid]")!;const alerts=panel.querySelector<HTMLElement>("[data-year-alerts]")!;

   const closeModal=()=>document.querySelector("[data-month-modal='1']")?.remove();

   const openMonth=(month:number,name:string,current:{name:string;settings:Record<string,any>},rawSchedule:Record<string,any>)=>{
    closeModal();const year=new Date().getFullYear(),total=daysInMonth(year,month);const schedule=withIqamaCarryForward(rawSchedule);
    const overlay=document.createElement("div");overlay.dataset.monthModal="1";overlay.style.cssText="position:fixed;inset:0;z-index:2147483000;background:rgba(0,20,17,.72);display:flex;align-items:center;justify-content:center;padding:18px;box-sizing:border-box";
    const modal=document.createElement("section");modal.style.cssText="width:min(1180px,96vw);max-height:90vh;overflow:hidden;background:#082f2a;border:1px solid #d9b36b;border-radius:18px;box-shadow:0 24px 80px rgba(0,0,0,.5);display:grid;grid-template-rows:auto auto 1fr auto;color:#fff";
    modal.innerHTML=`<div style="display:flex;justify-content:space-between;align-items:center;padding:16px 18px;border-bottom:1px solid #35584f"><div><strong style="font-size:22px;color:#f1c86f">${name} ${year}</strong><div style="font-size:12px;color:#a8c2b9;margin-top:3px">Manual month editor · unchanged Iqama values carry forward automatically</div></div><button data-close-month type="button" style="${btn}">Close</button></div><div data-month-warning style="padding:10px 18px"></div><div data-month-table style="overflow:auto;padding:0 18px 12px"></div><div style="display:flex;justify-content:flex-end;gap:10px;padding:14px 18px;border-top:1px solid #35584f"><button data-save-month type="button" style="${btn}">Save ${name}</button></div>`;
    overlay.appendChild(modal);document.body.appendChild(overlay);document.documentElement.style.overflow="hidden";
    const finish=()=>{document.documentElement.style.overflow="";closeModal()};
    overlay.onclick=e=>{if(e.target===overlay)finish()};modal.querySelector<HTMLButtonElement>("[data-close-month]")!.onclick=finish;
    const wrap=modal.querySelector<HTMLElement>("[data-month-table]")!;const warning=modal.querySelector<HTMLElement>("[data-month-warning]")!;
    const table=document.createElement("table");table.style.cssText="width:100%;border-collapse:separate;border-spacing:0 5px;font-size:12px;color:#fff;min-width:980px";table.innerHTML='<thead><tr><th style="text-align:left">Date</th><th>Fajr</th><th>F Iq.</th><th>Dhuhr</th><th>D Iq.</th><th>Asr</th><th>A Iq.</th><th>Maghrib</th><th>M Iq.</th><th>Isha</th><th>I Iq.</th></tr></thead><tbody></tbody>';
    const tbody=table.querySelector("tbody")!;let missing=0;
    for(let d=1;d<=total;d++){
      const date=key(year,month,d),stored=schedule[date]||{adhan:{},iqama:{}};missing+=rowHealth(stored);const tr=document.createElement("tr");tr.dataset.date=date;
      const values=[date,stored.adhan?.fajr||"",stored.iqama?.fajr||"",stored.adhan?.dhuhr||"",stored.iqama?.dhuhr||"",stored.adhan?.asr||"",stored.iqama?.asr||"",stored.adhan?.maghrib||"",stored.iqama?.maghrib||"",stored.adhan?.isha||"",stored.iqama?.isha||""];
      values.forEach((v,i)=>{const td=document.createElement("td");td.style.cssText="padding:2px 4px;text-align:center";if(i===0){td.textContent=String(v);td.style.cssText+="text-align:left;white-space:nowrap;font-weight:700"}else{const input=document.createElement("input");input.value=String(v);input.style.cssText="width:78px;background:#072923;color:#fff;border:1px solid #46675e;border-radius:7px;padding:7px;box-sizing:border-box";td.appendChild(input)}tr.appendChild(td)});tbody.appendChild(tr);
    }
    warning.innerHTML=missing?`<span style="color:#ffd78b"><strong>Needs review:</strong> ${missing} values are still blank after carry-forward.</span>`:'<span style="color:#aee5bf"><strong>Healthy:</strong> all prayer and effective Iqama values are filled.</span>';
    wrap.appendChild(table);
    modal.querySelector<HTMLButtonElement>("[data-save-month]")!.onclick=async()=>{
      const next={...rawSchedule};Array.from(tbody.querySelectorAll<HTMLTableRowElement>("tr")).forEach(tr=>{const vals=Array.from(tr.querySelectorAll<HTMLInputElement>("input")).map(i=>i.value.trim());next[tr.dataset.date!]={adhan:{fajr:vals[0],dhuhr:vals[2],asr:vals[4],maghrib:vals[6],isha:vals[8]},iqama:{fajr:vals[1],dhuhr:vals[3],asr:vals[5],maghrib:vals[7],isha:vals[9]}}});
      try{warning.textContent="Saving…";await save(device,{name:current.name,settings:{...current.settings,prayerSchedule:next,prayerMode:"custom"}});warning.innerHTML='<span style="color:#aee5bf"><strong>Saved.</strong> Carried-forward Iqama values are now stored for this month.</span>';window.dispatchEvent(new Event("hassoun-schedule-updated"));await render()}catch(e){warning.textContent=e instanceof Error?e.message:"Could not save month"}
    };
   };

   const render=async()=>{
    try{
     const current=await load(device);const raw=(current.settings.prayerSchedule||{}) as Record<string,any>;const schedule=withIqamaCarryForward(raw);const year=new Date().getFullYear();grid.innerHTML="";let empty=0,review=0;
     MONTHS.forEach((name,idx)=>{const month=idx+1,total=daysInMonth(year,month);let present=0,issues=0;for(let d=1;d<=total;d++){const r=schedule[key(year,month,d)];if(r)present++;issues+=rowHealth(r)}const healthy=present===total&&issues===0;if(!present)empty++;else if(!healthy)review++;const card=document.createElement("button");card.type="button";card.style.cssText=`text-align:left;padding:11px;border-radius:11px;border:1px solid ${healthy?'#4f9977':present?'#c89545':'#735e4c'};background:#0a3932;color:#fff;cursor:pointer`;card.innerHTML=`<strong style="font-size:15px">${name}</strong><div style="font-size:11px;margin-top:5px;color:${healthy?'#aee5bf':present?'#ffd78b':'#baa89b'}">${present}/${total} · ${healthy?'Ready':present?'Review':'Empty'}</div>`;card.onclick=()=>openMonth(month,name,current,raw);grid.appendChild(card)});
     alerts.innerHTML=`<div style="padding:8px 10px;border-radius:9px;background:${empty||review?'#42321b':'#123d31'};color:${empty||review?'#ffd78b':'#aee5bf'}"><strong>Schedule:</strong> ${empty} empty · ${review} need review <span style="opacity:.8">· unchanged Iqama values carry forward</span></div>`;
    }catch(e){alerts.textContent=e instanceof Error?e.message:"Could not inspect year schedule"}
   };

   panel.querySelector<HTMLButtonElement>("[data-refresh-year]")!.onclick=()=>void render();
   window.addEventListener("hassoun-schedule-updated",()=>void render());await render();
  };
  enhance();const timer=window.setInterval(()=>void enhance(),900);return()=>{stopped=true;window.clearInterval(timer);document.documentElement.style.overflow="";document.querySelector("[data-month-modal='1']")?.remove();document.querySelectorAll("[data-year-schedule-manager='1']").forEach(x=>x.remove())};
 },[]);
 return null;
}
