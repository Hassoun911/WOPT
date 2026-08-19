from pathlib import Path
import re
from textwrap import dedent

ROOT = Path(__file__).resolve().parents[2]
ANDROID = ROOT / "mobile/modules/hassoun-widget/android/src/main"
JAVA = ANDROID / "java/ca/wopt/hassounwidget/HassounPrayerWidgetProvider.kt"
LAYOUT = ANDROID / "res/layout"
DRAWABLE = ANDROID / "res/drawable"


def write(path: Path, content: str):
    path.write_text(dedent(content).lstrip(), encoding="utf-8")


def must_replace(text: str, old: str, new: str) -> str:
    if old not in text:
        raise RuntimeError(f"Expected source block not found:\n{old[:180]}")
    return text.replace(old, new, 1)


# ---------------------------------------------------------------------------
# 1) Provider: stop treating time + suffix + Arabic + English as one blob.
# ---------------------------------------------------------------------------
provider = JAVA.read_text(encoding="utf-8")
provider = must_replace(
    provider,
    '    private val prayerSymbols = mapOf("fajr" to "☼", "dhuhr" to "☀", "asr" to "☀", "maghrib" to "☾", "isha" to "☾")',
    '''    private val prayerIcons = mapOf(
      "fajr" to R.drawable.ic_widget_fajr,
      "dhuhr" to R.drawable.ic_widget_dhuhr,
      "asr" to R.drawable.ic_widget_asr,
      "maghrib" to R.drawable.ic_widget_maghrib,
      "isha" to R.drawable.ic_widget_isha
    )'''
)
provider = must_replace(
    provider,
    '        views.setTextViewText(R.id.widget_next_time, formatClock(next.timeText, locale))',
    '''        if (isLockScreen) {
          views.setTextViewText(R.id.widget_next_time, formatClock(next.timeText, locale))
        } else {
          views.setTextViewText(R.id.widget_next_time, formatClockMain(next.timeText))
          views.setTextViewText(R.id.widget_next_suffix, formatClockSuffix(next.timeText))
        }'''
)
provider = must_replace(
    provider,
    '        views.setTextViewText(R.id.widget_next_time, "")\n        views.setViewVisibility(R.id.widget_countdown, View.GONE)',
    '        views.setTextViewText(R.id.widget_next_time, "")\n        if (!isLockScreen) views.setTextViewText(R.id.widget_next_suffix, "")\n        views.setViewVisibility(R.id.widget_countdown, View.GONE)'
)
provider = must_replace(
    provider,
    '        views.setTextViewTextSize(R.id.widget_next_time, TypedValue.COMPLEX_UNIT_SP, timeSp)\n        views.setTextViewTextSize(R.id.widget_next_name, TypedValue.COMPLEX_UNIT_SP, prayerNameSp)',
    '''        views.setTextViewTextSize(R.id.widget_next_time, TypedValue.COMPLEX_UNIT_SP, timeSp)
        views.setTextViewTextSize(R.id.widget_next_name, TypedValue.COMPLEX_UNIT_SP, prayerNameSp)
        if (!isLockScreen) {
          val suffixSp = when (layout) {
            "vertical" -> 9f
            "square" -> 7.5f
            "slim", "compact", "next" -> 6.5f
            else -> 11f
          }
          views.setTextViewTextSize(R.id.widget_next_suffix, TypedValue.COMPLEX_UNIT_SP, suffixSp)
        }'''
)
provider = provider.replace(
    'R.id.widget_next_secondary, R.id.widget_next_time, R.id.widget_date,',
    'R.id.widget_next_secondary, R.id.widget_next_time, R.id.widget_next_suffix, R.id.widget_date,',
    1
)

new_bind = r'''    private fun bindPrayerStrip(
      views: RemoteViews,
      day: JSONObject,
      locale: String,
      nextKey: String,
      lockScreen: Boolean,
      theme: String,
      showArabic: Boolean,
      highlightNext: Boolean,
      timeSize: String,
      layout: String
    ) {
      val ids = listOf(R.id.widget_prayer_fajr, R.id.widget_prayer_dhuhr, R.id.widget_prayer_asr, R.id.widget_prayer_maghrib, R.id.widget_prayer_isha)
      val baseText = if (theme == "ivory") Color.rgb(20, 72, 61) else Color.rgb(247, 241, 222)
      val activeText = if (theme == "ivory") Color.rgb(13, 83, 66) else Color.rgb(239, 207, 132)

      prayerKeys.zip(ids).forEach { (key, id) ->
        val name = englishNames[key] ?: key
        val arabic = arabicNames[key] ?: ""
        val time = formatClock(day.optString(key, "--:--"), locale)
        val title = when (layout) {
          "vertical" -> when {
            locale == "ar" && showArabic -> "$arabic  •  $name\n$time"
            locale == "ar" -> "$name\n$time"
            showArabic -> "$name  •  $arabic\n$time"
            else -> "$name\n$time"
          }
          "slim", "compact", "next" -> "$name\n$time"
          "square" -> if (showArabic) "$name\n$arabic\n$time" else "$name\n$time"
          else -> if (showArabic) "$name\n$arabic\n$time" else "$name\n$time"
        }
        views.setTextViewText(id, title)
        val icon = prayerIcons[key] ?: 0
        if (layout == "vertical") {
          views.setTextViewCompoundDrawables(id, icon, 0, 0, 0)
          views.setInt(id, "setCompoundDrawablePadding", 8)
        } else {
          views.setTextViewCompoundDrawables(id, 0, icon, 0, 0)
          views.setInt(id, "setCompoundDrawablePadding", 3)
        }

        val active = highlightNext && key == nextKey
        views.setTextColor(id, if (active) activeText else baseText)
        val chipBackground = when {
          active && theme == "ivory" -> R.drawable.hassoun_widget_prayer_chip_active_light
          active -> R.drawable.hassoun_widget_prayer_chip_active_dark
          theme == "ivory" -> R.drawable.hassoun_widget_prayer_chip_light
          else -> R.drawable.hassoun_widget_prayer_chip_dark
        }
        views.setInt(id, "setBackgroundResource", chipBackground)
        val stripSp = if (lockScreen) 9.5f else when (layout) {
          "vertical" -> when (timeSize) { "small" -> 8.4f; "medium" -> 9.2f; "xlarge" -> 10.4f; else -> 9.8f }
          "square" -> when (timeSize) { "small" -> 5.0f; "medium" -> 5.6f; "xlarge" -> 6.6f; else -> 6.1f }
          "slim", "compact", "next" -> when (timeSize) { "small" -> 4.0f; "medium" -> 4.5f; "xlarge" -> 5.4f; else -> 5.0f }
          else -> when (timeSize) { "small" -> 7.2f; "medium" -> 8.0f; "xlarge" -> 9.2f; else -> 8.6f }
        }
        views.setTextViewTextSize(id, TypedValue.COMPLEX_UNIT_SP, stripSp)
      }
    }
'''
provider, n = re.subn(r'    private fun bindPrayerStrip\([\s\S]*?\n    private fun applyTheme', new_bind + '\n    private fun applyTheme', provider, count=1)
if n != 1:
    raise RuntimeError("Could not replace bindPrayerStrip")

