from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if new in text:
        return text
    if old not in text:
        raise SystemExit(f"{label} anchor missing")
    return text.replace(old, new, 1)

# -----------------------------------------------------------------------------
# One visible Quran audio surface at a time.
# -----------------------------------------------------------------------------
app_path = Path("mobile/App.tsx")
app = app_path.read_text()
app = replace_once(
    app,
    '  const [quranAppNavVisible, setQuranAppNavVisible] = useState(true);\n',
    '  const [quranAppNavVisible, setQuranAppNavVisible] = useState(true);\n  const [quranOwnsAudioSurface, setQuranOwnsAudioSurface] = useState(false);\n',
    "App Quran audio ownership state",
)
app = replace_once(
    app,
    '? <Quran locale={locale} onBackHome={() => { setQuranAppNavVisible(true); setActiveTab("home"); }} onAppNavVisibilityChange={setQuranAppNavVisible} />',
    '? <Quran locale={locale} onBackHome={() => { setQuranAppNavVisible(true); setQuranOwnsAudioSurface(false); setActiveTab("home"); }} onAppNavVisibilityChange={setQuranAppNavVisible} onLocalAudioSurfaceChange={setQuranOwnsAudioSurface} />',
    "App Quran props",
)
app = replace_once(
    app,
    '{globalQuranAudio.state !== "idle" && globalQuranAudio.state !== "error" ? (',
    '{(activeTab !== "quran" || !quranOwnsAudioSurface) && globalQuranAudio.state !== "idle" && globalQuranAudio.state !== "error" ? (',
    "App global audio visibility",
)
app_path.write_text(app)

quran_path = Path("mobile/src/quran/QuranV3.tsx")
quran = quran_path.read_text()
quran = replace_once(
    quran,
    '  onAppNavVisibilityChange?: (visible: boolean) => void;\n};',
    '  onAppNavVisibilityChange?: (visible: boolean) => void;\n  onLocalAudioSurfaceChange?: (visible: boolean) => void;\n};',
    "Quran props type",
)
quran = replace_once(
    quran,
    'export default function QuranV3({ locale, onBackHome, onAppNavVisibilityChange }: Props) {',
    'export default function QuranV3({ locale, onBackHome, onAppNavVisibilityChange, onLocalAudioSurfaceChange }: Props) {',
    "Quran function props",
)
ownership_anchor = '  const spreadMode = appearance.bookMode === "spread" || (appearance.bookMode === "auto" && autoSpread);\n\n'
ownership_block = '''  const spreadMode = appearance.bookMode === "spread" || (appearance.bookMode === "auto" && autoSpread);\n\n  // Reader, Radio and the Quran menu own the audio controls while they are visible.\n  // Everywhere else, App.tsx may show the single global persistent player.\n  useEffect(() => {\n    onLocalAudioSurfaceChange?.(screen === "reader" || screen === "radio" || menuOpen);\n  }, [screen, menuOpen, onLocalAudioSurfaceChange]);\n\n  useEffect(() => () => {\n    onLocalAudioSurfaceChange?.(false);\n  }, [onLocalAudioSurfaceChange]);\n\n'''
quran = replace_once(quran, ownership_anchor, ownership_block, "Quran audio ownership effect")
quran = replace_once(
    quran,
    '      {screen === "reader" && playerVisible ? miniPlayer : null}\n',
    '      {screen === "reader" && playerVisible && !selectedAyah && !menuOpen && !appearanceOpen ? miniPlayer : null}\n',
    "Quran reader mini player visibility",
)
quran_path.write_text(quran)

