from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[2]
PAGE = ROOT / "mobile/src/PrayerCalculationSettingsPage.tsx"
DATA = ROOT / "mobile/src/prayerData.ts"

page = r'''import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
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
type Preview = { fajr?: string; dhuhr?: string; asr?: string; maghrib?: string; isha?: string; source: string };

const SCHOOL_OPTIONS = [
  { id: 0 as const, en: "Standard", ar: "قياسي", subEn: "Shafi‘i · Maliki · Hanbali", subAr: "شافعي · مالكي · حنبلي" },
  { id: 1 as const, en: "Hanafi", ar: "حنفي", subEn: "Later Asr calculation", subAr: "حساب عصر متأخر" }
];

const HIGH_LAT_OPTIONS = [
  { id: 3 as const, en: "Angle based", ar: "بحسب الزاوية" },
  { id: 1 as const, en: "Middle of night", ar: "منتصف الليل" },
  { id: 2 as const, en: "One-seventh", ar: "سُبع الليل" },
  { id: 0 as const, en: "None", ar: "بدون" }
];

const PRAYERS = [
  ["fajr", "Fajr", "الفجر"],
  ["dhuhr", "Dhuhr", "الظهر"],
  ["asr", "Asr", "العصر"],
  ["maghrib", "Maghrib", "المغرب"],
  ["isha", "Isha", "العشاء"]
] as const;

function SourceCard({ active, title, body, badge, onPress }: { active: boolean; title: string; body: string; badge?: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.sourceCard, active && styles.sourceCardActive]}>
      <View style={[styles.radio, active && styles.radioActive]}>{active ? <View style={styles.radioDot} /> : null}</View>
      <View style={{ flex: 1 }}>
        <View style={styles.sourceTitleRow}><Text style={styles.sourceTitle}>{title}</Text>{badge ? <Text style={styles.recommended}>{badge}</Text> : null}</View>
        <Text style={styles.sourceBody}>{body}</Text>
      </View>
    </Pressable>
  );
}

function Chip({ active, title, note, onPress }: { active: boolean; title: string; note?: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, active && styles.chipActive]}>
      <Text style={[styles.chipTitle, active && styles.chipTitleActive]}>{title}</Text>
      {note ? <Text style={[styles.chipNote, active && styles.chipNoteActive]}>{note}</Text> : null}
    </Pressable>
  );
}

export default function PrayerCalculationSettingsPage({ locale, onBack }: Props) {
  const ar = locale === "ar";
  const t = (en: string, arabic: string) => ar ? arabic : en;
  const [prefs, setPrefs] = useState<PrayerCalculationPreferences>(DEFAULT_CALCULATION_PREFS);
  const [savedSource, setSavedSource] = useState<string>("");
  const [savedLabel, setSavedLabel] = useState<string>("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void loadPrayerCalculationPreferences().then(setPrefs);
    void loadSavedPrayerContext().then((ctx) => {
      if (!ctx) return;
      setSavedSource(ctx.location.source);
      setSavedLabel(ctx.location.label);
    });
  }, []);

  const officialAvailable = savedSource === "windsor_islamic_association" || savedLabel.toLowerCase().includes("windsor");
  const resolvedSource = prefs.scheduleSource === "calculated"
    ? "calculated"
    : officialAvailable
      ? "official"
      : "calculated";
  const controlsEnabled = resolvedSource === "calculated";

  const sourceSummary = useMemo(() => {
    if (resolvedSource === "official") return t("Using official local mosque schedule", "يتم استخدام الجدول الرسمي للمسجد المحلي");
    return t("Using calculated prayer times", "يتم استخدام مواقيت الصلاة المحسوبة");
  }, [resolvedSource, ar]);

  useEffect(() => {
    let alive = true;
    if (!controlsEnabled) { setPreview(null); setPreviewing(false); return; }
    setPreviewing(true);
    const timer = setTimeout(() => {
      void previewPrayerDayForPreferences(prefs)
        .then((value) => { if (alive) setPreview(value); })
        .catch(() => { if (alive) setPreview(null); })
        .finally(() => { if (alive) setPreviewing(false); });
    }, 220);
    return () => { alive = false; clearTimeout(timer); };
  }, [prefs.mode, prefs.method, prefs.school, prefs.highLatitude, prefs.offsets.fajr, prefs.offsets.dhuhr, prefs.offsets.asr, prefs.offsets.maghrib, prefs.offsets.isha, prefs.scheduleSource, controlsEnabled]);

  const setSource = (scheduleSource: PrayerScheduleSource) => setPrefs((p) => ({ ...p, scheduleSource }));
  const reset = () => setPrefs(DEFAULT_CALCULATION_PREFS);

  const save = async () => {
    setSaving(true);
    try {
      await savePrayerCalculationPreferences(prefs);
      Alert.alert(
        t("Saved & applied", "تم الحفظ والتطبيق"),
        t("Hassoun will recalculate the phone immediately and sync these settings to paired supported displays.", "سيعيد حسون حساب المواقيت على الهاتف فوراً ويزامن هذه الإعدادات مع الشاشات المدعومة المقترنة.")
      );
    } finally { setSaving(false); }
  };

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Pressable onPress={onBack} style={styles.backButton}><Text style={styles.back}>‹</Text></Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{t("Prayer Calculation", "حساب مواقيت الصلاة")}</Text>
          <Text style={styles.location}>{savedLabel || t("Current saved location", "الموقع المحفوظ الحالي")}</Text>
        </View>
      </View>

      <View style={styles.engineCard}>
        <Text style={styles.engineEyebrow}>{t("ACTIVE SOURCE", "المصدر الفعلي")}</Text>
        <Text style={styles.engineTitle}>{sourceSummary}</Text>
        <Text style={styles.engineText}>{resolvedSource === "official"
          ? t("Hassoun found a trusted official timetable for this location. Choose Calculated Prayer Times below if you want method, Hanafi/Standard Asr, high-latitude and minute controls to change the times.", "وجد حسون جدولاً رسمياً موثوقاً لهذا الموقع. اختر المواقيت المحسوبة أدناه إذا أردت أن تغيّر الطريقة ومذهب العصر وقاعدة خطوط العرض وضبط الدقائق المواقيت.")
          : t("Calculation engine: AlAdhan using your saved GPS location and the settings below.", "محرك الحساب: AlAdhan باستخدام موقع GPS المحفوظ والإعدادات أدناه.")}
        </Text>
      </View>

      <Text style={styles.sectionLabel}>{t("1 · PRAYER TIME SOURCE", "١ · مصدر مواقيت الصلاة")}</Text>
      <SourceCard active={prefs.scheduleSource === "smart"} badge={t("RECOMMENDED", "موصى به")} onPress={() => setSource("smart")} title={t("Smart Automatic", "تلقائي ذكي")} body={t("Use an official trusted local schedule when Hassoun has one; otherwise calculate automatically from GPS.", "استخدم جدولاً محلياً رسمياً موثوقاً عند توفره، وإلا احسب تلقائياً من GPS.")} />
      <SourceCard active={prefs.scheduleSource === "official"} onPress={() => setSource("official")} title={t("Official Local Mosque Schedule", "الجدول الرسمي للمسجد المحلي")} body={officialAvailable ? t("Official timetable is available for your saved location.", "الجدول الرسمي متوفر لموقعك المحفوظ.") : t("Use an official timetable when Hassoun has one for this location; otherwise calculations are used.", "استخدم جدولاً رسمياً عندما يتوفر لهذا الموقع، وإلا تُستخدم المواقيت المحسوبة.")} />
      <SourceCard active={prefs.scheduleSource === "calculated"} onPress={() => setSource("calculated")} title={t("Calculated Prayer Times", "مواقيت الصلاة المحسوبة")} body={t("Always use GPS + the exact method, Asr school, high-latitude rule and minute adjustments you choose below.", "استخدم دائماً GPS مع الطريقة ومذهب العصر وقاعدة خطوط العرض وضبط الدقائق التي تختارها أدناه.")} />

      <View style={[styles.controlsPanel, !controlsEnabled && styles.controlsPanelInactive]}>
        {!controlsEnabled ? (
          <View style={styles.lockNotice}>
            <Text style={styles.lockTitle}>{t("Official timetable currently controls the times", "الجدول الرسمي يتحكم بالمواقيت حالياً")}</Text>
            <Text style={styles.lockText}>{t("Your calculation choices remain saved, but they only change prayer times when Calculated Prayer Times is selected.", "تبقى خيارات الحساب محفوظة، لكنها تغيّر المواقيت فقط عند اختيار المواقيت المحسوبة.")}</Text>
            <Pressable style={styles.enableButton} onPress={() => setSource("calculated")}><Text style={styles.enableButtonText}>{t("Switch to calculated times", "التبديل إلى المواقيت المحسوبة")}</Text></Pressable>
          </View>
        ) : null}

        <View pointerEvents={controlsEnabled ? "auto" : "none"} style={!controlsEnabled ? styles.dimmed : undefined}>
          <Text style={styles.sectionLabel}>{t("2 · CALCULATION METHOD", "٢ · طريقة الحساب")}</Text>
          <View style={styles.twoCol}>
            <Chip active={prefs.mode === "smart"} title={t("Smart method", "طريقة ذكية")} note={t("Hassoun chooses by region", "يختار حسون حسب المنطقة")} onPress={() => setPrefs((p) => ({ ...p, mode: "smart" }))} />
            <Chip active={prefs.mode === "manual"} title={t("Manual method", "طريقة يدوية")} note={t("You choose the standard", "أنت تختار المعيار")} onPress={() => setPrefs((p) => ({ ...p, mode: "manual" }))} />
          </View>

          {prefs.mode === "manual" ? <View style={styles.methodList}>{METHOD_OPTIONS.map((option) => (
            <Pressable key={option.id} onPress={() => setPrefs((p) => ({ ...p, method: option.id }))} style={[styles.methodRow, prefs.method === option.id && styles.methodRowActive]}>
              <View style={[styles.methodRadio, prefs.method === option.id && styles.methodRadioActive]} />
              <View style={{ flex: 1 }}><Text style={styles.methodName}>{option.name}</Text><Text style={styles.methodNote}>{option.note}</Text></View>
            </Pressable>
          ))}</View> : null}

          <Text style={styles.sectionLabel}>{t("3 · ASR SCHOOL", "٣ · مذهب العصر")}</Text>
          <View style={styles.twoCol}>{SCHOOL_OPTIONS.map((option) => (
            <Chip key={option.id} active={prefs.school === option.id} title={t(option.en, option.ar)} note={t(option.subEn, option.subAr)} onPress={() => setPrefs((p) => ({ ...p, school: option.id }))} />
          ))}</View>

          <Text style={styles.sectionLabel}>{t("4 · HIGH-LATITUDE RULE", "٤ · قاعدة خطوط العرض العالية")}</Text>
          <View style={styles.wrap}>{HIGH_LAT_OPTIONS.map((option) => <Chip key={option.id} active={prefs.highLatitude === option.id} title={t(option.en, option.ar)} onPress={() => setPrefs((p) => ({ ...p, highLatitude: option.id }))} />)}</View>

          <Text style={styles.sectionLabel}>{t("5 · MINUTE ADJUSTMENTS", "٥ · ضبط الدقائق")}</Text>
          <Text style={styles.helpText}>{t("Fine-tune any individual prayer from −30 to +30 minutes.", "اضبط أي صلاة بشكل مستقل من −30 إلى +30 دقيقة.")}</Text>
          {PRAYERS.map(([key, en, arabic]) => (
            <View key={key} style={styles.tuneRow}>
              <Text style={styles.tuneName}>{t(en, arabic)}</Text>
              <Pressable style={styles.stepper} onPress={() => setPrefs((p) => ({ ...p, offsets: { ...p.offsets, [key]: Math.max(-30, p.offsets[key] - 1) } }))}><Text style={styles.stepperText}>−</Text></Pressable>
              <Text style={styles.offsetText}>{prefs.offsets[key] > 0 ? `+${prefs.offsets[key]}` : prefs.offsets[key]} {t("min", "د")}</Text>
              <Pressable style={styles.stepper} onPress={() => setPrefs((p) => ({ ...p, offsets: { ...p.offsets, [key]: Math.min(30, p.offsets[key] + 1) } }))}><Text style={styles.stepperText}>+</Text></Pressable>
            </View>
          ))}
        </View>
      </View>

      <Text style={styles.sectionLabel}>{t("LIVE PREVIEW", "معاينة مباشرة")}</Text>
      <View style={styles.previewCard}>
        {!controlsEnabled ? <Text style={styles.previewInfo}>{t("Select Calculated Prayer Times to preview your calculation profile.", "اختر المواقيت المحسوبة لمعاينة إعدادات الحساب.")}</Text> : previewing ? <ActivityIndicator /> : preview ? <>
          <Text style={styles.previewMeta}>{preview.source}</Text>
          <View style={styles.previewGrid}>{PRAYERS.map(([key, en, arabic]) => (
            <View key={key} style={[styles.previewPrayer, key === "asr" && styles.previewPrayerEmphasis]}><Text style={styles.previewPrayerName}>{t(en, arabic)}</Text><Text style={styles.previewPrayerTime}>{preview[key] || "—"}</Text></View>
          ))}</View>
        </> : <Text style={styles.previewInfo}>{t("Preview unavailable until Hassoun has a saved location and network connection.", "المعاينة غير متاحة حتى يتوفر موقع محفوظ واتصال بالشبكة.")}</Text>}
      </View>

      <View style={styles.actionRow}>
        <Pressable style={styles.resetButton} onPress={reset}><Text style={styles.resetText}>{t("Reset defaults", "إعادة الافتراضي")}</Text></Pressable>
        <Pressable disabled={saving} style={[styles.saveButton, saving && styles.saveDisabled]} onPress={() => { void save(); }}><Text style={styles.saveText}>{saving ? t("Applying…", "جارٍ التطبيق…") : t("Save & apply now", "حفظ وتطبيق الآن")}</Text></Pressable>
      </View>

      <Text style={styles.footnote}>{t("These settings are the prayer-calculation source of truth for Hassoun phone calculations and are synced to paired supported displays. Official local timetables remain authoritative whenever Smart/Official mode resolves to one.", "هذه الإعدادات هي المصدر الأساسي لحساب مواقيت الصلاة في هاتف حسون ويتم مزامنتها مع الشاشات المدعومة المقترنة. وتبقى الجداول المحلية الرسمية هي المعتمدة عندما يختار الوضع الذكي أو الرسمي جدولاً متوفراً.")}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page:{flex:1,backgroundColor:"#f5f2e9"},content:{padding:18,paddingBottom:56,gap:12},header:{flexDirection:"row",alignItems:"center",gap:10},backButton:{width:42,height:42,borderRadius:21,backgroundColor:"#fff",alignItems:"center",justifyContent:"center"},back:{fontSize:35,color:"#0b5546",lineHeight:37},title:{fontSize:27,fontWeight:"900",color:"#153f36"},location:{fontSize:13,color:"#6a7772",marginTop:2},engineCard:{backgroundColor:"#0b5c4b",borderRadius:20,padding:17},engineEyebrow:{fontSize:11,fontWeight:"900",letterSpacing:1.4,color:"#f0d178"},engineTitle:{fontSize:19,fontWeight:"900",color:"#fff",marginTop:5},engineText:{fontSize:13,color:"#e5f1ed",lineHeight:19,marginTop:6},sectionLabel:{fontSize:12,fontWeight:"900",letterSpacing:1,color:"#5b7069",marginTop:7},sourceCard:{flexDirection:"row",gap:12,padding:14,borderRadius:17,borderWidth:1,borderColor:"#d9ddd7",backgroundColor:"#fff"},sourceCardActive:{borderColor:"#0b6b56",borderWidth:2,backgroundColor:"#ecf7f2"},radio:{width:20,height:20,borderRadius:10,borderWidth:2,borderColor:"#8ca098",marginTop:2,alignItems:"center",justifyContent:"center"},radioActive:{borderColor:"#0b6b56"},radioDot:{width:10,height:10,borderRadius:5,backgroundColor:"#0b6b56"},sourceTitleRow:{flexDirection:"row",alignItems:"center",gap:8,flexWrap:"wrap"},sourceTitle:{fontSize:16,fontWeight:"900",color:"#173f36"},sourceBody:{fontSize:13,color:"#697771",lineHeight:18,marginTop:4},recommended:{fontSize:9,fontWeight:"900",color:"#785b00",backgroundColor:"#f6df8a",paddingHorizontal:7,paddingVertical:3,borderRadius:9},controlsPanel:{gap:10},controlsPanelInactive:{borderRadius:18},lockNotice:{backgroundColor:"#fff8df",borderColor:"#e7ca69",borderWidth:1,borderRadius:16,padding:14},lockTitle:{fontSize:15,fontWeight:"900",color:"#654f08"},lockText:{fontSize:12,color:"#756522",lineHeight:18,marginTop:4},enableButton:{marginTop:10,alignSelf:"flex-start",backgroundColor:"#0b654f",paddingHorizontal:14,paddingVertical:9,borderRadius:12},enableButtonText:{color:"#fff",fontWeight:"900",fontSize:12},dimmed:{opacity:.38},twoCol:{flexDirection:"row",gap:10},wrap:{flexDirection:"row",gap:8,flexWrap:"wrap"},chip:{flex:1,minWidth:145,backgroundColor:"#fff",borderWidth:1,borderColor:"#d7ddd7",borderRadius:15,padding:12},chipActive:{backgroundColor:"#0f624f",borderColor:"#0f624f"},chipTitle:{fontSize:14,fontWeight:"900",color:"#173f36"},chipTitleActive:{color:"#fff"},chipNote:{fontSize:11,color:"#73817b",marginTop:3},chipNoteActive:{color:"#d8ece5"},methodList:{gap:7},methodRow:{flexDirection:"row",alignItems:"center",gap:10,backgroundColor:"#fff",borderWidth:1,borderColor:"#d8ddd8",borderRadius:14,padding:12},methodRowActive:{borderColor:"#0b6b56",backgroundColor:"#eef7f3"},methodRadio:{width:15,height:15,borderRadius:8,borderWidth:2,borderColor:"#9aa9a3"},methodRadioActive:{borderColor:"#0b6b56",backgroundColor:"#0b6b56"},methodName:{fontSize:14,fontWeight:"900",color:"#173f36"},methodNote:{fontSize:11,color:"#75827d",marginTop:2},helpText:{fontSize:12,color:"#6d7974",marginTop:-5},tuneRow:{flexDirection:"row",alignItems:"center",backgroundColor:"#fff",borderRadius:14,padding:10,borderWidth:1,borderColor:"#dde1dc"},tuneName:{flex:1,fontSize:15,fontWeight:"900",color:"#183f36"},stepper:{width:38,height:38,borderRadius:11,backgroundColor:"#edf4f1",alignItems:"center",justifyContent:"center"},stepperText:{fontSize:25,fontWeight:"700",color:"#0b654f",lineHeight:27},offsetText:{width:74,textAlign:"center",fontSize:14,fontWeight:"900",color:"#173f36"},previewCard:{backgroundColor:"#fff",borderRadius:18,padding:14,borderWidth:1,borderColor:"#d9ddd8"},previewInfo:{fontSize:13,color:"#6d7974",lineHeight:19},previewMeta:{fontSize:11,fontWeight:"800",color:"#7a8781",marginBottom:10},previewGrid:{flexDirection:"row",gap:6},previewPrayer:{flex:1,backgroundColor:"#f1f5f2",borderRadius:12,paddingVertical:10,paddingHorizontal:5,alignItems:"center"},previewPrayerEmphasis:{backgroundColor:"#e4f2ec"},previewPrayerName:{fontSize:10,fontWeight:"800",color:"#5d7069"},previewPrayerTime:{fontSize:13,fontWeight:"900",color:"#153f36",marginTop:3},actionRow:{flexDirection:"row",gap:10,marginTop:5},resetButton:{flex:1,borderRadius:15,padding:14,alignItems:"center",borderWidth:1,borderColor:"#bdc8c2",backgroundColor:"#fff"},resetText:{fontWeight:"900",color:"#466158"},saveButton:{flex:2,borderRadius:15,padding:14,alignItems:"center",backgroundColor:"#0b654f"},saveDisabled:{opacity:.6},saveText:{fontWeight:"900",color:"#fff",fontSize:15},footnote:{fontSize:11,color:"#77827e",lineHeight:17,marginTop:2}
});
'''
PAGE.write_text(page, encoding="utf-8")

