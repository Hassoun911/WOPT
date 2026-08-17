from pathlib import Path
import re

ROOT = Path('.')


def write(path: str, content: str):
    p = ROOT / path
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(content, encoding='utf-8')


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        if new in text:
            return text
        raise SystemExit(f'Missing target for {label}')
    return text.replace(old, new, 1)

# Version bump
p = ROOT / 'mobile/app.config.ts'
s = p.read_text()
s = s.replace('version: "0.5.4"', 'version: "0.5.5"')
s = s.replace('versionCode: 26', 'versionCode: 27')
p.write_text(s)

# TS bridge: theme + richer layout names.
p = ROOT / 'mobile/modules/hassoun-widget/index.ts'
s = p.read_text()
s = replace_once(s,
    'export type HassounWidgetLayout = "compact" | "next" | "full";',
    'export type HassounWidgetLayout = "compact" | "next" | "full" | "square" | "vertical" | "slim";\nexport type HassounWidgetTheme = "emerald" | "ivory" | "ocean" | "sunset" | "midnight";',
    'widget layout type')
s = replace_once(s, '  layout: HassounWidgetLayout;\n  showCountdown:', '  layout: HassounWidgetLayout;\n  theme: HassounWidgetTheme;\n  showCountdown:', 'theme preference')
s = replace_once(s, '    layout: HassounWidgetLayout,\n    showCountdown:', '    layout: HassounWidgetLayout,\n    theme: HassounWidgetTheme,\n    showCountdown:', 'native theme argument')
s = replace_once(s, '  layout: "next",\n  showCountdown:', '  layout: "full",\n  theme: "emerald",\n  showCountdown:', 'defaults')
s = replace_once(s, '      preferences.layout,\n      preferences.showCountdown,', '      preferences.layout,\n      preferences.theme,\n      preferences.showCountdown,', 'theme bridge')
p.write_text(s)

# Native module preferences.
p = ROOT / 'mobile/modules/hassoun-widget/android/src/main/java/ca/wopt/hassounwidget/HassounWidgetModule.kt'
s = p.read_text()
s = replace_once(s, '      layout: String,\n      showCountdown: Boolean,', '      layout: String,\n      theme: String,\n      showCountdown: Boolean,', 'native signature')
s = replace_once(s,
    '.putString("layout", layout.takeIf { it in setOf("compact", "next", "full") } ?: "next")',
    '.putString("layout", layout.takeIf { it in setOf("compact", "next", "full", "square", "vertical", "slim") } ?: "full")\n        .putString("theme", theme.takeIf { it in setOf("emerald", "ivory", "ocean", "sunset", "midnight") } ?: "emerald")',
    'native prefs')
s = replace_once(s, '          "layout" to "next",\n          "showCountdown"', '          "layout" to "full",\n          "theme" to "emerald",\n          "showCountdown"', 'native null defaults')
s = replace_once(s, '        "layout" to (prefs.getString("layout", "next") ?: "next"),\n        "showCountdown"', '        "layout" to (prefs.getString("layout", "full") ?: "full"),\n        "theme" to (prefs.getString("theme", "emerald") ?: "emerald"),\n        "showCountdown"', 'native get prefs')
p.write_text(s)

# Main widget: replace crescent placeholder with the actual Hassoun launcher logo.
p = ROOT / 'mobile/modules/hassoun-widget/android/src/main/res/layout/hassoun_prayer_widget.xml'
s = p.read_text()
old_badge = '''    <TextView
      android:layout_width="34dp"
      android:layout_height="34dp"
      android:gravity="center"
      android:background="@drawable/hassoun_widget_brand_badge"
      android:text="☾"
      android:textColor="#F0D27A"
      android:textStyle="bold"
      android:textSize="22sp" />'''
new_badge = '''    <ImageView
      android:id="@+id/widget_logo"
      android:layout_width="48dp"
      android:layout_height="48dp"
      android:contentDescription="Hassoun"
      android:scaleType="fitCenter"
      android:src="@mipmap/ic_launcher" />'''
s = replace_once(s, old_badge, new_badge, 'home widget logo')
p.write_text(s)

# Transparent lock layout also carries the real Hassoun logo.
p = ROOT / 'mobile/modules/hassoun-widget/android/src/main/res/layout/hassoun_prayer_widget_lockscreen.xml'
s = p.read_text()
needle = '''  <LinearLayout
    android:layout_width="match_parent"
    android:layout_height="wrap_content"
    android:orientation="horizontal"
    android:gravity="center_vertical">

    <LinearLayout'''
replacement = '''  <LinearLayout
    android:layout_width="match_parent"
    android:layout_height="wrap_content"
    android:orientation="horizontal"
    android:gravity="center_vertical">

    <ImageView
      android:id="@+id/widget_logo"
      android:layout_width="34dp"
      android:layout_height="34dp"
      android:layout_marginEnd="7dp"
      android:contentDescription="Hassoun"
      android:scaleType="fitCenter"
      android:src="@mipmap/ic_launcher" />

    <LinearLayout'''
