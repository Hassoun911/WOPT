"use client";

import { useEffect, useMemo, useState } from "react";

const STORAGE = "hassoun:web-masjid-tv:v2";
const DATA_URL = "https://raw.githubusercontent.com/Hassoun911/WOPT/main/windsor_islamic_association_2026_prayer_times.json";
const PRAYERS = ["fajr","dhuhr","asr","maghrib","isha"] as const;
type Prayer = typeof PRAYERS[number];
type Day = Record<Prayer,string>;
const EN: Record<Prayer,string> = { fajr:"Fajr", dhuhr:"Dhuhr", asr:"Asr", maghrib:"Maghrib", isha:"Isha" };
const AR: Record<Prayer,string> = { fajr:"الفجر", dhuhr:"الظهر", asr:"العصر", maghrib:"المغرب", isha:"العشاء" };
const FALLBACK: Day = { fajr:"05:00", dhuhr:"13:30", asr:"17:00", maghrib:"20:00", isha:"21:30" };
const COLORS = ["#0B6B55", "#08795E", "#0A5B4A", "#146B63", "#255F48", "#4A6C46"];

const pad=(n:number)=>String(n).padStart(2,"0");
const dayKey=(d:Date)=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const mins=(v:string)=>{const m=String(v||"").match(/^(\d{1,2}):(\d{2})/);return m?Number(m[1])*60+Number(m[2]):NaN};
const pretty=(v:string)=>{const m=String(v||"").match(/^(\d{1,2}):(\d{2})/);if(!m)return v||"—";const raw=Number(m[1]),ap=raw>=12?"PM":"AM";return `${raw%12||12}:${m[2]} ${ap}`};
function readSettings(){try{return JSON.parse(localStorage.getItem(STORAGE)||"{}") as Record<string,any>}catch{return {}}}

