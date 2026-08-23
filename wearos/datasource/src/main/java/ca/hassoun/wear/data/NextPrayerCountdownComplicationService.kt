package ca.hassoun.wear.data

import androidx.wear.watchface.complications.data.ComplicationData
import androidx.wear.watchface.complications.data.ComplicationType
import androidx.wear.watchface.complications.data.CountDownTimeReference
import androidx.wear.watchface.complications.data.PlainComplicationText
import androidx.wear.watchface.complications.data.ShortTextComplicationData
import androidx.wear.watchface.complications.data.TimeDifferenceComplicationText
import androidx.wear.watchface.complications.data.TimeDifferenceStyle
import androidx.wear.watchface.complications.data.TimeRange
import androidx.wear.watchface.complications.datasource.ComplicationRequest
import androidx.wear.watchface.complications.datasource.SuspendingComplicationDataSourceService
import java.time.Instant

class NextPrayerCountdownComplicationService : SuspendingComplicationDataSourceService() {
    override suspend fun onComplicationRequest(request: ComplicationRequest): ComplicationData? {
        if (request.complicationType != ComplicationType.SHORT_TEXT) return null
        val prayer = PrayerSchedule.nextPrayer(this) ?: return buildPlain("--")

        val countdown = TimeDifferenceComplicationText.Builder(
            TimeDifferenceStyle.STOPWATCH,
            CountDownTimeReference(prayer.instant)
        )
            .setDisplayAsNow(false)
            .build()

        return ShortTextComplicationData.Builder(
            text = countdown,
            contentDescription = PlainComplicationText.Builder("Time left until ${prayer.name}").build()
        )
            .setValidTimeRange(TimeRange.between(Instant.now(), prayer.instant))
            .build()
    }

    override fun getPreviewData(type: ComplicationType): ComplicationData? {
        return if (type == ComplicationType.SHORT_TEXT) buildPlain("1:28") else null
    }

    private fun buildPlain(value: String): ComplicationData {
        return ShortTextComplicationData.Builder(
            text = PlainComplicationText.Builder(value).build(),
            contentDescription = PlainComplicationText.Builder("Prayer time remaining $value").build()
        ).build()
    }
}
