package ca.hassoun.wear.data

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.location.Location
import android.location.LocationManager
import android.os.CancellationSignal
import androidx.wear.watchface.complications.data.ComplicationData
import androidx.wear.watchface.complications.data.ComplicationType
import androidx.wear.watchface.complications.data.PlainComplicationText
import androidx.wear.watchface.complications.data.ShortTextComplicationData
import androidx.wear.watchface.complications.datasource.ComplicationRequest
import androidx.wear.watchface.complications.datasource.SuspendingComplicationDataSourceService
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withTimeoutOrNull
import kotlin.coroutines.resume
import kotlin.math.atan2
import kotlin.math.cos
import kotlin.math.roundToInt
import kotlin.math.sin

class QiblaComplicationService : SuspendingComplicationDataSourceService() {
    override suspend fun onComplicationRequest(request: ComplicationRequest): ComplicationData? {
        if (request.complicationType != ComplicationType.SHORT_TEXT) return null

        if (!hasLocationPermission()) {
            return buildData("SETUP")
        }

        val position = currentLocation()
            ?: bestLastKnownLocation()
            ?: WatchDataStore.location(this)

        val value = if (position == null) {
            "WAIT"
        } else {
            "${qiblaBearing(position.first, position.second).roundToInt()}°"
        }

        return buildData(value)
    }

    override fun getPreviewData(type: ComplicationType): ComplicationData? {
        return if (type == ComplicationType.SHORT_TEXT) buildData("102°") else null
    }

    private fun hasLocationPermission(): Boolean {
        return checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED ||
            checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED
    }

    private suspend fun currentLocation(): Pair<Double, Double>? {
        val manager = getSystemService(Context.LOCATION_SERVICE) as LocationManager
        val fine = checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED

        val candidates = buildList {
            add(LocationManager.FUSED_PROVIDER)
            add(LocationManager.NETWORK_PROVIDER)
            if (fine) add(LocationManager.GPS_PROVIDER)
            manager.getProviders(true).forEach { provider ->
                if (!contains(provider)) add(provider)
            }
        }.filter { provider ->
            runCatching { manager.isProviderEnabled(provider) }.getOrDefault(false)
        }

        for (provider in candidates) {
            val location = withTimeoutOrNull(6_000L) {
                requestCurrentLocation(manager, provider)
            }
            if (location != null) {
                WatchDataStore.saveLocation(this, location)
                return location.latitude to location.longitude
            }
        }

        return null
    }

    private suspend fun requestCurrentLocation(
        manager: LocationManager,
        provider: String
    ): Location? = suspendCancellableCoroutine { continuation ->
        val cancellationSignal = CancellationSignal()
        continuation.invokeOnCancellation { cancellationSignal.cancel() }

        runCatching {
            manager.getCurrentLocation(provider, cancellationSignal, mainExecutor) { location ->
                if (continuation.isActive) continuation.resume(location)
            }
        }.onFailure {
            if (continuation.isActive) continuation.resume(null)
        }
    }

    private fun bestLastKnownLocation(): Pair<Double, Double>? {
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
