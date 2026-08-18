from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
provider = ROOT / 'mobile/modules/hassoun-widget/android/src/main/java/ca/wopt/hassounwidget/HassounPrayerWidgetProvider.kt'
manifest = ROOT / 'mobile/modules/hassoun-widget/android/src/main/AndroidManifest.xml'
res_xml = ROOT / 'mobile/modules/hassoun-widget/android/src/main/res/xml'
java_dir = ROOT / 'mobile/modules/hassoun-widget/android/src/main/java/ca/wopt/hassounwidget'

text = provider.read_text()

old = '''      val home = ComponentName(context, HassounPrayerWidgetProvider::class.java)\n      manager.getAppWidgetIds(home).forEach { updateWidget(context, manager, it, false) }\n      val lock = ComponentName(context, HassounLockScreenWidgetProvider::class.java)\n      manager.getAppWidgetIds(lock).forEach { updateWidget(context, manager, it, false) }'''
new = '''      val providers = listOf(\n        HassounPrayerWidgetProvider::class.java,\n        HassounSquareWidgetProvider::class.java,\n        HassounVerticalWidgetProvider::class.java,\n        HassounSlimWidgetProvider::class.java\n      )\n      providers.forEach { providerClass ->\n        val component = ComponentName(context, providerClass)\n        manager.getAppWidgetIds(component).forEach { updateWidget(context, manager, it, false) }\n      }\n      val lock = ComponentName(context, HassounLockScreenWidgetProvider::class.java)\n      manager.getAppWidgetIds(lock).forEach { updateWidget(context, manager, it, false) }'''
if old not in text:
    raise SystemExit('updateAll block not found')
text = text.replace(old, new, 1)

old = '''      val requestedLayout = prefs.getString("layout", "full") ?: "full"\n      val minWidth = widgetOptions.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 0)\n      val minHeight = widgetOptions.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, 0)'''
new = '''      val requestedLayout = prefs.getString("layout", "full") ?: "full"\n      val providerClassName = manager.getAppWidgetInfo(appWidgetId)?.provider?.className.orEmpty()\n      val providerLayout = when {\n        providerClassName.endsWith("HassounSquareWidgetProvider") -> "square"\n        providerClassName.endsWith("HassounVerticalWidgetProvider") -> "vertical"\n        providerClassName.endsWith("HassounSlimWidgetProvider") -> "slim"\n        providerClassName.endsWith("HassounPrayerWidgetProvider") -> "full"\n        else -> null\n      }\n      val minWidth = widgetOptions.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 0)\n      val minHeight = widgetOptions.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, 0)'''
if old not in text:
    raise SystemExit('requestedLayout block not found')
text = text.replace(old, new, 1)

old = '''      val layout = if (isLockScreen) requestedLayout else when {\n        minWidth <= 0 || minHeight <= 0 -> "slim"'''
new = '''      val layout = if (isLockScreen) requestedLayout else providerLayout ?: when {\n        minWidth <= 0 || minHeight <= 0 -> "slim"'''
if old not in text:
    raise SystemExit('layout decision block not found')
text = text.replace(old, new, 1)

old = '''        val timeSp = if (layout == "vertical") {\n          when (timeSize) { "small" -> 15f; "medium" -> 17f; "xlarge" -> 21f; else -> 19f }\n        } else {\n          when (timeSize) { "small" -> 20f; "medium" -> 25f; "xlarge" -> 35f; else -> 30f }\n        }\n        val prayerNameSp = if (layout == "vertical") {\n          when (focus) { "all" -> 15f; "balanced" -> 17f; else -> 19f }\n        } else {\n          when (focus) { "all" -> 20f; "balanced" -> 23f; else -> 26f }\n        }'''
new = '''        val timeSp = when (layout) {\n          "vertical" -> when (timeSize) { "small" -> 21f; "medium" -> 25f; "xlarge" -> 34f; else -> 29f }\n          "square" -> when (timeSize) { "small" -> 20f; "medium" -> 24f; "xlarge" -> 32f; else -> 28f }\n          "slim", "compact", "next" -> when (timeSize) { "small" -> 24f; "medium" -> 29f; "xlarge" -> 40f; else -> 34f }\n          else -> when (timeSize) { "small" -> 25f; "medium" -> 31f; "xlarge" -> 44f; else -> 37f }\n        }\n        val prayerNameSp = when (layout) {\n          "vertical" -> when (focus) { "all" -> 21f; "balanced" -> 25f; else -> 30f }\n          "square" -> when (focus) { "all" -> 20f; "balanced" -> 24f; else -> 29f }\n          "slim", "compact", "next" -> when (focus) { "all" -> 20f; "balanced" -> 25f; else -> 31f }\n          else -> when (focus) { "all" -> 22f; "balanced" -> 27f; else -> 34f }\n        }'''
if old not in text:
    raise SystemExit('text size block not found')
