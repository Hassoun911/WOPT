import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import BrandMark from "./BrandMark";
import { daysBetweenDateKeys, hijriPartsForDateKey, islamicDateLabelForEvent, islamicEventCountdown, islamicEventsForGregorianYear, islamicEventTimeline, type IslamicEventOccurrence } from "./islamicEvents";

type Props = { locale: "en" | "ar"; todayKey: string; onBack: () => void };

function EventMini({ event, locale, label }: { event: IslamicEventOccurrence | null; locale: "en" | "ar"; label: string }) {
  if (!event) return null;
  const date = new Intl.DateTimeFormat(locale === "ar" ? "ar-CA" : "en-CA", { timeZone: "UTC", month: "short", day: "numeric", year: "numeric" }).format(new Date(`${event.dateKey}T12:00:00Z`));
  return (
    <View style={styles.miniCard}>
      <View style={styles.miniTop}><Text style={styles.miniEmoji}>{event.emoji}</Text><Text style={styles.miniLabel}>{label}</Text></View>
      <Text style={styles.miniTitle}>{event.name[locale]}</Text>
      <Text style={styles.miniDate}>{date}</Text>
    </View>
  );
}

export default function IslamicEventsPage({ locale, todayKey, onBack }: Props) {
  const ar = locale === "ar";
  const t = (en: string, arabic: string) => ar ? arabic : en;
  const gregorianYear = Number(todayKey.slice(0, 4));
  const currentHijriYear = hijriPartsForDateKey(todayKey).year;
  const allNearbyEvents = [
    ...islamicEventsForGregorianYear(gregorianYear - 1),
    ...islamicEventsForGregorianYear(gregorianYear),
    ...islamicEventsForGregorianYear(gregorianYear + 1)
  ].sort((a, b) => a.dateKey.localeCompare(b.dateKey));
  const events = allNearbyEvents.filter((event) => event.hijriYear === currentHijriYear);
  const upcomingEvents = events.filter((event) => event.dateKey >= todayKey);
  const pastEvents = events.filter((event) => event.dateKey < todayKey).reverse();
  const timeline = islamicEventTimeline(todayKey);
  const next = upcomingEvents[0] ?? timeline.next;
  const days = next ? daysBetweenDateKeys(todayKey, next.dateKey) : 0;

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.screen} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Pressable onPress={onBack} style={styles.back}><Text style={styles.backText}>‹</Text></Pressable>
        <BrandMark size={44} />
        <View style={styles.copy}>
          <Text style={styles.eyebrow}>HASSOUN • {t("ISLAMIC EVENTS", "المناسبات الإسلامية")}</Text>
          <Text style={styles.title}>{t("Islamic Calendar", "التقويم الإسلامي")}</Text>
        </View>
      </View>
      <Text style={styles.subtitle}>{t("Important Islamic dates, what is coming next, and the full year in one calm view.", "المناسبات الإسلامية المهمة وما هو قادم وجميع مناسبات السنة في عرض واضح وهادئ.")}</Text>

      {next ? (
        <View style={styles.nextHero}>
          <View style={styles.nextHeroTop}>
            <View style={styles.nextGlow}><Text style={styles.nextEmoji}>{next.emoji}</Text></View>
            <View style={styles.counter}><Text style={styles.counterNumber}>{islamicEventCountdown(days, locale)}</Text><Text style={styles.counterLabel}>{t("remaining", "متبقي")}</Text></View>
          </View>
          <Text style={styles.nextLabel}>{t("NEXT ISLAMIC EVENT", "المناسبة الإسلامية القادمة")}</Text>
          <Text style={styles.nextTitle}>{next.name[locale]}</Text>
          <Text style={styles.nextHijri}>{islamicDateLabelForEvent(next, locale)}</Text>
          <Text style={styles.nextDescription}>{next.description[locale]}</Text>
        </View>
      ) : null}

      <View style={styles.twoCol}>
        <EventMini event={timeline.previous} locale={locale} label={t("LAST EVENT", "آخر مناسبة")} />
        <EventMini event={timeline.next} locale={locale} label={t("COMING UP", "القادمة")} />
      </View>

      <View style={styles.sectionHead}>
        <Text style={styles.sectionTitle}>{t(`Remaining events • ${currentHijriYear} AH`, `المناسبات المتبقية • ${new Intl.NumberFormat("ar").format(currentHijriYear)} هـ`)}</Text>
        <Text style={styles.sectionMeta}>{upcomingEvents.length} {t("remaining", "متبقية")}</Text>
      </View>

      <View style={styles.list}>{upcomingEvents.map((event) => {
        const past = event.dateKey < todayKey;
        const isNext = next?.id === event.id && next.dateKey === event.dateKey;
        const date = new Intl.DateTimeFormat(ar ? "ar-CA" : "en-CA", { timeZone: "UTC", weekday: "short", month: "short", day: "numeric" }).format(new Date(`${event.dateKey}T12:00:00Z`));
        return (
          <View key={`${event.id}-${event.dateKey}`} style={[styles.eventRow, isNext && styles.eventRowNext, past && styles.eventRowPast]}>
            <View style={[styles.eventIcon, isNext && styles.eventIconNext]}><Text style={styles.eventEmoji}>{event.emoji}</Text></View>
            <View style={styles.copy}>
              <View style={styles.eventTitleRow}><Text style={styles.eventTitle}>{event.name[locale]}</Text>{isNext ? <Text style={styles.nextPill}>{t("NEXT", "القادمة")}</Text> : null}</View>
              <Text style={styles.eventDate}>{date} • {islamicDateLabelForEvent(event, locale)}</Text>
              <Text style={styles.eventDescription}>{event.description[locale]}</Text>
              {event.note ? <Text style={styles.eventNote}>ⓘ {event.note[locale]}</Text> : null}
            </View>
          </View>
        );
      })}</View>

      {pastEvents.length ? (
        <>
          <View style={styles.sectionHead}>
            <Text style={styles.sectionTitle}>{t(`Earlier in ${currentHijriYear} AH`, `مناسبات سابقة في ${new Intl.NumberFormat("ar").format(currentHijriYear)} هـ`)}</Text>
            <Text style={styles.sectionMeta}>{pastEvents.length} {t("past", "سابقة")}</Text>
          </View>
          <View style={styles.list}>{pastEvents.map((event) => {
            const date = new Intl.DateTimeFormat(ar ? "ar-CA" : "en-CA", { timeZone: "UTC", weekday: "short", month: "short", day: "numeric" }).format(new Date(`${event.dateKey}T12:00:00Z`));
            return (
              <View key={`past-${event.id}-${event.dateKey}`} style={[styles.eventRow, styles.eventRowPast]}>
                <View style={styles.eventIcon}><Text style={styles.eventEmoji}>{event.emoji}</Text></View>
                <View style={styles.copy}>
                  <View style={styles.eventTitleRow}><Text style={styles.eventTitle}>{event.name[locale]}</Text><Text style={styles.pastPill}>{t("PAST", "سابقة")}</Text></View>
                  <Text style={styles.eventDate}>{date} • {islamicDateLabelForEvent(event, locale)}</Text>
                  <Text style={styles.eventDescription}>{event.description[locale]}</Text>
                  {event.note ? <Text style={styles.eventNote}>ⓘ {event.note[locale]}</Text> : null}
                </View>
              </View>
            );
          })}</View>
        </>
      ) : null}

      <View style={styles.notice}><BrandMark size={36} /><Text style={styles.noticeText}>{t("Hijri dates are estimates for reliable on-device display. Ramadan, Eid and other dates can shift by a day based on local moon sighting and religious authority announcements.", "التواريخ الهجرية تقديرية للعرض على الجهاز. قد تتغير بداية رمضان والعيد وبعض المناسبات يوماً بحسب رؤية الهلال وإعلانات الجهات الإسلامية المحلية.")}</Text></View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: "#f7f4ec" },
  screen: { paddingHorizontal: 18, paddingTop: 14, paddingBottom: 42 },
  header: { flexDirection: "row", alignItems: "center", gap: 10 },
  back: { width: 42, height: 42, borderRadius: 14, backgroundColor: "#fff", borderWidth: 1, borderColor: "#ddd9d0", alignItems: "center", justifyContent: "center" },
  backText: { color: "#0b654f", fontSize: 30, lineHeight: 32 },
  copy: { flex: 1, minWidth: 0 },
  eyebrow: { color: "#a17c36", fontSize: 9, fontWeight: "900", letterSpacing: 1.1 },
  title: { color: "#173f35", fontSize: 24, fontWeight: "900", marginTop: 2 },
  subtitle: { color: "#70807a", fontSize: 12, lineHeight: 18, marginTop: 10, marginBottom: 14 },
  nextHero: { borderRadius: 25, backgroundColor: "#075a46", borderWidth: 1, borderColor: "#2a7b65", padding: 17 },
  nextHeroTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 },
  nextGlow: { width: 58, height: 58, borderRadius: 19, backgroundColor: "rgba(255,255,255,.11)", alignItems: "center", justifyContent: "center" },
  nextEmoji: { fontSize: 30 },
  nextLabel: { color: "#e5c66e", fontSize: 9, fontWeight: "900", letterSpacing: 1.2 },
  nextTitle: { color: "#fff", fontSize: 24, lineHeight: 29, fontWeight: "900", marginTop: 5 },
  nextHijri: { color: "#d2e3dc", fontSize: 11, marginTop: 4 },
  nextDescription: { color: "#c7dbd4", fontSize: 12, lineHeight: 18, marginTop: 8 },
  counter: { minWidth: 104, minHeight: 58, borderRadius: 18, backgroundColor: "#f1d888", alignItems: "center", justifyContent: "center", paddingHorizontal: 10, paddingVertical: 8 },
  counterNumber: { color: "#17483c", fontSize: 14, lineHeight: 18, fontWeight: "900", textAlign: "center" },
  counterLabel: { color: "#587066", fontSize: 9, fontWeight: "900", marginTop: 2 },
  twoCol: { flexDirection: "row", gap: 9, marginTop: 11 },
  miniCard: { flex: 1, minHeight: 124, borderRadius: 20, backgroundColor: "#fff", borderWidth: 1, borderColor: "#e0ddd4", padding: 12 },
  miniTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 6 },
  miniLabel: { flex: 1, color: "#9a7b3f", fontSize: 8.5, fontWeight: "900", letterSpacing: .7, textAlign: "right" },
  miniEmoji: { fontSize: 23 },
  miniTitle: { color: "#173f35", fontSize: 13, lineHeight: 17, fontWeight: "900", marginTop: 9 },
  miniDate: { color: "#7e8b86", fontSize: 10, marginTop: 5 },
  sectionHead: { marginTop: 22, marginBottom: 10, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  sectionTitle: { flex: 1, color: "#173f35", fontSize: 18, fontWeight: "900" },
  sectionMeta: { color: "#897c61", fontSize: 10, fontWeight: "800" },
  list: { gap: 9 },
  eventRow: { borderRadius: 20, backgroundColor: "#fff", borderWidth: 1, borderColor: "#e2ded5", padding: 13, flexDirection: "row", gap: 11 },
  eventRowNext: { borderColor: "#d7ba66", backgroundColor: "#fffaf0" },
  eventRowPast: { opacity: .72 },
  eventIcon: { width: 45, height: 45, borderRadius: 15, backgroundColor: "#edf4f0", alignItems: "center", justifyContent: "center" },
  eventIconNext: { backgroundColor: "#f5e6b6" },
  eventEmoji: { fontSize: 22 },
  eventTitleRow: { flexDirection: "row", alignItems: "center", gap: 7, flexWrap: "wrap" },
  eventTitle: { color: "#173f35", fontSize: 14, lineHeight: 18, fontWeight: "900", flexShrink: 1 },
  nextPill: { color: "#fff", backgroundColor: "#0b654f", borderRadius: 99, overflow: "hidden", paddingHorizontal: 8, paddingVertical: 3, fontSize: 8, fontWeight: "900" },
  pastPill: { color: "#725f3d", backgroundColor: "#eee7d8", borderRadius: 99, overflow: "hidden", paddingHorizontal: 8, paddingVertical: 3, fontSize: 8, fontWeight: "900" },
  eventDate: { color: "#9a7b3f", fontSize: 10, fontWeight: "800", marginTop: 4 },
  eventDescription: { color: "#6f7f79", fontSize: 11, lineHeight: 16, marginTop: 5 },
  eventNote: { color: "#837865", fontSize: 10, lineHeight: 15, marginTop: 6 },
  notice: { marginTop: 15, borderRadius: 19, backgroundColor: "#e8f3ee", padding: 14, flexDirection: "row", gap: 10, alignItems: "center" },
  noticeText: { flex: 1, color: "#587168", fontSize: 10.5, lineHeight: 16 }
});
