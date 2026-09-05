from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
NOTIFICATIONS = ROOT / "mobile/src/notifications.ts"

text = NOTIFICATIONS.read_text(encoding="utf-8")

# Prayer reminder notifications must never display the generic "Current location"
# when the app can resolve a real city from the phone's latest coordinates.
if 'import * as Location from "expo-location";' not in text:
    text = text.replace(
        'import * as Notifications from "expo-notifications";\n',
        'import * as Notifications from "expo-notifications";\nimport * as Location from "expo-location";\n',
        1,
    )

helper_anchor = 'function notificationContent(event: PrayerEvent, locale: "en" | "ar", locationLabel = "Windsor, Ontario") {'
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
    // Keep the supplied label if Android cannot resolve a city at scheduling time.
  }
  return locationLabel;
}

'''
if 'resolvePrayerNotificationLocationLabel' not in text:
    if helper_anchor not in text:
        raise SystemExit('Could not find notificationContent anchor')
    text = text.replace(helper_anchor, helpers + helper_anchor, 1)

schedule_anchor = '''  const preferences = suppliedPreferences ?? await loadPhonePrayerAlertPreferences();
  const days = Platform.OS === "ios" ? 4 : 14;'''
schedule_replacement = '''  const preferences = suppliedPreferences ?? await loadPhonePrayerAlertPreferences();
  const resolvedLocationLabel = await resolvePrayerNotificationLocationLabel(locationLabel);
  const days = Platform.OS === "ios" ? 4 : 14;'''
if schedule_anchor in text:
    text = text.replace(schedule_anchor, schedule_replacement, 1)
elif 'const resolvedLocationLabel = await resolvePrayerNotificationLocationLabel(locationLabel);' not in text:
    raise SystemExit('Could not install resolved notification city label')

old_content = 'content: notificationContent(event, locale, locationLabel),'
new_content = 'content: notificationContent(event, locale, resolvedLocationLabel),'
if old_content in text:
    text = text.replace(old_content, new_content, 1)
elif new_content not in text:
    raise SystemExit('Could not route prayer notifications through resolved city label')

NOTIFICATIONS.write_text(text, encoding="utf-8")

checks = [
    'import * as Location from "expo-location";',
    'resolvePrayerNotificationLocationLabel',
    'Location.reverseGeocodeAsync',
    'const resolvedLocationLabel = await resolvePrayerNotificationLocationLabel(locationLabel);',
    'notificationContent(event, locale, resolvedLocationLabel)',
    'NOTIFICATION_GEOCODE_TIMEOUT',
]
written = NOTIFICATIONS.read_text(encoding="utf-8")
for needle in checks:
    if needle not in written:
        raise SystemExit(f'Missing notification city-label fix: {needle}')

print('Applied prayer notification city-label resolution for 20m, 10m, and prayer-time alerts')
