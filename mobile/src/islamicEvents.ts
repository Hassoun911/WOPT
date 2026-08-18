export type IslamicEventDefinition = {
  id: string;
  month: number;
  day: number;
  emoji: string;
  name: { en: string; ar: string };
  description: { en: string; ar: string };
  note?: { en: string; ar: string };
};

export type IslamicEventOccurrence = IslamicEventDefinition & {
  dateKey: string;
  hijriYear: number;
};

export type IslamicEventTimeline = {
  previous: IslamicEventOccurrence | null;
  next: IslamicEventOccurrence | null;
  daysUntilNext: number | null;
};

export const ISLAMIC_EVENTS: IslamicEventDefinition[] = [
  { id: "new-year", month: 1, day: 1, emoji: "🌙", name: { en: "Islamic New Year", ar: "رأس السنة الهجرية" }, description: { en: "The first day of Muharram and the beginning of a new Hijri year.", ar: "أول يوم من شهر محرم وبداية سنة هجرية جديدة." } },
  { id: "ashura", month: 1, day: 10, emoji: "🤲", name: { en: "Day of Ashura", ar: "يوم عاشوراء" }, description: { en: "The 10th of Muharram, a significant day of fasting and remembrance.", ar: "العاشر من محرم، يوم عظيم للصيام والذكر." } },
  { id: "mawlid", month: 3, day: 12, emoji: "✨", name: { en: "12 Rabi al-Awwal", ar: "١٢ ربيع الأول" }, description: { en: "A date widely associated with the birth of Prophet Muhammad ﷺ.", ar: "تاريخ يرتبط عند كثير من المسلمين بمولد النبي محمد ﷺ." }, note: { en: "Observance and historical dating vary among Muslim communities.", ar: "تختلف طريقة إحياء هذا اليوم وتحديد التاريخ بين المجتمعات الإسلامية." } },
  { id: "isra-miraj", month: 7, day: 27, emoji: "🌌", name: { en: "Isra & Mi'raj", ar: "الإسراء والمعراج" }, description: { en: "A traditional date remembering the Night Journey and Ascension.", ar: "تاريخ متعارف عليه لذكرى الإسراء والمعراج." }, note: { en: "The exact historical date is not certain.", ar: "التاريخ التاريخي الدقيق غير ثابت." } },
  { id: "mid-shaban", month: 8, day: 15, emoji: "🌕", name: { en: "Mid-Sha'ban", ar: "ليلة النصف من شعبان" }, description: { en: "The middle of Sha'ban, observed in different ways across Muslim communities.", ar: "منتصف شعبان وتختلف طرق إحيائه بين المجتمعات الإسلامية." } },
  { id: "ramadan", month: 9, day: 1, emoji: "🏮", name: { en: "Ramadan Begins", ar: "بداية رمضان" }, description: { en: "The beginning of the blessed month of fasting, Qur'an and worship.", ar: "بداية شهر الصيام والقرآن والعبادة المبارك." } },
  { id: "laylat-qadr", month: 9, day: 27, emoji: "⭐", name: { en: "Laylat al-Qadr (27th night)", ar: "ليلة القدر (ليلة ٢٧)" }, description: { en: "A commonly highlighted night within the last ten nights of Ramadan.", ar: "ليلة يكثر تحريها ضمن العشر الأواخر من رمضان." }, note: { en: "Laylat al-Qadr should be sought throughout the odd nights of the last ten nights.", ar: "تُتحرى ليلة القدر في الليالي الوترية من العشر الأواخر." } },
  { id: "eid-fitr", month: 10, day: 1, emoji: "🎉", name: { en: "Eid al-Fitr", ar: "عيد الفطر" }, description: { en: "The celebration marking the completion of Ramadan.", ar: "عيد المسلمين بعد إكمال شهر رمضان." } },
  { id: "hajj-begins", month: 12, day: 8, emoji: "🕋", name: { en: "Hajj Days Begin", ar: "بداية أيام الحج" }, description: { en: "The 8th of Dhul-Hijjah, the beginning of the central days of Hajj.", ar: "الثامن من ذي الحجة وبداية الأيام الأساسية للحج." } },
  { id: "arafah", month: 12, day: 9, emoji: "🤍", name: { en: "Day of Arafah", ar: "يوم عرفة" }, description: { en: "The 9th of Dhul-Hijjah and the greatest day of Hajj.", ar: "التاسع من ذي الحجة وأعظم أيام الحج." } },
  { id: "eid-adha", month: 12, day: 10, emoji: "🕌", name: { en: "Eid al-Adha", ar: "عيد الأضحى" }, description: { en: "The Festival of Sacrifice on the 10th of Dhul-Hijjah.", ar: "عيد الأضحى في العاشر من ذي الحجة." } }
];

