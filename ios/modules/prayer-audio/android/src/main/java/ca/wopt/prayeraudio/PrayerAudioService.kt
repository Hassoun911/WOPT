package ca.wopt.prayeraudio

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.media.AudioManager
import android.media.MediaPlayer
import android.os.Build
import android.os.IBinder
import android.os.PowerManager
import java.util.Locale

class PrayerAudioService : Service() {
  private var player: MediaPlayer? = null
  private var wakeLock: PowerManager.WakeLock? = null
  private var audioFocusRequest: AudioFocusRequest? = null

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    if (intent?.action == ACTION_STOP) {
      finishPlayback()
      return START_NOT_STICKY
    }

    val prayer = intent?.getStringExtra("prayer")?.replaceFirstChar {
      if (it.isLowerCase()) it.titlecase(Locale.CANADA) else it.toString()
    } ?: "Prayer"

    val isFajr = prayer.equals("Fajr", ignoreCase = true)
    createNotificationChannel()
    startForeground(NOTIFICATION_ID, playbackNotification(prayer, includesDua = !isFajr))
    acquireWakeLock()
    requestAudioFocus()
    if (isFajr) {
      playResource(R.raw.fajr_adhan) { finishPlayback() }
    } else {
      playResource(R.raw.azan9) {
        playResource(R.raw.dua_after_azan) { finishPlayback() }
      }
    }
    return START_NOT_STICKY
  }

  override fun onDestroy() {
    releasePlayer()
    abandonAudioFocus()
    wakeLock?.let { if (it.isHeld) it.release() }
    wakeLock = null
    super.onDestroy()
  }

  private fun playResource(resourceId: Int, onComplete: () -> Unit) {
    releasePlayer()
    val descriptor = resources.openRawResourceFd(resourceId)
    player = MediaPlayer().apply {
      setAudioAttributes(
        AudioAttributes.Builder()
          .setUsage(AudioAttributes.USAGE_ALARM)
          .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
          .build()
      )
      setDataSource(descriptor.fileDescriptor, descriptor.startOffset, descriptor.length)
      setOnPreparedListener { it.start() }
      setOnCompletionListener {
        releasePlayer()
        onComplete()
      }
      setOnErrorListener { _, _, _ ->
        releasePlayer()
        onComplete()
        true
      }
      prepareAsync()
    }
    descriptor.close()
  }

  private fun releasePlayer() {
    player?.runCatching { stop() }
    player?.release()
    player = null
  }

  private fun acquireWakeLock() {
    val powerManager = getSystemService(Context.POWER_SERVICE) as PowerManager
    wakeLock = powerManager.newWakeLock(
      PowerManager.PARTIAL_WAKE_LOCK,
      "Hassoun:PrayerAudio"
    ).apply { acquire(6 * 60 * 1000L) }
  }

  private fun requestAudioFocus() {
    val audioManager = getSystemService(Context.AUDIO_SERVICE) as AudioManager
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      audioFocusRequest = AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT)
        .setAudioAttributes(
          AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_ALARM)
            .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
            .build()
        )
        .setOnAudioFocusChangeListener { }
        .build()
        .also { audioManager.requestAudioFocus(it) }
    } else {
      @Suppress("DEPRECATION")
      audioManager.requestAudioFocus(null, AudioManager.STREAM_ALARM, AudioManager.AUDIOFOCUS_GAIN_TRANSIENT)
    }
  }

  private fun abandonAudioFocus() {
    val audioManager = getSystemService(Context.AUDIO_SERVICE) as AudioManager
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      audioFocusRequest?.let { audioManager.abandonAudioFocusRequest(it) }
    } else {
      @Suppress("DEPRECATION")
      audioManager.abandonAudioFocus(null)
    }
    audioFocusRequest = null
  }

  private fun createNotificationChannel() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    manager.createNotificationChannel(
      NotificationChannel(CHANNEL_ID, "Adhan playback", NotificationManager.IMPORTANCE_LOW).apply {
        description = "Shows while the Adhan and dua are playing"
        setSound(null, null)
        enableVibration(false)
      }
    )
  }

  private fun playbackNotification(prayer: String, includesDua: Boolean): Notification {
    val stopIntent = Intent(this, PrayerAudioService::class.java).apply { action = ACTION_STOP }
    val stopPendingIntent = PendingIntent.getService(
      this,
      0,
      stopIntent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )
    val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      Notification.Builder(this, CHANNEL_ID)
    } else {
      @Suppress("DEPRECATION")
      Notification.Builder(this)
    }
    return builder
      .setSmallIcon(
        resources.getIdentifier("notification_icon", "drawable", packageName)
          .takeIf { it != 0 } ?: applicationInfo.icon
      )
      .setContentTitle("Hassoun • $prayer Adhan")
      .setContentText(
        if (includesDua) "Playing the Adhan, followed by the dua" else "Playing the Fajr Adhan"
      )
      .setOngoing(true)
      .setCategory(Notification.CATEGORY_ALARM)
      .setVisibility(Notification.VISIBILITY_PUBLIC)
      .addAction(0, "Stop", stopPendingIntent)
      .build()
  }

  private fun finishPlayback() {
    stopForeground(STOP_FOREGROUND_REMOVE)
    stopSelf()
  }

  companion object {
    const val ACTION_PLAY = "ca.wopt.prayeraudio.PLAY"
    const val ACTION_STOP = "ca.wopt.prayeraudio.STOP"
    private const val CHANNEL_ID = "prayer-playback-v1"
    private const val NOTIFICATION_ID = 7861
  }
}
