import { requireNativeModule } from "expo-modules-core";
import { Platform } from "react-native";
import { getRemoteControlConfig } from "../../src/remoteControlStore";

export type HassounWidgetLayout = "compact" | "next" | "full" | "square" | "vertical" | "slim";
export type HassounWidgetTheme = "emerald" | "ivory" | "ocean" | "sunset" | "midnight";
export type HassounWidgetAppearance = "light" | "dark" | "auto";
export type HassounWidgetTimeSize = "small" | "medium" | "large" | "xlarge";
export type HassounWidgetCountdownStyle = "circle" | "pill" | "minimal";
export type HassounWidgetFocus = "next" | "balanced" | "all";

export type HassounWidgetPreferences = {
  layout: HassounWidgetLayout;
  theme: HassounWidgetTheme;
  appearance: HassounWidgetAppearance;
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
  appearance: "auto",
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

function enabled() {
  return getRemoteControlConfig().features.widgets;
}

const HassounWidget = {
  get available() { return Boolean(native) && enabled(); },
  setPreferences(preferences: HassounWidgetPreferences) {
    if (enabled()) native?.setPreferences(preferences);
  },
  getPreferences(): HassounWidgetPreferences {
    return { ...defaults, ...(native?.getPreferences() ?? {}) };
  },
  syncPrayerSchedule(scheduleJson: string, locale: "en" | "ar") {
    if (enabled()) native?.syncPrayerSchedule(scheduleJson, locale);
  },
  refresh() {
    if (enabled()) native?.refresh();
  },
  requestPin() {
    return enabled() ? (native?.requestPin() ?? false) : false;
  },
  getCapabilities(): HassounWidgetCapabilities {
    if (!enabled()) return { available: false, pinningSupported: false, lockScreenEligible: false, sdkInt: 0 };
    return native?.getCapabilities() ?? { available: false, pinningSupported: false, lockScreenEligible: false, sdkInt: 0 };
  }
};

export default HassounWidget;
