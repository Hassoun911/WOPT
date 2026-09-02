from pathlib import Path

qpath = Path('mobile/src/quran/QuranV3.tsx')
q = qpath.read_text(encoding='utf-8')

# Exact bookmark resume point.
old = '''  const openReader = (surah: number, ayah = 1, from: Screen = screen) => {\n    const target = getAyah(surah, ayah);\n    if (!target) return;\n    const next = { surah: target.surah, ayah: target.ayah };\n    setPosition(next);\n    setSelectedAyah(null);\n    setBackTarget(from === "reader" ? "home" : from);\n    persistLast(next);\n    setScreen("reader");\n  };'''
new = '''  const openReader = (surah: number, ayah = 1, from: Screen = screen) => {\n    const target = getAyah(surah, ayah);\n    if (!target) return;\n    const next = { surah: target.surah, ayah: target.ayah };\n    setPosition(next);\n    setSelectedAyah(from === "bookmarks" ? target : null);\n    setBackTarget(from === "reader" ? "home" : from);\n    persistLast(next);\n    setScreen("reader");\n  };'''
if old in q:
    q = q.replace(old, new, 1)

# Google Play: audio controls may not silently ignore presses.
old = '''  const playNativeAyah = (ayah: QuranAyah, reciterId = audioPrefs.reciter) => {\n    if (!QuranAudio) return;\n    completionRef.current = null;\n    QuranAudio.playQueue(nativeQueuePayload([ayah], reciterId), 0, false, audioPrefs.speed);\n  };'''
new = '''  const playNativeAyah = (ayah: QuranAyah, reciterId = audioPrefs.reciter) => {\n    if (!QuranAudio) {\n      Alert.alert(tr("Audio unavailable", "الصوت غير متاح"), tr("Qur’an audio could not start on this device. Please restart Hassoun and try again.", "تعذر بدء صوت القرآن على هذا الجهاز. أعد تشغيل حسّون وحاول مرة أخرى."));\n      return;\n    }\n    setAudioStatus((previous) => ({ ...previous, available: true, state: "loading" }));\n    completionRef.current = null;\n    try { QuranAudio.playQueue(nativeQueuePayload([ayah], reciterId), 0, false, audioPrefs.speed); }\n    catch (error) { Alert.alert(tr("Playback failed", "فشل التشغيل"), error instanceof Error ? error.message : tr("Please try again.", "يرجى المحاولة مرة أخرى.")); }\n  };'''
if old in q:
    q = q.replace(old, new, 1)

old = '''  const playQueue = (queue: QuranAyah[], repeat = false) => {\n    const first = queue[0];\n    if (!first || !QuranAudio) return;\n    setAudioQueue(queue);\n    setAudioIndex(0);\n    setRepeatQueue(repeat);\n    completionRef.current = null;\n    QuranAudio.playQueue(nativeQueuePayload(queue), 0, repeat, audioPrefs.speed);\n  };'''
new = '''  const playQueue = (queue: QuranAyah[], repeat = false) => {\n    const first = queue[0];\n    if (!first) return;\n    if (!QuranAudio) {\n      Alert.alert(tr("Audio unavailable", "الصوت غير متاح"), tr("Qur’an audio could not start on this device. Please restart Hassoun and try again.", "تعذر بدء صوت القرآن على هذا الجهاز. أعد تشغيل حسّون وحاول مرة أخرى."));\n      return;\n    }\n    setAudioQueue(queue);\n    setAudioIndex(0);\n    setRepeatQueue(repeat);\n    setAudioStatus((previous) => ({ ...previous, available: true, state: "loading", title: previous.title ?? tr("Preparing Qur’an audio…", "جارٍ تجهيز صوت القرآن…") }));\n    completionRef.current = null;\n    try { QuranAudio.playQueue(nativeQueuePayload(queue), 0, repeat, audioPrefs.speed); }\n    catch (error) {\n      setAudioStatus((previous) => ({ ...previous, state: "error" }));\n      Alert.alert(tr("Playback failed", "فشل التشغيل"), error instanceof Error ? error.message : tr("Please try again.", "يرجى المحاولة مرة أخرى."));\n    }\n  };'''
if old in q:
    q = q.replace(old, new, 1)

