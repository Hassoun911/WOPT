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

# Local quick controls. First normalize any existing 24-hour label.
page = re.sub(
    r'\["clock24Hour",\s*t\("Use 24-hour clock",\s*"[^"]*"\)\]',
    '["clock24Hour",t("24-hour clock","نظام 24 ساعة")]',
    page,
    count=1,
)
# Replace whichever generated Clock AM/PM item exists, regardless of Arabic text/spacing.
page, replaced_period = re.subn(
    r'\["showClockPeriod",\s*t\("Clock AM / PM",\s*"[^"]*"\)\]',
    '["clock24Hour",t("24-hour clock","نظام 24 ساعة")]',
    page,
    count=1,
)

# If the generated local setup no longer exposes the old array row, inject a dedicated
# explicit switch beside the prayer alert engine status. This avoids depending on the
# historical quick-control serializer and gives clock24Hour correct OFF-by-default semantics.
if 'clock24Hour",t("24-hour clock"' not in page and 'HASSOUN_CLOCK_LOCAL_CONTROL_V1' not in page:
    status_re = re.compile(r'(<Text style=\{styles\.sheetSub\}>PRAYER ALERT ENGINE · .*?</Text>)', re.S)
    status_match = status_re.search(page)
    if not status_match:
        raise SystemExit('v1035 clock controls: no safe local setup insertion anchor')
    local_control = '''\n<View style={{marginTop:10,padding:12,borderRadius:14,backgroundColor:"rgba(255,255,255,.08)",flexDirection:"row",alignItems:"center",justifyContent:"space-between"}}>{/* HASSOUN_CLOCK_LOCAL_CONTROL_V1 */}<View style={{flex:1,paddingRight:12}}><Text style={{color:"#ffffff",fontWeight:"900",fontSize:16}}>{t("24-hour clock","نظام 24 ساعة")}</Text><Text style={{color:"rgba(255,255,255,.72)",fontSize:12,marginTop:2}}>{remoteTheme.clock24Hour===true?t("24-hour time · no AM/PM","وقت 24 ساعة · بدون AM/PM"):t("12-hour time · AM/PM","وقت 12 ساعة · AM/PM")}</Text></View><Switch value={remoteTheme.clock24Hour===true} onValueChange={v=>localTheme({clock24Hour:v})}/></View>'''
    page = page[:status_match.end()] + local_control + page[status_match.end():]

# If the local control lives in the historical generic array, ensure clock24Hour defaults OFF.
if 'clock24Hour",t("24-hour clock"' in page:
    old_switch = '<Switch value={theme[String(k)]!==false} onValueChange={v=>localTheme({[String(k)]:v})}/>'
    new_switch = '<Switch value={String(k)==="clock24Hour"?remoteTheme.clock24Hour===true:remoteTheme[String(k)]!==false} onValueChange={v=>localTheme({[String(k)]:v})}/>'
    if old_switch in page:
        page = page.replace(old_switch, new_switch, 1)
    else:
        # Generated tablet pages normally use remoteTheme instead of theme after the live-theme patch.
        old_remote = '<Switch value={remoteTheme[String(k)]!==false} onValueChange={v=>localTheme({[String(k)]:v})}/>'
        if old_remote in page:
            page = page.replace(old_remote, new_switch, 1)

# Paired admin: remove standalone clock AM/PM; it is inherent in 12-hour format.
editor = editor.replace('{bool("Use 24-hour clock","clock24Hour",th.clock24Hour===true)}', '{bool("24-hour clock","clock24Hour",th.clock24Hour===true)}', 1)
editor = editor.replace('{bool("Show AM / PM","showClockPeriod",th.showClockPeriod!==false)}', '', 1)
# Broader generated variants.
editor = re.sub(r'\{bool\("Show AM / PM","showClockPeriod",[^}]+\)\}', '', editor, count=1)
if '24-hour clock","clock24Hour"' not in editor:
    raise SystemExit('v1035 clock controls: admin clock-format control missing')

for marker in [
    'HASSOUN_TABLET_CLOCK_FORMAT_CONTROLS_V1',
    'forcedClockShowSecondsV1035',
    'forcedClockSuffixV1035',
    'Prayer AM / PM',
]:
    if marker not in page:
        raise SystemExit(f'v1035 clock controls missing marker: {marker}')
if 'clock24Hour",t("24-hour clock"' not in page and 'HASSOUN_CLOCK_LOCAL_CONTROL_V1' not in page:
    raise SystemExit('v1035 clock controls: local 24-hour control missing after normalization')
if re.search(r'\["showClockPeriod",\s*t\("Clock AM / PM"', page):
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
