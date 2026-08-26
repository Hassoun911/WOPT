import fs from 'node:fs';

const appPath = 'App.tsx';
let app = fs.readFileSync(appPath, 'utf8');

function replaceOnce(from, to, label) {
  if (!app.includes(from)) throw new Error(`Missing expected source for ${label}`);
  app = app.replace(from, to);
}

replaceOnce(
  'import { loadPrayerTimes } from "./src/prayerData";',
  'import { loadPrayerTimes, type PrayerLocation } from "./src/prayerData";',
  'prayer data import'
);

replaceOnce(
`function nextPrayerFor(prayerTimes: PrayerTimes, now = new Date()) {
  const currentKey = windsorDateKey(now);`,
`function nextPrayerFor(prayerTimes: PrayerTimes, now = new Date(), timeZone = WINDSOR_TIME_ZONE) {
  const currentKey = windsorDateKey(now, timeZone);`,
  'next prayer timezone'
);
replaceOnce(
  '      const target = windsorLocalToDate(dateKey, day[prayer]);',
  '      const target = windsorLocalToDate(dateKey, day[prayer], timeZone);',
  'next prayer target timezone'
);
replaceOnce(
`function hijriDateLabel(date: Date, locale: "en" | "ar") {
  try {
    return new Intl.DateTimeFormat(locale === "ar" ? "ar-u-ca-islamic-umalqura" : "en-u-ca-islamic-umalqura", {
      day: "numeric", month: "long", year: "numeric", timeZone: WINDSOR_TIME_ZONE`,
`function hijriDateLabel(date: Date, locale: "en" | "ar", timeZone = WINDSOR_TIME_ZONE) {
  try {
    return new Intl.DateTimeFormat(locale === "ar" ? "ar-u-ca-islamic-umalqura" : "en-u-ca-islamic-umalqura", {
      day: "numeric", month: "long", year: "numeric", timeZone`,
  'Hijri timezone'
);

replaceOnce(
  '  const [live, setLive] = useState(false);',
`  const [live, setLive] = useState(false);
  const [prayerLocation, setPrayerLocation] = useState<PrayerLocation>({
    latitude: 42.3149,
    longitude: -83.0364,
    timezone: WINDSOR_TIME_ZONE,
    label: CITY_LABEL,
    source: "saved"
  });`,
  'location state'
);

replaceOnce(
`  const todayKey = windsorDateKey(now);
  const today = prayerTimes[todayKey];
  const next = useMemo(() => nextPrayerFor(prayerTimes, now), [now, prayerTimes]);`,
`  const activeTimeZone = prayerLocation.timezone || WINDSOR_TIME_ZONE;
  const activeLocationLabel = prayerLocation.label || CITY_LABEL;
  const todayKey = windsorDateKey(now, activeTimeZone);
  const today = prayerTimes[todayKey];
  const next = useMemo(() => nextPrayerFor(prayerTimes, now, activeTimeZone), [now, prayerTimes, activeTimeZone]);`,
  'location-aware current day'
);

replaceOnce(
`      setPrayerTimes(loaded.prayerTimes);
      setLive(loaded.live);`,
`      setPrayerTimes(loaded.prayerTimes);
      setPrayerLocation(loaded.location);
      setLive(loaded.live);`,
  'startup location state'
);

replaceOnce(
`        const result = await schedulePrayerNotifications(loaded.prayerTimes, chosenLocale, savedPhoneAlertPreferences);
        setScheduledCount(result.count);
        await scheduleIslamicEventReminders(windsorDateKey(new Date()), chosenLocale).catch(() => undefined);`,
`        const result = await schedulePrayerNotifications(loaded.prayerTimes, chosenLocale, savedPhoneAlertPreferences, {
          timeZone: loaded.location.timezone,
          locationLabel: loaded.location.label
        });
        setScheduledCount(result.count);
        await scheduleIslamicEventReminders(windsorDateKey(new Date(), loaded.location.timezone), chosenLocale, loaded.location.timezone).catch(() => undefined);`,
  'startup notification location'
);

const oldForeground = `  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active") return;
      setNow(new Date());
      void loadQuizStats().then(setQuizStats).catch(() => undefined);
      if (!alertsEnabled || !Object.keys(prayerTimes).length) return;
      void schedulePrayerNotifications(prayerTimes, locale, phoneAlertPreferences)
        .then((result) => setScheduledCount(result.count))
        .catch(() => undefined);
      void scheduleIslamicEventReminders(windsorDateKey(new Date()), locale).catch(() => undefined);
    });
    return () => subscription.remove();
  }, [alertsEnabled, locale, prayerTimes, phoneAlertPreferences]);`;
