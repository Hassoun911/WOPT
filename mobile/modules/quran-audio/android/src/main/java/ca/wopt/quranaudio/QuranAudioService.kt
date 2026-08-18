package ca.wopt.quranaudio

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.media.MediaPlayer
import android.media.session.MediaSession
import android.media.session.PlaybackState
import android.os.Build
import android.os.IBinder
import android.os.PowerManager
import org.json.JSONArray

class QuranAudioService : Service() {
  data class QueueItem(val url: String, val title: String, val subtitle: String)

  private var player: MediaPlayer? = null
  private var queue: List<QueueItem> = emptyList()
  private var queueIndex = 0
  private var repeatQueue = false
  private var speed = 1.0f
  private var state = "idle"
  private var mediaSession: MediaSession? = null

  // Continuous Qur’an mode is lazy: only the absolute ayah range is passed
  // through the Intent. This avoids Android Binder crashes from huge JSON queues.
  private var rangeActive = false
  private var rangeStartAbsolute = 1
  private var rangeEndAbsolute = 0
  private var rangeReciterBase = ""
  private var rangeReciterName = "Hassoun"

  override fun onCreate() {
    super.onCreate()
    createChannel()
    mediaSession = MediaSession(this, "HassounQuranAudio").apply {
      setCallback(object : MediaSession.Callback() {
        override fun onPlay() = resumePlayback()
        override fun onPause() = pausePlayback()
        override fun onStop() = stopPlayback(true)
        override fun onSkipToNext() = skipNext()
        override fun onSkipToPrevious() = skipPrevious()
        override fun onSeekTo(pos: Long) {
          player?.let { runCatching { it.seekTo(pos.toInt().coerceAtLeast(0)) } }
          publishSnapshot()
        }
      })
      isActive = true
    }
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    when (intent?.action) {
      ACTION_PLAY_QUEUE -> {
        rangeActive = false
        rangeEndAbsolute = 0
        queue = parseQueue(intent.getStringExtra(EXTRA_ITEMS).orEmpty())
        queueIndex = intent.getIntExtra(EXTRA_INDEX, 0).coerceIn(0, (queue.size - 1).coerceAtLeast(0))
        repeatQueue = intent.getBooleanExtra(EXTRA_REPEAT, false)
        speed = intent.getFloatExtra(EXTRA_SPEED, 1.0f).coerceIn(0.5f, 2.0f)
        if (queue.isNotEmpty()) playCurrent() else stopPlayback(true)
      }
      ACTION_PLAY_RANGE -> {
        queue = emptyList()
        rangeStartAbsolute = intent.getIntExtra(EXTRA_RANGE_START, 1).coerceAtLeast(1)
        rangeEndAbsolute = intent.getIntExtra(EXTRA_RANGE_END, rangeStartAbsolute).coerceAtLeast(rangeStartAbsolute)
        rangeReciterBase = intent.getStringExtra(EXTRA_RECITER_BASE).orEmpty().trimEnd('/')
        rangeReciterName = intent.getStringExtra(EXTRA_RECITER_NAME).orEmpty().ifBlank { "Hassoun" }
        rangeActive = rangeReciterBase.isNotBlank() && rangeEndAbsolute >= rangeStartAbsolute
        queueIndex = 0
        repeatQueue = intent.getBooleanExtra(EXTRA_REPEAT, false)
        speed = intent.getFloatExtra(EXTRA_SPEED, 1.0f).coerceIn(0.5f, 2.0f)
        if (rangeActive) playCurrent() else stopPlayback(true)
      }
      ACTION_PAUSE -> pausePlayback()
      ACTION_RESUME -> resumePlayback()
      ACTION_STOP -> stopPlayback(true)
      ACTION_NEXT -> skipNext()
      ACTION_PREVIOUS -> skipPrevious()
      ACTION_SEEK -> seekBy(intent.getIntExtra(EXTRA_DELTA, 0))
      ACTION_SPEED -> {
        speed = intent.getFloatExtra(EXTRA_SPEED, 1.0f).coerceIn(0.5f, 2.0f)
        player?.let(::applySpeed)
        publishSnapshot()
        updateNotification()
      }
      ACTION_REPEAT -> {
        repeatQueue = intent.getBooleanExtra(EXTRA_REPEAT, false)
        publishSnapshot()
        updateNotification()
      }
    }
    return START_STICKY
  }

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onDestroy() {
    releasePlayer()
    mediaSession?.release()
    mediaSession = null
    if (state != "idle") {
      state = "idle"
      publishSnapshot()
    }
    super.onDestroy()
  }

