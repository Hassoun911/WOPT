package ca.wopt.hassounwidget

import android.app.AlarmManager
import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.appwidget.AppWidgetProviderInfo
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.os.Build
import android.os.SystemClock
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
      intent.action == Intent.ACTION_TIMEZONE_CHANGED
    ) {
      updateAll(context)
    }
  }

  companion object {
    private val prayerKeys = listOf("fajr", "dhuhr", "asr", "maghrib", "isha")
    private val englishNames = mapOf("fajr" to "Fajr", "dhuhr" to "Dhuhr", "asr" to "Asr", "maghrib" to "Maghrib", "isha" to "Isha")
    private val arabicNames = mapOf("fajr" to "الفجر", "dhuhr" to "الظهر", "asr" to "العصر", "maghrib" to "المغرب", "isha" to "العشاء")
    private val toronto = TimeZone.getTimeZone("America/Toronto")

    fun updateAll(context: Context) {
      val manager = AppWidgetManager.getInstance(context)
      val home = ComponentName(context, HassounPrayerWidgetProvider::class.java)
      manager.getAppWidgetIds(home).forEach { updateWidget(context, manager, it, false) }
      val lock = ComponentName(context, HassounLockScreenWidgetProvider::class.java)
      manager.getAppWidgetIds(lock).forEach { updateWidget(context, manager, it, true) }
    }

    fun updateTransparentWidget(context: Context, manager: AppWidgetManager, appWidgetId: Int) {
      updateWidget(context, manager, appWidgetId, true)
    }

    private fun updateWidget(context: Context, manager: AppWidgetManager, appWidgetId: Int, forceLockScreen: Boolean = false) {
      val widgetOptions = manager.getAppWidgetOptions(appWidgetId)
      val hostCategory = widgetOptions.getInt(
        AppWidgetManager.OPTION_APPWIDGET_HOST_CATEGORY,
        AppWidgetProviderInfo.WIDGET_CATEGORY_HOME_SCREEN
      )
      val isLockScreen = forceLockScreen || (hostCategory and AppWidgetProviderInfo.WIDGET_CATEGORY_KEYGUARD) != 0
      val prefs = context.getSharedPreferences(HassounWidgetStore.PREFS, Context.MODE_PRIVATE)
      val layout = prefs.getString("layout", "full") ?: "full"
      val views = RemoteViews(
        context.packageName,
        if (isLockScreen) R.layout.hassoun_prayer_widget_lockscreen
        else if (layout == "vertical") R.layout.hassoun_prayer_widget_vertical
        else R.layout.hassoun_prayer_widget
      )
      val locale = prefs.getString("locale", "en") ?: "en"
      val theme = prefs.getString("theme", "emerald") ?: "emerald"
      val showCountdown = prefs.getBoolean("showCountdown", true)
      val showHijri = prefs.getBoolean("showHijri", true)
      val showGregorian = prefs.getBoolean("showGregorian", true)
      val showAllPrayers = prefs.getBoolean("showAllPrayers", true)
      val showLocation = prefs.getBoolean("showLocation", false)
      val schedule = loadSchedule(context)
      val next = schedule?.let { findNextPrayer(it, locale) }

      bindLaunchIntent(context, views)
      if (!isLockScreen) applyTheme(views, theme)
      views.setTextViewText(R.id.widget_header, "HASSOUN")
      views.setTextViewText(R.id.widget_brand_subtitle, if (locale == "ar") "مواقيت الصلاة • وندسور" else "PRAYER TIMES • WINDSOR")

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
        views.setTextViewText(R.id.widget_next_secondary, if (locale == "ar") englishNames[next.key] ?: next.key else arabicNames[next.key] ?: next.key)
        views.setTextViewText(R.id.widget_next_time, formatClock(next.timeText, locale))

        val delay = (next.targetMillis - System.currentTimeMillis()).coerceAtLeast(0L)
        if (showCountdown) {
          views.setViewVisibility(R.id.widget_countdown, View.VISIBLE)
          views.setChronometer(R.id.widget_countdown, SystemClock.elapsedRealtime() + delay, if (locale == "ar") "⏳ %s" else "⏳ %s left", true)
          if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            views.setChronometerCountDown(R.id.widget_countdown, true)
          }
        } else {
          views.setViewVisibility(R.id.widget_countdown, View.GONE)
        }

        val fullLayout = isLockScreen || layout == "full" || layout == "vertical"
        if (fullLayout && (showAllPrayers || isLockScreen)) {
          views.setViewVisibility(R.id.widget_prayer_strip, View.VISIBLE)
          bindPrayerStrip(views, next.day, locale, next.key, isLockScreen, theme)
        } else {
          views.setViewVisibility(R.id.widget_prayer_strip, View.GONE)
        }
        scheduleNextRefresh(context, next.targetMillis + 15_000L)
      }

      val compact = !isLockScreen && (layout == "compact" || layout == "slim")
      val now = Date()
      if (!compact && showGregorian) {
        views.setViewVisibility(R.id.widget_date, View.VISIBLE)
        views.setTextViewText(R.id.widget_date, gregorianLabel(now, locale))
      } else {
        views.setViewVisibility(R.id.widget_date, View.GONE)
      }
      if (!compact && showHijri) {
        views.setViewVisibility(R.id.widget_hijri, View.VISIBLE)
        views.setTextViewText(R.id.widget_hijri, hijriLabel(now, locale))
      } else {
        views.setViewVisibility(R.id.widget_hijri, View.GONE)
      }
      if (!isLockScreen && !compact && showLocation) {
        views.setViewVisibility(R.id.widget_location, View.VISIBLE)
        views.setTextViewText(R.id.widget_location, if (locale == "ar") "⌖ وندسور، أونتاريو • الجدول الرسمي" else "⌖ Windsor, Ontario • Official schedule")
      } else {
        views.setViewVisibility(R.id.widget_location, View.GONE)
      }

      manager.updateAppWidget(appWidgetId, views)
    }

    private fun bindLaunchIntent(context: Context, views: RemoteViews) {
      val launch = context.packageManager.getLaunchIntentForPackage(context.packageName) ?: return
      launch.flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
      val pending = PendingIntent.getActivity(
        context,
        7501,
        launch,
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
      )
      views.setOnClickPendingIntent(R.id.widget_root, pending)
    }

    private fun loadSchedule(context: Context): JSONObject? {
      return runCatching {
        val file = File(context.filesDir, HassounWidgetStore.SCHEDULE_FILE)
        if (!file.exists()) return null
        JSONObject(file.readText())
      }.getOrNull()
    }

    private fun findNextPrayer(schedule: JSONObject, locale: String): PrayerMoment? {
      val nowMillis = System.currentTimeMillis()
      val base = Calendar.getInstance(toronto).apply { timeInMillis = nowMillis }
      for (offset in 0..7) {
        val dayCal = base.clone() as Calendar
        dayCal.add(Calendar.DAY_OF_MONTH, offset)
        val dateKey = SimpleDateFormat("yyyy-MM-dd", Locale.US).apply { timeZone = toronto }.format(dayCal.time)
        val day = schedule.optJSONObject(dateKey) ?: continue
        for (key in prayerKeys) {
          val raw = day.optString(key, "")
          if (raw.isBlank()) continue
          val target = prayerCalendar(dayCal, raw) ?: continue
          if (target.timeInMillis <= nowMillis) continue
          val name = if (locale == "ar") arabicNames[key] ?: key else englishNames[key] ?: key
          return PrayerMoment(key, name, raw, target.timeInMillis, dateKey, day)
        }
      }
      return null
    }

    private fun prayerCalendar(day: Calendar, raw: String): Calendar? {
      val pieces = raw.trim().split(":")
      if (pieces.size < 2) return null
      val hour = pieces[0].toIntOrNull() ?: return null
      val minute = pieces[1].take(2).toIntOrNull() ?: return null
      return (day.clone() as Calendar).apply {
        set(Calendar.HOUR_OF_DAY, hour)
        set(Calendar.MINUTE, minute)
        set(Calendar.SECOND, 0)
        set(Calendar.MILLISECOND, 0)
      }
    }

    private fun formatClock(raw: String, locale: String): String {
      val parts = raw.split(":")
      val hour24 = parts.getOrNull(0)?.toIntOrNull() ?: return raw
      val minute = parts.getOrNull(1)?.take(2)?.toIntOrNull() ?: 0
      val hour12 = when (val h = hour24 % 12) { 0 -> 12; else -> h }
      val suffix = if (hour24 < 12) "a.m." else "p.m."
      return if (locale == "ar") "$hour12:${minute.toString().padStart(2, '0')} ${if (hour24 < 12) "ص" else "م"}" else "$hour12:${minute.toString().padStart(2, '0')} $suffix"
    }

    private fun bindPrayerStrip(views: RemoteViews, day: JSONObject, locale: String, nextKey: String, lockScreen: Boolean = false, theme: String = "emerald") {
      val ids = mapOf(
        "fajr" to R.id.widget_prayer_fajr,
        "dhuhr" to R.id.widget_prayer_dhuhr,
        "asr" to R.id.widget_prayer_asr,
        "maghrib" to R.id.widget_prayer_maghrib,
        "isha" to R.id.widget_prayer_isha
      )
      prayerKeys.forEach { key ->
        val id = ids[key] ?: return@forEach
        val name = if (locale == "ar") arabicNames[key] ?: key else englishNames[key] ?: key
        val time = formatClock(day.optString(key, "--:--"), locale)
        val active = key == nextKey
        views.setTextViewText(id, "${if (active) "● " else ""}$name\n$time")
        val lightTheme = theme == "ivory"
        val inactive = if (lockScreen) "#FFFFFF" else if (lightTheme) "#214A40" else "#E7F3EF"
        views.setTextColor(id, Color.parseColor(if (active) "#F4D26F" else inactive))
        views.setInt(
          id,
          "setBackgroundResource",
          if (lockScreen) {
            if (active) R.drawable.hassoun_widget_lock_prayer_active else R.drawable.hassoun_widget_lock_prayer_idle
          } else if (lightTheme) {
            R.drawable.hassoun_widget_prayer_chip_light
          } else {
            R.drawable.hassoun_widget_prayer_chip
          }
        )
      }
    }

    private fun applyTheme(views: RemoteViews, theme: String) {
      val light = theme == "ivory"
      val background = when (theme) {
        "ivory" -> R.drawable.hassoun_widget_background_ivory
        "ocean" -> R.drawable.hassoun_widget_background_ocean
        "sunset" -> R.drawable.hassoun_widget_background_sunset
        "midnight" -> R.drawable.hassoun_widget_background_midnight
        else -> R.drawable.hassoun_widget_background
      }
      val primary = Color.parseColor(if (light) "#173F35" else "#FFFFFF")
      val muted = Color.parseColor(if (light) "#776B57" else "#C7DDD6")
      val accent = Color.parseColor(if (light) "#A8711D" else "#F0D27A")
      views.setInt(R.id.widget_root, "setBackgroundResource", background)
      views.setTextColor(R.id.widget_header, primary)
      views.setTextColor(R.id.widget_brand_subtitle, muted)
      views.setTextColor(R.id.widget_date, primary)
      views.setTextColor(R.id.widget_hijri, accent)
      views.setTextColor(R.id.widget_next_label, accent)
      views.setTextColor(R.id.widget_next_name, primary)
      views.setTextColor(R.id.widget_next_secondary, muted)
      views.setTextColor(R.id.widget_next_time, primary)
      views.setTextColor(R.id.widget_location, muted)
    }

    private fun prayerList(day: JSONObject, locale: String): String {
      return prayerKeys.joinToString("\n") { key ->
        val name = if (locale == "ar") arabicNames[key] ?: key else englishNames[key] ?: key
        "$name  ${formatClock(day.optString(key, "--:--"), locale)}"
      }
    }

    private fun gregorianLabel(date: Date, locale: String): String {
      return SimpleDateFormat(if (locale == "ar") "EEE، d MMM" else "EEE, MMM d", if (locale == "ar") Locale("ar") else Locale.CANADA).apply {
        timeZone = toronto
      }.format(date)
    }

    private fun hijriLabel(date: Date, locale: String): String {
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.N) return ""
      return runCatching {
        val zone = android.icu.util.TimeZone.getTimeZone("America/Toronto")
        val cal = android.icu.util.IslamicCalendar(zone, if (locale == "ar") Locale("ar") else Locale.ENGLISH)
        cal.calculationType = android.icu.util.IslamicCalendar.CalculationType.ISLAMIC_UMALQURA
        cal.time = date
        val day = cal.get(android.icu.util.Calendar.DAY_OF_MONTH)
        val month = cal.get(android.icu.util.Calendar.MONTH)
        val year = cal.get(android.icu.util.Calendar.YEAR)
        val enMonths = arrayOf("Muharram", "Safar", "Rabiʿ I", "Rabiʿ II", "Jumada I", "Jumada II", "Rajab", "Shaʿban", "Ramadan", "Shawwal", "Dhu al-Qiʿdah", "Dhu al-Hijjah")
        val arMonths = arrayOf("محرم", "صفر", "ربيع الأول", "ربيع الآخر", "جمادى الأولى", "جمادى الآخرة", "رجب", "شعبان", "رمضان", "شوال", "ذو القعدة", "ذو الحجة")
        if (locale == "ar") "$day ${arMonths.getOrElse(month) { "" }} $year هـ" else "${enMonths.getOrElse(month) { "" }} $day, $year AH"
      }.getOrDefault("")
    }

    private fun scheduleNextRefresh(context: Context, atMillis: Long) {
      val alarm = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
      val intent = Intent(context, HassounPrayerWidgetProvider::class.java).setAction(HassounWidgetStore.ACTION_REFRESH)
      val pending = PendingIntent.getBroadcast(
        context,
        7502,
        intent,
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
      )
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && alarm.canScheduleExactAlarms()) {
        alarm.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, atMillis, pending)
      } else {
        alarm.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, atMillis, pending)
      }
    }
  }
}


class HassounLockScreenWidgetProvider : AppWidgetProvider() {
  override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
    appWidgetIds.forEach { HassounPrayerWidgetProvider.updateTransparentWidget(context, appWidgetManager, it) }
  }

  override fun onAppWidgetOptionsChanged(context: Context, appWidgetManager: AppWidgetManager, appWidgetId: Int, newOptions: android.os.Bundle) {
    HassounPrayerWidgetProvider.updateTransparentWidget(context, appWidgetManager, appWidgetId)
  }

  override fun onReceive(context: Context, intent: Intent) {
    super.onReceive(context, intent)
    if (intent.action == HassounWidgetStore.ACTION_REFRESH || intent.action == Intent.ACTION_BOOT_COMPLETED || intent.action == Intent.ACTION_TIME_CHANGED || intent.action == Intent.ACTION_TIMEZONE_CHANGED) {
      HassounPrayerWidgetProvider.updateAll(context)
    }
  }
}
