"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const API = "https://wopt-prayer-push.wopt-windsor.workers.dev";
const LIST_KEY = "hassoun:paired-displays:v2";
type Display = { id:string; code:string; name:string; token:string; pairedAt:string };
type Remote = { name:string; settings:Record<string,unknown>; revision:number };
type Effect = "none"|"pulse"|"flash";

function findEditorHost(){
  const h=Array.from(document.querySelectorAll<HTMLElement>("h2")).find(x=>(x.textContent||"").includes("Live display editor"));
  return h?.parentElement?.parentElement || null;
}
function activeCode(){
  const articles=Array.from(document.querySelectorAll<HTMLElement>("article"));
  const active=articles.find(a=>{const s=a.getAttribute("style")||"";return /efc66c|239\s*,\s*198\s*,\s*108/i.test(s)});
  return active?.textContent?.match(/\b\d{6}\b/)?.[0]||"";
}
function validColor(v:unknown){return typeof v==="string"&&/^#[0-9a-f]{6}$/i.test(v)?v:"#f3d47e"}
function validSpeed(v:unknown){const n=Number(v);return Number.isFinite(n)?Math.max(6,Math.min(40,n)):18}
function validEffect(v:unknown):Effect{return v==="pulse"||v==="flash"?v:"none"}
function ensureTickerStyle(){
  if(document.getElementById("hassoun-preview-ticker-style"))return;
  const style=document.createElement("style");
  style.id="hassoun-preview-ticker-style";
  style.textContent=`
    @keyframes hassounPreviewTicker{0%{transform:translateX(100%)}100%{transform:translateX(-100%)}}
    @keyframes hassounPreviewPulse{0%,100%{opacity:1;filter:brightness(1)}50%{opacity:.55;filter:brightness(1.45)}}
    @keyframes hassounPreviewFlash{0%,44%,56%,100%{opacity:1}45%,55%{opacity:.12}}
  `;
  document.head.appendChild(style);
}
function syncPreviewTicker(value:string,speed:number,color:string,effect:Effect){
  ensureTickerStyle();
  const buttons=Array.from(document.querySelectorAll<HTMLButtonElement>("button"));
  const footer=buttons.find(b=>{
    const img=b.querySelector<HTMLImageElement>('img[src*="hassoun-brand"]');
    return !!img && (b.textContent||"").includes("Powered by");
  });
  if(!footer)return;
  footer.style.justifyContent="flex-end";
  footer.style.position="relative";
  footer.style.overflow="hidden";
  footer.style.paddingLeft="10px";
  footer.style.paddingRight="10px";

  let ticker=footer.querySelector<HTMLElement>("[data-preview-ticker='1']");
  if(!ticker){
    ticker=document.createElement("span");
    ticker.dataset.previewTicker="1";
    ticker.style.cssText="position:absolute;left:10px;right:120px;top:0;bottom:0;display:flex;align-items:center;overflow:hidden;pointer-events:none;white-space:nowrap;text-align:left;font-weight:800";
    const inner=document.createElement("span");
    inner.dataset.previewTickerInner="1";
    inner.style.cssText="display:inline-block;min-width:100%;padding-left:100%;will-change:transform";
    ticker.appendChild(inner);
    footer.insertBefore(ticker,footer.firstChild);
  }
  const inner=ticker.querySelector<HTMLElement>("[data-preview-ticker-inner='1']");
  if(inner){
    inner.textContent=value.trim();
    inner.style.color=color;
    const move=`hassounPreviewTicker ${speed}s linear infinite`;
    const fx=effect==="pulse"?", hassounPreviewPulse 1.25s ease-in-out infinite":effect==="flash"?", hassounPreviewFlash 1.1s linear infinite":"";
    inner.style.animation=move+fx;
  }
  ticker.style.display=value.trim()?"flex":"none";
}

export default function TickerControl(){
  const [items,setItems]=useState<Display[]>([]);
  const [selected,setSelected]=useState("");
  const [text,setText]=useState("");
  const [speed,setSpeed]=useState(18);
  const [color,setColor]=useState("#f3d47e");
  const [effect,setEffect]=useState<Effect>("none");
  const [optionsOpen,setOptionsOpen]=useState(false);
  const [status,setStatus]=useState("");
  const [host,setHost]=useState<HTMLElement|null>(null);
  const timer=useRef<number|undefined>(undefined);
  const current=items.find(x=>x.id===selected);

  useEffect(()=>{try{const list=JSON.parse(localStorage.getItem(LIST_KEY)||"[]") as Display[];setItems(list);if(list[0])setSelected(list[0].id)}catch{}},[]);
  useEffect(()=>{
    const sync=()=>{setHost(findEditorHost());const code=activeCode();if(code){const match=items.find(x=>x.code===code);if(match&&match.id!==selected)setSelected(match.id)}};
    sync();const id=window.setInterval(sync,500);return()=>window.clearInterval(id);
  },[items,selected]);

  useEffect(()=>{
    if(!current)return;let live=true;setStatus("Loading ticker…");
    fetch(`${API}/masjid-displays/control/${encodeURIComponent(current.id)}`,{headers:{Authorization:`Bearer ${current.token}`},cache:"no-store"})
      .then(r=>r.ok?r.json():Promise.reject()).then((d:Remote)=>{if(!live)return;const s=d.settings||{};const t=typeof s.tickerText==="string"?String(s.tickerText):"";const sp=validSpeed(s.tickerSpeed);const c=validColor(s.tickerColor);const fx=validEffect(s.tickerEffect);setText(t);setSpeed(sp);setColor(c);setEffect(fx);syncPreviewTicker(t,sp,c,fx);setStatus("")})
      .catch(()=>{if(live)setStatus("Could not load ticker")});return()=>{live=false};
  },[selected]);

  useEffect(()=>{syncPreviewTicker(text,speed,color,effect);const id=window.setInterval(()=>syncPreviewTicker(text,speed,color,effect),700);return()=>window.clearInterval(id)},[text,speed,color,effect]);

  const save=(next:{text:string;speed:number;color:string;effect:Effect})=>{
    if(!current)return;setStatus("Updating display…");
    fetch(`${API}/masjid-displays/control/${encodeURIComponent(current.id)}`,{headers:{Authorization:`Bearer ${current.token}`},cache:"no-store"})
      .then(r=>r.ok?r.json():Promise.reject()).then((d:Remote)=>fetch(`${API}/masjid-displays/control/${encodeURIComponent(current.id)}`,{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${current.token}`},body:JSON.stringify({name:d.name||current.name,settings:{...(d.settings||{}),tickerText:next.text,tickerSpeed:next.speed,tickerColor:next.color,tickerEffect:next.effect}})}))
      .then(r=>r.ok?r.json():Promise.reject()).then(()=>setStatus("Live · ticker updated")).catch(()=>setStatus("Could not update ticker"));
  };
  const queue=(next:{text:string;speed:number;color:string;effect:Effect})=>{syncPreviewTicker(next.text,next.speed,next.color,next.effect);if(timer.current)window.clearTimeout(timer.current);timer.current=window.setTimeout(()=>save(next),350)};
  const setAll=(next:Partial<{text:string;speed:number;color:string;effect:Effect}>)=>{const n={text:next.text??text,speed:next.speed??speed,color:next.color??color,effect:next.effect??effect};if(next.text!==undefined)setText(n.text);if(next.speed!==undefined)setSpeed(n.speed);if(next.color!==undefined)setColor(n.color);if(next.effect!==undefined)setEffect(n.effect);queue(n)};
  useEffect(()=>()=>{if(timer.current)window.clearTimeout(timer.current)},[]);
  if(!items.length||!host)return null;

  const btn=(active:boolean)=>({padding:"8px 11px",borderRadius:999,border:"1px solid #826f45",background:active?"#e0b65f":"#082b26",color:active?"#092a25":"#fff",fontWeight:900,cursor:"pointer"} as const);
  const ui=<section style={{margin:"14px 0 18px",padding:"14px 16px",border:"1px solid #826f45",borderRadius:14,background:"#0a2d28",color:"#f7f5eb",fontFamily:"Arial,sans-serif"}}>
    <div style={{display:"grid",gridTemplateColumns:"minmax(180px,240px) minmax(0,1fr)",gap:14,alignItems:"end"}}>
      <label style={{fontWeight:800}}>Display<select value={selected} onChange={e=>setSelected(e.target.value)} style={{display:"block",width:"100%",marginTop:6,padding:"10px 11px",borderRadius:10,border:"1px solid #56776e",background:"#082b26",color:"#fff"}}>{items.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
      <label style={{fontWeight:800}}>Sliding announcement ticker<input value={text} onChange={e=>setAll({text:e.target.value})} placeholder="Type any announcement and it will scroll across this display footer…" style={{display:"block",width:"100%",marginTop:6,padding:"11px 12px",borderRadius:10,border:"1px solid #56776e",background:"#082b26",color:"#fff",fontSize:16}} /></label>
    </div>
    <button type="button" aria-expanded={optionsOpen} onClick={()=>setOptionsOpen(v=>!v)} style={{marginTop:12,padding:"9px 13px",borderRadius:999,border:"1px solid #826f45",background:"#082b26",color:"#f7f5eb",fontWeight:900,cursor:"pointer"}}>{optionsOpen?"Hide ticker options ▲":"Ticker options ▼"}</button>
    {optionsOpen?<div style={{display:"grid",gridTemplateColumns:"minmax(240px,1fr) minmax(200px,.7fr) minmax(260px,1fr)",gap:16,marginTop:14,alignItems:"end"}}>
      <div><div style={{fontWeight:800,marginBottom:7}}>Scroll speed · {speed}s per pass</div><input type="range" min="6" max="40" step="1" value={speed} onChange={e=>setAll({speed:Number(e.target.value)})} style={{width:"100%"}}/><div style={{display:"flex",gap:7,marginTop:7}}><button type="button" style={btn(speed===28)} onClick={()=>setAll({speed:28})}>Slow</button><button type="button" style={btn(speed===18)} onClick={()=>setAll({speed:18})}>Normal</button><button type="button" style={btn(speed===10)} onClick={()=>setAll({speed:10})}>Fast</button></div></div>
      <label style={{fontWeight:800}}>Text color<div style={{display:"flex",gap:8,marginTop:7}}><input type="color" value={color} onChange={e=>setAll({color:e.target.value})} style={{width:52,height:42,border:0,background:"transparent"}}/><input value={color} onChange={e=>{const v=e.target.value;if(/^#[0-9a-f]{6}$/i.test(v))setAll({color:v});else setColor(v)}} style={{width:"100%",padding:"9px 10px",borderRadius:9,border:"1px solid #56776e",background:"#082b26",color:"#fff"}}/></div></label>
      <div><div style={{fontWeight:800,marginBottom:7}}>Text effect</div><div style={{display:"flex",gap:7,flexWrap:"wrap"}}><button type="button" style={btn(effect==="none")} onClick={()=>setAll({effect:"none"})}>None</button><button type="button" style={btn(effect==="pulse")} onClick={()=>setAll({effect:"pulse"})}>Pulse</button><button type="button" style={btn(effect==="flash")} onClick={()=>setAll({effect:"flash"})}>Flash</button></div></div>
    </div>:null}
    <div style={{marginTop:10,fontSize:12,color:status.startsWith("Live")?"#aee5bf":"#d9b36b"}}>{status||"Changes auto-save and normally appear on the selected display within a few seconds."}</div>
  </section>;
  return createPortal(ui,host);
}
