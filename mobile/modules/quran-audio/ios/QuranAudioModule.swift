import AVFoundation
import ExpoModulesCore
import Foundation
import MediaPlayer

private struct HassounQueueItem {
  let url: String
  let title: String
  let subtitle: String
}

private final class HassounQuranPlayer: NSObject {
  static let shared = HassounQuranPlayer()

  private var player: AVPlayer?
  private var queue: [HassounQueueItem] = []
  private var queueIndex = 0
  private var repeatQueue = false
  private var requestedSpeed: Float = 1.0
  private var playbackState = "idle"
  private var rangeStart = 1
  private var rangeEnd = 0
  private var rangeBase = ""
  private var rangeReciterName = "Hassoun"
  private var rangeActive = false
  private var endObserver: NSObjectProtocol?
  private var failedObserver: NSObjectProtocol?
  private var retryCount = 0
  private var resumeSeconds: Double = 0
  private let maxRetries = 3

  private let ayahCounts = [
    7,286,200,176,120,165,206,75,129,109,123,111,43,52,99,128,111,110,98,135,112,78,118,64,77,227,93,88,69,60,
    34,30,73,54,45,83,182,88,75,85,54,53,89,59,37,35,38,29,18,45,60,49,62,55,78,96,29,22,24,13,
    14,11,11,18,12,12,30,52,52,44,28,28,20,56,40,31,50,40,46,42,29,19,36,25,22,17,19,26,30,20,
    15,21,11,8,8,19,5,8,8,11,11,8,3,9,5,4,7,3,6,3,5,4,5,6
  ]

  private override init() {
    super.init()
    configureRemoteCommands()
  }

  deinit {
    removeObservers()
  }

  private func bridgeValue(_ value: String?) -> Any {
    guard let value else { return NSNull() }
    return value
  }

  private func configureAudioSession() {
    let session = AVAudioSession.sharedInstance()
    do {
      try session.setCategory(.playback, mode: .spokenAudio, options: [.allowAirPlay, .allowBluetoothA2DP])
      try session.setActive(true)
    } catch {
      // Playback may still work; status will report an error if AVPlayer fails.
    }
  }

  private func configureRemoteCommands() {
    let commands = MPRemoteCommandCenter.shared()
    commands.playCommand.isEnabled = true
    commands.pauseCommand.isEnabled = true
    commands.stopCommand.isEnabled = true
    commands.nextTrackCommand.isEnabled = true
    commands.previousTrackCommand.isEnabled = true
    commands.changePlaybackPositionCommand.isEnabled = true

    commands.playCommand.addTarget { [weak self] _ in self?.resume(); return .success }
    commands.pauseCommand.addTarget { [weak self] _ in self?.pause(); return .success }
    commands.stopCommand.addTarget { [weak self] _ in self?.stop(); return .success }
    commands.nextTrackCommand.addTarget { [weak self] _ in self?.next(); return .success }
    commands.previousTrackCommand.addTarget { [weak self] _ in self?.previous(); return .success }
    commands.changePlaybackPositionCommand.addTarget { [weak self] event in
      guard let event = event as? MPChangePlaybackPositionCommandEvent else { return .commandFailed }
      self?.seek(toSeconds: event.positionTime)
      return .success
    }
  }

  private func currentQueueSize() -> Int {
    return rangeActive ? max(0, rangeEnd - rangeStart + 1) : queue.count
  }

  private func surahAyah(absolute: Int) -> (Int, Int) {
    var remaining = max(1, absolute)
    for (index, count) in ayahCounts.enumerated() {
      if remaining <= count { return (index + 1, remaining) }
      remaining -= count
    }
    return (114, ayahCounts.last ?? 6)
  }

  private func currentItem() -> HassounQueueItem? {
    if !rangeActive { return queue.indices.contains(queueIndex) ? queue[queueIndex] : nil }
    let absolute = rangeStart + queueIndex
    guard absolute >= rangeStart && absolute <= rangeEnd, !rangeBase.isEmpty else { return nil }
    let (surah, ayah) = surahAyah(absolute: absolute)
    return HassounQueueItem(
      url: "\(rangeBase)/\(absolute).mp3",
      title: "Surah \(surah) • Ayah \(ayah)",
      subtitle: "\(rangeReciterName) • Hassoun"
    )
  }

