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
  'import HomePrayerPanel from "./src/HomePrayerPanel";\nimport TabletWallPrayerDisplay from "./src/TabletWallPrayerDisplay";\n',
  "tablet wall component import"
);

replaceOnce(
  '  const [alertPreferencesBusy, setAlertPreferencesBusy] = useState(false);\n',
  '  const [alertPreferencesBusy, setAlertPreferencesBusy] = useState(false);\n  const [wallLocationLabel, setWallLocationLabel] = useState(CITY_LABEL);\n  const { width: viewportWidth, height: viewportHeight } = useWindowDimensions();\n  const isPortraitWallTablet = activeTab === "home" && viewportWidth >= 600 && viewportHeight > viewportWidth;\n',
  "tablet portrait detection and location state"
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
  `\n  const homeScreen = isPortraitWallTablet ? (\n    <TabletWallPrayerDisplay\n      locale={locale}\n      now={now}\n      shortDate={shortDate}\n      hijriDate={hijriDate}\n      locationLabel={wallLocationLabel}\n      today={today}\n      next={next}\n      preferences={phoneAlertPreferences}\n      onTogglePrayer={(prayer) => void togglePrayerAudio(prayer)}\n      onOpenQibla={() => setActiveTab("qibla")}\n    />\n  ) : phoneHomeScreen;\n\n  const alertsScreen = (\n`,
  "tablet wall home selection"
);

replaceOnce(
  '<StatusBar style="dark" /><View style={styles.flex}>{body}</View>',
  '<StatusBar hidden={isPortraitWallTablet} style="dark" /><View style={styles.flex}>{body}</View>',
  "hide status bar in portrait wall mode"
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

const wallPath = new URL("../src/TabletWallPrayerDisplay.tsx", import.meta.url);
let wall = fs.readFileSync(wallPath, "utf8");
const replaceWall = (from, to) => {
  if (wall.includes(from)) wall = wall.replace(from, to);
};

replaceWall('const WALL_SETTINGS_KEY = "hassoun:tablet-wall-display:settings:v4";', 'const WALL_SETTINGS_KEY = "hassoun:tablet-wall-display:settings:v5";');
replaceWall('clock: { color: "#FFFFFF", fontFamily: "sans-serif", fontSize: 150, fontWeight: "900" }', 'clock: { color: "#FFFFFF", fontFamily: "sans-serif", fontSize: 190, fontWeight: "900" }');
replaceWall('arabic: { color: "#F0CC72", fontFamily: "Noto Naskh Arabic", fontSize: 108, fontWeight: "900" }', 'arabic: { color: "#F0CC72", fontFamily: "Noto Naskh Arabic", fontSize: 122, fontWeight: "900" }');
replaceWall('prayerTime: { color: "#FFFFFF", fontFamily: "sans-serif", fontSize: 104, fontWeight: "900" }', 'prayerTime: { color: "#FFFFFF", fontFamily: "sans-serif", fontSize: 132, fontWeight: "900" }');
replaceWall('bottomCardHeight: 92,', 'bottomCardHeight: 106,');
replaceWall('screen: { flex: 1, paddingHorizontal: 28, paddingTop: 8, paddingBottom: 12, overflow: "hidden" }', 'screen: { flex: 1, paddingHorizontal: 14, paddingTop: 4, paddingBottom: 8, overflow: "hidden" }');
replaceWall('backgroundVeil: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(255,249,235,0.70)" }', 'backgroundVeil: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: "rgba(255,249,235,0.70)" }');
replaceWall('metaRow: { minHeight: 52, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 22, paddingHorizontal: 30 }', 'metaRow: { minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 18, paddingHorizontal: 16 }');
replaceWall('clockArea: { height: 168, justifyContent: "center", alignItems: "center", marginTop: -4 }, clockStack: { width: "100%", height: 160, justifyContent: "center", alignItems: "center" }', 'clockArea: { height: 208, justifyContent: "center", alignItems: "center", marginTop: -8 }, clockStack: { width: "100%", height: 202, justifyContent: "center", alignItems: "center" }');
replaceWall('mainCard: { flex: 1, minHeight: 0, marginHorizontal: 46, marginTop: 6, marginBottom: 14, paddingHorizontal: 34, paddingVertical: 18, alignItems: "center", justifyContent: "space-evenly", shadowColor: "#3F3319", shadowOpacity: 0.24, shadowRadius: 15, shadowOffset: { width: 0, height: 9 }, elevation: 8 }', 'mainCard: { flex: 1, minHeight: 0, marginHorizontal: 10, marginTop: 0, marginBottom: 10, paddingHorizontal: 22, paddingVertical: 12, alignItems: "center", justifyContent: "space-evenly", shadowColor: "#3F3319", shadowOpacity: 0.28, shadowRadius: 18, shadowOffset: { width: 0, height: 10 }, elevation: 10 }');
replaceWall('prayerArabic: { width: "100%", textAlign: "center", lineHeight: 130,', 'prayerArabic: { width: "100%", textAlign: "center", lineHeight: 142,');
replaceWall('prayerTime: { width: "100%", textAlign: "center", lineHeight: 118,', 'prayerTime: { width: "100%", textAlign: "center", lineHeight: 146,');
replaceWall('bottomStrip: { flexDirection: "row", gap: 9, marginHorizontal: 8 }, bottomCard: { flex: 1, borderWidth: 1, borderRadius: 17, alignItems: "center", justifyContent: "center", paddingHorizontal: 4, paddingVertical: 5 }', 'bottomStrip: { flexDirection: "row", gap: 6, marginHorizontal: 0 }, bottomCard: { flex: 1, borderWidth: 1, borderRadius: 15, alignItems: "center", justifyContent: "center", paddingHorizontal: 3, paddingVertical: 6 }');
replaceWall('nextPill: { borderWidth: 1, borderColor: "#D9B65C", borderRadius: 999, paddingHorizontal: 24, paddingVertical: 8 }', 'nextPill: { borderWidth: 1, borderColor: "#D9B65C", borderRadius: 999, paddingHorizontal: 28, paddingVertical: 9 }');
replaceWall('nextPillText: { color: "#F0CC72", fontWeight: "900", fontSize: 16, letterSpacing: 1.2 }', 'nextPillText: { color: "#F0CC72", fontWeight: "900", fontSize: 17, letterSpacing: 1.3 }');
replaceWall('mosqueGlow: { position: "absolute", left: "10%", right: "10%", bottom: 96, height: 290, borderWidth: 2, borderRadius: 180 }', 'mosqueGlow: { position: "absolute", left: "3%", right: "3%", bottom: 94, height: 390, borderWidth: 2, borderRadius: 210 }');

fs.writeFileSync(wallPath, wall);
console.log("Applied approved full-screen portrait tablet wall Adhan display with larger couch-readable layout");
