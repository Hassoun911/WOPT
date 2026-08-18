from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[2]


def read(path: str) -> str:
    return (ROOT / path).read_text()


def write(path: str, content: str) -> None:
    target = ROOT / path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content)


def replace_once(path: str, old: str, new: str) -> None:
    text = read(path)
    if old not in text:
        raise SystemExit(f"Missing expected block in {path}: {old[:160]!r}")
    write(path, text.replace(old, new, 1))


def regex_once(path: str, pattern: str, replacement: str) -> None:
    text = read(path)
    updated, count = re.subn(pattern, lambda _m: replacement, text, count=1, flags=re.S)
    if count != 1:
        raise SystemExit(f"Pattern matched {count} times in {path}: {pattern[:160]!r}")
    write(path, updated)


# -----------------------------------------------------------------------------
# Shared exact Hassoun mark for native screens.
# -----------------------------------------------------------------------------
write("mobile/src/BrandMark.tsx", r'''import { Image, StyleSheet, View } from "react-native";

export default function BrandMark({ size = 44 }: { size?: number }) {
  return (
    <View style={[styles.shell, { width: size, height: size, borderRadius: Math.max(12, Math.round(size * 0.28)) }]}>
      <Image source={require("../assets/hassoun-logo.png")} resizeMode="contain" style={{ width: size, height: size }} />
    </View>
  );
}

const styles = StyleSheet.create({
  shell: { overflow: "hidden", backgroundColor: "#003d33", alignItems: "center", justifyContent: "center" }
});
''')

# -----------------------------------------------------------------------------
# Islamic events: dynamic Umm al-Qura calendar, current-year list and timeline.
# -----------------------------------------------------------------------------
write("mobile/src/islamicEvents.ts", r'''export type IslamicEventDefinition = {
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
    const parts = new Intl.DateTimeFormat("en-u-ca-islamic-umalqura", {
      calendar: "islamic-umalqura",
      timeZone: "UTC",
      year: "numeric",
      month: "numeric",
      day: "numeric"
    }).formatToParts(date);
    const number = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value ?? 0);
    return { year: number("year"), month: number("month"), day: number("day") };
  } catch {
    return { year: 0, month: 0, day: 0 };
  }
}

export function islamicEventsForGregorianYear(year: number) {
  const existing = cache.get(year);
  if (existing) return existing;
  const found: IslamicEventOccurrence[] = [];
  const start = Date.UTC(year, 0, 1, 12);
  const end = Date.UTC(year + 1, 0, 1, 12);
  for (let time = start; time < end; time += 86_400_000) {
    const date = new Date(time);
    const dateKey = dateKeyUtc(date);
    const hijri = hijriParts(dateKey);
    for (const definition of ISLAMIC_EVENTS) {
      if (definition.month === hijri.month && definition.day === hijri.day) {
        found.push({ ...definition, dateKey, hijriYear: hijri.year });
      }
    }
  }
  found.sort((a, b) => a.dateKey.localeCompare(b.dateKey));
  cache.set(year, found);
  return found;
}

export function daysBetweenDateKeys(from: string, to: string) {
  const start = Date.parse(`${from}T00:00:00Z`);
  const end = Date.parse(`${to}T00:00:00Z`);
  return Math.round((end - start) / 86_400_000);
}

export function islamicEventTimeline(todayKey: string): IslamicEventTimeline {
  const year = Number(todayKey.slice(0, 4));
  const all = [
    ...islamicEventsForGregorianYear(year - 1),
    ...islamicEventsForGregorianYear(year),
    ...islamicEventsForGregorianYear(year + 1)
  ].sort((a, b) => a.dateKey.localeCompare(b.dateKey));
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

export function islamicDateLabel(dateKey: string, locale: "en" | "ar") {
  try {
    return new Intl.DateTimeFormat(locale === "ar" ? "ar-u-ca-islamic-umalqura" : "en-u-ca-islamic-umalqura", {
      calendar: "islamic-umalqura", timeZone: "UTC", day: "numeric", month: "long", year: "numeric"
    }).format(new Date(`${dateKey}T12:00:00Z`));
  } catch { return ""; }
}
''')

