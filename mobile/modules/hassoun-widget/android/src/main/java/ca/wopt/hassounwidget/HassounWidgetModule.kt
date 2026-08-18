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
      val requestedLayout = (preferences["layout"] as? String).takeIf { it in setOf("compact", "next", "full", "square", "vertical", "slim") } ?: "full"
      // Android 16 / API 36 launchers (especially Samsung One UI) can reject the
      // heavier RemoteViews variants after pinning even though the APK compiles.
      // Keep the same widget data/features but persist the shallow launcher-safe
      // layout so the provider never immediately replaces its safe initial view
      // with a layout the host may fail to inflate.
      val layout = if (Build.VERSION.SDK_INT >= 36) "slim" else requestedLayout
      val theme = (preferences["theme"] as? String).takeIf { it in setOf("emerald", "ivory", "ocean", "sunset", "midnight") } ?: "emerald"
      val timeSize = (preferences["timeSize"] as? String).takeIf { it in setOf("small", "medium", "large", "xlarge") } ?: "large"
      val countdownStyle = (preferences["countdownStyle"] as? String).takeIf { it in setOf("circle", "pill", "minimal") } ?: "circle"
      val focus = (preferences["focus"] as? String).takeIf { it in setOf("next", "balanced", "all") } ?: "next"
      val locale = if (preferences["locale"] == "ar") "ar" else "en"

      context.getSharedPreferences(HassounWidgetStore.PREFS, Context.MODE_PRIVATE)
        .edit()
        .putString("layout", layout)
        .putBoolean("android16WidgetSafeMode", Build.VERSION.SDK_INT >= 36)
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
      val storedLayout = prefs.getString("layout", "full") ?: "full"
      val layout = if (Build.VERSION.SDK_INT >= 36) "slim" else storedLayout
      mapOf(
        "layout" to layout,
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
      val prefs = context.getSharedPreferences(HassounWidgetStore.PREFS, Context.MODE_PRIVATE)
      val editor = prefs.edit().putString("locale", if (locale == "ar") "ar" else "en")
      if (Build.VERSION.SDK_INT >= 36) {
        // Migrate widgets created by older builds before refreshing them. Without
        // this, an existing saved "full" preference can immediately reproduce
        // the launcher failure after an app upgrade.
        editor.putString("layout", "slim").putBoolean("android16WidgetSafeMode", true)
      }
      editor.apply()
      HassounPrayerWidgetProvider.updateAll(context)
      null
    }

    Function("refresh") {
      val context = appContext.reactContext ?: return@Function null
      if (Build.VERSION.SDK_INT >= 36) {
        context.getSharedPreferences(HassounWidgetStore.PREFS, Context.MODE_PRIVATE)
          .edit().putString("layout", "slim").putBoolean("android16WidgetSafeMode", true).apply()
      }
      HassounPrayerWidgetProvider.updateAll(context)
      null
    }

    Function("requestPin") {
      val context = appContext.reactContext ?: return@Function false
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return@Function false
      val manager = AppWidgetManager.getInstance(context)
      if (!manager.isRequestPinAppWidgetSupported) return@Function false
      if (Build.VERSION.SDK_INT >= 36) {
        context.getSharedPreferences(HassounWidgetStore.PREFS, Context.MODE_PRIVATE)
          .edit().putString("layout", "slim").putBoolean("android16WidgetSafeMode", true).apply()
      }
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
    "layout" to (if (Build.VERSION.SDK_INT >= 36) "slim" else "full"), "theme" to "emerald", "showCountdown" to true,
    "showHijri" to true, "showGregorian" to true, "showAllPrayers" to true,
    "showLocation" to false, "showLogo" to true, "showArabicNames" to true,
    "highlightNext" to true, "timeSize" to "large", "countdownStyle" to "circle",
    "focus" to "next", "locale" to "en"
  )
}