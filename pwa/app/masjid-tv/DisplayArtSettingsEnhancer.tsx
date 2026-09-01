"use client";

import {useEffect} from "react";

const API="https://wopt-prayer-push.wopt-windsor.workers.dev";
const LIST_KEY="hassoun:paired-displays:v2";
type Device={id:string;code:string;name:string;token:string;pairedAt:string};
type Remote={name:string;settings:Record<string,any>;revision?:number};
const PRAYERS=["fajr","dhuhr","asr","maghrib","isha"] as const;
const LABELS:{[k:string]:string}={fajr:"Fajr",dhuhr:"Dhuhr",asr:"Asr",maghrib:"Maghrib",isha:"Isha"};
const iconKey=(p:string)=>`show${p.charAt(0).toUpperCase()+p.slice(1)}Icon`;

function devices():Device[]{try{return JSON.parse(localStorage.getItem(LIST_KEY)||"[]")}catch{return[]}}
function activeDevice():Device|null{const list=devices();if(!list.length)return null;const saved=sessionStorage.getItem("hassoun:studio-active-display-code");if(saved){const d=list.find(x=>x.code===saved);if(d)return d}const code=document.body.textContent?.match(/\b\d{6}\b/)?.[0];return(code?list.find(x=>x.code===code):null)||list[0]||null}
async function load(device:Device){const r=await fetch(`${API}/masjid-displays/control/${encodeURIComponent(device.id)}`,{headers:{Authorization:`Bearer ${device.token}`},cache:"no-store"});if(!r.ok)throw new Error("Could not load display settings");return await r.json() as Remote}
async function save(device:Device,remote:Remote,patch:Record<string,any>){const next={...remote,settings:{...remote.settings,...patch}};const r=await fetch(`${API}/masjid-displays/control/${encodeURIComponent(device.id)}`,{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${device.token}`},body:JSON.stringify({name:next.name,settings:next.settings})});if(!r.ok)throw new Error("Could not save display settings");return next}
function inputByLabel(prefix:string){const labels=Array.from(document.querySelectorAll("label"));const label=labels.find(x=>(x.textContent||"").trim().toLowerCase().startsWith(prefix.toLowerCase()));return label?.querySelector("input") as HTMLInputElement|null}

async function removeSolidBackground(src:string):Promise<string>{
 return await new Promise((resolve,reject)=>{const img=new Image();if(/^https?:/i.test(src))img.crossOrigin="anonymous";img.onerror=()=>reject(new Error("Logo could not be processed"));img.onload=()=>{const max=640,scale=Math.min(1,max/Math.max(img.width,img.height)),w=Math.max(1,Math.round(img.width*scale)),h=Math.max(1,Math.round(img.height*scale));const c=document.createElement("canvas");c.width=w;c.height=h;const x=c.getContext("2d",{willReadFrequently:true});if(!x)return reject(new Error("Image processing unavailable"));x.drawImage(img,0,0,w,h);try{const data=x.getImageData(0,0,w,h),p=data.data;const pts:Array<[number,number]>=[[0,0],[w-1,0],[0,h-1],[w-1,h-1],[Math.floor(w/2),0],[Math.floor(w/2),h-1]];let rr=0,gg=0,bb=0,n=0;for(const [px,py] of pts){const i=(py*w+px)*4;if((p[i+3]??0)<20)continue;rr+=(p[i]??0);gg+=(p[i+1]??0);bb+=(p[i+2]??0);n++}if(!n)return resolve(c.toDataURL("image/png"));rr/=n;gg/=n;bb/=n;const hard=38,soft=82;for(let i=0;i<p.length;i+=4){const pr=p[i]??0,pg=p[i+1]??0,pb=p[i+2]??0,pa=p[i+3]??0;const d=Math.sqrt((pr-rr)**2+(pg-gg)**2+(pb-bb)**2);if(d<=hard)p[i+3]=0;else if(d<soft)p[i+3]=Math.round(pa*((d-hard)/(soft-hard)))}x.putImageData(data,0,0);resolve(c.toDataURL("image/png"))}catch(e){reject(e)}};img.src=src})
}

export default function DisplayArtSettingsEnhancer(){
 useEffect(()=>{
  if(!location.pathname.includes("/masjid-tv/devices"))return;
  let stopped=false;
  const enhance=async()=>{
   if(stopped)return;const device=activeDevice();if(!device)return;
   const identityHeading=Array.from(document.querySelectorAll("h3")).find(h=>(h.textContent||"").includes("Mosque & display identity"));
   const prayerHeading=Array.from(document.querySelectorAll("h3")).find(h=>(h.textContent||"").includes("Prayer table & Iqama"));
   if(!identityHeading&&!prayerHeading)return;
   let remote:Remote;try{remote=await load(device)}catch{return}

   if(identityHeading&&!identityHeading.parentElement?.querySelector("[data-logo-art-settings='1']")){
    const host=identityHeading.parentElement!;const box=document.createElement("section");box.dataset.logoArtSettings="1";box.style.cssText="display:grid;gap:10px;padding:12px;border:1px solid #4b6e64;border-radius:12px;background:#082f2a";
    box.innerHTML=`<strong style="color:#efc56a">Logo appearance</strong><div style="display:flex;gap:8px;flex-wrap:wrap"><button type="button" data-logo-mode="original">Original</button><button type="button" data-logo-mode="removed">Remove background</button></div><small style="color:#9fc1b6">Background removal works best with a plain or mostly solid logo background.</small><div data-logo-mode-status style="color:#aee5bf;font-size:12px"></div>`;
    host.appendChild(box);const status=box.querySelector<HTMLElement>("[data-logo-mode-status]")!;
    const styleButtons=()=>box.querySelectorAll<HTMLButtonElement>("button").forEach(b=>{const on=String(remote.settings.logoBackgroundMode||"original")===b.dataset.logoMode;b.style.cssText=`padding:9px 13px;border-radius:999px;border:1px solid #d9b36b;background:${on?'#d9b36b':'transparent'};color:${on?'#102c25':'#fff'};font-weight:800;cursor:pointer`});styleButtons();
    box.querySelectorAll<HTMLButtonElement>("button").forEach(b=>b.onclick=async()=>{const mode=b.dataset.logoMode||"original";try{status.textContent=mode==="removed"?"Removing background…":"Saving…";const url=inputByLabel("logo url")?.value.trim()||String(remote.settings.logoUrl||"");const patch:Record<string,any>={logoBackgroundMode:mode};if(mode==="removed"&&url)patch.logoBackgroundRemovedUrl=await removeSolidBackground(url);remote=await save(device,remote,patch);styleButtons();status.textContent=mode==="removed"?"Background-removed logo selected.":"Original logo selected.";window.dispatchEvent(new Event("hassoun-display-art-updated"))}catch(e){status.textContent=e instanceof Error?e.message:"Could not update logo"}});
   }

   if(prayerHeading&&!prayerHeading.parentElement?.querySelector("[data-prayer-art-settings='1']")){
    const host=prayerHeading.parentElement!;const box=document.createElement("section");box.dataset.prayerArtSettings="1";box.style.cssText="display:grid;gap:11px;padding:12px;border:1px solid #4b6e64;border-radius:12px;background:#082f2a";
    const checked=(k:string)=>remote.settings[k]!==false?"checked":"";box.innerHTML=`<strong style="color:#efc56a">Prayer artwork</strong><label style="font-weight:800"><input data-art-key="showPrayerIcons" type="checkbox" ${checked("showPrayerIcons")}/> Show prayer icons</label><label style="font-weight:800"><input data-art-key="showArabicPrayerNames" type="checkbox" ${checked("showArabicPrayerNames")}/> Show Arabic prayer names</label><div><span style="display:block;margin-bottom:6px">Icon style</span><select data-icon-style style="width:100%;padding:9px;border-radius:9px;background:#082b26;color:white;border:1px solid #56776e"><option value="arch">Islamic arch</option><option value="rosette">Gold rosette</option><option value="minimal">Modern line</option></select></div><div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px">${PRAYERS.map(p=>`<label><input data-art-key="${iconKey(p)}" type="checkbox" ${checked(iconKey(p))}/> ${LABELS[p]} icon</label>`).join("")}</div><small style="color:#9fc1b6">These controls affect the display artwork only. No controls appear on the Masjid screen.</small><div data-prayer-art-status style="color:#aee5bf;font-size:12px"></div>`;
    host.insertBefore(box,prayerHeading.nextSibling);const sel=box.querySelector<HTMLSelectElement>("[data-icon-style]")!;sel.value=String(remote.settings.prayerIconStyle||"arch");const status=box.querySelector<HTMLElement>("[data-prayer-art-status]")!;
    const persist=async(patch:Record<string,any>)=>{try{status.textContent="Saving…";remote=await save(device,remote,patch);status.textContent="Live · artwork updated";window.dispatchEvent(new Event("hassoun-display-art-updated"))}catch(e){status.textContent=e instanceof Error?e.message:"Could not save artwork"}};
    box.querySelectorAll<HTMLInputElement>("input[data-art-key]").forEach(i=>i.onchange=()=>void persist({[i.dataset.artKey!]:i.checked}));sel.onchange=()=>void persist({prayerIconStyle:sel.value});
   }
  };
  void enhance();const timer=window.setInterval(()=>void enhance(),900);return()=>{stopped=true;window.clearInterval(timer);document.querySelectorAll("[data-logo-art-settings='1'],[data-prayer-art-settings='1']").forEach(x=>x.remove())};
 },[]);
 return null;
}
