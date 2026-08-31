"use client";

import { useEffect } from "react";

const API="https://wopt-prayer-push.wopt-windsor.workers.dev";
const LIST_KEY="hassoun:paired-displays:v2";
type Device={id:string;code:string;name:string;token:string;pairedAt:string};

function devices():Device[]{try{return JSON.parse(localStorage.getItem(LIST_KEY)||"[]") as Device[]}catch{return []}}
function activeDevice():Device|null{
  const card=Array.from(document.querySelectorAll<HTMLElement>("article,section,div")).find(el=>/\b\d{6}\b/.test(el.textContent||"")&&Array.from(el.querySelectorAll("button")).some(b=>(b.textContent||"").includes("Manage live")));
  const code=card?.textContent?.match(/\b\d{6}\b/)?.[0];
  if(code)return devices().find(d=>d.code===code)||devices()[0]||null;
  return devices()[0]||null;
}
async function load(d:Device){const r=await fetch(`${API}/masjid-displays/control/${encodeURIComponent(d.id)}`,{headers:{Authorization:`Bearer ${d.token}`},cache:"no-store"});if(!r.ok)throw new Error("Could not load display");return await r.json() as {name:string;settings:Record<string,unknown>}}
async function patch(d:Device,key:string,value:boolean){const current=await load(d);const r=await fetch(`${API}/masjid-displays/control/${encodeURIComponent(d.id)}`,{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${d.token}`},body:JSON.stringify({name:current.name,settings:{...current.settings,[key]:value}})});if(!r.ok)throw new Error("Could not update display")}

function hijriParts(now=new Date()){
  const parts=new Intl.DateTimeFormat("en-u-ca-islamic",{day:"numeric",month:"numeric",year:"numeric"}).formatToParts(now);
  const n=(t:string)=>Number(parts.find(p=>p.type===t)?.value||0);
  return {day:n("day"),month:n("month"),year:n("year")};
}
function islamicEvent(){
  const {day,month}=hijriParts();
  if(month===1&&day===1)return "Islamic New Year";
  if(month===1&&day===10)return "Ashura";
  if(month===9&&day===1)return "Ramadan begins";
  if(month===9&&day===27)return "Laylat al-Qadr";
  if(month===10&&day===1)return "Eid al-Fitr";
  if(month===12&&day===9)return "Day of Arafah";
  if(month===12&&day===10)return "Eid al-Adha";
  return "";
}

export default function IslamicCalendarControls(){
  useEffect(()=>{
    let lastClockHost:HTMLElement|null=null;
    let stopped=false;
    const render=async()=>{
      if(stopped)return;
      const heading=Array.from(document.querySelectorAll<HTMLHeadingElement>("h3")).find(h=>(h.textContent||"").includes("Clock & date"));
      const host=heading?.parentElement as HTMLElement|null;
      if(!host)return;
      if(host===lastClockHost&&host.querySelector("[data-islamic-calendar-controls='1']"))return;
      lastClockHost=host;
      host.querySelector("[data-islamic-calendar-controls='1']")?.remove();
      const d=activeDevice();if(!d)return;
      let settings:Record<string,unknown>={};try{settings=(await load(d)).settings||{}}catch{return}
      const panel=document.createElement("div");panel.dataset.islamicCalendarControls="1";panel.style.cssText="display:grid;gap:10px;padding:12px;border:1px solid #46675e;border-radius:12px;background:#0a332c;margin-top:4px";
      const title=document.createElement("strong");title.textContent="Islamic calendar";title.style.color="#e7bd59";panel.appendChild(title);
      const make=(key:string,label:string,initial:boolean)=>{
        const row=document.createElement("label");row.style.cssText="display:flex;gap:9px;align-items:center;font-weight:800;cursor:pointer";
        const input=document.createElement("input");input.type="checkbox";input.checked=initial;input.onchange=()=>{void patch(d,key,input.checked);syncPreview(key,input.checked)};
        row.append(input,document.createTextNode(label));panel.appendChild(row);
      };
      make("showHijriDate","Show Hijri date",settings.showHijriDate!==false);
      make("showIslamicEvents","Show Islamic holidays / events",settings.showIslamicEvents!==false);
      const note=document.createElement("small");note.textContent="Islamic events only appear on relevant dates.";note.style.color="#9bb5ad";panel.appendChild(note);
      host.appendChild(panel);
      syncPreview("showHijriDate",settings.showHijriDate!==false);
      syncPreview("showIslamicEvents",settings.showIslamicEvents!==false);
    };
    const previewState={showHijriDate:true,showIslamicEvents:true};
    const syncPreview=(key:string,value:boolean)=>{
      (previewState as Record<string,boolean>)[key]=value;
      const clockHeading=Array.from(document.querySelectorAll<HTMLHeadingElement>("h3")).find(h=>(h.textContent||"").includes("Clock & date"));
      const editor=clockHeading?.closest("section,article,div")?.parentElement?.parentElement || document.body;
      const buttons=Array.from(editor.querySelectorAll<HTMLButtonElement>("button"));
      const clock=buttons.find(b=>/\d{1,2}:\d{2}:\d{2}\s?(AM|PM)/i.test(b.textContent||""));if(!clock)return;
      let extra=clock.querySelector<HTMLElement>("[data-preview-islamic-line='1']");
      if(!extra){extra=document.createElement("small");extra.dataset.previewIslamicLine="1";extra.style.cssText="display:block;margin-top:3px;font-size:10px;opacity:.9";clock.appendChild(extra)}
      const now=new Date();const hijri=new Intl.DateTimeFormat("en-u-ca-islamic",{day:"numeric",month:"long",year:"numeric"}).format(now);const event=islamicEvent();
      const bits:string[]=[];if(previewState.showHijriDate)bits.push(hijri);if(previewState.showIslamicEvents&&event)bits.push(event);extra.textContent=bits.join(" • ");extra.style.display=bits.length?"block":"none";
    };
    const timer=window.setInterval(()=>void render(),700);void render();
    return()=>{stopped=true;window.clearInterval(timer);document.querySelectorAll("[data-islamic-calendar-controls='1']").forEach(n=>n.remove())};
  },[]);
  return null;
}
