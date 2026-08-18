package ca.wopt.quranaudio

import android.content.Context
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import org.json.JSONArray
import org.json.JSONObject

class QuranAudioModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  override fun definition() = ModuleDefinition {
    Name("QuranAudio")

    AsyncFunction("play") { url: String, requestedSpeed: Double ->
      val item = JSONArray().put(JSONObject().put("url", url).put("title", "Qur’an").put("subtitle", "Hassoun"))
      QuranAudioService.playQueue(context, item.toString(), 0, false, requestedSpeed.toFloat())
    }

    Function("playQueue") { itemsJson: String, startIndex: Int, repeat: Boolean, requestedSpeed: Double ->
      QuranAudioService.playQueue(context, itemsJson, startIndex, repeat, requestedSpeed.toFloat())
    }

    Function("playRange") { startAbsolute: Int, endAbsolute: Int, reciterId: String, bitrate: Int, reciterName: String, repeat: Boolean, requestedSpeed: Double ->
      QuranAudioService.playRange(context, startAbsolute, endAbsolute, reciterId, bitrate, reciterName, repeat, requestedSpeed.toFloat())
    }

    Function("pause") { QuranAudioService.pause(context) }
    Function("resume") { QuranAudioService.resume(context) }
    Function("stop") { QuranAudioService.stop(context) }
    Function("next") { QuranAudioService.next(context) }
    Function("previous") { QuranAudioService.previous(context) }
    Function("seekBy") { deltaMs: Int -> QuranAudioService.seekBy(context, deltaMs) }
    Function("setSpeed") { requestedSpeed: Double -> QuranAudioService.setSpeed(context, requestedSpeed.toFloat().coerceIn(0.5f, 2.0f)) }
    Function("setRepeat") { repeat: Boolean -> QuranAudioService.setRepeat(context, repeat) }
    Function("getStatus") { QuranAudioService.snapshot }
  }
}
