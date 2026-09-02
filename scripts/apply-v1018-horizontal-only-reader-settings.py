from pathlib import Path

path = Path('mobile/src/quran/quranRendering.tsx')
text = path.read_text(encoding='utf-8')

text = text.replace('export type QuranBrowseMode = "vertical" | "horizontal";', 'export type QuranBrowseMode = "horizontal";', 1)
text = text.replace('  browseMode: "vertical",', '  browseMode: "horizontal",', 1)

old_load = '''        if (saved) {\n          const parsed = JSON.parse(saved) as Partial<QuranAppearance>;\n          setAppearanceState({ ...DEFAULT_QURAN_APPEARANCE, ...parsed });\n        }'''
new_load = '''        if (saved) {\n          const parsed = JSON.parse(saved) as Partial<QuranAppearance> & { browseMode?: string };\n          // v1.0.18+: Mushaf paging is Arabic-book horizontal only.\n          // Migrate any older saved vertical preference permanently.\n          setAppearanceState({ ...DEFAULT_QURAN_APPEARANCE, ...parsed, browseMode: "horizontal" });\n        }'''
if old_load in text:
    text = text.replace(old_load, new_load, 1)

old_set = '''      const value = typeof next === "function" ? next(previous) : next;\n      void AsyncStorage.setItem(APPEARANCE_KEY, JSON.stringify(value));\n      return value;'''
new_set = '''      const requested = typeof next === "function" ? next(previous) : next;\n      const value = { ...requested, browseMode: "horizontal" as const };\n      void AsyncStorage.setItem(APPEARANCE_KEY, JSON.stringify(value));\n      return value;'''
if old_set in text:
    text = text.replace(old_set, new_set, 1)

old_browse = '''            <Text style={[styles.sectionLabel, ar && styles.rtl]}>{t("PAGE BROWSING", "طريقة التنقل")}</Text>\n            <View style={styles.browseRow}>\n              {([\n                ["vertical", "↕", t("Vertical", "رأسي"), t("Scroll up/down. At the page edge, keep swiping to turn the page.", "مرّر لأعلى وأسفل، وعند نهاية الصفحة تابع السحب للانتقال.")],\n                ["horizontal", "↔", t("Horizontal", "أفقي"), t("Swipe left/right anywhere on the Mushaf page to turn pages.", "اسحب يميناً ويساراً في أي مكان على صفحة المصحف للتنقل بين الصفحات.")]\n              ] as Array<[QuranBrowseMode, string, string, string]>).map(([mode, icon, label, note]) => (\n                <Pressable key={mode} onPress={() => setAppearance((previous) => ({ ...previous, browseMode: mode }))} style={[styles.browseChoice, appearance.browseMode === mode && styles.browseChoiceActive]}>\n                  <Text style={[styles.browseIcon, appearance.browseMode === mode && styles.browseIconActive]}>{icon}</Text>\n                  <View style={{ flex: 1 }}><Text style={[styles.browseLabel, ar && styles.rtl]}>{label}</Text><Text style={[styles.browseNote, ar && styles.rtl]}>{note}</Text></View>\n                  <View style={[styles.radio, appearance.browseMode === mode && styles.radioSelected]}>{appearance.browseMode === mode ? <View style={styles.radioDot} /> : null}</View>\n                </Pressable>\n              ))}\n            </View>'''
new_browse = '''            <Text style={[styles.sectionLabel, ar && styles.rtl]}>{t("PAGE BROWSING", "طريقة التنقل")}</Text>\n            <View style={styles.browseRow}>\n              <View style={[styles.browseChoice, styles.browseChoiceActive]}>\n                <Text style={[styles.browseIcon, styles.browseIconActive]}>↔</Text>\n                <View style={{ flex: 1 }}>\n                  <Text style={[styles.browseLabel, ar && styles.rtl]}>{t("Arabic book paging", "تصفّح الكتاب العربي")}</Text>\n                  <Text style={[styles.browseNote, ar && styles.rtl]}>{t("Swipe left for the next page and right for the previous page. Up/down is reading scroll only.", "اسحب لليسار للصفحة التالية ولليمين للصفحة السابقة. التمرير لأعلى وأسفل للقراءة فقط.")}</Text>\n                </View>\n                <View style={[styles.radio, styles.radioSelected]}><View style={styles.radioDot} /></View>\n              </View>\n            </View>'''
if old_browse not in text:
    raise SystemExit('Reader settings browse block not found')
text = text.replace(old_browse, new_browse, 1)

# Remove stale wording from the settings subtitle that suggests navigation mode is configurable.
text = text.replace('Font • Tajweed • navigation • layout • size • colors', 'Font • Tajweed • layout • size • colors')
text = text.replace('الخط • التجويد • التنقل • شكل الكتاب • الحجم • الألوان', 'الخط • التجويد • شكل الكتاب • الحجم • الألوان')

required = [
    'export type QuranBrowseMode = "horizontal";',
    'browseMode: "horizontal"',
    'Arabic book paging',
    'Swipe left for the next page and right for the previous page. Up/down is reading scroll only.',
]
for marker in required:
    if marker not in text:
        raise SystemExit('Missing horizontal-only reader setting: ' + marker)
for forbidden in [
    '["vertical", "↕"',
    'Scroll up/down. At the page edge, keep swiping to turn the page.',
    'browseMode: "vertical"',
]:
    if forbidden in text:
        raise SystemExit('Vertical browsing setting still present: ' + forbidden)

path.write_text(text, encoding='utf-8')
print('Reader settings are now horizontal-only and old vertical preferences are migrated.')
