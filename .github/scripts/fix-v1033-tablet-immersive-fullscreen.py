from pathlib import Path
import re

PAGE = Path('mobile/src/MasjidDisplayPage.tsx')
page = PAGE.read_text(encoding='utf-8')

# HASSOUN_TABLET_IMMERSIVE_FULLSCREEN_V1
# Keep the native Tablet/iPad display visually exclusive: no status bar, no Android
# navigation/task bar, and re-hide system chrome whenever Android brings it back.

# Ensure AppState is imported from react-native.
m = re.search(r'import \{([^}]*)\} from "react-native";', page, flags=re.S)
if not m:
    raise SystemExit('v1033 fullscreen: react-native import missing')
items = [x.strip() for x in m.group(1).split(',') if x.strip()]
if 'AppState' not in items:
    items.append('AppState')
page = page[:m.start()] + 'import { ' + ', '.join(items) + ' } from "react-native";' + page[m.end():]

if 'HASSOUN_TABLET_IMMERSIVE_FULLSCREEN_V1' not in page:
    anchor = '  useKeepAwake();\n'
    if anchor not in page:
        raise SystemExit('v1033 fullscreen: useKeepAwake anchor missing')
    helper = '''  // HASSOUN_TABLET_IMMERSIVE_FULLSCREEN_V1\n  const enterTabletImmersive = useCallback(() => {\n    StatusBar.setHidden(true, "none");\n    if (Platform.OS === "android") {\n      void NavigationBar.setVisibilityAsync("hidden").catch(() => undefined);\n      const navAny = NavigationBar as any;\n      if (typeof navAny.setPositionAsync === "function") void navAny.setPositionAsync("absolute").catch(() => undefined);\n    }\n  }, []);\n\n'''
    page = page.replace(anchor, anchor + helper, 1)

    # Insert an effect before the first existing effect. It re-hides bars on entry,
    # after transient Android system UI gestures, and whenever app returns active.
    effect_anchor = re.search(r'\n\s*useEffect\(\(\)\s*=>', page)
    if not effect_anchor:
        raise SystemExit('v1033 fullscreen: effect insertion point missing')
    effect = '''\n  useEffect(() => {\n    enterTabletImmersive();\n    const t1 = setTimeout(enterTabletImmersive, 120);\n    const t2 = setTimeout(enterTabletImmersive, 500);\n    const t3 = setTimeout(enterTabletImmersive, 1500);\n    const keepHidden = setInterval(enterTabletImmersive, 1800);\n    const sub = AppState.addEventListener("change", state => { if (state === "active") enterTabletImmersive(); });\n    return () => {\n      clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearInterval(keepHidden); sub.remove();\n      StatusBar.setHidden(false, "none");\n      if (Platform.OS === "android") void NavigationBar.setVisibilityAsync("visible").catch(() => undefined);\n    };\n  }, [enterTabletImmersive]);\n'''
    page = page[:effect_anchor.start()] + effect + page[effect_anchor.start():]

# Make the full-screen root consume the complete app window with no accidental inset gap.
page = page.replace(
    '<StatusBar hidden />',
    '<StatusBar hidden translucent backgroundColor="transparent" />'
)
page = page.replace(
    '<StatusBar hidden/>',
    '<StatusBar hidden translucent backgroundColor="transparent"/>'
)

for marker in [
    'HASSOUN_TABLET_IMMERSIVE_FULLSCREEN_V1',
    'enterTabletImmersive',
    'StatusBar.setHidden(true',
    'NavigationBar.setVisibilityAsync("hidden")',
    'AppState.addEventListener',
    'setInterval(enterTabletImmersive, 1800)',
]:
    if marker not in page:
        raise SystemExit(f'v1033 fullscreen missing marker: {marker}')

# Bump the Android build so this can be installed cleanly over v1.0.32.
cfg_path = Path('mobile/app.config.ts')
cfg = cfg_path.read_text(encoding='utf-8')
cfg, n1 = re.subn(r'(?m)^(\s*)version\s*:.*?,\s*$', r'\1version: "1.0.33",', cfg, count=1)
cfg, n2 = re.subn(r'(?m)^(\s*)versionCode\s*:\s*\d+\s*,?\s*$', r'\1versionCode: 77,', cfg, count=1)
if n1 != 1 or n2 != 1:
    raise SystemExit(f'v1033 fullscreen version bump failed: version={n1}, versionCode={n2}')
cfg_path.write_text(cfg, encoding='utf-8')

PAGE.write_text(page, encoding='utf-8')
print('HASSOUN_TABLET_IMMERSIVE_FULLSCREEN_V1 applied: tablet display owns the full screen and continuously suppresses status/navigation/task bars')
