import * as Location from "expo-location";

export type DetectedPrayerLocation = {
  latitude: number;
  longitude: number;
  city?: string | null;
  region?: string | null;
  countryCode?: string | null;
  countryName?: string | null;
  timezone: string;
};

function deviceTimeZone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

export async function detectPrayerLocation(): Promise<DetectedPrayerLocation | null> {
  const permission = await Location.requestForegroundPermissionsAsync();
  if (!permission.granted) return null;

  const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
  const latitude = position.coords.latitude;
  const longitude = position.coords.longitude;

  let city: string | null = null;
  let region: string | null = null;
  let countryCode: string | null = null;
  let countryName: string | null = null;
  try {
    const places = await Location.reverseGeocodeAsync({ latitude, longitude });
    const place = places[0];
    city = place?.city || place?.subregion || null;
    region = place?.region || null;
    countryCode = place?.isoCountryCode || null;
    countryName = place?.country || null;
  } catch {
    // Coordinates and timezone remain enough to calculate accurate prayer times.
  }

  return {
    latitude,
    longitude,
    city,
    region,
    countryCode,
    countryName,
    timezone: deviceTimeZone()
  };
}