data = DATA.read_text(encoding="utf-8")
pattern = re.compile(r'export async function previewPrayerDayForPreferences\(preferences: PrayerCalculationPreferences\): Promise<\{ asr\?: string; source: string \}> \{.*?\n\}\n\nfunction windsorFallback', re.S)
replacement = '''export async function previewPrayerDayForPreferences(preferences: PrayerCalculationPreferences): Promise<{ fajr?: string; dhuhr?: string; asr?: string; maghrib?: string; isha?: string; source: string }> {
  const saved = await loadSavedPrayerContext();
  if (!saved?.location) throw new Error("NO_SAVED_LOCATION");
  const { latitude, longitude } = saved.location;
  const now = new Date();
  const { payload, method } = await fetchAlAdhanMonth(latitude, longitude, now.getFullYear(), now.getMonth() + 1, preferences);
  const target = localDateKey();
  const day = payload.data?.find((item) => gregorianKey(item.date?.gregorian?.date) === target);
  return {
    fajr: parseTiming(day?.timings?.Fajr) || undefined,
    dhuhr: parseTiming(day?.timings?.Dhuhr) || undefined,
    asr: parseTiming(day?.timings?.Asr) || undefined,
    maghrib: parseTiming(day?.timings?.Maghrib) || undefined,
    isha: parseTiming(day?.timings?.Isha) || undefined,
    source: `${preferences.school === 1 ? "Hanafi" : "Standard"} Asr · method ${method}`
  };
}

function windsorFallback'''
data, count = pattern.subn(replacement, data, count=1)
if count != 1:
    raise SystemExit("Could not replace prayer calculation preview function")
DATA.write_text(data, encoding="utf-8")

for needle in ["Smart Automatic","Official Local Mosque Schedule","Calculated Prayer Times","Save & apply now","LIVE PREVIEW","Reset defaults","Switch to calculated times"]:
    if needle not in PAGE.read_text(encoding="utf-8"):
        raise SystemExit(f"Functional calculation page missing {needle}")
for needle in ["fajr: parseTiming", "dhuhr: parseTiming", "maghrib: parseTiming", "isha: parseTiming"]:
    if needle not in DATA.read_text(encoding="utf-8"):
        raise SystemExit(f"Full prayer preview missing {needle}")
print("Rebuilt Prayer Calculation as a fully interactive source/method/Asr/high-latitude/tuning page with live five-prayer preview")
