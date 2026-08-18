from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]

VERTICAL = '''<?xml version="1.0" encoding="utf-8"?>
<LinearLayout xmlns:android="http://schemas.android.com/apk/res/android"
  android:id="@+id/widget_root"
  android:layout_width="match_parent"
  android:layout_height="match_parent"
  android:orientation="vertical"
  android:background="@drawable/hassoun_widget_patterned"
  android:padding="7dp">

  <LinearLayout android:layout_width="match_parent" android:layout_height="34dp" android:orientation="horizontal" android:gravity="center_vertical">
    <ImageView android:id="@+id/widget_logo" android:layout_width="32dp" android:layout_height="32dp" android:src="@drawable/hassoun_widget_logo" android:scaleType="fitCenter" android:contentDescription="Hassoun"/>
    <LinearLayout android:layout_width="0dp" android:layout_height="wrap_content" android:layout_weight="1" android:layout_marginStart="6dp" android:orientation="vertical">
      <TextView android:id="@+id/widget_header" android:layout_width="wrap_content" android:layout_height="wrap_content" android:text="HASSOUN" android:textColor="#FFFFFF" android:textStyle="bold" android:textSize="10sp"/>
      <TextView android:id="@+id/widget_brand_subtitle" android:layout_width="wrap_content" android:layout_height="wrap_content" android:textColor="#BFDCD2" android:textStyle="bold" android:textSize="5.5sp"/>
    </LinearLayout>
  </LinearLayout>

  <LinearLayout android:layout_width="match_parent" android:layout_height="18dp" android:orientation="horizontal" android:gravity="center_vertical">
    <TextView android:id="@+id/widget_date" android:layout_width="0dp" android:layout_height="wrap_content" android:layout_weight="1" android:textColor="#F7F1DE" android:textStyle="bold" android:textSize="7sp" android:maxLines="1"/>
    <TextView android:id="@+id/widget_hijri" android:layout_width="0dp" android:layout_height="wrap_content" android:layout_weight="1" android:gravity="end" android:textColor="#D8C17A" android:textSize="7sp" android:maxLines="1"/>
  </LinearLayout>

  <LinearLayout android:layout_width="match_parent" android:layout_height="64dp" android:orientation="horizontal" android:gravity="center_vertical">
    <LinearLayout android:layout_width="0dp" android:layout_height="match_parent" android:layout_weight="1" android:orientation="vertical" android:gravity="center_vertical">
      <TextView android:id="@+id/widget_next_label" android:layout_width="wrap_content" android:layout_height="wrap_content" android:text="NEXT PRAYER" android:textColor="#E5C76E" android:textStyle="bold" android:textSize="6.5sp"/>
      <TextView android:id="@+id/widget_next_name" android:layout_width="wrap_content" android:layout_height="wrap_content" android:textColor="#FFFFFF" android:textStyle="bold" android:textSize="18sp" android:maxLines="1"/>
      <TextView android:id="@+id/widget_next_secondary" android:layout_width="wrap_content" android:layout_height="wrap_content" android:textColor="#BFD9D1" android:textSize="7sp" android:maxLines="1"/>
      <TextView android:id="@+id/widget_next_time" android:layout_width="wrap_content" android:layout_height="wrap_content" android:textColor="#FFFFFF" android:textStyle="bold" android:textSize="18sp" android:maxLines="1"/>
    </LinearLayout>
    <Chronometer android:id="@+id/widget_countdown" android:layout_width="60dp" android:layout_height="60dp" android:gravity="center" android:background="@drawable/hassoun_widget_countdown_circle" android:padding="4dp" android:textColor="#17483C" android:textStyle="bold" android:textSize="11sp" android:maxLines="2"/>
  </LinearLayout>

  <LinearLayout android:id="@+id/widget_prayer_strip" android:layout_width="match_parent" android:layout_height="0dp" android:layout_weight="1" android:orientation="vertical" android:gravity="center">
    <TextView android:id="@+id/widget_prayer_fajr" android:layout_width="match_parent" android:layout_height="0dp" android:layout_weight="1" android:gravity="center" android:background="@drawable/hassoun_widget_prayer_chip" android:textStyle="bold" android:textSize="7.5sp" android:maxLines="2"/>
    <TextView android:id="@+id/widget_prayer_dhuhr" android:layout_width="match_parent" android:layout_height="0dp" android:layout_weight="1" android:layout_marginTop="2dp" android:gravity="center" android:background="@drawable/hassoun_widget_prayer_chip" android:textStyle="bold" android:textSize="7.5sp" android:maxLines="2"/>
    <TextView android:id="@+id/widget_prayer_asr" android:layout_width="match_parent" android:layout_height="0dp" android:layout_weight="1" android:layout_marginTop="2dp" android:gravity="center" android:background="@drawable/hassoun_widget_prayer_chip" android:textStyle="bold" android:textSize="7.5sp" android:maxLines="2"/>
    <TextView android:id="@+id/widget_prayer_maghrib" android:layout_width="match_parent" android:layout_height="0dp" android:layout_weight="1" android:layout_marginTop="2dp" android:gravity="center" android:background="@drawable/hassoun_widget_prayer_chip" android:textStyle="bold" android:textSize="7.5sp" android:maxLines="2"/>
    <TextView android:id="@+id/widget_prayer_isha" android:layout_width="match_parent" android:layout_height="0dp" android:layout_weight="1" android:layout_marginTop="2dp" android:gravity="center" android:background="@drawable/hassoun_widget_prayer_chip" android:textStyle="bold" android:textSize="7.5sp" android:maxLines="2"/>
  </LinearLayout>

  <TextView android:id="@+id/widget_location" android:layout_width="wrap_content" android:layout_height="wrap_content" android:textColor="#AFCFC5" android:textSize="6sp" android:maxLines="1"/>
</LinearLayout>
'''

