import fs from 'node:fs';

const pushPath='app/admin/push/page.tsx';
const emailPath='app/admin/email/page.tsx';

let push=fs.readFileSync(pushPath,'utf8');
push=push.replace(
  "type P={public_id:string;name:string;title_en:string;status:string;target_platform:string;target_locale:string;target_country_code?:string;target_city?:string;scheduled_at?:string;sent_at?:string;sent_count?:number;failed_count?:number;delivery_count?:number};",
  "type P={public_id:string;name:string;title_en:string;title_ar?:string|null;body_en:string;body_ar?:string|null;status:string;target_platform:string;target_locale:string;target_country_code?:string;target_city?:string;scheduled_at?:string;sent_at?:string;sent_count?:number;failed_count?:number;delivery_count?:number};"
);

if(!push.includes('const editCampaign=(x:P)=>')){
  push=push.replace(
    "[notice,setNotice]=useState('');const load=",
    "[notice,setNotice]=useState(''),[editingFrom,setEditingFrom]=useState('');const load="
  );
  const marker="const clearTicker=async()=>";
  const actions=`const editCampaign=(x:P)=>{setTitle(x.title_en||x.name);setTitleAr(x.title_ar||'');setBody(x.body_en||'');setBodyAr(x.body_ar||'');setPlatform(x.target_platform||'all');setLocale(x.target_locale||'all');setCountry(x.target_country_code||'');setCity(x.target_city||'');setWhen('');setPushEnabled(true);setEditingFrom(x.public_id);setNotice('Loaded previous push for editing. Change anything you want, then send the edited copy.');window.scrollTo({top:0,behavior:'smooth'})};const resendCampaign=async(x:P)=>{if(!confirm('Resend this push now?'))return;setBusy(true);setError('');setNotice('');try{await call('/admin/push/campaigns',token,{method:'POST',body:JSON.stringify({name:x.name||x.title_en,titleEn:x.title_en,titleAr:x.title_ar||undefined,bodyEn:x.body_en,bodyAr:x.body_ar||undefined,category:'announcement',audience:'all_devices',targetPlatform:x.target_platform||'all',targetLocale:x.target_locale||'all',targetCountryCode:x.target_country_code||undefined,targetCity:x.target_city||undefined,priority:'high',scheduledAt:new Date().toISOString()})});setNotice('Push resent and queued for delivery.');await load()}catch(e){setError(String((e as Error).message||e))}finally{setBusy(false)}};const deleteCampaign=async(x:P)=>{if(!confirm('Delete this push campaign from CRM history?'))return;setBusy(true);setError('');setNotice('');try{await call('/admin/push/campaigns/'+encodeURIComponent(x.public_id),token,{method:'DELETE'});setNotice('Push campaign deleted.');await load()}catch(e){setError(String((e as Error).message||e))}finally{setBusy(false)}};`;
  if(!push.includes(marker)) throw new Error('Push clearTicker marker not found');
  push=push.replace(marker,actions+marker);
}

push=push.replace("setWhen('');await load()","setWhen('');setEditingFrom('');await load()");
push=push.replace("{busy?'Saving…':when?'Schedule message':'Send / activate now'}","{busy?'Saving…':editingFrom?'Send edited copy':when?'Schedule message':'Send / activate now'}");

const oldRow="<div key={x.public_id} className=\"msg-row\"><div><strong>{x.title_en||x.name}</strong><small>{x.target_platform} · {x.target_locale} {x.scheduled_at?`· ${new Date(x.scheduled_at).toLocaleString()}`:''}</small></div><div className=\"msg-metrics\"><span>{x.status==='scheduled'&&x.scheduled_at&&new Date(x.scheduled_at)<=new Date()?'queued':x.status}</span><small>{x.sent_count||0} sent · {x.failed_count||0} failed</small></div></div>";
const newRow="<div key={x.public_id} className=\"msg-row\"><div><strong>{x.title_en||x.name}</strong><small>{x.target_platform} · {x.target_locale} {x.scheduled_at?`· ${new Date(x.scheduled_at).toLocaleString()}`:''}</small><div className=\"msg-actions\"><button type=\"button\" onClick={()=>editCampaign(x)} disabled={busy}>✏️ Edit & resend</button><button type=\"button\" onClick={()=>void resendCampaign(x)} disabled={busy}>↻ Resend</button><button type=\"button\" className=\"delete\" onClick={()=>void deleteCampaign(x)} disabled={busy}>🗑 Delete</button></div></div><div className=\"msg-metrics\"><span>{x.status==='scheduled'&&x.scheduled_at&&new Date(x.scheduled_at)<=new Date()?'queued':x.status}</span><small>{x.sent_count||0} sent · {x.failed_count||0} failed</small></div></div>";
if(push.includes(oldRow)) push=push.replace(oldRow,newRow);
else if(!push.includes('Edit & resend')) throw new Error('Push row marker not found');

