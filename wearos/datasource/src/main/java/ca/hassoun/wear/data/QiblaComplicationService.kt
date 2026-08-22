package ca.hassoun.wear.data

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.location.LocationManager
import androidx.core.content.ContextCompat
import androidx.wear.watchface.complications.data.ComplicationData
import androidx.wear.watchface.complications.data.ComplicationType
import androidx.wear.watchface.complications.data.PlainComplicationText
import androidx.wear.watchface.complications.data.ShortTextComplicationData
import androidx.wear.watchface.complications.datasource.ComplicationRequest
import androidx.wear.watchface.complications.datasource.SuspendingComplicationDataSourceService
import kotlin.math.atan2
import kotlin.math.cos
import kotlin.math.roundToInt
import kotlin.math.sin

class QiblaComplicationService : SuspendingComplicationDataSourceService() {
    override suspend fun onComplicationRequest(request: ComplicationRequest): ComplicationData? {
        if (request.complicationType != ComplicationType.SHORT_TEXT) return null
        val position = bestLocation() ?: WatchDataStore.location(this)
        val value = if (position == null) "SETUP" else "${qiblaBearing(position.first, position.second).roundToInt()}°"
        return buildData(value)
    }

    override fun getPreviewData(type: ComplicationType): ComplicationData? {
        return if (type == ComplicationType.SHORT_TEXT) buildData("102°") else null
    }

    private fun bestLocation(): Pair<Double, Double>? {
        val fine = ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
        val coarse = ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED
        if (!fine && !coarse) return null

        val manager = getSystemService(Context.LOCATION_SERVICE) as LocationManager
        val location = manager.getProviders(true)
            .asSequence()
            .mapNotNull { provider -> runCatching { manager.getLastKnownLocation(provider) }.getOrNull() }
            .maxByOrNull { it.time }
            ?: return null

        WatchDataStore.saveLocation(this, location)
        return location.latitude to location.longitude
    }

    private fun qiblaBearing(latitude: Double, longitude: Double): Double {
        val kaabaLat = Math.toRadians(21.422487)
        val kaabaLon = Math.toRadians(39.826206)
        val userLat = Math.toRadians(latitude)
        val userLon = Math.toRadians(longitude)
        val deltaLon = kaabaLon - userLon

        val y = sin(deltaLon) * cos(kaabaLat)
        val x = cos(userLat) * sin(kaabaLat) - sin(userLat) * cos(kaabaLat) * cos(deltaLon)
        val degrees = Math.toDegrees(atan2(y, x))
        return (degrees + 360.0) % 360.0
    }

    private fun buildData(value: String): ComplicationData {
        return ShortTextComplicationData.Builder(
            text = PlainComplicationText.Builder(value).build(),
            contentDescription = PlainComplicationText.Builder("Qibla bearing $value from true north").build()
        ).build()
    }
}
