import AsyncStorage from "@react-native-async-storage/async-storage";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  AppState,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import QuizGamesHub from "./src/QuizGamesHub";
import IslamicEventsPage from "./src/IslamicEventsPage";
import { islamicEventCountdown, islamicEventTimeline } from "./src/islamicEvents";
import SettingsHub from "./src/SettingsHub";
import ScrollingTicker from "./src/ScrollingTicker";
import HassounWidget from "./modules/hassoun-widget";
import QuranAudio, { type QuranAudioStatus } from "./modules/quran-audio";
import { CITY_LABEL, STORAGE_KEYS, WINDSOR_TIME_ZONE } from "./src/config";
import {
  DEFAULT_PHONE_PRAYER_ALERTS,
  anyPrayerAlertEnabled,
  applyPrayerAlertPreset,
  loadPhonePrayerAlertPreferences,
  savePhonePrayerAlertPreferences,
  summarizePrayerAlertPreferences,
  type PrayerAlertPreferences
} from "./src/alertPreferences";
import { badgeForWins, EMPTY_QUIZ_STATS, loadQuizStats, nextBadge, type QuizStats } from "./src/islamicQuiz";
import { reportHassounActivity } from "./src/activity";
import { disableIslamicEventReminders, disablePrayerNotifications, scheduleIslamicEventReminders, schedulePrayerNotifications, scheduleTestReminder } from "./src/notifications";
import { openExactAlarmSettings, scheduleAndroidTestAdhan } from "./src/prayerAudio";
import { loadInitialPrayerTimes, loadPrayerTimes, type PrayerLocation } from "./src/prayerData";
import PrayerAlertPreferenceGrid from "./src/PrayerAlertPreferenceGrid";
import { registerDeviceForServerPush } from "./src/push";
import Quran from "./src/quran/Quran";
import { addDateDays, formatPrayerTime, windsorDateKey, windsorLocalToDate } from "./src/time";
import { PRAYER_KEYS, type PrayerKey, type PrayerTimes } from "./src/types";

type AppTab = "home" | "quran" | "quiz" | "alerts" | "events" | "more";

const ISLAMIC_EVENT_ALERTS_KEY = "hassoun:islamic-event-reminders:enabled:v1";

type AppProps = {
  onOpenEmailAlerts?: () => void;
};

const NAMES: Record<PrayerKey, { en: string; ar: string }> = {
  fajr: { en: "Fajr", ar: "الفجر" },
  dhuhr: { en: "Dhuhr", ar: "الظهر" },
  asr: { en: "Asr", ar: "العصر" },
  maghrib: { en: "Maghrib", ar: "المغرب" },
  isha: { en: "Isha", ar: "العشاء" }
};

const PRAYER_ICONS: Record<PrayerKey, string> = {
  fajr: "🌅",
  dhuhr: "☀️",
  asr: "🌤️",
  maghrib: "🌇",
  isha: "🌙"
};

function nextPrayerFor(prayerTimes: PrayerTimes, now = new Date(), timeZone = WINDSOR_TIME_ZONE) {
  const currentKey = windsorDateKey(now, timeZone);
  for (let dayOffset = 0; dayOffset <= 7; dayOffset += 1) {
    const dateKey = addDateDays(currentKey, dayOffset);
    const day = prayerTimes[dateKey];
    if (!day) continue;
    for (const prayer of PRAYER_KEYS) {
      const target = windsorLocalToDate(dateKey, day[prayer], timeZone);
      const deltaMs = target.getTime() - now.getTime();
      if (deltaMs <= 0) continue;
      const secondsRemaining = Math.max(1, Math.ceil(deltaMs / 1000));
      return { prayer, dateKey, time: day[prayer], secondsRemaining, isTomorrow: dateKey !== currentKey };
    }
  }
  return null;
}

function countdownLabel(seconds: number, locale: "en" | "ar") {
  if (seconds < 60) return locale === "ar" ? `${Math.max(1, seconds)} ث` : `${Math.max(1, seconds)}s`;
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return locale === "ar" ? `${hours ? `${hours} س ` : ""}${minutes} د` : `${hours ? `${hours}h ` : ""}${minutes}m`;
}

function hijriDateLabel(date: Date, locale: "en" | "ar", timeZone = WINDSOR_TIME_ZONE) {
  try {
    return new Intl.DateTimeFormat(locale === "ar" ? "ar-u-ca-islamic-umalqura" : "en-u-ca-islamic-umalqura", {
      day: "numeric", month: "long", year: "numeric", timeZone
    }).format(date);
  } catch { return ""; }
}

