package ca.wopt.prayeraudio

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build

class PrayerAlarmReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    val serviceIntent = Intent(context, PrayerAudioService::class.java).apply {
      action = PrayerAudioService.ACTION_PLAY
      putExtra("eventId", intent.getStringExtra("eventId"))
      putExtra("prayer", intent.getStringExtra("prayer"))
    }
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      context.startForegroundService(serviceIntent)
    } else {
      context.startService(serviceIntent)
    }
  }
}
