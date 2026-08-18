from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def read(path: str) -> str:
    return (ROOT / path).read_text()


def write(path: str, content: str) -> None:
    target = ROOT / path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content)


def replace_once(path: str, old: str, new: str) -> None:
    text = read(path)
    if old not in text:
        raise SystemExit(f"Missing expected block in {path}: {old[:160]!r}")
    write(path, text.replace(old, new, 1))


# TypeScript native-module contract: add compact range playback and expose mode.
replace_once(
    "mobile/modules/quran-audio/index.ts",
    '''  repeat?: boolean;\n};''',
    '''  repeat?: boolean;\n  mode?: "queue" | "range";\n};'''
)
replace_once(
    "mobile/modules/quran-audio/index.ts",
    '''  playQueue(itemsJson: string, startIndex: number, repeat: boolean, speed: number): void;\n  pause(): void;''',
    '''  playQueue(itemsJson: string, startIndex: number, repeat: boolean, speed: number): void;\n  playRange(startAbsolute: number, endAbsolute: number, reciterId: string, bitrate: number, reciterName: string, repeat: boolean, speed: number): void;\n  pause(): void;'''
)

# Expo native bridge: pass only a tiny range descriptor to Android.
replace_once(
    "mobile/modules/quran-audio/android/src/main/java/ca/wopt/quranaudio/QuranAudioModule.kt",
    '''    Function("playQueue") { itemsJson: String, startIndex: Int, repeat: Boolean, requestedSpeed: Double ->\n      QuranAudioService.playQueue(context, itemsJson, startIndex, repeat, requestedSpeed.toFloat())\n    }\n\n    Function("pause") {''',
    '''    Function("playQueue") { itemsJson: String, startIndex: Int, repeat: Boolean, requestedSpeed: Double ->\n      QuranAudioService.playQueue(context, itemsJson, startIndex, repeat, requestedSpeed.toFloat())\n    }\n\n    Function("playRange") { startAbsolute: Int, endAbsolute: Int, reciterId: String, bitrate: Int, reciterName: String, repeat: Boolean, requestedSpeed: Double ->\n      QuranAudioService.playRange(\n        context,\n        startAbsolute,\n        endAbsolute,\n        reciterId,\n        bitrate,\n        reciterName,\n        repeat,\n        requestedSpeed.toFloat()\n      )\n    }\n\n    Function("pause") {'''
)

