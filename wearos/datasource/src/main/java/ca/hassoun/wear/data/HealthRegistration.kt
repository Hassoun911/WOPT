package ca.hassoun.wear.data

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import androidx.health.services.client.HealthServices
import androidx.health.services.client.data.DataType
import androidx.health.services.client.data.PassiveListenerConfig

object HealthRegistration {
    fun register(context: Context) {
        if (context.checkSelfPermission(Manifest.permission.ACTIVITY_RECOGNITION) != PackageManager.PERMISSION_GRANTED) {
            return
        }

        val config = PassiveListenerConfig.builder()
            .setDataTypes(setOf(DataType.CALORIES_DAILY))
            .build()

        HealthServices.getClient(context)
            .passiveMonitoringClient
            .setPassiveListenerServiceAsync(PassiveHealthService::class.java, config)
    }
}
