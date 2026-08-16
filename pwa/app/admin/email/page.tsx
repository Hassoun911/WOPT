"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";

const API = "https://wopt-prayer-push.wopt-windsor.workers.dev";
const TOKEN_KEY = "wopt:admin-token:v1";

type Admin = { username: string; display_name?: string | null; role: string };
type EmailCampaign = {
  public_id: string;
  name: string;
  category: string;
  subject_en: string;
  status: string;
  target_locale: string;
  target_country_code?: string | null;
  target_city?: string | null;
  target_timezone?: string | null;
  scheduled_at?: string | null;
  sent_at?: string | null;
  sent_count?: number;
  failed_count?: number;
  pending_count?: number;
};

async function api<T>(path: string, init: RequestInit = {}, token?: string | null): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(`${API}${path}`, { ...init, headers });
  const payload = await response.json().catch(() => ({})) as T & { error?: string };
  if (!response.ok) throw new Error(payload.error || `Request failed (${response.status})`);
  return payload;
}

export default function AdminEmailPage() {
  const [token, setToken] = useState<string | null>(null);
  const [admin, setAdmin] = useState<Admin | null>(null);
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState("");
  const [campaigns, setCampaigns] = useState<EmailCampaign[]>([]);

  const [name, setName] = useState("");
  const [category, setCategory] = useState("announcement");
  const [subjectEn, setSubjectEn] = useState("");
  const [messageEn, setMessageEn] = useState("");
  const [subjectAr, setSubjectAr] = useState("");
  const [messageAr, setMessageAr] = useState("");
  const [locale, setLocale] = useState("all");
  const [country, setCountry] = useState("");
  const [city, setCity] = useState("");
  const [timezone, setTimezone] = useState("");
  const [scheduledLocal, setScheduledLocal] = useState("");

  const loadCampaigns = useCallback(async (authToken: string) => {
    const data = await api<{ campaigns: EmailCampaign[] }>("/admin/email/campaigns", {}, authToken);
    setCampaigns(data.campaigns || []);
  }, []);

  useEffect(() => {
    const saved = window.localStorage.getItem(TOKEN_KEY);
    if (!saved) return;
    setToken(saved);
    void api<{ admin: Admin }>("/admin/me", {}, saved)
      .then((data) => {
        setAdmin(data.admin);
        return loadCampaigns(saved);
      })
      .catch(() => {
        window.localStorage.removeItem(TOKEN_KEY);
        setToken(null);
        setAdmin(null);
      });
  }, [loadCampaigns]);

  const signIn = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const data = await api<{ token: string; admin: Admin }>("/admin/login", {
        method: "POST",
        body: JSON.stringify({ login, password })
      });
      window.localStorage.setItem(TOKEN_KEY, data.token);
      setToken(data.token);
      setAdmin(data.admin);
      setPassword("");
      await loadCampaigns(data.token);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to sign in");
    } finally {
      setBusy(false);
    }
  };

  const schedule = async (event: FormEvent) => {
    event.preventDefault();
    if (!token) return;
    setBusy(true);
    setError("");
    setResult("");
    try {
      const scheduledAt = scheduledLocal ? new Date(scheduledLocal).toISOString() : new Date().toISOString();
      const payload = await api<{ scheduledAt: string }>("/admin/email/campaigns", {
        method: "POST",
        body: JSON.stringify({
          name: name || subjectEn,
          category,
          subjectEn,
          htmlEn: `<div style="font-family:Arial,sans-serif;line-height:1.65;color:#173f35"><p>${messageEn.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br>")}</p><p><a href="{{manageUrl}}">Manage email alerts</a></p></div>`,
          textEn: `${messageEn}\n\nManage email alerts: {{manageUrl}}`,
          subjectAr: subjectAr || undefined,
          htmlAr: messageAr ? `<div dir="rtl" style="font-family:Arial,sans-serif;line-height:1.8;color:#173f35"><p>${messageAr.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br>")}</p><p><a href="{{manageUrl}}">إدارة تنبيهات البريد</a></p></div>` : undefined,
          textAr: messageAr ? `${messageAr}\n\nإدارة التنبيهات: {{manageUrl}}` : undefined,
          audience: "all_subscribers",
          targetLocale: locale,
          targetCountryCode: country || undefined,
          targetCity: city || undefined,
          targetTimezone: timezone || undefined,
          scheduledAt
        })
      }, token);
      setResult(scheduledLocal ? `Email campaign scheduled for ${new Date(payload.scheduledAt).toLocaleString()}.` : "Email campaign queued for immediate delivery.");
      setName(""); setSubjectEn(""); setMessageEn(""); setSubjectAr(""); setMessageAr(""); setScheduledLocal("");
      await loadCampaigns(token);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to create campaign");
    } finally {
      setBusy(false);
    }
  };

  if (!token || !admin) {
    return <main style={s.page}><form onSubmit={signIn} style={s.login}><p style={s.eyebrow}>WOPT ADMIN</p><h1 style={s.h1}>Email Campaigns</h1><p style={s.muted}>Admin access only.</p><label style={s.label}>Username or email</label><input value={login} onChange={(e) => setLogin(e.target.value)} style={s.input} /><label style={s.label}>Password</label><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} style={s.input} />{error ? <p style={s.error}>{error}</p> : null}<button style={s.primary} disabled={busy || !login || !password}>{busy ? "Signing in…" : "Sign in"}</button><a href="../" style={s.link}>← Main admin dashboard</a></form></main>;
  }

  return (
    <main style={s.page}>
      <header style={s.header}><div><p style={s.eyebrow}>WOPT ADMIN</p><h1 style={{ margin: 0 }}>Email Campaigns</h1></div><div style={s.headerActions}><span style={s.muted}>{admin.display_name || admin.username}</span><a href="../" style={s.secondary}>Dashboard</a></div></header>
      {error ? <div style={s.error}>{error}</div> : null}
      <div style={s.grid}>
        <form onSubmit={schedule} style={s.card}>
          <h2 style={s.h2}>Compose email</h2>
          <div style={s.two}><div><label style={s.label}>Campaign name</label><input value={name} onChange={(e) => setName(e.target.value)} style={s.input} /></div><div><label style={s.label}>Category</label><select value={category} onChange={(e) => setCategory(e.target.value)} style={s.input}><option value="announcement">Announcement</option><option value="religious_occasion">Religious occasion</option><option value="community_event">Community event</option><option value="daily_content">Daily content</option><option value="marketing">Marketing</option><option value="system">System</option></select></div></div>
          <label style={s.label}>English subject</label><input value={subjectEn} onChange={(e) => setSubjectEn(e.target.value)} maxLength={180} style={s.input} required />
          <label style={s.label}>English message</label><textarea value={messageEn} onChange={(e) => setMessageEn(e.target.value)} rows={6} style={s.textarea} required />
          <label style={s.label}>Arabic subject (optional)</label><input value={subjectAr} onChange={(e) => setSubjectAr(e.target.value)} dir="rtl" style={s.input} />
          <label style={s.label}>Arabic message (optional)</label><textarea value={messageAr} onChange={(e) => setMessageAr(e.target.value)} dir="rtl" rows={5} style={s.textarea} />
          <div style={s.three}><div><label style={s.label}>Language target</label><select value={locale} onChange={(e) => setLocale(e.target.value)} style={s.input}><option value="all">All</option><option value="en">English</option><option value="ar">Arabic</option></select></div><div><label style={s.label}>Country code</label><input value={country} onChange={(e) => setCountry(e.target.value.toUpperCase())} maxLength={2} placeholder="Optional" style={s.input} /></div><div><label style={s.label}>City</label><input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Optional" style={s.input} /></div></div>
          <label style={s.label}>Time zone filter (optional)</label><input value={timezone} onChange={(e) => setTimezone(e.target.value)} placeholder="America/Toronto" style={s.input} />
          <label style={s.label}>Schedule (blank = send now)</label><input type="datetime-local" value={scheduledLocal} onChange={(e) => setScheduledLocal(e.target.value)} style={s.input} />
          {result ? <p style={s.success}>{result}</p> : null}
          <button disabled={busy || !subjectEn || !messageEn} style={s.primary}>{busy ? "Saving…" : scheduledLocal ? "Schedule email" : "Send email now"}</button>
        </form>

        <section style={s.card}><div style={s.titleRow}><h2 style={s.h2}>Recent campaigns</h2><button onClick={() => token && void loadCampaigns(token)} style={s.secondaryButton}>Refresh</button></div><div>{campaigns.map((campaign) => <div key={campaign.public_id} style={s.campaign}><div><strong>{campaign.name}</strong><div style={s.small}>{campaign.subject_en}</div><div style={s.small}>{campaign.category} • {campaign.target_locale}{campaign.target_city ? ` • ${campaign.target_city}` : ""}</div></div><div style={{ textAlign: "right" }}><span style={s.badge}>{campaign.status}</span><div style={s.small}>{campaign.sent_count || 0} sent • {campaign.pending_count || 0} pending • {campaign.failed_count || 0} failed</div></div></div>)}</div>{!campaigns.length ? <p style={s.muted}>No email campaigns yet.</p> : null}</section>
      </div>
    </main>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: { minHeight: "100vh", background: "#f4f2e9", color: "#173f35", padding: 24, fontFamily: "system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif" },
  header: { maxWidth: 1220, margin: "0 auto 22px", minHeight: 70, display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #d7dfda" }, headerActions: { display: "flex", alignItems: "center", gap: 12 }, eyebrow: { color: "#17705b", fontWeight: 900, letterSpacing: 2, fontSize: 11, margin: 0 }, h1: { fontSize: 29, margin: "5px 0" }, h2: { margin: 0, fontSize: 20 }, muted: { color: "#71837d", fontSize: 13, lineHeight: 1.5 },
  login: { width: "min(440px,100%)", margin: "12vh auto", background: "white", border: "1px solid #d7dfda", borderRadius: 24, padding: 26, display: "grid", gap: 10 }, grid: { maxWidth: 1220, margin: "0 auto", display: "grid", gridTemplateColumns: "minmax(0,1.2fr) minmax(330px,.8fr)", gap: 16, alignItems: "start" }, card: { background: "white", border: "1px solid #d7dfda", borderRadius: 20, padding: 20 },
  label: { display: "block", color: "#355c52", fontSize: 12, fontWeight: 800, marginTop: 12, marginBottom: 5 }, input: { width: "100%", minHeight: 44, border: "1px solid #cbd8d3", borderRadius: 12, padding: "10px 12px", background: "#fbfcfa", color: "#173f35", fontSize: 14 }, textarea: { width: "100%", border: "1px solid #cbd8d3", borderRadius: 12, padding: 12, background: "#fbfcfa", color: "#173f35", fontSize: 14, resize: "vertical" }, two: { display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 12 }, three: { display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 12 },
  primary: { width: "100%", minHeight: 48, marginTop: 16, border: 0, borderRadius: 13, background: "#0b5b47", color: "white", fontWeight: 900, cursor: "pointer" }, secondary: { display: "inline-block", textDecoration: "none", border: "1px solid #cbd8d3", borderRadius: 11, padding: "9px 13px", background: "white", color: "#0b5b47", fontWeight: 800 }, secondaryButton: { border: "1px solid #cbd8d3", borderRadius: 10, padding: "8px 11px", background: "white", color: "#0b5b47", fontWeight: 800, cursor: "pointer" }, link: { textAlign: "center", color: "#0b5b47", fontWeight: 800, textDecoration: "none", marginTop: 6 }, error: { maxWidth: 1220, margin: "0 auto 12px", background: "#fff0ed", color: "#923a32", borderRadius: 12, padding: 12 }, success: { background: "#ecf9f3", color: "#0b6f52", borderRadius: 10, padding: 10, fontSize: 13 }, titleRow: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }, campaign: { display: "flex", justifyContent: "space-between", gap: 12, padding: "12px 0", borderBottom: "1px solid #edf1ef" }, small: { color: "#80908b", fontSize: 11, marginTop: 3 }, badge: { display: "inline-block", borderRadius: 99, padding: "4px 8px", background: "#e8f3ef", color: "#0b6f52", fontSize: 11, fontWeight: 900 }
};
