import { Platform } from "react-native";
import { requireNativeModule } from "expo-modules-core";

export type HassounWidgetLayout = "compact" | "next" | "full";
export type HassounWidgetPreferences = {
  layout: HassounWidgetLayout;
  showCountdown: boolean;
  showHijri: boolean;
  showGregorian: boolean;
  showAllPrayers: boolean;
  showLocation: boolean;
  locale: "en" | "ar";
};

export type HassounWidgetCapabilities = {
  available: boolean;
  pinningSupported: boolean;
  lockScreenEligible: boolean;
  sdkInt: number;
};

type NativeWidget = {
  setPreferences: (
    layout: HassounWidgetLayout,
    showCountdown: boolean,
    showHijri: boolean,
    showGregorian: boolean,
    showAllPrayers: boolean,
    showLocation: boolean,
    locale: "en" | "ar"
  ) => void;
  getPreferences: () => HassounWidgetPreferences;
  syncPrayerSchedule: (scheduleJson: string, locale: "en" | "ar") => void;
  refresh: () => void;
  requestPin: () => boolean;
  getCapabilities: () => HassounWidgetCapabilities;
};

let native: NativeWidget | null = null;
if (Platform.OS === "android") {
  try {
    native = requireNativeModule<NativeWidget>("HassounWidget");
  } catch {
    native = null;
  }
}

const defaults: HassounWidgetPreferences = {
  layout: "next",
  showCountdown: true,
  showHijri: true,
  showGregorian: true,
  showAllPrayers: true,
  showLocation: false,
  locale: "en"
};

const HassounWidget = {
  available: Boolean(native),
  setPreferences(preferences: HassounWidgetPreferences) {
    native?.setPreferences(
      preferences.layout,
      preferences.showCountdown,
      preferences.showHijri,
      preferences.showGregorian,
      preferences.showAllPrayers,
      preferences.showLocation,
      preferences.locale
    );
  },
  getPreferences() {
    return native?.getPreferences() ?? defaults;
  },
  syncPrayerSchedule(scheduleJson: string, locale: "en" | "ar") {
    native?.syncPrayerSchedule(scheduleJson, locale);
  },
  refresh() {
    native?.refresh();
  },
  requestPin() {
    return native?.requestPin() ?? false;
  },
  getCapabilities(): HassounWidgetCapabilities {
    return native?.getCapabilities() ?? { available: false, pinningSupported: false, lockScreenEligible: false, sdkInt: 0 };
  }
};

export default HassounWidget;
