import AVFoundation
import ExpoModulesCore
import MediaPlayer

private struct IOSQuranItem {
  let url: URL
  let title: String
  let subtitle: String
}

private final class IOSQuranAudioEngine: NSObject {
  static let shared = IOSQuranAudioEngine()

  private var player: AVPlayer?
  private var itemObservation: NSKeyValueObservation?
  private var endObserver: NSObjectProtocol?
  private var interruptionObserver: NSObjectProtocol?
  private var queue: [IOSQuranItem] = []
  private var queueIndex = 0
  private var repeatQueue = false
  private var speed: Float = 1.0
  private var state = "idle"
  private var lastError = ""

  private override init() {
    super.init()
    onMain { [weak self] in
      self?.configureAudioSession()
      self?.configureRemoteCommands()
      self?.installInterruptionObserver()
    }
  }

  deinit {
    if let interruptionObserver {
      NotificationCenter.default.removeObserver(interruptionObserver)
    }
    clearObservers()
  }

  private func onMain(_ block: @escaping () -> Void) {
    if Thread.isMainThread { block() }
    else { DispatchQueue.main.async(execute: block) }
  }

  private func onMainSync<T>(_ block: () -> T) -> T {
    if Thread.isMainThread { return block() }
    return DispatchQueue.main.sync(execute: block)
  }

  private func configureAudioSession() {
    do {
      let session = AVAudioSession.sharedInstance()
      try session.setCategory(.playback, mode: .spokenAudio, options: [.allowAirPlay, .allowBluetoothA2DP])
      try session.setActive(true)
      lastError = ""
    } catch {
      state = "error"
      lastError = "Audio session: \(error.localizedDescription)"
    }
  }

  private func activateSession() -> Bool {
    do {
      let session = AVAudioSession.sharedInstance()
      try session.setCategory(.playback, mode: .spokenAudio, options: [.allowAirPlay, .allowBluetoothA2DP])
      try session.setActive(true)
      return true
    } catch {
      state = "error"
      lastError = "Audio session: \(error.localizedDescription)"
      return false
    }
  }

  private func installInterruptionObserver() {
    interruptionObserver = NotificationCenter.default.addObserver(
      forName: AVAudioSession.interruptionNotification,
      object: AVAudioSession.sharedInstance(),
      queue: .main
    ) { [weak self] note in
      guard let self,
            let raw = note.userInfo?[AVAudioSessionInterruptionTypeKey] as? UInt,
            let type = AVAudioSession.InterruptionType(rawValue: raw) else { return }
      if type == .began {
        self.player?.pause()
        if self.state == "playing" { self.state = "paused" }
        self.updateNowPlaying()
      } else {
        let rawOptions = note.userInfo?[AVAudioSessionInterruptionOptionKey] as? UInt ?? 0
        if AVAudioSession.InterruptionOptions(rawValue: rawOptions).contains(.shouldResume) {
          self.resumeNow()
        }
      }
    }
  }

  private func configureRemoteCommands() {
    let center = MPRemoteCommandCenter.shared()
    center.playCommand.isEnabled = true
    center.pauseCommand.isEnabled = true
    center.stopCommand.isEnabled = true
    center.nextTrackCommand.isEnabled = true
    center.previousTrackCommand.isEnabled = true
    center.changePlaybackPositionCommand.isEnabled = true

    center.playCommand.addTarget { [weak self] _ in self?.resume(); return .success }
    center.pauseCommand.addTarget { [weak self] _ in self?.pause(); return .success }
    center.stopCommand.addTarget { [weak self] _ in self?.stop(); return .success }
    center.nextTrackCommand.addTarget { [weak self] _ in self?.next(); return .success }
    center.previousTrackCommand.addTarget { [weak self] _ in self?.previous(); return .success }
    center.changePlaybackPositionCommand.addTarget { [weak self] event in
      guard let self, let position = event as? MPChangePlaybackPositionCommandEvent else { return .commandFailed }
      self.onMain { self.seekTo(ms: Int(position.positionTime * 1000)) }
      return .success
    }
  }

  func play(urlString: String, requestedSpeed: Double) {
    guard let url = URL(string: urlString) else {
      onMain { self.state = "error"; self.lastError = "Invalid audio URL" }
      return
    }
    playQueue(items: [IOSQuranItem(url: url, title: "Qur’an", subtitle: "Hassoun")], startIndex: 0, repeatPlayback: false, requestedSpeed: requestedSpeed)
  }

  func playQueue(json: String, startIndex: Int, repeatPlayback: Bool, requestedSpeed: Double) {
    guard let data = json.data(using: .utf8),
          let raw = try? JSONSerialization.jsonObject(with: data) as? [[String: Any]] else {
      onMain { self.state = "error"; self.lastError = "Invalid audio queue" }
      return
    }
    let items = raw.compactMap { entry -> IOSQuranItem? in
      guard let text = entry["url"] as? String, let url = URL(string: text) else { return nil }
      return IOSQuranItem(
        url: url,
        title: (entry["title"] as? String) ?? "Qur’an",
        subtitle: (entry["subtitle"] as? String) ?? "Hassoun"
      )
    }
    playQueue(items: items, startIndex: startIndex, repeatPlayback: repeatPlayback, requestedSpeed: requestedSpeed)
  }

