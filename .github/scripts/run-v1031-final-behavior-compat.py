from pathlib import Path

script_path = Path('.github/scripts/fix-v1031-tablet-final-behavior.py')
source = script_path.read_text(encoding='utf-8')

old_literal = "old_exact = 'else if (result.exactAlarmGranted === false) setTabletPrayerRuntimeStatus(\"exact-alarm-permission-needed\");'"
new_literal = "old_exact = 'else if (\"exactAlarmGranted\" in result && result.exactAlarmGranted === false) setTabletPrayerRuntimeStatus(\"exact-alarm-permission-needed\");'"
if old_literal not in source:
    raise SystemExit('v1031 compat: exact-alarm matcher declaration missing')
source = source.replace(old_literal, new_literal, 1)

old_condition = "new_exact = '''else if (result.exactAlarmGranted === false) {\\n"
new_condition = "new_exact = '''else if (\"exactAlarmGranted\" in result && result.exactAlarmGranted === false) {\\n"
if old_condition not in source:
    raise SystemExit('v1031 compat: replacement exact-alarm condition missing')
source = source.replace(old_condition, new_condition, 1)

exec(compile(source, str(script_path), 'exec'))

# The final behavior patch inserts freeze/beat settings near the theme block, but the
# reconstructed tablet computes imminent prayer and starts the animation earlier in the
# component. Move only these dependency-free settings above their first use so TypeScript
# sees them before use, while leaving color/font declarations in their original location.
page_path = Path('mobile/src/MasjidDisplayPage.tsx')
page = page_path.read_text(encoding='utf-8')
freeze_line = '  const freezeBeforeMinutes = Math.max(1, Number(remoteTheme.freezeBeforeMinutes) || 5);\n'
beat_line = '  const beatEnabled = remoteTheme.beatBeforePrayer !== false;\n'
for line in (freeze_line, beat_line):
    if page.count(line) != 1:
        raise SystemExit(f'v1031 compat: expected exactly one declaration: {line.strip()}')
    page = page.replace(line, '', 1)
anchor = '  const imminentSeconds = secondsUntilPrayer(now, location.timezone, day?.[next]);\n'
if anchor not in page:
    raise SystemExit('v1031 compat: imminent prayer anchor missing')
page = page.replace(anchor, freeze_line + beat_line + anchor, 1)
if page.find('const freezeBeforeMinutes') > page.find('const imminentSeconds'):
    raise SystemExit('v1031 compat: freezeBeforeMinutes still declared after use')
if page.find('const beatEnabled') > page.find('HASSOUN_TABLET_5MIN_BEAT_V1'):
    raise SystemExit('v1031 compat: beatEnabled still declared after animation use')

# Explicit user-controlled clock format. Default is 12-hour regardless of Android locale.
# If the admin enables clock24Hour, render 24-hour time. This avoids relying on Intl's
# hour12 behavior, which some Android builds can override visually.
intl_clock_24 = 'const clock = new Intl.DateTimeFormat("en-US", { timeZone: location.timezone, hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(now);'
intl_clock_12 = 'const clock = new Intl.DateTimeFormat("en-US", { timeZone: location.timezone, hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true }).format(now);'
manual_clock = '''const clockParts = zonedParts(now, location.timezone);\n  const clock24Hour = remoteTheme.clock24Hour === true;\n  const clockHour12 = clockParts.hour % 12 || 12;\n  const clockPeriod = clockParts.hour >= 12 ? "PM" : "AM";\n  const clock = clock24Hour\n    ? `${String(clockParts.hour).padStart(2, "0")}:${String(clockParts.minute).padStart(2, "0")}:${String(clockParts.second).padStart(2, "0")}`\n    : `${String(clockHour12).padStart(2, "0")}:${String(clockParts.minute).padStart(2, "0")}:${String(clockParts.second).padStart(2, "0")} ${clockPeriod}`;'''
if intl_clock_24 in page:
    page = page.replace(intl_clock_24, manual_clock, 1)
elif intl_clock_12 in page:
    page = page.replace(intl_clock_12, manual_clock, 1)
elif 'const clock24Hour = remoteTheme.clock24Hour === true;' not in page:
    raise SystemExit('v1031 compat: tablet display clock formatter missing')
if 'const clock24Hour = remoteTheme.clock24Hour === true;' not in page:
    raise SystemExit('v1031 compat: 12/24-hour clock preference did not apply')

# Add the same setting to the tablet's local setup quick controls.
quick_old = '[["showSeconds",t("Show seconds","إظهار الثواني")],["showClockPeriod",t("Clock AM / PM","AM / PM للساعة")],["showPrayerPeriod",t("Prayer AM / PM","AM / PM للصلاة")],["showAdhan",t("Show Adhan badge","إظهار شارة الأذان")]]'
quick_new = '[["showSeconds",t("Show seconds","إظهار الثواني")],["clock24Hour",t("Use 24-hour clock","استخدام نظام 24 ساعة")],["showClockPeriod",t("Clock AM / PM","AM / PM للساعة")],["showPrayerPeriod",t("Prayer AM / PM","AM / PM للصلاة")],["showAdhan",t("Show Adhan badge","إظهار شارة الأذان")]]'
if quick_old in page:
    page = page.replace(quick_old, quick_new, 1)

page_path.write_text(page, encoding='utf-8')

# Add smart YouTube/direct-video URL background support after the final tablet page exists.
youtube_script = Path('.github/scripts/fix-v1031-youtube-video-background.py')
if not youtube_script.exists():
    raise SystemExit('v1031 compat: YouTube background patch missing')
exec(compile(youtube_script.read_text(encoding='utf-8'), str(youtube_script), 'exec'))

# Add 12/24-hour selection to the paired admin editor as well.
editor_path = Path('mobile/src/ConnectDisplayPage.tsx')
editor = editor_path.read_text(encoding='utf-8')
clock_controls_old = '{bool("Show seconds","showSeconds",th.showSeconds!==false)}{bool("Show AM / PM","showClockPeriod",th.showClockPeriod!==false)}'
clock_controls_new = '{bool("Show seconds","showSeconds",th.showSeconds!==false)}{bool("Use 24-hour clock","clock24Hour",th.clock24Hour===true)}{bool("Show AM / PM","showClockPeriod",th.showClockPeriod!==false)}'
if clock_controls_old in editor:
    editor = editor.replace(clock_controls_old, clock_controls_new, 1)
elif 'Use 24-hour clock","clock24Hour"' not in editor:
    raise SystemExit('v1031 compat: paired admin clock controls missing')
editor_path.write_text(editor, encoding='utf-8')

page = page_path.read_text(encoding='utf-8')
for marker in ['backgroundYouTubeId', 'backgroundYouTubeUrl', 'react-native-webview', 'clock24Hour']:
    if marker not in page:
        raise SystemExit(f'v1031 compat: final tablet marker missing: {marker}')
editor = editor_path.read_text(encoding='utf-8')
if 'Use 24-hour clock","clock24Hour"' not in editor:
    raise SystemExit('v1031 compat: admin 12/24-hour setting missing')

# Distinct installable build so it is obvious the device is running the clock-format fix.
cfg_path = Path('mobile/app.config.ts')
cfg = cfg_path.read_text(encoding='utf-8')
cfg = cfg.replace('version: "1.0.31"', 'version: "1.0.32"')
cfg = cfg.replace('versionCode: 75', 'versionCode: 76')
cfg_path.write_text(cfg, encoding='utf-8')

print('HASSOUN_V1032_CLOCK_FORMAT applied: explicit admin 12/24-hour clock + exact alarms + smart layout + YouTube backgrounds')
