from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PRAYER = ROOT / "mobile/src/prayerData.ts"
CALC = ROOT / "mobile/src/PrayerCalculationSettingsPage.tsx"
MOSQUES = ROOT / "mobile/src/NearbyMosquesPage.tsx"
HOME = ROOT / "mobile/src/HomePrayerPage.tsx"

# -----------------------------------------------------------------------------
# 1) Prayer times are ALWAYS driven by GPS.
#    - Windsor GPS + today's bundled official data => Windsor official schedule.
#    - Otherwise => calculate/fetch from the phone GPS coordinates.
#    - Selecting a mosque never changes the prayer calculation coordinates.
# -----------------------------------------------------------------------------
prayer = PRAYER.read_text(encoding="utf-8")

if 'function dateKeyInZone(timeZone: string)' not in prayer:
    anchor = '''function localDateKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}
'''
    helper = '''
function dateKeyInZone(timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());
  const values: Record<string, string> = {};
  for (const part of parts) values[part.type] = part.value;
  return `${values.year}-${values.month}-${values.day}`;
}
'''
    if anchor not in prayer:
        raise SystemExit("localDateKey anchor missing")
    prayer = prayer.replace(anchor, anchor + helper, 1)

prayer = prayer.replace(
    '  const selected = preferences.locationMode === "mosque" ? preferences.selectedMosque : null;\n',
    '  // Mosque selection is discovery/navigation only. Prayer times always follow the phone GPS.\n',
    1,
)

old_catch = '''  } catch (error) {
    if (!selected) {
      if (force && !saved) throw error;
      return fallback;
    }
  }

  if (!position && !selected) return fallback;

  // GPS is the default prayer-location source. An explicitly selected mosque is
  // the only user override, and it contributes its exact coordinates.
  const latitude = selected ? selected.latitude : position!.coords.latitude;
  const longitude = selected ? selected.longitude : position!.coords.longitude;
  const nearWindsor = isNearWindsor(latitude, longitude);
  const shouldUseOfficialWindsor = nearWindsor && preferences.scheduleSource !== "calculated";
'''
new_catch = '''  } catch (error) {
    if (force && !saved) throw error;
    return fallback;
  }

  if (!position) return fallback;

  // HASSOUN_GPS_ONLY_PRAYER_SOURCE_V1
  // The mosque directory is informational only. The phone GPS decides Windsor
  // versus calculated prayer times and is the only coordinate source here.
  const latitude = position.coords.latitude;
  const longitude = position.coords.longitude;
  const nearWindsor = isNearWindsor(latitude, longitude);
  const windsorDateKey = dateKeyInZone(WINDSOR_TIME_ZONE);
  const officialWindsorAvailable = Boolean((bundledSchedule as PrayerFile).prayer_times[windsorDateKey]);
  const shouldUseOfficialWindsor = nearWindsor && officialWindsorAvailable;
'''
if old_catch in prayer:
    prayer = prayer.replace(old_catch, new_catch, 1)
elif 'HASSOUN_GPS_ONLY_PRAYER_SOURCE_V1' not in prayer:
    raise SystemExit("Could not convert mosque coordinate override to GPS-only prayer source")

prayer = prayer.replace('        label: selected?.name || CITY_LABEL,', '        label: CITY_LABEL,', 1)
prayer = prayer.replace('  const localLabel = selected?.name || fastLocationLabel(latitude, longitude, saved);', '  const localLabel = fastLocationLabel(latitude, longitude, saved);', 1)
prayer = prayer.replace('      selected ? Promise.resolve(selected.name) : resolveCity(latitude, longitude)', '      resolveCity(latitude, longitude)', 1)

if 'selected ? selected.latitude' in prayer or 'selected ? selected.longitude' in prayer:
    raise SystemExit("Mosque coordinates are still influencing prayer calculations")

PRAYER.write_text(prayer, encoding="utf-8")

# -----------------------------------------------------------------------------
# 2) Prayer Calculation UI: source selection is automatic by GPS.
#    Keep calculation method controls for locations where calculation is needed,
#    but remove the misleading manual source choices.
# -----------------------------------------------------------------------------
calc = CALC.read_text(encoding="utf-8")
calc = calc.replace('  type PrayerCalculationPreferences,\n  type PrayerScheduleSource\n', '  type PrayerCalculationPreferences\n', 1)
calc = calc.replace(
    '  const officialActive = savedSource === "windsor_islamic_association" && prefs.scheduleSource !== "calculated";',
    '  const officialActive = savedSource === "windsor_islamic_association";',
    1,
)
calc = calc.replace('  const setSource = (scheduleSource: PrayerScheduleSource) => setPrefs((p) => ({ ...p, scheduleSource }));\n\n', '', 1)

