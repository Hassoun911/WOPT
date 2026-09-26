from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[2]
PAGE = ROOT / "mobile/src/PrayerCalculationSettingsPage.tsx"
MOSQUES = ROOT / "mobile/src/NearbyMosquesPage.tsx"

# This patch runs after fix-v1037-gps-mosque-source.py has created the page.
if not PAGE.exists() or not MOSQUES.exists():
    raise SystemExit("v1.0.39 requires the v1.0.37 GPS/mosque source layer first")

# -----------------------------------------------------------------------------
# 1) Replace the nearby-mosque discovery implementation with a true radius
#    search around the device coordinates. Overpass is primary because it can
#    query actual OSM mosque features by distance; Nominatim remains a fallback.
# -----------------------------------------------------------------------------
mosques = MOSQUES.read_text(encoding="utf-8")

start = mosques.find("async function findNearbyMosques(latitude: number, longitude: number) {")
end = mosques.find("\n}\n\nexport default function NearbyMosquesPage", start)
if start < 0 or end < 0:
    raise SystemExit("Could not locate findNearbyMosques()")

new_find = r'''async function findNearbyMosques(latitude: number, longitude: number) {
  const map = new Map<string, MosqueRow>();
  const radiusMeters = 30000;

  // Primary: true geospatial radius search around the phone's GPS coordinates.
  try {
    const query = `[out:json][timeout:18];(
      node["amenity"="place_of_worship"]["religion"="muslim"](around:${radiusMeters},${latitude},${longitude});
      way["amenity"="place_of_worship"]["religion"="muslim"](around:${radiusMeters},${latitude},${longitude});
      relation["amenity"="place_of_worship"]["religion"="muslim"](around:${radiusMeters},${latitude},${longitude});
      node["name"~"mosque|masjid|مسجد|جامع",i](around:${radiusMeters},${latitude},${longitude});
      way["name"~"mosque|masjid|مسجد|جامع",i](around:${radiusMeters},${latitude},${longitude});
      relation["name"~"mosque|masjid|مسجد|جامع",i](around:${radiusMeters},${latitude},${longitude});
    );out center tags;`;
    const response = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body: `data=${encodeURIComponent(query)}`
    });
    if (response.ok) {
      const payload = await response.json() as { elements?: any[] };
      for (const element of payload.elements || []) {
        const lat = Number(element?.lat ?? element?.center?.lat);
        const lon = Number(element?.lon ?? element?.center?.lon);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
        const tags = element?.tags || {};
        const name = first(tags.name, tags["name:en"], tags["name:ar"], "Mosque");
        const street = first(tags["addr:street"]);
        const number = first(tags["addr:housenumber"]);
        const city = first(tags["addr:city"], tags["addr:town"], tags["addr:village"]);
        const region = first(tags["addr:state"], tags["addr:province"]);
        const country = first(tags["addr:country"]);
        const address = [number, street, city, region, country].filter(Boolean).join(", ");
        const row: MosqueRow = {
          id: `osm:${element?.type || "place"}:${element?.id || `${lat}:${lon}`}`,
          name,
          displayName: address || [name, city, region].filter(Boolean).join(", "),
          latitude: lat,
          longitude: lon,
          city: city || undefined,
          region: region || undefined,
          country: country || undefined,
          distanceKm: distanceKm(latitude, longitude, lat, lon)
        };
        if (row.distanceKm <= 30 && !map.has(row.id)) map.set(row.id, row);
      }
    }
  } catch {}

  // Fallback/enrichment: city-based Nominatim search when OSM radius search is
  // unavailable or sparse. Results are still distance-filtered from the GPS fix.
  if (map.size < 5) {
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
    for (const word of ["mosque", "masjid"]) {
      try {
        const params = new URLSearchParams({
          format: "jsonv2",
          addressdetails: "1",
          namedetails: "1",
          limit: "40",
          q: [word, where].filter(Boolean).join(" ")
        });
        const response = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`, {
          headers: { Accept: "application/json", "Accept-Language": "en" }
        });
        if (!response.ok) continue;
        const rows = await response.json() as any[];
        for (const raw of rows) {
          const normalized = normalize(raw, latitude, longitude);
          if (!normalized || normalized.distanceKm > 30) continue;
          const key = `${normalized.name.toLowerCase()}:${normalized.latitude.toFixed(5)}:${normalized.longitude.toFixed(5)}`;
          if (![...map.values()].some((item) => `${item.name.toLowerCase()}:${item.latitude.toFixed(5)}:${item.longitude.toFixed(5)}` === key)) {
            map.set(normalized.id, normalized);
          }
        }
      } catch {}
    }
  }

  return [...map.values()]
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, 40);
}'''