write("mobile/src/IslamicEventsPage.tsx", r'''import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import BrandMark from "./BrandMark";
import { islamicDateLabel, islamicEventCountdown, islamicEventsForGregorianYear, islamicEventTimeline, type IslamicEventOccurrence } from "./islamicEvents";

type Props = { locale: "en" | "ar"; todayKey: string; onBack: () => void };

function EventMini({ event, locale, label }: { event: IslamicEventOccurrence | null; locale: "en" | "ar"; label: string }) {
  if (!event) return null;
  const ar = locale === "ar";
  const date = new Intl.DateTimeFormat(ar ? "ar-CA" : "en-CA", { timeZone: "UTC", month: "short", day: "numeric", year: "numeric" }).format(new Date(`${event.dateKey}T12:00:00Z`));
  return <View style={styles.miniCard}><Text style={styles.miniLabel}>{label}</Text><Text style={styles.miniEmoji}>{event.emoji}</Text><Text style={styles.miniTitle}>{event.name[locale]}</Text><Text style={styles.miniDate}>{date}</Text></View>;
}

export default function IslamicEventsPage({ locale, todayKey, onBack }: Props) {
  const ar = locale === "ar";
  const t = (en: string, arabic: string) => ar ? arabic : en;
  const year = Number(todayKey.slice(0, 4));
  const events = islamicEventsForGregorianYear(year);
  const timeline = islamicEventTimeline(todayKey);
  const next = timeline.next;
  const days = timeline.daysUntilNext ?? 0;

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.screen} showsVerticalScrollIndicator={false}>
      <View style={styles.header}><Pressable onPress={onBack} style={styles.back}><Text style={styles.backText}>‹</Text></Pressable><BrandMark size={44} /><View style={styles.copy}><Text style={styles.eyebrow}>HASSOUN • {t("ISLAMIC EVENTS", "المناسبات الإسلامية")}</Text><Text style={styles.title}>{t("Islamic Calendar", "التقويم الإسلامي")}</Text><Text style={styles.subtitle}>{t("Last event, what is coming next, and the full year at a glance.", "آخر مناسبة وما هو قادم وجميع مناسبات السنة في مكان واحد.")}</Text></View></View>

      {next ? <View style={styles.nextHero}><View style={styles.nextGlow}><Text style={styles.nextEmoji}>{next.emoji}</Text></View><View style={styles.copy}><Text style={styles.nextLabel}>{t("NEXT ISLAMIC EVENT", "المناسبة الإسلامية القادمة")}</Text><Text style={styles.nextTitle}>{next.name[locale]}</Text><Text style={styles.nextHijri}>{islamicDateLabel(next.dateKey, locale)}</Text><Text style={styles.nextDescription}>{next.description[locale]}</Text></View><View style={styles.counter}><Text style={styles.counterNumber}>{islamicEventCountdown(days, locale)}</Text><Text style={styles.counterLabel}>{t("remaining", "متبقي")}</Text></View></View> : null}

      <View style={styles.twoCol}><EventMini event={timeline.previous} locale={locale} label={t("LAST EVENT", "آخر مناسبة")} /><EventMini event={timeline.next} locale={locale} label={t("COMING UP", "القادمة")} /></View>

      <View style={styles.sectionHead}><Text style={styles.sectionTitle}>{t(`${year} Islamic Events`, `المناسبات الإسلامية ${new Intl.NumberFormat("ar").format(year)}`)}</Text><Text style={styles.sectionMeta}>{events.length} {t("dates", "تواريخ")}</Text></View>

      <View style={styles.list}>{events.map((event) => {
        const past = event.dateKey < todayKey;
        const isNext = next?.id === event.id && next.dateKey === event.dateKey;
        const date = new Intl.DateTimeFormat(ar ? "ar-CA" : "en-CA", { timeZone: "UTC", weekday: "short", month: "short", day: "numeric" }).format(new Date(`${event.dateKey}T12:00:00Z`));
        return <View key={`${event.id}-${event.dateKey}`} style={[styles.eventRow, isNext && styles.eventRowNext, past && styles.eventRowPast]}><View style={[styles.eventIcon, isNext && styles.eventIconNext]}><Text style={styles.eventEmoji}>{event.emoji}</Text></View><View style={styles.copy}><View style={styles.eventTitleRow}><Text style={styles.eventTitle}>{event.name[locale]}</Text>{isNext ? <Text style={styles.nextPill}>{t("NEXT", "القادمة")}</Text> : null}</View><Text style={styles.eventDate}>{date} • {islamicDateLabel(event.dateKey, locale)}</Text><Text style={styles.eventDescription}>{event.description[locale]}</Text>{event.note ? <Text style={styles.eventNote}>ⓘ {event.note[locale]}</Text> : null}</View></View>;
      })}</View>

      <View style={styles.notice}><Text style={styles.noticeIcon}>☾</Text><Text style={styles.noticeText}>{t("Hijri dates use the Umm al-Qura calendar as an estimate. Ramadan, Eid and other dates may shift by a day based on local moon sighting and local religious authority announcements.", "تُعرض التواريخ الهجرية وفق تقويم أم القرى كتقدير. قد تتغير بداية رمضان والعيد وبعض المناسبات يوماً بحسب رؤية الهلال وإعلانات الجهات الإسلامية المحلية.")}</Text></View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: "#f7f4ec" }, screen: { padding: 17, paddingBottom: 38 }, header: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 15 }, back: { width: 42, height: 42, borderRadius: 14, backgroundColor: "#fff", borderWidth: 1, borderColor: "#ddd9d0", alignItems: "center", justifyContent: "center" }, backText: { color: "#0b654f", fontSize: 30, lineHeight: 32 }, copy: { flex: 1 }, eyebrow: { color: "#a17c36", fontSize: 8, fontWeight: "900", letterSpacing: 1 }, title: { color: "#173f35", fontSize: 25, fontWeight: "900", marginTop: 3 }, subtitle: { color: "#77837e", fontSize: 9, lineHeight: 14, marginTop: 2 },
  nextHero: { borderRadius: 26, backgroundColor: "#075a46", borderWidth: 1, borderColor: "#2a7b65", padding: 15, flexDirection: "row", alignItems: "center", gap: 11 }, nextGlow: { width: 62, height: 62, borderRadius: 22, backgroundColor: "rgba(255,255,255,.1)", alignItems: "center", justifyContent: "center" }, nextEmoji: { fontSize: 31 }, nextLabel: { color: "#e5c66e", fontSize: 7, fontWeight: "900", letterSpacing: 1 }, nextTitle: { color: "#fff", fontSize: 20, fontWeight: "900", marginTop: 3 }, nextHijri: { color: "#d2e3dc", fontSize: 8, marginTop: 2 }, nextDescription: { color: "#c7dbd4", fontSize: 8, lineHeight: 12, marginTop: 4 }, counter: { width: 86, minHeight: 72, borderRadius: 21, backgroundColor: "#f1d888", alignItems: "center", justifyContent: "center", padding: 6 }, counterNumber: { color: "#17483c", fontSize: 13, lineHeight: 17, fontWeight: "900", textAlign: "center" }, counterLabel: { color: "#587066", fontSize: 6, fontWeight: "900", marginTop: 2 },
  twoCol: { flexDirection: "row", gap: 8, marginTop: 10 }, miniCard: { flex: 1, minHeight: 116, borderRadius: 20, backgroundColor: "#fff", borderWidth: 1, borderColor: "#e0ddd4", padding: 11 }, miniLabel: { color: "#9a7b3f", fontSize: 6.5, fontWeight: "900", letterSpacing: .8 }, miniEmoji: { fontSize: 23, marginTop: 7 }, miniTitle: { color: "#173f35", fontSize: 11, fontWeight: "900", marginTop: 5 }, miniDate: { color: "#85908b", fontSize: 7, marginTop: 3 },
  sectionHead: { marginTop: 21, marginBottom: 9, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, sectionTitle: { color: "#173f35", fontSize: 18, fontWeight: "900" }, sectionMeta: { color: "#897c61", fontSize: 8, fontWeight: "800" }, list: { gap: 8 }, eventRow: { borderRadius: 21, backgroundColor: "#fff", borderWidth: 1, borderColor: "#e2ded5", padding: 12, flexDirection: "row", gap: 10 }, eventRowNext: { borderColor: "#d7ba66", backgroundColor: "#fffaf0" }, eventRowPast: { opacity: .68 }, eventIcon: { width: 45, height: 45, borderRadius: 15, backgroundColor: "#edf4f0", alignItems: "center", justifyContent: "center" }, eventIconNext: { backgroundColor: "#f5e6b6" }, eventEmoji: { fontSize: 22 }, eventTitleRow: { flexDirection: "row", alignItems: "center", gap: 6 }, eventTitle: { color: "#173f35", fontSize: 12, fontWeight: "900", flexShrink: 1 }, nextPill: { color: "#fff", backgroundColor: "#0b654f", borderRadius: 99, overflow: "hidden", paddingHorizontal: 7, paddingVertical: 3, fontSize: 5.5, fontWeight: "900" }, eventDate: { color: "#9a7b3f", fontSize: 7.5, fontWeight: "800", marginTop: 3 }, eventDescription: { color: "#78847f", fontSize: 8, lineHeight: 12, marginTop: 4 }, eventNote: { color: "#8b806c", fontSize: 7, lineHeight: 11, marginTop: 5 }, notice: { marginTop: 14, borderRadius: 19, backgroundColor: "#e8f3ee", padding: 13, flexDirection: "row", gap: 9, alignItems: "center" }, noticeIcon: { color: "#0b654f", fontSize: 25 }, noticeText: { flex: 1, color: "#5f756d", fontSize: 8, lineHeight: 13 }
});
''')

