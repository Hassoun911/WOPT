"use client";

import { FormEvent, useEffect, useState } from "react";

const API = "https://wopt-prayer-push.wopt-windsor.workers.dev";

async function post<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${API}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const payload = await response.json().catch(() => ({})) as T & { error?: string };
  if (!response.ok) throw new Error(payload.error || `Request failed (${response.status})`);
  return payload;
}

export default function AdminResetPage() {
  const [token, setToken] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    const url = new URL(window.location.href);
    setToken(url.searchParams.get("token") || "");
  }, []);

  const requestReset = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await post<{ message: string }>("/admin/password/forgot", { email });
      setMessage(result.message);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to request a reset link.");
    } finally {
      setBusy(false);
    }
  };

  const resetPassword = async (event: FormEvent) => {
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
      await post("/admin/password/reset", { token, password });
      window.localStorage.removeItem("wopt:admin-token:v1");
      setDone(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to reset the password.");
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <main style={s.page}>
        <section style={s.card}>
          <p style={s.eyebrow}>Hassoun ADMIN</p>
          <h1 style={s.h1}>Password changed</h1>
          <p style={s.muted}>All previous admin sessions were revoked. Sign in again with your new password.</p>
          <a href="../" style={s.primaryLink}>Return to admin sign in</a>
        </section>
      </main>
    );
  }

  return (
    <main style={s.page}>
      <form onSubmit={token ? resetPassword : requestReset} style={s.card}>
        <p style={s.eyebrow}>Hassoun ADMIN</p>
        <h1 style={s.h1}>{token ? "Set a new password" : "Forgot password"}</h1>
        <p style={s.muted}>
          {token
            ? "Choose a new admin password. Using this link will sign out every existing admin session for this account."
            : "Enter the email address on the admin account. If it matches an active admin, Hassoun will send a secure one-hour reset link."}
        </p>

        {token ? (
          <>
            <label style={s.label}>New password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" style={s.input} required />
            <label style={s.label}>Confirm new password</label>
            <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" style={s.input} required />
          </>
        ) : (
          <>
            <label style={s.label}>Admin email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" style={s.input} required />
          </>
        )}

        {error ? <p style={s.error}>{error}</p> : null}
        {message ? <p style={s.success}>{message}</p> : null}
        <button disabled={busy || (token ? !password || !confirm : !email)} style={s.primary}>
          {busy ? "Please wait…" : token ? "Reset password" : "Send reset link"}
        </button>
        <a href="../" style={s.link}>← Admin sign in</a>
      </form>
    </main>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: { minHeight: "100vh", display: "grid", placeItems: "center", padding: 20, background: "#f4f2e9", color: "#173f35", fontFamily: "system-ui,-apple-system,sans-serif" },
  card: { width: "min(470px,100%)", background: "white", border: "1px solid #d7dfda", borderRadius: 24, padding: 28, display: "grid", gap: 8 },
  eyebrow: { margin: 0, color: "#17705b", fontWeight: 900, fontSize: 11, letterSpacing: 2 },
  h1: { margin: "5px 0", fontSize: 29 },
  muted: { color: "#71837d", lineHeight: 1.55, fontSize: 13 },
  label: { marginTop: 8, color: "#355c52", fontSize: 12, fontWeight: 800 },
  input: { width: "100%", minHeight: 44, border: "1px solid #cbd8d3", borderRadius: 12, padding: "10px 12px", background: "#fbfcfa", color: "#173f35", fontSize: 14 },
  primary: { minHeight: 49, border: 0, borderRadius: 13, background: "#0b5b47", color: "white", fontWeight: 900, marginTop: 10, cursor: "pointer" },
  primaryLink: { display: "block", textAlign: "center", textDecoration: "none", background: "#0b5b47", color: "white", fontWeight: 900, borderRadius: 13, padding: "14px 18px", marginTop: 12 },
  link: { color: "#0b5b47", textAlign: "center", textDecoration: "none", fontWeight: 800, marginTop: 8 },
  error: { background: "#fff0ed", color: "#943a32", borderRadius: 10, padding: 10, fontSize: 13 },
  success: { background: "#e9f8f1", color: "#0b6f52", borderRadius: 10, padding: 10, fontSize: 13 }
};