  private func playQueue(items: [IOSQuranItem], startIndex: Int, repeatPlayback: Bool, requestedSpeed: Double) {
    onMain {
      self.queue = items
      self.queueIndex = items.isEmpty ? 0 : min(max(startIndex, 0), items.count - 1)
      self.repeatQueue = repeatPlayback
      self.speed = Float(min(max(requestedSpeed, 0.5), 2.0))
      self.lastError = ""
      if items.isEmpty {
        self.stopNow()
      } else {
        self.playCurrent()
      }
    }
  }

  func playRange(startAbsolute: Int, endAbsolute: Int, reciterId: String, bitrate: Int, reciterName: String, repeatPlayback: Bool, requestedSpeed: Double) {
    let start = max(startAbsolute, 1)
    let end = max(endAbsolute, start)
    let reciter = reciterId.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !reciter.isEmpty else {
      onMain { self.state = "error"; self.lastError = "Missing reciter" }
      return
    }
    let name = reciterName.isEmpty ? "Hassoun" : reciterName
    var items: [IOSQuranItem] = []
    items.reserveCapacity(end - start + 1)
    for absolute in start...end {
      guard let url = URL(string: "https://cdn.islamic.network/quran/audio/\(max(bitrate, 32))/\(reciter)/\(absolute).mp3") else { continue }
      items.append(IOSQuranItem(url: url, title: "Qur’an • Ayah \(absolute)", subtitle: "\(name) • Hassoun"))
    }
    playQueue(items: items, startIndex: 0, repeatPlayback: repeatPlayback, requestedSpeed: requestedSpeed)
  }

  func pause() { onMain { self.pauseNow() } }
  private func pauseNow() {
    player?.pause()
    if state == "playing" || state == "loading" { state = "paused" }
    updateNowPlaying()
  }

  func resume() { onMain { self.resumeNow() } }
  private func resumeNow() {
    guard activateSession() else { return }
    if player == nil { playCurrent(); return }
    player?.playImmediately(atRate: speed)
    state = "playing"
    updateNowPlaying()
  }

  func stop() { onMain { self.stopNow() } }
  private func stopNow() {
    clearObservers()
    player?.pause()
    player?.replaceCurrentItem(with: nil)
    player = nil
    queue = []
    queueIndex = 0
    repeatQueue = false
    state = "idle"
    lastError = ""
    MPNowPlayingInfoCenter.default().nowPlayingInfo = nil
  }

  func next() {
    onMain {
      guard !self.queue.isEmpty else { return }
      if self.queueIndex + 1 < self.queue.count { self.queueIndex += 1 }
      else if self.repeatQueue { self.queueIndex = 0 }
      else { return }
      self.playCurrent()
    }
  }

  func previous() {
    onMain {
      guard !self.queue.isEmpty else { return }
      if self.currentPositionMs() > 5000 { self.seekTo(ms: 0); return }
      self.queueIndex = max(self.queueIndex - 1, 0)
      self.playCurrent()
    }
  }

  func seekBy(deltaMs: Int) { onMain { self.seekTo(ms: self.currentPositionMs() + deltaMs) } }
  private func seekTo(ms: Int) {
    guard let player else { return }
    let duration = currentDurationMs()
    let target = min(max(ms, 0), duration > 0 ? duration : Int.max)
    player.seek(to: CMTime(value: CMTimeValue(target), timescale: 1000), toleranceBefore: .zero, toleranceAfter: .zero)
    updateNowPlaying()
  }

  func setSpeed(_ requested: Double) {
    onMain {
      self.speed = Float(min(max(requested, 0.5), 2.0))
      if self.state == "playing" { self.player?.rate = self.speed }
      self.updateNowPlaying()
    }
  }

  func setRepeat(_ repeatPlayback: Bool) { onMain { self.repeatQueue = repeatPlayback } }

  func status() -> [String: Any] {
    return onMainSync {
      let item = self.queue.indices.contains(self.queueIndex) ? self.queue[self.queueIndex] : nil
      return [
        "available": true,
        "state": self.state,
        "positionMs": self.currentPositionMs(),
        "durationMs": self.currentDurationMs(),
        "speed": Double(self.speed),
        "url": item?.url.absoluteString ?? "",
        "title": item?.title ?? "",
        "subtitle": item?.subtitle ?? "",
        "queueIndex": self.queueIndex,
        "queueSize": self.queue.count,
        "repeat": self.repeatQueue,
        "mode": "queue",
        "error": self.lastError
      ]
    }
  }

