from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
QURAN = ROOT / "mobile/src/quran/QuranV3.tsx"
CONFIG = ROOT / "mobile/app.config.ts"

text = QURAN.read_text()

old = '''  const selectedIsBookmarked = Boolean(selectedAyah && bookmarks.includes(refKey(selectedAyah)));
  const autoSpread = width >= 700;
  const spreadMode = appearance.bookMode === "spread" || (appearance.bookMode === "auto" && autoSpread);
'''
new = '''  const selectedIsBookmarked = Boolean(selectedAyah && bookmarks.includes(refKey(selectedAyah)));
  const autoSpread = width >= 700;
  const spreadMode = appearance.bookMode === "spread" || (appearance.bookMode === "auto" && autoSpread);
  const visibleReaderPages = (() => {
    if (!spreadMode) return [currentPage];
    const left = currentPage === 1 ? 1 : currentPage % 2 === 0 ? currentPage : currentPage - 1;
    return left >= 604 ? [604] : [left, left + 1];
  })();
  const activeAyahOnVisiblePage = Boolean(
    activeAyah && visibleReaderPages.includes(pageForAyah(activeAyah.surah, activeAyah.ayah) ?? -1)
  );
'''
if old not in text:
    raise SystemExit("Could not find reader state insertion point")
text = text.replace(old, new, 1)

old = '''  const playAyah = (ayah: QuranAyah, repeat = false) => playQueue([ayah], repeat);
  const playSurah = (surah: number, repeat = false) => playQueue(getSurahAyahs(surah), repeat);

  const toggleSelectedPlayback = (ayah: QuranAyah) => {
'''
new = '''  const playAyah = (ayah: QuranAyah, repeat = false) => playQueue([ayah], repeat);
  const playSurah = (surah: number, repeat = false) => playQueue(getSurahAyahs(surah), repeat);
  const playVisibleReaderPages = (repeat = false) => {
    const queue = visibleReaderPages.flatMap((page) => pageAyahsFor(page, pages));
    playQueue(queue, repeat);
  };

  const toggleSelectedPlayback = (ayah: QuranAyah) => {
'''
if old not in text:
    raise SystemExit("Could not find page playback helper insertion point")
text = text.replace(old, new, 1)

old = '''  const togglePlayerPlayback = () => {
    if (audioStatus.state === "playing") { QuranAudio?.pause(); return; }
    if (audioStatus.state === "paused" || audioStatus.state === "completed") { QuranAudio?.resume(); return; }
    if (!activeAyah) { playSurah(position.surah, false); return; }
    QuranAudio?.resume();
  };
'''
new = '''  const togglePlayerPlayback = () => {
    if (screen === "reader") {
      // Reader playback always belongs to what is visible now. If the native
      // session is playing/paused on another page, replace it with the current
      // page (or current two-page spread) instead of resuming unrelated audio.
      if (!activeAyahOnVisiblePage) {
        playVisibleReaderPages(false);
        return;
      }
      if (audioStatus.state === "playing") { QuranAudio?.pause(); return; }
      if (audioStatus.state === "paused") { QuranAudio?.resume(); return; }
      // A completed visible-page queue should replay that page from its first ayah.
      playVisibleReaderPages(false);
      return;
    }
    if (audioStatus.state === "playing") { QuranAudio?.pause(); return; }
    if (audioStatus.state === "paused") { QuranAudio?.resume(); return; }
    if (!activeAyah) { playSurah(position.surah, false); return; }
    QuranAudio?.resume();
  };
'''
if old not in text:
    raise SystemExit("Could not find togglePlayerPlayback")
text = text.replace(old, new, 1)

old = '''  const miniPlayer = playerAyah ? (
    <View style={styles.miniPlayer}>
      <Pressable disabled={!activeAyah} onPress={() => QuranAudio?.seekBy(-10000)} style={[styles.playerControl, !activeAyah && styles.playerControlDisabled]}><Text style={styles.playerControlText}>−10</Text></Pressable>
      <Pressable onPress={togglePlayerPlayback} style={styles.playerMain}><Text style={styles.playerMainText}>{audioStatus.state === "playing" ? "Ⅱ" : "▶"}</Text></Pressable>
      <Pressable disabled={!activeAyah} onPress={() => QuranAudio?.seekBy(10000)} style={[styles.playerControl, !activeAyah && styles.playerControlDisabled]}><Text style={styles.playerControlText}>+10</Text></Pressable>
      <Pressable onPress={() => updateSpeed(audioPrefs.speed >= 2 ? 0.5 : audioPrefs.speed + 0.1)} style={styles.playerSpeedPill}><Text style={styles.playerSpeedText}>{audioPrefs.speed.toFixed(1)}×</Text></Pressable>
    </View>
  ) : null;
'''
new = '''  const miniPlayer = playerAyah ? (
    <View style={styles.miniPlayer}>
      <Pressable disabled={!activeAyahOnVisiblePage} onPress={() => QuranAudio?.seekBy(-10000)} style={[styles.playerControl, !activeAyahOnVisiblePage && styles.playerControlDisabled]}><Text style={styles.playerControlText}>−10</Text></Pressable>
      <Pressable onPress={togglePlayerPlayback} style={styles.playerMain}><Text style={styles.playerMainText}>{audioStatus.state === "playing" && activeAyahOnVisiblePage ? "Ⅱ" : "▶"}</Text></Pressable>
      <Pressable disabled={!activeAyahOnVisiblePage} onPress={() => QuranAudio?.seekBy(10000)} style={[styles.playerControl, !activeAyahOnVisiblePage && styles.playerControlDisabled]}><Text style={styles.playerControlText}>+10</Text></Pressable>
      <Pressable onPress={() => updateSpeed(audioPrefs.speed >= 2 ? 0.5 : audioPrefs.speed + 0.1)} style={styles.playerSpeedPill}><Text style={styles.playerSpeedText}>{audioPrefs.speed.toFixed(1)}×</Text></Pressable>
    </View>
  ) : null;
'''
if old not in text:
    raise SystemExit("Could not find miniPlayer block")
text = text.replace(old, new, 1)

QURAN.write_text(text)

config = CONFIG.read_text()
config = config.replace('version: "0.5.7"', 'version: "0.5.8"', 1)
config = config.replace('versionCode: 29', 'versionCode: 30', 1)
CONFIG.write_text(config)

print("Applied v0.5.8: reader Play now starts from visible Mushaf page/spread.")
