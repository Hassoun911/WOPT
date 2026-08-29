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
  `\n  const homeScreen = isPortraitWallTablet ? (\n    <TabletWallPrayerDisplay\n      locale={locale}\n      now={now}\n      shortDate={shortDate}\n      hijriDate={hijriDate}\n      locationLabel={wallLocationLabel}\n      today={today}\n      next={next}\n      preferences={phoneAlertPreferences}\n      alertsEnabled={alertsEnabled}\n      onTogglePrayer={(prayer) => void togglePrayerAudio(prayer)}\n      onOpenQibla={() => setActiveTab("qibla")}\n      onTestNotification={() => void testNotification()}\n      onTestAdhan={() => void testAdhan()}\n      onEnableAlerts={() => void toggleAlerts(true)}\n    />\n  ) : phoneHomeScreen;\n\n  const alertsScreen = (\n`,
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

replaceWall('  onTogglePrayer: (prayer: PrayerKey) => void;\n  onOpenQibla: () => void;\n', '  onTogglePrayer: (prayer: PrayerKey) => void;\n  onOpenQibla: () => void;\n  alertsEnabled?: boolean;\n  onTestNotification?: () => void;\n  onTestAdhan?: () => void;\n  onEnableAlerts?: () => void;\n');
replaceWall('  clockShadowColor: string;\n  clockShadowRadius: number;\n  clockShadowDepth: number;\n', '  clockShadowColor: string;\n  clockShadowRadius: number;\n  clockShadowDepth: number;\n  clockEdgeColor: string;\n  clockEdgeWidth: number;\n');
replaceWall('const WALL_SETTINGS_KEY = "hassoun:tablet-wall-display:settings:v6";', 'const WALL_SETTINGS_KEY = "hassoun:tablet-wall-display:settings:v7";');
replaceWall('const FONT_CHOICES = ["System", "sans-serif", "sans-serif-medium", "sans-serif-condensed", "serif", "monospace", "Noto Naskh Arabic", "Noto Kufi Arabic", "Noto Sans Arabic", "Traditional Arabic"];', 'const FONT_CHOICES = ["System", "sans-serif", "sans-serif-medium", "sans-serif-black", "sans-serif-condensed", "sans-serif-light", "sans-serif-thin", "serif", "serif-monospace", "monospace", "cursive", "Noto Naskh Arabic", "Noto Kufi Arabic", "Noto Sans Arabic", "Traditional Arabic"];');
replaceWall('const COLOR_SWATCHES = ["#FFFFFF", "#FFF9EB", "#F6E7B0", "#E8C767", "#C89932", "#0A5B48", "#07503F", "#03392F", "#102D27", "#171717", "#7A2D2D", "#315D89"];', 'const COLOR_SWATCHES = ["#FFFFFF", "#FFFDF6", "#FFF9EB", "#F6E7B0", "#F1D27A", "#E8C767", "#D7A93A", "#C89932", "#9E6D13", "#0A5B48", "#07503F", "#03392F", "#102D27", "#171717", "#3A2A12", "#7A2D2D", "#9B2335", "#315D89", "#5E4A8A"];');
replaceWall('clock: { color: "#FFFFFF", fontFamily: "sans-serif", fontSize: 210, fontWeight: "900" }', 'clock: { color: "#FFFFFF", fontFamily: "sans-serif-black", fontSize: 218, fontWeight: "900" }');
replaceWall('  clockShadowColor: "#8A651C",\n  clockShadowRadius: 7,\n  clockShadowDepth: 7,\n', '  clockShadowColor: "#5B3B08",\n  clockShadowRadius: 10,\n  clockShadowDepth: 10,\n  clockEdgeColor: "#D8A42B",\n  clockEdgeWidth: 3,\n');
replaceWall('export default function TabletWallPrayerDisplay({ locale, now, shortDate, locationLabel = "Current location", today, next, preferences, onTogglePrayer }: Props)', 'export default function TabletWallPrayerDisplay({ locale, now, shortDate, locationLabel = "Current location", today, next, preferences, onTogglePrayer, alertsEnabled = false, onTestNotification, onTestAdhan, onEnableAlerts }: Props)');
replaceWall('      <View style={styles.clockStack}>\n        <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.62} style={[styles.clock3d, textStyle("clock"), { color: settings.clockShadowColor, transform: [{ translateY: settings.clockShadowDepth }, { translateX: 2 }] }]}>{clockText}</Text>\n        <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.62} style={[styles.clockFace, textStyle("clock"), { textShadowColor: "#2D2218", textShadowRadius: settings.clockShadowRadius, textShadowOffset: { width: 0, height: 3 } }]}>{clockText}</Text>\n      </View>', '      <View style={styles.clockStack}>\n        <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.52} style={[styles.clock3d, textStyle("clock"), { color: settings.clockShadowColor, transform: [{ translateY: settings.clockShadowDepth }, { translateX: 2 }] }]}>{clockText}</Text>\n        {[[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[1,-1],[-1,1],[1,1]].map(([x,y], index) => <Text key={`edge-${index}`} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.52} style={[styles.clockEdge, textStyle("clock"), { color: settings.clockEdgeColor, transform: [{ translateX: x * settings.clockEdgeWidth }, { translateY: y * settings.clockEdgeWidth }] }]}>{clockText}</Text>)}\n        <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.52} style={[styles.clockFace, textStyle("clock"), { textShadowColor: settings.clockShadowColor, textShadowRadius: settings.clockShadowRadius, textShadowOffset: { width: 0, height: 4 } }]}>{clockText}</Text>\n      </View>');
replaceWall('          {editorTab === "text" ? <><Text style={styles.editorSection}>Choose text element</Text>', '          {editorTab === "text" ? <><Text style={styles.editorSection}>Choose text element</Text>');
replaceWall('<Stepper value={settings.text[selectedTextTarget].fontSize} min={8} max={190} step={2} onChange={(fontSize) => updateText(selectedTextTarget, { fontSize })} />', '<Stepper value={settings.text[selectedTextTarget].fontSize} min={8} max={280} step={2} onChange={(fontSize) => updateText(selectedTextTarget, { fontSize })} />');
replaceWall('<Text style={styles.editorLabel}>Font</Text><View style={styles.fontGrid}>', '<Text style={styles.editorLabel}>Quick clock looks</Text>{selectedTextTarget === "clock" ? <View style={styles.fontGrid}><Pressable onPress={() => { updateText("clock", { color: "#FFFFFF", fontFamily: "sans-serif-black", fontSize: 218, fontWeight: "900" }); updateSettings({ clockEdgeColor: "#D8A42B", clockEdgeWidth: 3, clockShadowColor: "#5B3B08", clockShadowDepth: 10, clockShadowRadius: 10 }); }} style={styles.fontChip}><Text style={styles.fontChipText}>White + Gold 3D</Text></Pressable><Pressable onPress={() => { updateText("clock", { color: "#FFF9EB", fontFamily: "serif", fontSize: 212, fontWeight: "900" }); updateSettings({ clockEdgeColor: "#C89932", clockEdgeWidth: 2, clockShadowColor: "#3A2A12", clockShadowDepth: 8, clockShadowRadius: 8 }); }} style={styles.fontChip}><Text style={styles.fontChipText}>Classic Gold</Text></Pressable><Pressable onPress={() => { updateText("clock", { color: "#FFFFFF", fontFamily: "sans-serif-condensed", fontSize: 232, fontWeight: "900" }); updateSettings({ clockEdgeColor: "#9E6D13", clockEdgeWidth: 4, clockShadowColor: "#171717", clockShadowDepth: 12, clockShadowRadius: 12 }); }} style={styles.fontChip}><Text style={styles.fontChipText}>Bold Wall</Text></Pressable></View> : null}<Text style={styles.editorLabel}>Font</Text><View style={styles.fontGrid}>');
replaceWall('<Text style={styles.editorLabel}>Clock 3D depth</Text><Stepper value={settings.clockShadowDepth} min={0} max={16} step={1} onChange={(clockShadowDepth) => updateSettings({ clockShadowDepth })} />', '<ColorControl label="Clock gold/edge color" value={settings.clockEdgeColor} onChange={(clockEdgeColor) => updateSettings({ clockEdgeColor })} /><Text style={styles.editorLabel}>Clock edge thickness</Text><Stepper value={settings.clockEdgeWidth} min={0} max={8} step={1} onChange={(clockEdgeWidth) => updateSettings({ clockEdgeWidth })} /><ColorControl label="Clock shadow color" value={settings.clockShadowColor} onChange={(clockShadowColor) => updateSettings({ clockShadowColor })} /><Text style={styles.editorLabel}>Clock 3D depth</Text><Stepper value={settings.clockShadowDepth} min={0} max={20} step={1} onChange={(clockShadowDepth) => updateSettings({ clockShadowDepth })} /><Text style={styles.editorLabel}>Clock shadow softness</Text><Stepper value={settings.clockShadowRadius} min={0} max={20} step={1} onChange={(clockShadowRadius) => updateSettings({ clockShadowRadius })} />');
replaceWall('{editorTab === "behavior" ? <><ToggleRow label="Auto-slide prayers"', '{editorTab === "behavior" ? <><Text style={styles.editorSection}>Wall display behavior</Text><ToggleRow label="Auto-slide prayers"');
replaceWall('<Text style={styles.editorLabel}>Lock on next prayer (minutes)</Text><Stepper value={settings.lockMinutes} min={1} max={30} step={1} onChange={(lockMinutes) => updateSettings({ lockMinutes })} /></> : null}', '<Text style={styles.editorLabel}>Lock on next prayer (minutes)</Text><Stepper value={settings.lockMinutes} min={1} max={30} step={1} onChange={(lockMinutes) => updateSettings({ lockMinutes })} /><Text style={[styles.editorSection, { marginTop: 24 }]}>Sound & alert test</Text><Text style={styles.editorHint}>Run these while setting up a wall tablet. Hassoun will tell you if notification or exact-alarm permission needs to be enabled.</Text><View style={styles.soundTestGrid}><Pressable onPress={onTestNotification} style={styles.soundTestButton}><Text style={styles.soundTestTitle}>🔔 Test notification chime</Text><Text style={styles.soundTestSub}>Arrives in about 15 seconds</Text></Pressable><Pressable onPress={onTestAdhan} style={styles.soundTestButton}><Text style={styles.soundTestTitle}>🕌 Test Fajr Adhan</Text><Text style={styles.soundTestSub}>Starts in about 30 seconds</Text></Pressable>{!alertsEnabled ? <Pressable onPress={onEnableAlerts} style={[styles.soundTestButton, styles.enableAlertsButton]}><Text style={[styles.soundTestTitle, { color: "#FFF" }]}>Enable prayer alerts</Text><Text style={[styles.soundTestSub, { color: "#E8F2EE" }]}>Checks notification + alarm permissions</Text></Pressable> : <View style={styles.soundStatus}><Text style={styles.soundStatusText}>✓ Prayer alerts enabled</Text></View>}</View></> : null}');
replaceWall('clock3d: { position: "absolute", width: "100%", textAlign: "center", letterSpacing: -5 }, clockFace:', 'clock3d: { position: "absolute", width: "100%", textAlign: "center", letterSpacing: -5 }, clockEdge: { position: "absolute", width: "100%", textAlign: "center", letterSpacing: -5 }, clockFace:');
replaceWall('  toggleRow: { minHeight: 48,', '  soundTestGrid: { gap: 10, marginTop: 12 }, soundTestButton: { borderWidth: 1, borderColor: "#D4B45A", backgroundColor: "#FFF8E8", borderRadius: 16, paddingHorizontal: 14, paddingVertical: 13 }, soundTestTitle: { color: "#17483D", fontSize: 14, fontWeight: "900" }, soundTestSub: { color: "#6B756F", fontSize: 11, marginTop: 3 }, enableAlertsButton: { backgroundColor: "#07503F", borderColor: "#07503F" }, soundStatus: { borderRadius: 14, backgroundColor: "#E3F2EB", padding: 12, alignItems: "center" }, soundStatusText: { color: "#07503F", fontWeight: "900" },\n  toggleRow: { minHeight: 48,');

fs.writeFileSync(wallPath, wall);
console.log("Applied target wall display with advanced clock designer and sound diagnostics");
