package ca.wopt.prayeraudio

import android.app.AlarmManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

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
}
