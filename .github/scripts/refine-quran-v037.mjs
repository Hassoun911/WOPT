import fs from "node:fs";

function patchFile(path, patches) {
  let src = fs.readFileSync(path, "utf8");
  for (const [label, before, after] of patches) {
    if (!src.includes(before)) throw new Error(`${path}: missing patch target ${label}`);
    src = src.replace(before, after);
  }
  fs.writeFileSync(path, src);
}

patchFile("mobile/src/quran/QuranV3.tsx", [
  [
    "night mode const",
    `  const spreadMode = appearance.bookMode === "spread" || (appearance.bookMode === "auto" && autoSpread);`,
    `  const spreadMode = appearance.bookMode === "spread" || (appearance.bookMode === "auto" && autoSpread);\n  const nightMode = appearance.pageTheme === "dark";`
  ],
  [
    "top bar theme",
    `    <View style={styles.topBar}>\n      <Pressable onPress={handleBack} style={styles.iconButton}><Text style={styles.back}>{ar ? "›" : "‹"}</Text></Pressable>\n      <View style={styles.topCopy}><Text style={[styles.topTitle, ar && styles.rtl]}>{title}</Text>{subtitle ? <Text style={[styles.topSubtitle, ar && styles.rtl]}>{subtitle}</Text> : null}</View>\n      <Pressable onPress={() => setMenuOpen(true)} style={styles.topMenuButton}><Text style={styles.topMenuIcon}>☰</Text></Pressable>\n    </View>`,
    `    <View style={[styles.topBar, nightMode && styles.topBarNight]}>\n      <Pressable onPress={handleBack} style={[styles.iconButton, nightMode && styles.iconButtonNight]}><Text style={[styles.back, nightMode && styles.textNight]}>{ar ? "›" : "‹"}</Text></Pressable>\n      <View style={styles.topCopy}><Text style={[styles.topTitle, nightMode && styles.textNight, ar && styles.rtl]}>{title}</Text>{subtitle ? <Text style={[styles.topSubtitle, nightMode && styles.mutedNight, ar && styles.rtl]}>{subtitle}</Text> : null}</View>\n      <Pressable onPress={() => setMenuOpen(true)} style={[styles.topMenuButton, nightMode && styles.topMenuButtonNight]}><Text style={[styles.topMenuIcon, nightMode && styles.textNight]}>☰</Text></Pressable>\n    </View>`
  ],
  [
    "mini player icons",
    `      <Pressable onPress={previousAudio} style={styles.playerButton}><Text>⏮️</Text></Pressable>\n      <Pressable onPress={() => audioStatus.state === "playing" ? QuranAudio?.pause() : QuranAudio?.resume()} style={styles.playerMain}><Text>{audioStatus.state === "playing" ? "⏸️" : "▶️"}</Text></Pressable>\n      <Pressable onPress={nextAudio} style={styles.playerButton}><Text>⏭️</Text></Pressable>`,
    `      <Pressable onPress={previousAudio} style={styles.playerButton}><Text style={styles.playerGlyph}>‹‹</Text></Pressable>\n      <Pressable onPress={() => audioStatus.state === "playing" ? QuranAudio?.pause() : QuranAudio?.resume()} style={styles.playerMain}><Text style={styles.playerMainGlyph}>{audioStatus.state === "playing" ? "Ⅱ" : "▶"}</Text></Pressable>\n      <Pressable onPress={nextAudio} style={styles.playerButton}><Text style={styles.playerGlyph}>››</Text></Pressable>`
  ],
  [
    "radio title and action icons",
    `<View style={styles.radioCard}><Text style={styles.radioCardTitle}>▶️ {tr("Play one Surah", "تشغيل سورة")}</Text><Text style={styles.radioCardHint}>{tr("Play once, loop it, or add it to your playlist.", "شغّلها مرة أو كررها أو أضفها إلى قائمة التشغيل.")}</Text>{surahStepper(radioSurah, setRadioSurah)}<View style={styles.radioActionRow}><Pressable onPress={() => playSurah(radioSurah, false)} style={styles.radioAction}><Text style={styles.radioActionIcon}>▶️</Text><Text style={styles.radioActionText}>{tr("Play once", "مرة واحدة")}</Text></Pressable><Pressable onPress={() => playSurah(radioSurah, true)} style={styles.radioAction}><Text style={styles.radioActionIcon}>🔁</Text><Text style={styles.radioActionText}>{tr("Loop", "تكرار")}</Text></Pressable><Pressable onPress={() => { if (!radioPlaylist.includes(radioSurah)) persistPlaylist([...radioPlaylist, radioSurah]); }} style={styles.radioAction}><Text style={styles.radioActionIcon}>＋</Text><Text style={styles.radioActionText}>{tr("Playlist", "أضف للقائمة")}</Text></Pressable></View></View>`,
    `<View style={styles.radioCard}><Text style={styles.radioCardTitle}>{tr("Play one Surah", "تشغيل سورة")}</Text><Text style={styles.radioCardHint}>{tr("Play once, loop it, or add it to your playlist.", "شغّلها مرة أو كررها أو أضفها إلى قائمة التشغيل.")}</Text>{surahStepper(radioSurah, setRadioSurah)}<View style={styles.radioActionRow}><Pressable onPress={() => playSurah(radioSurah, false)} style={styles.radioAction}><View style={styles.audioIconCircle}><Text style={styles.audioIconGlyph}>▶</Text></View><Text style={styles.radioActionText}>{tr("Play once", "مرة واحدة")}</Text></Pressable><Pressable onPress={() => playSurah(radioSurah, true)} style={styles.radioAction}><View style={styles.audioIconCircle}><Text style={styles.audioIconGlyph}>↻</Text></View><Text style={styles.radioActionText}>{tr("Loop", "تكرار")}</Text></Pressable><Pressable onPress={() => { if (!radioPlaylist.includes(radioSurah)) persistPlaylist([...radioPlaylist, radioSurah]); }} style={styles.radioAction}><View style={styles.audioIconCircle}><Text style={styles.audioIconGlyph}>＋</Text></View><Text style={styles.radioActionText}>{tr("Playlist", "أضف للقائمة")}</Text></Pressable></View></View>`
  ],
  [
    "playlist title",
    `<Text style={styles.radioCardTitle}>🎶 {tr("My playlist", "قائمة التشغيل")}</Text>`,
    `<Text style={styles.radioCardTitle}>{tr("My playlist", "قائمة التشغيل")}</Text>`
  ],
  [
    "playlist buttons",
    `<Text style={styles.radioPrimaryText}>▶️ {tr("Play playlist", "تشغيل القائمة")}</Text>`,
    `<Text style={styles.radioPrimaryText}>▶  {tr("Play playlist", "تشغيل القائمة")}</Text>`
  ],
  [
    "playlist loop button",
    `<Text style={styles.radioSecondaryText}>🔁 {tr("Loop playlist", "تكرار القائمة")}</Text>`,
    `<Text style={styles.radioSecondaryText}>↻  {tr("Loop playlist", "تكرار القائمة")}</Text>`
  ],
  [
    "continuous title",
    `<Text style={styles.radioCardTitle}>🌙 {tr("Continuous Qur’an", "القرآن المتواصل")}</Text>`,
    `<Text style={styles.radioCardTitle}>{tr("Continuous Qur’an", "القرآن المتواصل")}</Text>`
  ],
  [
    "continuous start button",
    `<Text style={styles.radioPrimaryText}>▶️ {tr("Start listening", "ابدأ الاستماع")}</Text>`,
    `<Text style={styles.radioPrimaryText}>▶  {tr("Start listening", "ابدأ الاستماع")}</Text>`
  ],
  [
    "continuous loop button",
    `<Text style={styles.radioSecondaryText}>🔁 {tr("Loop range", "تكرار النطاق")}</Text>`,
    `<Text style={styles.radioSecondaryText}>↻  {tr("Loop range", "تكرار النطاق")}</Text>`
  ],
  [
    "surah frame",
    `{beginsSurah ? <View style={styles.surahFrame}><Text style={styles.surahFrameText}>۞ {segmentSurah?.nameArabic} ۞</Text></View> : null}`,
    `{beginsSurah ? <View style={styles.surahFrame}><Text style={styles.surahFrameOrnament}>۞</Text><View style={styles.surahFrameCenter}><Text style={styles.surahFrameKicker}>سُورَةُ</Text><Text style={styles.surahFrameText}>{segmentSurah?.nameArabic}</Text></View><Text style={styles.surahFrameOrnament}>۞</Text></View> : null}`
  ],
  [
    "study play icon",
    `<Pressable onPress={() => playAyah(ayah)} style={styles.smallPlay}><Text>▶️</Text></Pressable>`,
    `<Pressable onPress={() => playAyah(ayah)} style={styles.smallPlay}><Text style={styles.smallPlayGlyph}>▶</Text></Pressable>`
  ],
  [
    "ayah action icons",
    `<Pressable onPress={() => playAyah(selectedAyah)} style={styles.actionButton}><Text style={styles.actionIcon}>▶️</Text><Text style={styles.actionLabel}>{tr("Play", "تشغيل")}</Text></Pressable><Pressable onPress={() => playAyah(selectedAyah, true)} style={styles.actionButton}><Text style={styles.actionIcon}>🔁</Text><Text style={styles.actionLabel}>{tr("Repeat", "تكرار")}</Text></Pressable><Pressable onPress={() => toggleBookmark(selectedAyah)} style={styles.actionButton}><Text style={styles.actionIcon}>🔖</Text><Text style={styles.actionLabel}>{tr("Save", "حفظ")}</Text></Pressable><Pressable onPress={() => startMemorizing(selectedAyah)} style={styles.actionButton}><Text style={styles.actionIcon}>📿</Text><Text style={styles.actionLabel}>{tr("Memorize", "حفظ")}</Text></Pressable>`,
    `<Pressable onPress={() => playAyah(selectedAyah)} style={styles.actionButton}><View style={styles.actionIconCircle}><Text style={styles.actionIconGlyph}>▶</Text></View><Text style={styles.actionLabel}>{tr("Play", "تشغيل")}</Text></Pressable><Pressable onPress={() => playAyah(selectedAyah, true)} style={styles.actionButton}><View style={styles.actionIconCircle}><Text style={styles.actionIconGlyph}>↻</Text></View><Text style={styles.actionLabel}>{tr("Repeat", "تكرار")}</Text></Pressable><Pressable onPress={() => toggleBookmark(selectedAyah)} style={styles.actionButton}><View style={styles.actionIconCircle}><Text style={styles.actionIconGlyph}>⌑</Text></View><Text style={styles.actionLabel}>{tr("Save", "حفظ")}</Text></Pressable><Pressable onPress={() => startMemorizing(selectedAyah)} style={styles.actionButton}><View style={styles.actionIconCircle}><Text style={styles.actionIconGlyph}>✦</Text></View><Text style={styles.actionLabel}>{tr("Memorize", "حفظ")}</Text></Pressable>`
  ],
  [
    "menu transport",
    `{activeAyah ? <View style={styles.transport}><Pressable onPress={() => QuranAudio?.seekBy(-10000)} style={styles.transportButton}><Text>↩ 10</Text></Pressable><Pressable onPress={() => audioStatus.state === "playing" ? QuranAudio?.pause() : QuranAudio?.resume()} style={styles.transportMain}><Text>{audioStatus.state === "playing" ? "⏸" : "▶"}</Text></Pressable><Pressable onPress={() => QuranAudio?.seekBy(10000)} style={styles.transportButton}><Text>10 ↪</Text></Pressable><Pressable onPress={stopAudio} style={styles.transportButton}><Text>⏹</Text></Pressable></View> : null}`,
    `{activeAyah ? <View style={styles.transport}><Pressable onPress={() => QuranAudio?.seekBy(-10000)} style={styles.transportButton}><Text style={styles.transportText}>−10</Text></Pressable><Pressable onPress={() => audioStatus.state === "playing" ? QuranAudio?.pause() : QuranAudio?.resume()} style={styles.transportMain}><Text style={styles.transportMainText}>{audioStatus.state === "playing" ? "Ⅱ" : "▶"}</Text></Pressable><Pressable onPress={() => QuranAudio?.seekBy(10000)} style={styles.transportButton}><Text style={styles.transportText}>+10</Text></Pressable><Pressable onPress={stopAudio} style={styles.transportButton}><Text style={styles.transportStopText}>■</Text></Pressable></View> : null}`
  ],
  [
    "light night controls",
    `<View style={styles.readerModeRow}><Pressable onPress={() => persistAudioPrefs({ readerMode: "mushaf" })}`,
    `<View style={styles.themeModeRow}><Pressable onPress={() => setAppearance((current) => ({ ...current, pageTheme: current.pageTheme === "dark" ? "paper" : current.pageTheme }))} style={[styles.themeModeButton, !nightMode && styles.themeModeButtonActive]}><Text style={[styles.themeModeText, !nightMode && styles.themeModeTextActive]}>☀  {tr("Light", "نهاري")}</Text></Pressable><Pressable onPress={() => setAppearance((current) => ({ ...current, pageTheme: "dark" }))} style={[styles.themeModeButton, nightMode && styles.themeModeButtonActive]}><Text style={[styles.themeModeText, nightMode && styles.themeModeTextActive]}>☾  {tr("Night", "ليلي")}</Text></Pressable></View><View style={styles.readerModeRow}><Pressable onPress={() => persistAudioPrefs({ readerMode: "mushaf" })}`
  ],
  [
    "root night",
    `<View style={styles.flex}>\n      {body}`,
    `<View style={[styles.flex, nightMode && styles.nightRoot]}>\n      {body}`
  ],
  [
    "style top bar night",
    `  topBar: { minHeight: 67, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12, paddingVertical: 9, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#e7e2d8" },`,
    `  topBar: { minHeight: 67, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12, paddingVertical: 9, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#e7e2d8" },\n  topBarNight: { backgroundColor: "#151a18", borderBottomColor: "#2b332f" },\n  nightRoot: { backgroundColor: "#111513" },\n  textNight: { color: "#f2efe7" },\n  mutedNight: { color: "#aab4af" },\n  iconButtonNight: { backgroundColor: "#1c221f", borderColor: "#35403a" },\n  topMenuButtonNight: { backgroundColor: "#18382f" },`
  ],
  [
    "audio control styles",
    `  radioActionRow: { flexDirection: "row", gap: 7, marginTop: 11 }, radioAction: { flex: 1, minHeight: 66, borderRadius: 16, backgroundColor: "#edf5f1", alignItems: "center", justifyContent: "center", padding: 6 }, radioActionIcon: { fontSize: 18 }, radioActionText: { color: "#31564b", fontSize: 8, fontWeight: "900", textAlign: "center", marginTop: 3 },`,
    `  radioActionRow: { flexDirection: "row", gap: 9, marginTop: 12 }, radioAction: { flex: 1, minHeight: 76, borderRadius: 20, backgroundColor: "#f7f8f5", borderWidth: 1, borderColor: "#dfe8e3", alignItems: "center", justifyContent: "center", padding: 7 }, audioIconCircle: { width: 35, height: 35, borderRadius: 18, backgroundColor: "#0b654f", alignItems: "center", justifyContent: "center" }, audioIconGlyph: { color: "#fff", fontSize: 17, fontWeight: "900" }, radioActionText: { color: "#234a3f", fontSize: 8, fontWeight: "900", textAlign: "center", marginTop: 6 },`
  ],
  [
    "surah frame styles",
    `  readerBody: { flex: 1, backgroundColor: "#e9e5dc" }, bookCanvas: { padding: 8, paddingBottom: 12 }, bookCanvasSpread: { flexGrow: 1, justifyContent: "center" }, bookSpread: { flexDirection: "row", alignItems: "stretch", justifyContent: "center", gap: 0 }, bookPageSlot: { flex: 1, minWidth: 0 }, blankBookPage: { backgroundColor: "#e0d9ca", borderRadius: 14, opacity: .55, margin: 3 }, bookGutter: { width: 12, backgroundColor: "#d2cab9", borderLeftWidth: 1, borderRightWidth: 1, borderColor: "#c4bba8" }, mushafPage: { minHeight: 650, borderRadius: 13, borderWidth: 1, borderColor: "#d8d0c0", paddingHorizontal: 14, paddingTop: 11, paddingBottom: 12, shadowColor: "#342d23", shadowOpacity: .08, shadowRadius: 5, shadowOffset: { width: 0, height: 2 }, elevation: 2 }, pageTopLine: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 24, borderBottomWidth: 1, borderBottomColor: "#e2dbc9", marginBottom: 8 }, pageMeta: { color: "#70736e", fontSize: 8, fontWeight: "800" }, surahFrame: { minHeight: 40, alignItems: "center", justifyContent: "center", borderTopWidth: 1, borderBottomWidth: 1, borderColor: "#a89362", marginVertical: 8, backgroundColor: "rgba(193,170,115,.08)" }, surahFrameText: { color: "#20493e", fontSize: 19, fontWeight: "900", writingDirection: "rtl" }, basmala: { textAlign: "center", writingDirection: "rtl", marginVertical: 7 },`,
    `  readerBody: { flex: 1, backgroundColor: "#e9e5dc" }, bookCanvas: { padding: 8, paddingBottom: 12 }, bookCanvasSpread: { flexGrow: 1, justifyContent: "center" }, bookSpread: { flexDirection: "row", alignItems: "stretch", justifyContent: "center", gap: 0 }, bookPageSlot: { flex: 1, minWidth: 0 }, blankBookPage: { backgroundColor: "#e0d9ca", borderRadius: 14, opacity: .55, margin: 3 }, bookGutter: { width: 12, backgroundColor: "#d2cab9", borderLeftWidth: 1, borderRightWidth: 1, borderColor: "#c4bba8" }, mushafPage: { minHeight: 650, borderRadius: 13, borderWidth: 1, borderColor: "#d8d0c0", paddingHorizontal: 14, paddingTop: 11, paddingBottom: 12, shadowColor: "#342d23", shadowOpacity: .08, shadowRadius: 5, shadowOffset: { width: 0, height: 2 }, elevation: 2 }, pageTopLine: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 24, borderBottomWidth: 1, borderBottomColor: "#e2dbc9", marginBottom: 8 }, pageMeta: { color: "#70736e", fontSize: 8, fontWeight: "800" }, surahFrame: { minHeight: 68, flexDirection: "row", alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "#16735d", marginVertical: 12, paddingHorizontal: 13, backgroundColor: "rgba(21,112,88,.035)", shadowColor: "#8b733c", shadowOpacity: .08, shadowRadius: 3, shadowOffset: { width: 0, height: 1 } }, surahFrameCenter: { flex: 1, alignItems: "center", justifyContent: "center" }, surahFrameKicker: { color: "#98783b", fontSize: 8, fontWeight: "900", letterSpacing: 1.2, marginBottom: 1, writingDirection: "rtl" }, surahFrameText: { color: "#164f41", fontSize: 27, lineHeight: 36, fontFamily: "serif", fontWeight: "700", writingDirection: "rtl", textAlign: "center" }, surahFrameOrnament: { color: "#168469", fontSize: 24, paddingHorizontal: 6 }, basmala: { textAlign: "center", writingDirection: "rtl", marginVertical: 10 },`
  ],
  [
    "theme mode styles",
    `  readerModeRow: { flexDirection: "row", gap: 7, marginTop: 12 },`,
    `  themeModeRow: { flexDirection: "row", gap: 8, marginTop: 12 }, themeModeButton: { flex: 1, minHeight: 43, borderRadius: 14, borderWidth: 1, borderColor: "#dfe4e1", backgroundColor: "#f7f8f6", alignItems: "center", justifyContent: "center" }, themeModeButtonActive: { backgroundColor: "#0b654f", borderColor: "#0b654f" }, themeModeText: { color: "#4e625b", fontSize: 9, fontWeight: "900" }, themeModeTextActive: { color: "#fff" },\n  readerModeRow: { flexDirection: "row", gap: 7, marginTop: 12 },`
  ],
  [
    "player and action style extras",
    `  disabled: { opacity: .35 },`,
    `  playerGlyph: { color: "#0b654f", fontSize: 16, fontWeight: "900" }, playerMainGlyph: { color: "#fff", fontSize: 16, fontWeight: "900" }, smallPlayGlyph: { color: "#fff", fontSize: 13, fontWeight: "900" }, actionIconCircle: { width: 34, height: 34, borderRadius: 17, backgroundColor: "#0b654f", alignItems: "center", justifyContent: "center" }, actionIconGlyph: { color: "#fff", fontSize: 15, fontWeight: "900" }, transportText: { color: "#31564b", fontSize: 10, fontWeight: "900" }, transportMainText: { color: "#fff", fontSize: 16, fontWeight: "900" }, transportStopText: { color: "#7e544e", fontSize: 13, fontWeight: "900" },\n  disabled: { opacity: .35 },`
  ]
]);

patchFile("mobile/src/quran/quranRendering.tsx", [
  [
    "green qcf ayah end glyph",
    `          if ((appearance.font === "qcf-v1" || appearance.font === "qcf-v2") && raw) {\n            return (\n              <Text key={key} onPress={() => onPressAyah(ayah)} style={[highlightStyle, { fontFamily, color: effectiveColor }]}>\n                {decodeNumericEntities(raw)}{" "}\n              </Text>\n            );\n          }`,
    `          if ((appearance.font === "qcf-v1" || appearance.font === "qcf-v2") && raw) {\n            const decoded = decodeNumericEntities(raw);\n            const trailing = decoded.match(/\\s*$/)?.[0] ?? "";\n            const core = decoded.slice(0, decoded.length - trailing.length);\n            const verseGlyph = core.slice(-1);\n            const verseText = core.slice(0, -1);\n            return (\n              <Text key={key} onPress={() => onPressAyah(ayah)} style={[highlightStyle, { fontFamily, color: effectiveColor }]}>\n                {verseText}<Text style={{ color: "#0b8b69", fontFamily }}>{verseGlyph}</Text>{trailing || " "}\n              </Text>\n            );\n          }`
  ]
]);

console.log("Applied Quran v0.3.7 visual refinements.");