export default function TabletWallDisplayMode(){
  const [tablet,setTablet]=useState(false);
  const [now,setNow]=useState(new Date());
  const [today,setToday]=useState<Day>(FALLBACK);
  const [settings,setSettings]=useState<Record<string,any>>({});
  const [slide,setSlide]=useState(0);
  const [menu,setMenu]=useState(false);

  useEffect(()=>{
    const params=new URLSearchParams(location.search);
    const enabled=params.get("mode")==="tablet";
    setTablet(enabled);
    if(!enabled)return;
    document.documentElement.dataset.hassounTabletWall="1";
    document.body.dataset.hassounTabletWall="1";
    const initial=readSettings();setSettings(initial);
    const schedule=initial.prayerSchedule&&typeof initial.prayerSchedule==="object"?initial.prayerSchedule:{};
    const row=schedule[dayKey(new Date())]?.adhan;
    if(row&&PRAYERS.every(p=>row[p])) setToday(row as Day);
    else void fetch(DATA_URL).then(r=>r.json()).then((d:{prayer_times?:Record<string,Day>})=>{const x=d.prayer_times?.[dayKey(new Date())];if(x)setToday(x)}).catch(()=>undefined);
    const clock=window.setInterval(()=>setNow(new Date()),1000);
    const storage=(e:StorageEvent)=>{if(e.key===STORAGE){const s=readSettings();setSettings(s);const r=s.prayerSchedule?.[dayKey(new Date())]?.adhan;if(r)setToday(r)}};
    window.addEventListener("storage",storage);
    return()=>{window.clearInterval(clock);window.removeEventListener("storage",storage);delete document.documentElement.dataset.hassounTabletWall;delete document.body.dataset.hassounTabletWall};
  },[]);

  const next=useMemo<Prayer>(()=>{const n=now.getHours()*60+now.getMinutes();for(const p of PRAYERS){const m=mins(today[p]);if(Number.isFinite(m)&&m>n)return p}return "fajr"},[now,today]);
  useEffect(()=>{if(!tablet)return;const id=window.setInterval(()=>setSlide(v=>(v+1)%PRAYERS.length),Math.max(4,Number(settings.tabletSliderSeconds||8))*1000);return()=>window.clearInterval(id)},[tablet,settings.tabletSliderSeconds]);
  if(!tablet)return null;

  const p=PRAYERS[slide], active=p===next;
  const nextBg=String(settings.nextPrayerCardColor||"#0B6B55");
  const miniBg=String(settings.nextPrayerMiniCardColor||nextBg);
  const highlightBig=settings.highlightNextPrayerCard!==false;
  const highlightMini=settings.highlightNextPrayerMiniCard!==false;
  const time=now.toLocaleTimeString([], {hour:"numeric",minute:"2-digit",second:"2-digit"});
  const date=now.toLocaleDateString([], {weekday:"long",month:"long",day:"numeric",year:"numeric"});
  let hijri="";try{hijri=new Intl.DateTimeFormat("en-u-ca-islamic",{day:"numeric",month:"long",year:"numeric"}).format(now)}catch{}
  const locationLabel=String(settings.mosqueLocation||settings.locationLabel||"Local prayer times");
  const save=(patch:Record<string,any>)=>{const next={...readSettings(),...patch};localStorage.setItem(STORAGE,JSON.stringify(next));setSettings(next);window.dispatchEvent(new StorageEvent("storage",{key:STORAGE,newValue:JSON.stringify(next)}))};

  return <div className="htw-root">
    <style>{`
      html[data-hassoun-tablet-wall='1'],html[data-hassoun-tablet-wall='1'] body{margin:0!important;background:#03221c!important;overflow:hidden!important}
      html[data-hassoun-tablet-wall='1'] body>*:not(.htw-root){visibility:hidden!important}
      .htw-root{position:fixed;inset:0;z-index:2147483646;background:radial-gradient(circle at 50% 20%,#0b5748 0,#063c33 42%,#03221c 100%);color:#fff;font-family:Arial,sans-serif;display:flex;flex-direction:column;padding:2.2vh 3.2vw 1.5vh;box-sizing:border-box;overflow:hidden}
      .htw-clock{align-self:center;background:none;border:0;color:white;cursor:pointer;text-align:center}.htw-time{font-size:clamp(64px,12vw,118px);font-weight:900;line-height:.96;letter-spacing:-.06em}.htw-tap{color:#7ba69a;font-size:11px;margin-top:5px}.htw-meta{text-align:center;color:#bdd1ca;font-size:clamp(12px,2.1vw,18px);margin-top:1vh}.htw-meta b{display:block;color:#e9c765;margin-top:.4vh}
      .htw-hero{flex:1;min-height:0;margin:2vh auto 1.4vh;width:min(91vw,760px);border:2px solid rgba(230,194,91,.72);border-radius:28px;background:#0b493d;box-shadow:0 18px 46px rgba(0,0,0,.34),inset 0 1px 0 rgba(255,255,255,.1);display:flex;flex-direction:column;align-items:center;justify-content:center;position:relative;transition:background .35s ease}.htw-badge{position:absolute;top:3%;font-size:11px;letter-spacing:.22em;font-weight:900;color:#f3d375}.htw-ar{font-size:clamp(74px,17vw,150px);font-weight:900;line-height:1.05}.htw-en{font-size:clamp(35px,7vw,64px);font-weight:900;margin-top:1vh}.htw-prayer-time{font-size:clamp(48px,10vw,90px);font-weight:900;color:#f1cf69;margin-top:2vh}.htw-dots{position:absolute;bottom:3%;display:flex;gap:7px}.htw-dot{width:8px;height:8px;border-radius:8px;background:rgba(255,255,255,.24)}.htw-dot.on{width:26px;background:#e8c864}
      .htw-mini{display:grid;grid-template-columns:repeat(5,1fr);gap:7px}.htw-mini-card{min-width:0;border:1px solid rgba(222,187,87,.46);border-radius:14px;background:#0a4036;padding:1vh .3vw;text-align:center;cursor:pointer;color:white;position:relative}.htw-mini-ar{font-size:clamp(13px,2.6vw,23px);font-weight:900;color:#f0d177}.htw-mini-en{font-size:clamp(9px,1.7vw,15px);font-weight:800;margin-top:2px}.htw-mini-time{font-size:clamp(9px,1.7vw,15px);font-weight:900;margin-top:5px}.htw-mini-next{font-size:7px;letter-spacing:.13em;color:#f5d36d;font-weight:900;margin-top:3px}.htw-footer{text-align:center;color:#759b90;font-size:11px;font-weight:700;padding-top:1vh}
      .htw-backdrop{position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,.68);display:flex;align-items:center;justify-content:center;padding:18px}.htw-menu{width:min(92vw,620px);max-height:90vh;overflow:auto;background:#082f28;border:1px solid #4f776c;border-radius:24px;padding:22px;box-sizing:border-box}.htw-menu-head{display:flex;justify-content:space-between;align-items:flex-start}.htw-menu h2{margin:0;font-size:24px}.htw-menu p{color:#a9c0b9}.htw-close{border:0;border-radius:99px;width:40px;height:40px;background:rgba(255,255,255,.09);color:white;font-size:25px}.htw-label{font-size:11px;letter-spacing:.16em;color:#e3c363;font-weight:900;margin:20px 0 10px}.htw-toggle{display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #315b50;padding:12px 0;font-weight:800}.htw-toggle input{width:22px;height:22px}.htw-colors{display:flex;gap:10px;flex-wrap:wrap;margin-top:10px}.htw-color{width:46px;height:46px;border:2px solid rgba(255,255,255,.25);border-radius:13px}.htw-color.sel{outline:3px solid #f2cf6d;outline-offset:2px}.htw-action{display:block;width:100%;border:1px solid #426d61;background:#0a4238;color:white;border-radius:14px;padding:14px;margin-top:9px;font-weight:900;text-align:left;cursor:pointer}
      @media (orientation:landscape){.htw-root{padding-left:12vw;padding-right:12vw}.htw-hero{width:min(68vw,800px)}}
    `}</style>
    <button className="htw-clock" onClick={()=>setMenu(true)}><div className="htw-time">{time}</div><div className="htw-tap">Tap clock for setup</div></button>
    <div className="htw-meta">📍 {locationLabel}<div>{date}</div>{hijri?<b>☾ {hijri}</b>:null}</div>
    <div className="htw-hero" style={active&&highlightBig?{background:nextBg}:undefined}>
      <div className="htw-badge">{active?"NEXT PRAYER":"PRAYER"}</div><div className="htw-ar">{AR[p]}</div><div className="htw-en">{EN[p]}</div><div className="htw-prayer-time">{pretty(today[p])}</div><div className="htw-dots">{PRAYERS.map((x,i)=><span key={x} className={`htw-dot ${i===slide?"on":""}`}/>)}</div>
    </div>
    <div className="htw-mini">{PRAYERS.map((x,i)=>{const isNext=x===next;return <button key={x} className="htw-mini-card" onClick={()=>setSlide(i)} style={isNext&&highlightMini?{background:miniBg,borderColor:"#e8c864"}:undefined}><div className="htw-mini-ar">{AR[x]}</div><div className="htw-mini-en">{EN[x]}</div><div className="htw-mini-time">{pretty(today[x])}</div>{isNext?<div className="htw-mini-next">NEXT</div>:null}</button>})}</div>
    <div className="htw-footer">Prayer • Qur’an • Knowledge</div>
    {menu?<div className="htw-backdrop" onMouseDown={e=>{if(e.currentTarget===e.target)setMenu(false)}}><div className="htw-menu"><div className="htw-menu-head"><div><h2>Tablet Wall Display</h2><p>Customize this vertical display or switch modes.</p></div><button className="htw-close" onClick={()=>setMenu(false)}>×</button></div><div className="htw-label">NEXT PRAYER CARD</div><label className="htw-toggle"><span>Highlight next large prayer card</span><input type="checkbox" checked={highlightBig} onChange={e=>save({highlightNextPrayerCard:e.target.checked})}/></label><label className="htw-toggle"><span>Highlight matching mini card</span><input type="checkbox" checked={highlightMini} onChange={e=>save({highlightNextPrayerMiniCard:e.target.checked})}/></label><div className="htw-colors">{COLORS.map(c=><button key={c} className={`htw-color ${nextBg.toLowerCase()===c.toLowerCase()?"sel":""}`} style={{background:c}} onClick={()=>save({nextPrayerCardColor:c,nextPrayerMiniCardColor:c})}/>)}</div><div className="htw-label">DISPLAY MODE</div><button className="htw-action" onClick={()=>{sessionStorage.setItem("hassoun-web-force-website-session","1");location.href="/?mode=web"}}>🌐 Website Mode</button><button className="htw-action" onClick={()=>{sessionStorage.removeItem("hassoun-web-force-website-session");location.href="/masjid-tv/?mode=tv&activate=1"}}>📺 TV Display Mode</button></div></div>:null}
  </div>;
}
