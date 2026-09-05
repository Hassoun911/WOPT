from pathlib import Path
import runpy

# Prepare the scheduler PendingIntent extras for the v1.0.24 generation patch.
p = Path('mobile/modules/prayer-audio/android/src/main/java/ca/wopt/prayeraudio/PrayerAlarmScheduler.kt')
s = p.read_text(encoding='utf-8')
s = s.replace('      putExtra("scheduledAtMs", scheduledAtMs)\n', '', 1)
p.write_text(s, encoding='utf-8')

# Preserve active app tab and nested Settings page if Android recreates the Activity
# while the user is in a permission/settings screen.
runpy.run_path('.github/scripts/fix-v1021-resume-state.py', run_name='__main__')

# Make the final v1.0.24 patch run the user-facing permission/refresh postfix after
# its native alarm-generation changes have been applied.
patch_path = Path('.github/scripts/fix-v1024-native-alarm-refresh.py')
patch = patch_path.read_text(encoding='utf-8')
call = 'runpy.run_path(str(ROOT / ".github/scripts/post-v1024-user-runtime-fixes.py"), run_name="__main__")'
if call not in patch:
    patch += '\n\n# Apply final runtime permission/refresh fixes after v1.0.24 generation guard.\nimport runpy\n' + call + '\n'
    patch_path.write_text(patch, encoding='utf-8')

print('Prepared scheduler and chained final v1.0.24 runtime postfix')
