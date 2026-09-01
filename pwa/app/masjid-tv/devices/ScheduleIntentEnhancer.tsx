"use client";

import {useEffect} from "react";

const API="https://wopt-prayer-push.wopt-windsor.workers.dev";
const LIST_KEY="hassoun:paired-displays:v2";
type Device={id:string;code:string;name:string;token:string;pairedAt:string};
function devices():Device[]{try{return JSON.parse(localStorage.getItem(LIST_KEY)||"[]")}catch{return[]}}
function activeDevice():Device|null{const code=document.body.textContent?.match(/\b\d{6}\b/)?.[0];return(code?devices().find(d=>d.code===code):null)||devices()[0]||null}
async function load(d:Device){const r=await fetch(`${API}/masjid-displays/control/${encodeURIComponent(d.id)}`,{headers:{Authorization:`Bearer ${d.token}`},cache:"no-store"});if(!r.ok)throw new Error("Could not load current schedule");return await r.json() as {name:string;settings:Record<string,any>}}
async function save(d:Device,current:{name:string;settings:Record<string,any>}){const r=await fetch(`${API}/masjid-displays/control/${encodeURIComponent(d.id)}`,{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${d.token}`},body:JSON.stringify(current)});if(!r.ok)throw new Error("Could not save Iqama schedule")}

export default function ScheduleIntentEnhancer(){
  useEffect(()=>{
    let stopped=false;
    const enhance=()=>{
      if(stopped)return;
      const panel=document.querySelector<HTMLElement>("[data-bulk-prayer-import='1']");
      if(!panel||panel.querySelector("[data-schedule-intent='1']"))return;
      const pasteBox=panel.querySelector<HTMLTextAreaElement>("[data-schedule-text]");
      const analyze=panel.querySelector<HTMLButtonElement>("[data-analyze-text]");
      const apply=panel.querySelector<HTMLButtonElement>("[data-apply]");
      if(!pasteBox||!analyze||!apply)return;

      const box=document.createElement("section");box.dataset.scheduleIntent="1";box.style.cssText="display:grid;gap:8px;padding:10px;border:1px solid #6a805f;border-radius:10px;background:#0a332d";
      box.innerHTML='<strong style="color:#f1c86f">Tell Hassoun what to do</strong><div style="font-size:11px;color:#a8c2b9">Examples: “Apply these for Iqama only”, “Update September only”, “Import all months and Jumu’ah”, or “Adhan only”.</div><input data-intent-input placeholder="Optional instruction…" style="width:100%;box-sizing:border-box;background:#082b26;color:white;border:1px solid #56776e;border-radius:9px;padding:10px;font:inherit"><label style="display:flex;gap:8px;align-items:center;color:#fff;font-weight:700"><input data-auto-apply type="checkbox" checked> Auto-apply after a successful analysis</label><div style="font-size:11px;color:#d9b36b">Named months use the current year. Multiple named months can be imported together.</div>';
      const option2=Array.from(panel.querySelectorAll("div")).find(x=>(x.textContent||"").includes("Option 2 · Paste prayer schedule text"));option2?.insertAdjacentElement("afterbegin",box);
      const intent=box.querySelector<HTMLInputElement>("[data-intent-input]")!;const auto=box.querySelector<HTMLInputElement>("[data-auto-apply]")!;

      analyze.addEventListener("click",()=>{const command=intent.value.trim();if(!command)return;const original=pasteBox.value;pasteBox.value=`ADMIN INSTRUCTION: ${command}\n\n${original}`;window.setTimeout(()=>{pasteBox.value=original},0)},true);

      apply.addEventListener("click",async e=>{
        const command=intent.value.trim();if(!/(?:iqama|iqamah).*only|only.*(?:iqama|iqamah)/i.test(command))return;
        e.preventDefault();e.stopImmediatePropagation();
        const status=panel.querySelector<HTMLElement>("[data-schedule-status]");const d=activeDevice();if(!d||!status)return;
        try{
          status.textContent="Applying Iqama only · preserving existing Adhan times…";apply.disabled=true;
          const current=await load(d);const schedule={...(current.settings.prayerSchedule||{})};
          const table=panel.querySelector<HTMLElement>("[data-schedule-preview] table");if(!table)throw new Error("Analyze the Iqama table first");
          Array.from(table.querySelectorAll<HTMLTableRowElement>("tbody tr")).forEach(tr=>{
            const inputs=Array.from(tr.querySelectorAll<HTMLInputElement>("input"));if(inputs.length<11)return;const date=inputs[0].value.trim();if(!date)return;
            const old=schedule[date]||{adhan:{},iqama:{}};const adhan={...(old.adhan||{})};
            const iq={fajr:inputs[2].value.trim(),dhuhr:inputs[4].value.trim(),asr:inputs[6].value.trim(),maghrib:inputs[8].value.trim(),isha:inputs[10].value.trim()};
            if(/^sunset$/i.test(iq.maghrib))iq.maghrib=String(adhan.maghrib||old.iqama?.maghrib||"");
            schedule[date]={...old,adhan,iqama:{...(old.iqama||{}),...iq}};
          });
          const today=new Date().toISOString().slice(0,10);const todayIq=schedule[today]?.iqama||current.settings.iqama||{};
          await save(d,{name:current.name,settings:{...current.settings,prayerSchedule:schedule,prayerMode:"custom",iqama:todayIq,showIqama:true}});
          status.textContent="Live · Iqama-only schedule saved. Existing Adhan times were preserved.";
          window.dispatchEvent(new Event("hassoun-schedule-updated"));
        }catch(err){status.textContent=err instanceof Error?err.message:"Could not apply Iqama-only schedule"}finally{apply.disabled=false}
      },true);

      const observer=new MutationObserver(()=>{if(!auto.checked||apply.disabled)return;const status=panel.querySelector<HTMLElement>("[data-schedule-status]");if(status&&(status.textContent||"").startsWith("Found ")){auto.checked=false;window.setTimeout(()=>{if(!apply.disabled)apply.click()},120)}});
      observer.observe(panel,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:["disabled"]});(box as any)._cleanup=()=>observer.disconnect();
    };
    enhance();const timer=window.setInterval(enhance,600);return()=>{stopped=true;window.clearInterval(timer);document.querySelectorAll<HTMLElement>("[data-schedule-intent='1']").forEach(x=>{(x as any)._cleanup?.();x.remove()})};
  },[]);
  return null;
}
