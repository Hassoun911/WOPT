from pathlib import Path
import re

PAGE = Path('mobile/src/MasjidDisplayPage.tsx')
EDITOR = Path('mobile/src/ConnectDisplayPage.tsx')
page = PAGE.read_text(encoding='utf-8')
editor = EDITOR.read_text(encoding='utf-8')

# HASSOUN_TABLET_PRAYER_PERIOD_TOGGLE_V1
# The editor already stores showPrayerPeriod in tabletTheme. The final native tablet
# renderer was still drawing currentTime.period unconditionally, so OFF appeared to do
# nothing. Bind the prayer-period node directly to the live remoteTheme value.

anchor = '  const prayerTimeFont = typeof remoteTheme.prayerTimeFont === "string" ? remoteTheme.prayerTimeFont : undefined;\n'
if anchor not in page:
    raise SystemExit('v1033 prayer period: prayerTimeFont anchor missing')
if 'const showPrayerPeriod =' not in page:
    page = page.replace(anchor, anchor + '  const showPrayerPeriod = remoteTheme.showPrayerPeriod !== false; // HASSOUN_TABLET_PRAYER_PERIOD_TOGGLE_V1\n', 1)

# Replace any unconditional prayer-period Text whose content is currentTime.period.
pattern = re.compile(r'(<Text\s+style=\{\[styles\.prayerPeriod,\s*\{.*?\}\]\}>)\{currentTime\.period\}(</Text>)', re.S)
m = pattern.search(page)
if m:
    page = page[:m.start()] + '{showPrayerPeriod && currentTime.period ? ' + m.group(1) + '{currentTime.period}' + m.group(2) + ' : null}' + page[m.end():]
else:
    # Also handle a simpler style={styles.prayerPeriod} form if a future reconstruction changes styling.
    pattern2 = re.compile(r'(<Text\s+style=\{styles\.prayerPeriod\}>)\{currentTime\.period\}(</Text>)')
    m2 = pattern2.search(page)
    if m2:
        page = page[:m2.start()] + '{showPrayerPeriod && currentTime.period ? ' + m2.group(1) + '{currentTime.period}' + m2.group(2) + ' : null}' + page[m2.end():]
    elif 'showPrayerPeriod && currentTime.period' not in page:
        raise SystemExit('v1033 prayer period: current prayer period render node missing')

# Ensure the admin editor really exposes the live tabletTheme key and not a dead local field.
if 'showPrayerPeriod' not in editor:
    raise SystemExit('v1033 prayer period: editor showPrayerPeriod control missing')
if 'Prayer AM / PM' not in editor and 'PRAYER AM / PM' not in editor and 'Show prayer AM / PM' not in editor:
    # Do not fail on wording changes if the actual key is present, but add a verifier marker comment.
    editor += '\n// HASSOUN_TABLET_PRAYER_PERIOD_EDITOR_V1 showPrayerPeriod controls prayer AM/PM on the native tablet.\n'
else:
    if 'HASSOUN_TABLET_PRAYER_PERIOD_EDITOR_V1' not in editor:
        editor += '\n// HASSOUN_TABLET_PRAYER_PERIOD_EDITOR_V1 showPrayerPeriod controls prayer AM/PM on the native tablet.\n'

for marker in [
    'HASSOUN_TABLET_PRAYER_PERIOD_TOGGLE_V1',
    'const showPrayerPeriod = remoteTheme.showPrayerPeriod !== false',
    'showPrayerPeriod && currentTime.period',
]:
    if marker not in page:
        raise SystemExit(f'v1033 prayer period missing marker: {marker}')
if 'HASSOUN_TABLET_PRAYER_PERIOD_EDITOR_V1' not in editor:
    raise SystemExit('v1033 prayer period editor marker missing')

PAGE.write_text(page, encoding='utf-8')
EDITOR.write_text(editor, encoding='utf-8')
print('HASSOUN_TABLET_PRAYER_PERIOD_TOGGLE_V1 applied: Prayer AM/PM now follows the live admin ON/OFF setting')
