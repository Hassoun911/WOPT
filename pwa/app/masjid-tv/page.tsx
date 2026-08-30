"use client";

import { useEffect, useMemo, useState } from "react";
import "./masjid-tv.css";

type PrayerKey = "fajr" | "dhuhr" | "asr" | "maghrib" | "isha";
type Layout = "grand" | "community" | "announcements" | "cinematic" | "board" | "jumuah" | "adaptive" | "minimal";
type Announcement = { id: string; title: string; body: string };
type Jumuah = { id: string; label: string; time: string };
type PrayerDay = Record<PrayerKey, string>;

type Settings = {
  layout: Layout;
  mosqueName: string;
  mosqueLocation: string;
  logoUrl: string;
  backgroundMode: "theme" | "image" | "video";
  backgroundUrl: string;
  backgroundColor: string;
  cardColor: string;
  accentColor: string;
  textColor: string;
  showLogo: boolean;
  showClock: boolean;
  showDate: boolean;
  showLocation: boolean;
  showNextPrayer: boolean;
  showPrayerCards: boolean;
  showIqama: boolean;
  showAnnouncements: boolean;
  showJumuah: boolean;
  showVerse: boolean;
  showDonation: boolean;
  verseText: string;
  websiteUrl: string;
  donationLabel: string;
  iqama: Record<PrayerKey, string>;
  announcements: Announcement[];
  jumuah: Jumuah[];
};

const STORAGE = "hassoun:web-masjid-tv:v2";
const LEGACY_STORAGE = "hassoun:web-masjid-tv:v1";
const DATA_URL = "https://raw.githubusercontent.com/Hassoun911/WOPT/main/windsor_islamic_association_2026_prayer_times.json";
const prayers: PrayerKey[] = ["fajr", "dhuhr", "asr", "maghrib", "isha"];
const layouts: { id: Layout; name: string; note: string }[] = [
  { id: "grand", name: "Grand", note: "Formal timetable + community board" },
  { id: "community", name: "Community", note: "Bright green/cream community layout" },
  { id: "announcements", name: "Announcements", note: "Large notices + prayer sidebar" },
  { id: "cinematic", name: "Cinematic", note: "Kaaba/video glass overlay" },
  { id: "board", name: "Prayer Board", note: "Traditional adhan/iqama timetable" },
  { id: "jumuah", name: "Jumu’ah", note: "Friday khutbah focused layout" },
  { id: "adaptive", name: "Adaptive", note: "Balanced smart information wall" },
  { id: "minimal", name: "Minimal", note: "Clock + next prayer + essentials" },
];
const names: Record<PrayerKey, { en: string; ar: string }> = {
  fajr: { en: "Fajr", ar: "الفجر" }, dhuhr: { en: "Dhuhr", ar: "الظهر" }, asr: { en: "Asr", ar: "العصر" }, maghrib: { en: "Maghrib", ar: "المغرب" }, isha: { en: "Isha", ar: "العشاء" }
};
const icons: Record<PrayerKey, string> = { fajr: "☾", dhuhr: "☀", asr: "◉", maghrib: "◒", isha: "☽" };
const DEFAULTS: Settings = {
  layout: "grand", mosqueName: "Your Masjid Name", mosqueLocation: "Mosque location not set", logoUrl: "",
  backgroundMode: "theme", backgroundUrl: "", backgroundColor: "#063d34", cardColor: "#0a5548", accentColor: "#e7bd59", textColor: "#ffffff",
  showLogo: true, showClock: true, showDate: true, showLocation: true, showNextPrayer: true, showPrayerCards: true, showIqama: true, showAnnouncements: true, showJumuah: true, showVerse: true, showDonation: true,
  verseText: "Indeed, in the remembrance of Allah do hearts find rest. — Qur’an 13:28", websiteUrl: "", donationLabel: "Support your Masjid",
  iqama: { fajr: "", dhuhr: "", asr: "", maghrib: "", isha: "" },
  announcements: [
    { id: "a1", title: "Qur’an Class", body: "Every Saturday after Maghrib" },
    { id: "a2", title: "Community Dinner", body: "Join us for dinner and community connection" },
    { id: "a3", title: "Youth Halaqa", body: "Spiritual reminders and discussion for our youth" }
  ],
  jumuah: [{ id: "j1", label: "1st Khutbah", time: "" }, { id: "j2", label: "2nd Khutbah", time: "" }]
};

