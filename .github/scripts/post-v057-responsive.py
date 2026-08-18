from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]

def read(path: str) -> str:
    return (ROOT / path).read_text()

def write(path: str, content: str) -> None:
    target = ROOT / path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content)

def replace_once(path: str, old: str, new: str) -> None:
    text = read(path)
    if old not in text:
        raise SystemExit(f"Missing expected block in {path}: {old[:100]!r}")
    write(path, text.replace(old, new, 1))

# Keep the multiplayer client request headers simple and fully React Native compatible.
p = "mobile/src/MultiplayerGames.tsx"
s = read(p)
s = s.replace('headers: { "Content-Type": "application/json", ...(init?.headers || {}) }', 'headers: { "Content-Type": "application/json" }')
write(p, s)

# Android must choose a real layout for every layout users can select in Widget Studio.
replace_once(
    "mobile/modules/hassoun-widget/android/src/main/java/ca/wopt/hassounwidget/HassounPrayerWidgetProvider.kt",
    '''        if (isLockScreen) R.layout.hassoun_prayer_widget_lockscreen
        else if (layout == "vertical") R.layout.hassoun_prayer_widget_vertical
        else R.layout.hassoun_prayer_widget
''',
    '''        if (isLockScreen) R.layout.hassoun_prayer_widget_lockscreen
        else when (layout) {
          "vertical" -> R.layout.hassoun_prayer_widget_vertical
          "square" -> R.layout.hassoun_prayer_widget_square
          "slim", "compact", "next" -> R.layout.hassoun_prayer_widget_slim
          else -> R.layout.hassoun_prayer_widget
        }
'''
)

write("mobile/modules/hassoun-widget/android/src/main/res/layout/hassoun_prayer_widget_square.xml", r'''<?xml version="1.0" encoding="utf-8"?>
<LinearLayout xmlns:android="http://schemas.android.com/apk/res/android"
  android:id="@+id/widget_root" android:layout_width="match_parent" android:layout_height="match_parent"
  android:orientation="vertical" android:gravity="center_horizontal" android:background="@drawable/hassoun_widget_patterned" android:padding="10dp">
  <LinearLayout android:layout_width="match_parent" android:layout_height="wrap_content" android:orientation="horizontal" android:gravity="center_vertical">
    <ImageView android:id="@+id/widget_logo" android:layout_width="34dp" android:layout_height="34dp" android:src="@drawable/hassoun_widget_logo" android:scaleType="fitCenter" android:contentDescription="Hassoun"/>
    <LinearLayout android:layout_width="0dp" android:layout_height="wrap_content" android:layout_weight="1" android:layout_marginStart="6dp" android:orientation="vertical"><TextView android:id="@+id/widget_header" android:layout_width="wrap_content" android:layout_height="wrap_content" android:text="HASSOUN" android:textColor="#fff" android:textStyle="bold" android:textSize="9sp"/><TextView android:id="@+id/widget_brand_subtitle" android:layout_width="wrap_content" android:layout_height="wrap_content" android:textColor="#c7ddd6" android:textSize="5.5sp" android:textStyle="bold"/></LinearLayout>
    <LinearLayout android:layout_width="wrap_content" android:layout_height="wrap_content" android:gravity="end" android:orientation="vertical"><TextView android:id="@+id/widget_date" android:layout_width="wrap_content" android:layout_height="wrap_content" android:textColor="#fff" android:textStyle="bold" android:textSize="6sp"/><TextView android:id="@+id/widget_hijri" android:layout_width="wrap_content" android:layout_height="wrap_content" android:textColor="#f0d27a" android:textSize="5.5sp"/></LinearLayout>
  </LinearLayout>
  <TextView android:id="@+id/widget_next_label" android:layout_width="wrap_content" android:layout_height="wrap_content" android:layout_marginTop="6dp" android:text="NEXT PRAYER" android:textColor="#f0d27a" android:textStyle="bold" android:textSize="6sp"/>
  <TextView android:id="@+id/widget_next_name" android:layout_width="wrap_content" android:layout_height="wrap_content" android:textColor="#fff" android:textStyle="bold" android:textSize="21sp" android:maxLines="1"/>
  <TextView android:id="@+id/widget_next_secondary" android:layout_width="wrap_content" android:layout_height="wrap_content" android:textColor="#d7e5e0" android:textSize="7sp" android:maxLines="1"/>
  <LinearLayout android:layout_width="match_parent" android:layout_height="68dp" android:layout_marginTop="3dp" android:orientation="horizontal" android:gravity="center">
    <Chronometer android:id="@+id/widget_countdown" android:layout_width="64dp" android:layout_height="64dp" android:gravity="center" android:background="@drawable/hassoun_widget_countdown_circle" android:padding="4dp" android:textColor="#17483c" android:textStyle="bold" android:textSize="10sp" android:maxLines="2"/>
    <LinearLayout android:layout_width="0dp" android:layout_height="wrap_content" android:layout_weight="1" android:layout_marginStart="7dp" android:gravity="center_vertical|end" android:orientation="vertical"><TextView android:layout_width="wrap_content" android:layout_height="wrap_content" android:text="ADHAN" android:textColor="#c7ddd6" android:textStyle="bold" android:textSize="6sp"/><TextView android:id="@+id/widget_next_time" android:layout_width="wrap_content" android:layout_height="wrap_content" android:textColor="#fff" android:textStyle="bold" android:textSize="22sp" android:maxLines="1"/></LinearLayout>
  </LinearLayout>
  <LinearLayout android:id="@+id/widget_prayer_strip" android:layout_width="match_parent" android:layout_height="wrap_content" android:layout_marginTop="4dp" android:orientation="vertical">
    <LinearLayout android:layout_width="match_parent" android:layout_height="wrap_content" android:orientation="horizontal"><TextView android:id="@+id/widget_prayer_fajr" android:layout_width="0dp" android:layout_height="30dp" android:layout_weight="1" android:gravity="center" android:background="@drawable/hassoun_widget_prayer_chip" android:textStyle="bold" android:textSize="6.5sp" android:maxLines="2"/><TextView android:id="@+id/widget_prayer_dhuhr" android:layout_width="0dp" android:layout_height="30dp" android:layout_weight="1" android:layout_marginStart="3dp" android:gravity="center" android:background="@drawable/hassoun_widget_prayer_chip" android:textStyle="bold" android:textSize="6.5sp" android:maxLines="2"/><TextView android:id="@+id/widget_prayer_asr" android:layout_width="0dp" android:layout_height="30dp" android:layout_weight="1" android:layout_marginStart="3dp" android:gravity="center" android:background="@drawable/hassoun_widget_prayer_chip" android:textStyle="bold" android:textSize="6.5sp" android:maxLines="2"/></LinearLayout>
    <LinearLayout android:layout_width="match_parent" android:layout_height="wrap_content" android:layout_marginTop="3dp" android:orientation="horizontal"><TextView android:id="@+id/widget_prayer_maghrib" android:layout_width="0dp" android:layout_height="30dp" android:layout_weight="1" android:gravity="center" android:background="@drawable/hassoun_widget_prayer_chip" android:textStyle="bold" android:textSize="6.5sp" android:maxLines="2"/><TextView android:id="@+id/widget_prayer_isha" android:layout_width="0dp" android:layout_height="30dp" android:layout_weight="1" android:layout_marginStart="3dp" android:gravity="center" android:background="@drawable/hassoun_widget_prayer_chip" android:textStyle="bold" android:textSize="6.5sp" android:maxLines="2"/></LinearLayout>
  </LinearLayout>
  <TextView android:id="@+id/widget_location" android:layout_width="wrap_content" android:layout_height="wrap_content" android:layout_marginTop="3dp" android:textColor="#b9d4cb" android:textSize="5.5sp" android:maxLines="1"/>
</LinearLayout>
''')