  func playSingle(url: String, speed: Double) {
    playQueue(json: "[{\"url\":\"\(url.replacingOccurrences(of: "\"", with: "\\\""))\",\"title\":\"Qur’an\",\"subtitle\":\"Hassoun\"}]", startIndex: 0, repeatQueue: false, speed: speed)
  }

  func playQueue(json: String, startIndex: Int, repeatQueue: Bool, speed: Double) {
    guard let data = json.data(using: .utf8),
          let raw = try? JSONSerialization.jsonObject(with: data) as? [[String: Any]] else {
      playbackState = "error"
      return
    }
    let parsed = raw.compactMap { item -> HassounQueueItem? in
      guard let url = item["url"] as? String, !url.isEmpty else { return nil }
      return HassounQueueItem(url: url, title: (item["title"] as? String) ?? "Qur’an", subtitle: (item["subtitle"] as? String) ?? "Hassoun")
    }
    rangeActive = false
    rangeStart = 1
    rangeEnd = 0
    rangeBase = ""
    queue = parsed
    queueIndex = min(max(startIndex, 0), max(parsed.count - 1, 0))
    self.repeatQueue = repeatQueue
    requestedSpeed = Float(min(max(speed, 0.5), 2.0))
    retryCount = 0
    resumeSeconds = 0
    if queue.isEmpty { stop() } else { playCurrent() }
  }

  func playRange(start: Int, end: Int, reciterId: String, bitrate: Int, reciterName: String, repeatQueue: Bool, speed: Double) {
    queue = []
    rangeStart = max(1, start)
    rangeEnd = max(rangeStart, end)
    let safeBitrate = max(32, bitrate)
    rangeBase = "https://cdn.islamic.network/quran/audio/\(safeBitrate)/\(reciterId.trimmingCharacters(in: .whitespacesAndNewlines))"
    rangeReciterName = reciterName.isEmpty ? "Hassoun" : reciterName
    rangeActive = !reciterId.isEmpty
    queueIndex = 0
    self.repeatQueue = repeatQueue
    requestedSpeed = Float(min(max(speed, 0.5), 2.0))
    retryCount = 0
    resumeSeconds = 0
    if rangeActive { playCurrent() } else { stop() }
  }

  private func playCurrent() {
    guard let item = currentItem(), let url = URL(string: item.url) else {
      playbackState = "error"
      updateNowPlaying()
      return
    }

    configureAudioSession()
    removeObservers()
    player?.pause()
    let playerItem = AVPlayerItem(url: url)
    let nextPlayer = AVPlayer(playerItem: playerItem)
    player = nextPlayer
    playbackState = "loading"
    updateNowPlaying()

    endObserver = NotificationCenter.default.addObserver(forName: .AVPlayerItemDidPlayToEndTime, object: playerItem, queue: .main) { [weak self] _ in
      self?.completedCurrent()
    }
    failedObserver = NotificationCenter.default.addObserver(forName: .AVPlayerItemFailedToPlayToEndTime, object: playerItem, queue: .main) { [weak self] _ in
      self?.retryOrAdvance()
    }

    if resumeSeconds > 0 {
      nextPlayer.seek(to: CMTime(seconds: resumeSeconds, preferredTimescale: 1000))
    }
    nextPlayer.playImmediately(atRate: requestedSpeed)
    playbackState = "playing"
    retryCount = 0
    resumeSeconds = 0
    updateNowPlaying()
  }

  private func completedCurrent() {
    retryCount = 0
    resumeSeconds = 0
    if queueIndex + 1 < currentQueueSize() {
      queueIndex += 1
      playCurrent()
    } else if repeatQueue && currentQueueSize() > 0 {
      queueIndex = 0
      playCurrent()
    } else {
      playbackState = "completed"
      player?.pause()
      updateNowPlaying()
    }
  }

  private func retryOrAdvance() {
    resumeSeconds = currentSeconds()
    if retryCount < maxRetries {
      retryCount += 1
      playbackState = "loading"
      updateNowPlaying()
      let delay = Double(retryCount) * 1.25
      DispatchQueue.main.asyncAfter(deadline: .now() + delay) { [weak self] in self?.playCurrent() }
      return
    }
    retryCount = 0
    resumeSeconds = 0
    if queueIndex + 1 < currentQueueSize() {
      queueIndex += 1
      playCurrent()
    } else if repeatQueue && currentQueueSize() > 0 {
      queueIndex = 0
      playCurrent()
    } else {
      playbackState = "error"
      updateNowPlaying()
    }
  }

  func pause() {
    player?.pause()
    if player != nil { playbackState = "paused" }
    updateNowPlaying()
  }

  func resume() {
    guard let player else {
      if currentQueueSize() > 0 { playCurrent() }
      return
    }
    player.playImmediately(atRate: requestedSpeed)
    playbackState = "playing"
    updateNowPlaying()
  }

  func stop() {
    removeObservers()
    player?.pause()
    player = nil
    queue = []
    queueIndex = 0
    repeatQueue = false
    rangeActive = false
    rangeStart = 1
    rangeEnd = 0
    rangeBase = ""
    playbackState = "idle"
    retryCount = 0
    resumeSeconds = 0
    MPNowPlayingInfoCenter.default().nowPlayingInfo = nil
    do { try AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation) } catch {}
  }

  func next() {
    let size = currentQueueSize()
    guard size > 0 else { return }
    if queueIndex + 1 < size { queueIndex += 1 }
    else if repeatQueue { queueIndex = 0 }
    else { return }
    resumeSeconds = 0
    playCurrent()
  }

  func previous() {
    guard currentQueueSize() > 0 else { return }
    if currentSeconds() > 5 {
      seek(toSeconds: 0)
      return
    }
    queueIndex = max(0, queueIndex - 1)
    resumeSeconds = 0
    playCurrent()
  }

  private func currentSeconds() -> Double {
    guard let value = player?.currentTime().seconds, value.isFinite else { return 0 }
    return max(0, value)
  }

  private func durationSeconds() -> Double {
    guard let value = player?.currentItem?.duration.seconds, value.isFinite else { return 0 }
    return max(0, value)
  }

  func seekBy(milliseconds: Int) {
    seek(toSeconds: currentSeconds() + Double(milliseconds) / 1000.0)
  }

  func seek(toSeconds seconds: Double) {
    let duration = durationSeconds()
    let target = max(0, duration > 0 ? min(seconds, duration) : seconds)
    player?.seek(to: CMTime(seconds: target, preferredTimescale: 1000))
    updateNowPlaying()
  }

  func setSpeed(_ speed: Double) {
    requestedSpeed = Float(min(max(speed, 0.5), 2.0))
    if playbackState == "playing" { player?.rate = requestedSpeed }
    updateNowPlaying()
  }

  func setRepeat(_ repeatQueue: Bool) {
    self.repeatQueue = repeatQueue
    updateNowPlaying()
  }

  func status() -> [String: Any] {
    let item = currentItem()
    return [
      "available": true,
      "state": playbackState,
      "positionMs": Int(currentSeconds() * 1000),
      "durationMs": Int(durationSeconds() * 1000),
      "speed": Double(requestedSpeed),
      "url": bridgeValue(item?.url),
      "title": bridgeValue(item?.title),
      "subtitle": bridgeValue(item?.subtitle),
      "queueIndex": queueIndex,
      "queueSize": currentQueueSize(),
      "repeat": repeatQueue,
      "mode": rangeActive ? "range" : "queue"
    ]
  }

  private func updateNowPlaying() {
    guard let item = currentItem(), playbackState != "idle" else {
      if playbackState == "idle" { MPNowPlayingInfoCenter.default().nowPlayingInfo = nil }
      return
    }
    let duration = durationSeconds()
    var info: [String: Any] = [
      MPMediaItemPropertyTitle: item.title,
      MPMediaItemPropertyArtist: item.subtitle,
      MPNowPlayingInfoPropertyElapsedPlaybackTime: currentSeconds(),
      MPNowPlayingInfoPropertyPlaybackRate: playbackState == "playing" ? Double(requestedSpeed) : 0.0
    ]
    if duration > 0 { info[MPMediaItemPropertyPlaybackDuration] = duration }
    MPNowPlayingInfoCenter.default().nowPlayingInfo = info
  }

  private func removeObservers() {
    if let endObserver { NotificationCenter.default.removeObserver(endObserver); self.endObserver = nil }
    if let failedObserver { NotificationCenter.default.removeObserver(failedObserver); self.failedObserver = nil }
  }
}