# -----------------------------------------------------------------------------
# Premium Android prayer widget.
# -----------------------------------------------------------------------------
provider_path = Path("mobile/modules/hassoun-widget/android/src/main/java/ca/wopt/hassounwidget/HassounPrayerWidgetProvider.kt")
provider = provider_path.read_text()
provider = replace_once(
    provider,
    'import android.content.Intent\n',
    'import android.content.Intent\nimport android.graphics.Color\n',
    "Widget Color import",
)
provider = replace_once(
    provider,
    '      views.setTextViewText(R.id.widget_header, if (locale == "ar") "Hassoun • مواقيت الصلاة" else "Hassoun • Prayer Times")\n',
    '      views.setTextViewText(R.id.widget_header, "HASSOUN")\n      views.setTextViewText(R.id.widget_brand_subtitle, if (locale == "ar") "مواقيت الصلاة • وندسور" else "PRAYER TIMES • WINDSOR")\n',
    "Widget brand binding",
)
provider = replace_once(
    provider,
    '        views.setTextViewText(R.id.widget_next_name, if (locale == "ar") "افتح Hassoun للمزامنة" else "Open Hassoun to sync")\n        views.setTextViewText(R.id.widget_next_time, "")\n        views.setViewVisibility(R.id.widget_countdown, View.GONE)\n        views.setViewVisibility(R.id.widget_prayer_list, View.GONE)\n',
    '        views.setTextViewText(R.id.widget_next_name, if (locale == "ar") "افتح Hassoun" else "Open Hassoun")\n        views.setTextViewText(R.id.widget_next_secondary, if (locale == "ar") "للمزامنة" else "to sync prayer times")\n        views.setTextViewText(R.id.widget_next_time, "")\n        views.setViewVisibility(R.id.widget_countdown, View.GONE)\n        views.setViewVisibility(R.id.widget_prayer_strip, View.GONE)\n',
    "Widget empty state",
)
provider = replace_once(
    provider,
    '        views.setTextViewText(R.id.widget_next_name, next.name)\n        views.setTextViewText(R.id.widget_next_time, formatClock(next.timeText, locale))\n',
    '        views.setTextViewText(R.id.widget_next_name, next.name)\n        views.setTextViewText(R.id.widget_next_secondary, if (locale == "ar") englishNames[next.key] ?: next.key else arabicNames[next.key] ?: next.key)\n        views.setTextViewText(R.id.widget_next_time, formatClock(next.timeText, locale))\n',
    "Widget secondary prayer name",
)
provider = replace_once(
    provider,
    '''        val fullLayout = layout == "full"\n        if (fullLayout && showAllPrayers) {\n          views.setViewVisibility(R.id.widget_prayer_list, View.VISIBLE)\n          views.setTextViewText(R.id.widget_prayer_list, prayerList(next.day, locale))\n        } else {\n          views.setViewVisibility(R.id.widget_prayer_list, View.GONE)\n        }\n''',
    '''        val fullLayout = layout == "full"\n        if (fullLayout && showAllPrayers) {\n          views.setViewVisibility(R.id.widget_prayer_strip, View.VISIBLE)\n          bindPrayerStrip(views, next.day, locale, next.key)\n        } else {\n          views.setViewVisibility(R.id.widget_prayer_strip, View.GONE)\n        }\n''',
    "Widget prayer strip binding",
)
provider = replace_once(
    provider,
    '        views.setTextViewText(R.id.widget_location, if (locale == "ar") "وندسور، أونتاريو" else "Windsor, Ontario")\n',
    '        views.setTextViewText(R.id.widget_location, if (locale == "ar") "⌖ وندسور، أونتاريو • الجدول الرسمي" else "⌖ Windsor, Ontario • Official schedule")\n',
    "Widget location label",
)
helper_anchor = '    private fun prayerList(day: JSONObject, locale: String): String {\n'
helper_block = '''    private fun bindPrayerStrip(views: RemoteViews, day: JSONObject, locale: String, nextKey: String) {\n      val ids = mapOf(\n        "fajr" to R.id.widget_prayer_fajr,\n        "dhuhr" to R.id.widget_prayer_dhuhr,\n        "asr" to R.id.widget_prayer_asr,\n        "maghrib" to R.id.widget_prayer_maghrib,\n        "isha" to R.id.widget_prayer_isha\n      )\n      prayerKeys.forEach { key ->\n        val id = ids[key] ?: return@forEach\n        val name = if (locale == "ar") arabicNames[key] ?: key else englishNames[key] ?: key\n        val time = formatClock(day.optString(key, "--:--"), locale)\n        val active = key == nextKey\n        views.setTextViewText(id, "${if (active) "● " else ""}$name\\n$time")\n        views.setTextColor(id, Color.parseColor(if (active) "#F3D98B" else "#E7F3EF"))\n      }\n    }\n\n    private fun prayerList(day: JSONObject, locale: String): String {\n'''
provider = replace_once(provider, helper_anchor, helper_block, "Widget prayer strip helper")
provider_path.write_text(provider)

