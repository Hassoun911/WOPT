"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

const API = "https://wopt-prayer-push.wopt-windsor.workers.dev";
const TOKEN_KEY = "wopt:admin-token:v1";

type Admin = { public_id?: string; username: string; email: string; display_name?: string | null; role: string; must_change_password?: number };
type Dashboard = { subscribers?: Record<string, number>; devices?: Record<string, number>; emailOutbox?: Record<string, number>; pushCampaigns?: Record<string, number>; emailDeliveries?: Record<string, number> };
type CrmOverview = { content?: Record<string, number>; admins?: Record<string, number>; audit?: Record<string, number>; release?: Record<string, unknown> };
type Subscriber = { public_id: string; email: string; display_name?: string | null; status: string; city?: string | null; region?: string | null; country_name?: string | null; timezone: string; locale: string; linked_devices?: number };
type Setting = { key: string; value: unknown; description?: string; updatedAt?: string };
type Content = { public_id: string; content_type: string; title_en: string; title_ar?: string | null; body_en?: string | null; body_ar?: string | null; source_text?: string | null; status: string; featured: number; updated_at: string };
type TeamMember = { public_id: string; username: string; email: string; display_name?: string | null; role: string; status: string; last_signed_in_at?: string | null };
type Audit = { id: number; action: string; entity_type: string; entity_id?: string | null; summary?: string | null; created_at: string; username?: string | null; display_name?: string | null };
type Campaign = { public_id: string; name: string; title_en: string; status: string; target_platform: string; scheduled_at?: string | null; sent_at?: string | null; sent_count?: number; failed_count?: number };
type View = "dashboard" | "subscribers" | "content" | "control" | "push" | "team" | "audit";

async function api<T>(path: string, init: RequestInit = {}, token?: string | null): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(`${API}${path}`, { ...init, headers });
  const payload = await response.json().catch(() => ({})) as T & { error?: string };
  if (!response.ok) throw new Error(payload.error || `Request failed (${response.status})`);
  return payload;
}

function Stat({ label, value, hint }: { label: string; value: number | string; hint?: string }) {
  return <div style={s.stat}><strong style={s.statValue}>{value}</strong><span style={s.statLabel}>{label}</span>{hint ? <small style={s.muted}>{hint}</small> : null}</div>;
}

function Badge({ children, tone = "green" }: { children: React.ReactNode; tone?: "green" | "amber" | "red" | "blue" | "gray" }) {
  const bg = { green: "#e9f7ef", amber: "#fff6df", red: "#fdecec", blue: "#eaf2ff", gray: "#eef2f3" }[tone];
  const color = { green: "#17633d", amber: "#8a5b00", red: "#9c2626", blue: "#2459a9", gray: "#516064" }[tone];
  return <span style={{ ...s.badge, background: bg, color }}>{children}</span>;
}

function statusTone(status: string): "green" | "amber" | "red" | "gray" {
  if (["active", "published", "sent"].includes(status)) return "green";
  if (["pending", "scheduled", "draft"].includes(status)) return "amber";
  if (["disabled", "failed", "bounced"].includes(status)) return "red";
  return "gray";
}

