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
print('HASSOUN_V1031_FINAL_BEHAVIOR_COMPAT applied: guarded exact-alarm branch supported')
