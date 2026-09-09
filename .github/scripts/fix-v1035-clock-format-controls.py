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

# Normalize existing quick-control labels if they survived generation.
page = re.sub(
    r'\["clock24Hour",\s*t\("Use 24-hour clock",\s*"[^"]*"\)\]',
    '["clock24Hour",t("24-hour clock","نظام 24 ساعة")]',
    page,
    count=1,
)
page = re.sub(
    r'\["showClockPeriod",\s*t\("Clock AM / PM",\s*"[^"]*"\)\]',
    '["clock24Hour",t("24-hour clock","نظام 24 ساعة")]',
    page,
    count=1,
)

# If the generated setup no longer exposes the historical quick-control array, inject
# one explicit clock-format row at the top of the setup ScrollView. This anchor is part
# of the base native tablet setup and survives the later layout/runtime patches.
if 'clock24Hour",t("24-hour clock"' not in page and 'HASSOUN_CLOCK_LOCAL_CONTROL_V1' not in page:
    scroll_anchors = [
        '<ScrollView contentContainerStyle={styles.sheetBody}>',
        '<ScrollView contentContainerStyle={[styles.sheetBody',
    ]
    insert_at = -1
    anchor_len = 0
    for anchor in scroll_anchors:
        pos = page.find(anchor)
        if pos >= 0:
            # For the bracketed variant, only use the exact simple anchor; otherwise fall through to regex.
            if anchor.endswith('>'):
                insert_at = pos + len(anchor)
                anchor_len = len(anchor)
                break
    if insert_at < 0:
        m = re.search(r'<ScrollView[^>]*contentContainerStyle=\{[^}]*styles\.sheetBody[^}]*\}[^>]*>', page)
        if m:
            insert_at = m.end()
    if insert_at < 0:
        raise SystemExit('v1035 clock controls: setup ScrollView anchor missing')
    local_control = '''\n<View style={{marginBottom:12,padding:12,borderRadius:14,backgroundColor:"rgba(255,255,255,.08)",flexDirection:"row",alignItems:"center",justifyContent:"space-between"}}>{/* HASSOUN_CLOCK_LOCAL_CONTROL_V1 */}<View style={{flex:1,paddingRight:12}}><Text style={{color:"#ffffff",fontWeight:"900",fontSize:16}}>{t("24-hour clock","نظام 24 ساعة")}</Text><Text style={{color:"rgba(255,255,255,.72)",fontSize:12,marginTop:2}}>{remoteTheme.clock24Hour===true?t("24-hour time · no AM/PM","وقت 24 ساعة · بدون AM/PM"):t("12-hour time · AM/PM","وقت 12 ساعة · AM/PM")}</Text></View><Switch value={remoteTheme.clock24Hour===true} onValueChange={v=>localTheme({clock24Hour:v})}/></View>'''
    page = page[:insert_at] + local_control + page[insert_at:]

# If the generic quick-control array is present, make its clock switch default OFF.
if 'clock24Hour",t("24-hour clock"' in page:
    generic_patterns = [
        '<Switch value={theme[String(k)]!==false} onValueChange={v=>localTheme({[String(k)]:v})}/>',
        '<Switch value={remoteTheme[String(k)]!==false} onValueChange={v=>localTheme({[String(k)]:v})}/>',
    ]
    new_switch = '<Switch value={String(k)==="clock24Hour"?remoteTheme.clock24Hour===true:remoteTheme[String(k)]!==false} onValueChange={v=>localTheme({[String(k)]:v})}/>'
    for old in generic_patterns:
        if old in page:
            page = page.replace(old, new_switch, 1)
            break

# Paired admin: keep one clear 24-hour toggle and remove standalone Clock AM/PM.
editor = editor.replace('{bool("Use 24-hour clock","clock24Hour",th.clock24Hour===true)}', '{bool("24-hour clock","clock24Hour",th.clock24Hour===true)}', 1)
editor = editor.replace('{bool("Show AM / PM","showClockPeriod",th.showClockPeriod!==false)}', '', 1)
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
