package ca.wopt.prayeraudio

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import org.json.JSONArray
import org.json.JSONObject

data class PrayerScheduleResult(val scheduled: Int, val exact: Boolean)

object PrayerAlarmScheduler {
  private const val PREFS_NAME = "wopt_prayer_audio_v1"
  private const val EVENTS_KEY = "exact_prayer_events"
  private const val ACTION_PRAYER_ALARM = "ca.wopt.prayeraudio.PRAYER_ALARM"

  fun canScheduleExactAlarms(context: Context): Boolean {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return true
    val manager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
    return manager.canScheduleExactAlarms()
  }

  fun replaceSchedule(context: Context, eventsJson: String): PrayerScheduleResult {
    cancelAll(context)

    val now = System.currentTimeMillis()
    val incoming = JSONArray(eventsJson)
    val future = JSONArray()
    for (index in 0 until incoming.length()) {
      val event = incoming.getJSONObject(index)
      if (event.getLong("scheduledAtMs") > now) future.put(event)
    }

    context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
      .edit()
      .putString(EVENTS_KEY, future.toString())
      .apply()

    val exact = canScheduleExactAlarms(context)
    for (index in 0 until future.length()) {
      scheduleOne(context, future.getJSONObject(index), exact)
    }
    return PrayerScheduleResult(future.length(), exact)
  }

  fun scheduleTest(context: Context, prayer: String, delaySeconds: Int): Boolean {
    val exact = canScheduleExactAlarms(context)
    val event = JSONObject().apply {
      put("id", "test-${System.currentTimeMillis()}")
      put("prayer", prayer)
      put("scheduledAtMs", System.currentTimeMillis() + delaySeconds.coerceAtLeast(5) * 1000L)
    }
    scheduleOne(context, event, exact)
    return exact
  }

  fun restoreSchedule(context: Context) {
    val saved = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
      .getString(EVENTS_KEY, "[]") ?: "[]"
    replaceSchedule(context, saved)
  }

  fun cancelAll(context: Context) {
    val preferences = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    val saved = preferences.getString(EVENTS_KEY, "[]") ?: "[]"
    val events = runCatching { JSONArray(saved) }.getOrDefault(JSONArray())
    val manager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager

    for (index in 0 until events.length()) {
      val event = events.optJSONObject(index) ?: continue
      pendingIntent(context, event, PendingIntent.FLAG_NO_CREATE)?.let { manager.cancel(it) }
    }
    preferences.edit().remove(EVENTS_KEY).apply()
  }

  private fun scheduleOne(context: Context, event: JSONObject, exact: Boolean) {
    val manager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
    val triggerAt = event.getLong("scheduledAtMs")
    val intent = requireNotNull(pendingIntent(context, event, PendingIntent.FLAG_UPDATE_CURRENT))

    if (exact) {
      manager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAt, intent)
    } else {
      manager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAt, intent)
    }
  }

  private fun pendingIntent(context: Context, event: JSONObject, mode: Int): PendingIntent? {
    val eventId = event.optString("id")
    val prayer = event.optString("prayer")
    val intent = Intent(context, PrayerAlarmReceiver::class.java).apply {
      action = ACTION_PRAYER_ALARM
      data = Uri.parse("wopt-prayer://${Uri.encode(eventId)}")
      putExtra("eventId", eventId)
      putExtra("prayer", prayer)
    }
    return PendingIntent.getBroadcast(
      context,
      eventId.hashCode() and 0x7fffffff,
      intent,
      mode or PendingIntent.FLAG_IMMUTABLE
    )
  }
}