# -----------------------------------------------------------------------------
# App shell: Events page + 15-day Home spotlight + settings route.
# -----------------------------------------------------------------------------
replace_once("mobile/App.tsx", 'import QuizGamesHub from "./src/QuizGamesHub";\n', 'import QuizGamesHub from "./src/QuizGamesHub";\nimport IslamicEventsPage from "./src/IslamicEventsPage";\nimport { islamicEventCountdown, islamicEventTimeline } from "./src/islamicEvents";\n')
replace_once("mobile/App.tsx", 'type AppTab = "home" | "quran" | "quiz" | "alerts" | "more";', 'type AppTab = "home" | "quran" | "quiz" | "alerts" | "events" | "more";')
replace_once("mobile/App.tsx", '  const upcomingBadge = nextBadge(quizStats.totalWins);\n', '  const upcomingBadge = nextBadge(quizStats.totalWins);\n  const islamicTimeline = useMemo(() => islamicEventTimeline(todayKey), [todayKey]);\n  const upcomingIslamicEvent = islamicTimeline.next;\n  const upcomingIslamicDays = islamicTimeline.daysUntilNext;\n')
replace_once(
    "mobile/App.tsx",
    '''      {next ? (\n        <View style={styles.nextCard}>''',
    '''      {upcomingIslamicEvent && upcomingIslamicDays !== null && upcomingIslamicDays <= 15 ? (\n        <Pressable onPress={() => setActiveTab("events")} style={styles.eventCountdownCard}>\n          <View style={styles.eventCountdownIcon}><Text style={styles.eventCountdownEmoji}>{upcomingIslamicEvent.emoji}</Text></View>\n          <View style={styles.eventCountdownCopy}><Text style={styles.eventCountdownEyebrow}>{locale === "ar" ? "المناسبة الإسلامية القادمة" : "UPCOMING ISLAMIC EVENT"}</Text><Text style={styles.eventCountdownTitle}>{upcomingIslamicEvent.name[locale]}</Text><Text style={styles.eventCountdownText}>{locale === "ar" ? `متبقي ${islamicEventCountdown(upcomingIslamicDays, locale)}` : `${islamicEventCountdown(upcomingIslamicDays, locale)} remaining`} • {upcomingIslamicEvent.description[locale]}</Text></View>\n          <Text style={styles.eventCountdownArrow}>›</Text>\n        </Pressable>\n      ) : null}\n\n      {next ? (\n        <View style={styles.nextCard}>'''
)
replace_once(
    "mobile/App.tsx",
    '''      <View style={styles.smartGrid}>\n        <Pressable onPress={() => setActiveTab("quran")} style={styles.smartCard}>''',
    '''      <View style={styles.smartGrid}>\n        <Pressable onPress={() => setActiveTab("quran")} style={styles.smartCard}>'''
)
replace_once(
    "mobile/App.tsx",
    '''      </View>\n\n      <View style={styles.inspirationCard}>''',
    '''      </View>\n\n      <Pressable onPress={() => setActiveTab("events")} style={styles.eventsEntryCard}>\n        <View style={styles.eventsEntryIcon}><Text style={styles.eventsEntryEmoji}>🌙</Text></View>\n        <View style={styles.eventsEntryCopy}><Text style={styles.eventsEntryEyebrow}>{locale === "ar" ? "التقويم الإسلامي" : "ISLAMIC CALENDAR"}</Text><Text style={styles.eventsEntryTitle}>{locale === "ar" ? "المناسبات الإسلامية" : "Islamic Events"}</Text><Text style={styles.eventsEntryText}>{upcomingIslamicEvent ? `${locale === "ar" ? "القادمة" : "Next"}: ${upcomingIslamicEvent.name[locale]} • ${islamicEventCountdown(upcomingIslamicDays ?? 0, locale)}` : (locale === "ar" ? "اعرض مناسبات السنة" : "View the full year")}</Text></View>\n        <Text style={styles.eventsEntryArrow}>›</Text>\n      </Pressable>\n\n      <View style={styles.inspirationCard}>'''
)
replace_once(
    "mobile/App.tsx",
    '''    <SettingsHub\n      locale={locale}\n      onToggleLocale={toggleLocale}\n      onOpenAlerts={() => setActiveTab("alerts")}\n      onOpenEmailAlerts={onOpenEmailAlerts}\n    />''',
    '''    <SettingsHub\n      locale={locale}\n      onToggleLocale={toggleLocale}\n      onOpenAlerts={() => setActiveTab("alerts")}\n      onOpenEvents={() => setActiveTab("events")}\n      onOpenEmailAlerts={onOpenEmailAlerts}\n    />'''
)
replace_once(
    "mobile/App.tsx",
    '''      : activeTab === "alerts"\n        ? alertsScreen\n        : activeTab === "more"''',
    '''      : activeTab === "alerts"\n        ? alertsScreen\n        : activeTab === "events"\n          ? <IslamicEventsPage locale={locale} todayKey={todayKey} onBack={() => setActiveTab("home")} />\n          : activeTab === "more"'''
)
replace_once(
    "mobile/App.tsx",
    '  smartGrid: {',
    '  eventCountdownCard: { marginBottom: 12, borderRadius: 22, backgroundColor: "#fff8e8", borderWidth: 1, borderColor: "#dfc477", padding: 13, flexDirection: "row", alignItems: "center", gap: 10 }, eventCountdownIcon: { width: 48, height: 48, borderRadius: 16, backgroundColor: "#0b654f", alignItems: "center", justifyContent: "center" }, eventCountdownEmoji: { fontSize: 24 }, eventCountdownCopy: { flex: 1 }, eventCountdownEyebrow: { color: "#9a7b3f", fontSize: 7, fontWeight: "900", letterSpacing: .8 }, eventCountdownTitle: { color: "#173f35", fontSize: 15, fontWeight: "900", marginTop: 2 }, eventCountdownText: { color: "#74817c", fontSize: 8, lineHeight: 12, marginTop: 3 }, eventCountdownArrow: { color: "#0b654f", fontSize: 27 }, eventsEntryCard: { marginTop: 10, borderRadius: 21, backgroundColor: "#fff", borderWidth: 1, borderColor: "#dedad1", padding: 13, flexDirection: "row", alignItems: "center", gap: 10 }, eventsEntryIcon: { width: 48, height: 48, borderRadius: 16, backgroundColor: "#e9f3ee", alignItems: "center", justifyContent: "center" }, eventsEntryEmoji: { fontSize: 24 }, eventsEntryCopy: { flex: 1 }, eventsEntryEyebrow: { color: "#a17c36", fontSize: 7, fontWeight: "900", letterSpacing: .8 }, eventsEntryTitle: { color: "#173f35", fontSize: 14, fontWeight: "900", marginTop: 2 }, eventsEntryText: { color: "#7b8782", fontSize: 8, marginTop: 3 }, eventsEntryArrow: { color: "#0b654f", fontSize: 27 },\n  smartGrid: {'
)

