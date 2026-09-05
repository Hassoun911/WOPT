from pathlib import Path
import re

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

export const CALCULATION_PREFS_KEY = "hassoun:prayer-calculation:v1";
export const DEFAULT_CALCULATION_PREFS: PrayerCalculationPreferences = {
  mode: "smart",
  method: 3,
  school: 0,
  highLatitude: 3,
  offsets: { fajr: 0, dhuhr: 0, asr: 0, maghrib: 0, isha: 0 }
};

export const METHOD_OPTIONS = [
  { id: 3, name: "Muslim World League", note: "Common international method" },
  { id: 2, name: "ISNA", note: "Common in North America" },
  { id: 4, name: "Umm al-Qura, Makkah", note: "Common in Saudi Arabia" },
  { id: 5, name: "Egyptian General Authority", note: "Common in Egypt and nearby regions" },
  { id: 1, name: "University of Karachi", note: "Common in Pakistan and South Asia" },
  { id: 7, name: "Institute of Geophysics, Tehran", note: "Iran / Shia calculation option" },
  { id: 0, name: "Jafari / Ithna-Ashari", note: "Shia Ithna-Ashari calculation" }
] as const;

export async function loadPrayerCalculationPreferences(): Promise<PrayerCalculationPreferences> {
  try {
    const raw = await AsyncStorage.getItem(CALCULATION_PREFS_KEY);
    if (!raw) return DEFAULT_CALCULATION_PREFS;
    const parsed = JSON.parse(raw) as Partial<PrayerCalculationPreferences>;
    return {
      ...DEFAULT_CALCULATION_PREFS,
      ...parsed,
      offsets: { ...DEFAULT_CALCULATION_PREFS.offsets, ...(parsed.offsets || {}) },
      school: parsed.school === 1 ? 1 : 0,
      mode: parsed.mode === "manual" ? "manual" : "smart"
    };
  } catch { return DEFAULT_CALCULATION_PREFS; }
}

export async function savePrayerCalculationPreferences(value: PrayerCalculationPreferences) {
  await AsyncStorage.setItem(CALCULATION_PREFS_KEY, JSON.stringify(value));
}