source_cards = '''      <Text style={styles.sectionLabel}>{t("PRAYER TIME SOURCE", "مصدر مواقيت الصلاة")}</Text>
      <SourceCard active={prefs.scheduleSource === "smart"} onPress={() => setSource("smart")} title={t("Smart Automatic", "تلقائي ذكي")} body={t("Use a trusted official local schedule when Hassoun has one; otherwise calculate from your GPS location.", "استخدم جدولاً محلياً رسمياً موثوقاً عند توفره، وإلا احسب المواقيت من موقع GPS.")} />
      <SourceCard active={prefs.scheduleSource === "official"} onPress={() => setSource("official")} title={t("Official Local Mosque Schedule", "الجدول الرسمي للمسجد المحلي")} body={t("Prefer a trusted official schedule when one is available for your location.", "فضّل الجدول الرسمي الموثوق عند توفره لموقعك.")} />
      <SourceCard active={prefs.scheduleSource === "calculated"} onPress={() => setSource("calculated")} title={t("Calculated Prayer Times", "مواقيت محسوبة")} body={t("Always use GPS + your method, Asr school, high-latitude rule and minute tuning.", "استخدم دائماً GPS مع الطريقة ومذهب العصر وقاعدة خطوط العرض وضبط الدقائق.")} />
'''
auto_source = '''      <Text style={styles.sectionLabel}>{t("PRAYER TIME SOURCE", "مصدر مواقيت الصلاة")}</Text>
      <View style={styles.notice}>
        <Text style={styles.noticeTitle}>{t("Automatic by GPS", "تلقائي حسب GPS")}</Text>
        <Text style={styles.noticeText}>{t(
          "Hassoun always uses your phone GPS. In Windsor, official Hassoun/Windsor data is used when available for today. Everywhere else — or if Windsor data is unavailable — prayer times are calculated from GPS. Choosing a mosque never changes prayer times.",
          "يستخدم حسون دائماً موقع GPS للهاتف. في وندسور تُستخدم بيانات حسون/وندسور الرسمية عند توفرها لليوم. في أي مكان آخر، أو إذا لم تتوفر بيانات وندسور، تُحسب المواقيت من GPS. اختيار مسجد لا يغيّر مواقيت الصلاة."
        )}</Text>
      </View>
'''
if source_cards in calc:
    calc = calc.replace(source_cards, auto_source, 1)
elif 'Automatic by GPS' not in calc:
    raise SystemExit("Prayer source cards anchor missing")

calc = calc.replace(
    '          <Pressable style={styles.linkButton} onPress={() => setSource("calculated")}><Text style={styles.linkButtonText}>{t("Use calculated times instead", "استخدم المواقيت المحسوبة بدلاً من ذلك")}</Text></Pressable>\n',
    '',
    1,
)
calc = calc.replace(
    '"The official mosque timetable controls the five prayer times. Calculation options below do not alter that timetable."',
    '"Your GPS is in Windsor and official Windsor data is available today, so the official timetable is active. Mosque selection does not affect this."',
    1,
)
calc = calc.replace(
    '"Your calculation profile controls the prayer schedule and is synced to supported Hassoun displays."',
    '"Your GPS is outside the official Windsor data path, so the calculation profile below is applied to your GPS location."',
    1,
)
calc = calc.replace(
    '"Why this time? Hassoun shows the active source on this page. When calculated times are active, the method, Asr school, high-latitude rule and tuning above are the values used by the calculation request."',
    '"Prayer source is automatic by GPS. Mosque choices are for finding, saving and navigating to mosques only; they never change the prayer calculation."',
    1,
)
CALC.write_text(calc, encoding="utf-8")

# -----------------------------------------------------------------------------
# 3) Mosques Near Me is explicitly directory/navigation only.
# -----------------------------------------------------------------------------
mosques = MOSQUES.read_text(encoding="utf-8")
mosques = mosques.replace(
    'Choose where Hassoun should anchor your prayer times.',
    'Find, save and navigate to nearby mosques. Prayer times always stay based on your phone GPS.',
    1,
)
mosques = mosques.replace(
    'GPS remains the default. If you select a mosque, Hassoun uses a trusted official timetable when one is available; otherwise it calculates from that mosque’s exact coordinates. Windsor official data is only used for Windsor-area coordinates.',
    'Mosques are shown for location, distance and directions only. Selecting a mosque never changes the prayer-time calculation. Hassoun always decides prayer times from your phone GPS.',
    1,
)
mosques = mosques.replace(
    'Current prayer-location source',
    'Prayer times always use phone GPS',
    1,
)
mosques = mosques.replace(
    'Switch back to automatic location',
    'Clear the selected mosque',
    1,
)
mosques = mosques.replace(
    'Using mosque location: ${prefs.selectedMosque.name}. Tap to change.',
    'Selected mosque: ${prefs.selectedMosque.name}. Prayer times still use GPS. Tap to change.',
    1,
)
mosques = mosques.replace(
    'GPS is the default. Tap to see nearby mosques and optionally use one as your prayer-location source.',
    'Prayer times always follow GPS. Tap to find and select a nearby mosque for location and directions.',
    1,
)
MOSQUES.write_text(mosques, encoding="utf-8")

