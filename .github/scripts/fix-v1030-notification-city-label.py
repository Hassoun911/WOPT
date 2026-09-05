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

resolved_line = '  const resolvedLocationLabel = await resolvePrayerNotificationLocationLabel(locationLabel);'
if resolved_line not in text:
    # In the reconstructed source, locationLabel is derived from the notification context.
    # Insert resolution only AFTER that local variable exists.
    location_line = '  const locationLabel = context.locationLabel || CITY_LABEL;'
    if location_line in text:
        text = text.replace(location_line, location_line + '\n' + resolved_line, 1)
    else:
        # Compatibility path for older generated signatures where locationLabel is a parameter.
        function_start = text.find('async function schedulePrayerNotificationsUnlocked(')
        if function_start < 0:
            raise SystemExit('Could not find schedulePrayerNotificationsUnlocked')
        body_start = text.find('{', function_start)
        if body_start < 0:
            raise SystemExit('Could not find prayer notification function body')
        preferences_line = '  const preferences = suppliedPreferences ?? await loadPhonePrayerAlertPreferences();'
        pref_at = text.find(preferences_line, body_start)
        if pref_at < 0:
            raise SystemExit('Could not find prayer notification preferences line')
        # Only use this fallback when locationLabel is actually part of the function signature.
        signature = text[function_start:body_start]
        if 'locationLabel' not in signature:
            raise SystemExit('locationLabel is neither a context local nor a function parameter')
        insert_at = pref_at + len(preferences_line)
        text = text[:insert_at] + '\n' + resolved_line + text[insert_at:]

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

# Build-time ordering guard: resolvedLocationLabel must come after locationLabel declaration
# when the context-local form is present.
loc_decl = text.find('const locationLabel = context.locationLabel || CITY_LABEL;')
resolved_decl = text.find('const resolvedLocationLabel = await resolvePrayerNotificationLocationLabel(locationLabel);')
if loc_decl >= 0 and (resolved_decl < 0 or resolved_decl <= loc_decl):
    raise SystemExit('Notification city label is resolved before locationLabel is declared')

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

print('Applied prayer notification city-label resolution after locationLabel declaration')
