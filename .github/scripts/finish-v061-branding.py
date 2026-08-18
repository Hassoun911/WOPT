from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def read(path: str) -> str:
    return (ROOT / path).read_text()


def write(path: str, text: str) -> None:
    (ROOT / path).write_text(text)


def replace_once_if_missing(path: str, old: str, new: str, marker: str) -> None:
    text = read(path)
    if marker in text:
        return
    if old not in text:
        raise SystemExit(f"Expected branding block missing in {path}: {old[:120]!r}")
    write(path, text.replace(old, new, 1))


# Multiplayer Games: the Hassoun logo is the page brand on chooser, room setup,
# and live room screens. Game/category emoji remain content icons, not branding.
path = "mobile/src/MultiplayerGames.tsx"
text = read(path)
if 'import BrandMark from "./BrandMark";' not in text:
    text = text.replace(
        'import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";',
        'import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";\nimport BrandMark from "./BrandMark";'
    )
text = text.replace(
    '<View style={styles.header}><Pressable onPress={onBack} style={styles.back}><Text style={styles.backText}>‹</Text></Pressable><View style={styles.headerCopy}><Text style={styles.eyebrow}>🎮 HASSOUN MULTIPLAYER</Text>',
    '<View style={styles.header}><Pressable onPress={onBack} style={styles.back}><Text style={styles.backText}>‹</Text></Pressable><BrandMark size={44} /><View style={styles.headerCopy}><Text style={styles.eyebrow}>HASSOUN • MULTIPLAYER</Text>'
)
text = text.replace(
    '<View style={styles.header}><Pressable onPress={() => setGame(null)} style={styles.back}><Text style={styles.backText}>‹</Text></Pressable><View style={styles.headerCopy}><Text style={styles.eyebrow}>{meta?.icon} HASSOUN GAMES</Text>',
    '<View style={styles.header}><Pressable onPress={() => setGame(null)} style={styles.back}><Text style={styles.backText}>‹</Text></Pressable><BrandMark size={44} /><View style={styles.headerCopy}><Text style={styles.eyebrow}>HASSOUN • GAMES</Text>'
)
text = text.replace(
    '<View style={styles.roomTop}><Pressable onPress={leaveRoom} style={styles.back}><Text style={styles.backText}>‹</Text></Pressable><View style={styles.roomCodeWrap}>',
    '<View style={styles.roomTop}><Pressable onPress={leaveRoom} style={styles.back}><Text style={styles.backText}>‹</Text></Pressable><BrandMark size={40} /><View style={styles.roomCodeWrap}>'
)
write(path, text)

# Email signup: remove the made-up Arabic-letter badge and use the exact logo.
path = "mobile/src/EmailSignupCard.tsx"
text = read(path)
if 'import BrandMark from "./BrandMark";' not in text:
    text = text.replace(
        'import { detectPrayerLocation, type DetectedPrayerLocation } from "./deviceLocation";',
        'import BrandMark from "./BrandMark";\nimport { detectPrayerLocation, type DetectedPrayerLocation } from "./deviceLocation";'
    )
text = text.replace(
    '<View style={styles.decorativeRow}>\n        <View style={styles.mosqueMark}><Text style={styles.mosqueMarkText}>و</Text></View>\n        <Text style={styles.eyebrow}>{copy.eyebrow}</Text>\n      </View>',
    '<View style={styles.decorativeRow}>\n        <BrandMark size={36} />\n        <Text style={styles.eyebrow}>HASSOUN • {copy.eyebrow}</Text>\n      </View>'
)
write(path, text)

# Smart Memorize is a full-screen Qur'an experience; show the exact logo on
# both setup and active-lesson headers instead of using a prayer-bead emoji as brand.
path = "mobile/src/quran/SmartMemorize.tsx"
text = read(path)
if 'import BrandMark from "../BrandMark";' not in text:
    text = text.replace(
        'import QuranSpeech, { type QuranSpeechStatus } from "../../modules/quran-speech";',
        'import QuranSpeech, { type QuranSpeechStatus } from "../../modules/quran-speech";\nimport BrandMark from "../BrandMark";'
    )
text = text.replace(
    '<Pressable onPress={lesson ? () => setSetupOpen(false) : onBack} style={styles.roundButton}><Text style={styles.backText}>{ar ? "›" : "‹"}</Text></Pressable>\n        <View style={styles.flex}><Text style={[styles.eyebrow, ar && styles.rtl]}>📿 {t("SMART MEMORIZE", "الحفظ الذكي")}</Text>',
    '<Pressable onPress={lesson ? () => setSetupOpen(false) : onBack} style={styles.roundButton}><Text style={styles.backText}>{ar ? "›" : "‹"}</Text></Pressable>\n        <BrandMark size={40} />\n        <View style={styles.flex}><Text style={[styles.eyebrow, ar && styles.rtl]}>HASSOUN • {t("SMART MEMORIZE", "الحفظ الذكي")}</Text>'
)
text = text.replace(
    '<Pressable onPress={onBack} style={styles.roundButton}><Text style={styles.backText}>{ar ? "›" : "‹"}</Text></Pressable>\n          <View style={styles.flex}><Text style={[styles.eyebrow, ar && styles.rtl]}>📿 {t("SMART MEMORIZE", "الحفظ الذكي")}</Text>',
    '<Pressable onPress={onBack} style={styles.roundButton}><Text style={styles.backText}>{ar ? "›" : "‹"}</Text></Pressable>\n          <BrandMark size={40} />\n          <View style={styles.flex}><Text style={[styles.eyebrow, ar && styles.rtl]}>HASSOUN • {t("SMART MEMORIZE", "الحفظ الذكي")}</Text>'
)
write(path, text)

# Assertions: every full-screen mobile surface now has the real brand source.
required = {
    "mobile/App.tsx": 'hassoun-logo.png',
    "mobile/AppWithEmail.tsx": 'BrandMark',
    "mobile/src/IslamicEventsPage.tsx": 'BrandMark',
    "mobile/src/QuizGamesHub.tsx": 'BrandMark',
    "mobile/src/IslamicQuiz.tsx": 'BrandMark',
    "mobile/src/MultiplayerGames.tsx": 'BrandMark',
    "mobile/src/SettingsHub.tsx": 'BrandMark',
    "mobile/src/EmailSignupCard.tsx": 'BrandMark',
    "mobile/src/quran/QuranV3.tsx": 'BrandMark',
    "mobile/src/quran/SmartMemorize.tsx": 'BrandMark',
}
for file, marker in required.items():
    if marker not in read(file):
        raise SystemExit(f"Missing Hassoun logo branding in {file}")

print("Applied v0.6.1 exact Hassoun-logo branding across all full-screen app surfaces.")