export default function CrmDashboard() {
  const [token, setToken] = useState<string | null>(null);
  const [admin, setAdmin] = useState<Admin | null>(null);
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [view, setView] = useState<View>("dashboard");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [dashboard, setDashboard] = useState<Dashboard>({});
  const [crm, setCrm] = useState<CrmOverview>({});
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [settings, setSettings] = useState<Setting[]>([]);
  const [content, setContent] = useState<Content[]>([]);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [audit, setAudit] = useState<Audit[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [search, setSearch] = useState("");
  const [subscriberStatus, setSubscriberStatus] = useState("");
  const [contentType, setContentType] = useState("");
  const [contentStatus, setContentStatus] = useState("");

  const [newType, setNewType] = useState("announcement");
  const [newTitle, setNewTitle] = useState("");
  const [newTitleAr, setNewTitleAr] = useState("");
  const [newBody, setNewBody] = useState("");
  const [newBodyAr, setNewBodyAr] = useState("");
  const [newSource, setNewSource] = useState("");
  const [newFeatured, setNewFeatured] = useState(false);

  const [pushTitle, setPushTitle] = useState("");
  const [pushBody, setPushBody] = useState("");
  const [pushTitleAr, setPushTitleAr] = useState("");
  const [pushBodyAr, setPushBodyAr] = useState("");
  const [pushPlatform, setPushPlatform] = useState("all");
  const [pushScheduled, setPushScheduled] = useState("");

  const loadAll = useCallback(async (authToken: string) => {
    const [d, c, subs, st, ct, pushes] = await Promise.all([
      api<Dashboard>("/admin/dashboard", {}, authToken),
      api<CrmOverview>("/admin/crm/overview", {}, authToken),
      api<{ subscribers: Subscriber[] }>("/admin/subscribers?limit=200", {}, authToken),
      api<{ settings: Setting[] }>("/admin/settings", {}, authToken),
      api<{ content: Content[] }>("/admin/content", {}, authToken),
      api<{ campaigns: Campaign[] }>("/admin/push/campaigns", {}, authToken)
    ]);
    setDashboard(d); setCrm(c); setSubscribers(subs.subscribers || []); setSettings(st.settings || []); setContent(ct.content || []); setCampaigns(pushes.campaigns || []);
    const a = await api<{ entries: Audit[] }>("/admin/audit?limit=150", {}, authToken).catch(() => ({ entries: [] }));
    setAudit(a.entries || []);
    const t = await api<{ admins: TeamMember[] }>("/admin/team", {}, authToken).catch(() => ({ admins: [] }));
    setTeam(t.admins || []);
  }, []);

  useEffect(() => {
    const saved = window.localStorage.getItem(TOKEN_KEY);
    if (!saved) return;
    void api<{ admin: Admin }>("/admin/me", {}, saved).then(async (data) => {
      setToken(saved); setAdmin(data.admin); await loadAll(saved);
    }).catch(() => window.localStorage.removeItem(TOKEN_KEY));
  }, [loadAll]);


  useEffect(() => {
    if (!error && !notice) return;
    const timer = window.setTimeout(() => { setError(""); setNotice(""); }, 6500);
    return () => window.clearTimeout(timer);
  }, [error, notice]);

  const signIn = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const data = await api<{ token: string; admin: Admin }>("/admin/login", { method: "POST", body: JSON.stringify({ login, password }) });
      window.localStorage.setItem(TOKEN_KEY, data.token); setToken(data.token); setAdmin(data.admin); setPassword(""); await loadAll(data.token);
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to sign in"); } finally { setBusy(false); }
  };

  const signOut = () => {
    if (token) void api("/admin/logout", { method: "POST" }, token).catch(() => undefined);
    window.localStorage.removeItem(TOKEN_KEY); setToken(null); setAdmin(null);
  };

  const run = async (fn: () => Promise<void>, success = "Saved") => {
    setBusy(true); setError(""); setNotice("");
    try { await fn(); setNotice(success); if (token) await loadAll(token); }
    catch (e) { setError(e instanceof Error ? e.message : "Request failed"); }
    finally { setBusy(false); }
  };

  const filteredSubscribers = useMemo(() => subscribers.filter((x) => {
    const haystack = `${x.email} ${x.city || ""} ${x.region || ""} ${x.country_name || ""}`.toLowerCase();
    return (!search || haystack.includes(search.toLowerCase())) && (!subscriberStatus || x.status === subscriberStatus);
  }), [subscribers, search, subscriberStatus]);

  const filteredContent = useMemo(() => content.filter((x) => (!contentType || x.content_type === contentType) && (!contentStatus || x.status === contentStatus)), [content, contentType, contentStatus]);
  const subscriberSummary = dashboard.subscribers || {};
  const deviceSummary = dashboard.devices || {};

  if (!token || !admin) return <main style={s.loginPage}><form onSubmit={signIn} style={s.loginCard}>
    <div style={s.logo}>ح</div><div><p style={s.eyebrow}>HASSOUN OWNER SYSTEM</p><h1 style={s.loginTitle}>Admin CRM</h1><p style={s.muted}>Secure private control center for the Hassoun app.</p></div>
    <label style={s.label}>Username or email</label><input style={s.input} value={login} onChange={(e) => setLogin(e.target.value)} autoComplete="username" />
    <label style={s.label}>Password</label><input style={s.input} type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
    {error ? <div style={s.error}>{error}</div> : null}<button style={s.primary} disabled={busy || !login || !password}>{busy ? "Signing in…" : "Sign in"}</button>
    <a style={s.link} href="../">← Back to Hassoun</a>
  </form></main>;

  const tabs: { key: View; label: string }[] = [
    { key: "dashboard", label: "Dashboard" }, { key: "subscribers", label: "Users" }, { key: "content", label: "Content" },
    { key: "control", label: "App Control" }, { key: "push", label: "Push" }, { key: "team", label: "Admins" }, { key: "audit", label: "Audit" }
  ];

  return <main style={s.page}>
    <header style={s.header}><div style={s.brandRow}><div style={s.logoSmall}>ح</div><div><p style={s.eyebrow}>HASSOUN ADMIN</p><strong>Owner Control Center</strong></div></div><div style={s.headerRight}><span style={s.muted}>{admin.display_name || admin.username} · {admin.role}</span><a href="/admin/email" style={s.secondaryLink}>Email Center</a><button onClick={signOut} style={s.secondary}>Sign out</button></div></header>
    <nav style={s.nav}>{tabs.map((tab) => <button key={tab.key} onClick={() => setView(tab.key)} style={{ ...s.navButton, ...(view === tab.key ? s.navActive : {}) }}>{tab.label}</button>)}</nav>
    {error ? <div style={s.errorBanner}>{error}</div> : null}{notice ? <div style={s.successBanner}>{notice}</div> : null}

    {view === "dashboard" ? <section>
      <div style={s.titleRow}><div><p style={s.eyebrow}>LIVE OVERVIEW</p><h1 style={s.title}>Hassoun at a glance</h1></div><button style={s.secondary} onClick={() => token && void run(async () => { await loadAll(token); }, "Refreshed")}>Refresh</button></div>
      <div style={s.statsGrid}><Stat label="Active subscribers" value={subscriberSummary.active || 0} /><Stat label="Push devices" value={deviceSummary.active || 0} /><Stat label="Android" value={deviceSummary.android || 0} /><Stat label="iOS" value={deviceSummary.ios || 0} /><Stat label="Published content" value={crm.content?.published || 0} /><Stat label="Featured content" value={crm.content?.featured || 0} /><Stat label="Admins" value={crm.admins?.active || 0} /><Stat label="Audit events" value={crm.audit?.total || 0} /></div>
      <div style={s.grid2}><div style={s.panel}><h2 style={s.panelTitle}>Release control</h2><KeyValue label="Android minimum" value={String(crm.release?.minimum_android_version ?? "—")} /><KeyValue label="iOS minimum" value={String(crm.release?.minimum_ios_version ?? "—")} /><KeyValue label="Maintenance" value={crm.release?.maintenance_mode ? "ON" : "Off"} /></div>
      <div style={s.panel}><h2 style={s.panelTitle}>Delivery health</h2><KeyValue label="Scheduled pushes" value={String(dashboard.pushCampaigns?.scheduled || 0)} /><KeyValue label="Pending email" value={String(dashboard.emailOutbox?.pending || 0)} /><KeyValue label="Email failures" value={String(dashboard.emailDeliveries?.failed || 0)} /></div></div>
    </section> : null}

    {view === "subscribers" ? <section><Title eyebrow="USER & SUBSCRIBER CONTROL" title="Users" />
      <div style={s.filters}><input style={{ ...s.input, flex: 1 }} placeholder="Search email, city, country" value={search} onChange={(e) => setSearch(e.target.value)} /><select style={s.select} value={subscriberStatus} onChange={(e) => setSubscriberStatus(e.target.value)}><option value="">All statuses</option>{["active","pending","unsubscribed","bounced","disabled"].map(x => <option key={x}>{x}</option>)}</select></div>
      <div style={s.tableWrap}><table style={s.table}><thead><tr><Th>Email</Th><Th>Location</Th><Th>Platform links</Th><Th>Status</Th><Th>Action</Th></tr></thead><tbody>{filteredSubscribers.map((x) => <tr key={x.public_id}><Td><strong>{x.email}</strong><div style={s.subtle}>{x.locale.toUpperCase()} · {x.timezone}</div></Td><Td>{[x.city,x.region,x.country_name].filter(Boolean).join(", ") || "—"}</Td><Td>{x.linked_devices || 0}</Td><Td><Badge tone={statusTone(x.status)}>{x.status}</Badge></Td><Td><select style={s.smallSelect} value={x.status} onChange={(e) => { const next = e.target.value; void run(async () => { await api(`/admin/subscribers/${x.public_id}/status`, { method: "POST", body: JSON.stringify({ status: next }) }, token); }, `Subscriber changed to ${next}`); }}>{["active","pending","unsubscribed","bounced","disabled"].map(v => <option key={v}>{v}</option>)}</select></Td></tr>)}</tbody></table></div>
    </section> : null}

    {view === "content" ? <section><Title eyebrow="CONTENT MANAGEMENT" title="Ayah, Hadith, Du'a, events and more" />
      <div style={s.grid2}><form style={s.panel} onSubmit={(e) => { e.preventDefault(); void run(async () => { await api("/admin/content", { method: "POST", body: JSON.stringify({ contentType: newType, titleEn: newTitle, titleAr: newTitleAr, bodyEn: newBody, bodyAr: newBodyAr, sourceText: newSource, featured: newFeatured, status: "published" }) }, token); setNewTitle(""); setNewTitleAr(""); setNewBody(""); setNewBodyAr(""); setNewSource(""); setNewFeatured(false); }, "Content published"); }}>
        <h2 style={s.panelTitle}>Publish content</h2><label style={s.label}>Type</label><select style={s.selectFull} value={newType} onChange={(e) => setNewType(e.target.value)}>{["announcement","ayah","hadith","dua","event","quran_source","reciter","quiz"].map(x => <option key={x}>{x}</option>)}</select>
        <label style={s.label}>English title</label><input required style={s.input} value={newTitle} onChange={(e) => setNewTitle(e.target.value)} /><label style={s.label}>Arabic title</label><input dir="rtl" style={s.input} value={newTitleAr} onChange={(e) => setNewTitleAr(e.target.value)} />
        <label style={s.label}>English content</label><textarea style={s.textarea} value={newBody} onChange={(e) => setNewBody(e.target.value)} /><label style={s.label}>Arabic content</label><textarea dir="rtl" style={s.textarea} value={newBodyAr} onChange={(e) => setNewBodyAr(e.target.value)} />
        <label style={s.label}>Source / attribution</label><input style={s.input} value={newSource} onChange={(e) => setNewSource(e.target.value)} /><label style={s.check}><input type="checkbox" checked={newFeatured} onChange={(e) => setNewFeatured(e.target.checked)} /> Feature this content</label><button style={s.primary} disabled={busy}>Publish</button>
      </form>
      <div style={s.panel}><h2 style={s.panelTitle}>Content library</h2><div style={s.filters}><select style={s.select} value={contentType} onChange={(e) => setContentType(e.target.value)}><option value="">All types</option>{["announcement","ayah","hadith","dua","event","quran_source","reciter","quiz"].map(x => <option key={x}>{x}</option>)}</select><select style={s.select} value={contentStatus} onChange={(e) => setContentStatus(e.target.value)}><option value="">All status</option><option>published</option><option>draft</option><option>archived</option></select></div>
        <div style={s.cardList}>{filteredContent.map((x) => <div key={x.public_id} style={s.contentCard}><div><strong>{x.title_en}</strong><div style={s.subtle}>{x.content_type} · {new Date(x.updated_at).toLocaleString()}</div></div><div style={s.inline}><Badge tone={statusTone(x.status)}>{x.status}</Badge>{x.featured ? <Badge tone="blue">featured</Badge> : null}<button style={s.tiny} onClick={() => void run(async () => { await api(`/admin/content/${x.public_id}`, { method: "POST", body: JSON.stringify({ status: x.status === "published" ? "archived" : "published" }) }, token); }, x.status === "published" ? "Content archived" : "Content published")}>{x.status === "published" ? "Archive" : "Publish"}</button></div></div>)}</div>
      </div></div>
    </section> : null}

    {view === "control" ? <section><Title eyebrow="REMOTE APP CONTROL" title="Feature flags & release rules" /><div style={s.settingsGrid}>{settings.map((x) => <SettingCard key={x.key} setting={x} disabled={busy} onSave={(value) => void run(async () => { await api(`/admin/settings/${encodeURIComponent(x.key)}`, { method: "POST", body: JSON.stringify({ value }) }, token); }, `${x.key} updated`)} />)}</div></section> : null}

    {view === "push" ? <section><Title eyebrow="PUSH NOTIFICATIONS" title="Send or schedule a broadcast" /><div style={s.grid2}><form style={s.panel} onSubmit={(e) => { e.preventDefault(); void run(async () => { await api("/admin/push/campaigns", { method: "POST", body: JSON.stringify({ name: pushTitle, titleEn: pushTitle, bodyEn: pushBody, titleAr: pushTitleAr || undefined, bodyAr: pushBodyAr || undefined, category: "announcement", audience: "all_devices", targetPlatform: pushPlatform, targetLocale: "all", priority: "high", scheduledAt: pushScheduled ? new Date(pushScheduled).toISOString() : new Date().toISOString() }) }, token); setPushTitle(""); setPushBody(""); setPushTitleAr(""); setPushBodyAr(""); setPushScheduled(""); }, "Push queued"); }}><h2 style={s.panelTitle}>Compose</h2><label style={s.label}>English title</label><input required style={s.input} value={pushTitle} onChange={(e) => setPushTitle(e.target.value)} /><label style={s.label}>English message</label><textarea required style={s.textarea} value={pushBody} onChange={(e) => setPushBody(e.target.value)} /><label style={s.label}>Arabic title</label><input dir="rtl" style={s.input} value={pushTitleAr} onChange={(e) => setPushTitleAr(e.target.value)} /><label style={s.label}>Arabic message</label><textarea dir="rtl" style={s.textarea} value={pushBodyAr} onChange={(e) => setPushBodyAr(e.target.value)} /><div style={s.twoCols}><div><label style={s.label}>Platform</label><select style={s.selectFull} value={pushPlatform} onChange={(e) => setPushPlatform(e.target.value)}><option value="all">All</option><option value="android">Android</option><option value="ios">iOS</option><option value="web">Web</option></select></div><div><label style={s.label}>Schedule</label><input type="datetime-local" style={s.input} value={pushScheduled} onChange={(e) => setPushScheduled(e.target.value)} /></div></div><button style={s.primary} disabled={busy}>Send / schedule</button></form>
      <div style={s.panel}><h2 style={s.panelTitle}>Recent campaigns</h2><div style={s.cardList}>{campaigns.slice(0,30).map(x => <div key={x.public_id} style={s.contentCard}><div><strong>{x.title_en || x.name}</strong><div style={s.subtle}>{x.target_platform} · {x.scheduled_at ? new Date(x.scheduled_at).toLocaleString() : "—"}</div></div><Badge tone={statusTone(x.status)}>{x.status}</Badge></div>)}</div></div></div></section> : null}

    {view === "team" ? <section><Title eyebrow="SECURITY & ACCESS" title="Admin team" />{admin.role !== "owner" ? <div style={s.panel}>Only the owner can manage admin roles and access.</div> : <div style={s.tableWrap}><table style={s.table}><thead><tr><Th>Admin</Th><Th>Role</Th><Th>Status</Th><Th>Last sign-in</Th><Th>Control</Th></tr></thead><tbody>{team.map(x => <tr key={x.public_id}><Td><strong>{x.display_name || x.username}</strong><div style={s.subtle}>{x.email}</div></Td><Td>{x.role}</Td><Td><Badge tone={statusTone(x.status)}>{x.status}</Badge></Td><Td>{x.last_signed_in_at ? new Date(x.last_signed_in_at).toLocaleString() : "Never"}</Td><Td>{x.role === "owner" || x.public_id === admin.public_id ? <span style={s.subtle}>Protected</span> : <div style={s.inline}><select style={s.smallSelect} value={x.role} onChange={(e) => { const role = e.target.value; void run(async () => { await api(`/admin/team/${x.public_id}`, { method: "POST", body: JSON.stringify({ role }) }, token); }, "Admin role updated"); }}><option value="admin">admin</option><option value="editor">editor</option></select><button style={x.status === "active" ? s.dangerTiny : s.tiny} onClick={() => void run(async () => { await api(`/admin/team/${x.public_id}`, { method: "POST", body: JSON.stringify({ status: x.status === "active" ? "disabled" : "active" }) }, token); }, "Admin access updated")}>{x.status === "active" ? "Disable" : "Enable"}</button></div>}</Td></tr>)}</tbody></table></div>}</section> : null}

    {view === "audit" ? <section><Title eyebrow="ACCOUNTABILITY" title="Audit log" /><div style={s.tableWrap}><table style={s.table}><thead><tr><Th>When</Th><Th>Admin</Th><Th>Action</Th><Th>Area</Th><Th>Details</Th></tr></thead><tbody>{audit.map(x => <tr key={x.id}><Td>{new Date(x.created_at).toLocaleString()}</Td><Td>{x.display_name || x.username || "System"}</Td><Td><Badge tone="blue">{x.action}</Badge></Td><Td>{x.entity_type}</Td><Td>{x.summary || x.entity_id || "—"}</Td></tr>)}</tbody></table></div></section> : null}
  </main>;
}

