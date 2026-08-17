from pathlib import Path


def replace_once(path: str, old: str, new: str, label: str) -> None:
    p = Path(path)
    text = p.read_text(encoding="utf-8")
    if old not in text:
        raise SystemExit(f"Missing patch target: {label} in {path}")
    p.write_text(text.replace(old, new, 1), encoding="utf-8")


quran = "mobile/src/quran/QuranV3.tsx"
config = "mobile/app.config.ts"

# Reader player visibility: a simple tap on the Mushaf toggles the compact floating controls.
replace_once(
    quran,
    '  const [appearanceOpen, setAppearanceOpen] = useState(false);\n  const [loaded, setLoaded] = useState(false);\n',
    '  const [appearanceOpen, setAppearanceOpen] = useState(false);\n  const [playerVisible, setPlayerVisible] = useState(true);\n  const [loaded, setLoaded] = useState(false);\n',
    "floating player visibility state",
)
replace_once(
    quran,
    '  const verticalGestureStartY = useRef<number | null>(null);\n  const readerAtTop = useRef(true);\n',
    '  const verticalGestureStartY = useRef<number | null>(null);\n  const readerTapStart = useRef<{ x: number; y: number; time: number } | null>(null);\n  const readerAtTop = useRef(true);\n',
    "reader tap ref",
)

# Arabic-book paging: the next / higher Mushaf page is to the LEFT.
replace_once(
    quran,
    '''        // Swipe left = next Mushaf page, swipe right = previous page.
        turnReaderPage(gestureState.dx < 0 ? 1 : -1);
''',
    '''        // Arabic-book direction: higher / next pages live to the left.
        // Swipe right to advance to the next page; swipe left to go back.
        turnReaderPage(gestureState.dx > 0 ? 1 : -1);
''',
    "Arabic book horizontal swipe direction",
)

# Distinguish a screen tap from a swipe/scroll, then toggle the floating player.
insert_after = '''  const handleVerticalTouchEnd = (event: { nativeEvent: { pageY: number } }) => {
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
replacement = insert_after + '''

  const handleReaderSurfaceTouchStart = (event: { nativeEvent: { pageX: number; pageY: number } }) => {
    readerTapStart.current = { x: event.nativeEvent.pageX, y: event.nativeEvent.pageY, time: Date.now() };
  };

  const handleReaderSurfaceTouchEnd = (event: { nativeEvent: { pageX: number; pageY: number } }) => {
    const start = readerTapStart.current;
    readerTapStart.current = null;
    if (!start) return;
    const dx = event.nativeEvent.pageX - start.x;
    const dy = event.nativeEvent.pageY - start.y;
    const elapsed = Date.now() - start.time;
    if (Math.abs(dx) <= 10 && Math.abs(dy) <= 10 && elapsed <= 350) {
      setPlayerVisible((visible) => !visible);
    }
  };
'''
replace_once(quran, insert_after, replacement, "reader tap show hide controls")

# Compact controller-only floating player. No menu, metadata, next-track or previous-track buttons.
old_player = '''  const miniPlayer = playerAyah ? (
    <View style={styles.miniPlayer}>
      <View style={styles.playerHeader}>
        <View style={styles.playerBadge}><Text style={styles.playerBadgeText}>🎧</Text></View>
        <Pressable onPress={() => setMenuOpen(true)} style={styles.miniCopy}>
          <Text style={styles.miniEyebrow}>{ar ? activeReciter.ar : activeReciter.en}</Text>
          <Text style={styles.miniTitle}>{ar ? playerSurah?.nameArabic : playerSurah?.nameTransliterated} · {tr("Ayah", "الآية")} {num(playerAyah.ayah)}</Text>
          <Text style={styles.miniMeta}>{activeAyah ? `${formatTime(audioStatus.positionMs)} / ${formatTime(audioStatus.durationMs)}` : tr("Ready to play this Surah", "جاهز لتشغيل هذه السورة")}</Text>
        </Pressable>
        <Pressable onPress={() => setMenuOpen(true)} style={styles.playerMore}><Text style={styles.playerMoreText}>•••</Text></Pressable>
      </View>
      <View style={styles.playerTransport}>
        <Pressable disabled={!activeAyah} onPress={() => QuranAudio?.seekBy(-10000)} style={[styles.playerControl, !activeAyah && styles.playerControlDisabled]}><Text style={styles.playerControlText}>−10</Text></Pressable>
        <Pressable disabled={!activeAyah} onPress={previousAudio} style={[styles.playerControl, !activeAyah && styles.playerControlDisabled]}><Text style={styles.playerControlArrow}>‹</Text></Pressable>
        <Pressable onPress={togglePlayerPlayback} style={styles.playerMain}><Text style={styles.playerMainText}>{audioStatus.state === "playing" ? "Ⅱ" : "▶"}</Text></Pressable>
        <Pressable disabled={!activeAyah} onPress={nextAudio} style={[styles.playerControl, !activeAyah && styles.playerControlDisabled]}><Text style={styles.playerControlArrow}>›</Text></Pressable>
        <Pressable disabled={!activeAyah} onPress={() => QuranAudio?.seekBy(10000)} style={[styles.playerControl, !activeAyah && styles.playerControlDisabled]}><Text style={styles.playerControlText}>+10</Text></Pressable>
        <Pressable onPress={() => setMenuOpen(true)} style={styles.playerSpeedPill}><Text style={styles.playerSpeedText}>{audioPrefs.speed.toFixed(1)}×</Text></Pressable>
      </View>
    </View>
  ) : null;
