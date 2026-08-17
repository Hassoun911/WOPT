from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
provider = ROOT / "mobile/modules/hassoun-widget/android/src/main/java/ca/wopt/hassounwidget/HassounPrayerWidgetProvider.kt"
settings = ROOT / "mobile/src/SettingsHub.tsx"
config = ROOT / "mobile/app.config.ts"
res = ROOT / "mobile/modules/hassoun-widget/android/src/main/res"

text = provider.read_text()
if "import android.appwidget.AppWidgetProviderInfo" not in text:
    text = text.replace(
        "import android.appwidget.AppWidgetProvider\n",
        "import android.appwidget.AppWidgetProvider\nimport android.appwidget.AppWidgetProviderInfo\n",
    )

old = "      val views = RemoteViews(context.packageName, R.layout.hassoun_prayer_widget)\n"
new = """      val widgetOptions = manager.getAppWidgetOptions(appWidgetId)\n      val hostCategory = widgetOptions.getInt(\n        AppWidgetManager.OPTION_APPWIDGET_HOST_CATEGORY,\n        AppWidgetProviderInfo.WIDGET_CATEGORY_HOME_SCREEN\n      )\n      val isLockScreen = (hostCategory and AppWidgetProviderInfo.WIDGET_CATEGORY_KEYGUARD) != 0\n      val views = RemoteViews(\n        context.packageName,\n        if (isLockScreen) R.layout.hassoun_prayer_widget_lockscreen else R.layout.hassoun_prayer_widget\n      )\n"""
if old in text:
    text = text.replace(old, new, 1)

text = text.replace(
    '        val fullLayout = layout == "full"\n        if (fullLayout && showAllPrayers) {\n',
    '        val fullLayout = isLockScreen || layout == "full"\n        if (fullLayout && (showAllPrayers || isLockScreen)) {\n',
    1,
)
text = text.replace(
    "          bindPrayerStrip(views, next.day, locale, next.key)\n",
    "          bindPrayerStrip(views, next.day, locale, next.key, isLockScreen)\n",
    1,
)
text = text.replace(
    '      val compact = layout == "compact"\n',
    '      val compact = !isLockScreen && layout == "compact"\n',
    1,
)
text = text.replace(
    "      if (!compact && showLocation) {\n",
    "      if (!isLockScreen && !compact && showLocation) {\n",
    1,
)
text = text.replace(
    "    private fun bindPrayerStrip(views: RemoteViews, day: JSONObject, locale: String, nextKey: String) {\n",
    "    private fun bindPrayerStrip(views: RemoteViews, day: JSONObject, locale: String, nextKey: String, lockScreen: Boolean = false) {\n",
    1,
)
old_color = '        views.setTextColor(id, Color.parseColor(if (active) "#F3D98B" else "#E7F3EF"))\n'
new_color = '''        views.setTextColor(\n          id,\n          Color.parseColor(if (active) "#F4D26F" else if (lockScreen) "#FFFFFF" else "#E7F3EF")\n        )\n        if (lockScreen) {\n          views.setInt(\n            id,\n            "setBackgroundResource",\n            if (active) R.drawable.hassoun_widget_lock_prayer_active else R.drawable.hassoun_widget_lock_prayer_idle\n          )\n        }\n'''
if old_color in text:
    text = text.replace(old_color, new_color, 1)

provider.write_text(text)

