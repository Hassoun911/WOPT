from pathlib import Path
import re

PAGE = Path('mobile/src/MasjidDisplayPage.tsx')
page = PAGE.read_text(encoding='utf-8')

# HASSOUN_TABLET_LAYOUT_PERSIST_V3
# Preserve the FINAL reconstructed tablet theme itself. The native tablet page uses
# remoteTheme/setRemoteTheme rather than the older settings/setSettings state, so this
# backup follows the real source of truth and survives a normal APK-over-APK update.

# Ensure useRef is available for the restore gate.
m = re.search(r'import \{([^}]*)\} from "react";', page, flags=re.S)
if not m:
    raise SystemExit('v1032 persistence: React import missing')
react_names = [x.strip() for x in m.group(1).split(',') if x.strip()]
if 'useRef' not in react_names:
    react_names.append('useRef')
page = page[:m.start()] + 'import { ' + ', '.join(react_names) + ' } from "react";' + page[m.end():]

if 'const LAYOUT_BACKUP_KEY = "hassoun:tablet-layout-backup:v3";' not in page:
    component_anchor = 'export default function MasjidDisplayPage'
    pos = page.find(component_anchor)
    if pos < 0:
        raise SystemExit('v1032 persistence: MasjidDisplayPage component missing')
    page = page[:pos] + 'const LAYOUT_BACKUP_KEY = "hassoun:tablet-layout-backup:v3"; // HASSOUN_TABLET_LAYOUT_PERSIST_V3\n\n' + page[pos:]

# The final native tablet has remoteTheme state after the v1.0.30 sizing patch.
state_re = re.compile(r'(  const \[remoteTheme, setRemoteTheme\] = useState<Record<string, any>>\([^\n]+\);\n)')
m = state_re.search(page)
if not m:
    raise SystemExit('v1032 persistence: final remoteTheme state missing')
if 'tabletLayoutBackupReadyRef' not in page:
    page = page[:m.end()] + '  const tabletLayoutBackupReadyRef = useRef(false);\n' + page[m.end():]

# Merge legacy native-tablet saved settings into whatever is already restored instead of
# replacing the whole theme. This avoids an older/partial record wiping newer fields.
page = page.replace(
    '          setRemoteTheme(storedTheme || {});',
    '          setRemoteTheme(current => ({ ...current, ...(storedTheme || {}) }));',
    1,
)

# Likewise, an empty/partial server response must not erase local layout settings.
page = page.replace(
    '          setRemoteTheme(incomingTheme);',
    '          setRemoteTheme(current => Object.keys(incomingTheme).length ? ({ ...current, ...incomingTheme }) : current);',
    1,
)

# Restore the independent local theme backup once. Then persist every real remoteTheme
# change. Backup values are the base; current/default or newly received values win.
if 'HASSOUN_TABLET_LAYOUT_RESTORE_EFFECT_V3' not in page:
    state_pos = page.find('  const tabletLayoutBackupReadyRef = useRef(false);\n')
    if state_pos < 0:
        raise SystemExit('v1032 persistence: restore gate missing')
    state_end = state_pos + len('  const tabletLayoutBackupReadyRef = useRef(false);\n')
    effect = '''\n  // HASSOUN_TABLET_LAYOUT_RESTORE_EFFECT_V3\n  useEffect(() => {\n    let alive = true;\n    void AsyncStorage.getItem(LAYOUT_BACKUP_KEY).then(raw => {\n      if (!alive) return;\n      if (raw) {\n        try {\n          const backupTheme = JSON.parse(raw) as Record<string, any>;\n          if (backupTheme && typeof backupTheme === "object") {\n            setRemoteTheme(current => ({ ...backupTheme, ...current }));\n          }\n        } catch {}\n      }\n      tabletLayoutBackupReadyRef.current = true;\n    });\n    return () => { alive = false; };\n  }, []);\n\n  useEffect(() => {\n    if (!tabletLayoutBackupReadyRef.current) return;\n    void AsyncStorage.setItem(LAYOUT_BACKUP_KEY, JSON.stringify(remoteTheme));\n  }, [remoteTheme]);\n'''
    page = page[:state_end] + effect + page[state_end:]

for marker in [
    'HASSOUN_TABLET_LAYOUT_PERSIST_V3',
    'HASSOUN_TABLET_LAYOUT_RESTORE_EFFECT_V3',
    'hassoun:tablet-layout-backup:v3',
    'tabletLayoutBackupReadyRef',
    'backupTheme',
    'setRemoteTheme(current => ({ ...backupTheme, ...current }))',
    'AsyncStorage.getItem(LAYOUT_BACKUP_KEY)',
    'AsyncStorage.setItem(LAYOUT_BACKUP_KEY, JSON.stringify(remoteTheme))',
]:
    if marker not in page:
        raise SystemExit(f'v1032 persistence missing marker: {marker}')

PAGE.write_text(page, encoding='utf-8')
print('HASSOUN_TABLET_LAYOUT_PERSIST_V3 applied: actual final remoteTheme survives normal APK updates without resetting newer layout fields')
