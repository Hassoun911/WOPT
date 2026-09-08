from pathlib import Path
import re

PAGE = Path('mobile/src/MasjidDisplayPage.tsx')
page = PAGE.read_text(encoding='utf-8')

# Stable backup key intentionally survives normal APK updates because Android keeps
# app data/AsyncStorage when installing a newer APK over the existing Hassoun app.
if 'HASSOUN_TABLET_LAYOUT_PERSIST_V1' not in page:
    # Add a second durable local copy beside the existing tablet settings key.
    key_anchor = 'SETTINGS_KEY="hassoun:native-wall-display:v3"'
    if key_anchor in page:
        page = page.replace(key_anchor, key_anchor + ',LAYOUT_BACKUP_KEY="hassoun:tablet-layout-backup:v1"', 1)
    else:
        # Final reconstructed page can use const declarations with spaces.
        m = re.search(r'(const SETTINGS_KEY\s*=\s*["\']hassoun:native-wall-display:v3["\'];?)', page)
        if not m:
            raise SystemExit('v1032 persistence: SETTINGS_KEY declaration missing')
        page = page[:m.end()] + '\nconst LAYOUT_BACKUP_KEY = "hassoun:tablet-layout-backup:v1"; // HASSOUN_TABLET_LAYOUT_PERSIST_V1' + page[m.end():]

    # Mark the compact declaration path too.
    if 'HASSOUN_TABLET_LAYOUT_PERSIST_V1' not in page:
        page = page.replace('LAYOUT_BACKUP_KEY="hassoun:tablet-layout-backup:v1"', 'LAYOUT_BACKUP_KEY="hassoun:tablet-layout-backup:v1"/* HASSOUN_TABLET_LAYOUT_PERSIST_V1 */', 1)

# Startup: read both the normal settings object and the backup. The current settings
# win when both exist, but old/custom tabletTheme values from the backup are retained
# if a newer APK introduces defaults or a renamed field.
old_promise = 'Promise.all([AsyncStorage.getItem(SETTINGS_KEY),AsyncStorage.getItem(DEVICE_KEY),loadInitialPrayerTimes()])'
new_promise = 'Promise.all([AsyncStorage.getItem(SETTINGS_KEY),AsyncStorage.getItem(LAYOUT_BACKUP_KEY),AsyncStorage.getItem(DEVICE_KEY),loadInitialPrayerTimes()])'
if old_promise in page:
    page = page.replace(old_promise, new_promise, 1)
    page = page.replace('const [rawS,rawD,loaded]=await ' + new_promise, 'const [rawS,rawBackup,rawD,loaded]=await ' + new_promise, 1)
elif new_promise not in page:
    # Expanded formatting fallback.
    page = page.replace('AsyncStorage.getItem(SETTINGS_KEY),\n', 'AsyncStorage.getItem(SETTINGS_KEY),\n          AsyncStorage.getItem(LAYOUT_BACKUP_KEY),\n', 1)

# Compact startup parser used by the canonical tablet page.
compact = 'let s:Record<string,any>={};if(rawS)try{s=JSON.parse(rawS)}catch{}setSettings(s);'
if compact in page:
    repl = 'let s:Record<string,any>={};let backup:Record<string,any>={};if(rawBackup)try{backup=JSON.parse(rawBackup)}catch{}if(rawS)try{s=JSON.parse(rawS)}catch{}s={...backup,...s,tabletTheme:{...(backup.tabletTheme&&typeof backup.tabletTheme==="object"?backup.tabletTheme:{}),...(s.tabletTheme&&typeof s.tabletTheme==="object"?s.tabletTheme:{})}};setSettings(s);void AsyncStorage.setItem(LAYOUT_BACKUP_KEY,JSON.stringify(s));'
    page = page.replace(compact, repl, 1)
else:
    # Expanded page fallback: merge immediately after parsed settings are available.
    anchor = 'setSettings(s);'
    if anchor in page and 'rawBackup' in page and 'backup.tabletTheme' not in page:
        page = page.replace(anchor, 's={...backup,...s,tabletTheme:{...(backup.tabletTheme&&typeof backup.tabletTheme==="object"?backup.tabletTheme:{}),...(s.tabletTheme&&typeof s.tabletTheme==="object"?s.tabletTheme:{})}};\n          ' + anchor + '\n          void AsyncStorage.setItem(LAYOUT_BACKUP_KEY,JSON.stringify(s));', 1)

# Any local quick-control change writes both copies.
old_local = 'void AsyncStorage.setItem(SETTINGS_KEY,JSON.stringify(n))'
new_local = 'void Promise.all([AsyncStorage.setItem(SETTINGS_KEY,JSON.stringify(n)),AsyncStorage.setItem(LAYOUT_BACKUP_KEY,JSON.stringify(n))])'
page = page.replace(old_local, new_local)

# Any settings received from the paired admin are also stored in both copies.
old_remote = 'await AsyncStorage.setItem(SETTINGS_KEY,JSON.stringify(d.settings))'
new_remote = 'await Promise.all([AsyncStorage.setItem(SETTINGS_KEY,JSON.stringify(d.settings)),AsyncStorage.setItem(LAYOUT_BACKUP_KEY,JSON.stringify(d.settings))])'
page = page.replace(old_remote, new_remote)

# Verify the preservation logic exists in the final reconstructed page.
for marker in [
    'HASSOUN_TABLET_LAYOUT_PERSIST_V1',
    'hassoun:tablet-layout-backup:v1',
    'AsyncStorage.getItem(LAYOUT_BACKUP_KEY)',
    'backup.tabletTheme',
    'AsyncStorage.setItem(LAYOUT_BACKUP_KEY',
]:
    if marker not in page:
        raise SystemExit(f'v1032 persistence missing marker: {marker}')

PAGE.write_text(page, encoding='utf-8')
print('HASSOUN_TABLET_LAYOUT_PERSIST_V1 applied: tablet/iPad layout, theme, sizing, background and clock preferences survive APK updates')
