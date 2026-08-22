import fs from 'node:fs';

const path = 'src/quran/QuranV3.tsx';
let src = fs.readFileSync(path, 'utf8');

const oldEntry = 'onPress={() => memorizeRange ? setScreen("memorize") : openReader(lastPosition?.surah ?? 1, lastPosition?.ayah ?? 1, "home")}';
const newEntry = 'onPress={() => setScreen("memorize")}';

if (src.includes(oldEntry)) {
  src = src.replace(oldEntry, newEntry);
} else if (!src.includes(newEntry)) {
  throw new Error('Could not find the Memorize tile navigation anchor.');
}

fs.writeFileSync(path, src);
console.log('Memorize tile now opens Al-Hafiz Classroom directly.');
