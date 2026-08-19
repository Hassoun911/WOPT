"use client";

import type { CSSProperties, FormEvent } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import AdminUsersPanel from "./AdminUsersPanel";
import AdminGamesPanel from "./AdminGamesPanel";

const API = "https://wopt-prayer-push.wopt-windsor.workers.dev";
const TOKEN_KEY = "wopt:admin-token:v2";

type Admin = { username: string; email: string; display_name?: string | null; role: string };
type Dashboard = {
  subscribers?: Record<string, number>;
  devices?: Record<string, number>;
  emailOutbox?: Record<string, number>;
  pushCampaigns?: Record<string, number>;
  emailDeliveries?: Record<string, number>;
};
type Setting = { key: string; group: string; label: string; value: Record<string, unknown>; isPublic: boolean; description?: string | null; updatedAt?: string };
type ContentItem = { publicId: string; key: string; type: string; locale: string; title?: string | null; body?: string | null; status?: string; startsAt?: string | null; endsAt?: string | null; updatedAt?: string };
type PrayerOverride = { date_key: string; prayer: string; time_value: string; reason?: string | null; enabled: number; updated_at?: string };
type SupportTicket = { public_id: string; name?: string | null; email: string; subject: string; message: string; status: string; priority: string; platform?: string | null; app_version?: string | null; internal_note?: string | null; created_at: string; assigned_name?: string | null; assigned_username?: string | null };
type ReleaseCheck = { check_key: string; platform: string; label: string; status: string; details?: string | null; evidence_url?: string | null; updated_at?: string };
type Activity = { id: number; action: string; entity_type: string; entity_id?: string | null; created_at: string; username?: string | null; display_name?: string | null; details?: unknown };
type Subscriber = { public_id: string; email: string; display_name?: string | null; status: string; city?: string | null; region?: string | null; country_name?: string | null; timezone: string; locale: string; linked_devices?: number };
type PushCampaign = { public_id: string; name: string; category: string; title_en: string; status: string; target_platform: string; target_locale: string; scheduled_at?: string | null; sent_at?: string | null; delivery_count?: number; sent_count?: number; failed_count?: number };
type EmailCampaign = { public_id: string; name: string; category: string; subject_en?: string; status: string; target_locale: string; scheduled_at?: string | null; sent_count?: number; failed_count?: number; delivery_count?: number };
type Control = { settings: Setting[]; content: ContentItem[]; prayerOverrides: PrayerOverride[]; supportSummary: Array<{ status: string; count: number }>; releaseChecks: ReleaseCheck[]; activity: Activity[] };
type ViewName = "overview" | "control" | "content" | "prayer" | "subscribers" | "users" | "games" | "support" | "push" | "email" | "release" | "audit";

async function api<T>(path: string, init: RequestInit = {}, token?: string | null): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(`${API}${path}`, { ...init, headers });
  const payload = await response.json().catch(() => ({})) as T & { error?: string };
  if (!response.ok) throw new Error(payload.error || `Request failed (${response.status})`);
  return payload;
}

function Stat({ label, value, note }: { label: string; value: number | string; note?: string }) {
  return <div style={S.stat}><div style={S.statValue}>{value}</div><div style={S.statLabel}>{label}</div>{note ? <div style={S.statNote}>{note}</div> : null}</div>;
}

function Pill({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "good" | "warn" | "bad" }) {
  const bg = tone === "good" ? "#e2f5ec" : tone === "warn" ? "#fff1cc" : tone === "bad" ? "#ffe1de" : "#edf1ef";
  const color = tone === "good" ? "#0b654f" : tone === "warn" ? "#815c10" : tone === "bad" ? "#9a3028" : "#52625d";
  return <span style={{ ...S.pill, background: bg, color }}>{children}</span>;
}

function Card({ title, subtitle, actions, children }: { title: string; subtitle?: string; actions?: React.ReactNode; children: React.ReactNode }) {
  return <section style={S.card}><div style={S.cardHead}><div><h3 style={S.cardTitle}>{title}</h3>{subtitle ? <p style={S.muted}>{subtitle}</p> : null}</div>{actions}</div>{children}</section>;
}

function Toggle({ checked, label, onChange }: { checked: boolean; label: string; onChange: (value: boolean) => void }) {
  return <label style={S.toggleRow}><button type="button" onClick={() => onChange(!checked)} style={{ ...S.toggle, ...(checked ? S.toggleOn : {}) }}><span style={{ ...S.toggleDot, ...(checked ? S.toggleDotOn : {}) }} /></button><span>{label}</span></label>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label style={S.field}><span style={S.fieldLabel}>{label}</span>{children}</label>;
}

