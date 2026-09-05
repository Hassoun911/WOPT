package ca.wopt.prayeraudio

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import kotlin.math.abs

class PrayerAlarmReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    val eventId = intent.getStringExtra("eventId") ?: return
    val scheduledAtMs = intent.getLongExtra("scheduledAtMs", 0L)
    val now = System.currentTimeMillis()

    if (scheduledAtMs <= 0L || abs(now - scheduledAtMs) > MAX_TRIGGER_DRIFT_MS) return
    if (!PrayerAlarmScheduler.consumeAuthorizedEvent(context, eventId, scheduledAtMs)) return
    if (isDuplicateEvent(context, eventId)) return

    val serviceIntent = Intent(context, PrayerAudioService::class.java).apply {
      action = PrayerAudioService.ACTION_PLAY
      putExtra("eventId", eventId)
      putExtra("prayer", intent.getStringExtra("prayer"))
    }
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) context.startForegroundService(serviceIntent)
    else context.startService(serviceIntent)
  }

  private fun isDuplicateEvent(context: Context, eventId: String): Boolean {
    val now = System.currentTimeMillis()
    val preferences = context.getSharedPreferences(DEDUPE_PREFS, Context.MODE_PRIVATE)
    val previousId = preferences.getString(LAST_EVENT_ID, null)
    val previousAt = preferences.getLong(LAST_EVENT_AT, 0L)
    if (previousId == eventId && now - previousAt in 0 until DEDUPE_WINDOW_MS) return true
    preferences.edit().putString(LAST_EVENT_ID, eventId).putLong(LAST_EVENT_AT, now).commit()
    return false
  }

  companion object {
    private const val DEDUPE_PREFS = "wopt_prayer_alarm_dedupe_v2"
    private const val LAST_EVENT_ID = "last_event_id"
    private const val LAST_EVENT_AT = "last_event_at"
    private const val DEDUPE_WINDOW_MS = 10 * 60 * 1000L
    private const val MAX_TRIGGER_DRIFT_MS = 2 * 60 * 1000L
  }
}
