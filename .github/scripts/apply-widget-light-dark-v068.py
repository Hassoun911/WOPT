from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def read(rel: str) -> str:
    return (ROOT / rel).read_text(encoding="utf-8")


def write(rel: str, text: str) -> None:
    (ROOT / rel).write_text(text, encoding="utf-8")


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if new in text:
        return text
    if old not in text:
        raise RuntimeError(f"Could not find patch target: {label}")
    return text.replace(old, new, 1)


# 1) JS/TS bridge: add Light / Dark / Auto preference.
rel = "mobile/modules/hassoun-widget/index.ts"
s = read(rel)
s = replace_once(
    s,
    'export type HassounWidgetTheme = "emerald" | "ivory" | "ocean" | "sunset" | "midnight";\n',
    'export type HassounWidgetTheme = "emerald" | "ivory" | "ocean" | "sunset" | "midnight";\nexport type HassounWidgetAppearance = "light" | "dark" | "auto";\n',
    "widget appearance type",
)
s = replace_once(
    s,
    '  theme: HassounWidgetTheme;\n',
    '  theme: HassounWidgetTheme;\n  appearance: HassounWidgetAppearance;\n',
    "widget appearance preference",
)
s = replace_once(
    s,
    '  theme: "emerald",\n',
    '  theme: "emerald",\n  appearance: "auto",\n',
    "widget appearance default",
)
write(rel, s)


# 2) Native bridge: save/read appearance and refresh immediately.
rel = "mobile/modules/hassoun-widget/android/src/main/java/ca/wopt/hassounwidget/HassounWidgetModule.kt"
s = read(rel)
s = replace_once(
    s,
    '      val theme = (preferences["theme"] as? String).takeIf { it in setOf("emerald", "ivory", "ocean", "sunset", "midnight") } ?: "emerald"\n',
    '      val theme = (preferences["theme"] as? String).takeIf { it in setOf("emerald", "ivory", "ocean", "sunset", "midnight") } ?: "emerald"\n      val appearance = (preferences["appearance"] as? String).takeIf { it in setOf("light", "dark", "auto") } ?: "auto"\n',
    "native appearance parsing",
)
s = replace_once(
    s,
    '        .putString("theme", theme)\n',
    '        .putString("theme", theme)\n        .putString("appearance", appearance)\n',
    "native appearance storage",
)
s = replace_once(
    s,
    '        "theme" to (prefs.getString("theme", "emerald") ?: "emerald"),\n',
    '        "theme" to (prefs.getString("theme", "emerald") ?: "emerald"),\n        "appearance" to (prefs.getString("appearance", "auto") ?: "auto"),\n',
    "native appearance readback",
)
s = replace_once(
    s,
    '    "layout" to (if (Build.VERSION.SDK_INT >= 36) "slim" else "full"), "theme" to "emerald", "showCountdown" to true,\n',
    '    "layout" to (if (Build.VERSION.SDK_INT >= 36) "slim" else "full"), "theme" to "emerald", "appearance" to "auto", "showCountdown" to true,\n',
    "native appearance defaults",
)
write(rel, s)


