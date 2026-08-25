"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || "";
const appPath = (path: string) => `${BASE_PATH}${path}`;
const items = [
  ["/", "🏠", "Home", "Prayer times and daily dashboard"],
  ["/quran/", "۞", "Qur’an", "Read, listen, search and memorize"],
  ["/school/", "🎒", "Qur’an School", "Student, teacher and parent memorization portal"],
  ["/ask-sheikh/", "🕌", "Ask the Sheikh", "Qur’an and Sunnah reference assistant"],
  ["/games/", "🎮", "Games", "Daily quiz and multiplayer rooms"],
  ["/events/", "🌙", "Events", "Islamic calendar and upcoming dates"],
  ["/qibla/", "🕋", "Qibla", "Find the Qibla direction"],
  ["/more/", "⚙️", "More", "Alerts, settings and app tools"],
] as const;

export default function WebAppNav(){
  const pathname=usePathname();
  const [open,setOpen]=useState(false);
  const localPath=BASE_PATH&&pathname.startsWith(BASE_PATH)?pathname.slice(BASE_PATH.length)||"/":pathname;
  return <>
    <button className="web-menu-trigger" type="button" aria-label="Open Hassoun menu" aria-expanded={open} onClick={()=>setOpen(true)}><span>☰</span><b>Menu</b></button>
    <div className={open?"web-menu-backdrop open":"web-menu-backdrop"} onClick={()=>setOpen(false)} />
    <aside className={open?"web-slide-menu open":"web-slide-menu"} aria-hidden={!open}>
      <div className="web-slide-head"><div className="web-slide-brand"><img src={appPath("/hassoun-logo.png?v=20260824-4")} alt="Hassoun" style={{width:48,height:48,borderRadius:16,objectFit:"cover",display:"block",boxShadow:"0 6px 18px rgba(11,91,71,.16)"}}/><div><strong>Hassoun</strong><span>Islamic companion</span></div></div><button type="button" onClick={()=>setOpen(false)} aria-label="Close menu">×</button></div>
      <nav aria-label="Hassoun website navigation">{items.map(([href,icon,label,note])=>{const active=href==="/"?localPath==="/":localPath.startsWith(href.replace(/\/$/,""));return <a key={href} href={appPath(href)} className={active?"active":""} onClick={()=>setOpen(false)}><span className="web-slide-icon">{icon}</span><span><strong>{label}</strong><small>{note}</small></span><b>›</b></a>})}</nav>
      <div className="web-slide-foot"><span>Web version</span><small>Designed for desktop, tablet and mobile browsers.</small></div>
    </aside>
  </>;
}