const HIJRI_MONTHS_EN = ["Muharram", "Safar", "Rabi al-Awwal", "Rabi al-Thani", "Jumada al-Awwal", "Jumada al-Thani", "Rajab", "Sha'ban", "Ramadan", "Shawwal", "Dhu al-Qi'dah", "Dhu al-Hijjah"];
const HIJRI_MONTHS_AR = ["محرم", "صفر", "ربيع الأول", "ربيع الآخر", "جمادى الأولى", "جمادى الآخرة", "رجب", "شعبان", "رمضان", "شوال", "ذو القعدة", "ذو الحجة"];
const cache = new Map<number, IslamicEventOccurrence[]>();
const pad = (value: number) => String(value).padStart(2, "0");

// Deterministic tabular Hijri conversion. We intentionally do not depend on
// Intl islamic-umalqura here because some Android/Hermes builds return no
// usable calendar parts, which previously made the Events page show 0 dates.
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

export function islamicEventsForGregorianYear(year: number) {
  const existing = cache.get(year);
  if (existing) return existing;
  const found: IslamicEventOccurrence[] = [];
  const center = approximateHijriYear(year);
  for (let hijriYear = center - 2; hijriYear <= center + 2; hijriYear += 1) {
    for (const definition of ISLAMIC_EVENTS) {
      const gregorian = julianDayToGregorian(islamicToJulianDay(hijriYear, definition.month, definition.day));
      if (gregorian.year !== year) continue;
      found.push({ ...definition, dateKey: `${gregorian.year}-${pad(gregorian.month)}-${pad(gregorian.day)}`, hijriYear });
    }
  }
  found.sort((a, b) => a.dateKey.localeCompare(b.dateKey));
  cache.set(year, found);
  return found;
}

export function daysBetweenDateKeys(from: string, to: string) {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

export function islamicEventTimeline(todayKey: string): IslamicEventTimeline {
  const year = Number(todayKey.slice(0, 4));
  const all = [...islamicEventsForGregorianYear(year - 1), ...islamicEventsForGregorianYear(year), ...islamicEventsForGregorianYear(year + 1)].sort((a, b) => a.dateKey.localeCompare(b.dateKey));
  let previous: IslamicEventOccurrence | null = null;
  let next: IslamicEventOccurrence | null = null;
  for (const event of all) {
    if (event.dateKey < todayKey) previous = event;
    if (!next && event.dateKey >= todayKey) next = event;
  }
  return { previous, next, daysUntilNext: next ? daysBetweenDateKeys(todayKey, next.dateKey) : null };
}

export function islamicEventCountdown(days: number, locale: "en" | "ar") {
  if (days <= 0) return locale === "ar" ? "اليوم" : "Today";
  if (days < 45) return locale === "ar" ? `${new Intl.NumberFormat("ar").format(days)} يوم` : `${days} day${days === 1 ? "" : "s"}`;
  const months = Math.floor(days / 30);
  const remainder = days % 30;
  if (locale === "ar") return `${new Intl.NumberFormat("ar").format(months)} شهر${remainder ? ` و${new Intl.NumberFormat("ar").format(remainder)} يوم` : ""}`;
  return `${months} month${months === 1 ? "" : "s"}${remainder ? ` ${remainder}d` : ""}`;
}

export function islamicDateLabelForEvent(event: IslamicEventOccurrence, locale: "en" | "ar") {
  const month = locale === "ar" ? HIJRI_MONTHS_AR[event.month - 1] : HIJRI_MONTHS_EN[event.month - 1];
  const day = locale === "ar" ? new Intl.NumberFormat("ar").format(event.day) : String(event.day);
  const year = locale === "ar" ? new Intl.NumberFormat("ar").format(event.hijriYear) : String(event.hijriYear);
  return locale === "ar" ? `${day} ${month} ${year} هـ` : `${month} ${day}, ${year} AH`;
}

// Backward-compatible helper for any older caller. Event screens should prefer
// islamicDateLabelForEvent so the label never relies on Android calendar Intl.
export function islamicDateLabel(dateKey: string, locale: "en" | "ar") {
  const year = Number(dateKey.slice(0, 4));
  const event = [...islamicEventsForGregorianYear(year - 1), ...islamicEventsForGregorianYear(year), ...islamicEventsForGregorianYear(year + 1)].find((item) => item.dateKey === dateKey);
  return event ? islamicDateLabelForEvent(event, locale) : "";
}