  private func playCurrent() {
    guard queue.indices.contains(queueIndex) else { state = "idle"; return }
    guard activateSession() else { return }
    clearObservers()
    player?.pause()

    let item = AVPlayerItem(url: queue[queueIndex].url)
    item.preferredForwardBufferDuration = 5
    let newPlayer = AVPlayer(playerItem: item)
    newPlayer.automaticallyWaitsToMinimizeStalling = true
    player = newPlayer
    state = "loading"
    lastError = ""

    endObserver = NotificationCenter.default.addObserver(forName: .AVPlayerItemDidPlayToEndTime, object: item, queue: .main) { [weak self] _ in
      guard let self else { return }
      if self.queueIndex + 1 < self.queue.count {
        self.queueIndex += 1
        self.playCurrent()
      } else if self.repeatQueue && !self.queue.isEmpty {
        self.queueIndex = 0
        self.playCurrent()
      } else {
        self.state = "completed"
        self.updateNowPlaying()
      }
    }

    itemObservation = item.observe(\.status, options: [.initial, .new]) { [weak self, weak item] _, _ in
      guard let self, let item else { return }
      self.onMain {
        switch item.status {
        case .readyToPlay:
          self.player?.playImmediately(atRate: self.speed)
          self.state = "playing"
          self.lastError = ""
          self.updateNowPlaying()
        case .failed:
          self.state = "error"
          self.lastError = item.error?.localizedDescription ?? "Audio stream failed"
          self.updateNowPlaying()
        case .unknown:
          self.state = "loading"
        @unknown default:
          self.state = "loading"
        }
      }
    }
    updateNowPlaying()
  }

  private func clearObservers() {
    itemObservation?.invalidate()
    itemObservation = nil
    if let endObserver {
      NotificationCenter.default.removeObserver(endObserver)
      self.endObserver = nil
    }
  }

  private func currentPositionMs() -> Int {
    guard let player else { return 0 }
    let value = CMTimeGetSeconds(player.currentTime())
    return value.isFinite && !value.isNaN ? max(Int(value * 1000), 0) : 0
  }

  private func currentDurationMs() -> Int {
    guard let duration = player?.currentItem?.duration else { return 0 }
    let value = CMTimeGetSeconds(duration)
    return value.isFinite && !value.isNaN && value > 0 ? Int(value * 1000) : 0
  }

  private func updateNowPlaying() {
    guard queue.indices.contains(queueIndex), state != "idle" else { return }
    let item = queue[queueIndex]
    var info: [String: Any] = [
      MPMediaItemPropertyTitle: item.title,
      MPMediaItemPropertyArtist: item.subtitle,
      MPNowPlayingInfoPropertyElapsedPlaybackTime: Double(currentPositionMs()) / 1000.0,
      MPNowPlayingInfoPropertyPlaybackRate: state == "playing" ? Double(speed) : 0.0
    ]
    let duration = currentDurationMs()
    if duration > 0 { info[MPMediaItemPropertyPlaybackDuration] = Double(duration) / 1000.0 }
    MPNowPlayingInfoCenter.default().nowPlayingInfo = info
  }
}

public class QuranAudioIOSModule: Module {
  public func definition() -> ModuleDefinition {
    Name("QuranAudio")

    AsyncFunction("play") { (url: String, speed: Double) in
      IOSQuranAudioEngine.shared.play(urlString: url, requestedSpeed: speed)
    }
    Function("playQueue") { (json: String, index: Int, repeatPlayback: Bool, speed: Double) in
      IOSQuranAudioEngine.shared.playQueue(json: json, startIndex: index, repeatPlayback: repeatPlayback, requestedSpeed: speed)
    }
    Function("playRange") { (start: Int, end: Int, reciterId: String, bitrate: Int, reciterName: String, repeatPlayback: Bool, speed: Double) in
      IOSQuranAudioEngine.shared.playRange(startAbsolute: start, endAbsolute: end, reciterId: reciterId, bitrate: bitrate, reciterName: reciterName, repeatPlayback: repeatPlayback, requestedSpeed: speed)
    }
    Function("pause") { IOSQuranAudioEngine.shared.pause() }
    Function("resume") { IOSQuranAudioEngine.shared.resume() }
    Function("stop") { IOSQuranAudioEngine.shared.stop() }
    Function("next") { IOSQuranAudioEngine.shared.next() }
    Function("previous") { IOSQuranAudioEngine.shared.previous() }
    Function("seekBy") { (deltaMs: Int) in IOSQuranAudioEngine.shared.seekBy(deltaMs: deltaMs) }
    Function("setSpeed") { (speed: Double) in IOSQuranAudioEngine.shared.setSpeed(speed) }
    Function("setRepeat") { (repeatPlayback: Bool) in IOSQuranAudioEngine.shared.setRepeat(repeatPlayback) }
    Function("getStatus") { IOSQuranAudioEngine.shared.status() }
  }
}