export function smartMethodForLocation(latitude: number, longitude: number) {
  // Saudi Arabia / Gulf core
  if (latitude >= 16 && latitude <= 33 && longitude >= 34 && longitude <= 56) return 4;
  // Egypt / North-East Africa
  if (latitude >= 20 && latitude <= 33 && longitude >= 24 && longitude <= 37) return 5;
  // Pakistan / India / Bangladesh region
  if (latitude >= 5 && latitude <= 38 && longitude >= 60 && longitude <= 93) return 1;
  // North America
  if (latitude >= 15 && latitude <= 72 && longitude >= -170 && longitude <= -50) return 2;
  return 3;
}
''', encoding="utf-8")

PAGE.write_text(r'''import { useEffect, useState } from "react";
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

  const update = (next: PrayerCalculationPreferences) => { setPrefs(next); setSaved(false); };
  const save = async () => { await savePrayerCalculationPreferences(prefs); setSaved(true); };
  const offset = (prayer: typeof PRAYERS[number], delta: number) => update({
    ...prefs,
    offsets: { ...prefs.offsets, [prayer]: Math.max(-30, Math.min(30, prefs.offsets[prayer] + delta)) }
  });

  return <ScrollView style={styles.flex} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
    <View style={styles.header}><Pressable onPress={onBack} style={styles.back}><Text style={styles.backText}>‹</Text></Pressable><View><Text style={styles.eyebrow}>PRAYER TIMES</Text><Text style={styles.title}>{t("Calculation settings", "إعدادات حساب المواقيت")}</Text></View></View>
    <Text style={styles.subtitle}>{t("Hassoun automatically uses the official Windsor Islamic Association schedule while you are near Windsor. These choices control calculated prayer times everywhere else.", "يستخدم حسّون تلقائياً جدول جمعية وندسور الإسلامية الرسمي عند وجودك قرب وندسور. هذه الخيارات تتحكم بحساب المواقيت في الأماكن الأخرى.")}</Text>

    <View style={styles.hero}>
      <View style={{flex:1}}><Text style={styles.heroTitle}>{t("Smart automatic method", "الطريقة الذكية التلقائية")}</Text><Text style={styles.heroText}>{t("Recommended. Hassoun chooses a recognized method based on the device location.", "موصى بها. يختار حسّون طريقة معتمدة تلقائياً حسب موقع الجهاز.")}</Text></View>
      <Switch value={prefs.mode === "smart"} onValueChange={(v) => update({ ...prefs, mode: v ? "smart" : "manual" })} />
    </View>

    <Text style={styles.section}>{t("CALCULATION METHOD", "طريقة الحساب")}</Text>
    {METHOD_OPTIONS.map((item) => <Pressable key={item.id} disabled={prefs.mode === "smart"} onPress={() => update({ ...prefs, mode: "manual", method: item.id })} style={[styles.option, prefs.mode === "manual" && prefs.method === item.id && styles.optionActive, prefs.mode === "smart" && styles.optionDisabled]}>
      <View style={styles.radio}>{prefs.mode === "manual" && prefs.method === item.id ? <View style={styles.radioDot}/> : null}</View><View style={{flex:1}}><Text style={styles.optionTitle}>{item.name}</Text><Text style={styles.optionText}>{item.note}</Text></View>
    </Pressable>)}

    <Text style={styles.section}>{t("ASR SCHOOL", "مذهب العصر")}</Text>
    <View style={styles.segmentRow}>
      <Pressable onPress={() => update({ ...prefs, school: 0 })} style={[styles.segment, prefs.school === 0 && styles.segmentActive]}><Text style={[styles.segmentText, prefs.school === 0 && styles.segmentTextActive]}>{t("Standard (Shafi‘i/Maliki/Hanbali)", "الشافعي / المالكي / الحنبلي")}</Text></Pressable>
      <Pressable onPress={() => update({ ...prefs, school: 1 })} style={[styles.segment, prefs.school === 1 && styles.segmentActive]}><Text style={[styles.segmentText, prefs.school === 1 && styles.segmentTextActive]}>{t("Hanafi", "الحنفي")}</Text></Pressable>
    </View>

    <Text style={styles.section}>{t("HIGH-LATITUDE RULE", "قاعدة خطوط العرض العالية")}</Text>
    {([[3,"Angle based"],[1,"Middle of night"],[2,"One-seventh of night"],[0,"None"]] as Array<[0|1|2|3,string]>).map(([id,label]) => <Pressable key={id} onPress={() => update({ ...prefs, highLatitude:id })} style={[styles.smallOption, prefs.highLatitude === id && styles.optionActive]}><Text style={styles.smallOptionText}>{prefs.highLatitude === id ? "✓ " : ""}{label}</Text></Pressable>)}

    <Text style={styles.section}>{t("MANUAL FINE-TUNING", "ضبط يدوي بالدقائق")}</Text>
    <Text style={styles.note}>{t("Optional offsets are applied after calculation. Use only if your local mosque differs by a few minutes.", "تُطبق الفروقات الاختيارية بعد الحساب. استخدمها فقط إذا كان مسجدك المحلي يختلف ببضع دقائق.")}</Text>
    {PRAYERS.map((prayer) => <View key={prayer} style={styles.offsetRow}><Text style={styles.offsetName}>{prayer[0].toUpperCase()+prayer.slice(1)}</Text><Pressable onPress={() => offset(prayer,-1)} style={styles.step}><Text style={styles.stepText}>−</Text></Pressable><Text style={styles.offsetValue}>{prefs.offsets[prayer] > 0 ? "+" : ""}{prefs.offsets[prayer]} min</Text><Pressable onPress={() => offset(prayer,1)} style={styles.step}><Text style={styles.stepText}>+</Text></Pressable></View>)}

    <Pressable onPress={() => update(DEFAULT_CALCULATION_PREFS)} style={styles.reset}><Text style={styles.resetText}>{t("Reset recommended defaults", "إعادة الإعدادات الموصى بها")}</Text></Pressable>
    <Pressable onPress={() => void save()} style={styles.save}><Text style={styles.saveText}>{saved ? t("✓ Saved", "✓ تم الحفظ") : t("Save calculation settings", "حفظ إعدادات الحساب")}</Text></Pressable>
    <Text style={styles.footer}>{t("Changes apply on the next location/prayer refresh. Pull down on Home to force an immediate update.", "تُطبق التغييرات عند تحديث الموقع والمواقيت. اسحب للأسفل في الصفحة الرئيسية للتحديث فوراً.")}</Text>
  </ScrollView>;
}

