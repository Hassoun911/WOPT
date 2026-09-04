"use client";

import { useEffect, useMemo, useState } from "react";

const API = "https://wopt-prayer-push.wopt-windsor.workers.dev";
const LOGO = "/hassoun-app-icon.svg?v=20260904-app-match";
const PRAYERS = ["fajr", "dhuhr", "asr", "maghrib", "isha"] as const;
type Prayer = (typeof PRAYERS)[number];
type PrayerPreference = { prayer: Prayer; email_twenty: number; email_ten: number; email_athan: number };
type Subscription = { email:string; locale:"en"|"ar"; timezone:string; city?:string|null; region?:string|null; countryName?:string|null; status:string; preferences?:Record<string,number>|null; prayers?:PrayerPreference[] };
type Loaded = { subscription: Subscription };
type Choice = { twenty:boolean; ten:boolean; athan:boolean };

const names: Record<Prayer,{en:string;ar:string}> = {
  fajr:{en:"Fajr",ar:"الفجر"}, dhuhr:{en:"Dhuhr",ar:"الظهر"}, asr:{en:"Asr",ar:"العصر"}, maghrib:{en:"Maghrib",ar:"المغرب"}, isha:{en:"Isha",ar:"العشاء"}
};

async function request<T>(path:string, init?:RequestInit):Promise<T>{
  const response=await fetch(`${API}${path}`,init);
  const body=await response.json().catch(()=>({})) as T&{error?:string};
  if(!response.ok) throw new Error(body.error||`Request failed (${response.status})`);
  return body;
}

function getPosition(){
  return new Promise<GeolocationPosition>((resolve,reject)=>{
    if(!navigator.geolocation){reject(new Error("Location is not available on this device."));return;}
    navigator.geolocation.getCurrentPosition(resolve,reject,{enableHighAccuracy:false,timeout:12000,maximumAge:300000});
  });
}

async function reversePlace(latitude:number,longitude:number){
  try{
    const url=new URL("https://nominatim.openstreetmap.org/reverse");
    url.searchParams.set("format","jsonv2"); url.searchParams.set("lat",String(latitude)); url.searchParams.set("lon",String(longitude)); url.searchParams.set("zoom","10");
    const r=await fetch(url.toString(),{headers:{Accept:"application/json"}}); if(!r.ok) return {};
    const p=await r.json() as {address?:Record<string,string>}; const a=p.address||{};
    return {city:a.city||a.town||a.village||a.municipality||a.county||null,region:a.state||a.province||null,countryName:a.country||null,countryCode:a.country_code?.toUpperCase()||null};
  }catch{return {};}
}

