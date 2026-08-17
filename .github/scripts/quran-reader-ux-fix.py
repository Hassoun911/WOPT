from pathlib import Path


def replace_once(path: str, old: str, new: str, label: str) -> None:
    p = Path(path)
    text = p.read_text(encoding="utf-8")
    if old not in text:
        raise SystemExit(f"Missing patch target: {label} in {path}")
    p.write_text(text.replace(old, new, 1), encoding="utf-8")


quran = "mobile/src/quran/QuranV2.tsx"
config = "mobile/app.config.ts"
build = ".github/workflows/android-debug.yml"

replace_once(
    quran,
    '  Modal,\n  Pressable,\n',
    '  Modal,\n  PanResponder,\n  Pressable,\n',
    "PanResponder import",
)

replace_once(
    quran,
    '''  const [menuOpen, setMenuOpen] = useState(false);
  const [appearanceOpen, setAppearanceOpen] = useState(false);
  const { appearance, setAppearance, reset: resetAppearance } = useQuranAppearance();
  const [selectedAyah, setSelectedAyah] = useState<QuranAyah | null>(null);
''',
    '''  const [menuOpen, setMenuOpen] = useState(false);
  const [appearanceOpen, setAppearanceOpen] = useState(false);
  const [playerVisible, setPlayerVisible] = useState(true);
  const [selectionControlsOpen, setSelectionControlsOpen] = useState(false);
  const readerScrollYRef = useRef(0);
  const readerScrollMaxRef = useRef(0);
  const readerTapStartRef = useRef<{ x: number; y: number } | null>(null);
  const { appearance, setAppearance, reset: resetAppearance } = useQuranAppearance();
  const [selectedAyah, setSelectedAyah] = useState<QuranAyah | null>(null);
''',
    "reader interaction state",
)

replace_once(
    quran,
    '''  const openPage = (page: number) => {
    const safePage = clamp(page, 1, 604);
    const start = pages[safePage - 1];
    if (!start) return;
    const next = { surah: start.surah, ayah: start.ayah };
    setPosition(next);
    setSelectedAyah(null);
    setRange(null);
    setRangeSelecting(false);
    persistLast(next);
  };

''',
    '''  const openPage = (page: number) => {
    const safePage = clamp(page, 1, 604);
    const start = pages[safePage - 1];
    if (!start) return;
    const next = { surah: start.surah, ayah: start.ayah };
    setPosition(next);
    setSelectedAyah(null);
    setRange(null);
    setRangeSelecting(false);
    setSelectionControlsOpen(false);
    readerScrollYRef.current = 0;
    readerScrollMaxRef.current = 0;
    persistLast(next);
  };

  const goNextPage = () => {
    if (currentPage < 604) openPage(currentPage + 1);
  };

  const goPreviousPage = () => {
    if (currentPage > 1) openPage(currentPage - 1);
  };

  const readerPanResponder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponderCapture: (_event, gesture) => {
      const horizontal = Math.abs(gesture.dx);
      const vertical = Math.abs(gesture.dy);
      if (appearance.browseMode === "horizontal") {
        return horizontal > 18 && horizontal > vertical * 1.15;
      }
      const atTop = readerScrollYRef.current <= 2;
      const atBottom = readerScrollYRef.current >= Math.max(0, readerScrollMaxRef.current - 2);
      return vertical > 22 && vertical > horizontal * 1.15 && ((atBottom && gesture.dy < 0) || (atTop && gesture.dy > 0));
    },
    onPanResponderRelease: (_event, gesture) => {
      if (appearance.browseMode === "horizontal") {
        // Arabic-book order: higher pages live to the left, so a right swipe advances.
        if (gesture.dx > 55) goNextPage();
        else if (gesture.dx < -55) goPreviousPage();
        return;
      }
      const atTop = readerScrollYRef.current <= 2;
      const atBottom = readerScrollYRef.current >= Math.max(0, readerScrollMaxRef.current - 2);
      if (atBottom && gesture.dy < -45) goNextPage();
      else if (atTop && gesture.dy > 45) goPreviousPage();
    },
    onPanResponderTerminationRequest: () => true,
  }), [appearance.browseMode, currentPage]);

''',
    "working page gestures",
)