s = replace_once(s, needle, replacement, 'lock logo')
p.write_text(s)

# Theme backgrounds.
theme_xml = {
'hassoun_widget_background_ivory.xml': '''<?xml version="1.0" encoding="utf-8"?>\n<shape xmlns:android="http://schemas.android.com/apk/res/android" android:shape="rectangle"><gradient android:angle="0" android:startColor="#FFF9EE" android:endColor="#F4E5C9"/><corners android:radius="28dp"/><stroke android:width="1dp" android:color="#D8B875"/></shape>\n''',
'hassoun_widget_background_ocean.xml': '''<?xml version="1.0" encoding="utf-8"?>\n<shape xmlns:android="http://schemas.android.com/apk/res/android" android:shape="rectangle"><gradient android:angle="0" android:startColor="#4C91BD" android:endColor="#245F8D"/><corners android:radius="28dp"/><stroke android:width="1dp" android:color="#9FD1EE"/></shape>\n''',
'hassoun_widget_background_sunset.xml': '''<?xml version="1.0" encoding="utf-8"?>\n<shape xmlns:android="http://schemas.android.com/apk/res/android" android:shape="rectangle"><gradient android:angle="0" android:startColor="#F7C6B5" android:endColor="#B76F87"/><corners android:radius="28dp"/><stroke android:width="1dp" android:color="#F4D6A3"/></shape>\n''',
'hassoun_widget_background_midnight.xml': '''<?xml version="1.0" encoding="utf-8"?>\n<shape xmlns:android="http://schemas.android.com/apk/res/android" android:shape="rectangle"><gradient android:angle="0" android:startColor="#173A63" android:endColor="#08182F"/><corners android:radius="28dp"/><stroke android:width="1dp" android:color="#647FA2"/></shape>\n''',
'hassoun_widget_prayer_chip_light.xml': '''<?xml version="1.0" encoding="utf-8"?>\n<shape xmlns:android="http://schemas.android.com/apk/res/android" android:shape="rectangle"><solid android:color="#0A0B7057"/><corners android:radius="12dp"/><stroke android:width="1dp" android:color="#220B7057"/></shape>\n'''
}
for name, data in theme_xml.items():
    write(f'mobile/modules/hassoun-widget/android/src/main/res/drawable/{name}', data)

# Tall/vertical layout with same IDs so the provider can bind normally.
vertical = '''<?xml version="1.0" encoding="utf-8"?>
<LinearLayout xmlns:android="http://schemas.android.com/apk/res/android"
  android:id="@+id/widget_root" android:layout_width="match_parent" android:layout_height="match_parent"
  android:orientation="vertical" android:gravity="center_horizontal" android:background="@drawable/hassoun_widget_background" android:padding="13dp">
  <ImageView android:id="@+id/widget_logo" android:layout_width="54dp" android:layout_height="54dp" android:src="@mipmap/ic_launcher" android:scaleType="fitCenter" android:contentDescription="Hassoun" />
  <TextView android:id="@+id/widget_header" android:layout_width="wrap_content" android:layout_height="wrap_content" android:text="HASSOUN" android:textColor="#FFFFFF" android:textStyle="bold" android:textSize="12sp" />
  <TextView android:id="@+id/widget_brand_subtitle" android:layout_width="wrap_content" android:layout_height="wrap_content" android:textColor="#BFDCD2" android:textStyle="bold" android:textSize="7sp" />
  <TextView android:id="@+id/widget_date" android:layout_width="wrap_content" android:layout_height="wrap_content" android:layout_marginTop="8dp" android:textColor="#F7F1DE" android:textStyle="bold" android:textSize="9sp" />
  <TextView android:id="@+id/widget_hijri" android:layout_width="wrap_content" android:layout_height="wrap_content" android:layout_marginTop="2dp" android:textColor="#D8C17A" android:textSize="8sp" />
  <TextView android:id="@+id/widget_next_label" android:layout_width="wrap_content" android:layout_height="wrap_content" android:layout_marginTop="12dp" android:text="NEXT PRAYER" android:textColor="#E5C76E" android:textStyle="bold" android:textSize="8sp" />
  <TextView android:id="@+id/widget_next_name" android:layout_width="wrap_content" android:layout_height="wrap_content" android:textColor="#FFFFFF" android:textStyle="bold" android:textSize="27sp" />
  <TextView android:id="@+id/widget_next_secondary" android:layout_width="wrap_content" android:layout_height="wrap_content" android:textColor="#BFD9D1" android:textSize="10sp" />
  <TextView android:id="@+id/widget_next_time" android:layout_width="wrap_content" android:layout_height="wrap_content" android:layout_marginTop="4dp" android:textColor="#FFFFFF" android:textStyle="bold" android:textSize="18sp" />
  <Chronometer android:id="@+id/widget_countdown" android:layout_width="wrap_content" android:layout_height="wrap_content" android:layout_marginTop="5dp" android:background="@drawable/hassoun_widget_countdown" android:paddingLeft="10dp" android:paddingRight="10dp" android:paddingTop="4dp" android:paddingBottom="4dp" android:textColor="#17483C" android:textStyle="bold" android:textSize="8sp" />
  <LinearLayout android:id="@+id/widget_prayer_strip" android:layout_width="match_parent" android:layout_height="wrap_content" android:layout_marginTop="12dp" android:orientation="vertical">
    <TextView android:id="@+id/widget_prayer_fajr" android:layout_width="match_parent" android:layout_height="31dp" android:gravity="center" android:background="@drawable/hassoun_widget_prayer_chip" android:textStyle="bold" android:textSize="8sp" />
    <TextView android:id="@+id/widget_prayer_dhuhr" android:layout_width="match_parent" android:layout_height="31dp" android:layout_marginTop="4dp" android:gravity="center" android:background="@drawable/hassoun_widget_prayer_chip" android:textStyle="bold" android:textSize="8sp" />
    <TextView android:id="@+id/widget_prayer_asr" android:layout_width="match_parent" android:layout_height="31dp" android:layout_marginTop="4dp" android:gravity="center" android:background="@drawable/hassoun_widget_prayer_chip" android:textStyle="bold" android:textSize="8sp" />
    <TextView android:id="@+id/widget_prayer_maghrib" android:layout_width="match_parent" android:layout_height="31dp" android:layout_marginTop="4dp" android:gravity="center" android:background="@drawable/hassoun_widget_prayer_chip" android:textStyle="bold" android:textSize="8sp" />
    <TextView android:id="@+id/widget_prayer_isha" android:layout_width="match_parent" android:layout_height="31dp" android:layout_marginTop="4dp" android:gravity="center" android:background="@drawable/hassoun_widget_prayer_chip" android:textStyle="bold" android:textSize="8sp" />
  </LinearLayout>
  <TextView android:id="@+id/widget_location" android:layout_width="wrap_content" android:layout_height="wrap_content" android:layout_marginTop="7dp" android:textColor="#AFCFC5" android:textSize="8sp" />
</LinearLayout>
'''
write('mobile/modules/hassoun-widget/android/src/main/res/layout/hassoun_prayer_widget_vertical.xml', vertical)

