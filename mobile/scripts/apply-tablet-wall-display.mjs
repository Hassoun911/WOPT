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
console.log("Applied smart portrait wall mode and full paired phone remote controller");
