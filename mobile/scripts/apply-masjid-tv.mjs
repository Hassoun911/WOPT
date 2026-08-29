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
  '  View,\n  useWindowDimensions\n} from "react-native";',
  '  View,\n  useWindowDimensions,\n  Platform\n} from "react-native";',
  "Platform TV detection import"
);

replaceOnce(
  'import WallRemoteController from "./src/WallRemoteController";\n',
  'import WallRemoteController from "./src/WallRemoteController";\nimport MasjidTvDisplay from "./src/MasjidTvDisplay";\n',
  "Masjid TV display import"
);

replaceOnce(
  '  const isPortraitWallTablet = activeTab === "home" && viewportWidth >= 600 && viewportHeight > viewportWidth;\n',
  '  const isPortraitWallTablet = activeTab === "home" && viewportWidth >= 600 && viewportHeight > viewportWidth && !Platform.isTV;\n  const isMasjidTv = Boolean(Platform.isTV);\n',
  "Android TV mode detection"
);

replaceOnce(
  '\n  const alertsScreen = (\n',
  `\n  const masjidTvScreen = (\n    <MasjidTvDisplay\n      locale={locale}\n      now={now}\n      dateKey={todayKey}\n      shortDate={shortDate}\n      hijriDate={hijriDate}\n      locationLabel={wallLocationLabel}\n      today={today}\n      next={next}\n      onTestNotification={() => void testNotification()}\n      onTestAdhan={() => void testAdhan()}\n      onEnableAlerts={() => void toggleAlerts(true)}\n      onRefreshPrayers={() => void loadPrayerTimes().then((loaded) => {\n        setPrayerTimes(loaded.prayerTimes);\n        setLive(loaded.live);\n        setWallLocationLabel(loaded.location?.label && loaded.location.label !== "Current location" ? loaded.location.label : CITY_LABEL);\n      }).catch(() => undefined)}\n    />\n  );\n\n  const alertsScreen = (\n`,
  "Masjid TV screen"
);

replaceOnce(
  '  const body = activeTab === "quran"\n',
  '  const body = isMasjidTv ? masjidTvScreen : activeTab === "quran"\n',
  "Masjid TV body priority"
);

replaceOnce(
  '<StatusBar hidden={isPortraitWallTablet} style="dark" /><View style={styles.flex}>{body}</View><WallRemoteController visible={remoteControllerOpen} onClose={() => setRemoteControllerOpen(false)} />',
  '<StatusBar hidden={isPortraitWallTablet || isMasjidTv} style="dark" /><View style={styles.flex}>{body}</View>{!isMasjidTv ? <WallRemoteController visible={remoteControllerOpen} onClose={() => setRemoteControllerOpen(false)} /> : null}',
  "TV status bar and phone controller"
);

replaceOnce(
  '{!isPortraitWallTablet && (activeTab !== "quran" || !quranOwnsAudioSurface) && globalQuranAudio.state !== "idle"',
  '{!isPortraitWallTablet && !isMasjidTv && (activeTab !== "quran" || !quranOwnsAudioSurface) && globalQuranAudio.state !== "idle"',
  "hide audio surface on TV"
);

replaceOnce(
  '{!isPortraitWallTablet && activeTab !== "qibla" && (activeTab !== "quran" || quranAppNavVisible) ? <View style={styles.bottomNav}>',
  '{!isPortraitWallTablet && !isMasjidTv && activeTab !== "qibla" && (activeTab !== "quran" || quranAppNavVisible) ? <View style={styles.bottomNav}>',
  "hide app nav on TV"
);

fs.writeFileSync(appPath, source);
console.log("Applied Hassoun Masjid Android TV mode with portrait/landscape layout routing");
