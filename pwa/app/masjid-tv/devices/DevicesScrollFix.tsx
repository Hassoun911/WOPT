"use client";

import { useEffect } from "react";

export default function DevicesScrollFix(){
  useEffect(()=>{
    const html=document.documentElement;
    const body=document.body;
    const prevHtmlOverflow=html.style.overflow;
    const prevBodyOverflow=body.style.overflow;
    const prevHtmlHeight=html.style.height;
    const prevBodyHeight=body.style.height;
    const prevBodyMinHeight=body.style.minHeight;
    const prevOverscroll=body.style.overscrollBehaviorY;

    html.style.overflowY="auto";
    html.style.overflowX="hidden";
    html.style.height="auto";
    body.style.overflowY="auto";
    body.style.overflowX="hidden";
    body.style.height="auto";
    body.style.minHeight="100vh";
    body.style.overscrollBehaviorY="auto";

    const style=document.createElement("style");
    style.id="hassoun-devices-scroll-fix";
    style.textContent=`
      html,body{overflow-y:auto!important;overflow-x:hidden!important;height:auto!important;min-height:100%!important;scroll-behavior:smooth}
      body{padding-bottom:120px!important}
      main{overflow:visible!important;max-height:none!important;height:auto!important}
      textarea,select,input{overscroll-behavior:contain}
      @media (min-width: 900px){
        body{scrollbar-gutter:stable}
      }
    `;
    document.head.appendChild(style);

    const onKey=(e:KeyboardEvent)=>{
      const tag=(e.target as HTMLElement|null)?.tagName;
      if(tag==="INPUT"||tag==="TEXTAREA"||tag==="SELECT")return;
      const step=Math.max(220,Math.floor(window.innerHeight*0.72));
      if(e.key==="PageDown"){e.preventDefault();window.scrollBy({top:step,behavior:"smooth"});}
      else if(e.key==="PageUp"){e.preventDefault();window.scrollBy({top:-step,behavior:"smooth"});}
      else if(e.key==="Home"){e.preventDefault();window.scrollTo({top:0,behavior:"smooth"});}
      else if(e.key==="End"){e.preventDefault();window.scrollTo({top:document.documentElement.scrollHeight,behavior:"smooth"});}
      else if(e.key==="ArrowDown"){e.preventDefault();window.scrollBy({top:90,behavior:"smooth"});}
      else if(e.key==="ArrowUp"){e.preventDefault();window.scrollBy({top:-90,behavior:"smooth"});}
    };
    window.addEventListener("keydown",onKey,{passive:false});

    return()=>{
      window.removeEventListener("keydown",onKey);
      style.remove();
      html.style.overflow=prevHtmlOverflow;
      body.style.overflow=prevBodyOverflow;
      html.style.height=prevHtmlHeight;
      body.style.height=prevBodyHeight;
      body.style.minHeight=prevBodyMinHeight;
      body.style.overscrollBehaviorY=prevOverscroll;
    };
  },[]);
  return null;
}