# -----------------------------------------------------------------------------
# Settings: exact logo on root/subpages + Islamic Events route.
# -----------------------------------------------------------------------------
replace_once("mobile/src/SettingsHub.tsx", 'import HassounWidget, {', 'import BrandMark from "./BrandMark";\nimport HassounWidget, {')
replace_once("mobile/src/SettingsHub.tsx", '  onOpenAlerts: () => void;\n  onOpenEmailAlerts?: () => void;', '  onOpenAlerts: () => void;\n  onOpenEvents: () => void;\n  onOpenEmailAlerts?: () => void;')
replace_once("mobile/src/SettingsHub.tsx", 'export default function SettingsHub({ locale, onToggleLocale, onOpenAlerts, onOpenEmailAlerts }: Props)', 'export default function SettingsHub({ locale, onToggleLocale, onOpenAlerts, onOpenEvents, onOpenEmailAlerts }: Props)')
replace_once(
    "mobile/src/SettingsHub.tsx",
    '''    <View style={styles.subHeader}>\n      <Pressable onPress={onBack} style={styles.backButton}><Text style={styles.backText}>‹</Text></Pressable>\n      <Text style={styles.subHeaderTitle}>{title}</Text>\n    </View>''',
    '''    <View style={styles.subHeader}>\n      <Pressable onPress={onBack} style={styles.backButton}><Text style={styles.backText}>‹</Text></Pressable>\n      <BrandMark size={36} />\n      <Text style={styles.subHeaderTitle}>{title}</Text>\n    </View>'''
)
replace_once(
    "mobile/src/SettingsHub.tsx",
    '''      <Text style={styles.eyebrow}>⚙️ HASSOUN</Text>\n      <Text style={styles.title}>{t("Settings & Support", "الإعدادات والدعم")}</Text>''',
    '''      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}><BrandMark size={48} /><View style={{ flex: 1 }}><Text style={styles.eyebrow}>⚙️ HASSOUN</Text><Text style={styles.title}>{t("Settings & Support", "الإعدادات والدعم")}</Text></View></View>'''
)
replace_once(
    "mobile/src/SettingsHub.tsx",
    '''        <Row emoji="🔔" title={t("Prayer & Adhan alerts", "تنبيهات الصلاة والأذان")} text={t("Notification, Adhan and email alert controls", "التحكم بالتنبيهات والأذان وتنبيهات البريد")} onPress={onOpenAlerts} />\n        <Row emoji="🌐"''',
    '''        <Row emoji="🔔" title={t("Prayer & Adhan alerts", "تنبيهات الصلاة والأذان")} text={t("Notification, Adhan and email alert controls", "التحكم بالتنبيهات والأذان وتنبيهات البريد")} onPress={onOpenAlerts} />\n        <Row emoji="🌙" title={t("Islamic Events", "المناسبات الإسلامية")} text={t("Last event, next event, countdown and the full year", "آخر مناسبة والقادمة والعد التنازلي وجميع مناسبات السنة")} onPress={onOpenEvents} />\n        <Row emoji="🌐"'''
)

# -----------------------------------------------------------------------------
# Brand mark on Qur'an, Games and Quiz screens.
# -----------------------------------------------------------------------------
replace_once("mobile/src/quran/QuranV3.tsx", '  Alert,\n  BackHandler,', '  Alert,\n  BackHandler,\n  Image,')
replace_once("mobile/src/quran/QuranV3.tsx", 'import QuranAudio, { type QuranAudioStatus } from "../../modules/quran-audio";\n', 'import QuranAudio, { type QuranAudioStatus } from "../../modules/quran-audio";\nimport BrandMark from "../BrandMark";\n')
replace_once(
    "mobile/src/quran/QuranV3.tsx",
    '''      <Pressable onPress={handleBack} style={styles.iconButton}><Text style={styles.back}>{ar ? "›" : "‹"}</Text></Pressable>\n      <View style={styles.topCopy}>''',
    '''      <Pressable onPress={handleBack} style={styles.iconButton}><Text style={styles.back}>{ar ? "›" : "‹"}</Text></Pressable>\n      <BrandMark size={36} />\n      <View style={styles.topCopy}>'''
)
replace_once(
    "mobile/src/quran/QuranV3.tsx",
    '''        <Pressable onPress={onBackHome} style={styles.iconButton}><Text style={styles.back}>{ar ? "›" : "‹"}</Text></Pressable>\n        <View style={styles.topCopy}>''',
    '''        <Pressable onPress={onBackHome} style={styles.iconButton}><Text style={styles.back}>{ar ? "›" : "‹"}</Text></Pressable>\n        <BrandMark size={45} />\n        <View style={styles.topCopy}>'''
)