helpers = r'''    private fun formatClockMain(raw: String): String {
      val parts = raw.split(":")
      if (parts.size != 2) return raw
      val hour24 = parts[0].toIntOrNull() ?: return raw
      val minute = parts[1].toIntOrNull() ?: return raw
      val hour = when (val h = hour24 % 12) { 0 -> 12; else -> h }
      return String.format(Locale.US, "%d:%02d", hour, minute)
    }

    private fun formatClockSuffix(raw: String): String {
      val hour24 = raw.substringBefore(":").toIntOrNull() ?: return ""
      return if (hour24 >= 12) "p.m." else "a.m."
    }

'''
provider = provider.replace('    private fun formatClock(raw: String, locale: String): String {', helpers + '    private fun formatClock(raw: String, locale: String): String {', 1)
JAVA.write_text(provider, encoding="utf-8")

# ---------------------------------------------------------------------------
# 2) Real vector icons instead of emoji glyphs.
# ---------------------------------------------------------------------------
icons = {
"ic_widget_fajr.xml": '''
<vector xmlns:android="http://schemas.android.com/apk/res/android" android:width="18dp" android:height="18dp" android:viewportWidth="24" android:viewportHeight="24">
  <path android:fillColor="@android:color/transparent" android:strokeColor="#B88842" android:strokeWidth="1.7" android:strokeLineCap="round" android:pathData="M4,16L20,16M6,19L18,19M8,15a4,4 0,1 1,8,0M12,5L12,8M5.8,8.8L7.9,10.4M18.2,8.8L16.1,10.4" />
</vector>''',
"ic_widget_dhuhr.xml": '''
<vector xmlns:android="http://schemas.android.com/apk/res/android" android:width="18dp" android:height="18dp" android:viewportWidth="24" android:viewportHeight="24">
  <path android:fillColor="@android:color/transparent" android:strokeColor="#C79B43" android:strokeWidth="1.7" android:strokeLineCap="round" android:pathData="M12,7a5,5 0,1 0,0 10a5,5 0,1 0,0 -10M12,2L12,4M12,20L12,22M2,12L4,12M20,12L22,12M5,5L6.5,6.5M17.5,17.5L19,19M19,5L17.5,6.5M6.5,17.5L5,19" />
</vector>''',
"ic_widget_asr.xml": '''
<vector xmlns:android="http://schemas.android.com/apk/res/android" android:width="18dp" android:height="18dp" android:viewportWidth="24" android:viewportHeight="24">
  <path android:fillColor="@android:color/transparent" android:strokeColor="#C79B43" android:strokeWidth="1.7" android:strokeLineCap="round" android:pathData="M5,18L19,18M8,16a4,4 0,1 1,8,0M12,6L12,9M6.5,9L8,10.5M17.5,9L16,10.5" />
</vector>''',
"ic_widget_maghrib.xml": '''
<vector xmlns:android="http://schemas.android.com/apk/res/android" android:width="18dp" android:height="18dp" android:viewportWidth="24" android:viewportHeight="24">
  <path android:fillColor="#547B68" android:pathData="M19.5,15.2A8,8 0,1 1,8.8,4.3A6.6,6.6 0,0 0,19.5,15.2Z" />
</vector>''',
"ic_widget_isha.xml": '''
<vector xmlns:android="http://schemas.android.com/apk/res/android" android:width="18dp" android:height="18dp" android:viewportWidth="24" android:viewportHeight="24">
  <path android:fillColor="#4C6670" android:pathData="M18.7,15.3A7.2,7.2 0,1 1,9,5.5A5.9,5.9 0,0 0,18.7,15.3Z" />
  <path android:fillColor="#B88842" android:pathData="M18.8,4L19.4,5.6L21,6.2L19.4,6.8L18.8,8.4L18.2,6.8L16.6,6.2L18.2,5.6Z" />
</vector>'''
}
for name, content in icons.items():
    write(DRAWABLE / name, content)

