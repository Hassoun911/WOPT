from pathlib import Path
import runpy

ROOT = Path(__file__).resolve().parents[2]

# Reuse the already-hardened v0.6.1 finishing passes first.
runpy.run_path(str(ROOT / ".github/scripts/finish-v061-branding.py"), run_name="__main__")
runpy.run_path(str(ROOT / ".github/scripts/fix-v061-quran-multi-surah-play.py"), run_name="__main__")


def read(path: str) -> str:
    return (ROOT / path).read_text()


def write(path: str, text: str) -> None:
    (ROOT / path).write_text(text)

# Persistent per-prayer Adhan mute storage.
path = "mobile/src/config.ts"
text = read(path)
if 'prayerAudioMuted:' not in text:
    text = text.replace(
        '  locale: "wopt:locale:v1"\n',
        '  locale: "wopt:locale:v1",\n  prayerAudioMuted: "hassoun:prayer-audio-muted:v1"\n'
    )
write(path, text)

# Native Android Adhan scheduler reads the mute list every time the exact-alarm
# schedule is replaced. Reminder notifications are intentionally unaffected.
path = "mobile/src/prayerAudio.ts"
text = read(path)
if 'import { STORAGE_KEYS } from "./config";' not in text:
    text = text.replace(
        'import PrayerAudio from "../modules/prayer-audio";\n',
        'import PrayerAudio from "../modules/prayer-audio";\nimport { STORAGE_KEYS } from "./config";\n'
    )
old_events = '''  const events = buildPrayerEvents(prayerTimes, 30)\n    .filter((event) => event.kind === "athan")\n    .map((event) => ({\n      id: event.id,\n      prayer: event.prayer,\n      scheduledAtMs: event.scheduledAt.getTime()\n    }));'''
new_events = '''  let mutedPrayers = new Set<PrayerKey>();\n  try {\n    const saved = await AsyncStorage.getItem(STORAGE_KEYS.prayerAudioMuted);\n    const parsed = saved ? JSON.parse(saved) as unknown : [];\n    if (Array.isArray(parsed)) {\n      mutedPrayers = new Set(parsed.filter((value): value is PrayerKey =>\n        typeof value === "string" && ["fajr", "dhuhr", "asr", "maghrib", "isha"].includes(value)\n      ));\n    }\n  } catch {}\n\n  const events = buildPrayerEvents(prayerTimes, 30)\n    .filter((event) => event.kind === "athan" && !mutedPrayers.has(event.prayer))\n    .map((event) => ({\n      id: event.id,\n      prayer: event.prayer,\n      scheduledAtMs: event.scheduledAt.getTime()\n    }));'''
if 'mutedPrayers.has(event.prayer)' not in text:
    if old_events not in text:
        raise SystemExit("Expected prayer audio schedule block missing")
    text = text.replace(old_events, new_events, 1)
write(path, text)

# Home page: exact logo in the date hero, robust next-prayer rollover, readable
# final-minute countdown, and tap-any-prayer Adhan mute/unmute controls.
path = "mobile/App.tsx"
text = read(path)
text = text.replace(
    'import { openExactAlarmSettings, scheduleAndroidTestAdhan } from "./src/prayerAudio";',
    'import { openExactAlarmSettings, scheduleAndroidPrayerAudio, scheduleAndroidTestAdhan } from "./src/prayerAudio";'
)
text = text.replace(
    'import { addDateDays, formatPrayerTime, timeToMinutes, windsorDateKey, windsorLocalToDate, windsorSecondsSinceMidnight } from "./src/time";',
    'import { addDateDays, formatPrayerTime, windsorDateKey, windsorLocalToDate } from "./src/time";'
)
old_next = '''function nextPrayerFor(prayerTimes: PrayerTimes, now = new Date()) {\n  const currentKey = windsorDateKey(now);\n  const currentSeconds = windsorSecondsSinceMidnight(now);\n  for (let dayOffset = 0; dayOffset <= 7; dayOffset += 1) {\n    const dateKey = addDateDays(currentKey, dayOffset);\n    const day = prayerTimes[dateKey];\n    if (!day) continue;\n    for (const prayer of PRAYER_KEYS) {\n      const seconds = timeToMinutes(day[prayer]) * 60;\n      if (dayOffset === 0 && seconds <= currentSeconds) continue;\n      const target = windsorLocalToDate(dateKey, day[prayer]);\n      const secondsRemaining = Math.max(0, Math.floor((target.getTime() - now.getTime()) / 1000));\n      if (target.getTime() <= now.getTime()) continue;\n      return { prayer, dateKey, time: day[prayer], secondsRemaining, isTomorrow: dateKey !== currentKey };\n    }\n  }\n  return null;\n}\n\nfunction countdownLabel(seconds: number, locale: "en" | "ar") {\n  const hours = Math.floor(seconds / 3600);\n  const minutes = Math.floor((seconds % 3600) / 60);\n  return locale === "ar" ? `${hours ? `${hours} س ` : ""}${minutes} د` : `${hours ? `${hours}h ` : ""}${minutes}m`;\n}'''
new_next = '''function nextPrayerFor(prayerTimes: PrayerTimes, now = new Date()) {\n  const currentKey = windsorDateKey(now);\n  for (let dayOffset = 0; dayOffset <= 7; dayOffset += 1) {\n    const dateKey = addDateDays(currentKey, dayOffset);\n    const day = prayerTimes[dateKey];\n    if (!day) continue;\n    for (const prayer of PRAYER_KEYS) {\n      const target = windsorLocalToDate(dateKey, day[prayer]);\n      const deltaMs = target.getTime() - now.getTime();\n      if (deltaMs <= 0) continue;\n      const secondsRemaining = Math.max(1, Math.ceil(deltaMs / 1000));\n      return { prayer, dateKey, time: day[prayer], secondsRemaining, isTomorrow: dateKey !== currentKey };\n    }\n  }\n  return null;\n}\n\nfunction countdownLabel(seconds: number, locale: "en" | "ar") {\n  if (seconds < 60) return locale === "ar" ? `${Math.max(1, seconds)} ث` : `${Math.max(1, seconds)}s`;\n  const hours = Math.floor(seconds / 3600);\n  const minutes = Math.floor((seconds % 3600) / 60);\n  return locale === "ar" ? `${hours ? `${hours} س ` : ""}${minutes} د` : `${hours ? `${hours}h ` : ""}${minutes}m`;\n}'''
if 'const deltaMs = target.getTime() - now.getTime();' not in text:
    if old_next not in text:
        raise SystemExit("Expected nextPrayerFor block missing")
    text = text.replace(old_next, new_next, 1)

