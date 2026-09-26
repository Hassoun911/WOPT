from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[2]
MOSQUES = ROOT / "mobile/src/NearbyMosquesPage.tsx"
HUB = ROOT / "mobile/src/SettingsHub.tsx"
CALC = ROOT / "mobile/src/PrayerCalculationSettingsPage.tsx"

# -----------------------------------------------------------------------------
# 1) Windsor trusted directory fast path.
#    These are verified Windsor-area masjid/community locations. Live map APIs
#    can still add extra places elsewhere, but Windsor must never depend on one
#    public provider returning every known masjid.
# -----------------------------------------------------------------------------
s = MOSQUES.read_text(encoding="utf-8")
marker = 'export async function findNearbyMosques(latitude: number, longitude: number) {'
if marker not in s:
    raise SystemExit('findNearbyMosques export missing')

trusted = r'''const WINDSOR_TRUSTED_MOSQUES = [
  { id: "windsor-mosque", name: "Windsor Mosque", address: "1320 Northwood St, Windsor, ON N9E 1A4, Canada", latitude: 42.27742, longitude: -83.03205 },
  { id: "wia-centre", name: "Windsor Islamic Association Centre", address: "2555 McKay Ave, Windsor, ON N9E 2P4, Canada", latitude: 42.27438, longitude: -83.03135 },
  { id: "tarbiyah-centre", name: "Tarbiyah Centre", address: "1955 Provincial Rd Unit 2 & 3, Windsor, ON N8W 5V7, Canada" },
  { id: "west-musallah", name: "West Musallah Windsor", address: "3324 Bloomfield Rd, Windsor, ON N9C 1R3, Canada" },
  { id: "rose-city", name: "Rose City Islamic Centre", address: "5420 Empress St, Windsor, ON N8T 1B4, Canada" },
  { id: "masjid-at-taqwa", name: "Masjid At-Taqwa", address: "1970 Tourangeau Rd, Windsor, ON N8W 4N3, Canada" },
  { id: "noor-ul-islam", name: "Masjid Noor-ul-Islam", address: "659 Lincoln Rd, Windsor, ON N8Y 2G8, Canada", latitude: 42.32117, longitude: -83.01546 },
  { id: "alber-mosque", name: "ALBER Mosque", address: "65 Ellis St E, Windsor, ON N8X 2G8, Canada" },
  { id: "al-hijra", name: "Al-Hijra Academy - Masjid And Islamic School", address: "5100 Howard Ave, Tecumseh, ON N9H 0M3, Canada", latitude: 42.22755, longitude: -82.9964 }
] as const;

const WINDSOR_DIRECTORY_CENTER = { latitude: 42.3149, longitude: -83.0364 };

function isWindsorDirectoryArea(latitude: number, longitude: number) {
  return distanceKm(latitude, longitude, WINDSOR_DIRECTORY_CENTER.latitude, WINDSOR_DIRECTORY_CENTER.longitude) <= 45;
}

function normalizedMosqueName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

async function resolveTrustedWindsorRows(latitude: number, longitude: number): Promise<MosqueRow[]> {
  const rows = await Promise.all(WINDSOR_TRUSTED_MOSQUES.map(async (seed) => {
    let lat = "latitude" in seed ? Number(seed.latitude) : NaN;
    let lon = "longitude" in seed ? Number(seed.longitude) : NaN;

    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      try {
        const points = await withDeadline(Location.geocodeAsync(seed.address), 2800, "WINDSOR_MOSQUE_GEOCODE_TIMEOUT");
        const point = points[0];
        lat = Number(point?.latitude);
        lon = Number(point?.longitude);
      } catch {}
    }

    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      // One final exact-address Nominatim attempt. It is independent from the
      // broad mosque directory query and only runs for a missing trusted seed.
      try {
        const params = new URLSearchParams({ format: "jsonv2", limit: "1", q: seed.address });
        const response = await fetchWithTimeout(`https://nominatim.openstreetmap.org/search?${params.toString()}`, { headers: { Accept: "application/json", "Accept-Language": "en" } }, 2200);
        if (response.ok) {
          const raw = (await response.json() as any[])[0];
          lat = Number(raw?.lat);
          lon = Number(raw?.lon);
        }
      } catch {}
    }

    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    return {
      id: `trusted:${seed.id}`,
      name: seed.name,
      displayName: seed.address,
      latitude: lat,
      longitude: lon,
      city: "Windsor",
      region: "Ontario",
      country: "Canada",
      distanceKm: distanceKm(latitude, longitude, lat, lon)
    } satisfies MosqueRow;
  }));
  return rows.filter((row): row is MosqueRow => Boolean(row));
}

async function findWindsorMosques(latitude: number, longitude: number) {
  const trusted = await withDeadline(resolveTrustedWindsorRows(latitude, longitude), 6500, "WINDSOR_DIRECTORY_TIMEOUT");
  const map = new Map<string, MosqueRow>();
  for (const row of trusted) map.set(row.id, row);

  // Quick live enrichment adds newly-mapped Windsor mosques without being able
  // to hide or replace the trusted nine above.
  try {
    const radiusMeters = 45000;
    const query = `[out:json][timeout:5];(node["amenity"="place_of_worship"]["religion"="muslim"](around:${radiusMeters},${latitude},${longitude});way["amenity"="place_of_worship"]["religion"="muslim"](around:${radiusMeters},${latitude},${longitude});relation["amenity"="place_of_worship"]["religion"="muslim"](around:${radiusMeters},${latitude},${longitude});node["building"="mosque"](around:${radiusMeters},${latitude},${longitude});way["building"="mosque"](around:${radiusMeters},${latitude},${longitude}););out center tags;`;
    const response = await fetchWithTimeout("https://overpass.kumi.systems/api/interpreter", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body: `data=${encodeURIComponent(query)}`
    }, 3200);
    if (response.ok) {
      const payload = await response.json() as { elements?: any[] };
      for (const element of payload.elements || []) {
        const lat = Number(element?.lat ?? element?.center?.lat);
        const lon = Number(element?.lon ?? element?.center?.lon);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
        const tags = element?.tags || {};
        const name = first(tags.name, tags["name:en"], tags["name:ar"], "Mosque");
        const d = distanceKm(latitude, longitude, lat, lon);
        if (d > 45) continue;
        const norm = normalizedMosqueName(name);
        const duplicate = [...map.values()].some((existing) =>
          normalizedMosqueName(existing.name) === norm || distanceKm(existing.latitude, existing.longitude, lat, lon) < 0.08
        );
        if (duplicate) continue;
        const address = [tags["addr:housenumber"], tags["addr:street"], tags["addr:city"] || tags["addr:town"], tags["addr:state"]].filter(Boolean).join(", ");
        map.set(`osm:${element?.type || "place"}:${element?.id || `${lat}:${lon}`}`, {
          id: `osm:${element?.type || "place"}:${element?.id || `${lat}:${lon}`}`,
          name,
          displayName: address || name,
          latitude: lat,
          longitude: lon,
          city: first(tags["addr:city"], tags["addr:town"], tags["addr:village"]) || undefined,
          region: first(tags["addr:state"], tags["addr:province"]) || undefined,
          country: first(tags["addr:country"]) || undefined,
          distanceKm: d
        });
      }
    }
  } catch {}

  return [...map.values()].sort((a, b) => a.distanceKm - b.distanceKm).slice(0, 50);
}

'''