# 3) Native widget renderer: follow Android in Auto and repair the large first-add path.
rel = "mobile/modules/hassoun-widget/android/src/main/java/ca/wopt/hassounwidget/HassounPrayerWidgetProvider.kt"
s = read(rel)
s = replace_once(
    s,
    'import android.content.Intent\n',
    'import android.content.Intent\nimport android.content.res.Configuration\n',
    "configuration import",
)
s = replace_once(
    s,
    '      intent.action == Intent.ACTION_TIMEZONE_CHANGED\n',
    '      intent.action == Intent.ACTION_TIMEZONE_CHANGED ||\n      intent.action == Intent.ACTION_CONFIGURATION_CHANGED\n',
    "auto theme configuration refresh",
)
old_layout = '''      val layout = if (isLockScreen) requestedLayout else providerLayout ?: when {\n        minWidth <= 0 || minHeight <= 0 -> "slim"\n        minHeight >= minWidth * 1.35 -> "vertical"\n        minWidth <= 220 && minHeight >= 150 -> "square"\n        minHeight <= 80 || minWidth >= minHeight * 3.20 -> "slim"\n        requestedLayout == "square" -> "square"\n        requestedLayout == "slim" || requestedLayout == "compact" || requestedLayout == "next" -> "slim"\n        else -> "full"\n      }\n'''
new_layout = '''      val layout = if (isLockScreen) requestedLayout else when {\n        // Samsung can invoke onUpdate before it gives the widget usable dimensions.\n        // Always use the shallow safe shell for that very first render, including\n        // the Large 4x2 provider. This prevents the launcher \"Couldn't add widget\" failure.\n        minWidth <= 0 || minHeight <= 0 -> "slim"\n        providerLayout != null -> providerLayout\n        minHeight >= minWidth * 1.35 -> "vertical"\n        minWidth <= 220 && minHeight >= 150 -> "square"\n        minHeight <= 80 || minWidth >= minHeight * 3.20 -> "slim"\n        requestedLayout == "square" -> "square"\n        requestedLayout == "slim" || requestedLayout == "compact" || requestedLayout == "next" -> "slim"\n        else -> "full"\n      }\n'''
s = replace_once(s, old_layout, new_layout, "large widget safe first render")
s = replace_once(
    s,
    '      val theme = prefs.getString("theme", "emerald") ?: "emerald"\n',
    '''      val storedTheme = prefs.getString("theme", "emerald") ?: "emerald"\n      val appearance = prefs.getString("appearance", "auto") ?: "auto"\n      val systemDark = (context.resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES\n      val theme = when (appearance) {\n        "light" -> "ivory"\n        "dark" -> "midnight"\n        "auto" -> if (systemDark) "midnight" else "ivory"\n        else -> storedTheme\n      }\n''',
    "effective light dark auto theme",
)
write(rel, s)


# 4) Android system-theme changes should refresh the widget family.
rel = "mobile/modules/hassoun-widget/android/src/main/AndroidManifest.xml"
s = read(rel)
config_action = '        <action android:name="android.intent.action.CONFIGURATION_CHANGED" />\n'
if config_action not in s:
    first_tz = '        <action android:name="android.intent.action.TIMEZONE_CHANGED" />\n'
    if first_tz not in s:
        raise RuntimeError("Could not find manifest TIMEZONE_CHANGED action")
    s = s.replace(first_tz, first_tz + config_action, 1)
write(rel, s)


# 5) Widget settings UI: replace legacy palette picker with Light/Dark/Auto.
rel = "mobile/src/SettingsHub.tsx"
s = read(rel)
s = replace_once(
    s,
    '  View\n} from "react-native";\n',
    '  View,\n  useColorScheme\n} from "react-native";\n',
    "useColorScheme import",
)
s = replace_once(
    s,
    'import HassounWidget, { type HassounWidgetCountdownStyle, type HassounWidgetFocus, type HassounWidgetLayout, type HassounWidgetPreferences, type HassounWidgetTheme, type HassounWidgetTimeSize } from "../modules/hassoun-widget";\n',
    'import HassounWidget, { type HassounWidgetAppearance, type HassounWidgetCountdownStyle, type HassounWidgetFocus, type HassounWidgetLayout, type HassounWidgetPreferences, type HassounWidgetTheme, type HassounWidgetTimeSize } from "../modules/hassoun-widget";\n',
    "appearance type import",
)
s = replace_once(
    s,
    '  const t = (en: string, arabic: string) => ar ? arabic : en;\n',
    '  const t = (en: string, arabic: string) => ar ? arabic : en;\n  const systemColorScheme = useColorScheme();\n',
    "system color scheme hook",
)
s = replace_once(
    s,
    '    const previewTheme = WIDGET_THEME_META[widgetPrefs.theme || "emerald"];\n',
    '    const effectivePreviewTheme: HassounWidgetTheme = widgetPrefs.appearance === "light" ? "ivory" : widgetPrefs.appearance === "dark" ? "midnight" : systemColorScheme === "dark" ? "midnight" : "ivory";\n    const previewTheme = WIDGET_THEME_META[effectivePreviewTheme];\n',
    "appearance-aware live preview",
)
start_marker = '        <Text style={styles.sectionLabel}>{t("WIDGET STYLE", "نمط الويدجت")}</Text>\n'
end_marker = '        <Text style={styles.sectionLabel}>{t("WIDGET LAYOUT", "تصميم الويدجت")}</Text>\n'
if 'WIDGET APPEARANCE' not in s:
    start = s.find(start_marker)
    end = s.find(end_marker, start)
    if start < 0 or end < 0:
        raise RuntimeError("Could not locate widget style block")
    appearance_block = '''        <Text style={styles.sectionLabel}>{t("WIDGET APPEARANCE", "مظهر الويدجت")}</Text>\n        <Text style={styles.layoutNote}>{t("Choose Light, Dark, or Auto. Auto follows your Android light/dark setting and refreshes the widget when the phone theme changes.", "اختر فاتح أو داكن أو تلقائي. الوضع التلقائي يتبع مظهر أندرويد ويحدّث الويدجت عند تغيير مظهر الهاتف.")}</Text>\n        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.themeScrollContent}>\n          {([\n            ["light", t("Light", "فاتح"), "#FFF9EE", "#165445", "#B27A23"],\n            ["dark", t("Dark", "داكن"), "#10294A", "#FFFFFF", "#F3D083"],\n            ["auto", t("Auto", "تلقائي"), systemColorScheme === "dark" ? "#10294A" : "#FFF9EE", systemColorScheme === "dark" ? "#FFFFFF" : "#165445", "#D2B25A"]\n          ] as Array<[HassounWidgetAppearance, string, string, string, string]>).map(([appearance, label, bg, fg, accent]) => (\n            <Pressable key={appearance} onPress={() => updateWidget({ appearance })} style={[styles.themeChoice, widgetPrefs.appearance === appearance && styles.themeChoiceActive]}>\n              <View style={[styles.themeSwatch, { backgroundColor: bg, borderColor: accent }]}>\n                <Image source={widgetLogo} style={styles.themeLogo} resizeMode="contain" />\n                <Text style={[styles.themePrayer, { color: fg }]}>Maghrib</Text>\n                <Text style={[styles.themeTime, { color: accent }]}>8:31</Text>\n              </View>\n              <Text style={styles.themeLabel}>{widgetPrefs.appearance === appearance ? `✓ ${label}` : label}</Text>\n            </Pressable>\n          ))}\n        </ScrollView>\n\n'''
    s = s[:start] + appearance_block + s[end:]

