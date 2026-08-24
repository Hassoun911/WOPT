import AVFoundation
import ExpoModulesCore
import MediaPlayer

private struct QuranQueueItem {
  let url: URL
  let title: String
  let subtitle: String
}

private final class QuranAudioEngine: NSObject {
  static let shared = QuranAudioEngine()

  private var player: AVPlayer?
  private var itemObservation: NSKeyValueObservation?
  private var endObserver: NSObjectProtocol?
  private var interruptionObserver: NSObjectProtocol?
  private var queue: [QuranQueueItem] = []
  private var queueIndex = 0
  private var repeatQueue = false
  private var speed: Float = 1.0
  private var state = "idle"
  private var rangeActive = false
  private var rangeStartAbsolute = 1
  private var rangeEndAbsolute = 0
  private var rangeReciterBase = ""
  private var rangeReciterName = "Hassoun"
  private var retryCount = 0
  private var resumePositionMs = 0
  private var remoteCommandTargets: [(MPRemoteCommand, Any)] = []

  private let maxStreamRetries = 3

  override private init() {
    super.init()
    configureAudioSession()
    configureRemoteCommands()
    interruptionObserver = NotificationCenter.default.addObserver(
      forName: AVAudioSession.interruptionNotification,
      object: AVAudioSession.sharedInstance(),
      queue: .main
    ) { [weak self] notification in
      self?.handleInterruption(notification)
    }
  }

  deinit {
    if let observer = interruptionObserver {
      NotificationCenter.default.removeObserver(observer)
    }
    clearPlayerObservers()
  }

