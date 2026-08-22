package ca.hassoun.wear.data

import androidx.wear.watchface.complications.data.ComplicationData
import androidx.wear.watchface.complications.data.ComplicationType
import androidx.wear.watchface.complications.data.PlainComplicationText
import androidx.wear.watchface.complications.data.ShortTextComplicationData
import androidx.wear.watchface.complications.datasource.ComplicationRequest
import androidx.wear.watchface.complications.datasource.SuspendingComplicationDataSourceService
import kotlin.math.roundToInt

class CaloriesComplicationService : SuspendingComplicationDataSourceService() {
    override suspend fun onComplicationRequest(request: ComplicationRequest): ComplicationData? {
        if (request.complicationType != ComplicationType.SHORT_TEXT) return null
        val calories = WatchDataStore.calories(this)
        val text = calories?.roundToInt()?.toString() ?: "--"
        return buildData(text)
    }

    override fun getPreviewData(type: ComplicationType): ComplicationData? {
        return if (type == ComplicationType.SHORT_TEXT) buildData("520") else null
    }

    private fun buildData(value: String): ComplicationData {
        return ShortTextComplicationData.Builder(
            text = PlainComplicationText.Builder(value).build(),
            contentDescription = PlainComplicationText.Builder("$value calories today").build()
        ).build()
    }
}
