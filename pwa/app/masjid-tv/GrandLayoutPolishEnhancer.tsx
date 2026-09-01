"use client";

import {useEffect} from "react";

const STORAGE="hassoun:web-masjid-tv:v2";
const PRAYERS=[
  {en:"Fajr",ar:"الفجر",icon:"🌅"},
  {en:"Dhuhr",ar:"الظهر",icon:"☀️"},
  {en:"Asr",ar:"العصر",icon:"🌤️"},
  {en:"Maghrib",ar:"المغرب",icon:"🌇"},
  {en:"Isha",ar:"العشاء",icon:"🌙"},
];
const ANN_ICONS=["📖","🤝","🧑‍🤝‍🧑","📣"];

function readSettings(){try{return JSON.parse(localStorage.getItem(STORAGE)||"{}") as Record<string,any>}catch{return {}}}
function findGrandPanel(root:HTMLElement){return Array.from(root.querySelectorAll<HTMLElement>("div")).find(x=>x.style.left==="46.2%"&&x.style.width==="49.8%")||null}

export default function GrandLayoutPolishEnhancer(){
  useEffect(()=>{
    const sync=()=>{
      const root=document.querySelector<HTMLElement>(".pixel-replica-one");
      if(!root)return;
      root.dataset.grandPolished="1";

      // Prayer names: bold English on top, gold Arabic calligraphy underneath.
      const prayerRows=Array.from(root.querySelectorAll<HTMLElement>("div")).filter(row=>row.style.height==="18%"&&!!row.querySelector("strong")&&row.querySelectorAll("span").length>=3).slice(0,5);
      prayerRows.forEach((row,i)=>{
        const p=PRAYERS[i];if(!p)return;
        const spans=row.querySelectorAll<HTMLElement>("span");
        const icon=spans[0];const name=row.querySelector<HTMLElement>("strong");
        if(icon){icon.textContent=p.icon;icon.style.color="#f1c86f";icon.style.fontSize="1.35vw";icon.style.top="30%"}
        if(name){
          name.style.top="11%";name.style.left="10%";name.style.height="76%";name.style.display="flex";name.style.flexDirection="column";name.style.justifyContent="center";name.style.gap=".08vw";name.style.lineHeight="1";
          name.innerHTML=`<span style="font-family:Arial,Helvetica,sans-serif;font-size:1.13vw;font-weight:800;color:#fff;line-height:1.05">${p.en}</span><span lang="ar" dir="rtl" style="display:block;width:max-content;max-width:10vw;font-family:'Aref Ruqaa','Arabic Typesetting','Traditional Arabic','Amiri','Scheherazade New','Noto Naskh Arabic',serif;font-size:1.34vw;font-weight:700;color:#e8bd62;line-height:1.18;white-space:nowrap">${p.ar}</span>`;
        }
      });

      // Make the next-prayer strip feel more Islamic and visually clear.
      const hero=Array.from(root.querySelectorAll<HTMLElement>("div")).find(x=>x.style.top==="22%"&&x.style.height==="11.5%");
      if(hero){
        const circles=Array.from(hero.querySelectorAll<HTMLElement>("div")).filter(x=>x.style.borderRadius==="50%"&&x.style.width==="3.2vw");
        if(circles[0]){circles[0].textContent="🕌";circles[0].style.fontSize="1.35vw"}
        if(circles[1]){circles[1].textContent="⏳";circles[1].style.fontSize="1.25vw"}
      }

      // Quran reminder gets a visible Islamic/book cue.
      const verse=Array.from(root.querySelectorAll<HTMLElement>("div")).find(x=>x.style.right==="4.3%"&&x.style.top==="9.7%");
      if(verse&&!verse.dataset.iconized){verse.dataset.iconized="1";verse.textContent=`📖 ${verse.textContent||""}`}

      const panel=findGrandPanel(root);
      if(panel){
        // Announcement icons.
        const annIcons=Array.from(panel.querySelectorAll<HTMLElement>("div")).filter(x=>x.style.borderRadius==="50%"&&x.style.width==="2.8vw").slice(0,4);
        annIcons.forEach((x,i)=>{x.textContent=ANN_ICONS[i]||"✨";x.style.fontSize="1.05vw";x.style.color="#f1c86f"});

        // Donation panel: much larger scan-ready QR and a support icon.
        const supportTitle=Array.from(panel.querySelectorAll<HTMLElement>("div")).find(x=>(x.textContent||"").trim().toUpperCase()==="SUPPORT YOUR MASJID");
        if(supportTitle&&!supportTitle.dataset.iconized){supportTitle.dataset.iconized="1";supportTitle.textContent="🤲 SUPPORT YOUR MASJID"}
        const qr=panel.querySelector<HTMLImageElement>("img[data-hassoun-donation-qr='1']");
        const qrHost=qr?.parentElement as HTMLElement|null;
        if(qrHost){
          qrHost.style.left="77.2%";qrHost.style.top="31%";qrHost.style.width="10.2vw";qrHost.style.height="10.2vw";qrHost.style.lineHeight="normal";qrHost.style.padding=".35vw";qrHost.style.boxSizing="border-box";
          if(qr){qr.style.width="100%";qr.style.height="100%";qr.style.maxWidth="100%";qr.style.padding=".2vw";qr.style.margin="0";qr.style.boxSizing="border-box"}
        }
        const orNode=Array.from(panel.querySelectorAll<HTMLElement>("div")).find(x=>(x.textContent||"").trim()==="OR");if(orNode)orNode.style.top="72%";
        const visitNode=Array.from(panel.querySelectorAll<HTMLElement>("div")).find(x=>(x.textContent||"").trim()==="Visit our website");if(visitNode)visitNode.style.top="79%";

        // Reserve a clean area for Jumu'ah beneath announcements.
        const annList=Array.from(panel.children).find((x:any)=>x instanceof HTMLElement&&x.style.left==="3%"&&x.style.width==="67%") as HTMLElement|undefined;
        if(annList)annList.style.height="60%";
        let jumuah=panel.querySelector<HTMLElement>("[data-grand-jumuah='1']");
        const settings=readSettings();const times=Array.isArray(settings.jumuah)?settings.jumuah.filter((j:any)=>String(j?.time||"").trim()):[];
        if(settings.showJumuah===false){jumuah?.remove()}else{
          if(!jumuah){jumuah=document.createElement("div");jumuah.dataset.grandJumuah="1";jumuah.style.cssText="position:absolute;left:3%;bottom:3%;width:67%;height:15%;border:1px solid rgba(217,179,107,.75);border-radius:12px;background:rgba(4,77,64,.82);display:flex;align-items:center;gap:1vw;padding:.55vw .8vw;box-sizing:border-box;color:#fff;overflow:hidden";panel.appendChild(jumuah)}
          const value=times.length?times.slice(0,2).map((j:any)=>`${String(j.label||"Jumu’ah")} · ${String(j.time)}`).join("   •   "):"Jumu’ah time not set";
          jumuah.innerHTML=`<span style="font-size:1.55vw">🕌</span><div style="min-width:0"><strong style="display:block;color:#f1c86f;font-size:.95vw;letter-spacing:.08em">JUMU’AH • الجمعة</strong><span style="display:block;margin-top:.18vw;font-size:.88vw;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${value}</span></div>`;
        }
      }
    };
    sync();const timer=window.setInterval(sync,450);const observer=new MutationObserver(sync);observer.observe(document.documentElement,{childList:true,subtree:true});return()=>{window.clearInterval(timer);observer.disconnect()};
  },[]);
  return null;
}
