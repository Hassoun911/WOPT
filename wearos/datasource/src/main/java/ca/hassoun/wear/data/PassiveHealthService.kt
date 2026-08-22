package ca.hassoun.wear.data

import androidx.health.services.client.PassiveListenerService
import androidx.health.services.client.data.DataPointContainer
import androidx.health.services.client.data.DataType

class PassiveHealthService : PassiveListenerService() {
    override fun onNewDataPointsReceived(dataPoints: DataPointContainer) {
        dataPoints.getData(DataType.CALORIES_DAILY)
            .lastOrNull()
            ?.value
            ?.let { WatchDataStore.saveCalories(this, it) }
    }
}
