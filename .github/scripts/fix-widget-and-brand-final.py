from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]

# Samsung widget: keep ordinary 4x2 widgets on the full renderer. Only truly
# short/wide cells use the slim renderer.
path = ROOT / "mobile/modules/hassoun-widget/android/src/main/java/ca/wopt/hassounwidget/HassounPrayerWidgetProvider.kt"
text = path.read_text()
old = '        minHeight <= 125 || minWidth >= minHeight * 2.15 -> "slim"'
new = '        minHeight <= 80 || minWidth >= minHeight * 3.20 -> "slim"'
if old in text:
    text = text.replace(old, new, 1)
elif new not in text:
    raise SystemExit("Samsung widget layout threshold block not found")

# If the launcher has not supplied useful dimensions yet, always start with the
# safe full widget. This prevents Samsung placement from switching to an unsafe
# dynamic layout before the widget exists.
old = '        minWidth <= 0 || minHeight <= 0 -> if (requestedLayout == "vertical") "slim" else requestedLayout'
new = '        minWidth <= 0 || minHeight <= 0 -> "full"'
if old in text:
    text = text.replace(old, new, 1)
elif new not in text:
    raise SystemExit("Samsung initial widget dimension fallback not found")
path.write_text(text)

# Ensure all visible full-screen surfaces use the shared exact Hassoun brand mark.
required = {
    "mobile/App.tsx": "hassoun-logo.png",
    "mobile/AppWithEmail.tsx": "BrandMark",
    "mobile/src/IslamicEventsPage.tsx": "BrandMark",
    "mobile/src/QuizGamesHub.tsx": "BrandMark",
    "mobile/src/IslamicQuiz.tsx": "BrandMark",
    "mobile/src/MultiplayerGames.tsx": "BrandMark",
    "mobile/src/SettingsHub.tsx": "BrandMark",
    "mobile/src/EmailSignupCard.tsx": "BrandMark",
    "mobile/src/quran/QuranV3.tsx": "BrandMark",
    "mobile/src/quran/SmartMemorize.tsx": "BrandMark",
}
for file, marker in required.items():
    body = (ROOT / file).read_text()
    if marker not in body:
        raise SystemExit(f"Missing Hassoun brand mark in {file}")

# Guard both Android widget definitions so newer Samsung/API-36 devices cannot
# silently fall back to the old slim initial widget.
for rel in [
    "mobile/modules/hassoun-widget/android/src/main/res/xml/hassoun_prayer_widget_info.xml",
    "mobile/modules/hassoun-widget/android/src/main/res/xml-v36/hassoun_prayer_widget_info.xml",
]:
    body = (ROOT / rel).read_text()
    if 'android:initialLayout="@layout/hassoun_prayer_widget"' not in body:
        raise SystemExit(f"Unsafe Home widget initial layout remains in {rel}")

print("Final Samsung widget placement and Hassoun page-brand guards passed.")