service = "mobile/modules/quran-audio/android/src/main/java/ca/wopt/quranaudio/QuranAudioService.kt"
replace_once(
    service,
    '''  private var queue: List<QueueItem> = emptyList()\n  private var queueIndex = 0\n  private var repeatQueue = false\n  private var speed = 1.0f\n  private var state = "idle"\n  private var mediaSession: MediaSession? = null\n''',
    '''  private var queue: List<QueueItem> = emptyList()\n  private var queueIndex = 0\n  private var repeatQueue = false\n  private var speed = 1.0f\n  private var state = "idle"\n  private var mediaSession: MediaSession? = null\n\n  // Continuous Qur’an mode is deliberately lazy. Passing 6,000+ ayahs as JSON\n  // through an Android Intent can exceed Binder's transaction limit and crash.\n  // Instead we keep only a compact absolute-ayah range and create the current\n  // URL/title on demand inside this foreground service.\n  private var rangeActive = false\n  private var rangeStartAbsolute = 1\n  private var rangeEndAbsolute = 0\n  private var rangeReciterBase = ""\n  private var rangeReciterName = "Hassoun"\n'''
)
replace_once(
    service,
    '''      ACTION_PLAY_QUEUE -> {\n        queue = parseQueue(intent.getStringExtra(EXTRA_ITEMS).orEmpty())\n        queueIndex = intent.getIntExtra(EXTRA_INDEX, 0).coerceIn(0, (queue.size - 1).coerceAtLeast(0))\n        repeatQueue = intent.getBooleanExtra(EXTRA_REPEAT, false)\n        speed = intent.getFloatExtra(EXTRA_SPEED, 1.0f).coerceIn(0.5f, 2.0f)\n        if (queue.isNotEmpty()) playCurrent() else stopPlayback(true)\n      }\n      ACTION_PAUSE -> pausePlayback()''',
    '''      ACTION_PLAY_QUEUE -> {\n        rangeActive = false\n        rangeEndAbsolute = 0\n        queue = parseQueue(intent.getStringExtra(EXTRA_ITEMS).orEmpty())\n        queueIndex = intent.getIntExtra(EXTRA_INDEX, 0).coerceIn(0, (queue.size - 1).coerceAtLeast(0))\n        repeatQueue = intent.getBooleanExtra(EXTRA_REPEAT, false)\n        speed = intent.getFloatExtra(EXTRA_SPEED, 1.0f).coerceIn(0.5f, 2.0f)\n        if (queue.isNotEmpty()) playCurrent() else stopPlayback(true)\n      }\n      ACTION_PLAY_RANGE -> {\n        queue = emptyList()\n        rangeStartAbsolute = intent.getIntExtra(EXTRA_RANGE_START, 1).coerceAtLeast(1)\n        rangeEndAbsolute = intent.getIntExtra(EXTRA_RANGE_END, rangeStartAbsolute).coerceAtLeast(rangeStartAbsolute)\n        rangeReciterBase = intent.getStringExtra(EXTRA_RECITER_BASE).orEmpty().trimEnd('/')\n        rangeReciterName = intent.getStringExtra(EXTRA_RECITER_NAME).orEmpty().ifBlank { "Hassoun" }\n        rangeActive = rangeReciterBase.isNotBlank() && rangeEndAbsolute >= rangeStartAbsolute\n        queueIndex = 0\n        repeatQueue = intent.getBooleanExtra(EXTRA_REPEAT, false)\n        speed = intent.getFloatExtra(EXTRA_SPEED, 1.0f).coerceIn(0.5f, 2.0f)\n        if (rangeActive) playCurrent() else stopPlayback(true)\n      }\n      ACTION_PAUSE -> pausePlayback()'''
)
replace_once(
    service,
    '''  private fun playCurrent() {\n    val item = queue.getOrNull(queueIndex) ?: run {\n      stopPlayback(true)\n      return\n    }''',
    '''  private fun playCurrent() {\n    val item = currentItem() ?: run {\n      stopPlayback(true)\n      return\n    }'''
)
replace_once(
    service,
    '''      if (queueIndex + 1 < queue.size) {\n        queueIndex += 1\n        playCurrent()\n      } else if (repeatQueue && queue.isNotEmpty()) {\n        queueIndex = 0\n        playCurrent()''',
    '''      if (queueIndex + 1 < currentQueueSize()) {\n        queueIndex += 1\n        playCurrent()\n      } else if (repeatQueue && currentQueueSize() > 0) {\n        queueIndex = 0\n        playCurrent()'''
)
replace_once(
    service,
    '''    if (current == null) {\n      if (queue.isNotEmpty()) playCurrent()\n      return\n    }''',
    '''    if (current == null) {\n      if (currentQueueSize() > 0) playCurrent()\n      return\n    }'''
)
replace_once(
    service,
    '''  private fun skipNext() {\n    if (queue.isEmpty()) return\n    if (queueIndex + 1 < queue.size) queueIndex += 1\n    else if (repeatQueue) queueIndex = 0\n    else return\n    playCurrent()\n  }\n\n  private fun skipPrevious() {\n    if (queue.isEmpty()) return''',
    '''  private fun skipNext() {\n    val size = currentQueueSize()\n    if (size <= 0) return\n    if (queueIndex + 1 < size) queueIndex += 1\n    else if (repeatQueue) queueIndex = 0\n    else return\n    playCurrent()\n  }\n\n  private fun skipPrevious() {\n    if (currentQueueSize() <= 0) return'''
)
replace_once(
    service,
    '''    queue = emptyList()\n    queueIndex = 0\n    repeatQueue = false\n    state = "idle"''',
    '''    queue = emptyList()\n    queueIndex = 0\n    repeatQueue = false\n    rangeActive = false\n    rangeStartAbsolute = 1\n    rangeEndAbsolute = 0\n    rangeReciterBase = ""\n    rangeReciterName = "Hassoun"\n    state = "idle"'''
)
replace_once(
    service,
    '''  private fun publishSnapshot() {\n    val item = queue.getOrNull(queueIndex)''',
    '''  private fun publishSnapshot() {\n    val item = currentItem()'''
)
replace_once(
    service,
    '''      "queueIndex" to queueIndex,\n      "queueSize" to queue.size,\n      "repeat" to repeatQueue\n''',
    '''      "queueIndex" to queueIndex,\n      "queueSize" to currentQueueSize(),\n      "repeat" to repeatQueue,\n      "mode" to if (rangeActive) "range" else "queue"\n'''
)
replace_once(
    service,
    '''    val item = queue.getOrNull(queueIndex)\n    if (item != null) {''',
    '''    val item = currentItem()\n    if (item != null) {'''
)
# There are two queue.getOrNull occurrences after publishSnapshot/updateMediaSession; replace remaining buildNotification one.
text = read(service)
text = text.replace('    val item = queue.getOrNull(queueIndex)\n    val launchIntent = packageManager.getLaunchIntentForPackage(packageName)', '    val item = currentItem()\n    val launchIntent = packageManager.getLaunchIntentForPackage(packageName)', 1)
write(service, text)

