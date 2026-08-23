package ca.hassoun.wear.data

import android.Manifest
import android.app.Activity
import android.content.Context
import android.content.pm.PackageManager
import android.graphics.Color
import android.location.Location
import android.location.LocationManager
import android.os.Bundle
import android.view.Gravity
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView

class SetupActivity : Activity() {
    private lateinit var status: TextView
    private lateinit var enableButton: Button
    private var startingData = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val layout = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            setPadding(28, 28, 28, 28)
            setBackgroundColor(Color.rgb(0, 61, 51))
        }

        val title = TextView(this).apply {
            text = "Hassoun Watch Data"
            textSize = 20f
            setTextColor(Color.rgb(246, 197, 79))
            gravity = Gravity.CENTER
        }

        status = TextView(this).apply {
            textSize = 14f
            setTextColor(Color.WHITE)
            gravity = Gravity.CENTER
            setPadding(0, 18, 0, 18)
        }

        enableButton = Button(this).apply {
            text = "Enable live data"
            setOnClickListener { continuePermissionFlow() }
        }

        layout.addView(title)
        layout.addView(status)
        layout.addView(enableButton)
        setContentView(layout)
        updateUiAndMaybeStart()
    }

    override fun onResume() {
        super.onResume()
        if (::status.isInitialized) {
            updateUiAndMaybeStart()
        }
    }

    private fun hasActivityPermission(): Boolean {
        return checkSelfPermission(Manifest.permission.ACTIVITY_RECOGNITION) == PackageManager.PERMISSION_GRANTED
    }

    private fun hasLocationPermission(): Boolean {
        return checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED ||
            checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED
    }

    private fun hasPermissions(): Boolean = hasActivityPermission() && hasLocationPermission()

    private fun continuePermissionFlow() {
        when {
            !hasActivityPermission() -> {
                status.text = "Allow Physical activity for daily calories."
                requestPermissions(arrayOf(Manifest.permission.ACTIVITY_RECOGNITION), REQUEST_ACTIVITY)
            }
            !hasLocationPermission() -> {
                status.text = "Allow Location for Qibla direction."
                requestPermissions(
                    arrayOf(
                        Manifest.permission.ACCESS_FINE_LOCATION,
                        Manifest.permission.ACCESS_COARSE_LOCATION
                    ),
                    REQUEST_LOCATION
                )
            }
            else -> startDataSafely()
        }
    }

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)

        when (requestCode) {
            REQUEST_ACTIVITY -> {
                if (hasActivityPermission()) {
                    continuePermissionFlow()
                } else {
                    status.text = "Physical activity permission is needed for calories. Tap Enable live data to try again."
                }
            }
            REQUEST_LOCATION -> {
                if (hasLocationPermission()) {
                    startDataSafely()
                } else {
                    status.text = "Location permission is needed for Qibla. Tap Enable live data to try again."
                }
            }
        }
    }

    private fun updateUiAndMaybeStart() {
        if (hasPermissions()) {
            startDataSafely()
            return
        }

        startingData = false
        enableButton.isEnabled = true
        status.text = when {
            !hasActivityPermission() -> "Tap Enable live data, then allow Physical activity for calories."
            !hasLocationPermission() -> "Physical activity is allowed. Tap Enable live data, then allow Location for Qibla."
            else -> "Tap Enable live data."
        }
    }

    private fun startDataSafely() {
        if (startingData) return
        startingData = true
        enableButton.isEnabled = false
        status.text = "Connecting live watch data…"

        val healthResult = runCatching { HealthRegistration.register(this) }
        val locationResult = runCatching { refreshLocation() }

        if (healthResult.isFailure || locationResult.isFailure) {
            startingData = false
            enableButton.isEnabled = true
            status.text = "Live data could not start. Tap Enable live data to retry."
            return
        }

        if (WatchDataStore.location(this) != null) {
            status.text = "Live data enabled. Qibla location connected."
        } else {
            status.text = "Live data enabled. Finding Qibla location…"
        }
    }

    private fun refreshLocation() {
        if (!hasLocationPermission()) return

        val manager = getSystemService(Context.LOCATION_SERVICE) as LocationManager
        val enabledProviders = manager.getProviders(true)

        // Wear OS/Google Maps often already has a usable fused or network fix.
        // Save the newest cached fix immediately instead of waiting for GPS.
        newestLastKnownLocation(manager, enabledProviders)?.let { location ->
            saveQiblaLocation(location)
        }

        val candidates = buildList {
            add(LocationManager.FUSED_PROVIDER)
            add(LocationManager.NETWORK_PROVIDER)
            add(LocationManager.GPS_PROVIDER)
            enabledProviders.forEach { provider -> if (!contains(provider)) add(provider) }
        }.filter { provider ->
            runCatching { manager.isProviderEnabled(provider) }.getOrDefault(false)
        }

        if (candidates.isEmpty()) {
            if (WatchDataStore.location(this) == null) {
                locationFailed("Turn on Location on the watch, then tap Enable live data again.")
            }
            return
        }

        var completed = 0
        candidates.forEach { provider ->
            runCatching {
                manager.getCurrentLocation(provider, null, mainExecutor) { location ->
                    completed += 1
                    if (location != null) {
                        saveQiblaLocation(location)
                    } else if (completed == candidates.size && WatchDataStore.location(this) == null) {
                        locationFailed("Could not get a watch location. Open Maps until your blue dot appears, then tap Enable live data again.")
                    }
                }
            }.onFailure {
                completed += 1
                if (completed == candidates.size && WatchDataStore.location(this) == null) {
                    locationFailed("Could not get a watch location. Tap Enable live data to retry.")
                }
            }
        }
    }

    private fun newestLastKnownLocation(
        manager: LocationManager,
        providers: List<String>
    ): Location? {
        return providers
            .asSequence()
            .mapNotNull { provider -> runCatching { manager.getLastKnownLocation(provider) }.getOrNull() }
            .maxByOrNull { it.time }
    }

    private fun saveQiblaLocation(location: Location) {
        WatchDataStore.saveLocation(this, location)
        startingData = false
        enableButton.isEnabled = true
        status.text = "Live data enabled. Qibla location connected."
    }

    private fun locationFailed(message: String) {
        startingData = false
        enableButton.isEnabled = true
        status.text = message
    }

    companion object {
        private const val REQUEST_ACTIVITY = 9001
        private const val REQUEST_LOCATION = 9002
    }
}