const newForeground = `  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active") return;
      setNow(new Date());
      void loadQuizStats().then(setQuizStats).catch(() => undefined);
      void (async () => {
        const refreshed = await loadPrayerTimes();
        setPrayerTimes(refreshed.prayerTimes);
        setPrayerLocation(refreshed.location);
        setLive(refreshed.live);
        if (!alertsEnabled || !Object.keys(refreshed.prayerTimes).length) return;
        const result = await schedulePrayerNotifications(refreshed.prayerTimes, locale, phoneAlertPreferences, {
          timeZone: refreshed.location.timezone,
          locationLabel: refreshed.location.label
        });
        setScheduledCount(result.count);
        await scheduleIslamicEventReminders(
          windsorDateKey(new Date(), refreshed.location.timezone),
          locale,
          refreshed.location.timezone
        ).catch(() => undefined);
      })().catch(() => undefined);
    });
    return () => subscription.remove();
  }, [alertsEnabled, locale, phoneAlertPreferences]);`;
replaceOnce(oldForeground, newForeground, 'foreground location refresh');

replaceOnce(
  '      const result = await schedulePrayerNotifications(prayerTimes, nextLocale, phoneAlertPreferences);',
`      const result = await schedulePrayerNotifications(prayerTimes, nextLocale, phoneAlertPreferences, {
        timeZone: activeTimeZone,
        locationLabel: activeLocationLabel
      });`,
  'locale notification context'
);
replaceOnce(
  '      await scheduleIslamicEventReminders(todayKey, nextLocale).catch(() => undefined);',
  '      await scheduleIslamicEventReminders(todayKey, nextLocale, activeTimeZone).catch(() => undefined);',
  'locale event timezone'
);

replaceOnce(
  '      const result = await schedulePrayerNotifications(prayerTimes, locale, preferences);',
`      const result = await schedulePrayerNotifications(prayerTimes, locale, preferences, {
        timeZone: activeTimeZone,
        locationLabel: activeLocationLabel
      });`,
  'toggle alerts location context'
);
replaceOnce(
  '      await scheduleIslamicEventReminders(todayKey, locale).catch(() => undefined);',
  '      await scheduleIslamicEventReminders(todayKey, locale, activeTimeZone).catch(() => undefined);',
  'toggle alerts event timezone'
);

replaceOnce(
  '      const result = await schedulePrayerNotifications(prayerTimes, locale, nextPreferences);',
`      const result = await schedulePrayerNotifications(prayerTimes, locale, nextPreferences, {
        timeZone: activeTimeZone,
        locationLabel: activeLocationLabel
      });`,
  'preference notification context'
);

replaceOnce(
  'Loading Windsor prayer times…',
  'Loading local prayer times…',
  'loading text'
);
replaceOnce(
  '  const date = windsorLocalToDate(todayKey, "12:00");',
  '  const date = windsorLocalToDate(todayKey, "12:00", activeTimeZone);',
  'display date timezone'
);
replaceOnce(
  '  const hijriDate = hijriDateLabel(date, locale);',
  '  const hijriDate = hijriDateLabel(date, locale, activeTimeZone);',
  'display Hijri timezone'
);
replaceOnce(
  '<View style={styles.brandText}><Text style={styles.title}>Hassoun</Text><Text style={styles.subtitle}>{locale === "ar" ? "📍 وندسور، أونتاريو • مواقيت الصلاة" : "📍 Windsor, Ontario • Prayer Times"}</Text></View>',
  '<View style={styles.brandText}><Text style={styles.title}>Hassoun</Text><Text style={styles.subtitle}>📍 {activeLocationLabel} • {locale === "ar" ? "مواقيت الصلاة" : "Prayer Times"}</Text></View>',
  'header location label'
);
replaceOnce(
  '<Text style={styles.footer}>Official Windsor Islamic Association schedule • America/Toronto</Text>',
  '<Text style={styles.footer}>{prayerLocation.source === "windsor_islamic_association" ? "Official Windsor Islamic Association schedule" : "Local prayer times by current device location"} • {activeTimeZone}</Text>',
  'footer source'
);

fs.writeFileSync(appPath, app);

const configPath = 'app.config.ts';
let config = fs.readFileSync(configPath, 'utf8');
config = config.replace('version: "1.0.8"', 'version: "1.0.10"');
config = config.replace('versionCode: 49', 'versionCode: 51');
fs.writeFileSync(configPath, config);

console.log('Applied Hassoun v1.0.10 location-aware travel fix');
