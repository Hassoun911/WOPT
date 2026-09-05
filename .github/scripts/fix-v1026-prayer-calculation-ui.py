from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[2]
BASE = ROOT / ".github/scripts/fix-v1021-prayer-calculation-settings-v2.py"
PAGE = ROOT / "mobile/src/PrayerCalculationSettingsPage.tsx"
HUB = ROOT / "mobile/src/SettingsHub.tsx"

# Restore ONLY the proven full calculation settings page from v1.0.21.
# Do not execute that old patch because it would overwrite newer prayer/location logic.
source = BASE.read_text(encoding="utf-8")
start_marker = "PAGE.write_text(r'''"
end_marker = "''', encoding=\"utf-8\")"
start = source.index(start_marker) + len(start_marker)
end = source.index(end_marker, start)
page = source[start:end]

# Make the data source/API explicit at the top of the page.
subtitle = '<Text style={styles.subtitle}>{t("Near Windsor, Hassoun keeps using the official Windsor Islamic Association schedule. Outside Windsor, choose Smart or control every calculation option yourself.", "قرب وندسور يستمر حسّون باستخدام جدول جمعية وندسور الإسلامية الرسمي. خارج وندسور اختر الوضع الذكي أو تحكم بكل خيارات الحساب بنفسك.")}</Text>'
api_card = '''<Text style={styles.subtitle}>{t("Choose how Hassoun calculates prayer times and customize the method when needed.", "اختر كيف يحسب حسّون مواقيت الصلاة وخصص طريقة الحساب عند الحاجة.")}</Text>

    <View style={styles.apiCard}>
      <Text style={styles.apiEyebrow}>{t("PRAYER TIME SOURCE / API", "مصدر / API مواقيت الصلاة")}</Text>
      <Text style={styles.apiTitle}>{t("AlAdhan Prayer Times API", "واجهة AlAdhan لمواقيت الصلاة")}</Text>
      <Text style={styles.apiText}>{t("Outside Windsor, Hassoun uses your live GPS coordinates with AlAdhan and the calculation method selected below. In Windsor, the official Windsor Islamic Association schedule takes priority.", "خارج وندسور يستخدم حسّون إحداثيات GPS المباشرة مع AlAdhan وطريقة الحساب المحددة أدناه. داخل وندسور تكون أولوية الجدول الرسمي لجمعية وندسور الإسلامية.")}</Text>
      <View style={styles.apiRow}><Text style={styles.apiDot}>●</Text><Text style={styles.apiStatus}>{t("Automatic location-aware source selection", "اختيار تلقائي للمصدر حسب الموقع")}</Text></View>
    </View>'''
if subtitle not in page:
    raise SystemExit("Expected calculation-page subtitle anchor missing")
page = page.replace(subtitle, api_card, 1)

old_summary = '<View style={styles.summary}><Text style={styles.summaryLabel}>{t("CURRENT MODE", "الوضع الحالي")}</Text><Text style={styles.summaryValue}>{prefs.mode === "smart" ? t("Smart — location based", "ذكي — حسب الموقع") : `${method?.name || "Manual"} • ${prefs.school === 1 ? t("Hanafi", "حنفي") : t("Standard", "عادي")}`}</Text></View>'
new_summary = '<View style={styles.summary}><Text style={styles.summaryLabel}>{t("CURRENT CALCULATION", "الحساب الحالي")}</Text><Text style={styles.summaryValue}>{prefs.mode === "smart" ? t("Smart automatic — method selected from location", "ذكي تلقائي — يتم اختيار الطريقة حسب الموقع") : `${method?.name || "Manual"} • ${prefs.school === 1 ? t("Hanafi", "حنفي") : t("Standard", "عادي")}`}</Text><Text style={styles.summaryHint}>{t("This setting is sent with the coordinates used for prayer-time calculation outside Windsor.", "يتم استخدام هذا الإعداد مع الإحداثيات لحساب المواقيت خارج وندسور.")}</Text></View>'
if old_summary not in page:
    raise SystemExit("Expected current-mode summary anchor missing")
page = page.replace(old_summary, new_summary, 1)

style_anchor = 'subtitle:{marginTop:14,fontSize:12.5,lineHeight:19,color:"#64746f"},'
style_replacement = 'subtitle:{marginTop:14,fontSize:12.5,lineHeight:19,color:"#64746f"},apiCard:{marginTop:16,padding:16,borderRadius:20,backgroundColor:"#fff",borderWidth:1,borderColor:"#d8d3c8"},apiEyebrow:{fontSize:8,fontWeight:"900",letterSpacing:1.1,color:"#a17c36"},apiTitle:{fontSize:16,fontWeight:"900",color:"#173f35",marginTop:5},apiText:{fontSize:10.5,lineHeight:16,color:"#64746f",marginTop:6},apiRow:{flexDirection:"row",alignItems:"center",gap:7,marginTop:10},apiDot:{fontSize:10,color:"#18a573"},apiStatus:{fontSize:10,fontWeight:"800",color:"#0b654f"},'
if style_anchor not in page:
    raise SystemExit("Expected subtitle style anchor missing")
