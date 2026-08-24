import fs from 'node:fs';

const path = 'src/quran/AlHafizClassroom.tsx';
let s = fs.readFileSync(path, 'utf8');

const oldTokenize = `function tokenizeAyah(ayah: QuranAyah): LessonWord[] {\n  return ayah.text\n    .split(/\\s+/)\n    .map((text) => text.trim())\n    .filter(Boolean)\n    .filter((text) => /[\\u0621-\\u064Aٱ]/.test(text))\n    .map((text, index) => ({ text, normalized: normalizeArabic(text), surah: ayah.surah, ayah: ayah.ayah, wordIndex: index + 1 }))\n    .filter((word) => word.normalized.length > 0);\n}\n`;

const newTokenize = `function tokenizeAyah(ayah: QuranAyah): LessonWord[] {\n  const rawWords = ayah.text\n    .split(/\\s+/)\n    .map((text) => text.trim())\n    .filter(Boolean)\n    .filter((text) => /[\\u0621-\\u064Aٱ]/.test(text));\n  const normalized = rawWords.map(normalizeArabic);\n  const hasBismillahPrefix = normalized.length >= 4 &&\n    normalized[0] === \"بسم\" && normalized[1] === \"الله\" &&\n    normalized[2] === \"الرحمن\" && normalized[3] === \"الرحيم\";\n  const offset = hasBismillahPrefix ? 4 : 0;\n  return rawWords\n    .slice(offset)\n    .map((text, index) => ({ text, normalized: normalizeArabic(text), surah: ayah.surah, ayah: ayah.ayah, wordIndex: index + 1 + offset }))\n    .filter((word) => word.normalized.length > 0);\n}\n`;

if (!s.includes('hasBismillahPrefix')) {
  if (!s.includes(oldTokenize)) throw new Error('tokenizeAyah anchor not found');
  s = s.replace(oldTokenize, newTokenize);
}

if (!s.includes('\\u2066﴿')) {
  const ayahNumberRegex = /<Text style=\{\[styles\.ayahNumber, \{ fontSize: Math\.max\(16, activeCardView\.fontSize - 8\) \}\]\}>﴿\{ayah\.ayah\}﴾<\/Text>/;
  if (!ayahNumberRegex.test(s)) throw new Error('interactive ayah number anchor not found');
  s = s.replace(
    ayahNumberRegex,
    `<Text style={[styles.ayahNumber, { fontSize: Math.max(16, activeCardView.fontSize - 8), writingDirection: \"ltr\", textAlign: \"left\" }]}>{\"\\u2066﴿\" + String(ayah.ayah) + \"﴾\\u2069\"}</Text>`
  );
}

fs.writeFileSync(path, s);
console.log('Applied resilient Bismillah removal and ayah-number direction fix');
