from pathlib import Path
import re

PAGE = Path('mobile/src/MasjidDisplayPage.tsx')
EDITOR = Path('mobile/src/ConnectDisplayPage.tsx')
page = PAGE.read_text(encoding='utf-8')
editor = EDITOR.read_text(encoding='utf-8')

# HASSOUN_TABLET_PRAYER_PERIOD_TOGGLE_V3
# Blank the prayer-period value directly from remoteTheme so this works regardless of
# JSX structure and without declaration-order issues.

# Remove an older helper declaration if a previous patch left one behind.
page = re.sub(r'^\s*const showPrayerPeriod\s*=\s*remoteTheme\.showPrayerPeriod !== false;.*\n', '', page, count=1, flags=re.M)

current_patterns = [
    '  const currentTime = prayerParts(day?.[current.key]);\n',
    '  const currentTime=prayerParts(day?.[current.key]);\n',
]
changed = False
for old in current_patterns:
    if old in page:
        new = '  const currentTimeBase = prayerParts(day?.[current.key]);\n  const currentTime = { ...currentTimeBase, period: remoteTheme.showPrayerPeriod !== false ? currentTimeBase.period : "" }; // HASSOUN_TABLET_PRAYER_PERIOD_TOGGLE_V3\n'
        page = page.replace(old, new, 1)
        changed = True
        break
if not changed:
    pat = re.compile(r'(^\s*)const currentTime\s*=\s*prayerParts\(day\?\.\[current\.key\]\);', re.M)
    m = pat.search(page)
    if m:
        indent = m.group(1)
        repl = indent + 'const currentTimeBase = prayerParts(day?.[current.key]);\n' + indent + 'const currentTime = { ...currentTimeBase, period: remoteTheme.showPrayerPeriod !== false ? currentTimeBase.period : "" }; // HASSOUN_TABLET_PRAYER_PERIOD_TOGGLE_V3'
        page = page[:m.start()] + repl + page[m.end():]
        changed = True
if not changed and 'period: remoteTheme.showPrayerPeriod !== false ? currentTimeBase.period : ""' not in page:
    raise SystemExit('v1033 prayer period: currentTime source missing')

if 'showPrayerPeriod' not in editor:
    raise SystemExit('v1033 prayer period: editor showPrayerPeriod control missing')
if 'HASSOUN_TABLET_PRAYER_PERIOD_EDITOR_V3' not in editor:
    editor += '\n// HASSOUN_TABLET_PRAYER_PERIOD_EDITOR_V3 showPrayerPeriod controls main prayer AM/PM on the native tablet.\n'

for marker in [
    'HASSOUN_TABLET_PRAYER_PERIOD_TOGGLE_V3',
    'period: remoteTheme.showPrayerPeriod !== false ? currentTimeBase.period : ""',
]:
    if marker not in page:
        raise SystemExit(f'v1033 prayer period missing marker: {marker}')

PAGE.write_text(page, encoding='utf-8')
EDITOR.write_text(editor, encoding='utf-8')
print('HASSOUN_TABLET_PRAYER_PERIOD_TOGGLE_V3 applied: Prayer AM/PM now follows the live admin ON/OFF setting')
