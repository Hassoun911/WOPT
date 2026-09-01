"use client";

import {useEffect} from "react";

export default function ScheduleIntentEnhancer(){
  useEffect(()=>{
    let stopped=false;
    const enhance=()=>{
      if(stopped)return;
      const panel=document.querySelector<HTMLElement>("[data-bulk-prayer-import='1']");
      if(!panel||panel.querySelector("[data-schedule-intent='1']"))return;
      const pasteBox=panel.querySelector<HTMLTextAreaElement>("[data-schedule-text]");
      const analyze=panel.querySelector<HTMLButtonElement>("[data-analyze-text]");
      const apply=panel.querySelector<HTMLButtonElement>("[data-apply]");
      if(!pasteBox||!analyze||!apply)return;

      const box=document.createElement("section");box.dataset.scheduleIntent="1";box.style.cssText="display:grid;gap:8px;padding:10px;border:1px solid #6a805f;border-radius:10px;background:#0a332d";
      box.innerHTML='<strong style="color:#f1c86f">Tell Hassoun what to do</strong><div style="font-size:11px;color:#a8c2b9">Examples: “Apply these for Iqama only”, “Update September only”, “Import all months and Jumu’ah”, or “Adhan only”.</div><input data-intent-input placeholder="Optional instruction…" style="width:100%;box-sizing:border-box;background:#082b26;color:white;border:1px solid #56776e;border-radius:9px;padding:10px;font:inherit"><label style="display:flex;gap:8px;align-items:center;color:#fff;font-weight:700"><input data-auto-apply type="checkbox" checked> Auto-apply after a successful analysis</label><div style="font-size:11px;color:#d9b36b">Named months are saved under the current year. Multiple named months can be imported together.</div>';
      const option2=Array.from(panel.querySelectorAll("div")).find(x=>(x.textContent||"").includes("Option 2 · Paste prayer schedule text"));
      option2?.insertAdjacentElement("afterbegin",box);
      const intent=box.querySelector<HTMLInputElement>("[data-intent-input]")!;
      const auto=box.querySelector<HTMLInputElement>("[data-auto-apply]")!;

      analyze.addEventListener("click",()=>{
        const command=intent.value.trim();if(!command)return;
        const original=pasteBox.value;
        pasteBox.value=`ADMIN INSTRUCTION: ${command}\n\n${original}`;
        window.setTimeout(()=>{pasteBox.value=original},0);
      },true);

      const observer=new MutationObserver(()=>{
        if(!auto.checked||apply.disabled)return;
        const status=panel.querySelector<HTMLElement>("[data-schedule-status]");
        if(status&&(status.textContent||"").startsWith("Found ")){
          auto.checked=false;
          window.setTimeout(()=>{if(!apply.disabled)apply.click()},100);
        }
      });
      observer.observe(panel,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:["disabled"]});
      (box as any)._cleanup=()=>observer.disconnect();
    };
    enhance();const timer=window.setInterval(enhance,600);
    return()=>{stopped=true;window.clearInterval(timer);document.querySelectorAll<HTMLElement>("[data-schedule-intent='1']").forEach(x=>{(x as any)._cleanup?.();x.remove()})};
  },[]);
  return null;
}