function Title({ eyebrow, title }: { eyebrow: string; title: string }) { return <div style={s.titleRow}><div><p style={s.eyebrow}>{eyebrow}</p><h1 style={s.title}>{title}</h1></div></div>; }
function KeyValue({ label, value }: { label: string; value: string }) { return <div style={s.keyValue}><span style={s.muted}>{label}</span><strong>{value}</strong></div>; }
function Th({ children }: { children: React.ReactNode }) { return <th style={s.th}>{children}</th>; }
function Td({ children }: { children: React.ReactNode }) { return <td style={s.td}>{children}</td>; }

function SettingCard({ setting, onSave, disabled }: { setting: Setting; onSave: (value: unknown) => void; disabled: boolean }) {
  const isBool = typeof setting.value === "boolean";
  const isObject = setting.value !== null && typeof setting.value === "object";
  const [text, setText] = useState(isObject ? JSON.stringify(setting.value, null, 2) : String(setting.value ?? ""));
  useEffect(() => setText(isObject ? JSON.stringify(setting.value, null, 2) : String(setting.value ?? "")), [setting.value, isObject]);
  return <div style={s.panel}><div style={s.settingHeader}><div><strong>{setting.key.replaceAll("_", " ")}</strong><p style={s.subtle}>{setting.description}</p></div>{isBool ? <button disabled={disabled} style={setting.value ? s.toggleOn : s.toggleOff} onClick={() => onSave(!setting.value)}>{setting.value ? "ON" : "OFF"}</button> : null}</div>{!isBool ? <div style={s.inlineStretch}>{isObject ? <textarea style={{ ...s.textarea, margin: 0 }} value={text} onChange={(e) => setText(e.target.value)} /> : <input style={{ ...s.input, margin: 0 }} value={text} onChange={(e) => setText(e.target.value)} />}<button disabled={disabled} style={s.tiny} onClick={() => { if (isObject) { try { onSave(JSON.parse(text)); } catch { window.alert("Invalid JSON"); } } else onSave(text); }}>Save</button></div> : null}</div>;
}

