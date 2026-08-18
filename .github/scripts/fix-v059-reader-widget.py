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
        raise SystemExit(f"Missing expected block in {path}: {old[:140]!r}")
    write(path, text.replace(old, new, 1))


# -----------------------------------------------------------------------------
# Quran reader: page navigation must work from Surah, Juz, Pages, Search, etc.
# -----------------------------------------------------------------------------
replace_once(
    "mobile/src/quran/QuranV3.tsx",
    '''  const readerAtTop = useRef(true);\n  const readerAtBottom = useRef(false);\n''',
    '''  const readerAtTop = useRef(true);\n  const readerAtBottom = useRef(false);\n  const readerViewportHeight = useRef(0);\n  const readerContentHeight = useRef(0);\n'''
)

replace_once(
    "mobile/src/quran/QuranV3.tsx",
    '''  const handleVerticalTouchEnd = (event: { nativeEvent: { pageY: number } }) => {\n    if (appearance.browseMode !== "vertical") {\n      verticalGestureStartY.current = null;\n      return;\n    }\n    const start = verticalGestureStartY.current;\n    verticalGestureStartY.current = null;\n    if (start == null) return;\n    const dy = event.nativeEvent.pageY - start;\n    if (Math.abs(dy) < 60) return;\n    if (dy < 0 && readerAtBottom.current) turnReaderPage(1);\n    else if (dy > 0 && readerAtTop.current) turnReaderPage(-1);\n  };\n''',
    '''  const handleVerticalTouchEnd = (event: { nativeEvent: { pageY: number } }) => {\n    if (appearance.browseMode !== "vertical") {\n      verticalGestureStartY.current = null;\n      return;\n    }\n    const start = verticalGestureStartY.current;\n    verticalGestureStartY.current = null;\n    if (start == null) return;\n    const dy = event.nativeEvent.pageY - start;\n    if (Math.abs(dy) < 48) return;\n\n    // A Mushaf page that fits entirely inside the viewport never produces enough\n    // scroll events to mark itself as "at bottom". Treat it as both scroll edges\n    // so an upward/downward page gesture always works. This applies regardless of\n    // whether the reader was opened from Surah, Juz, Pages, Search or Bookmark.\n    const contentFits = readerContentHeight.current <= readerViewportHeight.current + 12;\n    if (dy < 0 && (readerAtBottom.current || contentFits)) turnReaderPage(1);\n    else if (dy > 0 && (readerAtTop.current || contentFits)) turnReaderPage(-1);\n  };\n'''
)

replace_once(
    "mobile/src/quran/QuranV3.tsx",
    '''            showsVerticalScrollIndicator={false}\n            scrollEventThrottle={16}\n            onTouchStart={handleVerticalTouchStart}\n            onTouchEnd={handleVerticalTouchEnd}\n            onScroll={({ nativeEvent }) => {\n              readerAtTop.current = nativeEvent.contentOffset.y <= 8;\n              readerAtBottom.current = nativeEvent.contentOffset.y + nativeEvent.layoutMeasurement.height >= nativeEvent.contentSize.height - 8;\n            }}\n''',
    '''            showsVerticalScrollIndicator={false}\n            nestedScrollEnabled\n            scrollEventThrottle={16}\n            onLayout={({ nativeEvent }) => {\n              readerViewportHeight.current = nativeEvent.layout.height;\n              readerAtBottom.current = readerContentHeight.current <= nativeEvent.layout.height + 12;\n            }}\n            onContentSizeChange={(_width, height) => {\n              readerContentHeight.current = height;\n              readerAtBottom.current = height <= readerViewportHeight.current + 12;\n            }}\n            onTouchStart={handleVerticalTouchStart}\n            onTouchEnd={handleVerticalTouchEnd}\n            onScroll={({ nativeEvent }) => {\n              readerViewportHeight.current = nativeEvent.layoutMeasurement.height;\n              readerContentHeight.current = nativeEvent.contentSize.height;\n              readerAtTop.current = nativeEvent.contentOffset.y <= 8;\n              readerAtBottom.current = nativeEvent.contentOffset.y + nativeEvent.layoutMeasurement.height >= nativeEvent.contentSize.height - 8;\n            }}\n'''
)

