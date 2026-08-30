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

const STORAGE = "hassoun:web-masjid-tv:v1";
const DATA_URL = "https://raw.githubusercontent.com/Hassoun911/WOPT/main/windsor_islamic_association_2026_prayer_times.json";
const prayers: PrayerKey[] = ["fajr", "dhuhr", "asr", "maghrib", "isha"];
const names: Record<PrayerKey, { en: string; ar: string }> = {
  fajr: { en: "Fajr", ar: "الفجر" }, dhuhr: { en: "Dhuhr", ar: "الظهر" }, asr: { en: "Asr", ar: "العصر" }, maghrib: { en: "Maghrib", ar: "المغرب" }, isha: { en: "Isha", ar: "العشاء" }
};
const icons: Record<PrayerKey, string> = { fajr: "◒", dhuhr: "☀", asr: "◐", maghrib: "◓", isha: "☾" };
const DEFAULTS: Settings = {
  layout: "grand", mosqueName: "Your Masjid Name", mosqueLocation: "Mosque location not set", logoUrl: "",
  backgroundMode: "theme", backgroundUrl: "", backgroundColor: "#062f28", cardColor: "#08473c", accentColor: "#f1cf72", textColor: "#ffffff",
  showLogo: true, showClock: true, showDate: true, showLocation: true, showNextPrayer: true, showPrayerCards: true, showIqama: true, showAnnouncements: true, showJumuah: true, showVerse: false, showDonation: false,
  verseText: "Indeed, in the remembrance of Allah do hearts find rest. — Qur’an 13:28", websiteUrl: "", donationLabel: "Support your Masjid",
  iqama: { fajr: "", dhuhr: "", asr: "", maghrib: "", isha: "" },
  announcements: [{ id: "a1", title: "Welcome", body: "Add mosque announcements from the setup panel." }],
  jumuah: [{ id: "j1", label: "Jumu’ah 1", time: "" }, { id: "j2", label: "Jumu’ah 2", time: "" }]
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
    try { const saved = localStorage.getItem(STORAGE); if (saved) setSettings({ ...DEFAULTS, ...JSON.parse(saved), iqama: { ...DEFAULTS.iqama, ...(JSON.parse(saved).iqama || {}) } }); } catch {}
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
  const countdown = `${Math.floor(secondsLeft / 3600)}h ${Math.floor((secondsLeft % 3600) / 60)}m`;
  const clock = now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" });
  const date = now.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric", year: "numeric" });

  const background = settings.backgroundMode === "image" && settings.backgroundUrl ? { backgroundImage: `linear-gradient(rgba(0,0,0,.42),rgba(0,0,0,.42)),url(${settings.backgroundUrl})` } : { backgroundColor: settings.backgroundColor };

  const Brand = () => <div className="webtv-brand">{settings.showLogo && settings.logoUrl ? <img src={settings.logoUrl} alt="Masjid logo" /> : null}<div><strong style={{ color: settings.accentColor }}>{settings.mosqueName}</strong>{settings.showLocation ? <small>{settings.mosqueLocation}</small> : null}</div></div>;
  const NextPrayer = () => settings.showNextPrayer ? <section className="webtv-next webtv-card"><div><span className="webtv-kicker">NEXT PRAYER</span><b className="webtv-ar">{names[current].ar}</b><strong style={{ color: settings.accentColor }}>{names[current].en}</strong></div><div className="webtv-next-time"><b>{pretty(nextTime)}</b><span style={{ color: settings.accentColor }}>{countdown} left</span>{settings.showIqama ? <small>Iqama {settings.iqama[current] || "—"}</small> : null}</div></section> : null;
  const PrayerCards = () => settings.showPrayerCards ? <div className="webtv-prayers">{prayers.map(p => <div key={p} className={`webtv-prayer webtv-card ${p === current ? "active" : ""}`}><strong>{icons[p]} {names[p].en} <span style={{ color: settings.accentColor }}>{names[p].ar}</span></strong><b>{pretty(today[p])}</b>{settings.showIqama ? <small>Iqama {settings.iqama[p] || "—"}</small> : null}</div>)}</div> : null;
  const Announcements = () => settings.showAnnouncements ? <section className="webtv-panel webtv-card"><h2 style={{ color: settings.accentColor }}>📣 Announcements</h2>{settings.announcements.length ? settings.announcements.map(a => <article key={a.id}><strong>{a.title}</strong><p>{a.body}</p></article>) : <p>No announcements</p>}</section> : null;
  const JumuahPanel = () => settings.showJumuah ? <section className="webtv-panel webtv-card"><h2 style={{ color: settings.accentColor }}>Jumu’ah</h2>{settings.jumuah.map(j => <div className="webtv-jumuah" key={j.id}><span>{j.label}</span><b style={{ color: settings.accentColor }}>{j.time || "—"}</b></div>)}</section> : null;

  return <main className={`webtv-shell layout-${settings.layout}`} style={{ ...background, color: settings.textColor, ["--card" as string]: settings.cardColor, ["--accent" as string]: settings.accentColor }}>
    {settings.backgroundMode === "video" && settings.backgroundUrl ? <video className="webtv-video" src={settings.backgroundUrl} autoPlay muted loop playsInline /> : null}
    <div className="webtv-overlay" />
    <div className="webtv-content">
      <header className="webtv-header"><Brand />{settings.showClock ? <button className="webtv-clock" onClick={() => setAdminOpen(true)}>{clock}</button> : null}{settings.showDate ? <div className="webtv-date">{date}<small>© Hassoun</small></div> : null}</header>
      <NextPrayer />
      <div className="webtv-main"><div className="webtv-left"><PrayerCards />{settings.showVerse ? <div className="webtv-verse">{settings.verseText}</div> : null}</div><div className="webtv-right"><Announcements /><JumuahPanel />{settings.showDonation ? <section className="webtv-panel webtv-card"><h2 style={{ color: settings.accentColor }}>{settings.donationLabel}</h2><p>{settings.websiteUrl || "Add website or donation information in setup."}</p></section> : null}</div></div>
      <footer className="webtv-footer"><span>Prayer • Community • Connection</span><span>Web Masjid TV Mode • Powered by Hassoun</span></footer>
    </div>

    {adminOpen ? <div className="webtv-admin-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) setAdminOpen(false); }}><div className="webtv-admin"><div className="webtv-admin-head"><div><h2>Masjid Display Studio</h2><p>Click the clock anytime to reopen this setup.</p></div><button onClick={() => setAdminOpen(false)}>×</button></div>
      <label>Layout</label><div className="webtv-choices">{(["grand","community","announcements","cinematic","board","jumuah","adaptive","minimal"] as Layout[]).map(x => <button key={x} className={settings.layout === x ? "selected" : ""} onClick={() => update("layout", x)}>{x}</button>)}</div>
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
