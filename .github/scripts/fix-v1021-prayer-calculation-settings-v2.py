from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SETTINGS = ROOT / "mobile/src/prayerCalculationSettings.ts"
PAGE = ROOT / "mobile/src/PrayerCalculationSettingsPage.tsx"
PRAYER = ROOT / "mobile/src/prayerData.ts"
HUB = ROOT / "mobile/src/SettingsHub.tsx"

SETTINGS.write_text(r'''import AsyncStorage from "@react-native-async-storage/async-storage";

export type CalculationMode = "smart" | "manual";
export type PrayerCalculationPreferences = {
  mode: CalculationMode;
  method: number;
  school: 0 | 1;
  highLatitude: 0 | 1 | 2 | 3;
  offsets: { fajr: number; dhuhr: number; asr: number; maghrib: number; isha: number };
};

export const CALCULATION_PREFS_KEY = "hassoun:prayer-calculation:v2";
export const DEFAULT_CALCULATION_PREFS: PrayerCalculationPreferences = {
  mode: "smart",
  method: 2,
  school: 0,
  highLatitude: 3,
  offsets: { fajr: 0, dhuhr: 0, asr: 0, maghrib: 0, isha: 0 }
};

export const METHOD_OPTIONS = [
  { id: 2, name: "ISNA", note: "North America" },
  { id: 3, name: "Muslim World League", note: "International" },
  { id: 4, name: "Umm al-Qura, Makkah", note: "Saudi Arabia" },
  { id: 5, name: "Egyptian Authority", note: "Egypt / nearby regions" },
  { id: 1, name: "University of Karachi", note: "South Asia" },
  { id: 7, name: "Tehran", note: "Institute of Geophysics" },
  { id: 0, name: "Jafari", note: "Ithna-Ashari" }
] as const;

export async function loadPrayerCalculationPreferences(): Promise<PrayerCalculationPreferences> {
  try {
    const raw = await AsyncStorage.getItem(CALCULATION_PREFS_KEY);
    if (!raw) return DEFAULT_CALCULATION_PREFS;
    const parsed = JSON.parse(raw) as Partial<PrayerCalculationPreferences>;
    return {
      ...DEFAULT_CALCULATION_PREFS,
      ...parsed,
      mode: parsed.mode === "manual" ? "manual" : "smart",
      school: parsed.school === 1 ? 1 : 0,
      highLatitude: parsed.highLatitude === 0 || parsed.highLatitude === 1 || parsed.highLatitude === 2 ? parsed.highLatitude : 3,
      offsets: { ...DEFAULT_CALCULATION_PREFS.offsets, ...(parsed.offsets || {}) }
    };
  } catch {
    return DEFAULT_CALCULATION_PREFS;
  }
}

export async function savePrayerCalculationPreferences(value: PrayerCalculationPreferences) {
  await AsyncStorage.setItem(CALCULATION_PREFS_KEY, JSON.stringify(value));
}

export function smartMethodForLocation(latitude: number, longitude: number) {
  if (latitude >= 16 && latitude <= 33 && longitude >= 34 && longitude <= 56) return 4;
  if (latitude >= 20 && latitude <= 33 && longitude >= 24 && longitude <= 37) return 5;
  if (latitude >= 5 && latitude <= 38 && longitude >= 60 && longitude <= 93) return 1;
  if (latitude >= 15 && latitude <= 72 && longitude >= -170 && longitude <= -50) return 2;
  return 3;
}

export function tuneString(offsets: PrayerCalculationPreferences["offsets"]) {
  return [offsets.fajr, 0, offsets.dhuhr, offsets.asr, 0, offsets.maghrib, offsets.isha, 0, 0].join(",");
}
''', encoding="utf-8")