replace_once(
    "mobile/src/quran/QuranV3.tsx",
    '''              <QuranPageText page={page} ayahs={segment.ayahs} appearance={appearance} locale={locale} selectedKey={selectedAyah ? refKey(selectedAyah) : null} highlightedKey={audioPrefs.highlightAudio && activeAyah ? refKey(activeAyah) : null} bookmarkedKeys={bookmarks} onPressAyah={(ayah) => { setSelectedAyah((current) => current?.surah === ayah.surah && current?.ayah === ayah.ayah ? null : ayah); persistLast({ surah: ayah.surah, ayah: ayah.ayah }); }} />\n''',
    '''              <QuranPageText key={`${page}-${segment.surah}-${appearance.font}-${appearance.tajweed ? "tajweed" : "plain"}`} page={page} ayahs={segment.ayahs} appearance={appearance} locale={locale} selectedKey={selectedAyah ? refKey(selectedAyah) : null} highlightedKey={audioPrefs.highlightAudio && activeAyah ? refKey(activeAyah) : null} bookmarkedKeys={bookmarks} onPressAyah={(ayah) => { setSelectedAyah((current) => current?.surah === ayah.surah && current?.ayah === ayah.ayah ? null : ayah); persistLast({ surah: ayah.surah, ayah: ayah.ayah }); }} />\n'''
)

# -----------------------------------------------------------------------------
# Quran page font rendering: never split QCF glyph streams.
# -----------------------------------------------------------------------------
replace_once(
    "mobile/src/quran/quranRendering.tsx",
    '''  useEffect(() => {\n    let active = true;\n    setLoading(true);\n''',
    '''  useEffect(() => {\n    let active = true;\n    // Page-specific QCF fonts are not interchangeable. Clear the previous page\n    // immediately so Unicode fallback can never be drawn with the wrong page font.\n    setRemoteText({});\n    setFontFamily(undefined);\n    setLoading(true);\n'''
)

replace_once(
    "mobile/src/quran/quranRendering.tsx",
    '''      <Text style={{ color: effectiveColor, fontSize: appearance.fontSize, lineHeight, textAlign: "right", writingDirection: "rtl", fontFamily }}>\n''',
    '''      <Text allowFontScaling={false} style={{ color: effectiveColor, fontSize: appearance.fontSize, lineHeight, textAlign: "right", writingDirection: "rtl", fontFamily, includeFontPadding: false }}>\n'''
)

replace_once(
    "mobile/src/quran/quranRendering.tsx",
    '''          if ((appearance.font === "qcf-v1" || appearance.font === "qcf-v2") && raw) {\n            const decoded = decodeNumericEntities(raw).trimEnd();\n            const glyphs = Array.from(decoded);\n            const markerGlyph = glyphs.pop() ?? "";\n            const verseGlyphs = glyphs.join("");\n            return (\n              <Text key={key} onPress={() => onPressAyah(ayah)} style={[highlightStyle, { fontFamily, color: effectiveColor }]}>\n                {verseGlyphs}\n                {markerGlyph ? <Text style={{ color: "#0b8b69", fontFamily }}>{markerGlyph}</Text> : null}{bookmarked ? <Text style={{ fontFamily: undefined, fontSize: Math.max(14, appearance.fontSize * 0.52) }}> 🔖 </Text> : null}{" "}\n              </Text>\n            );\n          }\n''',
    '''          if ((appearance.font === "qcf-v1" || appearance.font === "qcf-v2") && raw) {\n            // code_v1/code_v2 are page-font glyph streams, not ordinary Arabic\n            // characters. Splitting/recoloring the final glyph corrupts shaping and\n            // ayah markers. Keep the exact verified page-font sequence intact.\n            const decoded = decodeNumericEntities(raw).trim();\n            return (\n              <Text key={key} allowFontScaling={false} onPress={() => onPressAyah(ayah)} style={[highlightStyle, { fontFamily, color: effectiveColor }]}>\n                {decoded}{bookmarked ? <Text style={{ fontFamily: undefined, fontSize: Math.max(14, appearance.fontSize * 0.52) }}> 🔖 </Text> : null}{" "}\n              </Text>\n            );\n          }\n'''
)