# Provider: richer layouts/themes and dedicated transparent provider.
p = ROOT / 'mobile/modules/hassoun-widget/android/src/main/java/ca/wopt/hassounwidget/HassounPrayerWidgetProvider.kt'
s = p.read_text()
s = replace_once(s,
'''    fun updateAll(context: Context) {
      val manager = AppWidgetManager.getInstance(context)
      val component = ComponentName(context, HassounPrayerWidgetProvider::class.java)
      manager.getAppWidgetIds(component).forEach { updateWidget(context, manager, it) }
    }

    private fun updateWidget(context: Context, manager: AppWidgetManager, appWidgetId: Int) {''',
'''    fun updateAll(context: Context) {
      val manager = AppWidgetManager.getInstance(context)
      val home = ComponentName(context, HassounPrayerWidgetProvider::class.java)
      manager.getAppWidgetIds(home).forEach { updateWidget(context, manager, it, false) }
      val lock = ComponentName(context, HassounLockScreenWidgetProvider::class.java)
      manager.getAppWidgetIds(lock).forEach { updateWidget(context, manager, it, true) }
    }

    fun updateTransparentWidget(context: Context, manager: AppWidgetManager, appWidgetId: Int) {
      updateWidget(context, manager, appWidgetId, true)
    }

    private fun updateWidget(context: Context, manager: AppWidgetManager, appWidgetId: Int, forceLockScreen: Boolean = false) {''',
'provider update helpers')
s = replace_once(s,
'      val isLockScreen = (hostCategory and AppWidgetProviderInfo.WIDGET_CATEGORY_KEYGUARD) != 0\n      val views = RemoteViews(\n        context.packageName,\n        if (isLockScreen) R.layout.hassoun_prayer_widget_lockscreen else R.layout.hassoun_prayer_widget\n      )',
'      val isLockScreen = forceLockScreen || (hostCategory and AppWidgetProviderInfo.WIDGET_CATEGORY_KEYGUARD) != 0\n      val prefs = context.getSharedPreferences(HassounWidgetStore.PREFS, Context.MODE_PRIVATE)\n      val layout = prefs.getString("layout", "full") ?: "full"\n      val views = RemoteViews(\n        context.packageName,\n        if (isLockScreen) R.layout.hassoun_prayer_widget_lockscreen\n        else if (layout == "vertical") R.layout.hassoun_prayer_widget_vertical\n        else R.layout.hassoun_prayer_widget\n      )',
'layout resource selection')
s = replace_once(s,
'      val prefs = context.getSharedPreferences(HassounWidgetStore.PREFS, Context.MODE_PRIVATE)\n      val locale = prefs.getString("locale", "en") ?: "en"\n      val layout = prefs.getString("layout", "next") ?: "next"',
'      val locale = prefs.getString("locale", "en") ?: "en"\n      val theme = prefs.getString("theme", "emerald") ?: "emerald"',
'provider prefs dedupe')
s = replace_once(s, '      bindLaunchIntent(context, views)\n      views.setTextViewText(R.id.widget_header, "HASSOUN")', '      bindLaunchIntent(context, views)\n      if (!isLockScreen) applyTheme(views, theme)\n      views.setTextViewText(R.id.widget_header, "HASSOUN")', 'apply theme')
s = replace_once(s, '        val fullLayout = isLockScreen || layout == "full"', '        val fullLayout = isLockScreen || layout == "full" || layout == "vertical"', 'full layout')
s = replace_once(s, '          bindPrayerStrip(views, next.day, locale, next.key, isLockScreen)', '          bindPrayerStrip(views, next.day, locale, next.key, isLockScreen, theme)', 'prayer theme call')
s = replace_once(s, '      val compact = !isLockScreen && layout == "compact"', '      val compact = !isLockScreen && (layout == "compact" || layout == "slim")', 'compact layout')
s = replace_once(s,
'    private fun bindPrayerStrip(views: RemoteViews, day: JSONObject, locale: String, nextKey: String, lockScreen: Boolean = false) {',
'    private fun bindPrayerStrip(views: RemoteViews, day: JSONObject, locale: String, nextKey: String, lockScreen: Boolean = false, theme: String = "emerald") {',
'bind prayer signature')
old_color = '''        views.setTextColor(
          id,
          Color.parseColor(if (active) "#F4D26F" else if (lockScreen) "#FFFFFF" else "#E7F3EF")
        )
        if (lockScreen) {
          views.setInt(
            id,
            "setBackgroundResource",
            if (active) R.drawable.hassoun_widget_lock_prayer_active else R.drawable.hassoun_widget_lock_prayer_idle
          )
        }'''
