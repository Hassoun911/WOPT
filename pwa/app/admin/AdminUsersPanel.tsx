"use client";

import { useCallback, useEffect, useState } from "react";

type AdminUser = {
  public_id: string;
  username: string;
  email: string;
  display_name?: string | null;
  role: "owner" | "admin" | "editor";
  status: "active" | "disabled";
  must_change_password: number;
  created_at: string;
  last_signed_in_at?: string | null;
  active_sessions?: number;
};

const API = "https://wopt-prayer-push.wopt-windsor.workers.dev";

async function request<T>(path: string, token: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  if (init.body) headers.set("Content-Type", "application/json");
  const response = await fetch(`${API}${path}`, { ...init, headers });
  const payload = await response.json().catch(() => ({})) as T & { error?: string };
  if (!response.ok) throw new Error(payload.error || `Request failed (${response.status})`);
  return payload;
}

export default function AdminUsersPanel({ token }: { token: string }) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ username: "", email: "", displayName: "", role: "editor", password: "" });
  const [reset, setReset] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setError("");
    try {
      const data = await request<{ users: AdminUser[] }>("/admin/users", token);
      setUsers(data.users || []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load administrators");
    }
  }, [token]);

  useEffect(() => { void load(); }, [load]);

  const run = async (fn: () => Promise<void>, success: string) => {
    setBusy(true); setError(""); setMessage("");
    try { await fn(); setMessage(success); await load(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Request failed"); }
    finally { setBusy(false); }
  };

  const create = async () => {
    await run(async () => {
      await request("/admin/users", token, { method: "POST", body: JSON.stringify(form) });
      setForm({ username: "", email: "", displayName: "", role: "editor", password: "" });
    }, "Administrator created. They must change the temporary password after signing in.");
  };

  const update = async (user: AdminUser, patch: Partial<AdminUser>) => {
    await run(() => request("/admin/users", token, { method: "PATCH", body: JSON.stringify({ publicId: user.public_id, role: patch.role ?? user.role, status: patch.status ?? user.status, email: patch.email ?? user.email, displayName: patch.display_name ?? user.display_name }) }).then(() => undefined), "Administrator updated.");
  };

  const resetPassword = async (user: AdminUser) => {
    const password = reset[user.public_id] || "";
    if (password.length < 12) { setError("Temporary password must be at least 12 characters."); return; }
    await run(() => request("/admin/users/password", token, { method: "POST", body: JSON.stringify({ publicId: user.public_id, password }) }).then(() => undefined), "Password reset and active sessions revoked.");
    setReset((old) => ({ ...old, [user.public_id]: "" }));
  };

  const revoke = async (user: AdminUser) => {
    await run(() => request("/admin/users/revoke-sessions", token, { method: "POST", body: JSON.stringify({ publicId: user.public_id }) }).then(() => undefined), "Administrator sessions revoked.");
  };

  return <div style={styles.wrap}>
    {error ? <div style={styles.error}>{error}</div> : null}
    {message ? <div style={styles.success}>{message}</div> : null}

    <section style={styles.card}>
      <div style={styles.head}><div><h3 style={styles.title}>Create administrator</h3><p style={styles.muted}>Owner-only. New administrators receive a temporary password and must replace it.</p></div><span style={styles.owner}>OWNER CONTROL</span></div>
      <div style={styles.grid}>
        <label style={styles.field}><span>Username</span><input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} style={styles.input} /></label>
        <label style={styles.field}><span>Email</span><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} style={styles.input} /></label>
        <label style={styles.field}><span>Display name</span><input value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} style={styles.input} /></label>
        <label style={styles.field}><span>Role</span><select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} style={styles.input}><option value="editor">Editor</option><option value="admin">Admin</option><option value="owner">Owner</option></select></label>
        <label style={{ ...styles.field, gridColumn: "1 / -1" }}><span>Temporary password (12+ characters)</span><input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} style={styles.input} /></label>
      </div>
      <button disabled={busy || !form.username || !form.email || form.password.length < 12} onClick={() => void create()} style={styles.primary}>Create administrator</button>
    </section>

    <section style={styles.card}>
      <div style={styles.head}><div><h3 style={styles.title}>Administrators</h3><p style={styles.muted}>Roles, access state, password resets and active sessions.</p></div><button onClick={() => void load()} style={styles.secondary}>Refresh</button></div>
      <div style={styles.list}>{users.map((user) => <article key={user.public_id} style={styles.user}>
        <div style={styles.userTop}><div><strong>{user.display_name || user.username}</strong><div style={styles.small}>@{user.username} • {user.email}</div></div><div style={styles.badges}><span style={styles.badge}>{user.role}</span><span style={{ ...styles.badge, background: user.status === "active" ? "#e2f5ec" : "#ffe1de", color: user.status === "active" ? "#0b654f" : "#9a3028" }}>{user.status}</span></div></div>
        <div style={styles.meta}>Sessions: {user.active_sessions ?? 0} • Last sign-in: {user.last_signed_in_at ? new Date(user.last_signed_in_at).toLocaleString() : "never"}{user.must_change_password ? " • password change required" : ""}</div>
        <div style={styles.actions}>
          <select value={user.role} onChange={(e) => void update(user, { role: e.target.value as AdminUser["role"] })} style={styles.smallInput}><option value="editor">Editor</option><option value="admin">Admin</option><option value="owner">Owner</option></select>
          <button onClick={() => void update(user, { status: user.status === "active" ? "disabled" : "active" })} style={user.status === "active" ? styles.warn : styles.secondary}>{user.status === "active" ? "Disable" : "Enable"}</button>
          <button onClick={() => void revoke(user)} style={styles.secondary}>Revoke sessions</button>
        </div>
        <div style={styles.passwordRow}><input type="password" placeholder="New temporary password" value={reset[user.public_id] || ""} onChange={(e) => setReset((old) => ({ ...old, [user.public_id]: e.target.value }))} style={styles.input} /><button onClick={() => void resetPassword(user)} style={styles.secondary}>Reset password</button></div>
      </article>)}</div>
    </section>
  </div>;
}