PAGE.write_text(r'''import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import {
  DEFAULT_CALCULATION_PREFS,
  METHOD_OPTIONS,
  loadPrayerCalculationPreferences,
  savePrayerCalculationPreferences,
  type PrayerCalculationPreferences
} from "./prayerCalculationSettings";

type Props = { locale: "en" | "ar"; onBack: () => void };
const PRAYERS = ["fajr", "dhuhr", "asr", "maghrib", "isha"] as const;

export default function PrayerCalculationSettingsPage({ locale, onBack }: Props) {
  const ar = locale === "ar";
  const t = (en: string, arabic: string) => ar ? arabic : en;
  const [prefs, setPrefs] = useState<PrayerCalculationPreferences>(DEFAULT_CALCULATION_PREFS);
  const [saved, setSaved] = useState(false);
  useEffect(() => { void loadPrayerCalculationPreferences().then(setPrefs); }, []);
  const method = useMemo(() => METHOD_OPTIONS.find((item) => item.id === prefs.method), [prefs.method]);
  const update = (next: PrayerCalculationPreferences) => { setPrefs(next); setSaved(false); };
  const save = async () => { await savePrayerCalculationPreferences(prefs); setSaved(true); };
  const offset = (prayer: typeof PRAYERS[number], delta: number) => update({ ...prefs, offsets: { ...prefs.offsets, [prayer]: Math.max(-30, Math.min(30, prefs.offsets[prayer] + delta)) } });

  return <ScrollView style={styles.flex} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
    <View style={styles.header}><Pressable onPress={onBack} style={styles.back}><Text style={styles.backText}>‹</Text></Pressable><View style={{flex:1}}><Text style={styles.eyebrow}>{t("PRAYER TIMES", "مواقيت الصلاة")}</Text><Text style={styles.title}>{t("Calculation method", "طريقة حساب المواقيت")}</Text></View></View>
    <Text style={styles.subtitle}>{t("Near Windsor, Hassoun keeps using the official Windsor Islamic Association schedule. Outside Windsor, choose Smart or control every calculation option yourself.", "قرب وندسور يستمر حسّون باستخدام جدول جمعية وندسور الإسلامية الرسمي. خارج وندسور اختر الوضع الذكي أو تحكم بكل خيارات الحساب بنفسك.")}</Text>

    <View style={styles.smartCard}>
      <View style={{flex:1}}><View style={styles.badge}><Text style={styles.badgeText}>{t("RECOMMENDED", "موصى به")}</Text></View><Text style={styles.smartTitle}>{t("Smart automatic", "الحساب الذكي التلقائي")}</Text><Text style={styles.smartText}>{t("Hassoun selects a recognized method from your live location. Best for travel and automatic city changes.", "يختار حسّون طريقة معتمدة حسب موقعك المباشر. الأفضل للسفر وتغيير المدن تلقائياً.")}</Text></View>
      <Switch value={prefs.mode === "smart"} onValueChange={(value) => update({ ...prefs, mode: value ? "smart" : "manual" })} />
    </View>

    <View style={styles.summary}><Text style={styles.summaryLabel}>{t("CURRENT MODE", "الوضع الحالي")}</Text><Text style={styles.summaryValue}>{prefs.mode === "smart" ? t("Smart — location based", "ذكي — حسب الموقع") : `${method?.name || "Manual"} • ${prefs.school === 1 ? t("Hanafi", "حنفي") : t("Standard", "عادي")}`}</Text></View>

    <Text style={styles.section}>{t("CALCULATION METHOD", "طريقة الحساب")}</Text>
    <Text style={styles.helper}>{prefs.mode === "smart" ? t("Turn Smart off to choose a method manually.", "أوقف الوضع الذكي لاختيار الطريقة يدوياً.") : t("Pick the method used by your local mosque or authority.", "اختر الطريقة التي يستخدمها مسجدك أو الجهة المحلية.")}</Text>
    {METHOD_OPTIONS.map((item) => <Pressable key={item.id} disabled={prefs.mode === "smart"} onPress={() => update({ ...prefs, mode: "manual", method: item.id })} style={[styles.option, prefs.mode === "manual" && prefs.method === item.id && styles.optionActive, prefs.mode === "smart" && styles.disabled]}>
      <View style={[styles.radio, prefs.mode === "manual" && prefs.method === item.id && styles.radioActive]}>{prefs.mode === "manual" && prefs.method === item.id ? <View style={styles.dot}/> : null}</View><View style={{flex:1}}><Text style={styles.optionTitle}>{item.name}</Text><Text style={styles.optionNote}>{item.note}</Text></View>
    </Pressable>)}

    <Text style={styles.section}>{t("ASR SCHOOL", "مذهب العصر")}</Text>
    <View style={styles.twoCol}>
      <Pressable onPress={() => update({ ...prefs, school: 0 })} style={[styles.choice, prefs.school === 0 && styles.choiceActive]}><Text style={[styles.choiceTitle, prefs.school === 0 && styles.choiceTitleActive]}>{t("Standard", "عادي")}</Text><Text style={[styles.choiceNote, prefs.school === 0 && styles.choiceNoteActive]}>{t("Shafi‘i • Maliki • Hanbali", "شافعي • مالكي • حنبلي")}</Text></Pressable>
      <Pressable onPress={() => update({ ...prefs, school: 1 })} style={[styles.choice, prefs.school === 1 && styles.choiceActive]}><Text style={[styles.choiceTitle, prefs.school === 1 && styles.choiceTitleActive]}>{t("Hanafi", "حنفي")}</Text><Text style={[styles.choiceNote, prefs.school === 1 && styles.choiceNoteActive]}>{t("Later Asr shadow rule", "قاعدة ظل العصر الحنفي")}</Text></Pressable>
    </View>

    <Text style={styles.section}>{t("HIGH-LATITUDE RULE", "قاعدة خطوط العرض العالية")}</Text>
    {([[3,t("Angle based", "حسب الزاوية")],[1,t("Middle of night", "منتصف الليل")],[2,t("One-seventh of night", "سُبع الليل")],[0,t("None", "بدون")]] as Array<[0|1|2|3,string]>).map(([id,label]) => <Pressable key={id} onPress={() => update({ ...prefs, highLatitude:id })} style={[styles.slimOption, prefs.highLatitude === id && styles.optionActive]}><Text style={styles.slimText}>{prefs.highLatitude === id ? "✓  " : "    "}{label}</Text></Pressable>)}

    <Text style={styles.section}>{t("FINE-TUNE BY MINUTES", "ضبط الدقائق")}</Text>
    <Text style={styles.helper}>{t("Optional. Adjust individual prayers from −30 to +30 minutes if your local mosque differs slightly.", "اختياري. عدّل كل صلاة من ‎−30 إلى +30 دقيقة إذا كان مسجدك المحلي يختلف قليلاً.")}</Text>
    {PRAYERS.map((prayer) => <View key={prayer} style={styles.offsetRow}><Text style={styles.offsetName}>{t(prayer[0].toUpperCase()+prayer.slice(1), prayer === "fajr" ? "الفجر" : prayer === "dhuhr" ? "الظهر" : prayer === "asr" ? "العصر" : prayer === "maghrib" ? "المغرب" : "العشاء")}</Text><Pressable onPress={() => offset(prayer,-1)} style={styles.step}><Text style={styles.stepText}>−</Text></Pressable><Text style={styles.offsetValue}>{prefs.offsets[prayer] > 0 ? "+" : ""}{prefs.offsets[prayer]} {t("min", "د")}</Text><Pressable onPress={() => offset(prayer,1)} style={styles.step}><Text style={styles.stepText}>+</Text></Pressable></View>)}

    <Pressable onPress={() => update(DEFAULT_CALCULATION_PREFS)} style={styles.reset}><Text style={styles.resetText}>{t("Reset recommended defaults", "إعادة الإعدادات الموصى بها")}</Text></Pressable>
    <Pressable onPress={() => void save()} style={styles.save}><Text style={styles.saveText}>{saved ? t("✓ Saved", "✓ تم الحفظ") : t("Save & use these settings", "حفظ واستخدام هذه الإعدادات")}</Text></Pressable>
    <Text style={styles.footer}>{t("Pull down on Home after saving to recalculate immediately with a fresh GPS location.", "بعد الحفظ اسحب للأسفل في الرئيسية لإعادة الحساب فوراً باستخدام موقع GPS جديد.")}</Text>
  </ScrollView>;
}

const styles = StyleSheet.create({
  flex:{flex:1,backgroundColor:"#f8f5ee"},content:{padding:18,paddingBottom:44},header:{flexDirection:"row",alignItems:"center",gap:12},back:{width:44,height:44,borderRadius:14,backgroundColor:"#fff",alignItems:"center",justifyContent:"center",borderWidth:1,borderColor:"#ded9cf"},backText:{fontSize:30,fontWeight:"900",color:"#0b654f"},eyebrow:{fontSize:9,fontWeight:"900",letterSpacing:1.2,color:"#a17c36"},title:{fontSize:22,fontWeight:"900",color:"#173f35"},subtitle:{marginTop:14,fontSize:12.5,lineHeight:19,color:"#64746f"},smartCard:{marginTop:18,padding:17,borderRadius:22,backgroundColor:"#0b654f",flexDirection:"row",alignItems:"center",gap:12},badge:{alignSelf:"flex-start",borderRadius:999,backgroundColor:"#f0d27a",paddingHorizontal:8,paddingVertical:4,marginBottom:8},badgeText:{fontSize:8,fontWeight:"900",letterSpacing:.8,color:"#57420f"},smartTitle:{fontSize:17,fontWeight:"900",color:"#fff"},smartText:{fontSize:11,lineHeight:16,color:"#d9ebe5",marginTop:4},summary:{marginTop:10,padding:13,borderRadius:16,backgroundColor:"#fff",borderWidth:1,borderColor:"#e2ddd2"},summaryLabel:{fontSize:8,fontWeight:"900",letterSpacing:1,color:"#9b7a39"},summaryValue:{fontSize:13,fontWeight:"900",color:"#173f35",marginTop:3},section:{marginTop:24,marginBottom:5,fontSize:10,fontWeight:"900",letterSpacing:1.1,color:"#8e6c2e"},helper:{fontSize:10.5,lineHeight:15,color:"#78837f",marginBottom:9},option:{flexDirection:"row",gap:12,alignItems:"center",padding:14,borderRadius:16,backgroundColor:"#fff",borderWidth:1,borderColor:"#dfdbd1",marginBottom:8},optionActive:{borderColor:"#0b654f",backgroundColor:"#edf7f3"},disabled:{opacity:.48},radio:{width:21,height:21,borderRadius:11,borderWidth:2,borderColor:"#9aa6a1",alignItems:"center",justifyContent:"center"},radioActive:{borderColor:"#0b654f"},dot:{width:11,height:11,borderRadius:6,backgroundColor:"#0b654f"},optionTitle:{fontSize:13,fontWeight:"900",color:"#173f35"},optionNote:{fontSize:10,color:"#7b8782",marginTop:2},twoCol:{flexDirection:"row",gap:9},choice:{flex:1,padding:14,borderRadius:16,backgroundColor:"#fff",borderWidth:1,borderColor:"#dfdbd1"},choiceActive:{backgroundColor:"#0b654f",borderColor:"#0b654f"},choiceTitle:{fontSize:13,fontWeight:"900",color:"#173f35"},choiceTitleActive:{color:"#fff"},choiceNote:{fontSize:9.5,lineHeight:13,color:"#7b8782",marginTop:3},choiceNoteActive:{color:"#d9ebe5"},slimOption:{padding:12,borderRadius:14,backgroundColor:"#fff",borderWidth:1,borderColor:"#dfdbd1",marginBottom:7},slimText:{fontSize:12,fontWeight:"800",color:"#294e44"},offsetRow:{flexDirection:"row",alignItems:"center",padding:10,backgroundColor:"#fff",borderRadius:14,marginBottom:7,borderWidth:1,borderColor:"#e7e2d8"},offsetName:{flex:1,fontSize:12.5,fontWeight:"900",color:"#173f35"},step:{width:36,height:36,borderRadius:12,backgroundColor:"#e8eee9",alignItems:"center",justifyContent:"center"},stepText:{fontSize:22,fontWeight:"900",color:"#0b654f"},offsetValue:{width:72,textAlign:"center",fontSize:11.5,fontWeight:"900",color:"#4c5d58"},reset:{marginTop:16,padding:13,alignItems:"center"},resetText:{fontSize:11.5,fontWeight:"800",color:"#8b6731"},save:{minHeight:54,borderRadius:999,backgroundColor:"#0b654f",alignItems:"center",justifyContent:"center"},saveText:{fontSize:14,fontWeight:"900",color:"#fff"},footer:{textAlign:"center",fontSize:10,lineHeight:15,color:"#78847f",marginTop:12}
});
''', encoding="utf-8")