# Add lazy range helpers before parseQueue.
replace_once(
    service,
    '''  private fun parseQueue(json: String): List<QueueItem> {''',
    '''  private fun currentQueueSize(): Int = if (rangeActive) {\n    (rangeEndAbsolute - rangeStartAbsolute + 1).coerceAtLeast(0)\n  } else queue.size\n\n  private fun currentItem(): QueueItem? {\n    if (!rangeActive) return queue.getOrNull(queueIndex)\n    val absolute = rangeStartAbsolute + queueIndex\n    if (absolute !in rangeStartAbsolute..rangeEndAbsolute) return null\n    val (surah, ayah) = surahAyahForAbsolute(absolute)\n    return QueueItem(\n      url = "$rangeReciterBase/$absolute.mp3",\n      title = "Surah $surah • Ayah $ayah",\n      subtitle = "$rangeReciterName • Hassoun"\n    )\n  }\n\n  private fun surahAyahForAbsolute(absolute: Int): Pair<Int, Int> {\n    var remaining = absolute.coerceAtLeast(1)\n    AYAH_COUNTS.forEachIndexed { index, count ->\n      if (remaining <= count) return Pair(index + 1, remaining)\n      remaining -= count\n    }\n    return Pair(114, AYAH_COUNTS.last())\n  }\n\n  private fun parseQueue(json: String): List<QueueItem> {'''
)

# Companion constants/status and compact range launcher.
replace_once(
    service,
    '''    private const val ACTION_PLAY_QUEUE = "ca.wopt.quranaudio.PLAY_QUEUE"\n    private const val ACTION_PAUSE =''',
    '''    private const val ACTION_PLAY_QUEUE = "ca.wopt.quranaudio.PLAY_QUEUE"\n    private const val ACTION_PLAY_RANGE = "ca.wopt.quranaudio.PLAY_RANGE"\n    private const val ACTION_PAUSE ='''
)
replace_once(
    service,
    '''    private const val EXTRA_ITEMS = "items"\n    private const val EXTRA_INDEX = "index"\n    private const val EXTRA_REPEAT = "repeat"''',
    '''    private const val EXTRA_ITEMS = "items"\n    private const val EXTRA_INDEX = "index"\n    private const val EXTRA_RANGE_START = "rangeStart"\n    private const val EXTRA_RANGE_END = "rangeEnd"\n    private const val EXTRA_RECITER_BASE = "reciterBase"\n    private const val EXTRA_RECITER_NAME = "reciterName"\n    private const val EXTRA_REPEAT = "repeat"'''
)
replace_once(
    service,
    '''      "queueSize" to 0,\n      "repeat" to false\n    )''',
    '''      "queueSize" to 0,\n      "repeat" to false,\n      "mode" to "queue"\n    )'''
)
replace_once(
    service,
    '''    fun playQueue(context: Context, itemsJson: String, startIndex: Int, repeat: Boolean, speed: Float) {\n      val intent = Intent(context, QuranAudioService::class.java)\n        .setAction(ACTION_PLAY_QUEUE)\n        .putExtra(EXTRA_ITEMS, itemsJson)\n        .putExtra(EXTRA_INDEX, startIndex)\n        .putExtra(EXTRA_REPEAT, repeat)\n        .putExtra(EXTRA_SPEED, speed)\n      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) context.startForegroundService(intent) else context.startService(intent)\n    }\n\n    fun pause(context: Context)''',
    '''    fun playQueue(context: Context, itemsJson: String, startIndex: Int, repeat: Boolean, speed: Float) {\n      val intent = Intent(context, QuranAudioService::class.java)\n        .setAction(ACTION_PLAY_QUEUE)\n        .putExtra(EXTRA_ITEMS, itemsJson)\n        .putExtra(EXTRA_INDEX, startIndex)\n        .putExtra(EXTRA_REPEAT, repeat)\n        .putExtra(EXTRA_SPEED, speed)\n      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) context.startForegroundService(intent) else context.startService(intent)\n    }\n\n    fun playRange(\n      context: Context,\n      startAbsolute: Int,\n      endAbsolute: Int,\n      reciterId: String,\n      bitrate: Int,\n      reciterName: String,\n      repeat: Boolean,\n      speed: Float\n    ) {\n      val base = "https://cdn.islamic.network/quran/audio/${bitrate.coerceAtLeast(32)}/${reciterId.trim()}"\n      val intent = Intent(context, QuranAudioService::class.java)\n        .setAction(ACTION_PLAY_RANGE)\n        .putExtra(EXTRA_RANGE_START, startAbsolute.coerceAtLeast(1))\n        .putExtra(EXTRA_RANGE_END, endAbsolute.coerceAtLeast(startAbsolute))\n        .putExtra(EXTRA_RECITER_BASE, base)\n        .putExtra(EXTRA_RECITER_NAME, reciterName)\n        .putExtra(EXTRA_REPEAT, repeat)\n        .putExtra(EXTRA_SPEED, speed)\n      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) context.startForegroundService(intent) else context.startService(intent)\n    }\n\n    fun pause(context: Context)'''
)
# Put the ayah-count table in companion object before snapshot.
replace_once(
    service,
    '''    @Volatile\n    var snapshot: Map<String, Any?> = mapOf(''',
    '''    private val AYAH_COUNTS = intArrayOf(\n      7,286,200,176,120,165,206,75,129,109,123,111,43,52,99,128,111,110,98,135,112,78,118,64,77,227,93,88,69,60,\n      34,30,73,54,45,83,182,88,75,85,54,53,89,59,37,35,38,29,18,45,60,49,62,55,78,96,29,22,24,13,14,11,11,18,\n      12,12,30,52,52,44,28,28,20,56,40,31,50,40,46,42,29,19,36,25,22,17,19,26,30,20,15,21,11,8,8,19,5,8,8,11,\n      11,8,3,9,5,4,7,3,6,3,5,4,5,6\n    )\n\n    @Volatile\n    var snapshot: Map<String, Any?> = mapOf('''
)