# Transparent lock-screen RemoteViews layout. IDs intentionally mirror the home widget so one provider can bind both.
(res / "layout").mkdir(parents=True, exist_ok=True)
(res / "layout/hassoun_prayer_widget_lockscreen.xml").write_text(r'''<?xml version="1.0" encoding="utf-8"?>
<LinearLayout xmlns:android="http://schemas.android.com/apk/res/android"
  android:id="@+id/widget_root"
  android:layout_width="match_parent"
  android:layout_height="match_parent"
  android:orientation="vertical"
  android:gravity="center_vertical"
  android:background="@android:color/transparent"
  android:padding="8dp">

  <LinearLayout
    android:layout_width="match_parent"
    android:layout_height="wrap_content"
    android:orientation="horizontal"
    android:gravity="center_vertical">

    <LinearLayout
      android:layout_width="0dp"
      android:layout_height="wrap_content"
      android:layout_weight="1"
      android:orientation="vertical">
      <TextView
        android:id="@+id/widget_header"
        android:layout_width="wrap_content"
        android:layout_height="wrap_content"
        android:text="HASSOUN"
        android:textColor="#F4D26F"
        android:textStyle="bold"
        android:textSize="10sp"
        android:shadowColor="#B0000000"
        android:shadowDx="0"
        android:shadowDy="1"
        android:shadowRadius="3" />
      <TextView
        android:id="@+id/widget_brand_subtitle"
        android:layout_width="wrap_content"
        android:layout_height="wrap_content"
        android:layout_marginTop="1dp"
        android:textColor="#F2FFFFFF"
        android:textStyle="bold"
        android:textSize="7sp"
        android:shadowColor="#B0000000"
        android:shadowDx="0"
        android:shadowDy="1"
        android:shadowRadius="3" />
    </LinearLayout>

    <LinearLayout
      android:layout_width="wrap_content"
      android:layout_height="wrap_content"
      android:gravity="end"
      android:orientation="vertical">
      <TextView
        android:id="@+id/widget_date"
        android:layout_width="wrap_content"
        android:layout_height="wrap_content"
        android:textColor="#FFFFFF"
        android:textStyle="bold"
        android:textSize="8sp"
        android:shadowColor="#B0000000"
        android:shadowDx="0"
        android:shadowDy="1"
        android:shadowRadius="3" />
      <TextView
        android:id="@+id/widget_hijri"
        android:layout_width="wrap_content"
        android:layout_height="wrap_content"
        android:layout_marginTop="1dp"
        android:textColor="#F4D26F"
        android:textSize="8sp"
        android:shadowColor="#B0000000"
        android:shadowDx="0"
        android:shadowDy="1"
        android:shadowRadius="3" />
    </LinearLayout>
  </LinearLayout>

  <LinearLayout
    android:layout_width="match_parent"
    android:layout_height="wrap_content"
    android:layout_marginTop="5dp"
    android:orientation="horizontal"
    android:gravity="center_vertical">

    <LinearLayout
      android:layout_width="0dp"
      android:layout_height="wrap_content"
      android:layout_weight="1"
      android:orientation="vertical">
      <TextView
        android:id="@+id/widget_next_label"
        android:layout_width="wrap_content"
        android:layout_height="wrap_content"
        android:text="NEXT PRAYER"
        android:textColor="#F4D26F"
        android:textStyle="bold"
        android:textSize="7sp"
        android:shadowColor="#C0000000"
        android:shadowDx="0"
        android:shadowDy="1"
        android:shadowRadius="3" />
      <TextView
        android:id="@+id/widget_next_name"
        android:layout_width="wrap_content"
        android:layout_height="wrap_content"
        android:layout_marginTop="1dp"
        android:textColor="#FFFFFF"
        android:textStyle="bold"
        android:textSize="20sp"
        android:maxLines="1"
        android:shadowColor="#D0000000"
        android:shadowDx="0"
        android:shadowDy="1"
        android:shadowRadius="4" />
      <TextView
        android:id="@+id/widget_next_secondary"
        android:layout_width="wrap_content"
        android:layout_height="wrap_content"
        android:layout_marginTop="1dp"
        android:textColor="#E6FFFFFF"
        android:textSize="8sp"
        android:maxLines="1"
        android:shadowColor="#C0000000"
        android:shadowDx="0"
        android:shadowDy="1"
        android:shadowRadius="3" />
    </LinearLayout>

    <LinearLayout
      android:layout_width="wrap_content"
      android:layout_height="wrap_content"
      android:gravity="end"
      android:orientation="vertical">
      <TextView
        android:id="@+id/widget_next_time"
        android:layout_width="wrap_content"
        android:layout_height="wrap_content"
        android:textColor="#FFFFFF"
        android:textStyle="bold"
        android:textSize="18sp"
        android:maxLines="1"
        android:shadowColor="#D0000000"
        android:shadowDx="0"
        android:shadowDy="1"
        android:shadowRadius="4" />
      <Chronometer
        android:id="@+id/widget_countdown"
        android:layout_width="wrap_content"
        android:layout_height="wrap_content"
        android:layout_marginTop="2dp"
        android:paddingLeft="7dp"
        android:paddingTop="2dp"
        android:paddingRight="7dp"
        android:paddingBottom="2dp"
        android:background="@drawable/hassoun_widget_lock_countdown"
        android:textColor="#FFFFFF"
        android:textStyle="bold"
        android:textSize="7sp"
        android:shadowColor="#A0000000"
        android:shadowDx="0"
        android:shadowDy="1"
        android:shadowRadius="2" />
    </LinearLayout>
  </LinearLayout>

  <LinearLayout
    android:id="@+id/widget_prayer_strip"
    android:layout_width="match_parent"
    android:layout_height="wrap_content"
    android:layout_marginTop="7dp"
    android:orientation="horizontal"
    android:gravity="center_vertical">
    <TextView android:id="@+id/widget_prayer_fajr" android:layout_width="0dp" android:layout_height="39dp" android:layout_weight="1" android:layout_marginEnd="2dp" android:gravity="center" android:padding="2dp" android:textColor="#FFFFFF" android:textStyle="bold" android:textSize="7sp" android:maxLines="2" android:shadowColor="#B0000000" android:shadowDx="0" android:shadowDy="1" android:shadowRadius="2" />
    <TextView android:id="@+id/widget_prayer_dhuhr" android:layout_width="0dp" android:layout_height="39dp" android:layout_weight="1" android:layout_marginStart="2dp" android:layout_marginEnd="2dp" android:gravity="center" android:padding="2dp" android:textColor="#FFFFFF" android:textStyle="bold" android:textSize="7sp" android:maxLines="2" android:shadowColor="#B0000000" android:shadowDx="0" android:shadowDy="1" android:shadowRadius="2" />
    <TextView android:id="@+id/widget_prayer_asr" android:layout_width="0dp" android:layout_height="39dp" android:layout_weight="1" android:layout_marginStart="2dp" android:layout_marginEnd="2dp" android:gravity="center" android:padding="2dp" android:textColor="#FFFFFF" android:textStyle="bold" android:textSize="7sp" android:maxLines="2" android:shadowColor="#B0000000" android:shadowDx="0" android:shadowDy="1" android:shadowRadius="2" />
    <TextView android:id="@+id/widget_prayer_maghrib" android:layout_width="0dp" android:layout_height="39dp" android:layout_weight="1" android:layout_marginStart="2dp" android:layout_marginEnd="2dp" android:gravity="center" android:padding="2dp" android:textColor="#FFFFFF" android:textStyle="bold" android:textSize="7sp" android:maxLines="2" android:shadowColor="#B0000000" android:shadowDx="0" android:shadowDy="1" android:shadowRadius="2" />
    <TextView android:id="@+id/widget_prayer_isha" android:layout_width="0dp" android:layout_height="39dp" android:layout_weight="1" android:layout_marginStart="2dp" android:gravity="center" android:padding="2dp" android:textColor="#FFFFFF" android:textStyle="bold" android:textSize="7sp" android:maxLines="2" android:shadowColor="#B0000000" android:shadowDx="0" android:shadowDy="1" android:shadowRadius="2" />
  </LinearLayout>

  <TextView
    android:id="@+id/widget_location"
    android:layout_width="match_parent"
    android:layout_height="wrap_content"
    android:visibility="gone"
    android:textSize="1sp" />
</LinearLayout>
''')

