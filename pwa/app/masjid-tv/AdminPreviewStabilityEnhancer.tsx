"use client";

import {useEffect} from "react";

function findEditorSection(){
  const heading=Array.from(document.querySelectorAll("h2")).find(x=>(x.textContent||"").includes("Live display editor"));
  return heading?.closest("section") as HTMLElement|null;
}

function findNativePreview(section:HTMLElement){
  return Array.from(section.querySelectorAll<HTMLElement>("div")).find(el=>
    el.style.aspectRatio==="16 / 9" &&
    !el.hasAttribute("data-smart-grand-v2-preview") &&
    !el.hasAttribute("data-studio-grand-mirror")
  )||null;
}

export default function AdminPreviewStabilityEnhancer(){
  useEffect(()=>{
    if(!location.pathname.includes("/masjid-tv/devices"))return;

    const style=document.createElement("style");
    style.dataset.adminPreviewStability="1";
    style.textContent=`
      /* One renderer only: SmartGrandV2 is also the live TV renderer. */
      [data-studio-grand-mirror="1"]{display:none!important;visibility:hidden!important;pointer-events:none!important}
      .hassoun-native-tv-preview-hidden{display:none!important;visibility:hidden!important;pointer-events:none!important}
      [data-smart-grand-v2-preview="1"]{
        display:block!important;
        visibility:visible!important;
        opacity:1!important;
        pointer-events:auto!important;
        width:100%!important;
        aspect-ratio:16 / 9!important;
        position:relative!important;
        overflow:hidden!important;
      }
    `;
    document.head.appendChild(style);

    let native:HTMLElement|null=null;

    const enforce=()=>{
      const section=findEditorSection();
      if(!section)return;

      const exact=section.querySelector<HTMLElement>('[data-smart-grand-v2-preview="1"]');
      const nextNative=findNativePreview(section);
      if(nextNative!==native){
        native?.classList.remove("hassoun-native-tv-preview-hidden");
        native=nextNative;
      }

      // Hide the old hand-built preview as soon as the true TV renderer exists.
      if(exact){
        exact.style.setProperty("display","block","important");
        exact.style.setProperty("visibility","visible","important");
        exact.style.setProperty("opacity","1","important");
        if(native){
          native.classList.add("hassoun-native-tv-preview-hidden");
          native.style.setProperty("display","none","important");
          native.style.setProperty("visibility","hidden","important");
          native.style.setProperty("pointer-events","none","important");
        }
      } else if(native){
        // Temporary loading fallback only; it disappears once SmartGrandV2 loads.
        native.classList.remove("hassoun-native-tv-preview-hidden");
        native.style.removeProperty("display");
        native.style.removeProperty("visibility");
        native.style.removeProperty("pointer-events");
      }

      section.querySelectorAll<HTMLElement>('[data-studio-grand-mirror="1"]').forEach(el=>{
        el.style.setProperty("display","none","important");
        el.style.setProperty("visibility","hidden","important");
        el.style.setProperty("pointer-events","none","important");
      });
    };

    enforce();
    const observer=new MutationObserver(enforce);
    observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:["style","class"]});
    const timer=window.setInterval(enforce,500);

    return()=>{
      observer.disconnect();
      window.clearInterval(timer);
      style.remove();
      native?.classList.remove("hassoun-native-tv-preview-hidden");
    };
  },[]);
  return null;
}
