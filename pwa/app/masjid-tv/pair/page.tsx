"use client";

import { useEffect, useMemo, useState } from "react";

const API = "https://wopt-prayer-push.wopt-windsor.workers.dev";
const LIST_KEY = "hassoun:paired-displays:v2";
type Display = { id:string; code:string; name:string; token:string; pairedAt:string };

export default function PairMasjidDisplayPage(){
  const [device,setDevice]=useState("");
  const [code,setCode]=useState("");
  const [name,setName]=useState("Masjid Display");
  const [controllerName,setControllerName]=useState("Hassoun Browser");
  const [saved,setSaved]=useState(false);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  useEffect(()=>{const p=new URLSearchParams(location.search);setDevice(p.get("device")||"");setCode(p.get("code")||"");},[]);
  const valid=useMemo(()=>/^\d{6}$/.test(code),[code]);
  const pair=async()=>{
    if(!valid)return;
    setBusy(true);setError("");
    try{
      const r=await fetch(`${API}/masjid-displays/pair`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({code,controllerName:(controllerName.trim()||"Hassoun Browser").slice(0,50)})});
      const data=await r.json() as {ok?:boolean;deviceId?:string;name?:string;token?:string;error?:string};
      if(!r.ok||!data.ok||!data.deviceId||!data.token)throw new Error(data.error||"Could not pair display");
      let list:Display[]=[];try{list=JSON.parse(localStorage.getItem(LIST_KEY)||"[]")}catch{}
      const item:Display={id:data.deviceId,code,name:(name.trim()||data.name||"Masjid Display").slice(0,40),token:data.token,pairedAt:new Date().toISOString()};
      list=[item,...list.filter(x=>x.id!==item.id)];localStorage.setItem(LIST_KEY,JSON.stringify(list));setDevice(item.id);setSaved(true);
      if(item.name!==data.name){await fetch(`${API}/masjid-displays/control/${encodeURIComponent(item.id)}`,{method:"POST",headers:{"Content-Type":"application/json","Authorization":`Bearer ${item.token}`},body:JSON.stringify({name:item.name})});}
    }catch(e){setError(e instanceof Error?e.message:"Could not pair display")}finally{setBusy(false)}
  };
  return <main style={{minHeight:"100vh",background:"#061f1b",color:"#f7f5eb",padding:"32px 18px",fontFamily:"Arial, sans-serif"}}><section style={{maxWidth:720,margin:"0 auto",background:"#0b3b33",border:"1px solid #8a7548",borderRadius:20,padding:24}}><div style={{fontSize:12,letterSpacing:2,color:"#d9b36b",fontWeight:900}}>HASSOUN DISPLAY PAIRING</div><h1 style={{margin:"8px 0 10px"}}>Connect a TV or display</h1><p style={{color:"#c7d4cf",lineHeight:1.5}}>Use this page from any laptop, desktop, tablet, phone browser, or the Hassoun app. Enter the 6-digit code shown on the Masjid display.</p><label style={{display:"block",marginTop:18,fontWeight:800}}>Pairing code<input inputMode="numeric" value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,"").slice(0,6))} maxLength={6} style={{display:"block",width:"100%",marginTop:7,padding:12,borderRadius:10,border:"1px solid #53786d",background:"#082b26",color:"#efc66c",fontSize:28,fontWeight:900,letterSpacing:6}}/></label><label style={{display:"block",marginTop:14,fontWeight:800}}>Display name<input value={name} onChange={e=>setName(e.target.value)} maxLength={40} style={{display:"block",width:"100%",marginTop:7,padding:12,borderRadius:10,border:"1px solid #53786d",background:"#082b26",color:"#fff",fontSize:17}}/></label><label style={{display:"block",marginTop:14,fontWeight:800}}>This controller name<input value={controllerName} onChange={e=>setControllerName(e.target.value)} maxLength={50} placeholder="Office computer, Sam's phone..." style={{display:"block",width:"100%",marginTop:7,padding:12,borderRadius:10,border:"1px solid #53786d",background:"#082b26",color:"#fff",fontSize:17}}/></label>{device?<div style={{marginTop:14,fontSize:12,color:"#9bb5ad"}}>Display ID: {device}</div>:null}{error?<p style={{color:"#ffb4ab",fontWeight:800}}>{error}</p>:null}<button onClick={pair} disabled={!valid||busy} style={{marginTop:20,padding:"12px 18px",border:0,borderRadius:999,background:valid&&!busy?"#d9b36b":"#6b746f",color:"#102c25",fontWeight:900,fontSize:16,cursor:valid&&!busy?"pointer":"not-allowed"}}>{busy?"Connecting…":"Pair display"}</button>{saved?<div style={{marginTop:18,padding:14,borderRadius:12,background:"#123f36"}}>Connected remotely. <a href="/masjid-tv/devices/" style={{color:"#fff1c4",fontWeight:900}}>Open Displays</a></div>:null}</section></main>
}
