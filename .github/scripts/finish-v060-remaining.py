from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]

def read(path: str) -> str:
    return (ROOT / path).read_text()

def write(path: str, text: str) -> None:
    (ROOT / path).write_text(text)

def replace_if(path: str, old: str, new: str) -> None:
    text = read(path)
    if new in text:
        return
    if old not in text:
        raise SystemExit(f"Expected block missing in {path}: {old[:120]!r}")
    write(path, text.replace(old, new, 1))

# ------------------------------------------------------------------
# Qur'an Radio: UI calls the compact native absolute-ayah range.
# ------------------------------------------------------------------
quran = "mobile/src/quran/QuranV3.tsx"
replace_if(
    quran,
    '''  const playFullQuranRange = (repeat = false) => {\n    const end = radioOngoing ? 114 : Math.max(radioStartSurah, radioEndSurah);\n    playQueue(buildSurahQueue(radioStartSurah, end), repeat);\n  };''',
    '''  const playFullQuranRange = (repeat = false) => {\n    if (!QuranAudio) return;\n    const start = clamp(radioStartSurah, 1, 114);\n    const end = radioOngoing ? 114 : clamp(Math.max(start, radioEndSurah), start, 114);\n    const lastAyahs = getSurahAyahs(end);\n    const lastAyah = lastAyahs[lastAyahs.length - 1];\n    if (!lastAyah) return;\n    const reciter = reciterInfo(audioPrefs.reciter);\n    const startAbsolute = absoluteIndex(start, 1) + 1;\n    const endAbsolute = absoluteIndex(end, lastAyah.ayah) + 1;\n    // Do not build thousands of JS objects or pass a multi-megabyte JSON Intent.\n    // Native foreground playback advances this compact range lazily, including on lock screen.\n    setAudioQueue([]);\n    setAudioIndex(-1);\n    setRepeatQueue(repeat);\n    completionRef.current = null;\n    QuranAudio.playRange(startAbsolute, endAbsolute, reciter.id, reciter.bitrate, ar ? reciter.ar : reciter.en, repeat, audioPrefs.speed);\n  };'''
)
replace_if(
    quran,
    '''    if (audioStatus.state === "playing") { QuranAudio?.pause(); return; }\n    if (audioStatus.state === "paused") { QuranAudio?.resume(); return; }\n    if (!activeAyah) { playSurah(position.surah, false); return; }\n    QuranAudio?.resume();''',
    '''    if (audioStatus.state === "playing") { QuranAudio?.pause(); return; }\n    if (audioStatus.state === "paused") { QuranAudio?.resume(); return; }\n    if (screen === "radio" && audioStatus.mode === "range") {\n      if (audioStatus.state === "completed") playFullQuranRange(repeatQueue);\n      else QuranAudio?.resume();\n      return;\n    }\n    if (!activeAyah) { playSurah(position.surah, false); return; }\n    QuranAudio?.resume();'''
)

# Exact Hassoun logo on the Qur'an top surfaces.
text = read(quran)
if 'import BrandMark from "../BrandMark";' not in text:
    text = text.replace('import SmartMemorize from "./SmartMemorize";', 'import SmartMemorize from "./SmartMemorize";\nimport BrandMark from "../BrandMark";')
if '<BrandMark size={36} />' not in text:
    text = text.replace('<Pressable onPress={handleBack} style={styles.iconButton}><Text style={styles.back}>{ar ? "›" : "‹"}</Text></Pressable>\n      <View style={styles.topCopy}>', '<Pressable onPress={handleBack} style={styles.iconButton}><Text style={styles.back}>{ar ? "›" : "‹"}</Text></Pressable>\n      <BrandMark size={36} />\n      <View style={styles.topCopy}>', 1)