  private fun currentQueueSize(): Int = if (rangeActive) {
    (rangeEndAbsolute - rangeStartAbsolute + 1).coerceAtLeast(0)
  } else queue.size

  private fun currentItem(): QueueItem? {
    if (!rangeActive) return queue.getOrNull(queueIndex)
    val absolute = rangeStartAbsolute + queueIndex
    if (absolute !in rangeStartAbsolute..rangeEndAbsolute) return null
    val (surah, ayah) = surahAyahForAbsolute(absolute)
    return QueueItem(
      url = "$rangeReciterBase/$absolute.mp3",
      title = "Surah $surah • Ayah $ayah",
      subtitle = "$rangeReciterName • Hassoun"
    )
  }

  private fun playCurrent() {
    val item = currentItem() ?: run {
      stopPlayback(true)
      return
    }
    releasePlayer()
    state = "loading"
    publishSnapshot()
    startForeground(NOTIFICATION_ID, buildNotification())

    val next = MediaPlayer()
    player = next
    next.setWakeMode(applicationContext, PowerManager.PARTIAL_WAKE_LOCK)
    next.setAudioAttributes(
      AudioAttributes.Builder()
        .setUsage(AudioAttributes.USAGE_MEDIA)
        .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
        .build()
    )
    next.setDataSource(item.url)
    next.setOnPreparedListener { mediaPlayer ->
      applySpeed(mediaPlayer)
      mediaPlayer.start()
      state = "playing"
      publishSnapshot()
      updateNotification()
    }
    next.setOnCompletionListener {
      if (queueIndex + 1 < currentQueueSize()) {
        queueIndex += 1
        playCurrent()
      } else if (repeatQueue && currentQueueSize() > 0) {
        queueIndex = 0
        playCurrent()
      } else {
        state = "completed"
        publishSnapshot()
        updateNotification()
      }
    }
    next.setOnErrorListener { _, _, _ ->
      // A failed network item should not kill a long continuous range. Skip it
      // when another ayah remains; surface an error only at the end.
      if (queueIndex + 1 < currentQueueSize()) {
        queueIndex += 1
        playCurrent()
      } else {
        state = "error"
        publishSnapshot()
        updateNotification()
      }
      true
    }
    next.prepareAsync()
  }

  private fun pausePlayback() {
    player?.let {
      if (runCatching { it.isPlaying }.getOrDefault(false)) {
        runCatching { it.pause() }
        state = "paused"
        publishSnapshot()
        updateNotification()
      }
    }
  }

  private fun resumePlayback() {
    val current = player
    if (current == null) {
      if (currentQueueSize() > 0) playCurrent()
      return
    }
    if (state == "completed") runCatching { current.seekTo(0) }
    runCatching { current.start() }
    state = "playing"
    publishSnapshot()
    updateNotification()
  }

  private fun skipNext() {
    val size = currentQueueSize()
    if (size <= 0) return
    if (queueIndex + 1 < size) queueIndex += 1
    else if (repeatQueue) queueIndex = 0
    else return
    playCurrent()
  }

  private fun skipPrevious() {
    if (currentQueueSize() <= 0) return
    val position = runCatching { player?.currentPosition ?: 0 }.getOrDefault(0)
    if (position > 5000) {
      runCatching { player?.seekTo(0) }
      publishSnapshot()
      return
    }
    queueIndex = (queueIndex - 1).coerceAtLeast(0)
    playCurrent()
  }