p = PRAYER.read_text(encoding="utf-8")
if 'from "./prayerCalculationSettings"' not in p:
    anchor = 'import type { PrayerFile, PrayerTimes } from "./types";'
    if anchor not in p:
        raise SystemExit("Prayer import anchor missing")
    p = p.replace(anchor, anchor + '\nimport { loadPrayerCalculationPreferences, smartMethodForLocation, tuneString } from "./prayerCalculationSettings";', 1)

old_fetch = '''async function fetchMonth(latitude: number, longitude: number, timezone: string, year: number, month: number) {\n  const url = new URL(PRAYER_API_URL);\n  url.searchParams.set("lat", String(latitude));\n  url.searchParams.set("lng", String(longitude));\n  url.searchParams.set("timezone", timezone);\n  url.searchParams.set("year", String(year));\n  url.searchParams.set("month", String(month));\n  url.searchParams.set("method", "3");\n  url.searchParams.set("school", "0");'''
new_fetch = '''async function fetchMonth(latitude: number, longitude: number, timezone: string, year: number, month: number) {\n  const calcPrefs = await loadPrayerCalculationPreferences();\n  const method = calcPrefs.mode === "smart" ? smartMethodForLocation(latitude, longitude) : calcPrefs.method;\n  const url = new URL(PRAYER_API_URL);\n  url.searchParams.set("lat", String(latitude));\n  url.searchParams.set("lng", String(longitude));\n  url.searchParams.set("timezone", timezone);\n  url.searchParams.set("year", String(year));\n  url.searchParams.set("month", String(month));\n  url.searchParams.set("method", String(method));\n  url.searchParams.set("school", String(calcPrefs.school));\n  url.searchParams.set("latitudeAdjustmentMethod", String(calcPrefs.highLatitude));\n  url.searchParams.set("tune", tuneString(calcPrefs.offsets));'''
if old_fetch in p:
    p = p.replace(old_fetch, new_fetch, 1)
