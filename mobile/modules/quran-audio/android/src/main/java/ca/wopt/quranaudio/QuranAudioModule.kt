package ca.wopt.quranaudio

import android.media.AudioAttributes
import android.media.MediaPlayer
import android.os.Build
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class QuranAudioModule : Module() {
  private var player: MediaPlayer? = null
  private var state: String = "idle"
  private var speed: Float = 1.0f
  private var currentUrl: String? = null

  override fun definition() = ModuleDefinition {
    Name("QuranAudio")

    AsyncFunction("play") { url: String, requestedSpeed: Double ->
      stopInternal()
      speed = requestedSpeed.toFloat().coerceIn(0.5f, 2.0f)
      currentUrl = url
      state = "loading"

      val next = MediaPlayer()
      player = next
      next.setAudioAttributes(
        AudioAttributes.Builder()
          .setUsage(AudioAttributes.USAGE_MEDIA)
          .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
          .build()
      )
      next.setDataSource(url)
      next.setOnPreparedListener { mediaPlayer ->
        applySpeed(mediaPlayer)
        mediaPlayer.start()
        state = "playing"
      }
      next.setOnCompletionListener {
        state = "completed"
      }
      next.setOnErrorListener { _, _, _ ->
        state = "error"
        true
      }
      next.prepareAsync()
    }

    Function("pause") {
      player?.let {
        if (it.isPlaying) {
          it.pause()
          state = "paused"
        }
      }
    }

    Function("resume") {
      player?.let {
        if (state == "paused" || state == "completed") {
          if (state == "completed") it.seekTo(0)
          it.start()
          state = "playing"
        }
      }
    }

    Function("stop") {
      stopInternal()
    }

    Function("seekBy") { deltaMs: Int ->
      player?.let {
        runCatching {
          val duration = if (it.duration > 0) it.duration else Int.MAX_VALUE
          val target = (it.currentPosition + deltaMs).coerceIn(0, duration)
          it.seekTo(target)
        }
      }
    }

    Function("setSpeed") { requestedSpeed: Double ->
      speed = requestedSpeed.toFloat().coerceIn(0.5f, 2.0f)
      player?.let(::applySpeed)
    }

    Function("getStatus") {
      val current = player
      val position = runCatching { current?.currentPosition ?: 0 }.getOrDefault(0)
      val duration = runCatching { current?.duration ?: 0 }.getOrDefault(0)
      mapOf(
        "available" to true,
        "state" to state,
        "positionMs" to position,
        "durationMs" to duration,
        "speed" to speed.toDouble(),
        "url" to currentUrl
      )
    }

    OnDestroy {
      stopInternal()
    }
  }

  private fun applySpeed(mediaPlayer: MediaPlayer) {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
      runCatching {
        mediaPlayer.playbackParams = mediaPlayer.playbackParams.setSpeed(speed)
      }
    }
  }

  private fun stopInternal() {
    player?.let { mediaPlayer ->
      runCatching { mediaPlayer.stop() }
      runCatching { mediaPlayer.reset() }
      runCatching { mediaPlayer.release() }
    }
    player = null
    currentUrl = null
    state = "idle"
  }
}
