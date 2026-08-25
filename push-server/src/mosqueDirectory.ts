import { requireAdmin } from "./adminAuth";
import type { Env } from "./types";

type MosqueCandidate = {
  name: string;
  address?: string;
  latitude: number;
  longitude: number;
  phone?: string;
  websiteUrl?: string;
  mapsUrl?: string;
  googlePlaceId?: string;
  osmType?: string;
  osmId?: string;
  source: "google" | "osm" | "directory";
};

type MosqueRow = MosqueCandidate & {
  publicId: string;
  city?: string;
  region?: string;
  countryCode?: string;
  countryName?: string;
  verificationStatus: string;
  timetableUrl?: string;
  timetableSourceType: string;
  calculationMethod?: number | null;
  madhab: string;
  lastVerifiedAt?: string | null;
  active: number;
  distanceKm?: number;
  hasVerifiedSchedule?: boolean;
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}

function finite(value: string | null, min: number, max: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= min && parsed <= max ? parsed : null;
}

function clean(value: unknown, max = 300) {
  return String(value ?? "").trim().slice(0, max);
}

function publicId() {
  return `mosque_${crypto.randomUUID().replace(/-/g, "")}`;
}

function haversine(lat1: number, lon1: number, lat2: number, lon2: number) {
  const rad = (value: number) => value * Math.PI / 180;
  const dLat = rad(lat2 - lat1);
  const dLon = rad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function directoryMosques(env: Env, lat: number, lng: number, radiusKm: number) {
  const latSpan = radiusKm / 111;
  const lngSpan = radiusKm / Math.max(20, 111 * Math.cos(lat * Math.PI / 180));
  const { results } = await env.DB.prepare(
    `SELECT m.public_id, m.name, m.address, m.city, m.region, m.country_code, m.country_name,
            m.latitude, m.longitude, m.phone, m.website_url, m.maps_url, m.google_place_id,
            m.osm_type, m.osm_id, m.discovery_source, m.verification_status, m.timetable_url,
            m.timetable_source_type, m.calculation_method, m.madhab, m.last_verified_at, m.active,
            EXISTS(
              SELECT 1 FROM mosque_prayer_times t
              WHERE t.mosque_id = m.id AND t.verified = 1 AND t.prayer_date >= date('now')
            ) AS has_verified_schedule
     FROM mosques m
     WHERE m.active = 1
       AND m.latitude BETWEEN ? AND ?
       AND m.longitude BETWEEN ? AND ?`
  ).bind(lat - latSpan, lat + latSpan, lng - lngSpan, lng + lngSpan).all<Record<string, unknown>>();

  return results.map((row) => ({
    publicId: String(row.public_id),
    name: String(row.name),
    address: row.address ? String(row.address) : undefined,
    city: row.city ? String(row.city) : undefined,
    region: row.region ? String(row.region) : undefined,
    countryCode: row.country_code ? String(row.country_code) : undefined,
    countryName: row.country_name ? String(row.country_name) : undefined,
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    phone: row.phone ? String(row.phone) : undefined,
    websiteUrl: row.website_url ? String(row.website_url) : undefined,
    mapsUrl: row.maps_url ? String(row.maps_url) : undefined,
    googlePlaceId: row.google_place_id ? String(row.google_place_id) : undefined,
    osmType: row.osm_type ? String(row.osm_type) : undefined,
    osmId: row.osm_id ? String(row.osm_id) : undefined,
    source: "directory" as const,
    verificationStatus: String(row.verification_status),
    timetableUrl: row.timetable_url ? String(row.timetable_url) : undefined,
    timetableSourceType: String(row.timetable_source_type),
    calculationMethod: row.calculation_method == null ? null : Number(row.calculation_method),
    madhab: String(row.madhab),
    lastVerifiedAt: row.last_verified_at ? String(row.last_verified_at) : null,
    active: Number(row.active),
    hasVerifiedSchedule: Number(row.has_verified_schedule) === 1,
    distanceKm: haversine(lat, lng, Number(row.latitude), Number(row.longitude))
  })).filter((mosque) => (mosque.distanceKm ?? Infinity) <= radiusKm) as MosqueRow[];
}

async function googleNearby(env: Env, lat: number, lng: number, radiusKm: number): Promise<MosqueCandidate[]> {
  if (!env.GOOGLE_MAPS_API_KEY) return [];
  const response = await fetch("https://places.googleapis.com/v1/places:searchNearby", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": env.GOOGLE_MAPS_API_KEY,
      "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.location,places.websiteUri,places.nationalPhoneNumber,places.googleMapsUri"
    },
    body: JSON.stringify({
      includedTypes: ["mosque"],
      maxResultCount: 20,
      rankPreference: "DISTANCE",
      locationRestriction: {
        circle: { center: { latitude: lat, longitude: lng }, radius: Math.min(radiusKm * 1000, 50000) }
      }
    })
  });
  if (!response.ok) {
    console.error("Google mosque discovery failed", response.status, (await response.text()).slice(0, 500));
    return [];
  }
  const payload = await response.json() as { places?: Array<Record<string, unknown>> };
  return (payload.places ?? []).flatMap((place) => {
    const location = place.location as { latitude?: unknown; longitude?: unknown } | undefined;
    const displayName = place.displayName as { text?: unknown } | undefined;
    const latitude = Number(location?.latitude);
    const longitude = Number(location?.longitude);
    const name = clean(displayName?.text, 180);
    if (!name || !Number.isFinite(latitude) || !Number.isFinite(longitude)) return [];
    return [{
      name,
      address: clean(place.formattedAddress, 300) || undefined,
      latitude,
      longitude,
      phone: clean(place.nationalPhoneNumber, 80) || undefined,
      websiteUrl: clean(place.websiteUri, 500) || undefined,
      mapsUrl: clean(place.googleMapsUri, 500) || undefined,
      googlePlaceId: clean(place.id, 200) || undefined,
      source: "google" as const
    }];
  });
}

