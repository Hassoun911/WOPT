from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
HOME = ROOT / "mobile/src/HomePrayerPage.tsx"
MOSQUES = ROOT / "mobile/src/NearbyMosquesPage.tsx"
PREF = ROOT / "mobile/src/nearestMosquePreference.ts"

if not HOME.exists() or not MOSQUES.exists():
    raise SystemExit("v1.0.41 requires HomePrayerPage and NearbyMosquesPage")

# -----------------------------------------------------------------------------
# 1) Persistent opt-in preference. This is intentionally separate from prayer
#    calculation preferences because it controls Home UI / nearby discovery only.
# -----------------------------------------------------------------------------
PREF.write_text(r'''import AsyncStorage from "@react-native-async-storage/async-storage";

export const SHOW_NEAREST_MOSQUE_HOME_KEY = "hassoun:nearest-mosque-home:v1";
const listeners = new Set<(enabled: boolean) => void>();

export async function loadShowNearestMosqueOnHome() {
  try {
    return (await AsyncStorage.getItem(SHOW_NEAREST_MOSQUE_HOME_KEY)) === "1";
  } catch {
    return false;
  }
}

export async function saveShowNearestMosqueOnHome(enabled: boolean) {
  await AsyncStorage.setItem(SHOW_NEAREST_MOSQUE_HOME_KEY, enabled ? "1" : "0");
  for (const listener of listeners) {
    try { listener(enabled); } catch {}
  }
}

export function subscribeShowNearestMosqueOnHome(listener: (enabled: boolean) => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
''', encoding="utf-8")

# -----------------------------------------------------------------------------
# 2) Export the proven v1.0.40 directory lookup and add an ON/OFF control to the
#    Mosques Near Me page.
# -----------------------------------------------------------------------------
mosques = MOSQUES.read_text(encoding="utf-8")

if '  Switch,\n' not in mosques:
    mosques = mosques.replace('  StyleSheet,\n  Text,', '  StyleSheet,\n  Switch,\n  Text,', 1)

pref_import = 'import { loadShowNearestMosqueOnHome, saveShowNearestMosqueOnHome } from "./nearestMosquePreference";\n'
if pref_import not in mosques:
    anchor = '} from "./prayerCalculationSettings";\n'
    if anchor not in mosques:
        raise SystemExit("Nearby mosque preference import anchor missing")
    mosques = mosques.replace(anchor, anchor + pref_import, 1)

mosques = mosques.replace('type MosqueRow = SelectedMosque & { distanceKm: number };', 'export type MosqueRow = SelectedMosque & { distanceKm: number };', 1)
mosques = mosques.replace('async function findNearbyMosques(latitude: number, longitude: number) {', 'export async function findNearbyMosques(latitude: number, longitude: number) {', 1)

state_anchor = '  const [query, setQuery] = useState("");'
if state_anchor not in mosques:
    raise SystemExit("Nearby mosque state anchor missing")
if 'const [showNearestOnHome, setShowNearestOnHome]' not in mosques:
    mosques = mosques.replace(state_anchor, state_anchor + '\n  const [showNearestOnHome, setShowNearestOnHome] = useState(false);', 1)

load_anchor = '    void loadPrayerCalculationPreferences().then(setPrefs);'
if load_anchor not in mosques:
    raise SystemExit("Nearby mosque load anchor missing")
if 'loadShowNearestMosqueOnHome().then(setShowNearestOnHome)' not in mosques:
    mosques = mosques.replace(load_anchor, load_anchor + '\n    void loadShowNearestMosqueOnHome().then(setShowNearestOnHome);', 1)

if 'const toggleNearestOnHome' not in mosques:
    choose_anchor = '  const chooseGps = async () => {'
    pos = mosques.find(choose_anchor)
    if pos < 0:
        raise SystemExit("Nearby mosque chooseGps anchor missing")
    toggle_fn = '''  const toggleNearestOnHome = async (enabled: boolean) => {
    setShowNearestOnHome(enabled);
    await saveShowNearestMosqueOnHome(enabled);
  };

'''
    mosques = mosques[:pos] + toggle_fn + mosques[pos:]

selected_anchor = '      {prefs?.locationMode === "mosque" && prefs.selectedMosque ? ('
if selected_anchor not in mosques:
    raise SystemExit("Nearby mosque selected-card anchor missing")
