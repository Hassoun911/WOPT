"use client";

import { useEffect } from "react";

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || "";
const appPath = (path:string)=>`${BASE_PATH}${path}`;
const LOGO = "/hassoun-brand.svg?v=20260825-exact-5";

const items = [
  { icon:"✉️", title:"Contact Us", text:"Send a support request, report an issue or share feedback with Hassoun.", href:"/support/" },
  { icon:"🕌", title:"Ask the Sheikh", text:"Ask an Islamic question and review Qur’an and Sunnah references.", href:"/ask-sheikh/" },
  { icon:"🔔", title:"Prayer alerts", text:"Manage prayer reminders and browser notifications.", href:"/?open=alerts" },
  { icon:"⚙️", title:"Settings", text:"Language, appearance, prayer schedule and app preferences.", href:"/?open=settings" },
  { icon:"🎙️", title:"Voice Assistants", text:"Connect Hassoun with Amazon Alexa and Google Home for prayer times, Islamic events and smart Adhan automations.", href:"/voice-assistants/" },
  { icon:"🔗", title:"Connect Display", text:"Enter the 6-digit code shown on a Masjid TV, tablet or computer display.", href:"/masjid-tv/pair/" },
  { icon:"▤", title:"My Displays", text:"Manage paired TVs, tablets, iPads and computer screens.", href:"/masjid-tv/devices/" },
  { icon:"🕋", title:"Qibla", text:"Use location and compass direction to face the Kaaba.", href:"/qibla/" },
  { icon:"🌙", title:"Islamic events", text:"Hijri dates, Ramadan, Eid, Arafah and other important events.", href:"/events/" },
  { icon:"🎮", title:"Islamic games", text:"Practice Islamic knowledge with saved quiz progress.", href:"/games/" },
  { icon:"۞", title:"Qur’an", text:"Read, search, listen, bookmark and use memorization tools.", href:"/quran/" },
  { icon:"📧", title:"Email prayer alerts", text:"Manage email delivery for Windsor prayer reminders.", href:"/email/manage/" },
  { icon:"ℹ️", title:"About Hassoun", text:"Learn about the app, privacy and project purpose.", href:"/about/" },
  { icon:"🔒", title:"Privacy", text:"Review privacy and data handling information.", href:"/privacy/" },
];

export default function MorePage(){
  useEffect(()=>{
    const html=document.documentElement;
    const body=document.body;
    const previous={
      htmlHeight:html.style.getPropertyValue("height"),
      htmlMinHeight:html.style.getPropertyValue("min-height"),
      htmlOverflow:html.style.getPropertyValue("overflow"),
      htmlOverflowX:html.style.getPropertyValue("overflow-x"),
      htmlOverflowY:html.style.getPropertyValue("overflow-y"),
      bodyHeight:body.style.getPropertyValue("height"),
      bodyMinHeight:body.style.getPropertyValue("min-height"),
      bodyOverflow:body.style.getPropertyValue("overflow"),
      bodyOverflowX:body.style.getPropertyValue("overflow-x"),
      bodyOverflowY:body.style.getPropertyValue("overflow-y"),
    };

    html.style.setProperty("height","auto","important");
    html.style.setProperty("min-height","100%","important");
    html.style.setProperty("overflow-x","hidden","important");
    html.style.setProperty("overflow-y","auto","important");
    body.style.setProperty("height","auto","important");
    body.style.setProperty("min-height","100dvh","important");
    body.style.setProperty("overflow-x","hidden","important");
    body.style.setProperty("overflow-y","auto","important");

    return ()=>{
      const restore=(el:HTMLElement,name:string,value:string)=>value?el.style.setProperty(name,value):el.style.removeProperty(name);
      restore(html,"height",previous.htmlHeight);
      restore(html,"min-height",previous.htmlMinHeight);
      restore(html,"overflow",previous.htmlOverflow);
      restore(html,"overflow-x",previous.htmlOverflowX);
      restore(html,"overflow-y",previous.htmlOverflowY);
      restore(body,"height",previous.bodyHeight);
      restore(body,"min-height",previous.bodyMinHeight);
      restore(body,"overflow",previous.bodyOverflow);
      restore(body,"overflow-x",previous.bodyOverflowX);
      restore(body,"overflow-y",previous.bodyOverflowY);
    };
  },[]);

  return <main className="parity-page" style={{minHeight:"100dvh"}}><section className="parity-hero"><div><div className="eyebrow">HASSOUN</div><h1>More</h1><p>Support, settings and all Hassoun web tools in one place.</p></div><div className="hero-badge" style={{overflow:"hidden",padding:8,background:"#0b5b47",display:"flex",alignItems:"center",justifyContent:"center"}}><img src={appPath(LOGO)} alt="Hassoun" data-hassoun-brand="official" style={{width:"100%",height:"100%",objectFit:"contain",display:"block"}}/></div></section><section className="more-grid">{items.map(item=><a className="more-card" href={appPath(item.href)} key={item.title}><span>{item.icon}</span><div><h2>{item.title}</h2><p>{item.text}</p></div><b>›</b></a>)}</section></main>;
}