if '<BrandMark size={42} />' not in text:
    text = text.replace('<Pressable onPress={onBackHome} style={styles.iconButton}><Text style={styles.back}>{ar ? "›" : "‹"}</Text></Pressable>\n        <View style={styles.topCopy}>', '<Pressable onPress={onBackHome} style={styles.iconButton}><Text style={styles.back}>{ar ? "›" : "‹"}</Text></Pressable>\n        <BrandMark size={42} />\n        <View style={styles.topCopy}>', 1)
write(quran, text)

# ------------------------------------------------------------------
# Exact logo on Games, Quiz, Settings and email-alert shell.
# ------------------------------------------------------------------
games = "mobile/src/QuizGamesHub.tsx"
text = read(games)
if 'import BrandMark from "./BrandMark";' not in text:
    text = text.replace('import MultiplayerGames, { type MultiplayerGameType } from "./MultiplayerGames";', 'import MultiplayerGames, { type MultiplayerGameType } from "./MultiplayerGames";\nimport BrandMark from "./BrandMark";')
if '<BrandMark size={44} />' not in text:
    text = text.replace('<View style={styles.top}><Pressable onPress={onBackHome} style={styles.back}><Text style={styles.backText}>‹</Text></Pressable><View style={styles.copy}>', '<View style={styles.top}><Pressable onPress={onBackHome} style={styles.back}><Text style={styles.backText}>‹</Text></Pressable><BrandMark size={44} /><View style={styles.copy}>')
write(games, text)

quiz = "mobile/src/IslamicQuiz.tsx"
text = read(quiz)
if 'import BrandMark from "./BrandMark";' not in text:
    text = text.replace('} from "./islamicQuiz";', '} from "./islamicQuiz";\nimport BrandMark from "./BrandMark";')
if '<BrandMark size={46} />' not in text:
    text = text.replace('<View style={styles.topRow}>\n        <View style={styles.titleWrap}>', '<View style={styles.topRow}>\n        <BrandMark size={46} />\n        <View style={styles.titleWrap}>')
write(quiz, text)

settings = "mobile/src/SettingsHub.tsx"
text = read(settings)
if 'import BrandMark from "./BrandMark";' not in text:
    text = text.replace('import { submitSupportMessage } from "./support";', 'import { submitSupportMessage } from "./support";\nimport BrandMark from "./BrandMark";')
if '<BrandMark size={50} />' not in text:
    text = text.replace('<Text style={styles.eyebrow}>⚙️ HASSOUN</Text>', '<BrandMark size={50} />\n      <Text style={styles.eyebrow}>⚙️ HASSOUN</Text>', 1)
text = text.replace('const widgetLogo = require("../assets/icon.png");', 'const widgetLogo = require("../assets/hassoun-logo.png");')
write(settings, text)

shell = "mobile/AppWithEmail.tsx"
text = read(shell)
if 'import BrandMark from "./src/BrandMark";' not in text:
    text = text.replace('import EmailSignupCard, { type EmailSignupCompletion } from "./src/EmailSignupCard";', 'import EmailSignupCard, { type EmailSignupCompletion } from "./src/EmailSignupCard";\nimport BrandMark from "./src/BrandMark";')
if '<BrandMark size={44} />' not in text:
    text = text.replace('<View style={styles.modalHeader}>\n            <View>', '<View style={styles.modalHeader}>\n            <BrandMark size={44} />\n            <View style={{ flex: 1 }}>')
write(shell, text)

# ------------------------------------------------------------------
# Widgets: force the v0.6.0 default to the central circle once, while
# retaining Circle/Pill/Minimal customization after that migration.
# ------------------------------------------------------------------
provider = "mobile/modules/hassoun-widget/android/src/main/java/ca/wopt/hassounwidget/HassounPrayerWidgetProvider.kt"
text = read(provider)
old = '      val countdownStyle = prefs.getString("countdownStyle", "circle") ?: "circle"'
new = '''      var countdownStyle = prefs.getString("countdownStyle", "circle") ?: "circle"\n      if (!prefs.getBoolean("countdownStyleV060Migrated", false)) {\n        countdownStyle = "circle"\n        prefs.edit().putString("countdownStyle", "circle").putBoolean("countdownStyleV060Migrated", true).apply()\n      }'''
if new not in text:
    if old not in text: raise SystemExit("Widget countdownStyle block missing")
    text = text.replace(old, new, 1)