const styles: Record<string, React.CSSProperties> = {
  wrap: { display: "grid", gap: 16 }, card: { background: "white", border: "1px solid #e0e5e0", borderRadius: 20, padding: 20 }, head: { display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start", marginBottom: 16 }, title: { margin: 0, color: "#173f35" }, muted: { color: "#71807a", margin: "5px 0 0", lineHeight: 1.5 }, owner: { borderRadius: 999, padding: "5px 9px", background: "#fff1cc", color: "#815c10", fontSize: 10, fontWeight: 900 }, grid: { display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 12, marginBottom: 12 }, field: { display: "grid", gap: 6, color: "#66756f", fontSize: 11, fontWeight: 900, textTransform: "uppercase", letterSpacing: .7 }, input: { width: "100%", boxSizing: "border-box", border: "1px solid #d9dfdb", borderRadius: 11, padding: "10px 11px", background: "#fff", color: "#173f35" }, smallInput: { border: "1px solid #d9dfdb", borderRadius: 9, padding: "7px 9px", background: "#fff" }, primary: { border: 0, borderRadius: 11, padding: "10px 14px", background: "#0b654f", color: "white", fontWeight: 900, cursor: "pointer" }, secondary: { border: "1px solid #d7dfda", borderRadius: 9, padding: "8px 10px", background: "white", color: "#173f35", fontWeight: 800, cursor: "pointer" }, warn: { border: "1px solid #ecd599", borderRadius: 9, padding: "8px 10px", background: "#fff8e2", color: "#7b5d11", fontWeight: 850, cursor: "pointer" }, list: { display: "grid", gap: 10 }, user: { border: "1px solid #e3e8e4", borderRadius: 15, padding: 14, background: "#fcfdfb" }, userTop: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 14 }, small: { color: "#7a8782", fontSize: 12, marginTop: 3 }, meta: { color: "#82908b", fontSize: 11, marginTop: 9 }, badges: { display: "flex", gap: 5 }, badge: { borderRadius: 999, padding: "5px 8px", background: "#edf1ef", color: "#52625d", fontSize: 10, fontWeight: 900 }, actions: { display: "flex", flexWrap: "wrap", gap: 7, marginTop: 11 }, passwordRow: { display: "grid", gridTemplateColumns: "1fr auto", gap: 8, marginTop: 9 }, error: { background: "#ffe5e2", color: "#8f2e27", border: "1px solid #f0c3bd", padding: 10, borderRadius: 11, fontWeight: 750 }, success: { background: "#e3f5ed", color: "#0b654f", border: "1px solid #c4e6d8", padding: 10, borderRadius: 11, fontWeight: 750 }
};
