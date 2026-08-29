import AsyncStorage from "@react-native-async-storage/async-storage";
import { useKeepAwake } from "expo-keep-awake";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  useWindowDimensions
} from "react-native";
import type { PrayerDay, PrayerKey } from "./types";
import { PRAYER_KEYS } from "./types";
import { formatPrayerTime } from "./time";
import {
  ensureWallDisplayRegistered,
  publishWallDeviceSettings,
  refreshWallPairingCode,
  startWallDeviceSync,
  type WallDeviceIdentity
} from "./wallRemote";

type Locale = "en" | "ar";
type NextPrayer = { prayer: PrayerKey; time: string; secondsRemaining: number; isTomorrow: boolean };
type Announcement = { id: string; title: string; body: string; priority: "normal" | "important" | "emergency"; startsAt?: string; endsAt?: string };
type Jumuah = { id: string; time: string; label: string; imam?: string; language?: string };
type MasjidSettings = {
  mode: "masjid";
  mosqueName: string;
  mosqueSubtitle: string;
  landscapeLayout: "grand" | "community" | "minimal";
  portraitLayout: "minaret" | "lobby" | "minimal";
  theme: "emerald" | "midnight" | "ivory";
  showSeconds: boolean;
  showAnnouncements: boolean;
  showIqama: boolean;
  showJumuah: boolean;
  showHijri: boolean;
  announcementSeconds: number;
  defaultIqama: Record<PrayerKey, string>;
  adhanByDate: Record<string, Partial<Record<PrayerKey, string>>>;
  iqamaByDate: Record<string, Partial<Record<PrayerKey, string>>>;
  jumuah: Jumuah[];
  announcements: Announcement[];
};

type Props = {
  locale: Locale;
  now: Date;
  dateKey: string;
  shortDate: string;
  hijriDate: string;
  locationLabel: string;
  today?: PrayerDay;
  next: NextPrayer | null;
  onTestNotification?: () => void;
  onTestAdhan?: () => void;
  onEnableAlerts?: () => void;
  onRefreshPrayers?: () => void;
  onExitMasjidMode?: () => void;
};

const STORAGE_KEY = "hassoun:masjid-tv:settings:v1";
const NAMES: Record<PrayerKey, { en: string; ar: string }> = {
  fajr: { en: "Fajr", ar: "الفجر" }, dhuhr: { en: "Dhuhr", ar: "الظهر" }, asr: { en: "Asr", ar: "العصر" }, maghrib: { en: "Maghrib", ar: "المغرب" }, isha: { en: "Isha", ar: "العشاء" }
};
const ICONS: Record<PrayerKey, string> = { fajr: "◒", dhuhr: "☀", asr: "◐", maghrib: "◓", isha: "☾" };
const DEFAULTS: MasjidSettings = {
  mode: "masjid",
  mosqueName: "Hassoun Masjid",
  mosqueSubtitle: "Prayer • Community • Connection",
  landscapeLayout: "grand",
  portraitLayout: "minaret",
  theme: "emerald",
  showSeconds: true,
  showAnnouncements: true,
  showIqama: true,
  showJumuah: true,
  showHijri: true,
  announcementSeconds: 12,
  defaultIqama: { fajr: "", dhuhr: "", asr: "", maghrib: "", isha: "" },
  adhanByDate: {},
  iqamaByDate: {},
  jumuah: [{ id: "j1", time: "", label: "Jumu’ah 1" }, { id: "j2", time: "", label: "Jumu’ah 2" }],
  announcements: []
};

