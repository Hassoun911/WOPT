import { Pressable, StyleSheet, Switch, Text, View } from "react-native";
import {
  applyPrayerAlertPreset,
  prayerEnabled,
  setPrayerEnabled,
  setPrayerTiming,
  summarizePrayerAlertPreferences,
  type PrayerAlertPreferences,
  type PrayerAlertTiming
} from "./alertPreferences";
import { PRAYER_KEYS, type PrayerKey } from "./types";

const NAMES: Record<PrayerKey, { en: string; ar: string }> = {
  fajr: { en: "Fajr", ar: "الفجر" },
  dhuhr: { en: "Dhuhr", ar: "الظهر" },
  asr: { en: "Asr", ar: "العصر" },
  maghrib: { en: "Maghrib", ar: "المغرب" },
  isha: { en: "Isha", ar: "العشاء" }
};

const PRAYER_MARKS: Record<PrayerKey, string> = {
  fajr: "◒",
  dhuhr: "☀",
  asr: "◐",
  maghrib: "◓",
  isha: "☾"
};

type Props = {
  locale: "en" | "ar";
  value: PrayerAlertPreferences;
  onChange: (next: PrayerAlertPreferences) => void;
  disabled?: boolean;
  showSummary?: boolean;
};

export default function PrayerAlertPreferenceGrid({ locale, value, onChange, disabled = false, showSummary = true }: Props) {
  const ar = locale === "ar";
  const t = (en: string, arabic: string) => ar ? arabic : en;

  const preset = (id: "all" | "twenty" | "ten" | "athan" | "none", label: string) => (
    <Pressable
      key={id}
      onPress={() => onChange(applyPrayerAlertPreset(id))}
      disabled={disabled}
      style={({ pressed }) => [styles.preset, id === "none" && styles.presetDanger, pressed && !disabled && styles.pressed, disabled && styles.disabled]}
    >
      <Text style={[styles.presetText, id === "none" && styles.presetDangerText]}>{label}</Text>
    </Pressable>
  );

  const timingChip = (prayer: PrayerKey, key: keyof PrayerAlertTiming, label: string) => {
    const active = value[prayer][key];
    return (
      <Pressable
        key={key}
        disabled={disabled}
        onPress={() => onChange(setPrayerTiming(value, prayer, key, !active))}
        style={({ pressed }) => [styles.timingChip, active && styles.timingChipActive, pressed && !disabled && styles.pressed, disabled && styles.disabled]}
      >
        <Text style={[styles.timingText, active && styles.timingTextActive]}>{label}</Text>
      </Pressable>
    );
  };

  return (
    <View>
      <View style={styles.presetHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.kicker}>{t("QUICK SETUP", "إعداد سريع")}</Text>
          <Text style={styles.quickTitle}>{t("Choose a preset or customize each prayer", "اختر إعداداً سريعاً أو خصص كل صلاة")}</Text>
        </View>
      </View>
      <View style={styles.presetWrap}>
        {preset("all", t("All", "الكل"))}
        {preset("twenty", t("20 min only", "٢٠ دقيقة فقط"))}
        {preset("ten", t("10 min only", "١٠ دقائق فقط"))}
        {preset("athan", t("Adhan only", "الأذان فقط"))}
        {preset("none", t("Stop all", "إيقاف الكل"))}
      </View>

      <View style={styles.gridHeader}>
        <Text style={styles.gridHeaderPrayer}>{t("PRAYER", "الصلاة")}</Text>
        <Text style={styles.gridHeaderTiming}>20m</Text>
        <Text style={styles.gridHeaderTiming}>10m</Text>
        <Text style={styles.gridHeaderTiming}>{t("Adhan", "الأذان")}</Text>
      </View>

      <View style={styles.list}>
        {PRAYER_KEYS.map((prayer, index) => {
          const enabled = prayerEnabled(value, prayer);
          return (
            <View key={prayer} style={[styles.row, index === PRAYER_KEYS.length - 1 && styles.rowLast, !enabled && styles.rowOff]}>
              <View style={styles.prayerMark}><Text style={styles.prayerMarkText}>{PRAYER_MARKS[prayer]}</Text></View>
              <View style={styles.prayerCopy}>
                <Text style={styles.prayerName}>{NAMES[prayer][locale]}</Text>
                <Text style={styles.prayerOther}>{NAMES[prayer][ar ? "en" : "ar"]}</Text>
              </View>
              <View style={styles.timingGroup}>
                {timingChip(prayer, "twenty", "20")}
                {timingChip(prayer, "ten", "10")}
                {timingChip(prayer, "athan", "◖")}
              </View>
              <Switch
                value={enabled}
                onValueChange={(next) => onChange(setPrayerEnabled(value, prayer, next))}
                disabled={disabled}
                trackColor={{ false: "#d9d6ce", true: "#98c7b8" }}
                thumbColor={enabled ? "#0b654f" : "#ffffff"}
              />
            </View>
          );
        })}
      </View>

      {showSummary ? (
        <View style={styles.summary}>
          <Text style={styles.summaryDot}>●</Text>
          <Text style={styles.summaryText}>{summarizePrayerAlertPreferences(value, locale)}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  presetHeader: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  kicker: { color: "#9b7a39", fontSize: 7, fontWeight: "900", letterSpacing: 1.1 },
  quickTitle: { color: "#254c42", fontSize: 12, fontWeight: "900", marginTop: 3 },
  presetWrap: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 13 },
  preset: { minHeight: 34, borderRadius: 99, paddingHorizontal: 10, alignItems: "center", justifyContent: "center", backgroundColor: "#eef5f1", borderWidth: 1, borderColor: "#d5e4dd" },
  presetDanger: { backgroundColor: "#fff1ee", borderColor: "#efcbc4" },
  presetText: { color: "#28584b", fontSize: 8, fontWeight: "900" },
  presetDangerText: { color: "#a34c40" },
  gridHeader: { minHeight: 28, flexDirection: "row", alignItems: "center", paddingHorizontal: 10 },
  gridHeaderPrayer: { flex: 1, color: "#8b8377", fontSize: 7, fontWeight: "900", letterSpacing: .8 },
  gridHeaderTiming: { width: 42, textAlign: "center", color: "#8b8377", fontSize: 7, fontWeight: "900" },
  list: { borderWidth: 1, borderColor: "#e2ddd4", borderRadius: 19, backgroundColor: "#fff", overflow: "hidden" },
  row: { minHeight: 72, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 10, borderBottomWidth: 1, borderBottomColor: "#efede8" },
  rowLast: { borderBottomWidth: 0 },
  rowOff: { backgroundColor: "#faf8f3" },
  prayerMark: { width: 34, height: 34, borderRadius: 11, backgroundColor: "#edf5f1", alignItems: "center", justifyContent: "center" },
  prayerMarkText: { color: "#0b654f", fontSize: 16, fontWeight: "900" },
  prayerCopy: { flex: 1, minWidth: 75 },
  prayerName: { color: "#244d42", fontSize: 12, fontWeight: "900" },
  prayerOther: { color: "#8a918c", fontSize: 8, marginTop: 2 },
  timingGroup: { flexDirection: "row", gap: 4 },
  timingChip: { width: 34, height: 31, borderRadius: 10, backgroundColor: "#f1eee7", borderWidth: 1, borderColor: "#e6e0d4", alignItems: "center", justifyContent: "center" },
  timingChipActive: { backgroundColor: "#0b654f", borderColor: "#0b654f" },
  timingText: { color: "#7d827e", fontSize: 7, fontWeight: "900" },
  timingTextActive: { color: "#fff" },
  summary: { marginTop: 9, minHeight: 38, borderRadius: 13, backgroundColor: "#edf5f1", flexDirection: "row", alignItems: "center", gap: 7, paddingHorizontal: 11 },
  summaryDot: { color: "#1d9a6c", fontSize: 8 },
  summaryText: { flex: 1, color: "#4f6d64", fontSize: 8.5, fontWeight: "800" },
  pressed: { opacity: .72 },
  disabled: { opacity: .45 }
});