# ---------------------------------------------------------------------------
# 3) Premium layouts. Every home-screen layout includes widget_next_suffix.
# ---------------------------------------------------------------------------
write(LAYOUT / "hassoun_prayer_widget.xml", '''
<?xml version="1.0" encoding="utf-8"?>
<LinearLayout xmlns:android="http://schemas.android.com/apk/res/android"
  android:id="@+id/widget_root"
  android:layout_width="match_parent" android:layout_height="match_parent"
  android:orientation="vertical" android:padding="10dp"
  android:background="@drawable/hassoun_widget_bg">

  <LinearLayout android:layout_width="match_parent" android:layout_height="42dp" android:orientation="horizontal" android:gravity="center_vertical">
    <ImageView android:id="@+id/widget_logo" android:layout_width="38dp" android:layout_height="38dp" android:src="@drawable/hassoun_widget_logo" android:scaleType="fitCenter" android:contentDescription="Hassoun" />
    <LinearLayout android:layout_width="0dp" android:layout_height="wrap_content" android:layout_weight="1" android:layout_marginStart="9dp" android:orientation="vertical">
      <TextView android:id="@+id/widget_header" android:layout_width="wrap_content" android:layout_height="wrap_content" android:text="HASSOUN" android:fontFamily="serif" android:textStyle="bold" android:textSize="14sp" android:letterSpacing="0.11" android:maxLines="1" android:includeFontPadding="false" />
      <TextView android:id="@+id/widget_brand_subtitle" android:layout_width="wrap_content" android:layout_height="wrap_content" android:textStyle="bold" android:textSize="6.2sp" android:letterSpacing="0.08" android:maxLines="1" android:includeFontPadding="false" />
    </LinearLayout>
    <LinearLayout android:layout_width="112dp" android:layout_height="wrap_content" android:orientation="vertical" android:gravity="end">
      <TextView android:id="@+id/widget_date" android:layout_width="match_parent" android:layout_height="wrap_content" android:gravity="end" android:textStyle="bold" android:textSize="7sp" android:maxLines="1" android:includeFontPadding="false" />
      <TextView android:id="@+id/widget_hijri" android:layout_width="match_parent" android:layout_height="wrap_content" android:gravity="end" android:textSize="6sp" android:maxLines="1" android:includeFontPadding="false" />
    </LinearLayout>
  </LinearLayout>

  <FrameLayout android:id="@+id/widget_hero" android:layout_width="match_parent" android:layout_height="0dp" android:layout_weight="1" android:layout_marginTop="5dp" android:layout_marginBottom="8dp" android:background="@drawable/hassoun_widget_hero_light">
    <ImageView android:id="@+id/widget_hero_art" android:layout_width="match_parent" android:layout_height="match_parent" android:layout_gravity="bottom" android:src="@drawable/hassoun_widget_mosque_silhouette_light" android:alpha="0.26" android:scaleType="fitCenter" android:contentDescription="" />
    <LinearLayout android:layout_width="match_parent" android:layout_height="match_parent" android:orientation="horizontal" android:gravity="center_vertical" android:paddingLeft="13dp" android:paddingRight="13dp">
      <LinearLayout android:layout_width="0dp" android:layout_height="match_parent" android:layout_weight="1.16" android:orientation="vertical" android:gravity="center_vertical">
        <TextView android:id="@+id/widget_next_label" android:layout_width="wrap_content" android:layout_height="wrap_content" android:text="NEXT PRAYER" android:textStyle="bold" android:textSize="8.5sp" android:letterSpacing="0.09" android:maxLines="1" android:includeFontPadding="false" />
        <TextView android:id="@+id/widget_next_name" android:layout_width="wrap_content" android:layout_height="wrap_content" android:fontFamily="serif" android:textSize="40sp" android:maxLines="1" android:includeFontPadding="false" />
        <TextView android:id="@+id/widget_next_secondary" android:layout_width="wrap_content" android:layout_height="wrap_content" android:layout_marginTop="2dp" android:textSize="10sp" android:maxLines="1" android:includeFontPadding="false" />
      </LinearLayout>
      <Chronometer android:id="@+id/widget_countdown" android:layout_width="82dp" android:layout_height="82dp" android:layout_marginHorizontal="10dp" android:gravity="center" android:background="@drawable/hassoun_widget_countdown_circle_light" android:padding="5dp" android:textStyle="bold" android:textSize="14sp" android:maxLines="2" android:includeFontPadding="false" />
      <LinearLayout android:layout_width="0dp" android:layout_height="match_parent" android:layout_weight="1.02" android:orientation="vertical" android:gravity="center_vertical|end">
        <TextView android:layout_width="wrap_content" android:layout_height="wrap_content" android:text="ADHAN" android:textColor="#AF7E39" android:textStyle="bold" android:textSize="7.5sp" android:letterSpacing="0.08" android:includeFontPadding="false" />
        <LinearLayout android:layout_width="match_parent" android:layout_height="wrap_content" android:gravity="end|bottom" android:orientation="horizontal">
          <TextView android:id="@+id/widget_next_time" android:layout_width="wrap_content" android:layout_height="wrap_content" android:fontFamily="serif" android:textSize="38sp" android:maxLines="1" android:includeFontPadding="false" android:autoSizeTextType="uniform" android:autoSizeMinTextSize="24sp" android:autoSizeMaxTextSize="38sp" android:autoSizeStepGranularity="1sp" />
          <TextView android:id="@+id/widget_next_suffix" android:layout_width="wrap_content" android:layout_height="wrap_content" android:layout_marginStart="4dp" android:layout_marginBottom="5dp" android:fontFamily="serif" android:textSize="11sp" android:maxLines="1" android:includeFontPadding="false" />
        </LinearLayout>
      </LinearLayout>
    </LinearLayout>
  </FrameLayout>

  <LinearLayout android:id="@+id/widget_prayer_strip" android:layout_width="match_parent" android:layout_height="78dp" android:orientation="horizontal">
    <TextView android:id="@+id/widget_prayer_fajr" android:layout_width="0dp" android:layout_height="match_parent" android:layout_weight="1" android:gravity="center" android:padding="4dp" android:textStyle="bold" android:maxLines="3" android:includeFontPadding="false" android:autoSizeTextType="uniform" android:autoSizeMinTextSize="7sp" android:autoSizeMaxTextSize="9sp" android:autoSizeStepGranularity="1sp" />
    <TextView android:id="@+id/widget_prayer_dhuhr" android:layout_width="0dp" android:layout_height="match_parent" android:layout_weight="1" android:layout_marginStart="4dp" android:gravity="center" android:padding="4dp" android:textStyle="bold" android:maxLines="3" android:includeFontPadding="false" android:autoSizeTextType="uniform" android:autoSizeMinTextSize="7sp" android:autoSizeMaxTextSize="9sp" android:autoSizeStepGranularity="1sp" />
    <TextView android:id="@+id/widget_prayer_asr" android:layout_width="0dp" android:layout_height="match_parent" android:layout_weight="1" android:layout_marginStart="4dp" android:gravity="center" android:padding="4dp" android:textStyle="bold" android:maxLines="3" android:includeFontPadding="false" android:autoSizeTextType="uniform" android:autoSizeMinTextSize="7sp" android:autoSizeMaxTextSize="9sp" android:autoSizeStepGranularity="1sp" />
    <TextView android:id="@+id/widget_prayer_maghrib" android:layout_width="0dp" android:layout_height="match_parent" android:layout_weight="1" android:layout_marginStart="4dp" android:gravity="center" android:padding="4dp" android:textStyle="bold" android:maxLines="3" android:includeFontPadding="false" android:autoSizeTextType="uniform" android:autoSizeMinTextSize="7sp" android:autoSizeMaxTextSize="9sp" android:autoSizeStepGranularity="1sp" />
    <TextView android:id="@+id/widget_prayer_isha" android:layout_width="0dp" android:layout_height="match_parent" android:layout_weight="1" android:layout_marginStart="4dp" android:gravity="center" android:padding="4dp" android:textStyle="bold" android:maxLines="3" android:includeFontPadding="false" android:autoSizeTextType="uniform" android:autoSizeMinTextSize="7sp" android:autoSizeMaxTextSize="9sp" android:autoSizeStepGranularity="1sp" />
  </LinearLayout>
  <TextView android:id="@+id/widget_location" android:layout_width="1dp" android:layout_height="1dp" android:visibility="gone" android:textSize="1sp" />
</LinearLayout>
''')

