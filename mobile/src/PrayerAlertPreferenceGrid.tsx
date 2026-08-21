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

  const timingChip = (prayer: PrayerKey, key: keyof PrayerAlertTiming, label: string, helper: string) => {
    const active = value[prayer][key];
    return (
      <Pressable
        key={key}
        disabled={disabled}
        onPress={() => onChange(setPrayerTiming(value, prayer, key, !active))}
        style={({ pressed }) => [styles.timingChip, active && styles.timingChipActive, pressed && !disabled && styles.pressed, disabled && styles.disabled]}
      >
        <Text style={[styles.timingText, active && styles.timingTextActive]}>{label}</Text>
        <Text style={[styles.timingHelper, active && styles.timingHelperActive]}>{helper}</Text>
      </Pressable>
    );
  };

  return (
    <View>
      <Text style={styles.kicker}>{t("QUICK SETUP", "إعداد سريع")}</Text>
      <Text style={styles.quickTitle}>{t("Start with a preset, then fine-tune each prayer", "ابدأ بإعداد سريع ثم خصص كل صلاة")}</Text>
      <View style={styles.presetWrap}>
        {preset("all", t("All alerts", "كل التنبيهات"))}
        {preset("twenty", t("20 min", "٢٠ دقيقة"))}
        {preset("ten", t("10 min", "١٠ دقائق"))}
        {preset("athan", t("Adhan", "الأذان"))}
        {preset("none", t("Off", "إيقاف"))}
      </View>

      <View style={styles.list}>
        {PRAYER_KEYS.map((prayer, index) => {
          const enabled = prayerEnabled(value, prayer);
          return (
            <View key={prayer} style={[styles.row, index === PRAYER_KEYS.length - 1 && styles.rowLast, !enabled && styles.rowOff]}>
              <View style={styles.rowTop}>
                <View style={[styles.prayerMark, enabled && styles.prayerMarkActive]}><Text style={styles.prayerMarkText}>{PRAYER_MARKS[prayer]}</Text></View>
                <View style={styles.prayerCopy}>
                  <Text style={styles.prayerName}>{NAMES[prayer][locale]}</Text>
                  <Text style={styles.prayerOther}>{NAMES[prayer][ar ? "en" : "ar"]}</Text>
                </View>
                <View style={styles.enableCopy}>
                  <Text style={[styles.enableLabel, enabled && styles.enableLabelActive]}>{enabled ? t("On", "مفعّل") : t("Off", "متوقف")}</Text>
                  <Switch
                    value={enabled}
                    onValueChange={(next) => onChange(setPrayerEnabled(value, prayer, next))}
                    disabled={disabled}
                    trackColor={{ false: "#d9d6ce", true: "#93c7b6" }}
                    thumbColor={enabled ? "#0b654f" : "#ffffff"}
                  />
                </View>
              </View>

              <View style={styles.timingGroup}>
                {timingChip(prayer, "twenty", t("20 min", "٢٠ د"), t("Before", "قبل"))}
                {timingChip(prayer, "ten", t("10 min", "١٠ د"), t("Before", "قبل"))}
                {timingChip(prayer, "athan", t("Adhan", "الأذان"), t("At prayer", "وقت الصلاة"))}
              </View>
            </View>
          );
        })}
      </View>

      {showSummary ? (
        <View style={styles.summary}>
          <View style={styles.summaryDot} />
          <Text style={styles.summaryText}>{summarizePrayerAlertPreferences(value, locale)}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  kicker: { color: "#9b7a39", fontSize: 9, fontWeight: "900", letterSpacing: 1.2 },
  quickTitle: { color: "#254c42", fontSize: 14, lineHeight: 19, fontWeight: "900", marginTop: 4 },
  presetWrap: { flexDirection: "row", flexWrap: "wrap", gap: 7, marginTop: 11, marginBottom: 14 },
  preset: { minHeight: 39, borderRadius: 13, paddingHorizontal: 13, alignItems: "center", justifyContent: "center", backgroundColor: "#eef5f1", borderWidth: 1, borderColor: "#d5e4dd" },
  presetDanger: { backgroundColor: "#fff3ef", borderColor: "#efd5cf" },
  presetText: { color: "#28584b", fontSize: 10, fontWeight: "900" },
  presetDangerText: { color: "#a34c40" },
  list: { gap: 9 },
  row: { borderWidth: 1, borderColor: "#e1ded6", borderRadius: 18, backgroundColor: "#fff", padding: 12 },
  rowLast: { marginBottom: 0 },
  rowOff: { backgroundColor: "#faf8f3" },
  rowTop: { flexDirection: "row", alignItems: "center" },
  prayerMark: { width: 42, height: 42, borderRadius: 14, backgroundColor: "#f0f1ed", alignItems: "center", justifyContent: "center", marginRight: 11 },
  prayerMarkActive: { backgroundColor: "#e2f1ea" },
  prayerMarkText: { color: "#0b654f", fontSize: 19, fontWeight: "900" },
  prayerCopy: { flex: 1 },
  prayerName: { color: "#244d42", fontSize: 15, fontWeight: "900" },
  prayerOther: { color: "#8a918c", fontSize: 11, marginTop: 2 },
  enableCopy: { alignItems: "flex-end", gap: 3 },
  enableLabel: { color: "#8c918d", fontSize: 9, fontWeight: "800" },
  enableLabelActive: { color: "#0b654f" },
  timingGroup: { flexDirection: "row", gap: 8, marginTop: 11 },
  timingChip: { flex: 1, minHeight: 52, borderRadius: 14, backgroundColor: "#f5f2eb", borderWidth: 1, borderColor: "#e6e0d4", alignItems: "center", justifyContent: "center", paddingHorizontal: 6 },
  timingChipActive: { backgroundColor: "#0b654f", borderColor: "#0b654f" },
  timingText: { color: "#53645e", fontSize: 11, fontWeight: "900" },
  timingTextActive: { color: "#fff" },
  timingHelper: { color: "#959c98", fontSize: 8.5, fontWeight: "700", marginTop: 2 },
  timingHelperActive: { color: "#c7e0d8" },
  summary: { marginTop: 12, minHeight: 48, borderRadius: 15, backgroundColor: "#edf5f1", flexDirection: "row", alignItems: "center", gap: 9, paddingHorizontal: 13, paddingVertical: 9 },
  summaryDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#1d9a6c" },
  summaryText: { flex: 1, color: "#4f6d64", fontSize: 10.5, lineHeight: 15, fontWeight: "800" },
  pressed: { opacity: .72 },
  disabled: { opacity: .45 }
});
