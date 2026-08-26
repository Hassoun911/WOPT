from pathlib import Path

# CRM dashboard: deep-linked views and clickable overview cards.
p = Path('admin-crm/app/CrmDashboard.tsx')
s = p.read_text()
s = s.replace('export default function CrmDashboard() {', 'export default function CrmDashboard({ initialView = "dashboard" }: { initialView?: View }) {', 1)
s = s.replace('const [view, setView] = useState<View>("dashboard");', 'const [view, setView] = useState<View>(initialView);', 1)
anchor = '  useEffect(() => { const saved = window.localStorage.getItem(TOKEN_KEY);'
sync = '  useEffect(() => { setView(initialView); }, [initialView]);\n'
if sync.strip() not in s:
    if anchor not in s:
        raise SystemExit('Could not find CRM initialization anchor')
    s = s.replace(anchor, sync + anchor, 1)
old = '[["Active subscribers", dashboard.subscribers?.active || 0, "👥"],["Push devices",dashboard.devices?.active || 0,"📱"],["Android",dashboard.devices?.android || 0,"🤖"],["iOS",dashboard.devices?.ios || 0,"🍎"],["Published content",crm.content?.published || 0,"📖"],["Admins",crm.admins?.active || 0,"🔐"],["Audit events",crm.audit?.total || 0,"🧾"]].map(([label,value,emoji]) => <div key={String(label)} style={s.stat}><span style={{fontSize:20}}>{emoji}</span><strong style={s.statValue}>{value}</strong><span style={s.statLabel}>{label}</span></div>)'
new = '[["Active subscribers", dashboard.subscribers?.active || 0, "👥", "/admin/users"],["Push devices",dashboard.devices?.active || 0,"📱","/admin/push"],["Android",dashboard.devices?.android || 0,"🤖","/admin/push"],["iOS",dashboard.devices?.ios || 0,"🍎","/admin/push"],["Published content",crm.content?.published || 0,"📖","/admin/quran"],["Admins",crm.admins?.active || 0,"🔐","team"],["Audit events",crm.audit?.total || 0,"🧾","audit"]].map(([label,value,emoji,target]) => <button type="button" key={String(label)} style={{...s.stat,cursor:"pointer",textAlign:"left",font:"inherit",width:"100%"}} onClick={() => String(target).startsWith("/") ? window.location.assign(String(target)) : setView(target as View)} title={`Open ${label}`}><span style={{fontSize:20}}>{emoji}</span><strong style={s.statValue}>{value}</strong><span style={s.statLabel}>{label}</span></button>)'
if old in s:
    s = s.replace(old, new, 1)
elif new not in s:
    raise SystemExit('Could not find dashboard stat cards')
p.write_text(s)

# Dedicated routes for CRM sections.
page_tpl = 'import CrmDashboard from "../../CrmDashboard";\nimport PasswordResetLink from "../../PasswordResetLink";\n\nexport default function Page() { return <><CrmDashboard initialView="VIEW" /><PasswordResetLink /></>; }\n'
for route, view in [('quran','content'), ('push','push'), ('settings','control')]:
    out = Path(f'admin-crm/app/admin/{route}/page.tsx')
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(page_tpl.replace('VIEW', view))

support_src = '''"use client";
import { useEffect, useState } from "react";
const API="https://wopt-prayer-push.wopt-windsor.workers.dev"; const TOKEN_KEY="wopt:admin-token:v1";
type Contact={public_id?:string;name?:string|null;email:string;subject?:string|null;message?:string|null;platform?:string|null;status?:string|null;created_at?:string|null};
export default function Page(){const[rows,setRows]=useState<Contact[]>([]);const[error,setError]=useState("");useEffect(()=>{const token=localStorage.getItem(TOKEN_KEY);if(!token){location.replace("/admin/");return;}fetch(`${API}/admin/support/contacts?limit=200`,{headers:{Authorization:`Bearer ${token}`}}).then(async r=>{const d=await r.json();if(!r.ok)throw new Error(d.error||"Unable to load support");return d}).then(d=>setRows(d.contacts||[])).catch(e=>setError(String(e.message||e)));},[]);return <main style={{minHeight:"100vh",background:"#f6f3e9",padding:28,color:"#163f35",fontFamily:"system-ui,sans-serif"}}><div style={{maxWidth:1250,margin:"0 auto"}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}><div><div style={{fontSize:12,fontWeight:800,letterSpacing:2,color:"#08765d"}}>HASSOUN ADMIN</div><h1>Support</h1></div><a href="/admin/" style={{color:"#163f35",fontWeight:800}}>← Dashboard</a></div>{error?<p style={{color:"#9c2626"}}>{error}</p>:null}<div style={{display:"grid",gap:12}}>{rows.map((x,i)=><article key={x.public_id||i} style={{background:"white",border:"1px solid #d7dfd9",borderRadius:14,padding:16}}><strong>{x.subject||"Support message"}</strong><div style={{fontSize:13,opacity:.7,marginTop:4}}>{x.name||x.email} · {x.email} · {x.platform||"unknown"}</div><p>{x.message||"—"}</p><div style={{fontSize:12,opacity:.7}}>{x.status||"new"}{x.created_at?` · ${new Date(x.created_at).toLocaleString()}`:""}</div></article>)}</div>{!rows.length&&!error?<p>No support messages yet.</p>:null}</div></main>}
'''
support = Path('admin-crm/app/admin/support/page.tsx')
support.parent.mkdir(parents=True, exist_ok=True)
support.write_text(support_src)