write(LAYOUT / "hassoun_prayer_widget_vertical.xml", '''
<?xml version="1.0" encoding="utf-8"?>
<LinearLayout xmlns:android="http://schemas.android.com/apk/res/android"
  android:id="@+id/widget_root" android:layout_width="match_parent" android:layout_height="match_parent"
  android:orientation="vertical" android:padding="8dp" android:background="@drawable/hassoun_widget_bg">
  <LinearLayout android:layout_width="match_parent" android:layout_height="34dp" android:orientation="horizontal" android:gravity="center_vertical">
    <ImageView android:id="@+id/widget_logo" android:layout_width="30dp" android:layout_height="30dp" android:src="@drawable/hassoun_widget_logo" android:scaleType="fitCenter" android:contentDescription="Hassoun" />
    <LinearLayout android:layout_width="0dp" android:layout_height="wrap_content" android:layout_weight="1" android:layout_marginStart="6dp" android:orientation="vertical">
      <TextView android:id="@+id/widget_header" android:layout_width="wrap_content" android:layout_height="wrap_content" android:text="HASSOUN" android:fontFamily="serif" android:textStyle="bold" android:textSize="10.5sp" android:letterSpacing="0.07" android:maxLines="1" android:includeFontPadding="false" />
      <TextView android:id="@+id/widget_brand_subtitle" android:layout_width="wrap_content" android:layout_height="wrap_content" android:textStyle="bold" android:textSize="4.8sp" android:maxLines="1" android:includeFontPadding="false" />
    </LinearLayout>
    <LinearLayout android:layout_width="88dp" android:layout_height="wrap_content" android:orientation="vertical" android:gravity="end">
      <TextView android:id="@+id/widget_date" android:layout_width="match_parent" android:layout_height="wrap_content" android:gravity="end" android:textStyle="bold" android:textSize="5.5sp" android:maxLines="1" android:includeFontPadding="false" />
      <TextView android:id="@+id/widget_hijri" android:layout_width="match_parent" android:layout_height="wrap_content" android:gravity="end" android:textSize="4.8sp" android:maxLines="1" android:includeFontPadding="false" />
    </LinearLayout>
  </LinearLayout>

  <FrameLayout android:id="@+id/widget_hero" android:layout_width="match_parent" android:layout_height="145dp" android:layout_marginTop="4dp" android:layout_marginBottom="7dp" android:background="@drawable/hassoun_widget_hero_light">
    <ImageView android:id="@+id/widget_hero_art" android:layout_width="match_parent" android:layout_height="match_parent" android:src="@drawable/hassoun_widget_mosque_silhouette_light" android:alpha="0.22" android:scaleType="fitCenter" android:contentDescription="" />
    <LinearLayout android:layout_width="match_parent" android:layout_height="match_parent" android:orientation="vertical" android:padding="10dp">
      <TextView android:id="@+id/widget_next_label" android:layout_width="wrap_content" android:layout_height="wrap_content" android:text="NEXT PRAYER" android:textStyle="bold" android:textSize="7sp" android:letterSpacing="0.06" android:maxLines="1" android:includeFontPadding="false" />
      <TextView android:id="@+id/widget_next_name" android:layout_width="wrap_content" android:layout_height="wrap_content" android:fontFamily="serif" android:textSize="34sp" android:maxLines="1" android:includeFontPadding="false" />
      <TextView android:id="@+id/widget_next_secondary" android:layout_width="wrap_content" android:layout_height="wrap_content" android:textSize="8sp" android:maxLines="1" android:includeFontPadding="false" />
      <LinearLayout android:layout_width="match_parent" android:layout_height="0dp" android:layout_weight="1" android:orientation="horizontal" android:gravity="center_vertical">
        <Chronometer android:id="@+id/widget_countdown" android:layout_width="62dp" android:layout_height="62dp" android:gravity="center" android:background="@drawable/hassoun_widget_countdown_circle_light" android:padding="3dp" android:textStyle="bold" android:textSize="12sp" android:maxLines="2" android:includeFontPadding="false" />
        <View android:layout_width="0dp" android:layout_height="1dp" android:layout_weight="1" />
        <LinearLayout android:layout_width="wrap_content" android:layout_height="wrap_content" android:orientation="vertical" android:gravity="end">
          <TextView android:layout_width="wrap_content" android:layout_height="wrap_content" android:text="ADHAN" android:textColor="#AF7E39" android:textStyle="bold" android:textSize="5.8sp" android:letterSpacing="0.05" android:includeFontPadding="false" />
          <LinearLayout android:layout_width="wrap_content" android:layout_height="wrap_content" android:gravity="bottom|end" android:orientation="horizontal">
            <TextView android:id="@+id/widget_next_time" android:layout_width="wrap_content" android:layout_height="wrap_content" android:fontFamily="serif" android:textSize="28sp" android:maxLines="1" android:includeFontPadding="false" />
            <TextView android:id="@+id/widget_next_suffix" android:layout_width="wrap_content" android:layout_height="wrap_content" android:layout_marginStart="3dp" android:layout_marginBottom="4dp" android:fontFamily="serif" android:textSize="9sp" android:maxLines="1" android:includeFontPadding="false" />
          </LinearLayout>
        </LinearLayout>
      </LinearLayout>
    </LinearLayout>
  </FrameLayout>

  <LinearLayout android:id="@+id/widget_prayer_strip" android:layout_width="match_parent" android:layout_height="0dp" android:layout_weight="1" android:orientation="vertical">
    <TextView android:id="@+id/widget_prayer_fajr" android:layout_width="match_parent" android:layout_height="0dp" android:layout_weight="1" android:gravity="center_vertical" android:textDirection="ltr" android:paddingLeft="10dp" android:paddingRight="10dp" android:textStyle="bold" android:maxLines="2" android:includeFontPadding="false" android:autoSizeTextType="uniform" android:autoSizeMinTextSize="8sp" android:autoSizeMaxTextSize="10sp" android:autoSizeStepGranularity="1sp" />
    <TextView android:id="@+id/widget_prayer_dhuhr" android:layout_width="match_parent" android:layout_height="0dp" android:layout_weight="1" android:layout_marginTop="4dp" android:gravity="center_vertical" android:textDirection="ltr" android:paddingLeft="10dp" android:paddingRight="10dp" android:textStyle="bold" android:maxLines="2" android:includeFontPadding="false" android:autoSizeTextType="uniform" android:autoSizeMinTextSize="8sp" android:autoSizeMaxTextSize="10sp" android:autoSizeStepGranularity="1sp" />
    <TextView android:id="@+id/widget_prayer_asr" android:layout_width="match_parent" android:layout_height="0dp" android:layout_weight="1" android:layout_marginTop="4dp" android:gravity="center_vertical" android:textDirection="ltr" android:paddingLeft="10dp" android:paddingRight="10dp" android:textStyle="bold" android:maxLines="2" android:includeFontPadding="false" android:autoSizeTextType="uniform" android:autoSizeMinTextSize="8sp" android:autoSizeMaxTextSize="10sp" android:autoSizeStepGranularity="1sp" />
    <TextView android:id="@+id/widget_prayer_maghrib" android:layout_width="match_parent" android:layout_height="0dp" android:layout_weight="1" android:layout_marginTop="4dp" android:gravity="center_vertical" android:textDirection="ltr" android:paddingLeft="10dp" android:paddingRight="10dp" android:textStyle="bold" android:maxLines="2" android:includeFontPadding="false" android:autoSizeTextType="uniform" android:autoSizeMinTextSize="8sp" android:autoSizeMaxTextSize="10sp" android:autoSizeStepGranularity="1sp" />
    <TextView android:id="@+id/widget_prayer_isha" android:layout_width="match_parent" android:layout_height="0dp" android:layout_weight="1" android:layout_marginTop="4dp" android:gravity="center_vertical" android:textDirection="ltr" android:paddingLeft="10dp" android:paddingRight="10dp" android:textStyle="bold" android:maxLines="2" android:includeFontPadding="false" android:autoSizeTextType="uniform" android:autoSizeMinTextSize="8sp" android:autoSizeMaxTextSize="10sp" android:autoSizeStepGranularity="1sp" />
  </LinearLayout>
  <TextView android:id="@+id/widget_location" android:layout_width="1dp" android:layout_height="1dp" android:visibility="gone" android:textSize="1sp" />
</LinearLayout>
''')

