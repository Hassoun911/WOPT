import type { ExpoConfig } from "expo/config";

const config: ExpoConfig = {
  name: "Hassoun",
  slug: "wopt",
  owner: "hassoun911",
  scheme: "windsorprayer",
  version: "1.0.7",
  orientation: "portrait",
  icon: "./assets/icon.png",
  userInterfaceStyle: "automatic",
  ios: {
    supportsTablet: false,
    bundleIdentifier: "ca.wopt.windsorprayertimes",
    buildNumber: "2",
    infoPlist: {
      UIBackgroundModes: ["remote-notification", "audio"],
      NSLocationWhenInUseUsageDescription: "Hassoun uses your location to support location-aware features and prayer-time settings when you choose to use them.",
      NSMicrophoneUsageDescription: "Hassoun uses the microphone only when you choose Qur’an recitation practice so the device speech-recognition service can compare your recitation.",
      NSSpeechRecognitionUsageDescription: "Hassoun uses speech recognition only when you choose Qur’an recitation practice so your recitation can be compared on your device."
    }
  },
  android: {
    package: "ca.wopt.windsorprayertimes",
    versionCode: 48,
    icon: "./assets/icon.png",
    permissions: [
      "android.permission.POST_NOTIFICATIONS",
      "android.permission.RECEIVE_BOOT_COMPLETED",
      "android.permission.SCHEDULE_EXACT_ALARM",
      "android.permission.FOREGROUND_SERVICE",
      "android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK",
      "android.permission.VIBRATE",
      "android.permission.WAKE_LOCK",
      "android.permission.ACCESS_COARSE_LOCATION",
      "android.permission.ACCESS_FINE_LOCATION",
      "android.permission.RECORD_AUDIO"
    ]
  },
  plugins: [
    [
      "expo-notifications",
      {
        "icon": "./assets/notification-icon.png",
        "color": "#0b5b47",
        "defaultChannel": "prayer-reminders-v2",
        "sounds": ["./assets/attention_chime.wav"],
        "enableBackgroundRemoteNotifications": true
      }
    ]
  ],
  extra: {
    pushApiUrl: process.env.EXPO_PUBLIC_PUSH_API_URL || "https://wopt-prayer-push.wopt-windsor.workers.dev",
    eas: {
      projectId: process.env.EXPO_PUBLIC_EAS_PROJECT_ID || "69276452-f6f2-4d13-80e8-399ab32746ff"
    }
  }
};

export default config;
