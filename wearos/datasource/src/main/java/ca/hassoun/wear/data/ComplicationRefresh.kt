package ca.hassoun.wear.data

import android.content.ComponentName
import android.content.Context
import androidx.wear.watchface.complications.datasource.ComplicationDataSourceUpdateRequester

object ComplicationRefresh {
    fun calories(context: Context) {
        ComplicationDataSourceUpdateRequester.create(
            context,
            ComponentName(context, CaloriesComplicationService::class.java)
        ).requestUpdateAll()
    }

    fun qibla(context: Context) {
        ComplicationDataSourceUpdateRequester.create(
            context,
            ComponentName(context, QiblaComplicationService::class.java)
        ).requestUpdateAll()
    }
}
