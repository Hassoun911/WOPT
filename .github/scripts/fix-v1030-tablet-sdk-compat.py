from pathlib import Path

page_path = Path("mobile/src/MasjidDisplayPage.tsx")
page = page_path.read_text(encoding="utf-8")

# SDK 57 / current React Native compatibility: these APIs are not available in
# the generated TypeScript surface used by the proven v1.0.29 base.
page = page.replace('      void NavigationBar.setBehaviorAsync("overlay-swipe").catch(() => undefined);\n', '')
page = page.replace('StyleSheet.absoluteFillObject', 'StyleSheet.absoluteFill')

if 'setBehaviorAsync' in page:
    raise SystemExit('Unsupported NavigationBar.setBehaviorAsync still present')
if 'StyleSheet.absoluteFillObject' in page:
    raise SystemExit('Unsupported StyleSheet.absoluteFillObject still present')
if 'NavigationBar.setVisibilityAsync("hidden")' not in page:
    raise SystemExit('Navigation bar hide behavior missing')

page_path.write_text(page, encoding="utf-8")
print('HASSOUN_TABLET_SDK_COMPAT_V1 applied')

# Final tablet runtime patch must run after every display/layout rewrite so the wall
# mode owns its prayer notification/Adhan schedule and prayer-time visual reaction.
runtime = Path('.github/scripts/fix-v1030-tablet-prayer-runtime.py')
if not runtime.exists():
    raise SystemExit('Tablet prayer runtime patch missing')
exec(compile(runtime.read_text(encoding='utf-8'), str(runtime), 'exec'))

final_page = page_path.read_text(encoding='utf-8')
for marker in [
    'HASSOUN_TABLET_PRAYER_RUNTIME_V1',
    'schedulePrayerNotifications(times, locale, preferences',
    'const prayerNow = useMemo',
    'PRAYER NOW',
    'tabletPrayerRuntimeStatus',
]:
    if marker not in final_page:
        raise SystemExit(f'Missing tablet prayer runtime marker: {marker}')
print('HASSOUN_TABLET_PRAYER_RUNTIME_V1 verified after SDK compatibility pass')