const pad = (n: number) => String(n).padStart(2, "0");
const keyFor = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const toMinutes = (value: string) => { const [h, m] = value.split(":").map(Number); return h * 60 + m; };
const pretty = (value: string) => { if (!value || !value.includes(":")) return value || "—"; const [hRaw, m] = value.split(":").map(Number); const suffix = hRaw >= 12 ? "PM" : "AM"; const h = hRaw % 12 || 12; return `${h}:${pad(m)} ${suffix}`; };

export default function MasjidTvWebPage() {
  const [settings, setSettings] = useState<Settings>(DEFAULTS);
  const [adminOpen, setAdminOpen] = useState(false);
  const [now, setNow] = useState(new Date());
  const [today, setToday] = useState<PrayerDay>({ fajr: "05:00", dhuhr: "13:30", asr: "17:00", maghrib: "20:00", isha: "21:30" });

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE) || localStorage.getItem(LEGACY_STORAGE);
      if (raw) {
        const saved = JSON.parse(raw) as Partial<Settings>;
        setSettings({ ...DEFAULTS, ...saved, iqama: { ...DEFAULTS.iqama, ...(saved.iqama || {}) }, announcements: saved.announcements || DEFAULTS.announcements, jumuah: saved.jumuah || DEFAULTS.jumuah });
      }
    } catch {}
    const id = window.setInterval(() => setNow(new Date()), 1000);
    void fetch(DATA_URL).then(r => r.json()).then((data: { prayer_times?: Record<string, PrayerDay> }) => { const row = data.prayer_times?.[keyFor(new Date())]; if (row) setToday(row); }).catch(() => undefined);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => { try { localStorage.setItem(STORAGE, JSON.stringify(settings)); } catch {} }, [settings]);

  const update = <K extends keyof Settings>(key: K, value: Settings[K]) => setSettings(s => ({ ...s, [key]: value }));
  const current = useMemo(() => {
    const minute = now.getHours() * 60 + now.getMinutes();
    for (const prayer of prayers) if (toMinutes(today[prayer]) > minute) return prayer;
    return "fajr" as PrayerKey;
  }, [now, today]);
  const nextTime = today[current];
  const secondsLeft = useMemo(() => {
    const [h, m] = nextTime.split(":").map(Number); const target = new Date(now); target.setHours(h, m, 0, 0); if (target <= now) target.setDate(target.getDate() + 1); return Math.max(0, Math.floor((target.getTime() - now.getTime()) / 1000));
  }, [now, nextTime]);
  const countdown = `${pad(Math.floor(secondsLeft / 3600))}:${pad(Math.floor((secondsLeft % 3600) / 60))}:${pad(secondsLeft % 60)}`;
  const clock = now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" });
  const date = now.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  const hijri = new Intl.DateTimeFormat("en-u-ca-islamic", { day: "numeric", month: "long", year: "numeric" }).format(now).replace(" AH", " AH");
  const background = settings.backgroundMode === "image" && settings.backgroundUrl ? { backgroundImage: `linear-gradient(rgba(0,0,0,.40),rgba(0,0,0,.50)),url(${settings.backgroundUrl})` } : { backgroundColor: settings.backgroundColor };

  const Brand = ({ compact = false }: { compact?: boolean }) => <div className={`tv-brand ${compact ? "compact" : ""}`}>{settings.showLogo && settings.logoUrl ? <img src={settings.logoUrl} alt="Masjid logo" /> : <div className="tv-logo-fallback">☪</div>}<div><strong>{settings.mosqueName}</strong>{settings.showLocation ? <small>{settings.mosqueLocation}</small> : null}</div></div>;
  const ClockBlock = ({ stacked = false }: { stacked?: boolean }) => <div className={`tv-clock-block ${stacked ? "stacked" : ""}`}>{settings.showClock ? <button className="tv-clock" onClick={() => setAdminOpen(true)}>{clock}</button> : null}{settings.showDate ? <div className="tv-dates"><span>{date}</span><span>{hijri}</span></div> : null}</div>;
  const Copyright = () => <span className="tv-copyright">© Hassoun</span>;
  const NextHero = ({ compact = false, light = false }: { compact?: boolean; light?: boolean }) => settings.showNextPrayer ? <section className={`tv-next ${compact ? "compact" : ""} ${light ? "light" : ""}`}><span className="eyebrow">NEXT PRAYER</span><div className="next-name"><b>{names[current].ar}</b><strong>{names[current].en}</strong></div><div className="next-time"><span>ADHAN TIME</span><b>{pretty(nextTime)}</b><em>{countdown} until adhan</em>{settings.showIqama ? <small>Iqama {settings.iqama[current] || "—"}</small> : null}</div></section> : null;
  const PrayerStrip = ({ light = false }: { light?: boolean }) => settings.showPrayerCards ? <div className={`tv-prayer-strip ${light ? "light" : ""}`}>{prayers.map(p => <div key={p} className={`tv-prayer-card ${p === current ? "active" : ""}`}><div className="prayer-head"><span>{icons[p]}</span><strong>{names[p].en}</strong><b>{names[p].ar}</b></div><div className="prayer-times"><span><small>ADHAN</small><b>{pretty(today[p])}</b></span>{settings.showIqama ? <span><small>IQAMA</small><b>{settings.iqama[p] || "—"}</b></span> : null}</div></div>)}</div> : null;
  const PrayerTable = ({ light = false }: { light?: boolean }) => settings.showPrayerCards ? <section className={`tv-prayer-table ${light ? "light" : ""}`}><div className="table-head"><span>SALAH</span><span>AZAN</span>{settings.showIqama ? <span>IQAMA</span> : null}</div>{prayers.map(p => <div key={p} className={`table-row ${p === current ? "active" : ""}`}><strong><i>{icons[p]}</i>{names[p].en}<small>{names[p].ar}</small></strong><b>{pretty(today[p])}</b>{settings.showIqama ? <b className="iqama">{settings.iqama[p] || "—"}</b> : null}</div>)}</section> : null;
  const AnnouncementPanel = ({ light = false, cards = false }: { light?: boolean; cards?: boolean }) => settings.showAnnouncements ? <section className={`tv-announcements ${light ? "light" : ""} ${cards ? "cards" : ""}`}><h2>📣 ANNOUNCEMENTS</h2><div className="announcement-list">{settings.announcements.length ? settings.announcements.map((a, i) => <article key={a.id}><span className="announcement-icon">{["▣","◉","♡","✦"][i % 4]}</span><div><strong>{a.title}</strong><p>{a.body}</p></div></article>) : <p>No announcements</p>}</div></section> : null;
  const JumuahPanel = ({ light = false, hero = false }: { light?: boolean; hero?: boolean }) => settings.showJumuah ? <section className={`tv-jumuah ${light ? "light" : ""} ${hero ? "hero" : ""}`}><h2>JUMU’AH</h2><div className="jumuah-mark">☪</div><div className="jumuah-times">{settings.jumuah.map(j => <div key={j.id}><span>{j.label}</span><b>{j.time || "—"}</b></div>)}</div></section> : null;
  const DonationPanel = ({ light = false }: { light?: boolean }) => settings.showDonation ? <section className={`tv-donation ${light ? "light" : ""}`}><h3>{settings.donationLabel}</h3><p>Every contribution helps your masjid serve the community.</p><div className="donation-mark">▦</div><strong>{settings.websiteUrl || "Add donation / website link in setup"}</strong></section> : null;
  const Verse = ({ light = false }: { light?: boolean }) => settings.showVerse ? <div className={`tv-verse ${light ? "light" : ""}`}>☝ <strong>REMEMBER ALLAH</strong><span>{settings.verseText}</span></div> : null;
  const Footer = () => <footer className="tv-footer"><span>Prayer • Community • Connection</span><Copyright /></footer>;

  const renderLayout = () => {
    switch (settings.layout) {
      case "grand":
        return <div className="template template-grand"><header><Brand /><ClockBlock /><div className="header-verse">{settings.showVerse ? settings.verseText : <Copyright />}</div></header><NextHero compact /><div className="grand-body"><PrayerTable /><div className="grand-community"><AnnouncementPanel /><DonationPanel /></div></div><Footer /></div>;
      case "community":
        return <div className="template template-community light-theme"><header><Brand /><ClockBlock /><div className="community-date">{date}<small>{hijri}</small></div></header><div className="community-main"><NextHero light /><JumuahPanel light hero /><AnnouncementPanel light cards /></div><PrayerStrip light /><div className="community-footer"><Verse light /><span>{settings.websiteUrl || "Community • Worship • Learning"}</span><Copyright /></div></div>;
      case "announcements":
        return <div className="template template-announcements"><header><Brand /><ClockBlock /><Copyright /></header><div className="ann-layout"><div className="ann-left"><NextHero /><PrayerStrip /></div><div className="ann-right"><AnnouncementPanel cards /><JumuahPanel /><DonationPanel /></div></div><Footer /></div>;
      case "cinematic":
        return <div className="template template-cinematic"><header><Brand compact /><ClockBlock /><div className="cinematic-date">{date}<small>{hijri}</small></div></header><div className="cinematic-main"><NextHero /><div className="cinematic-side"><AnnouncementPanel /><JumuahPanel /></div></div><PrayerStrip /><div className="cinematic-status"><span>● CONNECTED</span><span>Last updated {now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span><Copyright /></div></div>;
      case "board":
        return <div className="template template-board"><header><Brand /><ClockBlock stacked /><div className="board-date">{date}<small>{hijri}</small></div></header><div className="board-body"><PrayerTable /><div className="board-side"><AnnouncementPanel /><JumuahPanel /><DonationPanel /></div></div><Footer /></div>;
      case "jumuah":
        return <div className="template template-jumuah light-theme"><header><Brand /><ClockBlock /><div className="community-date">{date}<small>{hijri}</small></div></header><div className="jumuah-main"><NextHero light /><JumuahPanel light hero /><AnnouncementPanel light cards /></div><PrayerStrip light /><Verse light /><Footer /></div>;
      case "adaptive":
        return <div className="template template-adaptive"><header><Brand /><ClockBlock /><div className="adaptive-date">{date}<small>{hijri}</small></div></header><div className="adaptive-grid"><NextHero /><AnnouncementPanel cards /><div className="adaptive-prayers"><PrayerStrip /></div><JumuahPanel /></div><Verse /><Footer /></div>;
      case "minimal":
      default:
        return <div className="template template-minimal"><header><Brand compact /><ClockBlock /><Copyright /></header><NextHero /><PrayerStrip /><Verse /><Footer /></div>;
    }
  };

  return <main className={`webtv-shell layout-${settings.layout}`} style={{ ...background, color: settings.textColor, ["--card" as string]: settings.cardColor, ["--accent" as string]: settings.accentColor }}>
    {settings.backgroundMode === "video" && settings.backgroundUrl ? <video className="webtv-video" src={settings.backgroundUrl} autoPlay muted loop playsInline /> : null}
    <div className="webtv-overlay" />
    {renderLayout()}

    {adminOpen ? <div className="webtv-admin-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) setAdminOpen(false); }}><div className="webtv-admin"><div className="webtv-admin-head"><div><h2>Masjid Display Studio</h2><p>Choose a complete layout, then customize what it shows.</p></div><button onClick={() => setAdminOpen(false)}>×</button></div>
      <label>Layouts</label><div className="layout-picker">{layouts.map(x => <button key={x.id} className={settings.layout === x.id ? "selected" : ""} onClick={() => update("layout", x.id)}><span className={`layout-mini mini-${x.id}`}><i /><i /><i /></span><strong>{x.name}</strong><small>{x.note}</small></button>)}</div>
      <div className="webtv-grid2"><label>Masjid name<input value={settings.mosqueName} onChange={e => update("mosqueName", e.target.value)} /></label><label>Location<input value={settings.mosqueLocation} onChange={e => update("mosqueLocation", e.target.value)} /></label><label>Logo image URL<input value={settings.logoUrl} onChange={e => update("logoUrl", e.target.value)} /></label><label>Website / donation link<input value={settings.websiteUrl} onChange={e => update("websiteUrl", e.target.value)} /></label></div>
      <label>Background</label><div className="webtv-choices">{(["theme","image","video"] as const).map(x => <button key={x} className={settings.backgroundMode === x ? "selected" : ""} onClick={() => update("backgroundMode", x)}>{x}</button>)}</div><label>Background image/video URL<input value={settings.backgroundUrl} onChange={e => update("backgroundUrl", e.target.value)} /></label>
      <div className="webtv-grid4"><label>Background<input value={settings.backgroundColor} onChange={e => update("backgroundColor", e.target.value)} /></label><label>Cards<input value={settings.cardColor} onChange={e => update("cardColor", e.target.value)} /></label><label>Accent<input value={settings.accentColor} onChange={e => update("accentColor", e.target.value)} /></label><label>Text<input value={settings.textColor} onChange={e => update("textColor", e.target.value)} /></label></div>
      <h3>Show / hide</h3><div className="webtv-toggles">{(["showLogo","showClock","showDate","showLocation","showNextPrayer","showPrayerCards","showIqama","showAnnouncements","showJumuah","showVerse","showDonation"] as (keyof Settings)[]).map(k => <label key={String(k)}><input type="checkbox" checked={Boolean(settings[k])} onChange={e => update(k, e.target.checked as never)} />{String(k).replace(/^show/, "").replace(/([A-Z])/g, " $1")}</label>)}</div>
      <h3>Iqama times</h3><div className="webtv-grid5">{prayers.map(p => <label key={p}>{names[p].en}<input value={settings.iqama[p]} onChange={e => update("iqama", { ...settings.iqama, [p]: e.target.value })} placeholder="e.g. 6:15 AM" /></label>)}</div>
      <h3>Announcements</h3>{settings.announcements.map(a => <div className="webtv-edit-row" key={a.id}><input value={a.title} onChange={e => update("announcements", settings.announcements.map(x => x.id === a.id ? { ...x, title: e.target.value } : x))} /><input value={a.body} onChange={e => update("announcements", settings.announcements.map(x => x.id === a.id ? { ...x, body: e.target.value } : x))} /><button onClick={() => update("announcements", settings.announcements.filter(x => x.id !== a.id))}>Delete</button></div>)}<button className="webtv-add" onClick={() => update("announcements", [...settings.announcements, { id: String(Date.now()), title: "New announcement", body: "" }])}>+ Add announcement</button>
      <h3>Jumu’ah</h3>{settings.jumuah.map(j => <div className="webtv-edit-row" key={j.id}><input value={j.label} onChange={e => update("jumuah", settings.jumuah.map(x => x.id === j.id ? { ...x, label: e.target.value } : x))} /><input value={j.time} onChange={e => update("jumuah", settings.jumuah.map(x => x.id === j.id ? { ...x, time: e.target.value } : x))} /><button onClick={() => update("jumuah", settings.jumuah.filter(x => x.id !== j.id))}>Delete</button></div>)}<button className="webtv-add" onClick={() => update("jumuah", [...settings.jumuah, { id: String(Date.now()), label: `Jumu’ah ${settings.jumuah.length + 1}`, time: "" }])}>+ Add Jumu’ah</button>
      <label>Qur’an / reminder text<textarea value={settings.verseText} onChange={e => update("verseText", e.target.value)} /></label>
      <div className="webtv-admin-actions"><button onClick={() => document.documentElement.requestFullscreen?.()}>Enter Full Screen</button><button onClick={() => setAdminOpen(false)}>Save & Close</button></div>
    </div></div> : null}
  </main>;
}