# Secured admin-only subscriber creation endpoint.
ar = Path('push-server/src/adminRestricted.ts')
a = ar.read_text()
if 'import { subscribeByEmail } from "./subscribers";' not in a:
    a = a.replace('import type { Env } from "./types";', 'import { subscribeByEmail } from "./subscribers";\nimport type { Env } from "./types";', 1)
marker = 'export async function listRestrictedSubscribers(request: Request, env: Env, url: URL) {'
create_fn = '''export async function createRestrictedSubscriber(request: Request, env: Env) {
  const auth = await requireOperator(request, env);
  if (!auth.admin) return auth.response!;
  const clone = request.clone();
  let body: Record<string, unknown>;
  try { body = await clone.json() as Record<string, unknown>; }
  catch { return json({ error: "Invalid request body" }, 400); }
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!email) return json({ error: "Email is required" }, 400);
  const signup = await subscribeByEmail(request, env);
  if (!signup.ok) return signup;
  const row = await env.DB.prepare("SELECT id, public_id, email FROM email_subscribers WHERE email = ? COLLATE NOCASE LIMIT 1").bind(email).first<{ id: number; public_id: string; email: string }>();
  if (!row) return json({ error: "Subscriber creation failed" }, 500);
  await env.DB.batch([
    env.DB.prepare("UPDATE email_subscribers SET status = 'active', unsubscribed_at = NULL, verification_token_hash = NULL, verification_expires_at = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(row.id),
    env.DB.prepare("UPDATE email_outbox SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP WHERE subscriber_id = ? AND kind = 'verification' AND status = 'pending'").bind(row.id)
  ]);
  return json({ ok: true, subscriber: { public_id: row.public_id, email: row.email, status: "active" } });
}

'''
if 'export async function createRestrictedSubscriber' not in a:
    if marker not in a:
        raise SystemExit('Could not find restricted subscriber marker')
    a = a.replace(marker, create_fn + marker, 1)
ar.write_text(a)

idx = Path('push-server/src/index.ts')
i = idx.read_text()
i = i.replace('  createRestrictedEmailCampaign,\n  createRestrictedPushCampaign,', '  createRestrictedEmailCampaign,\n  createRestrictedPushCampaign,\n  createRestrictedSubscriber,', 1)
get_route = '      } else if (request.method === "GET" && url.pathname === "/admin/subscribers") {\n        response = await listRestrictedSubscribers(request, env, url);'
post_route = '      } else if (request.method === "POST" && url.pathname === "/admin/subscribers") {\n        response = await createRestrictedSubscriber(request, env);\n' + get_route
if 'request.method === "POST" && url.pathname === "/admin/subscribers"' not in i:
    if get_route not in i:
        raise SystemExit('Could not find admin subscribers route')
    i = i.replace(get_route, post_route, 1)
idx.write_text(i)

# User Control Center add/unsubscribe controls.
ucc = Path('admin-crm/app/UserControlCenter.tsx')
u = ucc.read_text()
state_anchor = '  const [notice, setNotice] = useState("");\n'
state_add = '''  const [showAddUser, setShowAddUser] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [newCity, setNewCity] = useState("Windsor");
  const [newRegion, setNewRegion] = useState("Ontario");
  const [newCountry, setNewCountry] = useState("Canada");
  const [newCountryCode, setNewCountryCode] = useState("CA");
  const [newTimezone, setNewTimezone] = useState("America/Toronto");
  const [newLat, setNewLat] = useState("42.3149");
  const [newLng, setNewLng] = useState("-83.0364");
'''
if 'const [showAddUser' not in u:
    if state_anchor not in u:
        raise SystemExit('Could not find UserControlCenter state anchor')
    u = u.replace(state_anchor, state_anchor + state_add, 1)

