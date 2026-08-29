import fs from "node:fs";

const appPath = new URL("../App.tsx", import.meta.url);
let source = fs.readFileSync(appPath, "utf8");

const replaceOnce = (from, to, label) => {
  if (!source.includes(from)) {
    if (source.includes(to)) return;
    throw new Error(`Missing expected source for ${label}`);
  }
  source = source.replace(from, to);
};

replaceOnce(
  '  View\n} from "react-native";',
  '  View,\n  useWindowDimensions\n} from "react-native";',
  "useWindowDimensions import"
);

replaceOnce(
  'import HomePrayerPanel from "./src/HomePrayerPanel";\n',
  'import HomePrayerPanel from "./src/HomePrayerPanel";\nimport TabletWallPrayerDisplay from "./src/TabletWallPrayerDisplay";\nimport WallRemoteController from "./src/WallRemoteController";\n',
  "smart wall imports"
);

replaceOnce(
  '  const [alertPreferencesBusy, setAlertPreferencesBusy] = useState(false);\n',
  '  const [alertPreferencesBusy, setAlertPreferencesBusy] = useState(false);\n  const [wallLocationLabel, setWallLocationLabel] = useState(CITY_LABEL);\n  const [remoteControllerOpen, setRemoteControllerOpen] = useState(false);\n  const { width: viewportWidth, height: viewportHeight } = useWindowDimensions();\n  const isPortraitWallTablet = activeTab === "home" && viewportWidth >= 600 && viewportHeight > viewportWidth;\n',
  "tablet detection and remote controller state"
);

replaceOnce(
  '      setPrayerTimes(loaded.prayerTimes);\n      setLive(loaded.live);\n',
  '      setPrayerTimes(loaded.prayerTimes);\n      setLive(loaded.live);\n      setWallLocationLabel(loaded.location?.label && loaded.location.label !== "Current location" ? loaded.location.label : CITY_LABEL);\n',
  "live wall location label"
);

replaceOnce(
  '  const homeScreen = (\n',
  '  const phoneHomeScreen = (\n',
  "phone home screen rename"
);

replaceOnce(
  '\n  const alertsScreen = (\n',
  `\n  const homeScreen = isPortraitWallTablet ? (\n    <TabletWallPrayerDisplay\n      locale={locale}\n      now={now}\n      shortDate={shortDate}\n      hijriDate={hijriDate}\n      locationLabel={wallLocationLabel}\n      today={today}\n      next={next}\n      preferences={phoneAlertPreferences}\n      alertsEnabled={alertsEnabled}\n      onTogglePrayer={(prayer) => void togglePrayerAudio(prayer)}\n      onOpenQibla={() => setActiveTab("qibla")}\n      onTestNotification={() => void testNotification()}\n      onTestAdhan={() => void testAdhan()}\n      onEnableAlerts={() => void toggleAlerts(true)}\n      onRefreshPrayers={() => void loadPrayerTimes().then((loaded) => {\n        setPrayerTimes(loaded.prayerTimes);\n        setLive(loaded.live);\n        setWallLocationLabel(loaded.location?.label && loaded.location.label !== "Current location" ? loaded.location.label : CITY_LABEL);\n      }).catch(() => undefined)}\n    />\n  ) : phoneHomeScreen;\n\n  const alertsScreen = (\n`,
  "smart tablet wall selection"
);

replaceOnce(
  '  const moreScreen = <SettingsHub locale={locale} onToggleLocale={toggleLocale} onOpenAlerts={() => setActiveTab("alerts")} onOpenEmailAlerts={onOpenEmailAlerts} />;',
  '  const moreScreen = <SettingsHub locale={locale} onToggleLocale={toggleLocale} onOpenAlerts={() => setActiveTab("alerts")} onOpenWallDisplays={() => setRemoteControllerOpen(true)} onOpenEmailAlerts={onOpenEmailAlerts} />;',
  "wall displays in settings"
);

replaceOnce(
  '<StatusBar style="dark" /><View style={styles.flex}>{body}</View>',
  '<StatusBar hidden={isPortraitWallTablet} style="dark" /><View style={styles.flex}>{body}</View><WallRemoteController visible={remoteControllerOpen} onClose={() => setRemoteControllerOpen(false)} />',
  "status bar and phone remote modal"
);

replaceOnce(
  '{(activeTab !== "quran" || !quranOwnsAudioSurface) && globalQuranAudio.state !== "idle"',
  '{!isPortraitWallTablet && (activeTab !== "quran" || !quranOwnsAudioSurface) && globalQuranAudio.state !== "idle"',
  "hide global Quran audio bar in portrait wall mode"
);

replaceOnce(
  '{activeTab !== "qibla" && (activeTab !== "quran" || quranAppNavVisible) ? <View style={styles.bottomNav}>',
  '{!isPortraitWallTablet && activeTab !== "qibla" && (activeTab !== "quran" || quranAppNavVisible) ? <View style={styles.bottomNav}>',
  "hide normal app navigation in portrait wall mode"
);