export default function ManageEmailPage(){
  const [id,setId]=useState(""); const [token,setToken]=useState(""); const [subscription,setSubscription]=useState<Subscription|null>(null);
  const [choices,setChoices]=useState<Record<Prayer,Choice>>(()=>Object.fromEntries(PRAYERS.map(p=>[p,{twenty:false,ten:false,athan:true}])) as Record<Prayer,Choice>);
  const [general,setGeneral]=useState({prayerAlerts:true,dailyPrayerSchedule:false,religiousOccasions:true,dailyContent:false,announcements:true,communityEvents:true,marketing:false});
  const [busy,setBusy]=useState(true); const [message,setMessage]=useState(""); const [error,setError]=useState(""); const [unsubscribed,setUnsubscribed]=useState(false);
  const [landing,setLanding]=useState(false); const [email,setEmail]=useState(""); const [landingBusy,setLandingBusy]=useState(false); const [landingMessage,setLandingMessage]=useState("");

  useEffect(()=>{
    const url=new URL(window.location.href); const publicId=url.searchParams.get("id")||""; const secureToken=url.searchParams.get("token")||"";
    setId(publicId); setToken(secureToken);
    if(!publicId||!secureToken){setLanding(true);setBusy(false);return;}
    void request<Loaded>(`/email/subscribers/preferences?id=${encodeURIComponent(publicId)}&token=${encodeURIComponent(secureToken)}`)
      .then(({subscription:loaded})=>{
        setSubscription(loaded);
        setChoices(Object.fromEntries(PRAYERS.map(prayer=>{const pref=loaded.prayers?.find(e=>e.prayer===prayer);return [prayer,{twenty:pref?.email_twenty===1,ten:pref?.email_ten===1,athan:pref?.email_athan!==0}]})) as Record<Prayer,Choice>);
        const prefs=loaded.preferences||{};
        setGeneral({prayerAlerts:prefs.prayer_alerts!==0,dailyPrayerSchedule:prefs.daily_prayer_schedule===1,religiousOccasions:prefs.religious_occasions!==0,dailyContent:prefs.daily_content===1,announcements:prefs.announcements!==0,communityEvents:prefs.community_events!==0,marketing:prefs.marketing===1});
      })
      .catch(cause=>setError(cause instanceof Error?cause.message:"Unable to open this manage link."))
      .finally(()=>setBusy(false));
  },[]);

  const locale=subscription?.locale==="ar"?"ar":"en";
  const location=useMemo(()=>subscription?[subscription.city,subscription.region,subscription.countryName].filter(Boolean).join(", ")||subscription.timezone:"",[subscription]);
  const updateChoice=(prayer:Prayer,key:keyof Choice,value:boolean)=>setChoices(current=>({...current,[prayer]:{...current[prayer],[key]:value}}));

  const sendSecureLink=async()=>{
    const normalized=email.trim().toLowerCase(); if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)){setError("Enter a valid email address.");return;}
    setLandingBusy(true); setError(""); setLandingMessage("");
    try{
      const pos=await getPosition(); const place=await reversePlace(pos.coords.latitude,pos.coords.longitude); const timezone=Intl.DateTimeFormat().resolvedOptions().timeZone||"UTC";
      const result=await request<{alreadySubscribed?:boolean;verificationRequired?:boolean;message?:string}>("/email/subscribers",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email:normalized,locale:"en",latitude:pos.coords.latitude,longitude:pos.coords.longitude,timezone,...place,preferences:{prayerAlerts:true,religiousOccasions:true,announcements:true,communityEvents:true},prayers:Object.fromEntries(PRAYERS.map(p=>[p,{twenty:false,ten:false,athan:true}]))})});
      setLandingMessage(result.alreadySubscribed?"A secure manage link was sent to your email.":"Check your email to confirm Hassoun alerts. After confirmation, your secure manage link will work anytime.");
    }catch(cause){setError(cause instanceof Error?cause.message:"Unable to send the secure link.");}
    finally{setLandingBusy(false);}
  };

  const save=async()=>{if(!id||!token)return;setBusy(true);setError("");setMessage("");try{await request("/email/subscribers/preferences",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({id,token,locale,preferences:general,prayers:Object.fromEntries(PRAYERS.map(prayer=>[prayer,choices[prayer]]))})});setMessage(locale==="ar"?"تم حفظ إعدادات البريد.":"Your email alert settings are saved.");}catch(cause){setError(cause instanceof Error?cause.message:"Unable to save settings.");}finally{setBusy(false);}};
  const unsubscribe=async()=>{if(!id||!token||!window.confirm(locale==="ar"?"هل تريد إيقاف جميع رسائل Hassoun؟":"Stop all Hassoun emails for this address?"))return;setBusy(true);setError("");try{await request("/email/subscribers/unsubscribe",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({id,token})});setUnsubscribed(true);}catch(cause){setError(cause instanceof Error?cause.message:"Unable to unsubscribe.");}finally{setBusy(false);}};

  if(landing) return <main style={s.center}><div style={s.landingCard}><img src={LOGO} alt="Hassoun" width={84} height={84} style={s.landingLogo}/><p style={s.eyebrow}>HASSOUN</p><h1 style={s.h1}>Email Alerts</h1><p style={s.muted}>Enter your email to receive a secure link for managing your Hassoun email alerts. If you are new, Hassoun will send a confirmation first.</p><input value={email} onChange={e=>setEmail(e.target.value)} inputMode="email" autoComplete="email" placeholder="you@example.com" style={s.input}/>{error?<p style={s.error}>{error}</p>:null}{landingMessage?<p style={s.success}>{landingMessage}</p>:null}<button onClick={()=>void sendSecureLink()} disabled={landingBusy} style={s.primary}>{landingBusy?"Sending…":"Send secure email link"}</button><a href="../../" style={s.backButton}>Return to Hassoun</a><p style={s.privacy}>For privacy, email settings are opened only through a secure personal link.</p></div></main>;
  if(busy&&!subscription) return <main style={s.center}><div style={s.card}><p>Loading email settings…</p></div></main>;
  if(error&&!subscription) return <main style={s.center}><div style={s.landingCard}><img src={LOGO} alt="Hassoun" width={72} height={72} style={s.landingLogo}/><h1 style={s.h1}>Hassoun Email Alerts</h1><p style={s.error}>{error}</p><a href="/email/manage/" style={s.backButton}>Request a new secure link</a><a href="../../" style={s.link}>Return to Hassoun</a></div></main>;
  if(unsubscribed) return <main style={s.center}><div style={s.card}><h1 style={s.h1}>{locale==="ar"?"تم إلغاء الاشتراك":"Unsubscribed"}</h1><p style={s.muted}>{locale==="ar"?"لن يتم إرسال رسائل Hassoun إلى هذا البريد بعد الآن.":"Hassoun will no longer send email to this address."}</p><a href="../../" style={s.link}>Return to Hassoun</a></div></main>;

  return <main style={s.page} dir={locale==="ar"?"rtl":"ltr"}><div style={s.shell}>
    <header style={s.header}><div style={s.brandRow}><img src={LOGO} alt="Hassoun" width={56} height={56} style={s.logo}/><div><p style={s.eyebrow}>HASSOUN</p><h1 style={s.h1}>{locale==="ar"?"إدارة تنبيهات البريد":"Manage email alerts"}</h1><p style={s.muted}>{subscription?.email}</p></div></div><a href="../../" style={s.link}>{locale==="ar"?"العودة":"Back"}</a></header>
    <section style={s.location}><strong>📍 {location}</strong><span style={s.small}>{subscription?.timezone}</span></section>
    <section style={s.card}><div style={s.titleRow}><div><p style={s.eyebrow}>{locale==="ar"?"مواقيت الصلاة":"PRAYER TIMES"}</p><h2 style={s.h2}>{locale==="ar"?"اختيارات التنبيه":"Prayer alert choices"}</h2></div><input type="checkbox" checked={general.prayerAlerts} onChange={e=>setGeneral(g=>({...g,prayerAlerts:e.target.checked}))} style={s.bigCheck}/></div><div style={s.prayerHeader}><span></span><span>20 min</span><span>10 min</span><span>{locale==="ar"?"الوقت":"At time"}</span></div>{PRAYERS.map(prayer=><div key={prayer} style={s.prayerRow}><strong>{names[prayer][locale]}</strong><input type="checkbox" checked={choices[prayer].twenty} onChange={e=>updateChoice(prayer,"twenty",e.target.checked)}/><input type="checkbox" checked={choices[prayer].ten} onChange={e=>updateChoice(prayer,"ten",e.target.checked)}/><input type="checkbox" checked={choices[prayer].athan} onChange={e=>updateChoice(prayer,"athan",e.target.checked)}/></div>)}</section>
    <section style={s.card}><p style={s.eyebrow}>{locale==="ar"?"رسائل أخرى":"OTHER EMAILS"}</p><h2 style={s.h2}>{locale==="ar"?"اختيارات المحتوى":"Content preferences"}</h2>{([["religiousOccasions",locale==="ar"?"المناسبات الإسلامية":"Islamic occasions"],["announcements",locale==="ar"?"إعلانات Hassoun":"Hassoun announcements"],["communityEvents",locale==="ar"?"فعاليات المجتمع":"Community events"],["dailyContent",locale==="ar"?"المحتوى الإسلامي اليومي":"Daily Islamic content"],["marketing",locale==="ar"?"العروض والرعاة":"Offers and sponsors"]] as const).map(([key,label])=><label key={key} style={s.toggleRow}><span>{label}</span><input type="checkbox" checked={general[key]} onChange={e=>setGeneral(g=>({...g,[key]:e.target.checked}))}/></label>)}</section>
    {error?<p style={s.error}>{error}</p>:null}{message?<p style={s.success}>{message}</p>:null}<button onClick={()=>void save()} disabled={busy} style={s.primary}>{busy?(locale==="ar"?"جارٍ الحفظ…":"Saving…"):(locale==="ar"?"حفظ الإعدادات":"Save settings")}</button><button onClick={()=>void unsubscribe()} disabled={busy} style={s.danger}>{locale==="ar"?"إلغاء الاشتراك من جميع الرسائل":"Unsubscribe from all emails"}</button><p style={s.privacy}>{locale==="ar"?"لا تحتاج إلى حساب أو كلمة مرور. هذا الرابط الآمن هو مفتاح إدارة اشتراكك.":"No account or password is required. This secure link is the key to managing your subscription."}</p>
  </div></main>;
}