# Quran UI: continuous playback no longer builds/serializes the full Qur'an queue.
replace_once(
    "mobile/src/quran/QuranV3.tsx",
    '''  const playFullQuranRange = (repeat = false) => {\n    const end = radioOngoing ? 114 : Math.max(radioStartSurah, radioEndSurah);\n    playQueue(buildSurahQueue(radioStartSurah, end), repeat);\n  };''',
    '''  const playFullQuranRange = (repeat = false) => {\n    if (!QuranAudio) return;\n    const start = clamp(radioStartSurah, 1, 114);\n    const end = radioOngoing ? 114 : clamp(Math.max(start, radioEndSurah), start, 114);\n    const lastAyahs = getSurahAyahs(end);\n    const lastAyah = lastAyahs[lastAyahs.length - 1];\n    if (!lastAyah) return;\n    const reciter = reciterInfo(audioPrefs.reciter);\n    const startAbsolute = absoluteIndex(start, 1) + 1;\n    const endAbsolute = absoluteIndex(end, lastAyah.ayah) + 1;\n    // Do not build thousands of JS objects or pass a multi-megabyte JSON Intent.\n    // The native foreground service advances this compact absolute-ayah range lazily.\n    setAudioQueue([]);\n    setAudioIndex(-1);\n    setRepeatQueue(repeat);\n    completionRef.current = null;\n    QuranAudio.playRange(startAbsolute, endAbsolute, reciter.id, reciter.bitrate, ar ? reciter.ar : reciter.en, repeat, audioPrefs.speed);\n  };'''
)
replace_once(
    "mobile/src/quran/QuranV3.tsx",
    '''    if (audioStatus.state === "playing") { QuranAudio?.pause(); return; }\n    if (audioStatus.state === "paused") { QuranAudio?.resume(); return; }\n    if (!activeAyah) { playSurah(position.surah, false); return; }\n    QuranAudio?.resume();''',
    '''    if (audioStatus.state === "playing") { QuranAudio?.pause(); return; }\n    if (audioStatus.state === "paused") { QuranAudio?.resume(); return; }\n    if (screen === "radio" && audioStatus.mode === "range") {\n      if (audioStatus.state === "completed") playFullQuranRange(repeatQueue);\n      else QuranAudio?.resume();\n      return;\n    }\n    if (!activeAyah) { playSurah(position.surah, false); return; }\n    QuranAudio?.resume();'''
)

# The old helper remains useful for small explicit playlists but continuous mode must not call it.
print("Applied native-safe continuous Quran radio range playback.")