# -----------------------------------------------------------------------------
# Widget provider: an old lock-widget instance sitting on Home must not remain
# transparent after upgrading. Let Android host category decide.
# -----------------------------------------------------------------------------
replace_once(
    "mobile/modules/hassoun-widget/android/src/main/java/ca/wopt/hassounwidget/HassounPrayerWidgetProvider.kt",
    '''    fun updateTransparentWidget(context: Context, manager: AppWidgetManager, appWidgetId: Int) {\n      updateWidget(context, manager, appWidgetId, true)\n    }\n''',
    '''    fun updateTransparentWidget(context: Context, manager: AppWidgetManager, appWidgetId: Int) {\n      // Do not blindly force transparency. Legacy versions allowed this provider\n      // on Home screens, so existing widget IDs can survive an app upgrade. The\n      // host category now decides: Home gets the themed card; keyguard stays clear.\n      updateWidget(context, manager, appWidgetId, false)\n    }\n'''
)

replace_once(
    "mobile/modules/hassoun-widget/android/src/main/java/ca/wopt/hassounwidget/HassounPrayerWidgetProvider.kt",
    '''          views.setTextViewTextSize(R.id.widget_countdown, TypedValue.COMPLEX_UNIT_SP, if (countdownStyle == "circle") 10f else 8.5f)\n''',
    '''          views.setTextViewTextSize(R.id.widget_countdown, TypedValue.COMPLEX_UNIT_SP, if (countdownStyle == "circle") 12f else 9.5f)\n'''
)

# Large Home widget: make countdown the visual center.
replace_once(
    "mobile/modules/hassoun-widget/android/src/main/res/layout/hassoun_prayer_widget.xml",
    'android:layout_height="66dp" android:layout_marginTop="5dp" android:orientation="horizontal" android:gravity="center_vertical"',
    'android:layout_height="82dp" android:layout_marginTop="5dp" android:orientation="horizontal" android:gravity="center_vertical"'
)
replace_once(
    "mobile/modules/hassoun-widget/android/src/main/res/layout/hassoun_prayer_widget.xml",
    '<Chronometer android:id="@+id/widget_countdown" android:layout_width="64dp" android:layout_height="64dp" android:layout_marginHorizontal="5dp" android:gravity="center" android:background="@drawable/hassoun_widget_countdown_circle" android:padding="5dp" android:textColor="#17483C" android:textStyle="bold" android:textSize="10sp" android:maxLines="2" />',
    '<Chronometer android:id="@+id/widget_countdown" android:layout_width="76dp" android:layout_height="76dp" android:layout_marginHorizontal="8dp" android:gravity="center" android:background="@drawable/hassoun_widget_countdown_circle" android:padding="6dp" android:textColor="#17483C" android:textStyle="bold" android:textSize="12sp" android:maxLines="2" />'
)

# Transparent keyguard widget: next prayer left, large countdown center, Adhan right.
write("mobile/modules/hassoun-widget/android/src/main/res/drawable/hassoun_widget_lock_countdown_circle.xml", '''<?xml version="1.0" encoding="utf-8"?>\n<shape xmlns:android="http://schemas.android.com/apk/res/android" android:shape="oval">\n  <solid android:color="#55E8C85F"/>\n  <stroke android:width="2dp" android:color="#F3D36F"/>\n</shape>\n''')

