import type { Env } from "./types";

const JSON_HEADERS={"Content-Type":"application/json","Cache-Control":"no-store"};
const html=(body:string,status=200)=>new Response(body,{status,headers:{"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-store"}});
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:JSON_HEADERS});
const enc=new TextEncoder();
async function sha(value:string){const b=await crypto.subtle.digest("SHA-256",enc.encode(value));return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,"0")).join("");}
function token(bytes=32){const a=new Uint8Array(bytes);crypto.getRandomValues(a);return [...a].map(x=>x.toString(16).padStart(2,"0")).join("");}
function otp(){const a=new Uint32Array(1);crypto.getRandomValues(a);return String(100000+(a[0]%900000));}
function publicId(prefix:string){return `${prefix}_${token(12)}`;}
function esc(s:string){return s.replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]||c));}
function base(env:Env){return (env.PUBLIC_API_URL||"https://wopt-prayer-push.wopt-windsor.workers.dev").replace(/\/$/,"");}
function clientId(env:Env){return env.ALEXA_ACCOUNT_LINK_CLIENT_ID||"hassoun-alexa";}
function validRedirect(value:string){try{const u=new URL(value);return u.protocol==="https:"&&["pitangui.amazon.com","layla.amazon.com","alexa.amazon.co.jp"].includes(u.hostname)&&u.pathname.startsWith("/api/skill/link/");}catch{return false;}}
async function accountForEmail(env:Env,email:string){
  const normalized=email.trim().toLowerCase();
  let row=await env.DB.prepare("SELECT id,public_id,email,display_name FROM voice_accounts WHERE email=? AND status='active'").bind(normalized).first<any>();
  if(row)return row;
  const subscriber=await env.DB.prepare("SELECT display_name,latitude,longitude,timezone,calculation_method,madhab,city,region FROM email_subscribers WHERE email=? AND status='active'").bind(normalized).first<any>();
  const pid=publicId("va");
  await env.DB.prepare("INSERT INTO voice_accounts(public_id,email,display_name) VALUES(?,?,?)").bind(pid,normalized,subscriber?.display_name||null).run();
  row=await env.DB.prepare("SELECT id,public_id,email,display_name FROM voice_accounts WHERE public_id=?").bind(pid).first<any>();
  if(subscriber&&row){
    const name=[subscriber.city,subscriber.region].filter(Boolean).join(", ")||"Home";
    await env.DB.prepare("INSERT INTO voice_locations(public_id,account_id,name,latitude,longitude,timezone,calculation_method,madhab,is_default) VALUES(?,?,?,?,?,?,?,?,1)")
      .bind(publicId("vl"),row.id,name,subscriber.latitude,subscriber.longitude,subscriber.timezone,subscriber.calculation_method||null,subscriber.madhab||"standard").run();
  }
  return row;
}
async function sendCode(env:Env,email:string,code:string){
  if(!env.RESEND_API_KEY||!env.EMAIL_FROM)throw new Error("EMAIL_NOT_CONFIGURED");
  const r=await fetch("https://api.resend.com/emails",{method:"POST",headers:{Authorization:`Bearer ${env.RESEND_API_KEY}`,"Content-Type":"application/json"},body:JSON.stringify({from:env.EMAIL_FROM,to:[email],subject:"Your Hassoun verification code",html:`<div style=\"font-family:Arial,sans-serif\"><h2>Hassoun verification</h2><p>Your one-time code is:</p><div style=\"font-size:34px;font-weight:800;letter-spacing:6px\">${code}</div><p>This code expires in 10 minutes.</p></div>`,text:`Your Hassoun verification code is ${code}. It expires in 10 minutes.`,reply_to:env.EMAIL_REPLY_TO||undefined})});
  if(!r.ok)throw new Error(`EMAIL_${r.status}`);
}
function authorizePage(params:URLSearchParams,message=""){
  const client=params.get("client_id")||"",redirect=params.get("redirect_uri")||"",state=params.get("state")||"",scope=params.get("scope")||"voice_profile";
  return `<!doctype html><html><head><meta name=viewport content="width=device-width,initial-scale=1"><title>Link Hassoun to Alexa</title></head><body style="margin:0;background:#f7f4ec;font-family:Arial,sans-serif;color:#17362e"><main style="max-width:520px;margin:0 auto;padding:32px 20px"><div style="background:#0b5b47;color:white;padding:24px;border-radius:24px"><div style="font-size:12px;font-weight:800;letter-spacing:.12em">HASSOUN + ALEXA</div><h1 style="margin:8px 0 8px">Link your Hassoun profile</h1><p style="margin:0;color:#d9eee7;line-height:1.5">Sign in by email so Alexa can use your saved prayer location and per-device settings.</p></div>${message?`<p style="padding:12px 14px;background:#fff7df;border-radius:14px">${esc(message)}</p>`:""}<form method=post action="${base({PUBLIC_API_URL:""} as Env)}/oauth/alexa/request-code" style="margin-top:18px;background:white;padding:20px;border-radius:20px"><input type=hidden name=client_id value="${esc(client)}"><input type=hidden name=redirect_uri value="${esc(redirect)}"><input type=hidden name=state value="${esc(state)}"><input type=hidden name=scope value="${esc(scope)}"><label style="font-weight:700">Email</label><input required type=email name=email autocomplete=email style="box-sizing:border-box;width:100%;margin-top:8px;padding:13px;border:1px solid #cfdad5;border-radius:12px;font-size:16px"><button style="width:100%;margin-top:14px;padding:14px;border:0;border-radius:12px;background:#0b5b47;color:white;font-weight:800;font-size:16px">Email me a code</button></form></main></body></html>`;
}
function verifyPage(email:string,requestId:string){return `<!doctype html><html><head><meta name=viewport content="width=device-width,initial-scale=1"><title>Verify Hassoun</title></head><body style="margin:0;background:#f7f4ec;font-family:Arial,sans-serif;color:#17362e"><main style="max-width:520px;margin:0 auto;padding:32px 20px"><h1>Check your email</h1><p>Enter the six-digit code sent to <b>${esc(email)}</b>.</p><form method=post action="${base({PUBLIC_API_URL:""} as Env)}/oauth/alexa/verify" style="background:white;padding:20px;border-radius:20px"><input type=hidden name=request_id value="${esc(requestId)}"><input inputmode=numeric pattern="[0-9]{6}" maxlength=6 required name=code style="box-sizing:border-box;width:100%;padding:14px;border:1px solid #cfdad5;border-radius:12px;font-size:28px;letter-spacing:8px;text-align:center"><button style="width:100%;margin-top:14px;padding:14px;border:0;border-radius:12px;background:#0b5b47;color:white;font-weight:800">Link Alexa</button></form></main></body></html>`;}

