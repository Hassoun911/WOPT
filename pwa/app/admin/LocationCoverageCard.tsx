"use client";

import { useEffect, useState } from "react";

const API = "https://wopt-prayer-push.wopt-windsor.workers.dev";
const TOKEN_KEY = "wopt:admin-token:v1";

type Stats = {
  total?: number;
  live?: number;
  today?: number;
  active30d?: number;
  historical?: number;
  mobile?: number;
  web?: number;
  alexa?: number;
  observations?: number;
};

type LocationRow = {
  location_key: string;
  place_label?: string | null;
  city?: string | null;
  region?: string | null;
  country_name?: string | null;
  timezone?: string | null;
  last_seen?: string | null;
  hit_count?: number;
  mobile_hits?: number;
  web_hits?: number;
  alexa_hits?: number;
};

type Payload = { stats?: Stats; locations?: LocationRow[] };

function label(row: LocationRow) {
  if (row.place_label && row.place_label !== "Your location") return row.place_label;
  const named = [row.city, row.region, row.country_name].filter(Boolean).join(", ");
  return named || row.location_key.replace(/^geo:/, "").split("|")[0];
}

function ago(value?: string | null) {
  if (!value) return "—";
  const diff = Date.now() - new Date(`${value.replace(" ", "T")}Z`).getTime();
  if (!Number.isFinite(diff) || diff < 0) return "now";
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function LocationCoverageCard() {
  const [data, setData] = useState<Payload>({});
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    const load = async () => {
      const token = localStorage.getItem(TOKEN_KEY);
      if (!token) return;
      try {
        const response = await fetch(`${API}/admin/location-usage`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
        const payload = await response.json().catch(() => ({})) as Payload & { error?: string };
        if (!response.ok) throw new Error(payload.error || `Request failed (${response.status})`);
        if (alive) { setData(payload); setError(""); }
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : "Unable to load location coverage");
      }
    };
    void load();
    const timer = window.setInterval(() => void load(), 30000);
    return () => { alive = false; window.clearInterval(timer); };
  }, []);

  const stats = data.stats || {};
  const cards = [
    ["Different locations", stats.total || 0, "🌍"],
    ["Live now · 15 min", stats.live || 0, "🟢"],
    ["Active today", stats.today || 0, "☀️"],
    ["Active 30 days", stats.active30d || 0, "📅"],
    ["Historical only", stats.historical || 0, "🕘"],
  ] as const;

  return (
    <section style={s.wrap}>
      <div style={s.head}>
        <div>
          <div style={s.eyebrow}>GLOBAL LOCATION COVERAGE</div>
          <h2 style={s.title}>Where Hassoun is being used</h2>
          <p style={s.help}>Anonymous coarse location counts only. No email, device ID, IP address or exact GPS coordinate is stored in this coverage table.</p>
        </div>
        <div style={s.platforms}>Mobile {stats.mobile || 0} · Web {stats.web || 0} · Alexa {stats.alexa || 0}</div>
      </div>

      {error ? <div style={s.error}>{error}</div> : null}

      <div style={s.stats}>
        {cards.map(([name, value, icon]) => <div key={name} style={s.stat}><span style={s.icon}>{icon}</span><strong style={s.value}>{value}</strong><span style={s.name}>{name}</span></div>)}
      </div>

      <div style={s.listHead}><strong>Recently seen locations</strong><span>{Number(stats.observations || 0).toLocaleString()} total observations</span></div>
      <div style={s.list}>
        {(data.locations || []).slice(0, 12).map((row) => (
          <div key={row.location_key} style={s.row}>
            <div><strong>{label(row)}</strong><div style={s.subtle}>{row.timezone || "UTC"}</div></div>
            <div style={s.right}><strong>{ago(row.last_seen)}</strong><div style={s.subtle}>{row.hit_count || 0} hits</div></div>
          </div>
        ))}
        {!data.locations?.length && !error ? <div style={s.empty}>No recorded locations yet. Counts will begin as users open Hassoun with location enabled.</div> : null}
      </div>
    </section>
  );
}

const s: Record<string, React.CSSProperties> = {
  wrap:{maxWidth:1200,margin:"18px auto",padding:22,border:"1px solid #dce5e1",borderRadius:20,background:"#fff",boxShadow:"0 8px 28px rgba(20,63,53,.05)",color:"#173f35"},
  head:{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:18,flexWrap:"wrap"},
  eyebrow:{fontSize:11,fontWeight:900,letterSpacing:1.5,color:"#08765d"},title:{margin:"5px 0 3px",fontSize:25},help:{margin:0,color:"#6d7d77",fontSize:13,maxWidth:760,lineHeight:1.5},
  platforms:{background:"#edf8f3",border:"1px solid #c8e3d7",padding:"8px 11px",borderRadius:999,fontSize:12,fontWeight:800},
  stats:{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(145px,1fr))",gap:10,marginTop:18},stat:{padding:14,border:"1px solid #e2e8e5",borderRadius:15,background:"#f9fbfa",display:"grid",gap:3},icon:{fontSize:18},value:{fontSize:27},name:{fontSize:12,color:"#667a73",fontWeight:750},
  listHead:{display:"flex",justifyContent:"space-between",gap:12,flexWrap:"wrap",marginTop:20,paddingBottom:9,borderBottom:"1px solid #e7ece9",fontSize:13},list:{display:"grid"},row:{display:"flex",justifyContent:"space-between",gap:12,padding:"10px 2px",borderBottom:"1px solid #edf1ef"},right:{textAlign:"right"},subtle:{fontSize:11,color:"#7b8a84",marginTop:2},empty:{padding:"16px 0",color:"#7b8a84"},error:{marginTop:12,padding:10,borderRadius:10,background:"#fff2f0",color:"#9b2c2c"}
};