if 'Show nearest mosque on Home' not in mosques:
    toggle_jsx = '''      <View style={styles.homeNearestCard}>
        <View style={{ flex: 1 }}>
          <Text style={styles.homeNearestTitle}>{t("Show nearest mosque on Home", "إظهار أقرب مسجد في الصفحة الرئيسية")}</Text>
          <Text style={styles.homeNearestText}>{t(
            "Keep this on to always show the closest mosque and its distance on the Home page.",
            "اترك هذا الخيار مفعلاً لإظهار أقرب مسجد والمسافة إليه دائماً في الصفحة الرئيسية."
          )}</Text>
        </View>
        <Switch
          value={showNearestOnHome}
          onValueChange={(value) => { void toggleNearestOnHome(value); }}
          trackColor={{ false: "#cbd1cd", true: "#8fc7b7" }}
          thumbColor={showNearestOnHome ? "#0b6a53" : "#f4f4f4"}
        />
      </View>

'''
    mosques = mosques.replace(selected_anchor, toggle_jsx + selected_anchor, 1)

style_anchor = 'const styles = StyleSheet.create({'
if style_anchor not in mosques:
    raise SystemExit("Nearby mosque styles anchor missing")
if 'homeNearestCard:' not in mosques:
    mosques = mosques.replace(style_anchor, style_anchor + '''
  homeNearestCard: { flexDirection: "row", alignItems: "center", gap: 14, padding: 15, borderRadius: 18, borderWidth: 1, borderColor: "#d6dbd5", backgroundColor: "#fff" },
  homeNearestTitle: { color: "#17463b", fontSize: 15, fontWeight: "900" },
  homeNearestText: { color: "#68756f", fontSize: 11.5, lineHeight: 17, marginTop: 4 },
''', 1)

MOSQUES.write_text(mosques, encoding="utf-8")

# -----------------------------------------------------------------------------
# 3) Home card. It uses the same coordinates as the active prayer location, so
#    mosque distance and prayer location cannot silently disagree. A prayer/GPS
#    refresh updates calculatedAt and automatically refreshes the mosque card.
# -----------------------------------------------------------------------------
home = HOME.read_text(encoding="utf-8")
home = home.replace('import { useMemo, useState } from "react";', 'import { useEffect, useMemo, useState } from "react";', 1)

imports_anchor = 'import { PRAYER_KEYS, type PrayerKey } from "./types";\n'
if imports_anchor not in home:
    raise SystemExit("Home imports anchor missing")
extra_imports = '''import { findNearbyMosques, type MosqueRow } from "./NearbyMosquesPage";
import { loadShowNearestMosqueOnHome, subscribeShowNearestMosqueOnHome } from "./nearestMosquePreference";
'''
if 'subscribeShowNearestMosqueOnHome' not in home:
    home = home.replace(imports_anchor, imports_anchor + extra_imports, 1)

if 'function mosqueDistanceLabel' not in home:
    export_anchor = 'export default function HomePrayerPage({'
    pos = home.find(export_anchor)
    if pos < 0:
        raise SystemExit("Home component anchor missing")
    helper = '''function mosqueDistanceLabel(distanceKm: number, locale: Locale) {
  if (distanceKm < 1) {
    const metres = Math.max(50, Math.round(distanceKm * 1000 / 50) * 50);
    return locale === "ar" ? `${metres} م` : `${metres} m away`;
  }
  const km = distanceKm < 10 ? distanceKm.toFixed(1) : Math.round(distanceKm).toString();
  return locale === "ar" ? `${km} كم` : `${km} km away`;
}

'''
    home = home[:pos] + helper + home[pos:]

state_anchor = '  const [emailMessage, setEmailMessage] = useState("");'
if state_anchor not in home:
    raise SystemExit("Home email state anchor missing")
if 'nearestMosqueEnabled' not in home:
    home = home.replace(state_anchor, state_anchor + '''
  const [nearestMosqueEnabled, setNearestMosqueEnabled] = useState(false);
  const [nearestMosque, setNearestMosque] = useState<MosqueRow | null>(null);
  const [nearestMosqueState, setNearestMosqueState] = useState<"idle" | "loading" | "empty" | "error">("idle");''', 1)

submit_anchor = '  const submitPrayerEmail = async () => {'
if submit_anchor not in home:
    raise SystemExit("Home submit anchor missing")
