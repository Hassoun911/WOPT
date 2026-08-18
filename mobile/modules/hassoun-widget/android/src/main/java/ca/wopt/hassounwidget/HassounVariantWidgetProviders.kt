package ca.wopt.hassounwidget

import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context

open class HassounVariantWidgetProvider : AppWidgetProvider() {
  override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
    HassounPrayerWidgetProvider.updateAll(context)
  }

  override fun onAppWidgetOptionsChanged(
    context: Context,
    appWidgetManager: AppWidgetManager,
    appWidgetId: Int,
    newOptions: android.os.Bundle
  ) {
    HassounPrayerWidgetProvider.updateAll(context)
  }
}

class HassounSquareWidgetProvider : HassounVariantWidgetProvider()
class HassounVerticalWidgetProvider : HassounVariantWidgetProvider()
class HassounSlimWidgetProvider : HassounVariantWidgetProvider()
