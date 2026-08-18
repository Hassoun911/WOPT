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

const cache = new Map<number, IslamicEventOccurrence[]>();
function pad(value: number) { return String(value).padStart(2, "0"); }
function dateKeyUtc(date: Date) { return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`; }
function hijriParts(dateKey: string) {
  const date = new Date(`${dateKey}T12:00:00Z`);
  try {
    const parts = new Intl.DateTimeFormat("en-u-ca-islamic-umalqura", { calendar: "islamic-umalqura", timeZone: "UTC", year: "numeric", month: "numeric", day: "numeric" }).formatToParts(date);
    const number = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value ?? 0);
    return { year: number("year"), month: number("month"), day: number("day") };
  } catch { return { year: 0, month: 0, day: 0 }; }
}
export function islamicEventsForGregorianYear(year: number) {
  const existing = cache.get(year); if (existing) return existing;
  const found: IslamicEventOccurrence[] = [];
  for (let time = Date.UTC(year, 0, 1, 12); time < Date.UTC(year + 1, 0, 1, 12); time += 86_400_000) {
    const date = new Date(time); const dateKey = dateKeyUtc(date); const hijri = hijriParts(dateKey);
    for (const definition of ISLAMIC_EVENTS) if (definition.month === hijri.month && definition.day === hijri.day) found.push({ ...definition, dateKey, hijriYear: hijri.year });
  }
  found.sort((a, b) => a.dateKey.localeCompare(b.dateKey)); cache.set(year, found); return found;
}
export function daysBetweenDateKeys(from: string, to: string) { return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000); }
export function islamicEventTimeline(todayKey: string): IslamicEventTimeline {
  const year = Number(todayKey.slice(0, 4));
  const all = [...islamicEventsForGregorianYear(year - 1), ...islamicEventsForGregorianYear(year), ...islamicEventsForGregorianYear(year + 1)].sort((a, b) => a.dateKey.localeCompare(b.dateKey));
  let previous: IslamicEventOccurrence | null = null; let next: IslamicEventOccurrence | null = null;
  for (const event of all) { if (event.dateKey < todayKey) previous = event; if (!next && event.dateKey >= todayKey) next = event; }
  return { previous, next, daysUntilNext: next ? daysBetweenDateKeys(todayKey, next.dateKey) : null };
}
export function islamicEventCountdown(days: number, locale: "en" | "ar") {
  if (days <= 0) return locale === "ar" ? "اليوم" : "Today";
  if (days < 45) return locale === "ar" ? `${new Intl.NumberFormat("ar").format(days)} يوم` : `${days} day${days === 1 ? "" : "s"}`;
  const months = Math.floor(days / 30); const remainder = days % 30;
  if (locale === "ar") return `${new Intl.NumberFormat("ar").format(months)} شهر${remainder ? ` و${new Intl.NumberFormat("ar").format(remainder)} يوم` : ""}`;
  return `${months} month${months === 1 ? "" : "s"}${remainder ? ` ${remainder}d` : ""}`;
}
export function islamicDateLabel(dateKey: string, locale: "en" | "ar") {
  try { return new Intl.DateTimeFormat(locale === "ar" ? "ar-u-ca-islamic-umalqura" : "en-u-ca-islamic-umalqura", { calendar: "islamic-umalqura", timeZone: "UTC", day: "numeric", month: "long", year: "numeric" }).format(new Date(`${dateKey}T12:00:00Z`)); } catch { return ""; }
}