write("mobile/modules/hassoun-widget/android/src/main/res/layout/hassoun_prayer_widget_lockscreen.xml", r'''<?xml version="1.0" encoding="utf-8"?>
<LinearLayout xmlns:android="http://schemas.android.com/apk/res/android"
  android:id="@+id/widget_root"
  android:layout_width="match_parent"
  android:layout_height="match_parent"
  android:orientation="vertical"
  android:gravity="center_vertical"
  android:background="@android:color/transparent"
  android:padding="8dp">

  <LinearLayout android:layout_width="match_parent" android:layout_height="wrap_content" android:orientation="horizontal" android:gravity="center_vertical">
    <ImageView android:id="@+id/widget_logo" android:layout_width="36dp" android:layout_height="36dp" android:layout_marginEnd="7dp" android:contentDescription="Hassoun" android:scaleType="fitCenter" android:src="@drawable/hassoun_widget_logo" />
    <LinearLayout android:layout_width="0dp" android:layout_height="wrap_content" android:layout_weight="1" android:orientation="vertical">
      <TextView android:id="@+id/widget_header" android:layout_width="wrap_content" android:layout_height="wrap_content" android:text="HASSOUN" android:textColor="#F4D26F" android:textStyle="bold" android:textSize="10sp" android:shadowColor="#B0000000" android:shadowDy="1" android:shadowRadius="3" />
      <TextView android:id="@+id/widget_brand_subtitle" android:layout_width="wrap_content" android:layout_height="wrap_content" android:textColor="#F2FFFFFF" android:textStyle="bold" android:textSize="7sp" android:shadowColor="#B0000000" android:shadowDy="1" android:shadowRadius="3" />
    </LinearLayout>
    <LinearLayout android:layout_width="wrap_content" android:layout_height="wrap_content" android:gravity="end" android:orientation="vertical">
      <TextView android:id="@+id/widget_date" android:layout_width="wrap_content" android:layout_height="wrap_content" android:textColor="#FFFFFF" android:textStyle="bold" android:textSize="8sp" android:shadowColor="#B0000000" android:shadowDy="1" android:shadowRadius="3" />
      <TextView android:id="@+id/widget_hijri" android:layout_width="wrap_content" android:layout_height="wrap_content" android:textColor="#F4D26F" android:textSize="8sp" android:shadowColor="#B0000000" android:shadowDy="1" android:shadowRadius="3" />
    </LinearLayout>
  </LinearLayout>

  <LinearLayout android:layout_width="match_parent" android:layout_height="82dp" android:layout_marginTop="4dp" android:orientation="horizontal" android:gravity="center_vertical">
    <LinearLayout android:layout_width="0dp" android:layout_height="wrap_content" android:layout_weight="1" android:orientation="vertical">
      <TextView android:id="@+id/widget_next_label" android:layout_width="wrap_content" android:layout_height="wrap_content" android:text="NEXT PRAYER" android:textColor="#F4D26F" android:textStyle="bold" android:textSize="7sp" android:shadowColor="#C0000000" android:shadowDy="1" android:shadowRadius="3" />
      <TextView android:id="@+id/widget_next_name" android:layout_width="wrap_content" android:layout_height="wrap_content" android:textColor="#FFFFFF" android:textStyle="bold" android:textSize="24sp" android:maxLines="1" android:shadowColor="#D0000000" android:shadowDy="1" android:shadowRadius="4" />
      <TextView android:id="@+id/widget_next_secondary" android:layout_width="wrap_content" android:layout_height="wrap_content" android:textColor="#E6FFFFFF" android:textSize="8sp" android:maxLines="1" android:shadowColor="#C0000000" android:shadowDy="1" android:shadowRadius="3" />
    </LinearLayout>

    <Chronometer android:id="@+id/widget_countdown" android:layout_width="76dp" android:layout_height="76dp" android:layout_marginHorizontal="8dp" android:gravity="center" android:padding="5dp" android:background="@drawable/hassoun_widget_lock_countdown_circle" android:textColor="#FFFFFF" android:textStyle="bold" android:textSize="12sp" android:maxLines="2" android:shadowColor="#B0000000" android:shadowDy="1" android:shadowRadius="3" />

    <LinearLayout android:layout_width="0dp" android:layout_height="wrap_content" android:layout_weight="1" android:gravity="end" android:orientation="vertical">
      <TextView android:layout_width="wrap_content" android:layout_height="wrap_content" android:text="ADHAN" android:textColor="#E6FFFFFF" android:textStyle="bold" android:textSize="6sp" android:shadowColor="#B0000000" android:shadowDy="1" android:shadowRadius="3" />
      <TextView android:id="@+id/widget_next_time" android:layout_width="wrap_content" android:layout_height="wrap_content" android:textColor="#FFFFFF" android:textStyle="bold" android:textSize="25sp" android:maxLines="1" android:shadowColor="#D0000000" android:shadowDy="1" android:shadowRadius="4" />
    </LinearLayout>
  </LinearLayout>

  <LinearLayout android:id="@+id/widget_prayer_strip" android:layout_width="match_parent" android:layout_height="wrap_content" android:layout_marginTop="5dp" android:orientation="horizontal" android:gravity="center_vertical">
    <TextView android:id="@+id/widget_prayer_fajr" android:layout_width="0dp" android:layout_height="39dp" android:layout_weight="1" android:layout_marginEnd="2dp" android:gravity="center" android:padding="2dp" android:textColor="#FFFFFF" android:textStyle="bold" android:textSize="7sp" android:maxLines="2" android:shadowColor="#B0000000" android:shadowDy="1" android:shadowRadius="2" />
    <TextView android:id="@+id/widget_prayer_dhuhr" android:layout_width="0dp" android:layout_height="39dp" android:layout_weight="1" android:layout_marginHorizontal="2dp" android:gravity="center" android:padding="2dp" android:textColor="#FFFFFF" android:textStyle="bold" android:textSize="7sp" android:maxLines="2" android:shadowColor="#B0000000" android:shadowDy="1" android:shadowRadius="2" />
    <TextView android:id="@+id/widget_prayer_asr" android:layout_width="0dp" android:layout_height="39dp" android:layout_weight="1" android:layout_marginHorizontal="2dp" android:gravity="center" android:padding="2dp" android:textColor="#FFFFFF" android:textStyle="bold" android:textSize="7sp" android:maxLines="2" android:shadowColor="#B0000000" android:shadowDy="1" android:shadowRadius="2" />
    <TextView android:id="@+id/widget_prayer_maghrib" android:layout_width="0dp" android:layout_height="39dp" android:layout_weight="1" android:layout_marginHorizontal="2dp" android:gravity="center" android:padding="2dp" android:textColor="#FFFFFF" android:textStyle="bold" android:textSize="7sp" android:maxLines="2" android:shadowColor="#B0000000" android:shadowDy="1" android:shadowRadius="2" />
    <TextView android:id="@+id/widget_prayer_isha" android:layout_width="0dp" android:layout_height="39dp" android:layout_weight="1" android:layout_marginStart="2dp" android:gravity="center" android:padding="2dp" android:textColor="#FFFFFF" android:textStyle="bold" android:textSize="7sp" android:maxLines="2" android:shadowColor="#B0000000" android:shadowDy="1" android:shadowRadius="2" />
  </LinearLayout>

  <TextView android:id="@+id/widget_location" android:layout_width="match_parent" android:layout_height="wrap_content" android:visibility="gone" android:textSize="1sp" />
</LinearLayout>
''')

# Release identity.
replace_once("mobile/app.config.ts", '  version: "0.5.8",', '  version: "0.5.9",')
replace_once("mobile/app.config.ts", '    versionCode: 30,', '    versionCode: 31,')

print("Applied Hassoun v0.5.9 Quran page navigation/rendering and widget fixes.")
