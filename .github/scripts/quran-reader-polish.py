from pathlib import Path


def replace_once(path: str, old: str, new: str, label: str) -> None:
    p = Path(path)
    text = p.read_text(encoding="utf-8")
    if old not in text:
        raise SystemExit(f"Missing patch target: {label} in {path}")
    p.write_text(text.replace(old, new, 1), encoding="utf-8")


quran = "mobile/src/quran/QuranV3.tsx"
rendering = "mobile/src/quran/quranRendering.tsx"
config = "mobile/app.config.ts"
icon = "mobile/assets/hassoun-app-icon.svg"

# Use a real responder that captures horizontal drags before the vertical ScrollView.
replace_once(
    quran,
    "  Modal,\n  Pressable,\n",
    "  Modal,\n  PanResponder,\n  Pressable,\n",
    "PanResponder import",
)
replace_once(
    quran,
    "  const readerGestureStart = useRef<{ x: number; y: number } | null>(null);\n  const readerAtTop = useRef(true);\n  const readerAtBottom = useRef(false);\n",
    "  const verticalGestureStartY = useRef<number | null>(null);\n  const readerAtTop = useRef(true);\n  const readerAtBottom = useRef(false);\n",
    "reader gesture ref",
)

old_gestures = '''  const handleReaderTouchStart = (event: { nativeEvent: { pageX: number; pageY: number } }) => {
    readerGestureStart.current = { x: event.nativeEvent.pageX, y: event.nativeEvent.pageY };
  };

  const handleReaderTouchEnd = (event: { nativeEvent: { pageX: number; pageY: number } }) => {
    const start = readerGestureStart.current;
    readerGestureStart.current = null;
    if (!start) return;
    const dx = event.nativeEvent.pageX - start.x;
    const dy = event.nativeEvent.pageY - start.y;
    if (appearance.browseMode === "horizontal") {
      if (Math.abs(dx) < 70 || Math.abs(dx) <= Math.abs(dy)) return;
      turnReaderPage(dx < 0 ? 1 : -1);
      return;
    }
    if (Math.abs(dy) < 70 || Math.abs(dy) <= Math.abs(dx)) return;
    if (dy < 0 && readerAtBottom.current) turnReaderPage(1);
    else if (dy > 0 && readerAtTop.current) turnReaderPage(-1);
  };
'''
new_gestures = '''  const readerPanResponder = useMemo(
    () => PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponderCapture: (_event, gestureState) => {
        if (appearance.browseMode !== "horizontal") return false;
        const horizontal = Math.abs(gestureState.dx);
        const vertical = Math.abs(gestureState.dy);
        return horizontal > 12 && horizontal > vertical * 1.15;
      },
      onPanResponderTerminationRequest: () => false,
      onPanResponderRelease: (_event, gestureState) => {
        if (appearance.browseMode !== "horizontal") return;
        const distance = Math.abs(gestureState.dx);
        const speed = Math.abs(gestureState.vx);
        if (distance < 48 && speed < 0.35) return;
        // Swipe left = next Mushaf page, swipe right = previous page.
        turnReaderPage(gestureState.dx < 0 ? 1 : -1);
      }
    }),
    [appearance.browseMode, currentPage, spreadMode]
  );

  const handleVerticalTouchStart = (event: { nativeEvent: { pageY: number } }) => {
    if (appearance.browseMode !== "vertical") return;
    verticalGestureStartY.current = event.nativeEvent.pageY;
  };

  const handleVerticalTouchEnd = (event: { nativeEvent: { pageY: number } }) => {
    if (appearance.browseMode !== "vertical") {
      verticalGestureStartY.current = null;
      return;
    }
    const start = verticalGestureStartY.current;
    verticalGestureStartY.current = null;
    if (start == null) return;
    const dy = event.nativeEvent.pageY - start;
    if (Math.abs(dy) < 60) return;
    if (dy < 0 && readerAtBottom.current) turnReaderPage(1);
    else if (dy > 0 && readerAtTop.current) turnReaderPage(-1);
  };
'''
replace_once(quran, old_gestures, new_gestures, "real horizontal pan responder")

replace_once(
    quran,
    '<View style={styles.readerBody} onTouchStart={handleReaderTouchStart} onTouchEnd={handleReaderTouchEnd}>',
    '<View style={styles.readerBody} {...readerPanResponder.panHandlers}>',
    "reader pan handlers",
)
replace_once(
    quran,
    '''            showsVerticalScrollIndicator={false}
            scrollEventThrottle={16}
            onScroll={({ nativeEvent }) => {
''',
    '''            showsVerticalScrollIndicator={false}
            scrollEventThrottle={16}
            onTouchStart={handleVerticalTouchStart}
            onTouchEnd={handleVerticalTouchEnd}
            onScroll={({ nativeEvent }) => {
''',
    "vertical page-edge gesture handlers",
)