layout = '''<?xml version="1.0" encoding="utf-8"?>
<LinearLayout xmlns:android="http://schemas.android.com/apk/res/android"
  android:id="@+id/widget_root"
  android:layout_width="match_parent"
  android:layout_height="match_parent"
  android:orientation="vertical"
  android:gravity="center_vertical"
  android:background="@drawable/hassoun_widget_background"
  android:padding="14dp">

  <LinearLayout
    android:layout_width="match_parent"
    android:layout_height="wrap_content"
    android:orientation="horizontal"
    android:gravity="center_vertical">

    <TextView
      android:layout_width="34dp"
      android:layout_height="34dp"
      android:gravity="center"
      android:background="@drawable/hassoun_widget_brand_badge"
      android:text="☾"
      android:textColor="#F0D27A"
      android:textStyle="bold"
      android:textSize="22sp" />

    <LinearLayout
      android:layout_width="0dp"
      android:layout_height="wrap_content"
      android:layout_weight="1"
      android:layout_marginStart="9dp"
      android:orientation="vertical">
      <TextView
        android:id="@+id/widget_header"
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:text="HASSOUN"
        android:textColor="#FFFFFF"
        android:textStyle="bold"
        android:textSize="12sp"
        android:maxLines="1" />
      <TextView
        android:id="@+id/widget_brand_subtitle"
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:layout_marginTop="1dp"
        android:textColor="#BFDCD2"
        android:textStyle="bold"
        android:textSize="7sp"
        android:maxLines="1" />
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
        android:textColor="#F7F1DE"
        android:textStyle="bold"
        android:textSize="9sp"
        android:maxLines="1" />
      <TextView
        android:id="@+id/widget_hijri"
        android:layout_width="wrap_content"
        android:layout_height="wrap_content"
        android:layout_marginTop="2dp"
        android:textColor="#D8C17A"
        android:textSize="8sp"
        android:maxLines="1" />
    </LinearLayout>
  </LinearLayout>

  <TextView
    android:layout_width="match_parent"
    android:layout_height="1dp"
    android:layout_marginTop="9dp"
    android:background="#2DFFFFFF"
    android:text="" />

  <LinearLayout
    android:layout_width="match_parent"
    android:layout_height="wrap_content"
    android:layout_marginTop="9dp"
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
        android:textColor="#E5C76E"
        android:textStyle="bold"
        android:textSize="8sp" />
      <TextView
        android:id="@+id/widget_next_name"
        android:layout_width="wrap_content"
        android:layout_height="wrap_content"
        android:layout_marginTop="1dp"
        android:textColor="#FFFFFF"
        android:textStyle="bold"
        android:textSize="25sp"
        android:maxLines="1" />
      <TextView
        android:id="@+id/widget_next_secondary"
        android:layout_width="wrap_content"
        android:layout_height="wrap_content"
        android:layout_marginTop="1dp"
        android:textColor="#BFD9D1"
        android:textSize="10sp"
        android:maxLines="1" />
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
        android:maxLines="1" />
      <Chronometer
        android:id="@+id/widget_countdown"
        android:layout_width="wrap_content"
        android:layout_height="wrap_content"
        android:layout_marginTop="5dp"
        android:gravity="center"
        android:background="@drawable/hassoun_widget_countdown"
        android:paddingLeft="9dp"
        android:paddingTop="4dp"
        android:paddingRight="9dp"
        android:paddingBottom="4dp"
        android:textColor="#17483C"
        android:textStyle="bold"
        android:textSize="8sp" />
    </LinearLayout>
  </LinearLayout>

  <LinearLayout
    android:id="@+id/widget_prayer_strip"
    android:layout_width="match_parent"
    android:layout_height="wrap_content"
    android:layout_marginTop="10dp"
    android:orientation="horizontal"
    android:gravity="center_vertical">

    <TextView
      android:id="@+id/widget_prayer_fajr"
      android:layout_width="0dp"
      android:layout_height="42dp"
      android:layout_weight="1"
      android:layout_marginEnd="2dp"
      android:gravity="center"
      android:background="@drawable/hassoun_widget_prayer_chip"
      android:textColor="#E7F3EF"
      android:textStyle="bold"
      android:textSize="7.5sp"
      android:lineSpacingExtra="1dp"
      android:maxLines="2" />
    <TextView
      android:id="@+id/widget_prayer_dhuhr"
      android:layout_width="0dp"
      android:layout_height="42dp"
      android:layout_weight="1"
      android:layout_marginStart="2dp"
      android:layout_marginEnd="2dp"
      android:gravity="center"
      android:background="@drawable/hassoun_widget_prayer_chip"
      android:textColor="#E7F3EF"
      android:textStyle="bold"
      android:textSize="7.5sp"
      android:lineSpacingExtra="1dp"
      android:maxLines="2" />
    <TextView
      android:id="@+id/widget_prayer_asr"
      android:layout_width="0dp"
      android:layout_height="42dp"
      android:layout_weight="1"
      android:layout_marginStart="2dp"
      android:layout_marginEnd="2dp"
      android:gravity="center"
      android:background="@drawable/hassoun_widget_prayer_chip"
      android:textColor="#E7F3EF"
      android:textStyle="bold"
      android:textSize="7.5sp"
      android:lineSpacingExtra="1dp"
      android:maxLines="2" />
    <TextView
      android:id="@+id/widget_prayer_maghrib"
      android:layout_width="0dp"
      android:layout_height="42dp"
      android:layout_weight="1"
      android:layout_marginStart="2dp"
      android:layout_marginEnd="2dp"
      android:gravity="center"
      android:background="@drawable/hassoun_widget_prayer_chip"
      android:textColor="#E7F3EF"
      android:textStyle="bold"
      android:textSize="7.5sp"
      android:lineSpacingExtra="1dp"
      android:maxLines="2" />
    <TextView
      android:id="@+id/widget_prayer_isha"
      android:layout_width="0dp"
      android:layout_height="42dp"
      android:layout_weight="1"
      android:layout_marginStart="2dp"
      android:gravity="center"
      android:background="@drawable/hassoun_widget_prayer_chip"
      android:textColor="#E7F3EF"
      android:textStyle="bold"
      android:textSize="7.5sp"
      android:lineSpacingExtra="1dp"
      android:maxLines="2" />
  </LinearLayout>

  <TextView
    android:id="@+id/widget_location"
    android:layout_width="match_parent"
    android:layout_height="wrap_content"
    android:layout_marginTop="7dp"
    android:textColor="#AFCFC5"
    android:textSize="8sp"
    android:maxLines="1" />
</LinearLayout>
'''
Path("mobile/modules/hassoun-widget/android/src/main/res/layout/hassoun_prayer_widget.xml").write_text(layout)

