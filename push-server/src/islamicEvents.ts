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

const cache = new Map<number, IslamicEventOccurrence[]>();
const pad = (value: number) => String(value).padStart(2, "0");

function islamicToJulianDay(year: number, month: number, day: number) {
  return day + Math.ceil(29.5 * (month - 1)) + (year - 1) * 354 + Math.floor((3 + 11 * year) / 30) + 1948439.5 - 1;
}

function julianDayToGregorian(jd: number) {
  const z = Math.floor(jd + 0.5);
  const f = jd + 0.5 - z;
  let a = z;
  if (z >= 2299161) {
    const alpha = Math.floor((z - 1867216.25) / 36524.25);
    a = z + 1 + alpha - Math.floor(alpha / 4);
  }
  const b = a + 1524;
  const c = Math.floor((b - 122.1) / 365.25);
  const d = Math.floor(365.25 * c);
  const e = Math.floor((b - d) / 30.6001);
  const day = Math.floor(b - d - Math.floor(30.6001 * e) + f);
  const month = e < 14 ? e - 1 : e - 13;
  const year = month > 2 ? c - 4716 : c - 4715;
  return { year, month, day };
}

function approximateHijriYear(gregorianYear: number) {
  return Math.floor((gregorianYear - 622) * 33 / 32);
}

export function eventsForGregorianYear(year: number) {
  const cached = cache.get(year);
  if (cached) return cached;
  const found: IslamicEventOccurrence[] = [];
  const center = approximateHijriYear(year);
  for (let hijriYear = center - 2; hijriYear <= center + 2; hijriYear += 1) {
    for (const event of EVENTS) {
      const gregorian = julianDayToGregorian(islamicToJulianDay(hijriYear, event.month, event.day));
      if (gregorian.year !== year) continue;
      found.push({ ...event, dateKey: `${gregorian.year}-${pad(gregorian.month)}-${pad(gregorian.day)}`, hijriYear });
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
