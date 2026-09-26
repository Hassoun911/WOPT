from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[2]
SETTINGS = ROOT / "mobile/src/prayerCalculationSettings.ts"
PAGE = ROOT / "mobile/src/PrayerCalculationSettingsPage.tsx"
PRAYER = ROOT / "mobile/src/prayerData.ts"
MOSQUES = ROOT / "mobile/src/NearbyMosquesPage.tsx"

# -----------------------------------------------------------------------------
# 1) Extend prayer preferences with an explicit prayer-location source.
#    Default stays GPS. A selected mosque is an opt-in override.
# -----------------------------------------------------------------------------
settings = SETTINGS.read_text(encoding="utf-8")

if 'export type PrayerLocationMode = "gps" | "mosque";' not in settings:
    settings = settings.replace(
        'export type PrayerScheduleSource = "smart" | "official" | "calculated";\n',
        'export type PrayerScheduleSource = "smart" | "official" | "calculated";\n'
        'export type PrayerLocationMode = "gps" | "mosque";\n\n'
        'export type SelectedMosque = {\n'
        '  id: string;\n'
        '  name: string;\n'
        '  displayName: string;\n'
        '  latitude: number;\n'
        '  longitude: number;\n'
        '  city?: string;\n'
        '  region?: string;\n'
        '  country?: string;\n'
        '};\n',
        1,
    )

if 'locationMode: PrayerLocationMode;' not in settings:
    settings = settings.replace(
        'export type PrayerCalculationPreferences = {\n  scheduleSource: PrayerScheduleSource;\n',
        'export type PrayerCalculationPreferences = {\n'
        '  scheduleSource: PrayerScheduleSource;\n'
        '  locationMode: PrayerLocationMode;\n'
        '  selectedMosque: SelectedMosque | null;\n',
        1,
    )

if 'locationMode: "gps"' not in settings:
    settings = settings.replace(
        'export const DEFAULT_CALCULATION_PREFS: PrayerCalculationPreferences = {\n  scheduleSource: "smart",\n',
        'export const DEFAULT_CALCULATION_PREFS: PrayerCalculationPreferences = {\n'
        '  scheduleSource: "smart",\n'
        '  locationMode: "gps",\n'
        '  selectedMosque: null,\n',
        1,
    )

old_return = '''    return {\n      ...DEFAULT_CALCULATION_PREFS,\n      ...parsed,\n      scheduleSource,\n      mode: parsed.mode === "manual" ? "manual" : "smart",\n      school: parsed.school === 1 ? 1 : 0,\n      highLatitude: parsed.highLatitude === 0 || parsed.highLatitude === 1 || parsed.highLatitude === 2 ? parsed.highLatitude : 3,\n      offsets: { ...DEFAULT_CALCULATION_PREFS.offsets, ...(parsed.offsets || {}) }\n    };'''
new_return = '''    const candidate = parsed.selectedMosque as SelectedMosque | null | undefined;\n    const selectedMosque = candidate && Number.isFinite(Number(candidate.latitude)) && Number.isFinite(Number(candidate.longitude))\n      ? {\n          ...candidate,\n          latitude: Number(candidate.latitude),\n          longitude: Number(candidate.longitude),\n          id: String(candidate.id || `${candidate.latitude}:${candidate.longitude}`),\n          name: String(candidate.name || "Selected mosque"),\n          displayName: String(candidate.displayName || candidate.name || "Selected mosque")\n        }\n      : null;\n    const locationMode: PrayerLocationMode = parsed.locationMode === "mosque" && selectedMosque ? "mosque" : "gps";\n    return {\n      ...DEFAULT_CALCULATION_PREFS,\n      ...parsed,\n      scheduleSource,\n      locationMode,\n      selectedMosque,\n      mode: parsed.mode === "manual" ? "manual" : "smart",\n      school: parsed.school === 1 ? 1 : 0,\n      highLatitude: parsed.highLatitude === 0 || parsed.highLatitude === 1 || parsed.highLatitude === 2 ? parsed.highLatitude : 3,\n      offsets: { ...DEFAULT_CALCULATION_PREFS.offsets, ...(parsed.offsets || {}) }\n    };'''
if old_return in settings:
    settings = settings.replace(old_return, new_return, 1)
