"use client";

import { FormEvent, useState } from "react";

const API_BASE=(process.env.NEXT_PUBLIC_PUSH_API_URL||"https://wopt-prayer-push.wopt-windsor.workers.dev").replace(/\/$/,"");
const LOGO="/hassoun-official-logo.jpg?v=20260825-official-2";

export default function SupportPage() {
  const [name,setName]=useState("");
  const [email,setEmail]=useState("");
  const [subject,setSubject]=useState("Website support");
  const [message,setMessage]=useState("");
  const [busy,setBusy]=useState(false);
  const [notice,setNotice]=useState<{ok:boolean;text:string}|null>(null);

  async function submit(e:FormEvent){
    e.preventDefault();
    setNotice(null);
    if(!/^\S+@\S+\.\S+$/.test(email.trim())){setNotice({ok:false,text:"Please enter a valid email address."});return;}
    if(message.trim().length<10){setNotice({ok:false,text:"Please give us a little more detail so we can help."});return;}
    setBusy(true);
    try{
      const response=await fetch(`${API_BASE}/support/contact`,{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({name:name.trim(),email:email.trim(),subject:subject.trim(),message:message.trim(),locale:"en",platform:"web",appVersion:"hassoun.app"})
      });
      const data=await response.json().catch(()=>({})) as {error?:string;contactId?:string};
      if(!response.ok) throw new Error(data.error||"Your message could not be sent.");
      setNotice({ok:true,text:"Thank you. Your message was sent to Hassoun Support and saved in the CRM."});
      setMessage("");
    }catch(error){setNotice({ok:false,text:error instanceof Error?error.message:"Your message could not be sent."});}
    finally{setBusy(false);}
  }

  const field:React.CSSProperties={width:"100%",boxSizing:"border-box",border:"1px solid #c9d8d2",borderRadius:14,padding:"13px 14px",fontSize:16,background:"#fff",color:"#173f35",outline:"none"};
  const label:React.CSSProperties={display:"grid",gap:7,fontWeight:800,color:"#173f35"};

  return (
    <main style={{minHeight:"100vh",background:"#f7f4ec",color:"#173f35",padding:"28px 16px 90px",fontFamily:"Arial, sans-serif"}}>
      <div style={{maxWidth:760,margin:"0 auto"}}>
        <section style={{background:"#0b5b47",color:"white",borderRadius:28,padding:"24px",display:"flex",gap:18,alignItems:"center",boxShadow:"0 12px 32px rgba(11,91,71,.14)"}}>
          <img src={LOGO} alt="Hassoun" style={{width:86,height:86,objectFit:"cover",borderRadius:22,border:"1px solid rgba(255,255,255,.28)"}}/>
          <div><div style={{fontSize:12,fontWeight:900,letterSpacing:2,color:"#f0cf80"}}>HASSOUN SUPPORT</div><h1 style={{fontSize:34,margin:"5px 0 6px"}}>Contact Us</h1><p style={{margin:0,color:"#d8ebe5",lineHeight:1.5}}>Questions, technical issues, feedback, privacy requests or anything we can help with.</p></div>
        </section>

        <form onSubmit={submit} style={{marginTop:18,background:"#fffdf8",border:"1px solid #e4ded3",borderRadius:24,padding:22,display:"grid",gap:16}}>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:14}}>
            <label style={label}>Your name<input style={field} value={name} onChange={e=>setName(e.target.value)} placeholder="Name" maxLength={100}/></label>
            <label style={label}>Email address<input style={field} type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com" required maxLength={254}/></label>
          </div>
          <label style={label}>Subject<select style={field} value={subject} onChange={e=>setSubject(e.target.value)}><option>Website support</option><option>Prayer times / location</option><option>Qur’an / Tahfiz School</option><option>Adhan / notifications</option><option>Email alerts</option><option>Account / privacy request</option><option>Feature suggestion</option><option>Other</option></select></label>
          <label style={label}>Message<textarea style={{...field,minHeight:150,resize:"vertical",lineHeight:1.5}} value={message} onChange={e=>setMessage(e.target.value)} placeholder="Tell us what happened or how we can help…" required maxLength={5000}/></label>
          {notice?<div role="status" style={{padding:"13px 15px",borderRadius:14,fontWeight:800,background:notice.ok?"#e8f6ef":"#fff0ed",color:notice.ok?"#0b654f":"#8d3328"}}>{notice.text}</div>:null}
          <button type="submit" disabled={busy} style={{border:0,borderRadius:15,padding:"14px 18px",fontSize:17,fontWeight:900,background:"#0b654f",color:"white",cursor:busy?"wait":"pointer",opacity:busy?.75:1}}>{busy?"Sending…":"Send message"}</button>
        </form>

        <section style={{marginTop:16,display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(240px,1fr))",gap:14}}>
          <div style={{background:"#eaf5f0",borderRadius:20,padding:20}}><h2 style={{marginTop:0}}>Helpful details</h2><p style={{lineHeight:1.6,marginBottom:0}}>For technical problems, include the page you were using, your device/browser, and what you expected to happen. Screenshots are helpful when available.</p></div>
          <div style={{background:"#fff7e8",borderRadius:20,padding:20}}><h2 style={{marginTop:0}}>Privacy requests</h2><p style={{lineHeight:1.6,marginBottom:0}}>Choose <strong>Account / privacy request</strong>. Email subscribers can also manage or unsubscribe from the link included in Hassoun emails.</p></div>
        </section>
      </div>
    </main>
  );
}
