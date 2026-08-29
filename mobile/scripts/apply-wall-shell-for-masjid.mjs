import fs from "node:fs";

const appPath = new URL("../App.tsx", import.meta.url);
let source = fs.readFileSync(appPath, "utf8");
const apply = (from, to, label) => {
  if (source.includes(to)) return;
  if (!source.includes(from)) throw new Error(`Missing expected App source for ${label}`);
  source = source.replace(from, to);
};

apply('  View\n} from "react-native";','  View,\n  useWindowDimensions\n} from "react-native";', 'useWindowDimensions');
apply('import HomePrayerPanel from "./src/HomePrayerPanel";\n','import HomePrayerPanel from "./src/HomePrayerPanel";\nimport TabletWallPrayerDisplay from "./src/TabletWallPrayerDisplay";\nimport WallRemoteController from "./src/WallRemoteController";\n','wall imports');
apply('  const [alertPreferencesBusy, setAlertPreferencesBusy] = useState(false);\n','  const [alertPreferencesBusy, setAlertPreferencesBusy] = useState(false);\n  const [wallLocationLabel, setWallLocationLabel] = useState(CITY_LABEL);\n  const [remoteControllerOpen, setRemoteControllerOpen] = useState(false);\n  const { width: viewportWidth, height: viewportHeight } = useWindowDimensions();\n  const isPortraitWallTablet = activeTab === "home" && viewportWidth >= 600 && viewportHeight > viewportWidth;\n','wall state');
apply('      setPrayerTimes(loaded.prayerTimes);\n      setLive(loaded.live);\n','      setPrayerTimes(loaded.prayerTimes);\n      setLive(loaded.live);\n      setWallLocationLabel(loaded.location?.label && loaded.location.label !== "Current location" ? loaded.location.label : CITY_LABEL);\n','location');
apply('  const homeScreen = (\n','  const phoneHomeScreen = (\n','home rename');
apply('\n  const alertsScreen = (\n',`\n  const homeScreen = isPortraitWallTablet ? (\n    <TabletWallPrayerDisplay\n      locale={locale}\n      now={now}\n      shortDate={shortDate}\n      hijriDate={hijriDate}\n      locationLabel={wallLocationLabel}\n      today={today}\n      next={next}\n      preferences={phoneAlertPreferences}\n      alertsEnabled={alertsEnabled}\n      onTogglePrayer={(prayer) => void togglePrayerAudio(prayer)}\n      onOpenQibla={() => setActiveTab("qibla")}\n      onTestNotification={() => void testNotification()}\n      onTestAdhan={() => void testAdhan()}\n      onEnableAlerts={() => void toggleAlerts(true)}\n      onRefreshPrayers={() => void loadPrayerTimes().then((loaded) => {\n        setPrayerTimes(loaded.prayerTimes);\n        setLive(loaded.live);\n        setWallLocationLabel(loaded.location?.label && loaded.location.label !== "Current location" ? loaded.location.label : CITY_LABEL);\n      }).catch(() => undefined)}\n    />\n  ) : phoneHomeScreen;\n\n  const alertsScreen = (\n`,'tablet screen');
apply('  const moreScreen = <SettingsHub locale={locale} onToggleLocale={toggleLocale} onOpenAlerts={() => setActiveTab("alerts")} onOpenEmailAlerts={onOpenEmailAlerts} />;','  const moreScreen = <SettingsHub locale={locale} onToggleLocale={toggleLocale} onOpenAlerts={() => setActiveTab("alerts")} onOpenWallDisplays={() => setRemoteControllerOpen(true)} onOpenEmailAlerts={onOpenEmailAlerts} />;','settings callback');
apply('<StatusBar style="dark" /><View style={styles.flex}>{body}</View>','<StatusBar hidden={isPortraitWallTablet} style="dark" /><View style={styles.flex}>{body}</View><WallRemoteController visible={remoteControllerOpen} onClose={() => setRemoteControllerOpen(false)} />','wall status/modal');
apply('{(activeTab !== "quran" || !quranOwnsAudioSurface) && globalQuranAudio.state !== "idle"','{!isPortraitWallTablet && (activeTab !== "quran" || !quranOwnsAudioSurface) && globalQuranAudio.state !== "idle"','hide audio');
apply('{activeTab !== "qibla" && (activeTab !== "quran" || quranAppNavVisible) ? <View style={styles.bottomNav}>','{!isPortraitWallTablet && activeTab !== "qibla" && (activeTab !== "quran" || quranAppNavVisible) ? <View style={styles.bottomNav}>','hide nav');
fs.writeFileSync(appPath, source);

const settingsPath = new URL("../src/SettingsHub.tsx", import.meta.url);
let settings = fs.readFileSync(settingsPath, "utf8");
const sapply = (from, to, label) => {
  if (settings.includes(to)) return;
  if (!settings.includes(from)) throw new Error(`Missing expected Settings source for ${label}`);
  settings = settings.replace(from, to);
};
sapply('  onOpenAlerts: () => void;\n  onOpenEmailAlerts?: () => void;','  onOpenAlerts: () => void;\n  onOpenWallDisplays: () => void;\n  onOpenEmailAlerts?: () => void;','prop');
sapply('export default function SettingsHub({ locale, onToggleLocale, onOpenAlerts, onOpenEmailAlerts }: Props) {','export default function SettingsHub({ locale, onToggleLocale, onOpenAlerts, onOpenWallDisplays, onOpenEmailAlerts }: Props) {','callback');
sapply('        <Row emoji="🔔" title={t("Prayer & Adhan alerts", "تنبيهات الصلاة والأذان")} text={t("Notification, Adhan and email alert controls", "التحكم بالتنبيهات والأذان وتنبيهات البريد")} onPress={onOpenAlerts} />\n        <Row emoji="🌐"','        <Row emoji="🔔" title={t("Prayer & Adhan alerts", "تنبيهات الصلاة والأذان")} text={t("Notification, Adhan and email alert controls", "التحكم بالتنبيهات والأذان وتنبيهات البريد")} onPress={onOpenAlerts} />\n        <Row emoji="📺" title={t("Wall & Masjid Displays", "شاشات الحائط والمساجد")} text={t("Pair and remotely control Hassoun wall tablets and mosque TVs", "اقرن وتحكم عن بعد في شاشات Hassoun اللوحية وشاشات المساجد")} onPress={onOpenWallDisplays} />\n        <Row emoji="🌐"','row');
fs.writeFileSync(settingsPath, settings);
console.log('Applied clean shared wall shell for Masjid build');
