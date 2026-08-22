from pathlib import Path

layout_path = Path('mobile/modules/hassoun-widget/android/src/main/res/layout/hassoun_prayer_widget.xml')
provider_path = Path('mobile/modules/hassoun-widget/android/src/main/java/ca/wopt/hassounwidget/HassounPrayerWidgetProvider.kt')

layout = r'''<?xml version="1.0" encoding="utf-8"?>
<LinearLayout xmlns:android="http://schemas.android.com/apk/res/android"
  android:id="@+id/widget_root"
  android:layout_width="match_parent"
  android:layout_height="match_parent"
  android:orientation="vertical"
  android:paddingLeft="12dp"
  android:paddingRight="12dp"
  android:paddingTop="10dp"
  android:paddingBottom="10dp"
  android:background="@drawable/hassoun_widget_bg">

  <LinearLayout
    android:layout_width="match_parent"
    android:layout_height="64dp"
    android:orientation="horizontal"
    android:gravity="center_vertical">

    <ImageView
      android:id="@+id/widget_logo"
      android:layout_width="56dp"
      android:layout_height="56dp"
      android:src="@drawable/hassoun_widget_logo"
      android:scaleType="fitCenter"
      android:contentDescription="Hassoun" />

    <LinearLayout
      android:layout_width="0dp"
      android:layout_height="wrap_content"
      android:layout_weight="1"
      android:layout_marginStart="10dp"
      android:orientation="vertical">
      <TextView
        android:id="@+id/widget_header"
        android:layout_width="wrap_content"
        android:layout_height="wrap_content"
        android:text="HASSOUN"
        android:fontFamily="serif"
        android:textStyle="bold"
        android:textSize="23sp"
        android:letterSpacing="0.10"
        android:maxLines="1"
        android:includeFontPadding="false" />
      <TextView
        android:id="@+id/widget_brand_subtitle"
        android:layout_width="wrap_content"
        android:layout_height="wrap_content"
        android:textStyle="bold"
        android:textSize="10sp"
        android:letterSpacing="0.05"
        android:maxLines="1"
        android:includeFontPadding="false" />
    </LinearLayout>

    <LinearLayout
      android:layout_width="150dp"
      android:layout_height="wrap_content"
      android:orientation="vertical"
      android:gravity="end">
      <TextView
        android:id="@+id/widget_hijri"
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:gravity="end"
        android:textStyle="bold"
        android:textSize="13sp"
        android:maxLines="1"
        android:includeFontPadding="false" />
      <TextView
        android:id="@+id/widget_date"
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:gravity="end"
        android:textSize="10sp"
        android:layout_marginTop="3dp"
        android:maxLines="1"
        android:includeFontPadding="false" />
    </LinearLayout>
  </LinearLayout>

  <FrameLayout
    android:id="@+id/widget_hero"
    android:layout_width="match_parent"
    android:layout_height="0dp"
    android:layout_weight="1"
    android:layout_marginTop="4dp"
    android:layout_marginBottom="7dp"
    android:background="@drawable/hassoun_widget_hero_light">

    <ImageView
      android:id="@+id/widget_hero_art"
      android:layout_width="match_parent"
      android:layout_height="match_parent"
      android:layout_gravity="bottom"
      android:src="@drawable/hassoun_widget_mosque_silhouette_light"
      android:alpha="0.24"
      android:scaleType="fitCenter"
      android:contentDescription="" />

    <LinearLayout
      android:layout_width="match_parent"
      android:layout_height="match_parent"
      android:orientation="horizontal"
      android:gravity="center_vertical"
      android:paddingLeft="18dp"
      android:paddingRight="18dp">

      <LinearLayout
        android:layout_width="0dp"
        android:layout_height="match_parent"
        android:layout_weight="1.13"
        android:orientation="vertical"
        android:gravity="center_vertical">
        <TextView
          android:id="@+id/widget_next_label"
          android:layout_width="wrap_content"
          android:layout_height="wrap_content"
          android:text="NEXT PRAYER"
          android:textStyle="bold"
          android:textSize="10sp"
          android:letterSpacing="0.08"
          android:maxLines="1"
          android:includeFontPadding="false" />
        <TextView
          android:id="@+id/widget_next_name"
          android:layout_width="wrap_content"
          android:layout_height="wrap_content"
          android:fontFamily="serif"
          android:textStyle="bold"
          android:textSize="46sp"
          android:maxLines="1"
          android:includeFontPadding="false" />
        <TextView
          android:id="@+id/widget_next_secondary"
          android:layout_width="wrap_content"
          android:layout_height="wrap_content"
          android:layout_marginTop="3dp"
          android:textStyle="bold"
          android:textSize="19sp"
          android:maxLines="1"
          android:includeFontPadding="false" />
      </LinearLayout>

      <Chronometer
        android:id="@+id/widget_countdown"
        android:layout_width="106dp"
        android:layout_height="106dp"
        android:layout_marginHorizontal="13dp"
        android:gravity="center"
        android:background="@drawable/hassoun_widget_countdown_circle_light"
        android:padding="8dp"
        android:textStyle="bold"
        android:textSize="20sp"
        android:maxLines="2"
        android:includeFontPadding="false" />

      <LinearLayout
        android:layout_width="0dp"
        android:layout_height="match_parent"
        android:layout_weight="1.02"
        android:orientation="vertical"
        android:gravity="center_vertical|end">
        <TextView
          android:layout_width="wrap_content"
          android:layout_height="wrap_content"
          android:text="ADHAN"
          android:textColor="#AF7E39"
          android:textStyle="bold"
          android:textSize="10sp"
          android:letterSpacing="0.07"
          android:includeFontPadding="false" />
        <LinearLayout
          android:layout_width="match_parent"
          android:layout_height="wrap_content"
          android:gravity="end|bottom"
          android:orientation="horizontal">
          <TextView
            android:id="@+id/widget_next_time"
            android:layout_width="wrap_content"
            android:layout_height="wrap_content"
            android:fontFamily="serif"
            android:textStyle="bold"
            android:textSize="46sp"
            android:maxLines="1"
            android:includeFontPadding="false"
            android:autoSizeTextType="uniform"
            android:autoSizeMinTextSize="30sp"
            android:autoSizeMaxTextSize="46sp"
            android:autoSizeStepGranularity="1sp" />
          <TextView
            android:id="@+id/widget_next_suffix"
            android:layout_width="wrap_content"
            android:layout_height="wrap_content"
            android:layout_marginStart="4dp"
            android:layout_marginBottom="6dp"
            android:fontFamily="serif"
            android:textStyle="bold"
            android:textSize="14sp"
            android:maxLines="1"
            android:includeFontPadding="false" />
        </LinearLayout>
      </LinearLayout>
    </LinearLayout>
  </FrameLayout>

  <LinearLayout
    android:id="@+id/widget_prayer_strip"
    android:layout_width="match_parent"
    android:layout_height="72dp"
    android:orientation="horizontal"
    android:gravity="center_vertical"
    android:paddingLeft="12dp"
    android:paddingRight="12dp"
    android:background="@drawable/hassoun_widget_hero_light">

    <ImageView
      android:id="@+id/widget_following_icon"
      android:layout_width="42dp"
      android:layout_height="42dp"
      android:scaleType="fitCenter"
      android:contentDescription="Next prayer" />

    <LinearLayout
      android:layout_width="0dp"
      android:layout_height="wrap_content"
      android:layout_weight="1"
      android:layout_marginStart="10dp"
      android:orientation="vertical">
      <TextView
        android:layout_width="wrap_content"
        android:layout_height="wrap_content"
        android:text="NEXT PRAYER • الصلاة القادمة"
        android:textStyle="bold"
        android:textSize="9sp"
        android:letterSpacing="0.04"
        android:maxLines="1"
        android:includeFontPadding="false" />
      <TextView
        android:id="@+id/widget_following_name"
        android:layout_width="wrap_content"
        android:layout_height="wrap_content"
        android:textStyle="bold"
        android:textSize="18sp"
        android:maxLines="1"
        android:includeFontPadding="false" />
    </LinearLayout>

    <TextView
      android:id="@+id/widget_following_time"
      android:layout_width="105dp"
      android:layout_height="wrap_content"
      android:gravity="center"
      android:textStyle="bold"
      android:textSize="18sp"
      android:maxLines="1"
      android:includeFontPadding="false" />

    <Chronometer
      android:id="@+id/widget_following_countdown"
      android:layout_width="105dp"
      android:layout_height="wrap_content"
      android:gravity="end"
      android:textStyle="bold"
      android:textSize="14sp"
      android:maxLines="1"
      android:includeFontPadding="false" />

    <!-- Keep legacy ids available because shared theme code can address them. -->
    <TextView android:id="@+id/widget_prayer_fajr" android:layout_width="1dp" android:layout_height="1dp" android:visibility="gone" />
    <TextView android:id="@+id/widget_prayer_dhuhr" android:layout_width="1dp" android:layout_height="1dp" android:visibility="gone" />
    <TextView android:id="@+id/widget_prayer_asr" android:layout_width="1dp" android:layout_height="1dp" android:visibility="gone" />
    <TextView android:id="@+id/widget_prayer_maghrib" android:layout_width="1dp" android:layout_height="1dp" android:visibility="gone" />
    <TextView android:id="@+id/widget_prayer_isha" android:layout_width="1dp" android:layout_height="1dp" android:visibility="gone" />
  </LinearLayout>

  <TextView android:id="@+id/widget_location" android:layout_width="1dp" android:layout_height="1dp" android:visibility="gone" android:textSize="1sp" />
</LinearLayout>
'''