if 'const [mutedPrayerAudio, setMutedPrayerAudio]' not in text:
    text = text.replace(
        '  const [quizStats, setQuizStats] = useState<QuizStats>(EMPTY_QUIZ_STATS);\n',
        '  const [quizStats, setQuizStats] = useState<QuizStats>(EMPTY_QUIZ_STATS);\n  const [mutedPrayerAudio, setMutedPrayerAudio] = useState<PrayerKey[]>([]);\n'
    )

old_load = '''      const [savedLocale, savedAlerts, loaded, storedQuizStats] = await Promise.all([\n        AsyncStorage.getItem(STORAGE_KEYS.locale),\n        AsyncStorage.getItem(STORAGE_KEYS.alertsEnabled),\n        loadPrayerTimes(),\n        loadQuizStats()\n      ]);'''
new_load = '''      const [savedLocale, savedAlerts, savedMutedPrayerAudio, loaded, storedQuizStats] = await Promise.all([\n        AsyncStorage.getItem(STORAGE_KEYS.locale),\n        AsyncStorage.getItem(STORAGE_KEYS.alertsEnabled),\n        AsyncStorage.getItem(STORAGE_KEYS.prayerAudioMuted),\n        loadPrayerTimes(),\n        loadQuizStats()\n      ]);'''
if 'savedMutedPrayerAudio' not in text:
    if old_load not in text:
        raise SystemExit("Expected App startup Promise.all block missing")
    text = text.replace(old_load, new_load, 1)
    text = text.replace(
        '      setQuizStats(storedQuizStats);\n      setBusy(false);\n',
        '      setQuizStats(storedQuizStats);\n      try {\n        const parsedMuted = savedMutedPrayerAudio ? JSON.parse(savedMutedPrayerAudio) as unknown : [];\n        if (Array.isArray(parsedMuted)) setMutedPrayerAudio(parsedMuted.filter((value): value is PrayerKey => typeof value === "string" && PRAYER_KEYS.includes(value as PrayerKey)));\n      } catch {}\n      setBusy(false);\n',
        1
    )

if 'const togglePrayerAudio = async (prayer: PrayerKey)' not in text:
    anchor = '  const testNotification = async () => {\n'
    fn = '''  const togglePrayerAudio = async (prayer: PrayerKey) => {\n    const currentlyMuted = mutedPrayerAudio.includes(prayer);\n    const nextMuted = currentlyMuted\n      ? mutedPrayerAudio.filter((item) => item !== prayer)\n      : [...mutedPrayerAudio, prayer];\n    setMutedPrayerAudio(nextMuted);\n    await AsyncStorage.setItem(STORAGE_KEYS.prayerAudioMuted, JSON.stringify(nextMuted));\n    if (alertsEnabled && Object.keys(prayerTimes).length) {\n      await scheduleAndroidPrayerAudio(prayerTimes).catch(() => undefined);\n    }\n  };\n\n'''
    if anchor not in text:
        raise SystemExit("Could not insert prayer mute function")
    text = text.replace(anchor, fn + anchor, 1)

