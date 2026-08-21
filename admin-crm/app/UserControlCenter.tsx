"use client";

import { useEffect, useMemo, useState } from "react";

const API = "https://wopt-prayer-push.wopt-windsor.workers.dev";
const TOKEN_KEY = "wopt:admin-token:v1";

type Subscriber = { public_id: string; email: string; display_name?: string | null; locale: string; status: string; latitude?: number; longitude?: number; timezone: string; country_code?: string | null; country_name?: string | null; region?: string | null; city?: string | null; calculation_method?: number | null; madhab?: string; linked_devices?: number };
type Device = { id: number; installation_id: string; provider: string; platform: string; locale: string; enabled: number; app_version?: string | null; notify_twenty: number; notify_ten: number; notify_athan: number; notify_announcements: number; notify_community_events: number; notify_marketing: number; latitude?: number | null; longitude?: number | null; timezone?: string | null; country_code?: string | null; city?: string | null; location_updated_at?: string | null; subscriber_public_id?: string | null; subscriber_email?: string | null; subscriber_name?: string | null; updated_at?: string };
type PrayerPref = { prayer: string; email_twenty: number; email_ten: number; email_athan: number };
type Activity = { id: number; activity_key: string; activity_label: string; detail?: string | null; platform?: string | null; occurred_at: string };
type User360 = { subscriber: Record<string, any>; emailPreferences: Record<string, any>; prayerPreferences: PrayerPref[]; devices: Device[]; activity: Activity[]; recentEmailDeliveries: Array<Record<string, any>> };

async function api<T>(path: string, init: RequestInit = {}) {
  const token = window.localStorage.getItem(TOKEN_KEY);
  const headers = new Headers(init.headers);
  if (init.body) headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(`${API}${path}`, { ...init, headers });
  const payload = await response.json().catch(() => ({})) as T & { error?: string };
  if (!response.ok) throw new Error(payload.error || `Request failed (${response.status})`);
  return payload;
}