function formatWhen(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

export default function AdminControlCenter() {
  const [token, setToken] = useState<string | null>(null);
  const [admin, setAdmin] = useState<Admin | null>(null);
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [view, setView] = useState<ViewName>("overview");
  const [dashboard, setDashboard] = useState<Dashboard>({});
  const [control, setControl] = useState<Control>({ settings: [], content: [], prayerOverrides: [], supportSummary: [], releaseChecks: [], activity: [] });
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [pushCampaigns, setPushCampaigns] = useState<PushCampaign[]>([]);
  const [emailCampaigns, setEmailCampaigns] = useState<EmailCampaign[]>([]);
  const [search, setSearch] = useState("");

  const [contentForm, setContentForm] = useState({ publicId: "", key: "home.announcement", type: "announcement", locale: "both", title: "", body: "", status: "draft" });
  const [prayerForm, setPrayerForm] = useState({ dateKey: "", prayer: "fajr", time: "", reason: "" });
  const [pushForm, setPushForm] = useState({ name: "", titleEn: "", bodyEn: "", titleAr: "", bodyAr: "", category: "announcement", audience: "all_devices", targetPlatform: "all", targetLocale: "all", scheduledAt: "" });
  const [emailForm, setEmailForm] = useState({ name: "", subjectEn: "", htmlEn: "", subjectAr: "", htmlAr: "", category: "announcement", audience: "all_subscribers", targetLocale: "all", scheduledAt: "" });
  const [jsonDrafts, setJsonDrafts] = useState<Record<string, string>>({});

  const settingMap = useMemo(() => Object.fromEntries(control.settings.map((setting) => [setting.key, setting])), [control.settings]);
  const featureFlags = (settingMap.feature_flags?.value ?? {}) as Record<string, unknown>;
  const appUi = (settingMap.app_ui?.value ?? {}) as Record<string, unknown>;

  const loadAll = useCallback(async (authToken: string) => {
    const [dash, ctrl, subs, support, pushes, emails] = await Promise.all([
      api<Dashboard & { admin?: Admin }>("/admin/dashboard", {}, authToken),
      api<Control>("/admin/control", {}, authToken),
      api<{ subscribers: Subscriber[] }>("/admin/subscribers?limit=200", {}, authToken),
      api<{ tickets: SupportTicket[] }>("/admin/support/tickets", {}, authToken),
      api<{ campaigns: PushCampaign[] }>("/admin/push/campaigns", {}, authToken),
      api<{ campaigns: EmailCampaign[] }>("/admin/email/campaigns", {}, authToken)
    ]);
    setDashboard(dash);
    if (dash.admin) setAdmin(dash.admin);
    setControl(ctrl);
    setSubscribers(subs.subscribers || []);
    setTickets(support.tickets || []);
    setPushCampaigns(pushes.campaigns || []);
    setEmailCampaigns(emails.campaigns || []);
    setJsonDrafts(Object.fromEntries((ctrl.settings || []).map((item) => [item.key, JSON.stringify(item.value, null, 2)])));
  }, []);

  useEffect(() => {
    const saved = window.localStorage.getItem(TOKEN_KEY) || window.localStorage.getItem("wopt:admin-token:v1");
    if (!saved) return;
    setToken(saved);
    void api<{ admin: Admin }>("/admin/me", {}, saved).then(async (data) => {
      setAdmin(data.admin);
      await loadAll(saved);
    }).catch(() => {
      window.localStorage.removeItem(TOKEN_KEY);
      setToken(null);
      setAdmin(null);
    });
  }, [loadAll]);

  const run = async (operation: () => Promise<void>, success?: string) => {
    setBusy(true); setError(""); setMessage("");
    try { await operation(); if (success) setMessage(success); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Request failed"); }
    finally { setBusy(false); }
  };

  const signIn = async (event: FormEvent) => {
    event.preventDefault();
    await run(async () => {
      const data = await api<{ token: string; admin: Admin }>("/admin/login", { method: "POST", body: JSON.stringify({ login, password }) });
      window.localStorage.setItem(TOKEN_KEY, data.token);
      setToken(data.token); setAdmin(data.admin); setPassword("");
      await loadAll(data.token);
    });
  };

  const signOut = () => {
    if (token) void api("/admin/logout", { method: "POST" }, token).catch(() => undefined);
    window.localStorage.removeItem(TOKEN_KEY); window.localStorage.removeItem("wopt:admin-token:v1");
    setToken(null); setAdmin(null);
  };

  const reload = async () => { if (token) await run(() => loadAll(token), "Control Center refreshed."); };

  const saveSetting = async (key: string, value: unknown) => {
    if (!token) return;
    const setting = settingMap[key];
    await run(async () => {
      await api("/admin/control/settings", { method: "POST", body: JSON.stringify({ key, group: setting?.group, label: setting?.label || key, description: setting?.description, isPublic: setting?.isPublic ?? true, value }) }, token);
      await loadAll(token);
    }, `${setting?.label || key} saved.`);
  };

  const toggleFeature = (key: string, value: boolean) => void saveSetting("feature_flags", { ...featureFlags, [key]: value });
  const saveAppUiPatch = (patch: Record<string, unknown>) => void saveSetting("app_ui", { ...appUi, ...patch });

  const saveJsonSetting = async (key: string) => {
    try { await saveSetting(key, JSON.parse(jsonDrafts[key] || "{}")); }
    catch { setError(`Invalid JSON in ${key}.`); }
  };

  const saveContent = async (event: FormEvent) => {
    event.preventDefault(); if (!token) return;
    await run(async () => {
      await api("/admin/control/content", { method: "POST", body: JSON.stringify(contentForm) }, token);
      setContentForm({ publicId: "", key: "home.announcement", type: "announcement", locale: "both", title: "", body: "", status: "draft" });
      await loadAll(token);
    }, "Content saved.");
  };

  const savePrayer = async (event: FormEvent) => {
    event.preventDefault(); if (!token) return;
    await run(async () => {
      await api("/admin/control/prayer-overrides", { method: "POST", body: JSON.stringify(prayerForm) }, token);
      setPrayerForm((old) => ({ ...old, time: "", reason: "" }));
      await loadAll(token);
    }, "Prayer override saved and will be merged into the live schedule.");
  };

  const deletePrayer = async (item: PrayerOverride) => {
    if (!token) return;
    await run(async () => {
      await api(`/admin/control/prayer-overrides?dateKey=${encodeURIComponent(item.date_key)}&prayer=${encodeURIComponent(item.prayer)}`, { method: "DELETE" }, token);
      await loadAll(token);
    }, "Prayer override removed.");
  };

  const updateTicket = async (ticket: SupportTicket, patch: Partial<SupportTicket> & { assignToMe?: boolean }) => {
    if (!token) return;
    await run(async () => {
      await api("/admin/support/tickets", { method: "POST", body: JSON.stringify({ publicId: ticket.public_id, status: patch.status ?? ticket.status, priority: patch.priority ?? ticket.priority, internalNote: patch.internal_note ?? ticket.internal_note, assignToMe: patch.assignToMe }) }, token);
      const data = await api<{ tickets: SupportTicket[] }>("/admin/support/tickets", {}, token);
      setTickets(data.tickets || []);
    }, "Support ticket updated.");
  };

  const updateRelease = async (check: ReleaseCheck, status: string) => {
    if (!token) return;
    await run(async () => {
      await api("/admin/release/checks", { method: "POST", body: JSON.stringify({ key: check.check_key, status, details: check.details, evidenceUrl: check.evidence_url }) }, token);
      await loadAll(token);
    }, "Release check updated.");
  };

  const createPush = async (event: FormEvent) => {
    event.preventDefault(); if (!token) return;
    await run(async () => {
      const body = { ...pushForm, scheduledAt: pushForm.scheduledAt ? new Date(pushForm.scheduledAt).toISOString() : new Date().toISOString() };
      await api("/admin/push/campaigns", { method: "POST", body: JSON.stringify(body) }, token);
      setPushForm({ name: "", titleEn: "", bodyEn: "", titleAr: "", bodyAr: "", category: "announcement", audience: "all_devices", targetPlatform: "all", targetLocale: "all", scheduledAt: "" });
      await loadAll(token);
    }, "Push campaign queued.");
  };

  const createEmail = async (event: FormEvent) => {
    event.preventDefault(); if (!token) return;
    await run(async () => {
      const body = { ...emailForm, scheduledAt: emailForm.scheduledAt ? new Date(emailForm.scheduledAt).toISOString() : new Date().toISOString() };
      await api("/admin/email/campaigns", { method: "POST", body: JSON.stringify(body) }, token);
      setEmailForm({ name: "", subjectEn: "", htmlEn: "", subjectAr: "", htmlAr: "", category: "announcement", audience: "all_subscribers", targetLocale: "all", scheduledAt: "" });
      await loadAll(token);
    }, "Email campaign queued.");
  };

  if (!token || !admin) {
    return <main style={S.loginPage}><form onSubmit={signIn} style={S.loginCard}><div style={S.logo}>و</div><div><div style={S.eyebrow}>HASSOUN ADMIN</div><h1 style={S.loginTitle}>Control Center</h1><p style={S.muted}>Private administration for the Hassoun app, users, content and releases.</p></div><Field label="Username or email"><input value={login} onChange={(event) => setLogin(event.target.value)} autoComplete="username" style={S.input} /></Field><Field label="Password"><input value={password} onChange={(event) => setPassword(event.target.value)} type="password" autoComplete="current-password" style={S.input} /></Field>{error ? <div style={S.error}>{error}</div> : null}<button disabled={busy || !login || !password} style={S.primary}>{busy ? "Signing in…" : "Sign in"}</button></form></main>;
  }

  const nav: Array<[ViewName, string, string]> = [
    ["overview", "Overview", "⌂"], ["control", "App Control", "⚙"], ["content", "Content", "✎"], ["prayer", "Prayer Times", "◷"],
    ["subscribers", "Subscribers", "◎"], ["users", "Administrators", "♙"], ["games", "Game Rooms", "◉"], ["support", "Support", "✉"],
    ["push", "Push", "↗"], ["email", "Email", "@"], ["release", "Store Release", "✓"], ["audit", "Audit", "≡"]
  ];

  const supportOpen = control.supportSummary.find((row) => row.status === "open")?.count ?? 0;
  const releasePassed = control.releaseChecks.filter((check) => check.status === "pass").length;
  const releaseTotal = control.releaseChecks.length;
  const filteredSubscribers = subscribers.filter((item) => !search || [item.email, item.display_name, item.city, item.region, item.country_name].some((value) => String(value || "").toLowerCase().includes(search.toLowerCase())));

  return <main style={S.page}>
    <aside style={S.sidebar}>
      <div style={S.sideBrand}><div style={S.logoSmall}>و</div><div><div style={S.eyebrow}>HASSOUN</div><strong>Admin CRM</strong></div></div>
      <div style={S.nav}>{nav.map(([key, label, icon]) => <button key={key} onClick={() => setView(key)} style={{ ...S.navButton, ...(view === key ? S.navActive : {}) }}><span style={S.navIcon}>{icon}</span>{label}</button>)}</div>
      <div style={S.sideBottom}><div style={S.muted}>{admin.display_name || admin.username}<br />{admin.role}</div><button onClick={signOut} style={S.secondary}>Sign out</button></div>
    </aside>

    <section style={S.main}>
      <header style={S.topbar}><div><div style={S.eyebrow}>HASSOUN CONTROL CENTER</div><h1 style={S.pageTitle}>{nav.find(([key]) => key === view)?.[1]}</h1></div><div style={S.topActions}><button onClick={() => void reload()} disabled={busy} style={S.secondary}>↻ Refresh</button><a href="../" style={S.secondaryLink}>Open app ↗</a></div></header>
      {error ? <div style={S.errorBanner}>{error}</div> : null}{message ? <div style={S.successBanner}>{message}</div> : null}

      {view === "overview" ? <>
        <div style={S.stats}><Stat label="Email subscribers" value={dashboard.subscribers?.total ?? 0} /><Stat label="Registered devices" value={dashboard.devices?.total ?? 0} /><Stat label="Open support" value={supportOpen} /><Stat label="Release checks" value={`${releasePassed}/${releaseTotal || 0}`} note="passed" /></div>
        <div style={S.twoCols}><Card title="App status" subtitle="Remote state users currently receive"><div style={S.list}><div style={S.listRow}><span>Maintenance</span><Pill tone={appUi.maintenanceMode ? "warn" : "good"}>{appUi.maintenanceMode ? "ON" : "OFF"}</Pill></div><div style={S.listRow}><span>Home announcement</span><Pill>{appUi.homeAnnouncementEnabled ? "ON" : "OFF"}</Pill></div><div style={S.listRow}><span>Public settings</span><strong>{control.settings.filter((item) => item.isPublic).length}</strong></div><div style={S.listRow}><span>Published content</span><strong>{control.content.filter((item) => item.status === "published").length}</strong></div></div></Card><Card title="Store readiness" subtitle="Android + iOS submission checklist"><div style={S.list}>{control.releaseChecks.slice(0, 8).map((check) => <div key={check.check_key} style={S.listRow}><span>{check.platform.toUpperCase()} • {check.label}</span><Pill tone={check.status === "pass" ? "good" : check.status === "fail" ? "bad" : "warn"}>{check.status}</Pill></div>)}</div></Card></div>
        <Card title="Recent admin activity" subtitle="Latest configuration and communication changes"><div style={S.tableWrap}><table style={S.table}><thead><tr><th>When</th><th>Admin</th><th>Action</th><th>Entity</th></tr></thead><tbody>{control.activity.slice(0, 12).map((row) => <tr key={row.id}><td>{formatWhen(row.created_at)}</td><td>{row.display_name || row.username || "System"}</td><td>{row.action}</td><td>{row.entity_type}{row.entity_id ? ` • ${row.entity_id}` : ""}</td></tr>)}</tbody></table></div></Card>
      </> : null}

      {view === "control" ? <>
        <Card title="Feature switches" subtitle="Turn major app features on or off remotely. Changes apply when devices refresh config."><div style={S.toggleGrid}>{Object.entries(featureFlags).map(([key, value]) => <Toggle key={key} checked={value !== false} label={key.replace(/([A-Z])/g, " $1").replace(/^./, (letter) => letter.toUpperCase())} onChange={(next) => toggleFeature(key, next)} />)}</div></Card>
        <Card title="Maintenance & global announcement" subtitle="Emergency app-wide controls"><div style={S.formGrid}><Toggle checked={appUi.maintenanceMode === true} label="Maintenance mode" onChange={(value) => saveAppUiPatch({ maintenanceMode: value })} /><Toggle checked={appUi.homeAnnouncementEnabled === true} label="Show global announcement" onChange={(value) => saveAppUiPatch({ homeAnnouncementEnabled: value })} /><Field label="Maintenance message (English)"><input key={`maintenance-en-${String(appUi.maintenanceMessageEn || "")}`} defaultValue={String(appUi.maintenanceMessageEn || "")} onBlur={(event) => saveAppUiPatch({ maintenanceMessageEn: event.target.value })} style={S.input} /></Field><Field label="Maintenance message (Arabic)"><input key={`maintenance-ar-${String(appUi.maintenanceMessageAr || "")}`} defaultValue={String(appUi.maintenanceMessageAr || "")} onBlur={(event) => saveAppUiPatch({ maintenanceMessageAr: event.target.value })} style={S.input} /></Field><Field label="Announcement (English)"><textarea defaultValue={String(appUi.homeAnnouncementEn || "")} onBlur={(event) => saveAppUiPatch({ homeAnnouncementEn: event.target.value })} style={S.textarea} /></Field><Field label="Announcement (Arabic)"><textarea defaultValue={String(appUi.homeAnnouncementAr || "")} onBlur={(event) => saveAppUiPatch({ homeAnnouncementAr: event.target.value })} style={S.textarea} /></Field></div></Card>
        <div style={S.twoCols}>{control.settings.filter((setting) => !["feature_flags", "app_ui"].includes(setting.key)).map((setting) => <Card key={setting.key} title={setting.label} subtitle={`${setting.group} • ${setting.description || setting.key}`} actions={<Pill>{setting.isPublic ? "PUBLIC" : "INTERNAL"}</Pill>}><textarea value={jsonDrafts[setting.key] ?? JSON.stringify(setting.value, null, 2)} onChange={(event) => setJsonDrafts((old) => ({ ...old, [setting.key]: event.target.value }))} spellCheck={false} style={S.codeArea} /><button onClick={() => void saveJsonSetting(setting.key)} style={S.primarySmall}>Save {setting.label}</button></Card>)}</div>
      </> : null}

      {view === "content" ? <div style={S.twoCols}><Card title="Create / edit content" subtitle="Publish app content without a new store build"><form onSubmit={saveContent} style={S.form}><Field label="Content key"><input value={contentForm.key} onChange={(e) => setContentForm({ ...contentForm, key: e.target.value })} style={S.input} /></Field><div style={S.formGrid}><Field label="Type"><select value={contentForm.type} onChange={(e) => setContentForm({ ...contentForm, type: e.target.value })} style={S.input}><option>announcement</option><option>banner</option><option>daily_inspiration</option><option>islamic_event</option><option>help</option><option>legal_notice</option><option>custom</option></select></Field><Field label="Language"><select value={contentForm.locale} onChange={(e) => setContentForm({ ...contentForm, locale: e.target.value })} style={S.input}><option value="both">Both</option><option value="en">English</option><option value="ar">Arabic</option></select></Field></div><Field label="Title"><input value={contentForm.title} onChange={(e) => setContentForm({ ...contentForm, title: e.target.value })} style={S.input} /></Field><Field label="Body"><textarea value={contentForm.body} onChange={(e) => setContentForm({ ...contentForm, body: e.target.value })} style={S.textareaTall} /></Field><Field label="Status"><select value={contentForm.status} onChange={(e) => setContentForm({ ...contentForm, status: e.target.value })} style={S.input}><option>draft</option><option>published</option><option>archived</option></select></Field><button style={S.primary}>Save content</button></form></Card><Card title="Content library" subtitle={`${control.content.length} items`}><div style={S.scrollList}>{control.content.map((item) => <button key={item.publicId} onClick={() => setContentForm({ publicId: item.publicId, key: item.key, type: item.type, locale: item.locale, title: item.title || "", body: item.body || "", status: item.status || "draft" })} style={S.contentRow}><div><strong>{item.title || item.key}</strong><div style={S.mutedSmall}>{item.key} • {item.type} • {item.locale}</div></div><Pill tone={item.status === "published" ? "good" : "neutral"}>{item.status}</Pill></button>)}</div></Card></div> : null}

      {view === "prayer" ? <div style={S.twoCols}><Card title="Prayer-time override" subtitle="Safely override one official Windsor time. The source JSON stays unchanged."><form onSubmit={savePrayer} style={S.form}><Field label="Date"><input type="date" value={prayerForm.dateKey} onChange={(e) => setPrayerForm({ ...prayerForm, dateKey: e.target.value })} required style={S.input} /></Field><div style={S.formGrid}><Field label="Prayer"><select value={prayerForm.prayer} onChange={(e) => setPrayerForm({ ...prayerForm, prayer: e.target.value })} style={S.input}>{["fajr", "dhuhr", "asr", "maghrib", "isha"].map((p) => <option key={p}>{p}</option>)}</select></Field><Field label="24-hour time"><input type="time" value={prayerForm.time} onChange={(e) => setPrayerForm({ ...prayerForm, time: e.target.value })} required style={S.input} /></Field></div><Field label="Reason / source note"><textarea value={prayerForm.reason} onChange={(e) => setPrayerForm({ ...prayerForm, reason: e.target.value })} style={S.textarea} /></Field><button style={S.primary}>Save override</button></form></Card><Card title="Active overrides" subtitle="These are merged over the official schedule"><div style={S.scrollList}>{control.prayerOverrides.map((item) => <div key={`${item.date_key}:${item.prayer}`} style={S.contentRowStatic}><div><strong>{item.date_key} • {item.prayer}</strong><div style={S.mutedSmall}>{item.time_value}{item.reason ? ` • ${item.reason}` : ""}</div></div><button onClick={() => void deletePrayer(item)} style={S.dangerSmall}>Remove</button></div>)}</div></Card></div> : null}

      {view === "subscribers" ? <Card title="Subscribers & linked devices" subtitle="Search prayer-email subscribers and their device links" actions={<input placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} style={S.search} />}><div style={S.tableWrap}><table style={S.table}><thead><tr><th>Email</th><th>Status</th><th>Location</th><th>Timezone</th><th>Language</th><th>Devices</th></tr></thead><tbody>{filteredSubscribers.map((row) => <tr key={row.public_id}><td><strong>{row.email}</strong><br /><span style={S.mutedSmall}>{row.display_name}</span></td><td><Pill tone={row.status === "active" ? "good" : "warn"}>{row.status}</Pill></td><td>{[row.city, row.region, row.country_name].filter(Boolean).join(", ") || "—"}</td><td>{row.timezone}</td><td>{row.locale}</td><td>{row.linked_devices ?? 0}</td></tr>)}</tbody></table></div></Card> : null}

      {view === "users" ? <AdminUsersPanel token={token} /> : null}

      {view === "games" ? <AdminGamesPanel token={token} /> : null}

      {view === "support" ? <Card title="Support CRM" subtitle="Every in-app support request is stored here even if email delivery fails"><div style={S.ticketGrid}>{tickets.map((ticket) => <article key={ticket.public_id} style={S.ticket}><div style={S.cardHead}><div><strong>{ticket.subject}</strong><div style={S.mutedSmall}>{ticket.name || "User"} • {ticket.email} • {formatWhen(ticket.created_at)}</div></div><Pill tone={ticket.priority === "urgent" || ticket.priority === "high" ? "bad" : ticket.status === "resolved" ? "good" : "warn"}>{ticket.priority} • {ticket.status}</Pill></div><p style={S.ticketMessage}>{ticket.message}</p><div style={S.ticketMeta}>{ticket.platform || "unknown"} • v{ticket.app_version || "?"}{ticket.assigned_name || ticket.assigned_username ? ` • assigned to ${ticket.assigned_name || ticket.assigned_username}` : ""}</div><div style={S.buttonRow}><button onClick={() => void updateTicket(ticket, { status: "in_progress", assignToMe: true })} style={S.secondary}>Take</button><button onClick={() => void updateTicket(ticket, { status: "resolved", assignToMe: true })} style={S.primarySmall}>Resolve</button><button onClick={() => void updateTicket(ticket, { priority: "high" })} style={S.warnSmall}>High priority</button></div></article>)}</div></Card> : null}

      {view === "push" ? <div style={S.twoCols}><Card title="Send push campaign" subtitle="Target Android, iOS or web devices"><form onSubmit={createPush} style={S.form}><Field label="Campaign name"><input value={pushForm.name} onChange={(e) => setPushForm({ ...pushForm, name: e.target.value })} style={S.input} /></Field><Field label="English title"><input required value={pushForm.titleEn} onChange={(e) => setPushForm({ ...pushForm, titleEn: e.target.value })} style={S.input} /></Field><Field label="English message"><textarea required value={pushForm.bodyEn} onChange={(e) => setPushForm({ ...pushForm, bodyEn: e.target.value })} style={S.textarea} /></Field><Field label="Arabic title"><input value={pushForm.titleAr} onChange={(e) => setPushForm({ ...pushForm, titleAr: e.target.value })} style={S.input} /></Field><Field label="Arabic message"><textarea value={pushForm.bodyAr} onChange={(e) => setPushForm({ ...pushForm, bodyAr: e.target.value })} style={S.textarea} /></Field><div style={S.formGrid}><Field label="Platform"><select value={pushForm.targetPlatform} onChange={(e) => setPushForm({ ...pushForm, targetPlatform: e.target.value })} style={S.input}><option value="all">All</option><option>android</option><option>ios</option><option>web</option></select></Field><Field label="Language"><select value={pushForm.targetLocale} onChange={(e) => setPushForm({ ...pushForm, targetLocale: e.target.value })} style={S.input}><option value="all">All</option><option>en</option><option>ar</option></select></Field></div><Field label="Schedule (blank = now)"><input type="datetime-local" value={pushForm.scheduledAt} onChange={(e) => setPushForm({ ...pushForm, scheduledAt: e.target.value })} style={S.input} /></Field><button style={S.primary}>Queue push</button></form></Card><Card title="Push history"><div style={S.scrollList}>{pushCampaigns.map((campaign) => <div key={campaign.public_id} style={S.contentRowStatic}><div><strong>{campaign.name}</strong><div style={S.mutedSmall}>{campaign.title_en} • {campaign.target_platform}/{campaign.target_locale} • {formatWhen(campaign.scheduled_at)}</div></div><Pill tone={campaign.status === "sent" ? "good" : campaign.status === "failed" ? "bad" : "warn"}>{campaign.status}</Pill></div>)}</div></Card></div> : null}

      {view === "email" ? <div style={S.twoCols}><Card title="Email campaign" subtitle="Send to verified Hassoun prayer-email subscribers"><form onSubmit={createEmail} style={S.form}><Field label="Campaign name"><input value={emailForm.name} onChange={(e) => setEmailForm({ ...emailForm, name: e.target.value })} style={S.input} /></Field><Field label="English subject"><input required value={emailForm.subjectEn} onChange={(e) => setEmailForm({ ...emailForm, subjectEn: e.target.value })} style={S.input} /></Field><Field label="English HTML"><textarea required value={emailForm.htmlEn} onChange={(e) => setEmailForm({ ...emailForm, htmlEn: e.target.value })} style={S.textareaTall} /></Field><Field label="Arabic subject"><input value={emailForm.subjectAr} onChange={(e) => setEmailForm({ ...emailForm, subjectAr: e.target.value })} style={S.input} /></Field><Field label="Arabic HTML"><textarea value={emailForm.htmlAr} onChange={(e) => setEmailForm({ ...emailForm, htmlAr: e.target.value })} style={S.textarea} /></Field><Field label="Schedule (blank = now)"><input type="datetime-local" value={emailForm.scheduledAt} onChange={(e) => setEmailForm({ ...emailForm, scheduledAt: e.target.value })} style={S.input} /></Field><button style={S.primary}>Queue email</button></form></Card><Card title="Email history"><div style={S.scrollList}>{emailCampaigns.map((campaign) => <div key={campaign.public_id} style={S.contentRowStatic}><div><strong>{campaign.name}</strong><div style={S.mutedSmall}>{campaign.subject_en} • {campaign.target_locale} • {formatWhen(campaign.scheduled_at)}</div></div><Pill tone={campaign.status === "sent" ? "good" : campaign.status === "failed" ? "bad" : "warn"}>{campaign.status}</Pill></div>)}</div></Card></div> : null}

      {view === "release" ? <Card title="Android & iOS Store Release" subtitle="One checklist for Google Play and App Store"><div style={S.releaseGrid}>{control.releaseChecks.map((check) => <div key={check.check_key} style={S.releaseRow}><div><div style={S.releasePlatform}>{check.platform.toUpperCase()}</div><strong>{check.label}</strong><div style={S.mutedSmall}>{check.details}</div></div><select value={check.status} onChange={(e) => void updateRelease(check, e.target.value)} style={S.statusSelect}><option value="pending">Pending</option><option value="pass">Pass</option><option value="fail">Fail</option><option value="not_applicable">N/A</option></select></div>)}</div></Card> : null}

      {view === "audit" ? <Card title="Admin audit log" subtitle="Who changed what and when"><div style={S.tableWrap}><table style={S.table}><thead><tr><th>When</th><th>Admin</th><th>Action</th><th>Entity</th><th>Details</th></tr></thead><tbody>{control.activity.map((row) => <tr key={row.id}><td>{formatWhen(row.created_at)}</td><td>{row.display_name || row.username || "System"}</td><td>{row.action}</td><td>{row.entity_type}<br /><span style={S.mutedSmall}>{row.entity_id}</span></td><td><code style={S.codeInline}>{row.details ? JSON.stringify(row.details) : "—"}</code></td></tr>)}</tbody></table></div></Card> : null}
    </section>
  </main>;
}

const S: Record<string, CSSProperties> = {
  page: { minHeight: "100vh", background: "#f5f6f2", color: "#173f35", fontFamily: "Inter, Arial, sans-serif", display: "grid", gridTemplateColumns: "250px 1fr" },
  sidebar: { position: "sticky", top: 0, height: "100vh", background: "#0b463a", color: "white", padding: "22px 16px", display: "flex", flexDirection: "column", gap: 18, boxSizing: "border-box" },
  sideBrand: { display: "flex", alignItems: "center", gap: 12, padding: "0 6px 14px", borderBottom: "1px solid rgba(255,255,255,.12)" },
  logoSmall: { width: 42, height: 42, borderRadius: 14, background: "#fff7e8", color: "#0b654f", display: "grid", placeItems: "center", fontWeight: 900, fontSize: 25 },
  nav: { display: "flex", flexDirection: "column", gap: 5, flex: 1, overflowY: "auto" }, navButton: { border: 0, background: "transparent", color: "#d8e8e2", borderRadius: 12, padding: "10px 12px", textAlign: "left", fontWeight: 750, cursor: "pointer", display: "flex", gap: 10, alignItems: "center" }, navActive: { background: "#fff7e8", color: "#173f35" }, navIcon: { width: 22, textAlign: "center" }, sideBottom: { borderTop: "1px solid rgba(255,255,255,.12)", paddingTop: 14, display: "grid", gap: 10 },
  main: { minWidth: 0, padding: "26px clamp(18px,3vw,44px) 70px" }, topbar: { display: "flex", justifyContent: "space-between", gap: 20, alignItems: "center", marginBottom: 20 }, topActions: { display: "flex", gap: 10, alignItems: "center" }, eyebrow: { fontSize: 11, letterSpacing: 1.8, fontWeight: 900, color: "#c59839" }, pageTitle: { margin: "4px 0 0", fontSize: 30 }, muted: { color: "#71807a", margin: "4px 0 0", lineHeight: 1.5 }, mutedSmall: { color: "#7a8782", fontSize: 12, marginTop: 3 },
  stats: { display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: 14, marginBottom: 16 }, stat: { background: "white", border: "1px solid #e0e5e0", borderRadius: 18, padding: 18 }, statValue: { fontSize: 28, fontWeight: 900 }, statLabel: { marginTop: 5, fontSize: 13, fontWeight: 800, color: "#66756f" }, statNote: { fontSize: 11, color: "#93a09b", marginTop: 2 },
  twoCols: { display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 16, alignItems: "start", marginBottom: 16 }, card: { background: "white", border: "1px solid #e0e5e0", borderRadius: 20, padding: 20, marginBottom: 16, minWidth: 0 }, cardHead: { display: "flex", justifyContent: "space-between", gap: 14, alignItems: "flex-start", marginBottom: 14 }, cardTitle: { margin: 0, fontSize: 18 },
  list: { display: "grid", gap: 0 }, listRow: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 14, padding: "11px 0", borderBottom: "1px solid #eef1ee", fontSize: 13 }, pill: { display: "inline-flex", alignItems: "center", borderRadius: 999, padding: "5px 9px", fontSize: 10, fontWeight: 900, letterSpacing: .4, whiteSpace: "nowrap" },
  toggleGrid: { display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 10 }, toggleRow: { display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", border: "1px solid #e3e8e4", borderRadius: 14, fontWeight: 750, fontSize: 13 }, toggle: { width: 42, height: 24, borderRadius: 15, border: 0, padding: 3, background: "#cfd7d3", cursor: "pointer" }, toggleOn: { background: "#0b654f" }, toggleDot: { display: "block", width: 18, height: 18, background: "white", borderRadius: 99, transition: ".15s", transform: "translateX(0)" }, toggleDotOn: { transform: "translateX(18px)" },
  form: { display: "grid", gap: 12 }, formGrid: { display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 12 }, field: { display: "grid", gap: 6 }, fieldLabel: { fontSize: 11, textTransform: "uppercase", letterSpacing: .8, fontWeight: 900, color: "#66756f" }, input: { width: "100%", boxSizing: "border-box", border: "1px solid #d9dfdb", borderRadius: 11, padding: "10px 11px", background: "#fff", color: "#173f35", font: "inherit" }, search: { border: "1px solid #d9dfdb", borderRadius: 10, padding: "8px 10px", minWidth: 220 }, textarea: { width: "100%", minHeight: 90, boxSizing: "border-box", border: "1px solid #d9dfdb", borderRadius: 11, padding: 11, font: "inherit", resize: "vertical" }, textareaTall: { width: "100%", minHeight: 150, boxSizing: "border-box", border: "1px solid #d9dfdb", borderRadius: 11, padding: 11, font: "inherit", resize: "vertical" }, codeArea: { width: "100%", minHeight: 190, boxSizing: "border-box", background: "#11211d", color: "#dcebe5", border: 0, borderRadius: 13, padding: 13, fontFamily: "ui-monospace,SFMono-Regular,monospace", fontSize: 12, resize: "vertical", marginBottom: 10 }, codeInline: { fontSize: 11, whiteSpace: "pre-wrap", overflowWrap: "anywhere" },
  primary: { border: 0, borderRadius: 12, padding: "11px 16px", background: "#0b654f", color: "white", fontWeight: 900, cursor: "pointer" }, primarySmall: { border: 0, borderRadius: 9, padding: "8px 11px", background: "#0b654f", color: "white", fontWeight: 850, cursor: "pointer" }, secondary: { border: "1px solid #d7dfda", borderRadius: 10, padding: "8px 11px", background: "white", color: "#173f35", fontWeight: 800, cursor: "pointer" }, secondaryLink: { border: "1px solid #d7dfda", borderRadius: 10, padding: "8px 11px", background: "white", color: "#173f35", fontWeight: 800, textDecoration: "none" }, dangerSmall: { border: "1px solid #efc2bd", borderRadius: 9, padding: "7px 10px", background: "#fff1ef", color: "#9a3028", fontWeight: 850, cursor: "pointer" }, warnSmall: { border: "1px solid #ecd599", borderRadius: 9, padding: "7px 10px", background: "#fff8e2", color: "#7b5d11", fontWeight: 850, cursor: "pointer" }, buttonRow: { display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 },
  scrollList: { maxHeight: 600, overflowY: "auto", display: "grid", gap: 7 }, contentRow: { width: "100%", border: "1px solid #e3e8e4", borderRadius: 12, padding: 11, background: "#fbfcfa", textAlign: "left", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, cursor: "pointer", color: "#173f35" }, contentRowStatic: { border: "1px solid #e3e8e4", borderRadius: 12, padding: 11, background: "#fbfcfa", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 },
  tableWrap: { width: "100%", overflowX: "auto" }, table: { width: "100%", borderCollapse: "collapse", fontSize: 12 },
  ticketGrid: { display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 12 }, ticket: { border: "1px solid #e3e8e4", borderRadius: 16, padding: 15, background: "#fcfdfb" }, ticketMessage: { whiteSpace: "pre-wrap", lineHeight: 1.55, color: "#40524b", fontSize: 13 }, ticketMeta: { color: "#83908b", fontSize: 11 },
  releaseGrid: { display: "grid", gap: 9 }, releaseRow: { display: "grid", gridTemplateColumns: "1fr 150px", alignItems: "center", gap: 18, borderBottom: "1px solid #eef1ee", padding: "12px 0" }, releasePlatform: { color: "#b27a23", fontWeight: 900, fontSize: 10, letterSpacing: 1 }, statusSelect: { border: "1px solid #d9dfdb", borderRadius: 10, padding: "8px 10px", background: "white" },
  errorBanner: { background: "#ffe5e2", color: "#8f2e27", border: "1px solid #f0c3bd", padding: "10px 13px", borderRadius: 12, marginBottom: 14, fontWeight: 750 }, successBanner: { background: "#e3f5ed", color: "#0b654f", border: "1px solid #c4e6d8", padding: "10px 13px", borderRadius: 12, marginBottom: 14, fontWeight: 750 },
  loginPage: { minHeight: "100vh", display: "grid", placeItems: "center", padding: 20, background: "linear-gradient(145deg,#f5f2e9,#e5f0eb)", fontFamily: "Inter,Arial,sans-serif" }, loginCard: { width: "min(440px,100%)", display: "grid", gap: 15, background: "white", border: "1px solid #dfe5e0", borderRadius: 24, padding: 28, boxShadow: "0 24px 70px rgba(22,55,46,.15)" }, logo: { width: 64, height: 64, borderRadius: 20, display: "grid", placeItems: "center", background: "#0b654f", color: "white", fontWeight: 900, fontSize: 36 }, loginTitle: { margin: "4px 0", fontSize: 30, color: "#173f35" }, error: { color: "#9a3028", fontWeight: 750 }
};
