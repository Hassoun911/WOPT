import type { ExpoConfig } from "expo/config";

const config: ExpoConfig = {
  name: "Windsor Prayer Times",
  slug: "wopt",
  owner: "hassoun911",
  scheme: "windsorprayer",
  version: "0.3.4",
  orientation: "portrait",
  icon: "./assets/icon.png",
  userInterfaceStyle: "automatic",
  ios: {
    supportsTablet: true,
    bundleIdentifier: "ca.wopt.windsorprayertimes",
    infoPlist: {
      UIBackgroundModes: ["remote-notification"],
      NSLocationWhenInUseUsageDescription: "WOPT uses your location to automatically select the correct local prayer times and email alert time zone."
    }
  },
  android: {
    package: "ca.wopt.windsorprayertimes",
    versionCode: 7,
    adaptiveIcon: {
      foregroundImage: "./assets/adaptive-icon.png",
      backgroundColor: "#0b5b47"
    },
    permissions: [
      "android.permission.POST_NOTIFICATIONS",
      "android.permission.RECEIVE_BOOT_COMPLETED",
      "android.permission.SCHEDULE_EXACT_ALARM",
      "android.permission.FOREGROUND_SERVICE",
      "android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK",
      "android.permission.VIBRATE",
      "android.permission.WAKE_LOCK",
      "android.permission.ACCESS_COARSE_LOCATION",
      "android.permission.ACCESS_FINE_LOCATION"
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