export default function UserControlCenter() {
  const [users, setUsers] = useState<Subscriber[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [detail, setDetail] = useState<User360 | null>(null);
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<"users" | "devices">("users");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadLists = async () => {
    setBusy(true); setError("");
    try {
      const [u, d] = await Promise.all([api<{ subscribers: Subscriber[] }>("/admin/subscribers?limit=200"), api<{ devices: Device[] }>("/admin/devices")]);
      setUsers(u.subscribers || []); setDevices(d.devices || []);
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to load users"); }
    finally { setBusy(false); }
  };

  useEffect(() => { void loadLists(); }, []);

  const openUser = async (id: string) => {
    setSelected(id); setBusy(true); setError("");
    try { setDetail(await api<User360>(`/admin/subscribers/${id}/360`)); }
    catch (e) { setError(e instanceof Error ? e.message : "Unable to open user"); }
    finally { setBusy(false); }
  };

  const run = async (fn: () => Promise<void>, msg: string) => {
    setBusy(true); setError(""); setNotice("");
    try { await fn(); setNotice(msg); await loadLists(); if (selected) await openUser(selected); }
    catch (e) { setError(e instanceof Error ? e.message : "Request failed"); }
    finally { setBusy(false); }
  };

  const filteredUsers = useMemo(() => users.filter((u) => `${u.email} ${u.display_name || ""} ${u.city || ""} ${u.region || ""} ${u.country_name || ""} ${u.timezone}`.toLowerCase().includes(query.toLowerCase())), [users, query]);
  const filteredDevices = useMemo(() => devices.filter((d) => `${d.installation_id} ${d.platform} ${d.city || ""} ${d.country_code || ""} ${d.subscriber_email || ""}`.toLowerCase().includes(query.toLowerCase())), [devices, query]);

  return <main style={s.page}>
    <header style={s.header}><div><p style={s.eyebrow}>HASSOUN OWNER SYSTEM</p><h1 style={s.title}>Users & devices</h1><p style={s.muted}>Full control over subscribers, GPS locations, prayer settings, devices, activity and delivery history.</p></div><div style={s.headerActions}><a href="/" style={s.secondary}>← Dashboard</a><button onClick={() => void loadLists()} style={s.secondary}>Refresh</button></div></header>
    {error ? <div style={s.error}>{error}</div> : null}{notice ? <div style={s.success}>{notice}</div> : null}
    <div style={s.toolbar}><div style={s.tabs}><button style={mode === "users" ? s.activeTab : s.tab} onClick={() => setMode("users")}>Users ({users.length})</button><button style={mode === "devices" ? s.activeTab : s.tab} onClick={() => setMode("devices")}>Devices ({devices.length})</button></div><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name, email, city, country or device…" style={s.search} /></div>

    {mode === "users" ? <div style={s.split}><aside style={s.userList}>{filteredUsers.map((u) => <button key={u.public_id} onClick={() => void openUser(u.public_id)} style={{ ...s.userCard, ...(selected === u.public_id ? s.userCardActive : {}) }}><div style={s.userCopy}><strong>{u.display_name || u.email}</strong><span>{u.email}</span><span>📍 {[u.city,u.region,u.country_name].filter(Boolean).join(", ") || "Unknown location"}</span></div><div style={s.userMeta}><span style={s.status}>{u.status}</span><small>{u.linked_devices || 0} device(s)</small></div></button>)}</aside><section style={s.detail}>{detail ? <UserEditor detail={detail} setDetail={setDetail} run={run} selected={selected} /> : <div style={s.empty}><strong>Select a user</strong><span>Open a complete User 360 record to manage location, subscriptions, devices and history.</span></div>}</section></div> : <section style={s.deviceGrid}>{filteredDevices.map((d) => <DeviceCard key={d.id} device={d} run={run} openUser={d.subscriber_public_id ? () => { setMode("users"); void openUser(d.subscriber_public_id!); } : undefined} />)}</section>}
    {busy ? <div style={s.busy}>Working…</div> : null}
  </main>;
}

function UserEditor({ detail, setDetail, run, selected }: { detail: User360; setDetail: React.Dispatch<React.SetStateAction<User360 | null>>; run: (fn: () => Promise<void>, msg: string) => Promise<void>; selected: string }) {
  const x = detail.subscriber;
  const setUser = (key: string, value: unknown) => setDetail((d) => d ? { ...d, subscriber: { ...d.subscriber, [key]: value } } : d);
  const setEmail = (key: string, value: number) => setDetail((d) => d ? { ...d, emailPreferences: { ...d.emailPreferences, [key]: value } } : d);
  const setPrayer = (name: string, key: "email_twenty" | "email_ten" | "email_athan", value: number) => setDetail((d) => d ? { ...d, prayerPreferences: d.prayerPreferences.map((p) => p.prayer === name ? { ...p, [key]: value } : p) } : d);
  const saveProfile = () => run(async () => { await api(`/admin/subscribers/${selected}/profile`, { method: "POST", body: JSON.stringify({ displayName: x.display_name || "", locale: x.locale, status: x.status, latitude: x.latitude, longitude: x.longitude, timezone: x.timezone, countryCode: x.country_code || "", countryName: x.country_name || "", region: x.region || "", city: x.city || "", calculationMethod: x.calculation_method, madhab: x.madhab }) }); }, "User profile and location saved");
  const savePreferences = () => run(async () => {
    const prayers: Record<string, unknown> = {};
    for (const p of detail.prayerPreferences) prayers[p.prayer] = { twenty: !!p.email_twenty, ten: !!p.email_ten, athan: !!p.email_athan };
    const e = detail.emailPreferences;
    await api(`/admin/subscribers/${selected}/preferences`, { method: "POST", body: JSON.stringify({ email: { prayerAlerts: !!e.prayer_alerts, dailyPrayerSchedule: !!e.daily_prayer_schedule, religiousOccasions: !!e.religious_occasions, dailyContent: !!e.daily_content, announcements: !!e.announcements, communityEvents: !!e.community_events, marketing: !!e.marketing }, prayers }) });
  }, "Email and prayer preferences saved");

  return <div style={s.detailInner}>
    <div style={s.detailHead}><div><p style={s.eyebrow}>USER 360</p><h2 style={s.h2}>{x.display_name || x.email}</h2><p style={s.muted}>{x.email} · {x.public_id}</p></div><span style={s.status}>{x.status}</span></div>
    <Panel title="Identity & prayer location" note="GPS coordinates and timezone are authoritative. Windsor uses the official local source; other locations use GPS calculations."><div style={s.formGrid}><Field label="Display name" value={x.display_name || ""} onChange={(v) => setUser("display_name", v)} /><Select label="Status" value={x.status} options={["active","pending","unsubscribed","bounced","disabled"]} onChange={(v) => setUser("status", v)} /><Field label="City" value={x.city || ""} onChange={(v) => setUser("city", v)} /><Field label="Region" value={x.region || ""} onChange={(v) => setUser("region", v)} /><Field label="Country" value={x.country_name || ""} onChange={(v) => setUser("country_name", v)} /><Field label="Country code" value={x.country_code || ""} onChange={(v) => setUser("country_code", v)} /><Field label="Latitude" value={String(x.latitude ?? "")} onChange={(v) => setUser("latitude", Number(v))} /><Field label="Longitude" value={String(x.longitude ?? "")} onChange={(v) => setUser("longitude", Number(v))} /><Field label="Timezone" value={x.timezone || ""} onChange={(v) => setUser("timezone", v)} /><Field label="Calculation method" value={String(x.calculation_method ?? "")} onChange={(v) => setUser("calculation_method", v ? Number(v) : null)} /><Select label="Madhab" value={x.madhab || "standard"} options={["standard","hanafi"]} onChange={(v) => setUser("madhab", v)} /><Select label="Language" value={x.locale || "en"} options={["en","ar"]} onChange={(v) => setUser("locale", v)} /></div><button style={s.primary} onClick={() => void saveProfile()}>Save user & location</button></Panel>

    <Panel title="Email subscription controls" note="Control every category and each prayer email timing."><div style={s.toggleGrid}>{[["prayer_alerts","Prayer alerts"],["daily_prayer_schedule","Daily prayer schedule"],["religious_occasions","Islamic occasions"],["daily_content","Daily content"],["announcements","Announcements"],["community_events","Community events"],["marketing","Marketing"]].map(([key,label]) => <Toggle key={key} label={label} value={!!detail.emailPreferences[key]} onChange={(v) => setEmail(key, v ? 1 : 0)} />)}</div><div style={s.prayerGrid}>{["fajr","dhuhr","asr","maghrib","isha"].map((name) => { const p = detail.prayerPreferences.find((q) => q.prayer === name) || { prayer: name, email_twenty: 0, email_ten: 0, email_athan: 1 }; return <div key={name} style={s.prayerCard}><strong style={s.capitalize}>{name}</strong><Toggle label="20 min" value={!!p.email_twenty} onChange={(v) => setPrayer(name, "email_twenty", v ? 1 : 0)} /><Toggle label="10 min" value={!!p.email_ten} onChange={(v) => setPrayer(name, "email_ten", v ? 1 : 0)} /><Toggle label="Adhan" value={!!p.email_athan} onChange={(v) => setPrayer(name, "email_athan", v ? 1 : 0)} /></div>; })}</div><button style={s.primary} onClick={() => void savePreferences()}>Save email preferences</button></Panel>

    <Panel title={`Linked devices (${detail.devices.length})`} note="Enable or disable each Android, iOS or web installation and its individual push settings."><div style={s.deviceGrid}>{detail.devices.map((d) => <DeviceCard key={d.id} device={d} run={run} />)}</div></Panel>
    <Panel title="Recent activity" note="Real tracked app activity. Nothing here is fabricated.">{detail.activity.length ? <div style={s.timeline}>{detail.activity.slice(0,30).map((a) => <div key={a.id} style={s.timelineItem}><div><strong>{a.activity_label}</strong><span>{a.detail || a.activity_key} · {a.platform || "app"}</span></div><time>{new Date(a.occurred_at).toLocaleString()}</time></div>)}</div> : <p style={s.muted}>No activity recorded yet.</p>}</Panel>
    <Panel title="Recent email delivery" note="Prayer and system email outcomes for this subscriber.">{detail.recentEmailDeliveries.length ? <div style={s.timeline}>{detail.recentEmailDeliveries.slice(0,20).map((e) => <div key={String(e.id)} style={s.timelineItem}><div><strong>{String(e.subject_snapshot || e.notification_kind || "Email")}</strong><span>{String(e.prayer || "")} {e.error_message ? `· ${e.error_message}` : ""}</span></div><span style={s.status}>{String(e.status || "")}</span></div>)}</div> : <p style={s.muted}>No email delivery history yet.</p>}</Panel>
  </div>;
}

function DeviceCard({ device, run, openUser }: { device: Device; run: (fn: () => Promise<void>, msg: string) => Promise<void>; openUser?: () => void }) {
  const patch = (body: Record<string, unknown>, msg: string) => run(async () => { await api(`/admin/devices/${device.id}`, { method: "POST", body: JSON.stringify(body) }); }, msg);
  return <div style={s.deviceCard}><div style={s.deviceTop}><div><strong>{device.platform.toUpperCase()} · {device.provider}</strong><p style={s.mono}>{device.installation_id}</p></div><button style={device.enabled ? s.on : s.off} onClick={() => void patch({ enabled: !device.enabled }, device.enabled ? "Device disabled" : "Device enabled")}>{device.enabled ? "ON" : "OFF"}</button></div><div style={s.deviceInfo}><span>📍 {device.city || "Unknown"} {device.timezone ? `· ${device.timezone}` : ""}</span><span>Version: {device.app_version || "—"}</span>{device.subscriber_email ? <button style={s.linkButton} onClick={openUser}>{device.subscriber_name || device.subscriber_email}</button> : <span>Anonymous device</span>}</div><div style={s.toggleGrid}><Toggle label="20 min" value={!!device.notify_twenty} onChange={(v) => void patch({ notifyTwenty: v }, "Device prayer alert updated")} /><Toggle label="10 min" value={!!device.notify_ten} onChange={(v) => void patch({ notifyTen: v }, "Device prayer alert updated")} /><Toggle label="Adhan" value={!!device.notify_athan} onChange={(v) => void patch({ notifyAthan: v }, "Device Adhan updated")} /><Toggle label="Announcements" value={!!device.notify_announcements} onChange={(v) => void patch({ notifyAnnouncements: v }, "Device announcements updated")} /><Toggle label="Community" value={!!device.notify_community_events} onChange={(v) => void patch({ notifyCommunityEvents: v }, "Device community alerts updated")} /><Toggle label="Marketing" value={!!device.notify_marketing} onChange={(v) => void patch({ notifyMarketing: v }, "Device marketing updated")} /></div></div>;
}

function Panel({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) { return <section style={s.panel}><h3 style={s.h3}>{title}</h3>{note ? <p style={s.muted}>{note}</p> : null}{children}</section>; }
function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) { return <label style={s.field}><span>{label}</span><input value={value} onChange={(e) => onChange(e.target.value)} style={s.input} /></label>; }
function Select({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (v: string) => void }) { return <label style={s.field}><span>{label}</span><select value={value} onChange={(e) => onChange(e.target.value)} style={s.input}>{options.map((o) => <option key={o}>{o}</option>)}</select></label>; }
function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) { return <label style={s.toggle}><span>{label}</span><input type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} /></label>; }