replace_once("mobile/src/QuizGamesHub.tsx", 'import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";\n', 'import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";\nimport BrandMark from "./BrandMark";\n')
replace_once(
    "mobile/src/QuizGamesHub.tsx",
    '<View style={styles.top}><Pressable onPress={onBackHome} style={styles.back}><Text style={styles.backText}>‹</Text></Pressable><View style={styles.copy}>',
    '<View style={styles.top}><Pressable onPress={onBackHome} style={styles.back}><Text style={styles.backText}>‹</Text></Pressable><BrandMark size={44} /><View style={styles.copy}>'
)

replace_once("mobile/src/MultiplayerGames.tsx", 'import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";\n', 'import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";\nimport BrandMark from "./BrandMark";\n')
replace_once("mobile/src/MultiplayerGames.tsx", '<View style={styles.header}><Pressable onPress={onBack} style={styles.back}><Text style={styles.backText}>‹</Text></Pressable><View style={styles.headerCopy}>', '<View style={styles.header}><Pressable onPress={onBack} style={styles.back}><Text style={styles.backText}>‹</Text></Pressable><BrandMark size={43} /><View style={styles.headerCopy}>')
replace_once("mobile/src/MultiplayerGames.tsx", '<View style={styles.header}><Pressable onPress={() => setGame(null)} style={styles.back}><Text style={styles.backText}>‹</Text></Pressable><View style={styles.headerCopy}>', '<View style={styles.header}><Pressable onPress={() => setGame(null)} style={styles.back}><Text style={styles.backText}>‹</Text></Pressable><BrandMark size={43} /><View style={styles.headerCopy}>')

replace_once("mobile/src/IslamicQuiz.tsx", '  Pressable,\n', '  Image,\n  Pressable,\n')
replace_once("mobile/src/IslamicQuiz.tsx", 'import {\n  badgeForWins,', 'import BrandMark from "./BrandMark";\nimport {\n  badgeForWins,')
replace_once("mobile/src/IslamicQuiz.tsx", '<View style={styles.topRow}>\n        <View style={styles.titleWrap}>', '<View style={styles.topRow}>\n        <BrandMark size={46} />\n        <View style={styles.titleWrap}>')
replace_once("mobile/src/IslamicQuiz.tsx", '<View style={styles.resultHero}>\n          <Text style={styles.resultEmoji}>', '<View style={styles.resultHero}>\n          <BrandMark size={50} />\n          <Text style={styles.resultEmoji}>')

# Email signup modal branding.
replace_once("mobile/AppWithEmail.tsx", '  Modal,\n', '  Image,\n  Modal,\n')
replace_once("mobile/AppWithEmail.tsx", 'import App from "./App";\n', 'import App from "./App";\nimport BrandMark from "./src/BrandMark";\n')
replace_once(
    "mobile/AppWithEmail.tsx",
    '''          <View style={styles.modalHeader}>\n            <View>''',
    '''          <View style={styles.modalHeader}>\n            <BrandMark size={46} />\n            <View style={{ flex: 1 }}>'''
)
replace_once(
    "mobile/AppWithEmail.tsx",
    '''            <View style={styles.heroIllustration}>\n              <View style={styles.heroMoon}><Text style={styles.heroMoonText}>☾</Text></View>\n              <View style={styles.heroDome}><Text style={styles.heroDomeText}>و</Text></View>\n            </View>''',
    '''            <View style={styles.heroIllustration}>\n              <Image source={require("./assets/hassoun-logo.png")} resizeMode="contain" style={{ width: 72, height: 72 }} />\n            </View>'''
)

# -----------------------------------------------------------------------------
# Notifications: Islamic-event reminder at 15 days + exact Hassoun mark where
# Android supports full-colour large icons.
# -----------------------------------------------------------------------------
replace_once("mobile/src/notifications.ts", 'import { buildPrayerEvents } from "./events";\n', 'import { buildPrayerEvents } from "./events";\nimport { islamicEventsForGregorianYear } from "./islamicEvents";\n')
replace_once("mobile/src/notifications.ts", 'import { formatPrayerTime } from "./time";\n', 'import { addDateDays, formatPrayerTime, windsorDateKey, windsorLocalToDate } from "./time";\n')
insert_event_scheduler = r'''
async function scheduleIslamicEventReminders(locale: "en" | "ar") {
  const now = new Date();
  const todayKey = windsorDateKey(now);
  const year = Number(todayKey.slice(0, 4));
  const identifiers: string[] = [];
  const events = [...islamicEventsForGregorianYear(year), ...islamicEventsForGregorianYear(year + 1)];
  for (const event of events) {
    const reminderKey = addDateDays(event.dateKey, -15);
    const reminderAt = windsorLocalToDate(reminderKey, "09:00");
    if (reminderAt.getTime() <= now.getTime()) continue;
    const identifier = await Notifications.scheduleNotificationAsync({
      content: {
        title: locale === "ar" ? `Hassoun • بقي ١٥ يوماً على ${event.name.ar}` : `Hassoun • ${event.name.en} in 15 days`,
        body: locale === "ar" ? `${event.description.ar} افتح Hassoun لعرض العد التنازلي والتقويم الإسلامي.` : `${event.description.en} Open Hassoun for the countdown and Islamic calendar.`,
        sound: "default",
        data: { kind: "islamic-event", eventId: event.id, eventDate: event.dateKey }
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: reminderAt,
        channelId: GENERAL_CHANNEL_ID
      }
    });
    identifiers.push(identifier);
  }
  return identifiers;
}

'''
replace_once("mobile/src/notifications.ts", 'async function schedulePrayerNotificationsUnlocked(\n', insert_event_scheduler + 'async function schedulePrayerNotificationsUnlocked(\n')
replace_once(
    "mobile/src/notifications.ts",
    '''  const androidAudio = await scheduleAndroidPrayerAudio(prayerTimes);\n\n  await Promise.all([\n    AsyncStorage.setItem(STORAGE_KEYS.scheduledNotificationIds, JSON.stringify(identifiers)),''',
    '''  const eventIdentifiers = await scheduleIslamicEventReminders(locale);\n  identifiers.push(...eventIdentifiers);\n  const androidAudio = await scheduleAndroidPrayerAudio(prayerTimes);\n\n  await Promise.all([\n    AsyncStorage.setItem(STORAGE_KEYS.scheduledNotificationIds, JSON.stringify(identifiers)),'''
)

