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
      showCountdown: Boolean,
      showHijri: Boolean,
      showGregorian: Boolean,
      showAllPrayers: Boolean,
      showLocation: Boolean,
      locale: String ->
      val context = appContext.reactContext ?: return@Function
      context.getSharedPreferences(HassounWidgetStore.PREFS, Context.MODE_PRIVATE)
        .edit()
        .putString("layout", layout.takeIf { it in setOf("compact", "next", "full") } ?: "next")
        .putBoolean("showCountdown", showCountdown)
        .putBoolean("showHijri", showHijri)
        .putBoolean("showGregorian", showGregorian)
        .putBoolean("showAllPrayers", showAllPrayers)
        .putBoolean("showLocation", showLocation)
        .putString("locale", if (locale == "ar") "ar" else "en")
        .apply()
      HassounPrayerWidgetProvider.updateAll(context)
    }

    Function("getPreferences") {
      val context = appContext.reactContext
      if (context == null) {
        return@Function mapOf(
          "layout" to "next",
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
        "layout" to (prefs.getString("layout", "next") ?: "next"),
        "showCountdown" to prefs.getBoolean("showCountdown", true),
        "showHijri" to prefs.getBoolean("showHijri", true),
        "showGregorian" to prefs.getBoolean("showGregorian", true),
        "showAllPrayers" to prefs.getBoolean("showAllPrayers", true),
        "showLocation" to prefs.getBoolean("showLocation", false),
        "locale" to (prefs.getString("locale", "en") ?: "en")
      )
    }

    Function("syncPrayerSchedule") { scheduleJson: String, locale: String ->
      val context = appContext.reactContext ?: return@Function
      File(context.filesDir, HassounWidgetStore.SCHEDULE_FILE).writeText(scheduleJson)
      context.getSharedPreferences(HassounWidgetStore.PREFS, Context.MODE_PRIVATE)
        .edit()
        .putString("locale", if (locale == "ar") "ar" else "en")
        .apply()
      HassounPrayerWidgetProvider.updateAll(context)
    }

    Function("refresh") {
      val context = appContext.reactContext ?: return@Function
      HassounPrayerWidgetProvider.updateAll(context)
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