const s: Record<string, React.CSSProperties> = {
  page:{minHeight:"100vh",background:"#f5f7f6",color:"#18332c",fontFamily:"Inter, ui-sans-serif, system-ui, -apple-system, sans-serif",paddingBottom:50},loginPage:{minHeight:"100vh",display:"grid",placeItems:"center",background:"linear-gradient(145deg,#063f34,#0c6652)",padding:20},loginCard:{width:"min(440px,100%)",background:"white",borderRadius:24,padding:32,boxShadow:"0 25px 80px #001c1640",display:"grid",gap:10},logo:{width:60,height:60,borderRadius:18,display:"grid",placeItems:"center",fontSize:30,fontWeight:800,background:"#e4f5ee",color:"#0b5b47"},logoSmall:{width:42,height:42,borderRadius:12,display:"grid",placeItems:"center",fontSize:22,fontWeight:800,background:"#e4f5ee",color:"#0b5b47"},loginTitle:{fontSize:32,margin:"4px 0"},header:{position:"sticky",top:0,zIndex:10,background:"#fffefef2",backdropFilter:"blur(12px)",borderBottom:"1px solid #dde7e3",padding:"14px clamp(18px,4vw,58px)",display:"flex",alignItems:"center",justifyContent:"space-between",gap:18,flexWrap:"wrap"},brandRow:{display:"flex",alignItems:"center",gap:12},headerRight:{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"},nav:{padding:"14px clamp(18px,4vw,58px)",display:"flex",gap:8,overflowX:"auto",background:"#f5f7f6",borderBottom:"1px solid #e1e8e5"},navButton:{border:0,background:"transparent",padding:"10px 14px",borderRadius:10,color:"#536862",fontWeight:700,cursor:"pointer",whiteSpace:"nowrap"},navActive:{background:"#0b5b47",color:"white",boxShadow:"0 5px 16px #0b5b4725"},titleRow:{maxWidth:1250,margin:"28px auto 18px",padding:"0 clamp(18px,4vw,30px)",display:"flex",justifyContent:"space-between",alignItems:"end",gap:16},title:{fontSize:"clamp(25px,3vw,38px)",margin:"4px 0"},eyebrow:{fontSize:11,letterSpacing:1.6,fontWeight:850,color:"#0b8062",margin:0},muted:{color:"#6b7d78",fontSize:13},subtle:{color:"#7b8c87",fontSize:12,marginTop:4},statsGrid:{maxWidth:1250,margin:"0 auto",padding:"0 clamp(18px,4vw,30px)",display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(155px,1fr))",gap:12},stat:{background:"white",border:"1px solid #e0e8e5",borderRadius:17,padding:18,display:"grid",gap:5},statValue:{fontSize:29,color:"#0b5b47"},statLabel:{fontWeight:750,fontSize:13},grid2:{maxWidth:1250,margin:"18px auto",padding:"0 clamp(18px,4vw,30px)",display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(320px,1fr))",gap:16},panel:{background:"white",border:"1px solid #e0e8e5",borderRadius:18,padding:20,boxShadow:"0 4px 18px #163d3108"},panelTitle:{fontSize:19,margin:"0 0 16px"},keyValue:{display:"flex",justifyContent:"space-between",gap:10,padding:"11px 0",borderBottom:"1px solid #eef2f0"},filters:{maxWidth:1250,margin:"0 auto 15px",padding:"0 clamp(18px,4vw,30px)",display:"flex",gap:10,flexWrap:"wrap"},tableWrap:{maxWidth:1250,margin:"0 auto",background:"white",border:"1px solid #e0e8e5",borderRadius:18,overflowX:"auto"},table:{width:"100%",borderCollapse:"collapse",minWidth:760},th:{textAlign:"left",fontSize:11,textTransform:"uppercase",letterSpacing:.7,color:"#70807b",padding:"13px 15px",background:"#f7faf8",borderBottom:"1px solid #e7eeeb"},td:{padding:"14px 15px",borderBottom:"1px solid #eef2f0",fontSize:13,verticalAlign:"middle"},badge:{display:"inline-flex",padding:"5px 9px",borderRadius:999,fontSize:11,fontWeight:800},input:{width:"100%",boxSizing:"border-box",border:"1px solid #cad8d3",borderRadius:11,padding:"11px 12px",fontSize:14,background:"white",outline:"none",marginBottom:10},textarea:{width:"100%",minHeight:92,boxSizing:"border-box",border:"1px solid #cad8d3",borderRadius:11,padding:"11px 12px",fontSize:14,background:"white",outline:"none",resize:"vertical",marginBottom:10},select:{border:"1px solid #cad8d3",borderRadius:11,padding:"10px 12px",background:"white",minWidth:155},selectFull:{width:"100%",border:"1px solid #cad8d3",borderRadius:11,padding:"11px 12px",background:"white",marginBottom:10},smallSelect:{border:"1px solid #cad8d3",borderRadius:8,padding:"7px 8px",background:"white"},label:{fontSize:12,fontWeight:800,color:"#455b55",margin:"5px 0"},primary:{border:0,borderRadius:11,padding:"12px 16px",background:"#0b5b47",color:"white",fontWeight:800,cursor:"pointer"},secondary:{border:"1px solid #cbd9d4",borderRadius:10,padding:"9px 12px",background:"white",color:"#34524a",fontWeight:750,cursor:"pointer"},secondaryLink:{border:"1px solid #cbd9d4",borderRadius:10,padding:"9px 12px",background:"white",color:"#34524a",fontWeight:750,textDecoration:"none",fontSize:13},tiny:{border:"1px solid #bfd2cb",borderRadius:8,padding:"7px 9px",background:"white",color:"#245347",fontWeight:750,cursor:"pointer",fontSize:12},dangerTiny:{border:"1px solid #efb7b7",borderRadius:8,padding:"7px 9px",background:"#fff4f4",color:"#9c2626",fontWeight:750,cursor:"pointer",fontSize:12},link:{color:"#0b6c55",textDecoration:"none",fontWeight:700,fontSize:13,marginTop:8},error:{color:"#9c2626",fontSize:13},errorBanner:{position:"relative",zIndex:1,maxWidth:1218,boxSizing:"border-box",margin:"16px auto 0",padding:"12px 16px",background:"#fff3f1",color:"#9c2626",border:"1px solid #f3c9c4",borderRadius:12,boxShadow:"0 4px 14px rgba(80,20,20,.05)"},successBanner:{position:"relative",zIndex:1,maxWidth:1218,boxSizing:"border-box",margin:"16px auto 0",padding:"12px 16px",background:"#e9f7ef",color:"#17633d",border:"1px solid #c9e8d5",borderRadius:12,boxShadow:"0 4px 14px rgba(20,80,50,.05)"},twoCols:{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:12},inline:{display:"flex",gap:7,alignItems:"center",flexWrap:"wrap"},inlineStretch:{display:"flex",gap:8,alignItems:"center"},check:{display:"flex",alignItems:"center",gap:8,fontSize:13,margin:"8px 0 14px"},cardList:{display:"grid",gap:8,maxHeight:560,overflowY:"auto"},contentCard:{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,padding:"12px 0",borderBottom:"1px solid #eef2f0"},settingsGrid:{maxWidth:1250,margin:"0 auto",padding:"0 clamp(18px,4vw,30px)",display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(320px,1fr))",gap:14},settingHeader:{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:12},toggleOn:{border:0,borderRadius:999,padding:"7px 11px",background:"#dff4e8",color:"#17633d",fontWeight:850,cursor:"pointer"},toggleOff:{border:0,borderRadius:999,padding:"7px 11px",background:"#eef2f3",color:"#596964",fontWeight:850,cursor:"pointer"}
};
