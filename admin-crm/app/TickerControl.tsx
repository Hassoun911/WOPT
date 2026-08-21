"use client";

import { FormEvent, useEffect, useState } from "react";

const API = "https://wopt-prayer-push.wopt-windsor.workers.dev";
const TOKEN_KEY = "wopt:admin-token:v1";

type Ticker = { enabled: boolean; message: string; speed: "slow" | "normal" | "fast" };

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

export default function TickerControl() {
  const [ticker, setTicker] = useState<Ticker>({ enabled: false, message: "", speed: "normal" });
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    void api<{ settings: Array<{ key: string; value: unknown }> }>("/admin/settings")
      .then((data) => {
        const value = data.settings.find((x) => x.key === "scrolling_ticker")?.value as Partial<Ticker> | undefined;
        if (value) setTicker({ enabled: value.enabled === true, message: String(value.message || ""), speed: value.speed === "slow" || value.speed === "fast" ? value.speed : "normal" });
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Unable to load ticker"));
  }, []);

  const save = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError(""); setNotice("");
    try {
      await api("/admin/settings/scrolling_ticker", { method: "POST", body: JSON.stringify({ value: ticker }) });
      setNotice(ticker.enabled ? "Ticker published to Hassoun." : "Ticker is off and hidden from users.");
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to save ticker"); }
    finally { setBusy(false); }
  };

  return <section>
    <div style={s.titleRow}><div><p style={s.eyebrow}>LIVE APP MESSAGE</p><h1 style={s.title}>Scrolling ticker</h1><p style={s.muted}>Send a live scrolling alert across Hassoun. Emoji and Arabic/Unicode text are supported.</p></div></div>
    {error ? <div style={s.error}>{error}</div> : null}{notice ? <div style={s.success}>{notice}</div> : null}
    <div style={s.grid}>
      <form onSubmit={save} style={s.panel}>
        <div style={s.switchRow}><div><strong>Show ticker in app</strong><p style={s.muted}>When OFF, the bar disappears completely.</p></div><button type="button" onClick={() => setTicker((x) => ({ ...x, enabled: !x.enabled }))} style={ticker.enabled ? s.on : s.off}>{ticker.enabled ? "ON" : "OFF"}</button></div>
        <label style={s.label}>Scrolling message</label>
        <textarea value={ticker.message} onChange={(e) => setTicker((x) => ({ ...x, message: e.target.value.slice(0, 500) }))} placeholder="🌙 Ramadan reminder • 📖 New Qur’an feature • ⚠️ Important app notice…" style={s.textarea} />
        <div style={s.counter}>{ticker.message.length}/500</div>
        <label style={s.label}>Speed</label>
        <div style={s.speedRow}>{(["slow","normal","fast"] as const).map((speed) => <button key={speed} type="button" onClick={() => setTicker((x) => ({ ...x, speed }))} style={ticker.speed === speed ? s.speedActive : s.speed}>{speed}</button>)}</div>
        <button disabled={busy || (ticker.enabled && !ticker.message.trim())} style={s.primary}>{busy ? "Saving…" : "Save & publish"}</button>
      </form>
      <div style={s.panel}><h2 style={s.previewTitle}>Live preview</h2><div style={s.phone}><div style={s.phoneTop}>Hassoun</div>{ticker.enabled && ticker.message.trim() ? <div style={s.ticker}><div style={s.marquee}>{ticker.message}</div></div> : <div style={s.hidden}>Ticker is hidden</div>}<div style={s.mock}><strong>Prayer • Qur’an • Knowledge</strong><span>This preview shows how the ticker sits above the app content.</span></div></div></div>
    </div>
  </section>;
}

const s: Record<string, React.CSSProperties> = {
  titleRow: { marginBottom: 18 }, eyebrow: { margin: 0, color: "#0b6a53", fontSize: 11, fontWeight: 900, letterSpacing: 1.8 }, title: { margin: "5px 0 4px", color: "#173f35", fontSize: 34, lineHeight: 1.1 }, muted: { margin: "4px 0", color: "#71817b", fontSize: 13, lineHeight: 1.5 }, grid: { display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(320px,.75fr)", gap: 18 }, panel: { background: "#fff", border: "1px solid #dce5e1", borderRadius: 20, padding: 20, boxShadow: "0 8px 26px rgba(15,68,55,.05)" }, switchRow: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, paddingBottom: 16, borderBottom: "1px solid #edf1ef" }, on: { border: 0, borderRadius: 999, padding: "9px 18px", background: "#0b654f", color: "white", fontWeight: 900, cursor: "pointer" }, off: { border: "1px solid #ccd8d3", borderRadius: 999, padding: "9px 18px", background: "#f2f5f4", color: "#65736e", fontWeight: 900, cursor: "pointer" }, label: { display: "block", color: "#21483e", fontWeight: 800, fontSize: 13, marginTop: 17, marginBottom: 7 }, textarea: { width: "100%", minHeight: 135, boxSizing: "border-box", resize: "vertical", border: "1px solid #cbd9d4", borderRadius: 14, padding: 13, font: "inherit", fontSize: 15, lineHeight: 1.5 }, counter: { textAlign: "right", color: "#89948f", fontSize: 11, marginTop: 5 }, speedRow: { display: "flex", gap: 8 }, speed: { flex: 1, border: "1px solid #cfdad6", background: "#fff", color: "#50645d", borderRadius: 12, padding: "10px 8px", fontWeight: 800, textTransform: "capitalize", cursor: "pointer" }, speedActive: { flex: 1, border: "1px solid #0b654f", background: "#e7f4ee", color: "#0b654f", borderRadius: 12, padding: "10px 8px", fontWeight: 900, textTransform: "capitalize", cursor: "pointer" }, primary: { width: "100%", marginTop: 20, border: 0, borderRadius: 13, minHeight: 47, background: "#0b654f", color: "#fff", fontWeight: 900, cursor: "pointer" }, error: { background: "#fdecea", color: "#9d2f27", padding: 12, borderRadius: 12, marginBottom: 12 }, success: { background: "#e7f6ee", color: "#0b684f", padding: 12, borderRadius: 12, marginBottom: 12 }, previewTitle: { margin: "0 0 13px", color: "#173f35", fontSize: 18 }, phone: { border: "1px solid #ccd9d4", borderRadius: 22, overflow: "hidden", background: "#f7f4ec", minHeight: 310 }, phoneTop: { background: "#fff", padding: "14px 16px", color: "#173f35", fontWeight: 900, borderBottom: "1px solid #e6ece9" }, ticker: { overflow: "hidden", background: "#0b654f", color: "#fff", height: 42, display: "flex", alignItems: "center" }, marquee: { whiteSpace: "nowrap", padding: "0 18px", fontWeight: 900 }, hidden: { height: 42, display: "flex", alignItems: "center", justifyContent: "center", color: "#8a9590", fontSize: 12, background: "#f0f3f2" }, mock: { padding: 20, display: "flex", flexDirection: "column", gap: 9, color: "#173f35" }
};
