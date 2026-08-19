"use client";

import { FormEvent, useEffect, useState } from "react";

const API = "https://wopt-prayer-push.wopt-windsor.workers.dev";
const TOKEN_KEY = "wopt:admin-token:v1";

type Admin = { username: string; display_name?: string | null; role: string };

async function api<T>(path: string, init: RequestInit = {}, token?: string | null): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body) headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(`${API}${path}`, { ...init, headers });
  const payload = await response.json().catch(() => ({})) as T & { error?: string };
  if (!response.ok) throw new Error(payload.error || `Request failed (${response.status})`);
  return payload;
}

export default function AdminTeamCreatePage() {
  const [token, setToken] = useState<string | null>(null);
  const [admin, setAdmin] = useState<Admin | null>(null);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [temporaryPassword, setTemporaryPassword] = useState("");
  const [role, setRole] = useState("admin");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const saved = window.localStorage.getItem(TOKEN_KEY);
    if (!saved) return;
    setToken(saved);
    void api<{ admin: Admin }>("/admin/me", {}, saved).then((x) => setAdmin(x.admin)).catch(() => setAdmin(null));
  }, []);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!token) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const result = await api<{ username: string; role: string }>("/admin/team", {
        method: "POST",
        body: JSON.stringify({ username, email, displayName, temporaryPassword, role })
      }, token);
      setNotice(`${result.role} ${result.username} created. They must change the temporary password after signing in.`);
      setUsername(""); setEmail(""); setDisplayName(""); setTemporaryPassword(""); setRole("admin");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to create admin");
    } finally { setBusy(false); }
  };

  if (!token || !admin) return <main style={styles.page}><div style={styles.card}><h1>Admin Team</h1><p>Sign in from the Admin CRM first.</p><a href="../" style={styles.link}>Go to Admin CRM</a></div></main>;
  if (admin.role !== "owner") return <main style={styles.page}><div style={styles.card}><h1>Owner access required</h1><p>Only the Hassoun owner can create new admin accounts.</p><a href="../" style={styles.link}>Back to CRM</a></div></main>;

  return <main style={styles.page}><form onSubmit={submit} style={styles.card}>
    <p style={styles.eyebrow}>SECURITY & ACCESS</p><h1 style={styles.title}>Create admin account</h1><p style={styles.muted}>Create an admin or editor. The temporary password must be changed after first sign-in.</p>
    <label style={styles.label}>Display name</label><input style={styles.input} value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
    <label style={styles.label}>Username</label><input required style={styles.input} value={username} onChange={(e) => setUsername(e.target.value)} autoCapitalize="none" />
    <label style={styles.label}>Email</label><input required type="email" style={styles.input} value={email} onChange={(e) => setEmail(e.target.value)} />
    <label style={styles.label}>Role</label><select style={styles.input} value={role} onChange={(e) => setRole(e.target.value)}><option value="admin">Admin — manage operations</option><option value="editor">Editor — content-focused access</option></select>
    <label style={styles.label}>Temporary password</label><input required minLength={10} type="password" style={styles.input} value={temporaryPassword} onChange={(e) => setTemporaryPassword(e.target.value)} autoComplete="new-password" />
    {error ? <div style={styles.error}>{error}</div> : null}{notice ? <div style={styles.success}>{notice}</div> : null}
    <button disabled={busy} style={styles.button}>{busy ? "Creating…" : "Create account"}</button><a href="../" style={styles.link}>← Back to CRM</a>
  </form></main>;
}

const styles: Record<string, React.CSSProperties> = {
  page: { minHeight: "100vh", display: "grid", placeItems: "center", background: "#f3f7f5", padding: 24, fontFamily: "Inter,system-ui,sans-serif", color: "#18332c" },
  card: { width: "min(600px,100%)", boxSizing: "border-box", background: "white", border: "1px solid #dce7e2", borderRadius: 22, padding: 28, boxShadow: "0 18px 55px rgba(15,70,55,.09)" },
  eyebrow: { margin: 0, color: "#0b8062", fontSize: 11, letterSpacing: 1.4, fontWeight: 900 }, title: { margin: "5px 0 8px", fontSize: 30 }, muted: { color: "#6d7e79", fontSize: 14, lineHeight: 1.5 },
  label: { display: "block", fontWeight: 800, fontSize: 12, margin: "14px 0 6px" }, input: { width: "100%", boxSizing: "border-box", border: "1px solid #cad8d3", borderRadius: 11, padding: "11px 12px", fontSize: 14, background: "white" },
  button: { width: "100%", border: 0, borderRadius: 11, padding: "12px 16px", marginTop: 18, background: "#0b5b47", color: "white", fontWeight: 850, cursor: "pointer" }, link: { display: "inline-block", marginTop: 16, color: "#0b6c55", fontWeight: 750, textDecoration: "none" },
  error: { marginTop: 12, borderRadius: 10, padding: 11, background: "#fdecec", color: "#9c2626" }, success: { marginTop: 12, borderRadius: 10, padding: 11, background: "#e9f7ef", color: "#17633d" }
};
