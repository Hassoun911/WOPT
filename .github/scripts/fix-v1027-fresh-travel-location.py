from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
APP = ROOT / "mobile/App.tsx"
PRAYER_DATA = ROOT / "mobile/src/prayerData.ts"

app = APP.read_text(encoding="utf-8")
prayer = PRAYER_DATA.read_text(encoding="utf-8")

# v1.0.27 travel-location hard fix.
# A manual refresh must obtain a genuinely fresh GPS fix. The previous resilient
# fallback could accept Android's recent last-known location even during a forced
# refresh, which could leave a traveller stuck on the previous Windsor location.
old_position = '''    let position: Location.LocationObject;
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

new_position = '''    let position: Location.LocationObject;
    try {
      const request = Location.getCurrentPositionAsync({
        accuracy: options.forceLocation ? Location.Accuracy.High : Location.Accuracy.Balanced
      });
      position = options.forceLocation
        ? await Promise.race([
            request,
            new Promise<never>((_, reject) => setTimeout(() => reject(new Error("LOCATION_FIX_TIMEOUT")), 15000))
          ])
        : await request;

      // Forced refresh may never accept an old provider result as a successful refresh.
      if (options.forceLocation) {
        const freshAgeMs = Math.max(0, Date.now() - position.timestamp);
        if (freshAgeMs > 60 * 1000) throw new Error("LOCATION_FIX_STALE");
      }
    } catch (error) {
      if (options.forceLocation) {
        const code = error instanceof Error ? error.message : "LOCATION_FIX_UNAVAILABLE";
        if (code === "LOCATION_FIX_TIMEOUT" || code === "LOCATION_FIX_STALE") throw error;
        throw new Error("LOCATION_FIX_UNAVAILABLE");
      }

      // Startup can still use last-known data for fast/offline resilience.
      const last = await Location.getLastKnownPositionAsync();
      if (!last) return fallback;
      position = last;
    }'''

if old_position not in prayer:
    raise SystemExit("Expected v1.0.24 location block not found")
prayer = prayer.replace(old_position, new_position, 1)

# Include the stale-fix diagnostic in the existing user-facing location error path.
old_error = 'code === "LOCATION_FIX_UNAVAILABLE" || code === "LOCATION_FIX_TIMEOUT"'
new_error = 'code === "LOCATION_FIX_UNAVAILABLE" || code === "LOCATION_FIX_TIMEOUT" || code === "LOCATION_FIX_STALE"'
if old_error in app:
    app = app.replace(old_error, new_error, 1)
elif new_error not in app:
    raise SystemExit("Could not add stale-location refresh diagnostic")

PRAYER_DATA.write_text(prayer, encoding="utf-8")
APP.write_text(app, encoding="utf-8")

checks = {
    PRAYER_DATA: [
        'accuracy: options.forceLocation ? Location.Accuracy.High : Location.Accuracy.Balanced',
        'LOCATION_FIX_STALE',
        'freshAgeMs > 60 * 1000',
        'LOCATION_FIX_TIMEOUT")), 15000',
    ],
    APP: ['LOCATION_FIX_STALE'],
}
for path, needles in checks.items():
    text = path.read_text(encoding="utf-8")
    for needle in needles:
        if needle not in text:
            raise SystemExit(f"Missing {needle!r} in {path}")

# Safety assertion: forced refresh must not fall through to Android last-known location.
forced_section = prayer[prayer.index('let position: Location.LocationObject;'):prayer.index('const latitude = position.coords.latitude;')]
if 'if (options.forceLocation)' not in forced_section or 'throw new Error("LOCATION_FIX_UNAVAILABLE")' not in forced_section:
    raise SystemExit("Forced location refresh guard missing")

print("Applied v1.0.27 strict fresh travel GPS refresh; forced refresh cannot reuse stale Windsor location")
