import fs from 'node:fs';

const path = 'integrations/alexa/lambda/index.mjs';
let text = fs.readFileSync(path, 'utf8');

function replaceRequired(pattern, replacement, label) {
  const before = text;
  text = text.replace(pattern, replacement);
  if (text === before) throw new Error(`Dashboard design anchor missing (${label})`);
}

const prayerTileBlock = `const prayerTile = (key, label, arabic, icon) => ({
  type: "Frame",
  width: "18.4%",
  height: "106dp",
  borderRadius: "18dp",
  backgroundColor: \`\${hassounData.nextPrayer.prayer == '\${key}' ? '#12836F' : '#FFFDF8'}\`,
  item: {
    type: "Container",
    width: "100%",
    height: "100%",
    paddingLeft: "14dp",
    paddingRight: "14dp",
    paddingTop: "10dp",
    paddingBottom: "10dp",
    justifyContent: "center",
    items: [
      {
        type: "Container",
        direction: "row",
        justifyContent: "spaceBetween",
        alignItems: "center",
        items: [
          { type: "Text", text: label, fontSize: "18dp", fontWeight: 700, color: \`\${hassounData.nextPrayer.prayer == '\${key}' ? '#FFFFFF' : '#173F37'}\` },
          { type: "Text", text: icon, fontSize: "22dp", color: \`\${hassounData.nextPrayer.prayer == '\${key}' ? '#F4E7A7' : '#C99532'}\` }
        ]
      },
      { type: "Text", text: arabic, fontSize: "19dp", fontWeight: 700, color: \`\${hassounData.nextPrayer.prayer == '\${key}' ? '#FFFFFF' : '#173F37'}\`, paddingTop: "1dp" },
      { type: "Text", text: \`\${hassounData.prayers.\${key}.displayTime}\`, fontSize: "23dp", fontWeight: 700, color: \`\${hassounData.nextPrayer.prayer == '\${key}' ? '#FFFFFF' : '#173F37'}\`, paddingTop: "2dp" }
    ]
  }
});`;

replaceRequired(
  /const prayerTile = \(key, label\) => \(\{[\s\S]*?\n\}\);(?=\n\nconst HASSOUN_DASHBOARD)/,
  prayerTileBlock,
  'prayer tiles'
);

replaceRequired(/backgroundColor: "#F5F1E7",/, 'backgroundColor: "#F8F3E9",', 'background');
replaceRequired(/paddingLeft: "30dp",\n\s*paddingRight: "30dp",\n\s*paddingTop: "16dp",\n\s*paddingBottom: "16dp",/, 'paddingLeft: "30dp",\n          paddingRight: "30dp",\n          paddingTop: "18dp",\n          paddingBottom: "14dp",', 'screen padding');
replaceRequired(/\{ type: "Text", text: "HASSOUN", fontSize: "27dp", fontWeight: 700, color: "#0B5F4F" \}/, '{ type: "Text", text: "HASSOUN", fontSize: "30dp", fontWeight: 700, color: "#0B5F4F" }', 'brand size');
replaceRequired(/height: "356dp",\n\s*marginTop: "10dp",/, 'height: "350dp",\n              marginTop: "12dp",', 'main row height');
replaceRequired(/width: "66%",\n\s*height: "356dp",/, 'width: "62%",\n                  height: "350dp",', 'main card width');
replaceRequired(/width: "34%",\n\s*height: "356dp",\n\s*paddingLeft: "14dp",/, 'width: "38%",\n                  height: "350dp",\n                  paddingLeft: "20dp",', 'side column width');
replaceRequired(/borderRadius: "26dp",\n\s*backgroundColor: "#0B6B58",/, 'borderRadius: "28dp",\n                  backgroundColor: "#0B6B58",', 'main card radius');
replaceRequired(/\{ type: "Text", text: "\$\{hassounData\.nextPrayer\.name\}", fontSize: "60dp", fontWeight: 700, color: "#FFFFFF", paddingTop: "1dp" \},/, '{ type: "Text", text: "${hassounData.nextPrayer.name}", fontSize: "58dp", fontWeight: 700, color: "#FFFFFF", paddingTop: "1dp" },\n                      { type: "Text", text: "${hassounData.nextPrayer.arabicName}", fontSize: "38dp", fontWeight: 700, color: "#FFFFFF", paddingTop: "0dp" },', 'main bilingual prayer');
replaceRequired(/\s*\{ type: "Text", text: "\$\{hassounData\.nextPrayer\.timeUntil\}", fontSize: "22dp", fontWeight: 600, color: "#D8EFE8", paddingTop: "3dp" \},\n/, '\n', 'remove duplicate countdown');
replaceRequired(/height: "136dp",/, 'height: "148dp",', 'today card height');
replaceRequired(/height: "208dp",\n\s*marginTop: "12dp",/, 'height: "190dp",\n                      marginTop: "12dp",', 'event card height');
replaceRequired(/height: "84dp",\n\s*justifyContent: "spaceBetween",\n\s*marginTop: "10dp",/, 'height: "106dp",\n              justifyContent: "spaceBetween",\n              marginTop: "16dp",', 'prayer row');
replaceRequired(/prayerTile\("fajr", "FAJR"\),\n\s*prayerTile\("dhuhr", "DHUHR"\),\n\s*prayerTile\("asr", "ASR"\),\n\s*prayerTile\("maghrib", "MAGHRIB"\),\n\s*prayerTile\("isha", "ISHA"\)/, 'prayerTile("fajr", "Fajr", "الفجر", "☾"),\n                prayerTile("dhuhr", "Dhuhr", "الظهر", "☀"),\n                prayerTile("asr", "Asr", "العصر", "☀"),\n                prayerTile("maghrib", "Maghrib", "المغرب", "◒"),\n                prayerTile("isha", "Isha", "العشاء", "☾")', 'bilingual prayer labels');
replaceRequired(/\{ type: "Text", text: "Closer to what matters\.", width: "100%", textAlign: "center", fontSize: "12dp", fontStyle: "italic", color: "#6C837A", paddingTop: "8dp" \}/, '{ type: "Container", direction: "row", width: "100%", justifyContent: "spaceBetween", alignItems: "center", paddingTop: "8dp", items: [\n              { type: "Text", text: "Closer to what matters.", fontSize: "14dp", fontStyle: "italic", fontWeight: 600, color: "#315E55" },\n              { type: "Text", text: "FAITH   |   FAMILY   |   COMMUNITY", fontSize: "11dp", letterSpacing: 2, color: "#70847E" }\n            ] }', 'footer');
replaceRequired(/nextPrayer: \{\n\s*\.\.\.next,/, 'nextPrayer: {\n      ...next,\n      arabicName: ({ fajr: "الفجر", dhuhr: "الظهر", asr: "العصر", maghrib: "المغرب", isha: "العشاء" })[next.prayer] || "الصلاة",', 'next prayer Arabic name');

fs.writeFileSync(path, text);
console.log('Applied approved bilingual Echo Show dashboard design.');