mosques = mosques[:start] + new_find + mosques[end + 2:]
mosques = mosques.replace('t("Nearby Mosques", "المساجد القريبة")', 't("Mosques Near Me", "المساجد القريبة مني")')
mosques = mosques.replace(
    't("Choose where Hassoun should anchor your prayer times.", "اختر المسجد الذي تريد أن يعتمد عليه حسون لموقع مواقيت الصلاة.")',
    't("Mosques around your current GPS location, sorted by distance. Tap a mosque to use its location for prayer times.", "المساجد حول موقع GPS الحالي مرتبة حسب المسافة. اضغط على مسجد لاستخدام موقعه لمواقيت الصلاة.")'
)
mosques = mosques.replace(
    't("No nearby mosques were found. Try again or keep GPS as your prayer source.", "لم يتم العثور على مساجد قريبة. حاول مرة أخرى أو استخدم GPS كمصدر لمواقيت الصلاة.")',
    't("No mosques were found within 30 km. Tap refresh to try again, or keep GPS as your prayer source.", "لم يتم العثور على مساجد ضمن 30 كم. اضغط تحديث للمحاولة مرة أخرى أو استمر باستخدام GPS كمصدر لمواقيت الصلاة.")'
)
mosques = mosques.replace(
    't("Finding mosques near you…", "جارٍ البحث عن المساجد القريبة…")',
    't("Loading mosques near you…", "جارٍ تحميل المساجد القريبة منك…")'
)
MOSQUES.write_text(mosques, encoding="utf-8")

# -----------------------------------------------------------------------------
# 2) Make Mosques Near Me look and behave like navigation, not a fourth radio
#    source. The selected mosque is still shown clearly when one is active.
# -----------------------------------------------------------------------------
page = PAGE.read_text(encoding="utf-8")

old_block = '''      <SourceCard
        active={prefs.locationMode === "mosque"}
        onPress={() => setMosquesOpen(true)}
        title={t("Nearby Mosques / Prayer Location", "المساجد القريبة / موقع الصلاة")}
        body={prefs.locationMode === "mosque" && prefs.selectedMosque
          ? t(`Using mosque location: ${prefs.selectedMosque.name}. Tap to change.`, `موقع المسجد المستخدم: ${prefs.selectedMosque.name}. اضغط للتغيير.`)
          : t("GPS is the default. Tap to see nearby mosques and optionally use one as your prayer-location source.", "GPS هو الافتراضي. اضغط لرؤية المساجد القريبة واختيار مسجد كمصدر اختياري لموقع الصلاة.")}
      />'''

new_block = '''      <Pressable onPress={() => setMosquesOpen(true)} style={[styles.mosquesNearMeCard, prefs.locationMode === "mosque" && styles.mosquesNearMeCardActive]}>
        <View style={styles.mosquesNearMeIcon}><Text style={styles.mosquesNearMeEmoji}>🕌</Text></View>
        <View style={{ flex: 1 }}>
          <Text style={styles.mosquesNearMeTitle}>{t("Mosques Near Me", "المساجد القريبة مني")}</Text>
          <Text style={styles.mosquesNearMeBody}>{prefs.locationMode === "mosque" && prefs.selectedMosque
            ? t(`Using ${prefs.selectedMosque.name} as your prayer location. Tap to change.`, `يتم استخدام ${prefs.selectedMosque.name} كموقع للصلاة. اضغط للتغيير.`)
            : t("Open a list of mosques around your GPS location and choose one if you want.", "افتح قائمة المساجد حول موقع GPS واختر مسجداً إذا أردت.")}</Text>
        </View>
        <Text style={styles.mosquesNearMeArrow}>›</Text>
      </Pressable>'''

if old_block not in page:
    raise SystemExit("Could not locate the old Nearby Mosques source card")
page = page.replace(old_block, new_block, 1)

style_anchor = 'const styles = StyleSheet.create({'
if style_anchor not in page:
    raise SystemExit("Prayer calculation styles missing")
page = page.replace(style_anchor, style_anchor + '''
  mosquesNearMeCard: { flexDirection: "row", alignItems: "center", gap: 12, padding: 15, borderRadius: 18, borderWidth: 1, borderColor: "#d6dbd5", backgroundColor: "#fff" },
  mosquesNearMeCardActive: { borderColor: "#12624f", backgroundColor: "#edf6f2" },
  mosquesNearMeIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: "#eef5f1", alignItems: "center", justifyContent: "center" },
  mosquesNearMeEmoji: { fontSize: 22 },
  mosquesNearMeTitle: { color: "#17463b", fontSize: 16, fontWeight: "900" },
  mosquesNearMeBody: { color: "#68756f", fontSize: 11.5, lineHeight: 17, marginTop: 3 },
  mosquesNearMeArrow: { color: "#0b654f", fontSize: 30, fontWeight: "700" },
''', 1)
PAGE.write_text(page, encoding="utf-8")

checks = {
    MOSQUES: [
        'Mosques Near Me',
        'overpass-api.de/api/interpreter',
        'radiusMeters = 30000',
        'Loading mosques near you',
        'distanceKm: distanceKm',
        'chooseMosque',
    ],
    PAGE: [
        'Mosques Near Me',
        'mosquesNearMeCard',
        'setMosquesOpen(true)',
        'Using ${prefs.selectedMosque.name} as your prayer location',
    ],
}
for path, needles in checks.items():
    text = path.read_text(encoding="utf-8")
    for needle in needles:
        if needle not in text:
            raise SystemExit(f"Missing v1.0.39 Mosques Near Me marker {needle!r} in {path}")

print("HASSOUN_V1039_MOSQUES_NEAR_ME_APPLIED")
