import { Platform } from "react-native";
import { requireNativeModule } from "expo-modules-core";

export type HassounWidgetLayout = "compact" | "next" | "full" | "square" | "vertical" | "slim";
export type HassounWidgetTheme = "emerald" | "ivory" | "ocean" | "sunset" | "midnight";
export type HassounWidgetTimeSize = "small" | "medium" | "large" | "xlarge";
export type HassounWidgetCountdownStyle = "circle" | "pill" | "minimal";
export type HassounWidgetFocus = "next" | "balanced" | "all";

export type HassounWidgetPreferences = {
  layout: HassounWidgetLayout;
  theme: HassounWidgetTheme;
  showCountdown: boolean;
  showHijri: boolean;
  showGregorian: boolean;
  showAllPrayers: boolean;
  showLocation: boolean;
  showLogo: boolean;
  showArabicNames: boolean;
  highlightNext: boolean;
  timeSize: HassounWidgetTimeSize;
  countdownStyle: HassounWidgetCountdownStyle;
  focus: HassounWidgetFocus;
  locale: "en" | "ar";
};

export type HassounWidgetCapabilities = {
  available: boolean;
  pinningSupported: boolean;
  lockScreenEligible: boolean;
  sdkInt: number;
};

type NativeWidget = {
  setPreferences: (preferences: HassounWidgetPreferences) => void;
  getPreferences: () => HassounWidgetPreferences;
  syncPrayerSchedule: (scheduleJson: string, locale: "en" | "ar") => void;
  refresh: () => void;
  requestPin: () => boolean;
  getCapabilities: () => HassounWidgetCapabilities;
};

let native: NativeWidget | null = null;
if (Platform.OS === "android") {
  try { native = requireNativeModule<NativeWidget>("HassounWidget"); } catch { native = null; }
}

const defaults: HassounWidgetPreferences = {
  layout: "full",
  theme: "emerald",
  showCountdown: true,
  showHijri: true,
  showGregorian: true,
  showAllPrayers: true,
  showLocation: false,
  showLogo: true,
  showArabicNames: true,
  highlightNext: true,
  timeSize: "large",
  countdownStyle: "circle",
  focus: "next",
  locale: "en"
};

const HassounWidget = {
  available: Boolean(native),
  setPreferences(preferences: HassounWidgetPreferences) {
    native?.setPreferences(preferences);
  },
  getPreferences(): HassounWidgetPreferences {
    return { ...defaults, ...(native?.getPreferences() ?? {}) };
  },
  syncPrayerSchedule(scheduleJson: string, locale: "en" | "ar") { native?.syncPrayerSchedule(scheduleJson, locale); },
  refresh() { native?.refresh(); },
  requestPin() { return native?.requestPin() ?? false; },
  getCapabilities(): HassounWidgetCapabilities {
    return native?.getCapabilities() ?? { available: false, pinningSupported: false, lockScreenEligible: false, sdkInt: 0 };
  }
};

export default HassounWidget;