async function osmNearby(lat: number, lng: number, radiusKm: number): Promise<MosqueCandidate[]> {
  const radiusM = Math.min(Math.max(radiusKm * 1000, 1000), 50000);
  const query = `[out:json][timeout:12];(node[\"amenity\"=\"place_of_worship\"][\"religion\"=\"muslim\"](around:${radiusM},${lat},${lng});way[\"amenity\"=\"place_of_worship\"][\"religion\"=\"muslim\"](around:${radiusM},${lat},${lng});relation[\"amenity\"=\"place_of_worship\"][\"religion\"=\"muslim\"](around:${radiusM},${lat},${lng}););out center tags 40;`;
  const response = await fetch(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`, { headers: { Accept: "application/json" } });
  if (!response.ok) return [];
  const payload = await response.json() as { elements?: Array<Record<string, unknown>> };
  return (payload.elements ?? []).flatMap((element) => {
    const tags = (element.tags ?? {}) as Record<string, unknown>;
    const center = element.center as { lat?: unknown; lon?: unknown } | undefined;
    const latitude = Number(element.lat ?? center?.lat);
    const longitude = Number(element.lon ?? center?.lon);
    const name = clean(tags.name ?? tags["name:en"] ?? tags["name:ar"], 180);
    if (!name || !Number.isFinite(latitude) || !Number.isFinite(longitude)) return [];
    const street = clean(tags["addr:street"], 120);
    const number = clean(tags["addr:housenumber"], 30);
    const city = clean(tags["addr:city"], 120);
    const address = [number, street, city].filter(Boolean).join(" ");
    const websiteUrl = clean(tags.website ?? tags["contact:website"], 500) || undefined;
    return [{
      name,
      address: address || undefined,
      latitude,
      longitude,
      phone: clean(tags.phone ?? tags["contact:phone"], 80) || undefined,
      websiteUrl,
      osmType: clean(element.type, 20) || undefined,
      osmId: clean(element.id, 40) || undefined,
      source: "osm" as const
    }];
  });
}

async function upsertDiscovered(env: Env, candidate: MosqueCandidate) {
  if (candidate.googlePlaceId) {
    await env.DB.prepare(
      `INSERT INTO mosques (public_id, name, address, latitude, longitude, phone, website_url, maps_url, google_place_id, discovery_source)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'google')
       ON CONFLICT(google_place_id) DO UPDATE SET
         name=excluded.name, address=COALESCE(excluded.address, mosques.address), latitude=excluded.latitude,
         longitude=excluded.longitude, phone=COALESCE(excluded.phone, mosques.phone), website_url=COALESCE(excluded.website_url, mosques.website_url),
         maps_url=COALESCE(excluded.maps_url, mosques.maps_url), last_discovered_at=CURRENT_TIMESTAMP, updated_at=CURRENT_TIMESTAMP`
    ).bind(publicId(), candidate.name, candidate.address ?? null, candidate.latitude, candidate.longitude, candidate.phone ?? null, candidate.websiteUrl ?? null, candidate.mapsUrl ?? null, candidate.googlePlaceId).run();
    return;
  }
  if (candidate.osmId) {
    await env.DB.prepare(
      `INSERT INTO mosques (public_id, name, address, latitude, longitude, phone, website_url, osm_type, osm_id, discovery_source)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'osm')
       ON CONFLICT(osm_type, osm_id) DO UPDATE SET
         name=excluded.name, address=COALESCE(excluded.address, mosques.address), latitude=excluded.latitude,
         longitude=excluded.longitude, phone=COALESCE(excluded.phone, mosques.phone), website_url=COALESCE(excluded.website_url, mosques.website_url),
         last_discovered_at=CURRENT_TIMESTAMP, updated_at=CURRENT_TIMESTAMP`
    ).bind(publicId(), candidate.name, candidate.address ?? null, candidate.latitude, candidate.longitude, candidate.phone ?? null, candidate.websiteUrl ?? null, candidate.osmType ?? null, candidate.osmId).run();
  }
}

export async function nearbyMosques(env: Env, url: URL) {
  const lat = finite(url.searchParams.get("lat"), -90, 90);
  const lng = finite(url.searchParams.get("lng"), -180, 180);
  if (lat == null || lng == null) return json({ error: "Valid lat and lng are required" }, 400);
  const radiusKm = Math.min(50, Math.max(2, Number(url.searchParams.get("radiusKm") ?? 15) || 15));

  let directory = await directoryMosques(env, lat, lng, radiusKm);
  const google = await googleNearby(env, lat, lng, radiusKm);
  let discoverySource: "google" | "osm" | "directory" = google.length ? "google" : "directory";
  let discovered = google;

  if (!discovered.length) {
    discovered = await osmNearby(lat, lng, radiusKm).catch(() => []);
    if (discovered.length) discoverySource = "osm";
  }

  if (discovered.length) {
    await Promise.all(discovered.map((candidate) => upsertDiscovered(env, candidate).catch((error) => console.error("Mosque upsert failed", error))));
    directory = await directoryMosques(env, lat, lng, radiusKm);
  }

  directory.sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity));
  return json({
    ok: true,
    discoverySource,
    googleConfigured: Boolean(env.GOOGLE_MAPS_API_KEY),
    radiusKm,
    mosques: directory.slice(0, 30)
  });
}

export async function listAdminMosques(request: Request, env: Env, url: URL) {
  const auth = await requireAdmin(request, env);
  if (!auth.admin) return auth.response!;
  const q = clean(url.searchParams.get("q"), 100);
  const status = clean(url.searchParams.get("status"), 30);
  const like = `%${q.replace(/[%_]/g, "")}%`;
  const { results } = await env.DB.prepare(
    `SELECT public_id, name, address, city, region, country_code, country_name, latitude, longitude, phone,
            website_url, maps_url, google_place_id, osm_type, osm_id, discovery_source, verification_status,
            active, timetable_url, timetable_source_type, calculation_method, madhab, last_verified_at,
            last_discovered_at, created_at, updated_at
     FROM mosques
     WHERE (? = '' OR verification_status = ?)
       AND (? = '' OR name LIKE ? COLLATE NOCASE OR COALESCE(address,'') LIKE ? COLLATE NOCASE OR COALESCE(city,'') LIKE ? COLLATE NOCASE)
     ORDER BY CASE verification_status WHEN 'verified' THEN 0 WHEN 'pending' THEN 1 ELSE 2 END, updated_at DESC
     LIMIT 500`
  ).bind(status, status, q, like, like, like).all<Record<string, unknown>>();
  return json({ ok: true, mosques: results });
}

export async function upsertAdminMosque(request: Request, env: Env) {
  const auth = await requireAdmin(request, env);
  if (!auth.admin) return auth.response!;
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return json({ error: "Invalid request" }, 400);

  const existingPublicId = clean(body.publicId, 100);
  const name = clean(body.name, 180);
  const latitude = Number(body.latitude);
  const longitude = Number(body.longitude);
  if (!name || !Number.isFinite(latitude) || !Number.isFinite(longitude)) return json({ error: "Name and coordinates are required" }, 400);
  const status = ["discovered", "pending", "verified", "rejected"].includes(String(body.verificationStatus)) ? String(body.verificationStatus) : "pending";
  const sourceType = ["unknown", "adhan", "iqamah", "both"].includes(String(body.timetableSourceType)) ? String(body.timetableSourceType) : "unknown";
  const madhab = body.madhab === "hanafi" ? "hanafi" : "standard";
  const id = existingPublicId || publicId();

  await env.DB.prepare(
    `INSERT INTO mosques (
       public_id, name, address, city, region, country_code, country_name, latitude, longitude, phone, website_url,
       maps_url, discovery_source, verification_status, active, timetable_url, timetable_source_type, calculation_method,
       madhab, last_verified_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'manual', ?, ?, ?, ?, ?, ?, CASE WHEN ? = 'verified' THEN CURRENT_TIMESTAMP ELSE NULL END)
     ON CONFLICT(public_id) DO UPDATE SET
       name=excluded.name, address=excluded.address, city=excluded.city, region=excluded.region,
       country_code=excluded.country_code, country_name=excluded.country_name, latitude=excluded.latitude,
       longitude=excluded.longitude, phone=excluded.phone, website_url=excluded.website_url, maps_url=excluded.maps_url,
       verification_status=excluded.verification_status, active=excluded.active, timetable_url=excluded.timetable_url,
       timetable_source_type=excluded.timetable_source_type, calculation_method=excluded.calculation_method,
       madhab=excluded.madhab, last_verified_at=CASE WHEN excluded.verification_status='verified' THEN COALESCE(mosques.last_verified_at,CURRENT_TIMESTAMP) ELSE mosques.last_verified_at END,
       updated_at=CURRENT_TIMESTAMP`
  ).bind(
    id, name, clean(body.address, 300) || null, clean(body.city, 120) || null, clean(body.region, 120) || null,
    clean(body.countryCode, 8) || null, clean(body.countryName, 120) || null, latitude, longitude,
    clean(body.phone, 80) || null, clean(body.websiteUrl, 500) || null, clean(body.mapsUrl, 500) || null,
    status, body.active === false ? 0 : 1, clean(body.timetableUrl, 500) || null, sourceType,
    Number.isFinite(Number(body.calculationMethod)) ? Number(body.calculationMethod) : null, madhab, status
  ).run();
  return json({ ok: true, publicId: id });
}

export async function suggestMosque(request: Request, env: Env) {
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return json({ error: "Invalid request" }, 400);
  const name = clean(body.name, 180);
  if (!name) return json({ error: "Mosque name is required" }, 400);
  const id = `suggest_${crypto.randomUUID().replace(/-/g, "")}`;
  const latitude = Number(body.latitude);
  const longitude = Number(body.longitude);
  await env.DB.prepare(
    `INSERT INTO mosque_suggestions (public_id, name, address, latitude, longitude, website_url, timetable_url, submitted_by_email)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(id, name, clean(body.address, 300) || null, Number.isFinite(latitude) ? latitude : null, Number.isFinite(longitude) ? longitude : null, clean(body.websiteUrl, 500) || null, clean(body.timetableUrl, 500) || null, clean(body.email, 254) || null).run();
  return json({ ok: true, publicId: id });
}
