"use client";

import { useEffect, useMemo, useState } from "react";

const API = "https://wopt-prayer-push.wopt-windsor.workers.dev";
const TOKEN_KEY = "wopt:admin-token:v1";
const PRAYERS = ["fajr", "dhuhr", "asr", "maghrib", "isha"] as const;
type Prayer = (typeof PRAYERS)[number];
type DayRow = Record<Prayer, string>;
type PrayerTimes = Record<string, DayRow>;

type Status = {
  month: string;
  prayerTimes: PrayerTimes;
  sourceUrl: string;
  scheduleUrl: string;
  autoSync: boolean;
  lastAuto?: { checkedDate?: string; month?: string; status?: string; at?: string; error?: string; commitSha?: string | null } | null;
  githubPublishingConfigured: boolean;
};

function monthKeyNow() {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Toronto", year: "numeric", month: "2-digit" }).formatToParts(new Date());
  const get = (k: string) => p.find((x) => x.type === k)?.value || "";
  return `${get("year")}-${get("month")}`;
}

function labelPrayer(p: Prayer) {
  return p.charAt(0).toUpperCase() + p.slice(1);
}

export default function PrayerScheduleAdminPage() {
  const [month, setMonth] = useState(monthKeyNow());
  const [rows, setRows] = useState<PrayerTimes>({});
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const token = typeof window !== "undefined" ? localStorage.getItem(TOKEN_KEY) || "" : "";

  async function call(path: string, init: RequestInit = {}) {
    const response = await fetch(`${API}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(init.headers || {}) },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
    return data;
  }

  async function load(target = month) {
    if (!token) { location.replace("/admin/"); return; }
    setBusy("load"); setMessage("");
    try {
      const data = await call(`/admin/prayer-schedule?month=${encodeURIComponent(target)}`) as Status;
      setStatus(data); setRows(data.prayerTimes || {});
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to load schedule"); }
    finally { setBusy(""); }
  }

  useEffect(() => { void load(month); }, [month]);

  const dates = useMemo(() => Object.keys(rows).sort(), [rows]);
  const rowCount = dates.length;

  async function preview() {
    setBusy("preview"); setMessage("");
    try {
      const data = await call("/admin/prayer-schedule", { method: "POST", body: JSON.stringify({ action: "preview", month }) });
      setRows(data.prayerTimes || {});
      setMessage(`Pulled ${Object.keys(data.prayerTimes || {}).length} days from Al-Hijra. Review, then publish.`);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to pull Al-Hijra schedule"); }
    finally { setBusy(""); }
  }

  async function publish() {
    if (!confirm(`Publish ${month} to the official Hassoun Windsor JSON?`)) return;
    setBusy("publish"); setMessage("");
    try {
      const data = await call("/admin/prayer-schedule", { method: "POST", body: JSON.stringify({ action: "publish", month, prayerTimes: rows }) });
      setMessage(`Published ${month}${data.commit?.sha ? ` • commit ${String(data.commit.sha).slice(0, 10)}` : ""}. Hassoun services will pick it up automatically.`);
      await load(month);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to publish schedule"); }
    finally { setBusy(""); }
  }

  async function setAuto(enabled: boolean) {
    setBusy("auto"); setMessage("");
    try {
      const data = await call("/admin/prayer-schedule", { method: "POST", body: JSON.stringify({ action: "set_auto", enabled }) });
      setStatus((s) => s ? { ...s, autoSync: data.autoSync } : s);
      setMessage(enabled ? "Automatic monthly sync is enabled." : "Automatic monthly sync is off.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to change auto sync"); }
    finally { setBusy(""); }
  }

  function edit(date: string, prayer: Prayer, value: string) {
    setRows((old) => ({ ...old, [date]: { ...old[date], [prayer]: value } }));
  }

  return (
    <main style={s.page}>
      <header style={s.header}>
        <div>
          <div style={s.eyebrow}>HASSOUN ADMIN • PRAYER DATA</div>
          <h1 style={s.h1}>🕌 Windsor Prayer Schedule</h1>
          <p style={s.muted}>Update the official Hassoun Windsor JSON manually or pull the monthly Adhan times from Al-Hijra automatically.</p>
        </div>
      </header>

      <section style={s.grid}>
        <div style={s.card}>
          <div style={s.cardTitle}>Monthly source</div>
          <div style={s.sourceName}>AL-HIJRA MASJID • AthanPlus</div>
          <a href={status?.sourceUrl || "https://timing.athanplus.com/masjid/widgets/monthly?masjid_id=adJEGWAk&theme=1"} target="_blank" rel="noreferrer" style={s.link}>Open source timetable ↗</a>
          <div style={s.row}><span>Month</span><input type="month" value={month} onChange={(e) => setMonth(e.target.value)} style={s.input} /></div>
          <button disabled={Boolean(busy)} onClick={() => void preview()} style={s.primary}>{busy === "preview" ? "Pulling…" : "✨ Pull month from Al-Hijra"}</button>
          <p style={s.help}>This imports only Adhan times: Fajr, Dhuhr, Asr, Maghrib and Isha. Sunrise and Iqamah are ignored.</p>
        </div>

        <div style={s.card}>
          <div style={s.cardTitle}>Automatic monthly sync</div>
          <div style={s.autoRow}>
            <div><strong>{status?.autoSync ? "ON" : "OFF"}</strong><div style={s.help}>On the 25th and later, Hassoun also checks the next month so the schedule can be ready before month-end.</div></div>
            <button disabled={Boolean(busy)} onClick={() => void setAuto(!status?.autoSync)} style={status?.autoSync ? s.danger : s.secondary}>{status?.autoSync ? "Turn off" : "Turn on"}</button>
          </div>
          <div style={s.metaLine}>GitHub publishing: <strong>{status?.githubPublishingConfigured ? "Configured" : "Needs one-time setup"}</strong></div>
          {status?.lastAuto ? <div style={s.metaBox}><div>Last check: {status.lastAuto.checkedDate || "—"}</div><div>Month: {status.lastAuto.month || "—"}</div><div>Status: {status.lastAuto.status || "—"}</div>{status.lastAuto.error ? <div style={{color:"#9b2c2c"}}>{status.lastAuto.error}</div> : null}</div> : null}
        </div>
      </section>

      {message ? <div style={s.message}>{message}</div> : null}

      <section style={s.tableCard}>
        <div style={s.tableHead}>
          <div><div style={s.cardTitle}>{month} prayer times</div><div style={s.help}>{rowCount} days loaded • times are 24-hour Windsor local time</div></div>
          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
            <button disabled={Boolean(busy)} onClick={() => void load(month)} style={s.secondary}>Reload current</button>
            <button disabled={Boolean(busy) || !rowCount} onClick={() => void publish()} style={s.publish}>{busy === "publish" ? "Publishing…" : "Publish to Hassoun JSON"}</button>
          </div>
        </div>
        {!status?.githubPublishingConfigured ? <div style={s.warning}><strong>One-time setup required:</strong> add the Cloudflare Worker secret <code>GITHUB_SCHEDULE_TOKEN</code> with write access to this repository. The admin page can already preview and edit the timetable; publishing and auto-sync will work once that secret is added.</div> : null}
        <div style={{overflowX:"auto"}}>
          <table style={s.table}>
            <thead><tr><th style={s.th}>Date</th>{PRAYERS.map((p) => <th key={p} style={s.th}>{labelPrayer(p)}</th>)}</tr></thead>
            <tbody>{dates.map((date) => <tr key={date}><td style={s.dateCell}>{date}</td>{PRAYERS.map((p) => <td key={p} style={s.td}><input aria-label={`${date} ${p}`} value={rows[date]?.[p] || ""} onChange={(e) => edit(date, p, e.target.value)} style={s.timeInput} /></td>)}</tr>)}</tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

const s: Record<string, React.CSSProperties> = {
  page:{padding:"28px",background:"#f7f5ef",minHeight:"100dvh",color:"#173f35"},header:{maxWidth:1200,margin:"0 auto 18px"},eyebrow:{fontSize:12,fontWeight:900,letterSpacing:1.7,color:"#08765d"},h1:{fontSize:36,margin:"8px 0"},muted:{color:"#667a73",maxWidth:820,lineHeight:1.55},grid:{maxWidth:1200,margin:"0 auto",display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(320px,1fr))",gap:16},card:{background:"white",border:"1px solid #dde4df",borderRadius:20,padding:20,boxShadow:"0 8px 28px rgba(20,63,53,.05)"},cardTitle:{fontSize:19,fontWeight:900},sourceName:{marginTop:12,fontWeight:800,color:"#0b5b47"},link:{display:"inline-block",marginTop:6,color:"#08765d",fontWeight:750},row:{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,marginTop:20},input:{minHeight:42,border:"1px solid #ccd9d4",borderRadius:10,padding:"8px 10px",fontSize:15},primary:{width:"100%",marginTop:14,minHeight:48,border:0,borderRadius:12,background:"#0b5b47",color:"white",fontWeight:900,cursor:"pointer"},secondary:{minHeight:42,border:"1px solid #b9ccc5",borderRadius:10,background:"white",color:"#17483c",padding:"0 14px",fontWeight:800,cursor:"pointer"},danger:{minHeight:42,border:"1px solid #d3aaa7",borderRadius:10,background:"#fff6f4",color:"#8b2f27",padding:"0 14px",fontWeight:800,cursor:"pointer"},publish:{minHeight:44,border:0,borderRadius:10,background:"#0b6b58",color:"white",padding:"0 17px",fontWeight:900,cursor:"pointer"},help:{fontSize:13,color:"#71817b",lineHeight:1.45,margin:"7px 0 0"},autoRow:{display:"flex",justifyContent:"space-between",gap:16,alignItems:"center",marginTop:15},metaLine:{marginTop:18,paddingTop:14,borderTop:"1px solid #edf0ee",fontSize:14},metaBox:{marginTop:10,padding:12,borderRadius:12,background:"#f6f8f7",fontSize:13,lineHeight:1.7},message:{maxWidth:1200,margin:"16px auto 0",background:"#edf8f3",border:"1px solid #b9ddce",color:"#125642",padding:"13px 15px",borderRadius:12,fontWeight:700},tableCard:{maxWidth:1200,margin:"16px auto 0",background:"white",border:"1px solid #dde4df",borderRadius:20,padding:18,boxShadow:"0 8px 28px rgba(20,63,53,.05)"},tableHead:{display:"flex",justifyContent:"space-between",gap:15,alignItems:"center",flexWrap:"wrap",marginBottom:12},warning:{background:"#fff8e5",border:"1px solid #ead59e",padding:12,borderRadius:12,color:"#6d571d",fontSize:13,marginBottom:12,lineHeight:1.5},table:{width:"100%",borderCollapse:"collapse",minWidth:760},th:{textAlign:"left",fontSize:12,letterSpacing:1,textTransform:"uppercase",color:"#687b74",padding:"10px 8px",borderBottom:"1px solid #dfe6e2"},td:{padding:"6px 8px",borderBottom:"1px solid #edf1ef"},dateCell:{padding:"6px 8px",borderBottom:"1px solid #edf1ef",fontWeight:800,whiteSpace:"nowrap"},timeInput:{width:86,minHeight:36,border:"1px solid #d7e0dc",borderRadius:8,padding:"6px 8px",fontWeight:800,color:"#17483c"}
};
