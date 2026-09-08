from pathlib import Path
import re

PAGE = Path('mobile/src/MasjidDisplayPage.tsx')
EDITOR = Path('mobile/src/ConnectDisplayPage.tsx')
page = PAGE.read_text(encoding='utf-8')
editor = EDITOR.read_text(encoding='utf-8')

# HASSOUN_TABLET_PRAYER_PERIOD_TOGGLE_V2
# Make the Prayer AM/PM setting renderer-independent by blanking the period at the
# currentTime source whenever showPrayerPeriod is OFF. Any existing Text layout then
# automatically hides it without depending on exact JSX structure.

anchor = '  const prayerTimeFont = typeof remoteTheme.prayerTimeFont === "string" ? remoteTheme.prayerTimeFont : undefined;\n'
if anchor not in page:
    raise SystemExit('v1033 prayer period: prayerTimeFont anchor missing')
if 'const showPrayerPeriod =' not in page:
    page = page.replace(anchor, anchor + '  const showPrayerPeriod = remoteTheme.showPrayerPeriod !== false; // HASSOUN_TABLET_PRAYER_PERIOD_TOGGLE_V2\n', 1)

current_patterns = [
    '  const currentTime = prayerParts(day?.[current.key]);\n',
    '  const currentTime=prayerParts(day?.[current.key]);\n',
]
changed = False
for old in current_patterns:
    if old in page:
        indent = '  '
        new = indent + 'const currentTimeBase = prayerParts(day?.[current.key]);\n' + indent + 'const currentTime = { ...currentTimeBase, period: showPrayerPeriod ? currentTimeBase.period : "" };\n'
        page = page.replace(old, new, 1)
        changed = True
        break
if not changed:
    # Handle compressed or typed variants.
    pat = re.compile(r'(^\s*)const currentTime\s*=\s*prayerParts\(day\?\.\[current\.key\]\);', re.M)
    m = pat.search(page)
    if m:
        indent = m.group(1)
        repl = indent + 'const currentTimeBase = prayerParts(day?.[current.key]);\n' + indent + 'const currentTime = { ...currentTimeBase, period: showPrayerPeriod ? currentTimeBase.period : "" };'
        page = page[:m.start()] + repl + page[m.end():]
        changed = True
if not changed and 'period: showPrayerPeriod ? currentTimeBase.period : ""' not in page:
    raise SystemExit('v1033 prayer period: currentTime source missing')

if 'showPrayerPeriod' not in editor:
    raise SystemExit('v1033 prayer period: editor showPrayerPeriod control missing')
if 'HASSOUN_TABLET_PRAYER_PERIOD_EDITOR_V2' not in editor:
    editor += '\n// HASSOUN_TABLET_PRAYER_PERIOD_EDITOR_V2 showPrayerPeriod controls main prayer AM/PM on the native tablet.\n'

for marker in [
    'HASSOUN_TABLET_PRAYER_PERIOD_TOGGLE_V2',
    'const showPrayerPeriod = remoteTheme.showPrayerPeriod !== false',
    'period: showPrayerPeriod ? currentTimeBase.period : ""',
]:
    if marker not in page:
        raise SystemExit(f'v1033 prayer period missing marker: {marker}')

PAGE.write_text(page, encoding='utf-8')
EDITOR.write_text(editor, encoding='utf-8')
print('HASSOUN_TABLET_PRAYER_PERIOD_TOGGLE_V2 applied: Prayer AM/PM now follows the live admin ON/OFF setting regardless of JSX layout')