filtered_anchor = '  const filteredUsers = useMemo(() => users.filter((u) => `${u.email} ${u.display_name || ""} ${u.city || ""} ${u.region || ""} ${u.country_name || ""} ${u.timezone}`.toLowerCase().includes(query.toLowerCase())), [users, query]);\n'
add_fn = '''  const addUser = async () => {
    const latitude = Number(newLat); const longitude = Number(newLng);
    if (!newEmail.trim()) { setError("Email is required"); return; }
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) { setError("Valid latitude and longitude are required"); return; }
    setBusy(true); setError(""); setNotice("");
    try {
      const created = await api<{ subscriber?: { public_id?: string } }>("/admin/subscribers", { method: "POST", body: JSON.stringify({ email: newEmail.trim(), displayName: newName.trim(), locale: "en", latitude, longitude, timezone: newTimezone.trim(), countryCode: newCountryCode.trim().toUpperCase(), countryName: newCountry.trim(), region: newRegion.trim(), city: newCity.trim(), calculationMethod: 3, madhab: "standard" }) });
      setNotice("User added and activated"); setShowAddUser(false); setNewEmail(""); setNewName("");
      await loadLists(); if (created.subscriber?.public_id) await openUser(created.subscriber.public_id);
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to add user"); }
    finally { setBusy(false); }
  };

'''
if 'const addUser = async () =>' not in u:
    if filtered_anchor not in u:
        raise SystemExit('Could not find filteredUsers anchor')
    u = u.replace(filtered_anchor, add_fn + filtered_anchor, 1)

render_anchor = '    {error ? <div style={s.error}>{error}</div> : null}{notice ? <div style={s.success}>{notice}</div> : null}\n    <div style={s.toolbar}>'
add_panel = '''    {error ? <div style={s.error}>{error}</div> : null}{notice ? <div style={s.success}>{notice}</div> : null}
    <div style={{display:"flex",justifyContent:"flex-end",marginBottom:12}}><button style={s.primary} onClick={() => setShowAddUser(v => !v)}>{showAddUser ? "Cancel" : "＋ Add user"}</button></div>
    {showAddUser ? <section style={{background:"white",border:"1px solid #d7dfd9",borderRadius:16,padding:16,marginBottom:16}}><h3 style={{marginTop:0}}>Add active subscriber</h3><p style={s.muted}>Create the subscriber directly from admin without sending a verification email.</p><div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(210px,1fr))",gap:10}}><input style={s.search} placeholder="Email *" value={newEmail} onChange={e=>setNewEmail(e.target.value)} /><input style={s.search} placeholder="Display name" value={newName} onChange={e=>setNewName(e.target.value)} /><input style={s.search} placeholder="City" value={newCity} onChange={e=>setNewCity(e.target.value)} /><input style={s.search} placeholder="Region" value={newRegion} onChange={e=>setNewRegion(e.target.value)} /><input style={s.search} placeholder="Country" value={newCountry} onChange={e=>setNewCountry(e.target.value)} /><input style={s.search} placeholder="Country code" value={newCountryCode} onChange={e=>setNewCountryCode(e.target.value)} /><input style={s.search} placeholder="Timezone" value={newTimezone} onChange={e=>setNewTimezone(e.target.value)} /><input style={s.search} placeholder="Latitude *" value={newLat} onChange={e=>setNewLat(e.target.value)} /><input style={s.search} placeholder="Longitude *" value={newLng} onChange={e=>setNewLng(e.target.value)} /></div><div style={{marginTop:12}}><button style={s.primary} disabled={busy} onClick={() => void addUser()}>{busy ? "Adding…" : "Add & activate user"}</button></div></section> : null}
    <div style={s.toolbar}>'''
if 'Add active subscriber' not in u:
    if render_anchor not in u:
        raise SystemExit('Could not find UserControlCenter render anchor')
    u = u.replace(render_anchor, add_panel, 1)

old_head = '<div style={s.detailHead}><div><p style={s.eyebrow}>USER 360</p><h2 style={s.h2}>{x.display_name || x.email}</h2><p style={s.muted}>{x.email} · {x.public_id}</p></div><span style={s.status}>{x.status}</span></div>'
new_head = '<div style={s.detailHead}><div><p style={s.eyebrow}>USER 360</p><h2 style={s.h2}>{x.display_name || x.email}</h2><p style={s.muted}>{x.email} · {x.public_id}</p></div><div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}><span style={s.status}>{x.status}</span><button style={x.status === "unsubscribed" ? s.primary : s.secondary} onClick={() => void run(async () => { await api(`/admin/subscribers/${selected}/status`, { method:"POST", body:JSON.stringify({status:x.status === "unsubscribed" ? "active" : "unsubscribed"}) }); }, x.status === "unsubscribed" ? "User reactivated" : "User unsubscribed")}>{x.status === "unsubscribed" ? "Reactivate" : "Unsubscribe"}</button></div></div>'
if old_head in u:
    u = u.replace(old_head, new_head, 1)
elif new_head not in u:
    raise SystemExit('Could not find UserEditor header')
ucc.write_text(u)

Path('admin-crm/.vercel-force-crm-user-fix-20260825.txt').write_text('CRM routes, clickable cards, add user, unsubscribe/reactivate fixed\n')