write("mobile/modules/hassoun-widget/android/src/main/res/layout/hassoun_prayer_widget_slim.xml", r'''<?xml version="1.0" encoding="utf-8"?>
<LinearLayout xmlns:android="http://schemas.android.com/apk/res/android"
  android:id="@+id/widget_root" android:layout_width="match_parent" android:layout_height="match_parent"
  android:orientation="vertical" android:gravity="center" android:background="@drawable/hassoun_widget_patterned" android:padding="7dp">
  <LinearLayout android:layout_width="match_parent" android:layout_height="0dp" android:layout_weight="1" android:orientation="horizontal" android:gravity="center_vertical">
    <ImageView android:id="@+id/widget_logo" android:layout_width="36dp" android:layout_height="36dp" android:src="@drawable/hassoun_widget_logo" android:scaleType="fitCenter" android:contentDescription="Hassoun"/>
    <LinearLayout android:layout_width="0dp" android:layout_height="wrap_content" android:layout_weight="1" android:layout_marginStart="5dp" android:orientation="vertical"><TextView android:id="@+id/widget_header" android:layout_width="wrap_content" android:layout_height="wrap_content" android:text="HASSOUN" android:textColor="#fff" android:textStyle="bold" android:textSize="7sp"/><TextView android:id="@+id/widget_brand_subtitle" android:layout_width="wrap_content" android:layout_height="wrap_content" android:textColor="#c7ddd6" android:textSize="4.5sp"/><TextView android:id="@+id/widget_next_label" android:layout_width="wrap_content" android:layout_height="wrap_content" android:text="NEXT PRAYER" android:textColor="#f0d27a" android:textStyle="bold" android:textSize="4.5sp"/><TextView android:id="@+id/widget_next_name" android:layout_width="wrap_content" android:layout_height="wrap_content" android:textColor="#fff" android:textStyle="bold" android:textSize="15sp" android:maxLines="1"/><TextView android:id="@+id/widget_next_secondary" android:layout_width="wrap_content" android:layout_height="wrap_content" android:textColor="#d7e5e0" android:textSize="5.5sp" android:maxLines="1"/></LinearLayout>
    <Chronometer android:id="@+id/widget_countdown" android:layout_width="52dp" android:layout_height="52dp" android:layout_marginHorizontal="5dp" android:gravity="center" android:background="@drawable/hassoun_widget_countdown_circle" android:padding="3dp" android:textColor="#17483c" android:textStyle="bold" android:textSize="8sp" android:maxLines="2"/>
    <LinearLayout android:layout_width="wrap_content" android:layout_height="wrap_content" android:gravity="end" android:orientation="vertical"><TextView android:layout_width="wrap_content" android:layout_height="wrap_content" android:text="ADHAN" android:textColor="#c7ddd6" android:textSize="4.5sp" android:textStyle="bold"/><TextView android:id="@+id/widget_next_time" android:layout_width="wrap_content" android:layout_height="wrap_content" android:textColor="#fff" android:textStyle="bold" android:textSize="18sp" android:maxLines="1"/><TextView android:id="@+id/widget_date" android:layout_width="wrap_content" android:layout_height="wrap_content" android:visibility="gone" android:textSize="1sp"/><TextView android:id="@+id/widget_hijri" android:layout_width="wrap_content" android:layout_height="wrap_content" android:visibility="gone" android:textSize="1sp"/></LinearLayout>
  </LinearLayout>
  <LinearLayout android:id="@+id/widget_prayer_strip" android:layout_width="match_parent" android:layout_height="22dp" android:layout_marginTop="2dp" android:orientation="horizontal"><TextView android:id="@+id/widget_prayer_fajr" android:layout_width="0dp" android:layout_height="match_parent" android:layout_weight="1" android:gravity="center" android:textStyle="bold" android:textSize="5.5sp" android:maxLines="2"/><TextView android:id="@+id/widget_prayer_dhuhr" android:layout_width="0dp" android:layout_height="match_parent" android:layout_weight="1" android:gravity="center" android:textStyle="bold" android:textSize="5.5sp" android:maxLines="2"/><TextView android:id="@+id/widget_prayer_asr" android:layout_width="0dp" android:layout_height="match_parent" android:layout_weight="1" android:gravity="center" android:textStyle="bold" android:textSize="5.5sp" android:maxLines="2"/><TextView android:id="@+id/widget_prayer_maghrib" android:layout_width="0dp" android:layout_height="match_parent" android:layout_weight="1" android:gravity="center" android:textStyle="bold" android:textSize="5.5sp" android:maxLines="2"/><TextView android:id="@+id/widget_prayer_isha" android:layout_width="0dp" android:layout_height="match_parent" android:layout_weight="1" android:gravity="center" android:textStyle="bold" android:textSize="5.5sp" android:maxLines="2"/></LinearLayout>
  <TextView android:id="@+id/widget_location" android:layout_width="wrap_content" android:layout_height="wrap_content" android:visibility="gone" android:textSize="1sp"/>
</LinearLayout>
''')