elif 'const locationMode: PrayerLocationMode' not in settings:
    raise SystemExit('Could not patch prayer preference loader')

SETTINGS.write_text(settings, encoding="utf-8")

# -----------------------------------------------------------------------------
# 2) Nearby Mosques page. Uses the phone GPS, reverse-geocodes the locality,
#    searches OpenStreetMap/Nominatim, sorts by distance, and lets the user opt
#    into a mosque as the prayer-location source.
# -----------------------------------------------------------------------------
MOSQUES.write_text(r'''import * as Location from "expo-location";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import {
  loadPrayerCalculationPreferences,
  savePrayerCalculationPreferences,
  type PrayerCalculationPreferences,
  type SelectedMosque
} from "./prayerCalculationSettings";

type Props = { locale: "en" | "ar"; onBack: () => void };
type MosqueRow = SelectedMosque & { distanceKm: number };

function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const rad = (v: number) => v * Math.PI / 180;
  const dLat = rad(lat2 - lat1);
  const dLon = rad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function first(...values: unknown[]) {
  for (const value of values) {
    const text = String(value ?? "").trim();
    if (text) return text;
  }
  return "";
}

function normalize(row: any, latitude: number, longitude: number): MosqueRow | null {
  const lat = Number(row?.lat);
  const lon = Number(row?.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  const address = row?.address || {};
  const displayName = String(row?.display_name || "").trim();
  const name = first(row?.name, row?.namedetails?.name, displayName.split(",")[0], "Mosque");
  const hay = `${name} ${displayName}`;
  if (!/mosque|masjid|islamic|muslim|جامع|مسجد/i.test(hay)) return null;
  return {
    id: String(row?.place_id || `${lat}:${lon}:${name}`),
    name,
    displayName: displayName || name,
    latitude: lat,
    longitude: lon,
    city: first(address.city, address.town, address.municipality, address.village, address.hamlet) || undefined,
    region: first(address.state, address.province, address.region) || undefined,
    country: first(address.country) || undefined,
    distanceKm: distanceKm(latitude, longitude, lat, lon)
  };
}

async function findNearbyMosques(latitude: number, longitude: number) {
  let city = "";
  let region = "";
  let country = "";
  try {
    const places = await Location.reverseGeocodeAsync({ latitude, longitude });
    const place = places[0];
    city = first(place?.city, place?.subregion, place?.district);
    region = first(place?.region);
    country = first(place?.country);
  } catch {}

  const where = [city, region, country].filter(Boolean).join(" ");
  const queries = [
    ["mosque", where].filter(Boolean).join(" "),
    ["masjid", where].filter(Boolean).join(" ")
  ];
  const map = new Map<string, MosqueRow>();

  for (let i = 0; i < queries.length; i += 1) {
    if (i > 0 && map.size >= 8) break;
    const q = queries[i];
    const params = new URLSearchParams({
      format: "jsonv2",
      addressdetails: "1",
      namedetails: "1",
      limit: "30",
      q
    });
    const response = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`, {
      headers: { Accept: "application/json", "Accept-Language": "en" }
    });
    if (!response.ok) continue;
    const rows = await response.json() as any[];
    for (const row of rows) {
      const normalized = normalize(row, latitude, longitude);
      if (!normalized) continue;
      if (normalized.distanceKm > 100) continue;
      if (!map.has(normalized.id)) map.set(normalized.id, normalized);
    }
  }

  return [...map.values()].sort((a, b) => a.distanceKm - b.distanceKm).slice(0, 30);
}

export default function NearbyMosquesPage({ locale, onBack }: Props) {
  const ar = locale === "ar";
  const t = (en: string, arabic: string) => ar ? arabic : en;
  const [prefs, setPrefs] = useState<PrayerCalculationPreferences | null>(null);
  const [rows, setRows] = useState<MosqueRow[]>([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");

  const refresh = async () => {
    setBusy(true);
    setError("");
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) throw new Error("LOCATION_PERMISSION_DENIED");
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const found = await findNearbyMosques(position.coords.latitude, position.coords.longitude);
      setRows(found);
      if (!found.length) setError(t("No nearby mosques were found. Try again or keep GPS as your prayer source.", "لم يتم العثور على مساجد قريبة. حاول مرة أخرى أو استخدم GPS كمصدر لمواقيت الصلاة."));
    } catch (cause) {
      const code = cause instanceof Error ? cause.message : String(cause);
      setError(code.includes("LOCATION")
        ? t("Location access is needed to find nearby mosques.", "يلزم السماح بالموقع للعثور على المساجد القريبة.")
        : t("Mosque search is temporarily unavailable. Your GPS prayer times still work.", "البحث عن المساجد غير متاح مؤقتاً. مواقيت الصلاة حسب GPS ما زالت تعمل."));
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    void loadPrayerCalculationPreferences().then(setPrefs);
    void refresh();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) => `${row.name} ${row.displayName} ${row.city || ""}`.toLowerCase().includes(q));
  }, [query, rows]);

  const chooseGps = async () => {
    const current = prefs || await loadPrayerCalculationPreferences();
    const next = { ...current, locationMode: "gps" as const, selectedMosque: null };
    await savePrayerCalculationPreferences(next);
    setPrefs(next);
    onBack();
  };

  const chooseMosque = async (mosque: MosqueRow) => {
    const current = prefs || await loadPrayerCalculationPreferences();
    const selected: SelectedMosque = {
      id: mosque.id,
      name: mosque.name,
      displayName: mosque.displayName,
      latitude: mosque.latitude,
      longitude: mosque.longitude,
      city: mosque.city,
      region: mosque.region,
      country: mosque.country
    };
    const next = { ...current, locationMode: "mosque" as const, selectedMosque: selected };
    await savePrayerCalculationPreferences(next);
    setPrefs(next);
    onBack();
  };

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Pressable onPress={onBack} style={styles.back}><Text style={styles.backText}>‹</Text></Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{t("Nearby Mosques", "المساجد القريبة")}</Text>
          <Text style={styles.subtitle}>{t("Choose where Hassoun should anchor your prayer times.", "اختر المسجد الذي تريد أن يعتمد عليه حسون لموقع مواقيت الصلاة.")}</Text>
        </View>
      </View>

      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>{t("How this works", "كيف يعمل هذا الخيار")}</Text>
        <Text style={styles.infoText}>{t(
          "GPS remains the default. If you select a mosque, Hassoun uses a trusted official timetable when one is available; otherwise it calculates from that mosque’s exact coordinates. Windsor official data is only used for Windsor-area coordinates.",
          "يبقى GPS هو الخيار الافتراضي. إذا اخترت مسجداً، يستخدم حسون جدولاً رسمياً موثوقاً عند توفره، وإلا يحسب المواقيت من إحداثيات المسجد الدقيقة. بيانات وندسور الرسمية لا تُستخدم إلا ضمن منطقة وندسور."
        )}</Text>
      </View>

      <Pressable onPress={() => void chooseGps()} style={[styles.gpsButton, prefs?.locationMode === "gps" && styles.gpsButtonActive]}>
        <Text style={styles.gpsTitle}>📍 {t("Use my GPS location", "استخدم موقعي عبر GPS")}</Text>
        <Text style={styles.gpsText}>{prefs?.locationMode === "gps" ? t("Current prayer-location source", "مصدر موقع الصلاة الحالي") : t("Switch back to automatic location", "العودة إلى الموقع التلقائي")}</Text>
      </Pressable>

      {prefs?.locationMode === "mosque" && prefs.selectedMosque ? (
        <View style={styles.selectedCard}>
          <Text style={styles.selectedLabel}>{t("SELECTED MOSQUE", "المسجد المحدد")}</Text>
          <Text style={styles.selectedName}>{prefs.selectedMosque.name}</Text>
          <Text style={styles.selectedText}>{prefs.selectedMosque.displayName}</Text>
        </View>
      ) : null}

      <View style={styles.searchRow}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={t("Filter nearby mosques…", "ابحث ضمن المساجد القريبة…")}
          placeholderTextColor="#8b948f"
          style={styles.input}
        />
        <Pressable onPress={() => void refresh()} style={styles.refreshButton}><Text style={styles.refreshText}>↻</Text></Pressable>
      </View>

      {busy ? <View style={styles.loading}><ActivityIndicator color="#0b6a53" /><Text style={styles.loadingText}>{t("Finding mosques near you…", "جارٍ البحث عن المساجد القريبة…")}</Text></View> : null}
      {!!error && !busy ? <Text style={styles.error}>{error}</Text> : null}

      {!busy ? filtered.map((row) => {
        const selected = prefs?.locationMode === "mosque" && prefs.selectedMosque?.id === row.id;
        return (
          <Pressable key={row.id} onPress={() => void chooseMosque(row)} style={[styles.mosqueCard, selected && styles.mosqueCardSelected]}>
            <View style={styles.mosqueIcon}><Text style={styles.mosqueEmoji}>🕌</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.mosqueName}>{row.name}</Text>
              <Text style={styles.mosqueAddress} numberOfLines={2}>{row.displayName}</Text>
              <Text style={styles.distance}>{row.distanceKm < 1 ? `${Math.round(row.distanceKm * 1000)} m` : `${row.distanceKm.toFixed(1)} km`} {t("away", "بعيداً")}</Text>
            </View>
            <Text style={styles.useText}>{selected ? "✓" : t("Use", "اختيار")}</Text>
          </Pressable>
        );
      }) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#f4f2ea" },
  content: { padding: 18, paddingBottom: 52, gap: 12 },
  header: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  back: { width: 40, height: 44, justifyContent: "center" },
  backText: { fontSize: 44, color: "#0c433a", lineHeight: 46 },
  title: { color: "#153c35", fontSize: 26, fontWeight: "900" },
  subtitle: { color: "#6d7772", fontSize: 13, lineHeight: 19, marginTop: 3 },
  infoCard: { backgroundColor: "#0d493e", borderRadius: 18, padding: 15 },
  infoTitle: { color: "#fff", fontSize: 15, fontWeight: "900" },
  infoText: { color: "#e2efea", fontSize: 12, lineHeight: 19, marginTop: 6 },
  gpsButton: { backgroundColor: "#fff", borderWidth: 1, borderColor: "#d9ddd7", borderRadius: 17, padding: 15 },
  gpsButtonActive: { borderColor: "#0b6a53", backgroundColor: "#edf7f3" },
  gpsTitle: { color: "#174d40", fontSize: 15, fontWeight: "900" },
  gpsText: { color: "#6e7b75", fontSize: 11, marginTop: 4 },
  selectedCard: { backgroundColor: "#fff8e7", borderWidth: 1, borderColor: "#dfc47e", borderRadius: 16, padding: 14 },
  selectedLabel: { color: "#91702d", fontSize: 9, fontWeight: "900", letterSpacing: 1.2 },
  selectedName: { color: "#173f35", fontSize: 17, fontWeight: "900", marginTop: 4 },
  selectedText: { color: "#766f63", fontSize: 11, lineHeight: 16, marginTop: 3 },
  searchRow: { flexDirection: "row", gap: 8 },
  input: { flex: 1, minHeight: 48, borderRadius: 14, backgroundColor: "#fff", borderWidth: 1, borderColor: "#d8ddd7", paddingHorizontal: 13, color: "#173f35" },
  refreshButton: { width: 48, minHeight: 48, borderRadius: 14, backgroundColor: "#0b6a53", alignItems: "center", justifyContent: "center" },
  refreshText: { color: "#fff", fontSize: 24, fontWeight: "900" },
  loading: { flexDirection: "row", alignItems: "center", gap: 9, padding: 14 },
  loadingText: { color: "#61716b", fontSize: 12 },
  error: { backgroundColor: "#fff1ee", color: "#944a3e", borderRadius: 13, padding: 13, fontSize: 12, lineHeight: 18 },
  mosqueCard: { flexDirection: "row", alignItems: "center", gap: 11, backgroundColor: "#fff", borderWidth: 1, borderColor: "#dde0da", borderRadius: 18, padding: 13 },
  mosqueCardSelected: { borderColor: "#0b6a53", backgroundColor: "#edf7f3" },
  mosqueIcon: { width: 44, height: 44, borderRadius: 13, backgroundColor: "#f1eee4", alignItems: "center", justifyContent: "center" },
  mosqueEmoji: { fontSize: 22 },
  mosqueName: { color: "#173f35", fontSize: 14, fontWeight: "900" },
  mosqueAddress: { color: "#7b817d", fontSize: 10.5, lineHeight: 15, marginTop: 2 },
  distance: { color: "#0b6a53", fontSize: 10, fontWeight: "800", marginTop: 4 },
  useText: { color: "#0b6a53", fontSize: 12, fontWeight: "900" }
});
''', encoding="utf-8")