fs.writeFileSync(appPath, source);

// Put Wall Displays under Settings & Support, not in the Home header.
const settingsPath = new URL("../src/SettingsHub.tsx", import.meta.url);
let settingsHub = fs.readFileSync(settingsPath, "utf8");
const settingsReplaceOnce = (from, to, label) => {
  if (!settingsHub.includes(from)) {
    if (settingsHub.includes(to)) return;
    throw new Error(`Missing expected settings source for ${label}`);
  }
  settingsHub = settingsHub.replace(from, to);
};
settingsReplaceOnce(
  '  onOpenAlerts: () => void;\n  onOpenEmailAlerts?: () => void;',
  '  onOpenAlerts: () => void;\n  onOpenWallDisplays: () => void;\n  onOpenEmailAlerts?: () => void;',
  "settings wall displays prop"
);
settingsReplaceOnce(
  'export default function SettingsHub({ locale, onToggleLocale, onOpenAlerts, onOpenEmailAlerts }: Props) {',
  'export default function SettingsHub({ locale, onToggleLocale, onOpenAlerts, onOpenWallDisplays, onOpenEmailAlerts }: Props) {',
  "settings wall displays callback"
);
settingsReplaceOnce(
  '        <Row emoji="🔔" title={t("Prayer & Adhan alerts", "تنبيهات الصلاة والأذان")} text={t("Notification, Adhan and email alert controls", "التحكم بالتنبيهات والأذان وتنبيهات البريد")} onPress={onOpenAlerts} />\n        <Row emoji="🌐"',
  '        <Row emoji="🔔" title={t("Prayer & Adhan alerts", "تنبيهات الصلاة والأذان")} text={t("Notification, Adhan and email alert controls", "التحكم بالتنبيهات والأذان وتنبيهات البريد")} onPress={onOpenAlerts} />\n        <Row emoji="📺" title={t("Wall Displays", "شاشات الحائط")} text={t("Pair and remotely control your Hassoun wall tablets", "اقرن وتحكم عن بعد في أجهزة Hassoun اللوحية على الحائط")} onPress={onOpenWallDisplays} />\n        <Row emoji="🌐"',
  "wall displays settings row"
);
fs.writeFileSync(settingsPath, settingsHub);

// Keep remote commands/status live without restarting the wall sync effect.
const wallPath = new URL("../src/TabletWallPrayerDisplay.tsx", import.meta.url);
let wall = fs.readFileSync(wallPath, "utf8");
const wallReplaceOnce = (from, to, label) => {
  if (!wall.includes(from)) {
    if (wall.includes(to)) return;
    throw new Error(`Missing expected wall source for ${label}`);
  }
  wall = wall.replace(from, to);
};
wallReplaceOnce(
  '  const transition = useRef(new Animated.Value(1)).current; const previousIndex = useRef(visibleIndex); const applyingRemote = useRef(false);\n',
  '  const transition = useRef(new Animated.Value(1)).current; const previousIndex = useRef(visibleIndex); const applyingRemote = useRef(false);\n  const liveRef = useRef({ next, today, locationLabel, alertsEnabled, batteryLevel, charging, onTestNotification, onTestAdhan, onEnableAlerts, onRefreshPrayers });\n  liveRef.current = { next, today, locationLabel, alertsEnabled, batteryLevel, charging, onTestNotification, onTestAdhan, onEnableAlerts, onRefreshPrayers };\n',
  "live remote status ref"
);
wallReplaceOnce('if (command === "test_notification") onTestNotification?.();','if (command === "test_notification") liveRef.current.onTestNotification?.();',"live notification test command");
wallReplaceOnce('if (command === "test_adhan") onTestAdhan?.();','if (command === "test_adhan") liveRef.current.onTestAdhan?.();',"live adhan test command");
wallReplaceOnce('if (command === "enable_alerts") onEnableAlerts?.();','if (command === "enable_alerts") liveRef.current.onEnableAlerts?.();',"live alert enable command");
wallReplaceOnce('if (command === "refresh_prayers") onRefreshPrayers?.();','if (command === "refresh_prayers") liveRef.current.onRefreshPrayers?.();',"live prayer refresh command");
wallReplaceOnce('if (command === "show_next_prayer" && next && !next.isTomorrow) setVisibleIndex(Math.max(0, PRAYER_KEYS.indexOf(next.prayer)));','if (command === "show_next_prayer") { const liveNext = liveRef.current.next; if (liveNext && !liveNext.isTomorrow) setVisibleIndex(Math.max(0, PRAYER_KEYS.indexOf(liveNext.prayer))); }',"live next prayer command");
wallReplaceOnce('nextPrayer: next?.prayer || null, secondsRemaining: next?.secondsRemaining ?? null, location: locationLabel, alertsEnabled,','nextPrayer: liveRef.current.next?.prayer || null, secondsRemaining: liveRef.current.next?.secondsRemaining ?? null, location: liveRef.current.locationLabel, alertsEnabled: liveRef.current.alertsEnabled,',"live remote core status");
wallReplaceOnce('smartStage: stageFor(next, recentPrayer(today, new Date()), settingsRef.current.smartPrayerStages), batteryLevel, charging, designerLocked: settingsRef.current.designerLocked','smartStage: stageFor(liveRef.current.next, recentPrayer(liveRef.current.today, new Date()), settingsRef.current.smartPrayerStages), batteryLevel: liveRef.current.batteryLevel, charging: liveRef.current.charging, designerLocked: settingsRef.current.designerLocked',"live remote smart and battery status");
fs.writeFileSync(wallPath, wall);