for service in [
  "mobile/modules/prayer-audio/android/src/main/java/ca/wopt/prayeraudio/PrayerAudioService.kt",
  "mobile/modules/quran-audio/android/src/main/java/ca/wopt/quranaudio/QuranAudioService.kt"
]:
  text = read(service)
  if "import android.graphics.BitmapFactory" not in text:
    text = text.replace("import android.content.Intent\n", "import android.content.Intent\nimport android.graphics.BitmapFactory\n", 1)
  if ".setLargeIcon(" not in text:
    text = text.replace(".setContentTitle(", ".setLargeIcon(BitmapFactory.decodeResource(resources, applicationInfo.icon))\n      .setContentTitle(", 1)
  if "quranaudio" in service:
    text = text.replace('.setSmallIcon(android.R.drawable.ic_media_play)', '.setSmallIcon(resources.getIdentifier("notification_icon", "drawable", packageName).takeIf { it != 0 } ?: applicationInfo.icon)')
  write(service, text)

# -----------------------------------------------------------------------------
# Server-side Islamic events helper for global prayer email event spotlight.
# -----------------------------------------------------------------------------
write("push-server/src/islamicEvents.ts", r'''export type EmailIslamicEvent = {
  id: string;
  month: number;
  day: number;
  emoji: string;
  name: { en: string; ar: string };
  description: { en: string; ar: string };
  dateKey: string;
};

const DEFINITIONS = [
  { id: "new-year", month: 1, day: 1, emoji: "🌙", name: { en: "Islamic New Year", ar: "رأس السنة الهجرية" }, description: { en: "A new Hijri year begins with Muharram.", ar: "بداية سنة هجرية جديدة مع شهر محرم." } },
  { id: "ashura", month: 1, day: 10, emoji: "🤲", name: { en: "Day of Ashura", ar: "يوم عاشوراء" }, description: { en: "The 10th of Muharram, a significant day of fasting and remembrance.", ar: "العاشر من محرم، يوم للصيام والذكر." } },
  { id: "mawlid", month: 3, day: 12, emoji: "✨", name: { en: "12 Rabi al-Awwal", ar: "١٢ ربيع الأول" }, description: { en: "A date widely associated with the birth of Prophet Muhammad ﷺ.", ar: "تاريخ يرتبط عند كثير من المسلمين بمولد النبي محمد ﷺ." } },
  { id: "isra-miraj", month: 7, day: 27, emoji: "🌌", name: { en: "Isra & Mi'raj", ar: "الإسراء والمعراج" }, description: { en: "A traditional date remembering the Night Journey and Ascension.", ar: "تاريخ متعارف عليه لذكرى الإسراء والمعراج." } },
  { id: "mid-shaban", month: 8, day: 15, emoji: "🌕", name: { en: "Mid-Sha'ban", ar: "ليلة النصف من شعبان" }, description: { en: "The middle of Sha'ban.", ar: "منتصف شهر شعبان." } },
  { id: "ramadan", month: 9, day: 1, emoji: "🏮", name: { en: "Ramadan Begins", ar: "بداية رمضان" }, description: { en: "The blessed month of fasting, Qur'an and worship begins.", ar: "بداية شهر الصيام والقرآن والعبادة." } },
  { id: "laylat-qadr", month: 9, day: 27, emoji: "⭐", name: { en: "Laylat al-Qadr (27th night)", ar: "ليلة القدر (ليلة ٢٧)" }, description: { en: "A commonly highlighted night within Ramadan's last ten nights.", ar: "ليلة يكثر تحريها ضمن العشر الأواخر من رمضان." } },
  { id: "eid-fitr", month: 10, day: 1, emoji: "🎉", name: { en: "Eid al-Fitr", ar: "عيد الفطر" }, description: { en: "The celebration marking the completion of Ramadan.", ar: "عيد المسلمين بعد إكمال رمضان." } },
  { id: "hajj-begins", month: 12, day: 8, emoji: "🕋", name: { en: "Hajj Days Begin", ar: "بداية أيام الحج" }, description: { en: "The central days of Hajj begin.", ar: "بداية الأيام الأساسية للحج." } },
  { id: "arafah", month: 12, day: 9, emoji: "🤍", name: { en: "Day of Arafah", ar: "يوم عرفة" }, description: { en: "The 9th of Dhul-Hijjah and the greatest day of Hajj.", ar: "التاسع من ذي الحجة وأعظم أيام الحج." } },
  { id: "eid-adha", month: 12, day: 10, emoji: "🕌", name: { en: "Eid al-Adha", ar: "عيد الأضحى" }, description: { en: "The Festival of Sacrifice.", ar: "عيد الأضحى المبارك." } }
] as const;

function pad(value: number) { return String(value).padStart(2, "0"); }
function dateKey(date: Date) { return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`; }
function hijriParts(key: string) {
  try {
    const parts = new Intl.DateTimeFormat("en-u-ca-islamic-umalqura", { timeZone: "UTC", calendar: "islamic-umalqura", year: "numeric", month: "numeric", day: "numeric" }).formatToParts(new Date(`${key}T12:00:00Z`));
    const value = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value ?? 0);
    return { month: value("month"), day: value("day") };
  } catch { return { month: 0, day: 0 }; }
}
function yearEvents(year: number) {
  const result: EmailIslamicEvent[] = [];
  for (let time = Date.UTC(year, 0, 1, 12); time < Date.UTC(year + 1, 0, 1, 12); time += 86_400_000) {
    const key = dateKey(new Date(time));
    const hijri = hijriParts(key);
    for (const item of DEFINITIONS) if (item.month === hijri.month && item.day === hijri.day) result.push({ ...item, dateKey: key });
  }
  return result;
}
export function daysBetween(from: string, to: string) { return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000); }
export function nextIslamicEvent(fromDateKey: string) {
  const year = Number(fromDateKey.slice(0, 4));
  const events = [...yearEvents(year), ...yearEvents(year + 1)].sort((a, b) => a.dateKey.localeCompare(b.dateKey));
  const event = events.find((item) => item.dateKey >= fromDateKey) ?? null;
  return event ? { event, daysUntil: daysBetween(fromDateKey, event.dateKey) } : { event: null, daysUntil: null };
}
export function hijriDateLabel(key: string, locale: "en" | "ar") {
  try { return new Intl.DateTimeFormat(locale === "ar" ? "ar-u-ca-islamic-umalqura" : "en-u-ca-islamic-umalqura", { timeZone: "UTC", calendar: "islamic-umalqura", day: "numeric", month: "long", year: "numeric" }).format(new Date(`${key}T12:00:00Z`)); } catch { return ""; }
}
''')

