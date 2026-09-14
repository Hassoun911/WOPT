"use client";
import {useEffect} from "react";
const API="https://wopt-prayer-push.wopt-windsor.workers.dev",KEY="wopt:admin-token:v1";

export default function EmailSponsorSaveFix(){
  useEffect(()=>{
    const style=document.createElement("style");
    style.id="hassoun-admin-scroll-fix";
    style.textContent=`
      html.hassoun-admin-scroll-unlocked,
      html.hassoun-admin-scroll-unlocked body{
        overflow-x:hidden!important;
        overflow-y:auto!important;
        height:auto!important;
        min-height:100%!important;
        max-height:none!important;
        position:static!important;
      }
      html.hassoun-admin-scroll-unlocked body{
        touch-action:pan-y!important;
        overscroll-behavior-y:auto!important;
      }
      html.hassoun-admin-scroll-unlocked .admin-shell,
      html.hassoun-admin-scroll-unlocked .admin-content,
      html.hassoun-admin-scroll-unlocked .admin-content>*,
      html.hassoun-admin-scroll-unlocked .admin-content main,
      html.hassoun-admin-scroll-unlocked .admin-content main>section{
        height:auto!important;
        min-height:0!important;
        max-height:none!important;
        overflow-y:visible!important;
      }
      html.hassoun-admin-scroll-unlocked .admin-shell{
        min-height:100dvh!important;
      }
      html.hassoun-admin-scroll-unlocked .admin-content main{
        padding-bottom:72px!important;
      }
    `;
    document.head.appendChild(style);

    const html=document.documentElement;
    const body=document.body;
    html.classList.add("hassoun-admin-scroll-unlocked");
    const unlock=()=>{
      html.style.setProperty("overflow-x","hidden","important");
      html.style.setProperty("overflow-y","auto","important");
      html.style.setProperty("height","auto","important");
      html.style.setProperty("max-height","none","important");
      body.style.setProperty("overflow-x","hidden","important");
      body.style.setProperty("overflow-y","auto","important");
      body.style.setProperty("height","auto","important");
      body.style.setProperty("max-height","none","important");
      body.style.setProperty("position","static","important");
    };
    unlock();
    const timer=window.setInterval(unlock,400);
    window.addEventListener("resize",unlock);
    window.addEventListener("pageshow",unlock);
    document.addEventListener("visibilitychange",unlock);

    const handler=async(e:MouseEvent)=>{const target=e.target as HTMLElement|null;const button=target?.closest('button');if(!button||button.textContent?.trim()!=="Save sponsor details")return;const box=button.closest('div');let root:HTMLElement|null=box;let nameInput:HTMLInputElement|null=null;for(let i=0;i<6&&root;i++,root=root.parentElement){nameInput=root.querySelector('input[id^="sponsor-name-"]');if(nameInput)break}if(!nameInput)return;const key=nameInput.id.replace('sponsor-name-','');const token=localStorage.getItem(KEY);if(!token)return;e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();const container=root||nameInput.parentElement;const sponsorUrl=(container?.querySelector(`#sponsor-url-${CSS.escape(key)}`) as HTMLInputElement|null)?.value||'';const sponsorMessageEn=(container?.querySelector(`#sponsor-message-${CSS.escape(key)}`) as HTMLInputElement|null)?.value||'';const sponsorMessageAr=(container?.querySelector(`#sponsor-message-ar-${CSS.escape(key)}`) as HTMLInputElement|null)?.value||'';const preview=container?.querySelector('img[alt="New sponsor logo preview"]') as HTMLImageElement|null;const payload:Record<string,unknown>={action:'update_template_profile',templateKey:key,sponsorName:nameInput.value,sponsorUrl,sponsorMessageEn,sponsorMessageAr};if(preview?.src?.startsWith('data:image/'))payload.sponsorLogoDataUrl=preview.src;const original=button.textContent;button.textContent='Saving…';button.setAttribute('disabled','true');try{const r=await fetch(`${API}/admin/email/campaigns`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify(payload)});const p=await r.json().catch(()=>({})) as {error?:string;sponsorLogoPresent?:boolean};if(!r.ok)throw new Error(p.error||`Save failed (${r.status})`);button.textContent=p.sponsorLogoPresent?'Saved ✓':'Saved';setTimeout(()=>location.reload(),500)}catch(err){button.textContent=original||'Save sponsor details';button.removeAttribute('disabled');alert(err instanceof Error?err.message:'Unable to save sponsor details')}};
    document.addEventListener('click',handler,true);
    return()=>{
      document.removeEventListener('click',handler,true);
      window.clearInterval(timer);
      window.removeEventListener("resize",unlock);
      window.removeEventListener("pageshow",unlock);
      document.removeEventListener("visibilitychange",unlock);
      html.classList.remove("hassoun-admin-scroll-unlocked");
      style.remove();
    }
  },[]);
  return null
}
