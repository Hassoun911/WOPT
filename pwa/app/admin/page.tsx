"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

const API = "https://wopt-prayer-push.wopt-windsor.workers.dev";
const TOKEN_KEY = "wopt:admin-token:v1";

type Admin = {
  username: string;
  email: string;
  display_name?: string | null;
  role: string;
  must_change_password?: number;
};

type Dashboard = {
  subscribers?: Record<string, number>;
  devices?: Record<string, number>;
  emailOutbox?: Record<string, number>;
  pushCampaigns?: Record<string, number>;
  emailDeliveries?: Record<string, number>;
};

type Subscriber = {
  public_id: string;
  email: string;
  display_name?: string | null;
  status: string;
  city?: string | null;
  region?: string | null;
  country_name?: string | null;
  timezone: string;
  locale: string;
  verified_at?: string | null;
  linked_devices?: number;
};

type Campaign = {
  public_id: string;
  name: string;
  category: string;
  title_en: string;
  status: string;
  target_platform: string;
  target_locale: string;
  scheduled_at?: string | null;
  sent_at?: string | null;
  delivery_count?: number;
  sent_count?: number;
  failed_count?: number;
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

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div style={styles.stat}>
      <span style={styles.statValue}>{value}</span>
      <span style={styles.statLabel}>{label}</span>
    </div>
  );
}

function locationLabel(subscriber: Subscriber) {
  return [subscriber.city, subscriber.region, subscriber.country_name].filter(Boolean).join(", ") || subscriber.timezone;
}