'''
new_player = '''  const miniPlayer = playerAyah ? (
    <View style={styles.miniPlayer}>
      <Pressable disabled={!activeAyah} onPress={() => QuranAudio?.seekBy(-10000)} style={[styles.playerControl, !activeAyah && styles.playerControlDisabled]}><Text style={styles.playerControlText}>−10</Text></Pressable>
      <Pressable onPress={togglePlayerPlayback} style={styles.playerMain}><Text style={styles.playerMainText}>{audioStatus.state === "playing" ? "Ⅱ" : "▶"}</Text></Pressable>
      <Pressable disabled={!activeAyah} onPress={() => QuranAudio?.seekBy(10000)} style={[styles.playerControl, !activeAyah && styles.playerControlDisabled]}><Text style={styles.playerControlText}>+10</Text></Pressable>
      <Pressable onPress={() => updateSpeed(audioPrefs.speed >= 2 ? 0.5 : audioPrefs.speed + 0.1)} style={styles.playerSpeedPill}><Text style={styles.playerSpeedText}>{audioPrefs.speed.toFixed(1)}×</Text></Pressable>
    </View>
  ) : null;
'''
replace_once(quran, old_player, new_player, "compact floating audio controller")

# The Mushaf itself owns tap-to-show/hide behavior while the pan responder owns horizontal page turns.
replace_once(
    quran,
    '<View style={styles.readerBody} {...readerPanResponder.panHandlers}>',
    '<View style={styles.readerBody} onTouchStart={handleReaderSurfaceTouchStart} onTouchEnd={handleReaderSurfaceTouchEnd} {...readerPanResponder.panHandlers}>',
    "reader surface tap handlers",
)

# Remove the large Previous / Next page-navigation bar. Swipe/scroll is now the primary navigation.
old_nav = '''          <View style={styles.bookNav}><Pressable disabled={currentPage <= 1} onPress={() => openPage(previousBookPage)} style={[styles.bookNavButton, currentPage <= 1 && styles.disabled]}><Text style={styles.bookNavArrow}>{ar ? "›" : "‹"}</Text><Text style={styles.bookNavText}>{spreadMode ? tr("Previous pages", "الصفحات السابقة") : tr("Previous", "السابق")}</Text></Pressable><Pressable onPress={() => setAppearanceOpen(true)} style={styles.pageCenterPill}><Text style={styles.pageCenterText}>{spreadMode ? `📖 ${spreadLeftPage ?? 1}–${spreadRightPage}` : `📖 ${currentPage}`}</Text></Pressable><Pressable disabled={currentPage >= 604 || (spreadMode && spreadRightPage >= 604)} onPress={() => openPage(nextBookPage)} style={[styles.bookNavButton, (currentPage >= 604 || (spreadMode && spreadRightPage >= 604)) && styles.disabled]}><Text style={styles.bookNavText}>{spreadMode ? tr("Next pages", "الصفحات التالية") : tr("Next", "التالي")}</Text><Text style={styles.bookNavArrow}>{ar ? "‹" : "›"}</Text></Pressable></View>
'''
replace_once(quran, old_nav, "", "remove previous next page controls")

# Show the compact player only in the reader; touching the page toggles it.
replace_once(
    quran,
    '      {miniPlayer}\n      {screen === "radio" ? quranDock : null}\n',
    '      {screen === "reader" && playerVisible ? miniPlayer : null}\n      {screen === "radio" ? quranDock : null}\n',
    "reader-only floating player",
)

# Floating pill styling: small footprint and no full-width audio bar.
old_player_styles = '  miniPlayer: { minHeight: 96, backgroundColor: "#103f35", paddingHorizontal: 12, paddingTop: 9, paddingBottom: 10, borderTopWidth: 1, borderTopColor: "#2c5c50" }, playerHeader: { flexDirection: "row", alignItems: "center", gap: 9 }, playerBadge: { width: 36, height: 36, borderRadius: 13, backgroundColor: "rgba(255,255,255,.1)", alignItems: "center", justifyContent: "center" }, playerBadgeText: { fontSize: 17 }, miniCopy: { flex: 1 }, miniEyebrow: { color: "#b8d7ce", fontSize: 7, fontWeight: "900" }, miniTitle: { color: "#fff", fontSize: 11, fontWeight: "900", marginTop: 2 }, miniMeta: { color: "#a9c7be", fontSize: 7, marginTop: 2 }, playerMore: { width: 34, height: 34, borderRadius: 12, backgroundColor: "rgba(255,255,255,.08)", alignItems: "center", justifyContent: "center" }, playerMoreText: { color: "#d5e5df", fontSize: 13, fontWeight: "900" }, playerTransport: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, marginTop: 8 }, playerControl: { width: 34, height: 34, borderRadius: 12, backgroundColor: "rgba(255,255,255,.09)", alignItems: "center", justifyContent: "center" }, playerControlDisabled: { opacity: .35 }, playerControlText: { color: "#d8e7e2", fontSize: 8, fontWeight: "900" }, playerControlArrow: { color: "#fff", fontSize: 25, lineHeight: 27, fontWeight: "700" }, playerMain: { width: 44, height: 44, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: "#fff" }, playerMainText: { color: "#0b654f", fontSize: 18, fontWeight: "900" }, playerSpeedPill: { minWidth: 40, height: 34, borderRadius: 12, backgroundColor: "#dcebe5", alignItems: "center", justifyContent: "center", paddingHorizontal: 6 }, playerSpeedText: { color: "#17483c", fontSize: 8, fontWeight: "900" },\n'
new_player_styles = '  miniPlayer: { position: "absolute", left: 48, right: 48, bottom: 18, minHeight: 56, borderRadius: 28, backgroundColor: "rgba(16,63,53,.96)", paddingHorizontal: 9, paddingVertical: 6, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderWidth: 1, borderColor: "rgba(255,255,255,.12)", shadowColor: "#000", shadowOpacity: .22, shadowRadius: 9, shadowOffset: { width: 0, height: 4 }, elevation: 12, zIndex: 50 }, playerHeader: { flexDirection: "row", alignItems: "center", gap: 9 }, playerBadge: { width: 36, height: 36, borderRadius: 13, backgroundColor: "rgba(255,255,255,.1)", alignItems: "center", justifyContent: "center" }, playerBadgeText: { fontSize: 17 }, miniCopy: { flex: 1 }, miniEyebrow: { color: "#b8d7ce", fontSize: 7, fontWeight: "900" }, miniTitle: { color: "#fff", fontSize: 11, fontWeight: "900", marginTop: 2 }, miniMeta: { color: "#a9c7be", fontSize: 7, marginTop: 2 }, playerMore: { width: 34, height: 34, borderRadius: 12, backgroundColor: "rgba(255,255,255,.08)", alignItems: "center", justifyContent: "center" }, playerMoreText: { color: "#d5e5df", fontSize: 13, fontWeight: "900" }, playerTransport: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 }, playerControl: { width: 38, height: 38, borderRadius: 19, backgroundColor: "rgba(255,255,255,.09)", alignItems: "center", justifyContent: "center" }, playerControlDisabled: { opacity: .35 }, playerControlText: { color: "#e4efeb", fontSize: 9, fontWeight: "900" }, playerControlArrow: { color: "#fff", fontSize: 25, lineHeight: 27, fontWeight: "700" }, playerMain: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: "#fff" }, playerMainText: { color: "#0b654f", fontSize: 17, fontWeight: "900" }, playerSpeedPill: { minWidth: 42, height: 38, borderRadius: 19, backgroundColor: "#dcebe5", alignItems: "center", justifyContent: "center", paddingHorizontal: 6 }, playerSpeedText: { color: "#17483c", fontSize: 8, fontWeight: "900" },\n'
replace_once(quran, old_player_styles, new_player_styles, "floating audio styles")

# New build version.
replace_once(config, 'version: "0.4.3",', 'version: "0.4.4",', "app version")
replace_once(config, 'versionCode: 15,', 'versionCode: 16,', "Android versionCode")

print("Quran Arabic-book paging and floating player v0.4.4 applied")
