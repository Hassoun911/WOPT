import fs from "node:fs";
const path = new URL("../src/MasjidTvDisplay.tsx", import.meta.url);
let source = fs.readFileSync(path, "utf8");
const from = '<View style={styles.grandSide}><JumuahPanel /><AnnouncementPanel /></View></View><PrayerCards />;';
const to = '<View style={styles.grandSide}><JumuahPanel /><AnnouncementPanel /></View></View><PrayerCards /></>;';
if (source.includes(from)) source = source.replace(from, to);
else if (!source.includes(to)) throw new Error("Grand Masjid layout fragment target not found");
fs.writeFileSync(path, source);
console.log("Fixed Masjid grand layout JSX fragment");
