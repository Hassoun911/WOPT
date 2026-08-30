import fs from "node:fs";

const path = new URL("../src/MasjidTvDisplay.tsx", import.meta.url);
let source = fs.readFileSync(path, "utf8");

function replaceOnce(from, to, label) {
  if (source.includes(to)) return;
  if (!source.includes(from)) throw new Error(`Missing source for ${label}`);
  source = source.replace(from, to);
}

replaceOnce(
  'import { useKeepAwake } from "expo-keep-awake";\n',
  'import { useKeepAwake } from "expo-keep-awake";\nimport * as ScreenOrientation from "expo-screen-orientation";\n',
  "screen orientation import"
);
replaceOnce(
  'import { formatPrayerTime } from "./time";\n',
  'import { formatPrayerTime } from "./time";\nimport MasjidVideoBackground from "./MasjidVideoBackground";\n',
  "video background import"
);
replaceOnce(
  'type PortraitLayout = "minaret" | "lobby" | "minimal";\n',
  'type PortraitLayout = "minaret" | "lobby" | "minimal";\ntype OrientationMode = "auto" | "landscape" | "portrait";\ntype BackgroundMode = "theme" | "kaabaVideo";\n',
  "TV settings types"
);
replaceOnce(
  '  portraitLayout: PortraitLayout;\n  theme: "emerald" | "midnight" | "ivory";\n',
  '  portraitLayout: PortraitLayout;\n  orientationMode: OrientationMode;\n  mosqueLocationLabel: string;\n  mosqueLatitude: string;\n  mosqueLongitude: string;\n  mosqueTimezone: string;\n  backgroundMode: BackgroundMode;\n  backgroundVideoUrl: string;\n  backgroundDim: number;\n  theme: "emerald" | "midnight" | "ivory";\n',
  "Masjid settings fields"
);
replaceOnce(
  '  portraitLayout: "minaret",\n  theme: "emerald",\n',
  '  portraitLayout: "minaret",\n  orientationMode: "auto",\n  mosqueLocationLabel: "",\n  mosqueLatitude: "",\n  mosqueLongitude: "",\n  mosqueTimezone: "America/Toronto",\n  backgroundMode: "theme",\n  backgroundVideoUrl: "",\n  backgroundDim: 0.45,\n  theme: "emerald",\n',
  "Masjid defaults"
);
replaceOnce(
  '  const { width, height } = useWindowDimensions();\n  const landscape = width >= height;\n  const [settings, setSettings] = useState<MasjidSettings>(DEFAULTS);\n',
  '  const { width, height } = useWindowDimensions();\n  const [settings, setSettings] = useState<MasjidSettings>(DEFAULTS);\n  const physicalLandscape = width >= height;\n  const landscape = settings.orientationMode === "landscape" ? true : settings.orientationMode === "portrait" ? false : physicalLandscape;\n  const displayLocationLabel = settings.mosqueLocationLabel.trim() || "Mosque location not set";\n',
  "orientation and mosque location routing"
);
replaceOnce(
  '  const [importText, setImportText] = useState("");\n\n  useEffect(() => {\n    void AsyncStorage.getItem(STORAGE_KEY)',
  '  const [importText, setImportText] = useState("");\n\n  useEffect(() => {\n    const applyOrientation = async () => {\n      try {\n        if (settings.orientationMode === "landscape") await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);\n        else if (settings.orientationMode === "portrait") await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT);\n        else await ScreenOrientation.unlockAsync();\n      } catch {\n        // Some TV firmware ignores rotation requests; layout routing still follows the admin override.\n      }\n    };\n    void applyOrientation();\n  }, [settings.orientationMode]);\n\n  useEffect(() => {\n    void AsyncStorage.getItem(STORAGE_KEY)',
  "orientation effect"
);
source = source.replace(/props\.locationLabel/g, 'displayLocationLabel');
// Masjid TV must never fall back to the phone/device GPS label.
source = source.replace('settings.mosqueLocationLabel.trim() || displayLocationLabel || "Mosque location"', 'settings.mosqueLocationLabel.trim() || "Mosque location not set"');

