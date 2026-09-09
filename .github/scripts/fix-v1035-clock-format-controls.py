from pathlib import Path
import re

PAGE = Path('mobile/src/MasjidDisplayPage.tsx')
EDITOR = Path('mobile/src/ConnectDisplayPage.tsx')
page = PAGE.read_text(encoding='utf-8')
editor = EDITOR.read_text(encoding='utf-8')

# HASSOUN_TABLET_CLOCK_FORMAT_CONTROLS_V1
# Make clock format atomic and predictable:
# - 12-hour mode ALWAYS shows AM/PM.
# - 24-hour mode NEVER shows AM/PM.
# - seconds remain independently configurable.
# Remove the confusing standalone Clock AM/PM toggle from local/admin controls.

forced_re = re.compile(
    r'  // HASSOUN_TABLET_FORCED_CLOCK_V3\n'
    r'  const forcedClockPartsV1033 = zonedParts\(now, location\.timezone\);\n'
    r'  const forcedClock24HourV1033 = remoteTheme\.clock24Hour === true;\n'
    r'  const forcedClockHour12V1033 = forcedClockPartsV1033\.hour % 12 \|\| 12;\n'
    r'  const forcedClockPeriodV1033 = forcedClockPartsV1033\.hour >= 12 \? "PM" : "AM";\n'
    r'  const forcedClockTextV1033 = forcedClock24HourV1033\n'
    r'    \? `\$\{String\(forcedClockPartsV1033\.hour\).*?`\n'
    r'    : `\$\{String\(forcedClockHour12V1033\).*?`;\n',
    re.S,
)
if not forced_re.search(page):
    raise SystemExit('v1035 clock controls: forced clock block missing')

clock = '''  // HASSOUN_TABLET_FORCED_CLOCK_V3\n  // HASSOUN_TABLET_CLOCK_FORMAT_CONTROLS_V1\n  const forcedClockPartsV1033 = zonedParts(now, location.timezone);\n  const forcedClock24HourV1033 = remoteTheme.clock24Hour === true;\n  const forcedClockShowSecondsV1035 = remoteTheme.showSeconds !== false;\n  const forcedClockHour12V1033 = forcedClockPartsV1033.hour % 12 || 12;\n  const forcedClockPeriodV1033 = forcedClockPartsV1033.hour >= 12 ? "PM" : "AM";\n  const forcedClockMinuteV1035 = String(forcedClockPartsV1033.minute).padStart(2,"0");\n  const forcedClockSecondV1035 = String(forcedClockPartsV1033.second).padStart(2,"0");\n  const forcedClockSuffixV1035 = forcedClockShowSecondsV1035 ? `:${forcedClockSecondV1035}` : "";\n  const forcedClockTextV1033 = forcedClock24HourV1033\n    ? `${String(forcedClockPartsV1033.hour).padStart(2,"0")}:${forcedClockMinuteV1035}${forcedClockSuffixV1035}`\n    : `${String(forcedClockHour12V1033).padStart(2,"0")}:${forcedClockMinuteV1035}${forcedClockSuffixV1035} ${forcedClockPeriodV1033}`;\n'''
page = forced_re.sub(clock, page, count=1)

# Local quick controls: one clear 24-hour toggle; 12-hour is simply OFF.
# AM/PM is automatically tied to 12-hour mode, so remove the contradictory toggle.
quick_patterns = [
    '[["showSeconds",t("Show seconds","إظهار الثواني")],["clock24Hour",t("Use 24-hour clock","استخدام نظام 24 ساعة")],["showClockPeriod",t("Clock AM / PM","AM / PM للساعة")],["showPrayerPeriod",t("Prayer AM / PM","AM / PM للصلاة")],["showAdhan",t("Show Adhan badge","إظهار شارة الأذان")]]',
    '[["showSeconds",t("Show seconds","إظهار الثواني")],["clock24Hour",t("Use 24-hour clock","استخدام نظام 24 ساعة")],["showPrayerPeriod",t("Prayer AM / PM","AM / PM للصلاة")],["showAdhan",t("Show Adhan badge","إظهار شارة الأذان")]]',
]
quick_new = '[["showSeconds",t("Show seconds","إظهار الثواني")],["clock24Hour",t("24-hour clock","نظام 24 ساعة")],["showPrayerPeriod",t("Prayer AM / PM","AM / PM للصلاة")],["showAdhan",t("Show Adhan badge","إظهار شارة الأذان")]]'
changed_quick = False
for old in quick_patterns:
    if old in page:
        page = page.replace(old, quick_new, 1)
        changed_quick = True
        break
if not changed_quick and '24-hour clock' not in page:
    raise SystemExit('v1035 clock controls: local quick-control row missing')

# Paired admin: remove standalone clock AM/PM; it is inherent in 12-hour format.
editor_old = '{bool("Show seconds","showSeconds",th.showSeconds!==false)}{bool("Use 24-hour clock","clock24Hour",th.clock24Hour===true)}{bool("Show AM / PM","showClockPeriod",th.showClockPeriod!==false)}'
editor_new = '{bool("Show seconds","showSeconds",th.showSeconds!==false)}{bool("24-hour clock","clock24Hour",th.clock24Hour===true)}'
if editor_old in editor:
    editor = editor.replace(editor_old, editor_new, 1)
else:
    editor = editor.replace('{bool("Use 24-hour clock","clock24Hour",th.clock24Hour===true)}', '{bool("24-hour clock","clock24Hour",th.clock24Hour===true)}', 1)
    editor = editor.replace('{bool("Show AM / PM","showClockPeriod",th.showClockPeriod!==false)}', '', 1)
if '24-hour clock","clock24Hour"' not in editor:
    raise SystemExit('v1035 clock controls: admin clock-format control missing')

# Remove stale helper usage if the generated page still computes a separate clock period.
# We intentionally do not delete the persisted key so upgrades remain backward compatible.

for marker in [
    'HASSOUN_TABLET_CLOCK_FORMAT_CONTROLS_V1',
    'forcedClockShowSecondsV1035',
    'forcedClockSuffixV1035',
    '24-hour clock',
    'Prayer AM / PM',
]:
    if marker not in page:
        raise SystemExit(f'v1035 clock controls missing marker: {marker}')

PAGE.write_text(page, encoding='utf-8')
EDITOR.write_text(editor, encoding='utf-8')

cfg_path = Path('mobile/app.config.ts')
cfg = cfg_path.read_text(encoding='utf-8')
cfg, n1 = re.subn(r'(?m)^(\s*)version\s*:.*?,\s*$', r'\1version: "1.0.35",', cfg, count=1)
cfg, n2 = re.subn(r'(?m)^(\s*)versionCode\s*:\s*\d+\s*,?\s*$', r'\1versionCode: 79,', cfg, count=1)
if n1 != 1 or n2 != 1:
    raise SystemExit(f'v1035 clock controls version bump failed: version={n1}, versionCode={n2}')
cfg_path.write_text(cfg, encoding='utf-8')

print('HASSOUN_TABLET_CLOCK_FORMAT_CONTROLS_V1 applied: clean 12h/24h behavior, automatic AM/PM, independent seconds; v1.0.35/79')