# Make the page explanation match the new behavior.
s = s.replace(
    'Choose your preferred layout, then resize the widget on your Home screen. Hassoun automatically uses the best design for the actual width and height Android gives it.',
    'Choose Light, Dark or Auto, then pick a widget size. Hassoun keeps the layout optimized for the actual size Android gives it.',
)
s = s.replace(
    'اختر التصميم المفضل ثم غيّر حجم الويدجت على الشاشة الرئيسية. يختار Hassoun تلقائياً أفضل تصميم حسب العرض والارتفاع الفعليين.',
    'اختر فاتح أو داكن أو تلقائي، ثم اختر حجم الويدجت. يحافظ Hassoun على التصميم المناسب للحجم الفعلي الذي يمنحه أندرويد.',
)
write(rel, s)


# 6) Refine the actual light and dark native backgrounds.
write(
    "mobile/modules/hassoun-widget/android/src/main/res/drawable/hassoun_widget_background_ivory.xml",
    '<?xml version="1.0" encoding="utf-8"?>\n<shape xmlns:android="http://schemas.android.com/apk/res/android" android:shape="rectangle">\n  <gradient android:angle="0" android:startColor="#FFFDF8" android:centerColor="#FFF8EA" android:endColor="#F3E8D1"/>\n  <corners android:radius="28dp"/>\n  <stroke android:width="1dp" android:color="#D8BE87"/>\n  <padding android:left="1dp" android:top="1dp" android:right="1dp" android:bottom="1dp"/>\n</shape>\n',
)
write(
    "mobile/modules/hassoun-widget/android/src/main/res/drawable/hassoun_widget_background_midnight.xml",
    '<?xml version="1.0" encoding="utf-8"?>\n<shape xmlns:android="http://schemas.android.com/apk/res/android" android:shape="rectangle">\n  <gradient android:angle="0" android:startColor="#123A4A" android:centerColor="#0B2940" android:endColor="#071526"/>\n  <corners android:radius="28dp"/>\n  <stroke android:width="1dp" android:color="#6C8EA0"/>\n  <padding android:left="1dp" android:top="1dp" android:right="1dp" android:bottom="1dp"/>\n</shape>\n',
)

print("Applied Hassoun v0.6.8 Light / Dark / Auto widget appearance + large-widget safe-add repair")