export default function AdminPage() {
  const [token, setToken] = useState<string | null>(null);
  const [admin, setAdmin] = useState<Admin | null>(null);
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [dashboard, setDashboard] = useState<Dashboard>({});
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [view, setView] = useState<"dashboard" | "subscribers" | "push">("dashboard");

  const [pushName, setPushName] = useState("");
  const [titleEn, setTitleEn] = useState("");
  const [bodyEn, setBodyEn] = useState("");
  const [titleAr, setTitleAr] = useState("");
  const [bodyAr, setBodyAr] = useState("");
  const [category, setCategory] = useState("announcement");
  const [audience, setAudience] = useState("all_devices");
  const [platform, setPlatform] = useState("all");
  const [locale, setLocale] = useState("all");
  const [targetCountry, setTargetCountry] = useState("");
  const [targetCity, setTargetCity] = useState("");
  const [targetTimezone, setTargetTimezone] = useState("");
  const [scheduledLocal, setScheduledLocal] = useState("");
  const [pushResult, setPushResult] = useState("");

  const loadDashboard = useCallback(async (authToken: string) => {
    const data = await api<Dashboard & { admin?: Admin }>("/admin/dashboard", {}, authToken);
    setDashboard(data);
    if (data.admin) setAdmin(data.admin);
  }, []);

  const loadSubscribers = useCallback(async (authToken: string, q = search, subscriberStatus = status) => {
    const params = new URLSearchParams({ limit: "150" });
    if (q.trim()) params.set("q", q.trim());
    if (subscriberStatus) params.set("status", subscriberStatus);
    const data = await api<{ subscribers: Subscriber[] }>(`/admin/subscribers?${params}`, {}, authToken);
    setSubscribers(data.subscribers || []);
  }, [search, status]);

  const loadCampaigns = useCallback(async (authToken: string) => {
    const data = await api<{ campaigns: Campaign[] }>("/admin/push/campaigns", {}, authToken);
    setCampaigns(data.campaigns || []);
  }, []);

  useEffect(() => {
    const saved = window.localStorage.getItem(TOKEN_KEY);
    if (!saved) return;
    setToken(saved);
    void api<{ admin: Admin }>("/admin/me", {}, saved)
      .then((data) => {
        setAdmin(data.admin);
        return Promise.all([loadDashboard(saved), loadSubscribers(saved, "", ""), loadCampaigns(saved)]);
      })
      .catch(() => {
        window.localStorage.removeItem(TOKEN_KEY);
        setToken(null);
        setAdmin(null);
      });
  }, [loadCampaigns, loadDashboard, loadSubscribers]);

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
      await Promise.all([loadDashboard(data.token), loadSubscribers(data.token, "", ""), loadCampaigns(data.token)]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to sign in");
    } finally {
      setBusy(false);
    }
  };

  const signOut = async () => {
    if (token) void api("/admin/logout", { method: "POST" }, token).catch(() => undefined);
    window.localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setAdmin(null);
  };

  const refreshSubscribers = async () => {
    if (!token) return;
    setBusy(true);
    setError("");
    try {
      await loadSubscribers(token);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load subscribers");
    } finally {
      setBusy(false);
    }
  };

  const schedulePush = async (event: FormEvent) => {
    event.preventDefault();
    if (!token) return;
    setBusy(true);
    setError("");
    setPushResult("");
    try {
      const scheduledAt = scheduledLocal ? new Date(scheduledLocal).toISOString() : new Date().toISOString();
      const result = await api<{ publicId: string; status: string; scheduledAt: string }>("/admin/push/campaigns", {
        method: "POST",
        body: JSON.stringify({
          name: pushName || titleEn,
          titleEn,
          bodyEn,
          titleAr: titleAr || undefined,
          bodyAr: bodyAr || undefined,
          category,
          audience,
          targetPlatform: platform,
          targetLocale: locale,
          targetCountryCode: targetCountry || undefined,
          targetCity: targetCity || undefined,
          targetTimezone: targetTimezone || undefined,
          priority: "high",
          scheduledAt
        })
      }, token);
      setPushResult(scheduledLocal ? `Push scheduled for ${new Date(result.scheduledAt).toLocaleString()}.` : "Push queued for immediate delivery.");
      setPushName("");
      setTitleEn("");
      setBodyEn("");
      setTitleAr("");
      setBodyAr("");
      setScheduledLocal("");
      await Promise.all([loadCampaigns(token), loadDashboard(token)]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to schedule push");
    } finally {
      setBusy(false);
    }
  };

  const subscriberSummary = useMemo(() => dashboard.subscribers || {}, [dashboard]);
  const deviceSummary = useMemo(() => dashboard.devices || {}, [dashboard]);

  if (!token || !admin) {
    return (
      <main style={styles.loginPage}>
        <form onSubmit={signIn} style={styles.loginCard}>
          <div style={styles.brand}>و</div>
          <div>
            <p style={styles.eyebrow}>WOPT ADMIN</p>
            <h1 style={styles.loginTitle}>Windsor Prayer Times CMS</h1>
            <p style={styles.muted}>Admin access only. Public subscribers never need an account or password.</p>
          </div>
          <label style={styles.label}>Username or email</label>
          <input value={login} onChange={(event) => setLogin(event.target.value)} autoComplete="username" style={styles.input} />
          <label style={styles.label}>Password</label>
          <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" autoComplete="current-password" style={styles.input} />
          {error ? <p style={styles.error}>{error}</p> : null}
          <button disabled={busy || !login || !password} style={styles.primaryButton}>{busy ? "Signing in…" : "Sign in"}</button>
          <a href="../" style={styles.backLink}>← Back to Windsor Prayer Times</a>
        </form>
      </main>
    );
  }

  return (
    <main style={styles.page}>
      <header style={styles.header}>
        <div style={styles.headerBrand}>
          <div style={styles.brandSmall}>و</div>
          <div><p style={styles.eyebrow}>WOPT ADMIN</p><strong>Control Center</strong></div>
        </div>
        <div style={styles.headerRight}><span style={styles.muted}>{admin.display_name || admin.username} • {admin.role}</span><button onClick={signOut} style={styles.secondaryButton}>Sign out</button></div>
      </header>

      <nav style={styles.nav}>
        {(["dashboard", "subscribers", "push"] as const).map((item) => (
          <button key={item} onClick={() => setView(item)} style={{ ...styles.navButton, ...(view === item ? styles.navButtonActive : {}) }}>
            {item === "dashboard" ? "Dashboard" : item === "subscribers" ? "Email subscribers" : "Push notifications"}
          </button>
        ))}
      </nav>

      {error ? <div style={styles.errorBanner}>{error}</div> : null}

      {view === "dashboard" ? (
        <section>
          <div style={styles.titleRow}><div><p style={styles.eyebrow}>OVERVIEW</p><h1 style={styles.title}>WOPT at a glance</h1></div><button onClick={() => token && void loadDashboard(token)} style={styles.secondaryButton}>Refresh</button></div>
          <div style={styles.statsGrid}>
            <Stat label="Active email subscribers" value={subscriberSummary.active || 0} />
            <Stat label="Pending verification" value={subscriberSummary.pending || 0} />
            <Stat label="Active push devices" value={deviceSummary.active || 0} />
            <Stat label="Android devices" value={deviceSummary.android || 0} />
            <Stat label="Web devices" value={deviceSummary.web || 0} />
            <Stat label="Scheduled pushes" value={dashboard.pushCampaigns?.scheduled || 0} />
            <Stat label="Pending emails" value={dashboard.emailOutbox?.pending || 0} />
            <Stat label="Email delivery failures" value={dashboard.emailDeliveries?.failed || 0} />
          </div>
          <div style={styles.panel}>
            <h2 style={styles.panelTitle}>System separation</h2>
            <p style={styles.muted}>Native Adhan alarms remain device-local. Windsor prayer pushes, worldwide subscriber emails, and admin broadcasts run as separate delivery streams.</p>
          </div>
        </section>
      ) : null}

      {view === "subscribers" ? (
        <section>
          <div style={styles.titleRow}><div><p style={styles.eyebrow}>EMAIL</p><h1 style={styles.title}>Subscribers</h1></div></div>
          <div style={styles.filters}>
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search email, city or country" style={{ ...styles.input, flex: 1 }} />
            <select value={status} onChange={(event) => setStatus(event.target.value)} style={styles.select}>
              <option value="">All statuses</option><option value="active">Active</option><option value="pending">Pending</option><option value="unsubscribed">Unsubscribed</option><option value="disabled">Disabled</option>
            </select>
            <button onClick={() => void refreshSubscribers()} disabled={busy} style={styles.primarySmall}>Search</button>
          </div>
          <div style={styles.tableWrap}>
            <table style={styles.table}><thead><tr><th style={styles.th}>Email</th><th style={styles.th}>Location</th><th style={styles.th}>Time zone</th><th style={styles.th}>Status</th><th style={styles.th}>Devices</th></tr></thead>
              <tbody>{subscribers.map((subscriber) => (
                <tr key={subscriber.public_id}><td style={styles.td}><strong>{subscriber.email}</strong><div style={styles.subtle}>{subscriber.locale.toUpperCase()}</div></td><td style={styles.td}>{locationLabel(subscriber)}</td><td style={styles.td}>{subscriber.timezone}</td><td style={styles.td}><span style={styles.badge}>{subscriber.status}</span></td><td style={styles.td}>{subscriber.linked_devices || 0}</td></tr>
              ))}</tbody>
            </table>
            {!subscribers.length ? <p style={{ ...styles.muted, padding: 20 }}>No subscribers match this search.</p> : null}
          </div>
        </section>
      ) : null}

      {view === "push" ? (
        <section>
          <div style={styles.titleRow}><div><p style={styles.eyebrow}>ADMIN PUSH</p><h1 style={styles.title}>Compose notification</h1></div></div>
          <div style={styles.pushGrid}>
            <form onSubmit={schedulePush} style={styles.panel}>
              <div style={styles.twoCols}><div><label style={styles.label}>Campaign name</label><input value={pushName} onChange={(e) => setPushName(e.target.value)} style={styles.input} /></div><div><label style={styles.label}>Category</label><select value={category} onChange={(e) => setCategory(e.target.value)} style={styles.selectFull}><option value="announcement">Announcement</option><option value="religious_occasion">Religious occasion</option><option value="community_event">Community event</option><option value="daily_content">Daily content</option><option value="marketing">Marketing</option><option value="system">System</option></select></div></div>
              <label style={styles.label}>English title</label><input value={titleEn} onChange={(e) => setTitleEn(e.target.value)} maxLength={120} style={styles.input} required />
              <label style={styles.label}>English message</label><textarea value={bodyEn} onChange={(e) => setBodyEn(e.target.value)} maxLength={500} rows={4} style={styles.textarea} required />
              <div style={styles.twoCols}><div><label style={styles.label}>Arabic title (optional)</label><input value={titleAr} onChange={(e) => setTitleAr(e.target.value)} dir="rtl" style={styles.input} /></div><div><label style={styles.label}>Arabic message (optional)</label><textarea value={bodyAr} onChange={(e) => setBodyAr(e.target.value)} dir="rtl" rows={3} style={styles.textarea} /></div></div>
              <div style={styles.threeCols}><div><label style={styles.label}>Audience</label><select value={audience} onChange={(e) => setAudience(e.target.value)} style={styles.selectFull}><option value="all_devices">All devices</option><option value="linked_subscribers">Email subscribers with device</option><option value="anonymous_devices">Anonymous devices</option><option value="custom">Custom filters</option></select></div><div><label style={styles.label}>Platform</label><select value={platform} onChange={(e) => setPlatform(e.target.value)} style={styles.selectFull}><option value="all">All</option><option value="android">Android</option><option value="ios">iOS</option><option value="web">Web</option></select></div><div><label style={styles.label}>Language</label><select value={locale} onChange={(e) => setLocale(e.target.value)} style={styles.selectFull}><option value="all">All</option><option value="en">English</option><option value="ar">Arabic</option></select></div></div>
              <div style={styles.threeCols}><div><label style={styles.label}>Country code (optional)</label><input value={targetCountry} onChange={(e) => setTargetCountry(e.target.value.toUpperCase())} placeholder="CA" maxLength={2} style={styles.input} /></div><div><label style={styles.label}>City (optional)</label><input value={targetCity} onChange={(e) => setTargetCity(e.target.value)} placeholder="Windsor" style={styles.input} /></div><div><label style={styles.label}>Time zone (optional)</label><input value={targetTimezone} onChange={(e) => setTargetTimezone(e.target.value)} placeholder="America/Toronto" style={styles.input} /></div></div>
              <label style={styles.label}>Schedule (leave blank to send now)</label><input value={scheduledLocal} onChange={(e) => setScheduledLocal(e.target.value)} type="datetime-local" style={styles.input} />
              {pushResult ? <p style={styles.success}>{pushResult}</p> : null}
              <button disabled={busy || !titleEn || !bodyEn} style={styles.primaryButton}>{busy ? "Saving…" : scheduledLocal ? "Schedule push" : "Send push now"}</button>
            </form>
            <div style={styles.panel}><h2 style={styles.panelTitle}>Recent campaigns</h2><div style={styles.campaignList}>{campaigns.map((campaign) => <div key={campaign.public_id} style={styles.campaign}><div><strong>{campaign.name}</strong><div style={styles.subtle}>{campaign.category} • {campaign.target_platform} • {campaign.target_locale}</div></div><div style={{ textAlign: "right" }}><span style={styles.badge}>{campaign.status}</span><div style={styles.subtle}>{campaign.sent_count || 0} sent • {campaign.failed_count || 0} failed</div></div></div>)}</div></div>
          </div>
        </section>
      ) : null}
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  loginPage: { minHeight: "100vh", background: "#f4f2e9", display: "grid", placeItems: "center", padding: 20, color: "#173f35" },
  loginCard: { width: "min(460px, 100%)", background: "white", border: "1px solid #d8e0dc", borderRadius: 28, padding: 30, boxShadow: "0 20px 60px rgba(17,61,49,.10)", display: "grid", gap: 12 },
  brand: { width: 56, height: 56, borderRadius: 18, display: "grid", placeItems: "center", background: "#0b5b47", color: "white", fontSize: 30, fontWeight: 900 },
  brandSmall: { width: 42, height: 42, borderRadius: 13, display: "grid", placeItems: "center", background: "#0b5b47", color: "white", fontSize: 23, fontWeight: 900 },
  loginTitle: { margin: "5px 0 5px", fontSize: 27 }, eyebrow: { margin: 0, color: "#17705b", fontSize: 11, fontWeight: 900, letterSpacing: 2 }, muted: { color: "#6d7f79", lineHeight: 1.55 },
  label: { display: "block", color: "#355c52", fontSize: 12, fontWeight: 800, marginTop: 9, marginBottom: 5 }, input: { width: "100%", minHeight: 44, border: "1px solid #cbd8d3", borderRadius: 12, padding: "10px 12px", background: "#fbfcfa", color: "#173f35", fontSize: 14 }, textarea: { width: "100%", border: "1px solid #cbd8d3", borderRadius: 12, padding: "11px 12px", background: "#fbfcfa", color: "#173f35", fontSize: 14, resize: "vertical" },
  select: { minHeight: 44, border: "1px solid #cbd8d3", borderRadius: 12, padding: "0 12px", background: "white", color: "#173f35" }, selectFull: { width: "100%", minHeight: 44, border: "1px solid #cbd8d3", borderRadius: 12, padding: "0 12px", background: "white", color: "#173f35" },
  primaryButton: { marginTop: 8, minHeight: 48, border: 0, borderRadius: 13, padding: "0 18px", background: "#0b5b47", color: "white", fontWeight: 900, cursor: "pointer" }, primarySmall: { minHeight: 44, border: 0, borderRadius: 12, padding: "0 17px", background: "#0b5b47", color: "white", fontWeight: 900, cursor: "pointer" }, secondaryButton: { border: "1px solid #cbd8d3", borderRadius: 11, padding: "9px 13px", background: "white", color: "#0b5b47", fontWeight: 800, cursor: "pointer" },
  backLink: { color: "#0b5b47", textDecoration: "none", fontSize: 13, fontWeight: 700, textAlign: "center", marginTop: 5 }, error: { color: "#a23c32", background: "#fff1ee", borderRadius: 10, padding: 10, fontSize: 13 }, errorBanner: { color: "#8d342d", background: "#fff1ee", border: "1px solid #f1c8c4", borderRadius: 12, padding: 12, marginBottom: 15 }, success: { color: "#0b6f52", background: "#edf9f4", borderRadius: 10, padding: 10, fontSize: 13 },
  page: { minHeight: "100vh", background: "#f4f2e9", color: "#173f35", padding: "0 24px 50px", fontFamily: "system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif" }, header: { minHeight: 76, maxWidth: 1250, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20, borderBottom: "1px solid #d8e0dc" }, headerBrand: { display: "flex", alignItems: "center", gap: 11 }, headerRight: { display: "flex", alignItems: "center", gap: 12 },
  nav: { maxWidth: 1250, margin: "18px auto 24px", display: "flex", gap: 8, flexWrap: "wrap" }, navButton: { border: "1px solid #ccd8d3", background: "white", color: "#49675f", borderRadius: 99, padding: "10px 15px", fontWeight: 800, cursor: "pointer" }, navButtonActive: { background: "#0b5b47", color: "white", borderColor: "#0b5b47" },
  titleRow: { maxWidth: 1250, margin: "0 auto 18px", display: "flex", alignItems: "end", justifyContent: "space-between" }, title: { fontSize: 33, margin: "5px 0 0" }, statsGrid: { maxWidth: 1250, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 12 }, stat: { background: "white", border: "1px solid #d8e0dc", borderRadius: 18, padding: 19, display: "grid", gap: 4 }, statValue: { fontSize: 29, fontWeight: 900 }, statLabel: { color: "#6d7f79", fontSize: 12, fontWeight: 700 },
  panel: { maxWidth: 1250, margin: "16px auto 0", background: "white", border: "1px solid #d8e0dc", borderRadius: 20, padding: 20 }, panelTitle: { margin: "0 0 8px", fontSize: 19 }, filters: { maxWidth: 1250, margin: "0 auto 14px", display: "flex", gap: 9, flexWrap: "wrap" }, tableWrap: { maxWidth: 1250, margin: "0 auto", overflowX: "auto", background: "white", border: "1px solid #d8e0dc", borderRadius: 18 }, table: { width: "100%", borderCollapse: "collapse", minWidth: 780 }, th: { textAlign: "left", padding: "13px 15px", borderBottom: "1px solid #dce4e0", fontSize: 11, color: "#6d7f79", letterSpacing: 1, textTransform: "uppercase" }, td: { padding: "13px 15px", borderBottom: "1px solid #edf1ef", fontSize: 13, verticalAlign: "top" }, subtle: { color: "#80908b", fontSize: 11, marginTop: 3 }, badge: { display: "inline-block", borderRadius: 99, padding: "4px 8px", background: "#e8f3ef", color: "#0b6f52", fontSize: 11, fontWeight: 900 },
  pushGrid: { maxWidth: 1250, margin: "0 auto", display: "grid", gridTemplateColumns: "minmax(0,1.35fr) minmax(300px,.65fr)", gap: 16, alignItems: "start" }, twoCols: { display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 12 }, threeCols: { display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 12 }, campaignList: { display: "grid", gap: 9 }, campaign: { display: "flex", justifyContent: "space-between", gap: 12, padding: "12px 0", borderBottom: "1px solid #edf1ef" }
};
