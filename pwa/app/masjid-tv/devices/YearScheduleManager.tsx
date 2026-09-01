"use client";

import {useEffect} from "react";

const API="https://wopt-prayer-push.wopt-windsor.workers.dev";
const LIST_KEY="hassoun:paired-displays:v2";
type Device={id:string;code:string;name:string;token:string;pairedAt:string};
const MONTHS=["January","February","March","April","May","June","July","August","September","October","November","December"];
const PRAYERS=["fajr","dhuhr","asr","maghrib","isha"] as const;

function devices():Device[]{try{return JSON.parse(localStorage.getItem(LIST_KEY)||"[]")}catch{return[]}}
function activeDevice():Device|null{
  const code=document.body.textContent?.match(/\b\d{6}\b/)?.[0];
  return (code?devices().find(d=>d.code===code):null)||devices()[0]||null;
}
async function load(device:Device){const r=await fetch(`${API}/masjid-displays/control/${encodeURIComponent(device.id)}`,{headers:{Authorization:`Bearer ${device.token}`},cache:"no-store"});if(!r.ok)throw new Error("Could not load display schedule");return await r.json() as {name:string;settings:Record<string,any>}}
async function save(device:Device,current:{name:string;settings:Record<string,any>}){const r=await fetch(`${API}/masjid-displays/control/${encodeURIComponent(device.id)}`,{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${device.token}`},body:JSON.stringify(current)});if(!r.ok)throw new Error("Could not save schedule changes")}
function daysInMonth(year:number,month:number){return new Date(year,month,0).getDate()}
function key(year:number,month:number,day:number){return `${year}-${String(month).padStart(2,"0")}-${String(day).padStart(2,"0")}`}
function rowHealth(row:any){if(!row)return 10;let issues=0;for(const p of PRAYERS){if(!row.adhan?.[p])issues++;if(!row.iqama?.[p])issues++;}return issues}

export default function YearScheduleManager(){
 useEffect(()=>{
  let stopped=false;
  const enhance=async()=>{
   if(stopped)return;
   const heading=Array.from(document.querySelectorAll<HTMLHeadingElement>("h3")).find(h=>(h.textContent||"").includes("Prayer table & Iqama"));
   const host=heading?.parentElement;if(!host||host.querySelector("[data-year-schedule-manager='1']"))return;
   const device=activeDevice();if(!device)return;
   const panel=document.createElement("section");panel.dataset.yearScheduleManager="1";panel.style.cssText="display:grid;gap:12px;padding:13px;border:1px solid #826f45;border-radius:13px;background:#082f2a;margin:8px 0";
   panel.innerHTML='<div style="display:flex;justify-content:space-between;gap:10px;align-items:center"><div><strong style="color:#f1c86f;font-size:17px">Full year prayer calendar</strong><div style="font-size:11px;color:#a8c2b9;margin-top:4px">Admin only · TV shows only the live/current schedule.</div></div><button data-refresh-year type="button">Refresh</button></div><div data-year-alerts></div><div data-month-grid style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px"></div><div data-month-editor style="display:none"></div>';
   panel.querySelectorAll("button").forEach(b=>b.setAttribute("style","padding:7px 10px;border-radius:9px;border:1px solid #d9b36b;background:#d9b36b;color:#102c25;font-weight:900;cursor:pointer"));
   host.insertBefore(panel,heading.nextSibling);
   const grid=panel.querySelector<HTMLElement>("[data-month-grid]")!;const alerts=panel.querySelector<HTMLElement>("[data-year-alerts]")!;const editor=panel.querySelector<HTMLElement>("[data-month-editor]")!;

   const render=async()=>{
    try{
     const current=await load(device);const schedule=(current.settings.prayerSchedule||{}) as Record<string,any>;const year=new Date().getFullYear();
     grid.innerHTML="";let badMonths=0;let emptyMonths=0;
     MONTHS.forEach((name,idx)=>{
      const month=idx+1,total=daysInMonth(year,month);let present=0,issueCount=0;
      for(let d=1;d<=total;d++){const r=schedule[key(year,month,d)];if(r)present++;issueCount+=rowHealth(r)}
      const complete=present===total&&issueCount===0;if(present===0)emptyMonths++;if(!complete)badMonths++;
      const card=document.createElement("button");card.type="button";card.style.cssText=`text-align:left;padding:10px;border-radius:10px;border:1px solid ${complete?'#4f9977':present?'#c89545':'#735e4c'};background:#0a3932;color:#fff;cursor:pointer`;
      card.innerHTML=`<strong>${name}</strong><div style="font-size:11px;margin-top:4px;color:${complete?'#aee5bf':present?'#ffd78b':'#baa89b'}">${present}/${total} dates · ${complete?'Healthy':present?issueCount+' missing values':'No schedule'}</div>`;
      card.onclick=()=>openMonth(month,name,current,schedule);
      grid.appendChild(card);
     });
     const j=Array.isArray(current.settings.jumuah)?current.settings.jumuah:[];
     alerts.innerHTML=`<div style="padding:9px;border-radius:9px;background:${badMonths?'#42321b':'#123d31'};color:${badMonths?'#ffd78b':'#aee5bf'}"><strong>Smart schedule check:</strong> ${emptyMonths} empty month${emptyMonths===1?'':'s'} · ${badMonths-emptyMonths} month${badMonths-emptyMonths===1?'':'s'} need review · ${j.length?j.length+' Jumu’ah time'+(j.length===1?'':'s')+' saved':'No Jumu’ah time saved'}</div>`;
    }catch(e){alerts.textContent=e instanceof Error?e.message:"Could not inspect year schedule"}
   };

   const openMonth=(month:number,name:string,current:{name:string;settings:Record<string,any>},schedule:Record<string,any>)=>{
    const year=new Date().getFullYear(),total=daysInMonth(year,month);editor.style.display="grid";editor.style.gap="9px";editor.innerHTML=`<div style="display:flex;justify-content:space-between;align-items:center"><div><strong style="color:#f1c86f;font-size:16px">${name} ${year}</strong><div style="font-size:11px;color:#a8c2b9">Edit manually here, or use the AI/file/paste importer above. Changes here affect only this month.</div></div><button data-close-month type="button">Close</button></div><div data-month-warning></div><div data-month-table style="max-height:430px;overflow:auto"></div><button data-save-month type="button">Save ${name}</button>`;
    editor.querySelectorAll("button").forEach(b=>b.setAttribute("style","padding:7px 10px;border-radius:9px;border:1px solid #d9b36b;background:#d9b36b;color:#102c25;font-weight:900;cursor:pointer"));
    editor.querySelector<HTMLButtonElement>("[data-close-month]")!.onclick=()=>{editor.style.display="none";editor.innerHTML=""};
    const wrap=editor.querySelector<HTMLElement>("[data-month-table]")!;const warning=editor.querySelector<HTMLElement>("[data-month-warning]")!;
    const table=document.createElement("table");table.style.cssText="width:100%;border-collapse:collapse;font-size:10px;color:#fff";table.innerHTML='<thead><tr><th>Date</th><th>Fajr</th><th>F Iq.</th><th>Dhuhr</th><th>D Iq.</th><th>Asr</th><th>A Iq.</th><th>Maghrib</th><th>M Iq.</th><th>Isha</th><th>I Iq.</th></tr></thead><tbody></tbody>';
    const tbody=table.querySelector("tbody")!;let missing=0;
    for(let d=1;d<=total;d++){
      const date=key(year,month,d),stored=schedule[date]||{adhan:{},iqama:{}};missing+=rowHealth(stored);const tr=document.createElement("tr");tr.dataset.date=date;
      const values=[date,stored.adhan?.fajr||"",stored.iqama?.fajr||"",stored.adhan?.dhuhr||"",stored.iqama?.dhuhr||"",stored.adhan?.asr||"",stored.iqama?.asr||"",stored.adhan?.maghrib||"",stored.iqama?.maghrib||"",stored.adhan?.isha||"",stored.iqama?.isha||""];
      values.forEach((v,i)=>{const td=document.createElement("td");td.style.cssText="border-top:1px solid #35584f;padding:2px";if(i===0){td.textContent=String(v);td.style.whiteSpace="nowrap"}else{const input=document.createElement("input");input.value=String(v);input.dataset.col=String(i);input.style.cssText="width:72px;background:#082b26;color:#fff;border:1px solid #46675e;border-radius:5px;padding:4px";td.appendChild(input)}tr.appendChild(td)});tbody.appendChild(tr);
    }
    warning.innerHTML=missing?`<div style="color:#ffd78b">Smart alert: ${missing} missing prayer/Iqama values in this month. Blank values are allowed, but review before relying on the TV.</div>`:'<div style="color:#aee5bf">Smart check: this month has complete Adhan and Iqama data.</div>';
    wrap.appendChild(table);
    editor.querySelector<HTMLButtonElement>("[data-save-month]")!.onclick=async()=>{
      const next={...schedule};Array.from(tbody.querySelectorAll<HTMLTableRowElement>("tr")).forEach(tr=>{const inputs=Array.from(tr.querySelectorAll<HTMLInputElement>("input"));const vals=inputs.map(i=>i.value.trim());next[tr.dataset.date!]={adhan:{fajr:vals[0],dhuhr:vals[2],asr:vals[4],maghrib:vals[6],isha:vals[8]},iqama:{fajr:vals[1],dhuhr:vals[3],asr:vals[5],maghrib:vals[7],isha:vals[9]}}});
      const updated={name:current.name,settings:{...current.settings,prayerSchedule:next,prayerMode:"custom"}};try{warning.textContent="Saving month…";await save(device,updated);warning.textContent=`Saved ${name} ${year}.`;await render()}catch(e){warning.textContent=e instanceof Error?e.message:"Could not save month"}
    };
   };

   panel.querySelector<HTMLButtonElement>("[data-refresh-year]")!.onclick=()=>void render();
   await render();
  };
  enhance();const timer=window.setInterval(()=>void enhance(),900);return()=>{stopped=true;window.clearInterval(timer);document.querySelectorAll("[data-year-schedule-manager='1']").forEach(x=>x.remove())};
 },[]);
 return null;
}