push=push.replace(
  ".msg-metrics{display:grid;text-align:right;white-space:nowrap}",
  ".msg-metrics{display:grid;text-align:right;white-space:nowrap}.msg-actions{display:flex;gap:7px;flex-wrap:wrap;margin-top:8px}.msg-actions button{border:1px solid #cfd9d5;background:#f7faf8;color:#174a3d;border-radius:9px;padding:7px 9px;font-weight:800;cursor:pointer}.msg-actions button.delete{background:#fff0ed;color:#9b3429;border-color:#efc5be}.msg-actions button:disabled{opacity:.55;cursor:not-allowed}"
);
fs.writeFileSync(pushPath,push);

let email=fs.readFileSync(emailPath,'utf8');
const oldEffect=`  useEffect(() => {\n    const saved = window.localStorage.getItem(TOKEN_KEY); if (!saved) return;\n    setToken(saved);\n    void api<{ admin: Admin }>(\"/admin/me\", {}, saved).then(async (res) => { setAdmin(res.admin); await load(saved); }).catch(() => { window.localStorage.removeItem(TOKEN_KEY); setToken(null); setAdmin(null); });\n  }, [load]);`;
const newEffect=`  useEffect(() => {\n    const saved = window.localStorage.getItem(TOKEN_KEY);\n    if (!saved) { setError(\"Open Owner Control Center and sign in first.\"); return; }\n    setToken(saved);\n    void api<{ admin: Admin }>(\"/admin/me\", {}, saved)\n      .then((res) => {\n        setAdmin(res.admin);\n        return load(saved).catch((cause) => setError(cause instanceof Error ? cause.message : \"Unable to load Email Center\"));\n      })\n      .catch((cause) => {\n        setError(cause instanceof Error ? cause.message : \"Admin session expired\");\n        setAdmin(null);\n      });\n  }, [load]);`;
if(email.includes(oldEffect)) email=email.replace(oldEffect,newEffect);
else if(!email.includes('Unable to load Email Center')) throw new Error('Email auth effect marker not found');

const oldLogin='  if (!token || !admin) return <main style={s.page}><form onSubmit={signIn} style={s.login}><p style={s.eyebrow}>HASSOUN ADMIN</p><h1 style={s.h1}>Email Center</h1><p style={s.muted}>Owner / admin access only.</p><label style={s.label}>Username or email</label><input value={login} onChange={(e)=>setLogin(e.target.value)} style={s.input}/><label style={s.label}>Password</label><input type="password" value={password} onChange={(e)=>setPassword(e.target.value)} style={s.input}/>{error?<p style={s.error}>{error}</p>:null}<button style={s.primary} disabled={busy}>{busy?"Signing in…":"Sign in"}</button><a href="../" style={s.link}>← Owner Control Center</a></form></main>;';
const newLogin='  if (!token || !admin) return <main style={s.page}><div style={s.login}><p style={s.eyebrow}>HASSOUN ADMIN</p><h1 style={s.h1}>Email Center</h1><p style={s.muted}>{error||"Use your existing Owner Control Center session."}</p><a href="../" style={s.primary}>← Return to Owner Control Center</a></div></main>;';
if(email.includes(oldLogin)) email=email.replace(oldLogin,newLogin);
else if(!email.includes('Use your existing Owner Control Center session.')) throw new Error('Email login panel marker not found');

if(!email.includes('async function testProfile(profile: Profile)')){
  const marker='  async function schedule(event: FormEvent) {';
  const fn=`  async function testProfile(profile: Profile) {\n    if (!token) return; setBusy(true); setError(\"\"); setNotice(\"\");\n    try {\n      await api(\"/admin/email/campaigns\", { method: \"POST\", body: JSON.stringify({ action: \"send_template_test\", templateKey: profile.template_key }) }, token);\n      setNotice(\`Test email for \${profile.name} sent to windsor.hassoun@gmail.com.\`);\n    } catch (cause) { setError(cause instanceof Error ? cause.message : \"Unable to send test email\"); }\n    finally { setBusy(false); }\n  }\n\n`;
  if(!email.includes(marker)) throw new Error('Email schedule marker not found');
  email=email.replace(marker,fn+marker);
}

const oldTitle='<div style={s.titleRow}><div><div style={s.smallCaps}>{profile.category}</div><h2 style={s.h2}>{profile.name}</h2><code style={s.code}>{profile.template_key}</code></div><Toggle on={profile.enabled===1} label="Template" onClick={()=>void toggleProfile(profile,"enabled")}/></div>';
const newTitle='<div style={s.titleRow}><div><div style={s.smallCaps}>{profile.category}</div><h2 style={s.h2}>{profile.name}</h2><code style={s.code}>{profile.template_key}</code></div><div style={{display:"grid",gap:8,justifyItems:"end"}}><Toggle on={profile.enabled===1} label="Template" onClick={()=>void toggleProfile(profile,"enabled")}/><button type="button" style={s.secondary} disabled={busy} onClick={()=>void testProfile(profile)}>✉ Test email</button><span style={s.small}>to windsor.hassoun@gmail.com</span></div></div>';
if(email.includes(oldTitle)) email=email.replace(oldTitle,newTitle);
else if(!email.includes('✉ Test email')) throw new Error('Email card title marker not found');

fs.writeFileSync(emailPath,email);

console.log('Applied CRM push actions, Email Center session fix, and per-template test buttons');
