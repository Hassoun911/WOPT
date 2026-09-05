from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
APP = ROOT / "mobile/App.tsx"
app = APP.read_text(encoding="utf-8")

marker = '  const toggleLocale = async () => {'
if marker not in app:
    raise SystemExit('toggleLocale anchor missing for Home autoload')

sentinel = 'HOME_PRAYER_AUTOLOAD_V1'
if sentinel not in app:
    effect = '''  // HOME_PRAYER_AUTOLOAD_V1: show saved prayer data immediately, then refresh location once on cold start.
  useEffect(() => {
    let active = true;

    void loadInitialPrayerTimes()
      .then((loaded) => {
        if (!active) return;
        setPrayerContext(loaded);
        setPrayerTimes(loaded.prayerTimes);
        setPrayerLocation(loaded.location);
        setLive(loaded.live);
        setWallLocationLabel(loaded.location.label);
      })
      .catch(() => undefined);

    void loadPrayerTimes()
      .then((loaded) => {
        if (!active) return;
        setPrayerContext(loaded);
        setPrayerTimes(loaded.prayerTimes);
        setPrayerLocation(loaded.location);
        setLive(loaded.live);
        setWallLocationLabel(loaded.location.label);
        HassounWidget.syncPrayerSchedule(JSON.stringify(loaded.prayerTimes), locale);
        HassounWidget.refresh();
      })
      .catch(() => undefined);

    return () => { active = false; };
  }, []);

'''
    app = app.replace(marker, effect + marker, 1)

for required in [
    'HOME_PRAYER_AUTOLOAD_V1',
    'void loadInitialPrayerTimes()',
    'void loadPrayerTimes()',
    'setPrayerContext(loaded);'
]:
    if required not in app:
        raise SystemExit(f'Home autoload requirement missing: {required}')

APP.write_text(app, encoding='utf-8')
print('Installed one-time cold-start prayer autoload for rebuilt Home')
