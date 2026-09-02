from pathlib import Path

qpath = Path('mobile/src/quran/QuranV3.tsx')
q = qpath.read_text(encoding='utf-8')

# Exact bookmark resume point.
old = '''  const openReader = (surah: number, ayah = 1, from: Screen = screen) => {\n    const target = getAyah(surah, ayah);\n    if (!target) return;\n    const next = { surah: target.surah, ayah: target.ayah };\n    setPosition(next);\n    setSelectedAyah(null);\n    setBackTarget(from === "reader" ? "home" : from);\n    persistLast(next);\n    setScreen("reader");\n  };'''
new = '''  const openReader = (surah: number, ayah = 1, from: Screen = screen) => {\n    const target = getAyah(surah, ayah);\n    if (!target) return;\n    const next = { surah: target.surah, ayah: target.ayah };\n    setPosition(next);\n    setSelectedAyah(from === "bookmarks" ? target : null);\n    setBackTarget(from === "reader" ? "home" : from);\n    persistLast(next);\n    setScreen("reader");\n  };'''
if old in q:
    q = q.replace(old, new, 1)

# Player is hidden while reading until the user taps the page.
q = q.replace('const [playerVisible, setPlayerVisible] = useState(true);', 'const [playerVisible, setPlayerVisible] = useState(false);', 1)

# Google Play: audio controls must never silently ignore a press.
old = '''  const playNativeAyah = (ayah: QuranAyah, reciterId = audioPrefs.reciter) => {\n    if (!QuranAudio) return;\n    completionRef.current = null;\n    QuranAudio.playQueue(nativeQueuePayload([ayah], reciterId), 0, false, audioPrefs.speed);\n  };'''
new = '''  const playNativeAyah = (ayah: QuranAyah, reciterId = audioPrefs.reciter) => {\n    if (!QuranAudio) {\n      Alert.alert(tr("Audio unavailable", "الصوت غير متاح"), tr("Qur’an audio could not start on this device. Please restart Hassoun and try again.", "تعذر بدء صوت القرآن على هذا الجهاز. أعد تشغيل حسّون وحاول مرة أخرى."));\n      return;\n    }\n    setAudioStatus((previous) => ({ ...previous, available: true, state: "loading" }));\n    completionRef.current = null;\n    try { QuranAudio.playQueue(nativeQueuePayload([ayah], reciterId), 0, false, audioPrefs.speed); }\n    catch (error) { Alert.alert(tr("Playback failed", "فشل التشغيل"), error instanceof Error ? error.message : tr("Please try again.", "يرجى المحاولة مرة أخرى.")); }\n  };'''
if old in q:
    q = q.replace(old, new, 1)

old = '''  const playQueue = (queue: QuranAyah[], repeat = false) => {\n    const first = queue[0];\n    if (!first || !QuranAudio) return;\n    setAudioQueue(queue);\n    setAudioIndex(0);\n    setRepeatQueue(repeat);\n    completionRef.current = null;\n    QuranAudio.playQueue(nativeQueuePayload(queue), 0, repeat, audioPrefs.speed);\n  };'''
new = '''  const playQueue = (queue: QuranAyah[], repeat = false) => {\n    const first = queue[0];\n    if (!first) return;\n    if (!QuranAudio) {\n      Alert.alert(tr("Audio unavailable", "الصوت غير متاح"), tr("Qur’an audio could not start on this device. Please restart Hassoun and try again.", "تعذر بدء صوت القرآن على هذا الجهاز. أعد تشغيل حسّون وحاول مرة أخرى."));\n      return;\n    }\n    setAudioQueue(queue);\n    setAudioIndex(0);\n    setRepeatQueue(repeat);\n    setAudioStatus((previous) => ({ ...previous, available: true, state: "loading", title: previous.title ?? tr("Preparing Qur’an audio…", "جارٍ تجهيز صوت القرآن…") }));\n    completionRef.current = null;\n    try { QuranAudio.playQueue(nativeQueuePayload(queue), 0, repeat, audioPrefs.speed); }\n    catch (error) {\n      setAudioStatus((previous) => ({ ...previous, state: "error" }));\n      Alert.alert(tr("Playback failed", "فشل التشغيل"), error instanceof Error ? error.message : tr("Please try again.", "يرجى المحاولة مرة أخرى."));\n    }\n  };'''
if old in q:
    q = q.replace(old, new, 1)

# Arabic Mushaf behavior: page changes are horizontal only.
# Swipe LEFT = next page. Swipe RIGHT = previous page.
start = q.find('  const readerPanResponder = useMemo(')
end = q.find('\n\n  const handleVerticalTouchStart', start)
if start >= 0 and end > start:
    q = q[:start] + '''  const readerPanResponder = useMemo(\n    () => PanResponder.create({\n      onStartShouldSetPanResponder: () => false,\n      onMoveShouldSetPanResponderCapture: (_event, gestureState) => {\n        const horizontal = Math.abs(gestureState.dx);\n        const vertical = Math.abs(gestureState.dy);\n        return horizontal >= 24 && horizontal > vertical * 1.35;\n      },\n      onPanResponderRelease: (_event, gestureState) => {\n        if (Math.abs(gestureState.dx) < 42) return;\n        turnReaderPage(gestureState.dx < 0 ? 1 : -1);\n      },\n      onPanResponderTerminate: () => {\n        verticalGestureStartY.current = null;\n      }\n    }),\n    [currentPage, spreadMode]\n  );''' + q[end:]

