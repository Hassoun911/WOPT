"use client";

import { useEffect, useState } from "react";

const API = "https://wopt-prayer-push.wopt-windsor.workers.dev";

type TickerSetting = { enabled?: boolean; message?: string; speed?: "slow" | "normal" | "fast" };

export default function ScrollingTicker() {
  const [ticker, setTicker] = useState<TickerSetting | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const response = await fetch(`${API}/app/runtime`, { cache: "no-store" });
        if (!response.ok) return;
        const payload = await response.json() as { settings?: { scrolling_ticker?: TickerSetting } };
        if (!cancelled) setTicker(payload.settings?.scrolling_ticker ?? null);
      } catch {}
    };
    void load();
    const timer = window.setInterval(load, 60_000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, []);

  if (!ticker?.enabled || !ticker.message?.trim()) return null;
  const duration = ticker.speed === "slow" ? 30 : ticker.speed === "fast" ? 14 : 21;

  return <div style={{ position: "sticky", top: 0, zIndex: 9999, width: "100%", overflow: "hidden", background: "linear-gradient(90deg,#0b5b47,#0f725b)", color: "white", borderBottom: "1px solid rgba(255,255,255,.22)", boxShadow: "0 4px 14px rgba(11,91,71,.16)" }}>
    <div style={{ display: "flex", alignItems: "center", minHeight: 42, whiteSpace: "nowrap", overflow: "hidden" }}>
      <div style={{ display: "inline-block", minWidth: "100%", paddingLeft: "100%", animation: `hassounTicker ${duration}s linear infinite`, fontWeight: 800, letterSpacing: ".01em", fontSize: 15, lineHeight: "42px" }}>
        {ticker.message}
      </div>
    </div>
    <style>{`@keyframes hassounTicker{0%{transform:translateX(0)}100%{transform:translateX(-200%)}}@media (prefers-reduced-motion: reduce){div[style*="hassounTicker"]{animation:none!important;padding-left:16px!important}}`}</style>
  </div>;
}
