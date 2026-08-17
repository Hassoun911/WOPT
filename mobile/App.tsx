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
import IslamicQuiz from "./src/IslamicQuiz";
import SettingsHub from "./src/SettingsHub";
import HassounWidget from "./modules/hassoun-widget";
import { CITY_LABEL, STORAGE_KEYS, WINDSOR_TIME_ZONE } from "./src/config";
import { badgeForWins, EMPTY_QUIZ_STATS, loadQuizStats, nextBadge, type QuizStats } from "./src/islamicQuiz";
import { disablePrayerNotifications, schedulePrayerNotifications, scheduleTestReminder } from "./src/notifications";
import { openExactAlarmSettings, scheduleAndroidTestAdhan } from "./src/prayerAudio";
import { loadPrayerTimes } from "./src/prayerData";
import { registerDeviceForServerPush } from "./src/push";
import Quran from "./src/quran/Quran";
import { addDateDays, formatPrayerTime, timeToMinutes, windsorDateKey, windsorLocalToDate, windsorSecondsSinceMidnight } from "./src/time";
import { PRAYER_KEYS, type PrayerKey, type PrayerTimes } from "./src/types";

type AppTab = "home" | "quran" | "quiz" | "alerts" | "more";

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

function nextPrayerFor(prayerTimes: PrayerTimes, now = new Date()) {
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

function countdownLabel(seconds: number, locale: "en" | "ar") {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return locale === "ar"
    ? `${hours ? `${hours} س ` : ""}${minutes} د`
    : `${hours ? `${hours}h ` : ""}${minutes}m`;
}

function hijriDateLabel(date: Date, locale: "en" | "ar") {
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

export default function App({ onOpenEmailAlerts }: AppProps) {
  const [now, setNow] = useState(new Date());
  const [prayerTimes, setPrayerTimes] = useState<PrayerTimes>({});
  const [live, setLive] = useState(false);
  const [locale, setLocale] = useState<"en" | "ar">("en");
  const [alertsEnabled, setAlertsEnabled] = useState(false);
  const [busy, setBusy] = useState(true);
  const [scheduledCount, setScheduledCount] = useState(0);
  const [activeTab, setActiveTab] = useState<AppTab>("home");
  const [quranAppNavVisible, setQuranAppNavVisible] = useState(true);
  const [quizStats, setQuizStats] = useState<QuizStats>(EMPTY_QUIZ_STATS);

  const todayKey = windsorDateKey(now);
  const today = prayerTimes[todayKey];
  const next = useMemo(() => nextPrayerFor(prayerTimes, now), [now, prayerTimes]);
  const badge = badgeForWins(quizStats.totalWins);
  const upcomingBadge = nextBadge(quizStats.totalWins);

  useEffect(() => {
    if (Object.keys(prayerTimes).length) {
      HassounWidget.syncPrayerSchedule(JSON.stringify(prayerTimes), locale);
    }
  }, [prayerTimes, locale]);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1_000);
    void (async () => {
      const [savedLocale, savedAlerts, loaded, storedQuizStats] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.locale),
        AsyncStorage.getItem(STORAGE_KEYS.alertsEnabled),
        loadPrayerTimes(),
        loadQuizStats()
      ]);
      const chosenLocale = savedLocale === "ar" ? "ar" : "en";
      setLocale(chosenLocale);
      setAlertsEnabled(savedAlerts === "on");
      setPrayerTimes(loaded.prayerTimes);
      setLive(loaded.live);
      setQuizStats(storedQuizStats);
      setBusy(false);

      if (savedAlerts === "on") {
        const result = await schedulePrayerNotifications(loaded.prayerTimes, chosenLocale);
        setScheduledCount(result.count);
        void registerDeviceForServerPush(chosenLocale).catch(() => undefined);
      }
    })();
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active") return;
      setNow(new Date());
      void loadQuizStats().then(setQuizStats).catch(() => undefined);
      if (!alertsEnabled || !Object.keys(prayerTimes).length) return;
      void schedulePrayerNotifications(prayerTimes, locale)
        .then((result) => setScheduledCount(result.count))
        .catch(() => undefined);
    });
    return () => subscription.remove();
  }, [alertsEnabled, locale, prayerTimes]);

  const toggleLocale = async () => {
    const nextLocale = locale === "en" ? "ar" : "en";
    setLocale(nextLocale);
    await AsyncStorage.setItem(STORAGE_KEYS.locale, nextLocale);
    if (alertsEnabled) {
      const result = await schedulePrayerNotifications(prayerTimes, nextLocale);
      setScheduledCount(result.count);
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
      const result = await schedulePrayerNotifications(prayerTimes, locale);
      if (!result.granted) {
        Alert.alert("Notifications are off", "Allow notifications in your phone settings to receive prayer alerts.");
        return;
      }
      setAlertsEnabled(true);
      setScheduledCount(result.count);
      void registerDeviceForServerPush(locale).catch(() => undefined);
      if (!result.exactAlarmGranted) {
        Alert.alert(
          "Allow exact prayer alarms",
          "Android needs Alarms & reminders access so the full Adhan can begin at the exact prayer time, even when the app is closed.",
          [
            { text: "Not now", style: "cancel" },
            { text: "Open settings", onPress: openExactAlarmSettings }
          ]
        );
      }
    } finally {
      setBusy(false);
    }
  };

  const testNotification = async () => {
    try {
      const result = await scheduleTestReminder(15);
      if (!result.granted) {
        Alert.alert("Notifications are off", "Allow notifications for Hassoun in Android settings, then try again.");
        return;
      }
      Alert.alert("Test scheduled", "Lock the phone. A Hassoun notification with the reminder chime should arrive in about 15 seconds.");
    } catch (error) {
      Alert.alert("Notification test failed", String(error));
    }
  };

  const testAdhan = async () => {
    try {
      const result = await scheduleAndroidTestAdhan("fajr", 30);
      if (!result.available) {
        Alert.alert("Native Adhan unavailable", "This build does not contain the native Android prayer-audio module.");
        return;
      }
      if (!result.exact) {
        Alert.alert(
          "Allow Alarms & reminders",
          "Exact alarm access is off. Enable it, return to Hassoun, then run the Adhan test again.",
          [
            { text: "Cancel", style: "cancel" },
            { text: "Open settings", onPress: openExactAlarmSettings }
          ]
        );
        return;
      }
      Alert.alert("Adhan test scheduled", "Lock the phone now. The Fajr Adhan should start by itself in about 30 seconds.");
    } catch (error) {
      Alert.alert("Adhan test failed", String(error));
    }
  };

  if (busy && !today) {
    return (
      <SafeAreaView style={styles.loading} edges={["top", "bottom", "left", "right"]}>
        <ActivityIndicator color="#0b5b47" size="large" />
        <Text style={styles.loadingText}>Loading Windsor prayer times…</Text>
      </SafeAreaView>
    );
  }

  const date = windsorLocalToDate(todayKey, "12:00");
  const shortDate = new Intl.DateTimeFormat(locale === "ar" ? "ar-CA" : "en-CA", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(date);
  const hijriDate = hijriDateLabel(date, locale);

  const header = (
    <View style={styles.header}>
      <Pressable onPress={() => setActiveTab("more")} style={styles.menuButton}>
        <Text style={styles.menuIcon}>☰</Text>
      </Pressable>
      <Image source={require("./assets/hassoun-logo.png")} style={styles.headerLogo} />
      <View style={styles.brandText}>
        <Text style={styles.title}>Hassoun</Text>
        <Text style={styles.subtitle}>{locale === "ar" ? "📍 وندسور، أونتاريو • مواقيت الصلاة" : "📍 Windsor, Ontario • Prayer Times"}</Text>
      </View>
      <Pressable onPress={toggleLocale} style={styles.languageButton}>
        <Text style={styles.languageText}>{locale === "en" ? "AR" : "EN"}</Text>
      </Pressable>
    </View>
  );

  const homeScreen = (
    <ScrollView style={styles.flex} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      {header}

      <View style={styles.dateHero}>
        <View style={styles.dateCopy}>
          <Text style={styles.datePrimary}>{shortDate}</Text>
          {hijriDate ? <Text style={styles.dateHijri}>🌙 {hijriDate}</Text> : null}
          <View style={styles.syncRow}>
            <View style={[styles.syncDot, !live && styles.syncDotSaved]} />
            <Text style={styles.syncText}>{live ? (locale === "ar" ? "متزامن عبر Hassoun" : "Synced by Hassoun") : (locale === "ar" ? "الجدول الرسمي محفوظ" : "Saved official schedule")}</Text>
          </View>
        </View>
        <View style={styles.mosqueScene}>
          <Text style={styles.sceneSun}>☀️</Text>
          <Text style={styles.sceneMosque}>🕌</Text>
        </View>
      </View>

      {next ? (
        <View style={styles.nextCard}>
          <View style={styles.nextTopRow}>
            <View>
              <Text style={styles.nextEyebrow}>{locale === "ar" ? `الصلاة القادمة${next.isTomorrow ? " • غداً" : ""}` : `NEXT PRAYER${next.isTomorrow ? " • TOMORROW" : ""}`}</Text>
              <Text style={styles.nextName}>{NAMES[next.prayer][locale]}</Text>
              <Text style={styles.nextArabic}>{NAMES[next.prayer][locale === "en" ? "ar" : "en"]}</Text>
            </View>
            <View style={styles.nextIconBubble}><Text style={styles.nextIcon}>{PRAYER_ICONS[next.prayer]}</Text></View>
          </View>
          <View style={styles.nextBottomRow}>
            <Text style={styles.nextTime}>{formatPrayerTime(next.time, locale)}</Text>
            <View style={styles.countdownPill}>
              <Text style={styles.countdownText}>⏳ {countdownLabel(next.secondsRemaining, locale)} {locale === "ar" ? "متبقي" : "left"}</Text>
            </View>
          </View>
          <View style={styles.progressTrack}><View style={styles.progressFill} /></View>
        </View>
      ) : null}

      <View style={styles.sectionHeadingRow}>
        <Text style={styles.sectionTitle}>{locale === "ar" ? "جدول اليوم" : "Today’s Schedule"}</Text>
        <Text style={styles.sectionMeta}>🕋 {locale === "ar" ? "٥ صلوات" : "5 prayers"}</Text>
      </View>

      <View style={styles.prayerList}>
        {today
          ? PRAYER_KEYS.map((prayer) => {
              const active = next?.prayer === prayer;
              return (
                <View key={prayer} style={[styles.prayerRow, active && styles.prayerRowActive]}>
                  <View style={[styles.prayerIconWrap, active && styles.prayerIconWrapActive]}>
                    <Text style={styles.prayerIcon}>{PRAYER_ICONS[prayer]}</Text>
                  </View>
                  <View style={styles.prayerNameBlock}>
                    <Text style={[styles.prayerName, active && styles.prayerActiveText]}>{NAMES[prayer][locale]}</Text>
                    <View style={styles.prayerSubRow}>
                      <Text style={[styles.prayerOtherName, active && styles.prayerActiveMuted]}>{NAMES[prayer][locale === "en" ? "ar" : "en"]}</Text>
                      {active && next?.isTomorrow ? <Text style={styles.tomorrowTag}>{locale === "ar" ? "غداً" : "Tomorrow"}</Text> : null}
                    </View>
                  </View>
                  <Text style={[styles.prayerTime, active && styles.prayerActiveText]}>{formatPrayerTime(active && next?.isTomorrow ? next.time : today[prayer], locale)}</Text>
                </View>
              );
            })
          : <Text style={styles.emptyText}>No prayer schedule is available for {todayKey}.</Text>}
      </View>

      <Pressable onPress={() => setActiveTab("quiz")} style={styles.quizCard}>
        <View style={styles.quizTopRow}>
          <View style={styles.quizIconWrap}><Text style={styles.quizIcon}>🧠</Text></View>
          <View style={styles.quizCopy}>
            <Text style={styles.quizEyebrow}>{locale === "ar" ? "تعلّم كل يوم" : "LEARN EVERY DAY"}</Text>
            <Text style={styles.quizTitle}>{locale === "ar" ? "المسابقة الإسلامية اليومية" : "Daily Islamic Quiz"}</Text>
            <Text style={styles.quizDescription}>{locale === "ar" ? "أسئلة للأطفال والكبار مع شارات وسلسلة أيام." : "Kids & Adults questions with badges and daily streaks."}</Text>
          </View>
          <Text style={styles.quizArrow}>›</Text>
        </View>
        <View style={styles.quizStats}>
          <View style={styles.quizStat}><Text style={styles.quizStatEmoji}>{badge.emoji}</Text><Text style={styles.quizStatValue}>{badge.name[locale]}</Text><Text style={styles.quizStatLabel}>{locale === "ar" ? "الشارة" : "Badge"}</Text></View>
          <View style={styles.quizStat}><Text style={styles.quizStatEmoji}>🔥</Text><Text style={styles.quizStatValue}>{quizStats.streak}</Text><Text style={styles.quizStatLabel}>{locale === "ar" ? "سلسلة" : "Streak"}</Text></View>
          <View style={styles.quizStat}><Text style={styles.quizStatEmoji}>🏆</Text><Text style={styles.quizStatValue}>{quizStats.totalWins}</Text><Text style={styles.quizStatLabel}>{locale === "ar" ? "انتصارات" : "Wins"}</Text></View>
        </View>
        {upcomingBadge ? (
          <Text style={styles.quizNextBadge}>{upcomingBadge.emoji} {locale === "ar" ? "الشارة القادمة" : "Next badge"}: {upcomingBadge.name[locale]} • {Math.max(0, upcomingBadge.minWins - quizStats.totalWins)} {locale === "ar" ? "انتصارات" : "wins"}</Text>
        ) : null}
      </Pressable>

      <View style={styles.smartGrid}>
        <Pressable onPress={() => setActiveTab("quran")} style={styles.smartCard}>
          <Text style={styles.smartEmoji}>📖</Text>
          <Text style={styles.smartTitle}>{locale === "ar" ? "القرآن" : "Qur’an"}</Text>
          <Text style={styles.smartText}>{locale === "ar" ? "قارئ أندرويد أصلي" : "Native Android reader"}</Text>
        </Pressable>
        <Pressable onPress={() => setActiveTab("alerts")} style={styles.smartCard}>
          <Text style={styles.smartEmoji}>🔔</Text>
          <Text style={styles.smartTitle}>{locale === "ar" ? "التنبيهات" : "Alerts"}</Text>
          <Text style={styles.smartText}>{alertsEnabled ? (locale === "ar" ? "مفعّلة" : "Enabled") : (locale === "ar" ? "اضبط التذكيرات" : "Set reminders")}</Text>
        </Pressable>
      </View>

      <View style={styles.inspirationCard}>
        <View style={styles.inspirationIcon}><Text style={styles.inspirationEmoji}>🏮</Text></View>
        <View style={styles.inspirationCopy}>
          <Text style={styles.inspirationEyebrow}>{locale === "ar" ? "إلهام اليوم" : "DAILY INSPIRATION"}</Text>
          <Text style={styles.inspirationText}>{locale === "ar" ? "بذكر الله تطمئن القلوب." : "Hearts find comfort in the remembrance of Allah."}</Text>
          <Text style={styles.inspirationRef}>Qur’an 13:28</Text>
        </View>
      </View>

      <Text style={styles.footer}>Official Windsor Islamic Association schedule • America/Toronto</Text>
    </ScrollView>
  );

  const alertsScreen = (
    <ScrollView style={styles.flex} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      {header}
      <Text style={styles.pageEyebrow}>🔔 {locale === "ar" ? "التنبيهات" : "ALERTS"}</Text>
      <Text style={styles.pageTitle}>{locale === "ar" ? "ابقَ على موعد مع الصلاة" : "Stay connected to prayer"}</Text>
      <Text style={styles.pageSubtitle}>{locale === "ar" ? "تحكم بالأذان والتنبيهات والبريد من مكان واحد." : "Control Adhan, phone notifications, and prayer emails in one place."}</Text>

      <View style={styles.settingsCard}>
        <View style={styles.settingIcon}><Text style={styles.settingEmoji}>🕌</Text></View>
        <View style={styles.settingCopy}>
          <Text style={styles.settingTitle}>{locale === "ar" ? "تنبيهات الصلاة والأذان" : "Prayer notifications & Adhan"}</Text>
          <Text style={styles.settingText}>{locale === "ar" ? "تنبيهات قبل الصلاة وتشغيل الأذان الأصلي في وقته." : "Pre-prayer reminders plus the native Adhan at prayer time."}</Text>
          {alertsEnabled ? <Text style={styles.settingStatus}>✓ {scheduledCount} scheduled</Text> : null}
        </View>
        <Switch
          value={alertsEnabled}
          onValueChange={toggleAlerts}
          disabled={busy}
          trackColor={{ false: "#d9ddd9", true: "#95c3b4" }}
          thumbColor={alertsEnabled ? "#0b5b47" : "#f8faf8"}
        />
      </View>

      <Pressable onPress={onOpenEmailAlerts} disabled={!onOpenEmailAlerts} style={styles.emailCard}>
        <View style={styles.emailIcon}><Text style={styles.emailEmoji}>✉️</Text></View>
        <View style={styles.settingCopy}>
          <Text style={styles.settingTitle}>{locale === "ar" ? "تنبيهات الصلاة عبر البريد" : "Prayer email alerts"}</Text>
          <Text style={styles.settingText}>{locale === "ar" ? "يتبع موقعك تلقائياً ويرسل حسب مواقيت الصلاة المحلية." : "Automatically follows your location and local prayer times."}</Text>
        </View>
        <Text style={styles.settingArrow}>›</Text>
      </Pressable>

      <View style={styles.testCard}>
        <Text style={styles.testTitle}>🧪 {locale === "ar" ? "اختبار النظام" : "System tests"}</Text>
        <Text style={styles.testDescription}>{locale === "ar" ? "اختبر التنبيه والأذان دون تغيير ساعة الهاتف." : "Test notifications and locked-screen Adhan without changing the phone clock."}</Text>
        <View style={styles.testRow}>
          <Pressable onPress={testNotification} style={styles.testButton} disabled={busy}>
            <Text style={styles.testButtonIcon}>🔔</Text>
            <Text style={styles.testButtonTitle}>{locale === "ar" ? "اختبار تنبيه" : "Test notification"}</Text>
            <Text style={styles.testButtonMeta}>15 sec</Text>
          </Pressable>
          <Pressable onPress={testAdhan} style={[styles.testButton, styles.testButtonPrimary]} disabled={busy}>
            <Text style={styles.testButtonIcon}>🕌</Text>
            <Text style={[styles.testButtonTitle, styles.testButtonPrimaryText]}>{locale === "ar" ? "اختبار الأذان" : "Test Adhan"}</Text>
            <Text style={[styles.testButtonMeta, styles.testButtonPrimaryMeta]}>30 sec</Text>
          </Pressable>
        </View>
      </View>
    </ScrollView>
  );

  const moreScreen = (
    <SettingsHub
      locale={locale}
      onToggleLocale={toggleLocale}
      onOpenAlerts={() => setActiveTab("alerts")}
      onOpenEmailAlerts={onOpenEmailAlerts}
    />
  );

  const body = activeTab === "quran"
    ? <Quran locale={locale} onBackHome={() => { setQuranAppNavVisible(true); setActiveTab("home"); }} onAppNavVisibilityChange={setQuranAppNavVisible} />
    : activeTab === "quiz"
      ? <IslamicQuiz locale={locale} dateKey={todayKey} stats={quizStats} onStatsChange={setQuizStats} onBackHome={() => setActiveTab("home")} />
      : activeTab === "alerts"
        ? alertsScreen
        : activeTab === "more"
          ? moreScreen
          : homeScreen;

  const navItems: Array<{ tab: AppTab; emoji: string; en: string; ar: string }> = [
    { tab: "home", emoji: "🏠", en: "Home", ar: "الرئيسية" },
    { tab: "quran", emoji: "📖", en: "Qur’an", ar: "القرآن" },
    { tab: "quiz", emoji: "🧠", en: "Quiz", ar: "مسابقة" },
    { tab: "alerts", emoji: "🔔", en: "Alerts", ar: "تنبيهات" },
    { tab: "more", emoji: "•••", en: "More", ar: "المزيد" }
  ];

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom", "left", "right"]}>
      <StatusBar style="dark" />
      <View style={styles.flex}>{body}</View>
      {(activeTab !== "quran" || quranAppNavVisible) ? (
        <View style={styles.bottomNav}>
          {navItems.map((item) => {
            const active = activeTab === item.tab;
            return (
              <Pressable
                key={item.tab}
                onPress={() => setActiveTab(item.tab)}
                style={[styles.navItem, active && styles.navItemActive]}
              >
                <Text style={[styles.navEmoji, active && styles.navEmojiActive]}>{item.emoji}</Text>
                <Text style={[styles.navLabel, active && styles.navLabelActive]}>{locale === "ar" ? item.ar : item.en}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safe: { flex: 1, backgroundColor: "#f7f4ec" },
  loading: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#f7f4ec", gap: 14 },
  loadingText: { color: "#355c52", fontSize: 15 },
  content: { padding: 18, paddingBottom: 28 },
  header: { flexDirection: "row", alignItems: "center", gap: 11, marginBottom: 16 },
  menuButton: { width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "#fff", borderWidth: 1, borderColor: "#e0ddd5" },
  menuIcon: { color: "#173f35", fontSize: 21, fontWeight: "700" },
  headerLogo: { width: 42, height: 42, borderRadius: 13, backgroundColor: "#003d33" },
  brandText: { flex: 1 },
  title: { color: "#173f35", fontSize: 17, fontWeight: "900" },
  subtitle: { color: "#74817c", fontSize: 11, marginTop: 3 },
  languageButton: { minWidth: 46, height: 42, borderWidth: 1, borderColor: "#d8d4ca", borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "#fbf9f4" },
  languageText: { color: "#0b5b47", fontWeight: "900", fontSize: 13 },
  dateHero: { minHeight: 130, flexDirection: "row", alignItems: "center", borderRadius: 24, backgroundColor: "#eee8dc", borderWidth: 1, borderColor: "#e0d8c8", padding: 16, overflow: "hidden" },
  dateCopy: { flex: 1 },
  datePrimary: { color: "#173f35", fontSize: 16, fontWeight: "900" },
  dateHijri: { color: "#577269", fontSize: 12, fontWeight: "700", marginTop: 5 },
  syncRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 12 },
  syncDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#20a269" },
  syncDotSaved: { backgroundColor: "#d5a93b" },
  syncText: { color: "#7b807a", fontSize: 9, fontWeight: "800" },
  mosqueScene: { width: 122, alignItems: "center", justifyContent: "center", position: "relative" },
  sceneSun: { position: "absolute", top: -18, right: 4, fontSize: 26, opacity: 0.8 },
  sceneMosque: { fontSize: 70 },
  nextCard: { backgroundColor: "#0a634d", borderRadius: 27, padding: 19, marginTop: 14, shadowColor: "#164d3f", shadowOpacity: 0.13, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 4 },
  nextTopRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  nextEyebrow: { color: "#c2ddd4", fontSize: 9, fontWeight: "900", letterSpacing: 1.5 },
  nextName: { color: "#fff", fontSize: 35, fontWeight: "900", marginTop: 5 },
  nextArabic: { color: "#cae0d8", fontSize: 15, marginTop: 1 },
  nextIconBubble: { width: 62, height: 62, borderRadius: 21, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,.12)" },
  nextIcon: { fontSize: 32 },
  nextBottomRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 19 },
  nextTime: { color: "#fff", fontSize: 24, fontWeight: "900" },
  countdownPill: { backgroundColor: "rgba(255,255,255,.13)", borderRadius: 99, paddingHorizontal: 11, paddingVertical: 7 },
  countdownText: { color: "#e7f2ee", fontSize: 11, fontWeight: "800" },
  progressTrack: { height: 4, backgroundColor: "rgba(255,255,255,.17)", borderRadius: 3, marginTop: 15, overflow: "hidden" },
  progressFill: { width: "56%", height: 4, backgroundColor: "#f2cc72", borderRadius: 3 },
  sectionHeadingRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 23, marginBottom: 10 },
  sectionTitle: { color: "#173f35", fontSize: 19, fontWeight: "900" },
  sectionMeta: { color: "#77837e", fontSize: 10, fontWeight: "700" },
  prayerList: { backgroundColor: "#fff", borderRadius: 22, borderWidth: 1, borderColor: "#dfddd5", overflow: "hidden" },
  prayerRow: { minHeight: 67, flexDirection: "row", alignItems: "center", paddingHorizontal: 13, borderBottomWidth: 1, borderBottomColor: "#efede8" },
  prayerRowActive: { backgroundColor: "#dff2e9", borderLeftWidth: 4, borderLeftColor: "#0b654f" },
  prayerIconWrap: { width: 39, height: 39, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "#f1f3ef", marginRight: 11 },
  prayerIconWrapActive: { backgroundColor: "#d8eee5" },
  prayerIcon: { fontSize: 20 },
  prayerNameBlock: { flex: 1 },
  prayerSubRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  tomorrowTag: { color: "#0b654f", backgroundColor: "#cce8dc", borderRadius: 99, paddingHorizontal: 6, paddingVertical: 2, fontSize: 7, fontWeight: "900", overflow: "hidden" },
  prayerName: { color: "#173f35", fontSize: 14, fontWeight: "900" },
  prayerOtherName: { color: "#8a9691", fontSize: 11, marginTop: 1 },
  prayerTime: { color: "#173f35", fontSize: 15, fontWeight: "900" },
  prayerActiveText: { color: "#0a654f" },
  prayerActiveMuted: { color: "#679385" },
  emptyText: { padding: 18, color: "#75827d" },
  quizCard: { marginTop: 16, borderRadius: 23, backgroundColor: "#fff", borderWidth: 1, borderColor: "#dedbd2", padding: 15 },
  quizTopRow: { flexDirection: "row", alignItems: "center", gap: 11 },
  quizIconWrap: { width: 49, height: 49, borderRadius: 17, backgroundColor: "#f0e9d7", alignItems: "center", justifyContent: "center" },
  quizIcon: { fontSize: 25 },
  quizCopy: { flex: 1 },
  quizEyebrow: { color: "#a27d32", fontSize: 8, fontWeight: "900", letterSpacing: 1.2 },
  quizTitle: { color: "#173f35", fontSize: 17, fontWeight: "900", marginTop: 2 },
  quizDescription: { color: "#78837e", fontSize: 10, lineHeight: 14, marginTop: 2 },
  quizArrow: { color: "#0b5b47", fontSize: 27 },
  quizStats: { flexDirection: "row", gap: 7, marginTop: 13 },
  quizStat: { flex: 1, minHeight: 67, backgroundColor: "#f7f6f1", borderRadius: 15, alignItems: "center", justifyContent: "center", padding: 6 },
  quizStatEmoji: { fontSize: 17 },
  quizStatValue: { color: "#244e43", fontSize: 11, fontWeight: "900", marginTop: 2, textAlign: "center" },
  quizStatLabel: { color: "#919994", fontSize: 8, marginTop: 1 },
  quizNextBadge: { color: "#7c785f", fontSize: 9, fontWeight: "700", marginTop: 10, textAlign: "center" },
  smartGrid: { flexDirection: "row", gap: 10, marginTop: 14 },
  smartCard: { flex: 1, minHeight: 104, borderRadius: 21, backgroundColor: "#fff", borderWidth: 1, borderColor: "#e1ded6", padding: 14 },
  smartEmoji: { fontSize: 24 },
  smartTitle: { color: "#173f35", fontSize: 14, fontWeight: "900", marginTop: 7 },
  smartText: { color: "#89938f", fontSize: 10, marginTop: 2 },
  inspirationCard: { flexDirection: "row", gap: 12, marginTop: 14, borderRadius: 22, backgroundColor: "#f0ebe1", padding: 15 },
  inspirationIcon: { width: 47, height: 47, borderRadius: 16, backgroundColor: "#fff9ec", alignItems: "center", justifyContent: "center" },
  inspirationEmoji: { fontSize: 25 },
  inspirationCopy: { flex: 1 },
  inspirationEyebrow: { color: "#a58448", fontSize: 8, fontWeight: "900", letterSpacing: 1.2 },
  inspirationText: { color: "#304f47", fontSize: 13, fontWeight: "800", lineHeight: 18, marginTop: 3 },
  inspirationRef: { color: "#8a8b7f", fontSize: 9, fontWeight: "700", marginTop: 4 },
  footer: { color: "#8a928e", fontSize: 9, textAlign: "center", marginTop: 22 },
  pageEyebrow: { color: "#17705b", fontSize: 10, fontWeight: "900", letterSpacing: 1.5, marginTop: 2 },
  pageTitle: { color: "#173f35", fontSize: 29, lineHeight: 34, fontWeight: "900", marginTop: 5 },
  pageSubtitle: { color: "#75827d", fontSize: 13, lineHeight: 19, marginTop: 5, marginBottom: 17 },
  settingsCard: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#fff", borderRadius: 22, borderWidth: 1, borderColor: "#dfddd5", padding: 15 },
  settingIcon: { width: 48, height: 48, borderRadius: 16, backgroundColor: "#e8f3ee", alignItems: "center", justifyContent: "center" },
  settingEmoji: { fontSize: 24 },
  settingCopy: { flex: 1 },
  settingTitle: { color: "#173f35", fontSize: 14, fontWeight: "900" },
  settingText: { color: "#7c8984", fontSize: 10, lineHeight: 15, marginTop: 3 },
  settingStatus: { color: "#087052", fontSize: 9, fontWeight: "900", marginTop: 5 },
  settingArrow: { color: "#0b5b47", fontSize: 28 },
  emailCard: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#f0ebe1", borderRadius: 22, borderWidth: 1, borderColor: "#dfd6c6", padding: 15, marginTop: 11 },
  emailIcon: { width: 48, height: 48, borderRadius: 16, backgroundColor: "#fffaf0", alignItems: "center", justifyContent: "center" },
  emailEmoji: { fontSize: 23 },
  testCard: { marginTop: 12, padding: 17, borderRadius: 22, backgroundColor: "#fff", borderWidth: 1, borderColor: "#dfddd5" },
  testTitle: { color: "#173f35", fontSize: 16, fontWeight: "900" },
  testDescription: { color: "#75827d", fontSize: 11, lineHeight: 17, marginTop: 4 },
  testRow: { flexDirection: "row", gap: 9, marginTop: 13 },
  testButton: { flex: 1, minHeight: 85, borderRadius: 17, borderWidth: 1, borderColor: "#d7e2dd", backgroundColor: "#f7faf8", padding: 11, justifyContent: "center" },
  testButtonPrimary: { backgroundColor: "#0b5b47", borderColor: "#0b5b47" },
  testButtonIcon: { fontSize: 20 },
  testButtonTitle: { color: "#164b3e", fontSize: 11, fontWeight: "900", marginTop: 5 },
  testButtonMeta: { color: "#8b9792", fontSize: 9, marginTop: 2 },
  testButtonPrimaryText: { color: "#fff" },
  testButtonPrimaryMeta: { color: "#bdd9cf" },
  moreRow: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 72, backgroundColor: "#fff", borderRadius: 20, borderWidth: 1, borderColor: "#e0ddd5", paddingHorizontal: 14, marginBottom: 9 },
  moreEmoji: { fontSize: 24 },
  moreCopy: { flex: 1 },
  moreTitle: { color: "#173f35", fontSize: 13, fontWeight: "900" },
  moreText: { color: "#85908c", fontSize: 10, lineHeight: 14, marginTop: 2 },
  sourceCard: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 72, backgroundColor: "#edf6f1", borderRadius: 20, paddingHorizontal: 14, marginTop: 4 },
  sourceEmoji: { fontSize: 24 },
  bottomNav: { minHeight: 68, flexDirection: "row", alignItems: "center", justifyContent: "space-around", backgroundColor: "#fff", borderTopWidth: 1, borderTopColor: "#e4e1d9", paddingHorizontal: 8, paddingTop: 5 },
  navItem: { flex: 1, minHeight: 54, alignItems: "center", justifyContent: "center", borderRadius: 16 },
  navItemActive: { backgroundColor: "#edf5f1" },
  navEmoji: { fontSize: 17, color: "#6c7974" },
  navEmojiActive: { color: "#0b5b47" },
  navLabel: { color: "#7f8a85", fontSize: 9, fontWeight: "700", marginTop: 2 },
  navLabelActive: { color: "#0b5b47", fontWeight: "900" }
});
