from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]

def write(path: str, content: str) -> None:
    target = ROOT / path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content)

write("mobile/modules/hassoun-widget/index.ts", r'''import { Platform } from "react-native";
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
''')

write("mobile/modules/hassoun-widget/android/src/main/java/ca/wopt/hassounwidget/HassounWidgetModule.kt", r'''package ca.wopt.hassounwidget

import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Context
import android.os.Build
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File

class HassounWidgetModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("HassounWidget")

    Function("setPreferences") { preferences: Map<String, Any?> ->
      val context = appContext.reactContext ?: return@Function null
      val layout = (preferences["layout"] as? String).takeIf { it in setOf("compact", "next", "full", "square", "vertical", "slim") } ?: "full"
      val theme = (preferences["theme"] as? String).takeIf { it in setOf("emerald", "ivory", "ocean", "sunset", "midnight") } ?: "emerald"
      val timeSize = (preferences["timeSize"] as? String).takeIf { it in setOf("small", "medium", "large", "xlarge") } ?: "large"
      val countdownStyle = (preferences["countdownStyle"] as? String).takeIf { it in setOf("circle", "pill", "minimal") } ?: "circle"
      val focus = (preferences["focus"] as? String).takeIf { it in setOf("next", "balanced", "all") } ?: "next"
      val locale = if (preferences["locale"] == "ar") "ar" else "en"

      context.getSharedPreferences(HassounWidgetStore.PREFS, Context.MODE_PRIVATE)
        .edit()
        .putString("layout", layout)
        .putString("theme", theme)
        .putBoolean("showCountdown", preferences["showCountdown"] as? Boolean ?: true)
        .putBoolean("showHijri", preferences["showHijri"] as? Boolean ?: true)
        .putBoolean("showGregorian", preferences["showGregorian"] as? Boolean ?: true)
        .putBoolean("showAllPrayers", preferences["showAllPrayers"] as? Boolean ?: true)
        .putBoolean("showLocation", preferences["showLocation"] as? Boolean ?: false)
        .putBoolean("showLogo", preferences["showLogo"] as? Boolean ?: true)
        .putBoolean("showArabicNames", preferences["showArabicNames"] as? Boolean ?: true)
        .putBoolean("highlightNext", preferences["highlightNext"] as? Boolean ?: true)
        .putString("timeSize", timeSize)
        .putString("countdownStyle", countdownStyle)
        .putString("focus", focus)
        .putString("locale", locale)
        .apply()

      HassounPrayerWidgetProvider.updateAll(context)
      null
    }

    Function("getPreferences") {
      val context = appContext.reactContext
      if (context == null) return@Function defaults()
      val prefs = context.getSharedPreferences(HassounWidgetStore.PREFS, Context.MODE_PRIVATE)
      mapOf(
        "layout" to (prefs.getString("layout", "full") ?: "full"),
        "theme" to (prefs.getString("theme", "emerald") ?: "emerald"),
        "showCountdown" to prefs.getBoolean("showCountdown", true),
        "showHijri" to prefs.getBoolean("showHijri", true),
        "showGregorian" to prefs.getBoolean("showGregorian", true),
        "showAllPrayers" to prefs.getBoolean("showAllPrayers", true),
        "showLocation" to prefs.getBoolean("showLocation", false),
        "showLogo" to prefs.getBoolean("showLogo", true),
        "showArabicNames" to prefs.getBoolean("showArabicNames", true),
        "highlightNext" to prefs.getBoolean("highlightNext", true),
        "timeSize" to (prefs.getString("timeSize", "large") ?: "large"),
        "countdownStyle" to (prefs.getString("countdownStyle", "circle") ?: "circle"),
        "focus" to (prefs.getString("focus", "next") ?: "next"),
        "locale" to (prefs.getString("locale", "en") ?: "en")
      )
    }

    Function("syncPrayerSchedule") { scheduleJson: String, locale: String ->
      val context = appContext.reactContext ?: return@Function null
      File(context.filesDir, HassounWidgetStore.SCHEDULE_FILE).writeText(scheduleJson)
      context.getSharedPreferences(HassounWidgetStore.PREFS, Context.MODE_PRIVATE)
        .edit().putString("locale", if (locale == "ar") "ar" else "en").apply()
      HassounPrayerWidgetProvider.updateAll(context)
      null
    }

    Function("refresh") {
      val context = appContext.reactContext ?: return@Function null
      HassounPrayerWidgetProvider.updateAll(context)
      null
    }

    Function("requestPin") {
      val context = appContext.reactContext ?: return@Function false
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return@Function false
      val manager = AppWidgetManager.getInstance(context)
      if (!manager.isRequestPinAppWidgetSupported) return@Function false
      manager.requestPinAppWidget(ComponentName(context, HassounPrayerWidgetProvider::class.java), null, null)
    }

    Function("getCapabilities") {
      val context = appContext.reactContext
      val pinning = context != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && AppWidgetManager.getInstance(context).isRequestPinAppWidgetSupported
      mapOf(
        "available" to (context != null),
        "pinningSupported" to pinning,
        "lockScreenEligible" to (Build.VERSION.SDK_INT >= 36),
        "sdkInt" to Build.VERSION.SDK_INT
      )
    }
  }

  private fun defaults() = mapOf(
    "layout" to "full", "theme" to "emerald", "showCountdown" to true,
    "showHijri" to true, "showGregorian" to true, "showAllPrayers" to true,
    "showLocation" to false, "showLogo" to true, "showArabicNames" to true,
    "highlightNext" to true, "timeSize" to "large", "countdownStyle" to "circle",
    "focus" to "next", "locale" to "en"
  )
}
''')

print("Converted Hassoun widget preference bridge to a single native preferences object.")