page = page.replace(style_anchor, style_replacement, 1)

summary_style = 'summaryValue:{fontSize:13,fontWeight:"900",color:"#173f35",marginTop:3},'
summary_replacement = 'summaryValue:{fontSize:13,fontWeight:"900",color:"#173f35",marginTop:3},summaryHint:{fontSize:9.5,lineHeight:14,color:"#74817c",marginTop:5},'
if summary_style not in page:
    raise SystemExit("Expected summary style anchor missing")
page = page.replace(summary_style, summary_replacement, 1)
PAGE.write_text(page, encoding="utf-8")

# FINAL navigation repair. Other generated settings patches can replace SettingsHub,
# so rewire the visible Prayer calculation row after all earlier settings work.
hub = HUB.read_text(encoding="utf-8")
import_line = 'import PrayerCalculationSettingsPage from "./PrayerCalculationSettingsPage";'
if import_line not in hub:
    imports = list(re.finditer(r'^import .*?;\s*$', hub, re.M))
    if not imports:
        raise SystemExit("SettingsHub import section not found")
    insert_at = imports[-1].end()
    hub = hub[:insert_at] + '\n' + import_line + hub[insert_at:]

m = re.search(r'type SettingsPage\s*=\s*([^;]+);', hub)
if not m:
    raise SystemExit("SettingsPage union not found")
if '"calculation"' not in m.group(1):
    replacement = 'type SettingsPage = ' + m.group(1).strip() + ' | "calculation";'
    hub = hub[:m.start()] + replacement + hub[m.end():]

# Remove any existing Prayer calculation row, regardless of what page it routed to,
# then insert exactly one row directly after Prayer & Adhan alerts.
hub = re.sub(
    r'\n\s*<Row[^\n]*title=\{t\("Prayer calculation",\s*"حساب مواقيت الصلاة"\)\}[^\n]*/>',
    '',
    hub,
)
alert_match = re.search(
    r'(<Row[^\n]*title=\{t\("Prayer & Adhan alerts",\s*"تنبيهات الصلاة والأذان"\)\}[^\n]*onPress=\{onOpenAlerts\}[^\n]*/>)',
    hub,
)
if not alert_match:
    raise SystemExit("Prayer & Adhan alerts row not found for calculation insertion")
calc_row = '\n        <Row emoji="🧭" title={t("Prayer calculation", "حساب مواقيت الصلاة")} text={t("API source, Smart/manual methods, Asr school, high-latitude rules and minute tuning", "مصدر API وطرق ذكية/يدوية ومذهب العصر وقواعد خطوط العرض وضبط الدقائق")} onPress={() => setPage("calculation")} />'
hub = hub[:alert_match.end()] + calc_row + hub[alert_match.end():]

# Remove stale calculation renderer variants and install one deterministic renderer.
hub = re.sub(r'\n\s*if \(page === "calculation"\)[^\n]*\n?', '\n', hub)
render_marker = '  if (page === "widgets") {'
idx = hub.find(render_marker)
if idx < 0:
    raise SystemExit("Widgets renderer anchor not found")
render = '  if (page === "calculation") return <PrayerCalculationSettingsPage locale={locale} onBack={() => setPage("root")} />;\n\n'
hub = hub[:idx] + render + hub[idx:]
HUB.write_text(hub, encoding="utf-8")

written = PAGE.read_text(encoding="utf-8")
page_required = [
    "PRAYER TIME SOURCE / API",
    "AlAdhan Prayer Times API",
    "Smart automatic",
    "CALCULATION METHOD",
    "METHOD_OPTIONS.map",
    "ASR SCHOOL",
    "HIGH-LATITUDE RULE",
    "FINE-TUNE BY MINUTES",
    "Save & use these settings",
]
for needle in page_required:
    if needle not in written:
        raise SystemExit(f"Missing prayer calculation page requirement: {needle}")

method_required = [
    "ISNA",
    "Muslim World League",
    "Umm al-Qura, Makkah",
    "Egyptian Authority",
    "University of Karachi",
    "Tehran",
    "Jafari",
]
for needle in method_required:
    if needle not in source:
        raise SystemExit(f"Missing prayer calculation method option: {needle}")

final_hub = HUB.read_text(encoding="utf-8")
nav_required = [
    import_line,
    'title={t("Prayer calculation", "حساب مواقيت الصلاة")}',
    'onPress={() => setPage("calculation")}',
    'if (page === "calculation") return <PrayerCalculationSettingsPage',
]
for needle in nav_required:
    if needle not in final_hub:
        raise SystemExit(f"Missing final Prayer Calculation navigation requirement: {needle}")
if final_hub.count('title={t("Prayer calculation", "حساب مواقيت الصلاة")}') != 1:
    raise SystemExit("Prayer Calculation row is duplicated")

print("Restored interactive prayer calculation settings and forced final SettingsHub route")
