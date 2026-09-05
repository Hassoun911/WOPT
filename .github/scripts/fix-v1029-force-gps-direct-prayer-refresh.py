from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PRAYER_DATA = ROOT / "mobile/src/prayerData.ts"

prayer = PRAYER_DATA.read_text(encoding="utf-8")

# Manual refresh must be an end-to-end GPS refresh. Outside Windsor it must not use
# the Hassoun Worker at all, because a server-side source/location response must never
# be able to keep the UI pinned to Windsor after the phone has travelled.
old_sig = 'async function fetchMonth(latitude: number, longitude: number, timezone: string, year: number, month: number): Promise<PrayerApiResponse> {'
new_sig = 'async function fetchMonth(latitude: number, longitude: number, timezone: string, year: number, month: number, directOnly = false): Promise<PrayerApiResponse> {'
if old_sig in prayer:
    prayer = prayer.replace(old_sig, new_sig, 1)
elif new_sig not in prayer:
    raise SystemExit('fetchMonth signature not found')

old_worker = '''  // Try Hassoun Worker first, but never make location refresh depend on it.
  try {
    const url = new URL(PRAYER_API_URL);'''
new_worker = '''  // Startup/background refresh may use Hassoun Worker. A user-forced manual refresh
  // bypasses it and goes straight from live GPS coordinates to AlAdhan.
  if (!directOnly) {
    try {
      const url = new URL(PRAYER_API_URL);'''
if old_worker in prayer:
    prayer = prayer.replace(old_worker, new_worker, 1)
elif 'if (!directOnly)' not in prayer:
    raise SystemExit('Worker opening block not found')

old_worker_end = '''  } catch {
    // Fall through to direct provider.
  }

  // Direct provider fallback.'''
new_worker_end = '''    } catch {
      // Fall through to direct provider.
    }
  }

  // Direct provider fallback / forced-refresh primary provider.'''
if old_worker_end in prayer:
    prayer = prayer.replace(old_worker_end, new_worker_end, 1)
elif 'forced-refresh primary provider' not in prayer:
    raise SystemExit('Worker closing block not found')

# Current and next month fetches during a manual refresh must use directOnly=true.
old_current = 'current = await fetchMonth(latitude, longitude, timezone, months[0].year, months[0].month);'
new_current = 'current = await fetchMonth(latitude, longitude, timezone, months[0].year, months[0].month, options.forceLocation);'
if old_current in prayer:
    prayer = prayer.replace(old_current, new_current, 1)
elif new_current not in prayer:
    raise SystemExit('Current-month fetch call not found')

old_next = 'next = await fetchMonth(latitude, longitude, timezone, months[1].year, months[1].month);'
new_next = 'next = await fetchMonth(latitude, longitude, timezone, months[1].year, months[1].month, options.forceLocation);'
if old_next in prayer:
    prayer = prayer.replace(old_next, new_next, 1)
elif new_next not in prayer:
    raise SystemExit('Next-month fetch call not found')

# A forced refresh city label comes from the GPS coordinates themselves. Never prefer
# a prayer API/Worker-provided location label for a manual location refresh.
old_label = '    const reverseLabel = apiLabel || await locationLabel(latitude, longitude);'
new_label = '''    const gpsLabel = await locationLabel(latitude, longitude);
    const reverseLabel = options.forceLocation ? gpsLabel : (apiLabel || gpsLabel);'''
if old_label in prayer:
    prayer = prayer.replace(old_label, new_label, 1)
elif 'options.forceLocation ? gpsLabel' not in prayer:
    raise SystemExit('Location-label preference anchor not found')

# Outside Windsor, a forced refresh must never reuse the previously saved Windsor label
# if reverse geocoding is temporarily unavailable. Use coordinates as an honest fallback.
old_fallback = '''      : isUsefulLabel(fallback.location.label)
          ? fallback.location.label
          : "Current location";'''
new_fallback = '''      : options.forceLocation
          ? `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`
          : isUsefulLabel(fallback.location.label)
            ? fallback.location.label
            : "Current location";'''
if old_fallback in prayer:
    prayer = prayer.replace(old_fallback, new_fallback, 1)
elif 'latitude.toFixed(4)' not in prayer:
    raise SystemExit('Stale saved-label fallback anchor not found')

PRAYER_DATA.write_text(prayer, encoding='utf-8')

required = [
    'directOnly = false',
    'if (!directOnly)',
    'options.forceLocation);',
    'options.forceLocation ? gpsLabel',
    'latitude.toFixed(4)',
    'Location.watchPositionAsync',
]
written = PRAYER_DATA.read_text(encoding='utf-8')
for needle in required:
    if needle not in written:
        raise SystemExit(f'Missing forced refresh requirement: {needle}')

print('Applied end-to-end forced GPS refresh: direct AlAdhan + GPS-derived city label')