replace_once(
    quran,
    '''      setRange({ ...range, start: Math.min(range.start, ayah.ayah), end: Math.max(range.start, ayah.ayah) });
      setRangeSelecting(false);
      setSelectedAyah(ayah);
    } else {
      setSelectedAyah((current) => current?.surah === ayah.surah && current?.ayah === ayah.ayah ? null : ayah);
      persistLast({ surah: ayah.surah, ayah: ayah.ayah });
''',
    '''      setRange({ ...range, start: Math.min(range.start, ayah.ayah), end: Math.max(range.start, ayah.ayah) });
      setRangeSelecting(false);
      setSelectionControlsOpen(false);
      setSelectedAyah(ayah);
    } else {
      setSelectionControlsOpen(false);
      setSelectedAyah((current) => current?.surah === ayah.surah && current?.ayah === ayah.ayah ? null : ayah);
      persistLast({ surah: ayah.surah, ayah: ayah.ayah });
''',
    "selection controls reset",
)

replace_once(
    quran,
    '''  const continueQuran = (from: Position) => {
    const queue: QuranAyah[] = [];
    for (let s = from.surah; s <= 114; s += 1) {
      const ayahs = getSurahAyahs(s);
      queue.push(...(s === from.surah ? ayahs.slice(from.ayah - 1) : ayahs));
    }
    playQueue(queue, false);
  };

''',
    '''  const continueQuran = (from: Position) => {
    const queue: QuranAyah[] = [];
    for (let s = from.surah; s <= 114; s += 1) {
      const ayahs = getSurahAyahs(s);
      queue.push(...(s === from.surah ? ayahs.slice(from.ayah - 1) : ayahs));
    }
    playQueue(queue, false);
  };

  const playCurrentSelection = (loop = false) => {
    if (!selectedAyah) return;
    const selectedRange = range?.surah === selectedAyah.surah && selectedAyah.ayah >= range.start && selectedAyah.ayah <= range.end
      ? range
      : { surah: selectedAyah.surah, start: selectedAyah.ayah, end: selectedAyah.ayah };
    playRange(selectedRange, loop);
    setSelectionControlsOpen(true);
    setPlayerVisible(true);
  };

''',
    "selection playback helper",
)

replace_once(
    quran,
    '''  const stopAudio = () => {
    QuranAudio?.stop();
    setAudioQueue([]);
    setAudioIndex(-1);
    setRepeatQueue(false);
    setAudioStatus({ available: Boolean(QuranAudio), state: "idle", positionMs: 0, durationMs: 0, speed: prefs.speed });
  };
''',
    '''  const stopAudio = () => {
    QuranAudio?.stop();
    setAudioQueue([]);
    setAudioIndex(-1);
    setRepeatQueue(false);
    setSelectionControlsOpen(false);
    setAudioStatus({ available: Boolean(QuranAudio), state: "idle", positionMs: 0, durationMs: 0, speed: prefs.speed });
  };
''',
    "stop closes expanded controls",
)

old_player = '''  const miniPlayer = activeAyah ? (
    <Pressable onPress={() => setMenuOpen(true)} style={styles.miniPlayer}>
      <View style={styles.miniCopy}>
        <Text style={styles.miniEyebrow}>🎧 {ar ? activeReciter.ar : activeReciter.en}</Text>
        <Text style={styles.miniTitle}>{ar ? getSurah(activeAyah.surah)?.nameArabic : getSurah(activeAyah.surah)?.nameTransliterated} {num(activeAyah.surah)}:{num(activeAyah.ayah)}</Text>
        <Text style={styles.miniMeta}>{formatTime(audioStatus.positionMs)} / {formatTime(audioStatus.durationMs)} · {prefs.speed.toFixed(1)}×</Text>
      </View>
      <Pressable onPress={(event) => { event.stopPropagation(); previousAudio(); }} style={styles.playerButton}><Text>⏮️</Text></Pressable>
      <Pressable onPress={(event) => { event.stopPropagation(); audioStatus.state === "playing" ? QuranAudio?.pause() : QuranAudio?.resume(); }} style={styles.playerButton}><Text>{audioStatus.state === "playing" ? "⏸️" : "▶️"}</Text></Pressable>
      <Pressable onPress={(event) => { event.stopPropagation(); nextAudio(); }} style={styles.playerButton}><Text>⏭️</Text></Pressable>
    </Pressable>
  ) : null;
'''
new_player = '''  const miniPlayer = activeAyah && playerVisible ? (
    <View style={[styles.floatingPlayerWrap, selectedAyah ? styles.floatingPlayerRaised : null]}>
      <View style={styles.miniPlayer}>
        <Pressable onPress={() => QuranAudio?.seekBy(-10000)} style={styles.playerButton}><Text style={styles.playerButtonText}>−10</Text></Pressable>
        <Pressable onPress={() => audioStatus.state === "playing" ? QuranAudio?.pause() : QuranAudio?.resume()} style={styles.playerButtonMain}><Text style={styles.playerMainText}>{audioStatus.state === "playing" ? "Ⅱ" : "▶"}</Text></Pressable>
        <Pressable onPress={() => QuranAudio?.seekBy(10000)} style={styles.playerButton}><Text style={styles.playerButtonText}>+10</Text></Pressable>
        <Pressable onPress={() => setRepeatQueue((value) => !value)} style={[styles.playerButton, repeatQueue && styles.playerButtonActive]}><Text style={styles.playerButtonText}>↻</Text></Pressable>
        <Pressable onPress={() => setAppearanceOpen(true)} style={styles.appearancePlayerButton}><Text style={styles.appearancePlayerText}>Aa</Text></Pressable>
      </View>
    </View>
  ) : null;
'''
replace_once(quran, old_player, new_player, "floating audio player")

