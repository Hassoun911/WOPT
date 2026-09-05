import { useMemo } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View
} from "react-native";
import type { PrayerAlertPreferences } from "./alertPreferences";
import PrayerAlertPreferenceGrid from "./PrayerAlertPreferenceGrid";
import type { LoadedPrayerTimes } from "./prayerData";
import { addDateDays, dateKeyInZone, formatPrayerTime, localToDateInZone } from "./time";
import { PRAYER_KEYS, type PrayerKey } from "./types";

type Locale = "en" | "ar";

type Props = {
  locale: Locale;
  context: LoadedPrayerTimes | null;
  refreshing: boolean;
  alertsEnabled: boolean;
  alertPreferencesBusy: boolean;
  preferences: PrayerAlertPreferences;
  scheduledCount: number;
  onRefresh: () => Promise<void> | void;
  onMenu: () => void;
  onToggleLocale: () => void;
  onOpenQibla: () => void;
  onOpenAlerts: () => void;
  onToggleAlerts: (enabled: boolean) => void;
  onChangePreferences: (next: PrayerAlertPreferences) => void;
  onTogglePrayerAudio: (prayer: PrayerKey) => void;
};

const NAMES: Record<PrayerKey, { en: string; ar: string }> = {
  fajr: { en: "Fajr", ar: "الفجر" },
  dhuhr: { en: "Dhuhr", ar: "الظهر" },
  asr: { en: "Asr", ar: "العصر" },
  maghrib: { en: "Maghrib", ar: "المغرب" },
  isha: { en: "Isha", ar: "العشاء" }
};

const GLYPHS: Record<PrayerKey, string> = {
  fajr: "◒",
  dhuhr: "☀︎",
  asr: "◐",
  maghrib: "◓",
  isha: "☾"
};

function nextPrayer(context: LoadedPrayerTimes, now: Date) {
  const zone = context.location.timezone;
  const currentKey = dateKeyInZone(now, zone);
  for (let offset = 0; offset <= 7; offset += 1) {
    const key = addDateDays(currentKey, offset);
    const day = context.prayerTimes[key];
    if (!day) continue;
    for (const prayer of PRAYER_KEYS) {
      const target = localToDateInZone(key, day[prayer], zone);
      const deltaMs = target.getTime() - now.getTime();
      if (deltaMs > 0) {
        return {
          prayer,
          time: day[prayer],
          secondsRemaining: Math.ceil(deltaMs / 1000),
          tomorrow: key !== currentKey
        };
      }
    }
  }
  return null;
}

function countdownParts(total: number) {
  const seconds = Math.max(0, Math.floor(total));
  return {
    h: String(Math.floor(seconds / 3600)).padStart(2, "0"),
    m: String(Math.floor((seconds % 3600) / 60)).padStart(2, "0"),
    s: String(seconds % 60).padStart(2, "0")
  };
}

function hijriLabel(date: Date, locale: Locale, timeZone: string) {
  try {
    return new Intl.DateTimeFormat(locale === "ar" ? "ar-u-ca-islamic-umalqura" : "en-u-ca-islamic-umalqura", {
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone
    }).format(date);
  } catch {
    return "";
  }
}