(res / "drawable").mkdir(parents=True, exist_ok=True)
resources = {
"hassoun_widget_brand_badge.xml": '''<?xml version="1.0" encoding="utf-8"?>\n<shape xmlns:android="http://schemas.android.com/apk/res/android" android:shape="rectangle">\n  <solid android:color="#2AFFFFFF" />\n  <stroke android:width="1dp" android:color="#40F4D26F" />\n  <corners android:radius="12dp" />\n</shape>\n''',
"hassoun_widget_countdown.xml": '''<?xml version="1.0" encoding="utf-8"?>\n<shape xmlns:android="http://schemas.android.com/apk/res/android" android:shape="rectangle">\n  <solid android:color="#F4D26F" />\n  <corners android:radius="16dp" />\n</shape>\n''',
"hassoun_widget_prayer_chip.xml": '''<?xml version="1.0" encoding="utf-8"?>\n<shape xmlns:android="http://schemas.android.com/apk/res/android" android:shape="rectangle">\n  <solid android:color="#16FFFFFF" />\n  <stroke android:width="1dp" android:color="#24FFFFFF" />\n  <corners android:radius="11dp" />\n</shape>\n''',
"hassoun_widget_lock_prayer_idle.xml": '''<?xml version="1.0" encoding="utf-8"?>\n<shape xmlns:android="http://schemas.android.com/apk/res/android" android:shape="rectangle">\n  <solid android:color="#18000000" />\n  <stroke android:width="1dp" android:color="#42FFFFFF" />\n  <corners android:radius="11dp" />\n</shape>\n''',
"hassoun_widget_lock_prayer_active.xml": '''<?xml version="1.0" encoding="utf-8"?>\n<shape xmlns:android="http://schemas.android.com/apk/res/android" android:shape="rectangle">\n  <solid android:color="#3A0B7057" />\n  <stroke android:width="1.5dp" android:color="#CCF4D26F" />\n  <corners android:radius="11dp" />\n</shape>\n''',
"hassoun_widget_lock_countdown.xml": '''<?xml version="1.0" encoding="utf-8"?>\n<shape xmlns:android="http://schemas.android.com/apk/res/android" android:shape="rectangle">\n  <solid android:color="#4A000000" />\n  <stroke android:width="1dp" android:color="#88F4D26F" />\n  <corners android:radius="14dp" />\n</shape>\n''',
}
for name, content in resources.items():
    (res / "drawable" / name).write_text(content)