if 'WINDSOR_TRUSTED_MOSQUES' not in s:
    s = s.replace(marker, trusted + marker, 1)

# Windsor fast path must happen before the slower generic multi-provider flow.
old = marker + '\n  const map = new Map<string, MosqueRow>();'
new = marker + '\n  if (isWindsorDirectoryArea(latitude, longitude)) {\n    return findWindsorMosques(latitude, longitude);\n  }\n  const map = new Map<string, MosqueRow>();'
if old in s:
    s = s.replace(old, new, 1)
elif 'return findWindsorMosques(latitude, longitude);' not in s:
    raise SystemExit('Could not add Windsor fast path')

MOSQUES.write_text(s, encoding="utf-8")

# -----------------------------------------------------------------------------
# 2) Persist SettingsHub nested page so Android process/activity recreation does
#    not send Permissions / Prayer Calculation / other settings pages to root.
# -----------------------------------------------------------------------------
h = HUB.read_text(encoding="utf-8")
if 'from "@react-native-async-storage/async-storage"' not in h:
    h = 'import AsyncStorage from "@react-native-async-storage/async-storage";\n' + h

state = '  const [page, setPage] = useState<SettingsPage>("root");'
if state not in h:
    raise SystemExit('SettingsHub page state missing')
if 'settingsRouteReady' not in h:
    h = h.replace(state, state + '\n  const [settingsRouteReady, setSettingsRouteReady] = useState(false);', 1)

