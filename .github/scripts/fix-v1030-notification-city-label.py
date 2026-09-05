from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[2]
NOTIFICATIONS = ROOT / "mobile/src/notifications.ts"

text = NOTIFICATIONS.read_text(encoding="utf-8")

# Prayer reminder notifications must never display generic "Current location"
# when a real city can be resolved from the phone's latest coordinates.
if 'import * as Location from "expo-location";' not in text:
    notif_import = 'import * as Notifications from "expo-notifications";\n'
    if notif_import not in text:
        raise SystemExit('Could not find expo-notifications import')
    text = text.replace(
        notif_import,
        notif_import + 'import * as Location from "expo-location";\n',
        1,
    )

helpers = r'''function isGenericPrayerLocationLabel(value: string) {
  const normalized = value.trim().toLowerCase();
  return !normalized || normalized === "current location" || normalized === "location";
}

async function resolvePrayerNotificationLocationLabel(locationLabel: string) {
  if (!isGenericPrayerLocationLabel(locationLabel)) return locationLabel;
  try {
    const permission = await Location.getForegroundPermissionsAsync();
    if (!permission.granted) return locationLabel;

    const last = await Location.getLastKnownPositionAsync();
    if (!last) return locationLabel;

    const places = await Promise.race([
      Location.reverseGeocodeAsync({
        latitude: last.coords.latitude,
        longitude: last.coords.longitude
      }),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("NOTIFICATION_GEOCODE_TIMEOUT")), 2500))
    ]);
    const place = places[0];
    const city = place?.city || place?.subregion;
    const region = place?.region;
    const country = place?.country;
    if (city && region) return `${city}, ${region}`;
    if (city && country) return `${city}, ${country}`;
    if (city) return city;
  } catch {
    // Keep the supplied label only if Android truly cannot resolve a city.
  }
  return locationLabel;
}

'''
if 'resolvePrayerNotificationLocationLabel' not in text:
    marker = 'function notificationContent('
    at = text.find(marker)
    if at < 0:
        raise SystemExit('Could not find notificationContent function')
    text = text[:at] + helpers + text[at:]

preferences_line = '  const preferences = suppliedPreferences ?? await loadPhonePrayerAlertPreferences();'
resolved_line = '  const resolvedLocationLabel = await resolvePrayerNotificationLocationLabel(locationLabel);'
if resolved_line not in text:
    if preferences_line not in text:
        raise SystemExit('Could not find prayer notification preferences line')
    text = text.replace(preferences_line, preferences_line + '\n' + resolved_line, 1)

# Route every scheduled 20m/10m/prayer-time notification through the resolved city.
new_text, count = re.subn(
    r'notificationContent\(event,\s*locale,\s*locationLabel\)',
    'notificationContent(event, locale, resolvedLocationLabel)',
    text,
    count=1,
)
if count:
    text = new_text
elif 'notificationContent(event, locale, resolvedLocationLabel)' not in text:
    raise SystemExit('Could not route prayer notifications through resolved city label')

NOTIFICATIONS.write_text(text, encoding="utf-8")

checks = [
    'import * as Location from "expo-location";',
    'resolvePrayerNotificationLocationLabel',
    'Location.reverseGeocodeAsync',
    resolved_line,
    'notificationContent(event, locale, resolvedLocationLabel)',
    'NOTIFICATION_GEOCODE_TIMEOUT',
]
written = NOTIFICATIONS.read_text(encoding="utf-8")
for needle in checks:
    if needle not in written:
        raise SystemExit(f'Missing notification city-label fix: {needle}')

print('Applied prayer notification city-label resolution for 20m, 10m, and prayer-time alerts')