# Vertical scrolling is reading only; never a page command.
start = q.find('  const handleVerticalTouchStart = (event: { nativeEvent: { pageY: number } }) => {')
end = q.find('\n\n  const handleVerticalTouchEnd', start)
if start >= 0 and end > start:
    q = q[:start] + '''  const handleVerticalTouchStart = (_event: { nativeEvent: { pageY: number } }) => {\n    verticalGestureStartY.current = null;\n  };''' + q[end:]
start = q.find('  const handleVerticalTouchEnd = (event: { nativeEvent: { pageY: number } }) => {')
if start < 0:
    start = q.find('  const handleVerticalTouchEnd = (_event: { nativeEvent: { pageY: number } }) => {')
end = q.find('\n\n\n  const handleReaderSurfaceTouchStart', start)
if start >= 0 and end > start:
    q = q[:start] + '''  const handleVerticalTouchEnd = (_event: { nativeEvent: { pageY: number } }) => {\n    verticalGestureStartY.current = null;\n  };''' + q[end:]

# Do not auto-turn at scroll end.
old = '''            onScrollEndDrag={() => {\n              const contentFits = readerContentHeight.current <= readerViewportHeight.current + 12;\n              if (readerScrollDirection.current === "down" && (readerAtBottom.current || contentFits)) {\n                turnReaderPage(1);\n              } else if (readerScrollDirection.current === "up" && (readerAtTop.current || readerLastScrollY.current <= 8 || contentFits)) {\n                turnReaderPage(-1);\n              }\n              readerScrollDirection.current = null;\n            }}'''
if old in q:
    q = q.replace(old, '''            onScrollEndDrag={() => {\n              readerScrollDirection.current = null;\n            }}''', 1)

# Remove the large Previous / Page / Next navigation row from older patch builds if present.
nav_start = q.find('            <View style={styles.readerPageNav}>')
if nav_start >= 0:
    nav_end = q.find('            </View>\n', nav_start)
    # Three nested items are all on one line in the generated patch; find the next ScrollView close boundary safely.
    scroll_close = q.find('          </ScrollView>', nav_start)
    if scroll_close > nav_start:
        block = q[nav_start:scroll_close]
        if 'readerPageNav' in block:
            q = q[:nav_start] + q[scroll_close:]

# Keep the Mushaf page using the screen; only a small safety gap is needed because the player floats above content.
q = q.replace('bookCanvas: { padding: 8, paddingBottom: 118 }', 'bookCanvas: { padding: 8, paddingBottom: 18 }', 1)
q = q.replace('bookCanvas: { padding: 8, paddingBottom: 12 }', 'bookCanvas: { padding: 8, paddingBottom: 18 }', 1)

# Compact floating audio controls; they overlay below the full page and disappear on tap.
q = q.replace('miniPlayer: { position: "absolute", left: 48, right: 48, bottom: 18, minHeight: 56,', 'miniPlayer: { position: "absolute", left: 70, right: 70, bottom: 8, minHeight: 48,', 1)
q = q.replace('floatingPlayerWrap: { position: "absolute", left: 0, right: 0, bottom: 18,', 'floatingPlayerWrap: { position: "absolute", left: 0, right: 0, bottom: 8,', 1)

# Remove stale nav styles if they exist from an already-patched source.
for style_name in ['readerPageNav:', 'readerPageNavButton:', 'readerPageNavDisabled:', 'readerPageNavText:', 'readerPageNumberPill:', 'readerPageNumberText:']:
    while style_name in q:
        line_start = q.rfind('\n', 0, q.find(style_name)) + 1
        line_end = q.find('\n', q.find(style_name))
        if line_end < 0: break
        q = q[:line_start] + q[line_end + 1:]

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

required = {
    'bookmark resume': 'setSelectedAyah(from === "bookmarks" ? target : null)',
    'responsive audio': 'Preparing Qur’an audio',
    'Arabic horizontal next-page swipe': 'gestureState.dx < 0 ? 1 : -1',
    'no vertical page turn': 'const handleVerticalTouchEnd = (_event',
    'tap player toggle': 'setPlayerVisible((visible) => !visible)',
    'Connect Display': 'page === "display"',
}
combined = q + s
for label, marker in required.items():
    if marker not in combined:
        raise SystemExit(f'Missing required v1.0.16 fix: {label}')
if 'styles.readerPageNav' in q:
    raise SystemExit('Large reader page navigation buttons are still present')
print('Applied and verified v1.0.16 Quran reader/store fixes.')