replace_once(
    quran,
    '''        <View style={styles.readerPageBody}>
          <ScrollView style={styles.flex} contentContainerStyle={styles.mushafWrap} showsVerticalScrollIndicator={false}>
''',
    '''        <View
          style={styles.readerPageBody}
          {...readerPanResponder.panHandlers}
          onTouchStart={(event) => { readerTapStartRef.current = { x: event.nativeEvent.locationX, y: event.nativeEvent.locationY }; }}
          onTouchEnd={(event) => {
            const start = readerTapStartRef.current;
            if (!start || !activeAyah) return;
            const dx = Math.abs(event.nativeEvent.locationX - start.x);
            const dy = Math.abs(event.nativeEvent.locationY - start.y);
            if (dx < 8 && dy < 8) setPlayerVisible((value) => !value);
          }}
        >
          <ScrollView
            style={styles.flex}
            contentContainerStyle={styles.mushafWrap}
            showsVerticalScrollIndicator={false}
            scrollEventThrottle={16}
            onScroll={(event) => {
              const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
              readerScrollYRef.current = contentOffset.y;
              readerScrollMaxRef.current = Math.max(0, contentSize.height - layoutMeasurement.height);
            }}
          >
''',
    "reader scroll and touch shell",
)

replace_once(
    quran,
    '''          <View style={styles.pageNav}><Pressable disabled={currentPage <= 1} onPress={() => openPage(currentPage - 1)} style={[styles.pageNavButton, currentPage <= 1 && styles.disabled]}><Text style={styles.pageNavText}>{ar ? "›" : "‹"} {tr("Previous", "السابق")}</Text></Pressable><View style={styles.pageNumberPill}><Text style={styles.pageNumberPillText}>📖 {tr(`Page ${currentPage}`, `صفحة ${num(currentPage)}`)}</Text></View><Pressable disabled={currentPage >= 604} onPress={() => openPage(currentPage + 1)} style={[styles.pageNavButton, currentPage >= 604 && styles.disabled]}><Text style={styles.pageNavText}>{tr("Next", "التالي")} {ar ? "‹" : "›"}</Text></Pressable></View>
''',
    '',
    "remove previous next page buttons",
)

