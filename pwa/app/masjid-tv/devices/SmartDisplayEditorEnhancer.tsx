"use client";

import { useEffect } from "react";

const API="https://wopt-prayer-push.wopt-windsor.workers.dev";
const LIST_KEY="hassoun:paired-displays:v2";
type Device={id:string;code:string;name:string;token:string;pairedAt:string};

function devices():Device[]{try{return JSON.parse(localStorage.getItem(LIST_KEY)||"[]")}catch{return []}}
function editorOpen(){return Array.from(document.querySelectorAll("h2")).some(h=>(h.textContent||"").includes("Live display editor"))}
function findActive():Device|null{
  if(!editorOpen())return null;
  const list=devices();
  const articles=Array.from(document.querySelectorAll<HTMLElement>("article"));
  for(const article of articles){
    const style=article.getAttribute("style")||"";
    if(!/efc66c|239\s*,\s*198\s*,\s*108/i.test(style))continue;
    const code=article.textContent?.match(/\b\d{6}\b/)?.[0];
    if(code){const found=list.find(d=>d.code===code);if(found)return found}
  }
  if(list.length===1)return list[0];
  return null;
}
async function load(device:Device){const r=await fetch(`${API}/masjid-displays/control/${encodeURIComponent(device.id)}`,{headers:{Authorization:`Bearer ${device.token}`},cache:"no-store"});if(!r.ok)throw new Error("Could not load display");return await r.json() as {name:string;settings:Record<string,unknown>}}
async function patch(device:Device,extra:Record<string,unknown>){const current=await load(device);const settings={...current.settings,...extra};const r=await fetch(`${API}/masjid-displays/control/${encodeURIComponent(device.id)}`,{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${device.token}`},body:JSON.stringify({settings})});if(!r.ok)throw new Error("Could not update display");return settings}
function btn(label:string){const b=document.createElement("button");b.type="button";b.textContent=label;b.style.cssText="padding:9px 12px;border-radius:999px;border:1px solid #d9b36b;background:#d9b36b;color:#102c25;font-weight:900;cursor:pointer";return b}
function setTextArea(value:string){const heading=Array.from(document.querySelectorAll("h3")).find(h=>(h.textContent||"").includes("Qur’an verse"));const box=heading?.parentElement?.querySelector("textarea") as HTMLTextAreaElement|null;if(box){const setter=Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,"value")?.set;setter?.call(box,value);box.dispatchEvent(new Event("input",{bubbles:true}));}}

export default function SmartDisplayEditorEnhancer(){
  useEffect(()=>{
    let active:Device|null=null;
    const clickCapture=(e:MouseEvent)=>{
      const t=e.target as HTMLElement|null;
      if(t?.tagName==="BUTTON"&&(t.textContent||"").includes("Manage live")){
        const code=t.closest("article")?.textContent?.match(/\b\d{6}\b/)?.[0];
        if(code)active=devices().find(d=>d.code===code)||null;
      }
    };
    document.addEventListener("click",clickCapture,true);

    const render=()=>{
      if(!editorOpen()){document.querySelectorAll("[data-smart-display-controls='1']").forEach(x=>x.remove());active=null;return}
      active=active||findActive();if(!active)return;
      const h=Array.from(document.querySelectorAll<HTMLHeadingElement>("h3")).find(x=>["Mosque & display identity","Clock & date","Next prayer","Prayer table & Iqama","Announcements","Qur’an verse / reminder","Donation / website panel","Layout & appearance"].some(v=>(x.textContent||"").includes(v)));
      if(!h||!h.parentElement)return;
      const host=h.parentElement;const key=(h.textContent||"").trim();
      const old=document.querySelector<HTMLElement>("[data-smart-display-controls='1']");
      if(old?.dataset.section===key&&old.parentElement===host)return;
      old?.remove();
      const panel=document.createElement("section");panel.dataset.smartDisplayControls="1";panel.dataset.section=key;panel.style.cssText="margin:0 0 14px;padding:12px;border:1px solid #6b7f79;border-radius:12px;background:#0b3b33;display:grid;gap:9px";
      const title=document.createElement("strong");title.textContent="✨ Smart controls";title.style.color="#f1c86f";panel.appendChild(title);
      const status=document.createElement("div");status.style.cssText="font-size:12px;color:#a8c2b9;min-height:16px";panel.appendChild(status);
      const row=document.createElement("div");row.style.cssText="display:flex;gap:8px;flex-wrap:wrap";panel.appendChild(row);
      const run=async(label:string,fn:()=>Promise<void>)=>{status.textContent=label;try{await fn();status.textContent="Live · updated on display"}catch(err){status.textContent=err instanceof Error?err.message:"Could not update"}};

      if(key.includes("Qur’an verse")){
        const manual=btn("Manual");manual.onclick=()=>void run("Switching to manual…",async()=>{await patch(active!,{verseMode:"manual"})});row.appendChild(manual);
        const daily=btn("Daily Auto");daily.onclick=()=>void run("Enabling daily verse…",async()=>{await patch(active!,{verseMode:"daily",showVerse:true})});row.appendChild(daily);
        const ai=btn("Ask AI");row.appendChild(ai);
        const q=document.createElement("textarea");q.placeholder="Describe what you want, e.g. a verse about patience during hardship";q.style.cssText="width:100%;min-height:72px;padding:10px;border-radius:10px;border:1px solid #56776e;background:#082b26;color:white;font-size:16px";panel.appendChild(q);
        const results=document.createElement("div");results.style.cssText="display:grid;gap:8px";panel.appendChild(results);
        ai.onclick=async()=>{const topic=q.value.trim();if(topic.length<3){status.textContent="Describe the topic first";return}status.textContent="Hassoun AI is finding verses…";results.innerHTML="";try{const r=await fetch(`${API}/masjid-displays/ai/verse`,{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${active!.token}`},body:JSON.stringify({deviceId:active!.id,topic})});const d=await r.json() as {options?:Array<{text:string;reference:string}>;error?:string;source?:string};if(!r.ok)throw new Error(d.error||"AI request failed");status.textContent=d.source==="ai"?"AI suggestions ready":"Curated suggestions ready";(d.options||[]).forEach(opt=>{const b=btn(`${opt.reference} — ${opt.text}`);b.style.whiteSpace="normal";b.style.textAlign="left";b.onclick=()=>void run("Publishing verse…",async()=>{const value=`${opt.text} — ${opt.reference}`;await patch(active!,{verseMode:"manual",verseText:value,showVerse:true});setTextArea(value)});results.appendChild(b)})}catch(err){status.textContent=err instanceof Error?err.message:"AI request failed"}};
      }else if(key.includes("Clock")){
        const b=btn("Automatic local clock");b.onclick=()=>void run("Enabling automatic clock…",async()=>{await patch(active!,{clockMode:"local",showClock:true,showDate:true})});row.appendChild(b);
      }else if(key.includes("Next prayer")||key.includes("Prayer table")){
        const b=btn("Auto from prayer schedule");b.onclick=()=>void run("Using prayer schedule…",async()=>{await patch(active!,{prayerMode:"auto",showNextPrayer:true,showPrayerCards:true})});row.appendChild(b);
      }else if(key.includes("Announcements")){
        const b=btn("Auto rotate announcements");b.onclick=()=>void run("Enabling rotation…",async()=>{await patch(active!,{announcementMode:"rotate",showAnnouncements:true})});row.appendChild(b);
      }else if(key.includes("Donation")){
        const b=btn("Smart donation panel");b.onclick=()=>void run("Optimizing donation panel…",async()=>{await patch(active!,{showDonation:true,donationMode:"smart"})});row.appendChild(b);
      }else if(key.includes("Layout")){
        for(const [label,bg,card,accent] of [["Emerald & Gold","#063d34","#0a5548","#e7bd59"],["Midnight","#071b24","#102e3b","#d4b46b"],["Warm Mosque","#3a2d21","#57432e","#e1bf72"]]){const b=btn(label);b.onclick=()=>void run("Applying theme…",async()=>{await patch(active!,{backgroundColor:bg,cardColor:card,accentColor:accent})});row.appendChild(b)}
      }else{
        const b=btn("Keep this section synced automatically");b.onclick=()=>void run("Enabling smart sync…",async()=>{await patch(active!,{smartIdentity:true})});row.appendChild(b);
      }
      host.insertBefore(panel,h);
    };
    const timer=window.setInterval(render,400);render();
    return()=>{window.clearInterval(timer);document.removeEventListener("click",clickCapture,true);document.querySelectorAll("[data-smart-display-controls='1']").forEach(x=>x.remove())};
  },[]);
  return null;
}