text = text.replace(
    '<View style={styles.dateHero}><View style={styles.dateCopy}><Text style={styles.datePrimary}>{shortDate}</Text>{hijriDate ? <Text style={styles.dateHijri}>🌙 {hijriDate}</Text> : null}<View style={styles.syncRow}><View style={[styles.syncDot, !live && styles.syncDotSaved]} /><Text style={styles.syncText}>{live ? (locale === "ar" ? "متزامن عبر Hassoun" : "Synced by Hassoun") : (locale === "ar" ? "الجدول الرسمي محفوظ" : "Saved official schedule")}</Text></View></View><View style={styles.mosqueScene}><Text style={styles.sceneSun}>☀️</Text><Text style={styles.sceneMosque}>🕌</Text></View></View>',
    '<View style={styles.dateHero}><View style={styles.dateCopy}><Text style={styles.datePrimary}>{shortDate}</Text>{hijriDate ? <Text style={styles.dateHijri}>🌙 {hijriDate}</Text> : null}<View style={styles.syncRow}><View style={[styles.syncDot, !live && styles.syncDotSaved]} /><Text style={styles.syncText}>{live ? (locale === "ar" ? "متزامن عبر Hassoun" : "Synced by Hassoun") : (locale === "ar" ? "الجدول الرسمي محفوظ" : "Saved official schedule")}</Text></View></View><View style={styles.heroLogoShell}><Image source={require("./assets/hassoun-logo.png")} resizeMode="contain" style={styles.heroLogo} /></View></View>'
)

old_schedule = '''      <View style={styles.sectionHeadingRow}><Text style={styles.sectionTitle}>{locale === "ar" ? "جدول اليوم" : "Today’s Schedule"}</Text><Text style={styles.sectionMeta}>🕋 {locale === "ar" ? "٥ صلوات" : "5 prayers"}</Text></View>\n      <View style={styles.prayerList}>{today ? PRAYER_KEYS.map((prayer) => { const active = next?.prayer === prayer; return <View key={prayer} style={[styles.prayerRow, active && styles.prayerRowActive]}><View style={[styles.prayerIconWrap, active && styles.prayerIconWrapActive]}><Text style={styles.prayerIcon}>{PRAYER_ICONS[prayer]}</Text></View><View style={styles.prayerNameBlock}><Text style={[styles.prayerName, active && styles.prayerActiveText]}>{NAMES[prayer][locale]}</Text><View style={styles.prayerSubRow}><Text style={[styles.prayerOtherName, active && styles.prayerActiveMuted]}>{NAMES[prayer][locale === "en" ? "ar" : "en"]}</Text>{active && next?.isTomorrow ? <Text style={styles.tomorrowTag}>{locale === "ar" ? "غداً" : "Tomorrow"}</Text> : null}</View></View><Text style={[styles.prayerTime, active && styles.prayerActiveText]}>{formatPrayerTime(active && next?.isTomorrow ? next.time : today[prayer], locale)}</Text></View>; }) : <Text style={styles.emptyText}>No prayer schedule is available for {todayKey}.</Text>}</View>'''
new_schedule = '''      <View style={styles.sectionHeadingRow}><View><Text style={styles.sectionTitle}>{locale === "ar" ? "جدول اليوم" : "Today’s Schedule"}</Text><Text style={styles.sectionHint}>{locale === "ar" ? "اضغط على أي صلاة لكتم أو تشغيل صوت الأذان" : "Tap any prayer to mute or unmute its Adhan audio"}</Text></View><Text style={styles.sectionMeta}>{locale === "ar" ? "٥ صلوات" : "5 prayers"}</Text></View>\n      <View style={styles.prayerList}>{today ? PRAYER_KEYS.map((prayer) => { const active = next?.prayer === prayer; const muted = mutedPrayerAudio.includes(prayer); return <Pressable accessibilityRole="button" accessibilityLabel={`${NAMES[prayer].en} ${muted ? "Adhan muted" : "Adhan on"}`} onPress={() => void togglePrayerAudio(prayer)} key={prayer} style={({ pressed }) => [styles.prayerRow, active && styles.prayerRowActive, muted && styles.prayerRowMuted, pressed && styles.prayerRowPressed]}><View style={[styles.prayerIconWrap, active && styles.prayerIconWrapActive]}><Text style={styles.prayerIcon}>{PRAYER_ICONS[prayer]}</Text></View><View style={styles.prayerNameBlock}><Text style={[styles.prayerName, active && styles.prayerActiveText]}>{NAMES[prayer][locale]}</Text><View style={styles.prayerSubRow}><Text style={[styles.prayerOtherName, active && styles.prayerActiveMuted]}>{NAMES[prayer][locale === "en" ? "ar" : "en"]}</Text>{active && next?.isTomorrow ? <Text style={styles.tomorrowTag}>{locale === "ar" ? "غداً" : "Tomorrow"}</Text> : null}</View></View><View style={styles.prayerRight}><View style={[styles.audioPill, muted && styles.audioPillMuted]}><Text style={[styles.audioPillText, muted && styles.audioPillTextMuted]}>{muted ? (locale === "ar" ? "مكتوم" : "MUTED") : (locale === "ar" ? "الأذان يعمل" : "ADHAN ON")}</Text></View><Text style={[styles.prayerTime, active && styles.prayerActiveText]}>{formatPrayerTime(active && next?.isTomorrow ? next.time : today[prayer], locale)}</Text></View></Pressable>; }) : <Text style={styles.emptyText}>No prayer schedule is available for {todayKey}.</Text>}</View>'''
if 'Tap any prayer to mute or unmute its Adhan audio' not in text:
    if old_schedule not in text:
        raise SystemExit("Expected Home prayer schedule block missing")
    text = text.replace(old_schedule, new_schedule, 1)

