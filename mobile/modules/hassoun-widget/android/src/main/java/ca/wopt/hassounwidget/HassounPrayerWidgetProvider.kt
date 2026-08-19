package ca.wopt.hassounwidget

import android.app.AlarmManager
import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.appwidget.AppWidgetProviderInfo
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.res.Configuration
import android.graphics.Color
import android.os.Build
import android.os.SystemClock
import android.util.TypedValue
import android.view.View
import android.widget.RemoteViews
import org.json.JSONObject
import java.io.File
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale
import java.util.TimeZone

internal object HassounWidgetStore {
  const val PREFS = "hassoun_widget_preferences"
  const val SCHEDULE_FILE = "hassoun_widget_schedule.json"
  const val ACTION_REFRESH = "ca.wopt.hassounwidget.REFRESH"
}

private data class PrayerMoment(
  val key: String,
  val name: String,
  val timeText: String,
  val targetMillis: Long,
  val dateKey: String,
  val day: JSONObject
)

class HassounPrayerWidgetProvider : AppWidgetProvider() {
  override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
    appWidgetIds.forEach { updateWidget(context, appWidgetManager, it) }
  }

  override fun onAppWidgetOptionsChanged(context: Context, appWidgetManager: AppWidgetManager, appWidgetId: Int, newOptions: android.os.Bundle) {
    updateWidget(context, appWidgetManager, appWidgetId)
  }

  override fun onReceive(context: Context, intent: Intent) {
    super.onReceive(context, intent)
    if (
      intent.action == HassounWidgetStore.ACTION_REFRESH ||
      intent.action == Intent.ACTION_BOOT_COMPLETED ||
      intent.action == Intent.ACTION_TIME_CHANGED ||
      intent.action == Intent.ACTION_TIMEZONE_CHANGED ||
      intent.action == Intent.ACTION_CONFIGURATION_CHANGED
    ) {
      updateAll(context)
    }
  }

  companion object {
    private val prayerKeys = listOf("fajr", "dhuhr", "asr", "maghrib", "isha")
    private val englishNames = mapOf("fajr" to "Fajr", "dhuhr" to "Dhuhr", "asr" to "Asr", "maghrib" to "Maghrib", "isha" to "Isha")
    private val arabicNames = mapOf("fajr" to "الفجر", "dhuhr" to "الظهر", "asr" to "العصر", "maghrib" to "المغرب", "isha" to "العشاء")
    private val prayerSymbols = mapOf("fajr" to "☼", "dhuhr" to "☀", "asr" to "☀", "maghrib" to "☾", "isha" to "☾")
    private val toronto = TimeZone.getTimeZone("America/Toronto")

    fun updateAll(context: Context) {
      val manager = AppWidgetManager.getInstance(context)
      val providers = listOf(
        HassounPrayerWidgetProvider::class.java,
        HassounSquareWidgetProvider::class.java,
        HassounVerticalWidgetProvider::class.java,
        HassounSlimWidgetProvider::class.java
      )
      providers.forEach { providerClass ->
        val component = ComponentName(context, providerClass)
        manager.getAppWidgetIds(component).forEach { updateWidget(context, manager, it, false) }
      }
      val lock = ComponentName(context, HassounLockScreenWidgetProvider::class.java)
      manager.getAppWidgetIds(lock).forEach { updateWidget(context, manager, it, false) }
    }

    fun updateTransparentWidget(context: Context, manager: AppWidgetManager, appWidgetId: Int) {
      updateWidget(context, manager, appWidgetId, false)
    }

    private fun updateWidget(context: Context, manager: AppWidgetManager, appWidgetId: Int, forceLockScreen: Boolean = false) {
      val widgetOptions = manager.getAppWidgetOptions(appWidgetId)
      val hostCategory = widgetOptions.getInt(
        AppWidgetManager.OPTION_APPWIDGET_HOST_CATEGORY,
        AppWidgetProviderInfo.WIDGET_CATEGORY_HOME_SCREEN
      )
      val isLockScreen = forceLockScreen || (hostCategory and AppWidgetProviderInfo.WIDGET_CATEGORY_KEYGUARD) != 0
      val prefs = context.getSharedPreferences(HassounWidgetStore.PREFS, Context.MODE_PRIVATE)
      val requestedLayout = prefs.getString("layout", "full") ?: "full"
      val providerClassName = manager.getAppWidgetInfo(appWidgetId)?.provider?.className.orEmpty()
      val providerLayout = when {
        providerClassName.endsWith("HassounSquareWidgetProvider") -> "square"
        providerClassName.endsWith("HassounVerticalWidgetProvider") -> "vertical"
        providerClassName.endsWith("HassounSlimWidgetProvider") -> "slim"
        providerClassName.endsWith("HassounPrayerWidgetProvider") -> "full"
        else -> null
      }
      val minWidth = widgetOptions.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 0)
      val minHeight = widgetOptions.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, 0)
      val layout = if (isLockScreen) requestedLayout else providerLayout ?: when {
        minHeight >= minWidth * 1.35 -> "vertical"
        minWidth <= 220 && minHeight >= 150 -> "square"
        minHeight <= 80 || minWidth >= minHeight * 3.20 -> "slim"
        requestedLayout == "square" -> "square"
        requestedLayout == "slim" || requestedLayout == "compact" || requestedLayout == "next" -> "slim"
        else -> "full"
      }
      val views = RemoteViews(
        context.packageName,
        if (isLockScreen) R.layout.hassoun_prayer_widget_lockscreen
        else when (layout) {
          "vertical" -> R.layout.hassoun_prayer_widget_vertical
          "square" -> R.layout.hassoun_prayer_widget_square
          "slim", "compact", "next" -> R.layout.hassoun_prayer_widget_slim
          else -> R.layout.hassoun_prayer_widget
        }
      )
      val locale = prefs.getString("locale", "en") ?: "en"
      val storedTheme = prefs.getString("theme", "emerald") ?: "emerald"
      val appearance = prefs.getString("appearance", "auto") ?: "auto"
      val systemDark = (context.resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES
      val theme = when (appearance) {
        "light" -> "ivory"
        "dark" -> "midnight"
        "auto" -> if (systemDark) "midnight" else "ivory"
        else -> storedTheme
      }
      val showCountdown = prefs.getBoolean("showCountdown", true)
      val showHijri = prefs.getBoolean("showHijri", true)
      val showGregorian = prefs.getBoolean("showGregorian", true)
      val showAllPrayers = prefs.getBoolean("showAllPrayers", true)
      val showLocation = prefs.getBoolean("showLocation", false)
      val showLogo = prefs.getBoolean("showLogo", true)
      val showArabicNames = prefs.getBoolean("showArabicNames", true)
      val highlightNext = prefs.getBoolean("highlightNext", true)
      val timeSize = prefs.getString("timeSize", "large") ?: "large"
      var countdownStyle = prefs.getString("countdownStyle", "circle") ?: "circle"
      if (!prefs.getBoolean("countdownStyleV061Migrated", false)) {
        countdownStyle = "circle"
        prefs.edit()
          .putString("countdownStyle", "circle")
          .putBoolean("countdownStyleV060Migrated", true)
          .putBoolean("countdownStyleV061Migrated", true)
          .apply()
      }
      val schedule = loadSchedule(context)
      val next = schedule?.let { findNextPrayer(it, locale) }

      bindLaunchIntent(context, views)
      if (!isLockScreen) applyTheme(views, theme)
      views.setViewVisibility(R.id.widget_logo, if (showLogo) View.VISIBLE else View.GONE)
      views.setTextViewText(R.id.widget_header, "HASSOUN")
      views.setTextViewText(R.id.widget_brand_subtitle, if (locale == "ar") "وندسور • كندا" else "WINDSOR • CANADA")

      if (next == null) {
        views.setTextViewText(R.id.widget_next_label, if (locale == "ar") "مواقيت الصلاة" else "PRAYER TIMES")
        views.setTextViewText(R.id.widget_next_name, if (locale == "ar") "افتح Hassoun" else "Open Hassoun")
        views.setTextViewText(R.id.widget_next_secondary, if (locale == "ar") "للمزامنة" else "to sync prayer times")
        views.setTextViewText(R.id.widget_next_time, "")
        views.setViewVisibility(R.id.widget_countdown, View.GONE)
        views.setViewVisibility(R.id.widget_prayer_strip, View.GONE)
      } else {
        views.setTextViewText(R.id.widget_next_label, if (locale == "ar") "الصلاة القادمة" else "NEXT PRAYER")
        views.setTextViewText(R.id.widget_next_name, next.name)
        val secondaryName = if (locale == "ar") englishNames[next.key] ?: next.key else arabicNames[next.key] ?: next.key
        views.setTextViewText(R.id.widget_next_secondary, if (showArabicNames) secondaryName else "")
        views.setViewVisibility(R.id.widget_next_secondary, if (showArabicNames) View.VISIBLE else View.GONE)
        views.setTextViewText(R.id.widget_next_time, formatClock(next.timeText, locale))

        val timeSp = when (layout) {
          "vertical" -> when (timeSize) { "small" -> 25f; "medium" -> 28f; "xlarge" -> 34f; else -> 31f }
          "square" -> when (timeSize) { "small" -> 21f; "medium" -> 24f; "xlarge" -> 30f; else -> 27f }
          "slim", "compact", "next" -> when (timeSize) { "small" -> 16f; "medium" -> 18f; "xlarge" -> 22f; else -> 20f }
          else -> when (timeSize) { "small" -> 28f; "medium" -> 31f; "xlarge" -> 38f; else -> 34f }
        }
        val prayerNameSp = when (layout) {
          "vertical" -> when (timeSize) { "small" -> 27f; "medium" -> 30f; "xlarge" -> 36f; else -> 33f }
          "square" -> when (timeSize) { "small" -> 23f; "medium" -> 26f; "xlarge" -> 32f; else -> 29f }
          "slim", "compact", "next" -> when (timeSize) { "small" -> 13f; "medium" -> 15f; "xlarge" -> 19f; else -> 17f }
          else -> when (timeSize) { "small" -> 30f; "medium" -> 33f; "xlarge" -> 40f; else -> 36f }
        }
        views.setTextViewTextSize(R.id.widget_next_time, TypedValue.COMPLEX_UNIT_SP, timeSp)
        views.setTextViewTextSize(R.id.widget_next_name, TypedValue.COMPLEX_UNIT_SP, prayerNameSp)

        val delay = (next.targetMillis - System.currentTimeMillis()).coerceAtLeast(0L)
        if (showCountdown) {
          views.setViewVisibility(R.id.widget_countdown, View.VISIBLE)
          val countFormat = when (countdownStyle) {
            "minimal" -> if (locale == "ar") "%s متبقي" else "%s left"
            "pill" -> if (locale == "ar") "⏳ %s متبقي" else "⏳ %s left"
            else -> if (locale == "ar") "%s\nمتبقي" else "%s\nLEFT"
          }
          views.setChronometer(R.id.widget_countdown, SystemClock.elapsedRealtime() + delay, countFormat, true)
          val countdownBackground = when (countdownStyle) {
            "minimal" -> R.drawable.hassoun_widget_countdown_minimal
            "pill" -> R.drawable.hassoun_widget_countdown
            else -> if (theme == "ivory") R.drawable.hassoun_widget_countdown_circle_light else R.drawable.hassoun_widget_countdown_circle_dark
          }
          views.setInt(R.id.widget_countdown, "setBackgroundResource", countdownBackground)
          val countdownSp = if (countdownStyle != "circle") 10f else when {
            isLockScreen -> 15f
            layout == "slim" || layout == "compact" -> 9f
            layout == "square" -> 11f
            layout == "vertical" -> 12f
            else -> 13f
          }
          views.setTextViewTextSize(R.id.widget_countdown, TypedValue.COMPLEX_UNIT_SP, countdownSp)
          if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            views.setChronometerCountDown(R.id.widget_countdown, true)
          }
        } else {
          views.setViewVisibility(R.id.widget_countdown, View.GONE)
        }

        val supportsPrayerStrip = isLockScreen || layout in setOf("full", "vertical", "square", "slim", "compact", "next")
        if (supportsPrayerStrip && (showAllPrayers || isLockScreen)) {
          views.setViewVisibility(R.id.widget_prayer_strip, View.VISIBLE)
          bindPrayerStrip(views, next.day, locale, next.key, isLockScreen, theme, showArabicNames, highlightNext, timeSize, layout)
        } else {
          views.setViewVisibility(R.id.widget_prayer_strip, View.GONE)
        }
        scheduleNextRefresh(context, next.targetMillis + 15_000L)
      }

      val hideDates = !isLockScreen && layout in setOf("square", "slim", "compact", "next")
      val now = Date()
      if (!hideDates && showGregorian) {
        views.setViewVisibility(R.id.widget_date, View.VISIBLE)
        views.setTextViewText(R.id.widget_date, gregorianLabel(now, locale))
      } else {
        views.setViewVisibility(R.id.widget_date, View.GONE)
      }
      if (!hideDates && showHijri) {
        views.setViewVisibility(R.id.widget_hijri, View.VISIBLE)
        views.setTextViewText(R.id.widget_hijri, hijriLabel(now, locale))
      } else {
        views.setViewVisibility(R.id.widget_hijri, View.GONE)
      }
      views.setViewVisibility(R.id.widget_location, if (!hideDates && showLocation) View.VISIBLE else View.GONE)
      views.setTextViewText(R.id.widget_location, if (locale == "ar") "وندسور، كندا" else "Windsor, Canada")

      manager.updateAppWidget(appWidgetId, views)
    }

    private fun bindPrayerStrip(
      views: RemoteViews,
      day: JSONObject,
      locale: String,
      nextKey: String,
      lockScreen: Boolean,
      theme: String,
      showArabic: Boolean,
      highlightNext: Boolean,
      timeSize: String,
      layout: String
    ) {
      val ids = listOf(R.id.widget_prayer_fajr, R.id.widget_prayer_dhuhr, R.id.widget_prayer_asr, R.id.widget_prayer_maghrib, R.id.widget_prayer_isha)
      val baseText = if (theme == "ivory") Color.rgb(20, 72, 61) else Color.rgb(247, 241, 222)
      val activeText = if (theme == "ivory") Color.rgb(13, 83, 66) else Color.rgb(239, 207, 132)

      prayerKeys.zip(ids).forEach { (key, id) ->
        val name = englishNames[key] ?: key
        val arabic = arabicNames[key] ?: ""
        val symbol = prayerSymbols[key] ?: "•"
        val time = formatClock(day.optString(key, "--:--"), locale)
        val title = when (layout) {
          "vertical" -> when {
            locale == "ar" && showArabic -> "$symbol   $arabic     $name     $time"
            locale == "ar" -> "$symbol   $name     $time"
            showArabic -> "$symbol   $name     $arabic     $time"
            else -> "$symbol   $name     $time"
          }
          "slim", "compact", "next" -> "$symbol\n$name\n$time"
          "square" -> if (showArabic) "$symbol\n$name • $arabic\n$time" else "$symbol\n$name\n$time"
          else -> if (showArabic) "$symbol\n$name • $arabic\n$time" else "$symbol\n$name\n$time"
        }
        views.setTextViewText(id, title)
        val active = highlightNext && key == nextKey
        views.setTextColor(id, if (active) activeText else baseText)
        val chipBackground = when {
          active && theme == "ivory" -> R.drawable.hassoun_widget_prayer_chip_active_light
          active -> R.drawable.hassoun_widget_prayer_chip_active_dark
          theme == "ivory" -> R.drawable.hassoun_widget_prayer_chip_light
          else -> R.drawable.hassoun_widget_prayer_chip_dark
        }
        views.setInt(id, "setBackgroundResource", chipBackground)
        val stripSp = if (lockScreen) 9.5f else when (layout) {
          "vertical" -> when (timeSize) { "small" -> 8.2f; "medium" -> 9f; "xlarge" -> 10.7f; else -> 9.8f }
          "square" -> when (timeSize) { "small" -> 5.2f; "medium" -> 5.8f; "xlarge" -> 7f; else -> 6.4f }
          "slim", "compact", "next" -> when (timeSize) { "small" -> 4.2f; "medium" -> 4.8f; "xlarge" -> 5.8f; else -> 5.3f }
          else -> when (timeSize) { "small" -> 7f; "medium" -> 7.8f; "xlarge" -> 9.5f; else -> 8.7f }
        }
        views.setTextViewTextSize(id, TypedValue.COMPLEX_UNIT_SP, stripSp)
      }
    }

    private fun applyTheme(views: RemoteViews, theme: String) {
      val light = theme == "ivory"
      val background = when (theme) {
        "ivory" -> R.drawable.hassoun_widget_bg_ivory
        "ocean" -> R.drawable.hassoun_widget_bg_ocean
        "sunset" -> R.drawable.hassoun_widget_bg_sunset
        "midnight" -> R.drawable.hassoun_widget_bg_midnight
        else -> R.drawable.hassoun_widget_bg
      }
      views.setInt(R.id.widget_root, "setBackgroundResource", background)
      views.setInt(R.id.widget_hero, "setBackgroundResource", if (light) R.drawable.hassoun_widget_hero_light else R.drawable.hassoun_widget_hero_dark)
      views.setImageViewResource(R.id.widget_hero_art, if (light) R.drawable.hassoun_widget_mosque_silhouette_light else R.drawable.hassoun_widget_mosque_silhouette_dark)

      val text = if (light) Color.rgb(20, 72, 61) else Color.rgb(250, 245, 230)
      val subtext = if (light) Color.rgb(148, 104, 45) else Color.rgb(218, 193, 132)
      val ids = listOf(
        R.id.widget_header, R.id.widget_brand_subtitle, R.id.widget_next_name,
        R.id.widget_next_secondary, R.id.widget_next_time, R.id.widget_date,
        R.id.widget_hijri, R.id.widget_location
      )
      ids.forEach { views.setTextColor(it, text) }
      views.setTextColor(R.id.widget_next_label, if (light) Color.rgb(175, 126, 57) else Color.rgb(226, 190, 112))
      views.setTextColor(R.id.widget_brand_subtitle, subtext)
      views.setTextColor(R.id.widget_next_secondary, subtext)
      views.setTextColor(R.id.widget_date, text)
      views.setTextColor(R.id.widget_hijri, subtext)
      views.setTextColor(R.id.widget_location, subtext)
      views.setTextColor(R.id.widget_countdown, if (light) Color.rgb(20, 72, 61) else Color.rgb(246, 222, 161))
    }

    private fun bindLaunchIntent(context: Context, views: RemoteViews) {
      val launch = context.packageManager.getLaunchIntentForPackage(context.packageName)
        ?: Intent(context, Class.forName("ca.wopt.windsorprayertimes.MainActivity"))
      launch.flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
      val pending = PendingIntent.getActivity(
        context,
        7200,
        launch,
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
      )
      views.setOnClickPendingIntent(R.id.widget_root, pending)
    }

    private fun loadSchedule(context: Context): JSONObject? = try {
      val file = File(context.filesDir, HassounWidgetStore.SCHEDULE_FILE)
      if (!file.exists()) null else JSONObject(file.readText())
    } catch (_: Exception) {
      null
    }

    private fun findNextPrayer(schedule: JSONObject, locale: String): PrayerMoment? {
      val zone = toronto
      val now = Calendar.getInstance(zone)
      val dateFormat = SimpleDateFormat("yyyy-MM-dd", Locale.US).apply { timeZone = zone }
      repeat(3) { offset ->
        val date = (now.clone() as Calendar).apply { add(Calendar.DAY_OF_YEAR, offset) }
        val key = dateFormat.format(date.time)
        val day = schedule.optJSONObject(key) ?: return@repeat
        prayerKeys.forEach { prayerKey ->
          val raw = day.optString(prayerKey, "")
          val target = parseTarget(date, raw, zone) ?: return@forEach
          if (target.timeInMillis > now.timeInMillis) {
            return PrayerMoment(
              prayerKey,
              if (locale == "ar") arabicNames[prayerKey] ?: prayerKey else englishNames[prayerKey] ?: prayerKey,
              raw,
              target.timeInMillis,
              key,
              day
            )
          }
        }
      }
      return null
    }

    private fun parseTarget(day: Calendar, raw: String, zone: TimeZone): Calendar? {
      val parts = raw.trim().split(":")
      if (parts.size != 2) return null
      val hour = parts[0].toIntOrNull() ?: return null
      val minute = parts[1].toIntOrNull() ?: return null
      return (day.clone() as Calendar).apply {
        timeZone = zone
        set(Calendar.HOUR_OF_DAY, hour)
        set(Calendar.MINUTE, minute)
        set(Calendar.SECOND, 0)
        set(Calendar.MILLISECOND, 0)
      }
    }

    private fun formatClock(raw: String, locale: String): String {
      val parts = raw.split(":")
      if (parts.size != 2) return raw
      val hour24 = parts[0].toIntOrNull() ?: return raw
      val minute = parts[1].toIntOrNull() ?: return raw
      val suffix = if (hour24 >= 12) "p.m." else "a.m."
      val hour = when (val h = hour24 % 12) { 0 -> 12; else -> h }
      return String.format(Locale.US, "%d:%02d %s", hour, minute, suffix)
    }

    private fun gregorianLabel(date: Date, locale: String): String {
      val fmt = SimpleDateFormat("EEE, MMM d, yyyy", if (locale == "ar") Locale("ar") else Locale.US).apply { timeZone = toronto }
      return fmt.format(date)
    }

    private fun hijriLabel(date: Date, locale: String): String {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
        return try {
          val cal = android.icu.util.IslamicCalendar()
          cal.timeZone = android.icu.util.TimeZone.getTimeZone("America/Toronto")
          cal.time = date
          val year = cal.get(android.icu.util.Calendar.YEAR)
          val month = cal.get(android.icu.util.Calendar.MONTH).coerceIn(0, 11)
          val day = cal.get(android.icu.util.Calendar.DAY_OF_MONTH)
          val enMonths = arrayOf("Muharram", "Safar", "Rabi I", "Rabi II", "Jumada I", "Jumada II", "Rajab", "Sha'ban", "Ramadan", "Shawwal", "Dhu al-Qi'dah", "Dhu al-Hijjah")
          val arMonths = arrayOf("محرم", "صفر", "ربيع الأول", "ربيع الآخر", "جمادى الأولى", "جمادى الآخرة", "رجب", "شعبان", "رمضان", "شوال", "ذو القعدة", "ذو الحجة")
          if (locale == "ar") "$year • $day ${arMonths[month]}" else "$year • $day ${enMonths[month]}"
        } catch (_: Exception) {
          "Hijri"
        }
      }
      return "Hijri"
    }

    private fun scheduleNextRefresh(context: Context, atMillis: Long) {
      val alarm = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
      val intent = Intent(context, HassounPrayerWidgetProvider::class.java).apply { action = HassounWidgetStore.ACTION_REFRESH }
      val pending = PendingIntent.getBroadcast(
        context,
        7301,
        intent,
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
      )
      try {
        alarm.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, atMillis, pending)
      } catch (_: SecurityException) {
        alarm.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, atMillis, pending)
      }
    }
  }
}