# -----------------------------------------------------------------------------
# 4) Move nearest mosque card to the BOTTOM of Home. Add animated driving car,
#    mosque name + distance, and a copy/action icon with Maps or Copy popup.
# -----------------------------------------------------------------------------
home = HOME.read_text(encoding="utf-8")
home = home.replace('import { useEffect, useMemo, useState } from "react";', 'import { useEffect, useMemo, useRef, useState } from "react";', 1)
home = home.replace('import {\n  ActivityIndicator,', 'import {\n  ActivityIndicator,\n  Alert,\n  Animated,', 1)
home = home.replace('  Image,\n  Pressable,', '  Image,\n  Linking,\n  Pressable,', 1)
if 'import * as Clipboard from "expo-clipboard";' not in home:
    home = home.replace('import type { PrayerAlertPreferences } from "./alertPreferences";\n', 'import * as Clipboard from "expo-clipboard";\nimport type { PrayerAlertPreferences } from "./alertPreferences";\n', 1)

state_block = '''  const [nearestMosqueEnabled, setNearestMosqueEnabled] = useState(false);
  const [nearestMosque, setNearestMosque] = useState<MosqueRow | null>(null);
  const [nearestMosqueState, setNearestMosqueState] = useState<"idle" | "loading" | "empty" | "error">("idle");'''
if state_block in home and 'const nearestMosqueCarX = useRef' not in home:
    home = home.replace(state_block, state_block + '\n  const nearestMosqueCarX = useRef(new Animated.Value(0)).current;', 1)

first_effect = '''  useEffect(() => {
    let alive = true;
    void loadShowNearestMosqueOnHome().then((enabled) => { if (alive) setNearestMosqueEnabled(enabled); });'''
if first_effect in home and 'HASSOUN_NEAREST_MOSQUE_CAR_ANIMATION_V1' not in home:
    animation = '''  // HASSOUN_NEAREST_MOSQUE_CAR_ANIMATION_V1
  useEffect(() => {
    if (!nearestMosqueEnabled) {
      nearestMosqueCarX.setValue(0);
      return;
    }
    const drive = Animated.loop(Animated.sequence([
      Animated.timing(nearestMosqueCarX, { toValue: 9, duration: 850, useNativeDriver: true }),
      Animated.timing(nearestMosqueCarX, { toValue: 0, duration: 850, useNativeDriver: true })
    ]));
    drive.start();
    return () => drive.stop();
  }, [nearestMosqueEnabled, nearestMosqueCarX]);

'''
    home = home.replace(first_effect, animation + first_effect, 1)

submit_anchor = '  const submitPrayerEmail = async () => {'
if submit_anchor in home and 'const openNearestMosqueActions' not in home:
    actions = '''  const openNearestMosqueActions = () => {
    if (!nearestMosque) return;
    const distance = mosqueDistanceLabel(nearestMosque.distanceKm, locale);
    const copyValue = `${nearestMosque.name}\n${nearestMosque.displayName}\n${distance}`;
    const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${nearestMosque.latitude},${nearestMosque.longitude}`;
    Alert.alert(
      nearestMosque.name,
      distance,
      [
        { text: locale === "ar" ? "فتح في الخرائط" : "Open with Maps", onPress: () => { void Linking.openURL(mapsUrl); } },
        { text: locale === "ar" ? "نسخ" : "Copy", onPress: () => { void Clipboard.setStringAsync(copyValue); } },
        { text: locale === "ar" ? "إلغاء" : "Cancel", style: "cancel" }
      ]
    );
  };

'''
    home = home.replace(submit_anchor, actions + submit_anchor, 1)

# Remove the old near-top card inserted by v1.0.41.
card_start = home.find('      {nearestMosqueEnabled ? (')
next_prayer_anchor = '\n\n      {next ? ('
if card_start >= 0:
    card_end = home.find(next_prayer_anchor, card_start)
    if card_end >= 0:
        home = home[:card_start] + home[card_end + 2:]

