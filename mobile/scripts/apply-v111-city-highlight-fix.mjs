import fs from 'node:fs';

function replaceOnce(text, from, to, label) {
  if (!text.includes(from)) throw new Error(`Missing expected source for ${label}`);
  return text.replace(from, to);
}

const prayerDataPath = 'src/prayerData.ts';
let prayerData = fs.readFileSync(prayerDataPath, 'utf8');

prayerData = replaceOnce(
  prayerData,
`  if (cached) {
    return {
      prayerTimes: cached.prayerTimes,
      live: false,
      location: { ...cached.location, source: "saved" }
    };
  }`,
`  if (cached) {
    const cachedLabel = cached.location.label === "Current location" && cached.location.source === "windsor_islamic_association"
      ? "Windsor, Ontario"
      : cached.location.label;
    return {
      prayerTimes: cached.prayerTimes,
      live: false,
      location: { ...cached.location, label: cachedLabel, source: "saved" }
    };
  }`,
  'cached Windsor label normalization'
);

prayerData = replaceOnce(
  prayerData,
  '      label: CITY_LABEL,',
  '      label: "Windsor, Ontario",',
  'bundled Windsor fallback label'
);

prayerData = replaceOnce(
  prayerData,
  '      label: current.source === "windsor_islamic_association" ? CITY_LABEL : label,',
  '      label: current.source === "windsor_islamic_association" && label === "Current location" ? "Windsor, Ontario" : label,',
  'live Windsor city label'
);

fs.writeFileSync(prayerDataPath, prayerData);

const panelPath = 'src/HomePrayerPanel.tsx';
let panel = fs.readFileSync(panelPath, 'utf8');
panel = replaceOnce(
  panel,
  '  nextCard: { marginTop: 14, minHeight: 148, borderRadius: 28, backgroundColor: cream, borderWidth: 1, borderColor: "#dfc987", overflow: "hidden", flexDirection: "row", alignItems: "stretch", shadowColor: "#143f35", shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: 5 }, elevation: 3 },',
  '  nextCard: { marginTop: 14, minHeight: 148, borderRadius: 28, backgroundColor: "#edf5f0", borderWidth: 3, borderColor: gold, overflow: "hidden", flexDirection: "row", alignItems: "stretch", shadowColor: "#0b5b47", shadowOpacity: 0.20, shadowRadius: 16, shadowOffset: { width: 0, height: 7 }, elevation: 7 },',
  'next prayer card highlight'
);
panel = replaceOnce(
  panel,
  '  nextAccent: { width: 72, backgroundColor: green },',
  '  nextAccent: { width: 82, backgroundColor: green },',
  'next prayer accent emphasis'
);
fs.writeFileSync(panelPath, panel);

const configPath = 'app.config.ts';
let config = fs.readFileSync(configPath, 'utf8');
config = replaceOnce(config, 'version: "1.0.10"', 'version: "1.0.11"', 'version');
config = replaceOnce(config, 'versionCode: 51', 'versionCode: 52', 'versionCode');
fs.writeFileSync(configPath, config);

console.log('Applied Hassoun v1.0.11 city label and next-prayer highlight fix');
