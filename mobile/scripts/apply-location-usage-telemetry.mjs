import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const file = path.join(root, "src", "prayerData.ts");
let text = fs.readFileSync(file, "utf8");

const importLine = 'import { recordPrayerLocationUsage } from "./locationUsage";\n';
if (!text.includes(importLine.trim())) {
  const anchor = 'import type { PrayerDay, PrayerFile, PrayerTimes } from "./types";\n';
  if (!text.includes(anchor)) throw new Error("Could not find prayerData import anchor");
  text = text.replace(anchor, `${anchor}${importLine}`);
}

const windsorAnchor = '      await saveContext(context);\n      return context;';
const windsorReplacement = '      await saveContext(context);\n      void recordPrayerLocationUsage(context.location, "mobile");\n      return context;';
if (!text.includes('void recordPrayerLocationUsage(context.location, "mobile");')) {
  if (!text.includes(windsorAnchor)) throw new Error("Could not find Windsor telemetry anchor");
  text = text.replace(windsorAnchor, windsorReplacement);
}

const localAnchor = '    await saveContext(context);\n    void refreshRemoteInBackground(context, preferences);';
const localReplacement = '    await saveContext(context);\n    void recordPrayerLocationUsage(context.location, "mobile");\n    void refreshRemoteInBackground(context, preferences);';
const callCount = (text.match(/recordPrayerLocationUsage\(context\.location, "mobile"\)/g) || []).length;
if (callCount < 2) {
  if (!text.includes(localAnchor)) throw new Error("Could not find local telemetry anchor");
  text = text.replace(localAnchor, localReplacement);
}

fs.writeFileSync(file, text);
console.log("Location usage telemetry applied to prayerData.ts");