layout_path.write_text(layout, encoding='utf-8')

provider = provider_path.read_text(encoding='utf-8')

# Larger typography in the full widget.
provider = provider.replace(
    'else -> when (timeSize) { "small" -> 28f; "medium" -> 31f; "xlarge" -> 38f; else -> 34f }',
    'else -> when (timeSize) { "small" -> 34f; "medium" -> 38f; "xlarge" -> 46f; else -> 42f }'
)
provider = provider.replace(
    'else -> when (timeSize) { "small" -> 30f; "medium" -> 33f; "xlarge" -> 40f; else -> 36f }',
    'else -> when (timeSize) { "small" -> 36f; "medium" -> 40f; "xlarge" -> 48f; else -> 44f }'
)
provider = provider.replace(
    'else -> 13f\n          }\n          views.setTextViewTextSize(R.id.widget_countdown, TypedValue.COMPLEX_UNIT_SP, countdownSp)',
    'else -> when (timeSize) { "small" -> 16f; "medium" -> 18f; "xlarge" -> 24f; else -> 20f }\n          }\n          views.setTextViewTextSize(R.id.widget_countdown, TypedValue.COMPLEX_UNIT_SP, countdownSp)\n          val countdownTextColor = if (theme == "ivory") Color.rgb(181, 126, 42) else Color.rgb(242, 201, 111)\n          views.setTextColor(R.id.widget_countdown, countdownTextColor)'
)