function mergeSettings(raw: unknown): MasjidSettings {
  if (!raw || typeof raw !== "object") return DEFAULTS;
  const partial = raw as Partial<MasjidSettings>;
  return {
    ...DEFAULTS,
    ...partial,
    mode: "masjid",
    defaultIqama: { ...DEFAULTS.defaultIqama, ...(partial.defaultIqama || {}) },
    adhanByDate: partial.adhanByDate || {},
    iqamaByDate: partial.iqamaByDate || {},
    jumuah: Array.isArray(partial.jumuah) ? partial.jumuah : DEFAULTS.jumuah,
    announcements: Array.isArray(partial.announcements) ? partial.announcements : []
  };
}
function clock(now: Date, seconds: boolean) {
  let hour = now.getHours() % 12; if (!hour) hour = 12;
  const base = `${String(hour).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  return seconds ? `${base}:${String(now.getSeconds()).padStart(2, "0")}` : base;
}
function countdown(seconds: number) {
  const safe = Math.max(0, Math.floor(seconds)); const h = Math.floor(safe / 3600); const m = Math.floor((safe % 3600) / 60); const s = safe % 60;
  return h ? `${h}h ${m}m` : m ? `${m}m ${s}s` : `${s}s`;
}
function activeAnnouncements(items: Announcement[], now: Date) {
  const t = now.getTime();
  return items.filter((item) => (!item.startsAt || new Date(item.startsAt).getTime() <= t) && (!item.endsAt || new Date(item.endsAt).getTime() >= t));
}
function csvToSchedule(text: string) {
  const adhanByDate: MasjidSettings["adhanByDate"] = {};
  const iqamaByDate: MasjidSettings["iqamaByDate"] = {};
  const rows = text.split(/\r?\n/).map((r) => r.trim()).filter(Boolean);
  if (!rows.length) return { adhanByDate, iqamaByDate };
  const headers = rows[0].split(",").map((h) => h.trim().toLowerCase());
  for (const row of rows.slice(1)) {
    const values = row.split(",").map((v) => v.trim());
    const record: Record<string, string> = {}; headers.forEach((h, i) => record[h] = values[i] || "");
    const date = record.date; if (!date) continue;
    adhanByDate[date] = {};
    iqamaByDate[date] = {};
    for (const prayer of PRAYER_KEYS) {
      if (record[prayer]) adhanByDate[date]![prayer] = record[prayer];
      if (record[`iqama_${prayer}`]) iqamaByDate[date]![prayer] = record[`iqama_${prayer}`];
    }
  }
  return { adhanByDate, iqamaByDate };
}

export default function MasjidTvDisplay(props: Props) {
  useKeepAwake("hassoun-masjid-tv");
  const { width, height } = useWindowDimensions(); const landscape = width >= height;
  const [settings, setSettings] = useState<MasjidSettings>(DEFAULTS); const settingsRef = useRef(settings); settingsRef.current = settings;
  const [ready, setReady] = useState(false); const [adminOpen, setAdminOpen] = useState(false); const [tab, setTab] = useState<"display" | "schedule" | "jumuah" | "announcements" | "remote">("display");
  const [device, setDevice] = useState<WallDeviceIdentity | null>(null); const [online, setOnline] = useState(false); const [announcementIndex, setAnnouncementIndex] = useState(0); const [importText, setImportText] = useState("");

  useEffect(() => { void AsyncStorage.getItem(STORAGE_KEY).then((raw) => { if (raw) { try { setSettings(mergeSettings(JSON.parse(raw))); } catch {} } }).finally(() => setReady(true)); }, []);
  useEffect(() => { if (ready) void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(settings)); }, [settings, ready]);
  useEffect(() => {
    if (!ready) return; let stopped: (() => void) | null = null; let cancelled = false;
    void ensureWallDisplayRegistered(settingsRef.current.mosqueName || "Hassoun Masjid TV", settingsRef.current).then(({ identity, display }) => {
      if (cancelled) return; setDevice(identity); setOnline(true);
      if (display.settings?.mode === "masjid") setSettings(mergeSettings(display.settings));
      stopped = startWallDeviceSync({
        identity, initialSettingsVersion: display.settingsVersion || 0,
        onSettings: (incoming) => { if (incoming?.mode === "masjid") setSettings(mergeSettings(incoming)); setOnline(true); },
        onCommand: async (incoming) => {
          const command = String(incoming.command || "");
          if (command === "test_notification") props.onTestNotification?.();
          if (command === "test_adhan") props.onTestAdhan?.();
          if (command === "enable_alerts") props.onEnableAlerts?.();
          if (command === "refresh_prayers") props.onRefreshPrayers?.();
          if (command === "open_masjid_admin") setAdminOpen(true);
          if (command === "layout_grand") setSettings((s) => ({ ...s, landscapeLayout: "grand" }));
          if (command === "layout_community") setSettings((s) => ({ ...s, landscapeLayout: "community" }));
          if (command === "layout_minimal") setSettings((s) => ({ ...s, landscapeLayout: "minimal", portraitLayout: "minimal" }));
        },
        getStatus: () => ({ mode: "masjid", online: true, mosqueName: settingsRef.current.mosqueName, orientation: landscape ? "landscape" : "portrait", layout: landscape ? settingsRef.current.landscapeLayout : settingsRef.current.portraitLayout, nextPrayer: props.next?.prayer || null, secondsRemaining: props.next?.secondsRemaining ?? null, location: props.locationLabel, jumuahCount: settingsRef.current.jumuah.filter((j) => j.time).length, announcements: settingsRef.current.announcements.length })
      });
    }).catch(() => setOnline(false));
    return () => { cancelled = true; stopped?.(); };
  }, [ready, landscape]);
  useEffect(() => { if (!ready || !device) return; const id = setTimeout(() => { void publishWallDeviceSettings(settings).then(() => setOnline(true)).catch(() => setOnline(false)); }, 700); return () => clearTimeout(id); }, [settings, ready, device]);

  const todayTimes = useMemo(() => ({ ...(props.today || {}), ...(settings.adhanByDate[props.dateKey] || {}) }) as Partial<Record<PrayerKey, string>>, [props.today, props.dateKey, settings.adhanByDate]);
  const todayIqama = useMemo(() => ({ ...settings.defaultIqama, ...(settings.iqamaByDate[props.dateKey] || {}) }), [settings.defaultIqama, settings.iqamaByDate, props.dateKey]);
  const announcements = useMemo(() => activeAnnouncements(settings.announcements, props.now), [settings.announcements, props.now]);
  useEffect(() => { if (announcements.length <= 1) return; const id = setInterval(() => setAnnouncementIndex((i) => (i + 1) % announcements.length), Math.max(5, settings.announcementSeconds) * 1000); return () => clearInterval(id); }, [announcements.length, settings.announcementSeconds]);
  const announcement = announcements[announcementIndex % Math.max(1, announcements.length)];
  const nextPrayer = props.next?.prayer || "fajr"; const nextTime = todayTimes[nextPrayer] || props.next?.time || "—"; const nextIqama = todayIqama[nextPrayer] || "—";
  const theme = settings.theme === "midnight" ? styles.midnight : settings.theme === "ivory" ? styles.ivory : styles.emerald;
  const layout = landscape ? settings.landscapeLayout : settings.portraitLayout;
  const isFriday = props.now.getDay() === 5;

  const PrayerCards = ({ compact = false }: { compact?: boolean }) => <View style={[styles.prayerRow, !landscape && styles.prayerColumn]}>{PRAYER_KEYS.map((p) => {
    const selected = p === nextPrayer; return <View key={p} style={[styles.prayerCard, compact && styles.prayerCardCompact, selected && styles.prayerCardSelected]}><Text style={[styles.prayerArabic, selected && styles.gold]}>{NAMES[p].ar}</Text><Text style={styles.prayerEnglish}>{NAMES[p].en}</Text><Text style={styles.prayerIcon}>{ICONS[p]}</Text><Text style={styles.prayerTime}>{formatPrayerTime(todayTimes[p] || "—")}</Text>{settings.showIqama ? <Text style={styles.iqama}>Iqama {todayIqama[p] ? formatPrayerTime(todayIqama[p]) : "—"}</Text> : null}</View>;
  })}</View>;

  const JumuahPanel = () => settings.showJumuah && isFriday ? <View style={styles.jumuahPanel}><Text style={styles.panelTitle}>JUMU’AH TODAY</Text>{settings.jumuah.filter((j) => j.time).map((j) => <View key={j.id} style={styles.jumuahRow}><Text style={styles.jumuahLabel}>{j.label}</Text><Text style={styles.jumuahTime}>{j.time}</Text><Text style={styles.jumuahMeta}>{[j.imam, j.language].filter(Boolean).join(" • ")}</Text></View>)}</View> : null;
  const AnnouncementPanel = ({ large = false }: { large?: boolean }) => settings.showAnnouncements && announcement ? <View style={[styles.announcement, large && styles.announcementLarge, announcement.priority === "emergency" && styles.emergency]}><Text style={styles.announcementKicker}>{announcement.priority === "emergency" ? "IMPORTANT NOTICE" : "MASJID ANNOUNCEMENT"}</Text><Text style={[styles.announcementTitle, large && styles.announcementTitleLarge]}>{announcement.title}</Text><Text style={[styles.announcementBody, large && styles.announcementBodyLarge]}>{announcement.body}</Text></View> : null;

  let body: React.ReactNode;
  if (landscape && layout === "community") body = <View style={styles.landscapeBody}><View style={styles.leftMain}><View style={styles.clockRow}><Text style={styles.bigClock}>{clock(props.now, settings.showSeconds)}</Text><View><Text style={styles.date}>{props.shortDate}</Text>{settings.showHijri ? <Text style={styles.hijri}>{props.hijriDate}</Text> : null}</View></View><View style={styles.nextCard}><View><Text style={styles.nextKicker}>NEXT PRAYER</Text><Text style={styles.nextArabic}>{NAMES[nextPrayer].ar}</Text><Text style={styles.nextEnglish}>{NAMES[nextPrayer].en}</Text></View><View><Text style={styles.nextTime}>{formatPrayerTime(nextTime)}</Text><Text style={styles.countdown}>{props.next ? countdown(props.next.secondsRemaining) : ""}</Text><Text style={styles.nextIqama}>Iqama {nextIqama === "—" ? "—" : formatPrayerTime(nextIqama)}</Text></View></View><PrayerCards compact /></View><View style={styles.sideRail}><AnnouncementPanel large /><JumuahPanel /></View></View>;
  else if (landscape && layout === "minimal") body = <View style={styles.minimalLandscape}><Text style={styles.minimalClock}>{clock(props.now, settings.showSeconds)}</Text><Text style={styles.minimalArabic}>{NAMES[nextPrayer].ar}</Text><Text style={styles.minimalEnglish}>{NAMES[nextPrayer].en}</Text><View style={styles.minimalTimes}><Text style={styles.minimalAdhan}>Adhan {formatPrayerTime(nextTime)}</Text><Text style={styles.minimalIqama}>Iqama {nextIqama === "—" ? "—" : formatPrayerTime(nextIqama)}</Text></View>{props.next ? <Text style={styles.minimalCountdown}>{countdown(props.next.secondsRemaining)} until Adhan</Text> : null}<JumuahPanel /></View>;
  else if (landscape) body = <><View style={styles.grandTop}><View><Text style={styles.mosqueName}>{settings.mosqueName}</Text><Text style={styles.location}>⌖ {props.locationLabel}</Text></View><Text style={styles.bigClock}>{clock(props.now, settings.showSeconds)}</Text><View style={styles.dateBlock}><Text style={styles.date}>{props.shortDate}</Text>{settings.showHijri ? <Text style={styles.hijri}>{props.hijriDate}</Text> : null}</View></View><View style={styles.grandCenter}><View style={styles.nextCard}><View><Text style={styles.nextKicker}>NEXT PRAYER</Text><Text style={styles.nextArabic}>{NAMES[nextPrayer].ar}</Text><Text style={styles.nextEnglish}>{NAMES[nextPrayer].en}</Text></View><View style={styles.nextRight}><Text style={styles.nextTime}>{formatPrayerTime(nextTime)}</Text>{props.next ? <Text style={styles.countdown}>{countdown(props.next.secondsRemaining)} left</Text> : null}<Text style={styles.nextIqama}>Iqama {nextIqama === "—" ? "—" : formatPrayerTime(nextIqama)}</Text></View></View><View style={styles.grandSide}><JumuahPanel /><AnnouncementPanel /></View></View><PrayerCards />;</n  else if (layout === "lobby") body = <ScrollView contentContainerStyle={styles.portraitBody}><Text style={styles.mosqueNamePortrait}>{settings.mosqueName}</Text><Text style={styles.portraitClock}>{clock(props.now, settings.showSeconds)}</Text><View style={styles.nextCardPortrait}><Text style={styles.nextKicker}>NEXT PRAYER</Text><Text style={styles.nextArabicPortrait}>{NAMES[nextPrayer].ar}</Text><Text style={styles.nextEnglish}>{NAMES[nextPrayer].en}</Text><Text style={styles.nextTimePortrait}>{formatPrayerTime(nextTime)}</Text><Text style={styles.nextIqama}>Iqama {nextIqama === "—" ? "—" : formatPrayerTime(nextIqama)}</Text></View><AnnouncementPanel large /><JumuahPanel /><PrayerCards compact /></ScrollView>;
  else if (layout === "minimal") body = <View style={styles.minimalPortrait}><Text style={styles.mosqueNamePortrait}>{settings.mosqueName}</Text><Text style={styles.portraitClock}>{clock(props.now, settings.showSeconds)}</Text><Text style={styles.minimalArabicPortrait}>{NAMES[nextPrayer].ar}</Text><Text style={styles.minimalEnglish}>{NAMES[nextPrayer].en}</Text><Text style={styles.minimalAdhan}>Adhan {formatPrayerTime(nextTime)}</Text><Text style={styles.minimalIqama}>Iqama {nextIqama === "—" ? "—" : formatPrayerTime(nextIqama)}</Text>{props.next ? <Text style={styles.minimalCountdown}>{countdown(props.next.secondsRemaining)}</Text> : null}<JumuahPanel /></View>;
  else body = <View style={styles.portraitBody}><View style={styles.portraitHeader}><Text style={styles.mosqueNamePortrait}>{settings.mosqueName}</Text><Text style={styles.location}>⌖ {props.locationLabel}</Text><Text style={styles.date}>{props.shortDate}</Text></View><Text style={styles.portraitClock}>{clock(props.now, settings.showSeconds)}</Text><View style={styles.nextCardPortrait}><Text style={styles.nextKicker}>NEXT PRAYER</Text><Text style={styles.nextArabicPortrait}>{NAMES[nextPrayer].ar}</Text><Text style={styles.nextEnglish}>{NAMES[nextPrayer].en}</Text><Text style={styles.nextTimePortrait}>{formatPrayerTime(nextTime)}</Text>{props.next ? <Text style={styles.countdown}>{countdown(props.next.secondsRemaining)} left</Text> : null}<Text style={styles.nextIqama}>Iqama {nextIqama === "—" ? "—" : formatPrayerTime(nextIqama)}</Text></View><PrayerCards compact /><JumuahPanel /><AnnouncementPanel /></View>;

  const update = (patch: Partial<MasjidSettings>) => setSettings((s) => ({ ...s, ...patch }));
  const updateIqama = (prayer: PrayerKey, value: string) => setSettings((s) => ({ ...s, defaultIqama: { ...s.defaultIqama, [prayer]: value } }));
  const addJumuah = () => setSettings((s) => ({ ...s, jumuah: [...s.jumuah, { id: `j${Date.now()}`, time: "", label: `Jumu’ah ${s.jumuah.length + 1}` }] }));
  const addAnnouncement = () => setSettings((s) => ({ ...s, announcements: [...s.announcements, { id: `a${Date.now()}`, title: "New announcement", body: "Edit this announcement", priority: "normal" }] }));
  const importSchedule = () => { try { const trimmed = importText.trim(); if (!trimmed) return; if (trimmed.startsWith("{")) { const data = JSON.parse(trimmed); update({ adhanByDate: data.adhanByDate || data.adhan || {}, iqamaByDate: data.iqamaByDate || data.iqama || {} }); } else { const parsed = csvToSchedule(trimmed); update(parsed); } Alert.alert("Schedule imported", "Adhan and Iqama schedule data has been saved on this display."); setImportText(""); } catch (error) { Alert.alert("Import failed", String(error)); } };

  return <View style={[styles.screen, theme]}><Pressable onLongPress={() => setAdminOpen(true)} delayLongPress={900} style={styles.fill}>{body}</Pressable><View style={styles.footer}><Text style={styles.footerText}>{settings.mosqueSubtitle}</Text><Text style={styles.footerStatus}>{online ? "● Connected" : "○ Offline-safe"}</Text></View>
    <Modal visible={adminOpen} animationType="slide" onRequestClose={() => setAdminOpen(false)} transparent><View style={styles.modalShade}><View style={styles.admin}><View style={styles.adminHeader}><View><Text style={styles.adminTitle}>Hassoun Masjid Control Center</Text><Text style={styles.adminSubtitle}>This TV • {landscape ? "Landscape" : "Portrait"}</Text></View><Pressable onPress={() => setAdminOpen(false)} style={styles.done}><Text style={styles.doneText}>Done</Text></Pressable></View><View style={styles.tabs}>{(["display","schedule","jumuah","announcements","remote"] as const).map((t) => <Pressable key={t} onPress={() => setTab(t)} style={[styles.tab, tab === t && styles.tabActive]}><Text style={styles.tabText}>{t.toUpperCase()}</Text></Pressable>)}</View><ScrollView contentContainerStyle={styles.adminContent}>
      {tab === "display" ? <><Text style={styles.adminLabel}>Mosque name</Text><TextInput value={settings.mosqueName} onChangeText={(mosqueName) => update({ mosqueName })} style={styles.input}/><Text style={styles.adminLabel}>Subtitle</Text><TextInput value={settings.mosqueSubtitle} onChangeText={(mosqueSubtitle) => update({ mosqueSubtitle })} style={styles.input}/><Text style={styles.adminLabel}>Landscape layout</Text><View style={styles.choiceRow}>{(["grand","community","minimal"] as const).map((x) => <Pressable key={x} onPress={() => update({ landscapeLayout: x })} style={[styles.choice, settings.landscapeLayout === x && styles.choiceActive]}><Text>{x}</Text></Pressable>)}</View><Text style={styles.adminLabel}>Portrait layout</Text><View style={styles.choiceRow}>{(["minaret","lobby","minimal"] as const).map((x) => <Pressable key={x} onPress={() => update({ portraitLayout: x })} style={[styles.choice, settings.portraitLayout === x && styles.choiceActive]}><Text>{x}</Text></Pressable>)}</View><Text style={styles.adminLabel}>Theme</Text><View style={styles.choiceRow}>{(["emerald","midnight","ivory"] as const).map((x) => <Pressable key={x} onPress={() => update({ theme: x })} style={[styles.choice, settings.theme === x && styles.choiceActive]}><Text>{x}</Text></Pressable>)}</View><Toggle label="Show seconds" value={settings.showSeconds} onChange={(showSeconds) => update({ showSeconds })}/><Toggle label="Show Iqama" value={settings.showIqama} onChange={(showIqama) => update({ showIqama })}/><Toggle label="Show Jumu’ah" value={settings.showJumuah} onChange={(showJumuah) => update({ showJumuah })}/><Toggle label="Show announcements" value={settings.showAnnouncements} onChange={(showAnnouncements) => update({ showAnnouncements })}/></> : null}
      {tab === "schedule" ? <><Text style={styles.adminSection}>Default Iqama times</Text>{PRAYER_KEYS.map((p) => <View key={p} style={styles.formRow}><Text style={styles.formLabel}>{NAMES[p].en}</Text><TextInput value={settings.defaultIqama[p]} onChangeText={(v) => updateIqama(p, v)} placeholder="e.g. 6:15 AM" style={styles.timeInput}/></View>)}<Text style={styles.adminSection}>Import mosque schedule</Text><Text style={styles.help}>Paste CSV with columns: date,fajr,dhuhr,asr,maghrib,isha,iqama_fajr,iqama_dhuhr,iqama_asr,iqama_maghrib,iqama_isha — or paste JSON containing adhanByDate and iqamaByDate.</Text><TextInput multiline value={importText} onChangeText={setImportText} placeholder="Paste CSV or JSON schedule here" style={[styles.input, styles.importBox]}/><Pressable onPress={importSchedule} style={styles.primary}><Text style={styles.primaryText}>Import & Save Schedule</Text></Pressable></> : null}
      {tab === "jumuah" ? <><View style={styles.sectionHeader}><Text style={styles.adminSection}>Jumu’ah sessions</Text><Pressable onPress={addJumuah} style={styles.smallButton}><Text>+ Add</Text></Pressable></View>{settings.jumuah.map((j, index) => <View key={j.id} style={styles.editorCard}><TextInput value={j.label} onChangeText={(label) => setSettings((s) => ({ ...s, jumuah: s.jumuah.map((x) => x.id === j.id ? { ...x, label } : x) }))} style={styles.input}/><View style={styles.formRow}><TextInput value={j.time} onChangeText={(time) => setSettings((s) => ({ ...s, jumuah: s.jumuah.map((x) => x.id === j.id ? { ...x, time } : x) }))} placeholder="1:30 PM" style={styles.timeInput}/><TextInput value={j.imam || ""} onChangeText={(imam) => setSettings((s) => ({ ...s, jumuah: s.jumuah.map((x) => x.id === j.id ? { ...x, imam } : x) }))} placeholder="Khateeb / Imam" style={styles.inputFlex}/><TextInput value={j.language || ""} onChangeText={(language) => setSettings((s) => ({ ...s, jumuah: s.jumuah.map((x) => x.id === j.id ? { ...x, language } : x) }))} placeholder="Language" style={styles.inputFlex}/></View><Pressable onPress={() => setSettings((s) => ({ ...s, jumuah: s.jumuah.filter((x) => x.id !== j.id) }))}><Text style={styles.delete}>Remove session {index + 1}</Text></Pressable></View>)}</> : null}
      {tab === "announcements" ? <><View style={styles.sectionHeader}><Text style={styles.adminSection}>Announcements & activities</Text><Pressable onPress={addAnnouncement} style={styles.smallButton}><Text>+ Add</Text></Pressable></View>{settings.announcements.map((a) => <View key={a.id} style={styles.editorCard}><TextInput value={a.title} onChangeText={(title) => setSettings((s) => ({ ...s, announcements: s.announcements.map((x) => x.id === a.id ? { ...x, title } : x) }))} style={styles.input}/><TextInput multiline value={a.body} onChangeText={(body) => setSettings((s) => ({ ...s, announcements: s.announcements.map((x) => x.id === a.id ? { ...x, body } : x) }))} style={[styles.input, { minHeight: 70 }]}/><View style={styles.choiceRow}>{(["normal","important","emergency"] as const).map((p) => <Pressable key={p} onPress={() => setSettings((s) => ({ ...s, announcements: s.announcements.map((x) => x.id === a.id ? { ...x, priority: p } : x) }))} style={[styles.choice, a.priority === p && styles.choiceActive]}><Text>{p}</Text></Pressable>)}</View><Pressable onPress={() => setSettings((s) => ({ ...s, announcements: s.announcements.filter((x) => x.id !== a.id) }))}><Text style={styles.delete}>Delete announcement</Text></Pressable></View>)}</> : null}
      {tab === "remote" ? <><Text style={styles.adminSection}>Pair a mosque administrator</Text><Text style={styles.help}>Open Hassoun on the admin’s phone → Wall Displays / Masjid Displays → enter this 6-character pairing code.</Text><View style={styles.codeCard}><Text style={styles.code}>{device?.pairingCode || "------"}</Text><Text>{online ? "Remote service online" : "Working offline / reconnecting"}</Text></View><Pressable onPress={() => void refreshWallPairingCode().then(setDevice).catch((e) => Alert.alert("Pairing", String(e)))} style={styles.primary}><Text style={styles.primaryText}>Generate New Pairing Code</Text></Pressable><View style={styles.remoteActions}><Pressable onPress={props.onTestNotification} style={styles.secondary}><Text>🔔 Test chime</Text></Pressable><Pressable onPress={props.onTestAdhan} style={styles.secondary}><Text>🕌 Test Adhan</Text></Pressable><Pressable onPress={props.onEnableAlerts} style={styles.secondary}><Text>✓ Check / enable alerts</Text></Pressable><Pressable onPress={props.onRefreshPrayers} style={styles.secondary}><Text>↻ Refresh prayer times</Text></Pressable></View>{props.onExitMasjidMode ? <Pressable onPress={props.onExitMasjidMode}><Text style={styles.delete}>Exit Masjid Mode on this device</Text></Pressable> : null}</> : null}
    </ScrollView></View></View></Modal>
  </View>;
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) { return <View style={styles.toggle}><Text style={styles.adminLabel}>{label}</Text><Switch value={value} onValueChange={onChange}/></View>; }

const styles = StyleSheet.create({
  screen:{flex:1,backgroundColor:"#052B24"},fill:{flex:1,padding:24},emerald:{backgroundColor:"#052B24"},midnight:{backgroundColor:"#071318"},ivory:{backgroundColor:"#EDE4CF"},
  grandTop:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",minHeight:150},mosqueName:{fontSize:32,fontWeight:"900",color:"#F6D675"},location:{fontSize:18,color:"#EDE8DA",marginTop:6},bigClock:{fontSize:104,fontWeight:"900",color:"#FFFDF5",textShadowColor:"#A97716",textShadowOffset:{width:5,height:7},textShadowRadius:3},dateBlock:{alignItems:"flex-end"},date:{fontSize:22,fontWeight:"800",color:"#FFFDF5"},hijri:{fontSize:17,color:"#E7C76B",marginTop:8},
  grandCenter:{flex:1,flexDirection:"row",gap:18},nextCard:{flex:1,borderWidth:2,borderColor:"#DDB94C",backgroundColor:"#063D32",borderRadius:30,paddingHorizontal:34,paddingVertical:22,flexDirection:"row",alignItems:"center",justifyContent:"space-between"},nextKicker:{alignSelf:"flex-start",fontSize:18,fontWeight:"900",color:"#DDB94C",letterSpacing:1.4},nextArabic:{fontSize:78,fontWeight:"900",color:"#F2CF68",marginTop:8},nextEnglish:{fontSize:30,fontWeight:"800",color:"#FFFDF5"},nextRight:{alignItems:"flex-end"},nextTime:{fontSize:72,fontWeight:"900",color:"#FFFDF5"},countdown:{fontSize:24,fontWeight:"800",color:"#EAC85D",marginTop:4},nextIqama:{fontSize:24,fontWeight:"900",color:"#AEE5D0",marginTop:10},grandSide:{width:"27%",gap:14},
  prayerRow:{flexDirection:"row",gap:12,marginTop:16},prayerColumn:{flexWrap:"wrap"},prayerCard:{flex:1,minWidth:120,borderWidth:1,borderColor:"#5D8A7A",backgroundColor:"rgba(2,35,29,0.82)",borderRadius:18,padding:12,alignItems:"center"},prayerCardCompact:{paddingVertical:8},prayerCardSelected:{borderWidth:3,borderColor:"#F0C954",backgroundColor:"#07523F"},prayerArabic:{fontSize:27,fontWeight:"900",color:"#FFFDF5"},gold:{color:"#F0C954"},prayerEnglish:{fontSize:16,fontWeight:"800",color:"#DCE8E2"},prayerIcon:{fontSize:26,color:"#E7C451",marginVertical:4},prayerTime:{fontSize:28,fontWeight:"900",color:"#FFFDF5"},iqama:{fontSize:14,fontWeight:"800",color:"#AEDBC8",marginTop:4},
  jumuahPanel:{borderWidth:1,borderColor:"#C8A747",backgroundColor:"rgba(2,35,29,0.9)",borderRadius:18,padding:16},panelTitle:{fontSize:16,fontWeight:"900",color:"#EBCB68",marginBottom:8},jumuahRow:{marginTop:7},jumuahLabel:{fontSize:17,fontWeight:"800",color:"#FFF"},jumuahTime:{fontSize:25,fontWeight:"900",color:"#F0C954"},jumuahMeta:{fontSize:13,color:"#C9DAD3"},announcement:{borderWidth:1,borderColor:"#4F816F",backgroundColor:"rgba(3,42,34,0.94)",borderRadius:18,padding:16},announcementLarge:{minHeight:180},emergency:{borderColor:"#FFBE52",borderWidth:3},announcementKicker:{fontSize:13,fontWeight:"900",color:"#EBCB68"},announcementTitle:{fontSize:22,fontWeight:"900",color:"#FFF",marginTop:6},announcementTitleLarge:{fontSize:30},announcementBody:{fontSize:16,color:"#DFE9E4",marginTop:7,lineHeight:22},announcementBodyLarge:{fontSize:20,lineHeight:28},
  landscapeBody:{flex:1,flexDirection:"row",gap:18},leftMain:{flex:1},sideRail:{width:"30%",gap:16},clockRow:{flexDirection:"row",justifyContent:"space-between",alignItems:"center",marginBottom:12},minimalLandscape:{flex:1,alignItems:"center",justifyContent:"center"},minimalClock:{fontSize:150,fontWeight:"900",color:"#FFF",textShadowColor:"#A97716",textShadowOffset:{width:6,height:8},textShadowRadius:2},minimalArabic:{fontSize:100,fontWeight:"900",color:"#F2CF68"},minimalArabicPortrait:{fontSize:120,fontWeight:"900",color:"#F2CF68"},minimalEnglish:{fontSize:40,fontWeight:"800",color:"#FFF"},minimalTimes:{flexDirection:"row",gap:40,marginTop:24},minimalAdhan:{fontSize:38,fontWeight:"900",color:"#FFF"},minimalIqama:{fontSize:38,fontWeight:"900",color:"#AEE5D0"},minimalCountdown:{fontSize:26,color:"#EBCB68",marginTop:14},
  portraitBody:{flexGrow:1,padding:18,alignItems:"stretch",gap:14},portraitHeader:{alignItems:"center"},mosqueNamePortrait:{fontSize:34,fontWeight:"900",color:"#F6D675",textAlign:"center"},portraitClock:{fontSize:112,fontWeight:"900",color:"#FFF",textAlign:"center",textShadowColor:"#9C6B12",textShadowOffset:{width:5,height:7},textShadowRadius:2},nextCardPortrait:{borderWidth:2,borderColor:"#DDB94C",backgroundColor:"#063D32",borderRadius:28,padding:24,alignItems:"center"},nextArabicPortrait:{fontSize:90,fontWeight:"900",color:"#F2CF68"},nextTimePortrait:{fontSize:70,fontWeight:"900",color:"#FFF"},minimalPortrait:{flex:1,alignItems:"center",justifyContent:"center",padding:30},
  footer:{height:38,borderTopWidth:1,borderTopColor:"#8A7636",paddingHorizontal:24,flexDirection:"row",alignItems:"center",justifyContent:"space-between"},footerText:{fontSize:15,color:"#E4D49C"},footerStatus:{fontSize:13,color:"#8CD7B9"},
  modalShade:{flex:1,backgroundColor:"rgba(0,0,0,0.55)",justifyContent:"flex-end"},admin:{height:"88%",backgroundColor:"#F8F5EC",borderTopLeftRadius:26,borderTopRightRadius:26},adminHeader:{padding:20,flexDirection:"row",justifyContent:"space-between",alignItems:"center"},adminTitle:{fontSize:28,fontWeight:"900",color:"#083E33"},adminSubtitle:{fontSize:15,color:"#5B6E67",marginTop:3},done:{backgroundColor:"#07503F",borderRadius:22,paddingHorizontal:22,paddingVertical:11},doneText:{color:"#FFF",fontWeight:"900"},tabs:{flexDirection:"row",paddingHorizontal:18,gap:8},tab:{flex:1,paddingVertical:11,borderRadius:12,backgroundColor:"#E8E5DC",alignItems:"center"},tabActive:{backgroundColor:"#0A513F"},tabText:{fontSize:12,fontWeight:"900",color:"#263A34"},adminContent:{padding:20,paddingBottom:60},adminLabel:{fontSize:16,fontWeight:"800",color:"#173C33",marginBottom:7},adminSection:{fontSize:22,fontWeight:"900",color:"#0A493C",marginBottom:12,marginTop:6},input:{borderWidth:1,borderColor:"#B9C6C0",borderRadius:12,padding:12,fontSize:16,backgroundColor:"#FFF",marginBottom:12},choiceRow:{flexDirection:"row",flexWrap:"wrap",gap:8,marginBottom:18},choice:{paddingHorizontal:16,paddingVertical:10,borderRadius:12,backgroundColor:"#E7E5DE"},choiceActive:{backgroundColor:"#E7C765"},toggle:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",paddingVertical:10,borderBottomWidth:1,borderBottomColor:"#E2E0D8"},formRow:{flexDirection:"row",alignItems:"center",gap:10,marginBottom:10},formLabel:{width:90,fontSize:16,fontWeight:"800"},timeInput:{width:140,borderWidth:1,borderColor:"#BBC7C2",borderRadius:10,padding:11,backgroundColor:"#FFF"},inputFlex:{flex:1,borderWidth:1,borderColor:"#BBC7C2",borderRadius:10,padding:11,backgroundColor:"#FFF"},help:{fontSize:14,color:"#5E6A66",lineHeight:20,marginBottom:12},importBox:{minHeight:150,textAlignVertical:"top"},primary:{backgroundColor:"#07503F",borderRadius:12,padding:14,alignItems:"center",marginVertical:8},primaryText:{color:"#FFF",fontWeight:"900",fontSize:16},sectionHeader:{flexDirection:"row",justifyContent:"space-between",alignItems:"center"},smallButton:{backgroundColor:"#E3C45E",paddingHorizontal:14,paddingVertical:8,borderRadius:10},editorCard:{backgroundColor:"#EEEBE3",borderRadius:14,padding:14,marginBottom:12},delete:{color:"#A62929",fontWeight:"800",marginTop:8},codeCard:{backgroundColor:"#E9E5D8",borderRadius:16,padding:20,alignItems:"center",marginVertical:14},code:{fontSize:46,fontWeight:"900",letterSpacing:7,color:"#07503F"},remoteActions:{flexDirection:"row",flexWrap:"wrap",gap:10,marginVertical:12},secondary:{backgroundColor:"#E8E5DC",padding:13,borderRadius:12}
});