new_color = '''        val lightTheme = theme == "ivory"
        val inactive = if (lockScreen) "#FFFFFF" else if (lightTheme) "#214A40" else "#E7F3EF"
        views.setTextColor(id, Color.parseColor(if (active) "#F4D26F" else inactive))
        views.setInt(
          id,
          "setBackgroundResource",
          if (lockScreen) {
            if (active) R.drawable.hassoun_widget_lock_prayer_active else R.drawable.hassoun_widget_lock_prayer_idle
          } else if (lightTheme) {
            R.drawable.hassoun_widget_prayer_chip_light
          } else {
            R.drawable.hassoun_widget_prayer_chip
          }
        )'''
s = replace_once(s, old_color, new_color, 'prayer theme colors')
insert_before = '    private fun prayerList(day: JSONObject, locale: String): String {'
apply_theme = '''    private fun applyTheme(views: RemoteViews, theme: String) {
      val light = theme == "ivory"
      val background = when (theme) {
        "ivory" -> R.drawable.hassoun_widget_background_ivory
        "ocean" -> R.drawable.hassoun_widget_background_ocean
        "sunset" -> R.drawable.hassoun_widget_background_sunset
        "midnight" -> R.drawable.hassoun_widget_background_midnight
        else -> R.drawable.hassoun_widget_background
      }
      val primary = Color.parseColor(if (light) "#173F35" else "#FFFFFF")
      val muted = Color.parseColor(if (light) "#776B57" else "#C7DDD6")
      val accent = Color.parseColor(if (light) "#A8711D" else "#F0D27A")
      views.setInt(R.id.widget_root, "setBackgroundResource", background)
      views.setTextColor(R.id.widget_header, primary)
      views.setTextColor(R.id.widget_brand_subtitle, muted)
      views.setTextColor(R.id.widget_date, primary)
      views.setTextColor(R.id.widget_hijri, accent)
      views.setTextColor(R.id.widget_next_label, accent)
      views.setTextColor(R.id.widget_next_name, primary)
      views.setTextColor(R.id.widget_next_secondary, muted)
      views.setTextColor(R.id.widget_next_time, primary)
      views.setTextColor(R.id.widget_location, muted)
    }

'''
if apply_theme not in s:
    s = s.replace(insert_before, apply_theme + insert_before, 1)
