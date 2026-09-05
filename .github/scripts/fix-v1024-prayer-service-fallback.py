from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[2]
PRAYER_DATA = ROOT / "mobile/src/prayerData.ts"
CONFIG = ROOT / "mobile/app.config.ts"

prayer = PRAYER_DATA.read_text(encoding="utf-8")
cfg = CONFIG.read_text(encoding="utf-8")

# Add direct AlAdhan response types used when our Worker is unavailable.
anchor = '''type CachedLocationPayload = {
  prayerTimes: PrayerTimes;
  location: PrayerLocation;
  savedAt: string;
};'''
extra_types = '''type AlAdhanDay = {
  timings?: Record<string, string>;
  date?: { gregorian?: { date?: string } };
  meta?: { timezone?: string };
};
type AlAdhanResponse = { code?: number; data?: AlAdhanDay[] };

'''
if 'type AlAdhanResponse' not in prayer:
    if anchor not in prayer:
        raise SystemExit('Could not find prayer data type anchor')
    prayer = prayer.replace(anchor, anchor + '\n\n' + extra_types, 1)

# Direct parser helpers.
helper_anchor = 'async function fetchMonth(latitude: number, longitude: number, timezone: string, year: number, month: number) {'
helpers = '''function parseAlAdhanTiming(value: unknown) {
  if (typeof value !== "string") return null;
  const match = value.match(/^(\\d{1,2}):(\\d{2})/);
  return match ? `${match[1].padStart(2, "0")}:${match[2]}` : null;
}

function alAdhanDateKey(value: unknown) {
  if (typeof value !== "string") return null;
  const match = value.match(/^(\\d{2})-(\\d{2})-(\\d{4})$/);
  return match ? `${match[3]}-${match[2]}-${match[1]}` : null;
}

'''
if 'function parseAlAdhanTiming' not in prayer:
    if helper_anchor not in prayer:
        raise SystemExit('Could not find fetchMonth anchor')
    prayer = prayer.replace(helper_anchor, helpers + helper_anchor, 1)

# Replace fetchMonth with Worker-first, direct-AlAdhan-second behavior.
fetch_pattern = re.compile(r'async function fetchMonth\(latitude: number, longitude: number, timezone: string, year: number, month: number\) \{.*?\n\}', re.S)
match = fetch_pattern.search(prayer)
if not match:
    raise SystemExit('Could not locate fetchMonth implementation')
new_fetch = '''async function fetchMonth(latitude: number, longitude: number, timezone: string, year: number, month: number): Promise<PrayerApiResponse> {
  // Try Hassoun Worker first, but never make location refresh depend on it.
  try {
    const url = new URL(PRAYER_API_URL);
    url.searchParams.set("lat", String(latitude));
    url.searchParams.set("lng", String(longitude));
    url.searchParams.set("timezone", timezone);
    url.searchParams.set("year", String(year));
    url.searchParams.set("month", String(month));
    url.searchParams.set("method", "3");
    url.searchParams.set("school", "0");
    const response = await fetch(url.toString(), { headers: { Accept: "application/json" } });
    if (response.ok) {
      const data = await response.json() as PrayerApiResponse;
      if (isPrayerTimes(data.prayer_times)) return data;
    }
  } catch {
    // Fall through to direct provider.
  }

  // Direct provider fallback. This keeps travel/local prayer refresh working even if
  // the Hassoun Worker is temporarily unavailable.
  const direct = new URL(`https://api.aladhan.com/v1/calendar/${year}/${month}`);
  direct.searchParams.set("latitude", String(latitude));
  direct.searchParams.set("longitude", String(longitude));
  direct.searchParams.set("method", "3");
  direct.searchParams.set("school", "0");
  const response = await fetch(direct.toString(), { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`Direct prayer service returned ${response.status}`);
  const payload = await response.json() as AlAdhanResponse;
  if (payload.code !== 200 || !Array.isArray(payload.data)) throw new Error("Direct prayer service response is invalid");

  const prayerTimes: PrayerTimes = {};
  for (const day of payload.data) {
    const key = alAdhanDateKey(day.date?.gregorian?.date);
    if (!key) continue;
    const fajr = parseAlAdhanTiming(day.timings?.Fajr);
    const dhuhr = parseAlAdhanTiming(day.timings?.Dhuhr);
    const asr = parseAlAdhanTiming(day.timings?.Asr);
    const maghrib = parseAlAdhanTiming(day.timings?.Maghrib);
    const isha = parseAlAdhanTiming(day.timings?.Isha);
    if (!fajr || !dhuhr || !asr || !maghrib || !isha) continue;
    prayerTimes[key] = { fajr, dhuhr, asr, maghrib, isha };
  }
  if (!Object.keys(prayerTimes).length) throw new Error("Direct prayer service returned no usable prayer times");
  return { prayer_times: prayerTimes, source: "aladhan", sourceLabel: "AlAdhan direct" };
}'''
prayer = prayer[:match.start()] + new_fetch + prayer[match.end():]

# If GPS confirms Windsor, use the bundled official Windsor schedule immediately.
# This removes all network dependency for the primary Windsor use case.
windsor_anchor = '''    const latitude = position.coords.latitude;
    const longitude = position.coords.longitude;
    const months = monthPair(timezone);'''
windsor_block = '''    const latitude = position.coords.latitude;
    const longitude = position.coords.longitude;

    if (isNearWindsor(latitude, longitude)) {
      const officialPrayerTimes = (bundledSchedule as PrayerFile).prayer_times;
      const resolvedLabel = await locationLabel(latitude, longitude);
      const location: PrayerLocation = {
        latitude,
        longitude,
        timezone: "America/Toronto",
        label: isUsefulLabel(resolvedLabel) ? resolvedLabel : "Windsor, Ontario",
        source: "windsor_islamic_association"
      };
      await AsyncStorage.setItem(
        STORAGE_KEYS.locationSchedule,
        JSON.stringify({ prayerTimes: officialPrayerTimes, location, savedAt: new Date().toISOString() } satisfies CachedLocationPayload)
      );
      return { prayerTimes: officialPrayerTimes, live: true, location };
    }

    const months = monthPair(timezone);'''
if windsor_anchor in prayer:
    prayer = prayer.replace(windsor_anchor, windsor_block, 1)
elif 'officialPrayerTimes' not in prayer:
    raise SystemExit('Could not install Windsor offline official schedule shortcut')

# Fresh installable build number.
cfg = re.sub(r'version:\s*(?:process\.env\.EXPO_APP_VERSION\s*\|\|\s*)?"[^"]+"', 'version: process.env.EXPO_APP_VERSION || "1.0.24"', cfg, count=1)
cfg = re.sub(r'versionCode:\s*\d+', 'versionCode: 68', cfg, count=1)

PRAYER_DATA.write_text(prayer, encoding="utf-8")
CONFIG.write_text(cfg, encoding="utf-8")

for needle in [
    'https://api.aladhan.com/v1/calendar/',
    'officialPrayerTimes',
    'Windsor, Ontario',
    'source: "windsor_islamic_association"',
    'AlAdhan direct',
]:
    if needle not in prayer:
        raise SystemExit(f'Missing prayer fallback requirement: {needle}')
for needle in ['1.0.24', 'versionCode: 68']:
    if needle not in cfg:
        raise SystemExit(f'Missing version requirement: {needle}')

print('Applied v1.0.24 prayer-service fallback: Windsor offline official schedule + direct AlAdhan fallback')
