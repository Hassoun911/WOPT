package ca.wopt.hassounwidget

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

    Function("setPreferences") {
      layout: String,
      theme: String,
      showCountdown: Boolean,
      showHijri: Boolean,
      showGregorian: Boolean,
      showAllPrayers: Boolean,
      showLocation: Boolean,
      locale: String ->
      val context = appContext.reactContext ?: return@Function null
      context.getSharedPreferences(HassounWidgetStore.PREFS, Context.MODE_PRIVATE)
        .edit()
        .putString("layout", layout.takeIf { it in setOf("compact", "next", "full", "square", "vertical", "slim") } ?: "full")
        .putString("theme", theme.takeIf { it in setOf("emerald", "ivory", "ocean", "sunset", "midnight") } ?: "emerald")
        .putBoolean("showCountdown", showCountdown)
        .putBoolean("showHijri", showHijri)
        .putBoolean("showGregorian", showGregorian)
        .putBoolean("showAllPrayers", showAllPrayers)
        .putBoolean("showLocation", showLocation)
        .putString("locale", if (locale == "ar") "ar" else "en")
        .apply()
      HassounPrayerWidgetProvider.updateAll(context)
      null
    }

    Function("getPreferences") {
      val context = appContext.reactContext
      if (context == null) {
        return@Function mapOf(
          "layout" to "full",
          "theme" to "emerald",
          "showCountdown" to true,
          "showHijri" to true,
          "showGregorian" to true,
          "showAllPrayers" to true,
          "showLocation" to false,
          "locale" to "en"
        )
      }
      val prefs = context.getSharedPreferences(HassounWidgetStore.PREFS, Context.MODE_PRIVATE)
      mapOf(
        "layout" to (prefs.getString("layout", "full") ?: "full"),
        "theme" to (prefs.getString("theme", "emerald") ?: "emerald"),
        "showCountdown" to prefs.getBoolean("showCountdown", true),
        "showHijri" to prefs.getBoolean("showHijri", true),
        "showGregorian" to prefs.getBoolean("showGregorian", true),
        "showAllPrayers" to prefs.getBoolean("showAllPrayers", true),
        "showLocation" to prefs.getBoolean("showLocation", false),
        "locale" to (prefs.getString("locale", "en") ?: "en")
      )
    }

    Function("syncPrayerSchedule") { scheduleJson: String, locale: String ->
      val context = appContext.reactContext ?: return@Function null
      File(context.filesDir, HassounWidgetStore.SCHEDULE_FILE).writeText(scheduleJson)
      context.getSharedPreferences(HassounWidgetStore.PREFS, Context.MODE_PRIVATE)
        .edit()
        .putString("locale", if (locale == "ar") "ar" else "en")
        .apply()
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
      val provider = ComponentName(context, HassounPrayerWidgetProvider::class.java)
      manager.requestPinAppWidget(provider, null, null)
    }

    Function("getCapabilities") {
      val context = appContext.reactContext
      val pinning = if (context != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        AppWidgetManager.getInstance(context).isRequestPinAppWidgetSupported
      } else false
      mapOf(
        "available" to (context != null),
        "pinningSupported" to pinning,
        "lockScreenEligible" to (Build.VERSION.SDK_INT >= 36),
        "sdkInt" to Build.VERSION.SDK_INT
      )
    }
  }
}