old_actions = '''      {selectedAyah ? <View style={styles.ayahActions}><Text style={styles.actionRef}>{ar ? getSurah(selectedAyah.surah)?.nameArabic : getSurah(selectedAyah.surah)?.nameTransliterated} • {tr("Ayah", "الآية")} {num(selectedAyah.ayah)}</Text><View style={styles.actionRow}><Pressable onPress={() => playAyah(selectedAyah)} style={styles.actionButton}><Text style={styles.actionEmoji}>▶️</Text><Text style={styles.actionLabel}>{tr("Play", "تشغيل")}</Text></Pressable><Pressable onPress={() => playAyah(selectedAyah, true)} style={styles.actionButton}><Text style={styles.actionEmoji}>🔁</Text><Text style={styles.actionLabel}>{tr("Repeat", "تكرار")}</Text></Pressable><Pressable onPress={() => startRange(selectedAyah)} style={styles.actionButton}><Text style={styles.actionEmoji}>✨</Text><Text style={styles.actionLabel}>{tr("Phrase", "مقطع")}</Text></Pressable><Pressable onPress={() => toggleBookmark(selectedAyah)} style={styles.actionButton}><Text style={styles.actionEmoji}>🔖</Text><Text style={styles.actionLabel}>{tr("Save", "حفظ")}</Text></Pressable><Pressable onPress={() => { const next = { surah: selectedAyah.surah, start: selectedAyah.ayah, end: selectedAyah.ayah }; setMemorizeRange(next); void AsyncStorage.setItem(KEYS.memorize, JSON.stringify(next)); setScreen("memorize"); }} style={styles.actionButton}><Text style={styles.actionEmoji}>📿</Text><Text style={styles.actionLabel}>{tr("Memorize", "حفظ")}</Text></Pressable></View></View> : null}
'''
new_actions = '''      {selectedAyah ? (
        <View style={styles.selectionDock}>
          <View style={styles.selectionHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.selectionEyebrow}>{range?.surah === selectedAyah.surah && selectedAyah.ayah >= range.start && selectedAyah.ayah <= range.end ? tr("SELECTED PHRASE", "المقطع المحدد") : tr("SELECTED AYAH", "الآية المحددة")}</Text>
              <Text style={styles.selectionRef}>{ar ? getSurah(selectedAyah.surah)?.nameArabic : getSurah(selectedAyah.surah)?.nameTransliterated} • {range?.surah === selectedAyah.surah && selectedAyah.ayah >= range.start && selectedAyah.ayah <= range.end ? `${num(range.start)}–${num(range.end)}` : num(selectedAyah.ayah)}</Text>
            </View>
            <Pressable onPress={() => { setSelectedAyah(null); setRange(null); setSelectionControlsOpen(false); }} style={styles.selectionClose}><Text style={styles.selectionCloseText}>×</Text></Pressable>
          </View>
          {selectionControlsOpen ? (
            <View style={styles.selectionTransport}>
              <Pressable onPress={() => audioStatus.state === "playing" ? QuranAudio?.pause() : QuranAudio?.resume()} style={styles.selectionControl}><Text style={styles.selectionControlIcon}>{audioStatus.state === "playing" ? "Ⅱ" : "▶"}</Text><Text style={styles.selectionControlLabel}>{audioStatus.state === "playing" ? tr("Pause", "إيقاف مؤقت") : tr("Resume", "متابعة")}</Text></Pressable>
              <Pressable onPress={stopAudio} style={styles.selectionControl}><Text style={styles.selectionControlIcon}>■</Text><Text style={styles.selectionControlLabel}>{tr("Stop", "إيقاف")}</Text></Pressable>
              <Pressable onPress={() => playCurrentSelection(false)} style={styles.selectionControl}><Text style={styles.selectionControlIcon}>↺</Text><Text style={styles.selectionControlLabel}>{tr("Repeat", "إعادة")}</Text></Pressable>
              <Pressable onPress={() => playCurrentSelection(true)} style={[styles.selectionControl, repeatQueue && styles.selectionControlActive]}><Text style={styles.selectionControlIcon}>∞</Text><Text style={styles.selectionControlLabel}>{tr("Loop", "تكرار")}</Text></Pressable>
            </View>
          ) : (
            <View style={styles.selectionActions}>
              <Pressable onPress={() => playCurrentSelection(false)} style={[styles.selectionButton, styles.selectionButtonPrimary]}><Text style={styles.selectionButtonIcon}>▶</Text><Text style={styles.selectionButtonPrimaryText}>{tr("Play", "تشغيل")}</Text></Pressable>
              <Pressable onPress={() => startRange(selectedAyah)} style={styles.selectionButton}><Text style={styles.selectionButtonIcon}>✦</Text><Text style={styles.selectionButtonText}>{tr("Phrase", "مقطع")}</Text></Pressable>
              <Pressable onPress={() => toggleBookmark(selectedAyah)} style={styles.selectionButton}><Text style={styles.selectionButtonIcon}>🔖</Text><Text style={styles.selectionButtonText}>{tr("Save", "حفظ")}</Text></Pressable>
              <Pressable onPress={() => { const next = { surah: selectedAyah.surah, start: selectedAyah.ayah, end: selectedAyah.ayah }; setMemorizeRange(next); void AsyncStorage.setItem(KEYS.memorize, JSON.stringify(next)); setScreen("memorize"); }} style={styles.selectionButton}><Text style={styles.selectionButtonIcon}>📿</Text><Text style={styles.selectionButtonText}>{tr("Memorize", "حفظ")}</Text></Pressable>
            </View>
          )}
        </View>
      ) : null}
'''
replace_once(quran, old_actions, new_actions, "selected ayah action dock")