const s: Record<string, React.CSSProperties> = {
  page: { minHeight: "100vh", background: "#f5f7f6", color: "#173f35", padding: "28px clamp(16px,4vw,48px) 60px", fontFamily: "system-ui,-apple-system,sans-serif" }, header: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 18, marginBottom: 20 }, headerActions: { display: "flex", gap: 8 }, eyebrow: { margin: 0, color: "#0b6b53", fontSize: 11, fontWeight: 900, letterSpacing: 1.7 }, title: { margin: "5px 0", fontSize: 36, lineHeight: 1.05 }, h2: { margin: "4px 0", fontSize: 25 }, h3: { margin: "0 0 3px", fontSize: 18 }, muted: { color: "#71817b", margin: "4px 0", fontSize: 13, lineHeight: 1.5 }, secondary: { border: "1px solid #cbd8d3", borderRadius: 12, padding: "10px 14px", background: "#fff", color: "#174b3e", fontWeight: 800, textDecoration: "none", cursor: "pointer" }, toolbar: { display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", marginBottom: 14 }, tabs: { display: "flex", gap: 7 }, tab: { border: "1px solid #d2deda", background: "#fff", color: "#536861", borderRadius: 12, padding: "10px 15px", fontWeight: 800, cursor: "pointer" }, activeTab: { border: "1px solid #0b654f", background: "#0b654f", color: "#fff", borderRadius: 12, padding: "10px 15px", fontWeight: 900, cursor: "pointer" }, search: { width: "min(430px,48vw)", minHeight: 42, border: "1px solid #cdd9d5", borderRadius: 12, padding: "0 13px", fontSize: 14 }, split: { display: "grid", gridTemplateColumns: "minmax(280px,.7fr) minmax(0,1.6fr)", gap: 14, alignItems: "start" }, userList: { display: "flex", flexDirection: "column", gap: 7, maxHeight: "75vh", overflowY: "auto", paddingRight: 3 }, userCard: { width: "100%", display: "flex", justifyContent: "space-between", gap: 8, textAlign: "left", padding: 13, border: "1px solid #dce5e1", borderRadius: 15, background: "#fff", cursor: "pointer" }, userCardActive: { borderColor: "#0b654f", boxShadow: "0 0 0 2px #d7eee5" }, userCopy: { display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }, userMeta: { display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 5, whiteSpace: "nowrap" }, status: { display: "inline-flex", alignItems: "center", borderRadius: 999, background: "#e6f3ed", color: "#0b654f", padding: "4px 8px", fontSize: 11, fontWeight: 900 }, detail: { minWidth: 0 }, detailInner: { display: "flex", flexDirection: "column", gap: 12 }, detailHead: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", background: "#fff", border: "1px solid #dce5e1", borderRadius: 18, padding: 18 }, panel: { background: "#fff", border: "1px solid #dce5e1", borderRadius: 18, padding: 17 }, formGrid: { display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 10, marginTop: 13 }, field: { display: "flex", flexDirection: "column", gap: 5, color: "#405a52", fontSize: 12, fontWeight: 800 }, input: { minHeight: 39, border: "1px solid #cbd8d3", borderRadius: 10, padding: "0 10px", background: "#fff", fontSize: 13 }, primary: { marginTop: 14, minHeight: 43, border: 0, borderRadius: 11, background: "#0b654f", color: "#fff", padding: "0 15px", fontWeight: 900, cursor: "pointer" }, toggleGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: 7, marginTop: 12 }, toggle: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, minHeight: 39, border: "1px solid #e1e8e5", background: "#f9fbfa", borderRadius: 10, padding: "0 10px", fontSize: 12, fontWeight: 700 }, prayerGrid: { display: "grid", gridTemplateColumns: "repeat(5,minmax(130px,1fr))", gap: 8, marginTop: 12, overflowX: "auto" }, prayerCard: { border: "1px solid #e0e7e4", borderRadius: 13, padding: 10, background: "#fbfcfb", display: "flex", flexDirection: "column", gap: 5 }, capitalize: { textTransform: "capitalize" }, deviceGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(290px,1fr))", gap: 10 }, deviceCard: { border: "1px solid #dde6e2", borderRadius: 15, padding: 13, background: "#fff" }, deviceTop: { display: "flex", justifyContent: "space-between", gap: 8, alignItems: "flex-start" }, deviceInfo: { display: "flex", flexDirection: "column", gap: 4, marginTop: 9, color: "#6d7d77", fontSize: 12 }, mono: { fontFamily: "monospace", fontSize: 10, color: "#7d8a85", wordBreak: "break-all", margin: "4px 0" }, on: { border: 0, borderRadius: 999, background: "#0b654f", color: "white", padding: "6px 10px", fontWeight: 900, cursor: "pointer" }, off: { border: "1px solid #d3dcda", borderRadius: 999, background: "#eef2f0", color: "#687670", padding: "6px 10px", fontWeight: 900, cursor: "pointer" }, linkButton: { border: 0, padding: 0, background: "transparent", color: "#0b654f", textAlign: "left", fontWeight: 800, cursor: "pointer" }, timeline: { display: "flex", flexDirection: "column", gap: 6, marginTop: 11 }, timelineItem: { display: "flex", justifyContent: "space-between", gap: 10, borderBottom: "1px solid #edf1ef", padding: "9px 0", fontSize: 12 }, empty: { minHeight: 300, background: "#fff", border: "1px dashed #cddbd6", borderRadius: 18, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 7, color: "#75847e", textAlign: "center", padding: 24 }, error: { background: "#fdecea", color: "#9d3027", padding: 12, borderRadius: 11, marginBottom: 12 }, success: { background: "#e6f5ed", color: "#0b654f", padding: 12, borderRadius: 11, marginBottom: 12 }, busy: { position: "fixed", right: 20, bottom: 20, background: "#173f35", color: "#fff", borderRadius: 999, padding: "9px 14px", fontWeight: 800 }
};
