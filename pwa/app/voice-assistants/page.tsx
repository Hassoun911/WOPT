"use client";

import { useEffect, useState } from "react";

const API = "https://wopt-prayer-push.wopt-windsor.workers.dev";
type LocationRow = { public_id:string; name:string; latitude:number; longitude:number; timezone:string; is_default:number };
type DeviceRow = { public_id:string; label?:string|null; last_seen_at:string; location_public_id?:string|null; location_name?:string|null };
type Profile = { account:{ email:string; display_name?:string|null }; locations:LocationRow[]; devices:DeviceRow[] };

export default function VoiceAssistantsPage() {
  const [email,setEmail]=useState("");
  const [requestId,setRequestId]=useState("");
  const [code,setCode]=useState("");
  const [token,setToken]=useState("");
  const [profile,setProfile]=useState<Profile|null>(null);
  const [message,setMessage]=useState("");
  const [busy,setBusy]=useState(false);
  const [locationName,setLocationName]=useState("Home");

  const loadProfile=async(t:string)=>{
    const r=await fetch(`${API}/voice/account`,{headers:{Authorization:`Bearer ${t}`},cache:"no-store"});
    if(!r.ok)throw new Error("Please sign in again");
    setProfile(await r.json());
  };

  useEffect(()=>{
    const saved=localStorage.getItem("hassoun:voice-manage-token")||"";
    if(!saved)return;setToken(saved);void loadProfile(saved).catch(()=>{localStorage.removeItem("hassoun:voice-manage-token");setToken("");});
  },[]);

  const requestCode=async()=>{
    setBusy(true);setMessage("");
    try{const r=await fetch(`${API}/voice/account/request-code`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email})});const j=await r.json();if(!r.ok)throw new Error(j.error||"Could not send code");setRequestId(j.requestId);setMessage("Verification code sent. Check your email.");}catch(e){setMessage(e instanceof Error?e.message:"Could not send code");}finally{setBusy(false);}
  };

  const verify=async()=>{
    setBusy(true);setMessage("");
    try{const r=await fetch(`${API}/voice/account/verify`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({requestId,code})});const j=await r.json();if(!r.ok)throw new Error(j.error||"Invalid code");localStorage.setItem("hassoun:voice-manage-token",j.token);setToken(j.token);await loadProfile(j.token);setMessage("Signed in to your Hassoun voice profile.");}catch(e){setMessage(e instanceof Error?e.message:"Could not verify code");}finally{setBusy(false);}
  };

  const addCurrentLocation=()=>{
    if(!token)return;
    if(!navigator.geolocation){setMessage("Location is not available in this browser.");return;}
    setBusy(true);setMessage("Getting your location…");
    navigator.geolocation.getCurrentPosition(async pos=>{
      try{const timezone=Intl.DateTimeFormat().resolvedOptions().timeZone||"UTC";const r=await fetch(`${API}/voice/account/locations`,{method:"POST",headers:{Authorization:`Bearer ${token}`,"Content-Type":"application/json"},body:JSON.stringify({name:locationName||"Home",latitude:pos.coords.latitude,longitude:pos.coords.longitude,timezone,isDefault:!profile?.locations?.length})});const j=await r.json();if(!r.ok)throw new Error(j.error||"Could not save location");await loadProfile(token);setMessage("Prayer location saved.");}catch(e){setMessage(e instanceof Error?e.message:"Could not save location");}finally{setBusy(false);}
    },()=>{setBusy(false);setMessage("Location permission was not granted.");},{enableHighAccuracy:true,timeout:10000,maximumAge:300000});
  };

  const assign=async(deviceId:string,locationId:string)=>{
    if(!token)return;setBusy(true);setMessage("");
    try{const r=await fetch(`${API}/voice/account/device-location`,{method:"POST",headers:{Authorization:`Bearer ${token}`,"Content-Type":"application/json"},body:JSON.stringify({deviceId,locationId})});const j=await r.json();if(!r.ok)throw new Error(j.error||"Could not assign device");await loadProfile(token);setMessage("Echo location updated.");}catch(e){setMessage(e instanceof Error?e.message:"Could not assign device");}finally{setBusy(false);}
  };

  const logout=()=>{localStorage.removeItem("hassoun:voice-manage-token");setToken("");setProfile(null);setRequestId("");setCode("");setMessage("");};

  return <main style={{minHeight:"100dvh",background:"#f7f4ec",color:"#17362e",padding:"24px 18px 60px"}}>
    <div style={{width:"min(980px,100%)",margin:"0 auto"}}>
      <a href="/" style={{display:"inline-flex",color:"#0b5b47",fontWeight:800,marginBottom:24}}>← Hassoun</a>
      <section style={{borderRadius:28,padding:"28px 26px",background:"linear-gradient(135deg,#074436,#0b5b47)",color:"white",boxShadow:"0 22px 60px rgba(7,68,54,.18)"}}>
        <div style={{fontSize:12,fontWeight:900,letterSpacing:".14em",color:"#bfe4d7"}}>HASSOUN SMART HOME</div>
        <h1 style={{margin:"10px 0",fontSize:"clamp(34px,6vw,58px)",lineHeight:1}}>Alexa + Hassoun</h1>
        <p style={{margin:0,maxWidth:760,color:"#d9eee7",lineHeight:1.6}}>Prayer voice questions and the Echo Show dashboard already work. Hassoun now also has the account/profile layer for saved prayer locations and assigning a different location to each linked Echo.</p>
      </section>

      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))",gap:16,marginTop:22}}>
        <section style={{border:"1px solid #bfe0d2",borderRadius:24,background:"#fffdf8",padding:22}}>
          <div style={{fontSize:28}}>🔵</div><h2 style={{margin:"12px 0 7px"}}>Amazon Alexa</h2>
          <span style={{display:"inline-block",borderRadius:999,padding:"6px 10px",background:"#e7f6ef",color:"#0b7a5b",fontSize:11,fontWeight:900}}>VOICE + DISPLAY WORKING</span>
          <p style={{color:"#62756e",lineHeight:1.55}}>Ask for prayer times, countdowns, Hijri dates and Islamic events. Echo Show dashboard, widget package and requested reminders are built.</p>
          <div style={{display:"grid",gap:8}}>{["Alexa, open Hassoun.","Alexa, ask Hassoun when Maghrib is.","Alexa, ask Hassoun how long until Isha."].map(x=><div key={x} style={{padding:"10px 12px",borderRadius:12,background:"#f3f7f5",fontSize:13}}>{x}</div>)}</div>
        </section>
        <section style={{border:"1px solid #e2d2a7",borderRadius:24,background:"#fff9e8",padding:22}}>
          <div style={{fontSize:28}}>🏠</div><h2 style={{margin:"12px 0 7px"}}>Smart Adhan automations</h2>
          <p style={{color:"#6f654e",lineHeight:1.55}}>TV muting, speaker-volume changes, lights and state restoration still require a separate Alexa smart-home/routine capability and Amazon approval. Hassoun keeps this separate from the prayer skill so core Alexa features stay reliable.</p>
        </section>
      </div>

      <section style={{marginTop:20,border:"1px solid #cfe0d9",borderRadius:24,background:"#fffdf8",padding:22}}>
        <div style={{display:"flex",justifyContent:"space-between",gap:12,alignItems:"center",flexWrap:"wrap"}}><div><div style={{fontSize:12,fontWeight:900,letterSpacing:".1em",color:"#0b5b47"}}>HASSOUN VOICE PROFILE</div><h2 style={{margin:"6px 0 0"}}>Saved locations & Echo assignments</h2></div>{token?<button onClick={logout} style={{border:"1px solid #cfdad5",background:"white",borderRadius:12,padding:"10px 14px",fontWeight:800}}>Sign out</button>:null}</div>
        {!token ? <div style={{marginTop:18,maxWidth:560}}>
          <p style={{color:"#62756e",lineHeight:1.55}}>Sign in with your email. Hassoun uses a one-time code—no password is stored.</p>
          <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="Email address" style={{boxSizing:"border-box",width:"100%",padding:13,border:"1px solid #cfdad5",borderRadius:12,fontSize:16}} />
          {!requestId?<button disabled={busy||!email} onClick={requestCode} style={{width:"100%",marginTop:10,padding:13,border:0,borderRadius:12,background:"#0b5b47",color:"white",fontWeight:900}}>Email me a code</button>:<div style={{marginTop:10}}><input value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,"").slice(0,6))} placeholder="6-digit code" inputMode="numeric" style={{boxSizing:"border-box",width:"100%",padding:13,border:"1px solid #cfdad5",borderRadius:12,fontSize:22,letterSpacing:5,textAlign:"center"}}/><button disabled={busy||code.length!==6} onClick={verify} style={{width:"100%",marginTop:10,padding:13,border:0,borderRadius:12,background:"#0b5b47",color:"white",fontWeight:900}}>Verify & sign in</button></div>}
        </div> : <div style={{marginTop:18}}>
          <p style={{margin:"0 0 14px",color:"#526c63"}}>Signed in as <strong>{profile?.account?.email}</strong>.</p>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(250px,1fr))",gap:14}}>
            <div style={{background:"#f3f7f5",borderRadius:18,padding:16}}><h3 style={{marginTop:0}}>Add this location</h3><input value={locationName} onChange={e=>setLocationName(e.target.value)} placeholder="Home, Office, Parents…" style={{boxSizing:"border-box",width:"100%",padding:11,border:"1px solid #cfdad5",borderRadius:10}}/><button disabled={busy} onClick={addCurrentLocation} style={{width:"100%",marginTop:10,padding:12,border:0,borderRadius:11,background:"#0b5b47",color:"white",fontWeight:900}}>Use my current location</button></div>
            <div style={{background:"#f3f7f5",borderRadius:18,padding:16}}><h3 style={{marginTop:0}}>Saved prayer locations</h3>{profile?.locations?.length?profile.locations.map(l=><div key={l.public_id} style={{padding:"9px 0",borderBottom:"1px solid #dbe5e0"}}><strong>{l.name}</strong>{l.is_default?<span style={{marginLeft:8,fontSize:11,color:"#0b7a5b"}}>DEFAULT</span>:null}<div style={{fontSize:12,color:"#6b7c75"}}>{l.timezone}</div></div>):<p style={{color:"#6b7c75"}}>No saved locations yet.</p>}</div>
          </div>
          <div style={{marginTop:14,background:"#f3f7f5",borderRadius:18,padding:16}}><h3 style={{marginTop:0}}>Your Echo devices</h3>{profile?.devices?.length?profile.devices.map(d=><div key={d.public_id} style={{display:"grid",gridTemplateColumns:"minmax(120px,1fr) minmax(160px,260px)",gap:12,alignItems:"center",padding:"10px 0",borderBottom:"1px solid #dbe5e0"}}><div><strong>{d.label||"Echo device"}</strong><div style={{fontSize:12,color:"#6b7c75"}}>Last seen {new Date(d.last_seen_at).toLocaleString()}</div></div><select value={d.location_public_id||""} onChange={e=>void assign(d.public_id,e.target.value)} style={{padding:10,border:"1px solid #cfdad5",borderRadius:10,background:"white"}}><option value="" disabled>Choose location</option>{profile.locations.map(l=><option key={l.public_id} value={l.public_id}>{l.name}</option>)}</select></div>):<p style={{color:"#6b7c75",lineHeight:1.5}}>No Echo has checked in to this Hassoun account yet. After Amazon account linking is enabled, open Hassoun once on each Echo and it will appear here automatically.</p>}</div>
        </div>}
        {message?<div style={{marginTop:14,padding:"11px 13px",borderRadius:12,background:"#edf5f1",color:"#35584e"}}>{message}</div>:null}
      </section>

      <section style={{marginTop:18,border:"1px solid #e2d2a7",borderRadius:22,background:"#fff9e8",padding:20}}><h2 style={{margin:0,fontSize:20}}>One-time production setup still required</h2><p style={{margin:"8px 0 0",color:"#6f654e",lineHeight:1.6}}>The Hassoun OAuth/profile service is now in the codebase. Amazon still needs the authorization URL, token URL, client ID and matching client secret entered in the Alexa Developer Console, and the Worker needs that same secret as a protected environment secret. The Alexa Lambda must also be updated with the new linked wrapper package.</p></section>
    </div>
  </main>;
}
