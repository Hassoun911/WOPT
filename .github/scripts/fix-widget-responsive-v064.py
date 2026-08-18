from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def patch(path: str, old: str, new: str) -> None:
    p = ROOT / path
    text = p.read_text()
    if old not in text:
        raise SystemExit(f"Could not find expected block in {path}")
    p.write_text(text.replace(old, new, 1))

# 1) Render according to the actual launcher dimensions instead of blindly
# stretching the selected XML into an incompatible Samsung widget cell.
patch(
    "mobile/modules/hassoun-widget/android/src/main/java/ca/wopt/hassounwidget/HassounPrayerWidgetProvider.kt",
    '''      val prefs = context.getSharedPreferences(HassounWidgetStore.PREFS, Context.MODE_PRIVATE)\n      val layout = prefs.getString("layout", "full") ?: "full"\n      val views = RemoteViews(\n        context.packageName,\n        if (isLockScreen) R.layout.hassoun_prayer_widget_lockscreen\n        else when (layout) {\n          "vertical" -> R.layout.hassoun_prayer_widget_vertical\n          "square" -> R.layout.hassoun_prayer_widget_square\n          "slim", "compact", "next" -> R.layout.hassoun_prayer_widget_slim\n          else -> R.layout.hassoun_prayer_widget\n        }\n      )''',
    '''      val prefs = context.getSharedPreferences(HassounWidgetStore.PREFS, Context.MODE_PRIVATE)\n      val requestedLayout = prefs.getString("layout", "full") ?: "full"\n      val minWidth = widgetOptions.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 0)\n      val minHeight = widgetOptions.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, 0)\n      // Android launchers own the physical widget cell size. A selected vertical\n      // design cannot safely be forced into a wide 4x1 cell (and vice versa).\n      // Pick the renderer that matches the real host dimensions, while using the\n      // selected layout as the preference when the current shape can support it.\n      val layout = if (isLockScreen) requestedLayout else when {\n        minWidth <= 0 || minHeight <= 0 -> if (requestedLayout == "vertical") "slim" else requestedLayout\n        minHeight >= minWidth * 1.35 -> "vertical"\n        minWidth <= 220 && minHeight >= 150 -> "square"\n        minHeight <= 125 || minWidth >= minHeight * 2.15 -> "slim"\n        requestedLayout == "square" -> "square"\n        requestedLayout == "slim" || requestedLayout == "compact" || requestedLayout == "next" -> "slim"\n        else -> "full"\n      }\n      val views = RemoteViews(\n        context.packageName,\n        if (isLockScreen) R.layout.hassoun_prayer_widget_lockscreen\n        else when (layout) {\n          "vertical" -> R.layout.hassoun_prayer_widget_vertical\n          "square" -> R.layout.hassoun_prayer_widget_square\n          "slim", "compact", "next" -> R.layout.hassoun_prayer_widget_slim\n          else -> R.layout.hassoun_prayer_widget\n        }\n      )'''
)

# 2) Samsung can show only initialLayout until another app action forces an
# update. Use the successful pin callback to immediately populate the widget.
patch(
    "mobile/modules/hassoun-widget/android/src/main/java/ca/wopt/hassounwidget/HassounWidgetModule.kt",
    '''      // Samsung / Android 16 is most reliable when a newly pinned widget starts\n      // from the shallow slim RemoteViews layout. This is only the initial add.\n      // After it is on the Home screen, setPreferences() can immediately switch\n      // it to Large / Square / Vertical / Slim without being forced back here.\n      if (Build.VERSION.SDK_INT >= 36) {\n        context.getSharedPreferences(HassounWidgetStore.PREFS, Context.MODE_PRIVATE)\n          .edit().putString("layout", "slim").putBoolean("android16WidgetSafeMode", true).apply()\n      }\n      manager.requestPinAppWidget(ComponentName(context, HassounPrayerWidgetProvider::class.java), null, null)''',
    '''      // The provider metadata already uses the shallow slim initialLayout,\n      // which is the Samsung-safe shell. Do not overwrite the user's saved layout.\n      // Ask Android to send us a success broadcast after the widget is actually\n      // placed, then populate it immediately so it never remains an empty shell.\n      val refreshIntent = android.content.Intent(context, HassounPrayerWidgetProvider::class.java).apply {\n        action = HassounWidgetStore.ACTION_REFRESH\n      }\n      val successCallback = android.app.PendingIntent.getBroadcast(\n        context,\n        7610,\n        refreshIntent,\n        android.app.PendingIntent.FLAG_UPDATE_CURRENT or android.app.PendingIntent.FLAG_IMMUTABLE\n      )\n      manager.requestPinAppWidget(ComponentName(context, HassounPrayerWidgetProvider::class.java), null, successCallback)'''
)

# 3) Make layout selection obvious and explain that Android controls the actual
# cell shape, which the widget now adapts to automatically.
patch(
    "mobile/src/SettingsHub.tsx",
    '''        <Text style={styles.subtitle}>{t("Choose a default Hassoun widget layout. The same responsive widget can be resized on phones, tablets and foldables.", "اختر التصميم الافتراضي لويدجت Hassoun. يمكن تغيير حجمه على الهواتف والأجهزة اللوحية والقابلة للطي.")}</Text>''',
    '''        <Text style={styles.subtitle}>{t("Choose your preferred layout, then resize the widget on your Home screen. Hassoun automatically uses the best design for the actual width and height Android gives it.", "اختر التصميم المفضل ثم غيّر حجم الويدجت على الشاشة الرئيسية. يختار Hassoun تلقائياً أفضل تصميم حسب العرض والارتفاع الفعليين.")}</Text>'''
)

patch(
    "mobile/src/SettingsHub.tsx",
    '''            <Pressable key={layout} onPress={() => updateWidget({ layout })} style={[styles.layoutChoice, widgetPrefs.layout === layout && styles.layoutChoiceActive]}>\n              <View style={[\n                styles.layoutMock,''',
    '''            <Pressable key={layout} onPress={() => updateWidget({ layout })} style={[styles.layoutChoice, widgetPrefs.layout === layout && styles.layoutChoiceActive]}>\n              {widgetPrefs.layout === layout ? <View style={{ position: "absolute", top: 10, right: 10, zIndex: 3, backgroundColor: "#0B654F", borderRadius: 14, paddingHorizontal: 9, paddingVertical: 4 }}><Text style={{ color: "#FFFFFF", fontSize: 10, fontWeight: "900" }}>✓ {t("SELECTED", "محدد")}</Text></View> : null}\n              <View style={[\n                styles.layoutMock,'''
)

# Re-read the native preference whenever the Widget page opens so its selection
# always reflects what is actually persisted, including after app restarts.
patch(
    "mobile/src/SettingsHub.tsx",
    '''  useEffect(() => {\n    const next = { ...HassounWidget.getPreferences(), locale };\n    setWidgetPrefs(next);\n    HassounWidget.setPreferences(next);\n  }, [locale]);''',
    '''  useEffect(() => {\n    const next = { ...HassounWidget.getPreferences(), locale };\n    setWidgetPrefs(next);\n    HassounWidget.setPreferences(next);\n  }, [locale]);\n\n  useEffect(() => {\n    if (page !== "widgets") return;\n    setWidgetPrefs({ ...HassounWidget.getPreferences(), locale });\n    HassounWidget.refresh();\n  }, [page, locale]);'''
)

print("Applied responsive widget v0.6.4 repair")
