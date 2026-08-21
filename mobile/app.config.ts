import type { ExpoConfig } from "expo/config";

const appFunctionality = ["NSPrivacyCollectedDataTypePurposeAppFunctionality"];

const config: ExpoConfig = {
  name: "Hassoun",
  slug: "wopt",
  owner: "hassoun911",
  scheme: "windsorprayer",
  version: "1.0.3",
  orientation: "portrait",
  icon: "./assets/icon.png",
  userInterfaceStyle: "automatic",
  ios: {
    supportsTablet: false,
    bundleIdentifier: "ca.wopt.windsorprayertimes",
    buildNumber: "1",
    infoPlist: {
      UIBackgroundModes: ["remote-notification", "audio"],
      NSLocationWhenInUseUsageDescription: "Hassoun uses your location only when you choose location-based prayer email alerts, so it can determine the appropriate local prayer time zone.",
      NSMicrophoneUsageDescription: "Hassoun uses the microphone only when you start Qur’an recitation practice.",
      NSSpeechRecognitionUsageDescription: "Hassoun uses speech recognition only during Qur’an recitation practice to compare your recitation with the selected verses.",
      ITSAppUsesNonExemptEncryption: false
    },
    privacyManifests: {
      NSPrivacyTracking: false,
      NSPrivacyTrackingDomains: [],
      NSPrivacyAccessedAPITypes: [
        {
          NSPrivacyAccessedAPIType: "NSPrivacyAccessedAPICategoryUserDefaults",
          NSPrivacyAccessedAPITypeReasons: ["CA92.1"]
        }
      ],
      NSPrivacyCollectedDataTypes: [
        {
          NSPrivacyCollectedDataType: "NSPrivacyCollectedDataTypeName",
          NSPrivacyCollectedDataTypeLinked: true,
          NSPrivacyCollectedDataTypeTracking: false,
          NSPrivacyCollectedDataTypePurposes: appFunctionality
        },
        {
          NSPrivacyCollectedDataType: "NSPrivacyCollectedDataTypeEmailAddress",
          NSPrivacyCollectedDataTypeLinked: true,
          NSPrivacyCollectedDataTypeTracking: false,
          NSPrivacyCollectedDataTypePurposes: appFunctionality
        },
        {
          NSPrivacyCollectedDataType: "NSPrivacyCollectedDataTypePreciseLocation",
          NSPrivacyCollectedDataTypeLinked: true,
          NSPrivacyCollectedDataTypeTracking: false,
          NSPrivacyCollectedDataTypePurposes: appFunctionality
        },
        {
          NSPrivacyCollectedDataType: "NSPrivacyCollectedDataTypeDeviceID",
          NSPrivacyCollectedDataTypeLinked: true,
          NSPrivacyCollectedDataTypeTracking: false,
          NSPrivacyCollectedDataTypePurposes: appFunctionality
        },
        {
          NSPrivacyCollectedDataType: "NSPrivacyCollectedDataTypeCustomerSupport",
          NSPrivacyCollectedDataTypeLinked: true,
          NSPrivacyCollectedDataTypeTracking: false,
          NSPrivacyCollectedDataTypePurposes: appFunctionality
        },
        {
          NSPrivacyCollectedDataType: "NSPrivacyCollectedDataTypeAudioData",
          NSPrivacyCollectedDataTypeLinked: false,
          NSPrivacyCollectedDataTypeTracking: false,
          NSPrivacyCollectedDataTypePurposes: appFunctionality
        },
        {
          NSPrivacyCollectedDataType: "NSPrivacyCollectedDataTypeGameplayContent",
          NSPrivacyCollectedDataTypeLinked: false,
          NSPrivacyCollectedDataTypeTracking: false,
          NSPrivacyCollectedDataTypePurposes: appFunctionality
        }
      ]
    }
  },
  android: {
    package: "ca.wopt.windsorprayertimes",
    versionCode: 44,
    adaptiveIcon: {
      foregroundImage: "./assets/adaptive-icon.png",
      backgroundColor: "#003d33"
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
    donationUrl: process.env.EXPO_PUBLIC_HASSOUN_DONATION_URL || "",
    eas: {
      projectId: process.env.EXPO_PUBLIC_EAS_PROJECT_ID || "69276452-f6f2-4d13-80e8-399ab32746ff"
    }
  }
};

export default config;