export async function handleVoiceAccounts(request:Request,env:Env){
  const url=new URL(request.url);
  if(url.pathname==="/oauth/alexa/authorize"&&request.method==="GET"){
    if(url.searchParams.get("client_id")!==clientId(env)||!validRedirect(url.searchParams.get("redirect_uri")||""))return html("Invalid Alexa account-linking request",400);
    return html(authorizePage(url.searchParams).replace(/https:\/\/wopt-prayer-push\.wopt-windsor\.workers\.dev/g,base(env)));
  }
  if(url.pathname==="/oauth/alexa/request-code"&&request.method==="POST"){
    const form=await request.formData(); const email=String(form.get("email")||"").trim().toLowerCase(); const cid=String(form.get("client_id")||""); const redirect=String(form.get("redirect_uri")||""); const state=String(form.get("state")||""); const scope=String(form.get("scope")||"voice_profile");
    if(!/^\S+@\S+\.\S+$/.test(email)||cid!==clientId(env)||!validRedirect(redirect))return html("Invalid request",400);
    const account=await accountForEmail(env,email); const code=otp(); const reqId=publicId("vr");
    await env.DB.prepare("INSERT INTO voice_login_codes(account_id,code_hash,purpose,request_json,expires_at) VALUES(?,?, 'oauth', ?, datetime('now','+10 minutes'))")
      .bind(account.id,await sha(code),JSON.stringify({requestId:reqId,client_id:cid,redirect_uri:redirect,state,scope})).run();
    try{await sendCode(env,email,code);}catch{return html("Unable to send verification email right now.",503);}
    return html(verifyPage(email,reqId).replace(/https:\/\/wopt-prayer-push\.wopt-windsor\.workers\.dev/g,base(env)));
  }
  if(url.pathname==="/oauth/alexa/verify"&&request.method==="POST"){
    const form=await request.formData(); const reqId=String(form.get("request_id")||""); const code=String(form.get("code")||"");
    const rows=await env.DB.prepare("SELECT id,account_id,code_hash,request_json FROM voice_login_codes WHERE purpose='oauth' AND consumed_at IS NULL AND expires_at>CURRENT_TIMESTAMP ORDER BY id DESC LIMIT 30").all<any>();
    const row=(rows.results||[]).find((r:any)=>{try{return JSON.parse(r.request_json||"{}").requestId===reqId;}catch{return false;}});
    if(!row||await sha(code)!==row.code_hash)return html("Invalid or expired code",401);
    const req=JSON.parse(row.request_json); const authCode=token(32);
    await env.DB.batch([env.DB.prepare("UPDATE voice_login_codes SET consumed_at=CURRENT_TIMESTAMP WHERE id=?").bind(row.id),env.DB.prepare("INSERT INTO voice_oauth_codes(account_id,code_hash,client_id,redirect_uri,expires_at) VALUES(?,?,?,?,datetime('now','+5 minutes'))").bind(row.account_id,await sha(authCode),req.client_id,req.redirect_uri)]);
    const dest=new URL(req.redirect_uri);dest.searchParams.set("code",authCode);if(req.state)dest.searchParams.set("state",req.state);return Response.redirect(dest.toString(),302);
  }
  if(url.pathname==="/oauth/alexa/token"&&request.method==="POST"){
    const form=await request.formData(); let cid=String(form.get("client_id")||""),secret=String(form.get("client_secret")||""); const auth=request.headers.get("authorization")||"";
    if(auth.startsWith("Basic ")){try{const [u,p]=atob(auth.slice(6)).split(":");cid=decodeURIComponent(u);secret=decodeURIComponent(p);}catch{}}
    if(cid!==clientId(env)||!env.ALEXA_ACCOUNT_LINK_CLIENT_SECRET||secret!==env.ALEXA_ACCOUNT_LINK_CLIENT_SECRET)return json({error:"invalid_client"},401);
    const grant=String(form.get("grant_type")||""); let accountId:number|null=null;
    if(grant==="authorization_code"){
      const code=String(form.get("code")||""); const redirect=String(form.get("redirect_uri")||""); const row=await env.DB.prepare("SELECT id,account_id,redirect_uri FROM voice_oauth_codes WHERE code_hash=? AND client_id=? AND consumed_at IS NULL AND expires_at>CURRENT_TIMESTAMP").bind(await sha(code),cid).first<any>();
      if(!row||row.redirect_uri!==redirect)return json({error:"invalid_grant"},400);accountId=row.account_id;await env.DB.prepare("UPDATE voice_oauth_codes SET consumed_at=CURRENT_TIMESTAMP WHERE id=?").bind(row.id).run();
    } else if(grant==="refresh_token"){
      const refresh=String(form.get("refresh_token")||""); const row=await env.DB.prepare("SELECT id,account_id FROM voice_oauth_tokens WHERE refresh_token_hash=? AND revoked_at IS NULL AND refresh_expires_at>CURRENT_TIMESTAMP").bind(await sha(refresh)).first<any>(); if(!row)return json({error:"invalid_grant"},400);accountId=row.account_id;await env.DB.prepare("UPDATE voice_oauth_tokens SET revoked_at=CURRENT_TIMESTAMP WHERE id=?").bind(row.id).run();
    } else return json({error:"unsupported_grant_type"},400);
    const access=token(32),refresh=token(32); await env.DB.prepare("INSERT INTO voice_oauth_tokens(account_id,access_token_hash,refresh_token_hash,access_expires_at,refresh_expires_at) VALUES(?,?,?,datetime('now','+1 hour'),datetime('now','+180 days'))").bind(accountId,await sha(access),await sha(refresh)).run();
    return json({access_token:access,token_type:"Bearer",expires_in:3600,refresh_token:refresh,scope:"voice_profile"});
  }
  if(url.pathname==="/voice/account/request-code"&&request.method==="POST"){
    const body=await request.json<any>().catch(()=>({}));const email=String(body.email||"").trim().toLowerCase();if(!/^\S+@\S+\.\S+$/.test(email))return json({error:"Invalid email"},400);const account=await accountForEmail(env,email);const code=otp();const reqId=publicId("vm");await env.DB.prepare("INSERT INTO voice_login_codes(account_id,code_hash,purpose,request_json,expires_at) VALUES(?,?, 'manage', ?, datetime('now','+10 minutes'))").bind(account.id,await sha(code),JSON.stringify({requestId:reqId})).run();try{await sendCode(env,email,code);}catch{return json({error:"Unable to send code"},503);}return json({ok:true,requestId:reqId});
  }
  if(url.pathname==="/voice/account/verify"&&request.method==="POST"){
    const body=await request.json<any>().catch(()=>({}));const rows=await env.DB.prepare("SELECT id,account_id,code_hash,request_json FROM voice_login_codes WHERE purpose='manage' AND consumed_at IS NULL AND expires_at>CURRENT_TIMESTAMP ORDER BY id DESC LIMIT 30").all<any>();const row=(rows.results||[]).find((r:any)=>{try{return JSON.parse(r.request_json||"{}").requestId===String(body.requestId||"");}catch{return false;}});if(!row||await sha(String(body.code||""))!==row.code_hash)return json({error:"Invalid or expired code"},401);const session=token(32);await env.DB.batch([env.DB.prepare("UPDATE voice_login_codes SET consumed_at=CURRENT_TIMESTAMP WHERE id=?").bind(row.id),env.DB.prepare("INSERT INTO voice_sessions(account_id,token_hash,expires_at) VALUES(?,?,datetime('now','+30 days'))").bind(row.account_id,await sha(session))]);return json({token:session,expiresIn:2592000});
  }
  const bearer=(request.headers.get("authorization")||"").replace(/^Bearer\s+/i,"");
  if(url.pathname.startsWith("/voice/account")){
    if(!bearer)return json({error:"Unauthorized"},401);const session=await env.DB.prepare("SELECT account_id FROM voice_sessions WHERE token_hash=? AND revoked_at IS NULL AND expires_at>CURRENT_TIMESTAMP").bind(await sha(bearer)).first<any>();if(!session)return json({error:"Unauthorized"},401);const aid=session.account_id;
    if(url.pathname==="/voice/account"&&request.method==="GET"){
      const account=await env.DB.prepare("SELECT public_id,email,display_name FROM voice_accounts WHERE id=?").bind(aid).first<any>();const locations=(await env.DB.prepare("SELECT public_id,name,latitude,longitude,timezone,calculation_method,madhab,is_default FROM voice_locations WHERE account_id=? ORDER BY is_default DESC,id").bind(aid).all<any>()).results||[];const devices=(await env.DB.prepare("SELECT d.public_id,d.label,d.last_seen_at,l.public_id AS location_public_id,l.name AS location_name FROM alexa_devices d LEFT JOIN voice_locations l ON l.id=d.location_id WHERE d.account_id=? ORDER BY d.last_seen_at DESC").bind(aid).all<any>()).results||[];return json({account,locations,devices});
    }
    if(url.pathname==="/voice/account/locations"&&request.method==="POST"){
      const b=await request.json<any>().catch(()=>({}));const lat=Number(b.latitude),lon=Number(b.longitude);if(!Number.isFinite(lat)||!Number.isFinite(lon)||lat<-90||lat>90||lon<-180||lon>180||!b.timezone)return json({error:"Invalid location"},400);if(b.isDefault)await env.DB.prepare("UPDATE voice_locations SET is_default=0 WHERE account_id=?").bind(aid).run();const pid=publicId("vl");await env.DB.prepare("INSERT INTO voice_locations(public_id,account_id,name,latitude,longitude,timezone,calculation_method,madhab,is_default) VALUES(?,?,?,?,?,?,?,?,?)").bind(pid,aid,String(b.name||"Location").slice(0,80),lat,lon,String(b.timezone).slice(0,80),Number.isFinite(Number(b.calculationMethod))?Number(b.calculationMethod):null,b.madhab==="hanafi"?"hanafi":"standard",b.isDefault?1:0).run();return json({ok:true,publicId:pid});
    }
    if(url.pathname==="/voice/account/device-location"&&request.method==="POST"){
      const b=await request.json<any>().catch(()=>({}));const device=await env.DB.prepare("SELECT id FROM alexa_devices WHERE public_id=? AND account_id=?").bind(String(b.deviceId||""),aid).first<any>();const loc=await env.DB.prepare("SELECT id FROM voice_locations WHERE public_id=? AND account_id=?").bind(String(b.locationId||""),aid).first<any>();if(!device||!loc)return json({error:"Device or location not found"},404);await env.DB.prepare("UPDATE alexa_devices SET location_id=?,label=COALESCE(?,label),updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(loc.id,b.label?String(b.label).slice(0,80):null,device.id).run();return json({ok:true});
    }
  }
  return null;
}

export async function applyLinkedAlexaLocation(request:Request,env:Env){
  const auth=(request.headers.get("authorization")||"").replace(/^Bearer\s+/i,"");if(!auth)return request;const tok=await env.DB.prepare("SELECT account_id FROM voice_oauth_tokens WHERE access_token_hash=? AND revoked_at IS NULL AND access_expires_at>CURRENT_TIMESTAMP").bind(await sha(auth)).first<any>();if(!tok)return request;
  const userHash=await sha(request.headers.get("x-alexa-user-id")||"unknown");const deviceHash=await sha(request.headers.get("x-alexa-device-id")||"unknown");let device=await env.DB.prepare("SELECT id,public_id,location_id FROM alexa_devices WHERE account_id=? AND alexa_device_hash=?").bind(tok.account_id,deviceHash).first<any>();if(!device){const pid=publicId("ad");await env.DB.prepare("INSERT INTO alexa_devices(public_id,account_id,alexa_user_hash,alexa_device_hash) VALUES(?,?,?,?)").bind(pid,tok.account_id,userHash,deviceHash).run();device=await env.DB.prepare("SELECT id,public_id,location_id FROM alexa_devices WHERE public_id=?").bind(pid).first<any>();}else await env.DB.prepare("UPDATE alexa_devices SET last_seen_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(device.id).run();
  let loc=device?.location_id?await env.DB.prepare("SELECT * FROM voice_locations WHERE id=? AND account_id=?").bind(device.location_id,tok.account_id).first<any>():null;if(!loc)loc=await env.DB.prepare("SELECT * FROM voice_locations WHERE account_id=? ORDER BY is_default DESC,id ASC LIMIT 1").bind(tok.account_id).first<any>();if(!loc)return request;const u=new URL(request.url);u.searchParams.set("latitude",String(loc.latitude));u.searchParams.set("longitude",String(loc.longitude));u.searchParams.set("timezone",String(loc.timezone));u.searchParams.set("location",String(loc.name));if(loc.calculation_method!=null)u.searchParams.set("method",String(loc.calculation_method));if(loc.madhab)u.searchParams.set("school",String(loc.madhab));return new Request(u.toString(),request);
}
