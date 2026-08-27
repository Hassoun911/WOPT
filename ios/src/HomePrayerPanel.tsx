import { useEffect, useRef } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import type { PrayerAlertPreferences } from "./alertPreferences";
import { formatPrayerTime } from "./time";
import { PRAYER_KEYS, type PrayerDay, type PrayerKey } from "./types";

type Locale = "en" | "ar";

type NextPrayer = {
  prayer: PrayerKey;
  time: string;
  secondsRemaining: number;
  isTomorrow: boolean;
};

type Props = {
  locale: Locale;
  today?: PrayerDay;
  next: NextPrayer | null;
  preferences: PrayerAlertPreferences;
  onTogglePrayer: (prayer: PrayerKey) => void;
  onOpenQibla: () => void;
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

function timeParts(totalSeconds: number) {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return {
    hours: String(hours).padStart(2, "0"),
    minutes: String(minutes).padStart(2, "0"),
    seconds: String(secs).padStart(2, "0")
  };
}

function compactCountdown(totalSeconds: number) {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return hours > 0
    ? `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`
    : `${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

function PrayerIcon({ prayer, active }: { prayer: PrayerKey; active: boolean }) {
  return (
    <View style={[styles.iconShell, active && styles.iconShellActive]}>
      <Text style={[styles.iconGlyph, active && styles.iconGlyphActive]}>{GLYPHS[prayer]}</Text>
      <View style={[styles.iconLine, active && styles.iconLineActive]} />
    </View>
  );
}

export default function HomePrayerPanel({ locale, today, next, preferences, onTogglePrayer, onOpenQibla }: Props) {
  const countdown = next ? timeParts(next.secondsRemaining) : null;
  const urgent = Boolean(next && !next.isTomorrow && next.secondsRemaining > 0 && next.secondsRemaining <= 300);
  const warningPulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!urgent) {
      warningPulse.stopAnimation();
      warningPulse.setValue(0);
      return;
    }
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(warningPulse, { toValue: 1, duration: 520, useNativeDriver: false }),
        Animated.timing(warningPulse, { toValue: 0, duration: 520, useNativeDriver: false })
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [urgent, warningPulse]);

  const warningBorder = warningPulse.interpolate({
    inputRange: [0, 1],
    outputRange: ["#d83838", "#ff7777"]
  });
  const warningShadow = warningPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.18, 0.48]
  });

  return (
    <>
      {next ? (
        <Animated.View
          style={[
            styles.nextCard,
            urgent && styles.nextCardUrgent,
            urgent && { borderColor: warningBorder, shadowOpacity: warningShadow }
          ]}
        >
          <View style={[styles.nextAccent, urgent && styles.nextAccentUrgent]} />
          <View style={styles.nextCopy}>
            <Text style={[styles.nextEyebrow, urgent && styles.urgentText]}>{urgent ? (locale === "ar" ? "تبقّى أقل من ٥ دقائق" : "LESS THAN 5 MINUTES") : (locale === "ar" ? "الصلاة القادمة" : "NEXT PRAYER")}</Text>
            <View style={styles.nextNameRow}>
              <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.78} style={[styles.nextArabic, urgent && styles.urgentTitle]}>{NAMES[next.prayer].ar}</Text>
              <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.82} style={[styles.nextEnglish, urgent && styles.urgentText]}>{NAMES[next.prayer].en}</Text>
            </View>
            <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.82} style={[styles.nextTime, urgent && styles.urgentTitle]}>{formatPrayerTime(next.time, locale)}</Text>
            {next.isTomorrow ? <Text style={styles.tomorrowTag}>{locale === "ar" ? "غداً" : "Tomorrow"}</Text> : null}
          </View>

          <View style={[styles.countdownCard, urgent && styles.countdownCardUrgent]}>
            <View style={styles.countdownHeading}>
              <Text style={styles.hourglass}>{urgent ? "⚠️" : "⌛"}</Text>
              <Text style={[styles.countdownLabel, urgent && styles.urgentText]}>{locale === "ar" ? "الوقت المتبقي" : "TIME REMAINING"}</Text>
            </View>
            <View style={styles.countdownRow}>
              <View style={styles.countUnit}><Text style={[styles.countNumber, urgent && styles.countNumberUrgent]}>{countdown?.hours}</Text><Text style={[styles.countLabel, urgent && styles.urgentText]}>{locale === "ar" ? "س" : "HRS"}</Text></View>
              <Text style={[styles.colon, urgent && styles.countNumberUrgent]}>:</Text>
              <View style={styles.countUnit}><Text style={[styles.countNumber, urgent && styles.countNumberUrgent]}>{countdown?.minutes}</Text><Text style={[styles.countLabel, urgent && styles.urgentText]}>{locale === "ar" ? "د" : "MIN"}</Text></View>
              <Text style={[styles.colon, urgent && styles.countNumberUrgent]}>:</Text>
              <View style={styles.countUnit}><Text style={[styles.countNumber, urgent && styles.countNumberUrgent]}>{countdown?.seconds}</Text><Text style={[styles.countLabel, urgent && styles.urgentText]}>{locale === "ar" ? "ث" : "SEC"}</Text></View>
            </View>
          </View>
        </Animated.View>
      ) : null}

      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <Text style={styles.heading}>{locale === "ar" ? "مواقيت الصلاة اليوم" : "Today’s Prayer Times"}</Text>
          <Text style={styles.hint}>{locale === "ar" ? "جميع الصلوات الخمس في مكان واحد" : "All five daily prayers at a glance"}</Text>
        </View>

        {today ? PRAYER_KEYS.map((prayer, index) => {
          const active = next?.prayer === prayer && !next.isTomorrow;
          const muted = !preferences[prayer].athan;
          const rowUrgent = active && urgent;
          const rowStyle = [
            styles.prayerRow,
            active && styles.prayerRowActive,
            rowUrgent && styles.prayerRowUrgent,
            index === PRAYER_KEYS.length - 1 && styles.prayerRowLast
          ];
          const row = (
            <>
              <PrayerIcon prayer={prayer} active={active} />
              <View style={styles.nameBlock}>
                <View style={styles.nameTopRow}>
                  <Text style={[styles.prayerEnglish, active && styles.activeText]}>{NAMES[prayer].en}</Text>
                  {active ? <View style={[styles.nextBadge, rowUrgent && styles.nextBadgeUrgent]}><Text style={[styles.nextBadgeText, rowUrgent && styles.nextBadgeUrgentText]}>{rowUrgent ? (locale === "ar" ? "قريباً" : "SOON") : (locale === "ar" ? "القادمة" : "NEXT")}</Text></View> : null}
                </View>
                <Text style={[styles.prayerArabic, active && styles.activeSubText]}>{NAMES[prayer].ar}</Text>
              </View>
              <View style={styles.prayerTimeBlock}>
                <Text style={[styles.prayerTime, active && styles.activeText]}>{formatPrayerTime(today[prayer], locale)}</Text>
                {active && next ? <Text style={[styles.rowCountdown, rowUrgent && styles.rowCountdownUrgent]}>{locale === "ar" ? "متبقي " : "in "}{compactCountdown(next.secondsRemaining)}</Text> : null}
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${NAMES[prayer].en} ${muted ? "Adhan muted" : "Adhan on"}`}
                onPress={() => onTogglePrayer(prayer)}
                style={({ pressed }) => [styles.audioButton, active && styles.audioButtonActive, muted && styles.audioButtonMuted, pressed && styles.pressed]}
              >
                <Text style={[styles.audioIcon, active && styles.audioIconActive, muted && styles.audioMuted]}>♪</Text>
              </Pressable>
            </>
          );
          return rowUrgent ? (
            <Animated.View key={prayer} style={[rowStyle, { borderColor: warningBorder, shadowOpacity: warningShadow }]}>{row}</Animated.View>
          ) : (
            <View key={prayer} style={rowStyle}>{row}</View>
          );
        }) : <Text style={styles.empty}>{locale === "ar" ? "لا يوجد جدول صلاة متاح اليوم." : "No prayer schedule is available today."}</Text>}
      </View>

      <Pressable onPress={onOpenQibla} style={({ pressed }) => [styles.qiblaCard, pressed && styles.pressed]}>
        <View style={styles.qiblaIcon}><Text style={styles.qiblaEmoji}>🕋</Text></View>
        <View style={styles.qiblaCopy}>
          <Text style={styles.qiblaEyebrow}>{locale === "ar" ? "اتجاه القبلة" : "QIBLA DIRECTION"}</Text>
          <Text style={styles.qiblaTitle}>{locale === "ar" ? "افتح بوصلة القبلة" : "Open the Qibla compass"}</Text>
        </View>
        <View style={styles.qiblaBearing}><Text style={styles.qiblaBearingValue}>52°</Text><Text style={styles.qiblaBearingDir}>NE</Text></View>
        <Text style={styles.chevron}>›</Text>
      </Pressable>
    </>
  );
}

