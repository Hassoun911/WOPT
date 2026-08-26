"use client";

import type { ReactNode } from "react";
import { useEffect } from "react";

export default function AdminLayout({ children }: { children: ReactNode }) {
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const previous = {htmlOverflow:html.style.overflow,htmlOverflowY:html.style.overflowY,htmlHeight:html.style.height,bodyOverflow:body.style.overflow,bodyOverflowY:body.style.overflowY,bodyHeight:body.style.height,bodyPosition:body.style.position};
    html.style.overflow="visible";html.style.overflowY="auto";html.style.height="auto";body.style.overflow="visible";body.style.overflowY="auto";body.style.height="auto";body.style.position="static";
    return()=>{html.style.overflow=previous.htmlOverflow;html.style.overflowY=previous.htmlOverflowY;html.style.height=previous.htmlHeight;body.style.overflow=previous.bodyOverflow;body.style.overflowY=previous.bodyOverflowY;body.style.height=previous.bodyHeight;body.style.position=previous.bodyPosition};
  }, []);
  const links=[["/admin/","🏠 CRM"],["/admin/school/","🎓 School"],["/admin/support/","💬 Support"],["/admin/email/","📧 Email"],["/admin/reports/","📊 Reports"],["/admin/system/","🩺 System"]];
  return <div style={{minHeight:"100dvh",overflow:"visible",paddingBottom:24}}><div style={{position:"sticky",top:0,zIndex:100,display:"flex",gap:7,flexWrap:"wrap",alignItems:"center",padding:"7px 14px",background:"rgba(250,248,242,.96)",backdropFilter:"blur(10px)",borderBottom:"1px solid #e5dfd2"}}>{links.map(([href,label])=><a key={href} href={href} style={{textDecoration:"none",color:"#145746",background:"white",border:"1px solid #d8e0dc",borderRadius:999,padding:"7px 11px",fontSize:12,fontWeight:800}}>{label}</a>)}</div>{children}</div>;
}
