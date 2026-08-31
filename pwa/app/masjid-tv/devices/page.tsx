"use client";

import { useEffect, useState } from "react";

const LIST_KEY="hassoun:paired-displays:v1";
type Display={id:string;code:string;name:string;pairedAt:string};

export default function DisplaysPage(){
  const [items,setItems]=useState<Display[]>([]);
  useEffect(()=>{try{setItems(JSON.parse(localStorage.getItem(LIST_KEY)||"[]"))}catch{}},[]);
  const save=(next:Display[])=>{setItems(next);localStorage.setItem(LIST_KEY,JSON.stringify(next))};
  const rename=(id:string,name:string)=>save(items.map(x=>x.id===id?{...x,name:(name.trim()||"Masjid Display").slice(0,40)}:x));
  const remove=(id:string)=>save(items.filter(x=>x.id!==id));
  return <main style={{minHeight:"100vh",background:"#061f1b",color:"#f7f5eb",padding:"30px 18px",fontFamily:"Arial,sans-serif"}}><section style={{maxWidth:920,margin:"0 auto"}}><div style={{fontSize:12,letterSpacing:2,color:"#d9b36b",fontWeight:900}}>HASSOUN</div><h1 style={{margin:"7px 0"}}>Displays</h1><p style={{color:"#c4d2cd",marginBottom:20}}>Manage each connected TV, mosque screen, tablet, or office display separately.</p>{items.length===0?<div style={{padding:22,border:"1px solid #46675e",borderRadius:16,background:"#0b322c"}}>No displays paired yet. Open Masjid Display Studio on a screen and scan its QR code.</div>:<div style={{display:"grid",gap:12}}>{items.map(item=><article key={item.id} style={{padding:18,border:"1px solid #826f45",borderRadius:16,background:"#0b3b33"}}><div style={{display:"flex",gap:14,alignItems:"center",justifyContent:"space-between",flexWrap:"wrap"}}><div style={{minWidth:220,flex:1}}><input defaultValue={item.name} onBlur={e=>rename(item.id,e.target.value)} aria-label="Display name" style={{width:"100%",maxWidth:420,padding:10,borderRadius:9,border:"1px solid #56776e",background:"#082b26",color:"#fff",fontSize:17,fontWeight:800}}/><div style={{fontSize:12,color:"#9bb5ad",marginTop:8}}>ID {item.id.slice(0,8).toUpperCase()}…{item.id.slice(-4).toUpperCase()} · Paired {new Date(item.pairedAt).toLocaleDateString()}</div></div><div style={{fontSize:22,letterSpacing:4,fontWeight:900,color:"#efc66c"}}>{item.code}</div><button onClick={()=>remove(item.id)} style={{padding:"9px 13px",borderRadius:999,border:"1px solid #8c5c59",background:"transparent",color:"#ffd7d4",fontWeight:800}}>Remove</button></div></article>)}</div>}<a href="/masjid-tv/" style={{display:"inline-block",marginTop:22,color:"#fff0bd",fontWeight:900}}>Back to Masjid TV</a></section></main>
}
