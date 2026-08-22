"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

const API = "https://wopt-prayer-push.wopt-windsor.workers.dev";
const TOKEN_KEY = "wopt:admin-token:v1";
const LOGO = "https://hassoun.app/hassoun-logo.png";

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
type Preview = { profile: Profile; section?: keyof Profile; approveEnable?: boolean } | null;

async function api<T>(path: string, init: RequestInit = {}, token?: string | null): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(`${API}${path}`, { ...init, headers });
  const payload = await response.json().catch(() => ({})) as T & { error?: string };
  if (!response.ok) throw new Error(payload.error || `Request failed (${response.status})`);
  return payload;
}

const FEATURES: Array<[keyof Profile, string, string, string]> = [
  ["include_islamic_occasion", "🌙 Islamic occasion", "Upcoming Islamic occasion when relevant", "🌙✨ Ramadan, Eid, Laylat al-Qadr and other important Islamic dates can appear here."],
  ["include_daily_hadith", "📜 Daily Hadith", "Rotating authentic Hadith with source", "📜 “The most beloved deeds to Allah are those done consistently, even if small.” — Sahih al-Bukhari"],
  ["include_daily_surah", "📖 Daily Qur’an", "Rotating Qur’an / Surah reminder", "📖✨ “Surely, in the remembrance of Allah do hearts find comfort.” — Qur’an 13:28"],
  ["include_occasion_countdown", "🕌 Occasion countdown", "Days remaining until the next Islamic occasion", "🕌⏳ 18 days until the next Islamic occasion • Prepare your heart, family and worship."],
  ["include_motivation", "🤲 Motivational reminder", "Short positive Islamic reminder", "🤲💚 A small sincere deed today can become a great reward with Allah. Keep going."],
  ["include_sadaqah_jariyah", "🌿 Sadaqah Jariyah", "Permanent memorial dedication", "🌿🤍 This Hassoun service is offered as a continuing Sadaqah Jariyah for Abdul Jalil Hassoun and Salwa Hassoun. May Allah accept it and multiply its benefit."],
  ["include_sponsor", "🤝 Sponsor section", "Supporter block in the email footer", "🤝✨ Proudly supported by a community sponsor helping keep Hassoun available to everyone."],
];

const samplePrayerTimes = [
  ["🌅 Fajr", "5:12 AM"], ["☀️ Dhuhr", "1:35 PM"], ["🌤️ Asr", "5:23 PM"], ["🌇 Maghrib", "8:26 PM"], ["🌙 Isha", "9:48 PM"]
];