# Make the Widget Studio preview visibly carry an Islamic motif, not a flat swatch.
p = "mobile/src/SettingsHub.tsx"
s = read(p)
needle = '''          ]}>\n            <View style={styles.previewHeaderRow}>'''
replacement = '''          ]}>\n            <View pointerEvents="none" style={styles.previewIslamicPattern}><Text style={[styles.previewPatternText, { color: previewTheme.accent }]}>✦  ◇  ✦  ◇  ✦  ◇  ✦</Text><Text style={[styles.previewPatternMosque, { color: previewTheme.muted }]}>⌒⌒  ◇  ⌒⌒  ◇  ⌒⌒</Text></View>\n            <View style={styles.previewHeaderRow}>'''
if needle not in s:
    raise SystemExit("Widget preview insertion point missing")
s = s.replace(needle, replacement, 1)
style_needle = '  previewStage: { alignItems: "center", marginBottom: 6 },\n'
style_replacement = '  previewStage: { alignItems: "center", marginBottom: 6 },\n  previewIslamicPattern: { position: "absolute", top: 5, left: 4, right: 4, bottom: 4, opacity: .16, justifyContent: "space-between", overflow: "hidden" }, previewPatternText: { fontSize: 22, letterSpacing: 8, textAlign: "center" }, previewPatternMosque: { fontSize: 20, letterSpacing: 7, textAlign: "center", marginBottom: 4 },\n'
if style_needle not in s:
    raise SystemExit("Widget preview style insertion point missing")
s = s.replace(style_needle, style_replacement, 1)
write(p, s)

print("Applied responsive Square/Slim widgets and Islamic Widget Studio preview.")
