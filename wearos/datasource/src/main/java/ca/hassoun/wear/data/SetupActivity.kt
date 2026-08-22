package ca.hassoun.wear.data

import android.Manifest
import android.app.Activity
import android.content.Context
import android.content.pm.PackageManager
import android.graphics.Color
import android.location.LocationManager
import android.os.Bundle
import android.view.Gravity
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView

class SetupActivity : Activity() {
    private lateinit var status: TextView

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

        val button = Button(this).apply {
            text = "Enable live data"
            setOnClickListener { requestRequiredPermissions() }
        }

        layout.addView(title)
        layout.addView(status)
        layout.addView(button)
        setContentView(layout)

        if (hasPermissions()) {
            startData()
        } else {
            status.text = "Grant Activity Recognition for calories and Location for Qibla."
        }
    }

    private fun hasPermissions(): Boolean {
        return checkSelfPermission(Manifest.permission.ACTIVITY_RECOGNITION) == PackageManager.PERMISSION_GRANTED &&
            (checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED ||
                checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED)
    }

    private fun requestRequiredPermissions() {
        requestPermissions(
            arrayOf(
                Manifest.permission.ACTIVITY_RECOGNITION,
                Manifest.permission.ACCESS_FINE_LOCATION,
                Manifest.permission.ACCESS_COARSE_LOCATION
            ),
            REQUEST_PERMISSIONS
        )
    }

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == REQUEST_PERMISSIONS && hasPermissions()) {
            startData()
        } else {
            status.text = "Permissions are still needed for calories and Qibla."
        }
    }

    private fun startData() {
        HealthRegistration.register(this)
        refreshLocation()
        status.text = "Live data enabled. Steps come from Wear OS. Calories and Qibla are now connected to Hassoun."
    }

    private fun refreshLocation() {
        val manager = getSystemService(Context.LOCATION_SERVICE) as LocationManager
        val provider = manager.getProviders(true).firstOrNull() ?: return
        runCatching {
            manager.getCurrentLocation(provider, null, mainExecutor) { location ->
                if (location != null) WatchDataStore.saveLocation(this, location)
            }
        }
    }

    companion object {
        private const val REQUEST_PERMISSIONS = 9001
    }
}
