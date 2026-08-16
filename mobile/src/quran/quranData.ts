import bundleJson from "./generated/quran-data.json";

export type QuranLocale = "en" | "ar";

export type QuranAyah = {
  surah: number;
  ayah: number;
  text: string;
  searchText: string;
};

export type QuranSurah = {
  number: number;
  startIndex: number;
  ayahCount: number;
  revelationOrder: number;
  rukus: number;
  nameArabic: string;
  nameTransliterated: string;
  nameEnglish: string;
  revelationType: "Meccan" | "Medinan" | string;
};

export type QuranPage = { page: number; surah: number; ayah: number };
export type QuranJuz = { juz: number; surah: number; ayah: number };

export type QuranBundle = {
  source: {
    name: string;
    script: string;
    version: string;
    license: string;
    upstream: string;
    mirror: string;
    mirrorCommit: string;
    generatedAt: string | null;
    verifiedCounts: { surahs: number; ayahs: number; pages: number; juz: number };
  };
  surahs: QuranSurah[];
  pages: QuranPage[];
  juz: QuranJuz[];
  ayahs: QuranAyah[];
};

const bundle = bundleJson as QuranBundle;

const ayahsBySurah = new Map<number, QuranAyah[]>();
for (const ayah of bundle.ayahs) {
  const group = ayahsBySurah.get(ayah.surah) ?? [];
  group.push(ayah);
  ayahsBySurah.set(ayah.surah, group);
}

const surahByNumber = new Map(bundle.surahs.map((surah) => [surah.number, surah]));

export function quranReady() {
  return bundle.surahs.length === 114 && bundle.ayahs.length === 6236;
}

export function quranSource() {
  return bundle.source;
}

export function allSurahs() {
  return bundle.surahs;
}

export function allPages() {
  return bundle.pages;
}

export function allJuz() {
  return bundle.juz;
}

export function getSurah(number: number) {
  return surahByNumber.get(number);
}

export function getSurahAyahs(number: number) {
  return ayahsBySurah.get(number) ?? [];
}

export function getAyah(surah: number, ayah: number) {
  const info = surahByNumber.get(surah);
  if (!info) return undefined;
  return bundle.ayahs[info.startIndex + ayah - 1];
}

export function absoluteIndex(surah: number, ayah: number) {
  const info = surahByNumber.get(surah);
  if (!info) return -1;
  return info.startIndex + Math.max(0, ayah - 1);
}

function startAtOrBefore<T extends { surah: number; ayah: number }>(items: T[], surah: number, ayah: number) {
  const target = absoluteIndex(surah, ayah);
  if (target < 0 || !items.length) return undefined;
  let low = 0;
  let high = items.length - 1;
  let answer = items[0];
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const item = items[mid];
    if (!item) break;
    const itemIndex = absoluteIndex(item.surah, item.ayah);
    if (itemIndex <= target) {
      answer = item;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  return answer;
}

export function pageForAyah(surah: number, ayah: number) {
  return startAtOrBefore(bundle.pages, surah, ayah)?.page;
}

export function juzForAyah(surah: number, ayah: number) {
  return startAtOrBefore(bundle.juz, surah, ayah)?.juz;
}

export type QuranSearchResult = {
  surah: QuranSurah;
  ayah?: QuranAyah;
  kind: "ayah" | "surah";
};

function normalizeArabic(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, "")
    .replace(/[ٱأإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/ـ/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function searchQuran(query: string, limit = 60): QuranSearchResult[] {
  const clean = query.trim();
  if (!clean) return [];
  const lower = clean.toLocaleLowerCase("en");
  const arabic = normalizeArabic(clean);
  const results: QuranSearchResult[] = [];

  for (const surah of bundle.surahs) {
    if (
      surah.nameArabic.includes(clean) ||
      normalizeArabic(surah.nameArabic).includes(arabic) ||
      surah.nameTransliterated.toLocaleLowerCase("en").includes(lower) ||
      surah.nameEnglish.toLocaleLowerCase("en").includes(lower) ||
      String(surah.number) === clean
    ) {
      results.push({ surah, kind: "surah" });
      if (results.length >= limit) return results;
    }
  }

  for (const ayah of bundle.ayahs) {
    const matches = ayah.searchText.includes(clean) || normalizeArabic(ayah.searchText).includes(arabic);
    if (!matches) continue;
    const surah = surahByNumber.get(ayah.surah);
    if (!surah) continue;
    results.push({ surah, ayah, kind: "ayah" });
    if (results.length >= limit) break;
  }

  return results;
}

export function ayahsInRange(startSurah: number, startAyah: number, endSurah: number, endAyah: number) {
  const start = absoluteIndex(startSurah, startAyah);
  const end = absoluteIndex(endSurah, endAyah);
  if (start < 0 || end < start) return [];
  return bundle.ayahs.slice(start, end + 1);
}
