"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";

const API = "https://wopt-prayer-push.wopt-windsor.workers.dev";
const TOKEN_KEY = "wopt:admin-token:v1";

type Admin = { username: string; display_name?: string | null; role: string };
type EmailCampaign = { public_id: string; name: string; category: string; subject_en: string; status: string; target_locale: string; sent_count?: number; failed_count?: number; pending_count?: number };
type Profile = {
  template_key: string; name: string; category: string; enabled: number;
  include_islamic_occasion: number; include_daily_hadith: number; include_daily_surah: number;
  include_occasion_countdown: number; include_motivation: number; include_sadaqah_jariyah: number;
  include_sponsor: number; sponsor_name?: string | null; sponsor_url?: string | null;
  sponsor_message_en?: string | null; sponsor_message_ar?: string | null;
};
type ContentItem = { id: number; content_type: string; title_en: string; title_ar?: string | null; body_en: string; body_ar?: string | null; source_ref?: string | null; enabled: number };
type EmailData = { campaigns: EmailCampaign[]; profiles: Profile[]; content: ContentItem[]; customTemplates: Array<{ template_key: string; name: string; category: string; subject_en: string; enabled: number }> };

async function api<T>(path: string, init: RequestInit = {}, token?: string | null): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(`${API}${path}`, { ...init, headers });
  const payload = await response.json().catch(() => ({})) as T & { error?: string };
  if (!response.ok) throw new Error(payload.error || `Request failed (${response.status})`);
  return payload;
}

const FEATURES: Array<[keyof Profile, string, string]> = [
  ["include_islamic_occasion", "Islamic occasions", "Show the upcoming Islamic occasion when relevant"],
  ["include_daily_hadith", "Daily hadith", "Add a rotating hadith reminder with source"],
  ["include_daily_surah", "Daily Qur’an", "Add a rotating Qur’an / surah reminder"],
  ["include_occasion_countdown", "Occasion countdown", "Show days remaining until the next Islamic occasion"],
  ["include_motivation", "Motivational reminder", "Add a short positive Islamic reminder"],
  ["include_sadaqah_jariyah", "Sadaqah Jariyah", "Show the permanent Sadaqah Jariyah dedication"],
  ["include_sponsor", "Sponsor section", "Show the sponsor / supporter block"],
];