# Build the surah heading like a Mushaf title strip: full Arabic name, no clipping,
# green geometric ornaments, and a centered single-line title.
old_title = '''              {beginsSurah ? (
                <View style={styles.surahFrame}>
                  <View style={styles.surahFrameInner}>
                    <Text style={styles.surahFrameOrnament}>۞</Text>
                    <Text style={styles.surahFrameText}>{segmentSurah?.nameArabic}</Text>
                    <Text style={styles.surahFrameOrnament}>۞</Text>
                  </View>
                </View>
              ) : null}
'''
new_title = '''              {beginsSurah ? (
                <View style={styles.surahFrame}>
                  <View style={styles.surahFrameInner}>
                    <View style={styles.surahFrameSide}>
                      <View style={styles.surahFrameDiamond} />
                      <View style={styles.surahFrameLine} />
                      <View style={styles.surahFrameDiamondSmall} />
                    </View>
                    <Text
                      style={styles.surahFrameText}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.72}
                    >{`سورة ${segmentSurah?.nameArabic ?? ""}`}</Text>
                    <View style={styles.surahFrameSide}>
                      <View style={styles.surahFrameDiamondSmall} />
                      <View style={styles.surahFrameLine} />
                      <View style={styles.surahFrameDiamond} />
                    </View>
                  </View>
                </View>
              ) : null}
'''
replace_once(quran, old_title, new_title, "full Islamic surah title")

