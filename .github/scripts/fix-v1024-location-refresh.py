from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[2]
APP = ROOT / "mobile/App.tsx"
PRAYER_DATA = ROOT / "mobile/src/prayerData.ts"
CONFIG = ROOT / "mobile/app.config.ts"

app = APP.read_text(encoding="utf-8")
prayer = PRAYER_DATA.read_text(encoding="utf-8")
cfg = CONFIG.read_text(encoding="utf-8")

# v1.0.24: manual refresh is a city/prayer refresh, not a surveying-grade GPS task.
# Balanced accuracy is substantially more reliable indoors while still being more than
# accurate enough to resolve the user's city and calculate prayer times.
permission_old = '    if (!permission.granted) return fallback;'
permission_new = '''    if (!permission.granted) {
      if (options.forceLocation) throw new Error("LOCATION_PERMISSION_DENIED");
      return fallback;
    }

    const servicesEnabled = await Location.hasServicesEnabledAsync();
    if (!servicesEnabled) {
      if (options.forceLocation) throw new Error("LOCATION_SERVICES_DISABLED");
      return fallback;
    }'''
if permission_old in prayer:
    prayer = prayer.replace(permission_old, permission_new, 1)
elif 'LOCATION_PERMISSION_DENIED' not in prayer:
    raise SystemExit('Could not patch location permission/services handling')

old_position = '''    let position: Location.LocationObject;
    try {
      position = await Location.getCurrentPositionAsync({
        accuracy: options.forceLocation ? Location.Accuracy.High : Location.Accuracy.Balanced
      });
    } catch {
      // A manual refresh must never silently report an old cached GPS position.
      // Startup may still use last-known data for speed/offline resilience.
      if (options.forceLocation) throw new Error("Fresh GPS location unavailable");
      const last = await Location.getLastKnownPositionAsync();
      if (!last) return fallback;
      position = last;
    }'''
new_position = '''    let position: Location.LocationObject;
    try {
      const request = Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      position = options.forceLocation
        ? await Promise.race([
            request,
            new Promise<never>((_, reject) => setTimeout(() => reject(new Error("LOCATION_FIX_TIMEOUT")), 10000))
          ])
        : await request;
    } catch {
      // A recent Android last-known fix is safe for city-level prayer calculations and
      // avoids false failures inside buildings. Never reuse an old travel location.
      const last = await Location.getLastKnownPositionAsync();
      const ageMs = last ? Math.max(0, Date.now() - last.timestamp) : Number.POSITIVE_INFINITY;
      if (last && ageMs <= 5 * 60 * 1000) {
        position = last;
      } else if (options.forceLocation) {
        throw new Error("LOCATION_FIX_UNAVAILABLE");
      } else {
        if (!last) return fallback;
        position = last;
      }
    }'''
if old_position in prayer:
    prayer = prayer.replace(old_position, new_position, 1)
elif 'LOCATION_FIX_UNAVAILABLE' not in prayer:
    raise SystemExit('Could not patch resilient current-position strategy')

# Do not fail the entire refresh just because the next calendar month could not be fetched.
old_months = '''    const months = monthPair(timezone);
    const [current, next] = await Promise.all(months.map(({ year, month }) => fetchMonth(latitude, longitude, timezone, year, month)));
    const prayerTimes = mergePrayerTimes(current.prayer_times || {}, next.prayer_times || {});'''
new_months = '''    const months = monthPair(timezone);
    let current: PrayerApiResponse;
    try {
      current = await fetchMonth(latitude, longitude, timezone, months[0].year, months[0].month);
    } catch {
      throw new Error("PRAYER_API_UNAVAILABLE");
    }
    let next: PrayerApiResponse | null = null;
    try {
      next = await fetchMonth(latitude, longitude, timezone, months[1].year, months[1].month);
    } catch {
      // Current month is enough to complete a successful location refresh.
    }
    const prayerTimes = mergePrayerTimes(current.prayer_times || {}, next?.prayer_times || {});'''
if old_months in prayer:
    prayer = prayer.replace(old_months, new_months, 1)
elif 'PRAYER_API_UNAVAILABLE' not in prayer:
    raise SystemExit('Could not patch current-month-first prayer API handling')

# The previous UI raced the WHOLE pipeline (GPS + API + geocoding) against 12 seconds,
# incorrectly reporting slow network work as a GPS timeout. loadPrayerTimes now bounds
# the GPS phase itself, so the outer race must be removed.
old_load = '''      const refreshed = await Promise.race([
        loadPrayerTimes({ forceLocation: true }),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error("GPS timed out")), 12000))
      ]);'''