# Add dedicated transparent provider class.
if 'class HassounLockScreenWidgetProvider' not in s:
    s += '''\n\nclass HassounLockScreenWidgetProvider : AppWidgetProvider() {\n  override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {\n    appWidgetIds.forEach { HassounPrayerWidgetProvider.updateTransparentWidget(context, appWidgetManager, it) }\n  }\n\n  override fun onAppWidgetOptionsChanged(context: Context, appWidgetManager: AppWidgetManager, appWidgetId: Int, newOptions: android.os.Bundle) {\n    HassounPrayerWidgetProvider.updateTransparentWidget(context, appWidgetManager, appWidgetId)\n  }\n\n  override fun onReceive(context: Context, intent: Intent) {\n    super.onReceive(context, intent)\n    if (intent.action == HassounWidgetStore.ACTION_REFRESH || intent.action == Intent.ACTION_BOOT_COMPLETED || intent.action == Intent.ACTION_TIME_CHANGED || intent.action == Intent.ACTION_TIMEZONE_CHANGED) {\n      HassounPrayerWidgetProvider.updateAll(context)\n    }\n  }\n}\n'''
p.write_text(s)

# Manifest: dedicated transparent provider visible to generic widget pickers / Samsung LockStar.
p = ROOT / 'mobile/modules/hassoun-widget/android/src/main/AndroidManifest.xml'
s = p.read_text()
receiver = '''    <receiver
      android:name=".HassounLockScreenWidgetProvider"
      android:enabled="true"
      android:exported="false"
      android:label="Hassoun Lock Screen — Transparent">
      <intent-filter>
        <action android:name="android.appwidget.action.APPWIDGET_UPDATE" />
        <action android:name="android.intent.action.BOOT_COMPLETED" />
        <action android:name="android.intent.action.TIME_SET" />
        <action android:name="android.intent.action.TIMEZONE_CHANGED" />
        <action android:name="ca.wopt.hassounwidget.REFRESH" />
      </intent-filter>
      <meta-data android:name="android.appwidget.provider" android:resource="@xml/hassoun_lock_widget_info" />
    </receiver>
'''
if '.HassounLockScreenWidgetProvider' not in s:
    s = s.replace('  </application>', receiver + '  </application>')
p.write_text(s)

lock_info = '''<?xml version="1.0" encoding="utf-8"?>
<appwidget-provider xmlns:android="http://schemas.android.com/apk/res/android"
  android:minWidth="180dp" android:minHeight="90dp"
  android:minResizeWidth="140dp" android:minResizeHeight="72dp"
  android:updatePeriodMillis="1800000"
  android:initialLayout="@layout/hassoun_prayer_widget_lockscreen"
  android:resizeMode="horizontal|vertical"
  android:widgetCategory="home_screen"
  android:description="@string/hassoun_widget_description" />
'''
lock_info_v36 = lock_info.replace('android:widgetCategory="home_screen"', 'android:widgetCategory="home_screen|keyguard"')
write('mobile/modules/hassoun-widget/android/src/main/res/xml/hassoun_lock_widget_info.xml', lock_info)
write('mobile/modules/hassoun-widget/android/src/main/res/xml-v36/hassoun_lock_widget_info.xml', lock_info_v36)

# Settings widget studio.
p = ROOT / 'mobile/src/SettingsHub.tsx'
s = p.read_text()
s = replace_once(s, '  Alert,\n  Linking,', '  Alert,\n  Image,\n  Linking,', 'Image import')
s = replace_once(s,
'import HassounWidget, { type HassounWidgetLayout, type HassounWidgetPreferences } from "../modules/hassoun-widget";',
'import HassounWidget, { type HassounWidgetLayout, type HassounWidgetPreferences, type HassounWidgetTheme } from "../modules/hassoun-widget";',
'widget theme import')
if 'WIDGET_THEME_META' not in s:
    s = s.replace('const PUBLIC_BASE = "https://hassoun911.github.io/WOPT";\n', '''const PUBLIC_BASE = "https://hassoun911.github.io/WOPT";\n\nconst WIDGET_THEME_META: Record<HassounWidgetTheme, { bg: string; fg: string; muted: string; accent: string; border: string }> = {\n  emerald: { bg: "#0B654F", fg: "#FFFFFF", muted: "#C7DDD6", accent: "#F0D27A", border: "#D2B25A" },\n  ivory: { bg: "#FFF7E8", fg: "#173F35", muted: "#7D725F", accent: "#B27A23", border: "#D8B875" },\n  ocean: { bg: "#3B7EAB", fg: "#FFFFFF", muted: "#D8ECF8", accent: "#F5D784", border: "#9FD1EE" },\n  sunset: { bg: "#CB8291", fg: "#FFFFFF", muted: "#F9E4E1", accent: "#FFE29C", border: "#F2C9A2" },\n  midnight: { bg: "#10294A", fg: "#FFFFFF", muted: "#CAD7E7", accent: "#F3D083", border: "#7186A2" }\n};\n''')
