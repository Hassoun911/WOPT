"use client";

import { useEffect, useMemo, useState } from "react";
import UserControlCenter from "./UserControlCenter";

const API = "https://wopt-prayer-push.wopt-windsor.workers.dev";
const TOKEN_KEY = "wopt:admin-token:v1";

type Subscriber = {
  public_id: string;
  email: string;
  display_name?: string | null;
  status: string;
  city?: string | null;
  region?: string | null;
  country_name?: string | null;
};

async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = window.localStorage.getItem(TOKEN_KEY);
  const headers = new Headers(init.headers);
  if (init.body) headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(`${API}${path}`, { ...init, headers });
  const payload = await response.json().catch(() => ({})) as T & { error?: string };
  if (!response.ok) throw new Error(payload.error || `Request failed (${response.status})`);
  return payload;
}

export default function AdminUsersManager() {
  const [users, setUsers] = useState<Subscriber[]>([]);
  const [query, setQuery] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [city, setCity] = useState("Windsor");
  const [region, setRegion] = useState("Ontario");
  const [country, setCountry] = useState("Canada");
  const [countryCode, setCountryCode] = useState("CA");
  const [timezone, setTimezone] = useState("America/Toronto");
  const [latitude, setLatitude] = useState("42.3149");
  const [longitude, setLongitude] = useState("-83.0364");

  async function load() {
    try {
      const data = await api<{ subscribers: Subscriber[] }>("/admin/subscribers?limit=300");
      setUsers(data.subscribers || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load users");
    }
  }

  useEffect(() => { void load(); }, []);

  async function addUser() {
    const lat = Number(latitude);
    const lng = Number(longitude);
    if (!email.trim()) { setError("Email is required"); return; }
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) { setError("Valid latitude and longitude are required"); return; }
    setBusy(true); setError(""); setNotice("");
    try {
      await api("/admin/subscribers/create/status", {
        method: "POST",
        body: JSON.stringify({
          email: email.trim(),
          displayName: name.trim(),
          locale: "en",
          latitude: lat,
          longitude: lng,
          timezone: timezone.trim(),
          countryCode: countryCode.trim().toUpperCase(),
          countryName: country.trim(),
          region: region.trim(),
          city: city.trim(),
          calculationMethod: 3,
          madhab: "standard"
        })
      });
      setNotice("User added and activated");
      setEmail(""); setName(""); setShowAdd(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to add user");
    } finally { setBusy(false); }
  }

  async function changeStatus(user: Subscriber, status: "active" | "unsubscribed") {
    setBusy(true); setError(""); setNotice("");
    try {
      await api(`/admin/subscribers/${user.public_id}/status`, { method: "POST", body: JSON.stringify({ status }) });
      setNotice(status === "active" ? `${user.email} reactivated` : `${user.email} unsubscribed`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to update user");
    } finally { setBusy(false); }
  }

  const filtered = useMemo(() => users.filter(u => `${u.email} ${u.display_name || ""} ${u.city || ""} ${u.region || ""} ${u.country_name || ""}`.toLowerCase().includes(query.toLowerCase())), [users, query]);

  return <>
    <section style={{maxWidth:1320,margin:"22px auto 0",padding:"0 22px",fontFamily:"system-ui,sans-serif",color:"#173f35"}}>
      <div style={{display:"flex",gap:10,alignItems:"center",justifyContent:"space-between",flexWrap:"wrap"}}>
        <div><div style={{fontSize:12,fontWeight:800,letterSpacing:1.5,color:"#08765d"}}>ADMIN USER MANAGEMENT</div><h2 style={{margin:"6px 0"}}>Add, unsubscribe or reactivate users</h2></div>
        <button onClick={() => setShowAdd(v => !v)} style={primary}>{showAdd ? "Cancel" : "＋ Add user"}</button>
      </div>
      {error ? <div style={errorBox}>⚠️ {error}</div> : null}
      {notice ? <div style={successBox}>✅ {notice}</div> : null}
      {showAdd ? <div style={panel}>
        <div style={grid}>
          <input style={input} placeholder="Email *" value={email} onChange={e=>setEmail(e.target.value)} />
          <input style={input} placeholder="Display name" value={name} onChange={e=>setName(e.target.value)} />
          <input style={input} placeholder="City" value={city} onChange={e=>setCity(e.target.value)} />
          <input style={input} placeholder="Region" value={region} onChange={e=>setRegion(e.target.value)} />
          <input style={input} placeholder="Country" value={country} onChange={e=>setCountry(e.target.value)} />
          <input style={input} placeholder="Country code" value={countryCode} onChange={e=>setCountryCode(e.target.value)} />
          <input style={input} placeholder="Timezone" value={timezone} onChange={e=>setTimezone(e.target.value)} />
          <input style={input} placeholder="Latitude *" value={latitude} onChange={e=>setLatitude(e.target.value)} />
          <input style={input} placeholder="Longitude *" value={longitude} onChange={e=>setLongitude(e.target.value)} />
        </div>
        <button disabled={busy} onClick={() => void addUser()} style={{...primary,marginTop:12}}>{busy ? "Working…" : "Add & activate user"}</button>
      </div> : null}
      <div style={{...panel,marginTop:14}}>
        <div style={{display:"flex",gap:10,justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",marginBottom:12}}><strong>Subscribers ({users.length})</strong><input style={{...input,maxWidth:360}} placeholder="Search user…" value={query} onChange={e=>setQuery(e.target.value)} /></div>
        <div style={{display:"grid",gap:8}}>{filtered.map(user => <div key={user.public_id} style={{display:"grid",gridTemplateColumns:"minmax(220px,1fr) auto auto",gap:10,alignItems:"center",padding:"10px 0",borderBottom:"1px solid #edf0ed"}}><div><strong>{user.display_name || user.email}</strong><div style={{fontSize:13,opacity:.7}}>{user.email} · {[user.city,user.region,user.country_name].filter(Boolean).join(", ") || "Unknown location"}</div></div><span style={badge}>{user.status}</span><button disabled={busy} onClick={() => void changeStatus(user, user.status === "unsubscribed" ? "active" : "unsubscribed")} style={user.status === "unsubscribed" ? primary : secondary}>{user.status === "unsubscribed" ? "Reactivate" : "Unsubscribe"}</button></div>)}</div>
      </div>
    </section>
    <UserControlCenter />
  </>;
}

const panel: React.CSSProperties = {background:"white",border:"1px solid #d7dfd9",borderRadius:16,padding:16,boxShadow:"0 8px 24px rgba(20,57,47,.06)"};
const grid: React.CSSProperties = {display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(210px,1fr))",gap:10};
const input: React.CSSProperties = {width:"100%",boxSizing:"border-box",padding:"11px 12px",border:"1px solid #cfd9d3",borderRadius:10,font:"inherit",background:"#fff"};
const primary: React.CSSProperties = {border:0,borderRadius:10,padding:"10px 14px",fontWeight:800,cursor:"pointer",background:"#0d775f",color:"white"};
const secondary: React.CSSProperties = {border:"1px solid #c9d5cf",borderRadius:10,padding:"9px 13px",fontWeight:800,cursor:"pointer",background:"white",color:"#173f35"};
const badge: React.CSSProperties = {fontSize:12,fontWeight:800,padding:"5px 9px",borderRadius:999,background:"#eef4f1"};
const errorBox: React.CSSProperties = {marginTop:10,padding:10,borderRadius:10,background:"#fdecec",color:"#9c2626"};
const successBox: React.CSSProperties = {marginTop:10,padding:10,borderRadius:10,background:"#e9f7ef",color:"#17633d"};
