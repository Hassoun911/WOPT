import fs from "node:fs";

const path = "mobile/src/quran/QuranV3.tsx";
let src = fs.readFileSync(path, "utf8");

const importNeedle = `import QuranAudio, { type QuranAudioStatus } from "../../modules/quran-audio";`;
if (!src.includes(`import SmartMemorize from "./SmartMemorize";`)) {
  if (!src.includes(importNeedle)) throw new Error("QuranV3 import anchor missing");
  src = src.replace(importNeedle, `${importNeedle}\nimport SmartMemorize from "./SmartMemorize";`);
}

const bodyNeedle = `  else if (screen === "memorize") body = memorize;`;
const bodyReplacement = `  else if (screen === "memorize") body = <SmartMemorize locale={locale} initialRange={memorizeRange} onBack={() => setScreen(memorizeRange ? "reader" : "home")} />;`;
if (src.includes(bodyNeedle)) src = src.replace(bodyNeedle, bodyReplacement);
else if (!src.includes(bodyReplacement)) throw new Error("QuranV3 memorize body anchor missing");

fs.writeFileSync(path, src);
console.log("Smart Memorize wired into QuranV3");
