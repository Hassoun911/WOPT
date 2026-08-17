from pathlib import Path

path = Path('mobile/src/quran/QuranV3.tsx')
text = path.read_text(encoding='utf-8')

old = '''  const quranDock = (\n    <Pressable onPress={() => setMenuOpen(true)} style={styles.quranDock}>\n      <View style={styles.quranDockIcon}><Text style={styles.quranDockIconText}>☰</Text></View>\n      <Text style={styles.quranDockText}>{tr("Qur’an Menu", "قائمة القرآن")}</Text>\n      <Text style={styles.quranDockArrow}>{ar ? "‹" : "›"}</Text>\n    </Pressable>\n  );\n\n'''
if old not in text:
    raise SystemExit('quranDock block not found')
text = text.replace(old, '', 1)

old2 = '      {screen === "radio" ? quranDock : null}\n'
if old2 not in text:
    raise SystemExit('radio quranDock render not found')
text = text.replace(old2, '', 1)

path.write_text(text, encoding='utf-8')
print('Removed duplicate lower Quran menu from Quran Radio')