write(LAYOUT / "hassoun_prayer_widget_square.xml", '''
<?xml version="1.0" encoding="utf-8"?>
<LinearLayout xmlns:android="http://schemas.android.com/apk/res/android" android:id="@+id/widget_root" android:layout_width="match_parent" android:layout_height="match_parent" android:orientation="vertical" android:padding="7dp" android:background="@drawable/hassoun_widget_bg">
  <LinearLayout android:layout_width="match_parent" android:layout_height="28dp" android:orientation="horizontal" android:gravity="center_vertical">
    <ImageView android:id="@+id/widget_logo" android:layout_width="26dp" android:layout_height="26dp" android:src="@drawable/hassoun_widget_logo" android:contentDescription="Hassoun" />
    <LinearLayout android:layout_width="0dp" android:layout_height="wrap_content" android:layout_weight="1" android:layout_marginStart="5dp" android:orientation="vertical"><TextView android:id="@+id/widget_header" android:layout_width="wrap_content" android:layout_height="wrap_content" android:text="HASSOUN" android:fontFamily="serif" android:textStyle="bold" android:textSize="9sp" android:letterSpacing="0.06" android:maxLines="1" android:includeFontPadding="false" /><TextView android:id="@+id/widget_brand_subtitle" android:layout_width="wrap_content" android:layout_height="wrap_content" android:textSize="4sp" android:maxLines="1" android:includeFontPadding="false" /></LinearLayout>
    <TextView android:id="@+id/widget_date" android:layout_width="1dp" android:layout_height="1dp" android:visibility="gone" /><TextView android:id="@+id/widget_hijri" android:layout_width="1dp" android:layout_height="1dp" android:visibility="gone" />
  </LinearLayout>
  <FrameLayout android:id="@+id/widget_hero" android:layout_width="match_parent" android:layout_height="0dp" android:layout_weight="1" android:layout_marginTop="3dp" android:layout_marginBottom="5dp" android:background="@drawable/hassoun_widget_hero_light">
    <ImageView android:id="@+id/widget_hero_art" android:layout_width="match_parent" android:layout_height="match_parent" android:src="@drawable/hassoun_widget_mosque_silhouette_light" android:alpha="0.2" android:scaleType="fitCenter" android:contentDescription="" />
    <LinearLayout android:layout_width="match_parent" android:layout_height="match_parent" android:orientation="vertical" android:padding="7dp"><TextView android:id="@+id/widget_next_label" android:layout_width="wrap_content" android:layout_height="wrap_content" android:text="NEXT PRAYER" android:textStyle="bold" android:textSize="5.8sp" android:maxLines="1" android:includeFontPadding="false" /><TextView android:id="@+id/widget_next_name" android:layout_width="wrap_content" android:layout_height="wrap_content" android:fontFamily="serif" android:textSize="27sp" android:maxLines="1" android:includeFontPadding="false" /><TextView android:id="@+id/widget_next_secondary" android:layout_width="wrap_content" android:layout_height="wrap_content" android:textSize="6.5sp" android:maxLines="1" android:includeFontPadding="false" /><LinearLayout android:layout_width="match_parent" android:layout_height="0dp" android:layout_weight="1" android:orientation="horizontal" android:gravity="center_vertical"><Chronometer android:id="@+id/widget_countdown" android:layout_width="52dp" android:layout_height="52dp" android:gravity="center" android:background="@drawable/hassoun_widget_countdown_circle_light" android:textStyle="bold" android:textSize="10.5sp" android:maxLines="2" android:includeFontPadding="false" /><View android:layout_width="0dp" android:layout_height="1dp" android:layout_weight="1" /><LinearLayout android:layout_width="wrap_content" android:layout_height="wrap_content" android:orientation="vertical" android:gravity="end"><TextView android:layout_width="wrap_content" android:layout_height="wrap_content" android:text="ADHAN" android:textColor="#AF7E39" android:textStyle="bold" android:textSize="5sp" /><LinearLayout android:layout_width="wrap_content" android:layout_height="wrap_content" android:orientation="horizontal" android:gravity="bottom|end"><TextView android:id="@+id/widget_next_time" android:layout_width="wrap_content" android:layout_height="wrap_content" android:fontFamily="serif" android:textSize="24sp" android:maxLines="1" android:includeFontPadding="false" /><TextView android:id="@+id/widget_next_suffix" android:layout_width="wrap_content" android:layout_height="wrap_content" android:layout_marginStart="2dp" android:layout_marginBottom="3dp" android:fontFamily="serif" android:textSize="7.5sp" android:maxLines="1" android:includeFontPadding="false" /></LinearLayout></LinearLayout></LinearLayout></LinearLayout>
  </FrameLayout>
  <LinearLayout android:id="@+id/widget_prayer_strip" android:layout_width="match_parent" android:layout_height="42dp" android:orientation="horizontal"><TextView android:id="@+id/widget_prayer_fajr" android:layout_width="0dp" android:layout_height="match_parent" android:layout_weight="1" android:gravity="center" android:maxLines="3" android:textStyle="bold" android:includeFontPadding="false" android:autoSizeTextType="uniform" android:autoSizeMinTextSize="4sp" android:autoSizeMaxTextSize="6sp" android:autoSizeStepGranularity="1sp" /><TextView android:id="@+id/widget_prayer_dhuhr" android:layout_width="0dp" android:layout_height="match_parent" android:layout_weight="1" android:layout_marginStart="2dp" android:gravity="center" android:maxLines="3" android:textStyle="bold" android:includeFontPadding="false" android:autoSizeTextType="uniform" android:autoSizeMinTextSize="4sp" android:autoSizeMaxTextSize="6sp" android:autoSizeStepGranularity="1sp" /><TextView android:id="@+id/widget_prayer_asr" android:layout_width="0dp" android:layout_height="match_parent" android:layout_weight="1" android:layout_marginStart="2dp" android:gravity="center" android:maxLines="3" android:textStyle="bold" android:includeFontPadding="false" android:autoSizeTextType="uniform" android:autoSizeMinTextSize="4sp" android:autoSizeMaxTextSize="6sp" android:autoSizeStepGranularity="1sp" /><TextView android:id="@+id/widget_prayer_maghrib" android:layout_width="0dp" android:layout_height="match_parent" android:layout_weight="1" android:layout_marginStart="2dp" android:gravity="center" android:maxLines="3" android:textStyle="bold" android:includeFontPadding="false" android:autoSizeTextType="uniform" android:autoSizeMinTextSize="4sp" android:autoSizeMaxTextSize="6sp" android:autoSizeStepGranularity="1sp" /><TextView android:id="@+id/widget_prayer_isha" android:layout_width="0dp" android:layout_height="match_parent" android:layout_weight="1" android:layout_marginStart="2dp" android:gravity="center" android:maxLines="3" android:textStyle="bold" android:includeFontPadding="false" android:autoSizeTextType="uniform" android:autoSizeMinTextSize="4sp" android:autoSizeMaxTextSize="6sp" android:autoSizeStepGranularity="1sp" /></LinearLayout>
  <TextView android:id="@+id/widget_location" android:layout_width="1dp" android:layout_height="1dp" android:visibility="gone" android:textSize="1sp" />
</LinearLayout>
''')