# Never turn Mushaf pages from vertical scrolling/swiping. Horizontal browse mode still uses intentional horizontal swipes.
old = '''        if (appearance.browseMode !== "vertical") return false;\n        if (vertical < 12 || vertical <= horizontal * 1.05) return false;\n\n        const contentFits = readerContentHeight.current <= readerViewportHeight.current + 12;\n        if (gestureState.dy < 0) return readerAtBottom.current || contentFits;\n        if (gestureState.dy > 0) return readerAtTop.current || readerLastScrollY.current <= 8 || contentFits;\n        return false;'''
if old in q:
    q = q.replace(old, '        return false;', 1)

old = '''        if (appearance.browseMode !== "vertical" || Math.abs(gestureState.dy) < 26) return;\n        const contentFits = readerContentHeight.current <= readerViewportHeight.current + 12;\n        if (gestureState.dy < 0 && (readerAtBottom.current || contentFits)) {\n          turnReaderPage(1);\n        } else if (gestureState.dy > 0 && (readerAtTop.current || readerLastScrollY.current <= 8 || contentFits)) {\n          turnReaderPage(-1);\n        }'''
if old in q:
    q = q.replace(old, '        return;', 1)

start = q.find('  const handleVerticalTouchEnd = (event: { nativeEvent: { pageY: number } }) => {')
end = q.find('\n\n\n  const handleReaderSurfaceTouchStart', start)
if start >= 0 and end > start:
    q = q[:start] + '''  const handleVerticalTouchEnd = (_event: { nativeEvent: { pageY: number } }) => {\n    verticalGestureStartY.current = null;\n  };''' + q[end:]

old = '''            onScrollEndDrag={() => {\n              const contentFits = readerContentHeight.current <= readerViewportHeight.current + 12;\n              if (readerScrollDirection.current === "down" && (readerAtBottom.current || contentFits)) {\n                turnReaderPage(1);\n              } else if (readerScrollDirection.current === "up" && (readerAtTop.current || contentFits)) {\n                turnReaderPage(-1);\n              }\n              readerScrollDirection.current = null;\n            }}'''
if old in q:
    q = q.replace(old, '''            onScrollEndDrag={() => {\n              readerScrollDirection.current = null;\n            }}''', 1)

# Add protected bottom space + explicit page controls.
page_anchor = '            {spreadMode ? <View style={styles.bookSpread}>{spreadLeftPage ? <View style={styles.bookPageSlot}>{renderMushafPage(spreadLeftPage)}</View> : <View style={[styles.bookPageSlot, styles.blankBookPage]} /> }<View style={styles.bookGutter} /><View style={styles.bookPageSlot}>{renderMushafPage(spreadRightPage)}</View></View> : renderMushafPage(currentPage)}\n'
if page_anchor in q and 'styles.readerPageNav' not in q:
    q = q.replace(page_anchor, page_anchor + '''            <View style={styles.readerPageNav}>\n              <Pressable disabled={currentPage <= 1} onPress={() => turnReaderPage(-1)} style={[styles.readerPageNavButton, currentPage <= 1 && styles.readerPageNavDisabled]}><Text style={styles.readerPageNavText}>{tr("‹ Previous page", "الصفحة السابقة ›")}</Text></Pressable>\n              <View style={styles.readerPageNumberPill}><Text style={styles.readerPageNumberText}>{tr(`Page ${currentPage}`, `صفحة ${num(currentPage)}`)}</Text></View>\n              <Pressable disabled={currentPage >= 604} onPress={() => turnReaderPage(1)} style={[styles.readerPageNavButton, currentPage >= 604 && styles.readerPageNavDisabled]}><Text style={styles.readerPageNavText}>{tr("Next page ›", "‹ الصفحة التالية")}</Text></Pressable>\n            </View>\n''', 1)

