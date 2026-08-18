from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
QURAN = ROOT / "mobile/src/quran/QuranV3.tsx"
CONFIG = ROOT / "mobile/app.config.ts"
PROVIDER = ROOT / "mobile/modules/hassoun-widget/android/src/main/java/ca/wopt/hassounwidget/HassounPrayerWidgetProvider.kt"
HOME_INFO = ROOT / "mobile/modules/hassoun-widget/android/src/main/res/xml/hassoun_prayer_widget_info.xml"
LOCK_INFO = ROOT / "mobile/modules/hassoun-widget/android/src/main/res/xml/hassoun_lock_widget_info.xml"


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if new in text:
        return text
    if old not in text:
        raise SystemExit(f"Could not find {label}")
    return text.replace(old, new, 1)


# -----------------------------------------------------------------------------
# Qur'an reader: Play always belongs to the page/spread actually on screen.
# -----------------------------------------------------------------------------
text = QURAN.read_text()
text = replace_once(
    text,
    '''  const selectedIsBookmarked = Boolean(selectedAyah && bookmarks.includes(refKey(selectedAyah)));
  const autoSpread = width >= 700;
  const spreadMode = appearance.bookMode === "spread" || (appearance.bookMode === "auto" && autoSpread);
''',
    '''  const selectedIsBookmarked = Boolean(selectedAyah && bookmarks.includes(refKey(selectedAyah)));
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
''',
    "reader visible page state",
)
text = replace_once(
    text,
    '''  const playAyah = (ayah: QuranAyah, repeat = false) => playQueue([ayah], repeat);
  const playSurah = (surah: number, repeat = false) => playQueue(getSurahAyahs(surah), repeat);

  const toggleSelectedPlayback = (ayah: QuranAyah) => {
''',
    '''  const playAyah = (ayah: QuranAyah, repeat = false) => playQueue([ayah], repeat);
  const playSurah = (surah: number, repeat = false) => playQueue(getSurahAyahs(surah), repeat);
  const playVisibleReaderPages = (repeat = false) => {
    const queue = visibleReaderPages.flatMap((page) => pageAyahsFor(page, pages));
    playQueue(queue, repeat);
  };

  const toggleSelectedPlayback = (ayah: QuranAyah) => {
''',
    "visible page playback helper",
)
text = replace_once(
    text,
    '''  const togglePlayerPlayback = () => {
    if (audioStatus.state === "playing") { QuranAudio?.pause(); return; }
    if (audioStatus.state === "paused" || audioStatus.state === "completed") { QuranAudio?.resume(); return; }
    if (!activeAyah) { playSurah(position.surah, false); return; }
    QuranAudio?.resume();
  };
''',
    '''  const togglePlayerPlayback = () => {
    if (screen === "reader") {
      // Never resume unrelated audio from a different page. The reader player
      // always starts/controls the exact Mushaf page (or spread) now visible.
      if (!activeAyahOnVisiblePage) {
        playVisibleReaderPages(false);
        return;
      }
      if (audioStatus.state === "playing") { QuranAudio?.pause(); return; }
      if (audioStatus.state === "paused") { QuranAudio?.resume(); return; }
      playVisibleReaderPages(false);
      return;
    }
    if (audioStatus.state === "playing") { QuranAudio?.pause(); return; }
    if (audioStatus.state === "paused") { QuranAudio?.resume(); return; }
    if (!activeAyah) { playSurah(position.surah, false); return; }
    QuranAudio?.resume();
  };
''',
    "reader player toggle",
)
text = replace_once(
    text,
    '''  const miniPlayer = playerAyah ? (
    <View style={styles.miniPlayer}>
      <Pressable disabled={!activeAyah} onPress={() => QuranAudio?.seekBy(-10000)} style={[styles.playerControl, !activeAyah && styles.playerControlDisabled]}><Text style={styles.playerControlText}>−10</Text></Pressable>
      <Pressable onPress={togglePlayerPlayback} style={styles.playerMain}><Text style={styles.playerMainText}>{audioStatus.state === "playing" ? "Ⅱ" : "▶"}</Text></Pressable>
      <Pressable disabled={!activeAyah} onPress={() => QuranAudio?.seekBy(10000)} style={[styles.playerControl, !activeAyah && styles.playerControlDisabled]}><Text style={styles.playerControlText}>+10</Text></Pressable>
      <Pressable onPress={() => updateSpeed(audioPrefs.speed >= 2 ? 0.5 : audioPrefs.speed + 0.1)} style={styles.playerSpeedPill}><Text style={styles.playerSpeedText}>{audioPrefs.speed.toFixed(1)}×</Text></Pressable>
    </View>
  ) : null;
''',
    '''  const miniPlayer = playerAyah ? (
    <View style={styles.miniPlayer}>
      <Pressable disabled={!activeAyahOnVisiblePage} onPress={() => QuranAudio?.seekBy(-10000)} style={[styles.playerControl, !activeAyahOnVisiblePage && styles.playerControlDisabled]}><Text style={styles.playerControlText}>−10</Text></Pressable>
      <Pressable onPress={togglePlayerPlayback} style={styles.playerMain}><Text style={styles.playerMainText}>{audioStatus.state === "playing" && activeAyahOnVisiblePage ? "Ⅱ" : "▶"}</Text></Pressable>
      <Pressable disabled={!activeAyahOnVisiblePage} onPress={() => QuranAudio?.seekBy(10000)} style={[styles.playerControl, !activeAyahOnVisiblePage && styles.playerControlDisabled]}><Text style={styles.playerControlText}>+10</Text></Pressable>
      <Pressable onPress={() => updateSpeed(audioPrefs.speed >= 2 ? 0.5 : audioPrefs.speed + 0.1)} style={styles.playerSpeedPill}><Text style={styles.playerSpeedText}>{audioPrefs.speed.toFixed(1)}×</Text></Pressable>
    </View>
  ) : null;
''',
    "mini player visible-page ownership",
)
QURAN.write_text(text)