export default function HomePrayerPage({
  locale,
  context,
  refreshing,
  alertsEnabled,
  alertPreferencesBusy,
  preferences,
  scheduledCount,
  onRefresh,
  onMenu,
  onToggleLocale,
  onOpenQibla,
  onOpenAlerts,
  onToggleAlerts,
  onChangePreferences,
  onTogglePrayerAudio
}: Props) {
  const now = new Date();
  const zone = context?.location.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  const todayKey = dateKeyInZone(now, zone);
  const today = context?.prayerTimes[todayKey];
  const next = useMemo(() => context ? nextPrayer(context, now) : null, [context, todayKey, Math.floor(now.getTime() / 1000)]);
  const countdown = next ? countdownParts(next.secondsRemaining) : null;
  const shortDate = new Intl.DateTimeFormat(locale === "ar" ? "ar-CA" : "en-CA", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: zone
  }).format(now);
  const hijri = hijriLabel(now, locale, zone);

  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      alwaysBounceVertical
      overScrollMode="always"
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => { void onRefresh(); }}
          progressViewOffset={8}
          enabled
        />
      }
    >
      <View style={styles.header}>
        <Pressable onPress={onMenu} style={styles.menuButton}><Text style={styles.menuIcon}>☰</Text></Pressable>
        <Image source={require("../assets/hassoun-logo.png")} style={styles.headerLogo} />
        <View style={styles.brandText}>
          <Text style={styles.title}>Hassoun</Text>
          <Text numberOfLines={1} style={styles.subtitle}>📍 {context?.location.label || (locale === "ar" ? "جارٍ تحديد الموقع" : "Locating…")} • {locale === "ar" ? "مواقيت الصلاة" : "Prayer Times"}</Text>
        </View>
        <Pressable onPress={onToggleLocale} style={styles.languageButton}><Text style={styles.languageText}>{locale === "en" ? "AR" : "EN"}</Text></Pressable>
      </View>

      <View style={styles.dateHero}>
        <View style={styles.dateCopy}>
          <Text style={styles.datePrimary}>{shortDate}</Text>
          {hijri ? <Text style={styles.dateHijri}>🌙 {hijri}</Text> : null}
          <View style={styles.syncRow}>
            <View style={[styles.syncDot, !context?.live && styles.syncDotSaved]} />
            <Text style={styles.syncText}>{context ? (context.location.source === "windsor_islamic_association" ? "Windsor Islamic Association • official Adhan time" : context.location.source === "aladhan" ? "Local Adhan calculation • device location" : "Saved prayer schedule") : "Loading prayer context"}</Text>
          </View>
        </View>
        <View style={styles.heroLogoShell}><Image source={require("../assets/hassoun-logo.png")} resizeMode="contain" style={styles.heroLogo} /></View>
      </View>

      {!context ? (
        <View style={styles.loadingCard}><ActivityIndicator size="small" /><Text style={styles.loadingText}>{locale === "ar" ? "جارٍ تحميل مواقيت الصلاة…" : "Loading prayer times…"}</Text></View>
      ) : null}

      {next ? (
        <View style={styles.nextCard}>
          <View style={styles.nextLeft}>
            <Text style={styles.eyebrow}>{locale === "ar" ? "الصلاة القادمة" : "NEXT PRAYER"}</Text>
            <View style={styles.nameRow}><Text style={styles.nextArabic}>{NAMES[next.prayer].ar}</Text><Text style={styles.nextEnglish}>{NAMES[next.prayer].en}</Text></View>
            <Text style={styles.nextTime}>{formatPrayerTime(next.time, locale)}</Text>
            {next.tomorrow ? <Text style={styles.tomorrow}>{locale === "ar" ? "غداً" : "Tomorrow"}</Text> : null}
          </View>
          <View style={styles.countdownCard}>
            <Text style={styles.countdownTitle}>{locale === "ar" ? "الوقت المتبقي" : "TIME LEFT"}</Text>
            <View style={styles.countdownValues}>
              <View style={styles.countdownUnit}><Text style={styles.countdownNumber}>{countdown?.h}</Text><Text style={styles.countdownLabel}>HRS</Text></View>
              <Text style={styles.colon}>:</Text>
              <View style={styles.countdownUnit}><Text style={styles.countdownNumber}>{countdown?.m}</Text><Text style={styles.countdownLabel}>MIN</Text></View>
              <Text style={styles.colon}>:</Text>
              <View style={styles.countdownUnit}><Text style={styles.countdownNumber}>{countdown?.s}</Text><Text style={styles.countdownLabel}>SEC</Text></View>
            </View>
          </View>
        </View>
      ) : null}

      <Text style={styles.sectionTitle}>{locale === "ar" ? "مواقيت الصلاة اليوم" : "Today’s Prayer Times"}</Text>
      <Text style={styles.sectionHint}>{locale === "ar" ? "يمكنك كتم أو تشغيل أذان كل صلاة بشكل مستقل" : "Mute or unmute the Adhan for each prayer separately"}</Text>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.cardsRow}>
        {today ? PRAYER_KEYS.map((prayer) => {
          const active = next?.prayer === prayer && !next.tomorrow;
          const muted = !preferences[prayer].athan;
          return (
            <View key={prayer} style={[styles.prayerCard, active && styles.prayerCardActive]}>
              {active ? <View style={styles.nextBadge}><Text style={styles.nextBadgeText}>NEXT</Text></View> : null}
              <Text style={[styles.glyph, active && styles.activeGold]}>{GLYPHS[prayer]}</Text>
              <Text style={[styles.prayerArabic, active && styles.activeWhite]}>{NAMES[prayer].ar}</Text>
              <Text style={[styles.prayerEnglish, active && styles.activeSub]}>{NAMES[prayer].en}</Text>
              <Text style={[styles.prayerTime, active && styles.activeWhite]}>{formatPrayerTime(today[prayer], locale)}</Text>
              <Pressable onPress={() => onTogglePrayerAudio(prayer)} style={[styles.audioButton, muted && styles.audioButtonMuted]}>
                <Text style={[styles.audioText, muted && styles.audioTextMuted]}>{muted ? (locale === "ar" ? "مكتوم" : "MUTED") : (locale === "ar" ? "الأذان" : "ADHAN")}</Text>
              </Pressable>
            </View>
          );
        }) : <Text style={styles.empty}>{locale === "ar" ? "لا يوجد جدول صلاة متاح اليوم." : "No prayer schedule is available today."}</Text>}
      </ScrollView>

      <Pressable onPress={onOpenQibla} style={styles.qiblaCard}>
        <View style={styles.qiblaIconShell}><Text style={styles.qiblaIcon}>🕋</Text></View>
        <View style={styles.qiblaCopy}><Text style={styles.qiblaEyebrow}>{locale === "ar" ? "اتجاه القبلة" : "QIBLA DIRECTION"}</Text><Text style={styles.qiblaTitle}>{locale === "ar" ? "افتح بوصلة القبلة" : "Open the Qibla compass"}</Text><Text style={styles.qiblaText}>{context?.location.label || ""}</Text></View>
        <Text style={styles.chevron}>›</Text>
      </Pressable>

      <View style={styles.subscriptionCard}>
        <View style={styles.subscriptionHeader}>
          <View style={styles.subscriptionIcon}><Text style={styles.subscriptionIconText}>🔔</Text></View>
          <View style={styles.subscriptionCopy}>
            <Text style={styles.subscriptionEyebrow}>{locale === "ar" ? "اشتراك تنبيهات الصلاة" : "PRAYER SUBSCRIPTION"}</Text>
            <Text style={styles.subscriptionTitle}>{locale === "ar" ? "تنبيهات الصلاة لهذا الهاتف" : "Prayer alerts for this phone"}</Text>
            <Text style={styles.subscriptionText}>{locale === "ar" ? "اختر تنبيهات ٢٠ دقيقة و١٠ دقائق والأذان لكل صلاة." : "Choose 20-minute, 10-minute and prayer-time Adhan alerts for each prayer."}</Text>
          </View>
          <Switch value={alertsEnabled} onValueChange={onToggleAlerts} disabled={alertPreferencesBusy} />
        </View>
        {alertsEnabled ? <Text style={styles.scheduledText}>✓ {scheduledCount} {locale === "ar" ? "تنبيه/أذان مجدول" : "scheduled prayer events"}</Text> : null}
        <PrayerAlertPreferenceGrid locale={locale} value={preferences} onChange={onChangePreferences} disabled={alertPreferencesBusy} />
        <Pressable onPress={onOpenAlerts} style={styles.manageButton}><Text style={styles.manageButtonText}>{locale === "ar" ? "إدارة جميع إعدادات التنبيهات" : "Manage all alert settings"}</Text><Text style={styles.manageArrow}>›</Text></Pressable>
      </View>

      <Text style={styles.footer}>{context?.location.source === "windsor_islamic_association" ? "Official Windsor Islamic Association schedule" : context?.location.source === "aladhan" ? "AlAdhan calculation using device location" : "Saved prayer schedule"}</Text>
    </ScrollView>
  );
}

