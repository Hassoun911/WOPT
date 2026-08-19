package ca.wopt.prayeraudio

import android.Manifest
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.location.Geocoder
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.util.Locale
import java.util.concurrent.Executor

class PrayerAudioModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  override fun definition() = ModuleDefinition {
    Name("PrayerAudio")

    Function("canScheduleExactAlarms") {
      PrayerAlarmScheduler.canScheduleExactAlarms(context)
    }

    AsyncFunction("scheduleExactPrayerAlarms") { eventsJson: String ->
      val result = PrayerAlarmScheduler.replaceSchedule(context, eventsJson)
      mapOf("scheduled" to result.scheduled, "exact" to result.exact)
    }

    AsyncFunction("restoreExactPrayerAlarms") {
      PrayerAlarmScheduler.restoreSchedule(context)
      mapOf("exact" to PrayerAlarmScheduler.canScheduleExactAlarms(context))
    }

    AsyncFunction("scheduleTestPrayerAlarm") { prayer: String, delaySeconds: Int ->
      val exact = PrayerAlarmScheduler.scheduleTest(context, prayer, delaySeconds)
      mapOf("exact" to exact)
    }

    AsyncFunction("getCurrentDeviceLocation") { promise: Promise ->
      resolveCurrentLocation(promise)
    }

    AsyncFunction("cancelExactPrayerAlarms") {
      PrayerAlarmScheduler.cancelAll(context)
    }

    Function("openExactAlarmSettings") {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        val intent = Intent(
          Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM,
          Uri.parse("package:${context.packageName}")
        ).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        context.startActivity(intent)
      }
    }
  }

  private fun hasLocationPermission(): Boolean {
    return context.checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED ||
      context.checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED
  }

  private fun resolveCurrentLocation(promise: Promise) {
    if (!hasLocationPermission()) {
      promise.resolve(null)
      return
    }

    val manager = context.getSystemService(Context.LOCATION_SERVICE) as LocationManager
    val providers = listOf(LocationManager.GPS_PROVIDER, LocationManager.NETWORK_PROVIDER)
      .filter { runCatching { manager.isProviderEnabled(it) }.getOrDefault(false) }

    if (providers.isEmpty()) {
      promise.resolve(null)
      return
    }

    val lastKnown = providers
      .mapNotNull { provider -> runCatching { manager.getLastKnownLocation(provider) }.getOrNull() }
      .maxByOrNull { it.time }

    if (lastKnown != null && System.currentTimeMillis() - lastKnown.time <= 10 * 60 * 1000L) {
      promise.resolve(locationPayload(lastKnown))
      return
    }

    val provider = if (providers.contains(LocationManager.GPS_PROVIDER)) {
      LocationManager.GPS_PROVIDER
    } else {
      providers.first()
    }

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
      val executor = Executor { command -> Handler(Looper.getMainLooper()).post(command) }
      runCatching {
        manager.getCurrentLocation(provider, null, executor) { location ->
          promise.resolve(location?.let(::locationPayload) ?: lastKnown?.let(::locationPayload))
        }
      }.onFailure {
        promise.resolve(lastKnown?.let(::locationPayload))
      }
      return
    }

    @Suppress("DEPRECATION")
    val listener = object : LocationListener {
      override fun onLocationChanged(location: Location) {
        promise.resolve(locationPayload(location))
      }
      override fun onStatusChanged(provider: String?, status: Int, extras: Bundle?) = Unit
      override fun onProviderEnabled(provider: String) = Unit
      override fun onProviderDisabled(provider: String) = Unit
    }

    runCatching {
      @Suppress("DEPRECATION")
      manager.requestSingleUpdate(provider, listener, Looper.getMainLooper())
    }.onFailure {
      promise.resolve(lastKnown?.let(::locationPayload))
    }
  }

  private fun locationPayload(location: Location): Map<String, Any?> {
    var city: String? = null
    var region: String? = null
    var countryCode: String? = null
    var countryName: String? = null

    runCatching {
      if (Geocoder.isPresent()) {
        @Suppress("DEPRECATION")
        val address = Geocoder(context, Locale.getDefault())
          .getFromLocation(location.latitude, location.longitude, 1)
          ?.firstOrNull()
        city = address?.locality ?: address?.subAdminArea
        region = address?.adminArea
        countryCode = address?.countryCode
        countryName = address?.countryName
      }
    }

    return mapOf(
      "latitude" to location.latitude,
      "longitude" to location.longitude,
      "accuracy" to location.accuracy.toDouble(),
      "city" to city,
      "region" to region,
      "countryCode" to countryCode,
      "countryName" to countryName,
      "capturedAtMs" to location.time
    )
  }
}