text = text.replace(old, new, 1)

old = '''        val stripSp = if (lockScreen) 9f else when (timeSize) {\n          "small" -> 8f\n          "xlarge" -> 10f\n          else -> 9f\n        }'''
new = '''        val stripSp = if (lockScreen) 10f else when (timeSize) {\n          "small" -> 9.5f\n          "medium" -> 11f\n          "xlarge" -> 14f\n          else -> 12.5f\n        }'''
if old not in text:
    raise SystemExit('strip size block not found')
text = text.replace(old, new, 1)
provider.write_text(text)

variants = '''package ca.wopt.hassounwidget\n\nimport android.appwidget.AppWidgetManager\nimport android.appwidget.AppWidgetProvider\nimport android.content.ComponentName\nimport android.content.Context\nimport android.content.Intent\n\nopen class HassounVariantWidgetProvider : AppWidgetProvider() {\n  override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {\n    appWidgetIds.forEach { HassounPrayerWidgetProvider.updateTransparentWidget(context, appWidgetManager, it) }\n  }\n\n  override fun onAppWidgetOptionsChanged(context: Context, appWidgetManager: AppWidgetManager, appWidgetId: Int, newOptions: android.os.Bundle) {\n    HassounPrayerWidgetProvider.updateTransparentWidget(context, appWidgetManager, appWidgetId)\n  }\n\n  override fun onReceive(context: Context, intent: Intent) {\n    super.onReceive(context, intent)\n    if (intent.action == HassounWidgetStore.ACTION_REFRESH || intent.action == Intent.ACTION_BOOT_COMPLETED || intent.action == Intent.ACTION_TIME_CHANGED || intent.action == Intent.ACTION_TIMEZONE_CHANGED) {\n      val manager = AppWidgetManager.getInstance(context)\n      val component = ComponentName(context, this::class.java)\n      manager.getAppWidgetIds(component).forEach { HassounPrayerWidgetProvider.updateTransparentWidget(context, manager, it) }\n    }\n  }\n}\n\nclass HassounSquareWidgetProvider : HassounVariantWidgetProvider()\nclass HassounVerticalWidgetProvider : HassounVariantWidgetProvider()\nclass HassounSlimWidgetProvider : HassounVariantWidgetProvider()\n'''
(java_dir / 'HassounVariantWidgetProviders.kt').write_text(variants)