const gold = "#d7b45e";
const green = "#075f4a";
const deepGreen = "#034b3d";

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: "#f7f7f2" },
  content: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 120, flexGrow: 1 },
  header: { flexDirection: "row", alignItems: "center", minHeight: 58, gap: 8 },
  menuButton: { width: 38, height: 38, borderRadius: 14, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#e2e4df" },
  menuIcon: { color: "#17483c", fontSize: 20, fontWeight: "900" },
  headerLogo: { width: 42, height: 42, borderRadius: 12 },
  brandText: { flex: 1, minWidth: 0 },
  title: { color: "#123f34", fontSize: 20, fontWeight: "900" },
  subtitle: { color: "#6d7f78", fontSize: 10, fontWeight: "700", marginTop: 1 },
  languageButton: { minWidth: 42, height: 36, borderRadius: 12, backgroundColor: "#0b5b47", alignItems: "center", justifyContent: "center" },
  languageText: { color: "#fff", fontSize: 12, fontWeight: "900" },
  dateHero: { marginTop: 10, borderRadius: 22, backgroundColor: "#fff", borderWidth: 1, borderColor: "#e0e1dc", padding: 15, flexDirection: "row", alignItems: "center" },
  dateCopy: { flex: 1 },
  datePrimary: { color: "#143e34", fontSize: 18, fontWeight: "900" },
  dateHijri: { color: "#8b753c", fontSize: 11, fontWeight: "800", marginTop: 4 },
  syncRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8 },
  syncDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#2c9a6b" },
  syncDotSaved: { backgroundColor: "#b59b55" },
  syncText: { color: "#7a8580", fontSize: 9, flex: 1 },
  heroLogoShell: { width: 58, height: 58, borderRadius: 18, overflow: "hidden", backgroundColor: "#f5f1e5" },
  heroLogo: { width: "100%", height: "100%" },
  loadingCard: { marginTop: 12, borderRadius: 16, backgroundColor: "#fff", padding: 14, flexDirection: "row", gap: 10, alignItems: "center" },
  loadingText: { color: "#315c51", fontWeight: "700" },
  nextCard: { marginTop: 14, borderRadius: 28, backgroundColor: green, padding: 18, borderWidth: 1, borderColor: "#b99a4f", flexDirection: "row", gap: 12 },
  nextLeft: { flex: 1 },
  eyebrow: { color: "#e3c779", fontSize: 9, fontWeight: "900", letterSpacing: 1.6 },
  nameRow: { flexDirection: "row", alignItems: "baseline", gap: 7, marginTop: 6, flexWrap: "wrap" },
  nextArabic: { color: "#fff", fontSize: 32, fontWeight: "900" },
  nextEnglish: { color: "#e5c979", fontSize: 14, fontWeight: "800" },
  nextTime: { color: "#fff", fontSize: 28, fontWeight: "900", marginTop: 4 },
  tomorrow: { color: "#f2ddb0", fontSize: 9, fontWeight: "900", marginTop: 5 },
  countdownCard: { width: 160, minHeight: 120, borderRadius: 21, backgroundColor: "rgba(2,55,45,.56)", borderWidth: 1, borderColor: "rgba(225,195,113,.58)", justifyContent: "center", padding: 10 },
  countdownTitle: { color: "#e8ca77", fontSize: 9, fontWeight: "900", textAlign: "center", marginBottom: 8 },
  countdownValues: { flexDirection: "row", justifyContent: "center", alignItems: "flex-start" },
  countdownUnit: { minWidth: 35, alignItems: "center" },
  countdownNumber: { color: "#fff", fontSize: 22, fontWeight: "900", fontVariant: ["tabular-nums"] },
  countdownLabel: { color: "#b9d2ca", fontSize: 7, fontWeight: "800" },
  colon: { color: "#e8ca77", fontSize: 20, fontWeight: "900" },
  sectionTitle: { color: "#173f35", fontSize: 19, fontWeight: "900", marginTop: 22 },
  sectionHint: { color: "#7b8984", fontSize: 9, marginTop: 3, marginBottom: 10 },
  cardsRow: { gap: 9, paddingRight: 18, paddingBottom: 3 },
  prayerCard: { width: 118, minHeight: 202, borderRadius: 22, backgroundColor: "#fffdf8", borderWidth: 1, borderColor: "#ded9ce", padding: 10, alignItems: "center" },
  prayerCardActive: { backgroundColor: deepGreen, borderColor: gold, borderWidth: 1.5 },
  nextBadge: { position: "absolute", top: 8, right: 8, borderRadius: 99, backgroundColor: gold, paddingHorizontal: 6, paddingVertical: 2 },
  nextBadgeText: { color: deepGreen, fontSize: 6.5, fontWeight: "900" },
  glyph: { color: "#a77f2d", fontSize: 30, marginTop: 15, marginBottom: 6 },
  activeGold: { color: "#f1d689" },
  prayerArabic: { color: "#183f35", fontSize: 16, fontWeight: "900" },
  prayerEnglish: { color: "#78857f", fontSize: 10, fontWeight: "700", marginTop: 1 },
  prayerTime: { color: "#123e34", fontSize: 14, fontWeight: "900", marginTop: 8 },
  activeWhite: { color: "#fff" },
  activeSub: { color: "#c7ddd5" },
  audioButton: { marginTop: "auto", minWidth: 88, minHeight: 31, borderRadius: 12, backgroundColor: "#e8f3ee", alignItems: "center", justifyContent: "center", paddingHorizontal: 8 },
  audioButtonMuted: { backgroundColor: "#efefeb" },
  audioText: { color: "#0a684f", fontSize: 8, fontWeight: "900" },
  audioTextMuted: { color: "#8a918e" },
  empty: { color: "#75827d", paddingVertical: 30 },
  qiblaCard: { marginTop: 16, borderRadius: 23, backgroundColor: "#fff", borderWidth: 1, borderColor: "#dedfd9", padding: 15, flexDirection: "row", alignItems: "center", gap: 12 },
  qiblaIconShell: { width: 52, height: 52, borderRadius: 17, backgroundColor: "#edf3ef", alignItems: "center", justifyContent: "center" },
  qiblaIcon: { fontSize: 26 },
  qiblaCopy: { flex: 1 },
  qiblaEyebrow: { color: "#a48132", fontSize: 8, fontWeight: "900", letterSpacing: 1 },
  qiblaTitle: { color: "#163f35", fontSize: 15, fontWeight: "900", marginTop: 2 },
  qiblaText: { color: "#7a8782", fontSize: 9, marginTop: 3 },
  chevron: { color: "#a88b48", fontSize: 28 },
  subscriptionCard: { marginTop: 18, borderRadius: 25, backgroundColor: "#fff", borderWidth: 1, borderColor: "#dcded8", padding: 16 },
  subscriptionHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  subscriptionIcon: { width: 46, height: 46, borderRadius: 15, backgroundColor: "#eef5f1", alignItems: "center", justifyContent: "center" },
  subscriptionIconText: { fontSize: 22 },
  subscriptionCopy: { flex: 1 },
  subscriptionEyebrow: { color: "#9d8039", fontSize: 8, fontWeight: "900", letterSpacing: 1 },
  subscriptionTitle: { color: "#163f35", fontSize: 15, fontWeight: "900", marginTop: 2 },
  subscriptionText: { color: "#7b8782", fontSize: 9, lineHeight: 13, marginTop: 3 },
  scheduledText: { color: "#197255", fontSize: 9, fontWeight: "800", marginTop: 12 },
  manageButton: { marginTop: 14, minHeight: 44, borderRadius: 14, backgroundColor: "#075f4a", paddingHorizontal: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  manageButtonText: { color: "#fff", fontSize: 11, fontWeight: "900" },
  manageArrow: { color: "#e5c979", fontSize: 22 },
  footer: { textAlign: "center", color: "#919a96", fontSize: 8, marginTop: 18 }
});
