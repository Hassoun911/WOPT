package ca.hassoun.wear.data

import android.content.Context
import android.location.Location

object WatchDataStore {
    private const val PREFS = "hassoun_watch_data"
    private const val KEY_CALORIES = "calories_daily"
    private const val KEY_LAT = "latitude"
    private const val KEY_LON = "longitude"
    private const val KEY_HAS_LOCATION = "has_location"

    fun saveCalories(context: Context, calories: Double) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit()
            .putFloat(KEY_CALORIES, calories.toFloat())
            .apply()
        ComplicationRefresh.calories(context)
    }

    fun calories(context: Context): Double? {
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        return if (prefs.contains(KEY_CALORIES)) prefs.getFloat(KEY_CALORIES, 0f).toDouble() else null
    }

    fun saveLocation(context: Context, location: Location) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit()
            .putBoolean(KEY_HAS_LOCATION, true)
            .putString(KEY_LAT, location.latitude.toString())
            .putString(KEY_LON, location.longitude.toString())
            .apply()
        ComplicationRefresh.qibla(context)
    }

    fun location(context: Context): Pair<Double, Double>? {
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        if (!prefs.getBoolean(KEY_HAS_LOCATION, false)) return null
        val lat = prefs.getString(KEY_LAT, null)?.toDoubleOrNull() ?: return null
        val lon = prefs.getString(KEY_LON, null)?.toDoubleOrNull() ?: return null
        return lat to lon
    }
}
