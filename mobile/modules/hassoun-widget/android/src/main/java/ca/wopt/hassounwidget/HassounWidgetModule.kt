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

    Function("setPreferences") { preferences: Map<String, Any?> ->
      val context = appContext.reactContext ?: return@Function null
      val layout = (preferences["layout"] as? String).takeIf { it in setOf("compact", "next", "full", "square", "vertical", "slim") } ?: "full"
      val theme = (preferences["theme"] as? String).takeIf { it in setOf("emerald", "ivory", "ocean", "sunset", "midnight") } ?: "emerald"
      val appearance = (preferences["appearance"] as? String).takeIf { it in setOf("light", "dark", "auto") } ?: "auto"
      val timeSize = (preferences["timeSize"] as? String).takeIf { it in setOf("small", "medium", "large", "xlarge") } ?: "large"
      val countdownStyle = (preferences["countdownStyle"] as? String).takeIf { it in setOf("circle", "pill", "minimal") } ?: "circle"
      val focus = (preferences["focus"] as? String).takeIf { it in setOf("next", "balanced", "all") } ?: "next"
      val locale = if (preferences["locale"] == "ar") "ar" else "en"

      context.getSharedPreferences(HassounWidgetStore.PREFS, Context.MODE_PRIVATE)
        .edit()
        .putString("layout", layout)
        .putBoolean("android16WidgetSafeMode", false)
        .putString("theme", theme)
        .putString("appearance", appearance)
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

      // A user changing Widget settings is an explicit action. Honor it on every
      // Android version, including Android 16, and refresh existing widgets now.
      HassounPrayerWidgetProvider.updateAll(context)
      null
    }

    Function("getPreferences") {
      val context = appContext.reactContext
      if (context == null) return@Function defaults()
      val prefs = context.getSharedPreferences(HassounWidgetStore.PREFS, Context.MODE_PRIVATE)
      mapOf(
        "layout" to (prefs.getString("layout", if (Build.VERSION.SDK_INT >= 36) "slim" else "full") ?: if (Build.VERSION.SDK_INT >= 36) "slim" else "full"),
        "theme" to (prefs.getString("theme", "emerald") ?: "emerald"),
        "appearance" to (prefs.getString("appearance", "auto") ?: "auto"),
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
      // Sync prayer data and language only. Never overwrite the user's chosen
      // widget layout/theme/options during a normal app refresh.
      context.getSharedPreferences(HassounWidgetStore.PREFS, Context.MODE_PRIVATE)
        .edit().putString("locale", if (locale == "ar") "ar" else "en").apply()
      HassounPrayerWidgetProvider.updateAll(context)
      null
    }

    Function("refresh") {
      val context = appContext.reactContext ?: return@Function null
      // Refresh must preserve every Widget Studio preference.
      HassounPrayerWidgetProvider.updateAll(context)
      null
    }

    Function("requestPin") {
      val context = appContext.reactContext ?: return@Function false
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return@Function false
      val manager = AppWidgetManager.getInstance(context)
      if (!manager.isRequestPinAppWidgetSupported) return@Function false

      // The provider metadata already uses the shallow slim initialLayout,
      // which is the Samsung-safe shell. Do not overwrite the user's saved layout.
      // Ask Android to send us a success broadcast after the widget is actually
      // placed, then populate it immediately so it never remains an empty shell.
      val refreshIntent = android.content.Intent(context, HassounPrayerWidgetProvider::class.java).apply {
        action = HassounWidgetStore.ACTION_REFRESH
      }
      val successCallback = android.app.PendingIntent.getBroadcast(
        context,
        7610,
        refreshIntent,
        android.app.PendingIntent.FLAG_UPDATE_CURRENT or android.app.PendingIntent.FLAG_IMMUTABLE
      )
      manager.requestPinAppWidget(ComponentName(context, HassounPrayerWidgetProvider::class.java), null, successCallback)
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
    "layout" to (if (Build.VERSION.SDK_INT >= 36) "slim" else "full"), "theme" to "emerald", "appearance" to "auto", "showCountdown" to true,
    "showHijri" to true, "showGregorian" to true, "showAllPrayers" to true,
    "showLocation" to false, "showLogo" to true, "showArabicNames" to true,
    "highlightNext" to true, "timeSize" to "large", "countdownStyle" to "circle",
    "focus" to "next", "locale" to "en"
  )
}