const green = "#075f4a";
const deepGreen = "#034b3d";
const gold = "#d7b45e";
const cream = "#f7f3e8";
const warningRed = "#d83838";

const styles = StyleSheet.create({
  nextCard: { marginTop: 14, minHeight: 148, borderRadius: 28, backgroundColor: "#edf5f0", borderWidth: 3, borderColor: gold, overflow: "hidden", flexDirection: "row", alignItems: "stretch", shadowColor: "#0b5b47", shadowOpacity: 0.20, shadowRadius: 16, shadowOffset: { width: 0, height: 7 }, elevation: 7 },
  nextCardUrgent: { borderWidth: 3, shadowColor: warningRed, shadowRadius: 14, elevation: 8 },
  nextAccent: { width: 24, backgroundColor: green },
  nextAccentUrgent: { backgroundColor: warningRed },
  nextCopy: { flex: 1, minWidth: 132, paddingVertical: 17, paddingLeft: 16, paddingRight: 8, justifyContent: "center" },
  nextEyebrow: { color: "#8e7137", fontSize: 8, fontWeight: "900", letterSpacing: 1.3 },
  nextNameRow: { flexDirection: "column", alignItems: "flex-start", gap: 2, marginTop: 5 },
  nextArabic: { color: deepGreen, fontSize: 27, fontWeight: "900" },
  nextEnglish: { color: "#9c7a35", fontSize: 14, fontWeight: "900" },
  nextTime: { color: deepGreen, fontSize: 18, fontWeight: "900", marginTop: 5 },
  urgentText: { color: warningRed },
  urgentTitle: { color: "#a91f1f" },
  tomorrowTag: { alignSelf: "flex-start", marginTop: 5, color: green, backgroundColor: "#e8f2ed", borderRadius: 99, paddingHorizontal: 8, paddingVertical: 3, fontSize: 8, fontWeight: "900", overflow: "hidden" },
  countdownCard: { width: 174, marginVertical: 11, marginRight: 11, marginLeft: 5, borderRadius: 22, backgroundColor: "#fffaf0", borderWidth: 1, borderColor: "#dfc987", paddingHorizontal: 9, justifyContent: "center" },
  countdownCardUrgent: { backgroundColor: "#fff4f2", borderColor: "#e79a94", borderWidth: 2 },
  countdownHeading: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginBottom: 7 },
  hourglass: { fontSize: 14 },
  countdownLabel: { color: "#705b31", fontSize: 8, fontWeight: "900", letterSpacing: .8 },
  countdownRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "center" },
  countUnit: { minWidth: 39, alignItems: "center" },
  countNumber: { color: deepGreen, fontSize: 24, fontWeight: "900", fontVariant: ["tabular-nums"] },
  countNumberUrgent: { color: warningRed },
  countLabel: { color: "#72817b", fontSize: 7, fontWeight: "800", marginTop: 2 },
  colon: { color: "#b9933d", fontSize: 21, fontWeight: "900", marginHorizontal: 1 },
  sectionCard: { marginTop: 15, borderRadius: 25, backgroundColor: "#fffdf8", borderWidth: 1, borderColor: "#dfd9ca", padding: 12, overflow: "hidden" },
  sectionHeader: { paddingHorizontal: 5, paddingTop: 3, paddingBottom: 11 },
  heading: { color: deepGreen, fontSize: 20, fontWeight: "900" },
  hint: { color: "#7f8a85", fontSize: 9.5, marginTop: 3 },
  prayerRow: { minHeight: 82, flexDirection: "row", alignItems: "center", paddingHorizontal: 10, borderBottomWidth: 1, borderBottomColor: "#ece7db", borderRadius: 18 },
  prayerRowActive: { backgroundColor: green, borderBottomColor: green, marginVertical: 3, shadowColor: "#0b4639", shadowOpacity: 0.13, shadowRadius: 7, shadowOffset: { width: 0, height: 3 }, elevation: 2 },
  prayerRowUrgent: { backgroundColor: "#7c2020", borderWidth: 3, borderBottomWidth: 3, shadowColor: warningRed, shadowRadius: 12, elevation: 7 },
  prayerRowLast: { borderBottomWidth: 0 },
  iconShell: { width: 50, height: 50, borderRadius: 17, backgroundColor: "#edf3ef", alignItems: "center", justifyContent: "center", marginRight: 11 },
  iconShellActive: { backgroundColor: "rgba(215,180,94,.16)", borderWidth: 1, borderColor: "rgba(215,180,94,.55)" },
  iconGlyph: { color: "#a98334", fontSize: 27, lineHeight: 30 },
  iconGlyphActive: { color: "#f1d789" },
  iconLine: { width: 27, height: 2, borderRadius: 1, backgroundColor: "#a98334", marginTop: -2 },
  iconLineActive: { backgroundColor: "#f1d789" },
  nameBlock: { flex: 1, minWidth: 92 },
  nameTopRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  prayerEnglish: { color: deepGreen, fontSize: 16, fontWeight: "900" },
  prayerArabic: { color: "#73817c", fontSize: 12, fontWeight: "800", marginTop: 2 },
  nextBadge: { borderRadius: 99, backgroundColor: gold, paddingHorizontal: 6, paddingVertical: 2 },
  nextBadgeText: { color: deepGreen, fontSize: 6.5, fontWeight: "900", letterSpacing: .6 },
  nextBadgeUrgent: { backgroundColor: "#ffd8d3" },
  nextBadgeUrgentText: { color: "#9f1f1f" },
  prayerTimeBlock: { minWidth: 96, alignItems: "flex-end", marginRight: 10 },
  prayerTime: { textAlign: "right", color: deepGreen, fontSize: 20, fontWeight: "900" },
  rowCountdown: { color: "#c8ded7", fontSize: 8.5, fontWeight: "900", marginTop: 2, fontVariant: ["tabular-nums"] },
  rowCountdownUrgent: { color: "#ffd5d1", fontSize: 10 },
  activeText: { color: "#fff" },
  activeSubText: { color: "#c8ded7" },
  audioButton: { width: 42, height: 42, borderRadius: 21, borderWidth: 1, borderColor: "#bfd3ca", backgroundColor: "#edf5f1", alignItems: "center", justifyContent: "center" },
  audioButtonActive: { borderColor: "rgba(255,255,255,.7)", backgroundColor: "rgba(255,255,255,.10)" },
  audioButtonMuted: { backgroundColor: "#f3ede3", borderColor: "#ddd0bd" },
  audioIcon: { color: green, fontSize: 20, fontWeight: "900" },
  audioIconActive: { color: "#fff" },
  audioMuted: { opacity: .4 },
  pressed: { opacity: .72, transform: [{ scale: .985 }] },
  empty: { color: "#74817c", padding: 18, textAlign: "center" },
  qiblaCard: { marginTop: 13, minHeight: 76, borderRadius: 22, backgroundColor: "#eef5f1", borderWidth: 1, borderColor: "#cedfd7", paddingHorizontal: 13, flexDirection: "row", alignItems: "center", gap: 10 },
  qiblaIcon: { width: 48, height: 48, borderRadius: 16, backgroundColor: green, alignItems: "center", justifyContent: "center" },
  qiblaEmoji: { fontSize: 23 },
  qiblaCopy: { flex: 1 },
  qiblaEyebrow: { color: "#9a7835", fontSize: 7, fontWeight: "900", letterSpacing: 1 },
  qiblaTitle: { color: deepGreen, fontSize: 14, fontWeight: "900", marginTop: 2 },
  qiblaBearing: { alignItems: "center", minWidth: 45 },
  qiblaBearingValue: { color: deepGreen, fontSize: 14, fontWeight: "900" },
  qiblaBearingDir: { color: "#7e8b86", fontSize: 8, fontWeight: "800" },
  chevron: { color: deepGreen, fontSize: 28 }
});