  private func configureAudioSession() {
    do {
      let session = AVAudioSession.sharedInstance()
      try session.setCategory(.playback, mode: .spokenAudio, options: [.allowAirPlay])
      try session.setActive(true)
    } catch {
      state = "error"
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

    remoteCommandTargets.append((center.playCommand, center.playCommand.addTarget { [weak self] _ in
      self?.resume()
      return .success
    }))
    remoteCommandTargets.append((center.pauseCommand, center.pauseCommand.addTarget { [weak self] _ in
      self?.pause()
      return .success
    }))
    remoteCommandTargets.append((center.stopCommand, center.stopCommand.addTarget { [weak self] _ in
      self?.stop()
      return .success
    }))
    remoteCommandTargets.append((center.nextTrackCommand, center.nextTrackCommand.addTarget { [weak self] _ in
      self?.next()
      return .success
    }))
    remoteCommandTargets.append((center.previousTrackCommand, center.previousTrackCommand.addTarget { [weak self] _ in
      self?.previous()
      return .success
    }))
    remoteCommandTargets.append((center.changePlaybackPositionCommand, center.changePlaybackPositionCommand.addTarget { [weak self] event in
      guard let self, let positionEvent = event as? MPChangePlaybackPositionCommandEvent else {
        return .commandFailed
      }
      self.seekTo(milliseconds: Int(positionEvent.positionTime * 1000.0))
      return .success
    }))
  }

  private func activateSessionIfNeeded() {
    do {
      try AVAudioSession.sharedInstance().setActive(true)
    } catch {
      state = "error"
    }
  }

  func play(urlString: String, requestedSpeed: Double) {
    guard let url = URL(string: urlString) else {
      state = "error"
      return
    }
    playQueue(
      items: [QuranQueueItem(url: url, title: "Qur’an", subtitle: "Hassoun")],
      startIndex: 0,
      repeatPlayback: false,
      requestedSpeed: requestedSpeed
    )
  }

  func playQueue(json: String, startIndex: Int, repeatPlayback: Bool, requestedSpeed: Double) {
    guard let data = json.data(using: .utf8),
          let raw = try? JSONSerialization.jsonObject(with: data) as? [[String: Any]] else {
      stop()
      state = "error"
      return
    }

    let parsed = raw.compactMap { entry -> QuranQueueItem? in
      guard let urlString = entry["url"] as? String,
            !urlString.isEmpty,
            let url = URL(string: urlString) else { return nil }
      let title = (entry["title"] as? String)?.isEmpty == false ? entry["title"] as! String : "Qur’an"
      let subtitle = (entry["subtitle"] as? String)?.isEmpty == false ? entry["subtitle"] as! String : "Hassoun"
      return QuranQueueItem(url: url, title: title, subtitle: subtitle)
    }

    rangeActive = false
    rangeEndAbsolute = 0
    queue = parsed
    queueIndex = parsed.isEmpty ? 0 : min(max(startIndex, 0), parsed.count - 1)
    repeatQueue = repeatPlayback
    speed = clampedSpeed(requestedSpeed)
    retryCount = 0
    resumePositionMs = 0

    if queue.isEmpty {
      stop()
    } else {
      playCurrent()
    }
  }

  func playRange(
    startAbsolute: Int,
    endAbsolute: Int,
    reciterId: String,
    bitrate: Int,
    reciterName: String,
    repeatPlayback: Bool,
    requestedSpeed: Double
  ) {
    let safeStart = max(startAbsolute, 1)
    let safeEnd = max(endAbsolute, safeStart)
    let cleanReciter = reciterId.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !cleanReciter.isEmpty else {
      stop()
      state = "error"
      return
    }

    queue = []
    rangeStartAbsolute = safeStart
    rangeEndAbsolute = safeEnd
    rangeReciterBase = "https://cdn.islamic.network/quran/audio/\(max(bitrate, 32))/\(cleanReciter)"
    rangeReciterName = reciterName.isEmpty ? "Hassoun" : reciterName
    rangeActive = true
    queueIndex = 0
    repeatQueue = repeatPlayback
    speed = clampedSpeed(requestedSpeed)
    retryCount = 0
    resumePositionMs = 0
    playCurrent()
  }

  func pause() {
    guard let player else { return }
    player.pause()
    if state != "idle" && state != "completed" {
      state = "paused"
    }
    updateNowPlaying()
  }

  func resume() {
    if player == nil {
      if currentQueueSize() > 0 {
        playCurrent()
      }
      return
    }
    activateSessionIfNeeded()
    if state == "completed" {
      player?.seek(to: .zero)
    }
    player?.playImmediately(atRate: speed)
    state = "playing"
    updateNowPlaying()
  }

  func stop() {
    releasePlayer()
    queue = []
    queueIndex = 0
    repeatQueue = false
    rangeActive = false
    rangeStartAbsolute = 1
    rangeEndAbsolute = 0
    rangeReciterBase = ""
    rangeReciterName = "Hassoun"
    retryCount = 0
    resumePositionMs = 0
    state = "idle"
    MPNowPlayingInfoCenter.default().nowPlayingInfo = nil
  }

  func next() {
    let size = currentQueueSize()
    guard size > 0 else { return }
    if queueIndex + 1 < size {
      queueIndex += 1
    } else if repeatQueue {
      queueIndex = 0
    } else {
      return
    }
    retryCount = 0
    resumePositionMs = 0
    playCurrent()
  }

  func previous() {
    guard currentQueueSize() > 0 else { return }
    if currentPositionMs() > 5000 {
      seekTo(milliseconds: 0)
      return
    }
    queueIndex = max(queueIndex - 1, 0)
    retryCount = 0
    resumePositionMs = 0
    playCurrent()
  }

  func seekBy(deltaMs: Int) {
    seekTo(milliseconds: currentPositionMs() + deltaMs)
  }

  func setSpeed(_ requestedSpeed: Double) {
    speed = clampedSpeed(requestedSpeed)
    if state == "playing" {
      player?.rate = speed
    }
    updateNowPlaying()
  }

  func setRepeat(_ repeatPlayback: Bool) {
    repeatQueue = repeatPlayback
  }

  func status() -> [String: Any] {
    var resolvedState = state
    if let player {
      switch player.timeControlStatus {
      case .playing:
        resolvedState = "playing"
      case .waitingToPlayAtSpecifiedRate:
        if state != "paused" { resolvedState = "loading" }
      case .paused:
        break
      @unknown default:
        break
      }
    }

    let item = currentItem()
    return [
      "available": true,
      "state": resolvedState,
      "positionMs": currentPositionMs(),
      "durationMs": currentDurationMs(),
      "speed": Double(speed),
      "url": item?.url.absoluteString ?? NSNull(),
      "title": item?.title ?? NSNull(),
      "subtitle": item?.subtitle ?? NSNull(),
      "queueIndex": queueIndex,
      "queueSize": currentQueueSize(),
      "repeat": repeatQueue,
      "mode": rangeActive ? "range" : "queue"
    ]
  }

  private func clampedSpeed(_ value: Double) -> Float {
    return Float(min(max(value, 0.5), 2.0))
  }

  private func currentQueueSize() -> Int {
    if rangeActive {
      return max(rangeEndAbsolute - rangeStartAbsolute + 1, 0)
    }
    return queue.count
  }

  private func currentItem() -> QuranQueueItem? {
    if !rangeActive {
      guard queue.indices.contains(queueIndex) else { return nil }
      return queue[queueIndex]
    }

    let absolute = rangeStartAbsolute + queueIndex
    guard absolute >= rangeStartAbsolute && absolute <= rangeEndAbsolute else { return nil }
    guard let url = URL(string: "\(rangeReciterBase)/\(absolute).mp3") else { return nil }
    let ref = surahAyahForAbsolute(absolute)
    return QuranQueueItem(
      url: url,
      title: "Surah \(ref.surah) • Ayah \(ref.ayah)",
      subtitle: "\(rangeReciterName) • Hassoun"
    )
  }

  private func playCurrent(startPositionMs: Int = 0) {
    guard let queueItem = currentItem() else {
      stop()
      return
    }

    activateSessionIfNeeded()
    releasePlayer()
    state = "loading"

    let playerItem = AVPlayerItem(url: queueItem.url)
    let newPlayer = AVPlayer(playerItem: playerItem)
    newPlayer.automaticallyWaitsToMinimizeStalling = true
    player = newPlayer

    endObserver = NotificationCenter.default.addObserver(
      forName: .AVPlayerItemDidPlayToEndTime,
      object: playerItem,
      queue: .main
    ) { [weak self] _ in
      self?.handleCompletion()
    }

    itemObservation = playerItem.observe(\.status, options: [.initial, .new]) { [weak self, weak playerItem] _, _ in
      guard let self, let playerItem else { return }
      DispatchQueue.main.async {
        switch playerItem.status {
        case .readyToPlay:
          let seekMs = max(startPositionMs, 0)
          if seekMs > 0 {
            let time = CMTime(value: CMTimeValue(seekMs), timescale: 1000)
            self.player?.seek(to: time, toleranceBefore: .zero, toleranceAfter: .zero) { [weak self] _ in
              guard let self else { return }
              self.player?.playImmediately(atRate: self.speed)
              self.state = "playing"
              self.retryCount = 0
              self.resumePositionMs = 0
              self.updateNowPlaying()
            }
          } else {
            self.player?.playImmediately(atRate: self.speed)
            self.state = "playing"
            self.retryCount = 0
            self.resumePositionMs = 0
            self.updateNowPlaying()
          }
        case .failed:
          self.retryOrAdvance()
        case .unknown:
          self.state = "loading"
        @unknown default:
          self.state = "loading"
        }
      }
    }

    updateNowPlaying()
  }

  private func retryOrAdvance() {
    resumePositionMs = currentPositionMs()
    releasePlayer()

    if retryCount < maxStreamRetries {
      retryCount += 1
      state = "loading"
      let delay = Double(retryCount) * 1.2
      DispatchQueue.main.asyncAfter(deadline: .now() + delay) { [weak self] in
        guard let self else { return }
        self.playCurrent(startPositionMs: self.resumePositionMs)
      }
      return
    }

    retryCount = 0
    resumePositionMs = 0
    if queueIndex + 1 < currentQueueSize() {
      queueIndex += 1
      playCurrent()
    } else if repeatQueue && currentQueueSize() > 0 {
      queueIndex = 0
      playCurrent()
    } else {
      state = "error"
      updateNowPlaying()
    }
  }

  private func handleCompletion() {
    retryCount = 0
    resumePositionMs = 0
    if queueIndex + 1 < currentQueueSize() {
      queueIndex += 1
      playCurrent()
    } else if repeatQueue && currentQueueSize() > 0 {
      queueIndex = 0
      playCurrent()
    } else {
      state = "completed"
      player?.pause()
      updateNowPlaying()
    }
  }

  private func seekTo(milliseconds: Int) {
    guard let player else { return }
    let duration = currentDurationMs()
    let upperBound = duration > 0 ? duration : Int.max
    let target = min(max(milliseconds, 0), upperBound)
    let time = CMTime(value: CMTimeValue(target), timescale: 1000)
    player.seek(to: time, toleranceBefore: .zero, toleranceAfter: .zero)
    updateNowPlaying()
  }

  private func releasePlayer() {
    itemObservation?.invalidate()
    itemObservation = nil
    if let observer = endObserver {
      NotificationCenter.default.removeObserver(observer)
      endObserver = nil
    }
    player?.pause()
    player?.replaceCurrentItem(with: nil)
    player = nil
  }

  private func clearPlayerObservers() {
    itemObservation?.invalidate()
    itemObservation = nil
    if let observer = endObserver {
      NotificationCenter.default.removeObserver(observer)
      endObserver = nil
    }
  }

  private func currentPositionMs() -> Int {
    guard let player else { return 0 }
    let seconds = CMTimeGetSeconds(player.currentTime())
    guard seconds.isFinite && !seconds.isNaN else { return 0 }
    return max(Int(seconds * 1000.0), 0)
  }

  private func currentDurationMs() -> Int {
    guard let duration = player?.currentItem?.duration else { return 0 }
    let seconds = CMTimeGetSeconds(duration)
    guard seconds.isFinite && !seconds.isNaN && seconds > 0 else { return 0 }
    return Int(seconds * 1000.0)
  }

  private func updateNowPlaying() {
    guard let item = currentItem(), state != "idle" else {
      if state == "idle" {
        MPNowPlayingInfoCenter.default().nowPlayingInfo = nil
      }
      return
    }

    var info: [String: Any] = [
      MPMediaItemPropertyTitle: item.title,
      MPMediaItemPropertyArtist: item.subtitle,
      MPNowPlayingInfoPropertyElapsedPlaybackTime: Double(currentPositionMs()) / 1000.0,
      MPNowPlayingInfoPropertyPlaybackRate: state == "playing" ? Double(speed) : 0.0
    ]

    let durationSeconds = Double(currentDurationMs()) / 1000.0
    if durationSeconds > 0 {
      info[MPMediaItemPropertyPlaybackDuration] = durationSeconds
    }
    MPNowPlayingInfoCenter.default().nowPlayingInfo = info
  }

  private func handleInterruption(_ notification: Notification) {
    guard let rawType = notification.userInfo?[AVAudioSessionInterruptionTypeKey] as? UInt,
          let type = AVAudioSession.InterruptionType(rawValue: rawType) else { return }

    switch type {
    case .began:
      if state == "playing" {
        player?.pause()
        state = "paused"
        updateNowPlaying()
      }
    case .ended:
      guard let rawOptions = notification.userInfo?[AVAudioSessionInterruptionOptionKey] as? UInt else { return }
      let options = AVAudioSession.InterruptionOptions(rawValue: rawOptions)
      if options.contains(.shouldResume) {
        resume()
      }
    @unknown default:
      break
    }
  }

  private func surahAyahForAbsolute(_ absolute: Int) -> (surah: Int, ayah: Int) {
    var remaining = max(absolute, 1)
    for (index, count) in Self.ayahCounts.enumerated() {
      if remaining <= count {
        return (index + 1, remaining)
      }
      remaining -= count
    }
    return (114, Self.ayahCounts.last ?? 6)
  }

  private static let ayahCounts = [
    7,286,200,176,120,165,206,75,129,109,123,111,43,52,99,128,111,110,98,135,112,78,118,64,77,227,93,88,69,60,
    34,30,73,54,45,83,182,88,75,85,54,53,89,59,37,35,38,29,18,45,60,49,62,55,78,96,29,22,24,13,
    14,11,11,18,12,12,30,52,52,44,28,28,20,56,40,31,50,40,46,42,29,19,36,25,22,17,19,26,30,20,
    15,21,11,8,8,19,5,8,8,11,11,8,3,9,5,4,7,3,6,3,5,4,5,6
  ]
}

public class QuranAudioModule: Module {
  public func definition() -> ModuleDefinition {
    Name("QuranAudio")

    AsyncFunction("play") { (url: String, requestedSpeed: Double) in
      QuranAudioEngine.shared.play(urlString: url, requestedSpeed: requestedSpeed)
    }

    Function("playQueue") { (itemsJson: String, startIndex: Int, repeatPlayback: Bool, requestedSpeed: Double) in
      QuranAudioEngine.shared.playQueue(
        json: itemsJson,
        startIndex: startIndex,
        repeatPlayback: repeatPlayback,
        requestedSpeed: requestedSpeed
      )
    }

    Function("playRange") { (
      startAbsolute: Int,
      endAbsolute: Int,
      reciterId: String,
      bitrate: Int,
      reciterName: String,
      repeatPlayback: Bool,
      requestedSpeed: Double
    ) in
      QuranAudioEngine.shared.playRange(
        startAbsolute: startAbsolute,
        endAbsolute: endAbsolute,
        reciterId: reciterId,
        bitrate: bitrate,
        reciterName: reciterName,
        repeatPlayback: repeatPlayback,
        requestedSpeed: requestedSpeed
      )
    }

    Function("pause") {
      QuranAudioEngine.shared.pause()
    }

    Function("resume") {
      QuranAudioEngine.shared.resume()
    }

    Function("stop") {
      QuranAudioEngine.shared.stop()
    }

    Function("next") {
      QuranAudioEngine.shared.next()
    }

    Function("previous") {
      QuranAudioEngine.shared.previous()
    }

    Function("seekBy") { (deltaMs: Int) in
      QuranAudioEngine.shared.seekBy(deltaMs: deltaMs)
    }

    Function("setSpeed") { (requestedSpeed: Double) in
      QuranAudioEngine.shared.setSpeed(requestedSpeed)
    }

    Function("setRepeat") { (repeatPlayback: Bool) in
      QuranAudioEngine.shared.setRepeat(repeatPlayback)
    }

    Function("getStatus") {
      return QuranAudioEngine.shared.status()
    }
  }
}
