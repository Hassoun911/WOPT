from pathlib import Path
p = Path('mobile/modules/prayer-audio/android/src/main/java/ca/wopt/prayeraudio/PrayerAlarmScheduler.kt')
s = p.read_text(encoding='utf-8')
# v1.0.20 already carries scheduledAtMs in the PendingIntent. The v1.0.24 patch
# replaces the whole extras tail and re-adds it together with generation/isTest.
s = s.replace('      putExtra("scheduledAtMs", scheduledAtMs)\n', '', 1)
p.write_text(s, encoding='utf-8')
print('Prepared scheduler PendingIntent extras for v1.0.24 generation patch')
