"use client";

import { FormEvent, useState } from "react";

const API = "https://wopt-prayer-push.wopt-windsor.workers.dev";
const TOKEN_KEY = "wopt:admin-token:v1";

export default function AdminSetupPage() {
  const [key, setKey] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    if (password.length < 10) {
      setError("Password must be at least 10 characters.");
      return;
    }
    setBusy(true);
    try {
      const response = await fetch(`${API}/admin/bootstrap`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Admin-Bootstrap-Key": key
        },
        body: JSON.stringify({ username, email, displayName, password })
      });
      const payload = await response.json().catch(() => ({})) as { token?: string; error?: string };
      if (!response.ok || !payload.token) throw new Error(payload.error || `Setup failed (${response.status})`);
      window.localStorage.setItem(TOKEN_KEY, payload.token);
      setDone(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to create the first admin.");
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return <main style={s.page}><section style={s.card}><p style={s.eyebrow}>WOPT ADMIN</p><h1 style={s.h1}>Owner account created</h1><p style={s.muted}>The one-time admin bootstrap is complete. The bootstrap endpoint will refuse to create another first admin.</p><a href="../" style={s.primaryLink}>Open admin dashboard</a></section></main>;
  }

  return (
    <main style={s.page}>
      <form onSubmit={submit} style={s.card}>
        <p style={s.eyebrow}>ONE-TIME SETUP</p>
        <h1 style={s.h1}>Create WOPT owner</h1>
        <p style={s.muted}>Use this only after the private ADMIN_BOOTSTRAP_KEY has been installed on the Worker. This page cannot create a second owner after bootstrap is complete.</p>
        <label style={s.label}>Private bootstrap key</label><input type="password" value={key} onChange={(e) => setKey(e.target.value)} autoComplete="off" style={s.input} required />
        <label style={s.label}>Username</label><input value={username} onChange={(e) => setUsername(e.target.value.toLowerCase())} autoComplete="username" style={s.input} placeholder="admin" required />
        <label style={s.label}>Admin email</label><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" style={s.input} required />
        <label style={s.label}>Display name</label><input value={displayName} onChange={(e) => setDisplayName(e.target.value)} style={s.input} />
        <label style={s.label}>Password</label><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" style={s.input} required />
        <label style={s.label}>Confirm password</label><input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" style={s.input} required />
        {error ? <p style={s.error}>{error}</p> : null}
        <button disabled={busy || !key || !username || !email || !password || !confirm} style={s.primary}>{busy ? "Creating owner…" : "Create owner account"}</button>
        <a href="../" style={s.link}>← Admin sign in</a>
      </form>
    </main>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: { minHeight: "100vh", display: "grid", placeItems: "center", padding: 20, background: "#f4f2e9", color: "#173f35", fontFamily: "system-ui,-apple-system,sans-serif" }, card: { width: "min(480px,100%)", background: "white", border: "1px solid #d7dfda", borderRadius: 24, padding: 28, display: "grid", gap: 7 }, eyebrow: { margin: 0, color: "#17705b", fontWeight: 900, fontSize: 11, letterSpacing: 2 }, h1: { margin: "5px 0", fontSize: 29 }, muted: { color: "#71837d", lineHeight: 1.55, fontSize: 13 }, label: { marginTop: 8, color: "#355c52", fontSize: 12, fontWeight: 800 }, input: { width: "100%", minHeight: 44, border: "1px solid #cbd8d3", borderRadius: 12, padding: "10px 12px", background: "#fbfcfa", color: "#173f35", fontSize: 14 }, error: { background: "#fff0ed", color: "#943a32", borderRadius: 10, padding: 10, fontSize: 13 }, primary: { minHeight: 49, border: 0, borderRadius: 13, background: "#0b5b47", color: "white", fontWeight: 900, marginTop: 10, cursor: "pointer" }, primaryLink: { display: "block", textAlign: "center", textDecoration: "none", background: "#0b5b47", color: "white", fontWeight: 900, borderRadius: 13, padding: "14px 18px", marginTop: 12 }, link: { color: "#0b5b47", textAlign: "center", textDecoration: "none", fontWeight: 800, marginTop: 8 }
};
