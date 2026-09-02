"use client";

import {useEffect} from "react";

function findEditorSection(){
  const heading=Array.from(document.querySelectorAll("h2")).find(x=>(x.textContent||"").includes("Live display editor"));
  return heading?.closest("section") as HTMLElement|null;
}

function findNativePreview(section:HTMLElement){
  return Array.from(section.querySelectorAll<HTMLElement>("div")).find(el=>el.style.aspectRatio==="16 / 9"&&!el.hasAttribute("data-smart-grand-v2-preview")&&!el.hasAttribute("data-studio-grand-mirror"))||null;
}

export default function AdminPreviewStabilityEnhancer(){
  useEffect(()=>{
    if(!location.pathname.includes("/masjid-tv/devices"))return;
    const style=document.createElement("style");
    style.dataset.adminPreviewStability="1";
    style.textContent=`
      [data-smart-grand-v2-preview="1"],
      [data-studio-grand-mirror="1"]{display:none!important;visibility:hidden!important;pointer-events:none!important}
      .hassoun-native-tv-preview-stable{display:grid!important;visibility:visible!important;opacity:1!important;pointer-events:auto!important}
    `;
    document.head.appendChild(style);

    let native:HTMLElement|null=null;
    const enforce=()=>{
      const section=findEditorSection();
      if(!section)return;
      const next=findNativePreview(section);
      if(next&&next!==native){
        native?.classList.remove("hassoun-native-tv-preview-stable");
        native=next;
        native.classList.add("hassoun-native-tv-preview-stable");
      }
      if(native){
        native.style.setProperty("display","grid","important");
        native.style.setProperty("visibility","visible","important");
        native.style.setProperty("opacity","1","important");
      }
      section.querySelectorAll<HTMLElement>('[data-smart-grand-v2-preview="1"],[data-studio-grand-mirror="1"]').forEach(el=>{
        el.style.setProperty("display","none","important");
        el.style.setProperty("visibility","hidden","important");
      });
    };

    enforce();
    const observer=new MutationObserver(enforce);
    observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:["style","class"]});
    const timer=window.setInterval(enforce,700);
    return()=>{
      observer.disconnect();
      window.clearInterval(timer);
      style.remove();
      native?.classList.remove("hassoun-native-tv-preview-stable");
    };
  },[]);
  return null;
}
