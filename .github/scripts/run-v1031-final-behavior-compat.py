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

# Force the visible local clock to 12-hour format ourselves. Do not rely on Intl hour12
# because some Android runtimes/device locales can still render a 24-hour clock.
intl_clock_24 = 'const clock = new Intl.DateTimeFormat("en-US", { timeZone: location.timezone, hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(now);'
intl_clock_12 = 'const clock = new Intl.DateTimeFormat("en-US", { timeZone: location.timezone, hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true }).format(now);'
manual_clock = '''const clockParts = zonedParts(now, location.timezone);\n  const clockHour12 = clockParts.hour % 12 || 12;\n  const clockPeriod = clockParts.hour >= 12 ? "PM" : "AM";\n  const clock = `${String(clockHour12).padStart(2, "0")}:${String(clockParts.minute).padStart(2, "0")}:${String(clockParts.second).padStart(2, "0")} ${clockPeriod}`;'''
if intl_clock_24 in page:
    page = page.replace(intl_clock_24, manual_clock, 1)
elif intl_clock_12 in page:
    page = page.replace(intl_clock_12, manual_clock, 1)
else:
    raise SystemExit('v1031 compat: tablet display clock formatter missing')
if 'const clockHour12 = clockParts.hour % 12 || 12;' not in page or 'const clockPeriod = clockParts.hour >= 12 ? "PM" : "AM";' not in page:
    raise SystemExit('v1031 compat: deterministic 12-hour clock update did not apply')
if 'hour12: false }).format(now);' in page:
    raise SystemExit('v1031 compat: visible 24-hour clock formatter survived')

page_path.write_text(page, encoding='utf-8')

# Add smart YouTube/direct-video URL background support after the final tablet page exists.
youtube_script = Path('.github/scripts/fix-v1031-youtube-video-background.py')
if not youtube_script.exists():
    raise SystemExit('v1031 compat: YouTube background patch missing')
exec(compile(youtube_script.read_text(encoding='utf-8'), str(youtube_script), 'exec'))

page = page_path.read_text(encoding='utf-8')
for marker in ['backgroundYouTubeId', 'backgroundYouTubeUrl', 'react-native-webview']:
    if marker not in page:
        raise SystemExit(f'v1031 compat: YouTube background marker missing: {marker}')

print('HASSOUN_V1031_FINAL_BEHAVIOR_COMPAT applied: exact alarms + declaration order + deterministic 12-hour clock + YouTube video backgrounds')