# Replace the decorative mosque/sun styles with the exact Hassoun logo shell.
text = text.replace(
    'mosqueScene: { width: 122, alignItems: "center", justifyContent: "center", position: "relative" }, sceneSun: { position: "absolute", top: -18, right: 4, fontSize: 26, opacity: 0.8 }, sceneMosque: { fontSize: 70 },',
    'heroLogoShell: { width: 112, height: 96, borderRadius: 26, backgroundColor: "#003d33", alignItems: "center", justifyContent: "center", overflow: "hidden" }, heroLogo: { width: 96, height: 96 },'
)
text = text.replace(
    'sectionHeadingRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 23, marginBottom: 10 }, sectionTitle: { color: "#173f35", fontSize: 19, fontWeight: "900" }, sectionMeta: { color: "#77837e", fontSize: 10, fontWeight: "700" },',
    'sectionHeadingRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 23, marginBottom: 10 }, sectionTitle: { color: "#173f35", fontSize: 19, fontWeight: "900" }, sectionHint: { color: "#7d8984", fontSize: 8, marginTop: 3, maxWidth: 260 }, sectionMeta: { color: "#77837e", fontSize: 10, fontWeight: "700" },'
)
if 'prayerRowMuted:' not in text:
    text = text.replace(
        'prayerRowActive: { backgroundColor: "#dff2e9", borderLeftWidth: 4, borderLeftColor: "#0b654f" },',
        'prayerRowActive: { backgroundColor: "#dff2e9", borderLeftWidth: 4, borderLeftColor: "#0b654f" }, prayerRowMuted: { backgroundColor: "#f5f1e9" }, prayerRowPressed: { opacity: .72 },'
    )
if 'audioPill:' not in text:
    text = text.replace(
        'prayerTime: { color: "#173f35", fontSize: 15, fontWeight: "900" },',
        'prayerRight: { alignItems: "flex-end", gap: 4 }, audioPill: { minWidth: 62, borderRadius: 99, backgroundColor: "#e5f2ec", paddingHorizontal: 7, paddingVertical: 3, alignItems: "center" }, audioPillMuted: { backgroundColor: "#eee5d9" }, audioPillText: { color: "#0b654f", fontSize: 5.8, fontWeight: "900", letterSpacing: .4 }, audioPillTextMuted: { color: "#8b6f59" }, prayerTime: { color: "#173f35", fontSize: 15, fontWeight: "900" },'
    )
write(path, text)

# Final hard assertions.
checks = {
    "mobile/App.tsx": [
        'Tap any prayer to mute or unmute its Adhan audio',
        'togglePrayerAudio',
        'STORAGE_KEYS.prayerAudioMuted',
        'heroLogoShell',
        'const deltaMs = target.getTime() - now.getTime();',
    ],
    "mobile/src/prayerAudio.ts": ['mutedPrayers.has(event.prayer)'],
    "mobile/src/config.ts": ['prayerAudioMuted'],
    "mobile/src/quran/QuranV3.tsx": ['MULTI_SURAH_PLAY_CHOOSER_V061', 'Which Surah do you want to play?'],
    "mobile/modules/hassoun-widget/android/src/main/java/ca/wopt/hassounwidget/HassounPrayerWidgetProvider.kt": ['countdownStyleV061Migrated', 'getAppWidgetIds(lock).forEach { updateWidget(context, manager, it, false) }'],
}
for file, markers in checks.items():
    value = read(file)
    for marker in markers:
        if marker not in value:
            raise SystemExit(f"Missing v0.6.2 requirement in {file}: {marker}")

print("Applied Hassoun v0.6.2 final fixes: widget recovery, events/branding, multi-Surah chooser, Home Adhan mute controls, and next-prayer rollover.")