# Explain the dedicated transparent lock-screen presentation in Settings.
s = settings.read_text()
old = 'This Hassoun widget is marked as lock-screen eligible on supported Android 16+/17 devices. Add it from your phone’s Lock screen customization screen. Samsung/other manufacturers decide where lock-screen widgets are offered.'
new = 'On supported Android lock screens, Hassoun automatically switches to a transparent Prayer Times layout: no solid card background, the next prayer is highlighted, and all five prayer times stay visible. Your Home Screen widget keeps its selected style. Add it from your phone’s Lock screen customization screen; Samsung/other manufacturers decide where third-party lock-screen widgets are offered.'
if old in s:
    s = s.replace(old, new, 1)
old_ar = 'تم تجهيز ويدجت Hassoun للعمل على شاشة القفل في أجهزة Android 16+/17 المدعومة. أضفه من إعدادات تخصيص شاشة القفل. تحدد Samsung والشركات الأخرى مكان توفر ويدجت شاشة القفل.'
new_ar = 'على شاشات القفل المدعومة يتحول Hassoun تلقائياً إلى تصميم شفاف لمواقيت الصلاة بدون خلفية صلبة، مع تمييز الصلاة القادمة وإظهار الصلوات الخمس. يبقى تصميم الشاشة الرئيسية كما اخترته. أضفه من إعدادات تخصيص شاشة القفل؛ تحدد Samsung والشركات الأخرى مكان توفر ويدجت الطرف الثالث.'
if old_ar in s:
    s = s.replace(old_ar, new_ar, 1)
settings.write_text(s)

c = config.read_text()
c = c.replace('version: "0.5.3"', 'version: "0.5.4"', 1)
c = c.replace('versionCode: 25', 'versionCode: 26', 1)
config.write_text(c)

print("Prepared transparent lock-screen prayer widget and Hassoun v0.5.4")