# Inject current theme vars inside widget page.
s = replace_once(s, '  if (page === "widgets") {\n    return (', '  if (page === "widgets") {\n    const previewTheme = WIDGET_THEME_META[widgetPrefs.theme || "emerald"];\n    const widgetLogo = require("../assets/hassoun-logo.png");\n    return (', 'widget preview vars')
start = s.index('        <Text style={styles.sectionLabel}>{t("WIDGET LAYOUT"')
end = s.index('        <Text style={styles.sectionLabel}>{t("SHOW ON WIDGET"', start)
new_widget_studio = '''        <Text style={styles.sectionLabel}>{t("WIDGET STYLE", "نمط الويدجت")}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.themeScrollContent}>
          {([
            ["emerald", t("Emerald", "زمردي")],
            ["ivory", t("Ivory", "عاجي")],
            ["ocean", t("Ocean", "أزرق")],
            ["sunset", t("Sunset", "غروب")],
            ["midnight", t("Midnight", "ليلي")]
          ] as Array<[HassounWidgetTheme, string]>).map(([theme, label]) => {
            const meta = WIDGET_THEME_META[theme];
            return (
              <Pressable key={theme} onPress={() => updateWidget({ theme })} style={[styles.themeChoice, widgetPrefs.theme === theme && styles.themeChoiceActive]}>
                <View style={[styles.themeSwatch, { backgroundColor: meta.bg, borderColor: meta.border }]}>
                  <Image source={widgetLogo} style={styles.themeLogo} resizeMode="contain" />
                  <Text style={[styles.themePrayer, { color: meta.fg }]}>Dhuhr</Text>
                  <Text style={[styles.themeTime, { color: meta.accent }]}>1:36</Text>
                </View>
                <Text style={styles.themeLabel}>{label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <Text style={styles.sectionLabel}>{t("WIDGET LAYOUT", "تصميم الويدجت")}</Text>
        <View style={styles.layoutGrid}>
          {([
            ["full", t("Large", "كبير"), t("Next prayer + all five", "الصلاة القادمة والخمس")],
            ["square", t("Square", "مربع"), t("Next prayer focus", "تركيز على القادمة")],
            ["vertical", t("Vertical", "طولي"), t("Tall prayer list", "قائمة طولية")],
            ["slim", t("Slim", "رفيع"), t("Logo + next prayer", "الشعار والصلاة القادمة")]
          ] as Array<[HassounWidgetLayout, string, string]>).map(([layout, label, note]) => (
            <Pressable key={layout} onPress={() => updateWidget({ layout })} style={[styles.layoutChoice, widgetPrefs.layout === layout && styles.layoutChoiceActive]}>
              <View style={[
                styles.layoutMock,
                layout === "full" && styles.layoutMockWide,
                layout === "square" && styles.layoutMockSquare,
                layout === "vertical" && styles.layoutMockVertical,
                layout === "slim" && styles.layoutMockSlim
              ]}><View style={styles.layoutMockLine} /></View>
              <Text style={styles.layoutTitle}>{label}</Text><Text style={styles.layoutNote}>{note}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.sectionLabel}>{t("LIVE PREVIEW", "معاينة مباشرة")}</Text>
        <View style={styles.previewStage}>
          <View style={[
            styles.widgetRichPreview,
            widgetPrefs.layout === "vertical" && styles.widgetRichPreviewVertical,
            widgetPrefs.layout === "square" && styles.widgetRichPreviewSquare,
            widgetPrefs.layout === "slim" && styles.widgetRichPreviewSlim,
            { backgroundColor: previewTheme.bg, borderColor: previewTheme.border }
          ]}>
            <View style={styles.previewHeaderRow}>
              <Image source={widgetLogo} style={styles.previewLogo} resizeMode="contain" />
              <View style={styles.previewBrandBlock}><Text style={[styles.previewBrand, { color: previewTheme.fg }]}>HASSOUN</Text><Text style={[styles.previewTiny, { color: previewTheme.muted }]}>PRAYER TIMES • WINDSOR</Text></View>
              {widgetPrefs.layout !== "slim" && <Text style={[styles.previewTiny, { color: previewTheme.muted }]}>Mon, Aug 17</Text>}
            </View>
            {widgetPrefs.layout === "slim" ? (
              <View style={styles.slimPreviewRow}><Text style={[styles.slimPrayer, { color: previewTheme.fg }]}>Dhuhr</Text><Text style={[styles.slimTime, { color: previewTheme.accent }]}>1:36 p.m.</Text><Text style={[styles.slimCountdown, { color: previewTheme.fg }]}>50:34</Text></View>
            ) : (
              <>
                <View style={styles.previewPrayerRow}><View><Text style={[styles.previewTiny, { color: previewTheme.accent }]}>NEXT PRAYER</Text><Text style={[styles.previewPrayer, { color: previewTheme.fg }]}>Dhuhr</Text><Text style={[styles.previewArabic, { color: previewTheme.muted }]}>الظهر</Text></View><View style={styles.previewTimeBlock}><Text style={[styles.previewTime, { color: previewTheme.fg }]}>1:36 p.m.</Text>{widgetPrefs.showCountdown && <Text style={[styles.previewCountdown, { color: previewTheme.accent }]}>⏳ 50:34 left</Text>}</View></View>
                {widgetPrefs.showHijri && <Text style={[styles.previewMeta, { color: previewTheme.muted }]}>Rabiʿ I 4, 1448 AH</Text>}
                {(widgetPrefs.layout === "full" || widgetPrefs.layout === "vertical") && widgetPrefs.showAllPrayers && (
                  <View style={widgetPrefs.layout === "vertical" ? styles.previewPrayerListVertical : styles.previewPrayerList}>
                    {["Fajr 5:06", "● Dhuhr 1:36", "Asr 5:26", "Maghrib 8:32", "Isha 9:55"].map((item) => <Text key={item} style={[styles.previewPrayerChip, { color: item.startsWith("●") ? previewTheme.accent : previewTheme.fg, borderColor: previewTheme.muted }]}>{item}</Text>)}
                  </View>
                )}
              </>
            )}
          </View>
        </View>
        <Text style={styles.previewHint}>{t("The preview changes immediately. After adding the widget, resize it on your Home screen to match the selected shape.", "تتغير المعاينة فوراً. بعد إضافة الويدجت غيّر حجمه على الشاشة الرئيسية ليتناسب مع الشكل المختار.")}</Text>

'''
s = s[:start] + new_widget_studio + s[end:]
# Replace lock-screen legal card with transparent preview + Samsung/LockStar instructions.
lock_start = s.index('        <LegalCard title={t("🔒 Lock-screen widget"')
lock_end = s.index('        </LegalCard>', lock_start) + len('        </LegalCard>')
new_lock = '''        <LegalCard title={t("🔒 Lock-screen widget", "🔒 ويدجت شاشة القفل") }>
          <View style={styles.lockPreview}>
            <View style={styles.lockPreviewTop}><Image source={widgetLogo} style={styles.lockPreviewLogo} resizeMode="contain" /><View><Text style={styles.lockPreviewBrand}>HASSOUN</Text><Text style={styles.lockPreviewSub}>NEXT PRAYER</Text></View><Text style={styles.lockPreviewTime}>Dhuhr  •  1:36</Text></View>
            <View style={styles.lockPrayerRow}>{["Fajr 5:06", "● Dhuhr 1:36", "Asr 5:26", "Maghrib 8:32", "Isha 9:55"].map((item) => <Text key={item} style={[styles.lockPrayerText, item.startsWith("●") && styles.lockPrayerActive]}>{item}</Text>)}</View>
          </View>
          <Text style={styles.legalText}>{t("Hassoun now includes a second widget named ‘Hassoun Lock Screen — Transparent’. It has no solid background and is designed specifically for LockStar / compatible lock-screen widget hosts.", "يتضمن Hassoun الآن ويدجت ثانياً باسم «Hassoun Lock Screen — Transparent» بدون خلفية صلبة ومصمم خصيصاً لـ LockStar وشاشات القفل المتوافقة.")}</Text>
          <Text style={styles.legalText}>{t("Samsung’s built-in Brief widget list does not show every third-party app. On Samsung, install Good Lock, open LockStar, edit the Lock screen, choose Add widget, then select Hassoun Lock Screen — Transparent.", "قائمة Brief Widgets في Samsung لا تعرض كل تطبيقات الطرف الثالث. على Samsung ثبّت Good Lock ثم افتح LockStar وعدّل شاشة القفل واختر Add widget ثم Hassoun Lock Screen — Transparent.")}</Text>
          <Pressable onPress={() => Linking.openURL("samsungapps://ProductDetail/com.samsung.android.goodlock").catch(() => Linking.openURL("https://galaxystore.samsung.com/detail/com.samsung.android.goodlock"))} style={styles.inlineButton}><Text style={styles.inlineButtonText}>Samsung Good Lock / LockStar ›</Text></Pressable>
          {widgetCapabilities.lockScreenEligible ? <Text style={styles.legalText}>{t("Your Android version also reports native lock-screen widget eligibility.", "إصدار Android لديك يعلن أيضاً دعم ويدجت شاشة القفل الأصلي.")}</Text> : null}
        </LegalCard>'''