write(LAYOUT / "hassoun_prayer_widget_slim.xml", '''
<?xml version="1.0" encoding="utf-8"?>
<LinearLayout xmlns:android="http://schemas.android.com/apk/res/android" android:id="@+id/widget_root" android:layout_width="match_parent" android:layout_height="match_parent" android:orientation="horizontal" android:padding="6dp" android:gravity="center_vertical" android:background="@drawable/hassoun_widget_bg">
  <FrameLayout android:id="@+id/widget_hero" android:layout_width="0dp" android:layout_height="match_parent" android:layout_weight="1.45" android:background="@drawable/hassoun_widget_hero_light"><ImageView android:id="@+id/widget_hero_art" android:layout_width="match_parent" android:layout_height="match_parent" android:src="@drawable/hassoun_widget_mosque_silhouette_light" android:alpha="0.14" android:scaleType="fitCenter" android:contentDescription="" /><LinearLayout android:layout_width="match_parent" android:layout_height="match_parent" android:orientation="horizontal" android:gravity="center_vertical" android:padding="5dp"><ImageView android:id="@+id/widget_logo" android:layout_width="26dp" android:layout_height="26dp" android:src="@drawable/hassoun_widget_logo" android:contentDescription="Hassoun" /><LinearLayout android:layout_width="0dp" android:layout_height="wrap_content" android:layout_weight="1" android:layout_marginStart="5dp" android:orientation="vertical"><TextView android:id="@+id/widget_header" android:layout_width="wrap_content" android:layout_height="wrap_content" android:text="HASSOUN" android:fontFamily="serif" android:textStyle="bold" android:textSize="7sp" android:maxLines="1" android:includeFontPadding="false" /><TextView android:id="@+id/widget_brand_subtitle" android:layout_width="wrap_content" android:layout_height="wrap_content" android:textSize="3.5sp" android:maxLines="1" android:includeFontPadding="false" /></LinearLayout><LinearLayout android:layout_width="70dp" android:layout_height="wrap_content" android:orientation="vertical"><TextView android:id="@+id/widget_next_label" android:layout_width="wrap_content" android:layout_height="wrap_content" android:text="NEXT" android:textStyle="bold" android:textSize="4.5sp" /><TextView android:id="@+id/widget_next_name" android:layout_width="wrap_content" android:layout_height="wrap_content" android:fontFamily="serif" android:textSize="17sp" android:maxLines="1" android:includeFontPadding="false" /><TextView android:id="@+id/widget_next_secondary" android:layout_width="wrap_content" android:layout_height="wrap_content" android:textSize="4.5sp" android:maxLines="1" android:includeFontPadding="false" /></LinearLayout><Chronometer android:id="@+id/widget_countdown" android:layout_width="44dp" android:layout_height="44dp" android:gravity="center" android:background="@drawable/hassoun_widget_countdown_circle_light" android:textStyle="bold" android:textSize="8.5sp" android:maxLines="2" android:includeFontPadding="false" /><LinearLayout android:layout_width="74dp" android:layout_height="wrap_content" android:orientation="vertical" android:gravity="end"><TextView android:layout_width="wrap_content" android:layout_height="wrap_content" android:text="ADHAN" android:textColor="#AF7E39" android:textStyle="bold" android:textSize="4sp" /><LinearLayout android:layout_width="wrap_content" android:layout_height="wrap_content" android:orientation="horizontal" android:gravity="bottom|end"><TextView android:id="@+id/widget_next_time" android:layout_width="wrap_content" android:layout_height="wrap_content" android:fontFamily="serif" android:textSize="18sp" android:maxLines="1" android:includeFontPadding="false" /><TextView android:id="@+id/widget_next_suffix" android:layout_width="wrap_content" android:layout_height="wrap_content" android:layout_marginStart="2dp" android:layout_marginBottom="2dp" android:fontFamily="serif" android:textSize="6sp" android:maxLines="1" android:includeFontPadding="false" /></LinearLayout></LinearLayout><TextView android:id="@+id/widget_date" android:layout_width="1dp" android:layout_height="1dp" android:visibility="gone" /><TextView android:id="@+id/widget_hijri" android:layout_width="1dp" android:layout_height="1dp" android:visibility="gone" /></LinearLayout></FrameLayout>
  <LinearLayout android:id="@+id/widget_prayer_strip" android:layout_width="0dp" android:layout_height="match_parent" android:layout_weight="0.95" android:layout_marginStart="5dp" android:orientation="horizontal"><TextView android:id="@+id/widget_prayer_fajr" android:layout_width="0dp" android:layout_height="match_parent" android:layout_weight="1" android:gravity="center" android:maxLines="2" android:textStyle="bold" android:autoSizeTextType="uniform" android:autoSizeMinTextSize="3.5sp" android:autoSizeMaxTextSize="5sp" android:autoSizeStepGranularity="0.5sp" /><TextView android:id="@+id/widget_prayer_dhuhr" android:layout_width="0dp" android:layout_height="match_parent" android:layout_weight="1" android:layout_marginStart="1dp" android:gravity="center" android:maxLines="2" android:textStyle="bold" android:autoSizeTextType="uniform" android:autoSizeMinTextSize="3.5sp" android:autoSizeMaxTextSize="5sp" android:autoSizeStepGranularity="0.5sp" /><TextView android:id="@+id/widget_prayer_asr" android:layout_width="0dp" android:layout_height="match_parent" android:layout_weight="1" android:layout_marginStart="1dp" android:gravity="center" android:maxLines="2" android:textStyle="bold" android:autoSizeTextType="uniform" android:autoSizeMinTextSize="3.5sp" android:autoSizeMaxTextSize="5sp" android:autoSizeStepGranularity="0.5sp" /><TextView android:id="@+id/widget_prayer_maghrib" android:layout_width="0dp" android:layout_height="match_parent" android:layout_weight="1" android:layout_marginStart="1dp" android:gravity="center" android:maxLines="2" android:textStyle="bold" android:autoSizeTextType="uniform" android:autoSizeMinTextSize="3.5sp" android:autoSizeMaxTextSize="5sp" android:autoSizeStepGranularity="0.5sp" /><TextView android:id="@+id/widget_prayer_isha" android:layout_width="0dp" android:layout_height="match_parent" android:layout_weight="1" android:layout_marginStart="1dp" android:gravity="center" android:maxLines="2" android:textStyle="bold" android:autoSizeTextType="uniform" android:autoSizeMinTextSize="3.5sp" android:autoSizeMaxTextSize="5sp" android:autoSizeStepGranularity="0.5sp" /></LinearLayout>
  <TextView android:id="@+id/widget_location" android:layout_width="1dp" android:layout_height="1dp" android:visibility="gone" android:textSize="1sp" />
</LinearLayout>
''')

