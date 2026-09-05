from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
BASE = ROOT / ".github/scripts/fix-v1021-prayer-calculation-settings-v2.py"
PAGE = ROOT / "mobile/src/PrayerCalculationSettingsPage.tsx"

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

# Make the current mode card explain exactly which method controls the API.
old_summary = '<View style={styles.summary}><Text style={styles.summaryLabel}>{t("CURRENT MODE", "الوضع الحالي")}</Text><Text style={styles.summaryValue}>{prefs.mode === "smart" ? t("Smart — location based", "ذكي — حسب الموقع") : `${method?.name || "Manual"} • ${prefs.school === 1 ? t("Hanafi", "حنفي") : t("Standard", "عادي")}`}</Text></View>'
new_summary = '<View style={styles.summary}><Text style={styles.summaryLabel}>{t("CURRENT CALCULATION", "الحساب الحالي")}</Text><Text style={styles.summaryValue}>{prefs.mode === "smart" ? t("Smart automatic — method selected from location", "ذكي تلقائي — يتم اختيار الطريقة حسب الموقع") : `${method?.name || "Manual"} • ${prefs.school === 1 ? t("Hanafi", "حنفي") : t("Standard", "عادي")}`}</Text><Text style={styles.summaryHint}>{t("This setting is sent with the coordinates used for prayer-time calculation outside Windsor.", "يتم استخدام هذا الإعداد مع الإحداثيات لحساب المواقيت خارج وندسور.")}</Text></View>'
if old_summary not in page:
    raise SystemExit("Expected current-mode summary anchor missing")
page = page.replace(old_summary, new_summary, 1)

# Add styles without disturbing the existing visual system.
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

required = [
    "PRAYER TIME SOURCE / API",
    "AlAdhan Prayer Times API",
    "Smart automatic",
    "CALCULATION METHOD",
    "Muslim World League",
    "ISNA",
    "Umm al-Qura",
    "ASR SCHOOL",
    "HIGH-LATITUDE RULE",
    "FINE-TUNE BY MINUTES",
    "Save & use these settings",
]
written = PAGE.read_text(encoding="utf-8")
for needle in required:
    if needle not in written:
        raise SystemExit(f"Missing prayer calculation UI requirement: {needle}")

print("Restored full prayer calculation settings page with API source + customization")
