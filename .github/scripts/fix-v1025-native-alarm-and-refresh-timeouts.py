from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PRAYER_DATA = ROOT / "mobile/src/prayerData.ts"
SCHEDULER = ROOT / "mobile/modules/prayer-audio/android/src/main/java/ca/wopt/prayeraudio/PrayerAlarmScheduler.kt"
RECEIVER = ROOT / "mobile/modules/prayer-audio/android/src/main/java/ca/wopt/prayeraudio/PrayerAlarmReceiver.kt"

prayer = PRAYER_DATA.read_text(encoding="utf-8")

# Bound reverse geocoding so a city-label lookup can never leave Home refresh spinning.
old_geo = '    const places = await Location.reverseGeocodeAsync({ latitude, longitude });'
new_geo = '''    const places = await Promise.race([
      Location.reverseGeocodeAsync({ latitude, longitude }),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("GEOCODE_TIMEOUT")), 2500))
    ]);'''
if old_geo in prayer:
    prayer = prayer.replace(old_geo, new_geo, 1)

# Bound Worker and direct-provider fetches. A hanging Worker must fall through quickly.
old_worker = '    const response = await fetch(url.toString(), { headers: { Accept: "application/json" } });'
new_worker = '''    const response = await Promise.race([
      fetch(url.toString(), { headers: { Accept: "application/json" } }),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("WORKER_TIMEOUT")), 2500))
    ]);'''
if old_worker in prayer:
    prayer = prayer.replace(old_worker, new_worker, 1)

old_direct = '  const response = await fetch(direct.toString(), { headers: { Accept: "application/json" } });'
new_direct = '''  const response = await Promise.race([
    fetch(direct.toString(), { headers: { Accept: "application/json" } }),
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error("DIRECT_PRAYER_TIMEOUT")), 7000))
  ]);'''
if old_direct in prayer:
    prayer = prayer.replace(old_direct, new_direct, 1)

PRAYER_DATA.write_text(prayer, encoding="utf-8")

