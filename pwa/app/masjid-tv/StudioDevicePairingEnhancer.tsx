"use client";

import { useEffect } from "react";

const API = "https://wopt-prayer-push.wopt-windsor.workers.dev";
const DEVICE_ID_KEY = "hassoun:masjid-display:id";
const DEVICE_CODE_KEY = "hassoun:masjid-display:code";
const DEVICE_NAME_KEY = "hassoun:masjid-display:name";
const DEVICE_SECRET_KEY = "hassoun:masjid-display:secret";
const DEVICE_REV_KEY = "hassoun:masjid-display:revision";
const SETTINGS_KEY = "hassoun:web-masjid-tv:v2";

function randomHex(bytesCount:number) {
  try { const bytes=new Uint8Array(bytesCount); crypto.getRandomValues(bytes); return Array.from(bytes).map(v=>v.toString(16).padStart(2,"0")).join(""); }
  catch { return `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`; }
}
function makeId() { return randomHex(12); }
function makeCode() { try { const bytes=new Uint32Array(1); crypto.getRandomValues(bytes); return String(100000+(bytes[0]%900000)); } catch { return String(Math.floor(100000+Math.random()*900000)); } }

type Device = { id:string; code:string; name:string; secret:string };

export default function StudioDevicePairingEnhancer() {
  useEffect(() => {
    let destroyed=false;
    let pollTimer=0;

    const ensureDevice = ():Device => {
      let id="",code="",name="",secret="";
      try {
        id=localStorage.getItem(DEVICE_ID_KEY)||""; code=localStorage.getItem(DEVICE_CODE_KEY)||""; name=localStorage.getItem(DEVICE_NAME_KEY)||""; secret=localStorage.getItem(DEVICE_SECRET_KEY)||"";
        if(!id){id=makeId();localStorage.setItem(DEVICE_ID_KEY,id)}
        if(!code){code=makeCode();localStorage.setItem(DEVICE_CODE_KEY,code)}
        if(!name){name="Masjid Display";localStorage.setItem(DEVICE_NAME_KEY,name)}
        if(!secret){secret=randomHex(24);localStorage.setItem(DEVICE_SECRET_KEY,secret)}
      } catch { id=makeId();code=makeCode();name="Masjid Display";secret=randomHex(24); }
      return {id,code,name,secret};
    };

    const localSettings=()=>{try{return JSON.parse(localStorage.getItem(SETTINGS_KEY)||"{}") as Record<string,unknown>}catch{return {}}};

    const register=async(device:Device)=>{
      try{
        const r=await fetch(`${API}/masjid-displays/register`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({deviceId:device.id,pairCode:device.code,deviceSecret:device.secret,name:device.name,settings:localSettings()})});
        if(r.ok){const d=await r.json() as {revision?:number};if(typeof d.revision==="number")localStorage.setItem(DEVICE_REV_KEY,String(d.revision));}
      }catch{}
    };

    const poll=async(device:Device)=>{
      try{
        const r=await fetch(`${API}/masjid-displays/device/${encodeURIComponent(device.id)}?secret=${encodeURIComponent(device.secret)}`,{cache:"no-store"});
        if(r.status===404){await register(device);return;}
        if(!r.ok)return;
        const data=await r.json() as {name?:string;settings?:Record<string,unknown>;revision?:number;pairCode?:string};
        if(data.pairCode&&/^\d{6}$/.test(data.pairCode)&&data.pairCode!==device.code){localStorage.setItem(DEVICE_CODE_KEY,data.pairCode);device.code=data.pairCode;}
        if(data.name&&data.name!==device.name){localStorage.setItem(DEVICE_NAME_KEY,data.name);device.name=data.name;}
        const seen=Number(localStorage.getItem(DEVICE_REV_KEY)||"0");
        if(typeof data.revision==="number"&&data.revision>seen&&data.settings&&typeof data.settings==="object"){
          const incoming=JSON.stringify(data.settings); const current=localStorage.getItem(SETTINGS_KEY)||"{}";
          localStorage.setItem(DEVICE_REV_KEY,String(data.revision));
          if(incoming!==current){localStorage.setItem(SETTINGS_KEY,incoming);location.reload();return;}
        }
      }catch{}
    };

    const device=ensureDevice();
    void poll(device).then(()=>register(device));
    const loop=async()=>{if(destroyed)return;await poll(device);pollTimer=window.setTimeout(loop,3000)};
    pollTimer=window.setTimeout(loop,3000);

    const findStudio=()=>{
      const heading=Array.from(document.querySelectorAll<HTMLElement>("h1,h2,h3,strong")).find(el=>(el.textContent||"").trim()==="Masjid Display Studio");
      if(!heading)return null;let node:HTMLElement|null=heading;
      for(let i=0;i<8&&node;i++,node=node.parentElement){const r=node.getBoundingClientRect();if(r.height>window.innerHeight*.55&&r.width>window.innerWidth*.45)return node;}
      return heading.parentElement;
    };

    const makePairCard=(studio:HTMLElement)=>{
      if(studio.querySelector('[data-hassoun-display-pairing="1"]'))return;
      const pairUrl=`${location.origin}/masjid-tv/pair/?device=${encodeURIComponent(device.id)}&code=${encodeURIComponent(device.code)}`;
      const qrUrl=`https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=8&data=${encodeURIComponent(pairUrl)}`;
      const card=document.createElement("section");card.dataset.hassounDisplayPairing="1";card.className="hassoun-display-pairing";
      card.innerHTML=`<div class="hdp-copy"><span class="hdp-kicker">DEVICE PAIRING</span><h3>Connect this display to Hassoun</h3><p>From any computer, phone, tablet, or Hassoun app, scan this QR or open Hassoun Display Pairing and enter the 6-digit code. Paired controllers can change this display remotely.</p><label class="hdp-name-label">Display name<input class="hdp-name" value="${device.name.replace(/&/g,"&amp;").replace(/"/g,"&quot;").replace(/</g,"&lt;")}" maxlength="40" aria-label="Display name" /></label><div class="hdp-code-label">PAIRING CODE</div><div class="hdp-code">${device.code}</div><div class="hdp-device">Device ID: ${device.id.slice(0,8).toUpperCase()}…${device.id.slice(-4).toUpperCase()}</div><a class="hdp-manage" href="/masjid-tv/devices/">Manage connected displays</a></div><div class="hdp-qr-wrap"><img class="hdp-qr" src="${qrUrl}" alt="QR code to connect this display to Hassoun" /><span>Scan to connect</span></div>`;
      card.querySelector<HTMLInputElement>(".hdp-name")?.addEventListener("change",async e=>{const input=e.currentTarget;const value=(input.value||"Masjid Display").trim().slice(0,40)||"Masjid Display";input.value=value;device.name=value;try{localStorage.setItem(DEVICE_NAME_KEY,value)}catch{}await register(device)});
      const heading=Array.from(studio.querySelectorAll<HTMLElement>("h1,h2,h3")).find(el=>(el.textContent||"").trim()==="Masjid Display Studio");const intro=heading?.nextElementSibling;if(intro?.parentElement)intro.insertAdjacentElement("afterend",card);else if(heading?.parentElement)heading.insertAdjacentElement("afterend",card);else studio.prepend(card);
    };

    const makeScrollable=(studio:HTMLElement)=>{
      if(studio.dataset.hassounRemoteScroll==="1")return;studio.dataset.hassounRemoteScroll="1";studio.tabIndex=studio.tabIndex<0?0:studio.tabIndex;
      Object.assign(studio.style,{overflowY:"auto",overscrollBehavior:"contain",WebkitOverflowScrolling:"touch",maxHeight:"94vh",scrollBehavior:"smooth"});
      studio.addEventListener("keydown",event=>{const target=event.target as HTMLElement|null;if(target&&/INPUT|TEXTAREA|SELECT/.test(target.tagName))return;const step=Math.max(180,Math.round(studio.clientHeight*.42));let delta=0;if(event.key==="ArrowDown")delta=110;else if(event.key==="ArrowUp")delta=-110;else if(event.key==="PageDown")delta=step;else if(event.key==="PageUp")delta=-step;else if(event.key==="Home"){studio.scrollTop=0;event.preventDefault();return}else if(event.key==="End"){studio.scrollTop=studio.scrollHeight;event.preventDefault();return}else return;studio.scrollTop+=delta;event.preventDefault()});
      try{studio.focus({preventScroll:true})}catch{studio.focus()}
    };

    const enhance=()=>{const studio=findStudio();if(!studio)return;makeScrollable(studio);makePairCard(studio)};
    enhance();const observer=new MutationObserver(enhance);observer.observe(document.documentElement,{childList:true,subtree:true});
    return()=>{destroyed=true;window.clearTimeout(pollTimer);observer.disconnect()};
  }, []);

  return <style>{`.hassoun-display-pairing{margin:18px 0 26px;padding:20px;border:1px solid rgba(126,214,190,.34);border-radius:18px;background:linear-gradient(135deg,#0b3f36,#102d2a);color:#f7f5eb;display:grid;grid-template-columns:minmax(0,1fr) 210px;gap:22px;align-items:center;box-shadow:0 10px 30px rgba(0,0,0,.18)}.hdp-kicker{font-size:11px;letter-spacing:2px;color:#d9b36b;font-weight:900}.hassoun-display-pairing h3{margin:5px 0 7px;font-size:22px}.hassoun-display-pairing p{margin:0 0 14px;color:#cbd8d3;line-height:1.45;max-width:760px}.hdp-name-label{display:block;font-size:12px;font-weight:800;color:#d8e1dd;margin:0 0 12px}.hdp-name{display:block;width:min(420px,100%);margin-top:6px;padding:11px 12px;border-radius:10px;border:1px solid #52766c;background:#092e28;color:white;font-size:16px}.hdp-code-label{font-size:10px;letter-spacing:2px;color:#8fb8ac;font-weight:900}.hdp-code{font-size:38px;letter-spacing:9px;font-weight:900;color:#f1c86f;line-height:1.1;margin:5px 0}.hdp-device{font-size:11px;color:#8fb8ac;margin-bottom:12px}.hdp-manage{display:inline-block;color:#fff7d9;text-decoration:none;font-weight:800;border:1px solid #9a814c;border-radius:999px;padding:9px 14px}.hdp-qr-wrap{text-align:center}.hdp-qr{display:block;width:180px;height:180px;background:white;padding:6px;border-radius:12px;margin:0 auto 8px}.hdp-qr-wrap span{font-size:12px;color:#cbd8d3;font-weight:800}@media(max-width:760px){.hassoun-display-pairing{grid-template-columns:1fr}.hdp-qr-wrap{justify-self:start}.hdp-qr{width:150px;height:150px}}`}</style>;
}