# -----------------------------------------------------------------------------
# 3) Add Nearby Mosques as a sub-page of Prayer Calculation.
# -----------------------------------------------------------------------------
page = PAGE.read_text(encoding="utf-8")
if 'import NearbyMosquesPage from "./NearbyMosquesPage";' not in page:
    anchor = 'import type { Locale } from "./types";'
    if anchor not in page:
        raise SystemExit('PrayerCalculationSettingsPage Locale import missing')
    page = page.replace(anchor, anchor + '\nimport NearbyMosquesPage from "./NearbyMosquesPage";', 1)

if 'const [mosquesOpen, setMosquesOpen]' not in page:
    anchor = '  const [previewing, setPreviewing] = useState(false);\n'
    if anchor not in page:
        raise SystemExit('Prayer calculation state anchor missing')
    page = page.replace(anchor, anchor + '  const [mosquesOpen, setMosquesOpen] = useState(false);\n', 1)

if 'if (mosquesOpen) return <NearbyMosquesPage' not in page:
    anchor = '  const setSource = (scheduleSource: PrayerScheduleSource) => setPrefs((p) => ({ ...p, scheduleSource }));\n\n'
    if anchor not in page:
        raise SystemExit('Prayer calculation source setter anchor missing')
    page = page.replace(
        anchor,
        anchor + '  if (mosquesOpen) return <NearbyMosquesPage locale={locale} onBack={() => { setMosquesOpen(false); void loadPrayerCalculationPreferences().then(setPrefs); }} />;\n\n',
        1,
    )

