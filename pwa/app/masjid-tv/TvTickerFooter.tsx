"use client";

import { useEffect, useState } from "react";

const SETTINGS_KEY = "hassoun:web-masjid-tv:v2";
type Effect="none"|"pulse"|"flash";
type TickerSettings={text:string;speed:number;color:string;effect:Effect};

function readTicker():TickerSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY) || "{}";
    const settings = JSON.parse(raw) as Record<string, unknown>;
    const text=typeof settings.tickerText === "string" ? settings.tickerText.trim() : "";
    const n=Number(settings.tickerSpeed);
    const speed=Number.isFinite(n)?Math.max(6,Math.min(40,n)):18;
    const color=typeof settings.tickerColor==="string"&&/^#[0-9a-f]{6}$/i.test(settings.tickerColor)?settings.tickerColor:"#f3d47e";
    const effect:Effect=settings.tickerEffect==="pulse"||settings.tickerEffect==="flash"?settings.tickerEffect:"none";
    return {text,speed,color,effect};
  } catch {
    return {text:"",speed:18,color:"#f3d47e",effect:"none"};
  }
}

function isTvDisplayPath(){
  const p=window.location.pathname.replace(/\/+$/,"").toLowerCase();
  return p==="/masjid-tv";
}

export default function TvTickerFooter() {
  const [ticker, setTicker] = useState<TickerSettings>({text:"",speed:18,color:"#f3d47e",effect:"none"});
  const [enabled,setEnabled]=useState(false);

  useEffect(() => {
    setEnabled(isTvDisplayPath());
    const sync = () => setTicker(readTicker());
    sync();
    const timer = window.setInterval(sync, 1000);
    window.addEventListener("storage", sync);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("storage", sync);
    };
  }, []);

  if(!enabled)return null;
  const effectClass=ticker.effect==="pulse"?" ticker-pulse":ticker.effect==="flash"?" ticker-flash":"";
  return <>
    <style>{`
      @keyframes hassounMasjidTickerMove{from{transform:translateX(100%)}to{transform:translateX(-100%)}}
      @keyframes hassounTickerPulse{0%,100%{opacity:1;filter:brightness(1)}50%{opacity:.55;filter:brightness(1.45)}}
      @keyframes hassounTickerFlash{0%,44%,56%,100%{opacity:1}45%,55%{opacity:.12}}
      .hassoun-tv-ticker-footer{position:absolute;left:0;right:0;bottom:0;height:6%;z-index:2147483000;background:#073b32;border-top:1px solid rgba(165,138,76,.45);display:flex;align-items:center;color:#f7f4eb;font-family:Arial,Helvetica,sans-serif;overflow:hidden}
      .hassoun-tv-ticker-track{position:relative;flex:1;height:100%;overflow:hidden;min-width:0}
      .hassoun-tv-ticker-text{position:absolute;left:0;top:0;height:100%;display:flex;align-items:center;white-space:nowrap;font-size:clamp(14px,1.15vw,25px);font-weight:800;letter-spacing:.02em;will-change:transform;padding-left:2vw}
      .hassoun-tv-ticker-text.ticker-pulse{animation-name:hassounMasjidTickerMove,hassounTickerPulse!important;animation-timing-function:linear,ease-in-out!important;animation-iteration-count:infinite,infinite!important;animation-duration:var(--ticker-speed),1.25s!important}
      .hassoun-tv-ticker-text.ticker-flash{animation-name:hassounMasjidTickerMove,hassounTickerFlash!important;animation-timing-function:linear,linear!important;animation-iteration-count:infinite,infinite!important;animation-duration:var(--ticker-speed),1.1s!important}
      .hassoun-tv-powered{height:100%;flex:0 0 auto;min-width:15%;padding:0 1.4vw;display:flex;align-items:center;justify-content:center;gap:.55vw;background:#052f29;border-left:1px solid rgba(165,138,76,.45);font-size:clamp(10px,.72vw,15px);color:#c8d5cf;white-space:nowrap}
      .hassoun-tv-powered img{height:68%;max-height:38px;width:auto;object-fit:contain;border-radius:5px}
      .pixel-replica-one>div>div[style*="bottom:0"][style*="height:6%"]{visibility:hidden!important}
      .template .tv-footer,.reference-replica-one .replica-one-footer{visibility:hidden!important}
      @media(prefers-reduced-motion:reduce){.hassoun-tv-ticker-text{animation:none!important;transform:none!important;position:relative!important;justify-content:center}}
    `}</style>
    <div className="hassoun-tv-ticker-footer" aria-label="Masjid announcement ticker">
      <div className="hassoun-tv-ticker-track">{ticker.text ? <span className={`hassoun-tv-ticker-text${effectClass}`} style={{color:ticker.color,animation:`hassounMasjidTickerMove ${ticker.speed}s linear infinite`,["--ticker-speed" as string]:`${ticker.speed}s`}}>{ticker.text}</span> : null}</div>
      <div className="hassoun-tv-powered"><span>Powered by</span><img src="/hassoun-logo.png" alt="Hassoun" /></div>
    </div>
  </>;
}
