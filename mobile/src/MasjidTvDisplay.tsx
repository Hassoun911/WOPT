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
import { formatPrayerTime } from "./time";
import { PRAYER_KEYS, type PrayerDay, type PrayerKey } from "./types";
import {
  ensureWallDisplayRegistered,
  publishWallDeviceSettings,
  refreshWallPairingCode,
  startWallDeviceSync,
  type WallDeviceIdentity
} from "./wallRemote";

type Locale = "en" | "ar";
type NextPrayer = { prayer: PrayerKey; time: string; secondsRemaining: number; isTomorrow: boolean };
type AnnouncementPriority = "normal" | "important" | "emergency";
type Announcement = { id: string; title: string; body: string; priority: AnnouncementPriority; startsAt?: string; endsAt?: string };
type Jumuah = { id: string; time: string; label: string; imam?: string; language?: string };
type LandscapeLayout = "grand" | "community" | "minimal";
type PortraitLayout = "minaret" | "lobby" | "minimal";

type MasjidSettings = {
  mode: "masjid";
  mosqueName: string;
  mosqueSubtitle: string;
  landscapeLayout: LandscapeLayout;
  portraitLayout: PortraitLayout;
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
};

const STORAGE_KEY = "hassoun:masjid-tv:settings:v2";
const NAMES: Record<PrayerKey, { en: string; ar: string }> = {
  fajr: { en: "Fajr", ar: "الفجر" },
  dhuhr: { en: "Dhuhr", ar: "الظهر" },
  asr: { en: "Asr", ar: "العصر" },
  maghrib: { en: "Maghrib", ar: "المغرب" },
  isha: { en: "Isha", ar: "العشاء" }
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
  jumuah: [
    { id: "j1", time: "", label: "Jumu’ah 1" },
    { id: "j2", time: "", label: "Jumu’ah 2" }
  ],
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

function displayClock(now: Date, seconds: boolean) {
  let hour = now.getHours() % 12;
  if (!hour) hour = 12;
  const base = `${String(hour).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  return seconds ? `${base}:${String(now.getSeconds()).padStart(2, "0")}` : base;
}

function countdown(seconds: number) {
  const safe = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const secs = safe % 60;
  if (hours) return `${hours}h ${minutes}m`;
  if (minutes) return `${minutes}m ${secs}s`;
  return `${secs}s`;
}

function activeAnnouncements(items: Announcement[], now: Date) {
  const current = now.getTime();
  return items.filter((item) => {
    const afterStart = !item.startsAt || new Date(item.startsAt).getTime() <= current;
    const beforeEnd = !item.endsAt || new Date(item.endsAt).getTime() >= current;
    return afterStart && beforeEnd;
  });
}

function csvToSchedule(text: string) {
  const adhanByDate: MasjidSettings["adhanByDate"] = {};
  const iqamaByDate: MasjidSettings["iqamaByDate"] = {};
  const rows = text.split(/\r?\n/).map((row) => row.trim()).filter(Boolean);
  if (rows.length < 2) return { adhanByDate, iqamaByDate };
  const headers = rows[0].split(",").map((header) => header.trim().toLowerCase());
  for (const row of rows.slice(1)) {
    const values = row.split(",").map((value) => value.trim());
    const record: Record<string, string> = {};
    headers.forEach((header, index) => { record[header] = values[index] || ""; });
    const date = record.date;
    if (!date) continue;
    const adhan: Partial<Record<PrayerKey, string>> = {};
    const iqama: Partial<Record<PrayerKey, string>> = {};
    for (const prayer of PRAYER_KEYS) {
      if (record[prayer]) adhan[prayer] = record[prayer];
      if (record[`iqama_${prayer}`]) iqama[prayer] = record[`iqama_${prayer}`];
    }
    adhanByDate[date] = adhan;
    iqamaByDate[date] = iqama;
  }
  return { adhanByDate, iqamaByDate };
}

function ToggleRow({ label, value, onChange }: { label: string; value: boolean; onChange: (value: boolean) => void }) {
  return <View style={styles.toggleRow}><Text style={styles.adminLabel}>{label}</Text><Switch value={value} onValueChange={onChange} /></View>;
}

export default function MasjidTvDisplay(props: Props) {
  useKeepAwake("hassoun-masjid-tv");
  const { width, height } = useWindowDimensions();
  const landscape = width >= height;
  const [settings, setSettings] = useState<MasjidSettings>(DEFAULTS);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const [ready, setReady] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [tab, setTab] = useState<"display" | "schedule" | "jumuah" | "announcements" | "remote">("display");
  const [device, setDevice] = useState<WallDeviceIdentity | null>(null);
  const [remoteOnline, setRemoteOnline] = useState(false);
  const [announcementIndex, setAnnouncementIndex] = useState(0);
  const [importText, setImportText] = useState("");

  useEffect(() => {
    void AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => { if (raw) setSettings(mergeSettings(JSON.parse(raw))); })
      .catch(() => undefined)
      .finally(() => setReady(true));
  }, []);

  useEffect(() => {
    if (ready) void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }, [settings, ready]);

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    let stopSync: (() => void) | null = null;
    void ensureWallDisplayRegistered(settingsRef.current.mosqueName || "Hassoun Masjid TV", settingsRef.current)
      .then(({ identity, display }) => {
        if (cancelled) return;
        setDevice(identity);
        setRemoteOnline(true);
        if (display.settings?.mode === "masjid") setSettings(mergeSettings(display.settings));
        stopSync = startWallDeviceSync({
          identity,
          initialSettingsVersion: display.settingsVersion || 0,
          onSettings: (incoming) => {
            if (incoming?.mode === "masjid") setSettings(mergeSettings(incoming));
            setRemoteOnline(true);
          },
          onCommand: async (incoming) => {
            const command = String(incoming.command || "");
            if (command === "test_notification") props.onTestNotification?.();
            if (command === "test_adhan") props.onTestAdhan?.();
            if (command === "enable_alerts") props.onEnableAlerts?.();
            if (command === "refresh_prayers") props.onRefreshPrayers?.();
            if (command === "open_masjid_admin") setAdminOpen(true);
            if (command === "layout_grand") setSettings((current) => ({ ...current, landscapeLayout: "grand" }));
            if (command === "layout_community") setSettings((current) => ({ ...current, landscapeLayout: "community" }));
            if (command === "layout_minimal") setSettings((current) => ({ ...current, landscapeLayout: "minimal", portraitLayout: "minimal" }));
          },
          getStatus: () => ({
            mode: "masjid",
            online: true,
            mosqueName: settingsRef.current.mosqueName,
            orientation: landscape ? "landscape" : "portrait",
            layout: landscape ? settingsRef.current.landscapeLayout : settingsRef.current.portraitLayout,
            nextPrayer: props.next?.prayer || null,
            secondsRemaining: props.next?.secondsRemaining ?? null,
            location: props.locationLabel,
            jumuahCount: settingsRef.current.jumuah.filter((item) => item.time).length,
            announcements: settingsRef.current.announcements.length
          })
        });
      })
      .catch(() => setRemoteOnline(false));
    return () => { cancelled = true; stopSync?.(); };
  }, [ready, landscape]);

  useEffect(() => {
    if (!ready || !device) return;
    const id = setTimeout(() => {
      void publishWallDeviceSettings(settings).then(() => setRemoteOnline(true)).catch(() => setRemoteOnline(false));
    }, 700);
    return () => clearTimeout(id);
  }, [settings, ready, device]);

  const todayTimes = useMemo(
    () => ({ ...(props.today || {}), ...(settings.adhanByDate[props.dateKey] || {}) }) as Partial<Record<PrayerKey, string>>,
    [props.today, props.dateKey, settings.adhanByDate]
  );
  const todayIqama = useMemo(
    () => ({ ...settings.defaultIqama, ...(settings.iqamaByDate[props.dateKey] || {}) }),
    [settings.defaultIqama, settings.iqamaByDate, props.dateKey]
  );
  const announcements = useMemo(() => activeAnnouncements(settings.announcements, props.now), [settings.announcements, props.now]);

  useEffect(() => {
    if (announcements.length <= 1) return;
    const id = setInterval(() => setAnnouncementIndex((index) => (index + 1) % announcements.length), Math.max(5, settings.announcementSeconds) * 1000);
    return () => clearInterval(id);
  }, [announcements.length, settings.announcementSeconds]);

  const announcement = announcements[announcementIndex % Math.max(announcements.length, 1)];
  const nextPrayer: PrayerKey = props.next?.prayer || "fajr";
  const nextTime = todayTimes[nextPrayer] || props.next?.time || "—";
  const nextIqama = todayIqama[nextPrayer] || "—";
  const isFriday = props.now.getDay() === 5;
  const layout = landscape ? settings.landscapeLayout : settings.portraitLayout;
  const themeStyle = settings.theme === "midnight" ? styles.midnight : settings.theme === "ivory" ? styles.ivory : styles.emerald;

  const update = (patch: Partial<MasjidSettings>) => setSettings((current) => ({ ...current, ...patch }));
  const updateIqama = (prayer: PrayerKey, value: string) => setSettings((current) => ({ ...current, defaultIqama: { ...current.defaultIqama, [prayer]: value } }));

  const PrayerCards = ({ compact = false }: { compact?: boolean }) => (
    <View style={[styles.prayerRow, !landscape && styles.prayerWrap]}>
      {PRAYER_KEYS.map((prayer) => {
        const selected = prayer === nextPrayer;
        return (
          <View key={prayer} style={[styles.prayerCard, compact && styles.prayerCardCompact, selected && styles.prayerSelected]}>
            <Text style={[styles.prayerArabic, selected && styles.gold]}>{NAMES[prayer].ar}</Text>
            <Text style={styles.prayerEnglish}>{NAMES[prayer].en}</Text>
            <Text style={styles.prayerIcon}>{ICONS[prayer]}</Text>
            <Text style={styles.prayerTime}>{formatPrayerTime(todayTimes[prayer] || "—")}</Text>
            {settings.showIqama ? <Text style={styles.iqama}>Iqama {todayIqama[prayer] ? formatPrayerTime(todayIqama[prayer]) : "—"}</Text> : null}
          </View>
        );
      })}
    </View>
  );

  const JumuahPanel = () => {
    if (!settings.showJumuah || !isFriday) return null;
    const sessions = settings.jumuah.filter((item) => item.time);
    if (!sessions.length) return null;
    return (
      <View style={styles.infoPanel}>
        <Text style={styles.panelKicker}>JUMU’AH TODAY</Text>
        {sessions.map((session) => (
          <View key={session.id} style={styles.jumuahItem}>
            <View><Text style={styles.jumuahLabel}>{session.label}</Text><Text style={styles.jumuahMeta}>{[session.imam, session.language].filter(Boolean).join(" • ")}</Text></View>
            <Text style={styles.jumuahTime}>{session.time}</Text>
          </View>
        ))}
      </View>
    );
  };

  const AnnouncementPanel = ({ large = false }: { large?: boolean }) => {
    if (!settings.showAnnouncements || !announcement) return null;
    return (
      <View style={[styles.announcement, large && styles.announcementLarge, announcement.priority === "emergency" && styles.emergency]}>
        <Text style={styles.panelKicker}>{announcement.priority === "emergency" ? "IMPORTANT NOTICE" : "MASJID ANNOUNCEMENT"}</Text>
        <Text style={[styles.announcementTitle, large && styles.announcementTitleLarge]}>{announcement.title}</Text>
        <Text style={[styles.announcementBody, large && styles.announcementBodyLarge]}>{announcement.body}</Text>
      </View>
    );
  };

  const NextPrayerCard = ({ portrait = false }: { portrait?: boolean }) => (
    <View style={[styles.nextCard, portrait && styles.nextCardPortrait]}>
      <View style={portrait ? styles.centered : undefined}>
        <Text style={styles.nextKicker}>NEXT PRAYER</Text>
        <Text style={[styles.nextArabic, portrait && styles.nextArabicPortrait]}>{NAMES[nextPrayer].ar}</Text>
        <Text style={styles.nextEnglish}>{NAMES[nextPrayer].en}</Text>
      </View>
      <View style={portrait ? styles.centered : styles.nextRight}>
        <Text style={[styles.nextTime, portrait && styles.nextTimePortrait]}>{formatPrayerTime(nextTime)}</Text>
        {props.next ? <Text style={styles.countdown}>{countdown(props.next.secondsRemaining)} left</Text> : null}
        {settings.showIqama ? <Text style={styles.nextIqama}>Iqama {nextIqama === "—" ? "—" : formatPrayerTime(nextIqama)}</Text> : null}
      </View>
    </View>
  );

  const GrandLandscape = () => (
    <View style={styles.layoutFill}>
      <View style={styles.grandTop}>
        <View><Text style={styles.mosqueName}>{settings.mosqueName}</Text><Text style={styles.location}>⌖ {props.locationLabel}</Text></View>
        <Text style={styles.bigClock}>{displayClock(props.now, settings.showSeconds)}</Text>
        <View style={styles.dateBlock}><Text style={styles.date}>{props.shortDate}</Text>{settings.showHijri ? <Text style={styles.hijri}>{props.hijriDate}</Text> : null}</View>
      </View>
      <View style={styles.grandCenter}><NextPrayerCard /><View style={styles.grandSide}><JumuahPanel /><AnnouncementPanel /></View></View>
      <PrayerCards />
    </View>
  );

  const CommunityLandscape = () => (
    <View style={styles.landscapeBody}>
      <View style={styles.leftMain}>
        <View style={styles.clockRow}><Text style={styles.bigClock}>{displayClock(props.now, settings.showSeconds)}</Text><View style={styles.dateBlock}><Text style={styles.date}>{props.shortDate}</Text>{settings.showHijri ? <Text style={styles.hijri}>{props.hijriDate}</Text> : null}</View></View>
        <NextPrayerCard />
        <PrayerCards compact />
      </View>
      <View style={styles.sideRail}><AnnouncementPanel large /><JumuahPanel /></View>
    </View>
  );

  const MinimalLandscape = () => (
    <View style={styles.minimalLayout}>
      <Text style={styles.minimalClock}>{displayClock(props.now, settings.showSeconds)}</Text>
      <Text style={styles.minimalArabic}>{NAMES[nextPrayer].ar}</Text>
      <Text style={styles.minimalEnglish}>{NAMES[nextPrayer].en}</Text>
      <View style={styles.minimalTimes}><Text style={styles.minimalAdhan}>Adhan {formatPrayerTime(nextTime)}</Text><Text style={styles.minimalIqama}>Iqama {nextIqama === "—" ? "—" : formatPrayerTime(nextIqama)}</Text></View>
      {props.next ? <Text style={styles.minimalCountdown}>{countdown(props.next.secondsRemaining)} until Adhan</Text> : null}
      <JumuahPanel />
    </View>
  );

  const MinaretPortrait = () => (
    <ScrollView contentContainerStyle={styles.portraitBody}>
      <View style={styles.portraitHeader}><Text style={styles.mosqueNamePortrait}>{settings.mosqueName}</Text><Text style={styles.location}>⌖ {props.locationLabel}</Text><Text style={styles.date}>{props.shortDate}</Text></View>
      <Text style={styles.portraitClock}>{displayClock(props.now, settings.showSeconds)}</Text>
      <NextPrayerCard portrait />
      <PrayerCards compact />
      <JumuahPanel />
      <AnnouncementPanel />
    </ScrollView>
  );

  const LobbyPortrait = () => (
    <ScrollView contentContainerStyle={styles.portraitBody}>
      <Text style={styles.mosqueNamePortrait}>{settings.mosqueName}</Text>
      <Text style={styles.portraitClock}>{displayClock(props.now, settings.showSeconds)}</Text>
      <NextPrayerCard portrait />
      <AnnouncementPanel large />
      <JumuahPanel />
      <PrayerCards compact />
    </ScrollView>
  );

  const MinimalPortrait = () => (
    <View style={styles.minimalPortrait}>
      <Text style={styles.mosqueNamePortrait}>{settings.mosqueName}</Text>
      <Text style={styles.portraitClock}>{displayClock(props.now, settings.showSeconds)}</Text>
      <Text style={styles.minimalArabicPortrait}>{NAMES[nextPrayer].ar}</Text>
      <Text style={styles.minimalEnglish}>{NAMES[nextPrayer].en}</Text>
      <Text style={styles.minimalAdhan}>Adhan {formatPrayerTime(nextTime)}</Text>
      <Text style={styles.minimalIqama}>Iqama {nextIqama === "—" ? "—" : formatPrayerTime(nextIqama)}</Text>
      {props.next ? <Text style={styles.minimalCountdown}>{countdown(props.next.secondsRemaining)}</Text> : null}
      <JumuahPanel />
    </View>
  );

  const importPastedSchedule = () => {
    try {
      const text = importText.trim();
      if (!text) return;
      if (text.startsWith("{")) {
        const data = JSON.parse(text);
        update({ adhanByDate: data.adhanByDate || data.adhan || {}, iqamaByDate: data.iqamaByDate || data.iqama || {} });
      } else update(csvToSchedule(text));
      setImportText("");
      Alert.alert("Schedule imported", "Adhan and Iqama schedule data is saved on this mosque display.");
    } catch (error) { Alert.alert("Import failed", String(error)); }
  };

  const importScheduleFile = async () => {
    try {
      const [DocumentPicker, FileSystem] = await Promise.all([import("expo-document-picker"), import("expo-file-system/legacy")]);
      const result = await DocumentPicker.getDocumentAsync({ type: ["text/csv", "application/json", "text/plain", "*/*"], copyToCacheDirectory: true, multiple: false });
      if (result.canceled || !result.assets?.[0]?.uri) return;
      const text = await FileSystem.readAsStringAsync(result.assets[0].uri);
      if (!text.trim()) throw new Error("The selected schedule file is empty.");
      if (text.trim().startsWith("{")) {
        const data = JSON.parse(text);
        update({ adhanByDate: data.adhanByDate || data.adhan || {}, iqamaByDate: data.iqamaByDate || data.iqama || {} });
      } else update(csvToSchedule(text));
      Alert.alert("Schedule uploaded", `${result.assets[0].name} was imported successfully.`);
    } catch (error) { Alert.alert("Schedule upload failed", String(error)); }
  };

  const addJumuah = () => setSettings((current) => ({ ...current, jumuah: [...current.jumuah, { id: `j${Date.now()}`, time: "", label: `Jumu’ah ${current.jumuah.length + 1}` }] }));
  const addAnnouncement = () => setSettings((current) => ({ ...current, announcements: [...current.announcements, { id: `a${Date.now()}`, title: "New announcement", body: "", priority: "normal" }] }));

  const body = landscape
    ? layout === "community" ? <CommunityLandscape /> : layout === "minimal" ? <MinimalLandscape /> : <GrandLandscape />
    : layout === "lobby" ? <LobbyPortrait /> : layout === "minimal" ? <MinimalPortrait /> : <MinaretPortrait />;

  return (
    <View style={[styles.screen, themeStyle]}>
      <Pressable onLongPress={() => setAdminOpen(true)} delayLongPress={900} style={styles.layoutFill}>{body}</Pressable>
      <View style={styles.footer}><Text style={styles.footerText}>{settings.mosqueSubtitle}</Text><Text style={styles.footerStatus}>{remoteOnline ? "● Connected" : "○ Offline-safe"}</Text></View>
      <Modal visible={adminOpen} animationType="slide" transparent onRequestClose={() => setAdminOpen(false)}>
        <View style={styles.modalShade}><View style={styles.admin}>
          <View style={styles.adminHeader}><View><Text style={styles.adminTitle}>Hassoun Masjid Control Center</Text><Text style={styles.adminSubtitle}>{landscape ? "Landscape TV" : "Portrait TV stand"}</Text></View><Pressable style={styles.done} onPress={() => setAdminOpen(false)}><Text style={styles.doneText}>Done</Text></Pressable></View>
          <View style={styles.tabs}>{(["display", "schedule", "jumuah", "announcements", "remote"] as const).map((item) => <Pressable key={item} onPress={() => setTab(item)} style={[styles.tab, tab === item && styles.tabActive]}><Text style={[styles.tabText, tab === item && styles.tabTextActive]}>{item.toUpperCase()}</Text></Pressable>)}</View>
          <ScrollView contentContainerStyle={styles.adminContent}>
            {tab === "display" ? <>
              <Text style={styles.adminLabel}>Mosque name</Text><TextInput value={settings.mosqueName} onChangeText={(mosqueName) => update({ mosqueName })} style={styles.input} />
              <Text style={styles.adminLabel}>Footer / subtitle</Text><TextInput value={settings.mosqueSubtitle} onChangeText={(mosqueSubtitle) => update({ mosqueSubtitle })} style={styles.input} />
              <Text style={styles.adminSection}>Landscape layouts</Text><View style={styles.choiceRow}>{(["grand", "community", "minimal"] as LandscapeLayout[]).map((item) => <Pressable key={item} onPress={() => update({ landscapeLayout: item })} style={[styles.choice, settings.landscapeLayout === item && styles.choiceActive]}><Text style={styles.choiceText}>{item}</Text></Pressable>)}</View>
              <Text style={styles.adminSection}>Portrait layouts</Text><View style={styles.choiceRow}>{(["minaret", "lobby", "minimal"] as PortraitLayout[]).map((item) => <Pressable key={item} onPress={() => update({ portraitLayout: item })} style={[styles.choice, settings.portraitLayout === item && styles.choiceActive]}><Text style={styles.choiceText}>{item}</Text></Pressable>)}</View>
              <Text style={styles.adminSection}>Theme</Text><View style={styles.choiceRow}>{(["emerald", "midnight", "ivory"] as const).map((item) => <Pressable key={item} onPress={() => update({ theme: item })} style={[styles.choice, settings.theme === item && styles.choiceActive]}><Text style={styles.choiceText}>{item}</Text></Pressable>)}</View>
              <ToggleRow label="Show seconds" value={settings.showSeconds} onChange={(showSeconds) => update({ showSeconds })} />
              <ToggleRow label="Show Iqama" value={settings.showIqama} onChange={(showIqama) => update({ showIqama })} />
              <ToggleRow label="Show Jumu’ah" value={settings.showJumuah} onChange={(showJumuah) => update({ showJumuah })} />
              <ToggleRow label="Show announcements" value={settings.showAnnouncements} onChange={(showAnnouncements) => update({ showAnnouncements })} />
            </> : null}

            {tab === "schedule" ? <>
              <Text style={styles.adminSection}>Default Iqama times</Text>
              {PRAYER_KEYS.map((prayer) => <View key={prayer} style={styles.formRow}><Text style={styles.formLabel}>{NAMES[prayer].en}</Text><TextInput value={settings.defaultIqama[prayer]} onChangeText={(value) => updateIqama(prayer, value)} placeholder="e.g. 6:15 AM" style={styles.timeInput} /></View>)}
              <Text style={styles.adminSection}>Upload mosque prayer schedule</Text>
              <Text style={styles.help}>CSV columns: date,fajr,dhuhr,asr,maghrib,isha,iqama_fajr,iqama_dhuhr,iqama_asr,iqama_maghrib,iqama_isha. JSON can contain adhanByDate and iqamaByDate.</Text>
              <Pressable style={styles.primary} onPress={() => void importScheduleFile()}><Text style={styles.primaryText}>Choose CSV / JSON Schedule File</Text></Pressable>
              <TextInput multiline value={importText} onChangeText={setImportText} placeholder="Or paste CSV / JSON here" style={[styles.input, styles.importBox]} />
              <Pressable style={styles.primary} onPress={importPastedSchedule}><Text style={styles.primaryText}>Import Pasted Schedule</Text></Pressable>
            </> : null}

            {tab === "jumuah" ? <>
              <View style={styles.sectionHeader}><Text style={styles.adminSection}>Jumu’ah sessions</Text><Pressable style={styles.smallButton} onPress={addJumuah}><Text style={styles.smallButtonText}>+ Add</Text></Pressable></View>
              <Text style={styles.help}>Add as many Friday prayers as your mosque offers. Each can have its own time, khateeb/imam and language.</Text>
              {settings.jumuah.map((session) => <View key={session.id} style={styles.editorCard}>
                <TextInput value={session.label} onChangeText={(label) => setSettings((current) => ({ ...current, jumuah: current.jumuah.map((item) => item.id === session.id ? { ...item, label } : item) }))} style={styles.input} />
                <View style={styles.formRow}><TextInput value={session.time} onChangeText={(time) => setSettings((current) => ({ ...current, jumuah: current.jumuah.map((item) => item.id === session.id ? { ...item, time } : item) }))} placeholder="1:30 PM" style={styles.timeInput} /><TextInput value={session.imam || ""} onChangeText={(imam) => setSettings((current) => ({ ...current, jumuah: current.jumuah.map((item) => item.id === session.id ? { ...item, imam } : item) }))} placeholder="Khateeb / Imam" style={styles.flexInput} /><TextInput value={session.language || ""} onChangeText={(language) => setSettings((current) => ({ ...current, jumuah: current.jumuah.map((item) => item.id === session.id ? { ...item, language } : item) }))} placeholder="Language" style={styles.flexInput} /></View>
                <Pressable onPress={() => setSettings((current) => ({ ...current, jumuah: current.jumuah.filter((item) => item.id !== session.id) }))}><Text style={styles.delete}>Remove session</Text></Pressable>
              </View>)}
            </> : null}

            {tab === "announcements" ? <>
              <View style={styles.sectionHeader}><Text style={styles.adminSection}>Announcements & activities</Text><Pressable style={styles.smallButton} onPress={addAnnouncement}><Text style={styles.smallButtonText}>+ Add</Text></Pressable></View>
              <Text style={styles.help}>Use this for classes, youth nights, lectures, fundraising, janazah notices, parking notices, Eid/Ramadan programs and emergency messages.</Text>
              {settings.announcements.map((announcementItem) => <View key={announcementItem.id} style={styles.editorCard}>
                <TextInput value={announcementItem.title} onChangeText={(title) => setSettings((current) => ({ ...current, announcements: current.announcements.map((item) => item.id === announcementItem.id ? { ...item, title } : item) }))} placeholder="Title" style={styles.input} />
                <TextInput multiline value={announcementItem.body} onChangeText={(bodyText) => setSettings((current) => ({ ...current, announcements: current.announcements.map((item) => item.id === announcementItem.id ? { ...item, body: bodyText } : item) }))} placeholder="Announcement" style={[styles.input, styles.announcementEditor]} />
                <View style={styles.choiceRow}>{(["normal", "important", "emergency"] as AnnouncementPriority[]).map((priority) => <Pressable key={priority} onPress={() => setSettings((current) => ({ ...current, announcements: current.announcements.map((item) => item.id === announcementItem.id ? { ...item, priority } : item) }))} style={[styles.choice, announcementItem.priority === priority && styles.choiceActive]}><Text style={styles.choiceText}>{priority}</Text></Pressable>)}</View>
                <Pressable onPress={() => setSettings((current) => ({ ...current, announcements: current.announcements.filter((item) => item.id !== announcementItem.id) }))}><Text style={styles.delete}>Delete announcement</Text></Pressable>
              </View>)}
            </> : null}

            {tab === "remote" ? <>
              <Text style={styles.adminSection}>Pair a mosque administrator</Text>
              <Text style={styles.help}>On the administrator’s phone open Hassoun → Wall & Masjid Displays and enter this six-character code.</Text>
              <View style={styles.codeCard}><Text style={styles.code}>{device?.pairingCode || "------"}</Text><Text style={styles.codeStatus}>{remoteOnline ? "● Remote service online" : "○ Offline / reconnecting"}</Text></View>
              <Pressable style={styles.primary} onPress={() => void refreshWallPairingCode().then(setDevice).catch((error) => Alert.alert("Pairing unavailable", String(error)))}><Text style={styles.primaryText}>Generate New Pairing Code</Text></Pressable>
              <View style={styles.remoteActions}><Pressable style={styles.secondary} onPress={props.onTestNotification}><Text>🔔 Test chime</Text></Pressable><Pressable style={styles.secondary} onPress={props.onTestAdhan}><Text>🕌 Test Adhan</Text></Pressable><Pressable style={styles.secondary} onPress={props.onEnableAlerts}><Text>✓ Check / enable alerts</Text></Pressable><Pressable style={styles.secondary} onPress={props.onRefreshPrayers}><Text>↻ Refresh prayer times</Text></Pressable></View>
            </> : null}
          </ScrollView>
        </View></View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#052B24" }, emerald: { backgroundColor: "#052B24" }, midnight: { backgroundColor: "#071318" }, ivory: { backgroundColor: "#3B3529" }, layoutFill: { flex: 1 },
  footer: { height: 38, borderTopWidth: 1, borderTopColor: "#78672E", paddingHorizontal: 24, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }, footerText: { color: "#E4D49C", fontSize: 15 }, footerStatus: { color: "#8CD7B9", fontSize: 13 },
  grandTop: { minHeight: 150, paddingHorizontal: 24, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }, mosqueName: { color: "#F6D675", fontWeight: "900", fontSize: 30 }, location: { color: "#EAE7DB", fontSize: 17, marginTop: 5 }, bigClock: { color: "#FFFDF5", fontWeight: "900", fontSize: 100, textShadowColor: "#A97716", textShadowOffset: { width: 5, height: 7 }, textShadowRadius: 3 }, dateBlock: { alignItems: "flex-end" }, date: { color: "#FFFDF5", fontWeight: "800", fontSize: 21 }, hijri: { color: "#E7C76B", fontSize: 17, marginTop: 6 },
  grandCenter: { flex: 1, flexDirection: "row", gap: 16, paddingHorizontal: 24 }, grandSide: { width: "28%", gap: 12 }, nextCard: { flex: 1, backgroundColor: "#063D32", borderColor: "#DDB94C", borderWidth: 2, borderRadius: 28, padding: 28, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }, nextCardPortrait: { flex: 0, flexDirection: "column", minHeight: 410 }, nextKicker: { color: "#DDB94C", fontSize: 18, fontWeight: "900", letterSpacing: 1.3 }, nextArabic: { color: "#F2CF68", fontSize: 72, fontWeight: "900", marginTop: 5 }, nextArabicPortrait: { fontSize: 90 }, nextEnglish: { color: "#FFFDF5", fontSize: 29, fontWeight: "800" }, nextRight: { alignItems: "flex-end" }, centered: { alignItems: "center" }, nextTime: { color: "#FFFDF5", fontSize: 66, fontWeight: "900" }, nextTimePortrait: { fontSize: 72 }, countdown: { color: "#EAC85D", fontSize: 23, fontWeight: "800", marginTop: 5 }, nextIqama: { color: "#AEE5D0", fontSize: 23, fontWeight: "900", marginTop: 10 },
  prayerRow: { flexDirection: "row", gap: 10, paddingHorizontal: 24, marginTop: 14, marginBottom: 12 }, prayerWrap: { flexWrap: "wrap", paddingHorizontal: 0 }, prayerCard: { flex: 1, minWidth: 115, backgroundColor: "rgba(2,35,29,0.9)", borderWidth: 1, borderColor: "#5D8A7A", borderRadius: 17, padding: 11, alignItems: "center" }, prayerCardCompact: { paddingVertical: 7 }, prayerSelected: { backgroundColor: "#07523F", borderColor: "#F0C954", borderWidth: 3 }, prayerArabic: { color: "#FFFDF5", fontSize: 25, fontWeight: "900" }, gold: { color: "#F0C954" }, prayerEnglish: { color: "#DCE8E2", fontSize: 15, fontWeight: "800" }, prayerIcon: { color: "#E7C451", fontSize: 24, marginVertical: 3 }, prayerTime: { color: "#FFFDF5", fontSize: 26, fontWeight: "900" }, iqama: { color: "#AEDBC8", fontSize: 13, fontWeight: "800", marginTop: 3 },
  infoPanel: { backgroundColor: "rgba(2,35,29,0.94)", borderColor: "#C8A747", borderWidth: 1, borderRadius: 17, padding: 15 }, panelKicker: { color: "#EBCB68", fontSize: 13, fontWeight: "900", letterSpacing: .7 }, jumuahItem: { marginTop: 8, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }, jumuahLabel: { color: "#FFF", fontSize: 16, fontWeight: "800" }, jumuahTime: { color: "#F0C954", fontSize: 24, fontWeight: "900" }, jumuahMeta: { color: "#C9DAD3", fontSize: 12, marginTop: 2 }, announcement: { backgroundColor: "rgba(3,42,34,0.94)", borderColor: "#4F816F", borderWidth: 1, borderRadius: 17, padding: 15 }, announcementLarge: { minHeight: 180 }, emergency: { borderColor: "#FFBE52", borderWidth: 3 }, announcementTitle: { color: "#FFF", fontSize: 21, fontWeight: "900", marginTop: 6 }, announcementTitleLarge: { fontSize: 29 }, announcementBody: { color: "#DFE9E4", fontSize: 15, lineHeight: 21, marginTop: 6 }, announcementBodyLarge: { fontSize: 19, lineHeight: 27 },
  landscapeBody: { flex: 1, flexDirection: "row", gap: 17, padding: 22 }, leftMain: { flex: 1 }, sideRail: { width: "30%", gap: 14 }, clockRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }, minimalLayout: { flex: 1, alignItems: "center", justifyContent: "center", padding: 30 }, minimalClock: { color: "#FFF", fontSize: 145, fontWeight: "900", textShadowColor: "#A97716", textShadowOffset: { width: 6, height: 8 }, textShadowRadius: 2 }, minimalArabic: { color: "#F2CF68", fontSize: 96, fontWeight: "900" }, minimalEnglish: { color: "#FFF", fontSize: 38, fontWeight: "800" }, minimalTimes: { flexDirection: "row", gap: 38, marginTop: 22 }, minimalAdhan: { color: "#FFF", fontSize: 36, fontWeight: "900" }, minimalIqama: { color: "#AEE5D0", fontSize: 36, fontWeight: "900" }, minimalCountdown: { color: "#EBCB68", fontSize: 25, marginTop: 13 },
  portraitBody: { flexGrow: 1, padding: 18, gap: 13 }, portraitHeader: { alignItems: "center" }, mosqueNamePortrait: { color: "#F6D675", textAlign: "center", fontSize: 33, fontWeight: "900" }, portraitClock: { color: "#FFF", textAlign: "center", fontSize: 108, fontWeight: "900", textShadowColor: "#9C6B12", textShadowOffset: { width: 5, height: 7 }, textShadowRadius: 2 }, minimalPortrait: { flex: 1, alignItems: "center", justifyContent: "center", padding: 30 }, minimalArabicPortrait: { color: "#F2CF68", fontSize: 112, fontWeight: "900" },
  modalShade: { flex: 1, backgroundColor: "rgba(0,0,0,.58)", justifyContent: "flex-end" }, admin: { height: "90%", backgroundColor: "#F8F5EC", borderTopLeftRadius: 25, borderTopRightRadius: 25 }, adminHeader: { padding: 20, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }, adminTitle: { color: "#083E33", fontSize: 28, fontWeight: "900" }, adminSubtitle: { color: "#5B6E67", fontSize: 15, marginTop: 2 }, done: { backgroundColor: "#07503F", borderRadius: 22, paddingHorizontal: 22, paddingVertical: 11 }, doneText: { color: "#FFF", fontWeight: "900" }, tabs: { flexDirection: "row", paddingHorizontal: 18, gap: 7 }, tab: { flex: 1, backgroundColor: "#E8E5DC", borderRadius: 11, paddingVertical: 11, alignItems: "center" }, tabActive: { backgroundColor: "#0A513F" }, tabText: { color: "#263A34", fontSize: 11, fontWeight: "900" }, tabTextActive: { color: "#FFF" }, adminContent: { padding: 20, paddingBottom: 60 }, adminLabel: { color: "#173C33", fontSize: 16, fontWeight: "800", marginBottom: 6 }, adminSection: { color: "#0A493C", fontSize: 21, fontWeight: "900", marginTop: 6, marginBottom: 11 }, input: { backgroundColor: "#FFF", borderColor: "#B9C6C0", borderWidth: 1, borderRadius: 11, padding: 12, fontSize: 16, marginBottom: 11 }, toggleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 10, borderBottomColor: "#E2E0D8", borderBottomWidth: 1 }, choiceRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 }, choice: { backgroundColor: "#E7E5DE", borderRadius: 11, paddingHorizontal: 15, paddingVertical: 10 }, choiceActive: { backgroundColor: "#E7C765" }, choiceText: { color: "#173C33", fontWeight: "800", textTransform: "capitalize" }, formRow: { flexDirection: "row", gap: 9, alignItems: "center", marginBottom: 9 }, formLabel: { width: 90, fontSize: 16, fontWeight: "800" }, timeInput: { width: 140, backgroundColor: "#FFF", borderColor: "#BBC7C2", borderWidth: 1, borderRadius: 10, padding: 11 }, flexInput: { flex: 1, backgroundColor: "#FFF", borderColor: "#BBC7C2", borderWidth: 1, borderRadius: 10, padding: 11 }, help: { color: "#5E6A66", fontSize: 14, lineHeight: 20, marginBottom: 11 }, importBox: { minHeight: 140, textAlignVertical: "top" }, primary: { backgroundColor: "#07503F", borderRadius: 11, padding: 14, alignItems: "center", marginVertical: 7 }, primaryText: { color: "#FFF", fontWeight: "900", fontSize: 16 }, sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" }, smallButton: { backgroundColor: "#E3C45E", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 }, smallButtonText: { color: "#193A31", fontWeight: "900" }, editorCard: { backgroundColor: "#EEEBE3", borderRadius: 13, padding: 13, marginBottom: 11 }, announcementEditor: { minHeight: 70, textAlignVertical: "top" }, delete: { color: "#A62929", fontWeight: "800", marginTop: 8 }, codeCard: { backgroundColor: "#E9E5D8", borderRadius: 15, padding: 20, alignItems: "center", marginVertical: 13 }, code: { color: "#07503F", fontSize: 45, fontWeight: "900", letterSpacing: 7 }, codeStatus: { color: "#53645F", marginTop: 5 }, remoteActions: { flexDirection: "row", flexWrap: "wrap", gap: 9, marginVertical: 12 }, secondary: { backgroundColor: "#E8E5DC", borderRadius: 11, padding: 13 }
});
