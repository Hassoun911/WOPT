"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const API = "https://wopt-prayer-push.wopt-windsor.workers.dev";
const LIST_KEY = "hassoun:paired-displays:v2";
type Display = { id:string; code:string; name:string; token:string; pairedAt:string };
type Remote = { name:string; settings:Record<string,unknown>; revision:number };

function findEditorHost(){
  const h=Array.from(document.querySelectorAll<HTMLElement>("h2")).find(x=>(x.textContent||"").includes("Live display editor"));
  return h?.parentElement?.parentElement || null;
}
function activeCode(){
  const articles=Array.from(document.querySelectorAll<HTMLElement>("article"));
  const active=articles.find(a=>{const s=a.getAttribute("style")||"";return /efc66c|239\s*,\s*198\s*,\s*108/i.test(s)});
  return active?.textContent?.match(/\b\d{6}\b/)?.[0]||"";
}

export default function TickerControl(){
  const [items,setItems]=useState<Display[]>([]);
  const [selected,setSelected]=useState("");
  const [text,setText]=useState("");
  const [status,setStatus]=useState("");
  const [host,setHost]=useState<HTMLElement|null>(null);
  const timer=useRef<number|undefined>(undefined);
  const current=items.find(x=>x.id===selected);

  useEffect(()=>{
    try{
      const list=JSON.parse(localStorage.getItem(LIST_KEY)||"[]") as Display[];
      setItems(list);
      if(list[0])setSelected(list[0].id);
    }catch{}
  },[]);

  useEffect(()=>{
    const sync=()=>{
      setHost(findEditorHost());
      const code=activeCode();
      if(code){const match=items.find(x=>x.code===code);if(match&&match.id!==selected)setSelected(match.id)}
    };
    sync();
    const id=window.setInterval(sync,500);
    return()=>window.clearInterval(id);
  },[items,selected]);

  useEffect(()=>{
    if(!current)return;
    let live=true;
    setStatus("Loading ticker…");
    fetch(`${API}/masjid-displays/control/${encodeURIComponent(current.id)}`,{headers:{Authorization:`Bearer ${current.token}`},cache:"no-store"})
      .then(r=>r.ok?r.json():Promise.reject())
      .then((d:Remote)=>{if(live){setText(typeof d.settings?.tickerText==="string"?String(d.settings.tickerText):"");setStatus("")}})
      .catch(()=>{if(live)setStatus("Could not load ticker")});
    return()=>{live=false};
  },[selected]);

  const save=(value:string)=>{
    if(!current)return;
    setStatus("Updating display…");
    fetch(`${API}/masjid-displays/control/${encodeURIComponent(current.id)}`,{headers:{Authorization:`Bearer ${current.token}`},cache:"no-store"})
      .then(r=>r.ok?r.json():Promise.reject())
      .then((d:Remote)=>fetch(`${API}/masjid-displays/control/${encodeURIComponent(current.id)}`,{
        method:"POST",
        headers:{"Content-Type":"application/json",Authorization:`Bearer ${current.token}`},
        body:JSON.stringify({name:d.name||current.name,settings:{...(d.settings||{}),tickerText:value}})
      }))
      .then(r=>r.ok?r.json():Promise.reject())
      .then(()=>setStatus("Live · ticker updated"))
      .catch(()=>setStatus("Could not update ticker"));
  };

  const change=(value:string)=>{
    setText(value);
    if(timer.current)window.clearTimeout(timer.current);
    timer.current=window.setTimeout(()=>save(value),350);
  };

  useEffect(()=>()=>{if(timer.current)window.clearTimeout(timer.current)},[]);
  if(!items.length||!host)return null;

  const ui=<section style={{margin:"14px 0 18px",padding:"14px 16px",border:"1px solid #826f45",borderRadius:14,background:"#0a2d28",color:"#f7f5eb",fontFamily:"Arial,sans-serif"}}>
    <div style={{display:"grid",gridTemplateColumns:"minmax(180px,240px) minmax(0,1fr)",gap:14,alignItems:"end"}}>
      <label style={{fontWeight:800}}>Display
        <select value={selected} onChange={e=>setSelected(e.target.value)} style={{display:"block",width:"100%",marginTop:6,padding:"10px 11px",borderRadius:10,border:"1px solid #56776e",background:"#082b26",color:"#fff"}}>
          {items.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}
        </select>
      </label>
      <label style={{fontWeight:800}}>Sliding announcement ticker
        <input value={text} onChange={e=>change(e.target.value)} placeholder="Type any announcement and it will scroll across this display footer…" style={{display:"block",width:"100%",marginTop:6,padding:"11px 12px",borderRadius:10,border:"1px solid #56776e",background:"#082b26",color:"#fff",fontSize:16}} />
      </label>
    </div>
    <div style={{marginTop:8,fontSize:12,color:status.startsWith("Live")?"#aee5bf":"#d9b36b"}}>{status||"Changes auto-save and normally appear on the selected display within a few seconds."}</div>
  </section>;

  return createPortal(ui,host);
}