# Softer surfaces: the concept board has blended panels, not outlined nested boxes.
write(DRAWABLE / "hassoun_widget_hero_light.xml", '''
<?xml version="1.0" encoding="utf-8"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android" android:shape="rectangle">
  <gradient android:angle="0" android:startColor="#00FFFDF8" android:centerColor="#36F8F2E4" android:endColor="#00EEF3E7" />
  <corners android:radius="20dp" />
</shape>
''')
write(DRAWABLE / "hassoun_widget_hero_dark.xml", '''
<?xml version="1.0" encoding="utf-8"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android" android:shape="rectangle">
  <gradient android:angle="0" android:startColor="#00123F36" android:centerColor="#4A153F36" android:endColor="#00071F1D" />
  <corners android:radius="20dp" />
</shape>
''')
write(DRAWABLE / "hassoun_widget_prayer_chip_light.xml", '''
<?xml version="1.0" encoding="utf-8"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android" android:shape="rectangle">
  <solid android:color="#FDFBF6" />
  <stroke android:width="1dp" android:color="#E6D9BE" />
  <corners android:radius="14dp" />
</shape>
''')
write(DRAWABLE / "hassoun_widget_prayer_chip_active_light.xml", '''
<?xml version="1.0" encoding="utf-8"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android" android:shape="rectangle">
  <solid android:color="#F1F6EF" />
  <stroke android:width="1.5dp" android:color="#8CA77C" />
  <corners android:radius="14dp" />
</shape>
''')

print("Applied premium widget structure v0.6.11")