old_styles = '  readerBody: { flex: 1, backgroundColor: "#e9e5dc" }, bookCanvas: { padding: 8, paddingBottom: 12 }, bookCanvasSpread: { flexGrow: 1, justifyContent: "center" }, bookSpread: { flexDirection: "row", alignItems: "stretch", justifyContent: "center", gap: 0 }, bookPageSlot: { flex: 1, minWidth: 0 }, blankBookPage: { backgroundColor: "#e0d9ca", borderRadius: 14, opacity: .55, margin: 3 }, bookGutter: { width: 12, backgroundColor: "#d2cab9", borderLeftWidth: 1, borderRightWidth: 1, borderColor: "#c4bba8" }, mushafPage: { minHeight: 650, borderRadius: 13, borderWidth: 1, borderColor: "#d8d0c0", paddingHorizontal: 14, paddingTop: 11, paddingBottom: 12, shadowColor: "#342d23", shadowOpacity: .08, shadowRadius: 5, shadowOffset: { width: 0, height: 2 }, elevation: 2 }, pageTopLine: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 24, borderBottomWidth: 1, borderBottomColor: "#e2dbc9", marginBottom: 8 }, pageMeta: { color: "#70736e", fontSize: 8, fontWeight: "800" }, surahFrame: { marginVertical: 9, padding: 4, borderRadius: 8, borderWidth: 1, borderColor: "#b79a58", backgroundColor: "rgba(190,161,93,.11)" }, surahFrameInner: { minHeight: 48, borderRadius: 6, borderWidth: 1, borderColor: "#d2bd87", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 14, paddingHorizontal: 16 }, surahFrameOrnament: { color: "#a47c28", fontSize: 20 }, surahFrameText: { color: "#0b654f", fontSize: 21, fontWeight: "900", writingDirection: "rtl" }, basmala: { textAlign: "center", writingDirection: "rtl", marginVertical: 7 }, pageBottom: { alignItems: "center", marginTop: 8 }, pageNumber: { color: "#6b706d", fontSize: 10, fontWeight: "800" }, bookNav: { minHeight: 55, flexDirection: "row", alignItems: "center", gap: 7, padding: 7, backgroundColor: "#fff", borderTopWidth: 1, borderTopColor: "#ded9cf" }, bookNavButton: { flex: 1, minHeight: 42, borderRadius: 13, backgroundColor: "#edf5f1", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, paddingHorizontal: 6 }, bookNavArrow: { color: "#0b654f", fontSize: 18, fontWeight: "900" }, bookNavText: { color: "#0b654f", fontSize: 8, fontWeight: "900", textAlign: "center" }, pageCenterPill: { minWidth: 72, minHeight: 42, borderRadius: 13, backgroundColor: "#0b654f", alignItems: "center", justifyContent: "center" }, pageCenterText: { color: "#fff", fontSize: 9, fontWeight: "900" },\n'
new_styles = '  readerBody: { flex: 1, backgroundColor: "#e9e5dc" }, bookCanvas: { padding: 8, paddingBottom: 12 }, bookCanvasSpread: { flexGrow: 1, justifyContent: "center" }, bookSpread: { flexDirection: "row", alignItems: "stretch", justifyContent: "center", gap: 0 }, bookPageSlot: { flex: 1, minWidth: 0 }, blankBookPage: { backgroundColor: "#e0d9ca", borderRadius: 14, opacity: .55, margin: 3 }, bookGutter: { width: 12, backgroundColor: "#d2cab9", borderLeftWidth: 1, borderRightWidth: 1, borderColor: "#c4bba8" }, mushafPage: { minHeight: 650, borderRadius: 13, borderWidth: 1, borderColor: "#d8d0c0", paddingHorizontal: 14, paddingTop: 11, paddingBottom: 12, shadowColor: "#342d23", shadowOpacity: .08, shadowRadius: 5, shadowOffset: { width: 0, height: 2 }, elevation: 2 }, pageTopLine: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 24, borderBottomWidth: 1, borderBottomColor: "#e2dbc9", marginBottom: 8 }, pageMeta: { color: "#70736e", fontSize: 8, fontWeight: "800" }, surahFrame: { marginVertical: 12, paddingVertical: 3, paddingHorizontal: 3, borderTopWidth: 1, borderBottomWidth: 1, borderColor: "#0b7a5d", backgroundColor: "rgba(11,122,93,.025)" }, surahFrameInner: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9, paddingHorizontal: 6 }, surahFrameSide: { flex: 1, minWidth: 34, flexDirection: "row", alignItems: "center", gap: 4 }, surahFrameLine: { flex: 1, height: 1, backgroundColor: "#0b7a5d", opacity: .8 }, surahFrameDiamond: { width: 10, height: 10, borderWidth: 1.5, borderColor: "#0b7a5d", transform: [{ rotate: "45deg" }] }, surahFrameDiamondSmall: { width: 6, height: 6, borderWidth: 1, borderColor: "#0b7a5d", transform: [{ rotate: "45deg" }] }, surahFrameText: { minWidth: 118, maxWidth: "60%", flexShrink: 1, color: "#173f35", fontSize: 22, lineHeight: 32, fontWeight: "700", textAlign: "center", writingDirection: "rtl", includeFontPadding: false }, basmala: { textAlign: "center", writingDirection: "rtl", marginVertical: 9 }, pageBottom: { alignItems: "center", marginTop: 8 }, pageNumber: { color: "#6b706d", fontSize: 10, fontWeight: "800" }, bookNav: { minHeight: 55, flexDirection: "row", alignItems: "center", gap: 7, padding: 7, backgroundColor: "#fff", borderTopWidth: 1, borderTopColor: "#ded9cf" }, bookNavButton: { flex: 1, minHeight: 42, borderRadius: 13, backgroundColor: "#edf5f1", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, paddingHorizontal: 6 }, bookNavArrow: { color: "#0b654f", fontSize: 18, fontWeight: "900" }, bookNavText: { color: "#0b654f", fontSize: 8, fontWeight: "900", textAlign: "center" }, pageCenterPill: { minWidth: 72, minHeight: 42, borderRadius: 13, backgroundColor: "#0b654f", alignItems: "center", justifyContent: "center" }, pageCenterText: { color: "#fff", fontSize: 9, fontWeight: "900" },\n'
replace_once(quran, old_styles, new_styles, "Mushaf title styles")

# Clarify that horizontal mode is a real touch gesture anywhere on the Mushaf page.
replace_once(
    rendering,
    't("Swipe left/right to move between Mushaf pages.", "اسحب يميناً ويساراً للتنقل بين صفحات المصحف.")',
    't("Swipe left/right anywhere on the Mushaf page to turn pages.", "اسحب يميناً ويساراً في أي مكان على صفحة المصحف للتنقل بين الصفحات.")',
    "horizontal browsing help",
)

# Give the launcher art more safe area so Android masks never crop the Hassoun wordmark or mosque.
replace_once(
    icon,
    '<g transform="translate(112 112) scale(.78)">',
    '<g transform="translate(154 154) scale(.70)">',
    "launcher icon safe area",
)

# New installable build version for this reader fix pass.
replace_once(config, 'version: "0.4.2",', 'version: "0.4.3",', "app version")
replace_once(config, 'versionCode: 14,', 'versionCode: 15,', "Android versionCode")

print("Quran reader v0.4.3 fixes applied")