const styles=StyleSheet.create({
  flex:{flex:1,backgroundColor:"#f7f4ec"},content:{padding:18,paddingBottom:40},header:{flexDirection:"row",alignItems:"center",gap:12},back:{width:44,height:44,borderRadius:14,backgroundColor:"#fff",alignItems:"center",justifyContent:"center",borderWidth:1,borderColor:"#ddd8ce"},backText:{fontSize:30,color:"#0b5b47",fontWeight:"900"},eyebrow:{fontSize:9,fontWeight:"900",letterSpacing:1.2,color:"#9b7a39"},title:{fontSize:24,fontWeight:"900",color:"#173f35"},subtitle:{marginTop:14,color:"#687873",fontSize:13,lineHeight:19},hero:{marginTop:18,padding:16,borderRadius:20,backgroundColor:"#0b5b47",flexDirection:"row",gap:12,alignItems:"center"},heroTitle:{color:"#fff",fontSize:16,fontWeight:"900"},heroText:{color:"#d7ebe4",fontSize:11,lineHeight:16,marginTop:4},section:{marginTop:24,marginBottom:8,color:"#8f7136",fontSize:10,fontWeight:"900",letterSpacing:1.1},option:{flexDirection:"row",alignItems:"center",gap:12,padding:14,borderRadius:16,backgroundColor:"#fff",borderWidth:1,borderColor:"#ddd9cf",marginBottom:8},optionActive:{borderColor:"#0b654f",backgroundColor:"#edf7f3"},optionDisabled:{opacity:.55},radio:{width:20,height:20,borderRadius:10,borderWidth:2,borderColor:"#0b654f",alignItems:"center",justifyContent:"center"},radioDot:{width:10,height:10,borderRadius:5,backgroundColor:"#0b654f"},optionTitle:{fontSize:13,fontWeight:"900",color:"#173f35"},optionText:{fontSize:10,color:"#7b8782",marginTop:2},segmentRow:{gap:8},segment:{padding:13,borderRadius:15,backgroundColor:"#fff",borderWidth:1,borderColor:"#ddd9cf"},segmentActive:{backgroundColor:"#0b654f",borderColor:"#0b654f"},segmentText:{fontSize:12,fontWeight:"800",color:"#425852"},segmentTextActive:{color:"#fff"},smallOption:{padding:12,borderRadius:14,backgroundColor:"#fff",borderWidth:1,borderColor:"#ddd9cf",marginBottom:7},smallOptionText:{fontSize:12,fontWeight:"800",color:"#294e44"},note:{fontSize:11,lineHeight:16,color:"#76827e",marginBottom:8},offsetRow:{flexDirection:"row",alignItems:"center",padding:10,backgroundColor:"#fff",borderRadius:14,marginBottom:7},offsetName:{flex:1,fontSize:13,fontWeight:"900",color:"#173f35"},step:{width:36,height:36,borderRadius:12,backgroundColor:"#e8eee9",alignItems:"center",justifyContent:"center"},stepText:{fontSize:22,fontWeight:"900",color:"#0b654f"},offsetValue:{width:76,textAlign:"center",fontSize:12,fontWeight:"900",color:"#4c5d58"},reset:{marginTop:18,padding:13,alignItems:"center"},resetText:{color:"#8b6731",fontWeight:"800",fontSize:12},save:{marginTop:4,minHeight:52,borderRadius:999,backgroundColor:"#0b654f",alignItems:"center",justifyContent:"center"},saveText:{color:"#fff",fontWeight:"900",fontSize:14},footer:{textAlign:"center",color:"#78847f",fontSize:10,lineHeight:15,marginTop:12}
});
''', encoding="utf-8")

p = PRAYER.read_text(encoding="utf-8")
if 'from "./prayerCalculationSettings"' not in p:
    # Add calculation settings import after other local imports.
    lines = p.splitlines()
    insert = 0
    for i,line in enumerate(lines):
      if line.startswith('import '): insert = i+1
    lines.insert(insert, 'import { loadPrayerCalculationPreferences, smartMethodForLocation } from "./prayerCalculationSettings";')
    p = '\n'.join(lines) + ('\n' if p.endswith('\n') else '')

# Inject prefs immediately before calculated API URL setup, using broad anchors used by the location-aware v1.0.20 pipeline.
if 'const calcPrefs = await loadPrayerCalculationPreferences();' not in p:
    # Prefer first calendar URL occurrence inside calculation function.
    marker = 'const url = new URL(`https://api.aladhan.com/v1/calendar/'
    idx = p.find(marker)
    if idx < 0:
        raise SystemExit("Could not find AlAdhan calendar URL in prayerData.ts")
    line_start = p.rfind('\n',0,idx)+1
    indent = p[line_start:idx]
    injection = indent + 'const calcPrefs = await loadPrayerCalculationPreferences();\n' + indent + 'const selectedMethod = calcPrefs.mode === "smart" ? smartMethodForLocation(latitude, longitude) : calcPrefs.method;\n'
    p = p[:line_start] + injection + p[line_start:]

p = re.sub(r'url\.searchParams\.set\("method",\s*"3"\);', 'url.searchParams.set("method", String(selectedMethod));', p)
p = re.sub(r'url\.searchParams\.set\("school",\s*"0"\);', 'url.searchParams.set("school", String(calcPrefs.school));\n    url.searchParams.set("latitudeAdjustmentMethod", String(calcPrefs.highLatitude));', p)

# Apply saved minute offsets to parsed prayer times after the API result is assembled.
# Handle common object names without changing Windsor official schedule data.
if 'applyCalculationOffset' not in p:
    helper = '''\nfunction applyCalculationOffset(value: string, minutes: number) {\n  if (!minutes) return value;\n  const m = String(value || "").match(/^(\\d{1,2}):(\\d{2})/);\n  if (!m) return value;\n  let total = Number(m[1]) * 60 + Number(m[2]) + minutes;\n  total = ((total % 1440) + 1440) % 1440;\n  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;\n}\n'''
    first_export = p.find('export ')
    if first_export < 0: first_export = len(p)
    p = p[:first_export] + helper + p[first_export:]

# Patch the common parsed prayer object if present.
for name in ('parsed', 'dayTimes', 'prayers'):
    needle = f'prayerTimes[key] = {name}'
    if needle in p and f'applyCalculationOffset({name}.fajr' not in p:
        replacement = f'''{name}.fajr = applyCalculationOffset({name}.fajr, calcPrefs.offsets.fajr);\n      {name}.dhuhr = applyCalculationOffset({name}.dhuhr, calcPrefs.offsets.dhuhr);\n      {name}.asr = applyCalculationOffset({name}.asr, calcPrefs.offsets.asr);\n      {name}.maghrib = applyCalculationOffset({name}.maghrib, calcPrefs.offsets.maghrib);\n      {name}.isha = applyCalculationOffset({name}.isha, calcPrefs.offsets.isha);\n      prayerTimes[key] = {name}'''
        p = p.replace(needle, replacement, 1)
        break

PRAYER.write_text(p, encoding="utf-8")

h = HUB.read_text(encoding="utf-8")
if 'import PrayerCalculationSettingsPage from "./PrayerCalculationSettingsPage";' not in h:
    anchor = 'import BrandMark from "./BrandMark";\n'
    if anchor not in h: raise SystemExit("SettingsHub BrandMark import missing")
    h = h.replace(anchor, anchor + 'import PrayerCalculationSettingsPage from "./PrayerCalculationSettingsPage";\n',1)

m = re.search(r'type SettingsPage = ([^;]+);', h)
if not m: raise SystemExit("SettingsPage union missing")
parts=[x.strip() for x in m.group(1).split('|')]
if '"prayerCalculation"' not in parts: parts.append('"prayerCalculation"')
h = h[:m.start(1)] + ' | '.join(parts) + h[m.end(1):]

if 'title={t("Prayer calculation", "حساب مواقيت الصلاة")}' not in h:
    alert_row = re.search(r'(\s*<Row[^\n]*title=\{t\("Prayer & Adhan alerts"[^\n]*/>)', h)
    if not alert_row: raise SystemExit("Prayer alerts row anchor missing")
    row='\n        <Row emoji="🧭" title={t("Prayer calculation", "حساب مواقيت الصلاة")} text={t("Smart method, madhab, high-latitude rule and minute adjustments", "الطريقة الذكية والمذهب وقاعدة خطوط العرض والضبط بالدقائق")} onPress={() => setPage("prayerCalculation")} />'
    h = h[:alert_row.end()] + row + h[alert_row.end():]

root_anchor='  if (page === "root") return root;\n\n'
if root_anchor not in h: raise SystemExit("Settings root anchor missing")
route='  if (page === "prayerCalculation") return <PrayerCalculationSettingsPage locale={locale} onBack={() => setPage("root")} />;\n\n'
if 'page === "prayerCalculation"' not in h:
    h = h.replace(root_anchor, root_anchor + route,1)

HUB.write_text(h, encoding="utf-8")

for required in ('smartMethodForLocation', 'latitudeAdjustmentMethod', 'PrayerCalculationSettingsPage', 'Prayer calculation'):
    text = p + h
    if required not in text: raise SystemExit("Missing calculation requirement: " + required)
print("Added smart prayer calculation methods, madhab/high-latitude options, and manual minute tuning")
