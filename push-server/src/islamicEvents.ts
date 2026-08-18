export type IslamicEvent = {
  id: string;
  month: number;
  day: number;
  name: { en: string; ar: string };
  description: { en: string; ar: string };
  emoji: string;
};

export type IslamicEventOccurrence = IslamicEvent & { dateKey: string; hijriYear: number };

const EVENTS: IslamicEvent[] = [
  { id: "new-year", month: 1, day: 1, emoji: "🌙", name: { en: "Islamic New Year", ar: "رأس السنة الهجرية" }, description: { en: "The first day of Muharram and a new Hijri year.", ar: "أول يوم من محرم وبداية سنة هجرية جديدة." } },
  { id: "ashura", month: 1, day: 10, emoji: "🤲", name: { en: "Day of Ashura", ar: "يوم عاشوراء" }, description: { en: "The 10th of Muharram, a significant day of fasting and remembrance.", ar: "العاشر من محرم، يوم عظيم للصيام والذكر." } },
  { id: "mawlid", month: 3, day: 12, emoji: "✨", name: { en: "12 Rabi al-Awwal", ar: "١٢ ربيع الأول" }, description: { en: "A date widely associated with the birth of Prophet Muhammad ﷺ.", ar: "تاريخ يرتبط عند كثير من المسلمين بمولد النبي محمد ﷺ." } },
  { id: "isra-miraj", month: 7, day: 27, emoji: "🌌", name: { en: "Isra & Mi'raj", ar: "الإسراء والمعراج" }, description: { en: "A traditional date remembering the Night Journey and Ascension.", ar: "تاريخ متعارف عليه لذكرى الإسراء والمعراج." } },
  { id: "mid-shaban", month: 8, day: 15, emoji: "🌕", name: { en: "Mid-Sha'ban", ar: "ليلة النصف من شعبان" }, description: { en: "The middle of Sha'ban, observed in different ways across Muslim communities.", ar: "منتصف شعبان وتختلف طرق إحيائه بين المجتمعات الإسلامية." } },
  { id: "ramadan", month: 9, day: 1, emoji: "🏮", name: { en: "Ramadan Begins", ar: "بداية رمضان" }, description: { en: "The beginning of the blessed month of fasting, Qur'an and worship.", ar: "بداية شهر الصيام والقرآن والعبادة المبارك." } },
  { id: "laylat-qadr", month: 9, day: 27, emoji: "⭐", name: { en: "Laylat al-Qadr (27th night)", ar: "ليلة القدر (ليلة ٢٧)" }, description: { en: "A commonly highlighted night within the last ten nights of Ramadan.", ar: "ليلة يكثر تحريها ضمن العشر الأواخر من رمضان." } },
  { id: "eid-fitr", month: 10, day: 1, emoji: "🎉", name: { en: "Eid al-Fitr", ar: "عيد الفطر" }, description: { en: "The celebration marking the completion of Ramadan.", ar: "عيد المسلمين بعد إكمال شهر رمضان." } },
  { id: "hajj-begins", month: 12, day: 8, emoji: "🕋", name: { en: "Hajj Days Begin", ar: "بداية أيام الحج" }, description: { en: "The 8th of Dhul-Hijjah and the beginning of the central days of Hajj.", ar: "الثامن من ذي الحجة وبداية الأيام الأساسية للحج." } },
  { id: "arafah", month: 12, day: 9, emoji: "🤍", name: { en: "Day of Arafah", ar: "يوم عرفة" }, description: { en: "The 9th of Dhul-Hijjah and the greatest day of Hajj.", ar: "التاسع من ذي الحجة وأعظم أيام الحج." } },
  { id: "eid-adha", month: 12, day: 10, emoji: "🕌", name: { en: "Eid al-Adha", ar: "عيد الأضحى" }, description: { en: "The Festival of Sacrifice on the 10th of Dhul-Hijjah.", ar: "عيد الأضحى في العاشر من ذي الحجة." } }
];

const HIJRI_EPOCH = 1948439.5;
const HIJRI_DAY_OFFSET = 1;
const cache = new Map<number, IslamicEventOccurrence[]>();
const pad = (value: number) => String(value).padStart(2, "0");
const dateKey = (date: Date) => `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;

function gregorianToJulianDay(year: number, month: number, day: number) {
  let y = year;
  let m = month;
  if (m <= 2) { y -= 1; m += 12; }
  const a = Math.floor(y / 100);
  const b = 2 - a + Math.floor(a / 4);
  return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + day + b - 1524.5;
}

function islamicToJulianDay(year: number, month: number, day: number) {
  return day + Math.ceil(29.5 * (month - 1)) + (year - 1) * 354 + Math.floor((3 + 11 * year) / 30) + HIJRI_EPOCH - 1;
}

function hijriParts(year: number, month: number, day: number) {
  const jd = Math.floor(gregorianToJulianDay(year, month, day) + HIJRI_DAY_OFFSET) + 0.5;
  const hijriYear = Math.floor((30 * (jd - HIJRI_EPOCH) + 10646) / 10631);
  const hijriMonth = Math.min(12, Math.max(1, Math.ceil((jd - (29 + islamicToJulianDay(hijriYear, 1, 1))) / 29.5) + 1));
  const hijriDay = Math.max(1, Math.floor(jd - islamicToJulianDay(hijriYear, hijriMonth, 1) + 1));
  return { year: hijriYear, month: hijriMonth, day: hijriDay };
}

export function eventsForGregorianYear(year: number) {
  const cached = cache.get(year);
  if (cached) return cached;
  const found: IslamicEventOccurrence[] = [];
  for (let ms = Date.UTC(year, 0, 1, 12); ms < Date.UTC(year + 1, 0, 1, 12); ms += 86_400_000) {
    const date = new Date(ms);
    const key = dateKey(date);
    const hijri = hijriParts(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
    for (const event of EVENTS) {
      if (event.month === hijri.month && event.day === hijri.day) found.push({ ...event, dateKey: key, hijriYear: hijri.year });
    }
  }
  found.sort((a, b) => a.dateKey.localeCompare(b.dateKey));
  cache.set(year, found);
  return found;
}

export function upcomingIslamicEvent(todayKey: string) {
  const year = Number(todayKey.slice(0, 4));
  const all = [...eventsForGregorianYear(year), ...eventsForGregorianYear(year + 1)].sort((a, b) => a.dateKey.localeCompare(b.dateKey));
  const event = all.find((candidate) => candidate.dateKey >= todayKey) ?? null;
  if (!event) return null;
  const daysLeft = Math.round((Date.parse(`${event.dateKey}T00:00:00Z`) - Date.parse(`${todayKey}T00:00:00Z`)) / 86_400_000);
  return { ...event, daysLeft };
}
