from pathlib import Path
import re

PAGE = Path('mobile/src/MasjidDisplayPage.tsx')
page = PAGE.read_text(encoding='utf-8')

# HASSOUN_TABLET_LAYOUT_PERSIST_V2
# Keep a dedicated tablet-layout backup in AsyncStorage. Android preserves AsyncStorage
# when a newer APK is installed over the existing app, so this survives normal updates.
# This patch deliberately does NOT depend on the older SETTINGS_KEY declaration because
# the reconstructed tablet page has changed that storage implementation across builds.

# Ensure useRef is available for the one-time restore gate.
m = re.search(r'import \{([^}]*)\} from "react";', page, flags=re.S)
if not m:
    raise SystemExit('v1032 persistence: React import missing')
react_names = [x.strip() for x in m.group(1).split(',') if x.strip()]
if 'useRef' not in react_names:
    react_names.append('useRef')
page = page[:m.start()] + 'import { ' + ', '.join(react_names) + ' } from "react";' + page[m.end():]

if 'const LAYOUT_BACKUP_KEY = "hassoun:tablet-layout-backup:v2";' not in page:
    # Put the key before the component; use a stable nearby declaration when available.
    component_anchor = 'export default function MasjidDisplayPage'
    pos = page.find(component_anchor)
    if pos < 0:
        raise SystemExit('v1032 persistence: MasjidDisplayPage component missing')
    page = page[:pos] + 'const LAYOUT_BACKUP_KEY = "hassoun:tablet-layout-backup:v2"; // HASSOUN_TABLET_LAYOUT_PERSIST_V2\n\n' + page[pos:]

# Add a ref beside the prayer-runtime refs/state. This prevents the initial empty/default
# settings object from overwriting the saved layout before restore finishes.
if 'tabletLayoutBackupReadyRef' not in page:
    candidates = [
        '  const exactAlarmTabletPromptRef = useRef(false);\n',
        '  const beatAnim = useRef(new Animated.Value(1)).current;\n',
    ]
    inserted = False
    for anchor in candidates:
        if anchor in page:
            page = page.replace(anchor, anchor + '  const tabletLayoutBackupReadyRef = useRef(false);\n', 1)
            inserted = True
            break
    if not inserted:
        # Fallback: place immediately after component opening.
        comp = re.search(r'export default function MasjidDisplayPage\([^)]*\)\s*\{\n', page)
        if not comp:
            raise SystemExit('v1032 persistence: component opening missing')
        page = page[:comp.end()] + '  const tabletLayoutBackupReadyRef = useRef(false);\n' + page[comp.end():]

# Restore the backup once, then save every subsequent settings change. Current settings
# win over backup values, while missing tabletTheme fields are recovered from the backup.
if 'HASSOUN_TABLET_LAYOUT_RESTORE_EFFECT_V2' not in page:
    state_anchor = re.search(r'\n\s*const theme\s*=|\n\s*const remoteTheme\s*=', page)
    if not state_anchor:
        # Place before the first existing effect after all state declarations.
        state_anchor = re.search(r'\n\s*useEffect\(\(\)\s*=>', page)
    if not state_anchor:
        raise SystemExit('v1032 persistence: insertion point missing')
    effect = '''\n  // HASSOUN_TABLET_LAYOUT_RESTORE_EFFECT_V2\n  useEffect(() => {\n    let alive = true;\n    void AsyncStorage.getItem(LAYOUT_BACKUP_KEY).then(raw => {\n      if (!alive) return;\n      if (raw) {\n        try {\n          const backup = JSON.parse(raw) as Record<string, any>;\n          setSettings(current => ({\n            ...backup,\n            ...current,\n            tabletTheme: {\n              ...(backup.tabletTheme && typeof backup.tabletTheme === "object" ? backup.tabletTheme : {}),\n              ...(current.tabletTheme && typeof current.tabletTheme === "object" ? current.tabletTheme : {}),\n            },\n          }));\n        } catch {}\n      }\n      tabletLayoutBackupReadyRef.current = true;\n    });\n    return () => { alive = false; };\n  }, []);\n\n  useEffect(() => {\n    if (!tabletLayoutBackupReadyRef.current) return;\n    void AsyncStorage.setItem(LAYOUT_BACKUP_KEY, JSON.stringify(settings));\n  }, [settings]);\n'''
    page = page[:state_anchor.start()] + effect + page[state_anchor.start():]

for marker in [
    'HASSOUN_TABLET_LAYOUT_PERSIST_V2',
    'HASSOUN_TABLET_LAYOUT_RESTORE_EFFECT_V2',
    'hassoun:tablet-layout-backup:v2',
    'tabletLayoutBackupReadyRef',
    'backup.tabletTheme',
    'AsyncStorage.getItem(LAYOUT_BACKUP_KEY)',
    'AsyncStorage.setItem(LAYOUT_BACKUP_KEY, JSON.stringify(settings))',
]:
    if marker not in page:
        raise SystemExit(f'v1032 persistence missing marker: {marker}')

PAGE.write_text(page, encoding='utf-8')
print('HASSOUN_TABLET_LAYOUT_PERSIST_V2 applied: tablet/iPad layout settings are restored and re-saved independently of legacy storage keys')
