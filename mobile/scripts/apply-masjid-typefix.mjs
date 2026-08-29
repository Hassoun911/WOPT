import fs from "node:fs";

const displayPath = new URL("../src/MasjidTvDisplay.tsx", import.meta.url);
let display = fs.readFileSync(displayPath, "utf8");
if (!display.includes("const prettyTime =")) {
  display = display.replaceAll("formatPrayerTime(", "prettyTime(");
  const anchor = '  const themeStyle = settings.theme === "midnight" ? styles.midnight : settings.theme === "ivory" ? styles.ivory : styles.emerald;\n';
  if (!display.includes(anchor)) throw new Error("Masjid pretty-time anchor missing");
  display = display.replace(anchor, anchor + '  const prettyTime = (value: string) => { if (!value || value === "—") return value; if (/\\b[ap]\\.?m\\.?/i.test(value)) return value; return formatPrayerTime(value, props.locale); };\n');
}
fs.writeFileSync(displayPath, display);

const remotePath = new URL("../src/WallRemoteController.tsx", import.meta.url);
let remote = fs.readFileSync(remotePath, "utf8");
const oldTabs = '(["status", ...(draft.mode === "masjid" ? ["masjid"] : []), "look", "text", "behavior", "smart"] as const).map((item) =>';
const newTabs = '(["status", ...(draft.mode === "masjid" ? ["masjid"] : []), "look", "text", "behavior", "smart"] as Array<"status" | "masjid" | "look" | "text" | "behavior" | "smart">).map((item) =>';
if (remote.includes(oldTabs)) remote = remote.replace(oldTabs, newTabs);
else if (!remote.includes(newTabs)) throw new Error("Masjid remote tab expression missing");
fs.writeFileSync(remotePath, remote);

console.log("Applied Masjid prayer-time locale and remote tab type fixes");
