"use client";

import { useEffect, useMemo, useState } from "react";

const KINDS = [
  { key:"twenty", title:"20 minutes before", text:"An early reminder so you have time to prepare." },
  { key:"ten", title:"10 minutes before", text:"A second reminder as prayer time approaches." },
  { key:"prayer", title:"At prayer time", text:"Notify you when the prayer time begins." },
] as const;
type Kind=(typeof KINDS)[number]["key"];
const STORAGE="wpt-alert-preferences";
const defaults:Record<Kind,boolean>={twenty:true,ten:true,prayer:true};

export default function AlertsPage(){
  const [prefs,setPrefs]=useState(defaults);
  const [permission,setPermission]=useState<NotificationPermission|"unsupported">("default");
  const [message,setMessage]=useState("");

  useEffect(()=>{
    try{const saved=JSON.parse(localStorage.getItem(STORAGE)||"null");if(saved)setPrefs({...defaults,...saved});}catch{}
    setPermission("Notification" in window?Notification.permission:"unsupported");
  },[]);

  const enabled=useMemo(()=>Object.values(prefs).filter(Boolean).length,[prefs]);
  async function toggle(key:Kind){
    if(!prefs[key]){
      if(!("Notification" in window)){setPermission("unsupported");setMessage("Browser notifications are not available on this device.");return;}
      const result=Notification.permission==="granted"?"granted":await Notification.requestPermission();
      setPermission(result);
      if(result!=="granted"){setMessage("Allow notifications in your browser to enable prayer alerts.");return;}
    }
    setPrefs(current=>{const next={...current,[key]:!current[key]};localStorage.setItem(STORAGE,JSON.stringify(next));localStorage.removeItem("wpt-alerts");return next;});
    setMessage("Prayer alert preferences saved on this browser.");
  }
  async function test(){
    if(!("Notification" in window)){setMessage("Notifications are not supported here.");return;}
    const result=Notification.permission==="granted"?"granted":await Notification.requestPermission();setPermission(result);
    if(result!=="granted"){setMessage("Notification permission is required for the test.");return;}
    new Notification("Hassoun prayer alert",{body:"Your browser notifications are working.",icon:"/hassoun-official-logo.jpg?v=20260825-official-2"});
    setMessage("Test notification sent.");
  }
  return <main className="utility-page"><section className="utility-hero"><div><div className="eyebrow">PRAYER ALERTS</div><h1>Browser prayer reminders</h1><p>Choose which reminders you want on this browser.</p></div><div className="utility-mark">🔔</div></section>
    <section className="utility-status"><div><strong>{permission==="granted"?"Notifications allowed":permission==="denied"?"Notifications blocked":permission==="unsupported"?"Unavailable":"Permission not requested"}</strong><span>{enabled}/3 reminders enabled</span></div><button onClick={test}>Test notification</button></section>
    <section className="utility-stack">{KINDS.map(item=><button key={item.key} className="utility-toggle-row" onClick={()=>toggle(item.key)}><span><strong>{item.title}</strong><small>{item.text}</small></span><i className={prefs[item.key]?"on":""}><b/></i></button>)}</section>
    {message?<p className="utility-message">{message}</p>:null}<a className="utility-back" href="/more/">← Back to More</a>
  </main>;
}
