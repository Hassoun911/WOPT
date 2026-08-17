from pathlib import Path

path = Path('mobile/App.tsx')
text = path.read_text()

text = text.replace(
  'import HassounWidget from "./modules/hassoun-widget";\n',
  'import HassounWidget from "./modules/hassoun-widget";\nimport QuranAudio, { type QuranAudioStatus } from "./modules/quran-audio";\n',
  1
)

text = text.replace(
  '  const [quranAppNavVisible, setQuranAppNavVisible] = useState(true);\n',
  '  const [quranAppNavVisible, setQuranAppNavVisible] = useState(true);\n  const [globalQuranAudio, setGlobalQuranAudio] = useState<QuranAudioStatus>({ available: Boolean(QuranAudio), state: "idle", positionMs: 0, durationMs: 0, speed: 1 });\n',
  1
)

anchor = '''  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
'''
idx = text.index(anchor)
# insert polling effect before AppState effect
poll_effect = '''  useEffect(() => {
    const sync = () => {
      if (!QuranAudio) return;
      setGlobalQuranAudio(QuranAudio.getStatus());
    };
    sync();
    const timer = setInterval(sync, 700);
    return () => clearInterval(timer);
  }, []);

'''
text = text[:idx] + poll_effect + text[idx:]

render_anchor = '''      <View style={styles.flex}>{body}</View>
      {(activeTab !== "quran" || quranAppNavVisible) ? (
'''
render_replacement = '''      <View style={styles.flex}>{body}</View>
      {globalQuranAudio.state !== "idle" && globalQuranAudio.state !== "error" ? (
        <View style={styles.globalAudioBar}>
          <View style={styles.globalAudioCopy}>
            <Text style={styles.globalAudioEyebrow}>{locale === "ar" ? "تشغيل القرآن" : "QUR’AN AUDIO"}</Text>
            <Text numberOfLines={1} style={styles.globalAudioTitle}>{globalQuranAudio.title || (locale === "ar" ? "القرآن الكريم" : "Qur’an playback")}</Text>
            {globalQuranAudio.subtitle ? <Text numberOfLines={1} style={styles.globalAudioMeta}>{globalQuranAudio.subtitle}</Text> : null}
          </View>
          <Pressable onPress={() => QuranAudio?.previous()} style={styles.globalAudioButton}><Text style={styles.globalAudioButtonText}>‹</Text></Pressable>
          <Pressable
            onPress={() => globalQuranAudio.state === "playing" ? QuranAudio?.pause() : QuranAudio?.resume()}
            style={styles.globalAudioMain}
          >
            <Text style={styles.globalAudioMainText}>{globalQuranAudio.state === "playing" ? "Ⅱ" : "▶"}</Text>
          </Pressable>
          <Pressable onPress={() => QuranAudio?.next()} style={styles.globalAudioButton}><Text style={styles.globalAudioButtonText}>›</Text></Pressable>
          <Pressable onPress={() => QuranAudio?.stop()} style={styles.globalAudioStop}><Text style={styles.globalAudioStopText}>■</Text></Pressable>
        </View>
      ) : null}
      {(activeTab !== "quran" || quranAppNavVisible) ? (
'''
if render_anchor not in text:
    raise SystemExit('render anchor missing')
text = text.replace(render_anchor, render_replacement, 1)

style_anchor = '  bottomNav: { minHeight: 68, flexDirection: "row", alignItems: "center", justifyContent: "space-around", backgroundColor: "#fff", borderTopWidth: 1, borderTopColor: "#e4e1d9", paddingHorizontal: 8, paddingTop: 5 },\n'
style_replacement = '''  globalAudioBar: { minHeight: 62, flexDirection: "row", alignItems: "center", gap: 7, marginHorizontal: 10, marginBottom: 6, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 22, backgroundColor: "#113f35", shadowColor: "#000", shadowOpacity: .18, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 10 },
  globalAudioCopy: { flex: 1, minWidth: 0 },
  globalAudioEyebrow: { color: "#b9d7ce", fontSize: 7, fontWeight: "900", letterSpacing: .8 },
  globalAudioTitle: { color: "#fff", fontSize: 10, fontWeight: "900", marginTop: 2 },
  globalAudioMeta: { color: "#b9d0c8", fontSize: 7, marginTop: 1 },
  globalAudioButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(255,255,255,.09)", alignItems: "center", justifyContent: "center" },
  globalAudioButtonText: { color: "#fff", fontSize: 24, lineHeight: 26, fontWeight: "700" },
  globalAudioMain: { width: 42, height: 42, borderRadius: 21, backgroundColor: "#fff", alignItems: "center", justifyContent: "center" },
  globalAudioMainText: { color: "#0b654f", fontSize: 16, fontWeight: "900" },
  globalAudioStop: { width: 34, height: 34, borderRadius: 17, backgroundColor: "rgba(255,255,255,.09)", alignItems: "center", justifyContent: "center" },
  globalAudioStopText: { color: "#f0d7cf", fontSize: 11, fontWeight: "900" },
  bottomNav: { minHeight: 68, flexDirection: "row", alignItems: "center", justifyContent: "space-around", backgroundColor: "#fff", borderTopWidth: 1, borderTopColor: "#e4e1d9", paddingHorizontal: 8, paddingTop: 5 },
'''
if style_anchor not in text:
    raise SystemExit('style anchor missing')
text = text.replace(style_anchor, style_replacement, 1)

path.write_text(text)
print('Global Quran audio controls integrated')