# -----------------------------------------------------------------------------
# Samsung/Home/Lock widgets.
# -----------------------------------------------------------------------------
provider = PROVIDER.read_text()
provider = replace_once(
    provider,
    '''      val views = RemoteViews(
        context.packageName,
        if (isLockScreen) R.layout.hassoun_prayer_widget_lockscreen
        else when (layout) {
          "vertical" -> R.layout.hassoun_prayer_widget_vertical
          "square" -> R.layout.hassoun_prayer_widget_square
          "slim", "compact", "next" -> R.layout.hassoun_prayer_widget_slim
          else -> R.layout.hassoun_prayer_widget
        }
      )
''',
    '''      val minWidth = widgetOptions.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 0)
      val minHeight = widgetOptions.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, 0)
      val resolvedLayout = when {
        isLockScreen -> R.layout.hassoun_prayer_widget_lockscreen
        layout == "vertical" && (minHeight == 0 || minHeight >= 180) -> R.layout.hassoun_prayer_widget_vertical
        layout == "square" && (minHeight == 0 || minHeight >= 110) -> R.layout.hassoun_prayer_widget_square
        layout in setOf("slim", "compact", "next") -> R.layout.hassoun_prayer_widget_slim
        // If Samsung reports a short host area, prefer the safe slim layout
        // rather than asking RemoteViews to inflate a card too tall to host.
        minHeight in 1..109 -> R.layout.hassoun_prayer_widget_slim
        else -> R.layout.hassoun_prayer_widget
      }
      val views = RemoteViews(context.packageName, resolvedLayout)
''',
    "safe widget layout resolver",
)
provider = replace_once(
    provider,
    '''      val lock = ComponentName(context, HassounLockScreenWidgetProvider::class.java)
      manager.getAppWidgetIds(lock).forEach { updateWidget(context, manager, it, true) }
''',
    '''      val lock = ComponentName(context, HassounLockScreenWidgetProvider::class.java)
      // Detect the host category instead of forcing transparency. This repairs
      // old lock-provider instances that Samsung previously allowed on Home.
      manager.getAppWidgetIds(lock).forEach { updateWidget(context, manager, it, false) }
''',
    "lock widget host detection in updateAll",
)
provider = replace_once(
    provider,
    '''    fun updateTransparentWidget(context: Context, manager: AppWidgetManager, appWidgetId: Int) {
      updateWidget(context, manager, appWidgetId, true)
    }
''',
    '''    fun updateTransparentWidget(context: Context, manager: AppWidgetManager, appWidgetId: Int) {
      // True keyguard hosts still become transparent via OPTION_APPWIDGET_HOST_CATEGORY.
      // A stale Home-screen instance becomes a normal themed Hassoun card.
      updateWidget(context, manager, appWidgetId, false)
    }
''',
    "lock-aware transparent updater",
)
PROVIDER.write_text(provider)

home_info = HOME_INFO.read_text()
home_info = home_info.replace('android:minWidth="180dp"', 'android:minWidth="110dp"')
home_info = home_info.replace('android:minHeight="90dp"', 'android:minHeight="60dp"')
home_info = home_info.replace('android:minResizeWidth="140dp"', 'android:minResizeWidth="110dp"')
home_info = home_info.replace('android:minResizeHeight="72dp"', 'android:minResizeHeight="60dp"')
home_info = home_info.replace('android:initialLayout="@layout/hassoun_prayer_widget"', 'android:initialLayout="@layout/hassoun_prayer_widget_slim"')
if 'android:previewLayout=' not in home_info:
    home_info = home_info.replace('android:initialLayout="@layout/hassoun_prayer_widget_slim"', 'android:initialLayout="@layout/hassoun_prayer_widget_slim"\n  android:previewLayout="@layout/hassoun_prayer_widget"')
HOME_INFO.write_text(home_info)

lock_info = LOCK_INFO.read_text()
lock_info = lock_info.replace('android:widgetCategory="home_screen"', 'android:widgetCategory="keyguard"')
LOCK_INFO.write_text(lock_info)

# v0.5.8 / Android versionCode 30.
config = CONFIG.read_text()
if 'version: "0.5.7"' in config:
    config = config.replace('version: "0.5.7"', 'version: "0.5.8"', 1)
if 'versionCode: 29' in config:
    config = config.replace('versionCode: 29', 'versionCode: 30', 1)
CONFIG.write_text(config)

print("Applied v0.5.8: visible-page Quran playback + Samsung/Home/Lock widget fixes.")