const s:Record<string,React.CSSProperties>={
  page:{minHeight:"100vh",background:"#f4f2e9",color:"#173f35",padding:20,fontFamily:"system-ui,-apple-system,sans-serif"},center:{minHeight:"100vh",display:"grid",placeItems:"center",padding:20,background:"#f4f2e9",color:"#173f35",fontFamily:"system-ui,-apple-system,sans-serif"},shell:{width:"min(720px,100%)",margin:"0 auto"},header:{display:"flex",justifyContent:"space-between",alignItems:"center",gap:16,marginBottom:18},brandRow:{display:"flex",alignItems:"center",gap:12},logo:{borderRadius:16,objectFit:"cover"},landingLogo:{borderRadius:22,objectFit:"cover",marginBottom:10},landingCard:{width:"min(520px,100%)",background:"#fff",border:"1px solid #d7dfda",borderRadius:28,padding:24,boxShadow:"0 16px 46px rgba(25,63,53,.08)"},eyebrow:{margin:0,color:"#17705b",letterSpacing:2,fontSize:11,fontWeight:900},h1:{margin:"5px 0",fontSize:30},h2:{margin:"5px 0 0",fontSize:20},muted:{color:"#71837d",margin:"8px 0",lineHeight:1.55},small:{color:"#71837d",fontSize:12},card:{background:"white",border:"1px solid #d7dfda",borderRadius:22,padding:20,marginTop:14},location:{display:"flex",flexDirection:"column",gap:3,padding:"12px 15px",borderRadius:15,background:"#e9f3ef",color:"#0b5b47"},titleRow:{display:"flex",justifyContent:"space-between",alignItems:"center"},bigCheck:{width:22,height:22},prayerHeader:{display:"grid",gridTemplateColumns:"1.5fr repeat(3,.7fr)",gap:8,alignItems:"center",marginTop:18,paddingBottom:8,color:"#71837d",fontSize:11,textAlign:"center"},prayerRow:{display:"grid",gridTemplateColumns:"1.5fr repeat(3,.7fr)",gap:8,alignItems:"center",minHeight:48,borderTop:"1px solid #edf1ef",textAlign:"center"},toggleRow:{display:"flex",justifyContent:"space-between",alignItems:"center",gap:15,minHeight:48,borderTop:"1px solid #edf1ef",fontSize:14},input:{width:"100%",boxSizing:"border-box",minHeight:52,border:"1px solid #cbd8d3",borderRadius:14,padding:"0 14px",fontSize:16,marginTop:14,background:"#fff"},primary:{width:"100%",minHeight:50,border:0,borderRadius:14,background:"#0b5b47",color:"white",fontWeight:900,marginTop:16,cursor:"pointer"},danger:{width:"100%",minHeight:46,border:"1px solid #e1b6b1",borderRadius:14,background:"#fff6f4",color:"#9b3e35",fontWeight:800,marginTop:10,cursor:"pointer"},backButton:{display:"block",textAlign:"center",marginTop:10,padding:"13px 16px",borderRadius:14,background:"#edf4f1",color:"#0b5b47",fontWeight:800,textDecoration:"none"},link:{color:"#0b5b47",fontWeight:800,textDecoration:"none"},error:{background:"#fff0ed",color:"#943a32",padding:12,borderRadius:12},success:{background:"#e9f8f1",color:"#0b6f52",padding:12,borderRadius:12},privacy:{color:"#80908b",fontSize:11,textAlign:"center",lineHeight:1.5,marginTop:14}
};