// Make every remote design change instant and keep the last selected choice stable.
const remotePath = new URL("../src/WallRemoteController.tsx", import.meta.url);
let remote = fs.readFileSync(remotePath, "utf8");
const remoteReplaceOnce = (from, to, label) => {
  if (!remote.includes(from)) {
    if (remote.includes(to)) return;
    throw new Error(`Missing expected remote source for ${label}`);
  }
  remote = remote.replace(from, to);
};
remoteReplaceOnce(
  'import { useEffect, useMemo, useState } from "react";',
  'import { useEffect, useMemo, useRef, useState } from "react";',
  "remote refs import"
);
remoteReplaceOnce(
  '  const [textTarget, setTextTarget] = useState("clock");\n  const selectedLink = useMemo(() => links.find((item) => item.displayId === selectedId) ?? null, [links, selectedId]);',
  '  const [textTarget, setTextTarget] = useState("clock");\n  const draftRef = useRef<Record<string, any>>({});\n  const sendingRef = useRef(false);\n  const queuedRef = useRef<Record<string, any> | null>(null);\n  const selectedLink = useMemo(() => links.find((item) => item.displayId === selectedId) ?? null, [links, selectedId]);\n  useEffect(() => { draftRef.current = draft; }, [draft]);',
  "remote remembered draft refs"
);
remoteReplaceOnce(
  '      setDisplay(state);\n      setDraft(state.settings || {});',
  '      setDisplay(state);\n      if (!sendingRef.current && !queuedRef.current) { setDraft(state.settings || {}); draftRef.current = state.settings || {}; }',
  "do not overwrite live user choice"
);
remoteReplaceOnce(
  '  const patch = (values: Record<string, any>) => setDraft((current) => ({ ...current, ...values }));\n  const patchText = (target: string, values: Record<string, any>) => setDraft((current) => ({ ...current, text: { ...(current.text || {}), [target]: { ...(current.text?.[target] || {}), ...values } } }));\n\n  const apply = async () => {\n    if (!selectedLink) return;\n    setBusy(true);\n    try {\n      await updateRemoteWallSettings(selectedLink, draft);\n      Alert.alert("Sent", "The wall display will apply these settings within a few seconds.");\n      await refreshState(true);\n    } catch (error) { Alert.alert("Could not update display", String(error)); }\n    finally { setBusy(false); }\n  };',
  `  const sendLiveSettings = async (nextDraft: Record<string, any>) => {\n    if (!selectedLink) return;\n    queuedRef.current = nextDraft;\n    if (sendingRef.current) return;\n    sendingRef.current = true;\n    try {\n      while (queuedRef.current) {\n        const payload = queuedRef.current;\n        queuedRef.current = null;\n        await updateRemoteWallSettings(selectedLink, payload);\n      }\n    } catch (error) {\n      Alert.alert("Could not update display", String(error));\n    } finally {\n      sendingRef.current = false;\n    }\n  };\n\n  const commitDraft = (builder: (current: Record<string, any>) => Record<string, any>) => {\n    const nextDraft = builder(draftRef.current);\n    draftRef.current = nextDraft;\n    setDraft(nextDraft);\n    void sendLiveSettings(nextDraft);\n  };\n  const patch = (values: Record<string, any>) => commitDraft((current) => ({ ...current, ...values }));\n  const patchText = (target: string, values: Record<string, any>) => commitDraft((current) => ({ ...current, text: { ...(current.text || {}), [target]: { ...(current.text?.[target] || {}), ...values } } }));`,
  "instant remote apply"
);
remoteReplaceOnce(
  '<Text style={styles.section}>Every text element</Text>',
  '<Text style={styles.section}>Every text element</Text><Text style={styles.note}>Changes apply instantly and your last selected color, font and size stay selected.</Text>',
  "instant apply help text"
);
remoteReplaceOnce(
  '<Pressable disabled={busy} onPress={() => void apply()} style={styles.saveButton}><Text style={styles.saveText}>Apply changes</Text></Pressable>',
  '<View style={styles.saveButton}><Text style={styles.saveText}>✓ Changes apply automatically</Text></View>',
  "automatic apply indicator"
);
fs.writeFileSync(remotePath, remote);

console.log("Applied smart wall mode, Settings remote entry, live status and instant remembered remote controls");
