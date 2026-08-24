package ca.wopt.hassounwidget

import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.content.Intent

class HassounLockScreenWidgetProvider : AppWidgetProvider() {
  override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
    appWidgetIds.forEach { HassounPrayerWidgetProvider.updateTransparentWidget(context, appWidgetManager, it) }
  }

  override fun onAppWidgetOptionsChanged(
    context: Context,
    appWidgetManager: AppWidgetManager,
    appWidgetId: Int,
    newOptions: android.os.Bundle
  ) {
    HassounPrayerWidgetProvider.updateTransparentWidget(context, appWidgetManager, appWidgetId)
  }

  override fun onReceive(context: Context, intent: Intent) {
    super.onReceive(context, intent)
    if (
      intent.action == HassounWidgetStore.ACTION_REFRESH ||
      intent.action == Intent.ACTION_BOOT_COMPLETED ||
      intent.action == Intent.ACTION_TIME_CHANGED ||
      intent.action == Intent.ACTION_TIMEZONE_CHANGED
    ) {
      HassounPrayerWidgetProvider.updateAll(context)
    }
  }
}