anchor = '  const [readerOpen, setReaderOpen] = useState(false);'
if anchor not in h:
    raise SystemExit('SettingsHub route effect anchor missing')
if 'HASSOUN_SETTINGS_NESTED_RESUME_V1' not in h:
    effects = '''  // HASSOUN_SETTINGS_NESTED_RESUME_V1
  useEffect(() => {
    let alive = true;
    void AsyncStorage.getItem("hassoun:settings-nested-route:v1")
      .then((saved) => {
        if (alive && saved) setPage(saved as SettingsPage);
      })
      .finally(() => { if (alive) setSettingsRouteReady(true); });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!settingsRouteReady) return;
    void AsyncStorage.setItem("hassoun:settings-nested-route:v1", page).catch(() => undefined);
  }, [page, settingsRouteReady]);

'''
    h = h.replace(anchor, anchor + '\n\n' + effects, 1)

HUB.write_text(h, encoding="utf-8")

# -----------------------------------------------------------------------------
# 3) Persist the child route inside Prayer Calculation (Mosques Near Me).
#    If Android kills the activity while this page is backgrounded, reopening
#    returns to Mosques Near Me rather than Prayer Calculation/Home.
# -----------------------------------------------------------------------------
p = CALC.read_text(encoding="utf-8")
if 'from "@react-native-async-storage/async-storage"' not in p:
    p = 'import AsyncStorage from "@react-native-async-storage/async-storage";\n' + p

mosque_state = re.search(r'^(\s*)const \[mosquesOpen, setMosquesOpen\] = useState\(false\);', p, re.M)
if not mosque_state:
    raise SystemExit('mosquesOpen state missing')
if 'mosquesRouteReady' not in p:
    line = mosque_state.group(0)
    p = p.replace(line, line + '\n' + mosque_state.group(1) + 'const [mosquesRouteReady, setMosquesRouteReady] = useState(false);', 1)

if 'HASSOUN_MOSQUES_CHILD_RESUME_V1' not in p:
    # Insert before the first existing effect in the component.
    component = p.find('export default function PrayerCalculationSettingsPage')
    pos = p.find('  useEffect(() => {', component)
    if pos < 0:
        raise SystemExit('Prayer Calculation useEffect anchor missing')
    block = '''  // HASSOUN_MOSQUES_CHILD_RESUME_V1
  useEffect(() => {
    let alive = true;
    void AsyncStorage.getItem("hassoun:prayer-calc-child-route:v1")
      .then((saved) => { if (alive && saved === "mosques") setMosquesOpen(true); })
      .finally(() => { if (alive) setMosquesRouteReady(true); });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!mosquesRouteReady) return;
    void AsyncStorage.setItem("hassoun:prayer-calc-child-route:v1", mosquesOpen ? "mosques" : "calculation").catch(() => undefined);
  }, [mosquesOpen, mosquesRouteReady]);

'''
    p = p[:pos] + block + p[pos:]

CALC.write_text(p, encoding="utf-8")

# Final invariants.
checks = {
    MOSQUES: [
        'WINDSOR_TRUSTED_MOSQUES', 'Windsor Mosque', 'Windsor Islamic Association Centre',
        'Tarbiyah Centre', 'West Musallah Windsor', 'Rose City Islamic Centre',
        'Masjid At-Taqwa', 'Masjid Noor-ul-Islam', 'ALBER Mosque', 'Al-Hijra Academy',
        'return findWindsorMosques(latitude, longitude);'
    ],
    HUB: ['HASSOUN_SETTINGS_NESTED_RESUME_V1', 'hassoun:settings-nested-route:v1', 'settingsRouteReady'],
    CALC: ['HASSOUN_MOSQUES_CHILD_RESUME_V1', 'hassoun:prayer-calc-child-route:v1', 'mosquesRouteReady']
}
for path, needles in checks.items():
    text = path.read_text(encoding="utf-8")
    for needle in needles:
        if needle not in text:
            raise SystemExit(f'Missing v1.0.43 marker {needle!r} in {path}')

print('HASSOUN_V1043_WINDSOR_DIRECTORY_AND_NESTED_RESUME_APPLIED')
