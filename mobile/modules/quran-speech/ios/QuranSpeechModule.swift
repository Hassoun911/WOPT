import AVFoundation
import ExpoModulesCore
import Foundation
import Speech

public class QuranSpeechModule: Module {
  private let audioEngine = AVAudioEngine()
  private var recognitionRequest: SFSpeechAudioBufferRecognitionRequest?
  private var recognitionTask: SFSpeechRecognitionTask?
  private var recognizer: SFSpeechRecognizer?

  private var state = "idle"
  private var transcript = ""
  private var partialTranscript = ""
  private var lastError: String? = nil

  public func definition() -> ModuleDefinition {
    Name("QuranSpeech")

    AsyncFunction("start") { (locale: String, promise: Promise) in
      self.requestPermissionsAndStart(locale: locale, promise: promise)
    }

    Function("stop") {
      DispatchQueue.main.async {
        if self.state == "listening" { self.state = "processing" }
        self.audioEngine.stop()
        self.audioEngine.inputNode.removeTap(onBus: 0)
        self.recognitionRequest?.endAudio()
      }
    }

    Function("cancel") {
      DispatchQueue.main.async { self.cancelRecognition(resetText: true) }
    }

    Function("getStatus") {
      return [
        "available": SFSpeechRecognizer.authorizationStatus() != .denied && SFSpeechRecognizer.authorizationStatus() != .restricted,
        "state": self.state,
        "transcript": self.transcript,
        "partialTranscript": self.partialTranscript,
        "error": self.lastError ?? NSNull()
      ] as [String: Any]
    }

    OnDestroy {
      DispatchQueue.main.async { self.cancelRecognition(resetText: false) }
    }
  }

  private func requestPermissionsAndStart(locale: String, promise: Promise) {
    transcript = ""
    partialTranscript = ""
    lastError = nil
    state = "processing"

    SFSpeechRecognizer.requestAuthorization { speechStatus in
      guard speechStatus == .authorized else {
        DispatchQueue.main.async {
          self.state = "error"
          self.lastError = self.speechAuthorizationMessage(speechStatus)
          promise.resolve(nil)
        }
        return
      }

      AVAudioSession.sharedInstance().requestRecordPermission { microphoneGranted in
        DispatchQueue.main.async {
          guard microphoneGranted else {
            self.state = "error"
            self.lastError = "Microphone permission is required"
            promise.resolve(nil)
            return
          }
          self.startRecognition(locale: locale)
          promise.resolve(nil)
        }
      }
    }
  }

  private func startRecognition(locale: String) {
    cancelRecognition(resetText: false)
    transcript = ""
    partialTranscript = ""
    lastError = nil

    let language = locale.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? "ar-SA" : locale
    let nextRecognizer = SFSpeechRecognizer(locale: Locale(identifier: language)) ?? SFSpeechRecognizer(locale: Locale(identifier: "ar-SA"))
    guard let nextRecognizer, nextRecognizer.isAvailable else {
      state = "error"
      lastError = "Speech recognition is not available for this language right now"
      return
    }
    recognizer = nextRecognizer

    let request = SFSpeechAudioBufferRecognitionRequest()
    request.shouldReportPartialResults = true
    request.taskHint = .dictation
    if #available(iOS 16.0, *) {
      request.addsPunctuation = false
    }
    recognitionRequest = request

    do {
      let session = AVAudioSession.sharedInstance()
      try session.setCategory(.record, mode: .measurement, options: [.duckOthers, .allowBluetooth])
      try session.setActive(true, options: .notifyOthersOnDeactivation)

      let input = audioEngine.inputNode
      let format = input.outputFormat(forBus: 0)
      input.removeTap(onBus: 0)
      input.installTap(onBus: 0, bufferSize: 1024, format: format) { buffer, _ in
        request.append(buffer)
      }
      audioEngine.prepare()
      try audioEngine.start()
    } catch {
      state = "error"
      lastError = "Unable to start microphone recognition: \(error.localizedDescription)"
      cancelRecognition(resetText: false)
      return
    }

    state = "listening"
    recognitionTask = nextRecognizer.recognitionTask(with: request) { [weak self] result, error in
      guard let self else { return }
      DispatchQueue.main.async {
        if let result {
          let text = result.bestTranscription.formattedString
          if result.isFinal {
            self.transcript = text
            self.partialTranscript = ""
            self.state = "done"
            self.finishAudioCapture()
          } else {
            self.partialTranscript = text
            self.state = "listening"
          }
        }

        if let error, self.state != "done" {
          self.state = "error"
          self.lastError = self.cleanSpeechError(error)
          self.finishAudioCapture()
        }
      }
    }
  }

  private func finishAudioCapture() {
    if audioEngine.isRunning { audioEngine.stop() }
    audioEngine.inputNode.removeTap(onBus: 0)
    recognitionRequest?.endAudio()
    do { try AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation) } catch {}
  }

  private func cancelRecognition(resetText: Bool) {
    if audioEngine.isRunning { audioEngine.stop() }
    audioEngine.inputNode.removeTap(onBus: 0)
    recognitionRequest?.endAudio()
    recognitionTask?.cancel()
    recognitionTask = nil
    recognitionRequest = nil
    recognizer = nil
    do { try AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation) } catch {}
    state = "idle"
    lastError = nil
    if resetText {
      transcript = ""
      partialTranscript = ""
    }
  }

  private func speechAuthorizationMessage(_ status: SFSpeechRecognizerAuthorizationStatus) -> String {
    switch status {
    case .denied: return "Speech recognition permission is required"
    case .restricted: return "Speech recognition is restricted on this device"
    case .notDetermined: return "Speech recognition permission was not granted"
    case .authorized: return ""
    @unknown default: return "Speech recognition permission is unavailable"
    }
  }

  private func cleanSpeechError(_ error: Error) -> String {
    let nsError = error as NSError
    if nsError.domain == "kAFAssistantErrorDomain" && nsError.code == 203 {
      return "No speech was recognized. Try again slowly."
    }
    return error.localizedDescription.isEmpty ? "Speech recognition error" : error.localizedDescription
  }
}
