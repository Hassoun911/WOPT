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

# Local quick controls. Replace the old Clock AM/PM control itself with the single
# 24-hour mode control. This is more robust than depending on the entire generated row.
page = page.replace('["clock24Hour",t("Use 24-hour clock","استخدام نظام 24 ساعة")]', '["clock24Hour",t("24-hour clock","نظام 24 ساعة")]', 1)
page = page.replace('["showClockPeriod",t("Clock AM / PM","AM / PM للساعة")]', '["clock24Hour",t("24-hour clock","نظام 24 ساعة")]', 1)
# Avoid duplicates if an earlier compat pass already inserted clock24Hour.
needle = '["clock24Hour",t("24-hour clock","نظام 24 ساعة")]'
first = page.find(needle)
if first >= 0:
    second = page.find(needle, first + len(needle))
    if second >= 0:
        prefix = page[:second]
        suffix = page[second + len(needle):]
        if prefix.endswith(','):
            prefix = prefix[:-1]
        elif suffix.startswith(','):
            suffix = suffix[1:]
        page = prefix + suffix
if needle not in page:
    raise SystemExit('v1035 clock controls: local 24-hour control missing')

# The generic local switch historically treated undefined as ON. clock24Hour must default OFF
# so a fresh install starts in 12-hour mode.
old_switch = '<Switch value={theme[String(k)]!==false} onValueChange={v=>localTheme({[String(k)]:v})}/>'
new_switch = '<Switch value={String(k)==="clock24Hour"?theme.clock24Hour===true:theme[String(k)]!==false} onValueChange={v=>localTheme({[String(k)]:v})}/>'
if old_switch in page:
    page = page.replace(old_switch, new_switch, 1)
elif 'String(k)==="clock24Hour"?theme.clock24Hour===true' not in page:
    # Handle compact/generated variants without relying on whitespace.
    page, n = re.subn(
        r'<Switch\s+value=\{theme\[String\(k\)\]!==false\}\s+onValueChange=\{v=>localTheme\(\{\[String\(k\)\]:v\}\)\}/>',
        new_switch,
        page,
        count=1,
    )
    if n != 1:
        raise SystemExit('v1035 clock controls: local switch semantics missing')

# Paired admin: remove standalone clock AM/PM; it is inherent in 12-hour format.
editor = editor.replace('{bool("Use 24-hour clock","clock24Hour",th.clock24Hour===true)}', '{bool("24-hour clock","clock24Hour",th.clock24Hour===true)}', 1)
editor = editor.replace('{bool("Show AM / PM","showClockPeriod",th.showClockPeriod!==false)}', '', 1)
if '24-hour clock","clock24Hour"' not in editor:
    raise SystemExit('v1035 clock controls: admin clock-format control missing')

for marker in [
    'HASSOUN_TABLET_CLOCK_FORMAT_CONTROLS_V1',
    'forcedClockShowSecondsV1035',
    'forcedClockSuffixV1035',
    '24-hour clock',
    'Prayer AM / PM',
    'String(k)==="clock24Hour"?theme.clock24Hour===true',
]:
    if marker not in page:
        raise SystemExit(f'v1035 clock controls missing marker: {marker}')

if '["showClockPeriod",t("Clock AM / PM"' in page:
    raise SystemExit('v1035 clock controls: obsolete local Clock AM/PM control survived')

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