# Native alarm registry: every broadcast must be currently authorized. Legacy/stale
# PendingIntents and old 30-second test alarms surviving an APK update are ignored.
SCHEDULER.write_text(r'''package ca.wopt.prayeraudio

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
  private const val PREFS_NAME = "wopt_prayer_audio_v2"
  private const val EVENTS_KEY = "exact_prayer_events"
  private const val TEST_EVENTS_KEY = "exact_test_events"
  private const val ACTION_PRAYER_ALARM = "ca.wopt.prayeraudio.PRAYER_ALARM"

  fun canScheduleExactAlarms(context: Context): Boolean {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return true
    val manager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
    return manager.canScheduleExactAlarms()
  }

  fun replaceSchedule(context: Context, eventsJson: String): PrayerScheduleResult {
    cancelRegular(context)
    val now = System.currentTimeMillis()
    val incoming = runCatching { JSONArray(eventsJson) }.getOrDefault(JSONArray())
    val future = JSONArray()
    for (index in 0 until incoming.length()) {
      val event = incoming.optJSONObject(index) ?: continue
      if (event.optLong("scheduledAtMs", 0L) > now + 1000L) future.put(event)
    }
    prefs(context).edit().putString(EVENTS_KEY, future.toString()).apply()
    val exact = canScheduleExactAlarms(context)
    for (index in 0 until future.length()) scheduleOne(context, future.getJSONObject(index), exact)
    return PrayerScheduleResult(future.length(), exact)
  }

  fun scheduleTest(context: Context, prayer: String, delaySeconds: Int): Boolean {
    cancelTests(context)
    val exact = canScheduleExactAlarms(context)
    val event = JSONObject().apply {
      put("id", "test-${System.currentTimeMillis()}")
      put("prayer", prayer)
      put("scheduledAtMs", System.currentTimeMillis() + delaySeconds.coerceAtLeast(5) * 1000L)
    }
    prefs(context).edit().putString(TEST_EVENTS_KEY, JSONArray().put(event).toString()).apply()
    scheduleOne(context, event, exact)
    return exact
  }

  fun restoreSchedule(context: Context) {
    val saved = prefs(context).getString(EVENTS_KEY, "[]") ?: "[]"
    replaceSchedule(context, saved)
  }

  fun cancelAll(context: Context) {
    cancelRegular(context)
    cancelTests(context)
  }

  fun consumeAuthorizedEvent(context: Context, eventId: String, scheduledAtMs: Long): Boolean {
    if (eventId.isBlank() || scheduledAtMs <= 0L) return false
    val regular = readArray(context, EVENTS_KEY)
    val tests = readArray(context, TEST_EVENTS_KEY)
    var found = false
    val remainingRegular = JSONArray()
    for (i in 0 until regular.length()) {
      val event = regular.optJSONObject(i) ?: continue
      val same = event.optString("id") == eventId && event.optLong("scheduledAtMs", 0L) == scheduledAtMs
      if (same) found = true else remainingRegular.put(event)
    }
    val remainingTests = JSONArray()
    for (i in 0 until tests.length()) {
      val event = tests.optJSONObject(i) ?: continue
      val same = event.optString("id") == eventId && event.optLong("scheduledAtMs", 0L) == scheduledAtMs
      if (same) found = true else remainingTests.put(event)
    }
    if (found) {
      prefs(context).edit()
        .putString(EVENTS_KEY, remainingRegular.toString())
        .putString(TEST_EVENTS_KEY, remainingTests.toString())
        .commit()
    }
    return found
  }

  private fun cancelRegular(context: Context) {
    cancelArray(context, EVENTS_KEY)
  }

  private fun cancelTests(context: Context) {
    cancelArray(context, TEST_EVENTS_KEY)
  }

  private fun cancelArray(context: Context, key: String) {
    val events = readArray(context, key)
    val manager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
    for (index in 0 until events.length()) {
      val event = events.optJSONObject(index) ?: continue
      pendingIntent(context, event, PendingIntent.FLAG_NO_CREATE)?.let { manager.cancel(it) }
    }
    prefs(context).edit().remove(key).apply()
  }

  private fun readArray(context: Context, key: String): JSONArray {
    val saved = prefs(context).getString(key, "[]") ?: "[]"
    return runCatching { JSONArray(saved) }.getOrDefault(JSONArray())
  }

  private fun prefs(context: Context) = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

  private fun scheduleOne(context: Context, event: JSONObject, exact: Boolean) {
    val manager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
    val triggerAt = event.optLong("scheduledAtMs", 0L)
    if (triggerAt <= System.currentTimeMillis() + 1000L) return
    val intent = requireNotNull(pendingIntent(context, event, PendingIntent.FLAG_UPDATE_CURRENT))
    if (exact) manager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAt, intent)
    else manager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAt, intent)
  }

  private fun pendingIntent(context: Context, event: JSONObject, mode: Int): PendingIntent? {
    val eventId = event.optString("id")
    val prayer = event.optString("prayer")
    val scheduledAtMs = event.optLong("scheduledAtMs", 0L)
    val intent = Intent(context, PrayerAlarmReceiver::class.java).apply {
      action = ACTION_PRAYER_ALARM
      data = Uri.parse("wopt-prayer://${Uri.encode(eventId)}")
      putExtra("eventId", eventId)
      putExtra("prayer", prayer)
      putExtra("scheduledAtMs", scheduledAtMs)
    }
    return PendingIntent.getBroadcast(
      context,
      eventId.hashCode() and 0x7fffffff,
      intent,
      mode or PendingIntent.FLAG_IMMUTABLE
    )
  }
}
''', encoding="utf-8")

RECEIVER.write_text(r'''package ca.wopt.prayeraudio

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
    // Critical v1.0.25 guard: only an event in the CURRENT native registry may play.
    // Old regular alarms and 30-second test alarms from an earlier APK are rejected.
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
''', encoding="utf-8")

checks = {
    PRAYER_DATA: ['WORKER_TIMEOUT', 'DIRECT_PRAYER_TIMEOUT', 'GEOCODE_TIMEOUT'],
    SCHEDULER: ['TEST_EVENTS_KEY', 'consumeAuthorizedEvent', 'wopt_prayer_audio_v2'],
    RECEIVER: ['consumeAuthorizedEvent', 'CURRENT native registry'],
}
for path, needles in checks.items():
    text = path.read_text(encoding="utf-8")
    for needle in needles:
        if needle not in text:
            raise SystemExit(f'Missing {needle!r} in {path}')

print('Applied v1.0.25 native alarm authorization + bounded travel refresh timeouts')
