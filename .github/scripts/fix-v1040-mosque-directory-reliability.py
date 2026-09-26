from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
MOSQUES = ROOT / "mobile/src/NearbyMosquesPage.tsx"

if not MOSQUES.exists():
    raise SystemExit("v1.0.40 requires NearbyMosquesPage.tsx to exist first")

mosques = MOSQUES.read_text(encoding="utf-8")
start = mosques.find("async function findNearbyMosques(latitude: number, longitude: number) {")
end = mosques.find("\n}\n\nexport default function NearbyMosquesPage", start)
if start < 0 or end < 0:
    raise SystemExit("Could not locate findNearbyMosques() for v1.0.40")

new_find = r'''async function findNearbyMosques(latitude: number, longitude: number) {
  const map = new Map<string, MosqueRow>();
  const radiusMeters = 30000;
  let providerSucceeded = false;

  const addOsmElement = (element: any) => {
    const lat = Number(element?.lat ?? element?.center?.lat);
    const lon = Number(element?.lon ?? element?.center?.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
    const tags = element?.tags || {};
    const name = first(tags.name, tags["name:en"], tags["name:ar"], "Mosque");
    const street = first(tags["addr:street"]);
    const number = first(tags["addr:housenumber"]);
    const city = first(tags["addr:city"], tags["addr:town"], tags["addr:village"], tags["addr:suburb"]);
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
    if (row.distanceKm <= 30) {
      const duplicate = [...map.values()].some((item) =>
        Math.abs(item.latitude - row.latitude) < 0.00008 && Math.abs(item.longitude - row.longitude) < 0.00008
      );
      if (!duplicate) map.set(row.id, row);
    }
  };

  const overpassQuery = `[out:json][timeout:16];(
    node["amenity"="place_of_worship"]["religion"="muslim"](around:${radiusMeters},${latitude},${longitude});
    way["amenity"="place_of_worship"]["religion"="muslim"](around:${radiusMeters},${latitude},${longitude});
    relation["amenity"="place_of_worship"]["religion"="muslim"](around:${radiusMeters},${latitude},${longitude});
    node["building"="mosque"](around:${radiusMeters},${latitude},${longitude});
    way["building"="mosque"](around:${radiusMeters},${latitude},${longitude});
    relation["building"="mosque"](around:${radiusMeters},${latitude},${longitude});
    node["name"~"mosque|masjid|islamic centre|islamic center|مسجد|جامع",i](around:${radiusMeters},${latitude},${longitude});
    way["name"~"mosque|masjid|islamic centre|islamic center|مسجد|جامع",i](around:${radiusMeters},${latitude},${longitude});
    relation["name"~"mosque|masjid|islamic centre|islamic center|مسجد|جامع",i](around:${radiusMeters},${latitude},${longitude});
  );out center tags;`;

  // Try more than one public Overpass instance. One overloaded instance should
  // never turn into a false "no mosques" result for the user.
  const overpassEndpoints = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter"
  ];

  for (const endpoint of overpassEndpoints) {
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
        body: `data=${encodeURIComponent(overpassQuery)}`
      });
      if (!response.ok) continue;
      const payload = await response.json() as { elements?: any[] };
      providerSucceeded = true;
      for (const element of payload.elements || []) addOsmElement(element);
      if (map.size >= 8) break;
    } catch {}
  }

  // Nominatim is a separate fallback and also enriches sparse Overpass results.
  if (map.size < 8) {
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

    const latSpan = 0.32;
    const lonSpan = 0.42;
    const left = longitude - lonSpan;
    const right = longitude + lonSpan;
    const top = latitude + latSpan;
    const bottom = latitude - latSpan;
    const where = [city, region, country].filter(Boolean).join(" ");
    const terms = ["mosque", "masjid", "islamic centre", "islamic center", "مسجد", "جامع"];

    for (const word of terms) {
      if (map.size >= 25) break;
      try {
        const params = new URLSearchParams({
          format: "jsonv2",
          addressdetails: "1",
          namedetails: "1",
          limit: "50",
          q: [word, where].filter(Boolean).join(" "),
          viewbox: `${left},${top},${right},${bottom}`,
          bounded: "1"
        });
        const response = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`, {
          headers: { Accept: "application/json", "Accept-Language": "en,ar;q=0.9" }
        });
        if (!response.ok) continue;
        const rows = await response.json() as any[];
        providerSucceeded = true;
        for (const raw of rows) {
          const normalized = normalize(raw, latitude, longitude);
          if (!normalized || normalized.distanceKm > 30) continue;
          const duplicate = [...map.values()].some((item) =>
            Math.abs(item.latitude - normalized.latitude) < 0.00008 && Math.abs(item.longitude - normalized.longitude) < 0.00008
          );
          if (!duplicate) map.set(normalized.id, normalized);
        }
      } catch {}
    }
  }

  if (!providerSucceeded) {
    throw new Error("MOSQUE_DIRECTORY_UNAVAILABLE");
  }

  return [...map.values()]
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, 40);
}'''

mosques = mosques[:start] + new_find + mosques[end + 2:]

for needle in [
    'overpass.kumi.systems/api/interpreter',
    'MOSQUE_DIRECTORY_UNAVAILABLE',
    'islamic centre',
    'bounded: "1"',
    'providerSucceeded',
]:
    if needle not in mosques:
        raise SystemExit(f"Missing v1.0.40 mosque reliability marker: {needle}")

MOSQUES.write_text(mosques, encoding="utf-8")
print("HASSOUN_V1040_MOSQUE_DIRECTORY_RELIABILITY_APPLIED")
