package ca.hassoun.wear.data

import androidx.wear.watchface.complications.data.ComplicationData
import androidx.wear.watchface.complications.data.ComplicationType
import androidx.wear.watchface.complications.data.PlainComplicationText
import androidx.wear.watchface.complications.data.ShortTextComplicationData
import androidx.wear.watchface.complications.data.TimeRange
import androidx.wear.watchface.complications.datasource.ComplicationRequest
import androidx.wear.watchface.complications.datasource.SuspendingComplicationDataSourceService
import java.time.Instant

class NextPrayerNameComplicationService : SuspendingComplicationDataSourceService() {
    override suspend fun onComplicationRequest(request: ComplicationRequest): ComplicationData? {
        if (request.complicationType != ComplicationType.SHORT_TEXT) return null
        val prayer = PrayerSchedule.nextPrayer(this) ?: return buildData("--")
        return ShortTextComplicationData.Builder(
            text = PlainComplicationText.Builder(prayer.name).build(),
            contentDescription = PlainComplicationText.Builder("Next prayer ${prayer.name}").build()
        )
            .setValidTimeRange(TimeRange.between(Instant.now(), prayer.instant))
            .build()
    }

    override fun getPreviewData(type: ComplicationType): ComplicationData? {
        return if (type == ComplicationType.SHORT_TEXT) buildData("ASR") else null
    }

    private fun buildData(value: String): ComplicationData {
        return ShortTextComplicationData.Builder(
            text = PlainComplicationText.Builder(value).build(),
            contentDescription = PlainComplicationText.Builder("Next prayer $value").build()
        ).build()
    }
}