# Include all five prayer times in each email payload.
replace_once(
    "push-server/src/globalPrayerEmail.ts",
    '''    prayerTime,\n    prayerDate: day.prayer_date,\n    locationLabel:''',
    '''    prayerTime,\n    prayerDate: day.prayer_date,\n    prayerTimes: { fajr: day.fajr, dhuhr: day.dhuhr, asr: day.asr, maghrib: day.maghrib, isha: day.isha },\n    locationLabel:'''
)

# -----------------------------------------------------------------------------
# Smart prayer email dashboard: exact logo, hero prayer, schedule, event block,
# inspiration, dates and responsive mobile layout.
# -----------------------------------------------------------------------------
replace_once("push-server/src/emailDelivery.ts", 'import type { Env, Locale, PrayerKey } from "./types";\n', 'import type { Env, Locale, PrayerKey } from "./types";\nimport { hijriDateLabel, nextIslamicEvent } from "./islamicEvents";\n')
email_helpers = r'''
const HASSOUN_LOGO_URL = "https://raw.githubusercontent.com/Hassoun911/WOPT/main/mobile/assets/hassoun-logo.png";

function clockLabel(value: unknown, locale: Locale) {
  const raw = String(value ?? "");
  const match = raw.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return raw;
  const hour24 = Number(match[1]);
  const minute = match[2];
  const hour12 = hour24 % 12 || 12;
  if (locale === "ar") return `${hour12}:${minute} ${hour24 >= 12 ? "م" : "ص"}`;
  return `${hour12}:${minute} ${hour24 >= 12 ? "PM" : "AM"}`;
}

function prayerDashboardEmail(data: Record<string, unknown>, locale: Locale, subject: string, prayer: string) {
  const ar = locale === "ar";
  const direction = ar ? "rtl" : "ltr";
  const align = ar ? "right" : "left";
  const kind = String(data.kind ?? "");
  const prayerDate = String(data.prayerDate ?? "");
  const location = String(data.locationLabel ?? (ar ? "موقعك" : "your location"));
  const manageUrl = String(data.manageUrl ?? "");
  const times = (data.prayerTimes && typeof data.prayerTimes === "object" ? data.prayerTimes : {}) as Record<string, unknown>;
  const names: Array<[PrayerKey, string, string]> = [
    ["fajr", "Fajr", "الفجر"], ["dhuhr", "Dhuhr", "الظهر"], ["asr", "Asr", "العصر"], ["maghrib", "Maghrib", "المغرب"], ["isha", "Isha", "العشاء"]
  ];
  const currentKey = typeof data.prayer === "string" ? data.prayer : "";
  const heroCountdown = kind === "twenty" ? (ar ? "٢٠ دقيقة متبقية" : "20 MINUTES LEFT") : kind === "ten" ? (ar ? "١٠ دقائق متبقية" : "10 MINUTES LEFT") : (ar ? "حان وقت الصلاة" : "PRAYER TIME");
  const gregorian = prayerDate ? new Intl.DateTimeFormat(ar ? "ar-CA" : "en-CA", { timeZone: "UTC", weekday: "long", month: "long", day: "numeric", year: "numeric" }).format(new Date(`${prayerDate}T12:00:00Z`)) : "";
  const hijri = prayerDate ? hijriDateLabel(prayerDate, locale) : "";
  const upcoming = prayerDate ? nextIslamicEvent(prayerDate) : { event: null, daysUntil: null };
  const showEvent = upcoming.event && upcoming.daysUntil !== null && upcoming.daysUntil <= 15;

  const prayerCells = names.map(([key, en, arabic]) => {
    const active = key === currentKey;
    const name = ar ? arabic : en;
    return `<td width="20%" align="center" style="padding:5px 2px"><div style="border:${active ? "2px solid #d8b85f" : "1px solid #e3dccf"};background:${active ? "#0b5b47" : "#fffdf8"};border-radius:14px;padding:10px 3px"><div style="font-size:11px;font-weight:900;color:${active ? "#fff" : "#254d43"}">${escapeHtml(name)}</div><div style="font-size:14px;font-weight:900;color:${active ? "#f4d26f" : "#173f35"};margin-top:4px">${escapeHtml(clockLabel(times[key], locale))}</div></div></td>`;
  }).join("");

  const eventBlock = showEvent && upcoming.event ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:14px"><tr><td style="background:#fff6df;border:1px solid #dfc274;border-radius:18px;padding:15px" dir="${direction}"><div style="font-size:10px;letter-spacing:1.3px;color:#98772e;font-weight:900">${ar ? "المناسبة الإسلامية القادمة" : "UPCOMING ISLAMIC EVENT"}</div><table role="presentation" width="100%"><tr><td style="font-size:28px;width:42px">${upcoming.event.emoji}</td><td style="text-align:${align}"><div style="font-size:17px;color:#173f35;font-weight:900">${escapeHtml(upcoming.event.name[locale])}</div><div style="font-size:12px;color:#6c756f;margin-top:3px">${escapeHtml(ar ? `متبقي ${upcoming.daysUntil} يوم` : `${upcoming.daysUntil} day${upcoming.daysUntil === 1 ? "" : "s"} remaining`)}</div></td></tr></table><div style="font-size:12px;line-height:1.5;color:#756d60;margin-top:8px">${escapeHtml(upcoming.event.description[locale])}</div></td></tr></table>` : "";

  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>@media(max-width:520px){.email-shell{padding:10px!important}.email-card{border-radius:20px!important}.hero-time{font-size:34px!important}.brand-copy{font-size:12px!important}}</style></head><body style="margin:0;background:#f2eee6;font-family:Arial,Helvetica,sans-serif;color:#173f35"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" class="email-shell" style="padding:24px 10px;background:#f2eee6"><tr><td align="center"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" class="email-card" style="max-width:600px;background:#fffdf8;border:1px solid #e1d8c8;border-radius:28px;overflow:hidden"><tr><td style="padding:20px 22px 12px"><table role="presentation" width="100%"><tr><td width="64"><img src="${HASSOUN_LOGO_URL}" width="58" height="58" alt="Hassoun" style="display:block;border:0;border-radius:16px;background:#003d33"></td><td class="brand-copy" style="padding-${ar ? "right" : "left"}:10px;text-align:${align}" dir="${direction}"><div style="font-size:12px;letter-spacing:2px;color:#a17825;font-weight:900">HASSOUN</div><div style="font-size:14px;color:#45655c;font-weight:800;margin-top:3px">${ar ? "الصلاة • القرآن • المعرفة" : "Prayer • Qur’an • Knowledge"}</div></td></tr></table></td></tr><tr><td style="padding:0 18px 18px"><div style="background:#0b5b47;border-radius:24px;padding:20px;color:#fff;text-align:${align}" dir="${direction}"><div style="font-size:10px;letter-spacing:1.5px;color:#f0d27a;font-weight:900">${ar ? "تنبيه الصلاة" : "PRAYER REMINDER"}</div><div style="font-size:27px;font-weight:900;margin-top:7px">${escapeHtml(prayer)}</div><div class="hero-time" style="font-size:40px;line-height:1.1;font-weight:900;color:#fff;margin-top:4px">${escapeHtml(clockLabel(data.prayerTime, locale))}</div><span style="display:inline-block;margin-top:10px;background:#f0d27a;color:#17483c;font-size:11px;font-weight:900;padding:8px 12px;border-radius:999px">${escapeHtml(heroCountdown)}</span><div style="font-size:11px;color:#c9ddd6;margin-top:12px">📍 ${escapeHtml(location)}</div></div>${gregorian || hijri ? `<div style="text-align:center;padding:13px 4px 3px;color:#5f6f69" dir="${direction}"><div style="font-size:12px;font-weight:800">${escapeHtml(gregorian)}</div><div style="font-size:12px;color:#a17c36;font-weight:800;margin-top:3px">☾ ${escapeHtml(hijri)}</div></div>` : ""}<div style="font-size:11px;letter-spacing:1px;font-weight:900;color:#8d7541;margin:13px 3px 5px;text-align:${align}" dir="${direction}">${ar ? "مواقيت اليوم" : "TODAY'S PRAYERS"}</div><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr>${prayerCells}</tr></table>${eventBlock}<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:14px"><tr><td style="background:#eef5f0;border-radius:18px;padding:15px;text-align:${align}" dir="${direction}"><div style="font-size:10px;letter-spacing:1px;color:#0b654f;font-weight:900">${ar ? "تذكير اليوم" : "DAILY REMINDER"}</div><div style="font-size:14px;line-height:1.65;color:#345c51;font-weight:700;margin-top:6px">${ar ? "ألا بذكر الله تطمئن القلوب." : "Indeed, in the remembrance of Allah hearts find rest."}</div><div style="font-size:11px;color:#9a7b3f;margin-top:5px">Qur’an 13:28</div></td></tr></table>${manageUrl ? `<table role="presentation" width="100%" style="margin-top:16px"><tr><td align="center"><a href="${escapeHtml(manageUrl)}" style="display:block;background:#173f35;color:#fff;text-decoration:none;font-size:13px;font-weight:900;padding:14px 18px;border-radius:15px">${ar ? "إدارة تنبيهات Hassoun" : "Manage Hassoun alerts"}</a></td></tr></table>` : ""}<div style="text-align:center;color:#9a9488;font-size:10px;line-height:1.5;padding:17px 8px 4px" dir="${direction}">${ar ? "قد تختلف التواريخ الهجرية يوماً حسب رؤية الهلال المحلية." : "Hijri dates may shift by a day according to local moon sighting."}<br>Hassoun • ${escapeHtml(location)}</div></td></tr></table></td></tr></table></body></html>`;
}

'''
replace_once("push-server/src/emailDelivery.ts", 'function builtInPrayerEmail(data: Record<string, unknown>, locale: Locale): RenderedEmail {\n', email_helpers + 'function builtInPrayerEmail(data: Record<string, unknown>, locale: Locale): RenderedEmail {\n')
regex_once(
    "push-server/src/emailDelivery.ts",
    r'function builtInPrayerEmail\(data: Record<string, unknown>, locale: Locale\): RenderedEmail \{.*?\n\}\n\nfunction builtInSystemEmail',
    r'''function builtInPrayerEmail(data: Record<string, unknown>, locale: Locale): RenderedEmail {
  const prayer = prayerName(data.prayer, locale);
  const kind = data.kind;
  const prayerTime = clockLabel(data.prayerTime, locale);
  const location = String(data.locationLabel ?? (locale === "ar" ? "موقعك" : "your location"));
  const manageUrl = String(data.manageUrl ?? "");
  const subject = locale === "ar"
    ? kind === "twenty" ? `Hassoun • بقي ٢٠ دقيقة على صلاة ${prayer}` : kind === "ten" ? `Hassoun • بقي ١٠ دقائق على صلاة ${prayer}` : `Hassoun • حان وقت صلاة ${prayer}`
    : kind === "twenty" ? `Hassoun • ${prayer} in 20 minutes` : kind === "ten" ? `Hassoun • ${prayer} in 10 minutes` : `Hassoun • It is time for ${prayer}`;
  const html = prayerDashboardEmail(data, locale, subject, prayer);
  const text = `${subject}\n${prayerTime} • ${location}${manageUrl ? `\n${locale === "ar" ? "إدارة التنبيهات" : "Manage alerts"}: ${manageUrl}` : ""}`;
  return { subject, html, text };
}

function builtInSystemEmail'''
)
# Correct legacy logo URL in generic system emails too.
text = read("push-server/src/emailDelivery.ts")
text = text.replace('https://hassoun911.github.io/Hassoun/assets/hassoun-logo.png', 'https://raw.githubusercontent.com/Hassoun911/WOPT/main/mobile/assets/hassoun-logo.png')
write("push-server/src/emailDelivery.ts", text)

# -----------------------------------------------------------------------------
# Release identity.
# -----------------------------------------------------------------------------
replace_once("mobile/app.config.ts", '  version: "0.5.9",', '  version: "0.6.0",')
replace_once("mobile/app.config.ts", '    versionCode: 31,', '    versionCode: 32,')

print("Applied Hassoun v0.6.0 complete update: events, branding, notifications and smart prayer emails.")