# Make the bilingual header/date hierarchy larger in the full layout.
needle = 'views.setTextViewText(R.id.widget_brand_subtitle, if (locale == "ar") "وندسور • كندا" else "WINDSOR • CANADA")\n'
insert = needle + '''      if (!isLockScreen && layout == "full") {
        views.setTextViewTextSize(R.id.widget_header, TypedValue.COMPLEX_UNIT_SP, 23f)
        views.setTextViewTextSize(R.id.widget_brand_subtitle, TypedValue.COMPLEX_UNIT_SP, 10f)
        views.setTextViewTextSize(R.id.widget_hijri, TypedValue.COMPLEX_UNIT_SP, 13f)
        views.setTextViewTextSize(R.id.widget_date, TypedValue.COMPLEX_UNIT_SP, 10f)
      }
'''
if needle not in provider:
    raise SystemExit('Header insertion point not found')
provider = provider.replace(needle, insert, 1)

# Full widget uses one clean following-prayer strip instead of five tiny prayer boxes.
old_strip = '''        val supportsPrayerStrip = isLockScreen || layout in setOf("full", "vertical", "square", "slim", "compact", "next")
        if (supportsPrayerStrip && (showAllPrayers || isLockScreen)) {
          views.setViewVisibility(R.id.widget_prayer_strip, View.VISIBLE)
          bindPrayerStrip(views, next.day, locale, next.key, isLockScreen, theme, showArabicNames, highlightNext, timeSize, layout)
        } else {
          views.setViewVisibility(R.id.widget_prayer_strip, View.GONE)
        }
'''
new_strip = '''        val supportsPrayerStrip = isLockScreen || layout in setOf("full", "vertical", "square", "slim", "compact", "next")
        if (!isLockScreen && layout == "full") {
          val following = schedule?.let { findFollowingPrayer(it, next, locale) }
          if (following != null) {
            views.setViewVisibility(R.id.widget_prayer_strip, View.VISIBLE)
            views.setImageViewResource(R.id.widget_following_icon, prayerIcons[following.key] ?: R.drawable.ic_widget_asr)
            val followingName = "${englishNames[following.key] ?: following.key} • ${arabicNames[following.key] ?: following.key}"
            views.setTextViewText(R.id.widget_following_name, followingName)
            views.setTextViewText(R.id.widget_following_time, "${formatClockMain(following.timeText)} ${formatClockSuffix(following.timeText)}")
            val followingDelay = (following.targetMillis - System.currentTimeMillis()).coerceAtLeast(0L)
            views.setChronometer(R.id.widget_following_countdown, SystemClock.elapsedRealtime() + followingDelay, if (locale == "ar") "بعد %s" else "in %s", true)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) views.setChronometerCountDown(R.id.widget_following_countdown, true)
            val followingColor = if (theme == "ivory") Color.rgb(13, 83, 66) else Color.rgb(239, 207, 132)
            views.setTextColor(R.id.widget_following_name, followingColor)
            views.setTextColor(R.id.widget_following_time, followingColor)
            views.setTextColor(R.id.widget_following_countdown, countdownTextColor)
          } else {
            views.setViewVisibility(R.id.widget_prayer_strip, View.GONE)
          }
        } else if (supportsPrayerStrip && (showAllPrayers || isLockScreen)) {
          views.setViewVisibility(R.id.widget_prayer_strip, View.VISIBLE)
          bindPrayerStrip(views, next.day, locale, next.key, isLockScreen, theme, showArabicNames, highlightNext, timeSize, layout)
        } else {
          views.setViewVisibility(R.id.widget_prayer_strip, View.GONE)
        }
'''
if old_strip not in provider:
    raise SystemExit('Prayer strip block not found')
