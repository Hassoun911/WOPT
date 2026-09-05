import { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import {
  DEFAULT_CALCULATION_PREFS,
  METHOD_OPTIONS,
  loadPrayerCalculationPreferences,
  savePrayerCalculationPreferences,
  type PrayerCalculationPreferences,
  type PrayerScheduleSource
} from "./prayerCalculationSettings";
import { loadSavedPrayerContext, previewPrayerDayForPreferences } from "./prayerData";
import type { Locale } from "./types";

type Props = { locale: Locale; onBack: () => void };

const SCHOOL_OPTIONS = [
  { id: 0 as const, en: "Standard", ar: "قياسي" },
  { id: 1 as const, en: "Hanafi", ar: "حنفي" }
];

const HIGH_LAT_OPTIONS = [
  { id: 3 as const, en: "Angle based", ar: "بحسب الزاوية" },
  { id: 1 as const, en: "Middle of night", ar: "منتصف الليل" },
  { id: 2 as const, en: "One-seventh", ar: "سُبع الليل" },
  { id: 0 as const, en: "None", ar: "بدون" }
];

const PRAYER_LABELS = [
  ["fajr", "Fajr", "الفجر"],
  ["dhuhr", "Dhuhr", "الظهر"],
  ["asr", "Asr", "العصر"],
  ["maghrib", "Maghrib", "المغرب"],
  ["isha", "Isha", "العشاء"]
] as const;

function Chip({ active, label, onPress, disabled = false }: { active: boolean; label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable disabled={disabled} onPress={onPress} style={[styles.chip, active && styles.chipActive, disabled && styles.disabled]}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

function SourceCard({ active, title, body, onPress }: { active: boolean; title: string; body: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.sourceCard, active && styles.sourceCardActive]}>
      <View style={[styles.radio, active && styles.radioActive]} />
      <View style={{ flex: 1 }}>
        <Text style={styles.sourceTitle}>{title}</Text>
        <Text style={styles.sourceBody}>{body}</Text>
      </View>
    </Pressable>
  );
}

export default function PrayerCalculationSettingsPage({ locale, onBack }: Props) {
  const ar = locale === "ar";
  const t = (en: string, arabic: string) => ar ? arabic : en;
  const [prefs, setPrefs] = useState<PrayerCalculationPreferences>(DEFAULT_CALCULATION_PREFS);
  const [savedSource, setSavedSource] = useState<string>("");
  const [savedLabel, setSavedLabel] = useState<string>("");
  const [preview, setPreview] = useState<{ asr?: string; source?: string } | null>(null);
  const [previewing, setPreviewing] = useState(false);

  useEffect(() => {
    void loadPrayerCalculationPreferences().then(setPrefs);
    void loadSavedPrayerContext().then((ctx) => {
      if (!ctx) return;
      setSavedSource(ctx.location.source);
      setSavedLabel(ctx.location.label);
    });
  }, []);

  const officialActive = savedSource === "windsor_islamic_association" && prefs.scheduleSource !== "calculated";
  const calculatedControlsEnabled = !officialActive;
  const sourceSummary = useMemo(() => {
    if (officialActive) return t("Currently using: Windsor Islamic Association official schedule", "المصدر الحالي: جدول جمعية وندسور الإسلامية الرسمي");
    return t(
      `Currently using: calculated prayer times · ${prefs.school === 1 ? "Hanafi" : "Standard"} Asr`,
      `المصدر الحالي: مواقيت محسوبة · عصر ${prefs.school === 1 ? "حنفي" : "قياسي"}`
    );
  }, [ar, officialActive, prefs.school]);

  useEffect(() => {
    let alive = true;
    if (!calculatedControlsEnabled) {
      setPreview(null);
      return;
    }
    setPreviewing(true);
    const timer = setTimeout(() => {
      void previewPrayerDayForPreferences(prefs)
        .then((value) => { if (alive) setPreview(value); })
        .catch(() => { if (alive) setPreview(null); })
        .finally(() => { if (alive) setPreviewing(false); });
    }, 300);
    return () => { alive = false; clearTimeout(timer); };
  }, [prefs.mode, prefs.method, prefs.school, prefs.highLatitude, prefs.offsets.fajr, prefs.offsets.dhuhr, prefs.offsets.asr, prefs.offsets.maghrib, prefs.offsets.isha, prefs.scheduleSource, calculatedControlsEnabled]);

  const save = async () => {
    await savePrayerCalculationPreferences(prefs);
    Alert.alert(t("Saved", "تم الحفظ"), t("Prayer calculation settings are now active across Hassoun.", "تم تفعيل إعدادات حساب الصلاة في حسون."));
  };

  const setSource = (scheduleSource: PrayerScheduleSource) => setPrefs((p) => ({ ...p, scheduleSource }));

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Pressable onPress={onBack}><Text style={styles.back}>‹</Text></Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{t("Prayer Calculation", "حساب مواقيت الصلاة")}</Text>
          {!!savedLabel && <Text style={styles.location}>{savedLabel}</Text>}
        </View>
      </View>

      <View style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>{sourceSummary}</Text>
        <Text style={styles.summaryText}>{officialActive
          ? t("The official mosque timetable controls the five prayer times. Calculation options below do not alter that timetable.", "الجدول الرسمي للمسجد يتحكم بمواقيت الصلوات الخمس، لذلك إعدادات الحساب أدناه لا تغيّر هذا الجدول.")
          : t("Your calculation profile controls the prayer schedule and is synced to supported Hassoun displays.", "ملف الحساب الخاص بك يتحكم بالمواقيت ويتم مزامنته مع شاشات حسون المدعومة.")}
        </Text>
      </View>

      <Text style={styles.sectionLabel}>{t("PRAYER TIME SOURCE", "مصدر مواقيت الصلاة")}</Text>
      <SourceCard active={prefs.scheduleSource === "smart"} onPress={() => setSource("smart")} title={t("Smart Automatic", "تلقائي ذكي")} body={t("Use a trusted official local schedule when Hassoun has one; otherwise calculate from your GPS location.", "استخدم جدولاً محلياً رسمياً موثوقاً عند توفره، وإلا احسب المواقيت من موقع GPS.")} />
      <SourceCard active={prefs.scheduleSource === "official"} onPress={() => setSource("official")} title={t("Official Local Mosque Schedule", "الجدول الرسمي للمسجد المحلي")} body={t("Prefer a trusted official schedule when one is available for your location.", "فضّل الجدول الرسمي الموثوق عند توفره لموقعك.")} />
      <SourceCard active={prefs.scheduleSource === "calculated"} onPress={() => setSource("calculated")} title={t("Calculated Prayer Times", "مواقيت محسوبة")} body={t("Always use GPS + your method, Asr school, high-latitude rule and minute tuning.", "استخدم دائماً GPS مع الطريقة ومذهب العصر وقاعدة خطوط العرض وضبط الدقائق.")} />

      {officialActive && (
        <View style={styles.notice}>
          <Text style={styles.noticeTitle}>{t("Official timetable is active", "الجدول الرسمي مفعّل")}</Text>
          <Text style={styles.noticeText}>{t("Method, Asr School, high-latitude rules and minute tuning are disabled because they do not affect the Windsor official timetable.", "تم تعطيل الطريقة ومذهب العصر وقواعد خطوط العرض وضبط الدقائق لأنها لا تؤثر على جدول وندسور الرسمي.")}</Text>
          <Pressable style={styles.linkButton} onPress={() => setSource("calculated")}><Text style={styles.linkButtonText}>{t("Use calculated times instead", "استخدم المواقيت المحسوبة بدلاً من ذلك")}</Text></Pressable>
        </View>
      )}

      <View style={!calculatedControlsEnabled ? styles.controlsDisabled : undefined} pointerEvents={calculatedControlsEnabled ? "auto" : "none"}>
        <Text style={styles.sectionLabel}>{t("CALCULATION METHOD", "طريقة الحساب")}</Text>
        <View style={styles.rowWrap}>
          <Chip active={prefs.mode === "smart"} label={t("Smart automatic", "تلقائي ذكي")} onPress={() => setPrefs((p) => ({ ...p, mode: "smart" }))} />
          <Chip active={prefs.mode === "manual"} label={t("Manual", "يدوي")} onPress={() => setPrefs((p) => ({ ...p, mode: "manual" }))} />
        </View>
        {prefs.mode === "manual" && METHOD_OPTIONS.map((option) => (
          <Pressable key={option.id} onPress={() => setPrefs((p) => ({ ...p, method: option.id }))} style={[styles.methodRow, prefs.method === option.id && styles.methodRowActive]}>
            <Text style={styles.methodName}>{option.name}</Text><Text style={styles.methodNote}>{option.note}</Text>
          </Pressable>
        ))}

        <Text style={styles.sectionLabel}>{t("ASR SCHOOL", "مذهب العصر")}</Text>
        <View style={styles.rowWrap}>{SCHOOL_OPTIONS.map((option) => <Chip key={option.id} active={prefs.school === option.id} label={t(option.en, option.ar)} onPress={() => setPrefs((p) => ({ ...p, school: option.id }))} />)}</View>
        <View style={styles.previewCard}>
          <Text style={styles.previewTitle}>{t("Live Asr preview", "معاينة مباشرة للعصر")}</Text>
          <Text style={styles.previewValue}>{previewing ? t("Calculating…", "جارٍ الحساب…") : preview?.asr || t("Preview unavailable", "المعاينة غير متاحة")}</Text>
          <Text style={styles.previewMeta}>{preview?.source || t("Updates as you change the calculation profile.", "تتحدث المعاينة عند تغيير إعدادات الحساب.")}</Text>
        </View>

        <Text style={styles.sectionLabel}>{t("HIGH-LATITUDE RULE", "قاعدة خطوط العرض العالية")}</Text>
        <View style={styles.rowWrap}>{HIGH_LAT_OPTIONS.map((option) => <Chip key={option.id} active={prefs.highLatitude === option.id} label={t(option.en, option.ar)} onPress={() => setPrefs((p) => ({ ...p, highLatitude: option.id }))} />)}</View>

        <Text style={styles.sectionLabel}>{t("FINE-TUNE BY MINUTES", "ضبط بالدقائق")}</Text>
        {PRAYER_LABELS.map(([key, en, arabic]) => (
          <View key={key} style={styles.tuneRow}>
            <Text style={styles.tuneName}>{t(en, arabic)}</Text>
            <Pressable style={styles.stepper} onPress={() => setPrefs((p) => ({ ...p, offsets: { ...p.offsets, [key]: Math.max(-30, p.offsets[key] - 1) } }))}><Text style={styles.stepperText}>−</Text></Pressable>
            <Text style={styles.offsetText}>{prefs.offsets[key] > 0 ? `+${prefs.offsets[key]}` : prefs.offsets[key]} min</Text>
            <Pressable style={styles.stepper} onPress={() => setPrefs((p) => ({ ...p, offsets: { ...p.offsets, [key]: Math.min(30, p.offsets[key] + 1) } }))}><Text style={styles.stepperText}>+</Text></Pressable>
          </View>
        ))}
      </View>

      <Pressable style={styles.saveButton} onPress={() => { void save(); }}><Text style={styles.saveText}>{t("Save & use these settings", "حفظ واستخدام هذه الإعدادات")}</Text></Pressable>
      <Text style={styles.footnote}>{t("Why this time? Hassoun shows the active source on this page. When calculated times are active, the method, Asr school, high-latitude rule and tuning above are the values used by the calculation request.", "لماذا هذا الوقت؟ يعرض حسون المصدر الفعلي في هذه الصفحة. وعند تفعيل المواقيت المحسوبة تُستخدم الطريقة ومذهب العصر وقاعدة خطوط العرض والضبط أعلاه في طلب الحساب.")}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#f4f2ea" }, content: { padding: 18, paddingBottom: 48, gap: 12 },
  header: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 4 }, back: { fontSize: 44, color: "#0c433a", lineHeight: 46 },
  title: { fontSize: 25, fontWeight: "800", color: "#153c35" }, location: { marginTop: 2, color: "#6a746f", fontSize: 13 },
  summaryCard: { backgroundColor: "#0d493e", borderRadius: 18, padding: 16 }, summaryTitle: { color: "white", fontSize: 16, fontWeight: "800" }, summaryText: { color: "#e5f0ec", marginTop: 6, lineHeight: 19 },
  sectionLabel: { marginTop: 10, fontSize: 12, fontWeight: "800", color: "#61726d", letterSpacing: 1 },
  sourceCard: { flexDirection: "row", gap: 12, padding: 14, borderRadius: 16, borderWidth: 1, borderColor: "#d6dbd5", backgroundColor: "white" }, sourceCardActive: { borderColor: "#12624f", backgroundColor: "#edf6f2" },
  radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: "#9ba6a1", marginTop: 2 }, radioActive: { borderWidth: 5, borderColor: "#12624f" }, sourceTitle: { fontSize: 15, fontWeight: "800", color: "#1b3d36" }, sourceBody: { marginTop: 3, color: "#68736f", lineHeight: 18 },
  notice: { backgroundColor: "#fff5d9", borderRadius: 16, padding: 14, borderWidth: 1, borderColor: "#ead79f" }, noticeTitle: { fontWeight: "800", color: "#604a0d" }, noticeText: { marginTop: 5, color: "#725c1e", lineHeight: 19 }, linkButton: { marginTop: 10, alignSelf: "flex-start", backgroundColor: "#0d493e", paddingHorizontal: 12, paddingVertical: 9, borderRadius: 12 }, linkButtonText: { color: "white", fontWeight: "800" },
  controlsDisabled: { opacity: 0.42 }, rowWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 }, chip: { paddingHorizontal: 12, paddingVertical: 9, borderRadius: 12, borderWidth: 1, borderColor: "#ccd4d0", backgroundColor: "white" }, chipActive: { backgroundColor: "#0d493e", borderColor: "#0d493e" }, chipText: { color: "#27463e", fontWeight: "700" }, chipTextActive: { color: "white" }, disabled: { opacity: 0.45 },
  methodRow: { padding: 12, borderRadius: 12, backgroundColor: "white", borderWidth: 1, borderColor: "#d9dfdc", marginBottom: 7 }, methodRowActive: { borderColor: "#0d493e", backgroundColor: "#edf6f2" }, methodName: { fontWeight: "800", color: "#234139" }, methodNote: { color: "#7a8580", marginTop: 2 },
  previewCard: { marginTop: 8, backgroundColor: "white", padding: 13, borderRadius: 14, borderWidth: 1, borderColor: "#d8dedb" }, previewTitle: { color: "#68736f", fontSize: 12, fontWeight: "800" }, previewValue: { color: "#0d493e", fontSize: 23, fontWeight: "900", marginTop: 3 }, previewMeta: { color: "#7b8581", fontSize: 12, marginTop: 2 },
  tuneRow: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "white", borderRadius: 12, padding: 10, marginBottom: 7 }, tuneName: { flex: 1, fontWeight: "800", color: "#27463e" }, stepper: { width: 34, height: 34, borderRadius: 10, backgroundColor: "#e8efec", alignItems: "center", justifyContent: "center" }, stepperText: { fontSize: 20, fontWeight: "900", color: "#0d493e" }, offsetText: { width: 62, textAlign: "center", fontWeight: "700", color: "#4d5c57" },
  saveButton: { marginTop: 10, backgroundColor: "#0d493e", borderRadius: 16, alignItems: "center", paddingVertical: 15 }, saveText: { color: "white", fontSize: 16, fontWeight: "900" }, footnote: { color: "#68736f", lineHeight: 18, fontSize: 12, paddingHorizontal: 4 }
});