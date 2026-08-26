import fs from 'node:fs';

function replaceOnce(text, from, to, label) {
  if (!text.includes(from)) throw new Error(`Missing expected source for ${label}`);
  return text.replace(from, to);
}

const panelPath = 'src/HomePrayerPanel.tsx';
let panel = fs.readFileSync(panelPath, 'utf8');

panel = replaceOnce(
  panel,
  '<Text style={[styles.nextArabic, urgent && styles.urgentTitle]}>{NAMES[next.prayer].ar}</Text>',
  '<Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.78} style={[styles.nextArabic, urgent && styles.urgentTitle]}>{NAMES[next.prayer].ar}</Text>',
  'next prayer Arabic single line'
);
panel = replaceOnce(
  panel,
  '<Text style={[styles.nextEnglish, urgent && styles.urgentText]}>{NAMES[next.prayer].en}</Text>',
  '<Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.82} style={[styles.nextEnglish, urgent && styles.urgentText]}>{NAMES[next.prayer].en}</Text>',
  'next prayer English single line'
);
panel = replaceOnce(
  panel,
  '<Text style={[styles.nextTime, urgent && styles.urgentTitle]}>{formatPrayerTime(next.time, locale)}</Text>',
  '<Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.82} style={[styles.nextTime, urgent && styles.urgentTitle]}>{formatPrayerTime(next.time, locale)}</Text>',
  'next prayer time single line'
);

panel = replaceOnce(
  panel,
  '  nextAccent: { width: 82, backgroundColor: green },',
  '  nextAccent: { width: 24, backgroundColor: green },',
  'narrow next prayer accent'
);
panel = replaceOnce(
  panel,
  '  nextCopy: { flex: 1, paddingVertical: 17, paddingLeft: 16, justifyContent: "center" },',
  '  nextCopy: { flex: 1, minWidth: 132, paddingVertical: 17, paddingLeft: 16, paddingRight: 8, justifyContent: "center" },',
  'next prayer copy sizing'
);
panel = replaceOnce(
  panel,
  '  nextNameRow: { flexDirection: "row", alignItems: "baseline", gap: 7, marginTop: 5, flexWrap: "wrap" },',
  '  nextNameRow: { flexDirection: "column", alignItems: "flex-start", gap: 2, marginTop: 5 },',
  'next prayer name stack'
);
panel = replaceOnce(
  panel,
  '  countdownCard: { width: 185, margin: 11, borderRadius: 22, backgroundColor: "#fffaf0", borderWidth: 1, borderColor: "#dfc987", paddingHorizontal: 11, justifyContent: "center" },',
  '  countdownCard: { width: 174, marginVertical: 11, marginRight: 11, marginLeft: 5, borderRadius: 22, backgroundColor: "#fffaf0", borderWidth: 1, borderColor: "#dfc987", paddingHorizontal: 9, justifyContent: "center" },',
  'countdown card sizing'
);

fs.writeFileSync(panelPath, panel);

const configPath = 'app.config.ts';
let config = fs.readFileSync(configPath, 'utf8');
config = replaceOnce(config, 'versionCode: 53', 'versionCode: 54', 'Android versionCode');
fs.writeFileSync(configPath, config);

console.log('Applied v1.0.12 next-prayer responsive layout fix and versionCode 54');
