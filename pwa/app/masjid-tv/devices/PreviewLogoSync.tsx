"use client";

import { useEffect } from "react";

function isLogoSource(value:string){return /^data:image\/(png|jpeg|jpg|webp|svg\+xml);base64,/i.test(value)||/^https?:\/\//i.test(value)}

export default function PreviewLogoSync(){
  useEffect(()=>{
    const sync=()=>{
      const heading=Array.from(document.querySelectorAll("h3")).find(h=>(h.textContent||"").includes("Mosque & display identity"));
      const panel=heading?.parentElement;
      const input=panel?Array.from(panel.querySelectorAll("input")).find(i=>((i.previousSibling?.textContent||"")+(i.parentElement?.textContent||"")).includes("Logo URL")) as HTMLInputElement|undefined:undefined;
      const logoUrl=input?.value?.trim()||"";
      if(!isLogoSource(logoUrl))return;

      const editorTitle=Array.from(document.querySelectorAll("h2,h3")).find(el=>(el.textContent||"").includes("Live display editor"));
      const editor=editorTitle?.closest("section,article,div");
      if(!editor)return;

      const previewButtons=Array.from(editor.querySelectorAll("button"));
      const identity=previewButtons.find(b=>{
        const text=(b.textContent||"").trim();
        return text.includes("Al Hijra")||text.includes("Your Masjid Name")||text.includes("Mosque location")||text.includes("Windsor, ON");
      });
      if(!identity)return;

      let img=identity.querySelector<HTMLImageElement>("img[data-uploaded-masjid-logo='1']");
      if(!img){
        img=document.createElement("img");
        img.dataset.uploadedMasjidLogo="1";
        img.alt="Masjid logo";
        img.style.cssText="display:block;width:42px;height:42px;max-width:42px;max-height:42px;object-fit:contain;margin:0 0 6px 0;border-radius:6px";
        identity.insertBefore(img,identity.firstChild);
      }
      if(img.src!==logoUrl)img.src=logoUrl;

      Array.from(identity.children).forEach(child=>{
        if(child!==img && child instanceof HTMLElement && (child.textContent||"").trim()==="☪")child.style.display="none";
      });
    };

    sync();
    const timer=window.setInterval(sync,500);
    return()=>window.clearInterval(timer);
  },[]);
  return null;
}