  private fun seekBy(deltaMs: Int) {
    player?.let {
      runCatching {
        val duration = if (it.duration > 0) it.duration else Int.MAX_VALUE
        it.seekTo((it.currentPosition + deltaMs).coerceIn(0, duration))
      }
    }
    publishSnapshot()
  }

  private fun stopPlayback(removeNotification: Boolean) {
    releasePlayer()
    queue = emptyList()
    queueIndex = 0
    repeatQueue = false
    rangeActive = false
    rangeStartAbsolute = 1
    rangeEndAbsolute = 0
    rangeReciterBase = ""
    rangeReciterName = "Hassoun"
    state = "idle"
    publishSnapshot()
    if (removeNotification) {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) stopForeground(STOP_FOREGROUND_REMOVE)
      else @Suppress("DEPRECATION") stopForeground(true)
      stopSelf()
    }
  }

  private fun releasePlayer() {
    player?.let { mediaPlayer ->
      runCatching { mediaPlayer.stop() }
      runCatching { mediaPlayer.reset() }
      runCatching { mediaPlayer.release() }
    }
    player = null
  }

  private fun applySpeed(mediaPlayer: MediaPlayer) {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
      runCatching { mediaPlayer.playbackParams = mediaPlayer.playbackParams.setSpeed(speed) }
    }
  }

  private fun publishSnapshot() {
    val item = currentItem()
    val current = player
    val position = runCatching { current?.currentPosition ?: 0 }.getOrDefault(0)
    val duration = runCatching { current?.duration ?: 0 }.getOrDefault(0)
    snapshot = mapOf(
      "available" to true,
      "state" to state,
      "positionMs" to position,
      "durationMs" to duration,
      "speed" to speed.toDouble(),
      "url" to item?.url,
      "title" to item?.title,
      "subtitle" to item?.subtitle,
      "queueIndex" to queueIndex,
      "queueSize" to currentQueueSize(),
      "repeat" to repeatQueue,
      "mode" to if (rangeActive) "range" else "queue"
    )
    updateMediaSession(position.toLong(), duration.toLong())
  }

  private fun updateMediaSession(position: Long, duration: Long) {
    val playbackState = when (state) {
      "playing" -> PlaybackState.STATE_PLAYING
      "paused" -> PlaybackState.STATE_PAUSED
      "loading" -> PlaybackState.STATE_BUFFERING
      "completed" -> PlaybackState.STATE_STOPPED
      "error" -> PlaybackState.STATE_ERROR
      else -> PlaybackState.STATE_NONE
    }
    val actions = PlaybackState.ACTION_PLAY or PlaybackState.ACTION_PAUSE or PlaybackState.ACTION_STOP or PlaybackState.ACTION_SKIP_TO_NEXT or PlaybackState.ACTION_SKIP_TO_PREVIOUS or PlaybackState.ACTION_SEEK_TO
    mediaSession?.setPlaybackState(PlaybackState.Builder().setActions(actions).setState(playbackState, position, speed).build())
    currentItem()?.let { item ->
      mediaSession?.setMetadata(
        android.media.MediaMetadata.Builder()
          .putString(android.media.MediaMetadata.METADATA_KEY_TITLE, item.title.ifBlank { "Qur’an" })
          .putString(android.media.MediaMetadata.METADATA_KEY_ARTIST, item.subtitle.ifBlank { "Hassoun" })
          .putLong(android.media.MediaMetadata.METADATA_KEY_DURATION, duration.coerceAtLeast(0))
          .build()
      )
    }
  }

  private fun updateNotification() {
    if (state == "idle") return
    getSystemService(NotificationManager::class.java).notify(NOTIFICATION_ID, buildNotification())
  }

  private fun buildNotification(): Notification {
    val item = currentItem()
    val launchIntent = packageManager.getLaunchIntentForPackage(packageName)
    val contentIntent = launchIntent?.let { PendingIntent.getActivity(this, 100, it, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE) }
    val playPauseAction = if (state == "playing") ACTION_PAUSE else ACTION_RESUME
    val playPauseIcon = if (state == "playing") android.R.drawable.ic_media_pause else android.R.drawable.ic_media_play
    val playPauseLabel = if (state == "playing") "Pause" else "Play"
    val smallIcon = resources.getIdentifier("notification_icon", "drawable", packageName).takeIf { it != 0 } ?: applicationInfo.icon
    val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) Notification.Builder(this, CHANNEL_ID) else @Suppress("DEPRECATION") Notification.Builder(this)
    builder
      .setSmallIcon(smallIcon)
      .setContentTitle(item?.title?.ifBlank { "Qur’an" } ?: "Qur’an")
      .setContentText(item?.subtitle?.ifBlank { "Hassoun" } ?: "Hassoun")
      .setContentIntent(contentIntent)
      .setCategory(Notification.CATEGORY_TRANSPORT)
      .setVisibility(Notification.VISIBILITY_PUBLIC)
      .setOngoing(state == "playing" || state == "loading")
      .addAction(android.R.drawable.ic_media_previous, "Previous", actionIntent(ACTION_PREVIOUS, 1))
      .addAction(playPauseIcon, playPauseLabel, actionIntent(playPauseAction, 2))
      .addAction(android.R.drawable.ic_media_next, "Next", actionIntent(ACTION_NEXT, 3))
      .addAction(android.R.drawable.ic_menu_close_clear_cancel, "Stop", actionIntent(ACTION_STOP, 4))
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
      builder.setStyle(Notification.MediaStyle().setMediaSession(mediaSession?.sessionToken).setShowActionsInCompactView(0, 1, 2))
    }
    return builder.build()
  }

  private fun actionIntent(action: String, requestCode: Int): PendingIntent {
    val intent = Intent(this, QuranAudioService::class.java).setAction(action)
    return PendingIntent.getService(this, requestCode, intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
  }

  private fun createChannel() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val manager = getSystemService(NotificationManager::class.java)
    manager.createNotificationChannel(NotificationChannel(CHANNEL_ID, "Qur’an audio", NotificationManager.IMPORTANCE_LOW).apply {
      description = "Hassoun background Qur’an playback controls"
      setSound(null, null)
      enableVibration(false)
    })
  }

  private fun surahAyahForAbsolute(absolute: Int): Pair<Int, Int> {
    var remaining = absolute.coerceAtLeast(1)
    AYAH_COUNTS.forEachIndexed { index, count ->
      if (remaining <= count) return Pair(index + 1, remaining)
      remaining -= count
    }
    return Pair(114, AYAH_COUNTS.last())
  }

  private fun parseQueue(json: String): List<QueueItem> {
    return runCatching {
      val array = JSONArray(json)
      (0 until array.length()).mapNotNull { index ->
        val item = array.optJSONObject(index) ?: return@mapNotNull null
        val url = item.optString("url")
        if (url.isBlank()) return@mapNotNull null
        QueueItem(url, item.optString("title", "Qur’an"), item.optString("subtitle", "Hassoun"))
      }
    }.getOrDefault(emptyList())
  }

  companion object {
    private const val CHANNEL_ID = "hassoun-quran-audio"
    private const val NOTIFICATION_ID = 4821
    private const val ACTION_PLAY_QUEUE = "ca.wopt.quranaudio.PLAY_QUEUE"
    private const val ACTION_PLAY_RANGE = "ca.wopt.quranaudio.PLAY_RANGE"
    private const val ACTION_PAUSE = "ca.wopt.quranaudio.PAUSE"
    private const val ACTION_RESUME = "ca.wopt.quranaudio.RESUME"
    private const val ACTION_STOP = "ca.wopt.quranaudio.STOP"
    private const val ACTION_NEXT = "ca.wopt.quranaudio.NEXT"
    private const val ACTION_PREVIOUS = "ca.wopt.quranaudio.PREVIOUS"
    private const val ACTION_SEEK = "ca.wopt.quranaudio.SEEK"
    private const val ACTION_SPEED = "ca.wopt.quranaudio.SPEED"
    private const val ACTION_REPEAT = "ca.wopt.quranaudio.REPEAT"
    private const val EXTRA_ITEMS = "items"
    private const val EXTRA_INDEX = "index"
    private const val EXTRA_RANGE_START = "rangeStart"
    private const val EXTRA_RANGE_END = "rangeEnd"
    private const val EXTRA_RECITER_BASE = "reciterBase"
    private const val EXTRA_RECITER_NAME = "reciterName"
    private const val EXTRA_REPEAT = "repeat"
    private const val EXTRA_SPEED = "speed"
    private const val EXTRA_DELTA = "delta"

    private val AYAH_COUNTS = intArrayOf(
      7,286,200,176,120,165,206,75,129,109,123,111,43,52,99,128,111,110,98,135,112,78,118,64,77,227,93,88,69,60,
      34,30,73,54,45,83,182,88,75,85,54,53,89,59,37,35,38,29,18,45,60,49,62,55,78,96,29,22,24,13,
      14,11,11,18,12,12,30,52,52,44,28,28,20,56,40,31,50,40,46,42,29,19,36,25,22,17,19,26,30,20,
      15,21,11,8,8,19,5,8,8,11,11,8,3,9,5,4,7,3,6,3,5,4,5,6
    )

    @Volatile
    var snapshot: Map<String, Any?> = mapOf(
      "available" to true, "state" to "idle", "positionMs" to 0, "durationMs" to 0, "speed" to 1.0,
      "url" to null, "title" to null, "subtitle" to null, "queueIndex" to 0, "queueSize" to 0, "repeat" to false, "mode" to "queue"
    )
      private set

    private fun command(context: Context, action: String, configure: (Intent) -> Unit = {}) {
      val intent = Intent(context, QuranAudioService::class.java).setAction(action)
      configure(intent)
      context.startService(intent)
    }

    fun playQueue(context: Context, itemsJson: String, startIndex: Int, repeat: Boolean, speed: Float) {
      val intent = Intent(context, QuranAudioService::class.java)
        .setAction(ACTION_PLAY_QUEUE)
        .putExtra(EXTRA_ITEMS, itemsJson)
        .putExtra(EXTRA_INDEX, startIndex)
        .putExtra(EXTRA_REPEAT, repeat)
        .putExtra(EXTRA_SPEED, speed)
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) context.startForegroundService(intent) else context.startService(intent)
    }

    fun playRange(context: Context, startAbsolute: Int, endAbsolute: Int, reciterId: String, bitrate: Int, reciterName: String, repeat: Boolean, speed: Float) {
      val safeStart = startAbsolute.coerceAtLeast(1)
      val safeEnd = endAbsolute.coerceAtLeast(safeStart)
      val base = "https://cdn.islamic.network/quran/audio/${bitrate.coerceAtLeast(32)}/${reciterId.trim()}"
      val intent = Intent(context, QuranAudioService::class.java)
        .setAction(ACTION_PLAY_RANGE)
        .putExtra(EXTRA_RANGE_START, safeStart)
        .putExtra(EXTRA_RANGE_END, safeEnd)
        .putExtra(EXTRA_RECITER_BASE, base)
        .putExtra(EXTRA_RECITER_NAME, reciterName)
        .putExtra(EXTRA_REPEAT, repeat)
        .putExtra(EXTRA_SPEED, speed)
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) context.startForegroundService(intent) else context.startService(intent)
    }

    fun pause(context: Context) = command(context, ACTION_PAUSE)
    fun resume(context: Context) = command(context, ACTION_RESUME)
    fun stop(context: Context) = command(context, ACTION_STOP)
    fun next(context: Context) = command(context, ACTION_NEXT)
    fun previous(context: Context) = command(context, ACTION_PREVIOUS)
    fun seekBy(context: Context, deltaMs: Int) = command(context, ACTION_SEEK) { it.putExtra(EXTRA_DELTA, deltaMs) }
    fun setSpeed(context: Context, speed: Float) = command(context, ACTION_SPEED) { it.putExtra(EXTRA_SPEED, speed) }
    fun setRepeat(context: Context, repeat: Boolean) = command(context, ACTION_REPEAT) { it.putExtra(EXTRA_REPEAT, repeat) }
  }
}