elif 'const calcPrefs = await loadPrayerCalculationPreferences();' not in p:
    raise SystemExit("Could not patch PRAYER_API_URL calculation block")
PRAYER.write_text(p, encoding="utf-8")

hub = HUB.read_text(encoding="utf-8")
if 'PrayerCalculationSettingsPage' not in hub:
    hub = hub.replace('import AboutHassounPage from "./AboutHassounPage";', 'import AboutHassounPage from "./AboutHassounPage";\nimport PrayerCalculationSettingsPage from "./PrayerCalculationSettingsPage";', 1)

old_type = 'type SettingsPage = "root" | "about" | "guide" | "contact" | "privacy" | "terms" | "data" | "permissions" | "widgets";'
new_type = 'type SettingsPage = "root" | "about" | "guide" | "contact" | "privacy" | "terms" | "data" | "permissions" | "widgets" | "calculation";'
if old_type in hub:
    hub = hub.replace(old_type, new_type, 1)
elif '"calculation"' not in hub:
    raise SystemExit("SettingsPage type anchor missing")

row_anchor = '        <Row emoji="🔔" title={t("Prayer & Adhan alerts", "تنبيهات الصلاة والأذان")} text={t("Notification, Adhan and email alert controls", "التحكم بالتنبيهات والأذان وتنبيهات البريد")} onPress={onOpenAlerts} />'
calc_row = row_anchor + '\n        <Row emoji="🧭" title={t("Prayer calculation", "حساب مواقيت الصلاة")} text={t("Smart method, manual methods, Asr school, high-latitude rules and minute tuning", "طريقة ذكية وطرق يدوية ومذهب العصر وقواعد خطوط العرض وضبط الدقائق")} onPress={() => setPage("calculation")} />'
if 'title={t("Prayer calculation"' not in hub:
    if row_anchor not in hub:
        raise SystemExit("Settings prayer-alert row anchor missing")
    hub = hub.replace(row_anchor, calc_row, 1)

page_anchor = '  if (page === "widgets") {'
if 'page === "calculation"' not in hub:
    if page_anchor not in hub:
        raise SystemExit("Settings widgets page anchor missing")
    hub = hub.replace(page_anchor, '  if (page === "calculation") return <PrayerCalculationSettingsPage locale={locale} onBack={() => setPage("root")} />;\n\n' + page_anchor, 1)
HUB.write_text(hub, encoding="utf-8")

checks = {
    SETTINGS: ['METHOD_OPTIONS', 'smartMethodForLocation', 'tuneString'],
    PAGE: ['Smart automatic', 'FINE-TUNE BY MINUTES', 'Save & use these settings'],
    PRAYER: ['const calcPrefs = await loadPrayerCalculationPreferences();', 'latitudeAdjustmentMethod', 'tuneString(calcPrefs.offsets)'],
    HUB: ['PrayerCalculationSettingsPage', 'Prayer calculation', 'page === "calculation"'],
}
for path, needles in checks.items():
    text = path.read_text(encoding="utf-8")
    for needle in needles:
        if needle not in text:
            raise SystemExit(f"Missing {needle} in {path}")

print("Installed smart prayer calculation UI and PRAYER_API_URL calculation controls")
