"use client";

import { useEffect, useMemo, useState } from "react";

const LIST_KEY = "hassoun:paired-displays:v1";
type Display = { id:string; code:string; name:string; pairedAt:string };

export default function PairMasjidDisplayPage(){
  const [device,setDevice]=useState("");
  const [code,setCode]=useState("");
  const [name,setName]=useState("Masjid Display");
  const [saved,setSaved]=useState(false);
  useEffect(()=>{const p=new URLSearchParams(location.search);setDevice(p.get("device")||"");setCode(p.get("code")||"");},[]);
  const valid=useMemo(()=>/^[a-z0-9]{12,64}$/i.test(device)&&/^\d{6}$/.test(code),[device,code]);
  const pair=()=>{if(!valid)return;let list:Display[]=[];try{list=JSON.parse(localStorage.getItem(LIST_KEY)||"[]")}catch{}const item:Display={id:device,code,name:(name.trim()||"Masjid Display").slice(0,40),pairedAt:new Date().toISOString()};list=[item,...list.filter(x=>x.id!==device)];localStorage.setItem(LIST_KEY,JSON.stringify(list));setSaved(true)};
  return <main style={{minHeight:"100vh",background:"#061f1b",color:"#f7f5eb",padding:"32px 18px",fontFamily:"Arial, sans-serif"}}><section style={{maxWidth:720,margin:"0 auto",background:"#0b3b33",border:"1px solid #8a7548",borderRadius:20,padding:24}}><div style={{fontSize:12,letterSpacing:2,color:"#d9b36b",fontWeight:900}}>HASSOUN DISPLAY PAIRING</div><h1 style={{margin:"8px 0 10px"}}>Connect this display</h1><p style={{color:"#c7d4cf",lineHeight:1.5}}>Pair this TV, tablet, or screen with Hassoun, give it a name, and keep it alongside your other displays.</p><label style={{display:"block",marginTop:18,fontWeight:800}}>Display name<input value={name} onChange={e=>setName(e.target.value)} maxLength={40} style={{display:"block",width:"100%",marginTop:7,padding:12,borderRadius:10,border:"1px solid #53786d",background:"#082b26",color:"#fff",fontSize:17}}/></label><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginTop:16}}><div style={{background:"#082b26",borderRadius:12,padding:14}}><small style={{color:"#8dafaa"}}>DEVICE</small><div style={{fontWeight:900,marginTop:6,wordBreak:"break-all"}}>{device||"Missing device ID"}</div></div><div style={{background:"#082b26",borderRadius:12,padding:14}}><small style={{color:"#8dafaa"}}>CODE</small><div style={{fontWeight:900,fontSize:28,letterSpacing:5,color:"#efc66c",marginTop:4}}>{code||"------"}</div></div></div>{!valid?<p style={{color:"#ffcf9a"}}>This pairing link is incomplete. Scan the QR shown on the display again.</p>:null}<button onClick={pair} disabled={!valid} style={{marginTop:20,padding:"12px 18px",border:0,borderRadius:999,background:valid?"#d9b36b":"#6b746f",color:"#102c25",fontWeight:900,fontSize:16,cursor:valid?"pointer":"not-allowed"}}>Pair display</button>{saved?<div style={{marginTop:18,padding:14,borderRadius:12,background:"#123f36"}}>Connected. <a href="/masjid-tv/devices/" style={{color:"#fff1c4",fontWeight:900}}>Open Displays</a></div>:null}</section></main>
}
