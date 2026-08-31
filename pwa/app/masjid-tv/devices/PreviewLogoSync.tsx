"use client";

import { useEffect } from "react";

function isLogoSource(value:string){return /^data:image\/(png|jpeg|jpg|webp|svg\+xml);base64,/i.test(value)||/^https?:\/\//i.test(value)}

function fieldByLabel(label:string){
  const labels=Array.from(document.querySelectorAll<HTMLLabelElement>("label"));
  const hit=labels.find(l=>(l.textContent||"").trim().toLowerCase().startsWith(label.toLowerCase()));
  return hit?.querySelector<HTMLInputElement>("input,textarea")||null;
}

function findIdentityButton(mosqueName:string,location:string){
  const buttons=Array.from(document.querySelectorAll<HTMLButtonElement>("button"));
  return buttons.find(b=>{
    const text=(b.textContent||"").trim();
    if(!text)return false;
    if(mosqueName&&text.includes(mosqueName))return true;
    if(location&&text.includes(location))return true;
    return text.includes("Your Masjid Name")||text.includes("Mosque location not set");
  })||null;
}

function findClockButton(){
  const buttons=Array.from(document.querySelectorAll<HTMLButtonElement>("button"));
  return buttons.find(b=>/\b\d{1,2}:\d{2}:\d{2}\s*(AM|PM)\b/i.test(b.textContent||""))||null;
}

export default function PreviewLogoSync(){
  useEffect(()=>{
    const sync=()=>{
      const logoInput=fieldByLabel("Logo URL");
      const mosqueInput=fieldByLabel("Mosque name");
      const locationInput=fieldByLabel("Mosque location");
      const mosqueName=mosqueInput?.value?.trim()||"";
      const location=locationInput?.value?.trim()||"";
      const logoUrl=logoInput?.value?.trim()||"";

      const identity=findIdentityButton(mosqueName,location);
      if(identity){
        let img=identity.querySelector<HTMLImageElement>("img[data-live-masjid-logo='1']");
        if(isLogoSource(logoUrl)){
          if(!img){
            img=document.createElement("img");
            img.dataset.liveMasjidLogo="1";
            img.alt="Masjid logo";
            img.style.cssText="display:block;width:46px;height:46px;max-width:46px;max-height:46px;object-fit:contain;margin:0 0 6px 0;border-radius:7px;background:transparent";
            identity.insertBefore(img,identity.firstChild);
          }
          if(img.getAttribute("src")!==logoUrl)img.setAttribute("src",logoUrl);
          Array.from(identity.children).forEach(child=>{
            if(child!==img&&child instanceof HTMLElement&&(child.textContent||"").trim()==="☪")child.style.display="none";
          });
        }else{
          img?.remove();
          Array.from(identity.children).forEach(child=>{
            if(child instanceof HTMLElement&&(child.textContent||"").trim()==="☪")child.style.display="";
          });
        }
      }

      const clock=findClockButton();
      if(clock){
        const now=new Date();
        const time=now.toLocaleTimeString([], {hour:"numeric",minute:"2-digit",second:"2-digit"});
        const date=now.toLocaleDateString([], {weekday:"long",month:"long",day:"numeric",year:"numeric"});
        const strong=clock.querySelector("strong");
        const small=clock.querySelector("small");
        if(strong)strong.textContent=time;
        if(small)small.textContent=date;
      }
    };

    sync();
    const timer=window.setInterval(sync,500);
    return()=>window.clearInterval(timer);
  },[]);
  return null;
}