new_load = '''      const refreshed = await loadPrayerTimes({ forceLocation: true });'''
if old_load in app:
    app = app.replace(old_load, new_load, 1)
elif new_load not in app:
    raise SystemExit('Could not remove whole-pipeline GPS race')

old_catch = '''      const detail = error instanceof Error && error.message === "GPS timed out"
        ? (locale === "ar" ? "تعذر الحصول على موقع GPS جديد خلال 12 ثانية. تأكد من تشغيل الموقع ثم اسحب للأسفل مرة أخرى." : "A fresh GPS fix was not available within 12 seconds. Make sure Location is on, then pull down again.")
        : (locale === "ar" ? "تعذر تحديث الموقع الآن. حاول مرة أخرى." : "Location could not be refreshed right now. Please try again.");
      Alert.alert(locale === "ar" ? "تعذر تحديث الموقع" : "Location refresh failed", detail);'''
new_catch = '''      const code = error instanceof Error ? error.message : "UNKNOWN";
      const detail = code === "LOCATION_PERMISSION_DENIED"
        ? (locale === "ar" ? "اسمح لحسون بالوصول إلى الموقع من إعدادات أندرويد ثم حاول مرة أخرى." : "Allow Hassoun to use Location in Android settings, then try again.")
        : code === "LOCATION_SERVICES_DISABLED"
          ? (locale === "ar" ? "خدمة الموقع في الهاتف متوقفة. شغّل الموقع ثم حاول مرة أخرى." : "Phone Location services are off. Turn Location on, then try again.")
          : code === "LOCATION_FIX_UNAVAILABLE" || code === "LOCATION_FIX_TIMEOUT"
            ? (locale === "ar" ? "لم يتمكن الهاتف من الحصول على موقع حديث. اقترب من نافذة أو افتح الخرائط للحظة ثم حاول مرة أخرى." : "Android could not obtain a recent location fix. Move near a window or open Maps briefly, then try again.")
            : code === "PRAYER_API_UNAVAILABLE"
              ? (locale === "ar" ? "تم العثور على موقعك، لكن خدمة مواقيت الصلاة لم تستجب. تحقق من الإنترنت وحاول مرة أخرى." : "Your location was found, but the prayer-times service did not respond. Check your internet and try again.")
              : (locale === "ar" ? "تعذر تحديث الموقع ومواقيت الصلاة الآن. حاول مرة أخرى." : "Location and prayer times could not be refreshed right now. Please try again.");
      const title = code === "PRAYER_API_UNAVAILABLE"
        ? (locale === "ar" ? "تعذر تحديث مواقيت الصلاة" : "Prayer times refresh failed")
        : (locale === "ar" ? "تعذر تحديث الموقع" : "Location refresh failed");
      Alert.alert(title, detail);'''
if old_catch in app:
    app = app.replace(old_catch, new_catch, 1)
elif 'PRAYER_API_UNAVAILABLE' not in app:
    raise SystemExit('Could not patch refresh error diagnostics')

cfg = re.sub(r'version:\s*(?:process\.env\.EXPO_APP_VERSION\s*\|\|\s*)?"[^"]+"', 'version: process.env.EXPO_APP_VERSION || "1.0.24"', cfg, count=1)
cfg = re.sub(r'versionCode:\s*\d+', 'versionCode: 68', cfg, count=1)

APP.write_text(app, encoding="utf-8")
PRAYER_DATA.write_text(prayer, encoding="utf-8")
CONFIG.write_text(cfg, encoding="utf-8")

checks = {
    APP: ['loadPrayerTimes({ forceLocation: true })', 'LOCATION_PERMISSION_DENIED', 'PRAYER_API_UNAVAILABLE', 'Prayer times refresh failed'],
    PRAYER_DATA: ['Location.Accuracy.Balanced', 'LOCATION_SERVICES_DISABLED', 'LOCATION_FIX_UNAVAILABLE', 'PRAYER_API_UNAVAILABLE', 'ageMs <= 5 * 60 * 1000'],
    CONFIG: ['1.0.24', 'versionCode: 68'],
}
for path, needles in checks.items():
    text = path.read_text(encoding="utf-8")
    for needle in needles:
        if needle not in text:
            raise SystemExit(f'Missing {needle!r} in {path}')

if 'new Error("GPS timed out")' in app:
    raise SystemExit('Old whole-pipeline GPS timeout still present')

print('Applied v1.0.24 resilient city location refresh with separate GPS/API diagnostics')