Path("mobile/modules/hassoun-widget/android/src/main/res/drawable/hassoun_widget_background.xml").write_text('''<?xml version="1.0" encoding="utf-8"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android" android:shape="rectangle">
  <gradient
    android:angle="0"
    android:startColor="#0E6B55"
    android:centerColor="#0A5949"
    android:endColor="#073D35" />
  <stroke android:width="1dp" android:color="#8ED4B86C" />
  <corners android:radius="30dp" />
</shape>
''')
Path("mobile/modules/hassoun-widget/android/src/main/res/drawable/hassoun_widget_brand_badge.xml").write_text('''<?xml version="1.0" encoding="utf-8"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android" android:shape="rectangle">
  <solid android:color="#18FFFFFF" />
  <stroke android:width="1dp" android:color="#66E0C36F" />
  <corners android:radius="12dp" />
</shape>
''')
Path("mobile/modules/hassoun-widget/android/src/main/res/drawable/hassoun_widget_countdown.xml").write_text('''<?xml version="1.0" encoding="utf-8"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android" android:shape="rectangle">
  <solid android:color="#F2DFA8" />
  <corners android:radius="99dp" />
</shape>
''')
Path("mobile/modules/hassoun-widget/android/src/main/res/drawable/hassoun_widget_prayer_chip.xml").write_text('''<?xml version="1.0" encoding="utf-8"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android" android:shape="rectangle">
  <solid android:color="#12FFFFFF" />
  <stroke android:width="1dp" android:color="#1FFFFFFF" />
  <corners android:radius="12dp" />
</shape>
''')

# Release bump.
config_path = Path("mobile/app.config.ts")
config = config_path.read_text().replace('version: "0.5.2"', 'version: "0.5.3"', 1).replace('versionCode: 24', 'versionCode: 25', 1)
config_path.write_text(config)

build_path = Path(".github/workflows/android-debug.yml")
build = build_path.read_text().replace("0.5.2", "0.5.3")
build = build.replace("persistent Quran audio + rich Radio release", "single-player Quran audio + premium widget release")
build_path.write_text(build)

print("Unified Quran audio surfaces, redesigned widget, and bumped Hassoun v0.5.3")
