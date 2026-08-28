import { useKeepAwake } from "expo-keep-awake";
import { Pressable, StyleSheet, Text, View } from "react-native";
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
  now: Date;
  shortDate: string;
  hijriDate: string;
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
  dhuhr: "☀",
  asr: "◐",
  maghrib: "◓",
  isha: "☾"
};

function remainingLabel(seconds: number, locale: Locale) {
  const safe = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  if (locale === "ar") return `${hours ? `${hours} س ` : ""}${minutes} د`;
  return `${hours ? `${hours}h ` : ""}${minutes}m`;
}

export default function TabletWallPrayerDisplay({
  locale,
  now,
  shortDate,
  hijriDate,
  today,
  next,
  preferences,
  onTogglePrayer,
  onOpenQibla
}: Props) {
  // Wall-display mode must stay visible while the tablet remains plugged in.
  useKeepAwake("hassoun-tablet-wall-display");

  const localTime = new Intl.DateTimeFormat(locale === "ar" ? "ar-CA" : "en-CA", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit"
  }).format(now);

  return (
    <View style={styles.screen}>
      <View style={styles.topRow}>
        <View style={styles.locationBlock}>
          <Text style={styles.location}>Windsor, Ontario</Text>
          <Text style={styles.scheduleLabel}>{locale === "ar" ? "جدول الأذان المحلي الرسمي" : "Official local Adhan schedule"}</Text>
        </View>
        <View style={styles.dateBlock}>
          <Text style={styles.clock}>{localTime}</Text>
          <Text style={styles.date}>{shortDate}</Text>
          {hijriDate ? <Text style={styles.hijri}>{hijriDate}</Text> : null}
        </View>
      </View>

      {next ? (
        <View style={styles.nextHero}>
          <View style={styles.nextCopy}>
            <Text style={styles.eyebrow}>{locale === "ar" ? "الصلاة القادمة" : "NEXT PRAYER"}</Text>
            <View style={styles.nextNameRow}>
              <Text style={styles.nextName}>{NAMES[next.prayer].en}</Text>
              <Text style={styles.nextArabic}>{NAMES[next.prayer].ar}</Text>
            </View>
            <Text style={styles.nextTime}>{formatPrayerTime(next.time, locale)}</Text>
          </View>
          <View style={styles.remainingBlock}>
            <Text style={styles.remainingIcon}>⌛</Text>
            <Text style={styles.remaining}>{remainingLabel(next.secondsRemaining, locale)}</Text>
            <Text style={styles.remainingLabel}>{locale === "ar" ? "متبقي" : "LEFT"}</Text>
          </View>
        </View>
      ) : null}

      <View style={styles.prayerGrid}>
        {today ? PRAYER_KEYS.map((prayer) => {
          const active = next?.prayer === prayer && !next.isTomorrow;
          const muted = !preferences[prayer].athan;
          return (
            <Pressable
              key={prayer}
              onPress={() => onTogglePrayer(prayer)}
              style={({ pressed }) => [styles.prayerCard, active && styles.prayerCardActive, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel={`${NAMES[prayer].en} ${muted ? "Adhan muted" : "Adhan enabled"}`}
            >
              {active ? <Text style={styles.nextBadge}>{locale === "ar" ? "القادمة" : "NEXT"}</Text> : null}
              <Text style={[styles.glyph, active && styles.activeText]}>{GLYPHS[prayer]}</Text>
              <Text style={[styles.prayerName, active && styles.activeText]}>{NAMES[prayer].en}</Text>
              <Text style={[styles.prayerArabic, active && styles.activeSubText]}>{NAMES[prayer].ar}</Text>
              <Text style={[styles.prayerTime, active && styles.activeText]}>{formatPrayerTime(today[prayer], locale)}</Text>
              <View style={[styles.audioPill, active && styles.audioPillActive, muted && styles.audioPillMuted]}>
                <Text style={[styles.audioText, active && styles.activeText]}>{muted ? "🔇 Adhan" : "🔊 Adhan"}</Text>
              </View>
            </Pressable>
          );
        }) : null}
      </View>

      <View style={styles.bottomGrid}>
        <View style={styles.dailyCard}>
          <Text style={styles.dailyEyebrow}>{locale === "ar" ? "آية اليوم" : "AYAH OF THE DAY"}</Text>
          <Text style={styles.dailyArabic}>أَلَا بِذِكْرِ اللَّهِ تَطْمَئِنُّ الْقُلُوبُ</Text>
          <Text style={styles.dailyText}>{locale === "ar" ? "ألا بذكر الله تطمئن القلوب." : "Surely, hearts find comfort in the remembrance of Allah."}</Text>
          <Text style={styles.dailyRef}>Qur’an 13:28</Text>
        </View>
        <View style={styles.dailyCard}>
          <Text style={styles.dailyEyebrow}>{locale === "ar" ? "دعاء اليوم" : "DUA OF THE DAY"}</Text>
          <Text style={styles.dailyArabic}>رَبَّنَا آتِنَا فِي الدُّنْيَا حَسَنَةً وَفِي الْآخِرَةِ حَسَنَةً وَقِنَا عَذَابَ النَّارِ</Text>
          <Text style={styles.dailyText}>{locale === "ar" ? "ربنا آتنا في الدنيا حسنة وفي الآخرة حسنة وقنا عذاب النار." : "Our Lord, grant us good in this world and the Hereafter, and protect us from the Fire."}</Text>
          <Text style={styles.dailyRef}>Qur’an 2:201</Text>
        </View>
      </View>

      <Pressable onPress={onOpenQibla} style={({ pressed }) => [styles.qiblaStrip, pressed && styles.pressed]}>
        <Text style={styles.qiblaText}>🕋 {locale === "ar" ? "اضغط لفتح اتجاه القبلة" : "Tap for Qibla direction"}</Text>
        <Text style={styles.qiblaArrow}>›</Text>
      </Pressable>
    </View>
  );
}

const green = "#075f4a";
const deepGreen = "#043f34";
const cream = "#f8f4e9";
const gold = "#d7b45e";

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: cream, paddingHorizontal: 24, paddingTop: 18, paddingBottom: 16, justifyContent: "space-between" },
  topRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
  locationBlock: { flex: 1 },
  location: { color: deepGreen, fontSize: 35, fontWeight: "900", letterSpacing: -0.6 },
  scheduleLabel: { color: "#9c7a35", fontSize: 14, fontWeight: "800", marginTop: 2 },
  dateBlock: { alignItems: "flex-end", minWidth: 260 },
  clock: { color: deepGreen, fontSize: 54, fontWeight: "900", fontVariant: ["tabular-nums"], lineHeight: 58 },
  date: { color: deepGreen, fontSize: 20, fontWeight: "900" },
  hijri: { color: "#9c7a35", fontSize: 16, fontWeight: "800", marginTop: 2 },

  nextHero: { minHeight: 225, borderRadius: 30, backgroundColor: deepGreen, borderWidth: 2, borderColor: gold, paddingHorizontal: 30, paddingVertical: 22, flexDirection: "row", alignItems: "center", justifyContent: "space-between", shadowColor: "#173f36", shadowOpacity: 0.16, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 6 },
  nextCopy: { flex: 1 },
  eyebrow: { color: gold, fontSize: 15, fontWeight: "900", letterSpacing: 2.3 },
  nextNameRow: { flexDirection: "row", alignItems: "baseline", gap: 18, marginTop: 6, flexWrap: "wrap" },
  nextName: { color: "#fffaf0", fontSize: 65, fontWeight: "900", letterSpacing: -1.5 },
  nextArabic: { color: "#fffaf0", fontSize: 48, fontWeight: "900" },
  nextTime: { color: "#fffaf0", fontSize: 46, fontWeight: "900", marginTop: 6 },
  remainingBlock: { minWidth: 240, alignItems: "center", justifyContent: "center", borderLeftWidth: 1, borderLeftColor: "#d7b45e77", paddingLeft: 24 },
  remainingIcon: { fontSize: 32 },
  remaining: { color: gold, fontSize: 52, fontWeight: "900", fontVariant: ["tabular-nums"], marginTop: 6 },
  remainingLabel: { color: "#f7e7b9", fontSize: 15, fontWeight: "900", letterSpacing: 2 },

  prayerGrid: { flexDirection: "row", gap: 10 },
  prayerCard: { flex: 1, minHeight: 230, borderRadius: 25, backgroundColor: "#fffdf8", borderWidth: 1.5, borderColor: "#dccb9d", alignItems: "center", justifyContent: "center", paddingHorizontal: 8, position: "relative" },
  prayerCardActive: { backgroundColor: green, borderColor: gold, borderWidth: 3, shadowColor: "#0b4639", shadowOpacity: 0.2, shadowRadius: 10, elevation: 5 },
  nextBadge: { position: "absolute", top: 9, right: 9, backgroundColor: gold, color: deepGreen, borderRadius: 99, overflow: "hidden", paddingHorizontal: 9, paddingVertical: 4, fontSize: 10, fontWeight: "900", letterSpacing: 1 },
  glyph: { color: "#9d7d35", fontSize: 38, fontWeight: "900" },
  prayerName: { color: deepGreen, fontSize: 27, fontWeight: "900", marginTop: 6 },
  prayerArabic: { color: "#71807a", fontSize: 16, fontWeight: "700", marginTop: 1 },
  prayerTime: { color: deepGreen, fontSize: 31, fontWeight: "900", marginTop: 9 },
  activeText: { color: "#fffaf0" },
  activeSubText: { color: "#e7d8ad" },
  audioPill: { marginTop: 11, borderRadius: 99, backgroundColor: "#e9f2ee", paddingHorizontal: 11, paddingVertical: 6 },
  audioPillActive: { backgroundColor: "#ffffff20" },
  audioPillMuted: { opacity: 0.55 },
  audioText: { color: deepGreen, fontSize: 11, fontWeight: "900" },
  pressed: { opacity: 0.78, transform: [{ scale: 0.992 }] },

  bottomGrid: { flexDirection: "row", gap: 14 },
  dailyCard: { flex: 1, minHeight: 220, borderRadius: 25, backgroundColor: "#fffdf8", borderWidth: 1.5, borderColor: "#dccb9d", padding: 22, alignItems: "center", justifyContent: "center" },
  dailyEyebrow: { color: "#9c7a35", fontSize: 13, fontWeight: "900", letterSpacing: 1.7 },
  dailyArabic: { color: deepGreen, fontSize: 30, fontWeight: "800", textAlign: "center", lineHeight: 46, marginTop: 10 },
  dailyText: { color: "#485a54", fontSize: 16, fontWeight: "600", textAlign: "center", lineHeight: 23, marginTop: 10 },
  dailyRef: { color: "#9c7a35", fontSize: 13, fontWeight: "900", marginTop: 7 },

  qiblaStrip: { minHeight: 54, borderRadius: 18, backgroundColor: "#e9f2ee", borderWidth: 1, borderColor: "#bfd9cf", flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 18 },
  qiblaText: { color: deepGreen, fontSize: 17, fontWeight: "900" },
  qiblaArrow: { color: green, fontSize: 30, fontWeight: "700" }
});
