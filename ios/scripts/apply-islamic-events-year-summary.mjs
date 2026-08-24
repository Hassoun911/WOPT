import fs from 'node:fs';

const path = 'src/IslamicEventsPage.tsx';
let s = fs.readFileSync(path, 'utf8');

function replaceOnce(label, from, to) {
  if (s.includes(to)) return;
  if (!s.includes(from)) throw new Error(label + ' anchor not found');
  s = s.replace(from, to);
}

replaceOnce(
  'event summary variables',
  '  const days = next ? daysBetweenDateKeys(todayKey, next.dateKey) : 0;\n',
  '  const days = next ? daysBetweenDateKeys(todayKey, next.dateKey) : 0;\n  const remainingThisHijriYear = upcomingEvents.length;\n  const nextIsNextHijriYear = Boolean(next && next.hijriYear > currentHijriYear);\n'
);

replaceOnce(
  'year summary card',
  '      <Text style={styles.subtitle}>{t("Important Islamic dates, what is coming next, and the full year in one calm view.", "المناسبات الإسلامية المهمة وما هو قادم وجميع مناسبات السنة في عرض واضح وهادئ.")}</Text>\n\n      {next ? (',
  '      <Text style={styles.subtitle}>{t("Important Islamic dates, what is coming next, and the full year in one calm view.", "المناسبات الإسلامية المهمة وما هو قادم وجميع مناسبات السنة في عرض واضح وهادئ.")}</Text>\n\n      <View style={styles.yearSummary}>\n        <View style={styles.yearSummaryCount}><Text style={styles.yearSummaryNumber}>{remainingThisHijriYear}</Text></View>\n        <View style={styles.yearSummaryCopy}>\n          <Text style={styles.yearSummaryLabel}>{t("ISLAMIC YEAR SUMMARY", "ملخص السنة الهجرية")}</Text>\n          <Text style={styles.yearSummaryTitle}>{remainingThisHijriYear === 1 ? t("1 Islamic event left this Hijri year", "تبقت مناسبة إسلامية واحدة هذا العام الهجري") : t(`${remainingThisHijriYear} Islamic events left this Hijri year`, `تبقت ${new Intl.NumberFormat("ar").format(remainingThisHijriYear)} مناسبات إسلامية هذا العام الهجري`)}</Text>\n          <Text style={styles.yearSummaryYear}>{t(`${currentHijriYear} AH`, `${new Intl.NumberFormat("ar").format(currentHijriYear)} هـ`)}</Text>\n        </View>\n      </View>\n\n      {next ? ('
);

replaceOnce(
  'next year badge',
  '          <Text style={styles.nextLabel}>{t("NEXT ISLAMIC EVENT", "المناسبة الإسلامية القادمة")}</Text>\n          <Text style={styles.nextTitle}>{next.name[locale]}</Text>',
  '          <View style={styles.nextLabelRow}>\n            <Text style={styles.nextLabel}>{t("NEXT ISLAMIC EVENT", "المناسبة الإسلامية القادمة")}</Text>\n            {nextIsNextHijriYear ? <Text style={styles.nextYearPill}>{t(`NEXT YEAR • ${next.hijriYear} AH`, `السنة القادمة • ${new Intl.NumberFormat("ar").format(next.hijriYear)} هـ`)}</Text> : null}\n          </View>\n          <Text style={styles.nextTitle}>{next.name[locale]}</Text>'
);

replaceOnce(
  'styles',
  '  subtitle: { color: "#70807a", fontSize: 12, lineHeight: 18, marginTop: 10, marginBottom: 14 },\n  nextHero:',
  '  subtitle: { color: "#70807a", fontSize: 12, lineHeight: 18, marginTop: 10, marginBottom: 14 },\n  yearSummary: { borderRadius: 21, backgroundColor: "#fffaf0", borderWidth: 1, borderColor: "#dfc987", padding: 13, flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 11 },\n  yearSummaryCount: { width: 62, height: 62, borderRadius: 20, backgroundColor: "#0b654f", alignItems: "center", justifyContent: "center" },\n  yearSummaryNumber: { color: "#fff", fontSize: 28, fontWeight: "900", fontVariant: ["tabular-nums"] },\n  yearSummaryCopy: { flex: 1, minWidth: 0 },\n  yearSummaryLabel: { color: "#a17c36", fontSize: 8.5, fontWeight: "900", letterSpacing: 1 },\n  yearSummaryTitle: { color: "#173f35", fontSize: 15, lineHeight: 20, fontWeight: "900", marginTop: 3 },\n  yearSummaryYear: { color: "#70807a", fontSize: 10, fontWeight: "800", marginTop: 3 },\n  nextHero:'
);

replaceOnce(
  'next label styles',
  '  nextLabel: { color: "#e5c66e", fontSize: 9, fontWeight: "900", letterSpacing: 1.2 },\n  nextTitle:',
  '  nextLabelRow: { flexDirection: "row", alignItems: "center", gap: 7, flexWrap: "wrap" },\n  nextLabel: { color: "#e5c66e", fontSize: 9, fontWeight: "900", letterSpacing: 1.2 },\n  nextYearPill: { color: "#7b2e22", backgroundColor: "#ffe0d9", borderRadius: 99, overflow: "hidden", paddingHorizontal: 9, paddingVertical: 4, fontSize: 8, fontWeight: "900" },\n  nextTitle:'
);

fs.writeFileSync(path, s);
console.log('Applied Islamic events year summary and next-year event badge');