public class QuranAudioModule: Module {
  public func definition() -> ModuleDefinition {
    Name("QuranAudio")

    AsyncFunction("play") { (url: String, speed: Double) in
      HassounQuranPlayer.shared.playSingle(url: url, speed: speed)
    }
    Function("playQueue") { (itemsJson: String, startIndex: Int, repeatQueue: Bool, speed: Double) in
      HassounQuranPlayer.shared.playQueue(json: itemsJson, startIndex: startIndex, repeatQueue: repeatQueue, speed: speed)
    }
    Function("playRange") { (startAbsolute: Int, endAbsolute: Int, reciterId: String, bitrate: Int, reciterName: String, repeatQueue: Bool, speed: Double) in
      HassounQuranPlayer.shared.playRange(start: startAbsolute, end: endAbsolute, reciterId: reciterId, bitrate: bitrate, reciterName: reciterName, repeatQueue: repeatQueue, speed: speed)
    }
    Function("pause") { HassounQuranPlayer.shared.pause() }
    Function("resume") { HassounQuranPlayer.shared.resume() }
    Function("stop") { HassounQuranPlayer.shared.stop() }
    Function("next") { HassounQuranPlayer.shared.next() }
    Function("previous") { HassounQuranPlayer.shared.previous() }
    Function("seekBy") { (deltaMs: Int) in HassounQuranPlayer.shared.seekBy(milliseconds: deltaMs) }
    Function("setSpeed") { (speed: Double) in HassounQuranPlayer.shared.setSpeed(speed) }
    Function("setRepeat") { (repeatQueue: Bool) in HassounQuranPlayer.shared.setRepeat(repeatQueue) }
    Function("getStatus") { HassounQuranPlayer.shared.status() }
  }
}