text = text.replace('val timeSp = when (timeSize) { "small" -> 18f; "medium" -> 22f; "xlarge" -> 30f; else -> 26f }', 'val timeSp = when (timeSize) { "small" -> 20f; "medium" -> 25f; "xlarge" -> 35f; else -> 30f }')
old_size = 'views.setTextViewTextSize(R.id.widget_countdown, TypedValue.COMPLEX_UNIT_SP, if (countdownStyle == "circle") 12f else 9.5f)'
new_size = '''val countdownSp = if (countdownStyle != "circle") 10f else when {\n            isLockScreen -> 17f\n            layout == "slim" || layout == "compact" -> 10.5f\n            layout == "square" -> 14f\n            layout == "vertical" -> 16f\n            else -> 17f\n          }\n          views.setTextViewTextSize(R.id.widget_countdown, TypedValue.COMPLEX_UNIT_SP, countdownSp)'''
if new_size not in text:
    if old_size not in text: raise SystemExit("Widget countdown text-size block missing")
    text = text.replace(old_size, new_size, 1)
write(provider, text)

# Increase central countdown geometry in every real layout.
xml_replacements = {
  "mobile/modules/hassoun-widget/android/src/main/res/layout/hassoun_prayer_widget.xml": [
    ('android:layout_height="82dp"', 'android:layout_height="98dp"'),
    ('android:layout_width="76dp" android:layout_height="76dp"', 'android:layout_width="92dp" android:layout_height="92dp"'),
    ('android:textSize="12sp" android:maxLines="2"', 'android:textSize="17sp" android:maxLines="2"')],
  "mobile/modules/hassoun-widget/android/src/main/res/layout/hassoun_prayer_widget_lockscreen.xml": [
    ('android:layout_height="82dp"', 'android:layout_height="98dp"'),
    ('android:layout_width="76dp" android:layout_height="76dp"', 'android:layout_width="92dp" android:layout_height="92dp"'),
    ('android:textSize="12sp" android:maxLines="2"', 'android:textSize="17sp" android:maxLines="2"')],
  "mobile/modules/hassoun-widget/android/src/main/res/layout/hassoun_prayer_widget_vertical.xml": [
    ('android:layout_width="72dp" android:layout_height="72dp"', 'android:layout_width="90dp" android:layout_height="90dp"'),
    ('android:textSize="10sp" android:maxLines="2"', 'android:textSize="16sp" android:maxLines="2"')],
  "mobile/modules/hassoun-widget/android/src/main/res/layout/hassoun_prayer_widget_square.xml": [
    ('android:layout_height="68dp"', 'android:layout_height="78dp"'),
    ('android:layout_width="64dp" android:layout_height="64dp"', 'android:layout_width="74dp" android:layout_height="74dp"'),
    ('android:textSize="10sp" android:maxLines="2"', 'android:textSize="14sp" android:maxLines="2"')],
  "mobile/modules/hassoun-widget/android/src/main/res/layout/hassoun_prayer_widget_slim.xml": [
    ('android:layout_width="52dp" android:layout_height="52dp"', 'android:layout_width="58dp" android:layout_height="58dp"'),
    ('android:textSize="8sp" android:maxLines="2"', 'android:textSize="10.5sp" android:maxLines="2"')]
}
for path, replacements in xml_replacements.items():
    text = read(path)
    for old, new in replacements:
        if new in text: continue
        if old not in text: raise SystemExit(f"Widget layout block missing in {path}: {old}")
        text = text.replace(old, new, 1)
    write(path, text)

print("Finished v0.6.0 remaining source fixes: Quran Radio, branding, and widget countdown.")
