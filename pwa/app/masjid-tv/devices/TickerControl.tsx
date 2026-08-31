"use client";

import { useEffect, useRef, useState } from "react";

const API = "https://wopt-prayer-push.wopt-windsor.workers.dev";
const LIST_KEY = "hassoun:paired-displays:v2";
type Display = { id:string; code:string; name:string; token:string; pairedAt:string };

type Remote = { name:string; settings:Record<string,unknown>; revision:number };

export default function TickerControl(){
  const [items,setItems]=useState<Display[]>([]);
  const [selected,setSelected]=useState("");
  const [text,setText]=useState("");
  const [status,setStatus]=useState("");
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

  if(!items.length)return null;
  return <section style={{margin:"0 auto 20px",maxWidth:1180,padding:"16px 18px",border:"1px solid #826f45",borderRadius:16,background:"#0b322c",color:"#f7f5eb",fontFamily:"Arial,sans-serif"}}>
    <div style={{display:"flex",gap:14,alignItems:"end",flexWrap:"wrap"}}>
      <label style={{minWidth:220,flex:"0 0 240px",fontWeight:800}}>Display
        <select value={selected} onChange={e=>setSelected(e.target.value)} style={{display:"block",width:"100%",marginTop:6,padding:"10px 11px",borderRadius:10,border:"1px solid #56776e",background:"#082b26",color:"#fff"}}>
          {items.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}
        </select>
      </label>
      <label style={{minWidth:300,flex:1,fontWeight:800}}>Sliding announcement ticker
        <input value={text} onChange={e=>change(e.target.value)} placeholder="Type any announcement and it will scroll across the TV footer…" style={{display:"block",width:"100%",marginTop:6,padding:"11px 12px",borderRadius:10,border:"1px solid #56776e",background:"#082b26",color:"#fff",fontSize:16}} />
      </label>
    </div>
    <div style={{marginTop:8,fontSize:12,color:status.startsWith("Live")?"#aee5bf":"#d9b36b"}}>{status||"Changes auto-save and normally appear on the display within a few seconds."}</div>
  </section>;
}