replace_once(
    quran,
    '''  ayahActions: { backgroundColor: "white", borderTopWidth: 1, borderTopColor: "#e1ddd4", padding: 9 }, actionRef: { color: "#17483c", fontSize: 9, fontWeight: "900", marginBottom: 7 }, actionRow: { flexDirection: "row", gap: 6 }, actionButton: { flex: 1, minHeight: 50, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: "#f0f5f2" }, actionEmoji: { fontSize: 17 }, actionLabel: { color: "#31564b", fontSize: 7, fontWeight: "900", marginTop: 2 },
  miniPlayer: { backgroundColor: "#113f35", paddingHorizontal: 11, paddingVertical: 9, flexDirection: "row", alignItems: "center", gap: 6, borderTopWidth: 1, borderTopColor: "#2b5d51" }, miniCopy: { flex: 1 }, miniEyebrow: { color: "#bdd9d0", fontSize: 7, fontWeight: "900" }, miniTitle: { color: "white", fontSize: 11, fontWeight: "900", marginTop: 2 }, miniMeta: { color: "#b9d1c9", fontSize: 8, marginTop: 2 }, playerButton: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,.1)" },
''',
    '''  selectionDock: { position: "absolute", left: 10, right: 10, bottom: 10, zIndex: 40, borderRadius: 22, padding: 10, backgroundColor: "rgba(255,255,255,.97)", borderWidth: 1, borderColor: "#dce5e0", shadowColor: "#000", shadowOpacity: .16, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 10 }, selectionHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 }, selectionEyebrow: { color: "#8d743d", fontSize: 7, fontWeight: "900", letterSpacing: .8 }, selectionRef: { color: "#17483c", fontSize: 10, fontWeight: "900", marginTop: 2 }, selectionClose: { width: 28, height: 28, borderRadius: 10, backgroundColor: "#edf3f0", alignItems: "center", justifyContent: "center" }, selectionCloseText: { color: "#31564b", fontSize: 20, lineHeight: 21 }, selectionActions: { flexDirection: "row", gap: 6 }, selectionButton: { flex: 1, minHeight: 48, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "#eff5f2" }, selectionButtonPrimary: { backgroundColor: "#0b654f" }, selectionButtonIcon: { fontSize: 15 }, selectionButtonText: { color: "#31564b", fontSize: 7, fontWeight: "900", marginTop: 2 }, selectionButtonPrimaryText: { color: "#fff", fontSize: 7, fontWeight: "900", marginTop: 2 }, selectionTransport: { flexDirection: "row", gap: 6 }, selectionControl: { flex: 1, minHeight: 52, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "#edf5f1" }, selectionControlActive: { backgroundColor: "#d8eee5", borderWidth: 1, borderColor: "#0b7a5d" }, selectionControlIcon: { color: "#0b654f", fontSize: 16, fontWeight: "900" }, selectionControlLabel: { color: "#31564b", fontSize: 7, fontWeight: "900", marginTop: 3 },
  floatingPlayerWrap: { position: "absolute", left: 0, right: 0, bottom: 18, zIndex: 50, alignItems: "center" }, floatingPlayerRaised: { bottom: 104 }, miniPlayer: { minHeight: 56, borderRadius: 28, paddingHorizontal: 8, paddingVertical: 7, flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(17,63,53,.97)", shadowColor: "#000", shadowOpacity: .22, shadowRadius: 11, shadowOffset: { width: 0, height: 5 }, elevation: 12 }, playerButton: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,.09)" }, playerButtonMain: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center", backgroundColor: "#fff" }, playerButtonActive: { backgroundColor: "#2c7d68" }, playerButtonText: { color: "#fff", fontSize: 10, fontWeight: "900" }, playerMainText: { color: "#0b654f", fontSize: 17, fontWeight: "900" }, appearancePlayerButton: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center", backgroundColor: "#dff2e9" }, appearancePlayerText: { color: "#0b654f", fontSize: 11, fontWeight: "900" },
''',
    "new action/player styles",
)

replace_once(config, 'version: "0.4.6",', 'version: "0.4.7",', "app version")
replace_once(config, 'versionCode: 18,', 'versionCode: 19,', "Android versionCode")
replace_once(build, 'Hassoun-v0.4.6.apk', 'Hassoun-v0.4.7.apk', "APK filename")
replace_once(build, 'hassoun-v0.4.6-${{ github.run_number }}', 'hassoun-v0.4.7-${{ github.run_number }}', "artifact name")

print("Qur'an reader scrolling and audio controls fixed")