if 'Nearby Mosques / Prayer Location' not in page:
    anchor = '      <SourceCard active={prefs.scheduleSource === "calculated"} onPress={() => setSource("calculated")} title={t("Calculated Prayer Times", "مواقيت محسوبة")} body={t("Always use GPS + your method, Asr school, high-latitude rule and minute tuning.", "استخدم دائماً GPS مع الطريقة ومذهب العصر وقاعدة خطوط العرض وضبط الدقائق.")} />\n'
    if anchor not in page:
        raise SystemExit('Calculated source card anchor missing')
    mosque_card = '''      <SourceCard\n        active={prefs.locationMode === "mosque"}\n        onPress={() => setMosquesOpen(true)}\n        title={t("Nearby Mosques / Prayer Location", "المساجد القريبة / موقع الصلاة")}\n        body={prefs.locationMode === "mosque" && prefs.selectedMosque\n          ? t(`Using mosque location: ${prefs.selectedMosque.name}. Tap to change.`, `موقع المسجد المستخدم: ${prefs.selectedMosque.name}. اضغط للتغيير.`)\n          : t("GPS is the default. Tap to see nearby mosques and optionally use one as your prayer-location source.", "GPS هو الافتراضي. اضغط لرؤية المساجد القريبة واختيار مسجد كمصدر اختياري لموقع الصلاة.")}\n      />\n'''
    page = page.replace(anchor, anchor + mosque_card, 1)

