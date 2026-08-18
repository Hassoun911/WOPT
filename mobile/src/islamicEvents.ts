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

const HIJRI_EPOCH = 1948439.5;
const HIJRI_DAY_OFFSET = 1;
const cache = new Map<number, IslamicEventOccurrence[]>();

function pad(value: number) { return String(value).padStart(2, "0"); }
function dateKeyUtc(date: Date) { return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`; }

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

function hijriPartsFromGregorian(year: number, month: number, day: number) {
  const jd = Math.floor(gregorianToJulianDay(year, month, day) + HIJRI_DAY_OFFSET) + 0.5;
  const hijriYear = Math.floor((30 * (jd - HIJRI_EPOCH) + 10646) / 10631);
  const hijriMonth = Math.min(12, Math.max(1, Math.ceil((jd - (29 + islamicToJulianDay(hijriYear, 1, 1))) / 29.5) + 1));
  const hijriDay = Math.max(1, Math.floor(jd - islamicToJulianDay(hijriYear, hijriMonth, 1) + 1));
  return { year: hijriYear, month: hijriMonth, day: hijriDay };
}

export function hijriPartsForDateKey(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  if (!year || !month || !day) return { year: 0, month: 0, day: 0 };
  return hijriPartsFromGregorian(year, month, day);
}

export function islamicEventsForGregorianYear(year: number) {
  const existing = cache.get(year);
  if (existing) return existing;
  const found: IslamicEventOccurrence[] = [];
  for (let time = Date.UTC(year, 0, 1, 12); time < Date.UTC(year + 1, 0, 1, 12); time += 86_400_000) {
    const date = new Date(time);
    const dateKey = dateKeyUtc(date);
    const hijri = hijriPartsFromGregorian(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
    for (const definition of ISLAMIC_EVENTS) {
      if (definition.month === hijri.month && definition.day === hijri.day) found.push({ ...definition, dateKey, hijriYear: hijri.year });
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

const HIJRI_MONTHS_EN = ["Muharram", "Safar", "Rabi al-Awwal", "Rabi al-Thani", "Jumada al-Awwal", "Jumada al-Thani", "Rajab", "Sha'ban", "Ramadan", "Shawwal", "Dhu al-Qi'dah", "Dhu al-Hijjah"];
const HIJRI_MONTHS_AR = ["محرم", "صفر", "ربيع الأول", "ربيع الآخر", "جمادى الأولى", "جمادى الآخرة", "رجب", "شعبان", "رمضان", "شوال", "ذو القعدة", "ذو الحجة"];

export function islamicDateLabel(dateKey: string, locale: "en" | "ar") {
  const hijri = hijriPartsForDateKey(dateKey);
  if (!hijri.year || !hijri.month || !hijri.day) return "";
  const month = locale === "ar" ? HIJRI_MONTHS_AR[hijri.month - 1] : HIJRI_MONTHS_EN[hijri.month - 1];
  if (locale === "ar") return `${new Intl.NumberFormat("ar").format(hijri.day)} ${month} ${new Intl.NumberFormat("ar").format(hijri.year)} هـ`;
  return `${month} ${hijri.day}, ${hijri.year} AH`;
}
