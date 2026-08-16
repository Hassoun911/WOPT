import type { ExpoConfig } from "expo/config";

const config: ExpoConfig = {
  name: "Windsor Prayer Times",
  slug: "windsor-prayer-times",
  scheme: "windsorprayer",
  version: "0.1.0",
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
    pushApiUrl: process.env.EXPO_PUBLIC_PUSH_API_URL ?? "",
    eas: {
      projectId: process.env.EXPO_PUBLIC_EAS_PROJECT_ID ?? ""
    }
  }
};

export default config;