PAGE.write_text(page, encoding="utf-8")

# -----------------------------------------------------------------------------
# 4) GPS-first runtime:
#    - fresh/last GPS is the default
#    - Windsor official data only for Windsor-area coordinates
#    - explicit mosque selection overrides the coordinate source
#    - AlAdhan result is returned to the Home screen immediately when available
#    - cached/local calculation is the fallback, never unrelated Windsor data
# -----------------------------------------------------------------------------
prayer = PRAYER.read_text(encoding="utf-8")

old_get_position = '''async function getPosition(force: boolean) {\n  const services = await Location.hasServicesEnabledAsync();\n  if (!services) throw new Error("LOCATION_SERVICES_DISABLED");\n\n  const last = await Location.getLastKnownPositionAsync({ maxAge: 30 * 60 * 1000, requiredAccuracy: 10000 });\n  if (last && !force) return last;\n\n  return timeout(\n    Location.getCurrentPositionAsync({ accuracy: force ? Location.Accuracy.High : Location.Accuracy.Balanced }),\n    GPS_TIMEOUT_MS,\n    "LOCATION_FIX_TIMEOUT"\n  );\n}'''
new_get_position = '''async function getPosition(force: boolean) {\n  const last = await Location.getLastKnownPositionAsync({ maxAge: 30 * 60 * 1000, requiredAccuracy: 10000 });\n  if (last && !force) return last;\n\n  const services = await Location.hasServicesEnabledAsync();\n  if (!services) throw new Error("LOCATION_SERVICES_DISABLED");\n\n  return timeout(\n    Location.getCurrentPositionAsync({ accuracy: force ? Location.Accuracy.High : Location.Accuracy.Balanced }),\n    GPS_TIMEOUT_MS,\n    "LOCATION_FIX_TIMEOUT"\n  );\n}'''
if old_get_position in prayer:
    prayer = prayer.replace(old_get_position, new_get_position, 1)
