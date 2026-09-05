from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[2]
APP = ROOT / "mobile/App.tsx"
app = APP.read_text(encoding="utf-8")

# Remove only legacy HomePrayerPanel import lines here. Screen bodies are deleted as
# complete top-level declarations below, so no partial JSX is ever left behind.
app = re.sub(r'^import .*HomePrayerPanel.*\n', '', app, flags=re.M)

# Remove old Home refresh callbacks before the new prayer context is installed.
for marker in ('  const refreshHome = useCallback', '  const refreshPrayerLocation = useCallback'):
    while True:
        start = app.find(marker)
        if start < 0:
            break
        candidates = [p for p in (
            app.find('\n  useEffect(', start + len(marker)),
            app.find('\n  const ', start + len(marker)),
            app.find('\n  async function ', start + len(marker)),
        ) if p >= 0]
        if not candidates:
            raise SystemExit(f'Could not bound legacy callback: {marker}')
        end = min(candidates)
        app = app[:start] + app[end + 1:]

# Reconstruction can create both homeScreen and phoneHomeScreen. Delete both complete
# top-level declarations. This guarantees the new Home component is the sole phone Home.
for marker in ('  const homeScreen =', '  const phoneHomeScreen ='):
    while True:
        start = app.find(marker)
        if start < 0:
            break
        next_decl = app.find('\n  const ', start + len(marker))
        if next_decl < 0:
            raise SystemExit(f'Could not find declaration after legacy screen: {marker.strip()}')
        app = app[:start] + app[next_decl + 1:]

# Any remaining reference to the legacy phone alias will be redirected after the new
# homeScreen is installed by rewrite-home-ground-zero.py.
APP.write_text(app, encoding='utf-8')
print('Removed all legacy Home renderers, HomePrayerPanel import, and old refresh callbacks before ground-zero rewrite')