m = manifest.read_text()
insert_after = '''    </receiver>\n    <receiver\n      android:name=".HassounLockScreenWidgetProvider"'''
variants_manifest = '''    </receiver>\n\n    <receiver android:name=".HassounSquareWidgetProvider" android:enabled="true" android:exported="false" android:label="Hassoun Square 2×2">\n      <intent-filter>\n        <action android:name="android.appwidget.action.APPWIDGET_UPDATE" />\n        <action android:name="android.intent.action.BOOT_COMPLETED" />\n        <action android:name="android.intent.action.TIME_SET" />\n        <action android:name="android.intent.action.TIMEZONE_CHANGED" />\n        <action android:name="ca.wopt.hassounwidget.REFRESH" />\n      </intent-filter>\n      <meta-data android:name="android.appwidget.provider" android:resource="@xml/hassoun_square_widget_info" />\n    </receiver>\n\n    <receiver android:name=".HassounVerticalWidgetProvider" android:enabled="true" android:exported="false" android:label="Hassoun Vertical 2×4">\n      <intent-filter>\n        <action android:name="android.appwidget.action.APPWIDGET_UPDATE" />\n        <action android:name="android.intent.action.BOOT_COMPLETED" />\n        <action android:name="android.intent.action.TIME_SET" />\n        <action android:name="android.intent.action.TIMEZONE_CHANGED" />\n        <action android:name="ca.wopt.hassounwidget.REFRESH" />\n      </intent-filter>\n      <meta-data android:name="android.appwidget.provider" android:resource="@xml/hassoun_vertical_widget_info" />\n    </receiver>\n\n    <receiver android:name=".HassounSlimWidgetProvider" android:enabled="true" android:exported="false" android:label="Hassoun Slim 4×1">\n      <intent-filter>\n        <action android:name="android.appwidget.action.APPWIDGET_UPDATE" />\n        <action android:name="android.intent.action.BOOT_COMPLETED" />\n        <action android:name="android.intent.action.TIME_SET" />\n        <action android:name="android.intent.action.TIMEZONE_CHANGED" />\n        <action android:name="ca.wopt.hassounwidget.REFRESH" />\n      </intent-filter>\n      <meta-data android:name="android.appwidget.provider" android:resource="@xml/hassoun_slim_widget_info" />\n    </receiver>\n\n    <receiver\n      android:name=".HassounLockScreenWidgetProvider"'''
if insert_after not in m:
    raise SystemExit('manifest insertion point not found')
m = m.replace(insert_after, variants_manifest, 1)
manifest.write_text(m)

base_info = res_xml / 'hassoun_prayer_widget_info.xml'
base = base_info.read_text()
base = base.replace('android:initialLayout="@layout/hassoun_prayer_widget_slim"', 'android:initialLayout="@layout/hassoun_prayer_widget_slim"')
base = base.replace('android:previewLayout="@layout/hassoun_prayer_widget_slim"', 'android:previewLayout="@layout/hassoun_prayer_widget"')
if 'android:targetCellWidth=' not in base:
    base = base.replace('android:minResizeHeight="90dp"', 'android:minResizeHeight="90dp"\n  android:targetCellWidth="4"\n  android:targetCellHeight="2"')
base_info.write_text(base)

infos = {
'hassoun_square_widget_info.xml': ('110dp','110dp','110dp','110dp','2','2','hassoun_prayer_widget_square'),
'hassoun_vertical_widget_info.xml': ('110dp','250dp','110dp','180dp','2','4','hassoun_prayer_widget_vertical'),
'hassoun_slim_widget_info.xml': ('250dp','60dp','180dp','60dp','4','1','hassoun_prayer_widget_slim'),
}
for name, (mw,mh,rw,rh,cw,ch,preview) in infos.items():
    (res_xml / name).write_text(f'''<?xml version="1.0" encoding="utf-8"?>\n<appwidget-provider xmlns:android="http://schemas.android.com/apk/res/android"\n  android:minWidth="{mw}"\n  android:minHeight="{mh}"\n  android:minResizeWidth="{rw}"\n  android:minResizeHeight="{rh}"\n  android:targetCellWidth="{cw}"\n  android:targetCellHeight="{ch}"\n  android:updatePeriodMillis="1800000"\n  android:initialLayout="@layout/hassoun_prayer_widget_slim"\n  android:previewLayout="@layout/{preview}"\n  android:resizeMode="horizontal|vertical"\n  android:widgetCategory="home_screen"\n  android:description="@string/hassoun_widget_description" />\n''')

# Increase static labels in the full native layout too.
full_layout = ROOT / 'mobile/modules/hassoun-widget/android/src/main/res/layout/hassoun_prayer_widget.xml'
f = full_layout.read_text()
f = f.replace('android:textSize="11sp"', 'android:textSize="14sp"', 1)
f = f.replace('android:textSize="6.5sp"', 'android:textSize="9sp"', 1)
f = f.replace('android:textSize="8sp"', 'android:textSize="10sp"', 1)
f = f.replace('android:textSize="7.5sp"', 'android:textSize="9sp"', 1)
f = f.replace('android:textSize="7sp"', 'android:textSize="9sp"', 1)
full_layout.write_text(f)

print('Applied Hassoun v0.6.7 four-size widget registration and readable native sizing.')
