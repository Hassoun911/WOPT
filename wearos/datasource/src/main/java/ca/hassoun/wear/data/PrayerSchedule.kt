package ca.hassoun.wear.data

import android.content.Context
import org.json.JSONObject
import java.time.Instant
import java.time.LocalDate
import java.time.LocalTime
import java.time.ZoneId
import java.time.ZonedDateTime

object PrayerSchedule {
    private val zone: ZoneId = ZoneId.of("America/Toronto")
    private val prayerOrder = listOf(
        "fajr" to "FAJR",
        "dhuhr" to "DHUHR",
        "asr" to "ASR",
        "maghrib" to "MAGHRIB",
        "isha" to "ISHA"
    )

    @Volatile
    private var cachedPrayerTimes: JSONObject? = null

    data class PrayerEvent(
        val name: String,
        val instant: Instant
    )

    fun nextPrayer(context: Context, now: ZonedDateTime = ZonedDateTime.now(zone)): PrayerEvent? {
        val prayerTimes = prayerTimes(context)
        for (offset in 0..1) {
            val date = now.toLocalDate().plusDays(offset.toLong())
            val day = prayerTimes.optJSONObject(date.toString()) ?: continue
            for ((key, label) in prayerOrder) {
                val rawTime = day.optString(key, "")
                if (rawTime.isBlank()) continue
                val time = runCatching { LocalTime.parse(rawTime) }.getOrNull() ?: continue
                val eventTime = ZonedDateTime.of(date, time, zone)
                if (eventTime.isAfter(now)) {
                    return PrayerEvent(label, eventTime.toInstant())
                }
            }
        }
        return null
    }

    private fun prayerTimes(context: Context): JSONObject {
        cachedPrayerTimes?.let { return it }
        return synchronized(this) {
            cachedPrayerTimes ?: loadPrayerTimes(context).also { cachedPrayerTimes = it }
        }
    }

    private fun loadPrayerTimes(context: Context): JSONObject {
        val text = context.assets.open("windsor_islamic_association_2026_prayer_times.json")
            .bufferedReader()
            .use { it.readText() }
        return JSONObject(text).getJSONObject("prayer_times")
    }
}