s = s[:lock_start] + new_lock + s[lock_end:]
# Style block replacement/additions.
s = s.replace('  layoutGrid: { flexDirection: "row", gap: 7, marginBottom: 12 },\n  layoutChoice: { flex: 1, minHeight: 105,', '  themeScrollContent: { gap: 9, paddingBottom: 10 },\n  themeChoice: { width: 112, borderRadius: 18, borderWidth: 1, borderColor: "#e0ddd5", backgroundColor: "#fff", padding: 7 },\n  themeChoiceActive: { borderColor: "#0b7057", borderWidth: 2 },\n  themeSwatch: { height: 82, borderRadius: 14, borderWidth: 1, padding: 8, justifyContent: "center" },\n  themeLogo: { width: 30, height: 30, position: "absolute", top: 6, left: 6 },\n  themePrayer: { fontSize: 13, fontWeight: "900", marginTop: 22 },\n  themeTime: { fontSize: 11, fontWeight: "900", marginTop: 2 },\n  themeLabel: { color: "#264b41", fontSize: 9, fontWeight: "900", textAlign: "center", marginTop: 6 },\n  layoutGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },\n  layoutChoice: { width: "48.5%", minHeight: 110,')
s = s.replace('  layoutIcon: { color: "#0b7057", fontSize: 23, fontWeight: "900" },\n', '  layoutMock: { borderRadius: 6, borderWidth: 2, borderColor: "#0b7057", alignItems: "center", justifyContent: "center" },\n  layoutMockWide: { width: 67, height: 38 },\n  layoutMockSquare: { width: 48, height: 48 },\n  layoutMockVertical: { width: 32, height: 60 },\n  layoutMockSlim: { width: 72, height: 22 },\n  layoutMockLine: { width: "65%", height: 3, borderRadius: 2, backgroundColor: "#0b7057" },\n')
old_preview_styles = '''  widgetPreview: { backgroundColor: "#0b654f", borderRadius: 25, padding: 16, marginBottom: 14 },
  widgetPreviewBrand: { color: "#b9d8ce", fontSize: 8, fontWeight: "900", letterSpacing: 1 },
  widgetPreviewRow: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", marginTop: 6 },
  widgetPreviewPrayer: { color: "#fff", fontSize: 24, fontWeight: "900" },
  widgetPreviewTime: { color: "#fff", fontSize: 17, fontWeight: "900" },
  widgetPreviewCountdown: { color: "#e4f1ed", fontSize: 10, fontWeight: "800", textAlign: "right", marginTop: 3 },
  widgetPreviewMeta: { color: "#bedbd1", fontSize: 9, marginTop: 8 },
  widgetPreviewList: { color: "#e9f4f0", fontSize: 9, lineHeight: 15, marginTop: 7 },
'''
new_preview_styles = '''  previewStage: { alignItems: "center", marginBottom: 6 },
  widgetRichPreview: { width: "100%", minHeight: 184, borderRadius: 25, borderWidth: 1, padding: 14 },
  widgetRichPreviewSquare: { width: 250, minHeight: 250 },
  widgetRichPreviewVertical: { width: 220, minHeight: 350 },
  widgetRichPreviewSlim: { width: "100%", minHeight: 88, paddingVertical: 10 },
  previewHeaderRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  previewLogo: { width: 42, height: 42 },
  previewBrandBlock: { flex: 1 },
  previewBrand: { fontSize: 11, fontWeight: "900" },
  previewTiny: { fontSize: 7, fontWeight: "800" },
  previewPrayerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginTop: 12 },
  previewPrayer: { fontSize: 27, fontWeight: "900" },
  previewArabic: { fontSize: 10, marginTop: 1 },
  previewTimeBlock: { alignItems: "flex-end" },
  previewTime: { fontSize: 18, fontWeight: "900" },
  previewCountdown: { fontSize: 9, fontWeight: "900", marginTop: 4 },
  previewMeta: { fontSize: 8, marginTop: 6 },
  previewPrayerList: { flexDirection: "row", gap: 4, marginTop: 12 },
  previewPrayerListVertical: { gap: 5, marginTop: 12 },
  previewPrayerChip: { flex: 1, borderWidth: 1, borderRadius: 9, paddingVertical: 6, paddingHorizontal: 4, textAlign: "center", fontSize: 7, fontWeight: "900" },
  slimPreviewRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 7 },
  slimPrayer: { fontSize: 18, fontWeight: "900" },
  slimTime: { fontSize: 15, fontWeight: "900" },
  slimCountdown: { fontSize: 11, fontWeight: "900" },
  previewHint: { color: "#7e8a85", fontSize: 9, lineHeight: 14, marginBottom: 8 },
  lockPreview: { borderRadius: 18, backgroundColor: "#566A79", padding: 11, marginBottom: 5 },
  lockPreviewTop: { flexDirection: "row", alignItems: "center", gap: 7 },
  lockPreviewLogo: { width: 32, height: 32 },
  lockPreviewBrand: { color: "#F4D26F", fontSize: 9, fontWeight: "900" },
  lockPreviewSub: { color: "#fff", fontSize: 6, fontWeight: "800" },
  lockPreviewTime: { color: "#fff", fontSize: 10, fontWeight: "900", marginLeft: "auto" },
  lockPrayerRow: { flexDirection: "row", gap: 4, marginTop: 9 },
  lockPrayerText: { flex: 1, color: "#fff", borderWidth: 1, borderColor: "#55FFFFFF", borderRadius: 7, paddingVertical: 5, textAlign: "center", fontSize: 5.5, fontWeight: "900" },
  lockPrayerActive: { color: "#F4D26F", borderColor: "#F4D26F" },
'''
s = replace_once(s, old_preview_styles, new_preview_styles, 'widget preview styles')
p.write_text(s)

print('Prepared Hassoun v0.5.5 widget studio, real logo, themes, previews, and Samsung LockStar provider')
