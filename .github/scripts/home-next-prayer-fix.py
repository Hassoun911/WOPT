from pathlib import Path


def replace_once(path: str, old: str, new: str, label: str) -> None:
    p = Path(path)
    text = p.read_text(encoding="utf-8")
    if old not in text:
        raise SystemExit(f"Missing patch target: {label} in {path}")
    p.write_text(text.replace(old, new, 1), encoding="utf-8")


app = "mobile/App.tsx"
config = "mobile/app.config.ts"

replace_once(
    app,
    'import { CITY_LABEL, STORAGE_KEYS } from "./src/config";\n',
    'import { CITY_LABEL, STORAGE_KEYS, WINDSOR_TIME_ZONE } from "./src/config";\n',
    "Windsor timezone import",
)
replace_once(
    app,
    'import { formatPrayerTime, timeToMinutes, windsorDateKey, windsorSecondsSinceMidnight } from "./src/time";\n',
    'import { addDateDays, formatPrayerTime, timeToMinutes, windsorDateKey, windsorLocalToDate, windsorSecondsSinceMidnight } from "./src/time";\n',
    "time helpers import",
)

replace_once(
    app,
    '''function nextPrayerFor(day: PrayerTimes[string] | undefined, now = new Date()) {
  if (!day) return null;
  const currentSeconds = windsorSecondsSinceMidnight(now);
  for (const prayer of PRAYER_KEYS) {
    const seconds = timeToMinutes(day[prayer]) * 60;
    if (seconds > currentSeconds) return { prayer, secondsRemaining: seconds - currentSeconds };
  }
  return null;
}
''',
    '''function nextPrayerFor(prayerTimes: PrayerTimes, now = new Date()) {
  const currentKey = windsorDateKey(now);
  const currentSeconds = windsorSecondsSinceMidnight(now);

  // Keep looking beyond Isha so the home screen rolls naturally into tomorrow's Fajr.
  for (let dayOffset = 0; dayOffset <= 7; dayOffset += 1) {
    const dateKey = addDateDays(currentKey, dayOffset);
    const day = prayerTimes[dateKey];
    if (!day) continue;

    for (const prayer of PRAYER_KEYS) {
      const seconds = timeToMinutes(day[prayer]) * 60;
      if (dayOffset === 0 && seconds <= currentSeconds) continue;

      const target = windsorLocalToDate(dateKey, day[prayer]);
      const secondsRemaining = Math.max(0, Math.floor((target.getTime() - now.getTime()) / 1000));
      if (target.getTime() <= now.getTime()) continue;

      return {
        prayer,
        dateKey,
        time: day[prayer],
        secondsRemaining,
        isTomorrow: dateKey !== currentKey
      };
    }
  }
  return null;
}
''',
    "cross-midnight next prayer",
)

replace_once(
    app,
    '''function hijriDateLabel(date: Date, locale: "en" | "ar") {
  try {
    return new Intl.DateTimeFormat(locale === "ar" ? "ar-u-ca-islamic" : "en-u-ca-islamic", {
      day: "numeric",
      month: "long",
      year: "numeric"
    }).format(date);
  } catch {
    return "";
  }
}
''',
    '''function hijriDateLabel(date: Date, locale: "en" | "ar") {
  try {
    return new Intl.DateTimeFormat(locale === "ar" ? "ar-u-ca-islamic-umalqura" : "en-u-ca-islamic-umalqura", {
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: WINDSOR_TIME_ZONE
    }).format(date);
  } catch {
    return "";
  }
}
''',
    "Umm al-Qura Hijri date",
)

replace_once(
    app,
    '  const next = useMemo(() => nextPrayerFor(today, now), [now, today]);\n',
    '  const next = useMemo(() => nextPrayerFor(prayerTimes, now), [now, prayerTimes]);\n',
    "next prayer memo",
)

replace_once(
    app,
    '  const date = new Date(`${todayKey}T12:00:00`);\n',
    '  const date = windsorLocalToDate(todayKey, "12:00");\n',
    "Windsor calendar date",
)

replace_once(
    app,
    '<Text style={styles.nextEyebrow}>{locale === "ar" ? "الصلاة القادمة" : "NEXT PRAYER"}</Text>',
    '<Text style={styles.nextEyebrow}>{locale === "ar" ? `الصلاة القادمة${next.isTomorrow ? " • غداً" : ""}` : `NEXT PRAYER${next.isTomorrow ? " • TOMORROW" : ""}`}</Text>',
    "next prayer tomorrow label",
)
replace_once(
    app,
    '<Text style={styles.nextTime}>{formatPrayerTime(today[next.prayer], locale)}</Text>',
    '<Text style={styles.nextTime}>{formatPrayerTime(next.time, locale)}</Text>',
    "next prayer correct day time",
)

replace_once(
    app,
    '''                  <View style={styles.prayerNameBlock}>
                    <Text style={[styles.prayerName, active && styles.prayerActiveText]}>{NAMES[prayer][locale]}</Text>
                    <Text style={[styles.prayerOtherName, active && styles.prayerActiveMuted]}>{NAMES[prayer][locale === "en" ? "ar" : "en"]}</Text>
                  </View>
                  <Text style={[styles.prayerTime, active && styles.prayerActiveText]}>{formatPrayerTime(today[prayer], locale)}</Text>
''',
    '''                  <View style={styles.prayerNameBlock}>
                    <Text style={[styles.prayerName, active && styles.prayerActiveText]}>{NAMES[prayer][locale]}</Text>
                    <View style={styles.prayerSubRow}>
                      <Text style={[styles.prayerOtherName, active && styles.prayerActiveMuted]}>{NAMES[prayer][locale === "en" ? "ar" : "en"]}</Text>
                      {active && next?.isTomorrow ? <Text style={styles.tomorrowTag}>{locale === "ar" ? "غداً" : "Tomorrow"}</Text> : null}
                    </View>
                  </View>
                  <Text style={[styles.prayerTime, active && styles.prayerActiveText]}>{formatPrayerTime(active && next?.isTomorrow ? next.time : today[prayer], locale)}</Text>
''',
    "next prayer row tomorrow state",
)

replace_once(
    app,
    '  prayerRowActive: { backgroundColor: "#edf7f2" },\n',
    '  prayerRowActive: { backgroundColor: "#dff2e9", borderLeftWidth: 4, borderLeftColor: "#0b654f" },\n',
    "strong green next prayer highlight",
)
replace_once(
    app,
    '  prayerNameBlock: { flex: 1 },\n',
    '  prayerNameBlock: { flex: 1 },\n  prayerSubRow: { flexDirection: "row", alignItems: "center", gap: 6 },\n  tomorrowTag: { color: "#0b654f", backgroundColor: "#cce8dc", borderRadius: 99, paddingHorizontal: 6, paddingVertical: 2, fontSize: 7, fontWeight: "900", overflow: "hidden" },\n',
    "tomorrow tag styles",
)

replace_once(config, 'version: "0.4.4",', 'version: "0.4.5",', "app version")
replace_once(config, 'versionCode: 16,', 'versionCode: 17,', "Android versionCode")

print("Home next-prayer and Hijri fixes applied")
