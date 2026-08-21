import CoreLocation
import ExpoModulesCore
import Foundation

private final class HassounLocationProvider: NSObject, CLLocationManagerDelegate {
  static let shared = HassounLocationProvider()
  private let manager = CLLocationManager()
  private var completion: (([String: Any]?) -> Void)?

  private override init() {
    super.init()
    manager.delegate = self
    manager.desiredAccuracy = kCLLocationAccuracyHundredMeters
  }

  func request(completion: @escaping ([String: Any]?) -> Void) {
    self.completion = completion
    DispatchQueue.main.async {
      let status = self.manager.authorizationStatus
      switch status {
      case .notDetermined:
        self.manager.requestWhenInUseAuthorization()
      case .authorizedAlways, .authorizedWhenInUse:
        self.manager.requestLocation()
      case .denied, .restricted:
        self.finish(nil)
      @unknown default:
        self.finish(nil)
      }
    }
  }

  func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
    switch manager.authorizationStatus {
    case .authorizedAlways, .authorizedWhenInUse:
      if completion != nil { manager.requestLocation() }
    case .denied, .restricted:
      finish(nil)
    case .notDetermined:
      break
    @unknown default:
      finish(nil)
    }
  }

  func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
    guard let location = locations.last else { finish(nil); return }
    finish([
      "latitude": location.coordinate.latitude,
      "longitude": location.coordinate.longitude,
      "accuracy": max(0, location.horizontalAccuracy),
      "city": NSNull(),
      "region": NSNull(),
      "countryCode": NSNull(),
      "countryName": NSNull(),
      "capturedAtMs": Int(location.timestamp.timeIntervalSince1970 * 1000)
    ])
  }

  func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
    finish(nil)
  }

  private func finish(_ value: [String: Any]?) {
    let callback = completion
    completion = nil
    callback?(value)
  }
}

public class PrayerAudioModule: Module {
  public func definition() -> ModuleDefinition {
    Name("PrayerAudio")

    // Exact Android AlarmManager scheduling has no direct iOS equivalent.
    // iOS prayer-time alerts are scheduled through expo-notifications instead.
    Function("canScheduleExactAlarms") { false }

    AsyncFunction("scheduleExactPrayerAlarms") { (_: String) in
      return ["scheduled": 0, "exact": false] as [String: Any]
    }

    AsyncFunction("restoreExactPrayerAlarms") {
      return ["exact": false] as [String: Any]
    }

    AsyncFunction("scheduleTestPrayerAlarm") { (_: String, _: Int) in
      return ["exact": false] as [String: Any]
    }

    AsyncFunction("getCurrentDeviceLocation") { (promise: Promise) in
      HassounLocationProvider.shared.request { location in
        promise.resolve(location)
      }
    }

    AsyncFunction("cancelExactPrayerAlarms") {
      return nil
    }

    Function("openExactAlarmSettings") {
      // No special exact-alarm settings screen exists on iOS.
    }
  }
}