provider = provider.replace(old_strip, new_strip, 1)

helper_anchor = '    private fun bindPrayerStrip(\n'
helper = r'''    private fun findFollowingPrayer(schedule: JSONObject, current: PrayerMoment, locale: String): PrayerMoment? {
      val currentIndex = prayerKeys.indexOf(current.key)
      if (currentIndex < 0) return null

      var nextDateKey = current.dateKey
      var nextDay = current.day
      var nextKey = prayerKeys.getOrNull(currentIndex + 1)

      if (nextKey == null) {
        val dateParser = SimpleDateFormat("yyyy-MM-dd", Locale.US).apply { timeZone = toronto }
        val currentDate = dateParser.parse(current.dateKey) ?: return null
        val calendar = Calendar.getInstance(toronto).apply { time = currentDate; add(Calendar.DAY_OF_YEAR, 1) }
        nextDateKey = dateParser.format(calendar.time)
        val prayerRoot = schedule.optJSONObject("prayer_times") ?: schedule
        nextDay = prayerRoot.optJSONObject(nextDateKey) ?: return null
        nextKey = "fajr"
      }

      val rawTime = nextDay.optString(nextKey, "")
      val match = Regex("^(\\d{1,2}):(\\d{2})").find(rawTime) ?: return null
      val normalizedTime = "${match.groupValues[1].padStart(2, '0')}:${match.groupValues[2]}"
      val dateTime = SimpleDateFormat("yyyy-MM-dd HH:mm", Locale.US).apply {
        timeZone = toronto
        isLenient = false
      }.parse("$nextDateKey $normalizedTime") ?: return null
      val displayName = if (locale == "ar") arabicNames[nextKey] ?: nextKey else englishNames[nextKey] ?: nextKey
      return PrayerMoment(nextKey, displayName, rawTime, dateTime.time, nextDateKey, nextDay)
    }

'''
if 'private fun findFollowingPrayer(' not in provider:
    if helper_anchor not in provider:
        raise SystemExit('Helper insertion point not found')
    provider = provider.replace(helper_anchor, helper + helper_anchor, 1)

provider_path.write_text(provider, encoding='utf-8')

checks = [
    ('large logo', 'android:layout_width="56dp"' in layout),
    ('large hijri', 'android:id="@+id/widget_hijri"' in layout and 'android:textSize="13sp"' in layout),
    ('following prayer strip', 'widget_following_countdown' in layout and 'findFollowingPrayer' in provider),
    ('gold countdown', 'countdownTextColor' in provider),
    ('full xlarge prayer time', '"xlarge" -> 46f' in provider),
]
for label, ok in checks:
    if not ok:
        raise SystemExit(f'Validation failed: {label}')
print('Applied large bilingual Hassoun widget layout with contrasting countdown timer.')
