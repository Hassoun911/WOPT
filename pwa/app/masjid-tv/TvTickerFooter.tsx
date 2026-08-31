"use client";

import { useEffect, useState } from "react";

const SETTINGS_KEY = "hassoun:web-masjid-tv:v2";

function readTicker() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY) || "{}";
    const settings = JSON.parse(raw) as Record<string, unknown>;
    return typeof settings.tickerText === "string" ? settings.tickerText.trim() : "";
  } catch {
    return "";
  }
}

function isTvDisplayPath(){
  const p=window.location.pathname.replace(/\/+$/,"").toLowerCase();
  return p==="/masjid-tv";
}

export default function TvTickerFooter() {
  const [ticker, setTicker] = useState("");
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
  return <>
    <style>{`
      @keyframes hassounMasjidTickerMove{from{transform:translateX(100%)}to{transform:translateX(-100%)}}
      .hassoun-tv-ticker-footer{position:absolute;left:0;right:0;bottom:0;height:6%;z-index:2147483000;background:#073b32;border-top:1px solid rgba(165,138,76,.45);display:flex;align-items:center;color:#f7f4eb;font-family:Arial,Helvetica,sans-serif;overflow:hidden}
      .hassoun-tv-ticker-track{position:relative;flex:1;height:100%;overflow:hidden;min-width:0}
      .hassoun-tv-ticker-text{position:absolute;left:0;top:0;height:100%;display:flex;align-items:center;white-space:nowrap;font-size:clamp(14px,1.15vw,25px);font-weight:800;color:#f3d47e;letter-spacing:.02em;animation:hassounMasjidTickerMove 18s linear infinite;will-change:transform;padding-left:2vw}
      .hassoun-tv-powered{height:100%;flex:0 0 auto;min-width:15%;padding:0 1.4vw;display:flex;align-items:center;justify-content:center;gap:.55vw;background:#052f29;border-left:1px solid rgba(165,138,76,.45);font-size:clamp(10px,.72vw,15px);color:#c8d5cf;white-space:nowrap}
      .hassoun-tv-powered img{height:68%;max-height:38px;width:auto;object-fit:contain;border-radius:5px}
      .pixel-replica-one>div>div[style*="bottom:0"][style*="height:6%"]{visibility:hidden!important}
      .template .tv-footer,.reference-replica-one .replica-one-footer{visibility:hidden!important}
      @media(prefers-reduced-motion:reduce){.hassoun-tv-ticker-text{animation:none!important;transform:none!important;position:relative!important;justify-content:center}}
    `}</style>
    <div className="hassoun-tv-ticker-footer" aria-label="Masjid announcement ticker">
      <div className="hassoun-tv-ticker-track">{ticker ? <span className="hassoun-tv-ticker-text">{ticker}</span> : null}</div>
      <div className="hassoun-tv-powered"><span>Powered by</span><img src="/hassoun-logo.png" alt="Hassoun" /></div>
    </div>
  </>;
}
