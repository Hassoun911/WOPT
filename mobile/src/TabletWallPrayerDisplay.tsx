import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { useKeepAwake } from "expo-keep-awake";
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

const WALL_SLIDE_MS = 9000;
const LOCK_SECONDS = 5 * 60;

function remainingLabel(seconds: number, locale: Locale) {
  const safe = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const secs = safe % 60;

  if (safe <= LOCK_SECONDS) {
    if (locale === "ar") return `${minutes}:${String(secs).padStart(2, "0")}`;
    return `${minutes}m ${String(secs).padStart(2, "0")}s`;
  }

  if (locale === "ar") return `${hours ? `${hours} س ` : ""}${minutes} د`;
  return `${hours ? `${hours}h ` : ""}${minutes}m`;
}

export default function TabletWallPrayerDisplay({
  locale,
  now,
  shortDate,
  today,
  next,
  preferences,
  onTogglePrayer
}: Props) {
  useKeepAwake("hassoun-tablet-wall-display");

  const nextIndex = next && !next.isTomorrow ? PRAYER_KEYS.indexOf(next.prayer) : -1;
  const sliderLocked = nextIndex >= 0 && next !== null && next.secondsRemaining <= LOCK_SECONDS;
  const [visibleIndex, setVisibleIndex] = useState(nextIndex >= 0 ? nextIndex : 0);
  const transition = useRef(new Animated.Value(1)).current;
  const previousIndex = useRef(visibleIndex);

  useEffect(() => {
    if (sliderLocked && nextIndex >= 0) setVisibleIndex(nextIndex);
  }, [sliderLocked, nextIndex]);

  useEffect(() => {
    if (sliderLocked) return;
    const id = setInterval(() => {
      setVisibleIndex((current) => (current + 1) % PRAYER_KEYS.length);
    }, WALL_SLIDE_MS);
    return () => clearInterval(id);
  }, [sliderLocked]);

  useEffect(() => {
    if (previousIndex.current === visibleIndex) return;
    previousIndex.current = visibleIndex;
    transition.setValue(0);
    Animated.timing(transition, {
      toValue: 1,
      duration: 520,
      useNativeDriver: true
    }).start();
  }, [transition, visibleIndex]);

  const localTime = useMemo(
    () =>
      new Intl.DateTimeFormat(locale === "ar" ? "ar-CA" : "en-CA", {
        hour: "numeric",
        minute: "2-digit",
        second: "2-digit"
      }).format(now),
    [locale, now]
  );

  const prayer = PRAYER_KEYS[visibleIndex] ?? PRAYER_KEYS[0];
  const prayerTime = today?.[prayer] ?? (next?.prayer === prayer ? next.time : "");
  const isUpcoming = next?.prayer === prayer && !next.isTomorrow;
  const muted = !preferences[prayer].athan;

  return (
    <View style={styles.screen}>
      <View style={styles.clockArea}>
        <Text
          style={styles.clock}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.7}
          accessibilityLabel={`Local time ${localTime}`}
        >
          {localTime}
        </Text>
        <Text style={styles.date}>{shortDate}</Text>
      </View>

      <View style={styles.divider} />

      <View style={styles.galleryArea}>
        <Animated.View
          style={[
            styles.cardWrap,
            {
              opacity: transition,
              transform: [
                {
                  translateX: transition.interpolate({
                    inputRange: [0, 1],
                    outputRange: [42, 0]
                  })
                }
              ]
            }
          ]}
        >
          <View style={[styles.prayerCard, isUpcoming && styles.prayerCardUpcoming]}>
            {sliderLocked && isUpcoming ? (
              <View style={styles.lockPill}>
                <Text style={styles.lockText}>{locale === "ar" ? "الصلاة خلال أقل من ٥ دقائق • ثابت" : "PRAYER UNDER 5 MIN • SLIDER LOCKED"}</Text>
              </View>
            ) : isUpcoming ? (
              <View style={styles.nextPill}>
                <Text style={styles.nextPillText}>{locale === "ar" ? "الصلاة القادمة" : "NEXT PRAYER"}</Text>
              </View>
            ) : null}

            <Text style={styles.glyph}>{GLYPHS[prayer]}</Text>
            <Text style={styles.arabicName}>{NAMES[prayer].ar}</Text>
            <View style={styles.goldRule} />
            <Text style={styles.englishName}>{NAMES[prayer].en}</Text>
            <Text style={styles.prayerTime}>{prayerTime ? formatPrayerTime(prayerTime, locale) : "—"}</Text>

            {isUpcoming && next ? (
              <View style={styles.countdownBlock}>
                <Text style={styles.startsIn}>{locale === "ar" ? "يبدأ خلال" : "STARTS IN"}</Text>
                <Text style={styles.countdown}>{remainingLabel(next.secondsRemaining, locale)}</Text>
              </View>
            ) : null}

            <Pressable
              onPress={() => onTogglePrayer(prayer)}
              style={({ pressed }) => [styles.adhanControl, muted && styles.adhanControlMuted, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel={`${NAMES[prayer].en} ${muted ? "Adhan muted" : "Adhan enabled"}`}
            >
              <Text style={styles.adhanIcon}>{muted ? "🔇" : "🔊"}</Text>
              <View>
                <Text style={styles.adhanTitle}>{locale === "ar" ? "الأذان" : "Adhan"}</Text>
                <Text style={[styles.adhanState, muted && styles.adhanStateMuted]}>{muted ? "OFF" : "ON"}</Text>
              </View>
            </Pressable>
          </View>
        </Animated.View>

        <View style={styles.prayerTabs}>
          {PRAYER_KEYS.map((key, index) => {
            const selected = index === visibleIndex;
            return (
              <Pressable
                key={key}
                onPress={() => setVisibleIndex(index)}
                style={({ pressed }) => [styles.prayerTab, selected && styles.prayerTabSelected, pressed && styles.pressed]}
                accessibilityRole="button"
                accessibilityLabel={`Show ${NAMES[key].en}`}
              >
                <Text style={[styles.tabArabic, selected && styles.tabSelectedText]}>{NAMES[key].ar}</Text>
                <Text style={[styles.tabEnglish, selected && styles.tabSelectedText]}>{NAMES[key].en}</Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.dots}>
          {PRAYER_KEYS.map((key, index) => (
            <View key={key} style={[styles.dot, index === visibleIndex && styles.dotActive]} />
          ))}
        </View>
      </View>
    </View>
  );
}

const deepGreen = "#031b17";
const cardGreen = "#052a23";
const cardGreenBright = "#07372e";
const gold = "#d7b45e";
const softGold = "#f1d181";

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: deepGreen,
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 16
  },
  clockArea: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
    paddingTop: 2,
    paddingBottom: 12
  },
  clock: {
    width: "100%",
    color: "#ffffff",
    fontSize: 126,
    lineHeight: 132,
    fontWeight: "900",
    letterSpacing: 1.5,
    textAlign: "center",
    fontVariant: ["tabular-nums"]
  },
  date: {
    color: gold,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: "800",
    textAlign: "center",
    marginTop: 1
  },
  divider: {
    height: 2,
    width: "100%",
    backgroundColor: gold,
    opacity: 0.85,
    marginBottom: 16
  },
  galleryArea: {
    flex: 1,
    alignItems: "center",
    justifyContent: "space-between"
  },
  cardWrap: {
    flex: 1,
    width: "100%",
    maxWidth: 760,
    alignItems: "center",
    justifyContent: "center"
  },
  prayerCard: {
    width: "94%",
    minHeight: 620,
    flex: 1,
    maxHeight: 850,
    borderRadius: 34,
    borderWidth: 2,
    borderColor: "#8a6d36",
    backgroundColor: cardGreen,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
    paddingVertical: 28,
    shadowColor: "#000000",
    shadowOpacity: 0.28,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10
  },
  prayerCardUpcoming: {
    borderColor: softGold,
    borderWidth: 3,
    backgroundColor: cardGreenBright
  },
  lockPill: {
    position: "absolute",
    top: 20,
    backgroundColor: softGold,
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 9
  },
  lockText: {
    color: deepGreen,
    fontSize: 14,
    fontWeight: "900",
    letterSpacing: 1.1
  },
  nextPill: {
    position: "absolute",
    top: 20,
    borderWidth: 1,
    borderColor: gold,
    backgroundColor: "#d7b45e18",
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 8
  },
  nextPillText: {
    color: softGold,
    fontSize: 14,
    fontWeight: "900",
    letterSpacing: 1.6
  },
  glyph: {
    color: gold,
    fontSize: 40,
    lineHeight: 46,
    marginBottom: 8
  },
  arabicName: {
    color: softGold,
    fontSize: 92,
    lineHeight: 116,
    fontWeight: "900",
    textAlign: "center",
    writingDirection: "rtl",
    includeFontPadding: true
  },
  goldRule: {
    width: 190,
    height: 2,
    backgroundColor: gold,
    marginTop: 4,
    marginBottom: 16
  },
  englishName: {
    color: "#ffffff",
    fontSize: 58,
    lineHeight: 66,
    fontWeight: "900",
    textAlign: "center"
  },
  prayerTime: {
    color: "#ffffff",
    fontSize: 84,
    lineHeight: 92,
    fontWeight: "900",
    textAlign: "center",
    fontVariant: ["tabular-nums"],
    marginTop: 8
  },
  countdownBlock: {
    alignItems: "center",
    justifyContent: "center",
    marginTop: 14
  },
  startsIn: {
    color: gold,
    fontSize: 16,
    fontWeight: "900",
    letterSpacing: 2.1
  },
  countdown: {
    color: softGold,
    fontSize: 48,
    lineHeight: 54,
    fontWeight: "900",
    fontVariant: ["tabular-nums"],
    marginTop: 4
  },
  adhanControl: {
    marginTop: 20,
    minWidth: 210,
    minHeight: 70,
    paddingHorizontal: 24,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#ffffff2e",
    backgroundColor: "#ffffff10",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12
  },
  adhanControlMuted: {
    opacity: 0.62
  },
  adhanIcon: {
    fontSize: 30
  },
  adhanTitle: {
    color: "#ffffff",
    fontSize: 20,
    fontWeight: "900"
  },
  adhanState: {
    color: "#6ce0a1",
    fontSize: 14,
    fontWeight: "900",
    textAlign: "center"
  },
  adhanStateMuted: {
    color: "#d7b45e"
  },
  prayerTabs: {
    width: "100%",
    flexDirection: "row",
    gap: 7,
    paddingTop: 14,
    paddingBottom: 8
  },
  prayerTab: {
    flex: 1,
    minHeight: 72,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#8a6d3670",
    backgroundColor: "#ffffff08",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3
  },
  prayerTabSelected: {
    backgroundColor: gold,
    borderColor: softGold
  },
  tabArabic: {
    color: gold,
    fontSize: 22,
    fontWeight: "900",
    writingDirection: "rtl"
  },
  tabEnglish: {
    color: "#b9b6aa",
    fontSize: 12,
    fontWeight: "800",
    marginTop: 1
  },
  tabSelectedText: {
    color: deepGreen
  },
  dots: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingBottom: 2
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    backgroundColor: "#ffffff32"
  },
  dotActive: {
    width: 27,
    backgroundColor: gold
  },
  pressed: {
    opacity: 0.78,
    transform: [{ scale: 0.985 }]
  }
});