replaceOnce(
  '<Text style={styles.adminLabel}>Footer / subtitle</Text><TextInput value={settings.mosqueSubtitle} onChangeText={(mosqueSubtitle) => update({ mosqueSubtitle })} style={styles.input} />\n              <Text style={styles.adminSection}>Landscape layouts</Text>',
  '<Text style={styles.adminLabel}>Footer / subtitle</Text><TextInput value={settings.mosqueSubtitle} onChangeText={(mosqueSubtitle) => update({ mosqueSubtitle })} style={styles.input} />\n              <Text style={styles.adminSection}>TV orientation</Text><View style={styles.choiceRow}>{(["auto", "landscape", "portrait"] as OrientationMode[]).map((item) => <Pressable key={item} onPress={() => update({ orientationMode: item })} style={[styles.choice, settings.orientationMode === item && styles.choiceActive]}><Text style={styles.choiceText}>{item}</Text></Pressable>)}</View>\n              <Text style={styles.adminSection}>Mosque location (saved; TV GPS not required)</Text>\n              <Text style={styles.adminLabel}>City / location label</Text><TextInput value={settings.mosqueLocationLabel} onChangeText={(mosqueLocationLabel) => update({ mosqueLocationLabel })} placeholder="Windsor, Ontario" style={styles.input} />\n              <Text style={styles.adminLabel}>Latitude</Text><TextInput value={settings.mosqueLatitude} onChangeText={(mosqueLatitude) => update({ mosqueLatitude })} placeholder="42.3149" style={styles.input} />\n              <Text style={styles.adminLabel}>Longitude</Text><TextInput value={settings.mosqueLongitude} onChangeText={(mosqueLongitude) => update({ mosqueLongitude })} placeholder="-83.0364" style={styles.input} />\n              <Text style={styles.adminLabel}>Timezone</Text><TextInput value={settings.mosqueTimezone} onChangeText={(mosqueTimezone) => update({ mosqueTimezone })} placeholder="America/Toronto" style={styles.input} />\n              <Text style={styles.adminSection}>Background</Text><View style={styles.choiceRow}>{(["theme", "kaabaVideo"] as BackgroundMode[]).map((item) => <Pressable key={item} onPress={() => update({ backgroundMode: item })} style={[styles.choice, settings.backgroundMode === item && styles.choiceActive]}><Text style={styles.choiceText}>{item === "kaabaVideo" ? "Kaaba video" : "Theme"}</Text></Pressable>)}</View>\n              {settings.backgroundMode === "kaabaVideo" ? <><Text style={styles.adminLabel}>Approved MP4 / HLS video URL</Text><TextInput value={settings.backgroundVideoUrl} onChangeText={(backgroundVideoUrl) => update({ backgroundVideoUrl })} placeholder="https://.../kaaba.mp4" autoCapitalize="none" style={styles.input} /><Text style={styles.adminLabel}>Video darkness (0.15–0.80)</Text><TextInput value={String(settings.backgroundDim)} onChangeText={(value) => update({ backgroundDim: Math.max(0.15, Math.min(0.8, Number(value) || 0.45)) })} keyboardType="decimal-pad" style={styles.input} /></> : null}\n              <Text style={styles.adminSection}>Landscape layouts</Text>',
  "admin orientation location background controls"
);
replaceOnce(
  '    <View style={[styles.screen, themeStyle]}>\n      <Pressable onLongPress={() => setAdminOpen(true)}',
  '    <View style={[styles.screen, themeStyle]}>\n      {settings.backgroundMode === "kaabaVideo" && settings.backgroundVideoUrl.trim() ? <MasjidVideoBackground uri={settings.backgroundVideoUrl.trim()} dim={settings.backgroundDim} /> : null}\n      <Pressable onLongPress={() => setAdminOpen(true)}',
  "background renderer"
);
replaceOnce(
  '            if (command === "layout_minimal") setSettings((current) => ({ ...current, landscapeLayout: "minimal", portraitLayout: "minimal" }));\n',
  '            if (command === "layout_minimal") setSettings((current) => ({ ...current, landscapeLayout: "minimal", portraitLayout: "minimal" }));\n            if (command === "orientation_auto") setSettings((current) => ({ ...current, orientationMode: "auto" }));\n            if (command === "orientation_landscape") setSettings((current) => ({ ...current, orientationMode: "landscape" }));\n            if (command === "orientation_portrait") setSettings((current) => ({ ...current, orientationMode: "portrait" }));\n',
  "remote orientation commands"
);

fs.writeFileSync(path, source);
console.log("Applied Masjid TV full-screen orientation, saved location, and Kaaba video background fixes");