vertical_path = ROOT / 'mobile/modules/hassoun-widget/android/src/main/res/layout/hassoun_prayer_widget_vertical.xml'
vertical_path.write_text(VERTICAL)

provider = ROOT / 'mobile/modules/hassoun-widget/android/src/main/java/ca/wopt/hassounwidget/HassounPrayerWidgetProvider.kt'
text = provider.read_text()
old = '''        val timeSp = when (timeSize) { "small" -> 20f; "medium" -> 25f; "xlarge" -> 35f; else -> 30f }\n        val prayerNameSp = when (focus) { "all" -> 20f; "balanced" -> 23f; else -> 26f }'''
new = '''        val timeSp = if (layout == "vertical") {\n          when (timeSize) { "small" -> 15f; "medium" -> 17f; "xlarge" -> 21f; else -> 19f }\n        } else {\n          when (timeSize) { "small" -> 20f; "medium" -> 25f; "xlarge" -> 35f; else -> 30f }\n        }\n        val prayerNameSp = if (layout == "vertical") {\n          when (focus) { "all" -> 15f; "balanced" -> 17f; else -> 19f }\n        } else {\n          when (focus) { "all" -> 20f; "balanced" -> 23f; else -> 26f }\n        }'''
if old not in text:
    raise SystemExit('Could not find time size block')
provider.write_text(text.replace(old, new, 1))

old_strip = '''        val stripSp = when { focus == "all" -> 8.8f; timeSize == "xlarge" -> 8.6f; timeSize == "small" -> 7.2f; else -> 8f }'''
new_strip = '''        val stripSp = when {\n          layout == "vertical" -> 7.2f\n          focus == "all" -> 8.8f\n          timeSize == "xlarge" -> 8.6f\n          timeSize == "small" -> 7.2f\n          else -> 8f\n        }'''
# bindPrayerStrip currently does not receive layout, so leave strip size controlled by XML/RemoteViews default.
# The vertical rows use equal weights and maxLines=2, which prevents clipping even at Samsung's compact dp height.

print('Applied compact Samsung vertical widget v0.6.5')