export default function AdminEmailPage() {
  const [token, setToken] = useState<string | null>(null);
  const [admin, setAdmin] = useState<Admin | null>(null);
  const [login, setLogin] = useState(""); const [password, setPassword] = useState("");
  const [error, setError] = useState(""); const [busy, setBusy] = useState(false); const [notice, setNotice] = useState("");
  const [tab, setTab] = useState<"templates" | "content" | "campaigns">("templates");
  const [data, setData] = useState<EmailData>({ campaigns: [], profiles: [], content: [], customTemplates: [] });
  const [preview, setPreview] = useState<Preview>(null);
  const [campaignPreview, setCampaignPreview] = useState(false);
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
  useEffect(() => { if (!error && !notice) return; const timer = window.setTimeout(() => { setError(""); setNotice(""); }, 6500); return () => window.clearTimeout(timer); }, [error, notice]);

  const activeContent = useMemo(() => data.content.filter(x => x.enabled === 1), [data.content]);

  async function signIn(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try { const res = await api<{ token: string; admin: Admin }>("/admin/login", { method: "POST", body: JSON.stringify({ login, password }) }); window.localStorage.setItem(TOKEN_KEY, res.token); setToken(res.token); setAdmin(res.admin); setPassword(""); await load(res.token); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to sign in"); } finally { setBusy(false); }
  }

  async function postAction(body: Record<string, unknown>) {
    if (!token) return; setBusy(true); setError(""); setNotice("");
    try { await api("/admin/email/campaigns", { method: "POST", body: JSON.stringify(body) }, token); await load(token); setNotice("✅ Saved successfully."); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to save"); } finally { setBusy(false); }
  }

  async function setProfile(profile: Profile, key: keyof Profile, value: boolean) {
    const bodyKey: Record<string, string> = { enabled: "enabled", include_islamic_occasion: "includeIslamicOccasion", include_daily_hadith: "includeDailyHadith", include_daily_surah: "includeDailySurah", include_occasion_countdown: "includeOccasionCountdown", include_motivation: "includeMotivation", include_sadaqah_jariyah: "includeSadaqahJariyah", include_sponsor: "includeSponsor" };
    await postAction({ action: "update_template_profile", templateKey: profile.template_key, [bodyKey[String(key)]]: value });
  }

  async function toggleProfile(profile: Profile, key: keyof Profile) {
    const current = Number(profile[key] ?? 0) === 1;
    if (key === "enabled" && !current) { setPreview({ profile, approveEnable: true }); return; }
    await setProfile(profile, key, !current);
  }

  async function saveSponsor(profile: Profile) {
    const sponsorName = (document.getElementById(`sponsor-name-${profile.template_key}`) as HTMLInputElement | null)?.value || "";
    const sponsorUrl = (document.getElementById(`sponsor-url-${profile.template_key}`) as HTMLInputElement | null)?.value || "";
    const sponsorMessageEn = (document.getElementById(`sponsor-message-${profile.template_key}`) as HTMLInputElement | null)?.value || "";
    const sponsorMessageAr = (document.getElementById(`sponsor-message-ar-${profile.template_key}`) as HTMLInputElement | null)?.value || "";
    await postAction({ action: "update_template_profile", templateKey: profile.template_key, sponsorName, sponsorUrl, sponsorMessageEn, sponsorMessageAr });
  }

  async function schedule(event: FormEvent) {
    event.preventDefault(); if (!token) return;
    if (!campaignPreview) { setCampaignPreview(true); return; }
    setBusy(true); setError(""); setNotice("");
    try {
      const scheduledAt = scheduledLocal ? new Date(scheduledLocal).toISOString() : new Date().toISOString();
      const escaped = messageEn.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\n/g,"<br>");
      await api("/admin/email/campaigns", { method: "POST", body: JSON.stringify({ name: name || subjectEn, category, subjectEn: subjectEn || "🌙✨ Hassoun Islamic Reminder 🤲📖", htmlEn: `<div style="font-family:Arial,sans-serif;line-height:1.65;color:#173f35"><p>${escaped}</p><p>🌿 Continuing Sadaqah Jariyah • 🤝 Community supported</p><p><a href="{{manageUrl}}">⚙️ Manage email alerts</a></p></div>`, textEn: `${messageEn}\n\n🌿 Continuing Sadaqah Jariyah\n⚙️ Manage email alerts: {{manageUrl}}`, subjectAr: subjectAr || undefined, htmlAr: messageAr ? `<div dir="rtl"><p>${messageAr}</p></div>` : undefined, textAr: messageAr || undefined, audience: "all_subscribers", targetLocale: locale, scheduledAt }) }, token);
      setName(""); setSubjectEn(""); setMessageEn(""); setSubjectAr(""); setMessageAr(""); setScheduledLocal(""); setCampaignPreview(false); await load(token); setNotice("✅ Campaign approved and queued.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to create campaign"); } finally { setBusy(false); }
  }

  if (!token || !admin) return <main style={s.page}><form onSubmit={signIn} style={s.login}><p style={s.eyebrow}>🕌 HASSOUN ADMIN</p><h1 style={s.h1}>📧 Email Center</h1><p style={s.muted}>Owner / admin access only.</p><label style={s.label}>Username or email</label><input value={login} onChange={(e)=>setLogin(e.target.value)} style={s.input}/><label style={s.label}>Password</label><input type="password" value={password} onChange={(e)=>setPassword(e.target.value)} style={s.input}/>{error?<p style={s.error}>{error}</p>:null}<button style={s.primary} disabled={busy}>{busy?"Signing in…":"Sign in"}</button><a href="../" style={s.link}>← Owner Control Center</a></form></main>;

  return <main style={s.page}>
    <header style={s.header}><div style={s.brand}><img src={LOGO} alt="Hassoun" style={s.logo}/><div><p style={s.eyebrow}>🕌 HASSOUN ADMIN</p><h1 style={{margin:0}}>📧 Smart Email Center</h1><p style={s.muted}>Preview first. Approve second. Send only when the final email looks right.</p></div></div><div style={s.headerActions}><span style={s.muted}>{admin.display_name || admin.username} · {admin.role}</span><a href="../" style={s.secondary}>Owner Control Center</a></div></header>
    <nav style={s.tabs}><button style={tab==="templates"?s.tabActive:s.tab} onClick={()=>setTab("templates")}>🧩 Templates</button><button style={tab==="content"?s.tabActive:s.tab} onClick={()=>setTab("content")}>📖 Daily Content</button><button style={tab==="campaigns"?s.tabActive:s.tab} onClick={()=>setTab("campaigns")}>📣 Campaigns</button></nav>
    {error?<div style={s.error}>{error}</div>:null}{notice?<div style={s.success}>{notice}</div>:null}

    {tab === "templates" ? <section style={s.wrap}>
      <div style={s.info}><strong>👁️ Preview before enabling</strong><span>Open any section or the complete email. Enabling a disabled template now requires approval from the full preview.</span></div>
      <div style={s.cards}>{data.profiles.map(profile => <article key={profile.template_key} style={s.card}>
        <div style={s.titleRow}><div><div style={s.smallCaps}>✉️ {profile.category}</div><h2 style={s.h2}>{profile.name}</h2><code style={s.code}>{profile.template_key}</code></div><div style={s.actions}><button style={s.previewButton} onClick={()=>setPreview({profile})}>👁️ Full preview</button><Toggle on={profile.enabled===1} label="Template" onClick={()=>void toggleProfile(profile,"enabled")}/></div></div>
        <div style={s.featureList}>{FEATURES.map(([key,label,desc]) => <div key={String(key)} style={s.feature}><div><strong>{label}</strong><div style={s.small}>{desc}</div><button style={s.textButton} onClick={()=>setPreview({profile,section:key})}>Preview section</button></div><Toggle on={Number(profile[key])===1} label={label} onClick={()=>void toggleProfile(profile,key)}/></div>)}</div>
        <div style={s.sponsorBox}><strong>🤝 Sponsor footer</strong><p style={s.small}>This appears near the bottom of the final email when Sponsor is ON.</p><div style={s.two}><input id={`sponsor-name-${profile.template_key}`} defaultValue={profile.sponsor_name || ""} placeholder="Sponsor name" style={s.input}/><input id={`sponsor-url-${profile.template_key}`} defaultValue={profile.sponsor_url || ""} placeholder="Sponsor website / link" style={s.input}/></div><input id={`sponsor-message-${profile.template_key}`} defaultValue={profile.sponsor_message_en || ""} placeholder="English sponsor message" style={s.input}/><input id={`sponsor-message-ar-${profile.template_key}`} defaultValue={profile.sponsor_message_ar || ""} placeholder="Arabic sponsor message" dir="rtl" style={s.input}/><button disabled={busy} onClick={()=>void saveSponsor(profile)} style={s.secondaryButton}>💾 Save sponsor details</button></div>
      </article>)}</div>
    </section> : null}

    {tab === "content" ? <section style={s.wrap}><div style={s.info}><strong>📚 Smart daily content library</strong><span>Only enabled items are eligible for rotation into emails. Preview the full template to see how they fit together.</span></div><div style={s.cards}>{data.content.map(item=><article key={item.id} style={s.card}><div style={s.titleRow}><div><div style={s.smallCaps}>✨ {item.content_type}</div><h2 style={s.h2}>{item.title_en}</h2></div><Toggle on={item.enabled===1} label="Content" onClick={()=>void postAction({action:"update_content_item",id:item.id,enabled:item.enabled!==1})}/></div><p style={s.body}>{item.body_en}</p>{item.source_ref?<div style={s.source}>📚 {item.source_ref}</div>:null}{item.title_ar?<><hr style={s.hr}/><h3 dir="rtl" style={{margin:"8px 0"}}>{item.title_ar}</h3><p dir="rtl" style={s.body}>{item.body_ar}</p></>:null}</article>)}</div></section>:null}

    {tab === "campaigns" ? <section style={s.wrap}><div style={s.grid}><form onSubmit={schedule} style={s.card}><h2 style={s.h2}>📣 Create campaign</h2><p style={s.small}>The first click opens a preview. You approve it from there before it is queued.</p><div style={s.two}><div><label style={s.label}>Campaign name</label><input value={name} onChange={e=>{setName(e.target.value);setCampaignPreview(false)}} style={s.input}/></div><div><label style={s.label}>Category</label><select value={category} onChange={e=>{setCategory(e.target.value);setCampaignPreview(false)}} style={s.input}><option value="announcement">Announcement</option><option value="religious_occasion">Islamic occasion</option><option value="daily_content">Daily content</option><option value="community_event">Community event</option><option value="marketing">Marketing</option><option value="system">System</option></select></div></div><label style={s.label}>English subject</label><input value={subjectEn} onChange={e=>{setSubjectEn(e.target.value);setCampaignPreview(false)}} placeholder="🌙✨ Hassoun reminder 🤲📖" style={s.input} required/><label style={s.label}>English message</label><textarea value={messageEn} onChange={e=>{setMessageEn(e.target.value);setCampaignPreview(false)}} rows={6} style={s.textarea} required/><label style={s.label}>Arabic subject</label><input value={subjectAr} onChange={e=>{setSubjectAr(e.target.value);setCampaignPreview(false)}} dir="rtl" style={s.input}/><label style={s.label}>Arabic message</label><textarea value={messageAr} onChange={e=>{setMessageAr(e.target.value);setCampaignPreview(false)}} dir="rtl" rows={5} style={s.textarea}/><div style={s.two}><div><label style={s.label}>Language</label><select value={locale} onChange={e=>setLocale(e.target.value)} style={s.input}><option value="all">All users</option><option value="en">English</option><option value="ar">Arabic</option></select></div><div><label style={s.label}>Schedule</label><input type="datetime-local" value={scheduledLocal} onChange={e=>setScheduledLocal(e.target.value)} style={s.input}/></div></div><button disabled={busy||!subjectEn||!messageEn} style={s.primary}>{campaignPreview ? (scheduledLocal?"✅ Approve & schedule":"✅ Approve & send") : "👁️ Preview campaign first"}</button>{campaignPreview?<div style={s.inlinePreview}><strong>{subjectEn}</strong><p>{messageEn}</p><div>🌿 Sadaqah Jariyah • 🤝 Sponsor/footer controls apply</div></div>:null}</form><div style={s.card}><div style={s.titleRow}><h2 style={s.h2}>🕘 Recent campaigns</h2><button onClick={()=>token&&void load(token)} style={s.secondaryButton}>Refresh</button></div>{data.campaigns.map(c=><div key={c.public_id} style={s.row}><div><strong>{c.name}</strong><div style={s.small}>{c.subject_en}</div><div style={s.small}>{c.category} · {c.target_locale}</div></div><div style={{textAlign:"right"}}><span style={s.badge}>{c.status}</span><div style={s.small}>{c.sent_count||0} sent · {c.pending_count||0} pending · {c.failed_count||0} failed</div></div></div>)}{!data.campaigns.length?<p style={s.muted}>No campaigns yet.</p>:null}</div></div></section>:null}

    {preview ? <PreviewModal preview={preview} content={activeContent} onClose={()=>setPreview(null)} onApprove={preview.approveEnable ? async()=>{ await setProfile(preview.profile,"enabled",true); setPreview(null); } : undefined}/> : null}
  </main>;
}

function PreviewModal({preview,content,onClose,onApprove}:{preview:NonNullable<Preview>;content:ContentItem[];onClose:()=>void;onApprove?:()=>Promise<void>}) {
  const p=preview.profile;
  const section=preview.section;
  const feature=section ? FEATURES.find(([key])=>key===section) : undefined;
  const hadith=content.find(x=>x.content_type.includes("hadith"));
  const quran=content.find(x=>x.content_type.includes("quran")||x.content_type.includes("surah")||x.content_type.includes("ayah"));
  return <div style={s.modalBackdrop} onMouseDown={onClose}><div style={s.modal} onMouseDown={e=>e.stopPropagation()}><div style={s.modalHeader}><div><p style={s.eyebrow}>👁️ APPROVAL PREVIEW</p><h2 style={{margin:"4px 0"}}>{section ? feature?.[1] : `Full ${p.name}`}</h2></div><button style={s.close} onClick={onClose}>✕</button></div>
    {section && feature ? <div style={s.sectionPreview}><div style={s.previewSectionTitle}>{feature[1]}</div><p>{feature[3]}</p></div> : <EmailPreview profile={p} hadith={hadith} quran={quran}/>} 
    <div style={s.modalActions}><button style={s.secondaryButton} onClick={onClose}>Close</button>{onApprove?<button style={s.approve} onClick={()=>void onApprove()}>✅ I approve this look — enable template</button>:null}</div></div></div>;
}

function EmailPreview({profile:p,hadith,quran}:{profile:Profile;hadith?:ContentItem;quran?:ContentItem}) {
  return <div style={s.emailFrame}>
    <div style={s.subject}>🌙🕌✨ Subject: Prayer time with Hassoun 🤲📖💚</div>
    <div style={s.emailHeader}><img src={LOGO} alt="Hassoun" style={s.emailLogo}/><div><div style={s.emailBrand}>🌙 HASSOUN 🕌</div><h2 style={{margin:"4px 0"}}>🕌✨ It’s time for Isha 🌙🤲</h2><div style={s.small}>Windsor, Ontario • Friday prayer reminder</div></div></div>
    <div style={s.hero}>🤲 May Allah accept your prayer, bring peace to your heart, and place barakah in your day. 🌿✨</div>
    <div style={s.prayerGrid}>{samplePrayerTimes.map(([n,t])=><div key={n} style={s.prayer}><span>{n}</span><strong>{t}</strong></div>)}</div>
    {p.include_islamic_occasion===1?<PreviewBlock title="🌙✨ Islamic occasion"><p>Prepare for the next blessed Islamic occasion with worship, family and gratitude. 🤲💛</p></PreviewBlock>:null}
    {p.include_occasion_countdown===1?<PreviewBlock title="🕌⏳ Next Islamic occasion"><p><strong>18 days remaining</strong> • A beautiful opportunity to prepare your heart and intentions. ✨</p></PreviewBlock>:null}
    {p.include_daily_surah===1?<PreviewBlock title="📖✨ Qur’an reminder"><p>{quran?.body_en || "Surely, in the remembrance of Allah do hearts find comfort."}</p><small>{quran?.source_ref || "Qur’an 13:28"}</small></PreviewBlock>:null}
    {p.include_daily_hadith===1?<PreviewBlock title="📜🤍 Hadith of the day"><p>{hadith?.body_en || "The most beloved deeds to Allah are those done consistently, even if small."}</p><small>{hadith?.source_ref || "Sahih al-Bukhari"}</small></PreviewBlock>:null}
    {p.include_motivation===1?<PreviewBlock title="🤲💚 Keep going"><p>A sincere prayer, a kind word, a page of Qur’an, or a quiet act of charity may be the deed Allah multiplies for you today. 🌿✨</p></PreviewBlock>:null}
    {p.include_sadaqah_jariyah===1?<div style={s.sadaqah}><strong>🌿🤍 Continuing Sadaqah Jariyah</strong><p>This Hassoun service is offered as Sadaqah Jariyah for <strong>Abdul Jalil Hassoun and Salwa Hassoun</strong>. May Allah accept it, forgive them, raise their ranks, and continue its reward through every person who benefits. 🤲🕌✨</p></div>:null}
    {p.include_sponsor===1?<div style={s.sponsor}><div style={s.sponsorLabel}>🤝 SPONSOR • COMMUNITY SUPPORT</div><strong>{p.sponsor_name || "Your approved sponsor appears here"}</strong><p>{p.sponsor_message_en || "Supporting Hassoun and helping keep beneficial Islamic tools available to the community. 🌙💚"}</p>{p.sponsor_url?<div style={s.sponsorLink}>{p.sponsor_url}</div>:null}</div>:null}
    <div style={s.emailFooter}><strong>🕌 Hassoun • Prayer • Qur’an • Knowledge 📖</strong><p>⚙️ Manage email alerts • 🔕 Unsubscribe • 🔐 Privacy</p><p>🌙 May Allah keep your heart connected to Him. 🤲✨</p></div>
  </div>;
}

function PreviewBlock({title,children}:{title:string;children:React.ReactNode}) { return <div style={s.previewBlock}><strong>{title}</strong>{children}</div>; }
function Toggle({on,label,onClick}:{on:boolean;label:string;onClick:()=>void}) { return <button type="button" aria-label={`${label} ${on?"on":"off"}`} onClick={onClick} style={{...s.toggle,background:on?"#08735a":"#d7ddda",justifyContent:on?"flex-end":"flex-start"}}><span style={s.knob}/></button>; }

const s: Record<string, React.CSSProperties> = {
  page:{minHeight:"100vh",background:"#f4f6f3",color:"#173f35",padding:24,fontFamily:"system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif"},wrap:{maxWidth:1320,margin:"0 auto"},header:{maxWidth:1320,margin:"0 auto 16px",display:"flex",gap:20,justifyContent:"space-between",alignItems:"center",paddingBottom:16,borderBottom:"1px solid #d8e1dd"},brand:{display:"flex",alignItems:"center",gap:14},logo:{width:62,height:62,borderRadius:16,objectFit:"cover",boxShadow:"0 6px 18px #1232"},headerActions:{display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"},eyebrow:{color:"#08735a",fontWeight:900,letterSpacing:2,fontSize:11,margin:0},h1:{fontSize:30,margin:"5px 0"},h2:{fontSize:20,margin:"3px 0"},muted:{color:"#71837d",fontSize:13,lineHeight:1.5},small:{color:"#7d8d87",fontSize:12,lineHeight:1.45},smallCaps:{fontSize:10,fontWeight:900,letterSpacing:1.4,textTransform:"uppercase",color:"#9b7b38"},body:{fontSize:14,lineHeight:1.7,color:"#36584f"},source:{display:"inline-block",background:"#eef5f1",padding:"5px 9px",borderRadius:99,fontSize:11,fontWeight:800,color:"#37655a"},hr:{border:0,borderTop:"1px solid #e6ece9",margin:"16px 0"},tabs:{maxWidth:1320,margin:"0 auto 18px",display:"flex",gap:8,flexWrap:"wrap"},tab:{border:"1px solid #cbd8d3",background:"white",color:"#355c52",padding:"10px 16px",borderRadius:12,fontWeight:800,cursor:"pointer"},tabActive:{border:"1px solid #0b604b",background:"#0b604b",color:"white",padding:"10px 16px",borderRadius:12,fontWeight:900,cursor:"pointer"},cards:{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(350px,1fr))",gap:14,marginBottom:16},card:{background:"white",border:"1px solid #d7e0dc",borderRadius:20,padding:18,boxShadow:"0 4px 18px rgba(29,70,57,.04)"},info:{maxWidth:1320,margin:"0 auto 14px",display:"flex",gap:12,alignItems:"center",background:"#edf6f2",border:"1px solid #d3e6de",borderRadius:14,padding:"12px 14px",fontSize:13,color:"#386257"},titleRow:{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:14},actions:{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap",justifyContent:"flex-end"},featureList:{marginTop:14,borderTop:"1px solid #edf1ef"},feature:{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,padding:"11px 0",borderBottom:"1px solid #edf1ef"},textButton:{border:0,background:"transparent",padding:0,color:"#08735a",fontWeight:800,fontSize:11,cursor:"pointer",marginTop:3},previewButton:{border:"1px solid #d4c28e",background:"#fffaf0",color:"#72591c",padding:"8px 10px",borderRadius:9,fontWeight:850,cursor:"pointer",fontSize:12},sponsorBox:{marginTop:14,background:"#fbf7ec",border:"1px solid #eadfc6",borderRadius:14,padding:12,display:"grid",gap:8},two:{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:10},grid:{display:"grid",gridTemplateColumns:"minmax(0,1.15fr) minmax(330px,.85fr)",gap:14,alignItems:"start"},row:{display:"flex",justifyContent:"space-between",gap:14,padding:"12px 0",borderBottom:"1px solid #edf1ef"},code:{fontSize:10,color:"#82908b"},badge:{display:"inline-block",padding:"4px 8px",borderRadius:99,background:"#e8f3ef",color:"#08735a",fontSize:11,fontWeight:900},toggle:{width:42,height:24,border:0,borderRadius:99,padding:3,display:"flex",alignItems:"center",cursor:"pointer",flex:"0 0 auto"},knob:{width:18,height:18,borderRadius:"50%",background:"white",boxShadow:"0 1px 3px rgba(0,0,0,.2)"},label:{display:"block",fontSize:12,fontWeight:800,color:"#355c52",marginTop:12,marginBottom:5},input:{width:"100%",minHeight:42,boxSizing:"border-box",border:"1px solid #cbd8d3",borderRadius:11,padding:"9px 11px",background:"#fbfcfa",color:"#173f35",fontSize:14},textarea:{width:"100%",boxSizing:"border-box",border:"1px solid #cbd8d3",borderRadius:11,padding:11,background:"#fbfcfa",color:"#173f35",fontSize:14,resize:"vertical"},primary:{width:"100%",minHeight:47,marginTop:15,border:0,borderRadius:12,background:"#0b604b",color:"white",fontWeight:900,cursor:"pointer"},secondary:{display:"inline-block",textDecoration:"none",border:"1px solid #cbd8d3",borderRadius:11,padding:"9px 13px",background:"white",color:"#0b604b",fontWeight:800},secondaryButton:{border:"1px solid #cbd8d3",borderRadius:10,padding:"8px 11px",background:"white",color:"#0b604b",fontWeight:800,cursor:"pointer"},link:{textAlign:"center",color:"#0b604b",fontWeight:800,textDecoration:"none",marginTop:6},login:{width:"min(440px,100%)",margin:"12vh auto",background:"white",border:"1px solid #d7dfda",borderRadius:24,padding:26,display:"grid",gap:10},error:{maxWidth:1320,margin:"0 auto 12px",background:"#fff0ed",color:"#923a32",borderRadius:12,padding:12},success:{maxWidth:1320,margin:"0 auto 12px",background:"#ecf9f3",color:"#0b6f52",borderRadius:12,padding:12},inlinePreview:{marginTop:12,border:"1px solid #d5e6df",background:"#f2faf6",borderRadius:12,padding:12,fontSize:13},modalBackdrop:{position:"fixed",inset:0,zIndex:100,background:"rgba(5,25,20,.72)",display:"grid",placeItems:"center",padding:18,overflowY:"auto"},modal:{width:"min(760px,100%)",maxHeight:"94vh",overflowY:"auto",background:"#f5f3ea",borderRadius:24,padding:18,boxShadow:"0 28px 90px #0008"},modalHeader:{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:15,marginBottom:12},close:{border:0,background:"#fff",width:38,height:38,borderRadius:99,fontWeight:900,cursor:"pointer"},modalActions:{display:"flex",gap:10,justifyContent:"flex-end",flexWrap:"wrap",marginTop:14},approve:{border:0,background:"#08735a",color:"white",padding:"10px 14px",borderRadius:10,fontWeight:900,cursor:"pointer"},sectionPreview:{background:"white",border:"1px solid #dfe6e2",borderRadius:18,padding:22,fontSize:15,lineHeight:1.7},previewSectionTitle:{fontWeight:900,fontSize:18,color:"#0b604b"},emailFrame:{background:"#fff",border:"1px solid #ddd9c9",borderRadius:22,overflow:"hidden",boxShadow:"0 10px 35px #18332c14"},subject:{padding:"12px 18px",background:"#102e27",color:"#f7df9c",fontWeight:900,fontSize:13},emailHeader:{padding:20,display:"flex",gap:15,alignItems:"center",background:"linear-gradient(135deg,#f8f3e5,#fff)"},emailLogo:{width:78,height:78,borderRadius:18,objectFit:"cover"},emailBrand:{fontSize:11,fontWeight:950,letterSpacing:2,color:"#8a6925"},hero:{margin:"0 18px 14px",padding:15,borderRadius:14,background:"#eaf6f1",color:"#185948",lineHeight:1.6,fontWeight:700},prayerGrid:{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:5,padding:"0 18px 15px"},prayer:{display:"grid",gap:4,textAlign:"center",background:"#f7f8f5",border:"1px solid #e4e8e4",borderRadius:10,padding:"9px 4px",fontSize:10},previewBlock:{margin:"0 18px 12px",padding:14,border:"1px solid #e5e8e3",borderRadius:14,lineHeight:1.55,color:"#294f45"},sadaqah:{margin:"14px 18px",padding:15,borderRadius:14,background:"#edf7f1",border:"1px solid #cfe7d8",lineHeight:1.55,color:"#215746"},sponsor:{margin:"14px 18px",padding:16,borderRadius:14,background:"#fff8e8",border:"1px solid #e8d49c",lineHeight:1.5,color:"#5f4a18"},sponsorLabel:{fontSize:10,fontWeight:950,letterSpacing:1.2,color:"#9a7626",marginBottom:5},sponsorLink:{fontSize:11,color:"#785f22",fontWeight:800},emailFooter:{padding:18,textAlign:"center",background:"#102e27",color:"#eef8f4",fontSize:11,lineHeight:1.55},modalActionsSecondary:{display:"flex"}
};