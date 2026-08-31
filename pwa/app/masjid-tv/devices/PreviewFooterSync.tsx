"use client";

import { useEffect } from "react";

export default function PreviewFooterSync(){
  useEffect(()=>{
    const sync=()=>{
      const candidates=Array.from(document.querySelectorAll<HTMLButtonElement>("button"));
      const footer=candidates.find(btn=>(btn.textContent||"").includes("Powered by") && !!btn.querySelector("img[alt='Hassoun app']"));
      if(!footer)return;
      footer.style.justifyContent="flex-end";
      footer.style.paddingLeft="14px";
      footer.style.paddingRight="14px";
      footer.style.gap="7px";
      footer.style.textAlign="right";
    };
    sync();
    const id=window.setInterval(sync,500);
    return()=>window.clearInterval(id);
  },[]);
  return null;
}
