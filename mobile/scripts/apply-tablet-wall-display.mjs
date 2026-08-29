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
  '<View style={styles.brandText}><Text style={styles.title}>Hassoun</Text><Text style={styles.subtitle}>{locale === "ar" ? "📍 وندسور، أونتاريو • مواقيت الصلاة" : "📍 Windsor, Ontario • Prayer Times"}</Text></View>\n      <Pressable onPress={toggleLocale}',
  '<View style={styles.brandText}><Text style={styles.title}>Hassoun</Text><Text style={styles.subtitle}>{locale === "ar" ? "📍 وندسور، أونتاريو • مواقيت الصلاة" : "📍 Windsor, Ontario • Prayer Times"}</Text></View>\n      <Pressable onPress={() => setRemoteControllerOpen(true)} accessibilityLabel="Wall Displays" style={styles.languageButton}><Text style={styles.languageText}>📺</Text></Pressable>\n      <Pressable onPress={toggleLocale}',
  "phone wall remote button"
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

// Keep remote commands/status live without restarting the wall sync effect.
// The sync loop intentionally starts once, so every mutable value it reports or acts on
// must be read through a ref rather than from the first-render closure.
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

wallReplaceOnce(
  'if (command === "test_notification") onTestNotification?.();',
  'if (command === "test_notification") liveRef.current.onTestNotification?.();',
  "live notification test command"
);
wallReplaceOnce(
  'if (command === "test_adhan") onTestAdhan?.();',
  'if (command === "test_adhan") liveRef.current.onTestAdhan?.();',
  "live adhan test command"
);
wallReplaceOnce(
  'if (command === "enable_alerts") onEnableAlerts?.();',
  'if (command === "enable_alerts") liveRef.current.onEnableAlerts?.();',
  "live alert enable command"
);
wallReplaceOnce(
  'if (command === "refresh_prayers") onRefreshPrayers?.();',
  'if (command === "refresh_prayers") liveRef.current.onRefreshPrayers?.();',
  "live prayer refresh command"
);
wallReplaceOnce(
  'if (command === "show_next_prayer" && next && !next.isTomorrow) setVisibleIndex(Math.max(0, PRAYER_KEYS.indexOf(next.prayer)));',
  'if (command === "show_next_prayer") { const liveNext = liveRef.current.next; if (liveNext && !liveNext.isTomorrow) setVisibleIndex(Math.max(0, PRAYER_KEYS.indexOf(liveNext.prayer))); }',
  "live next prayer command"
);
wallReplaceOnce(
  'nextPrayer: next?.prayer || null, secondsRemaining: next?.secondsRemaining ?? null, location: locationLabel, alertsEnabled,',
  'nextPrayer: liveRef.current.next?.prayer || null, secondsRemaining: liveRef.current.next?.secondsRemaining ?? null, location: liveRef.current.locationLabel, alertsEnabled: liveRef.current.alertsEnabled,',
  "live remote core status"
);
wallReplaceOnce(
  'smartStage: stageFor(next, recentPrayer(today, new Date()), settingsRef.current.smartPrayerStages), batteryLevel, charging, designerLocked: settingsRef.current.designerLocked',
  'smartStage: stageFor(liveRef.current.next, recentPrayer(liveRef.current.today, new Date()), settingsRef.current.smartPrayerStages), batteryLevel: liveRef.current.batteryLevel, charging: liveRef.current.charging, designerLocked: settingsRef.current.designerLocked',
  "live remote smart and battery status"
);

fs.writeFileSync(wallPath, wall);
console.log("Applied smart portrait wall mode, full paired phone remote controller and live remote status fix");
