package ca.wopt.quranspeech

import android.content.Intent
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class QuranSpeechModule : Module() {
  private var recognizer: SpeechRecognizer? = null
  @Volatile private var state: String = "idle"
  @Volatile private var transcript: String = ""
  @Volatile private var partialTranscript: String = ""
  @Volatile private var error: String? = null
  private val mainHandler = Handler(Looper.getMainLooper())

  override fun definition() = ModuleDefinition {
    Name("QuranSpeech")

    AsyncFunction("start") { locale: String ->
      val context = appContext.reactContext ?: throw IllegalStateException("Android context unavailable")
      transcript = ""
      partialTranscript = ""
      error = null

      if (!SpeechRecognizer.isRecognitionAvailable(context)) {
        state = "error"
        error = "Speech recognition is not available on this device"
        return@AsyncFunction
      }

      mainHandler.post {
        destroyRecognizer()
        val next = SpeechRecognizer.createSpeechRecognizer(context)
        recognizer = next
        next.setRecognitionListener(listener)
        val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
          putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
          putExtra(RecognizerIntent.EXTRA_LANGUAGE, locale.ifBlank { "ar-SA" })
          putExtra(RecognizerIntent.EXTRA_LANGUAGE_PREFERENCE, locale.ifBlank { "ar-SA" })
          putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
          putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 5)
          putExtra(RecognizerIntent.EXTRA_CALLING_PACKAGE, context.packageName)
        }
        state = "listening"
        next.startListening(intent)
      }
    }

    Function("stop") {
      mainHandler.post {
        if (state == "listening") state = "processing"
        recognizer?.stopListening()
      }
    }

    Function("cancel") {
      mainHandler.post {
        recognizer?.cancel()
        state = "idle"
        transcript = ""
        partialTranscript = ""
        error = null
      }
    }

    Function("getStatus") {
      mapOf(
        "available" to true,
        "state" to state,
        "transcript" to transcript,
        "partialTranscript" to partialTranscript,
        "error" to error
      )
    }

    OnDestroy {
      mainHandler.post { destroyRecognizer() }
    }
  }

  private val listener = object : RecognitionListener {
    override fun onReadyForSpeech(params: Bundle?) {
      state = "listening"
      error = null
    }

    override fun onBeginningOfSpeech() {
      state = "listening"
    }

    override fun onRmsChanged(rmsdB: Float) = Unit
    override fun onBufferReceived(buffer: ByteArray?) = Unit

    override fun onEndOfSpeech() {
      state = "processing"
    }

    override fun onError(errorCode: Int) {
      state = "error"
      error = errorMessage(errorCode)
    }

    override fun onResults(results: Bundle?) {
      val matches = results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
      transcript = matches?.firstOrNull().orEmpty()
      partialTranscript = ""
      state = "done"
      error = null
    }

    override fun onPartialResults(partialResults: Bundle?) {
      val matches = partialResults?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
      partialTranscript = matches?.firstOrNull().orEmpty()
    }

    override fun onEvent(eventType: Int, params: Bundle?) = Unit
  }

  private fun destroyRecognizer() {
    recognizer?.let {
      runCatching { it.cancel() }
      runCatching { it.destroy() }
    }
    recognizer = null
  }

  private fun errorMessage(code: Int): String = when (code) {
    SpeechRecognizer.ERROR_AUDIO -> "Audio recording error"
    SpeechRecognizer.ERROR_CLIENT -> "Speech recognition client error"
    SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS -> "Microphone permission is required"
    SpeechRecognizer.ERROR_NETWORK -> "Network error while recognizing speech"
    SpeechRecognizer.ERROR_NETWORK_TIMEOUT -> "Speech recognition network timeout"
    SpeechRecognizer.ERROR_NO_MATCH -> "No speech match found. Try again slowly."
    SpeechRecognizer.ERROR_RECOGNIZER_BUSY -> "Speech recognizer is busy. Try again."
    SpeechRecognizer.ERROR_SERVER -> "Speech recognition server error"
    SpeechRecognizer.ERROR_SPEECH_TIMEOUT -> "No speech was heard. Try again."
    else -> "Speech recognition error ($code)"
  }
}
