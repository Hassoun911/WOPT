import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import vm from "node:vm";

const SOURCE_COMMIT = "a5284b17034d36567e4a4bac982a17ba56837448";
const BASE = `https://raw.githubusercontent.com/TarteelAI/quran-assets/${SOURCE_COMMIT}`;
const OUT = resolve(process.cwd(), "src/quran/generated/quran-data.json");

const URLS = {
  uthmani: `${BASE}/text/quran-uthmani.txt`,
  simple: `${BASE}/text/quran-simple-clean.txt`,
  metadata: `${BASE}/metadata/quran-data.js`
};

async function download(url) {
  const response = await fetch(url, { headers: { "user-agent": "WOPT-Quran-Builder/1.0" } });
  if (!response.ok) throw new Error(`Quran data download failed (${response.status}) for ${url}`);
  return response.text();
}

function parseTanzilText(source) {
  return source
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => /^\d+\|\d+\|/.test(line))
    .map((line) => {
      const first = line.indexOf("|");
      const second = line.indexOf("|", first + 1);
      return {
        surah: Number(line.slice(0, first)),
        ayah: Number(line.slice(first + 1, second)),
        text: line.slice(second + 1)
      };
    });
}

function parseMetadata(source) {
  const context = {};
  const safeSource = source.replace(/let\s+QuranData\s*=\s*\{\s*\}\s*;/, "QuranData = {};");
  vm.runInNewContext(safeSource, context, { timeout: 1000, filename: "quran-data.js" });
  const data = context.QuranData;
  if (!data?.Sura || !data?.Page || !data?.Juz) throw new Error("Tanzil metadata is incomplete");

  const surahs = data.Sura.slice(1).map((item, index) => ({
    number: index + 1,
    startIndex: item[0],
    ayahCount: item[1],
    revelationOrder: item[2],
    rukus: item[3],
    nameArabic: item[4],
    nameTransliterated: item[5],
    nameEnglish: item[6],
    revelationType: item[7]
  }));

  const pages = data.Page.slice(1).map((item, index) => ({
    page: index + 1,
    surah: item[0],
    ayah: item[1]
  }));

  const juz = data.Juz.slice(1).map((item, index) => ({
    juz: index + 1,
    surah: item[0],
    ayah: item[1]
  }));

  return { surahs, pages, juz };
}

function assertQuran(uthmani, simple, metadata) {
  if (uthmani.length !== 6236) throw new Error(`Expected 6236 Uthmani ayahs, received ${uthmani.length}`);
  if (simple.length !== 6236) throw new Error(`Expected 6236 simple-search ayahs, received ${simple.length}`);
  if (metadata.surahs.length !== 114) throw new Error(`Expected 114 surahs, received ${metadata.surahs.length}`);
  if (metadata.pages.length !== 604) throw new Error(`Expected 604 Medina pages, received ${metadata.pages.length}`);
  if (metadata.juz.length !== 30) throw new Error(`Expected 30 juz, received ${metadata.juz.length}`);

  for (let i = 0; i < 6236; i += 1) {
    if (uthmani[i].surah !== simple[i].surah || uthmani[i].ayah !== simple[i].ayah) {
      throw new Error(`Quran source mismatch at absolute ayah ${i + 1}`);
    }
  }

  for (const surah of metadata.surahs) {
    const count = uthmani.filter((ayah) => ayah.surah === surah.number).length;
    if (count !== surah.ayahCount) {
      throw new Error(`Surah ${surah.number} expected ${surah.ayahCount} ayahs but source has ${count}`);
    }
  }
}

const [uthmaniSource, simpleSource, metadataSource] = await Promise.all([
  download(URLS.uthmani),
  download(URLS.simple),
  download(URLS.metadata)
]);

const uthmani = parseTanzilText(uthmaniSource);
const simple = parseTanzilText(simpleSource);
const metadata = parseMetadata(metadataSource);
assertQuran(uthmani, simple, metadata);

const simpleByKey = new Map(simple.map((ayah) => [`${ayah.surah}:${ayah.ayah}`, ayah.text]));
const payload = {
  source: {
    name: "Tanzil Quran Text",
    script: "Uthmani",
    version: "1.1",
    license: "CC BY 3.0",
    upstream: "https://tanzil.net",
    mirror: "TarteelAI/quran-assets",
    mirrorCommit: SOURCE_COMMIT,
    generatedAt: new Date().toISOString(),
    verifiedCounts: { surahs: 114, ayahs: 6236, pages: 604, juz: 30 }
  },
  surahs: metadata.surahs,
  pages: metadata.pages,
  juz: metadata.juz,
  ayahs: uthmani.map((ayah) => ({
    surah: ayah.surah,
    ayah: ayah.ayah,
    text: ayah.text,
    searchText: simpleByKey.get(`${ayah.surah}:${ayah.ayah}`) || ""
  }))
};

await mkdir(dirname(OUT), { recursive: true });
await writeFile(OUT, `${JSON.stringify(payload)}\n`, "utf8");
console.log(`WOPT Quran data ready: ${payload.ayahs.length} ayahs, ${payload.surahs.length} surahs, ${payload.pages.length} pages.`);