elif 'const last = await Location.getLastKnownPositionAsync' not in prayer:
    raise SystemExit('Could not patch GPS fallback order')

old_fallback = '''function windsorFallback(): LoadedPrayerTimes {\n  const prayerTimes = (bundledSchedule as PrayerFile).prayer_times;\n  return {\n    prayerTimes,\n    live: false,\n    location: { latitude: WINDSOR.latitude, longitude: WINDSOR.longitude, timezone: WINDSOR_TIME_ZONE, label: CITY_LABEL, source: "saved" },\n    calculationMethod: null,\n    calculatedAt: new Date().toISOString()\n  };\n}\n\nexport async function loadInitialPrayerTimes(): Promise<LoadedPrayerTimes> {\n  return (await loadSavedPrayerContext()) || windsorFallback();\n}'''
new_fallback = '''function locationRequiredFallback(): LoadedPrayerTimes {\n  return {\n    prayerTimes: {},\n    live: false,\n    location: {\n      latitude: 0,\n      longitude: 0,\n      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",\n      label: "Location required",\n      source: "saved"\n    },\n    calculationMethod: null,\n    calculatedAt: new Date().toISOString()\n  };\n}\n\nexport async function loadInitialPrayerTimes(): Promise<LoadedPrayerTimes> {\n  return (await loadSavedPrayerContext()) || locationRequiredFallback();\n}'''
if old_fallback in prayer:
    prayer = prayer.replace(old_fallback, new_fallback, 1)
elif 'function locationRequiredFallback()' not in prayer:
    raise SystemExit('Could not replace unsafe Windsor fallback')