footer_anchor = '      <Text style={styles.footer}>{context?.location.source === "windsor_islamic_association" ? "Official Windsor Islamic Association schedule" : context?.location.source === "aladhan" ? "AlAdhan calculation using device location" : "Saved prayer schedule"}</Text>'
if footer_anchor not in home:
    raise SystemExit("Home footer anchor missing")
if 'HASSOUN_BOTTOM_NEAREST_MOSQUE_CARD_V1' not in home:
    bottom_card = '''      {/* HASSOUN_BOTTOM_NEAREST_MOSQUE_CARD_V1 */}
      {nearestMosqueEnabled ? (
        <View style={styles.nearestMosqueCard}>
          <Animated.View style={[styles.nearestMosqueIcon, { transform: [{ translateX: nearestMosqueCarX }] }]}>
            <Text style={styles.nearestMosqueEmoji}>🚗</Text>
          </Animated.View>
          <View style={styles.nearestMosqueCopy}>
            <Text style={styles.nearestMosqueEyebrow}>{locale === "ar" ? "أقرب مسجد" : "NEAREST MOSQUE"}</Text>
            <Text numberOfLines={1} style={styles.nearestMosqueName}>
              {nearestMosque
                ? nearestMosque.name
                : nearestMosqueState === "loading"
                  ? (locale === "ar" ? "جارٍ البحث عن أقرب مسجد…" : "Finding the nearest mosque…")
                  : nearestMosqueState === "error"
                    ? (locale === "ar" ? "دليل المساجد غير متاح مؤقتاً" : "Mosque directory temporarily unavailable")
                    : (locale === "ar" ? "لم يتم العثور على مسجد قريب" : "No nearby mosque found")}
            </Text>
            <Text style={styles.nearestMosqueDistance}>
              {nearestMosque ? `🚗 ${mosqueDistanceLabel(nearestMosque.distanceKm, locale)}` : (locale === "ar" ? "يُحدّث من موقع GPS" : "Updates from your GPS location")}
            </Text>
          </View>
          <Pressable
            disabled={!nearestMosque}
            onPress={openNearestMosqueActions}
            style={[styles.mosqueActionButton, !nearestMosque && styles.mosqueActionButtonDisabled]}
            accessibilityRole="button"
            accessibilityLabel={locale === "ar" ? "خيارات المسجد" : "Mosque actions"}
          >
            <Text style={styles.mosqueActionText}>⧉</Text>
          </Pressable>
        </View>
      ) : null}

'''
    home = home.replace(footer_anchor, bottom_card + footer_anchor, 1)

style_anchor = '  nearestMosqueBadgeText: { color: "#fff", fontSize: 10.5, fontWeight: "900" },'
if style_anchor in home and 'mosqueActionButton:' not in home:
    extra_styles = '''
  mosqueActionButton: { width: 42, height: 42, borderRadius: 13, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#d8e2dc", backgroundColor: "#f7faf8" },
  mosqueActionButtonDisabled: { opacity: 0.35 },
  mosqueActionText: { color: "#075f4a", fontSize: 23, fontWeight: "900" },'''
    home = home.replace(style_anchor, style_anchor + extra_styles, 1)

HOME.write_text(home, encoding="utf-8")

# -----------------------------------------------------------------------------
# Final invariants.
# -----------------------------------------------------------------------------
checks = {
    PRAYER: [
        'HASSOUN_GPS_ONLY_PRAYER_SOURCE_V1',
        'const latitude = position.coords.latitude;',
        'officialWindsorAvailable',
        'dateKeyInZone(WINDSOR_TIME_ZONE)',
    ],
    CALC: ['Automatic by GPS', 'Choosing a mosque never changes prayer times'],
    MOSQUES: ['Prayer times always stay based on your phone GPS', 'location, distance and directions only'],
    HOME: [
        'HASSOUN_BOTTOM_NEAREST_MOSQUE_CARD_V1',
        'HASSOUN_NEAREST_MOSQUE_CAR_ANIMATION_V1',
        'Open with Maps',
        'Clipboard.setStringAsync',
        '🚗',
        '⧉',
    ],
}
for path, needles in checks.items():
    text = path.read_text(encoding="utf-8")
    for needle in needles:
        if needle not in text:
            raise SystemExit(f"Missing v1.0.44 marker {needle!r} in {path}")

if 'selected ? selected.latitude' in PRAYER.read_text(encoding="utf-8"):
    raise SystemExit("Selected mosque still changes prayer latitude")

print("HASSOUN_V1044_GPS_PRAYER_MOSQUE_DISPLAY_APPLIED")
