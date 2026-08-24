"use client";

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || "";
const appPath = (path:string)=>`${BASE_PATH}${path}`;

const items = [
  { icon:"🕌", title:"Ask the Sheikh", text:"Ask an Islamic question and review Qur’an and Sunnah references.", href:"/ask-sheikh/" },
  { icon:"🔔", title:"Prayer alerts", text:"Manage prayer reminders and browser notifications.", href:"/?open=alerts" },
  { icon:"⚙️", title:"Settings", text:"Language, appearance, prayer schedule and app preferences.", href:"/?open=settings" },
  { icon:"🕋", title:"Qibla", text:"Use location and compass direction to face the Kaaba.", href:"/qibla/" },
  { icon:"🌙", title:"Islamic events", text:"Hijri dates, Ramadan, Eid, Arafah and other important events.", href:"/events/" },
  { icon:"🎮", title:"Islamic games", text:"Practice Islamic knowledge with saved quiz progress.", href:"/games/" },
  { icon:"۞", title:"Qur’an", text:"Read, search, listen, bookmark and use memorization tools.", href:"/quran/" },
  { icon:"✉️", title:"Email prayer alerts", text:"Manage email delivery for Windsor prayer reminders.", href:"/email/manage/" },
  { icon:"ℹ️", title:"About Hassoun", text:"Learn about the app, privacy and project purpose.", href:"/about/" },
  { icon:"🔒", title:"Privacy", text:"Review privacy and data handling information.", href:"/privacy/" },
];

export default function MorePage(){return <main className="parity-page"><section className="parity-hero"><div><div className="eyebrow">HASSOUN</div><h1>More</h1><p>All web features in one place, arranged to mirror the Android app.</p></div><div className="hero-badge">☰</div></section><section className="more-grid">{items.map(item=><a className="more-card" href={appPath(item.href)} key={item.title}><span>{item.icon}</span><div><h2>{item.title}</h2><p>{item.text}</p></div><b>›</b></a>)}</section></main>}
