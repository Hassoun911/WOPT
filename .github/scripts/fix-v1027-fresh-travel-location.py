from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
APP = ROOT / "mobile/App.tsx"
PRAYER_DATA = ROOT / "mobile/src/prayerData.ts"

app = APP.read_text(encoding="utf-8")
prayer = PRAYER_DATA.read_text(encoding="utf-8")

# v1.0.27 travel-location hard fix.
# Manual refresh must not trust the first Android fused-location answer. On some phones
# getCurrentPositionAsync can return a recently timestamped cached coordinate after travel.
# For a forced refresh we therefore subscribe to live GPS updates and require two recent,
# mutually consistent samples before accepting the location.
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
      if (options.forceLocation) {
        const startedAt = Date.now();
        position = await new Promise<Location.LocationObject>(async (resolve, reject) => {
          let subscription: Location.LocationSubscription | null = null;
          let previous: Location.LocationObject | null = null;
          let settled = false;

          const finish = (result?: Location.LocationObject, error?: Error) => {
            if (settled) return;
            settled = true;
            if (subscription) subscription.remove();
            if (result) resolve(result);
            else reject(error || new Error("LOCATION_FIX_UNAVAILABLE"));
          };

          const timer = setTimeout(() => finish(undefined, new Error("LOCATION_FIX_TIMEOUT")), 20000);
          try {
            subscription = await Location.watchPositionAsync(
              {
                accuracy: Location.Accuracy.High,
                timeInterval: 1000,
                distanceInterval: 0,
                mayShowUserSettingsDialog: true
              },
              (sample) => {
                if (settled) return;
                const ageMs = Math.max(0, Date.now() - sample.timestamp);
                const accuracy = sample.coords.accuracy ?? Number.POSITIVE_INFINITY;
                // Ignore provider cache emitted before this manual refresh and very coarse fixes.
                if (sample.timestamp < startedAt - 3000 || ageMs > 15000 || accuracy > 1500) return;

                if (previous) {
                  const confirmedDistanceKm = distanceKm(
                    previous.coords.latitude,
                    previous.coords.longitude,
                    sample.coords.latitude,
                    sample.coords.longitude
                  );
                  // Two live samples agreeing within 2 km confirms the phone's present area.
                  if (confirmedDistanceKm <= 2) {
                    clearTimeout(timer);
                    finish(sample);
                    return;
                  }
                }
                previous = sample;
              }
            );
          } catch {
            clearTimeout(timer);
            finish(undefined, new Error("LOCATION_FIX_UNAVAILABLE"));
          }
        });
      } else {
        position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      }
    } catch (error) {
      if (options.forceLocation) {
        const code = error instanceof Error ? error.message : "LOCATION_FIX_UNAVAILABLE";
        if (code === "LOCATION_FIX_TIMEOUT") throw error;
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

# Existing location failure copy already covers unavailable/timeout states. Keep the
# visible message generic because the important change is that stale Windsor is never
# presented as a successful refresh.
PRAYER_DATA.write_text(prayer, encoding="utf-8")
APP.write_text(app, encoding="utf-8")

checks = {
    PRAYER_DATA: [
        'Location.watchPositionAsync',
        'accuracy: Location.Accuracy.High',
        'confirmedDistanceKm <= 2',
        'LOCATION_FIX_TIMEOUT")), 20000',
        'sample.timestamp < startedAt - 3000',
        'accuracy > 1500',
    ],
}
for path, needles in checks.items():
    text = path.read_text(encoding="utf-8")
    for needle in needles:
        if needle not in text:
            raise SystemExit(f"Missing {needle!r} in {path}")

# Safety assertions: forced refresh must use live updates and must not read last-known
# until the non-forced startup fallback branch.
forced_section = prayer[prayer.index('let position: Location.LocationObject;'):prayer.index('const latitude = position.coords.latitude;')]
if 'Location.watchPositionAsync' not in forced_section:
    raise SystemExit("Live GPS watcher missing from forced refresh")
if forced_section.index('Location.getLastKnownPositionAsync') < forced_section.index('if (options.forceLocation)'):
    raise SystemExit("Forced refresh can still reach last-known location")

print("Applied confirmed live GPS travel refresh: two fresh consistent samples required")
