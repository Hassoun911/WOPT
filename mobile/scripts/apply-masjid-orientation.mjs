import fs from "node:fs";

const displayPath = new URL("../src/MasjidTvDisplay.tsx", import.meta.url);
let source = fs.readFileSync(displayPath, "utf8");
const replaceOnce = (from, to, label) => {
  if (!source.includes(from)) {
    if (source.includes(to)) return;
    throw new Error(`Missing expected source for ${label}`);
  }
  source = source.replace(from, to);
};

replaceOnce(
  'import { useKeepAwake } from "expo-keep-awake";\n',
  'import { useKeepAwake } from "expo-keep-awake";\nimport * as ScreenOrientation from "expo-screen-orientation";\n',
  "screen orientation import"
);

replaceOnce(
  '  theme: "emerald" | "midnight" | "ivory";\n',
  '  theme: "emerald" | "midnight" | "ivory";\n  displayOrientation: "auto" | "landscape" | "portrait";\n',
  "orientation setting type"
);

replaceOnce(
  '  theme: "emerald",\n',
  '  theme: "emerald",\n  displayOrientation: "auto",\n',
  "orientation default"
);

const readyMarker = '  useEffect(() => { if (ready) void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(settings)); }, [settings, ready]);\n';
replaceOnce(
  readyMarker,
  readyMarker + '  useEffect(() => {\n    if (!ready) return;\n    const applyOrientation = async () => {\n      try {\n        if (settings.displayOrientation === "portrait") {\n          await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);\n        } else if (settings.displayOrientation === "landscape") {\n          await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);\n        } else {\n          await ScreenOrientation.unlockAsync();\n        }\n      } catch {}\n    };\n    void applyOrientation();\n  }, [ready, settings.displayOrientation]);\n',
  "orientation runtime effect"
);

replaceOnce(
  '<Text style={styles.section}>Landscape TV layout</Text>',
  '<Text style={styles.section}>TV orientation</Text><View style={styles.presetRow}>{(["auto","landscape","portrait"] as const).map((orientation) => <Pressable key={orientation} onPress={() => update({ displayOrientation: orientation })} style={[styles.preset, settings.displayOrientation === orientation && styles.presetActive]}><Text style={styles.presetText}>{orientation}</Text></Pressable>)}</View><Text style={styles.note}>Auto follows the TV/Android display setting. Use Portrait for a standing TV and Landscape for a normal horizontal TV.</Text><Text style={styles.section}>Landscape TV layout</Text>',
  "local orientation controls"
);

fs.writeFileSync(displayPath, source);

const remotePath = new URL("../src/WallRemoteController.tsx", import.meta.url);
let remote = fs.readFileSync(remotePath, "utf8");
const remoteFrom = '<Text style={styles.section}>Landscape TV layout</Text><View style={styles.presetRow}>{["grand","community","minimal"].map((layout) =>';
const remoteTo = '<Text style={styles.section}>TV orientation</Text><View style={styles.presetRow}>{["auto","landscape","portrait"].map((displayOrientation) => <Pressable key={displayOrientation} onPress={() => patch({ displayOrientation })} style={[styles.preset, draft.displayOrientation === displayOrientation && styles.presetActive]}><Text style={styles.presetText}>{displayOrientation}</Text></Pressable>)}</View><Text style={styles.note}>Auto follows the TV. Portrait is for standing displays; Landscape is for normal horizontal TVs.</Text><Text style={styles.section}>Landscape TV layout</Text><View style={styles.presetRow}>{["grand","community","minimal"].map((layout) =>';
if (!remote.includes(remoteFrom)) {
  if (!remote.includes('TV orientation')) throw new Error('Missing Masjid remote landscape layout marker');
} else {
  remote = remote.replace(remoteFrom, remoteTo);
}
fs.writeFileSync(remotePath, remote);
console.log("Added Masjid Auto/Landscape/Portrait orientation controls");