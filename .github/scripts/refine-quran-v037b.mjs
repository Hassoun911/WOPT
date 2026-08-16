import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const sourceScript = ".github/scripts/refine-quran-v037.mjs";
let source = fs.readFileSync(sourceScript, "utf8");
source = source.replace(/\n  \[\n    "audio control styles",[\s\S]*?\n  \],(?=\n  \[\n    "surah frame styles")/, "");
const temp = path.join(os.tmpdir(), `refine-quran-v037-${Date.now()}.mjs`);
fs.writeFileSync(temp, source);
await import(pathToFileURL(temp).href);

const quranPath = "mobile/src/quran/QuranV3.tsx";
let quran = fs.readFileSync(quranPath, "utf8");
const oldAction = `radioAction: { flex: 1, minHeight: 66, borderRadius: 16, backgroundColor: "#edf5f1", alignItems: "center", justifyContent: "center", padding: 6 }`;
if (!quran.includes(oldAction)) throw new Error("Missing radioAction style");
quran = quran.replace(oldAction, `radioAction: { flex: 1, minHeight: 76, borderRadius: 20, backgroundColor: "#f7f8f5", borderWidth: 1, borderColor: "#dfe8e3", alignItems: "center", justifyContent: "center", padding: 7 }`);
const oldIcon = `radioActionIcon: { fontSize: 18 },`;
if (!quran.includes(oldIcon)) throw new Error("Missing radioActionIcon style");
quran = quran.replace(oldIcon, `audioIconCircle: { width: 35, height: 35, borderRadius: 18, backgroundColor: "#0b654f", alignItems: "center", justifyContent: "center" }, audioIconGlyph: { color: "#fff", fontSize: 17, fontWeight: "900" }, radioActionIcon: { fontSize: 18 },`);
const oldActionText = `radioActionText: { color: "#31564b", fontSize: 8, fontWeight: "900", textAlign: "center", marginTop: 3 }`;
if (!quran.includes(oldActionText)) throw new Error("Missing radioActionText style");
quran = quran.replace(oldActionText, `radioActionText: { color: "#234a3f", fontSize: 8, fontWeight: "900", textAlign: "center", marginTop: 6 }`);
quran = quran.replace(`radioActionRow: { flexDirection: "row", gap: 7, marginTop: 11 }`, `radioActionRow: { flexDirection: "row", gap: 9, marginTop: 12 }`);
fs.writeFileSync(quranPath, quran);
console.log("Applied hardened Quran v0.3.7 visual refinements.");