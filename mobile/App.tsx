import AsyncStorage from "@react-native-async-storage/async-storage";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View
} from "react-native";
import { CITY_LABEL, STORAGE_KEYS } from "./src/config";
import { disablePrayerNotifications, schedulePrayerNotifications } from "./src/notifications";
import { openExactAlarmSettings } from "./src/prayerAudio";
import { loadPrayerTimes } from "./src/prayerData";
import { registerDeviceForServerPush } from "./src/push";
import { formatPrayerTime, timeToMinutes, windsorDateKey, windsorSecondsSinceMidnight } from "./src/time";
import { PRAYER_KEYS, type PrayerKey, type PrayerTimes } from "./src/types";

const NAMES: Record<PrayerKey, { en: string; ar: string }> = {
  fajr: { en: "Fajr", ar: "الفجر" },
  dhuhr: { en: "Dhuhr", ar: "الظهر" },
  asr: { en: "Asr", ar: "العصر" },
  maghrib: { en: "Maghrib", ar: "المغرب" },
  isha: { en: "Isha", ar: "العشاء" }
};

function nextPrayerFor(day: PrayerTimes[string] | undefined, now = new Date()) {
  if (!day) return null;
  const currentSeconds = windsorSecondsSinceMidnight(now);
  for (const prayer of PRAYER_KEYS) {
    const seconds = timeToMinutes(day[prayer]) * 60;
    if (seconds > currentSeconds) return { prayer, secondsRemaining: seconds - currentSeconds };
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

export default function App() {
  const [now, setNow] = useState(new Date());
  const [prayerTimes, setPrayerTimes] = useState<PrayerTimes>({});
  const [live, setLive] = useState(false);
  const [locale, setLocale] = useState<"en" | "ar">("en");
  const [alertsEnabled, setAlertsEnabled] = useState(false);
  const [busy, setBusy] = useState(true);
  const [scheduledCount, setScheduledCount] = useState(0);

  const todayKey = windsorDateKey(now);
  const today = prayerTimes[todayKey];
  const next = useMemo(() => nextPrayerFor(today, now), [now, today]);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1_000);
    void (async () => {
      const [savedLocale, savedAlerts, loaded] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.locale),
        AsyncStorage.getItem(STORAGE_KEYS.alertsEnabled),
        loadPrayerTimes()
      ]);
      const chosenLocale = savedLocale === "ar" ? "ar" : "en";
      setLocale(chosenLocale);
      setAlertsEnabled(savedAlerts === "on");
      setPrayerTimes(loaded.prayerTimes);
      setLive(loaded.live);
      setBusy(false);

      if (savedAlerts === "on") {
        const result = await schedulePrayerNotifications(loaded.prayerTimes, chosenLocale);
        setScheduledCount(result.count);
        void registerDeviceForServerPush(chosenLocale).catch(() => undefined);
      }
    })();
    return () => clearInterval(timer);
  }, []);

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

  if (busy && !today) {
    return (
      <SafeAreaView style={styles.loading}>
        <ActivityIndicator color="#0b5b47" size="large" />
        <Text style={styles.loadingText}>Loading Windsor prayer times…</Text>
      </SafeAreaView>
    );
  }

  const date = new Date(`${todayKey}T12:00:00`);
  const weekday = new Intl.DateTimeFormat(locale === "ar" ? "ar-CA" : "en-CA", { weekday: "long" }).format(date);
  const fullDate = new Intl.DateTimeFormat(locale === "ar" ? "ar-CA" : "en-CA", {
    year: "numeric",
    month: "long",
    day: "numeric"
  }).format(date);

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View style={styles.brandMark}><Text style={styles.brandLetter}>و</Text></View>
          <View style={styles.brandText}>
            <Text style={styles.title}>{locale === "ar" ? "مواقيت الصلاة في وندسور" : "Windsor Prayer Times"}</Text>
            <Text style={styles.subtitle}>{CITY_LABEL}</Text>
          </View>
          <Pressable onPress={toggleLocale} style={styles.languageButton}>
            <Text style={styles.languageText}>{locale === "en" ? "AR" : "EN"}</Text>
          </Pressable>
        </View>

        <View style={styles.syncPill}>
          <View style={[styles.syncDot, !live && styles.syncDotSaved]} />
          <Text style={styles.syncText}>{live ? "Synced from WOPT" : "Using saved WOPT schedule"}</Text>
        </View>

        <Text style={styles.eyebrow}>{CITY_LABEL.toUpperCase()}</Text>
        <Text style={styles.weekday}>{weekday}</Text>
        <Text style={styles.date}>{fullDate}</Text>

        {today && next ? (
          <View style={styles.nextCard}>
            <Text style={styles.nextEyebrow}>{locale === "ar" ? "الصلاة القادمة" : "NEXT PRAYER"}</Text>
            <Text style={styles.nextName}>{NAMES[next.prayer][locale]}</Text>
            <View style={styles.nextRow}>
              <View>
                <Text style={styles.nextLabel}>{locale === "ar" ? "تبدأ الساعة" : "BEGINS AT"}</Text>
                <Text style={styles.nextValue}>{formatPrayerTime(today[next.prayer], locale)}</Text>
              </View>
              <View style={styles.nextDivider} />
              <View>
                <Text style={styles.nextLabel}>{locale === "ar" ? "الوقت المتبقي" : "TIME LEFT"}</Text>
                <Text style={styles.nextValue}>{countdownLabel(next.secondsRemaining, locale)}</Text>
              </View>
            </View>
          </View>
        ) : null}

        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.eyebrow}>{locale === "ar" ? "الجدول اليومي" : "DAILY SCHEDULE"}</Text>
            <Text style={styles.sectionTitle}>{locale === "ar" ? "الصلوات الخمس" : "Daily prayers"}</Text>
          </View>
        </View>

        <View style={styles.prayerList}>
          {today
            ? PRAYER_KEYS.map((prayer, index) => {
                const active = next?.prayer === prayer;
                return (
                  <View key={prayer} style={[styles.prayerCard, active && styles.prayerCardActive]}>
                    <Text style={[styles.prayerNumber, active && styles.prayerActiveText]}>{String(index + 1).padStart(2, "0")}</Text>
                    <View style={styles.prayerNameBlock}>
                      <Text style={[styles.prayerName, active && styles.prayerActiveText]}>{NAMES[prayer][locale]}</Text>
                      <Text style={[styles.prayerOtherName, active && styles.prayerActiveMuted]}>{NAMES[prayer][locale === "en" ? "ar" : "en"]}</Text>
                    </View>
                    <Text style={[styles.prayerTime, active && styles.prayerActiveText]}>{formatPrayerTime(today[prayer], locale)}</Text>
                  </View>
                );
              })
            : <Text>No prayer schedule is available for {todayKey}.</Text>}
        </View>

        <View style={styles.alertCard}>
          <View style={styles.alertCopy}>
            <Text style={styles.alertTitle}>{locale === "ar" ? "تنبيهات الصلاة" : "Prayer notifications"}</Text>
            <Text style={styles.alertDescription}>
              {locale === "ar"
                ? "نفس نغمة التنبيه قبل ٢٠ و١٠ دقائق. عند الفجر يُشغّل أذان الفجر فقط، وللصلوات الأخرى يُشغّل الأذان ثم الدعاء."
                : "The same chime at 20 and 10 minutes before prayer. Fajr plays its own Adhan only; the other prayers play the Adhan followed by the dua."}
            </Text>
            {alertsEnabled ? <Text style={styles.alertStatus}>{scheduledCount} native alerts and Adhans scheduled</Text> : null}
          </View>
          <Switch
            value={alertsEnabled}
            onValueChange={toggleAlerts}
            disabled={busy}
            trackColor={{ false: "#d4d2ca", true: "#8bbdac" }}
            thumbColor={alertsEnabled ? "#0b5b47" : "#f7f5ef"}
          />
        </View>

        <Text style={styles.footer}>Official Windsor Islamic Association schedule • America/Toronto</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f5f2e9" },
  loading: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#f5f2e9", gap: 14 },
  loadingText: { color: "#355c52", fontSize: 15 },
  content: { padding: 22, paddingBottom: 56 },
  header: { flexDirection: "row", alignItems: "center", marginBottom: 28 },
  brandMark: { width: 48, height: 48, borderRadius: 16, backgroundColor: "#0b5b47", alignItems: "center", justifyContent: "center" },
  brandLetter: { color: "#fff", fontSize: 26, fontWeight: "800" },
  brandText: { flex: 1, marginLeft: 12 },
  title: { color: "#153f35", fontSize: 17, fontWeight: "800" },
  subtitle: { color: "#6a7c77", fontSize: 12, marginTop: 3 },
  languageButton: { borderWidth: 1, borderColor: "#cfd9d3", borderRadius: 14, paddingHorizontal: 15, paddingVertical: 11 },
  languageText: { color: "#0b5b47", fontWeight: "800" },
  syncPill: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 99, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: "#ebece5", marginBottom: 30 },
  syncDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#20a269" },
  syncDotSaved: { backgroundColor: "#d9b85f" },
  syncText: { fontSize: 12, color: "#48665e", fontWeight: "700" },
  eyebrow: { color: "#17705b", fontSize: 12, fontWeight: "900", letterSpacing: 2.2 },
  weekday: { color: "#123b31", fontSize: 50, fontWeight: "900", letterSpacing: -2, marginTop: 8 },
  date: { color: "#516d65", fontSize: 20, marginTop: 8, marginBottom: 26 },
  nextCard: { backgroundColor: "#075844", borderRadius: 32, padding: 28, marginBottom: 38 },
  nextEyebrow: { color: "#b5d4ca", fontSize: 12, fontWeight: "900", letterSpacing: 2 },
  nextName: { color: "#fff", fontSize: 48, fontWeight: "900", marginTop: 12 },
  nextRow: { flexDirection: "row", alignItems: "center", marginTop: 32 },
  nextLabel: { color: "#acd0c4", fontSize: 11, fontWeight: "800", letterSpacing: 1.4 },
  nextValue: { color: "#fff", fontSize: 24, fontWeight: "900", marginTop: 8 },
  nextDivider: { width: 1, height: 52, backgroundColor: "rgba(255,255,255,.18)", marginHorizontal: 24 },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 18 },
  sectionTitle: { color: "#153f35", fontSize: 31, fontWeight: "900", marginTop: 7 },
  prayerList: { gap: 12 },
  prayerCard: { minHeight: 78, flexDirection: "row", alignItems: "center", borderRadius: 22, backgroundColor: "#fbfaf6", borderWidth: 1, borderColor: "#d7dfda", paddingHorizontal: 18 },
  prayerCardActive: { backgroundColor: "#0b5b47", borderColor: "#0b5b47" },
  prayerNumber: { width: 36, color: "#9aa9a3", fontWeight: "800" },
  prayerNameBlock: { flex: 1 },
  prayerName: { color: "#173f35", fontSize: 19, fontWeight: "900" },
  prayerOtherName: { color: "#71837d", fontSize: 13, marginTop: 2 },
  prayerTime: { color: "#173f35", fontSize: 20, fontWeight: "900" },
  prayerActiveText: { color: "#fff" },
  prayerActiveMuted: { color: "#b8d7cd" },
  alertCard: { flexDirection: "row", alignItems: "center", marginTop: 28, padding: 22, borderRadius: 26, backgroundColor: "#fff", borderWidth: 1, borderColor: "#d7dfda" },
  alertCopy: { flex: 1, paddingRight: 14 },
  alertTitle: { color: "#173f35", fontSize: 20, fontWeight: "900" },
  alertDescription: { color: "#617871", fontSize: 14, lineHeight: 21, marginTop: 6 },
  alertStatus: { color: "#0b7a5c", fontSize: 12, fontWeight: "800", marginTop: 10 },
  footer: { color: "#7f8d88", fontSize: 11, textAlign: "center", marginTop: 28 }
});