export default function App({ onOpenEmailAlerts }: AppProps) {
  const [now, setNow] = useState(new Date());
  const [prayerTimes, setPrayerTimes] = useState<PrayerTimes>({});
  const [prayerLocation, setPrayerLocation] = useState<PrayerLocation | null>(null);
  const [live, setLive] = useState(false);
  const [locale, setLocale] = useState<"en" | "ar">("en");
  const [alertsEnabled, setAlertsEnabled] = useState(false);
  const [busy, setBusy] = useState(true);
  const [scheduledCount, setScheduledCount] = useState(0);
  const [activeTab, setActiveTab] = useState<AppTab>("home");
  const [quranAppNavVisible, setQuranAppNavVisible] = useState(true);
  const [quranOwnsAudioSurface, setQuranOwnsAudioSurface] = useState(false);
  const [globalQuranAudio, setGlobalQuranAudio] = useState<QuranAudioStatus>({ available: Boolean(QuranAudio), state: "idle", positionMs: 0, durationMs: 0, speed: 1 });
  const [quizStats, setQuizStats] = useState<QuizStats>(EMPTY_QUIZ_STATS);
  const [phoneAlertPreferences, setPhoneAlertPreferences] = useState<PrayerAlertPreferences>(DEFAULT_PHONE_PRAYER_ALERTS);
  const [alertPreferencesBusy, setAlertPreferencesBusy] = useState(false);
  const [islamicEventAlertsEnabled, setIslamicEventAlertsEnabled] = useState(true);
  const [islamicEventAlertsBusy, setIslamicEventAlertsBusy] = useState(false);

  const prayerTimeZone = prayerLocation?.timezone || WINDSOR_TIME_ZONE;
  const prayerLocationLabel = prayerLocation?.label || CITY_LABEL;
  const todayKey = windsorDateKey(now, prayerTimeZone);
  const today = prayerTimes[todayKey];
  const next = useMemo(() => nextPrayerFor(prayerTimes, now, prayerTimeZone), [now, prayerTimes, prayerTimeZone]);
  const badge = badgeForWins(quizStats.totalWins);
  const upcomingBadge = nextBadge(quizStats.totalWins);
  const islamicTimeline = useMemo(() => islamicEventTimeline(todayKey), [todayKey]);
  const upcomingIslamicEvent = islamicTimeline.next;
  const upcomingIslamicDays = islamicTimeline.daysUntilNext;

  useEffect(() => {
    void reportHassounActivity("app_open");
  }, []);

  useEffect(() => {
    const tracked = activeTab === "quiz" ? "games" : activeTab;
    void reportHassounActivity(tracked);
  }, [activeTab]);

  useEffect(() => {
    if (Object.keys(prayerTimes).length) HassounWidget.syncPrayerSchedule(JSON.stringify(prayerTimes), locale);
  }, [prayerTimes, locale]);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1_000);
    void (async () => {
      const [savedLocale, savedAlerts, savedEventAlerts, savedPhoneAlertPreferences, initial, storedQuizStats] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.locale),
        AsyncStorage.getItem(STORAGE_KEYS.alertsEnabled),
        AsyncStorage.getItem(ISLAMIC_EVENT_ALERTS_KEY),
        loadPhonePrayerAlertPreferences(),
        loadInitialPrayerTimes(),
        loadQuizStats()
      ]);
      const chosenLocale = savedLocale === "ar" ? "ar" : "en";
      setLocale(chosenLocale);
      setAlertsEnabled(savedAlerts === "on");
      const eventAlertsEnabled = savedEventAlerts !== "off";
      setIslamicEventAlertsEnabled(eventAlertsEnabled);
      setPrayerTimes(initial.prayerTimes);
      setPrayerLocation(initial.location);
      setLive(false);
      setQuizStats(storedQuizStats);
      setPhoneAlertPreferences(savedPhoneAlertPreferences);
      setBusy(false);

      // Refresh GPS/network after the cached UI is already visible.
      void loadPrayerTimes().then(async (fresh) => {
        setPrayerTimes(fresh.prayerTimes);
        setPrayerLocation(fresh.location);
        setLive(fresh.live);
        if (savedAlerts === "on") {
          const result = await schedulePrayerNotifications(fresh.prayerTimes, chosenLocale, savedPhoneAlertPreferences, { timeZone: fresh.location.timezone, locationLabel: fresh.location.label });
          setScheduledCount(result.count);
          if (eventAlertsEnabled) await scheduleIslamicEventReminders(windsorDateKey(new Date(), fresh.location.timezone), chosenLocale, fresh.location.timezone).catch(() => undefined);
          void registerDeviceForServerPush(chosenLocale).catch(() => undefined);
        }
      }).catch(() => undefined);
    })();
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const sync = () => { if (QuranAudio) setGlobalQuranAudio(QuranAudio.getStatus()); };
    sync();
    const timer = setInterval(sync, 700);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active") return;
      setNow(new Date());
      void loadQuizStats().then(setQuizStats).catch(() => undefined);
      if (!alertsEnabled || !Object.keys(prayerTimes).length) return;
      void schedulePrayerNotifications(prayerTimes, locale, phoneAlertPreferences, { timeZone: prayerTimeZone, locationLabel: prayerLocationLabel })
        .then((result) => setScheduledCount(result.count))
        .catch(() => undefined);
      if (islamicEventAlertsEnabled) void scheduleIslamicEventReminders(windsorDateKey(new Date(), prayerTimeZone), locale, prayerTimeZone).catch(() => undefined);
    });
    return () => subscription.remove();
  }, [alertsEnabled, islamicEventAlertsEnabled, locale, prayerTimes, phoneAlertPreferences, prayerLocationLabel, prayerTimeZone]);

  const toggleLocale = async () => {
    const nextLocale = locale === "en" ? "ar" : "en";
    setLocale(nextLocale);
    await AsyncStorage.setItem(STORAGE_KEYS.locale, nextLocale);
    if (alertsEnabled) {
      const result = await schedulePrayerNotifications(prayerTimes, nextLocale, phoneAlertPreferences, { timeZone: prayerTimeZone, locationLabel: prayerLocationLabel });
      setScheduledCount(result.count);
      if (islamicEventAlertsEnabled) await scheduleIslamicEventReminders(todayKey, nextLocale, prayerTimeZone).catch(() => undefined);
    }
  };

  const toggleAlerts = async (enabled: boolean) => {
    setBusy(true);
    try {
      if (!enabled) {
        await disablePrayerNotifications();
        setAlertsEnabled(false);
        setScheduledCount(0);
        return;
      }
      let preferences = phoneAlertPreferences;
      if (!anyPrayerAlertEnabled(preferences)) {
        preferences = applyPrayerAlertPreset("all");
        setPhoneAlertPreferences(preferences);
        await savePhonePrayerAlertPreferences(preferences);
      }
      const result = await schedulePrayerNotifications(prayerTimes, locale, preferences, { timeZone: prayerTimeZone, locationLabel: prayerLocationLabel });
      if (!result.granted) {
        Alert.alert("Notifications are off", "Allow notifications in your phone settings to receive prayer alerts.");
        return;
      }
      if (islamicEventAlertsEnabled) await scheduleIslamicEventReminders(todayKey, locale, prayerTimeZone).catch(() => undefined);
      setAlertsEnabled(true);
      setScheduledCount(result.count);
      void registerDeviceForServerPush(locale).catch(() => undefined);
      if (!result.exactAlarmGranted && PRAYER_KEYS.some((prayer) => preferences[prayer].athan)) {
        Alert.alert("Allow exact prayer alarms", "Android needs Alarms & reminders access so the full Adhan can begin at the exact prayer time, even when the app is closed.", [
          { text: "Not now", style: "cancel" },
          { text: "Open settings", onPress: openExactAlarmSettings }
        ]);
      }
    } finally { setBusy(false); }
  };

  const updatePhoneAlertPreferences = async (nextPreferences: PrayerAlertPreferences) => {
    setPhoneAlertPreferences(nextPreferences);
    await savePhonePrayerAlertPreferences(nextPreferences);
    if (!alertsEnabled || !Object.keys(prayerTimes).length) return;
    setAlertPreferencesBusy(true);
    try {
      if (!anyPrayerAlertEnabled(nextPreferences)) {
        await disablePrayerNotifications();
        setAlertsEnabled(false);
        setScheduledCount(0);
        return;
      }
      const result = await schedulePrayerNotifications(prayerTimes, locale, nextPreferences, { timeZone: prayerTimeZone, locationLabel: prayerLocationLabel });
      setScheduledCount(result.count);
    } finally {
      setAlertPreferencesBusy(false);
    }
  };

  const toggleIslamicEventAlerts = async (enabled: boolean) => {
    setIslamicEventAlertsBusy(true);
    try {
      if (!enabled) {
        await disableIslamicEventReminders();
        await AsyncStorage.setItem(ISLAMIC_EVENT_ALERTS_KEY, "off");
        setIslamicEventAlertsEnabled(false);
        return;
      }
      const result = await scheduleIslamicEventReminders(todayKey, locale, prayerTimeZone);
      if (!result.granted) {
        Alert.alert("Notifications are off", "Allow notifications in your phone settings to receive Islamic event reminders.");
        return;
      }
      await AsyncStorage.setItem(ISLAMIC_EVENT_ALERTS_KEY, "on");
      setIslamicEventAlertsEnabled(true);
    } catch (error) {
      Alert.alert("Event reminder error", String(error));
    } finally {
      setIslamicEventAlertsBusy(false);
    }
  };

  const togglePrayerAudio = async (prayer: PrayerKey) => {
    const nextPreferences: PrayerAlertPreferences = {
      ...phoneAlertPreferences,
      [prayer]: { ...phoneAlertPreferences[prayer], athan: !phoneAlertPreferences[prayer].athan }
    };
    await updatePhoneAlertPreferences(nextPreferences);
  };

  const testNotification = async () => {
    try {
      const result = await scheduleTestReminder(15);
      if (!result.granted) { Alert.alert("Notifications are off", "Allow notifications for Hassoun in Android settings, then try again."); return; }
      Alert.alert("Test scheduled", "Lock the phone. A Hassoun notification with the reminder chime should arrive in about 15 seconds.");
    } catch (error) { Alert.alert("Notification test failed", String(error)); }
  };

  const testAdhan = async () => {
    try {
      const result = await scheduleAndroidTestAdhan("fajr", 30);
      if (!result.available) { Alert.alert("Native Adhan unavailable", "This build does not contain the native Android prayer-audio module."); return; }
      if (!result.exact) {
        Alert.alert("Allow Alarms & reminders", "Exact alarm access is off. Enable it, return to Hassoun, then run the Adhan test again.", [
          { text: "Cancel", style: "cancel" }, { text: "Open settings", onPress: openExactAlarmSettings }
        ]);
        return;
      }
      Alert.alert("Adhan test scheduled", "Lock the phone now. The Fajr Adhan should start by itself in about 30 seconds.");
    } catch (error) { Alert.alert("Adhan test failed", String(error)); }
  };

  if (busy && !today) {
    return <SafeAreaView style={styles.loading} edges={["top", "bottom", "left", "right"]}><ActivityIndicator color="#0b5b47" size="large" /><Text style={styles.loadingText}>Loading prayer times for your current location…</Text></SafeAreaView>;
  }

  const date = windsorLocalToDate(todayKey, "12:00", prayerTimeZone);
  const shortDate = new Intl.DateTimeFormat(locale === "ar" ? "ar-CA" : "en-CA", { weekday: "short", month: "short", day: "numeric", year: "numeric" }).format(date);
  const hijriDate = hijriDateLabel(date, locale, prayerTimeZone);

  const header = (
    <View style={styles.header}>
      <Pressable onPress={() => setActiveTab("more")} style={styles.menuButton}><Text style={styles.menuIcon}>☰</Text></Pressable>
      <Image source={require("./assets/hassoun-logo.png")} style={styles.headerLogo} />
      <View style={styles.brandText}><Text style={styles.title}>Hassoun</Text><Text style={styles.subtitle}>📍 {prayerLocationLabel} • {locale === "ar" ? "مواقيت الصلاة" : "Prayer Times"}</Text></View>
      <Pressable onPress={toggleLocale} style={styles.languageButton}><Text style={styles.languageText}>{locale === "en" ? "AR" : "EN"}</Text></Pressable>
    </View>
  );

  const homeScreen = (
    <ScrollView style={styles.flex} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      {header}
      <View style={styles.dateHero}><View style={styles.dateCopy}><Text style={styles.datePrimary}>{shortDate}</Text>{hijriDate ? <Text style={styles.dateHijri}>🌙 {hijriDate}</Text> : null}<View style={styles.syncRow}><View style={[styles.syncDot, !live && styles.syncDotSaved]} /><Text style={styles.syncText}>{live ? (locale === "ar" ? "متزامن عبر Hassoun" : "Synced by Hassoun") : (locale === "ar" ? "الجدول الرسمي محفوظ" : "Saved local schedule")}</Text></View></View><View style={styles.heroLogoShell}><Image source={require("./assets/hassoun-logo.png")} resizeMode="contain" style={styles.heroLogo} /></View></View>

      {upcomingIslamicEvent && upcomingIslamicDays !== null && upcomingIslamicDays <= 15 ? (
        <Pressable onPress={() => setActiveTab("events")} style={styles.eventCountdownCard}>
          <View style={styles.eventCountdownIcon}><Text style={styles.eventCountdownEmoji}>{upcomingIslamicEvent.emoji}</Text></View>
          <View style={styles.eventCountdownCopy}><Text style={styles.eventCountdownEyebrow}>{locale === "ar" ? "المناسبة الإسلامية القادمة" : "UPCOMING ISLAMIC EVENT"}</Text><Text style={styles.eventCountdownTitle}>{upcomingIslamicEvent.name[locale]}</Text><Text style={styles.eventCountdownText}>{locale === "ar" ? `متبقي ${islamicEventCountdown(upcomingIslamicDays, locale)}` : `${islamicEventCountdown(upcomingIslamicDays, locale)} remaining`} • {upcomingIslamicEvent.description[locale]}</Text></View>
          <Text style={styles.eventCountdownArrow}>›</Text>
        </Pressable>
      ) : null}

      {next ? <View style={styles.nextCard}><View style={styles.nextTopRow}><View><Text style={styles.nextEyebrow}>{locale === "ar" ? `الصلاة القادمة${next.isTomorrow ? " • غداً" : ""}` : `NEXT PRAYER${next.isTomorrow ? " • TOMORROW" : ""}`}</Text><Text style={styles.nextName}>{NAMES[next.prayer][locale]}</Text><Text style={styles.nextArabic}>{NAMES[next.prayer][locale === "en" ? "ar" : "en"]}</Text></View><View style={styles.nextIconBubble}><Text style={styles.nextIcon}>{PRAYER_ICONS[next.prayer]}</Text></View></View><View style={styles.nextBottomRow}><Text style={styles.nextTime}>{formatPrayerTime(next.time, locale)}</Text><View style={styles.countdownPill}><Text style={styles.countdownText}>⏳ {countdownLabel(next.secondsRemaining, locale)} {locale === "ar" ? "متبقي" : "left"}</Text></View></View><View style={styles.progressTrack}><View style={styles.progressFill} /></View></View> : null}

      <View style={styles.sectionHeadingRow}><View><Text style={styles.sectionTitle}>{locale === "ar" ? "جدول اليوم" : "Today’s Schedule"}</Text><Text style={styles.sectionHint}>{locale === "ar" ? "اضغط على أي صلاة لكتم أو تشغيل صوت الأذان" : "Tap any prayer to mute or unmute its Adhan audio"}</Text></View><Text style={styles.sectionMeta}>{locale === "ar" ? "٥ صلوات" : "5 prayers"}</Text></View>
      <View style={styles.prayerList}>{today ? PRAYER_KEYS.map((prayer) => { const active = next?.prayer === prayer; const muted = !phoneAlertPreferences[prayer].athan; return <Pressable accessibilityRole="button" accessibilityLabel={`${NAMES[prayer].en} ${muted ? "Adhan muted" : "Adhan on"}`} onPress={() => void togglePrayerAudio(prayer)} key={prayer} style={({ pressed }) => [styles.prayerRow, active && styles.prayerRowActive, muted && styles.prayerRowMuted, pressed && styles.prayerRowPressed]}><View style={[styles.prayerIconWrap, active && styles.prayerIconWrapActive]}><Text style={styles.prayerIcon}>{PRAYER_ICONS[prayer]}</Text></View><View style={styles.prayerNameBlock}><Text style={[styles.prayerName, active && styles.prayerActiveText]}>{NAMES[prayer][locale]}</Text><View style={styles.prayerSubRow}><Text style={[styles.prayerOtherName, active && styles.prayerActiveMuted]}>{NAMES[prayer][locale === "en" ? "ar" : "en"]}</Text>{active && next?.isTomorrow ? <Text style={styles.tomorrowTag}>{locale === "ar" ? "غداً" : "Tomorrow"}</Text> : null}</View></View><View style={styles.prayerRight}><View style={[styles.audioPill, muted && styles.audioPillMuted]}><Text style={[styles.audioPillText, muted && styles.audioPillTextMuted]}>{muted ? (locale === "ar" ? "مكتوم" : "MUTED") : (locale === "ar" ? "الأذان يعمل" : "ADHAN ON")}</Text></View><Text style={[styles.prayerTime, active && styles.prayerActiveText]}>{formatPrayerTime(active && next?.isTomorrow ? next.time : today[prayer], locale)}</Text></View></Pressable>; }) : <Text style={styles.emptyText}>No prayer schedule is available for {todayKey}.</Text>}</View>

      <Pressable onPress={() => setActiveTab("quiz")} style={styles.quizCard}><View style={styles.quizTopRow}><View style={styles.quizIconWrap}><Text style={styles.quizIcon}>🧠</Text></View><View style={styles.quizCopy}><Text style={styles.quizEyebrow}>{locale === "ar" ? "تعلّم كل يوم" : "LEARN EVERY DAY"}</Text><Text style={styles.quizTitle}>{locale === "ar" ? "المسابقة والألعاب الجماعية" : "Quiz & Multiplayer Games"}</Text><Text style={styles.quizDescription}>{locale === "ar" ? "مسابقة يومية + Trivia وImposter وألعاب إسلامية ورياضية جماعية." : "Daily quiz + live Trivia, Imposter and Islamic/sports multiplayer games."}</Text></View><Text style={styles.quizArrow}>›</Text></View><View style={styles.quizStats}><View style={styles.quizStat}><Text style={styles.quizStatEmoji}>{badge.emoji}</Text><Text style={styles.quizStatValue}>{badge.name[locale]}</Text><Text style={styles.quizStatLabel}>{locale === "ar" ? "الشارة" : "Badge"}</Text></View><View style={styles.quizStat}><Text style={styles.quizStatEmoji}>🔥</Text><Text style={styles.quizStatValue}>{quizStats.streak}</Text><Text style={styles.quizStatLabel}>{locale === "ar" ? "سلسلة" : "Streak"}</Text></View><View style={styles.quizStat}><Text style={styles.quizStatEmoji}>🏆</Text><Text style={styles.quizStatValue}>{quizStats.totalWins}</Text><Text style={styles.quizStatLabel}>{locale === "ar" ? "انتصارات" : "Wins"}</Text></View></View>{upcomingBadge ? <Text style={styles.quizNextBadge}>{upcomingBadge.emoji} {locale === "ar" ? "الشارة القادمة" : "Next badge"}: {upcomingBadge.name[locale]} • {Math.max(0, upcomingBadge.minWins - quizStats.totalWins)} {locale === "ar" ? "انتصارات" : "wins"}</Text> : null}</Pressable>

      <View style={styles.smartGrid}><Pressable onPress={() => setActiveTab("quran")} style={styles.smartCard}><Text style={styles.smartEmoji}>📖</Text><Text style={styles.smartTitle}>{locale === "ar" ? "القرآن" : "Qur’an"}</Text><Text style={styles.smartText}>{locale === "ar" ? "قارئ أندرويد أصلي" : "Native Android reader"}</Text></Pressable><Pressable onPress={() => setActiveTab("alerts")} style={styles.smartCard}><Text style={styles.smartEmoji}>🔔</Text><Text style={styles.smartTitle}>{locale === "ar" ? "التنبيهات" : "Alerts"}</Text><Text style={styles.smartText}>{alertsEnabled ? (locale === "ar" ? "مفعّلة" : "Enabled") : (locale === "ar" ? "اضبط التذكيرات" : "Set reminders")}</Text></Pressable></View>

      <Pressable onPress={() => setActiveTab("events")} style={styles.eventsEntryCard}><View style={styles.eventsEntryIcon}><Text style={styles.eventsEntryEmoji}>🌙</Text></View><View style={styles.eventsEntryCopy}><Text style={styles.eventsEntryEyebrow}>{locale === "ar" ? "التقويم الإسلامي" : "ISLAMIC CALENDAR"}</Text><Text style={styles.eventsEntryTitle}>{locale === "ar" ? "المناسبات الإسلامية" : "Islamic Events"}</Text><Text style={styles.eventsEntryText}>{upcomingIslamicEvent ? `${locale === "ar" ? "القادمة" : "Next"}: ${upcomingIslamicEvent.name[locale]} • ${islamicEventCountdown(upcomingIslamicDays ?? 0, locale)}` : (locale === "ar" ? "شاهد مناسبات السنة" : "View the full year")}</Text></View><Text style={styles.eventsEntryArrow}>›</Text></Pressable>

      <View style={styles.inspirationCard}><View style={styles.inspirationIcon}><Text style={styles.inspirationEmoji}>🏮</Text></View><View style={styles.inspirationCopy}><Text style={styles.inspirationEyebrow}>{locale === "ar" ? "إلهام اليوم" : "DAILY INSPIRATION"}</Text><Text style={styles.inspirationText}>{locale === "ar" ? "بذكر الله تطمئن القلوب." : "Hearts find comfort in the remembrance of Allah."}</Text><Text style={styles.inspirationRef}>Qur’an 13:28</Text></View></View>
      <Text style={styles.footer}>{prayerLocation?.source === "windsor_islamic_association" ? "Official Windsor Islamic Association schedule" : "Prayer times calculated for current GPS location"} • {prayerTimeZone}</Text>
    </ScrollView>
  );

  const alertsScreen = (
    <ScrollView style={styles.flex} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      {header}
      <Text style={styles.pageEyebrow}>HASSOUN • {locale === "ar" ? "مركز التنبيهات" : "ALERT CENTER"}</Text>
      <Text style={styles.pageTitle}>{locale === "ar" ? "تنبيهاتك، باختيارك" : "Your prayer alerts, your way"}</Text>
      <Text style={styles.pageSubtitle}>{locale === "ar" ? "خصص كل صلاة على حدة: قبل ٢٠ دقيقة أو ١٠ دقائق أو الأذان عند الوقت، أو أي مجموعة منها." : "Customize every prayer separately: 20 minutes before, 10 minutes before, Adhan at prayer time, or any combination."}</Text>

      <View style={styles.alertMasterCard}>
        <View style={styles.alertMasterLogo}><Image source={require("./assets/hassoun-logo.png")} style={styles.alertMasterLogoImage} resizeMode="contain" /></View>
        <View style={styles.settingCopy}>
          <Text style={styles.alertMasterEyebrow}>{locale === "ar" ? "تنبيهات هذا الهاتف" : "THIS PHONE"}</Text>
          <Text style={styles.settingTitle}>{alertsEnabled ? (locale === "ar" ? "تنبيهات الصلاة مفعلة" : "Prayer alerts are active") : (locale === "ar" ? "تنبيهات الصلاة متوقفة" : "Prayer alerts are paused")}</Text>
          <Text style={styles.settingText}>{summarizePrayerAlertPreferences(phoneAlertPreferences, locale)}</Text>
          {alertsEnabled ? <Text style={styles.settingStatus}>✓ {scheduledCount} {locale === "ar" ? "تنبيه/أذان مجدول" : "scheduled reminder/Adhan events"}</Text> : null}
        </View>
        <Switch value={alertsEnabled} onValueChange={toggleAlerts} disabled={busy || alertPreferencesBusy} trackColor={{ false: "#d9ddd9", true: "#95c3b4" }} thumbColor={alertsEnabled ? "#0b5b47" : "#f8faf8"} />
      </View>

      <View style={styles.alertPreferenceCard}>
        <View style={styles.alertPreferenceHeading}>
          <View style={{ flex: 1 }}>
            <Text style={styles.alertPreferenceEyebrow}>{locale === "ar" ? "تخصيص كل صلاة" : "PER-PRAYER CONTROLS"}</Text>
            <Text style={styles.alertPreferenceTitle}>{locale === "ar" ? "اختر متى ينبهك Hassoun" : "Choose exactly when Hassoun alerts you"}</Text>
            <Text style={styles.alertPreferenceText}>{locale === "ar" ? "زر الصلاة على اليمين يوقف كل تنبيهات تلك الصلاة. أزرار 20 و10 والأذان تتحكم بكل نوع بشكل مستقل." : "The prayer switch turns that prayer completely on/off. The 20, 10 and Adhan buttons control each alert type independently."}</Text>
          </View>
        </View>
        <PrayerAlertPreferenceGrid
          locale={locale}
          value={phoneAlertPreferences}
          onChange={(nextPreferences) => void updatePhoneAlertPreferences(nextPreferences)}
          disabled={busy || alertPreferencesBusy}
        />
        {alertPreferencesBusy ? <View style={styles.alertSaving}><ActivityIndicator size="small" color="#0b654f" /><Text style={styles.alertSavingText}>{locale === "ar" ? "جارٍ تحديث التنبيهات على هذا الهاتف…" : "Updating this phone’s prayer schedule…"}</Text></View> : null}
      </View>

      <Pressable onPress={onOpenEmailAlerts} disabled={!onOpenEmailAlerts} style={styles.emailCard}>
        <View style={styles.emailLogoWrap}><Image source={require("./assets/hassoun-logo.png")} style={styles.emailLogo} resizeMode="contain" /></View>
        <View style={styles.settingCopy}><Text style={styles.settingTitle}>{locale === "ar" ? "تنبيهات الصلاة عبر البريد" : "Prayer email alerts"}</Text><Text style={styles.settingText}>{locale === "ar" ? "خصص Fajr وDhuhr وAsr وMaghrib وIsha بشكل مستقل، مع ٢٠ دقيقة أو ١٠ دقائق أو وقت الصلاة." : "Customize Fajr, Dhuhr, Asr, Maghrib and Isha independently with 20-minute, 10-minute and at-time emails."}</Text></View><Text style={styles.settingArrow}>›</Text>
      </Pressable>

      <View style={styles.emailCard}>
        <View style={styles.emailIcon}><Text style={styles.emailEmoji}>🌙</Text></View>
        <View style={styles.settingCopy}><Text style={styles.settingTitle}>{locale === "ar" ? "تنبيهات المناسبات الإسلامية" : "Islamic event reminders"}</Text><Text style={styles.settingText}>{locale === "ar" ? "ينبهك Hassoun قبل ١٥ يوماً من المناسبة القادمة. هذا إعداد مستقل عن صفحة المناسبات." : "Hassoun can remind you 15 days before the next Islamic event. This is a real alert setting, separate from the Events page."}</Text><Pressable onPress={() => setActiveTab("events")}><Text style={styles.eventSettingsLink}>{locale === "ar" ? "عرض كل المناسبات ←" : "View all Islamic events →"}</Text></Pressable></View>
        <Switch value={islamicEventAlertsEnabled} onValueChange={(value) => void toggleIslamicEventAlerts(value)} disabled={islamicEventAlertsBusy} trackColor={{ false: "#d9ddd9", true: "#95c3b4" }} thumbColor={islamicEventAlertsEnabled ? "#0b5b47" : "#f8faf8"} />
      </View>

      <View style={styles.testCard}><Text style={styles.testTitle}>{locale === "ar" ? "اختبار النظام" : "System tests"}</Text><Text style={styles.testDescription}>{locale === "ar" ? "اختبر التنبيه والأذان دون تغيير ساعة الهاتف." : "Test notifications and locked-screen Adhan without changing the phone clock."}</Text><View style={styles.testRow}><Pressable onPress={testNotification} style={styles.testButton} disabled={busy || alertPreferencesBusy}><Text style={styles.testButtonIcon}>🔔</Text><Text style={styles.testButtonTitle}>{locale === "ar" ? "اختبار تنبيه" : "Test notification"}</Text><Text style={styles.testButtonMeta}>15 sec</Text></Pressable><Pressable onPress={testAdhan} style={[styles.testButton, styles.testButtonPrimary]} disabled={busy || alertPreferencesBusy}><Text style={styles.testButtonIcon}>🕌</Text><Text style={[styles.testButtonTitle, styles.testButtonPrimaryText]}>{locale === "ar" ? "اختبار الأذان" : "Test Adhan"}</Text><Text style={[styles.testButtonMeta, styles.testButtonPrimaryMeta]}>30 sec</Text></Pressable></View></View>
    </ScrollView>
  );

  const moreScreen = <SettingsHub locale={locale} onToggleLocale={toggleLocale} onOpenAlerts={() => setActiveTab("alerts")} onOpenEmailAlerts={onOpenEmailAlerts} />;

  const body = activeTab === "quran"
    ? <Quran locale={locale} onBackHome={() => { setQuranAppNavVisible(true); setQuranOwnsAudioSurface(false); setActiveTab("home"); }} onAppNavVisibilityChange={setQuranAppNavVisible} onLocalAudioSurfaceChange={setQuranOwnsAudioSurface} />
    : activeTab === "quiz"
      ? <QuizGamesHub locale={locale} dateKey={todayKey} stats={quizStats} onStatsChange={setQuizStats} onBackHome={() => setActiveTab("home")} />
      : activeTab === "alerts"
        ? alertsScreen
        : activeTab === "events"
          ? <IslamicEventsPage locale={locale} todayKey={todayKey} onBack={() => setActiveTab("home")} />
          : activeTab === "more"
            ? moreScreen
            : homeScreen;

  const navItems: Array<{ tab: AppTab; emoji: string; en: string; ar: string }> = [
    { tab: "home", emoji: "🏠", en: "Home", ar: "الرئيسية" },
    { tab: "quran", emoji: "📖", en: "Qur’an", ar: "القرآن" },
    { tab: "quiz", emoji: "🎮", en: "Games", ar: "ألعاب" },
    { tab: "alerts", emoji: "🔔", en: "Alerts", ar: "تنبيهات" },
    { tab: "more", emoji: "•••", en: "More", ar: "المزيد" }
  ];

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom", "left", "right"]}>
      <StatusBar style="dark" /><ScrollingTicker /><View style={styles.flex}>{body}</View>
      {(activeTab !== "quran" || !quranOwnsAudioSurface) && globalQuranAudio.state !== "idle" && globalQuranAudio.state !== "error" ? <View style={styles.globalAudioBar}><View style={styles.globalAudioCopy}><Text style={styles.globalAudioEyebrow}>{locale === "ar" ? "تشغيل القرآن" : "QUR’AN AUDIO"}</Text><Text numberOfLines={1} style={styles.globalAudioTitle}>{globalQuranAudio.title || (locale === "ar" ? "القرآن الكريم" : "Qur’an playback")}</Text>{globalQuranAudio.subtitle ? <Text numberOfLines={1} style={styles.globalAudioMeta}>{globalQuranAudio.subtitle}</Text> : null}</View><Pressable onPress={() => QuranAudio?.previous()} style={styles.globalAudioButton}><Text style={styles.globalAudioButtonText}>‹</Text></Pressable><Pressable onPress={() => globalQuranAudio.state === "playing" ? QuranAudio?.pause() : QuranAudio?.resume()} style={styles.globalAudioMain}><Text style={styles.globalAudioMainText}>{globalQuranAudio.state === "playing" ? "Ⅱ" : "▶"}</Text></Pressable><Pressable onPress={() => QuranAudio?.next()} style={styles.globalAudioButton}><Text style={styles.globalAudioButtonText}>›</Text></Pressable><Pressable onPress={() => QuranAudio?.stop()} style={styles.globalAudioStop}><Text style={styles.globalAudioStopText}>■</Text></Pressable></View> : null}
      {(activeTab !== "quran" || quranAppNavVisible) ? <View style={styles.bottomNav}>{navItems.map((item) => { const active = activeTab === item.tab; return <Pressable key={item.tab} onPress={() => setActiveTab(item.tab)} style={[styles.navItem, active && styles.navItemActive]}><Text style={[styles.navEmoji, active && styles.navEmojiActive]}>{item.emoji}</Text><Text style={[styles.navLabel, active && styles.navLabelActive]}>{locale === "ar" ? item.ar : item.en}</Text></Pressable>; })}</View> : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  alertMasterCard: { borderRadius: 23, backgroundColor: "#fff", borderWidth: 1, borderColor: "#dfe5df", padding: 14, flexDirection: "row", alignItems: "center", gap: 11, marginTop: 17 },
  alertMasterLogo: { width: 49, height: 49, borderRadius: 15, backgroundColor: "#003d33", alignItems: "center", justifyContent: "center", overflow: "hidden" },
  alertMasterLogoImage: { width: 45, height: 45 },
  alertMasterEyebrow: { color: "#9b7a39", fontSize: 9, fontWeight: "900", letterSpacing: 1 },
  alertPreferenceCard: { borderRadius: 23, backgroundColor: "#fffdf8", borderWidth: 1, borderColor: "#e1d9ca", padding: 14, marginTop: 11 },
  alertPreferenceHeading: { flexDirection: "row", gap: 10, marginBottom: 13 },
  alertPreferenceEyebrow: { color: "#9b7a39", fontSize: 9, fontWeight: "900", letterSpacing: 1 },
  alertPreferenceTitle: { color: "#173f35", fontSize: 17, fontWeight: "900", marginTop: 3 },
  alertPreferenceText: { color: "#6f7e78", fontSize: 11, lineHeight: 16, marginTop: 5 },
  alertSaving: { minHeight: 38, borderRadius: 13, backgroundColor: "#edf5f1", marginTop: 10, paddingHorizontal: 11, flexDirection: "row", alignItems: "center", gap: 8 },
  alertSavingText: { flex: 1, color: "#526d64", fontSize: 8.5, fontWeight: "800" },
  emailLogoWrap: { width: 45, height: 45, borderRadius: 14, backgroundColor: "#003d33", alignItems: "center", justifyContent: "center", overflow: "hidden" },
  emailLogo: { width: 41, height: 41 },
  eventSettingsLink: { color: "#0b654f", fontSize: 10.5, fontWeight: "900", marginTop: 7 },
  flex: { flex: 1 }, safe: { flex: 1, backgroundColor: "#f7f4ec" }, loading: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#f7f4ec", gap: 14 }, loadingText: { color: "#355c52", fontSize: 15 }, content: { paddingHorizontal: 18, paddingTop: 14, paddingBottom: 34 }, header: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 14 }, menuButton: { width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "#fff", borderWidth: 1, borderColor: "#e0ddd5" }, menuIcon: { color: "#173f35", fontSize: 21, fontWeight: "700" }, headerLogo: { width: 42, height: 42, borderRadius: 13, backgroundColor: "#003d33" }, brandText: { flex: 1 }, title: { color: "#173f35", fontSize: 17, fontWeight: "900" }, subtitle: { color: "#74817c", fontSize: 11, marginTop: 3 }, languageButton: { minWidth: 46, height: 42, borderWidth: 1, borderColor: "#d8d4ca", borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "#fbf9f4" }, languageText: { color: "#0b5b47", fontWeight: "900", fontSize: 13 },
  dateHero: { minHeight: 116, flexDirection: "row", alignItems: "center", borderRadius: 24, backgroundColor: "#eee8dc", borderWidth: 1, borderColor: "#e0d8c8", padding: 16, overflow: "hidden" }, dateCopy: { flex: 1 }, datePrimary: { color: "#173f35", fontSize: 16, fontWeight: "900" }, dateHijri: { color: "#577269", fontSize: 12, fontWeight: "700", marginTop: 5 }, syncRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 12 }, syncDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#20a269" }, syncDotSaved: { backgroundColor: "#d5a93b" }, syncText: { color: "#7b807a", fontSize: 9, fontWeight: "800" }, heroLogoShell: { width: 90, height: 84, borderRadius: 26, backgroundColor: "#003d33", alignItems: "center", justifyContent: "center", overflow: "hidden" }, heroLogo: { width: 82, height: 82 },
  eventCountdownCard: { marginTop: 13, borderRadius: 23, backgroundColor: "#fff6da", borderWidth: 1, borderColor: "#e2c872", padding: 13, flexDirection: "row", alignItems: "center", gap: 10 }, eventCountdownIcon: { width: 50, height: 50, borderRadius: 17, backgroundColor: "#0b654f", alignItems: "center", justifyContent: "center" }, eventCountdownEmoji: { fontSize: 25 }, eventCountdownCopy: { flex: 1 }, eventCountdownEyebrow: { color: "#9d782d", fontSize: 9, fontWeight: "900", letterSpacing: 1 }, eventCountdownTitle: { color: "#173f35", fontSize: 15, fontWeight: "900", marginTop: 2 }, eventCountdownText: { color: "#66746e", fontSize: 11, lineHeight: 16, marginTop: 5 }, eventCountdownArrow: { color: "#0b654f", fontSize: 28 },
  nextCard: { backgroundColor: "#0a634d", borderRadius: 27, padding: 19, marginTop: 14, shadowColor: "#164d3f", shadowOpacity: 0.13, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 4 }, nextTopRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }, nextEyebrow: { color: "#c2ddd4", fontSize: 9, fontWeight: "900", letterSpacing: 1.5 }, nextName: { color: "#fff", fontSize: 35, fontWeight: "900", marginTop: 5 }, nextArabic: { color: "#cae0d8", fontSize: 15, marginTop: 1 }, nextIconBubble: { width: 62, height: 62, borderRadius: 21, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,.12)" }, nextIcon: { fontSize: 32 }, nextBottomRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 19 }, nextTime: { color: "#fff", fontSize: 24, fontWeight: "900" }, countdownPill: { backgroundColor: "rgba(255,255,255,.13)", borderRadius: 99, paddingHorizontal: 11, paddingVertical: 7 }, countdownText: { color: "#e7f2ee", fontSize: 11, fontWeight: "800" }, progressTrack: { height: 4, backgroundColor: "rgba(255,255,255,.17)", borderRadius: 3, marginTop: 15, overflow: "hidden" }, progressFill: { width: "56%", height: 4, backgroundColor: "#f2cc72", borderRadius: 3 },
  sectionHeadingRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 23, marginBottom: 10 }, sectionTitle: { color: "#173f35", fontSize: 19, fontWeight: "900" }, sectionHint: { color: "#7d8984", fontSize: 10.5, lineHeight: 15, marginTop: 4, maxWidth: 255 }, sectionMeta: { color: "#77837e", fontSize: 10, fontWeight: "700" }, prayerList: { backgroundColor: "#fff", borderRadius: 22, borderWidth: 1, borderColor: "#dfddd5", overflow: "hidden" }, prayerRow: { minHeight: 74, flexDirection: "row", alignItems: "center", paddingHorizontal: 13, borderBottomWidth: 1, borderBottomColor: "#efede8" }, prayerRowActive: { backgroundColor: "#dff2e9", borderLeftWidth: 4, borderLeftColor: "#0b654f" }, prayerRowMuted: { backgroundColor: "#f5f1e9" }, prayerRowPressed: { opacity: .72 }, prayerIconWrap: { width: 39, height: 39, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "#f1f3ef", marginRight: 11 }, prayerIconWrapActive: { backgroundColor: "#d8eee5" }, prayerIcon: { fontSize: 20 }, prayerNameBlock: { flex: 1 }, prayerSubRow: { flexDirection: "row", alignItems: "center", gap: 6 }, tomorrowTag: { color: "#0b654f", backgroundColor: "#cce8dc", borderRadius: 99, paddingHorizontal: 6, paddingVertical: 2, fontSize: 7, fontWeight: "900", overflow: "hidden" }, prayerName: { color: "#173f35", fontSize: 15, fontWeight: "900" }, prayerOtherName: { color: "#8a9691", fontSize: 11.5, marginTop: 1 }, prayerRight: { alignItems: "flex-end", gap: 4 }, audioPill: { minWidth: 62, borderRadius: 99, backgroundColor: "#e5f2ec", paddingHorizontal: 7, paddingVertical: 3, alignItems: "center" }, audioPillMuted: { backgroundColor: "#eee5d9" }, audioPillText: { color: "#0b654f", fontSize: 8, fontWeight: "900", letterSpacing: .4 }, audioPillTextMuted: { color: "#8b6f59" }, prayerTime: { color: "#173f35", fontSize: 15, fontWeight: "900" }, prayerActiveText: { color: "#0a654f" }, prayerActiveMuted: { color: "#679385" }, emptyText: { padding: 18, color: "#75827d" },
  quizCard: { marginTop: 16, borderRadius: 23, backgroundColor: "#fff", borderWidth: 1, borderColor: "#dedbd2", padding: 15 }, quizTopRow: { flexDirection: "row", alignItems: "center", gap: 11 }, quizIconWrap: { width: 49, height: 49, borderRadius: 17, backgroundColor: "#f0e9d7", alignItems: "center", justifyContent: "center" }, quizIcon: { fontSize: 25 }, quizCopy: { flex: 1 }, quizEyebrow: { color: "#a27d32", fontSize: 8, fontWeight: "900", letterSpacing: 1.2 }, quizTitle: { color: "#173f35", fontSize: 17, fontWeight: "900", marginTop: 2 }, quizDescription: { color: "#78837e", fontSize: 11, lineHeight: 16, marginTop: 4 }, quizArrow: { color: "#0b5b47", fontSize: 27 }, quizStats: { flexDirection: "row", gap: 7, marginTop: 13 }, quizStat: { flex: 1, minHeight: 67, backgroundColor: "#f7f6f1", borderRadius: 15, alignItems: "center", justifyContent: "center", padding: 6 }, quizStatEmoji: { fontSize: 17 }, quizStatValue: { color: "#244e43", fontSize: 11, fontWeight: "900", marginTop: 2, textAlign: "center" }, quizStatLabel: { color: "#919994", fontSize: 8, marginTop: 1 }, quizNextBadge: { color: "#7c785f", fontSize: 9, fontWeight: "700", marginTop: 10, textAlign: "center" }, smartGrid: { flexDirection: "row", gap: 10, marginTop: 14 }, smartCard: { flex: 1, minHeight: 104, borderRadius: 21, backgroundColor: "#fff", borderWidth: 1, borderColor: "#e1ded6", padding: 14 }, smartEmoji: { fontSize: 24 }, smartTitle: { color: "#173f35", fontSize: 14, fontWeight: "900", marginTop: 7 }, smartText: { color: "#7f8c87", fontSize: 11, lineHeight: 15, marginTop: 3 },
  eventsEntryCard: { marginTop: 11, borderRadius: 22, backgroundColor: "#eaf4ef", borderWidth: 1, borderColor: "#cfe1d9", padding: 14, flexDirection: "row", alignItems: "center", gap: 11 }, eventsEntryIcon: { width: 48, height: 48, borderRadius: 16, backgroundColor: "#0b654f", alignItems: "center", justifyContent: "center" }, eventsEntryEmoji: { fontSize: 24 }, eventsEntryCopy: { flex: 1 }, eventsEntryEyebrow: { color: "#8f7136", fontSize: 7, fontWeight: "900", letterSpacing: 1 }, eventsEntryTitle: { color: "#173f35", fontSize: 15, fontWeight: "900", marginTop: 2 }, eventsEntryText: { color: "#74817c", fontSize: 10.5, lineHeight: 15, marginTop: 4 }, eventsEntryArrow: { color: "#0b654f", fontSize: 28 },
  inspirationCard: { flexDirection: "row", gap: 12, marginTop: 14, borderRadius: 22, backgroundColor: "#f0ebe1", padding: 15 }, inspirationIcon: { width: 47, height: 47, borderRadius: 16, backgroundColor: "#fff9ec", alignItems: "center", justifyContent: "center" }, inspirationEmoji: { fontSize: 25 }, inspirationCopy: { flex: 1 }, inspirationEyebrow: { color: "#a58448", fontSize: 8, fontWeight: "900", letterSpacing: 1.2 }, inspirationText: { color: "#304f47", fontSize: 13, fontWeight: "800", lineHeight: 18, marginTop: 3 }, inspirationRef: { color: "#8a8b7f", fontSize: 9, fontWeight: "700", marginTop: 4 }, footer: { color: "#8a928e", fontSize: 10, lineHeight: 15, textAlign: "center", marginTop: 22 }, pageEyebrow: { color: "#17705b", fontSize: 10, fontWeight: "900", letterSpacing: 1.5, marginTop: 2 }, pageTitle: { color: "#173f35", fontSize: 27, lineHeight: 32, fontWeight: "900", marginTop: 5 }, pageSubtitle: { color: "#6f7f79", fontSize: 13, lineHeight: 20, marginTop: 5, marginBottom: 17 }, settingsCard: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#fff", borderRadius: 22, borderWidth: 1, borderColor: "#dfddd5", padding: 15 }, settingIcon: { width: 48, height: 48, borderRadius: 16, backgroundColor: "#e8f3ee", alignItems: "center", justifyContent: "center" }, settingEmoji: { fontSize: 24 }, settingCopy: { flex: 1 }, settingTitle: { color: "#173f35", fontSize: 14, fontWeight: "900" }, settingText: { color: "#74817c", fontSize: 11, lineHeight: 16, marginTop: 4 }, settingStatus: { color: "#087052", fontSize: 9, fontWeight: "900", marginTop: 5 }, settingArrow: { color: "#0b5b47", fontSize: 28 }, emailCard: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#fff", borderRadius: 22, borderWidth: 1, borderColor: "#dfd6c6", padding: 15, marginTop: 11 }, emailIcon: { width: 48, height: 48, borderRadius: 16, backgroundColor: "#fffaf0", alignItems: "center", justifyContent: "center" }, emailEmoji: { fontSize: 23 }, testCard: { marginTop: 12, padding: 17, borderRadius: 22, backgroundColor: "#fff", borderWidth: 1, borderColor: "#dfddd5" }, testTitle: { color: "#173f35", fontSize: 16, fontWeight: "900" }, testDescription: { color: "#75827d", fontSize: 11, lineHeight: 17, marginTop: 4 }, testRow: { gap: 9, marginTop: 13 }, testButton: { minHeight: 70, borderRadius: 17, borderWidth: 1, borderColor: "#d7e2dd", backgroundColor: "#f7faf8", padding: 11, justifyContent: "center" }, testButtonPrimary: { backgroundColor: "#0b5b47", borderColor: "#0b5b47" }, testButtonIcon: { fontSize: 20 }, testButtonTitle: { color: "#164b3e", fontSize: 12, fontWeight: "900", marginTop: 5 }, testButtonMeta: { color: "#8b9792", fontSize: 9, marginTop: 2 }, testButtonPrimaryText: { color: "#fff" }, testButtonPrimaryMeta: { color: "#bdd9cf" }, moreRow: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 72, backgroundColor: "#fff", borderRadius: 20, borderWidth: 1, borderColor: "#e0ddd5", paddingHorizontal: 14, marginBottom: 9 }, moreEmoji: { fontSize: 24 }, moreCopy: { flex: 1 }, moreTitle: { color: "#173f35", fontSize: 13, fontWeight: "900" }, moreText: { color: "#85908c", fontSize: 10, lineHeight: 14, marginTop: 2 }, sourceCard: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 72, backgroundColor: "#edf6f1", borderRadius: 20, paddingHorizontal: 14, marginTop: 4 }, sourceEmoji: { fontSize: 24 },
  globalAudioBar: { minHeight: 62, flexDirection: "row", alignItems: "center", gap: 7, marginHorizontal: 10, marginBottom: 6, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 22, backgroundColor: "#113f35", shadowColor: "#000", shadowOpacity: .18, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 10 }, globalAudioCopy: { flex: 1, minWidth: 0 }, globalAudioEyebrow: { color: "#b9d7ce", fontSize: 7, fontWeight: "900", letterSpacing: .8 }, globalAudioTitle: { color: "#fff", fontSize: 10, fontWeight: "900", marginTop: 2 }, globalAudioMeta: { color: "#b9d0c8", fontSize: 7, marginTop: 1 }, globalAudioButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(255,255,255,.09)", alignItems: "center", justifyContent: "center" }, globalAudioButtonText: { color: "#fff", fontSize: 24, lineHeight: 26, fontWeight: "700" }, globalAudioMain: { width: 42, height: 42, borderRadius: 21, backgroundColor: "#fff", alignItems: "center", justifyContent: "center" }, globalAudioMainText: { color: "#0b654f", fontSize: 16, fontWeight: "900" }, globalAudioStop: { width: 34, height: 34, borderRadius: 17, backgroundColor: "rgba(255,255,255,.09)", alignItems: "center", justifyContent: "center" }, globalAudioStopText: { color: "#f0d7cf", fontSize: 11, fontWeight: "900" }, bottomNav: { minHeight: 72, flexDirection: "row", alignItems: "center", justifyContent: "space-around", backgroundColor: "#fff", borderTopWidth: 1, borderTopColor: "#e4e1d9", paddingHorizontal: 8, paddingTop: 5 }, navItem: { flex: 1, minHeight: 54, alignItems: "center", justifyContent: "center", borderRadius: 16 }, navItemActive: { backgroundColor: "#edf5f1" }, navEmoji: { fontSize: 17, color: "#6c7974" }, navEmojiActive: { color: "#0b5b47" }, navLabel: { color: "#7f8a85", fontSize: 10, fontWeight: "700", marginTop: 2 }, navLabelActive: { color: "#0b5b47", fontWeight: "900" }
});