export default function AdminEmailPage() {
  const [token, setToken] = useState<string | null>(null);
  const [admin, setAdmin] = useState<Admin | null>(null);
  const [login, setLogin] = useState(""); const [password, setPassword] = useState("");
  const [error, setError] = useState(""); const [busy, setBusy] = useState(false); const [notice, setNotice] = useState("");
  const [tab, setTab] = useState<"templates" | "content" | "campaigns">("templates");
  const [data, setData] = useState<EmailData>({ campaigns: [], profiles: [], content: [], customTemplates: [] });
  const [name, setName] = useState(""); const [category, setCategory] = useState("announcement");
  const [subjectEn, setSubjectEn] = useState(""); const [messageEn, setMessageEn] = useState("");
  const [subjectAr, setSubjectAr] = useState(""); const [messageAr, setMessageAr] = useState("");
  const [locale, setLocale] = useState("all"); const [scheduledLocal, setScheduledLocal] = useState("");

  const load = useCallback(async (authToken: string) => {
    const next = await api<EmailData>("/admin/email/campaigns", {}, authToken);
    setData({ campaigns: next.campaigns || [], profiles: next.profiles || [], content: next.content || [], customTemplates: next.customTemplates || [] });
  }, []);

  useEffect(() => {
    const saved = window.localStorage.getItem(TOKEN_KEY); if (!saved) return;
    setToken(saved);
    void api<{ admin: Admin }>("/admin/me", {}, saved).then(async (res) => { setAdmin(res.admin); await load(saved); }).catch(() => { window.localStorage.removeItem(TOKEN_KEY); setToken(null); setAdmin(null); });
  }, [load]);

  async function signIn(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const res = await api<{ token: string; admin: Admin }>("/admin/login", { method: "POST", body: JSON.stringify({ login, password }) });
      window.localStorage.setItem(TOKEN_KEY, res.token); setToken(res.token); setAdmin(res.admin); setPassword(""); await load(res.token);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to sign in"); } finally { setBusy(false); }
  }

  async function postAction(body: Record<string, unknown>) {
    if (!token) return; setBusy(true); setError(""); setNotice("");
    try { await api("/admin/email/campaigns", { method: "POST", body: JSON.stringify(body) }, token); await load(token); setNotice("Saved."); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to save"); }
    finally { setBusy(false); }
  }

  async function toggleProfile(profile: Profile, key: keyof Profile) {
    const current = Number(profile[key] ?? 0) === 1;
    const bodyKey: Record<string, string> = {
      enabled: "enabled", include_islamic_occasion: "includeIslamicOccasion", include_daily_hadith: "includeDailyHadith",
      include_daily_surah: "includeDailySurah", include_occasion_countdown: "includeOccasionCountdown", include_motivation: "includeMotivation",
      include_sadaqah_jariyah: "includeSadaqahJariyah", include_sponsor: "includeSponsor"
    };
    await postAction({ action: "update_template_profile", templateKey: profile.template_key, [bodyKey[String(key)]]: !current });
  }

  async function saveSponsor(profile: Profile) {
    const sponsorName = (document.getElementById(`sponsor-name-${profile.template_key}`) as HTMLInputElement | null)?.value || "";
    const sponsorUrl = (document.getElementById(`sponsor-url-${profile.template_key}`) as HTMLInputElement | null)?.value || "";
    const sponsorMessageEn = (document.getElementById(`sponsor-message-${profile.template_key}`) as HTMLInputElement | null)?.value || "";
    await postAction({ action: "update_template_profile", templateKey: profile.template_key, sponsorName, sponsorUrl, sponsorMessageEn });
  }

  async function schedule(event: FormEvent) {
    event.preventDefault(); if (!token) return; setBusy(true); setError(""); setNotice("");
    try {
      const scheduledAt = scheduledLocal ? new Date(scheduledLocal).toISOString() : new Date().toISOString();
      await api("/admin/email/campaigns", { method: "POST", body: JSON.stringify({
        name: name || subjectEn, category, subjectEn,
        htmlEn: `<div style="font-family:Arial,sans-serif;line-height:1.65;color:#173f35"><p>${messageEn.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\n/g,"<br>")}</p><p><a href="{{manageUrl}}">Manage email alerts</a></p></div>`,
        textEn: `${messageEn}\n\nManage email alerts: {{manageUrl}}`, subjectAr: subjectAr || undefined,
        htmlAr: messageAr ? `<div dir="rtl" style="font-family:Arial,sans-serif;line-height:1.8;color:#173f35"><p>${messageAr.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\n/g,"<br>")}</p></div>` : undefined,
        textAr: messageAr || undefined, audience: "all_subscribers", targetLocale: locale, scheduledAt
      }) }, token);
      setName(""); setSubjectEn(""); setMessageEn(""); setSubjectAr(""); setMessageAr(""); setScheduledLocal(""); await load(token); setNotice("Campaign saved.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to create campaign"); } finally { setBusy(false); }
  }

  if (!token || !admin) return <main style={s.page}><form onSubmit={signIn} style={s.login}><p style={s.eyebrow}>HASSOUN ADMIN</p><h1 style={s.h1}>Email Center</h1><p style={s.muted}>Owner / admin access only.</p><label style={s.label}>Username or email</label><input value={login} onChange={(e)=>setLogin(e.target.value)} style={s.input}/><label style={s.label}>Password</label><input type="password" value={password} onChange={(e)=>setPassword(e.target.value)} style={s.input}/>{error?<p style={s.error}>{error}</p>:null}<button style={s.primary} disabled={busy}>{busy?"Signing in…":"Sign in"}</button><a href="../" style={s.link}>← Owner Control Center</a></form></main>;

  return <main style={s.page}>
    <header style={s.header}><div><p style={s.eyebrow}>HASSOUN ADMIN</p><h1 style={{margin:0}}>Smart Email Center</h1><p style={s.muted}>Control every Hassoun email, content block and campaign.</p></div><div style={s.headerActions}><span style={s.muted}>{admin.display_name || admin.username} · {admin.role}</span><a href="../" style={s.secondary}>Owner Control Center</a></div></header>
    <nav style={s.tabs}><button style={tab==="templates"?s.tabActive:s.tab} onClick={()=>setTab("templates")}>Templates</button><button style={tab==="content"?s.tabActive:s.tab} onClick={()=>setTab("content")}>Daily Content</button><button style={tab==="campaigns"?s.tabActive:s.tab} onClick={()=>setTab("campaigns")}>Campaigns</button></nav>
    {error?<div style={s.error}>{error}</div>:null}{notice?<div style={s.success}>{notice}</div>:null}

    {tab === "templates" ? <section style={s.wrap}>
      <div style={s.info}><strong>Template controls</strong><span>Changes here control what is included in each production email. Sadaqah Jariyah and Sponsor can be enabled independently per template.</span></div>
      <div style={s.cards}>{data.profiles.map(profile => <article key={profile.template_key} style={s.card}>
        <div style={s.titleRow}><div><div style={s.smallCaps}>{profile.category}</div><h2 style={s.h2}>{profile.name}</h2><code style={s.code}>{profile.template_key}</code></div><Toggle on={profile.enabled===1} label="Template" onClick={()=>void toggleProfile(profile,"enabled")}/></div>
        <div style={s.featureList}>{FEATURES.map(([key,label,desc]) => <div key={String(key)} style={s.feature}><div><strong>{label}</strong><div style={s.small}>{desc}</div></div><Toggle on={Number(profile[key])===1} label={label} onClick={()=>void toggleProfile(profile,key)}/></div>)}</div>
        <div style={s.sponsorBox}><strong>Sponsor details</strong><div style={s.two}><input id={`sponsor-name-${profile.template_key}`} defaultValue={profile.sponsor_name || ""} placeholder="Sponsor name" style={s.input}/><input id={`sponsor-url-${profile.template_key}`} defaultValue={profile.sponsor_url || ""} placeholder="Sponsor website / link" style={s.input}/></div><input id={`sponsor-message-${profile.template_key}`} defaultValue={profile.sponsor_message_en || ""} placeholder="Sponsor message (optional)" style={s.input}/><button disabled={busy} onClick={()=>void saveSponsor(profile)} style={s.secondaryButton}>Save sponsor details</button></div>
      </article>)}</div>
      {data.customTemplates.length ? <div style={s.card}><h2 style={s.h2}>Saved campaign templates</h2>{data.customTemplates.map(t=><div key={t.template_key} style={s.row}><div><strong>{t.name}</strong><div style={s.small}>{t.category} · {t.subject_en}</div></div><span style={s.badge}>{t.enabled?"ON":"OFF"}</span></div>)}</div>:null}
    </section> : null}

    {tab === "content" ? <section style={s.wrap}><div style={s.info}><strong>Smart daily content library</strong><span>These blocks rotate into emails when the matching template switch is ON.</span></div><div style={s.cards}>{data.content.map(item=><article key={item.id} style={s.card}><div style={s.titleRow}><div><div style={s.smallCaps}>{item.content_type}</div><h2 style={s.h2}>{item.title_en}</h2></div><Toggle on={item.enabled===1} label="Content" onClick={()=>void postAction({action:"update_content_item",id:item.id,enabled:item.enabled!==1})}/></div><p style={s.body}>{item.body_en}</p>{item.source_ref?<div style={s.source}>{item.source_ref}</div>:null}{item.title_ar?<><hr style={s.hr}/><h3 dir="rtl" style={{margin:"8px 0"}}>{item.title_ar}</h3><p dir="rtl" style={s.body}>{item.body_ar}</p></>:null}</article>)}</div></section>:null}

    {tab === "campaigns" ? <section style={s.wrap}><div style={s.grid}><form onSubmit={schedule} style={s.card}><h2 style={s.h2}>Create campaign</h2><div style={s.two}><div><label style={s.label}>Campaign name</label><input value={name} onChange={e=>setName(e.target.value)} style={s.input}/></div><div><label style={s.label}>Category</label><select value={category} onChange={e=>setCategory(e.target.value)} style={s.input}><option value="announcement">Announcement</option><option value="religious_occasion">Islamic occasion</option><option value="daily_content">Daily content</option><option value="community_event">Community event</option><option value="marketing">Marketing</option><option value="system">System</option></select></div></div><label style={s.label}>English subject</label><input value={subjectEn} onChange={e=>setSubjectEn(e.target.value)} style={s.input} required/><label style={s.label}>English message</label><textarea value={messageEn} onChange={e=>setMessageEn(e.target.value)} rows={6} style={s.textarea} required/><label style={s.label}>Arabic subject</label><input value={subjectAr} onChange={e=>setSubjectAr(e.target.value)} dir="rtl" style={s.input}/><label style={s.label}>Arabic message</label><textarea value={messageAr} onChange={e=>setMessageAr(e.target.value)} dir="rtl" rows={5} style={s.textarea}/><div style={s.two}><div><label style={s.label}>Language</label><select value={locale} onChange={e=>setLocale(e.target.value)} style={s.input}><option value="all">All users</option><option value="en">English</option><option value="ar">Arabic</option></select></div><div><label style={s.label}>Schedule</label><input type="datetime-local" value={scheduledLocal} onChange={e=>setScheduledLocal(e.target.value)} style={s.input}/></div></div><button disabled={busy||!subjectEn||!messageEn} style={s.primary}>{scheduledLocal?"Schedule campaign":"Send campaign"}</button></form><div style={s.card}><div style={s.titleRow}><h2 style={s.h2}>Recent campaigns</h2><button onClick={()=>token&&void load(token)} style={s.secondaryButton}>Refresh</button></div>{data.campaigns.map(c=><div key={c.public_id} style={s.row}><div><strong>{c.name}</strong><div style={s.small}>{c.subject_en}</div><div style={s.small}>{c.category} · {c.target_locale}</div></div><div style={{textAlign:"right"}}><span style={s.badge}>{c.status}</span><div style={s.small}>{c.sent_count||0} sent · {c.pending_count||0} pending · {c.failed_count||0} failed</div></div></div>)}{!data.campaigns.length?<p style={s.muted}>No campaigns yet.</p>:null}</div></div></section>:null}
  </main>;
}

function Toggle({on,label,onClick}:{on:boolean;label:string;onClick:()=>void}) { return <button type="button" aria-label={`${label} ${on?"on":"off"}`} onClick={onClick} style={{...s.toggle,background:on?"#08735a":"#d7ddda",justifyContent:on?"flex-end":"flex-start"}}><span style={s.knob}/></button>; }

const s: Record<string, React.CSSProperties> = {
  page:{minHeight:"100vh",background:"#f4f6f3",color:"#173f35",padding:24,fontFamily:"system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif"},wrap:{maxWidth:1320,margin:"0 auto"},header:{maxWidth:1320,margin:"0 auto 16px",display:"flex",gap:20,justifyContent:"space-between",alignItems:"center",paddingBottom:16,borderBottom:"1px solid #d8e1dd"},headerActions:{display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"},eyebrow:{color:"#08735a",fontWeight:900,letterSpacing:2,fontSize:11,margin:0},h1:{fontSize:30,margin:"5px 0"},h2:{fontSize:20,margin:"3px 0"},muted:{color:"#71837d",fontSize:13,lineHeight:1.5},small:{color:"#7d8d87",fontSize:12,lineHeight:1.45},smallCaps:{fontSize:10,fontWeight:900,letterSpacing:1.4,textTransform:"uppercase",color:"#9b7b38"},body:{fontSize:14,lineHeight:1.7,color:"#36584f"},source:{display:"inline-block",background:"#eef5f1",padding:"5px 9px",borderRadius:99,fontSize:11,fontWeight:800,color:"#37655a"},hr:{border:0,borderTop:"1px solid #e6ece9",margin:"16px 0"},tabs:{maxWidth:1320,margin:"0 auto 18px",display:"flex",gap:8,flexWrap:"wrap"},tab:{border:"1px solid #cbd8d3",background:"white",color:"#355c52",padding:"10px 16px",borderRadius:12,fontWeight:800,cursor:"pointer"},tabActive:{border:"1px solid #0b604b",background:"#0b604b",color:"white",padding:"10px 16px",borderRadius:12,fontWeight:900,cursor:"pointer"},cards:{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(340px,1fr))",gap:14,marginBottom:16},card:{background:"white",border:"1px solid #d7e0dc",borderRadius:20,padding:18,boxShadow:"0 4px 18px rgba(29,70,57,.04)"},info:{maxWidth:1320,margin:"0 auto 14px",display:"flex",gap:12,alignItems:"center",background:"#edf6f2",border:"1px solid #d3e6de",borderRadius:14,padding:"12px 14px",fontSize:13,color:"#386257"},titleRow:{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:14},featureList:{marginTop:14,borderTop:"1px solid #edf1ef"},feature:{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,padding:"11px 0",borderBottom:"1px solid #edf1ef"},sponsorBox:{marginTop:14,background:"#fbf7ec",border:"1px solid #eadfc6",borderRadius:14,padding:12,display:"grid",gap:8},two:{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:10},grid:{display:"grid",gridTemplateColumns:"minmax(0,1.15fr) minmax(330px,.85fr)",gap:14,alignItems:"start"},row:{display:"flex",justifyContent:"space-between",gap:14,padding:"12px 0",borderBottom:"1px solid #edf1ef"},code:{fontSize:10,color:"#82908b"},badge:{display:"inline-block",padding:"4px 8px",borderRadius:99,background:"#e8f3ef",color:"#08735a",fontSize:11,fontWeight:900},toggle:{width:42,height:24,border:0,borderRadius:99,padding:3,display:"flex",alignItems:"center",cursor:"pointer",flex:"0 0 auto"},knob:{width:18,height:18,borderRadius:"50%",background:"white",boxShadow:"0 1px 3px rgba(0,0,0,.2)"},label:{display:"block",fontSize:12,fontWeight:800,color:"#355c52",marginTop:12,marginBottom:5},input:{width:"100%",minHeight:42,border:"1px solid #cbd8d3",borderRadius:11,padding:"9px 11px",background:"#fbfcfa",color:"#173f35",fontSize:14},textarea:{width:"100%",border:"1px solid #cbd8d3",borderRadius:11,padding:11,background:"#fbfcfa",color:"#173f35",fontSize:14,resize:"vertical"},primary:{width:"100%",minHeight:47,marginTop:15,border:0,borderRadius:12,background:"#0b604b",color:"white",fontWeight:900,cursor:"pointer"},secondary:{display:"inline-block",textDecoration:"none",border:"1px solid #cbd8d3",borderRadius:11,padding:"9px 13px",background:"white",color:"#0b604b",fontWeight:800},secondaryButton:{border:"1px solid #cbd8d3",borderRadius:10,padding:"8px 11px",background:"white",color:"#0b604b",fontWeight:800,cursor:"pointer"},link:{textAlign:"center",color:"#0b604b",fontWeight:800,textDecoration:"none",marginTop:6},login:{width:"min(440px,100%)",margin:"12vh auto",background:"white",border:"1px solid #d7dfda",borderRadius:24,padding:26,display:"grid",gap:10},error:{maxWidth:1320,margin:"0 auto 12px",background:"#fff0ed",color:"#923a32",borderRadius:12,padding:12},success:{maxWidth:1320,margin:"0 auto 12px",background:"#ecf9f3",color:"#0b6f52",borderRadius:12,padding:12}
};