q = q.replace('bookCanvas: { padding: 8, paddingBottom: 12 }', 'bookCanvas: { padding: 8, paddingBottom: 118 }', 1)
style_anchor = '  readerBody: { flex: 1, backgroundColor: "#e9e5dc" },'
if style_anchor in q and 'readerPageNav:' not in q:
    styles = '''  readerPageNav: { minHeight: 72, flexDirection: "row", alignItems: "center", gap: 7, paddingHorizontal: 4, paddingTop: 10, paddingBottom: 10 },\n  readerPageNavButton: { flex: 1, minHeight: 48, borderRadius: 16, backgroundColor: "#edf5f1", borderWidth: 1, borderColor: "#d8e5df", alignItems: "center", justifyContent: "center", paddingHorizontal: 7 },\n  readerPageNavDisabled: { opacity: .35 },\n  readerPageNavText: { color: "#0b654f", fontSize: 10, fontWeight: "900", textAlign: "center" },\n  readerPageNumberPill: { minWidth: 72, minHeight: 48, borderRadius: 16, backgroundColor: "#103f35", alignItems: "center", justifyContent: "center", paddingHorizontal: 8 },\n  readerPageNumberText: { color: "#fff", fontSize: 10, fontWeight: "900" },\n'''
    q = q.replace(style_anchor, styles + style_anchor, 1)

qpath.write_text(q, encoding='utf-8')

# Add Connect Display to Settings & Support.
spath = Path('mobile/src/SettingsHub.tsx')
s = spath.read_text(encoding='utf-8')
if 'import ConnectDisplayPage from "./ConnectDisplayPage";' not in s:
    s = s.replace('import AboutHassounPage from "./AboutHassounPage";\n', 'import AboutHassounPage from "./AboutHassounPage";\nimport ConnectDisplayPage from "./ConnectDisplayPage";\n', 1)
s = s.replace('type SettingsPage = "root" | "about" | "guide" | "contact" | "privacy" | "terms" | "data" | "permissions" | "widgets";', 'type SettingsPage = "root" | "about" | "guide" | "contact" | "privacy" | "terms" | "data" | "permissions" | "widgets" | "display";', 1)
row = '        <Row emoji="🧩" title={t("Widgets", "الويدجت")} text={t("Choose layout and what appears on home and supported lock screens", "اختر التصميم والمعلومات التي تظهر على الشاشة الرئيسية وشاشة القفل المدعومة")} onPress={() => setPage("widgets")} />\n'
if row in s and 'title={t("Connect Display"' not in s:
    s = s.replace(row, row + '        <Row emoji="📺" title={t("Connect Display", "ربط شاشة")} text={t("Pair with a Masjid TV, iPad, tablet or computer using its 6-digit code", "اربط بتلفاز المسجد أو الآيباد أو الجهاز اللوحي أو الكمبيوتر باستخدام الرمز المكوّن من 6 أرقام")} onPress={() => setPage("display")} />\n', 1)
root = '  if (page === "root") return root;\n\n'
if root in s and 'page === "display"' not in s:
    s = s.replace(root, root + '  if (page === "display") return <ConnectDisplayPage locale={locale} onBack={() => setPage("root")} />;\n\n', 1)
spath.write_text(s, encoding='utf-8')

# Required assertions: fail build rather than silently producing another rollback.
required = {
    'Quran bookmark resume': 'setSelectedAyah(from === "bookmarks" ? target : null)',
    'Quran responsive audio': 'Preparing Qur’an audio',
    'No vertical scroll page turn': 'const handleVerticalTouchEnd = (_event',
    'Explicit page navigation': 'readerPageNav',
    'Connect Display setting': 'page === "display"',
}
combined = q + s
for label, marker in required.items():
    if marker not in combined:
        raise SystemExit(f'Missing required v1.0.15 fix: {label}')
print('Applied and verified v1.0.15 full store fixes.')