if 'subscribeShowNearestMosqueOnHome(setNearestMosqueEnabled)' not in home:
    effects = '''  useEffect(() => {
    let alive = true;
    void loadShowNearestMosqueOnHome().then((enabled) => { if (alive) setNearestMosqueEnabled(enabled); });
    const unsubscribe = subscribeShowNearestMosqueOnHome(setNearestMosqueEnabled);
    return () => { alive = false; unsubscribe(); };
  }, []);

  useEffect(() => {
    let alive = true;
    if (!nearestMosqueEnabled || !context) {
      setNearestMosque(null);
      setNearestMosqueState("idle");
      return () => { alive = false; };
    }
    setNearestMosqueState("loading");
    void findNearbyMosques(context.location.latitude, context.location.longitude)
      .then((rows) => {
        if (!alive) return;
        setNearestMosque(rows[0] || null);
        setNearestMosqueState(rows.length ? "idle" : "empty");
      })
      .catch(() => {
        if (!alive) return;
        setNearestMosque(null);
        setNearestMosqueState("error");
      });
    return () => { alive = false; };
  }, [nearestMosqueEnabled, context?.location.latitude, context?.location.longitude, context?.calculatedAt]);

'''
    home = home.replace(submit_anchor, effects + submit_anchor, 1)

home_anchor = '''      {!context ? <View style={styles.loadingCard}><ActivityIndicator size="small" /><Text style={styles.loadingText}>{locale === "ar" ? "جارٍ فتح مواقيت الصلاة…" : "Opening prayer times…"}</Text></View> : null}
'''
if home_anchor not in home:
    raise SystemExit("Home nearest-card insertion anchor missing")
if 'styles.nearestMosqueCard' not in home:
    card = '''      {nearestMosqueEnabled ? (
        <View style={styles.nearestMosqueCard}>
          <View style={styles.nearestMosqueIcon}><Text style={styles.nearestMosqueEmoji}>🕌</Text></View>
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
              {nearestMosque
                ? mosqueDistanceLabel(nearestMosque.distanceKm, locale)
                : (locale === "ar" ? "يُحدّث مع موقع الصلاة الحالي" : "Updates with your current prayer location")}
            </Text>
          </View>
          {nearestMosque ? <View style={styles.nearestMosqueBadge}><Text style={styles.nearestMosqueBadgeText}>{mosqueDistanceLabel(nearestMosque.distanceKm, locale)}</Text></View> : null}
        </View>
      ) : null}

'''
    home = home.replace(home_anchor, home_anchor + '\n' + card, 1)

style_anchor = 'const styles = StyleSheet.create({'
if style_anchor not in home:
    raise SystemExit("Home styles anchor missing")
if 'nearestMosqueCard:' not in home:
    home = home.replace(style_anchor, style_anchor + '''
  nearestMosqueCard: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#ffffff", borderRadius: 18, borderWidth: 1, borderColor: "#d8e2dc", padding: 14 },
  nearestMosqueIcon: { width: 46, height: 46, borderRadius: 15, backgroundColor: "#edf6f2", alignItems: "center", justifyContent: "center" },
  nearestMosqueEmoji: { fontSize: 23 },
  nearestMosqueCopy: { flex: 1, minWidth: 0 },
  nearestMosqueEyebrow: { color: "#8d7631", fontSize: 10.5, fontWeight: "900", letterSpacing: 0.8 },
  nearestMosqueName: { color: "#075f4a", fontSize: 16, fontWeight: "900", marginTop: 2 },
  nearestMosqueDistance: { color: "#6c7772", fontSize: 11.5, marginTop: 2 },
  nearestMosqueBadge: { backgroundColor: "#075f4a", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 7 },
  nearestMosqueBadgeText: { color: "#fff", fontSize: 10.5, fontWeight: "900" },
''', 1)

HOME.write_text(home, encoding="utf-8")

checks = {
    PREF: ['SHOW_NEAREST_MOSQUE_HOME_KEY', 'saveShowNearestMosqueOnHome', 'subscribeShowNearestMosqueOnHome'],
    MOSQUES: ['export async function findNearbyMosques', 'Show nearest mosque on Home', 'showNearestOnHome', '<Switch'],
    HOME: ['nearestMosqueEnabled', 'NEAREST MOSQUE', 'findNearbyMosques(context.location.latitude', 'mosqueDistanceLabel', 'nearestMosqueCard'],
}
for path, needles in checks.items():
    text = path.read_text(encoding="utf-8")
    for needle in needles:
        if needle not in text:
            raise SystemExit(f"Missing v1.0.41 marker {needle!r} in {path}")

print("HASSOUN_V1041_NEAREST_MOSQUE_HOME_APPLIED")