start = prayer.find('export async function loadPrayerTimes(options: { forceLocation?: boolean } = {}): Promise<LoadedPrayerTimes> {')
if start < 0:
    raise SystemExit('loadPrayerTimes start missing')
# It is the final exported function in the canonical prayerData source.
old_load = prayer[start:].strip()
new_load = r'''export async function loadPrayerTimes(options: { forceLocation?: boolean } = {}): Promise<LoadedPrayerTimes> {
  const force = Boolean(options.forceLocation);
  const saved = await loadSavedPrayerContext();
  const preferences = await loadPrayerCalculationPreferences();
  const fallback = saved || locationRequiredFallback();
  const selected = preferences.locationMode === "mosque" ? preferences.selectedMosque : null;

  let position: Location.LocationObject | null = null;
  try {
    const granted = await getPermission(force);
    if (granted) position = await getPosition(force);
  } catch (error) {
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

  if (shouldUseOfficialWindsor) {
    const context: LoadedPrayerTimes = {
      prayerTimes: (bundledSchedule as PrayerFile).prayer_times,
      live: true,
      location: {
        latitude,
        longitude,
        timezone: WINDSOR_TIME_ZONE,
        label: selected?.name || CITY_LABEL,
        source: "windsor_islamic_association"
      },
      calculationMethod: null,
      calculatedAt: new Date().toISOString()
    };
    await saveContext(context);
    return context;
  }

  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || saved?.location.timezone || "UTC";
  const local = calculateLocalWindow(latitude, longitude, timezone, preferences);
  const localLabel = selected?.name || fastLocationLabel(latitude, longitude, saved);
  const localContext: LoadedPrayerTimes = {
    prayerTimes: local.prayerTimes,
    live: true,
    location: { latitude, longitude, timezone, label: localLabel, source: "local_calculation" },
    calculationMethod: local.method,
    calculatedAt: new Date().toISOString()
  };

  // Keep a safe on-device schedule first, then prefer the coordinate API result.
  await saveContext(localContext);
  try {
    const [remote, city] = await Promise.all([
      fetchRemoteWindow(latitude, longitude, preferences),
      selected ? Promise.resolve(selected.name) : resolveCity(latitude, longitude)
    ]);
    const refreshed: LoadedPrayerTimes = {
      prayerTimes: remote.prayerTimes,
      live: true,
      location: { latitude, longitude, timezone: remote.timezone, label: city, source: "aladhan" },
      calculationMethod: remote.selectedMethod,
      calculatedAt: new Date().toISOString()
    };
    await saveContext(refreshed);
    return refreshed;
  } catch {
    return localContext;
  }
}'''
prayer = prayer[:start] + new_load + '\n'
PRAYER.write_text(prayer, encoding="utf-8")

# -----------------------------------------------------------------------------
# Verify the feature patch before the Android build starts.
# -----------------------------------------------------------------------------
checks = {
    SETTINGS: [
        'PrayerLocationMode = "gps" | "mosque"',
        'selectedMosque: SelectedMosque | null',
        'locationMode: "gps"',
    ],
    PAGE: [
        'NearbyMosquesPage',
        'Nearby Mosques / Prayer Location',
        'prefs.locationMode === "mosque"',
    ],
    MOSQUES: [
        'Finding mosques near you',
        'nominatim.openstreetmap.org/search',
        'Use my GPS location',
        'savePrayerCalculationPreferences',
    ],
    PRAYER: [
        'locationRequiredFallback',
        'preferences.locationMode === "mosque"',
        'selected ? selected.latitude : position!.coords.latitude',
        'shouldUseOfficialWindsor',
        'return refreshed',
    ],
}
for path, needles in checks.items():
    text = path.read_text(encoding="utf-8")
    for needle in needles:
        if needle not in text:
            raise SystemExit(f'Missing v1.0.37 marker {needle!r} in {path}')

print('HASSOUN_V1037_GPS_FIRST_MOSQUE_SOURCE_APPLIED')
